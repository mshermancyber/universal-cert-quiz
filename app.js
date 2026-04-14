// ─── Exam Configuration (loaded from file) ───────────────────────────────────
let examConfig = null;  // Set when file is loaded

// ─── State ───────────────────────────────────────────────────────────────────
let allQuestions   = [];
let examQuestions  = [];
let userAnswers    = [];
let unscoredSet    = new Set();
let flaggedSet     = new Set();
let currentIdx     = 0;
let timerInterval  = null;
let remainingSecs  = 0;
let startTime      = null;
let examDone       = false;

// ─── Utility ─────────────────────────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function fmt(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function $(id) { return document.getElementById(id); }

function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
}

// ─── CSV Parser ───────────────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 2) throw new Error('File appears empty or has no data rows.');

  const headers = parseCSVLine(lines[0]).map(h => h.trim().toUpperCase());

  // Required column names
  const required = ['TEST_NAME','TEST_CODE','PASS_SCORE','TOTAL_QUESTIONS',
                    'SCORED_QUESTIONS','UNSCORED_QUESTIONS','TIME_MINUTES',
                    'DOMAIN','QUESTION','OPTION_A','OPTION_B','OPTION_C',
                    'OPTION_D','CORRECT_ANSWER','EXPLANATION'];

  const missing = required.filter(r => !headers.includes(r));
  if (missing.length > 0) {
    throw new Error(`Missing required columns: ${missing.join(', ')}\n\nExpected header:\n${required.join(',')}`);
  }

  const col = {};
  headers.forEach((h, i) => col[h] = i);

  // Read config from first data row
  const firstRow = parseCSVLine(lines[1]);
  const config = {
    testName:        firstRow[col['TEST_NAME']]         || 'Unknown Test',
    testCode:        firstRow[col['TEST_CODE']]         || '',
    passScore:       parseInt(firstRow[col['PASS_SCORE']]) || 700,
    totalQuestions:  parseInt(firstRow[col['TOTAL_QUESTIONS']]) || 65,
    scoredQuestions: parseInt(firstRow[col['SCORED_QUESTIONS']]) || 50,
    unscoredQuestions: parseInt(firstRow[col['UNSCORED_QUESTIONS']]) || 15,
    timeMinutes:     parseInt(firstRow[col['TIME_MINUTES']]) || 90,
    maxScore:        1000,  // Standard for most certs
  };

  // Validate config
  if (config.scoredQuestions + config.unscoredQuestions !== config.totalQuestions) {
    throw new Error(`Config error: SCORED_QUESTIONS (${config.scoredQuestions}) + UNSCORED_QUESTIONS (${config.unscoredQuestions}) must equal TOTAL_QUESTIONS (${config.totalQuestions})`);
  }

  // Parse all question rows
  const questions = [];
  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);
    if (row.length < headers.length) continue;

    const q = {
      domain:      row[col['DOMAIN']].trim(),
      text:        row[col['QUESTION']].trim(),
      options:     [
        row[col['OPTION_A']].trim(),
        row[col['OPTION_B']].trim(),
        row[col['OPTION_C']].trim(),
        row[col['OPTION_D']].trim(),
      ],
      correct:     row[col['CORRECT_ANSWER']].trim().toUpperCase(),
      explanation: (row[col['EXPLANATION']] || '').trim(),
    };

    if (!q.text || !q.correct || !['A','B','C','D'].includes(q.correct)) continue;
    questions.push(q);
  }

  if (questions.length < config.totalQuestions) {
    throw new Error(`Not enough questions: file has ${questions.length} valid questions, but test requires ${config.totalQuestions}. Add more questions to the file.`);
  }

  return { config, questions };
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i+1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += c;
    }
  }
  result.push(current);
  return result;
}

