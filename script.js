// CS600 Final Tutorial Site - interactivity

// ---- Local progress persistence (flashcards, quizzes, practice reveals) ----
// Single localStorage key holding a JSON object. No analytics, no network.
// v2: keys are content-hashed (or explicit data-*-id) instead of positional,
// so reordering or inserting items does not corrupt saved state.
const PROGRESS_KEY = 'cs600-final-progress-v2';

// Small string hash (djb2 variant). Stable across reloads, no crypto needed.
function simpleHash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

// Stable key for a quiz: explicit data-quiz-id wins, then a hash of the
// question text, then positional index as a last resort.
function quizKey(q, idx) {
  if (q.dataset.quizId) return 'quiz:id:' + q.dataset.quizId;
  const t = q.querySelector('.quiz-q');
  const text = t ? t.textContent.trim() : '';
  if (text) return 'quiz:h:' + simpleHash(text);
  return 'quiz:idx:' + idx;
}

// Stable key for a practice card: explicit data-practice-id wins, then hash
// of the question text, then positional index.
function practiceKey(p, idx) {
  if (p.dataset.practiceId) return 'practice:id:' + p.dataset.practiceId;
  const t = p.querySelector('.practice-q');
  const text = t ? t.textContent.trim() : '';
  if (text) return 'practice:h:' + simpleHash(text);
  return 'practice:idx:' + idx;
}

function loadProgress() {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return { flashcards: {}, quizzes: {}, practice: {} };
    const parsed = JSON.parse(raw);
    return {
      flashcards: parsed.flashcards || {},
      quizzes: parsed.quizzes || {},
      practice: parsed.practice || {},
    };
  } catch (_) {
    return { flashcards: {}, quizzes: {}, practice: {} };
  }
}

function saveProgress(p) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
  } catch (_) {
    // Quota exceeded or storage disabled — silently ignore. The site stays
    // fully functional, just without cross-session memory.
  }
}

// Stable key for a flashcard: prefer the front .term text, fall back to index.
function flashcardKey(card, idx) {
  const term = card.querySelector('.flashcard-front .term');
  const t = term ? term.textContent.trim() : '';
  return t || ('card-' + idx);
}

const progress = loadProgress();

// ---- Smooth TOC active highlighting ----
function initToc() {
  const links = document.querySelectorAll('.toc-list a');
  const sections = [...document.querySelectorAll('main .section, main .hero')];
  const map = new Map();
  links.forEach(a => map.set(a.getAttribute('href').slice(1), a));

  function update() {
    const scrollY = window.scrollY + 120;
    let current = sections[0];
    for (const s of sections) {
      if (s.offsetTop <= scrollY) current = s;
    }
    if (!current) return;
    links.forEach(a => a.classList.remove('is-active'));
    const a = map.get(current.id);
    if (a) a.classList.add('is-active');

    // progress bar — guard against docH <= 0 (page shorter than viewport)
    const docH = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docH <= 0 ? 100 : Math.min(100, Math.max(0, (window.scrollY / docH) * 100));
    const bar = document.getElementById('progress-bar');
    if (bar) bar.style.width = pct + '%';
  }
  window.addEventListener('scroll', update, { passive: true });
  update();
}

// ---- Flashcards ----
function initFlashcards() {
  document.querySelectorAll('.flashcard').forEach((card, idx) => {
    // Make the card act like a button for AT and keyboard users.
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    const front = card.querySelector('.flashcard-front .term');
    if (front) {
      card.setAttribute('aria-label', 'Flashcard: ' + front.textContent.trim() + ' (press Enter or Space to flip)');
    } else {
      card.setAttribute('aria-label', 'Flashcard (press Enter or Space to flip)');
    }

    const key = flashcardKey(card, idx);
    // Restore prior flipped state.
    if (progress.flashcards[key]) {
      card.classList.add('is-flipped');
    }
    card.setAttribute('aria-pressed', card.classList.contains('is-flipped') ? 'true' : 'false');

    function flip() {
      const flipped = card.classList.toggle('is-flipped');
      card.setAttribute('aria-pressed', flipped ? 'true' : 'false');
      progress.flashcards[key] = flipped;
      saveProgress(progress);
    }
    card.addEventListener('click', flip);
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        flip();
      }
    });
  });
}

