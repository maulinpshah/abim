const ORIGIN = 'https://www.starttest.com/';

chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));

// chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {

//     if (!tab.url) return;
//     const url = new URL(tab.url);
//     // Enables the side panel on google.com
//     if (url.origin === ORIGIN) {

//         await chrome.sidePanel.setOptions({
//             tabId,
//             path: 'sidepanel.html',
//             enabled: true
//         });
//     } else {
//         // Disables the side panel on all other sites
//         await chrome.sidePanel.setOptions({
//             tabId,
//             enabled: false
//         });
//     }
// })