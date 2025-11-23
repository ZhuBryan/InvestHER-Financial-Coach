// InvestHer Content Script

// --- Configuration ---
// Use values from config.js if available, otherwise fallback (but ensure fallback is correct)
const PROJECT_REF = "paxhkncmathdqqnnvgtb"; 
const SUPABASE_FUNCTION_URL = `https://${PROJECT_REF}.supabase.co/functions/v1/generate-coaching`;
const SUPABASE_LOG_URL = `https://${PROJECT_REF}.supabase.co/functions/v1/log-purchase`;
// const USER_ID = "user_123"; // Removed hardcoded ID

// --- State ---
let isPopupOpen = false;
let currentMetadata = null; // Store extracted metadata from Gemini
let currentUserId = null; 

// Initialize user ID from storage
chrome.storage.local.get(['user'], (result) => {
  if (result.user) {
    currentUserId = result.user.id;
  }
});

// --- Session Sync Logic ---

function checkDashboardSession() {
  // Only run on the dashboard URL (localhost ports)
  if (window.location.hostname === 'localhost' && ['3000', '3001', '5173'].includes(window.location.port)) {
    console.log("InvestHer: Checking for dashboard session...");
    
    // Supabase stores session in localStorage with key: sb-<project-ref>-auth-token
    const sessionKey = `sb-${PROJECT_REF}-auth-token`;
    const sessionStr = localStorage.getItem(sessionKey);

    if (sessionStr) {
      try {
        const session = JSON.parse(sessionStr);
        if (session && session.access_token && session.user) {
          console.log("InvestHer: Found session, syncing to extension...");
          currentUserId = session.user.id;
          chrome.runtime.sendMessage({
            type: "SYNC_SESSION",
            session: {
              access_token: session.access_token,
              refresh_token: session.refresh_token,
              user: session.user
            }
          });
        }
      } catch (e) {
        console.error("InvestHer: Failed to parse session", e);
      }
    }
  }
}

// Run session check immediately
checkDashboardSession();

// Also listen for storage changes (in case user logs in while tab is open)
window.addEventListener('storage', (e) => {
  if (e.key && e.key.includes('auth-token')) {
    checkDashboardSession();
  }
});

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
      user_id: currentUserId 
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

  // 1. Check if we are on a Checkout or Cart page
  const currentUrl = window.location.href.toLowerCase();
  const isCheckoutContext = currentUrl.includes('checkout') || 
                            currentUrl.includes('cart') || 
                            currentUrl.includes('basket') || 
                            currentUrl.includes('payment') ||
                            currentUrl.includes('buy/spc') || // Amazon Checkout
                            currentUrl.includes('gp/buy');    // Amazon Buy

  if (!isCheckoutContext) {
    return;
  }

  // 2. Check for Cart Totals first (Higher priority)
  const totalSelectors = [
    '#sc-subtotal-amount-activecart', // Amazon Cart ID
    '.sc-subtotal-amount-activecart', // Amazon Cart Class
    '[data-name="Subtotals"]', // Amazon Checkout
    '#subtotals-marketplace-table', // Amazon Checkout
    '.grand-total-price',
    '.order-total',
    '.cart-total',
    '.checkout-total',
    '[data-test-id="TOTAL"]',
    '.summary-total',
    '.estimated-price',
    '.total-line-item .price',
    '.payment-due__price'
  ];

  let price = 0;
  let title = "Your Cart";

  // Strategy A: Specific Selectors
  for (const selector of totalSelectors) {
    const el = document.querySelector(selector);
    if (el) {
      const text = el.innerText.replace(/[^0-9.]/g, '');
      const p = parseFloat(text);
      if (!isNaN(p) && p > 0) {
        price = p;
        console.log("InvestHer: Detected Cart Total (Selector)", price);
        break;
      }
    }
  }

  // Strategy B: Text Search for "Total" (Fallback)
  if (price === 0) {
    const allElements = document.querySelectorAll('div, span, p, td, h3, h4');
    for (const el of allElements) {
      if (el.children.length > 0) continue; // Skip containers
      
      const text = el.innerText.toLowerCase();
      if (text.includes('total') && !text.includes('subtotal') && text.length < 30) {
        // Found a "Total" label. Look for price nearby.
        // 1. Check the element itself if it has a number
        let pText = el.innerText.replace(/[^0-9.]/g, '');
        let p = parseFloat(pText);
        
        // 2. Check next sibling
        if (isNaN(p) || p === 0) {
            const next = el.nextElementSibling;
            if (next) {
                pText = next.innerText.replace(/[^0-9.]/g, '');
                p = parseFloat(pText);
            }
        }

        // 3. Check parent's next sibling (common in tables)
        if (isNaN(p) || p === 0) {
            const parent = el.parentElement;
            if (parent && parent.nextElementSibling) {
                pText = parent.nextElementSibling.innerText.replace(/[^0-9.]/g, '');
                p = parseFloat(pText);
            }
        }

        if (!isNaN(p) && p > 0) {
            price = p;
            console.log("InvestHer: Detected Cart Total (Text Search)", price);
            break;
        }
      }
    }
  }

  // 3. If no cart total, check for single product price (Lowest Priority)
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

// Run detection immediately and then check periodically for SPAs/Navigation
detectProduct();
setInterval(detectProduct, 2000);
