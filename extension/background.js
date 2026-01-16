// Background service worker for Speed Reader extension

// Create context menu on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'speed-read-selection',
    title: 'Speed Read Selection',
    contexts: ['selection']
  });

  chrome.contextMenus.create({
    id: 'speed-read-page',
    title: 'Speed Read This Page',
    contexts: ['page']
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'speed-read-selection' && info.selectionText) {
    // Store selected text and open popup
    chrome.storage.local.set({
      pendingText: info.selectionText,
      pendingAction: 'selection'
    }, () => {
      chrome.action.openPopup();
    });
  } else if (info.menuItemId === 'speed-read-page') {
    // Store action and open popup
    chrome.storage.local.set({
      pendingAction: 'article'
    }, () => {
      chrome.action.openPopup();
    });
  }
});
