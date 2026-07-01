# BoardGPT

A Chrome extension that helps you study board-exam multiple-choice questions. While
you take a quiz, it opens a side panel, scrapes the on-screen question and answer
choices, sends them to OpenAI, and shows the most likely answer with a rationale —
including why each other option is wrong.

> ⚠️ **For studying/review only.** Using this during a real, proctored exam is
> almost certainly an academic-integrity violation. You are responsible for how you
> use it.

---

## What changed in v2

- **No more hardcoded API key.** You now supply your own OpenAI key on a Settings
  page; it is stored locally via `chrome.storage.local` and only ever sent to OpenAI.
- Switched from a private Azure OpenAI resource to the standard **OpenAI API**
  (`api.openai.com`), with a selectable model (default `gpt-4o`).
- Robust streaming, real error handling, modern clipboard API, least-privilege
  permissions, and removal of dead files (`popup.*`, `test.html`).
- **Auto-updating question panel** — the question shows and refreshes by itself as you
  navigate; **GPT's pick** is surfaced; and you can ask **follow-up questions** in a
  context-aware chat.
- **Reasoning-first prompt** — GPT now works through the findings and every option before
  committing to a letter (more accurate than the old answer-first prompt), and reports a
  confidence level. The prompt is **editable in Settings**.
- **Feedback log** — flag misses in the side panel and export them (JSON/CSV) to analyze
  why the prompt underperforms.

---

## Install (unpacked, developer mode)

1. Download/clone this folder to your computer.
2. Open **`chrome://extensions`** in Chrome (or any Chromium browser — Edge, Brave).
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select this project folder (the one containing
   `manifest.json`).
5. BoardGPT appears in your toolbar. Pin it for easy access (puzzle-piece icon → pin).

## One-time setup: add your OpenAI key

1. Get a key at <https://platform.openai.com/api-keys> (an `sk-...` string).
   Set a **monthly spending limit** on your OpenAI account first.
2. Right-click the BoardGPT toolbar icon → **Options**, or click **Settings** inside
   the side panel.
3. Paste the key, pick a model, click **Save**. Click **Test key** to confirm it works.

## Using it

1. Go to the exam site (**`starttest.com`**) and open a question.
2. Click the BoardGPT toolbar icon to open the side panel.
3. The current question appears automatically and **updates on its own** as you move
   between questions (it also best-effort copies the question to your clipboard).
4. Click **Ask GPT**. The answer and rationale stream into the panel, and **GPT's pick**
   (e.g. "GPT's pick: B") is surfaced at the top.
5. Don't understand the reasoning? Type a **follow-up question** in the box and press
   Enter — it keeps the full context of the question and prior answers.
   - **Copy question** copies the scraped text to your clipboard.
   - **Settings** opens the options page.

> BoardGPT shows you its recommendation and reasoning so **you** can evaluate and answer.
> It does not select or submit answers on the exam for you (see below).

---

## Feedback log & prompt tuning

To understand and reduce GPT's mistakes:

1. After an answer, the side panel asks **"Was GPT correct?"** Click **✓ Yes**, or **✗ No**
   and enter the correct letter + an optional note (e.g. "ignored that the anion gap was
   closed").
2. Each record is saved locally with the question, GPT's pick & confidence, the correct
   answer, your note, the model, and a **hash of the prompt** that produced it (so you can
   tell which prompt version caused which misses).
3. In **Settings → Feedback log**, see your running accuracy and **Export JSON/CSV** for
   analysis (pivot misses by confidence, by topic, by prompt hash).
4. Edit the **System prompt** in Settings, Save, and re-test. The default is reasoning-first
   (findings → reasoning → option-by-option → answer); **Reset to default** restores it.

This is the loop: *log misses → spot the pattern → adjust the prompt → re-test.* Because the
prompt hash is stored per record, you can prove whether a change actually moved accuracy.

## Expectations & limits

- **It can be wrong.** It is an LLM, not an authoritative medical source. Verify
  everything against your study materials.
- **It costs money.** Each question is a paid OpenAI API call billed to your key.
  `gpt-4o-mini` is cheaper if cost matters.
- **Site-specific scraping.** It reads the question from `starttest.com`'s specific
  iframe structure (`#ExamIframe` → `#ElementDisplayFrame`). If that site changes its
  markup, or you use a different quiz platform, scraping will return nothing and you'll
  see "No question found." Adjust the selectors in [`content.js`](content.js) for other
  sites (and add the site to `host_permissions`/`content_scripts.matches` in
  [`manifest.json`](manifest.json)).
- **Privacy.** Question text is sent to OpenAI when you click Ask GPT. Don't use it
  with confidential content you aren't allowed to share.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| "No API key set" | Open Settings and save a valid key. |
| "Could not reach the page…" | Open it on the exam tab and **reload** the tab so the content script loads. |
| "No question found…" | Make sure a question is actually on screen; the site's markup may have changed. |
| "OpenAI 401" | Key is wrong/revoked — re-check it in Settings → Test key. |
| "OpenAI 429" | Rate-limited or out of quota/credit on your OpenAI account. |

## Security note about the old key

Earlier versions committed a live Azure OpenAI key into the source (and it remains in
this repo's **git history**). **Treat that key as compromised — disable/rotate it in
the Azure portal.** If this repo will be shared, scrub it from history (e.g.
`git filter-repo`) before publishing.

## Files

| File | Role |
| --- | --- |
| `manifest.json` | Extension config (MV3). |
| `service-worker.js` | Opens the side panel when the toolbar icon is clicked. |
| `content.js` | Scrapes the question/choices from the exam page. |
| `sidepanel.html` / `sidepanel.js` | The side-panel UI. |
| `gpt.js` | Calls the OpenAI API and streams the answer. |
| `options.html` / `options.js` | Settings page (API key + model). |