// ─── File Loading ─────────────────────────────────────────────────────────────
function handleFileLoad(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const { config, questions } = parseCSV(e.target.result);
      examConfig   = config;
      allQuestions = questions;

      // Update welcome screen with test info
      $('welcome-test-name').textContent  = config.testName;
      $('welcome-test-code').textContent  = config.testCode;
      $('info-questions').textContent     = config.totalQuestions;
      $('info-time').textContent          = config.timeMinutes >= 60
        ? `${Math.floor(config.timeMinutes/60)}h${config.timeMinutes%60 > 0 ? config.timeMinutes%60+'m' : ''}`
        : `${config.timeMinutes}m`;
      $('info-pass').textContent          = config.passScore;
      $('info-pool').textContent          = questions.length;

      // Build domain list
      const domains = [...new Set(questions.map(q => q.domain))];
      const dl = $('domain-list');
      dl.innerHTML = '';
      domains.forEach(d => {
        const count = questions.filter(q => q.domain === d).length;
        const pct   = Math.round((count / questions.length) * 100);
        dl.innerHTML += `<div class="domain-chip"><span>${d}</span><span class="pct">${pct}%</span></div>`;
      });

      $('file-status').textContent = `✓ ${file.name}  (${questions.length} questions)`;
      $('file-status').style.color = 'var(--green)';
      $('btn-start').disabled = false;
      $('btn-start').classList.remove('disabled');

    } catch (err) {
      $('file-status').textContent = `✗ Error: ${err.message}`;
      $('file-status').style.color = 'var(--red)';
      $('btn-start').disabled = true;
      $('btn-start').classList.add('disabled');
    }
  };
  reader.readAsText(file);
}

// ─── Start Exam ───────────────────────────────────────────────────────────────
function startExam() {
  if (!examConfig || allQuestions.length < examConfig.totalQuestions) return;

  const pool     = shuffle(allQuestions).slice(0, examConfig.totalQuestions);
  examQuestions  = pool;
  userAnswers    = new Array(examConfig.totalQuestions).fill(null);
  flaggedSet     = new Set();
  currentIdx     = 0;
  examDone       = false;

  // Pick unscored indices
  const indices  = shuffle([...Array(examConfig.totalQuestions).keys()]);
  unscoredSet    = new Set(indices.slice(0, examConfig.unscoredQuestions));

  startTime      = Date.now();
  remainingSecs  = examConfig.timeMinutes * 60;

  // Update exam header with test name
  $('exam-test-name').textContent = examConfig.testCode || examConfig.testName;

  buildNavGrid();
  loadQuestion(0);
  startTimer();
  show('exam-screen');
}

// ─── Timer ───────────────────────────────────────────────────────────────────
function startTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    remainingSecs--;
    updateTimerUI();
    if (remainingSecs <= 0) {
      clearInterval(timerInterval);
      timeUp();
    }
  }, 1000);
}

function updateTimerUI() {
  const warningThreshold = Math.min(300, examConfig.timeMinutes * 60 * 0.1);
  const cautionThreshold = Math.min(900, examConfig.timeMinutes * 60 * 0.25);

  [$('timer'), $('timer-review')].forEach(el => {
    if (!el) return;
    el.textContent = fmt(remainingSecs);
    el.className = 'timer';
    if (remainingSecs <= warningThreshold)      el.classList.add('danger');
    else if (remainingSecs <= cautionThreshold) el.classList.add('warn');
  });
}

function timeUp() {
  examDone = true;
  showModal('⏱ TIME UP', `Your ${examConfig.timeMinutes} minutes have expired. Submitting your exam now.`, [{
    label: 'View Results',
    cls: 'btn-primary',
    action: () => { closeModal(); finishExam(); }
  }]);
}

// ─── Nav Grid ────────────────────────────────────────────────────────────────
function buildNavGrid() {
  const grid = $('nav-grid');
  grid.innerHTML = '';
  for (let i = 0; i < examConfig.totalQuestions; i++) {
    const btn = document.createElement('button');
    btn.className   = 'nav-btn';
    btn.textContent = i + 1;
    btn.setAttribute('data-i', i);
    btn.addEventListener('click', () => { loadQuestion(i); closeSidebar(); });
    grid.appendChild(btn);
  }
}

function updateNavGrid() {
  const btns = document.querySelectorAll('.nav-btn');
  btns.forEach((btn, i) => {
    btn.className = 'nav-btn';
    if (i === currentIdx)         btn.classList.add('current');
    else if (flaggedSet.has(i))   btn.classList.add('flagged');
    else if (userAnswers[i])      btn.classList.add('answered');
  });
}

