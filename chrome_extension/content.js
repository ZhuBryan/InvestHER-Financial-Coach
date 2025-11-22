const API_URL = "http://localhost:8000";

// Keywords to detect shopping pages
const SHOPPING_KEYWORDS = ["cart", "checkout", "basket", "buy"];

// Helper to call Supabase Edge Function
async function callCoachingFunction(itemName, price, description) {
    if (!CONFIG.SUPABASE_FUNCTION_URL) {
        console.error("InvestHer: Missing SUPABASE_FUNCTION_URL in config.js");
        return { message: "Save your money!", audio: null };
    }

    try {
        const res = await fetch(CONFIG.SUPABASE_FUNCTION_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CONFIG.SUPABASE_KEY}`
            },
            body: JSON.stringify({
                item_name: itemName,
                price: price,
                description: description,
                user_id: "test_user_123" // Replace with real user ID when auth is ready
            })
        });

        if (!res.ok) throw new Error(`Function Error: ${res.statusText}`);
        return await res.json();
    } catch (e) {
        console.error("InvestHer Edge Function Error:", e);
        return { message: "Think about your financial freedom!", audio: null };
    }
}

function parsePrice(text) {
    if (!text) return 0;
    // Matches $10.99, 10.99 USD, $ 10.99, 100.00, 1,200.50
    // Updated to be more flexible with optional decimals and currency codes
    const match = text.match(/(\$?\s*[\d,]+(\.\d{2})?)/);
    if (match) {
        return parseFloat(match[0].replace(/[^0-9.]/g, ''));
    }
    return 0;
}

function getPagePrice() {
    console.log("InvestHer: Starting smart price detection...");

    // 1. Amazon Specifics (High Accuracy)
    const amazonSubtotal = document.querySelector('#sc-subtotal-amount-activecart span, #sc-subtotal-amount-buybox span');
    if (amazonSubtotal) {
        console.log("InvestHer: Found Amazon Subtotal");
        return parsePrice(amazonSubtotal.innerText);
    }

    // 2. Uniqlo Specifics (and other modern sites)
    // Look for elements with "total" in class or id
    const totalElements = document.querySelectorAll('[class*="total"], [id*="total"], [data-test*="total"]');
    let specificTotal = 0;
    totalElements.forEach(el => {
        // We only want leaf nodes or nodes with direct text
        const price = parsePrice(el.innerText);
        if (price > specificTotal && price < 100000) { // Sanity check
             console.log(`InvestHer: Found specific total candidate: ${price} in .${el.className}`);
             specificTotal = price;
        }
    });
    if (specificTotal > 0) return specificTotal;

    // 3. "Total" Keyword Search (Generic)
    // We look for visible elements containing "Total" or "Subtotal" and a price
    const allElements = document.body.getElementsByTagName("*");
    let bestPrice = 0;
    let maxPriceFound = 0;

    for (let el of allElements) {
        // Skip hidden or script tags
        if (["SCRIPT", "STYLE", "NOSCRIPT", "SVG", "PATH"].includes(el.tagName)) continue;
        if (el.offsetParent === null) continue; // Check visibility
        if (el.children.length > 0) continue;   // Only check leaf nodes (text)

        const text = el.innerText;
        if (!text) continue;

        const price = parsePrice(text);
        if (price > 0) {
            if (price > maxPriceFound) maxPriceFound = price;

            // Check context (parent text) for "Total"
            const parentText = el.parentElement ? el.parentElement.innerText.toLowerCase() : "";
            if (parentText.includes("total") || parentText.includes("subtotal") || parentText.includes("order summary")) {
                console.log(`InvestHer: Candidate Price $${price} found near 'Total'`);
                // We assume the "Total" is likely the highest value labeled "Total" (ignoring discounts)
                if (price > bestPrice) bestPrice = price;
            }
        }
    }

    if (bestPrice > 0) return bestPrice;

    // 4. Fallback: Meta Tag
    const metaPrice = document.querySelector('meta[property="og:price:amount"]');
    if (metaPrice) return parseFloat(metaPrice.content);

    // 5. Last Resort: Max Price found (if reasonable)
    console.log("InvestHer: No 'Total' label found. Defaulting to Max Price:", maxPriceFound);
    return maxPriceFound;
}

async function createCoachPopup(price) {
    if (document.getElementById('investher-overlay')) return;

    // Try to get item name from Meta Title or Page Title
    const metaTitle = document.querySelector('meta[property="og:title"]');
    let itemName = metaTitle ? metaTitle.content : document.title;
    
    // Clean up item name (remove site names like "| UNIQLO", "- Amazon", etc.)
    itemName = itemName.split('|')[0].split('-')[0].trim();
    itemName = itemName.substring(0, 40); // Limit length

    // Get item description for better context
    const metaDesc = document.querySelector('meta[name="description"]') || document.querySelector('meta[property="og:description"]');
    let itemDesc = metaDesc ? metaDesc.content : "";
    itemDesc = itemDesc.substring(0, 150); // Limit length

    // 1. Show "Thinking" State
    const overlay = document.createElement('div');
    overlay.id = 'investher-overlay';
    overlay.innerHTML = `
        <div class="ih-card">
            <div class="ih-header">🤖 Analyzing...</div>
            <div class="ih-content">Thinking about your wallet...</div>
        </div>`;
    document.body.appendChild(overlay);

    try {
        // 2. Call Edge Function (Handles DB, Gemini, and ElevenLabs)
        const data = await callCoachingFunction(itemName, price, itemDesc);
        const aiMessage = data.message || "Think about your financial freedom!";
        
        // 3. Audio Logic
        let audioUrl = null;
        if (data.audio) {
            // Convert Base64 to Blob URL
            const binaryString = atob(data.audio);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: 'audio/mpeg' });
            audioUrl = URL.createObjectURL(blob);
        }

        // 4. Calculate Projection
        const futureVal = (price * (1.07 ** 10)).toFixed(2);

        // 5. Update UI
        overlay.innerHTML = `
            <div class="ih-card">
                <div class="ih-header">
                    <span>👩‍💼 InvestHer Coach</span>
                    <button id="ih-close">×</button>
                </div>
                <div class="ih-content">
                    <p class="ih-alert">Wait! You're spending <strong>$${price}</strong>.</p>
                    
                    <div class="ih-ai-box">
                        <button id="ih-speak" style="${audioUrl ? '' : 'display:none'}">🔊</button>
                        <p>"${aiMessage}"</p>
                    </div>

                    <p class="ih-stat">In 10 years this could be: <strong>$${futureVal}</strong></p>
                    
                    <div class="ih-actions">
                        <button id="ih-invest">Invest Instead</button>
                        <button id="ih-buy">Buy Anyway</button>
                    </div>
                </div>
            </div>
        `;

        // 6. Event Listeners
        document.getElementById('ih-close').addEventListener('click', () => overlay.remove());
        document.getElementById('ih-buy').addEventListener('click', () => overlay.remove());
        
        if (audioUrl) {
            const audio = new Audio(audioUrl);
            document.getElementById('ih-speak').addEventListener('click', () => audio.play());
        }
        
        document.getElementById('ih-invest').addEventListener('click', () => {
            // We still try to log to the backend if available
            fetch(`${API_URL}/add-savings`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ item_name: itemName, amount: price })
            }).catch(e => console.log("Backend offline, could not save."));
            
            window.open('http://localhost:8501', '_blank'); // Open Dashboard
            overlay.remove();
        });

    } catch (err) {
        console.error(err);
        overlay.remove();
    }
}

// Trigger Logic
const url = window.location.href.toLowerCase();
console.log("InvestHer: Checking URL...", url);

if (SHOPPING_KEYWORDS.some(k => url.includes(k))) {
    console.log("InvestHer: Shopping keyword detected!");
    setTimeout(() => {
        const price = getPagePrice();
        console.log("InvestHer: Detected Price:", price);
        if (price > 0) {
            createCoachPopup(price);
        } else {
            console.log("InvestHer: No price found. Popup skipped.");
        }
    }, 3000); // Increased to 3s to allow load
} else {
    console.log("InvestHer: No shopping keywords found in URL.");
}