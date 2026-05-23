// ── STATE ──────────────────────────────────────────────────────────────
const App = {
  screen: 'home',
  quizMode: null,
  quizCategory: null,
  quizQuestions: [],
  currentIndex: 0,
  selectedAnswer: null,
  sessionResults: [],
};

// ── STORAGE ────────────────────────────────────────────────────────────
const Store = {
  KEY: 'takken_hub_v1',

  load() {
    try { return JSON.parse(localStorage.getItem(this.KEY) || '{}'); }
    catch { return {}; }
  },

  save(data) {
    try { localStorage.setItem(this.KEY, JSON.stringify(data)); }
    catch (e) { console.warn('Storage error', e); }
  },

  history() { return this.load().history || {}; },

  recordAnswer(qid, isCorrect) {
    const data = this.load();
    if (!data.history) data.history = {};
    const h = data.history[qid] || { attempts: 0, correct: 0, bookmarked: false };
    h.attempts++;
    if (isCorrect) h.correct++;
    h.lastAt = Date.now();
    data.history[qid] = h;
    this.save(data);
  },

  toggleBookmark(qid) {
    const data = this.load();
    if (!data.history) data.history = {};
    const h = data.history[qid] || { attempts: 0, correct: 0, bookmarked: false };
    h.bookmarked = !h.bookmarked;
    data.history[qid] = h;
    this.save(data);
    return h.bookmarked;
  },

  isBookmarked(qid) {
    const h = this.history();
    return !!(h[qid] && h[qid].bookmarked);
  },

  reset() { this.save({}); },
};

// ── UTILITIES ──────────────────────────────────────────────────────────
function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── QUIZ LOGIC ─────────────────────────────────────────────────────────
function startQuiz(mode, category) {
  const hist = Store.history();
  let qs = [];

  switch (mode) {
    case 'category':
      qs = QUESTIONS.filter(q => q.category === category);
      break;
    case 'random':
      qs = shuffleArray(QUESTIONS).slice(0, 10);
      break;
    case 'review':
      qs = QUESTIONS.filter(q => {
        const h = hist[q.id];
        return h && h.attempts > 0 && h.correct < h.attempts;
      });
      break;
    case 'bookmark':
      qs = QUESTIONS.filter(q => hist[q.id] && hist[q.id].bookmarked);
      break;
    case 'session-review': {
      const wrongIds = App.sessionResults.filter(r => !r.correct).map(r => r.qid);
      qs = QUESTIONS.filter(q => wrongIds.includes(q.id));
      break;
    }
  }

  if (qs.length === 0) {
    const msgs = {
      review:   '間違えた問題がまだありません。\nまず問題を解いてみましょう！',
      bookmark: '付箋をつけた問題がありません。\n問題画面の ☆ をタップして付箋を追加できます。',
    };
    showToast(msgs[mode] || '対象の問題がありません。');
    return;
  }

  App.quizMode       = mode;
  App.quizCategory   = category || null;
  App.quizQuestions  = qs;
  App.currentIndex   = 0;
  App.selectedAnswer = null;
  App.sessionResults = [];
  go('quiz');
}

