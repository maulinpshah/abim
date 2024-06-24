document.addEventListener('DOMContentLoaded', function () {

    var promptButton = document.getElementById('prompt');


    promptButton.addEventListener('click', async function () {

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const response = await chrome.tabs.sendMessage(tab.id, { greeting: "hello" });
        // do something with response here, not outside the function
        console.log(response);

        document.body.innerHTML += response.instructions + "<br /><br/>" + response.choices
        writeToClipboard(response.instructions + response.choices)

    });


    async function writeToClipboard(text) {

        // Create hidden input with text
        const el = document.createElement('textarea')
        el.value = text
        document.body.append(el)

        // Select the text and copy to clipboard
        el.select()
        const success = document.execCommand('copy')
        el.remove()

        if (!success) {
            console.error('Unable to write to clipboard', text)
            return
        }

        console.log('succes writing to clipboard', text)

    }

})