// ---- Reveal practice ----
function initPractice() {
  document.querySelectorAll('.practice').forEach((p, idx) => {
    const btn = p.querySelector('.reveal-btn');
    const ans = p.querySelector('.practice-a');
    if (!btn || !ans) return;

    // Wire ARIA so screen readers know the answer is collapsible.
    const ansId = ans.id || ('practice-a-' + idx);
    ans.id = ansId;
    btn.setAttribute('aria-controls', ansId);

    const key = practiceKey(p, idx);
    // Restore prior open state.
    if (progress.practice[key]) {
      p.classList.add('is-open');
      btn.textContent = 'Hide answer';
    }
    const initOpen = p.classList.contains('is-open');
    btn.setAttribute('aria-expanded', initOpen ? 'true' : 'false');
    ans.setAttribute('aria-hidden', initOpen ? 'false' : 'true');

    btn.addEventListener('click', () => {
      const open = p.classList.toggle('is-open');
      btn.textContent = open ? 'Hide answer' : 'Reveal answer';
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      ans.setAttribute('aria-hidden', open ? 'false' : 'true');
      progress.practice[key] = open;
      saveProgress(progress);
    });
  });
}

// ---- Quizzes ----
function initQuiz() {
  document.querySelectorAll('.quiz').forEach((q, qIdx) => {
    const correctIdx = parseInt(q.dataset.correct, 10);
    const fb = q.querySelector('.quiz-feedback');
    if (fb) {
      fb.setAttribute('role', 'status');
      fb.setAttribute('aria-live', 'polite');
    }
    const correctMsg = q.dataset.correctMsg || 'Correct!';
    const wrongMsg = q.dataset.wrongMsg || 'Not quite — try again.';
    const isScored = q.classList.contains('test-q');
    const key = quizKey(q, qIdx);

    function applyState(picked) {
      const opts = q.querySelectorAll('.quiz-opt');
      opts.forEach(b => {
        b.classList.remove('correct', 'wrong');
        b.setAttribute('aria-pressed', 'false');
      });
      if (picked == null || picked < 0 || picked >= opts.length) return;
      const btn = opts[picked];
      btn.setAttribute('aria-pressed', 'true');
      if (picked === correctIdx) {
        btn.classList.add('correct');
        if (fb) { fb.textContent = '✓ ' + correctMsg; fb.style.color = 'var(--teal)'; }
      } else {
        btn.classList.add('wrong');
        if (fb) { fb.textContent = '✗ ' + wrongMsg; fb.style.color = 'var(--alert)'; }
        if (isScored && opts[correctIdx]) opts[correctIdx].classList.add('correct');
      }
      if (isScored) q.classList.add('is-locked');
    }

    // Restore prior pick.
    const saved = progress.quizzes[key];
    if (saved && typeof saved.picked === 'number') applyState(saved.picked);

    q.querySelectorAll('.quiz-opt').forEach((btn, i) => {
      btn.addEventListener('click', () => {
        if (isScored && q.classList.contains('is-locked')) return;
        applyState(i);
        progress.quizzes[key] = { picked: i, correct: i === correctIdx };
        saveProgress(progress);
        if (isScored) updateTestScore();
      });
    });
  });

  // After all quizzes are restored, refresh the scored-test counter.
  updateTestScore();
}

