// Talks to the OpenAI Chat Completions API with the user's stored key and streams
// responses into a DOM element. Supports an ongoing conversation so the user can
// ask follow-up questions with full context.

// Reasoning-first prompt: the model thinks and evaluates every option BEFORE it
// commits to a letter (much more accurate than answering first). The final pick is
// the last line; the UI surfaces it from data-letter regardless of position.
// This is the default; the user can override it on the Settings page.
const DEFAULT_SYSTEM_PROMPT = `You are a board-certified internal medicine physician helping a colleague prepare for a board-style multiple-choice exam (ABIM/USMLE style). Be rigorous and accurate, and reason carefully before committing to an answer.

You receive a clinical vignette ("Question") and answer options ("Choices"). The Choices block may also restate the specific lead-in question before the lettered options.

Think in this exact order, and DO NOT reveal your final letter until the very end:

<h2>Key findings</h2>
List the decisive clues from the vignette as short <p> sentences: demographics, specific labs/vitals with their values, timing/onset, and pertinent positives and negatives. In one sentence, state exactly what the lead-in is asking for (e.g. next best step, most likely diagnosis, best treatment).

<h2>Reasoning</h2>
Reason from those findings toward the answer. Name the most likely diagnosis or governing principle and why the specific details support it.

<h2>Option analysis</h2>
Evaluate EVERY option, one <p> per option, in order. For each, say whether it is correct or give the specific reason it is not the best choice, citing the relevant finding. Explicitly eliminate distractors.

Then, as the final line with nothing after it, output exactly:
<p class="gpt-pick" data-letter="X" data-confidence="high|medium|low">Best answer: X — short label</p>
X is the single best option letter (A, B, C, D, or E). Set confidence by how strongly the evidence supports that choice over the runner-up.

Rules:
- Choose exactly ONE best answer, even when more than one option seems reasonable; pick the single best.
- Decide from the specific details given, not surface keyword matching. Watch for details that change the usual textbook answer.
- If information seems missing or contradictory, say so in Reasoning, then still give your best answer with appropriately lower confidence.
- For follow-up questions, reply in the same HTML style and do NOT repeat the gpt-pick line.
- Never wrap your output in a code fence.`;

async function getSettings() {
  const { apiKey, model, systemPrompt } = await chrome.storage.local.get({
    apiKey: '',
    model: 'gpt-4o',
    systemPrompt: '',
  });
  return { apiKey, model, systemPrompt: systemPrompt || DEFAULT_SYSTEM_PROMPT };
}

async function buildInitialMessages(question, choices) {
  const { systemPrompt } = await getSettings();
  return [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `Question:\n${question}\n\nChoices:\n${choices}\n\n# Response:`,
    },
  ];
}

// Streams a chat completion for `messages` into `element`; returns the full text.
async function streamChat(messages, element) {
  const { apiKey, model } = await getSettings();
  if (!apiKey) {
    throw new Error('NO_API_KEY');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, temperature: 0, stream: true, messages }),
  });

  if (!response.ok) {
    let detail = '';
    try {
      const err = await response.json();
      detail = err?.error?.message || '';
    } catch {
      /* non-JSON error body */
    }
    throw new Error(`OpenAI ${response.status}: ${detail || response.statusText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let output = '';
  element.innerHTML = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary;
    while ((boundary = buffer.indexOf('\n\n')) !== -1) {
      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      for (const line of rawEvent.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') continue;
        try {
          const obj = JSON.parse(data);
          const delta = obj.choices?.[0]?.delta?.content;
          if (delta) {
            output += delta;
            element.innerHTML = output;
          }
        } catch {
          // keep-alive comment or partial frame
        }
      }
    }
  }

  return output;
}
