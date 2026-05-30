const CHAPTER_SIZE = 25;

const CHAPTER_LABELS = {
  '宅建業法': [
    '免許・宅建士・媒介・重要事項説明',
    '手付金・自ら売主制限・事務所規制',
    '業務規制・監督処分・その他',
    '書面・8種規制・保証金・届出規制',
    '業務規制・総合',
  ],
  '権利関係': [
    '民法総則・物権・担保物権・債権',
    '意思表示・代理・相続・不法行為',
    '借地借家・共有・保証・その他',
    '時効・担保・相続・借地借家の応用',
    '不法行為・権利総合',
  ],
  '法令上の制限': [
    '都市計画法・開発許可・建築基準法基礎',
    '建築基準法詳細・農地法・区画整理',
    '国土利用計画法・盛土規制・各種制限',
    '開発手続・建築規制・農地・各種制限の応用',
  ],
  '税・その他': [
    '不動産税制（取得税・固定資産税・印紙税）',
    '譲渡所得・鑑定評価・支援機構・景表法',
    '住宅ローン控除・相続税・土地建物知識',
    '税制詳細・鑑定評価・支援機構・広告規制',
  ],
};

// ── STATE ──────────────────────────────────────────────────────────────
const App = {
  screen: 'home',
  quizMode: null,
  quizCategory: null,
  quizQuestions: [],
  currentIndex: 0,
  selectedAnswer: null,
  sessionResults: [],
  randomCount: 10,
  selectedCategory: null,
  _resumeKey: null,
  _chapterStart: undefined,
  examTimerEnabled: false,
  examTimerSeconds: 0,
  _examTimerInterval: null,
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
    this.recordActiveDay();
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

  todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  },

  recordActiveDay() {
    const data = this.load();
    const today = this.todayStr();
    if (!data.activeDays) data.activeDays = [];
    if (!data.activeDays.includes(today)) {
      data.activeDays.push(today);
      this.save(data);
    }
  },

  todayCount() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const hist = this.history();
    return Object.values(hist).filter(h => h.lastAt >= start.getTime()).length;
  },

  streak() {
    const data = this.load();
    const days = (data.activeDays || []).slice().sort();
    if (days.length === 0) return 0;
    const today = this.todayStr();
    const check = new Date();
    if (!days.includes(today)) check.setDate(check.getDate() - 1);
    let count = 0;
    while (true) {
      const ds = `${check.getFullYear()}-${String(check.getMonth()+1).padStart(2,'0')}-${String(check.getDate()).padStart(2,'0')}`;
      if (!days.includes(ds)) break;
      count++;
      check.setDate(check.getDate() - 1);
    }
    return count;
  },

  isDailyCompleted() {
    return this.load().dailyCompleted === this.todayStr();
  },

  markDailyCompleted() {
    const data = this.load();
    data.dailyCompleted = this.todayStr();
    this.save(data);
  },

  resumeKey(category, chapterStart) {
    return `${category}:${chapterStart !== undefined ? chapterStart : 'all'}`;
  },

  saveResume(key, data) {
    const d = this.load();
    if (!d.resumeSessions) d.resumeSessions = {};
    d.resumeSessions[key] = data;
    this.save(d);
  },

  loadResume(key) {
    const d = this.load();
    return (d.resumeSessions && d.resumeSessions[key]) || null;
  },

  clearResume(key) {
    const d = this.load();
    if (d.resumeSessions && d.resumeSessions[key]) {
      delete d.resumeSessions[key];
      this.save(d);
    }
  },

  saveExamSession(data) {
    const d = this.load();
    d.examSession = data;
    this.save(d);
  },

  loadExamSession() {
    return this.load().examSession || null;
  },

  clearExamSession() {
    const d = this.load();
    delete d.examSession;
    this.save(d);
  },
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

