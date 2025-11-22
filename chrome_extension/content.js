// InvestHer Content Script

// --- Configuration ---
const SUPABASE_FUNCTION_URL = "https://tyjbjqflvjwdqjvwqjvw.supabase.co/functions/v1/generate-coaching";
const USER_ID = "user_123"; // Mock user ID

// --- State ---
let isPopupOpen = false;

// --- Helper Functions ---
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

function calculateAlternatives(price) {
  const coffeePrice = 6;
  const groceryWeekPrice = 100;
  
  const numCoffees = Math.floor(price / coffeePrice);
  const numGroceries = (price / groceryWeekPrice).toFixed(1);
  
  return [
    `${numCoffees} fancy coffees with friends`,
    `${numGroceries} weeks of groceries`,
    "Extra payment toward your goals"
  ];
}

// --- UI Generation ---
function createCoachPopup(productName, price) {
  if (isPopupOpen) return;
  isPopupOpen = true;

  // Create Overlay
  const overlay = document.createElement('div');
  overlay.id = 'investher-popup-overlay';
  
  // Create Container
  const container = document.createElement('div');
  container.id = 'investher-popup-container';
  
  // Initial State (Immediate Show with Loading placeholders)
  container.innerHTML = `
    <button class="investher-close-btn" id="investher-close-x">×</button>
    <div class="investher-header">
      <h1 class="investher-title">Before You Buy</h1>
      <div class="investher-price">${formatCurrency(price)}</div>
      <div class="investher-subtitle">Could be used for...</div>
    </div>
    
    <div class="investher-content">
      <!-- Loading State for Content -->
      <div id="investher-loading-state" class="investher-loading">
        <div class="investher-spinner"></div>
        <div>Finding better alternatives...</div>
      </div>

      <!-- Content (Hidden initially) -->
      <div id="investher-loaded-content" style="display: none;">
        <div class="investher-alt-list" id="investher-alt-list">
          <!-- Alternatives will be injected here -->
        </div>

        <div class="investher-grid">
          <div class="investher-card">
            <div class="investher-card-icon-circle investher-icon-pink">✨</div>
            <div class="investher-card-title">Pros</div>
            <div class="investher-card-text" id="investher-pro-text">You'll feel great wearing this</div>
          </div>
          <div class="investher-card">
            <div class="investher-card-icon-circle investher-icon-red">📉</div>
            <div class="investher-card-title">Cons</div>
            <div class="investher-card-text" id="investher-con-text">Do you really need it right now?</div>
          </div>
        </div>

        <div class="investher-actions">
          <button id="investher-save-btn" class="investher-btn investher-btn-primary">
            Commit to Savings
          </button>
          <button id="investher-buy-btn" class="investher-btn investher-btn-secondary">
            Continue Payment
          </button>
        </div>
      </div>
    </div>
  `;
  
  overlay.appendChild(container);
  document.body.appendChild(overlay);

  // Close Handlers
  const close = () => {
    overlay.remove();
    isPopupOpen = false;
    // Prevent re-opening in this session
    sessionStorage.setItem('investher_dismissed', 'true');
  };
  
  document.getElementById('investher-close-x').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  // Fetch Coaching Data
  fetch(SUPABASE_FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      item_name: productName, 
      price: price, 
      description: "Online shopping item",
      user_id: USER_ID 
    })
  })
  .then(res => res.json())
  .then(data => {
    // Hide Loading, Show Content
    document.getElementById('investher-loading-state').style.display = 'none';
    document.getElementById('investher-loaded-content').style.display = 'block';

    // Populate Alternatives
    const altList = document.getElementById('investher-alt-list');
    const icons = ['☕', '🛒', '💰']; // Coffee, Cart, Money Bag
    
    const alternatives = data.alternatives || calculateAlternatives(price);

    altList.innerHTML = alternatives.slice(0, 3).map((alt, index) => `
      <div class="investher-alt-item">
        <div class="investher-alt-icon">${icons[index] || ''}</div>
        <div class="investher-alt-text">${alt}</div>
      </div>
    `).join('');

    // Populate Pros/Cons
    if (data.pro) document.getElementById('investher-pro-text').innerText = data.pro;
    if (data.con) document.getElementById('investher-con-text').innerText = data.con;

    // Button Handlers
    document.getElementById('investher-save-btn').addEventListener('click', () => {
      // TODO: Save logic
      close();
      chrome.runtime.sendMessage({ action: "closeTab" });
    });

    document.getElementById('investher-buy-btn').addEventListener('click', close);

  })
  .catch(err => {
    console.error("InvestHer Error:", err);
    // Show default content on error
    document.getElementById('investher-loading-state').style.display = 'none';
    document.getElementById('investher-loaded-content').style.display = 'block';
    
    // Populate with defaults
    const altList = document.getElementById('investher-alt-list');
    const defaults = calculateAlternatives(price);
    
    altList.innerHTML = `
      <div class="investher-alt-item">
        <div class="investher-alt-icon">☕</div>
        <div class="investher-alt-text">${defaults[0]}</div>
      </div>
      <div class="investher-alt-item">
        <div class="investher-alt-icon">🛒</div>
        <div class="investher-alt-text">${defaults[1]}</div>
      </div>
      <div class="investher-alt-item">
        <div class="investher-alt-icon">💰</div>
        <div class="investher-alt-text">${defaults[2]}</div>
      </div>
    `;
    
    document.getElementById('investher-save-btn').addEventListener('click', () => {
      close();
      chrome.runtime.sendMessage({ action: "closeTab" });
    });
    document.getElementById('investher-buy-btn').addEventListener('click', close);
  });
}

