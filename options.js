// Settings page: stores the OpenAI API key, model, and system prompt in
// chrome.storage.local, and lets you view/export/clear the feedback log.

const apiKeyEl = document.getElementById('apiKey');
const modelEl = document.getElementById('model');
const promptEl = document.getElementById('systemPrompt');
const statusEl = document.getElementById('status');
const fbCountEl = document.getElementById('fbCount');
const fbStatusEl = document.getElementById('fbStatus');

function setStatus(el, message, kind) {
  el.textContent = message;
  el.className = kind || '';
}

async function load() {
  const { apiKey, model, systemPrompt } = await chrome.storage.local.get({
    apiKey: '',
    model: 'gpt-4o',
    systemPrompt: '',
  });
  apiKeyEl.value = apiKey;
  modelEl.value = model;
  // DEFAULT_SYSTEM_PROMPT comes from gpt.js, loaded before this script.
  promptEl.value = systemPrompt || DEFAULT_SYSTEM_PROMPT;
  await refreshFeedbackCount();
}

async function save() {
  const apiKey = apiKeyEl.value.trim();
  const model = modelEl.value;
  const systemPrompt = promptEl.value.trim();
  if (!apiKey) {
    setStatus(statusEl, 'Enter an API key first.', 'err');
    return;
  }
  await chrome.storage.local.set({ apiKey, model, systemPrompt });
  setStatus(statusEl, 'Saved.', 'ok');
}

async function testKey() {
  const apiKey = apiKeyEl.value.trim();
  if (!apiKey) {
    setStatus(statusEl, 'Enter an API key first.', 'err');
    return;
  }
  setStatus(statusEl, 'Testing…', '');
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.ok) {
      setStatus(statusEl, 'Key works ✓', 'ok');
    } else {
      const body = await res.json().catch(() => ({}));
      setStatus(statusEl, `Rejected (${res.status}): ${body?.error?.message || 'invalid key'}`, 'err');
    }
  } catch (e) {
    setStatus(statusEl, `Network error: ${e.message}`, 'err');
  }
}

// ---- feedback log -------------------------------------------------------
async function getLog() {
  const { feedbackLog = [] } = await chrome.storage.local.get({ feedbackLog: [] });
  return feedbackLog;
}

async function refreshFeedbackCount() {
  const log = await getLog();
  const wrong = log.filter((r) => r.verdict === 'wrong').length;
  const total = log.length;
  const acc = total ? Math.round(((total - wrong) / total) * 100) : 0;
  fbCountEl.textContent = total
    ? `${total} records · ${wrong} misses · ${acc}% marked correct`
    : '0 records';
}

function download(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toCsv(log) {
  const cols = [
    'ts', 'verdict', 'gptPick', 'gptConfidence', 'correctAnswer',
    'notes', 'model', 'promptHash', 'question', 'choices',
  ];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = log.map((r) => cols.map((c) => esc(r[c])).join(','));
  return [cols.join(','), ...rows].join('\n');
}

async function exportJson() {
  const log = await getLog();
  if (!log.length) return setStatus(fbStatusEl, 'Log is empty.', 'err');
  download('boardgpt-feedback.json', JSON.stringify(log, null, 2), 'application/json');
  setStatus(fbStatusEl, `Exported ${log.length} records.`, 'ok');
}

async function exportCsv() {
  const log = await getLog();
  if (!log.length) return setStatus(fbStatusEl, 'Log is empty.', 'err');
  download('boardgpt-feedback.csv', toCsv(log), 'text/csv');
  setStatus(fbStatusEl, `Exported ${log.length} records.`, 'ok');
}

async function clearLog() {
  const log = await getLog();
  if (!log.length) return setStatus(fbStatusEl, 'Log is already empty.', '');
  if (!confirm(`Delete all ${log.length} feedback records? This cannot be undone.`)) return;
  await chrome.storage.local.set({ feedbackLog: [] });
  await refreshFeedbackCount();
  setStatus(fbStatusEl, 'Log cleared.', 'ok');
}

// ---- wiring -------------------------------------------------------------
document.getElementById('save').addEventListener('click', save);
document.getElementById('test').addEventListener('click', testKey);
document.getElementById('resetPrompt').addEventListener('click', (e) => {
  e.preventDefault();
  promptEl.value = DEFAULT_SYSTEM_PROMPT;
  setStatus(statusEl, 'Prompt reset to default — click Save to keep it.', '');
});
document.getElementById('toggleReveal').addEventListener('click', (e) => {
  e.preventDefault();
  const reveal = apiKeyEl.type === 'password';
  apiKeyEl.type = reveal ? 'text' : 'password';
  e.target.textContent = reveal ? 'Hide' : 'Show';
});
document.getElementById('exportJson').addEventListener('click', exportJson);
document.getElementById('exportCsv').addEventListener('click', exportCsv);
document.getElementById('clearLog').addEventListener('click', clearLog);

load();
