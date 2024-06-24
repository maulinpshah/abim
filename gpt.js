async function createResponse(question, choices, element) {
    // const message = document.getElementById('message').value;
    // const shorthand = document.getElementById('shorthand').value;

    const response = await fetch('https://oai-summary-ncus.openai.azure.com/openai/deployments/gpt-4/chat/completions?api-version=2023-07-01-preview', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'api-key': '1c718823bed84bd0928dbb65642565d5'
        },
        body: JSON.stringify({
            "messages": [
                {
                    "role": "system",
                    "content": "You are a developing a board exam test for physicians. You will be given a question and multiple choice options. Provide a summary of your assessment, the most likely answer, and the rationale. Use HTML to style your response and make it more readable. Use H2 for each heading, and include paragraphs p tag for each option's explanation."
                },
                {
                    "role": "user",
                    "content": `Question:\n ${question}\n\nChoices:\n ${choices}\n\n# Response:`
                }
            ],
            "temperature": 0.0,
            "top_p": 0.95,
            "frequency_penalty": 0,
            "presence_penalty": 0,
            "max_tokens": 800,
            "stop": null,
            "stream": true
        }),
    });
    const reader = await response.body.getReader();
    const decoder = new TextDecoder();
    let partialData = ''
    element.innerHTML = ''
    let output = ''
    while (true) {
        const { done, value } = await reader.read()
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        let lines = (partialData + text).split(/\n+/);
        partialData = lines.pop();
        lines.forEach(line => {
            try { // HACK
                const obj = JSON.parse(line.slice(5)) // HACK: ignore `data:` prefix
                if (obj.choices[0].delta.content) {
                    output += obj.choices[0].delta.content
                    element.innerHTML = output
                }
            } catch { }
        })
    }

    console.log('output', output)
    // TODO: handle partialData
}