// ---- Scored self-test progress ----
function updateTestScore() {
  const all = document.querySelectorAll('.test-q');
  if (all.length === 0) return;
  const attempted = [...all].filter(q => q.classList.contains('is-locked')).length;
  const correct = [...all].filter(q => {
    if (!q.classList.contains('is-locked')) return false;
    // The user got it right iff no .quiz-opt has class "wrong".
    return q.querySelector('.quiz-opt.wrong') === null;
  }).length;
  const bar = document.getElementById('test-bar');
  const score = document.getElementById('test-score');
  if (bar) bar.style.width = (correct / all.length * 100) + '%';
  if (score) score.textContent = correct + ' / ' + all.length + ' correct · ' + attempted + ' attempted';
}

// ---- Walkthrough widgets ----
function initWalk() {
  document.querySelectorAll('.walk').forEach(w => {
    const buttons = w.querySelectorAll('.walk-step');
    const stages = w.querySelectorAll('.walk-scene');
    const captions = JSON.parse(w.dataset.captions || '[]');
    const cap = w.querySelector('.walk-caption');
    function show(i) {
      buttons.forEach((b, j) => b.classList.toggle('is-active', i === j));
      stages.forEach((s, j) => s.style.display = i === j ? 'block' : 'none');
      if (cap) cap.textContent = captions[i] || '';
    }
    buttons.forEach((b, i) => b.addEventListener('click', () => show(i)));
    show(0);
  });
}

// ---- RP -> BPP simulator ----
function initSim() {
  const sim = document.getElementById('rp-bpp-sim');
  if (!sim) return;
  const runs = sim.querySelector('#sim-runs');
  const p0 = sim.querySelector('#sim-p0');
  const errOut = sim.querySelector('#sim-err');
  const errBar = sim.querySelector('#sim-err-bar');
  const accOut = sim.querySelector('#sim-acc');
  const accBar = sim.querySelector('#sim-acc-bar');
  const runsLabel = sim.querySelector('#sim-runs-label');
  const p0Label = sim.querySelector('#sim-p0-label');

  function update() {
    const k = parseInt(runs.value, 10);
    const p = parseFloat(p0.value);
    const fail = Math.pow(1 - p, k);
    const acc = 1 - fail;
    runsLabel.textContent = k;
    p0Label.textContent = p.toFixed(2);
    errOut.textContent = (fail * 100).toFixed(2) + '%';
    accOut.textContent = (acc * 100).toFixed(2) + '%';
    errBar.style.width = (fail * 100) + '%';
    accBar.style.width = (acc * 100) + '%';
  }
  runs.addEventListener('input', update);
  p0.addEventListener('input', update);
  update();
}

// ---- Template picker ----
function initPicker() {
  const picker = document.getElementById('template-picker');
  if (!picker) return;
  const clues = picker.querySelectorAll('.picker-clue');
  const result = picker.querySelector('.picker-result');

  const recipes = {
    'L': { letter: 'A', name: 'Logspace decider', why: 'You only need a few counters of size O(log n).', how: 'List variables, bound each by n, scan input, accept on a final condition.' },
    'NL': { letter: 'B', name: 'Nondeterministic logspace', why: 'You can guess a path or witness one step at a time.', how: 'Guess the next step, store only current position + counter.' },
    'circuit': { letter: 'C', name: 'Circuit family analysis', why: 'Question asks for size, depth, or a per-length circuit.', how: 'Build C_n, prove correctness, count gates and depth.' },
    'fanin': { letter: 'D', name: 'Fan-in conversion (B1→B0)', why: 'Question asks to convert unbounded gates to bounded.', how: 'Replace each fan-in-k gate with a balanced binary tree: size k−1, depth ⌈log₂ k⌉.' },
    'rand': { letter: 'E', name: 'Randomized class inclusion', why: 'You\'re moving a machine between RP, coRP, BPP, ZPP.', how: 'Compose old machines, analyze yes/no probabilities, match target def.' },
    'self': { letter: 'F', name: 'Self-reducibility', why: 'You have a decider and need an actual witness.', how: 'Force one piece at a time using restricted instances; keep the partial witness extendable.' },
    'pspace': { letter: '+', name: 'Class inclusion via Savitch', why: 'You\'re comparing space classes.', how: 'Use Savitch (NSPACE(f)⊆SPACE(f²)) or configuration counting.' },
    'conl': { letter: '+', name: 'NL = coNL counting', why: 'You need to argue non-reachability is in NL.', how: 'Inductive count cᵢ of vertices reachable in ≤i steps; verify with logspace certificates.' },
  };

  function render(active) {
    if (!active) {
      result.innerHTML = '<em>Click a clue above to see the right template.</em>';
      return;
    }
    const r = recipes[active];
    result.innerHTML =
      '<strong>Template ' + r.letter + ': ' + r.name + '</strong><br>' +
      '<span style="color:var(--muted);font-size:0.9rem;">Why this fits:</span> ' + r.why + '<br>' +
      '<span style="color:var(--muted);font-size:0.9rem;">How to write it:</span> ' + r.how;
  }
  clues.forEach(c => {
    c.addEventListener('click', () => {
      clues.forEach(x => x.classList.remove('is-active'));
      c.classList.add('is-active');
      render(c.dataset.t);
    });
  });
  render(null);
}

