// Usage: 
// 1. Open your Supabase Dashboard -> Authentication -> Users
// 2. Copy a valid User UID.
// 3. Replace TEST_USER_ID below.
// 4. Run: node scripts/test-db-insert.js

const fetch = require('node-fetch'); // You might need to install node-fetch: npm install node-fetch

const PROJECT_REF = "paxhkncmathdqqnnvgtb";
const FUNCTION_URL = `https://${PROJECT_REF}.supabase.co/functions/v1/log-purchase`;

// REPLACE THIS WITH A VALID USER ID FROM YOUR AUTH.USERS TABLE
const TEST_USER_ID = "REPLACE_WITH_VALID_UUID"; 

async function testLogPurchase() {
  if (TEST_USER_ID === "REPLACE_WITH_VALID_UUID") {
    console.error("❌ Please replace TEST_USER_ID with a valid UUID from your Supabase auth.users table.");
    return;
  }

  const payload = {
    user_id: TEST_USER_ID,
    total_price: 123.45,
    products: [{ name: "Test Product", price: 123.45, quantity: 1 }],
    store: "Test Store",
    category: "Test Category",
    store_image: "https://via.placeholder.com/150",
    status: "success"
  };

  console.log("🚀 Sending test request to:", FUNCTION_URL);
  console.log("📦 Payload:", JSON.stringify(payload, null, 2));

  try {
    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const text = await response.text();
    console.log("📥 Response Status:", response.status);
    console.log("📄 Response Body:", text);

    if (response.ok) {
      console.log("✅ Test PASSED: Purchase logged successfully.");
    } else {
      console.error("❌ Test FAILED: Server returned an error.");
    }
  } catch (error) {
    console.error("❌ Test FAILED: Network error", error);
  }
}

testLogPurchase();
