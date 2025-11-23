// popup.js

document.addEventListener('DOMContentLoaded', () => {
    const loginView = document.getElementById('login-view');
    const loggedInView = document.getElementById('logged-in-view');
    const connectBtn = document.getElementById('connect-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const dashboardBtn = document.getElementById('dashboard-btn');
    const userInfo = document.getElementById('user-info');
  
    // Use config from config.js (loaded in html)
    // Fallback if config.js isn't loaded correctly or variables are missing
    const DASHBOARD_URL = (typeof CONFIG !== 'undefined' && CONFIG.DASHBOARD_URL) ? CONFIG.DASHBOARD_URL : "http://localhost:5173";
  
    // Check if user is already logged in
    chrome.storage.local.get(['user', 'access_token'], (result) => {
      if (result.user && result.access_token) {
        showLoggedIn(result.user);
      } else {
        // If not logged in, show connect button
        // Optionally, we could auto-redirect here, but it's better to let the user click
        // to avoid unexpected tab openings.
      }
    });

    connectBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: DASHBOARD_URL });
    });
  
    logoutBtn.addEventListener('click', () => {
      chrome.storage.local.clear(() => {
        loginView.classList.remove('hidden');
        loggedInView.classList.add('hidden');
      });
    });
  
    dashboardBtn.addEventListener('click', () => {
      // Just open the dashboard. The session should persist in the browser's localStorage/cookies.
      chrome.tabs.create({ url: DASHBOARD_URL });
    });
  
    function showLoggedIn(user) {
      loginView.classList.add('hidden');
      loggedInView.classList.remove('hidden');
      userInfo.innerText = `Logged in as ${user.email}`;
    }
  });
