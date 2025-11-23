// InvestHer Content Script

// --- Configuration ---
// Load config from config.js (loaded via manifest)
const PROJECT_REF = "paxhkncmathdqqnnvgtb";
const SUPABASE_FUNCTION_URL = `https://${PROJECT_REF}.supabase.co/functions/v1/generate-coaching`;
const SUPABASE_LOG_URL = `https://${PROJECT_REF}.supabase.co/functions/v1/log-purchase`;
const GEMINI_API_KEY = typeof CONFIG !== 'undefined' ? CONFIG.GEMINI_API_KEY : null;
const DASHBOARD_URL = typeof CONFIG !== 'undefined' ? CONFIG.DASHBOARD_URL : "http://localhost:5173";

// --- State ---
let isPopupOpen = false;
let currentMetadata = null; // Store extracted metadata from Gemini (products, store, category, etc.)
let currentUserId = null; 

// Initialize user ID from storage
chrome.storage.local.get(['user'], (result) => {
  if (result.user) {
    currentUserId = result.user.id;
    console.log("InvestHer: Loaded User ID from storage:", currentUserId);
  } else {
    console.warn("InvestHer: No User ID found in storage.");
  }
  
  // Start detection ONLY after we've attempted to load the user
  detectProduct();
  setInterval(detectProduct, 2000);
});

// DEBUG: Clear dismissal on reload for easier testing
if (window.location.href.includes('test-cart') || window.location.hostname === 'localhost') {
    sessionStorage.removeItem('investher_dismissed');
    console.log("InvestHer: Debug mode - Cleared dismissal state.");
}

// --- Session Sync Logic ---

function checkDashboardSession() {
  // Parse the configured dashboard URL
  let dashboardHostname = 'localhost';
  try {
      dashboardHostname = new URL(DASHBOARD_URL).hostname;
  } catch (e) {}

  // Only run on the dashboard URL
  if (window.location.hostname === dashboardHostname || (dashboardHostname === 'localhost' && ['3000', '3001', '5173'].includes(window.location.port))) {
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
          console.log("InvestHer: Synced User ID:", currentUserId);
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

function cleanProductTitle(title) {
  if (!title) return "Unknown Item";
  // Remove common prefixes/suffixes
  let clean = title.replace(/Amazon\.com\s*:/i, '')
                   .replace(/ : Amazon\.com/i, '')
                   .replace(/Details about/i, '');
  
  // Split by common separators and take the first meaningful chunk
  const separators = [' – ', ' - ', ' | ', ', ', ' : '];
  for (const sep of separators) {
      if (clean.includes(sep)) {
          const parts = clean.split(sep);
          if (parts[0].length > 10) {
              clean = parts[0];
              break;
          }
      }
  }

  // Hard truncate if still too long
  if (clean.length > 40) {
      clean = clean.substring(0, 37) + '...';
  }
  return clean.trim();
}

function calculateAlternatives(price) {
  const coffeePrice = 6;
  const groceryWeekPrice = 100;

  const numCoffees = Math.floor(price / coffeePrice);
  const numGroceries = (price / groceryWeekPrice).toFixed(1);

  return [
    "Extra payment toward your goals",
    `${numCoffees} fancy coffees with friends`,
    `${numGroceries} weeks of groceries`
  ];
}

// --- AI-Powered Page Scraping ---
async function scrapePageWithAI(productTitle, price) {
  // We don't need the Gemini API key here anymore because we are sending the data to the backend
  // to be processed. The backend has the key.
  
  try {
    // Extract raw data from page
    const pageData = {
      url: window.location.href,
      hostname: window.location.hostname,
      title: document.title,
      price: price,
      detectedProduct: productTitle,
      // Try to extract product items from cart
      productElements: []
    };

    // Scrape product cards/items (common selectors for e-commerce)
    const productSelectors = [
      '.cart-item', '.sc-list-item', '.a-spacing-mini', // Amazon
      '.line-item', '.cart-line-item', '.product-item', // Generic
      '[data-item]', '[data-product]', '.basket-item'
    ];

    for (const selector of productSelectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        elements.forEach((el, idx) => {
          if (idx < 5) { // Limit to first 5 items
            const text = el.innerText.substring(0, 500); // Limit text length
            pageData.productElements.push(text);
          }
        });
        break; // Found products, stop searching
      }
    }

    // Get favicon/store image
    const favicon = document.querySelector('link[rel*="icon"]');
    const storeLogo = document.querySelector('meta[property="og:image"]');

    pageData.storeImage = favicon?.href || storeLogo?.content ||
                          `https://www.google.com/s2/favicons?domain=${window.location.hostname}&sz=128`;

    // Return structured data directly (no AI scraping on client side)
    const cleanName = cleanProductTitle(productTitle);
    return {
        products: [{ name: cleanName, price: price, quantity: 1 }], // Fallback to detected title
        store: window.location.hostname.replace('www.', ''),
        category: "General",
        store_image: pageData.storeImage
    };

  } catch (error) {
    console.error("InvestHer: Scraping failed", error);
  }

  return null;
}

async function generateCoachingWithAI(metadata, price) {
  // Call Supabase Edge Function instead of direct Gemini call
  try {
    const res = await fetch(SUPABASE_FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          item_name: metadata.products[0].name, 
          price: price, 
          description: `Buying from ${metadata.store}`,
          user_id: currentUserId 
        })
    });
    const data = await res.json();
    console.log("InvestHer: AI Response Data:", data); // DEBUG LOG
    if (data.debug_raw) {
        console.log("InvestHer: DEBUG RAW STRING (Copy this):", data.debug_raw);
    }
    return data;
  } catch (e) {
    console.error("InvestHer: AI Coaching failed", e);
  }
  return null;
}

