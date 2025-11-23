chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "closeTab") {
    if (sender.tab) {
      chrome.tabs.remove(sender.tab.id);
    }
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