// ─── Question Display ────────────────────────────────────────────────────────
function loadQuestion(idx) {
  if (idx < 0 || idx >= examQuestions.length) return;
  currentIdx = idx;
  const q    = examQuestions[idx];

  $('q-counter').textContent = `Q ${idx + 1} / ${examConfig.totalQuestions}`;
  $('q-domain').textContent  = q.domain;
  $('q-text').textContent    = q.text;

  const opts   = $('options');
  opts.innerHTML = '';
  const letters = ['A','B','C','D'];
  q.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'opt-btn';
    btn.setAttribute('data-letter', letters[i]);
    btn.innerHTML = `<span class="opt-letter">${letters[i]}</span><span class="opt-text">${opt}</span>`;
    if (userAnswers[idx] === letters[i]) btn.classList.add('selected');
    btn.addEventListener('click', () => selectAnswer(letters[i], btn));
    opts.appendChild(btn);
  });

  $('btn-flag').classList.toggle('flagged', flaggedSet.has(idx));
  $('btn-prev').disabled      = idx === 0;
  $('btn-next').textContent   = idx === examConfig.totalQuestions - 1 ? 'Review' : 'Next ▶';

  updateNavGrid();
  updateProgress();
}

function selectAnswer(letter, clickedBtn) {
  if (examDone) return;
  userAnswers[currentIdx] = letter;
  document.querySelectorAll('.opt-btn').forEach(b => b.classList.remove('selected'));
  clickedBtn.classList.add('selected');
  updateNavGrid();
  updateProgress();
}

function updateProgress() {
  const answered = userAnswers.filter(a => a !== null).length;
  $('progress-text').textContent = `${answered} / ${examConfig.totalQuestions} answered`;
  $('progress-bar').style.width  = `${(answered / examConfig.totalQuestions) * 100}%`;
}

// ─── Navigation ──────────────────────────────────────────────────────────────
function prevQ() { if (currentIdx > 0) loadQuestion(currentIdx - 1); }
function nextQ() {
  if (currentIdx < examConfig.totalQuestions - 1) loadQuestion(currentIdx + 1);
  else showReviewScreen();
}

function toggleFlag() {
  if (flaggedSet.has(currentIdx)) flaggedSet.delete(currentIdx);
  else flaggedSet.add(currentIdx);
  $('btn-flag').classList.toggle('flagged', flaggedSet.has(currentIdx));
  updateNavGrid();
}

// ─── Review Screen (pre-submit) ──────────────────────────────────────────────
function showReviewScreen() {
  const answered   = userAnswers.filter(a => a !== null).length;
  const unanswered = examConfig.totalQuestions - answered;

  $('review-answered').textContent   = answered;
  $('review-unanswered').textContent = unanswered;
  $('review-flagged').textContent    = flaggedSet.size;

  const ul = $('unanswered-list');
  ul.innerHTML = '';
  userAnswers.forEach((a, i) => {
    if (a === null) {
      const li = document.createElement('button');
      li.className   = 'unanswered-btn';
      li.textContent = `Q${i + 1}`;
      li.addEventListener('click', () => { show('exam-screen'); loadQuestion(i); });
      ul.appendChild(li);
    }
  });

  show('review-screen');
}

function backToExam() { show('exam-screen'); loadQuestion(currentIdx); }

function submitExam() {
  const unanswered = userAnswers.filter(a => a === null).length;
  if (unanswered > 0) {
    showModal(
      'Unanswered Questions',
      `You have ${unanswered} unanswered question${unanswered > 1 ? 's' : ''}. Unanswered questions count as wrong. Submit anyway?`,
      [
        { label: 'Go Back', cls: 'btn-secondary', action: closeModal },
        { label: 'Submit',  cls: 'btn-danger',    action: () => { closeModal(); finishExam(); } }
      ]
    );
  } else {
    showModal(
      'Submit Exam?',
      'Are you ready to submit? You cannot change answers after submitting.',
      [
        { label: 'Cancel', cls: 'btn-secondary', action: closeModal },
        { label: 'Submit', cls: 'btn-primary',   action: () => { closeModal(); finishExam(); } }
      ]
    );
  }
}

// ─── Finish Exam ─────────────────────────────────────────────────────────────
function finishExam() {
  clearInterval(timerInterval);
  examDone = true;
  const usedSecs = Math.floor((Date.now() - startTime) / 1000);
  buildResultsScreen(usedSecs);
  show('results-screen');
}