// --- UI Generation ---
async function createCoachPopup(productName, price) {
  if (isPopupOpen) return;
  console.log("InvestHer: Opening popup. User ID:", currentUserId);
  isPopupOpen = true;

  // Create Overlay
  const overlay = document.createElement('div');
  overlay.id = 'investher-popup-overlay';

  // Create Container
  const container = document.createElement('div');
  container.id = 'investher-popup-container';

  // Initial State (Immediate Show with Loading placeholders)
  const logoUrl = chrome.runtime.getURL('InvestHer_-_Logo_1.png');
  container.innerHTML = `
    <button class="investher-close-btn" id="investher-close-x">×</button>
    <div class="investher-header">
      <div style="display: flex; justify-content: center; margin-bottom: 12px;">
        <img src="${logoUrl}" style="width: 48px; height: 48px; object-fit: contain;" alt="InvestHer Logo">
      </div>
      <h1 class="investher-title">Before You Buy</h1>
      <div class="investher-price">${formatCurrency(price)}</div>
      <div class="investher-subtitle">Could be used for...</div>
    </div>

    <!-- Dynamic Product Details (Hidden) -->
    <div id="investher-product-details" style="display: none;"></div>

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

  // 1. Scrape Page Data
  let metadata = null;
  try {
    metadata = await scrapePageWithAI(productName, price);
    currentMetadata = metadata;
    
    if (metadata && metadata.products) {
      const productDetailsEl = document.getElementById('investher-product-details');
      if (productDetailsEl) {
        // Removed product list rendering as requested
        productDetailsEl.style.display = 'none';
      }
    }
  } catch (e) {
    console.error("InvestHer: Scraping failed", e);
  }

  // 2. Generate Coaching (AI or Fallback)
  let coachingData = null;
  if (metadata) {
    coachingData = await generateCoachingWithAI(metadata, price);
  }

  // If AI failed, try Supabase or local fallback
  if (!coachingData) {
    // Double check user ID if it was null initially
    if (!currentUserId) {
        console.log("InvestHer: User ID was null, checking storage again before fallback...");
        const storage = await chrome.storage.local.get(['user']);
        if (storage.user) currentUserId = storage.user.id;
    }

    try {
        console.log("InvestHer: Attempting fallback fetch...");
        const res = await fetch(SUPABASE_FUNCTION_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              item_name: productName, 
              price: price, 
              description: "Online shopping item",
              user_id: currentUserId 
            })
        });
        coachingData = await res.json();
        console.log("InvestHer: Fallback Response Data:", coachingData); // DEBUG LOG
    } catch (e) {
        console.error("InvestHer: Supabase fetch failed", e);
    }
  }

  // 3. Render Content
  document.getElementById('investher-loading-state').style.display = 'none';
  document.getElementById('investher-loaded-content').style.display = 'block';

  const altList = document.getElementById('investher-alt-list');
  const icons = ['💰', '☕', '🛒'];
  const alternatives = (coachingData && coachingData.alternatives) ? coachingData.alternatives : calculateAlternatives(price);

  altList.innerHTML = alternatives.slice(0, 3).map((alt, index) => `
    <div class="investher-alt-item">
      <div class="investher-alt-icon">${icons[index] || ''}</div>
      <div class="investher-alt-text">${alt}</div>
    </div>
  `).join('');

  if (coachingData) {
      if (coachingData.pro) document.getElementById('investher-pro-text').innerText = coachingData.pro;
      if (coachingData.con) document.getElementById('investher-con-text').innerText = coachingData.con;
      if (coachingData.audio) {
        try {
          new Audio("data:audio/mpeg;base64," + coachingData.audio).play();
        } catch (e) {}
      }
  }

  // Button Handlers
  document.getElementById('investher-save-btn').addEventListener('click', () => {
      if (!currentUserId) {
        alert("Please log in to the InvestHer dashboard first to track your savings!");
        window.open(DASHBOARD_URL, '_blank'); // Open dashboard
        return;
      }

      const purchaseData = {
        user_id: currentUserId,
        total_price: price,
        products: currentMetadata?.products || [{ name: productName, price: price, quantity: 1 }],
        store: currentMetadata?.store || window.location.hostname,
        category: currentMetadata?.category || "General",
        status: "success",
        store_image: currentMetadata?.store_image || `https://www.google.com/s2/favicons?domain=${window.location.hostname}&sz=128`
      };
      
      console.log("InvestHer: Sending LOG_PURCHASE message", purchaseData);

      // Send to background script to handle the API call
      chrome.runtime.sendMessage({ 
        action: "LOG_PURCHASE", 
        data: purchaseData 
      }, (response) => {
        if (chrome.runtime.lastError) {
           console.error("InvestHer: Message sending failed", chrome.runtime.lastError);
        }
        // We don't wait for success to close, but we log it.
      });
      
      close();
      // Small delay to ensure message dispatch before tab close
      setTimeout(() => {
        chrome.runtime.sendMessage({ action: "closeTab" });
      }, 100);
  });

  document.getElementById('investher-buy-btn').addEventListener('click', () => {
      if (!currentUserId) {
        // Allow buying even if not logged in, but warn? Or just let them buy.
        // Better to just let them buy so we don't block them.
        console.warn("InvestHer: User not logged in, purchase not tracked.");
        close();
        return;
      }

      const purchaseData = {
        user_id: currentUserId,
        total_price: price,
        products: currentMetadata?.products || [{ name: productName, price: price, quantity: 1 }],
        store: currentMetadata?.store || window.location.hostname,
        category: currentMetadata?.category || "General",
        status: "failure",
        store_image: currentMetadata?.store_image || `https://www.google.com/s2/favicons?domain=${window.location.hostname}&sz=128`
      };
      
      console.log("InvestHer: Sending LOG_PURCHASE message (Buy)", purchaseData);

      // Send to background script
      chrome.runtime.sendMessage({ 
        action: "LOG_PURCHASE", 
        data: purchaseData 
      });
      
      close();
  });
}