function formatDate(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

// ── QUIZ LOGIC ─────────────────────────────────────────────────────────
function startQuiz(mode, category, chapterStart) {
  const hist = Store.history();
  let qs = [];

  switch (mode) {
    case 'category':
      qs = QUESTIONS.filter(q => q.category === category);
      if (chapterStart !== undefined) qs = qs.slice(chapterStart, chapterStart + CHAPTER_SIZE);
      qs = shuffleArray(qs);
      break;
    case 'random':
      qs = shuffleArray(QUESTIONS).slice(0, App.randomCount);
      break;
    case 'review':
      qs = QUESTIONS.filter(q => {
        const h = hist[q.id];
        return h && h.attempts > 0 && h.correct < h.attempts;
      });
      qs.sort((a, b) => {
        const ha = hist[a.id], hb = hist[b.id];
        return (hb.attempts - hb.correct) - (ha.attempts - ha.correct);
      });
      break;
    case 'bookmark':
      qs = QUESTIONS.filter(q => hist[q.id] && hist[q.id].bookmarked);
      break;
    case 'daily': {
      const DAILY_SIZE = 5;
      const unanswered = shuffleArray(QUESTIONS.filter(q => !hist[q.id] || hist[q.id].attempts === 0));
      const wrong      = shuffleArray(QUESTIONS.filter(q => {
        const h = hist[q.id];
        return h && h.attempts > 0 && h.correct < h.attempts;
      }));
      let pool = unanswered;
      if (pool.length < DAILY_SIZE) {
        pool = pool.concat(wrong.filter(q => !pool.includes(q)));
      }
      if (pool.length < DAILY_SIZE) {
        pool = pool.concat(shuffleArray(QUESTIONS.filter(q => !pool.includes(q))));
      }
      qs = pool.slice(0, DAILY_SIZE);
      break;
    }
    case 'session-review': {
      const wrongIds = App.sessionResults.filter(r => !r.correct).map(r => r.qid);
      qs = QUESTIONS.filter(q => wrongIds.includes(q.id));
      break;
    }
    case 'exam': {
      const EXAM_ALLOC = [
        { cat: '宅建業法',    n: 20 },
        { cat: '権利関係',    n: 14 },
        { cat: '法令上の制限', n: 8  },
        { cat: '税・その他',   n: 8  },
      ];
      qs = [];
      for (const { cat, n } of EXAM_ALLOC) {
        qs = qs.concat(shuffleArray(QUESTIONS.filter(q => q.category === cat)).slice(0, n));
      }
      qs = shuffleArray(qs);
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
  App._resumeKey     = mode === 'category' ? Store.resumeKey(category, chapterStart) : null;
  App._chapterStart  = chapterStart;
  go('quiz');
}

function answerQuestion(idx) {
  if (App.selectedAnswer !== null) return;
  const q  = App.quizQuestions[App.currentIndex];
  const ok = idx === q.correct;
  App.selectedAnswer = idx;
  App.sessionResults.push({ qid: q.id, correct: ok });
  Store.recordAnswer(q.id, ok);
  if (App._resumeKey) {
    Store.saveResume(App._resumeKey, {
      nextIndex:     App.currentIndex + 1,
      questionCount: App.quizQuestions.length,
      questionIds:   App.quizQuestions.map(q => q.id),
      updatedAt:     Date.now(),
    });
  }
  if (App.quizMode === 'exam') {
    Store.saveExamSession({
      questionIds:      App.quizQuestions.map(q => q.id),
      answers:          App.sessionResults.slice(),
      nextIndex:        App.currentIndex + 1,
      timerEnabled:     App.examTimerEnabled,
      remainingSeconds: App.examTimerSeconds,
      updatedAt:        Date.now(),
    });
  }
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
    if (App._resumeKey) {
      Store.clearResume(App._resumeKey);
      App._resumeKey = null;
    }
    if (App.quizMode === 'exam') Store.clearExamSession();
    stopExamTimer();
    go(App.quizMode === 'exam' ? 'exam-result' : 'result');
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
    home:                renderHome,
    categories:          renderCategories,
    'category-chapters': renderCategoryChapters,
    'random-count':      renderRandomCount,
    'exam-setup':        renderExamSetup,
    quiz:                renderQuiz,
    result:              renderResult,
    'exam-result':       renderExamResult,
    stats:               renderStats,
    guide:               renderGuide,
  };
  const fn = fns[App.screen];
  if (fn) document.getElementById('app').innerHTML = fn();
}

// ── HOME ───────────────────────────────────────────────────────────────
function renderHome() {
  const hist       = Store.history();
  const vals       = Object.values(hist);
  const total      = vals.reduce((s, h) => s + h.attempts, 0);
  const corr       = vals.reduce((s, h) => s + h.correct,  0);
  const rate       = total > 0 ? Math.round(corr / total * 100) : 0;
  const done       = vals.filter(h => h.attempts > 0).length;
  const bkCnt      = vals.filter(h => h.bookmarked).length;
  const todayCount = Store.todayCount();
  const streakDays = Store.streak();
  const isDone     = Store.isDailyCompleted();
  const wrongCnt = QUESTIONS.filter(q => {
    const h = hist[q.id];
    return h && h.attempts > 0 && h.correct < h.attempts;
  }).length;
  const CAT_ICONS = { '権利関係':'⚖️', '宅建業法':'🏢', '法令上の制限':'📋', '税・その他':'💴' };
  const catAll = CATEGORIES.map(cat => {
    const qs  = QUESTIONS.filter(q => q.category === cat);
    const att = qs.reduce((s, q) => s + (hist[q.id]?.attempts || 0), 0);
    const cr  = qs.reduce((s, q) => s + (hist[q.id]?.correct  || 0), 0);
    return { cat, att, rate: att > 0 ? Math.round(cr / att * 100) : null };
  });
  const catStats = catAll.filter(s => s.att > 0);
  const worstCat = catStats.length > 0
    ? catStats.slice().sort((a, b) => a.rate - b.rate)[0]
    : null;

  // 宅建試験日（毎年10月第3日曜日。翌年更新時はここ1行を変更）
  const EXAM_DATE = new Date('2026-10-18');
  const _today    = new Date(); _today.setHours(0, 0, 0, 0);
  const daysLeft  = Math.max(0, Math.ceil((EXAM_DATE - _today) / 86400000));
  const planMsg   = wrongCnt > 0
    ? `まず苦手 ${wrongCnt} 問を復習しよう`
    : (isDone ? '今日の5問は完了！明日も続けよう' : '今日の5問から始めよう');
  const planAction = wrongCnt > 0 ? 'start-review' : 'start-daily';
  const planIcon   = wrongCnt > 0 ? '🔄' : (isDone ? '✅' : '🌟');

  const undone     = QUESTIONS.length - done;
  const paceNeed   = daysLeft > 0 && undone > 0 ? Math.ceil(undone / daysLeft) : 0;
  const paceStatus = undone === 0
    ? '✅ 全問学習済み！復習を続けよう'
    : todayCount >= paceNeed && paceNeed > 0
      ? '✅ 今日のペース達成！'
      : paceNeed > 0
        ? `📌 今日あと ${paceNeed - todayCount} 問でペース達成`
        : '📅 試験日です！全力で！';
  const paceColor  = undone === 0 || (paceNeed > 0 && todayCount >= paceNeed)
    ? 'var(--g600)' : 'var(--text-mid)';

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
      <div class="stats-bar stats-bar-sm">
        <div class="stat-item">
          <div class="stat-value">${todayCount}</div>
          <div class="stat-label">今日の学習</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${streakDays}日</div>
          <div class="stat-label">連続学習</div>
        </div>
      </div>
    </div>

    <div class="stats-card" style="margin:0 16px 12px">
      <div class="stats-card-title">⚠️ 弱点サマリー</div>
      <div class="stats-grid">
        <div class="stats-metric${wrongCnt > 0 ? ' accent' : ''}">
          <div class="stats-metric-val">${wrongCnt}</div>
          <div class="stats-metric-label">苦手問題数</div>
        </div>
        <div class="stats-metric">
          <div class="stats-metric-val">${rate}%</div>
          <div class="stats-metric-label">全体正答率</div>
        </div>
      </div>
      <div style="margin-top:10px">
        ${catAll.map(s => {
          const barColor = s.rate === null ? 'var(--border)'
            : s.rate >= 70 ? 'var(--g400)'
            : s.rate >= 50 ? '#F0B429'
            : '#E05252';
          const rateText = s.rate !== null ? s.rate + '%' : '─';
          const sub = s.rate === null ? ''
            : s.rate >= 70
              ? `<span style="font-size:10px;color:var(--g600)">✓達成</span>`
              : `<span style="font-size:10px;color:#E05252">目安まで${70 - s.rate}%</span>`;
          return `
          <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border)">
            <span style="font-size:15px;flex-shrink:0">${CAT_ICONS[s.cat]}</span>
            <div style="flex:1;min-width:0">
              <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px">
                <span style="color:var(--text-mid)">${s.cat}</span>
                <span style="display:flex;gap:6px;align-items:center">${sub}<strong style="color:var(--text)">${rateText}</strong></span>
              </div>
              <div class="cat-bar-track">
                <div class="cat-bar-fill" style="width:${s.rate ?? 0}%;background:${barColor}"></div>
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>
      <div style="margin-top:6px;font-size:13px;font-weight:700;color:${wrongCnt > 0 ? '#E05252' : '#52B788'}">
        ${wrongCnt > 0 ? '⚠️ 要復習あり' : '✅ 順調です！'}
      </div>
      ${wrongCnt > 0 ? `
      <button class="menu-btn full" data-action="start-review"
        style="margin-top:10px;min-height:48px;padding:12px 20px">
        <span class="btn-icon" style="font-size:20px">🔄</span>
        <span class="btn-label" style="font-size:14px">今すぐ復習する（${wrongCnt}問）</span>
      </button>` : ''}
    </div>

    <div class="stats-card" style="margin:0 16px 12px">
      <div class="stats-card-title">🗓️ 試験日逆算プラン</div>
      <div style="text-align:center;margin-bottom:12px">
        <span style="font-size:36px;font-weight:900;color:var(--g600)">${daysLeft}日</span>
        <span style="font-size:13px;color:var(--text-sub);margin-left:6px">試験まで</span>
        <div style="font-size:11px;color:var(--text-sub);margin-top:2px">宅建試験日：2026/10/18</div>
      </div>
      <div class="stats-grid" style="margin-bottom:10px">
        <div class="stats-metric">
          <div class="stats-metric-val">5問</div>
          <div class="stats-metric-label">今日の目標</div>
        </div>
        <div class="stats-metric">
          <div class="stats-metric-val">35問</div>
          <div class="stats-metric-label">今週の目標</div>
        </div>
      </div>
      <div style="margin:8px 0 10px;padding:10px 12px;background:var(--g50);border-radius:var(--r-sm);font-size:13px;color:var(--text-mid);line-height:1.85">
        <div>未学習 <strong style="color:var(--text)">${undone}問</strong></div>
        ${undone > 0 && daysLeft > 0 ? `<div>残り${daysLeft}日 → 1日<strong style="color:var(--text)">${paceNeed}問</strong>ペースで完走</div>` : ''}
        <div style="font-weight:700;color:${paceColor}">${paceStatus}</div>
      </div>
      <button class="menu-btn full" data-action="${planAction}"
        style="min-height:48px;padding:12px 20px">
        <span class="btn-icon" style="font-size:20px">${planIcon}</span>
        <span class="btn-label" style="font-size:14px">${planMsg}</span>
      </button>
    </div>

    <div class="menu-section">
      <div class="section-label">学習メニュー</div>
      <button class="menu-btn daily${isDone ? ' daily-done' : ''}" data-action="start-daily">
        <span class="btn-icon">${isDone ? '✅' : '🌟'}</span>
        <span class="btn-label">${isDone ? '今日の5問 完了！' : '今日の5問'}</span>
        <span class="btn-sub">${isDone ? 'また明日！' : '毎日5問で継続力UP'}</span>
      </button>
      <div class="menu-grid">
        <button class="menu-btn primary" data-action="go-categories">
          <span class="btn-icon">📚</span>
          <span class="btn-label">分野別学習</span>
          <span class="btn-sub">カテゴリを選んで学ぶ</span>
        </button>
        <button class="menu-btn" data-action="start-random">
          <span class="btn-icon">🎲</span>
          <span class="btn-label">ランダムテスト</span>
          <span class="btn-sub">10・20・30問</span>
        </button>
        <button class="menu-btn" data-action="start-review"
          style="${wrongCnt === 0 ? 'opacity:0.45;pointer-events:none' : ''}">
          <span class="btn-icon">🔄</span>
          <span class="btn-label">間違い復習</span>
          <span class="btn-sub">${wrongCnt > 0 ? wrongCnt + '問' : '対象なし'}</span>
        </button>
        <button class="menu-btn" data-action="start-bookmark"
          style="${bkCnt === 0 ? 'opacity:0.45;pointer-events:none' : ''}">
          <span class="btn-icon">🔖</span>
          <span class="btn-label">付箋問題</span>
          <span class="btn-sub">${bkCnt > 0 ? bkCnt + '問' : 'なし'}</span>
        </button>
      </div>
      <button class="menu-btn full primary" data-action="go-exam">
        <span class="btn-icon">🏆</span>
        <span class="btn-label">模擬試験</span>
        <span class="btn-sub">50問・本試験風配分</span>
      </button>
      <button class="menu-btn full" data-action="go-stats">
        <span class="btn-icon">📊</span>
        <span class="btn-label">学習記録を見る</span>
      </button>
      <button class="menu-btn full" data-action="go-guide">
        <span class="btn-icon">📘</span>
        <span class="btn-label">アプリの使い方</span>
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

// ── CATEGORY CHAPTERS ─────────────────────────────────────────────────
function renderCategoryChapters() {
  const cat  = App.selectedCategory;
  const hist = Store.history();
  const icons = {
    '権利関係': '⚖️', '宅建業法': '🏢',
    '法令上の制限': '📋', '税・その他': '💴',
  };

  const allQs   = QUESTIONS.filter(q => q.category === cat);
  const allAtt  = allQs.reduce((s, q) => s + (hist[q.id]?.attempts || 0), 0);
  const allCr   = allQs.reduce((s, q) => s + (hist[q.id]?.correct  || 0), 0);
  const allRate = allAtt > 0 ? Math.round(allCr / allAtt * 100) + '%' : '─';

  const chapterCards = [];
  for (let start = 0; start < allQs.length; start += CHAPTER_SIZE) {
    const chQs   = allQs.slice(start, start + CHAPTER_SIZE);
    const chAtt  = chQs.reduce((s, q) => s + (hist[q.id]?.attempts || 0), 0);
    const chCr   = chQs.reduce((s, q) => s + (hist[q.id]?.correct  || 0), 0);
    const chDone = chQs.filter(q => hist[q.id]?.attempts > 0).length;
    const chRate = chAtt > 0 ? Math.round(chCr / chAtt * 100) + '%' : '─';
    const chNum  = Math.floor(start / CHAPTER_SIZE) + 1;
    const chLabel = (CHAPTER_LABELS[cat] && CHAPTER_LABELS[cat][chNum - 1])
      ? CHAPTER_LABELS[cat][chNum - 1]
      : `Chapter ${chNum}`;
    chapterCards.push(`
    <button class="chapter-card" data-action="start-chapter" data-value="${start}">
      <div class="chapter-left">
        <div class="chapter-title">${chLabel}</div>
        <div class="chapter-meta">${chQs.length}問 ・ 学習済み${chDone}問</div>
      </div>
      <div class="chapter-rate">${chRate}</div>
    </button>`);
  }

  return `
  <div class="screen">
    <div class="header">
      <button class="btn-back" data-action="go-categories">
        <span class="btn-back-arrow">←</span>戻る
      </button>
      <div class="header-title">${icons[cat] || '📖'} ${escapeHTML(cat)}</div>
    </div>
    <div class="chapter-select-body">
      <button class="chapter-card chapter-all" data-action="start-chapter-all">
        <div class="chapter-left">
          <div class="chapter-title">全問まとめて</div>
          <div class="chapter-meta">${allQs.length}問</div>
        </div>
        <div class="chapter-rate">${allRate}</div>
      </button>
      <div class="chapter-select-label">チャプター別に解く</div>
      ${chapterCards.join('')}
    </div>
  </div>`;
}

// ── RANDOM COUNT SELECTION ─────────────────────────────────────────────
function renderRandomCount() {
  const options = [
    { n: 10, label: '10問', sub: '手軽にサクッと' },
    { n: 20, label: '20問', sub: 'バランスよく練習' },
    { n: 30, label: '30問', sub: 'しっかり本番対策' },
  ];

  const cards = options.map(o => `
    <button class="count-card" data-action="start-random-count" data-value="${o.n}">
      <span class="count-num">${o.label}</span>
      <span class="count-sub">${o.sub}</span>
    </button>`).join('');

  return `
  <div class="screen">
    <div class="header">
      <button class="btn-back" data-action="go-home">
        <span class="btn-back-arrow">←</span>戻る
      </button>
      <div class="header-title">ランダムテスト</div>
    </div>
    <div class="count-select-body">
      <div class="count-select-label">何問解きますか？</div>
      <div class="count-select-grid">${cards}</div>
    </div>
  </div>`;
}

// ── EXAM SETUP ─────────────────────────────────────────────────────────
function renderExamSetup() {
  return `
  <div class="screen">
    <div class="header">
      <button class="btn-back" data-action="go-home">
        <span class="btn-back-arrow">←</span>戻る
      </button>
      <div class="header-title">模擬試験</div>
    </div>
    <div style="padding:16px">
      <div class="stats-card" style="margin-bottom:16px">
        <div class="stats-card-title">🏆 本試験風模擬試験</div>
        <div style="font-size:14px;line-height:1.85;color:var(--text-mid);margin-bottom:10px">
          本試験の出題配分に近い50問を出題します。
        </div>
        <div class="exam-alloc-grid">
          <div class="exam-alloc-item"><span>🏢 宅建業法</span><strong>20問</strong></div>
          <div class="exam-alloc-item"><span>⚖️ 権利関係</span><strong>14問</strong></div>
          <div class="exam-alloc-item"><span>📋 法令上の制限</span><strong>8問</strong></div>
          <div class="exam-alloc-item"><span>💴 税・その他</span><strong>8問</strong></div>
        </div>
        <div style="margin-top:10px;padding:8px 12px;background:var(--g50);border-radius:var(--r-sm);font-size:13px;color:var(--text-mid)">
          合格ライン目安：<strong style="color:var(--g700)">35点以上 / 50点満点</strong>
        </div>
      </div>
      <div class="section-label">タイマーを選ぶ</div>
      <button class="menu-btn full" data-action="start-exam" data-timer="1" style="margin-bottom:10px">
        <span class="btn-icon">⏱️</span>
        <span class="btn-label">時間を測って解く</span>
        <span class="btn-sub">120分カウントダウン</span>
      </button>
      <button class="menu-btn full" data-action="start-exam" data-timer="0">
        <span class="btn-icon">∞</span>
        <span class="btn-label">時間制限なしで解く</span>
        <span class="btn-sub">じっくり取り組む</span>
      </button>
    </div>
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
    daily: '今日の5問',
    exam: '模擬試験',
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
    ${App.quizMode === 'exam' && App.examTimerEnabled ? `<div class="exam-timer-bar" id="exam-timer-display">⏱️ <span style="font-weight:700">${Math.floor(App.examTimerSeconds / 60)}:${String(App.examTimerSeconds % 60).padStart(2, '0')}</span></div>` : ''}
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

  if (App.quizMode === 'daily') Store.markDailyCompleted();

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

  const dailyBanner = App.quizMode === 'daily' ? `
    <div class="daily-complete-banner">
      🎉 今日の5問 完了！
      <div class="daily-complete-sub">明日もまた挑戦しよう！</div>
    </div>` : '';

  return `
  <div class="screen">
    <div class="result-hero">
      ${dailyBanner}
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

// ── EXAM RESULT ────────────────────────────────────────────────────────
function renderExamResult() {
  const total    = App.quizQuestions.length;
  const answered = App.sessionResults.length;
  const correct  = App.sessionResults.filter(r => r.correct).length;
  const wrong    = answered - correct;
  const unanswered = total - answered;
  const rate     = Math.round(correct / total * 100);
  const PASS_LINE = 35;
  const passed   = correct >= PASS_LINE;

  const EXAM_ALLOC = [
    { cat: '宅建業法',    n: 20, icon: '🏢' },
    { cat: '権利関係',    n: 14, icon: '⚖️' },
    { cat: '法令上の制限', n: 8,  icon: '📋' },
    { cat: '税・その他',   n: 8,  icon: '💴' },
  ];

  const catRows = EXAM_ALLOC.map(({ cat, n, icon }) => {
    const catQIds    = App.quizQuestions.filter(q => q.category === cat).map(q => q.id);
    const catResults = App.sessionResults.filter(r => catQIds.includes(r.qid));
    const catCorrect = catResults.filter(r => r.correct).length;
    const catRate    = Math.round(catCorrect / n * 100);
    const barColor   = catRate >= 70 ? 'var(--g400)' : catRate >= 50 ? '#F0B429' : '#E05252';
    return `
    <div class="exam-cat-row">
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;margin-bottom:4px">
        <span>${icon} ${escapeHTML(cat)}</span>
        <strong>${catCorrect} / ${n}問</strong>
      </div>
      <div class="cat-bar-track">
        <div class="cat-bar-fill" style="width:${catRate}%;background:${barColor}"></div>
      </div>
    </div>`;
  }).join('');

  const wrongQids = App.sessionResults.filter(r => !r.correct).map(r => r.qid);
  const reviewBtn = wrongQids.length > 0 ? `
  <button class="res-btn primary" data-action="session-review">
    🔄 間違えた${wrongQids.length}問を復習する
  </button>` : `
  <div style="text-align:center;padding:8px;font-size:14px;color:#40916C;font-weight:700">
    🎉 全問正解！
  </div>`;

  const passLabel = passed
    ? `<div class="exam-pass-badge pass">✅ 合格ライン達成</div>`
    : `<div class="exam-pass-badge fail">📚 合格ライン未達（目安 35点以上）</div>`;

  return `
  <div class="screen">
    <div class="result-hero">
      ${scoreDonut(rate)}
      <div class="result-sub">${total}問中 ${correct}問正解</div>
      ${passLabel}
      <div class="result-chips">
        <div class="result-chip">
          <div class="result-chip-val">✅ ${correct}</div>
          <div class="result-chip-label">正解</div>
        </div>
        <div class="result-chip">
          <div class="result-chip-val">❌ ${wrong}</div>
          <div class="result-chip-label">不正解</div>
        </div>
        ${unanswered > 0 ? `
        <div class="result-chip">
          <div class="result-chip-val">⏭️ ${unanswered}</div>
          <div class="result-chip-label">未回答</div>
        </div>` : ''}
      </div>
    </div>
    <div style="padding:0 16px 16px">
      <div class="stats-card">
        <div class="stats-card-title">📊 カテゴリ別結果</div>
        ${catRows}
      </div>
    </div>
    <div class="result-actions">
      ${reviewBtn}
      <button class="res-btn secondary" data-action="go-exam">
        📝 もう一度模試を受ける
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
  const done   = vals.filter(h => h.attempts > 0).length;
  const undone = Math.max(0, QUESTIONS.length - done);

  const activeDays = Store.load().activeDays || [];
  const streakDays = Store.streak();
  const todayStr   = Store.todayStr();
  const DAY_NAMES  = ['日','月','火','水','木','金','土'];
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return { label: DAY_NAMES[d.getDay()], done: activeDays.includes(ds), isToday: ds === todayStr };
  });
  const weekDone = week.filter(d => d.done).length;

  const icons = {
    '権利関係': '⚖️', '宅建業法': '🏢',
    '法令上の制限': '📋', '税・その他': '💴',
  };

  // 苦手問題 TOP5（誤答数降順）
  const weakQs = QUESTIONS
    .filter(q => {
      const h = hist[q.id];
      return h && h.attempts > 0 && h.correct < h.attempts;
    })
    .sort((a, b) => {
      const ha = hist[a.id], hb = hist[b.id];
      return (hb.attempts - hb.correct) - (ha.attempts - ha.correct);
    })
    .slice(0, 5);

  const weakList = weakQs.length > 0
    ? weakQs.map((q, i) => {
        const h        = hist[q.id];
        const wrongCnt = h.attempts - h.correct;
        const qText    = q.question.length > 34
          ? escapeHTML(q.question.slice(0, 34)) + '…'
          : escapeHTML(q.question);
        return `
        <div class="weak-item">
          <div class="weak-rank">${i + 1}</div>
          <div class="weak-info">
            <div class="weak-cat-tag">${escapeHTML(q.category)}</div>
            <div class="weak-q-text">${qText}</div>
          </div>
          <div class="weak-wrong-count">×${wrongCnt}</div>
        </div>`;
      }).join('')
    : '<div class="weak-empty">まだ間違えた問題がありません ✨</div>';

  // 分野別成績行
  const catRows = CATEGORIES.map(cat => {
    const qs        = QUESTIONS.filter(q => q.category === cat);
    const catDone   = qs.filter(q => hist[q.id]?.attempts > 0).length;
    const catUndone = qs.length - catDone;
    const att       = qs.reduce((s, q) => s + (hist[q.id]?.attempts || 0), 0);
    const cr        = qs.reduce((s, q) => s + (hist[q.id]?.correct  || 0), 0);
    const r         = att > 0 ? Math.round(cr / att * 100) : 0;
    const latestAt  = qs.reduce((max, q) => Math.max(max, hist[q.id]?.lastAt || 0), 0);

    const countText = att > 0
      ? `${att}回解答 / 正解${cr}回　未学習${catUndone}問`
      : `未挑戦（全${qs.length}問）`;
    const dateHtml = latestAt > 0
      ? `<div class="cat-stat-date">最終学習: ${formatDate(latestAt)}</div>`
      : '';

    return `
    <div class="cat-stat-row">
      <span class="cat-stat-icon">${icons[cat] || '📖'}</span>
      <div class="cat-stat-info">
        <div class="cat-stat-name">${escapeHTML(cat)}</div>
        <div class="cat-stat-count">${countText}</div>
        <div class="cat-bar-track">
          <div class="cat-bar-fill" style="width:${r}%"></div>
        </div>
        ${dateHtml}
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
        <div class="stats-card-title">📅 継続記録</div>
        <div style="text-align:center;margin-bottom:14px">
          <span style="font-size:36px;font-weight:900;color:var(--g600)">${streakDays}日</span>
          <span style="font-size:13px;color:var(--text-sub);margin-left:6px">連続学習中</span>
        </div>
        <div class="cal-week">
          ${week.map(d => `
          <div class="cal-day">
            <div class="cal-label">${d.label}</div>
            <div class="cal-dot${d.done ? ' done' : ''}${d.isToday ? ' today' : ''}"></div>
          </div>`).join('')}
        </div>
        <div style="text-align:center;margin-top:10px;font-size:13px;
          color:var(--text-mid);font-weight:700">
          直近7日で ${weekDone} 日学習
        </div>
      </div>
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
          <div class="stats-metric" style="grid-column:1/-1">
            <div class="stats-metric-val">${undone}</div>
            <div class="stats-metric-label">未学習問題</div>
          </div>
        </div>
      </div>

      <div class="stats-card">
        <div class="stats-card-title">⚠️ 苦手問題 TOP5</div>
        <div class="weak-list">${weakList}</div>
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

// ── GUIDE ──────────────────────────────────────────────────────────────
function renderGuide() {
  const items = [
    {
      icon: '🌟',
      title: '今日の5問',
      body: '毎日5問を出題します。未学習の問題を優先し、次に間違えた問題、それ以外はランダムで補充します。毎日続けることで連続学習日数が伸びます。',
    },
    {
      icon: '📚',
      title: '分野別学習',
      body: '権利関係・宅建業法・法令上の制限・税その他の4分野から選んで学習できます。各分野は25問ずつの章に分かれており、進捗を確認しながら進められます。',
    },
    {
      icon: '🎲',
      title: 'ランダムテスト',
      body: '全300問からランダムに10・20・30問を出題します。分野を横断した本番に近い練習ができます。',
    },
    {
      icon: '🔄',
      title: '間違い復習',
      body: '過去に1度でも間違えた問題を、誤答数の多い順に出題します。苦手な問題を集中的に克服できます。',
    },
    {
      icon: '⚠️',
      title: '弱点サマリー',
      body: 'ホーム画面に4分野ごとの正答率ミニバーが表示されます。どの分野を優先して復習すべきか一目で確認できます。70%を目安に、低い分野から集中的に復習しましょう。',
    },
    {
      icon: '🔖',
      title: '付箋問題',
      body: '問題画面の ☆ をタップすると付箋を付けられます。気になった問題や重要問題をまとめて復習するのに使います。',
    },
    {
      icon: '📊',
      title: '学習記録',
      body: '全体の正答率・総回答数・苦手問題TOP5・分野別成績を確認できます。学習の進み具合を把握して、優先的に取り組む分野を見つけましょう。',
    },
    {
      icon: '🗓️',
      title: '試験日逆算プラン',
      body: '試験日までの残り日数から、今日の目標5問・今週の目標35問を確認できます。苦手問題がある場合は、まず間違い復習から進めるのがおすすめです。',
    },
    {
      icon: '💡',
      title: '学習のコツ',
      body: 'まず「今日の5問」を毎日続けることが最優先です。連続学習日数を積み重ねることが合格への近道です。慣れてきたら分野別学習やランダムテストで実力を確認しましょう。',
    },
    {
      icon: '📚',
      title: '分野・章ごとに学ぶ',
      body: '分野別学習では、各分野をさらに「第1章」「第2章」「第3章」に分けて学習できます。特定の章を集中的に学ぶことで、苦手な単元を効率よく攻略できます。「全章」を選ぶと、その分野の全75問をまとめて出題します。',
    },
    {
      icon: '🧪',
      title: 'ベータ版について',
      body: '本アプリは現在ベータ版です。問題・解説の内容は随時改善・追加されます。現在300問収録しています。今後、問題数の拡充も検討しています。お気づきの点があればフィードバックをお寄せください。',
    },
  ];

  const cards = items.map(item => `
    <div class="stats-card">
      <div class="stats-card-title">${item.icon} ${escapeHTML(item.title)}</div>
      <div style="font-size:14px;line-height:1.85;color:var(--text-mid)">${escapeHTML(item.body)}</div>
    </div>`).join('');

  return `
  <div class="screen">
    <div class="header">
      <button class="btn-back" data-action="go-home">
        <span class="btn-back-arrow">←</span>戻る
      </button>
      <div class="header-title">アプリの使い方</div>
    </div>
    <div class="stats-body">
      ${cards}
    </div>
  </div>`;
}

// ── RESUME DIALOG ──────────────────────────────────────────────────────
function showResumeDialog(resumeKey, resumeData, category, chapterStart) {
  const prev = document.getElementById('resume-dialog');
  if (prev) prev.remove();

  const answered = resumeData.nextIndex;
  const total    = resumeData.questionCount;

  const overlay = document.createElement('div');
  overlay.id = 'resume-dialog';
  overlay.innerHTML = `
    <div class="resume-card">
      <div class="resume-title">途中から再開しますか？</div>
      <div class="resume-body">${escapeHTML(String(answered))}問答えました（全${escapeHTML(String(total))}問）</div>
      <div class="resume-btns">
        <button class="resume-btn-sub" data-resume="restart">最初から解く</button>
        <button class="resume-btn-primary" data-resume="continue">続きから解く</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  overlay.addEventListener('click', e => {
    if (e.target === overlay) { overlay.remove(); return; }
    const btn = e.target.closest('[data-resume]');
    if (!btn) return;
    overlay.remove();

    if (btn.dataset.resume === 'continue') {
      // Restore shuffled order from saved questionIds
      let qs = null;
      if (resumeData.questionIds && resumeData.questionIds.length > 0) {
        const restored = resumeData.questionIds.map(id => QUESTIONS.find(q => q.id === id));
        if (restored.every(q => q !== undefined)) qs = restored;
      }
      // Fallback: questionIds missing/invalid or index out of range → fresh start
      if (!qs || resumeData.nextIndex >= qs.length) {
        Store.clearResume(resumeKey);
        startQuiz('category', category, chapterStart);
        return;
      }
      App.quizMode       = 'category';
      App.quizCategory   = category;
      App.quizQuestions  = qs;
      App.currentIndex   = resumeData.nextIndex;
      App.selectedAnswer = null;
      App.sessionResults = [];
      App._resumeKey     = resumeKey;
      App._chapterStart  = chapterStart;
      go('quiz');
    } else {
      Store.clearResume(resumeKey);
      startQuiz('category', category, chapterStart);
    }
  });
}

// ── EXAM RESUME ────────────────────────────────────────────────────────
function isValidExamSession(es) {
  if (!es) return false;
  if (!Array.isArray(es.questionIds) || es.questionIds.length !== 50) return false;
  if (!Array.isArray(es.answers)) return false;
  if (typeof es.nextIndex !== 'number') return false;
  if (es.nextIndex <= 0 || es.nextIndex >= es.questionIds.length) return false;
  return true;
}

function showExamResumeDialog(es) {
  const prev = document.getElementById('resume-dialog');
  if (prev) prev.remove();

  const answered = es.nextIndex;
  const total    = es.questionIds.length;
  const timeInfo = es.timerEnabled
    ? `（残り${Math.floor(es.remainingSeconds / 60)}分）`
    : '';

  const overlay = document.createElement('div');
  overlay.id = 'resume-dialog';
  overlay.innerHTML = `
    <div class="resume-card">
      <div class="resume-title">模試の途中から再開しますか？</div>
      <div class="resume-body">${escapeHTML(String(answered))}問答えました（全${escapeHTML(String(total))}問）${escapeHTML(timeInfo)}</div>
      <div class="resume-btns">
        <button class="resume-btn-sub" data-exam-resume="restart">最初から解く</button>
        <button class="resume-btn-primary" data-exam-resume="continue">続きから解く</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  overlay.addEventListener('click', e => {
    if (e.target === overlay) { overlay.remove(); return; }
    const btn = e.target.closest('[data-exam-resume]');
    if (!btn) return;
    overlay.remove();

    if (btn.dataset.examResume === 'continue') {
      const restored = es.questionIds.map(id => QUESTIONS.find(q => q.id === id));
      if (restored.some(q => q === undefined)) {
        Store.clearExamSession();
        go('exam-setup');
        return;
      }
      // Edge case: all answered already
      if (es.nextIndex >= restored.length) {
        Store.clearExamSession();
        go('exam-setup');
        return;
      }
      App.quizMode       = 'exam';
      App.quizCategory   = null;
      App.quizQuestions  = restored;
      App.currentIndex   = es.nextIndex;
      App.selectedAnswer = null;
      App.sessionResults = es.answers.slice();
      App._resumeKey     = null;
      App._chapterStart  = undefined;
      App.examTimerEnabled  = es.timerEnabled;
      App.examTimerSeconds  = es.timerEnabled ? (es.remainingSeconds || 0) : 0;
      go('quiz');
      if (es.timerEnabled && App.examTimerSeconds > 0) startExamTimer();
    } else {
      Store.clearExamSession();
      go('exam-setup');
    }
  });
}

// ── EXAM TIMER ─────────────────────────────────────────────────────────
function stopExamTimer() {
  if (App._examTimerInterval) {
    clearInterval(App._examTimerInterval);
    App._examTimerInterval = null;
  }
}

function startExamTimer() {
  stopExamTimer();
  App._examTimerInterval = setInterval(() => {
    if (App.screen !== 'quiz' || App.quizMode !== 'exam') {
      stopExamTimer();
      return;
    }
    App.examTimerSeconds--;
    if (App.examTimerSeconds <= 0) {
      stopExamTimer();
      Store.clearExamSession();
      go('exam-result');
      return;
    }
    const el = document.getElementById('exam-timer-display');
    if (el) {
      const m = Math.floor(App.examTimerSeconds / 60);
      const s = App.examTimerSeconds % 60;
      const color = App.examTimerSeconds <= 300 ? '#E05252' : 'var(--g700)';
      el.innerHTML = `⏱️ <span style="font-weight:700;color:${color}">${m}:${String(s).padStart(2, '0')}</span>`;
    }
  }, 1000);
}

// ── EVENTS ─────────────────────────────────────────────────────────────
document.getElementById('app').addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el) return;

  switch (el.dataset.action) {
    case 'go-home': {
      if (App.quizMode === 'exam' && App.screen === 'quiz') {
        const es = Store.loadExamSession();
        if (es) {
          Store.saveExamSession({ ...es, remainingSeconds: App.examTimerSeconds, updatedAt: Date.now() });
        }
      }
      stopExamTimer();
      go('home');
      break;
    }
    case 'go-categories':  go('categories');  break;
    case 'go-stats':       go('stats');       break;
    case 'go-guide':       go('guide');       break;
    case 'go-exam': {
      const es = Store.loadExamSession();
      if (isValidExamSession(es)) {
        showExamResumeDialog(es);
      } else {
        if (es) Store.clearExamSession();
        go('exam-setup');
      }
      break;
    }

    case 'start-exam': {
      const timerOn = el.dataset.timer === '1';
      App.examTimerEnabled = timerOn;
      App.examTimerSeconds = timerOn ? 7200 : 0;
      startQuiz('exam');
      if (timerOn) startExamTimer();
      break;
    }

    case 'start-random':        go('random-count');                   break;
    case 'start-random-count':
      App.randomCount = parseInt(el.dataset.value);
      startQuiz('random');
      break;
    case 'start-daily':    startQuiz('daily');                        break;
    case 'start-review':   startQuiz('review');                      break;
    case 'start-bookmark': startQuiz('bookmark');                    break;
    case 'start-category': {
      App.selectedCategory = el.dataset.value;
      const catQs = QUESTIONS.filter(q => q.category === App.selectedCategory);
      if (catQs.length > CHAPTER_SIZE) go('category-chapters');
      else startQuiz('category', App.selectedCategory);
      break;
    }
    case 'start-chapter': {
      const cat   = App.selectedCategory;
      const start = parseInt(el.dataset.value);
      const rkey  = Store.resumeKey(cat, start);
      const rd    = Store.loadResume(rkey);
      if (rd && rd.nextIndex > 0 && rd.nextIndex < rd.questionCount) {
        showResumeDialog(rkey, rd, cat, start);
      } else {
        if (rd) Store.clearResume(rkey);
        startQuiz('category', cat, start);
      }
      break;
    }
    case 'start-chapter-all': {
      const cat  = App.selectedCategory;
      const rkey = Store.resumeKey(cat, undefined);
      const rd   = Store.loadResume(rkey);
      if (rd && rd.nextIndex > 0 && rd.nextIndex < rd.questionCount) {
        showResumeDialog(rkey, rd, cat, undefined);
      } else {
        if (rd) Store.clearResume(rkey);
        startQuiz('category', cat);
      }
      break;
    }
    case 'session-review': startQuiz('session-review');              break;

    case 'answer':
      answerQuestion(parseInt(el.dataset.value));
      break;

    case 'next':
      nextQuestion();
      break;

    case 'bookmark': {
      const qid = el.dataset.qid;
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