function buildResultsScreen(usedSecs) {
  let correct = 0, scoredTotal = 0;
  const domainStats = {};

  examQuestions.forEach((q, i) => {
    if (!domainStats[q.domain]) domainStats[q.domain] = { correct: 0, total: 0 };
    if (!unscoredSet.has(i)) {
      scoredTotal++;
      domainStats[q.domain].total++;
      if (userAnswers[i] === q.correct) {
        correct++;
        domainStats[q.domain].correct++;
      }
    }
  });

  const pct    = scoredTotal > 0 ? (correct / scoredTotal) : 0;
  // Scale: minScore + pct * (maxScore - minScore)
  // Most certs use 100-1000 scaled. We support custom pass scores.
  const minScore = 100;
  const scaled   = Math.round(minScore + pct * (examConfig.maxScore - minScore));
  const passed   = scaled >= examConfig.passScore;

  $('result-test-name').textContent  = `${examConfig.testName} (${examConfig.testCode})`;
  $('result-status').textContent     = passed ? 'PASS' : 'FAIL';
  $('result-status').className       = passed ? 'result-status pass' : 'result-status fail';
  $('result-score').textContent      = `${scaled} / ${examConfig.maxScore}`;
  $('result-pass-threshold').textContent = `Passing: ${examConfig.passScore}`;
  $('result-correct').textContent    = `${correct} / ${scoredTotal}`;
  $('result-pct').textContent        = `${Math.round(pct * 100)}%`;
  $('result-time').textContent       = fmt(usedSecs);
  $('result-pass-note').textContent  = passed
    ? '🎉 Congratulations! You passed!'
    : `Score of ${examConfig.passScore}+ needed to pass. Keep studying!`;
  $('result-pass-note').className    = passed ? 'pass-note pass' : 'pass-note fail';

  // Domain breakdown
  const domDiv = $('domain-breakdown');
  domDiv.innerHTML = '<h3>Domain Breakdown</h3>';
  Object.entries(domainStats).forEach(([domain, stats]) => {
    const p = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
    domDiv.innerHTML += `
      <div class="domain-row">
        <div class="domain-name">${domain}</div>
        <div class="domain-score">${stats.correct}/${stats.total}</div>
        <div class="domain-bar-wrap"><div class="domain-bar" style="width:${p}%"></div></div>
        <div class="domain-pct">${p}%</div>
      </div>`;
  });

  window._examData = { examQuestions, userAnswers, unscoredSet, scaled, passed, correct,
                       scoredTotal, usedSecs, config: examConfig };
}

// ─── Answer Review ───────────────────────────────────────────────────────────
function showAnswerReview() {
  const d = window._examData;
  if (!d) return;

  const container = $('review-questions');
  container.innerHTML = '';
  const letters = ['A','B','C','D'];

  d.examQuestions.forEach((q, i) => {
    const ua        = d.userAnswers[i];
    const isU       = d.unscoredSet.has(i);
    const isCorrect = ua === q.correct;
    const isSkipped = ua === null;

    let cardClass = 'review-card';
    let badge = '', badgeClass = '';
    if (isU)           { badge = 'UNSCORED'; badgeClass = 'badge-unscored'; }
    else if (isSkipped){ badge = 'SKIPPED';  badgeClass = 'badge-skip'; cardClass += ' wrong'; }
    else if (isCorrect){ badge = 'CORRECT';  badgeClass = 'badge-correct'; cardClass += ' correct'; }
    else               { badge = 'WRONG';    badgeClass = 'badge-wrong'; cardClass += ' wrong'; }

    let optsHtml = '';
    q.options.forEach((opt, oi) => {
      const letter = letters[oi];
      const isC = letter === q.correct, isUa = letter === ua;
      let cls  = 'review-opt';
      let mark = '';
      if (isC && isUa)  { cls += ' opt-correct'; mark = ' ✓ Your answer (correct)'; }
      else if (isC)     { cls += ' opt-correct'; mark = ' ✓ Correct answer'; }
      else if (isUa)    { cls += ' opt-wrong';   mark = ' ✗ Your answer'; }
      optsHtml += `<div class="${cls}"><strong>${letter}.</strong> ${opt}${mark}</div>`;
    });

    container.innerHTML += `
      <div class="${cardClass}">
        <div class="review-card-header">
          <span class="review-qnum">Q${i+1}</span>
          <span class="review-domain">${q.domain}</span>
          <span class="review-badge ${badgeClass}">${badge}</span>
        </div>
        <div class="review-qtext">${q.text}</div>
        <div class="review-opts">${optsHtml}</div>
        ${q.explanation ? `<div class="review-explanation"><span class="exp-label">EXPLANATION</span>${q.explanation}</div>` : ''}
      </div>`;
  });

  show('answer-review-screen');
}