// --- Detection Logic ---
let hasLoggedUrlCheck = false;

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
    if (!hasLoggedUrlCheck) {
        console.log("InvestHer: URL does not match checkout context:", currentUrl);
        hasLoggedUrlCheck = true;
    }
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
          const titleSelectors = ['#productTitle', 'h1', '.product-title', '.product-name'];
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

  // Try to find title if it's still generic "Your Cart"
  if (title === "Your Cart") {
      // Look for item names in cart
      const itemSelectors = ['.sc-product-title', '.product-name', '.item-title', 'h3', 'h4'];
      for (const sel of itemSelectors) {
          const el = document.querySelector(sel);
          if (el && el.innerText.length > 3) {
              title = el.innerText.trim();
              // If multiple items, maybe just say "Your Cart with [Item]..."
              const count = document.querySelectorAll(sel).length;
              if (count > 1) {
                  title = `${title} and ${count - 1} other items`;
              }
              break;
          }
      }
  }

  if (price > 0) {
    // IMMEDIATE POPUP
    const cleanName = cleanProductTitle(title);
    createCoachPopup(cleanName, price);
  }
}

// Run detection immediately and then check periodically for SPAs/Navigation
// detectProduct(); // Moved to storage callback
// setInterval(detectProduct, 2000); // Moved to storage callback