// ---- Min-cut probability ----
function initMinCut() {
  const mc = document.getElementById('mincut-sim');
  if (!mc) return;
  const n = mc.querySelector('#mc-n');
  const r = mc.querySelector('#mc-r');
  const single = mc.querySelector('#mc-single');
  const boost = mc.querySelector('#mc-boost');
  const nL = mc.querySelector('#mc-n-label');
  const rL = mc.querySelector('#mc-r-label');

  function update() {
    const N = parseInt(n.value, 10);
    const R = parseInt(r.value, 10);
    nL.textContent = N;
    rL.textContent = R;
    const p = 2 / (N * (N - 1));
    const boostP = 1 - Math.pow(1 - p, R);
    single.textContent = (p * 100).toFixed(4) + '%';
    boost.textContent = (boostP * 100).toFixed(2) + '%';
  }
  n.addEventListener('input', update);
  r.addEventListener('input', update);
  update();
}

// ---- Majority circuit demo ----
function initMajority() {
  const mj = document.getElementById('majority-demo');
  if (!mj) return;
  const bits = mj.querySelectorAll('.maj-bit');
  const summary = mj.querySelector('#maj-summary');
  const result = mj.querySelector('#maj-result');
  const subsetsEl = mj.querySelector('#maj-subsets');

  function update() {
    const arr = [...bits].map(b => b.dataset.on === '1' ? 1 : 0);
    bits.forEach(b => {
      const on = b.dataset.on === '1';
      b.classList.toggle('on', on);
      b.textContent = on ? '1' : '0';
    });
    const ones = arr.reduce((a,b) => a+b, 0);
    const n = arr.length;
    const k = Math.floor(n/2) + 1;
    const isMaj = ones >= k;
    summary.innerHTML = '<strong>' + ones + '</strong> ones out of ' + n + ' &middot; threshold k=' + k;
    result.textContent = isMaj ? 'MAJ = 1 (yes)' : 'MAJ = 0 (no)';
    result.style.color = isMaj ? 'var(--teal)' : 'var(--accent-deep)';

    // show which k-subsets are all-1
    const positions = arr.map((v,i) => v === 1 ? (i+1) : null).filter(x => x);
    const subsets = [];
    function combos(arr, k) {
      const res = [];
      function rec(start, cur) {
        if (cur.length === k) { res.push([...cur]); return; }
        for (let i = start; i < arr.length; i++) { cur.push(arr[i]); rec(i+1, cur); cur.pop(); }
      }
      rec(0, []);
      return res;
    }
    const sat = combos(positions, k);
    if (sat.length) {
      subsetsEl.innerHTML = sat.slice(0, 6).map(s => '<span class="pill" style="background:rgba(46,122,101,0.18);">{' + s.join(',') + '}</span>').join(' ') + (sat.length > 6 ? ' <span style="color:var(--muted);">+' + (sat.length-6) + ' more</span>' : '');
    } else {
      subsetsEl.innerHTML = '<span style="color:var(--muted);">No k-subset is entirely 1 → OR gate outputs 0.</span>';
    }
  }
  bits.forEach(b => {
    b.addEventListener('click', () => {
      b.dataset.on = b.dataset.on === '1' ? '0' : '1';
      update();
    });
  });
  update();
}