function backToResults() { show('results-screen'); }

// ─── Export ───────────────────────────────────────────────────────────────────
function exportResults() {
  const d = window._examData;
  if (!d) return;
  const letters = ['A','B','C','D'];
  const cfg = d.config;

  const ds = {};
  d.examQuestions.forEach((q, i) => {
    if (!ds[q.domain]) ds[q.domain] = { c: 0, t: 0 };
    if (!d.unscoredSet.has(i)) {
      ds[q.domain].t++;
      if (d.userAnswers[i] === q.correct) ds[q.domain].c++;
    }
  });

  let qhtml = '';
  d.examQuestions.forEach((q, i) => {
    const ua  = d.userAnswers[i];
    const isU = d.unscoredSet.has(i);
    const isC = ua === q.correct;
    const isSk = ua === null;
    const cc  = isU ? 'unscored' : (isC ? 'correct' : 'wrong');
    const badge = isU ? '<span class="badge bu">UNSCORED</span>'
                : isSk ? '<span class="badge bs">SKIPPED</span>'
                : isC  ? '<span class="badge bc">CORRECT</span>'
                       : '<span class="badge bw">WRONG</span>';
    let optsH = '';
    q.options.forEach((opt, oi) => {
      const L = letters[oi], isOC = L === q.correct, isOU = L === ua;
      const cls  = (isOC && isOU) || isOC ? 'opt oc' : isOU ? 'opt ow' : 'opt on';
      const mark = (isOC && isOU) ? ' ✓ Your answer (correct)' : isOC ? ' ✓ Correct answer' : isOU ? ' ✗ Your answer' : '';
      optsH += `<div class="${cls}"><strong>${L}.</strong> ${opt}${mark}</div>`;
    });
    qhtml += `<div class="qcard ${cc}"><div class="qh"><span class="qnum">Q${i+1}</span>${badge}</div><div class="qdom">${q.domain}</div><div class="qtext">${q.text}</div>${optsH}${q.explanation?`<div class="exp"><span class="el">EXPLANATION</span>${q.explanation}</div>`:''}</div>`;
  });

  let domH = '';
  Object.entries(ds).forEach(([dom, s]) => {
    const p = s.t > 0 ? Math.round((s.c/s.t)*100) : 0;
    domH += `<div class="dr"><span class="dn">${dom}</span><span class="ds">${s.c}/${s.t}</span><div class="db-wrap"><div class="db-fill" style="width:${p}%"></div></div><span class="dp">${p}%</span></div>`;
  });

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>${cfg.testName} Results</title>
<style>
body{background:#08080f;color:#dcdcf0;font-family:'Courier New',monospace;padding:30px;print-color-adjust:exact;-webkit-print-color-adjust:exact}
h1{color:#00e6ff;text-align:center;letter-spacing:4px;font-size:22px;margin-bottom:4px}
.sub{text-align:center;color:#666699;font-size:11px;margin-bottom:20px}
.sp{background:#12122a;border:1px solid #00e6ff33;border-radius:8px;padding:18px;margin-bottom:22px;display:flex;gap:14px;flex-wrap:wrap;justify-content:space-around}
.si{text-align:center}.sv{font-size:30px;font-weight:900}.sl{font-size:10px;color:#8888aa;letter-spacing:2px}
.pass{color:#39ff14}.fail{color:#ff3250}.cyan{color:#00e6ff}.yellow{color:#ffe600}.mag{color:#dc00c8}
.ds-sec{background:#12122a;border:1px solid #333355;border-radius:6px;padding:14px;margin-bottom:18px}
.ds-sec h3{color:#dc00c8;font-size:11px;letter-spacing:3px;margin-bottom:8px}
.dr{display:flex;align-items:center;gap:10px;padding:5px 0;border-bottom:1px solid #1a1a30;font-size:11px}
.dn{flex:1;color:#aaaacc}.ds{color:#ffe600;width:48px;text-align:right}.dp{color:#8888aa;width:38px;text-align:right}
.db-wrap{width:140px;height:5px;background:#1a1a30;border-radius:3px;overflow:hidden}
.db-fill{height:100%;background:linear-gradient(90deg,#00e6ff,#dc00c8);border-radius:3px}
.qcard{background:#12122a;border-left:3px solid #333355;border-radius:4px;padding:13px;margin-bottom:11px;page-break-inside:avoid}
.qcard.correct{border-left-color:#39ff14}.qcard.wrong{border-left-color:#ff3250}.qcard.unscored{border-left-color:#ffe600;opacity:.85}
.qh{display:flex;justify-content:space-between;margin-bottom:7px}
.qnum{font-size:10px;color:#8888aa}.qdom{font-size:10px;color:#666699;margin-bottom:5px}
.badge{font-size:9px;padding:2px 7px;border-radius:3px;font-weight:bold;letter-spacing:1px}
.bc{background:#39ff1422;color:#39ff14;border:1px solid #39ff1444}
.bw{background:#ff325022;color:#ff3250;border:1px solid #ff325044}
.bu{background:#ffe60022;color:#ffe600;border:1px solid #ffe60044}
.bs{background:#88888822;color:#aaa;border:1px solid #88888844}
.qtext{font-size:12px;line-height:1.5;margin-bottom:9px}
.opt{font-size:11px;padding:5px 8px;border-radius:3px;margin-bottom:3px;border:1px solid transparent}
.oc{background:#39ff1415;border-color:#39ff1455;color:#39ff14;font-weight:bold}
.ow{background:#ff325015;border-color:#ff325055;color:#ff3250}.on{color:#8888aa}
.exp{margin-top:7px;padding:7px;background:#0a0a20;border-radius:3px;font-size:10px;color:#9999bb;border-left:2px solid #00e6ff33;line-height:1.5}
.el{color:#00e6ff;font-size:9px;letter-spacing:2px;display:block;margin-bottom:3px}
.footer{text-align:center;color:#444466;font-size:10px;margin-top:28px;padding-top:14px;border-top:1px solid #1a1a30}
@media print{body{padding:12px}.qcard{page-break-inside:avoid}}
</style></head><body>
<h1>◈ EXAM RESULTS ◈</h1>
<div class="sub">${cfg.testName} (${cfg.testCode}) | ${new Date().toLocaleString()}</div>
<div class="sp">
<div class="si"><div class="sv ${d.passed?'pass':'fail'}">${d.passed?'PASS':'FAIL'}</div><div class="sl">STATUS</div></div>
<div class="si"><div class="sv cyan">${d.scaled}</div><div class="sl">SCORE / ${cfg.maxScore}</div></div>
<div class="si"><div class="sv" style="color:#aaa;font-size:14px;padding-top:8px">${cfg.passScore}+ to pass</div><div class="sl">THRESHOLD</div></div>
<div class="si"><div class="sv yellow">${d.correct}/${d.scoredTotal}</div><div class="sl">CORRECT</div></div>
<div class="si"><div class="sv mag">${Math.round((d.correct/d.scoredTotal)*100)}%</div><div class="sl">ACCURACY</div></div>
<div class="si"><div class="sv" style="color:#aaaaff">${fmt(d.usedSecs)}</div><div class="sl">TIME USED</div></div>
</div>
<div class="ds-sec"><h3>DOMAIN BREAKDOWN</h3>${domH}</div>
${qhtml}
<div class="footer">${cfg.testName} Quiz Trainer | Open in browser → File > Print > Save as PDF</div>
</body></html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${cfg.testCode.replace(/[^a-zA-Z0-9]/g,'-')}-results-${Date.now()}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────
function toggleSidebar() {
  $('sidebar').classList.toggle('open');
  $('sidebar-overlay').classList.toggle('active');
}
function closeSidebar() {
  $('sidebar').classList.remove('open');
  $('sidebar-overlay').classList.remove('active');
}

// ─── Modal ───────────────────────────────────────────────────────────────────
function showModal(title, message, buttons) {
  $('modal-title').textContent   = title;
  $('modal-message').textContent = message;
  const bf = $('modal-buttons');
  bf.innerHTML = '';
  buttons.forEach(b => {
    const btn = document.createElement('button');
    btn.className   = `btn ${b.cls}`;
    btn.textContent = b.label;
    btn.addEventListener('click', b.action);
    bf.appendChild(btn);
  });
  $('modal-overlay').classList.add('active');
}
function closeModal() { $('modal-overlay').classList.remove('active'); }

// ─── Service Worker ───────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

// ─── PWA Install ─────────────────────────────────────────────────────────────
let deferredPrompt;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  $('install-btn').style.display = 'flex';
});
function installPWA() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(() => {
      deferredPrompt = null;
      $('install-btn').style.display = 'none';
    });
  }
}
