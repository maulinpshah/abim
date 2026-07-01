// HOW TO USE
// 1. Open an actual exam question on starttest.com so it is visible on screen.
// 2. Open DevTools on that tab (F12 or Cmd+Opt+I) → Console.
// 3. Paste this entire file and press Enter.
// It runs the SAME traversal as the extension and prints what it would scrape,
// plus diagnostics if a step fails. Share the output and we can lock in selectors.

(function () {
  const exam = document.getElementById('ExamIframe');
  if (!exam) return console.error('[verify] #ExamIframe not found on the top page.');

  let examDoc;
  try {
    examDoc = exam.contentWindow.document;
  } catch (e) {
    return console.error('[verify] #ExamIframe is cross-origin, cannot read it:', e.message);
  }

  // Find the question frame. Try the known id first, then any nested frame.
  let frame = examDoc.getElementById('ElementDisplayFrame');
  if (!frame) {
    const all = [...examDoc.querySelectorAll('iframe, frame')];
    console.warn(
      '[verify] #ElementDisplayFrame not found. Other frames inside #ExamIframe:',
      all.map((f) => ({ id: f.id, name: f.name, src: f.src }))
    );
    frame = all[0];
  }
  if (!frame) return console.error('[verify] No frame inside #ExamIframe.');

  let doc;
  try {
    doc = frame.contentWindow.document;
  } catch (e) {
    return console.error('[verify] Question frame is cross-origin, cannot read it:', e.message);
  }

  const instructions = doc.querySelector('div.instructions-content');
  const choices = doc.querySelector('div.stem-block');

  console.log('[verify] instructions (div.instructions-content):', instructions?.innerText ?? '❌ NOT FOUND');
  console.log('[verify] choices (div.stem-block):', choices?.innerText ?? '❌ NOT FOUND');

  if (!instructions || !choices) {
    console.warn(
      '[verify] One or both selectors missed. Candidate containers in the question frame (id / class / first 60 chars):'
    );
    [...doc.querySelectorAll('div')]
      .filter((d) => (d.innerText || '').trim().length > 20)
      .slice(0, 40)
      .forEach((d) =>
        console.log('  ', { id: d.id, class: d.className }, (d.innerText || '').trim().slice(0, 60))
      );
  }
})();
