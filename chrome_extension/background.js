chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "closeTab") {
    if (sender.tab) {
      chrome.tabs.remove(sender.tab.id);
    }
  }
});
