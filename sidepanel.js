document.addEventListener('DOMContentLoaded', function () {
  const askButton = document.getElementById('ask');
  const copyButton = document.getElementById('copy');
  const settingsButton = document.getElementById('settings');
  const statusEl = document.getElementById('status');
  const questionEl = document.getElementById('question');
  const pickEl = document.getElementById('pick');
  const transcriptEl = document.getElementById('transcript');
  const followupRow = document.getElementById('followupRow');
  const followupInput = document.getElementById('followupInput');
  const followupSend = document.getElementById('followupSend');
  const feedbackRow = document.getElementById('feedbackRow');
  const fbDetail = document.getElementById('fbDetail');
  const fbCorrectAns = document.getElementById('fbCorrectAns');
  const fbNotes = document.getElementById('fbNotes');

  let currentQuestion = null; // { instructions, choices }
  let conversation = []; // OpenAI messages array, kept for follow-ups
  let lastAnswerEl = null; // the first answer element (for feedback)
  let lastPick = null; // { letter, confidence }
  let busy = false;

  function setStatus(message, isError) {
    statusEl.textContent = message || '';
    statusEl.className = isError ? 'err' : '';
  }

  function questionText(q) {
    return `${q.instructions || ''}\n${q.choices || ''}`.trim();
  }

  function showQuestion(q, { announce } = {}) {
    currentQuestion = q;
    conversation = [];
    lastAnswerEl = null;
    lastPick = null;
    questionEl.style.display = 'block';
    questionEl.innerHTML = '';
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = 'Current question';
    questionEl.append(label, document.createTextNode(questionText(q)));

    pickEl.style.display = 'none';
    pickEl.textContent = '';
    transcriptEl.innerHTML = '';
    followupRow.style.display = 'none';
    feedbackRow.style.display = 'none';
    fbDetail.style.display = 'none';
    if (announce) setStatus('New question detected. Click "Ask GPT".');

    navigator.clipboard?.writeText(questionText(q)).catch(() => {});
  }

  settingsButton.addEventListener('click', () => chrome.runtime.openOptionsPage());

  // ---- scraping ----------------------------------------------------------
  async function scrapeFromPage() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error('No active tab.');
    let response;
    try {
      response = await chrome.tabs.sendMessage(tab.id, { greeting: 'hello' });
    } catch {
      throw new Error(
        'Could not reach the page. Open this on the exam (starttest.com) tab and reload it.'
      );
    }
    if (!response || (!response.instructions && !response.choices)) {
      throw new Error('No question found on this page. Make sure a question is on screen.');
    }
    return response;
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'questionChanged' && !busy) {
      showQuestion({ instructions: msg.instructions, choices: msg.choices }, { announce: true });
    }
  });

  // ---- asking ------------------------------------------------------------
  function appendAnswerBlock() {
    const el = document.createElement('div');
    el.className = 'answer card';
    transcriptEl.append(el);
    return el;
  }

  function surfacePick(answerEl) {
    const node = answerEl.querySelector('.gpt-pick');
    const letter = node?.getAttribute('data-letter');
    const confidence = node?.getAttribute('data-confidence') || '';
    if (letter) {
      lastPick = { letter, confidence };
      pickEl.textContent = confidence
        ? `GPT's pick: ${letter} · confidence: ${confidence}`
        : `GPT's pick: ${letter}`;
      pickEl.style.display = 'block';
    }
  }

  async function runStream(answerEl) {
    busy = true;
    askButton.disabled = true;
    try {
      const text = await streamChat(conversation, answerEl);
      conversation.push({ role: 'assistant', content: text });
      setStatus('');
    } catch (err) {
      if (err.message === 'NO_API_KEY') {
        setStatus('No API key set. Opening Settings…', true);
        chrome.runtime.openOptionsPage();
      } else {
        setStatus(err.message, true);
      }
      throw err;
    } finally {
      busy = false;
      askButton.disabled = false;
    }
  }

  askButton.addEventListener('click', async function () {
    try {
      const q = await scrapeFromPage();
      showQuestion(q);
      setStatus('Asking GPT…');

      conversation = await buildInitialMessages(q.instructions, q.choices);
      const answerEl = appendAnswerBlock();
      await runStream(answerEl);

      lastAnswerEl = answerEl;
      surfacePick(answerEl);
      followupRow.style.display = 'flex';
      feedbackRow.style.display = 'block';
      followupInput.focus();
    } catch (err) {
      if (err.message !== 'NO_API_KEY') setStatus(err.message, true);
    }
  });

  // ---- follow-ups --------------------------------------------------------
  async function sendFollowup() {
    const text = followupInput.value.trim();
    if (!text || busy) return;
    if (!conversation.length) {
      setStatus('Ask GPT first, then ask follow-ups.', true);
      return;
    }
    followupInput.value = '';

    const qLine = document.createElement('div');
    qLine.className = 'followup-q';
    qLine.textContent = `You: ${text}`;
    transcriptEl.append(qLine);

    conversation.push({ role: 'user', content: text });
    setStatus('Thinking…');
    const answerEl = appendAnswerBlock();
    try {
      await runStream(answerEl);
    } catch {
      /* status already set */
    }
    followupInput.focus();
  }

  followupSend.addEventListener('click', sendFollowup);
  followupInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendFollowup();
    }
  });

  // ---- feedback log ------------------------------------------------------
  // Simple djb2 hash so each record can be tied to the prompt that produced it.
  function hashString(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return (h >>> 0).toString(16);
  }

  async function logFeedback(verdict, correctAnswer, notes) {
    if (!currentQuestion || !lastAnswerEl) {
      setStatus('Nothing to log yet — ask GPT first.', true);
      return;
    }
    const { model, systemPrompt } = await getSettings();
    const record = {
      ts: new Date().toISOString(),
      verdict, // 'correct' | 'wrong'
      gptPick: lastPick?.letter || '',
      gptConfidence: lastPick?.confidence || '',
      correctAnswer: (correctAnswer || '').trim().toUpperCase(),
      notes: notes || '',
      question: currentQuestion.instructions || '',
      choices: currentQuestion.choices || '',
      gptHtml: lastAnswerEl.innerHTML,
      model,
      promptHash: hashString(systemPrompt),
    };
    const { feedbackLog = [] } = await chrome.storage.local.get({ feedbackLog: [] });
    feedbackLog.push(record);
    await chrome.storage.local.set({ feedbackLog });
    feedbackRow.style.display = 'none';
    setStatus(
      verdict === 'wrong'
        ? `Logged miss (${feedbackLog.length} total). View/export in Settings.`
        : `Logged correct (${feedbackLog.length} total).`
    );
  }

  document.getElementById('fbCorrect').addEventListener('click', () => logFeedback('correct'));
  document.getElementById('fbWrong').addEventListener('click', () => {
    fbDetail.style.display = 'block';
    fbCorrectAns.focus();
  });
  document.getElementById('fbSave').addEventListener('click', () => {
    logFeedback('wrong', fbCorrectAns.value, fbNotes.value);
    fbCorrectAns.value = '';
    fbNotes.value = '';
  });

  // ---- copy --------------------------------------------------------------
  copyButton.addEventListener('click', async function () {
    try {
      const q = currentQuestion || (await scrapeFromPage());
      await navigator.clipboard.writeText(questionText(q));
      setStatus('Question copied to clipboard.');
    } catch (err) {
      setStatus(err.message, true);
    }
  });

  scrapeFromPage()
    .then((q) => showQuestion(q))
    .catch(() => {});
});