function answerQuestion(idx) {
  if (App.selectedAnswer !== null) return;
  const q  = App.quizQuestions[App.currentIndex];
  const ok = idx === q.correct;
  App.selectedAnswer = idx;
  App.sessionResults.push({ qid: q.id, correct: ok });
  Store.recordAnswer(q.id, ok);
  render();
  // スクロールでフィードバックを表示
  requestAnimationFrame(() => {
    const fb = document.querySelector('.feedback');
    if (fb) fb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

function nextQuestion() {
  if (App.currentIndex < App.quizQuestions.length - 1) {
    App.currentIndex++;
    App.selectedAnswer = null;
  } else {
    go('result');
    return;
  }
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── NAVIGATION ─────────────────────────────────────────────────────────
function go(screen) {
  App.screen = screen;
  render();
  window.scrollTo(0, 0);
}

// ── RENDER ─────────────────────────────────────────────────────────────
function render() {
  const fns = {
    home:       renderHome,
    categories: renderCategories,
    quiz:       renderQuiz,
    result:     renderResult,
    stats:      renderStats,
  };
  const fn = fns[App.screen];
  if (fn) document.getElementById('app').innerHTML = fn();
}

// ── HOME ───────────────────────────────────────────────────────────────
function renderHome() {
  const hist  = Store.history();
  const vals  = Object.values(hist);
  const total = vals.reduce((s, h) => s + h.attempts, 0);
  const corr  = vals.reduce((s, h) => s + h.correct,  0);
  const rate  = total > 0 ? Math.round(corr / total * 100) : 0;
  const done  = vals.filter(h => h.attempts > 0).length;
  const bkCnt = vals.filter(h => h.bookmarked).length;
  const hasWrong = QUESTIONS.some(q => {
    const h = hist[q.id];
    return h && h.attempts > 0 && h.correct < h.attempts;
  });

  return `
  <div class="screen">
    <div class="home-hero">
      <div class="home-logo">🏠</div>
      <div class="home-title">Takken Learning Hub</div>
      <div class="home-subtitle">宅建試験 学習サポートアプリ</div>
      <div class="stats-bar">
        <div class="stat-item">
          <div class="stat-value">${done}</div>
          <div class="stat-label">学習済み問題</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${total}</div>
          <div class="stat-label">総回答数</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${rate}%</div>
          <div class="stat-label">正答率</div>
        </div>
      </div>
    </div>

    <div class="menu-section">
      <div class="section-label">学習メニュー</div>
      <div class="menu-grid">
        <button class="menu-btn primary" data-action="go-categories">
          <span class="btn-icon">📚</span>
          <span class="btn-label">分野別学習</span>
          <span class="btn-sub">カテゴリを選んで学ぶ</span>
        </button>
        <button class="menu-btn" data-action="start-random">
          <span class="btn-icon">🎲</span>
          <span class="btn-label">ランダムテスト</span>
          <span class="btn-sub">全分野から10問</span>
        </button>
        <button class="menu-btn" data-action="start-review"
          style="${!hasWrong ? 'opacity:0.45;pointer-events:none' : ''}">
          <span class="btn-icon">🔄</span>
          <span class="btn-label">間違い復習</span>
          <span class="btn-sub">苦手問題を克服</span>
        </button>
        <button class="menu-btn" data-action="start-bookmark"
          style="${bkCnt === 0 ? 'opacity:0.45;pointer-events:none' : ''}">
          <span class="btn-icon">🔖</span>
          <span class="btn-label">付箋問題</span>
          <span class="btn-sub">${bkCnt > 0 ? bkCnt + '問' : 'なし'}</span>
        </button>
      </div>
      <button class="menu-btn full" data-action="go-stats">
        <span class="btn-icon">📊</span>
        <span class="btn-label">学習記録を見る</span>
      </button>
    </div>
  </div>`;
}

// ── CATEGORIES ─────────────────────────────────────────────────────────
function renderCategories() {
  const hist = Store.history();
  const icons = {
    '権利関係': '⚖️',
    '宅建業法': '🏢',
    '法令上の制限': '📋',
    '税・その他': '💴',
  };

  const cards = CATEGORIES.map(cat => {
    const qs       = QUESTIONS.filter(q => q.category === cat);
    const done     = qs.filter(q => hist[q.id] && hist[q.id].attempts > 0).length;
    const attempts = qs.reduce((s, q) => s + (hist[q.id]?.attempts || 0), 0);
    const correct  = qs.reduce((s, q) => s + (hist[q.id]?.correct  || 0), 0);
    const rate     = attempts > 0 ? Math.round(correct / attempts * 100) : null;

    return `
    <div class="cat-card" data-action="start-category" data-value="${escapeHTML(cat)}">
      <div class="cat-icon">${icons[cat] || '📖'}</div>
      <div class="cat-info">
        <div class="cat-name">${escapeHTML(cat)}</div>
        <div class="cat-meta">${done} / ${qs.length}問 学習済み</div>
      </div>
      <div class="cat-rate">
        <div class="cat-rate-num">${rate !== null ? rate + '%' : '─'}</div>
        <div class="cat-rate-label">正答率</div>
      </div>
    </div>`;
  }).join('');

  return `
  <div class="screen">
    <div class="header">
      <button class="btn-back" data-action="go-home">
        <span class="btn-back-arrow">←</span>戻る
      </button>
      <div class="header-title">分野を選ぶ</div>
    </div>
    <div class="cat-list">${cards}</div>
  </div>`;
}

// ── QUIZ ───────────────────────────────────────────────────────────────
function renderQuiz() {
  const q        = App.quizQuestions[App.currentIndex];
  const total    = App.quizQuestions.length;
  const num      = App.currentIndex + 1;
  const pct      = Math.round(num / total * 100);
  const answered = App.selectedAnswer !== null;
  const bk       = Store.isBookmarked(q.id);

  const labels = ['1', '2', '3', '4'];

  const opts = q.options.map((opt, i) => {
    let cls = 'opt-btn';
    if (answered) {
      if (i === q.correct) cls += ' correct';
      else if (i === App.selectedAnswer) cls += ' wrong';
    }
    return `
    <button class="${cls}" data-action="answer" data-value="${i}" ${answered ? 'disabled' : ''}>
      <span class="opt-num">${labels[i]}</span>
      <span class="opt-text">${escapeHTML(opt)}</span>
    </button>`;
  }).join('');

  let feedback = '', explanation = '', nextBtn = '';

  if (answered) {
    const ok = App.selectedAnswer === q.correct;
    const correctLabel = labels[q.correct];

    feedback = `
    <div class="feedback ${ok ? 'ok' : 'ng'}">
      <span class="feedback-icon">${ok ? '✅' : '❌'}</span>
      <div class="feedback-body">
        <div class="feedback-label">${ok ? '正解！' : '不正解'}</div>
        <div class="feedback-hint">
          ${ok ? 'よくできました！' : `正解は 選択肢${correctLabel} です`}
        </div>
      </div>
    </div>`;

    explanation = `
    <div class="explanation">
      <div class="expl-title">💡 解説</div>
      <div class="expl-text">${escapeHTML(q.explanation)}</div>
    </div>`;

    const isLast = num === total;
    nextBtn = `
    <button class="next-btn" data-action="next">
      ${isLast ? '📊　結果を見る' : '次の問題　→'}
    </button>`;
  }

  const modeNames = {
    category: escapeHTML(q.category),
    random: 'ランダムテスト',
    review: '間違い復習',
    bookmark: '付箋問題',
    'session-review': '復習',
  };

  return `
  <div class="screen">
    <div class="quiz-header">
      <button class="btn-back" data-action="go-home">
        <span class="btn-back-arrow">←</span>終了
      </button>
      <div class="header-title" style="font-size:14px">${modeNames[App.quizMode] || ''}</div>
      <div class="header-badge">${num} / ${total}</div>
      <button class="bookmark-btn ${bk ? 'active' : ''}" data-action="bookmark" data-qid="${q.id}"
        title="${bk ? '付箋を外す' : '付箋をつける'}">
        ${bk ? '🔖' : '☆'}
      </button>
    </div>
    <div class="quiz-progress-track">
      <div class="quiz-progress-fill" style="width:${pct}%"></div>
    </div>
    <div class="quiz-body">
      <div class="q-card">
        <div class="q-card-top">
          <span class="q-tag">${escapeHTML(q.category)}</span>
          <span class="q-num">問題 ${num} / ${total}</span>
        </div>
        <div class="q-text">${escapeHTML(q.question)}</div>
      </div>
      <div class="options">${opts}</div>
      ${feedback}
      ${explanation}
      ${nextBtn}
    </div>
  </div>`;
}

// ── RESULT ─────────────────────────────────────────────────────────────
function scoreDonut(rate) {
  const r     = 42;
  const circ  = 2 * Math.PI * r;
  const dash  = circ * rate / 100;
  const color = rate >= 70 ? '#52B788' : rate >= 50 ? '#F0B429' : '#E05252';
  return `
  <svg class="result-donut" viewBox="0 0 100 100" width="130" height="130"
    style="display:block;margin:0 auto 6px" aria-hidden="true">
    <circle cx="50" cy="50" r="${r}" fill="none"
      stroke="rgba(255,255,255,0.2)" stroke-width="11"/>
    <circle cx="50" cy="50" r="${r}" fill="none"
      stroke="${color}" stroke-width="11"
      stroke-dasharray="${dash} ${circ}"
      stroke-linecap="round"
      transform="rotate(-90 50 50)"/>
    <text x="50" y="46" text-anchor="middle" fill="white"
      font-size="22" font-weight="900"
      font-family="-apple-system,BlinkMacSystemFont,sans-serif">${rate}%</text>
    <text x="50" y="62" text-anchor="middle" fill="rgba(255,255,255,0.8)"
      font-size="11"
      font-family="-apple-system,BlinkMacSystemFont,sans-serif">正答率</text>
  </svg>`;
}

function renderResult() {
  const total   = App.sessionResults.length;
  const correct = App.sessionResults.filter(r => r.correct).length;
  const wrong   = total - correct;
  const rate    = total > 0 ? Math.round(correct / total * 100) : 0;
  const msg     = rate >= 80 ? '素晴らしい！' : rate >= 60 ? 'よくできました！' : rate >= 40 ? 'もう少し！' : '復習しよう！';

  const wrongQids = App.sessionResults.filter(r => !r.correct).map(r => r.qid);
  const wrongQs   = QUESTIONS.filter(q => wrongQids.includes(q.id));

  const wrongList = wrongQs.length > 0 ? `
  <div class="wrong-section" style="padding-top:16px">
    <div class="wrong-title">❌ 間違えた問題（${wrongQs.length}問）</div>
    ${wrongQs.map(q => `
    <div class="wrong-item">
      <div class="wrong-cat">${escapeHTML(q.category)}</div>
      <div class="wrong-q">${escapeHTML(q.question)}</div>
    </div>`).join('')}
  </div>` : '';

  const reviewBtn = wrongQs.length > 0 ? `
  <button class="res-btn primary" data-action="session-review">
    🔄 間違い問題を復習する
  </button>` : `
  <div style="text-align:center;padding:8px;font-size:14px;color:#40916C;font-weight:700">
    🎉 全問正解！
  </div>`;

  return `
  <div class="screen">
    <div class="result-hero">
      ${scoreDonut(rate)}
      <div class="result-sub">${total}問中 ${correct}問正解　${msg}</div>
      <div class="result-chips">
        <div class="result-chip">
          <div class="result-chip-val">✅ ${correct}</div>
          <div class="result-chip-label">正解</div>
        </div>
        <div class="result-chip">
          <div class="result-chip-val">❌ ${wrong}</div>
          <div class="result-chip-label">不正解</div>
        </div>
      </div>
    </div>
    ${wrongList}
    <div class="result-actions">
      ${reviewBtn}
      <button class="res-btn secondary" data-action="go-categories">
        📚 他の分野を学ぶ
      </button>
      <button class="res-btn secondary" data-action="go-home">
        🏠 ホームへ戻る
      </button>
    </div>
  </div>`;
}

// ── STATS ──────────────────────────────────────────────────────────────
function renderStats() {
  const hist   = Store.history();
  const vals   = Object.values(hist);
  const total  = vals.reduce((s, h) => s + h.attempts, 0);
  const corr   = vals.reduce((s, h) => s + h.correct,  0);
  const rate   = total > 0 ? Math.round(corr / total * 100) : 0;
  const bkCnt  = vals.filter(h => h.bookmarked).length;

  const icons = {
    '権利関係': '⚖️', '宅建業法': '🏢',
    '法令上の制限': '📋', '税・その他': '💴',
  };

  const catRows = CATEGORIES.map(cat => {
    const qs  = QUESTIONS.filter(q => q.category === cat);
    const att = qs.reduce((s, q) => s + (hist[q.id]?.attempts || 0), 0);
    const cr  = qs.reduce((s, q) => s + (hist[q.id]?.correct  || 0), 0);
    const r   = att > 0 ? Math.round(cr / att * 100) : 0;
    return `
    <div class="cat-stat-row">
      <span class="cat-stat-icon">${icons[cat] || '📖'}</span>
      <div class="cat-stat-info">
        <div class="cat-stat-name">${escapeHTML(cat)}</div>
        <div class="cat-stat-count">${att > 0 ? att + '回解答 / 正解' + cr + '回' : '未挑戦'}</div>
        <div class="cat-bar-track">
          <div class="cat-bar-fill" style="width:${r}%"></div>
        </div>
      </div>
      <div class="cat-stat-rate">${att > 0 ? r + '%' : '─'}</div>
    </div>`;
  }).join('');

  return `
  <div class="screen">
    <div class="header">
      <button class="btn-back" data-action="go-home">
        <span class="btn-back-arrow">←</span>戻る
      </button>
      <div class="header-title">学習記録</div>
    </div>
    <div class="stats-body">
      <div class="stats-card">
        <div class="stats-card-title">📊 全体成績</div>
        <div class="stats-grid">
          <div class="stats-metric accent">
            <div class="stats-metric-val">${rate}%</div>
            <div class="stats-metric-label">正答率</div>
          </div>
          <div class="stats-metric">
            <div class="stats-metric-val">${total}</div>
            <div class="stats-metric-label">総回答数</div>
          </div>
          <div class="stats-metric">
            <div class="stats-metric-val">${corr}</div>
            <div class="stats-metric-label">正解数</div>
          </div>
          <div class="stats-metric">
            <div class="stats-metric-val">${bkCnt}</div>
            <div class="stats-metric-label">付箋数</div>
          </div>
        </div>
      </div>

      <div class="stats-card">
        <div class="stats-card-title">📚 分野別成績</div>
        ${catRows}
      </div>

      <button class="reset-btn" data-action="reset">
        🗑️ 学習データをリセット
      </button>
    </div>
  </div>`;
}

// ── EVENTS ─────────────────────────────────────────────────────────────
document.getElementById('app').addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el) return;

  switch (el.dataset.action) {
    case 'go-home':        go('home');        break;
    case 'go-categories':  go('categories');  break;
    case 'go-stats':       go('stats');       break;

    case 'start-random':   startQuiz('random');                      break;
    case 'start-review':   startQuiz('review');                      break;
    case 'start-bookmark': startQuiz('bookmark');                    break;
    case 'start-category': startQuiz('category', el.dataset.value);  break;
    case 'session-review': startQuiz('session-review');              break;

    case 'answer':
      answerQuestion(parseInt(el.dataset.value));
      break;

    case 'next':
      nextQuestion();
      break;

    case 'bookmark': {
      const qid = parseInt(el.dataset.qid);
      const now  = Store.toggleBookmark(qid);
      el.className   = `bookmark-btn ${now ? 'active' : ''}`;
      el.textContent = now ? '🔖' : '☆';
      showToast(now ? '付箋をつけました 🔖' : '付箋を外しました');
      break;
    }

    case 'reset':
      if (confirm('学習データをすべてリセットしますか？\nこの操作は元に戻せません。')) {
        Store.reset();
        go('home');
      }
      break;
  }
});

// ── TOAST ──────────────────────────────────────────────────────────────
function showToast(msg) {
  const prev = document.querySelector('.app-toast');
  if (prev) prev.remove();

  const t = document.createElement('div');
  t.className = 'app-toast';
  t.style.cssText = [
    'position:fixed', 'bottom:32px', 'left:50%',
    'transform:translateX(-50%)',
    'background:#1B4332', 'color:#fff',
    'padding:12px 22px', 'border-radius:14px',
    'font-size:14px', 'font-weight:700',
    'white-space:pre-line', 'text-align:center',
    'z-index:9999', 'box-shadow:0 4px 20px rgba(0,0,0,0.32)',
    'max-width:300px', 'line-height:1.5',
    'animation:slideUp 0.22s ease both',
  ].join(';');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

// ── INIT ───────────────────────────────────────────────────────────────
render();