// ---- Reset progress ----
function initReset() {
  const btn = document.getElementById('reset-progress');
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (!confirm('Clear all saved progress? This will reset flashcards, revealed practice answers, and self-test picks. (Cannot be undone.)')) return;

    // 1. Wipe localStorage and in-memory progress.
    try { localStorage.removeItem(PROGRESS_KEY); } catch (_) {}
    progress.flashcards = {};
    progress.quizzes = {};
    progress.practice = {};

    // 2. Visually reset every interactive element immediately.
    document.querySelectorAll('.flashcard').forEach(card => {
      card.classList.remove('is-flipped');
      card.setAttribute('aria-pressed', 'false');
    });
    document.querySelectorAll('.practice').forEach(p => {
      p.classList.remove('is-open');
      const rb = p.querySelector('.reveal-btn');
      const ans = p.querySelector('.practice-a');
      if (rb) {
        rb.textContent = 'Reveal answer';
        rb.setAttribute('aria-expanded', 'false');
      }
      if (ans) ans.setAttribute('aria-hidden', 'true');
    });
    document.querySelectorAll('.quiz').forEach(q => {
      q.classList.remove('is-locked');
      q.querySelectorAll('.quiz-opt').forEach(b => {
        b.classList.remove('correct', 'wrong');
        b.setAttribute('aria-pressed', 'false');
      });
      const fb = q.querySelector('.quiz-feedback');
      if (fb) { fb.textContent = ''; fb.style.color = ''; }
    });

    // 3. Refresh the scored-test counter.
    updateTestScore();

    // 4. Brief visual confirmation.
    btn.classList.remove('flash');
    void btn.offsetWidth; // force reflow so the animation restarts
    btn.classList.add('flash');
  });
}

// ---- Init all ----
document.addEventListener('DOMContentLoaded', () => {
  initToc();
  initFlashcards();
  initPractice();
  initQuiz();
  initWalk();
  initSim();
  initPicker();
  initMinCut();
  initMajority();
  initReset();
  // KaTeX auto-render (with offline fallback banner)
  // Two failure paths:
  //   - The <script>/<link> tags in <head> have onerror="window.katexFail()".
  //     window.katexFail is defined inline in <head> *before* those tags, so
  //     an immediate network error has a real handler to call. It sets
  //     window.katexFailed and (if the body has rendered) reveals the banner.
  //   - This polling loop covers the slow-but-eventually-succeeds case. We
  //     wait up to ~15s before giving up so we don't false-alarm on slow
  //     connections (the previous 2.5s budget was too tight).
  function showKatexBanner() {
    var banner = document.getElementById('katex-offline-banner');
    if (banner) banner.style.display = 'block';
  }
  // If a head-time error already fired before the banner element existed,
  // surface it now that the DOM is ready.
  if (window.katexFailed) showKatexBanner();

  function tryRender(attempt) {
    if (window.renderMathInElement) {
      renderMathInElement(document.body, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false },
          { left: '\\[', right: '\\]', display: true },
        ],
        throwOnError: false,
      });
      return;
    }
    if (attempt < 30) {
      setTimeout(function () { tryRender(attempt + 1); }, 500);
    } else {
      showKatexBanner();
    }
  }
  tryRender(0);
});
