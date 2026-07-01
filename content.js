// Runs on the exam page. Scrapes the current question/choices out of the nested
// exam iframes, both on request (side panel asks) and on a watcher that pushes
// the new question to the side panel whenever it changes.
//
// Structure on starttest.com:
//   top page
//   └─ #ExamIframe (ITDStart.aspx, same-origin)
//      └─ #ElementDisplayFrame
//         ├─ div.instructions-content  (question)
//         └─ div.stem-block            (choices)

// The exam markup leaks UI noise into innerText: a leading numeric item id,
// "Strikeout option X" button labels, and choice letters on their own lines
// (e.g. "A" / "." / "text"). Strip those and re-join "A. text".
function cleanText(text) {
  if (!text) return '';
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '')
    .filter((l) => !/^\d+$/.test(l)) // standalone item-id numbers
    .filter((l) => !/^strikeout\b/i.test(l)); // "Strikeout option X" labels
  return lines
    .join('\n')
    .replace(/(^|\n)([A-Z])\n\.\n/g, '$1$2. '); // "A\n.\nText" -> "A. Text"
}

function getSameOriginDoc(frameEl) {
  try {
    return frameEl.contentWindow.document;
  } catch {
    return null; // cross-origin
  }
}

// Find the document that holds the question, tolerating frame renames/nesting.
function findQuestionDoc() {
  const exam = document.getElementById('ExamIframe');
  const examDoc = exam && getSameOriginDoc(exam);
  if (!examDoc) return null;

  const byId = examDoc.getElementById('ElementDisplayFrame');
  if (byId) {
    const doc = getSameOriginDoc(byId);
    if (doc) return doc;
  }

  // Fallback: first readable nested frame that actually contains a question.
  for (const f of examDoc.querySelectorAll('iframe, frame')) {
    const doc = getSameOriginDoc(f);
    if (doc && (doc.querySelector('div.stem-block') || doc.querySelector('div.instructions-content'))) {
      return doc;
    }
  }
  return getSameOriginDoc(examDoc.querySelector('iframe, frame')) || examDoc;
}

function scrapeQuestion() {
  const doc = findQuestionDoc();
  if (!doc) return null;

  const instructions = cleanText(doc.querySelector('div.instructions-content')?.innerText || '');
  const choices = cleanText(doc.querySelector('div.stem-block')?.innerText || '');

  if (!instructions && !choices) {
    const fallback = cleanText(doc.body?.innerText || '');
    if (!fallback) return null;
    return { instructions: fallback, choices: '', fallback: true };
  }
  return { instructions, choices };
}

// Pull: side panel asks for the current question.
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  sendResponse(scrapeQuestion());
});

// Push: notice when the question changes and tell the side panel.
let lastSignature = '';
function checkForNewQuestion() {
  const q = scrapeQuestion();
  if (!q) return;
  const sig = `${q.instructions}${q.choices}`.trim();
  if (!sig || sig === lastSignature) return;
  lastSignature = sig;
  // Rejects harmlessly if the side panel is closed (no receiver).
  chrome.runtime.sendMessage({ type: 'questionChanged', ...q }).catch(() => {});
}
setInterval(checkForNewQuestion, 1200);
