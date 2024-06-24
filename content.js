

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    console.log('onMessge')
    const frameDoc = document.getElementById("ExamIframe")?.contentWindow?.document?.getElementById('ElementDisplayFrame')?.contentWindow?.document
    if (!frameDoc) {
        console.error('could not find iframe')
        return;
    }

    sendResponse({ instructions: frameDoc.querySelector("div.instructions-content")?.innerText, choices: frameDoc.querySelector('div.stem-block')?.innerText });

});