// --- Detection Logic ---
function detectProduct() {
  // Check if already dismissed in this session
  if (sessionStorage.getItem('investher_dismissed') === 'true') return;
  
  // Prevent multiple popups
  if (document.getElementById('investher-popup-overlay')) return;

  // 1. Check for Cart Totals first (Higher priority)
  const totalSelectors = [
    '.sc-subtotal-amount-activecart', // Amazon Cart
    '.cart-total .price', // Shopify
    '.order-total .value',
    '[data-test-id="TOTAL"]',
    '.summary-total .price'
  ];

  let price = 0;
  let title = "Your Cart";

  for (const selector of totalSelectors) {
    const el = document.querySelector(selector);
    if (el) {
      const text = el.innerText.replace(/[^0-9.]/g, '');
      const p = parseFloat(text);
      if (!isNaN(p) && p > 0) {
        price = p;
        console.log("InvestHer: Detected Cart Total", price);
        break;
      }
    }
  }

  // 2. If no cart total, check for single product price
  if (price === 0) {
    const priceSelectors = [
      '.a-price .a-offscreen', // Amazon Product
      '.price',
      '[itemprop="price"]',
      '.product-price',
      '.price-box__price'
    ];

    for (const selector of priceSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        const text = el.innerText.replace(/[^0-9.]/g, '');
        const p = parseFloat(text);
        if (!isNaN(p) && p > 0) {
          price = p;
          
          // Try to find title
          const titleSelectors = ['#productTitle', 'h1', '.product-title'];
          for (const tSel of titleSelectors) {
            const tEl = document.querySelector(tSel);
            if (tEl) {
              title = tEl.innerText.trim();
              break;
            }
          }
          
          console.log("InvestHer: Detected Product Price", price);
          break;
        }
      }
    }
  }

  if (price > 0) {
    // IMMEDIATE POPUP
    createCoachPopup(title, price);
  }
}

// Run detection immediately and then check again shortly after for dynamic content
detectProduct();
// Check a few times for dynamic SPAs
setTimeout(detectProduct, 2000);
setTimeout(detectProduct, 5000);
