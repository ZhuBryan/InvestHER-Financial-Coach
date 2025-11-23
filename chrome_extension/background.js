const PROJECT_REF = "paxhkncmathdqqnnvgtb";
const SUPABASE_LOG_URL = `https://${PROJECT_REF}.supabase.co/functions/v1/log-purchase`;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "closeTab") {
    if (sender.tab) {
      chrome.tabs.remove(sender.tab.id);
    }
  }

  if (request.action === "LOG_PURCHASE") {
    console.log("InvestHer Background: Logging purchase...", request.data);
    
    fetch(SUPABASE_LOG_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request.data)
    })
    .then(response => {
      if (!response.ok) throw new Error('Network response was not ok');
      return response.json(); // or response.text()
    })
    .then(data => {
      console.log("InvestHer Background: Purchase logged successfully", data);
      sendResponse({ success: true, data: data });
    })
    .catch(error => {
      console.error("InvestHer Background: Failed to log purchase", error);
      sendResponse({ success: false, error: error.message });
    });

    return true; // Keep channel open for async response
  }

  if (request.type === "SYNC_SESSION") {
    console.log("Received session sync request from content script");
    if (request.session) {
      chrome.storage.local.set({
        access_token: request.session.access_token,
        refresh_token: request.session.refresh_token,
        user: request.session.user
      }, () => {
        console.log("Session synced successfully");
        sendResponse({ success: true });
      });
    }
    return true; // Keep channel open
  }
});
