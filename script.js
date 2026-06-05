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
    '建築規制・農地・開発許可・各種制限の総合',
  ],
  '税・その他': [
    '不動産税制（取得税・固定資産税・印紙税）',
    '譲渡所得・鑑定評価・支援機構・景表法',
    '住宅ローン控除・相続税・土地建物知識',
    '税制詳細・鑑定評価・支援機構・広告規制',
    '税制・鑑定評価・支援機構・広告規制の総合',
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
  numbersCategory: null,
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
    numbers:             renderNumbers,
    confusion:           renderConfusion,
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

  const totalQ        = QUESTIONS.length;
  const overallPct    = Math.round(done / totalQ * 100);
  const paceGood      = undone === 0 || (paceNeed > 0 && todayCount >= paceNeed);
  const paceBoxLabel  = paceGood ? '良好' : '伸ばそう';

  // 次のおすすめ：今日の5問完了後に、次に押すべき行動を1つ提案
  const nextTip = (
    wrongCnt >= 3
      ? { title:'間違えた問題を復習', reason:`苦手問題が ${wrongCnt} 問あります`,
          btnLabel:'復習する', action:'start-review', icon:'🔄' }
    : (worstCat && worstCat.rate !== null && worstCat.rate < 60)
      ? { title:'苦手分野を強化', reason:`${worstCat.cat} の正答率が ${worstCat.rate}%`,
          btnLabel:'分野別学習', action:'go-categories', icon:'📚' }
    : wrongCnt > 0
      ? { title:'残り問題を復習', reason:`復習対象が ${wrongCnt} 問あります`,
          btnLabel:'復習する', action:'start-review', icon:'🔄' }
    : { title:'模擬試験で確認', reason:'実戦形式で仕上げましょう',
        btnLabel:'模試へ', action:'go-exam', icon:'🏆' }
  );

  // 苦手分野TOP1（ホーム表示用。詳細は学習記録画面に任せる）
  const worstHasData = worstCat && worstCat.rate !== null;
  const worstColor   = worstHasData
    ? (worstCat.rate >= 70 ? 'var(--g400)'
      : worstCat.rate >= 50 ? 'var(--blue)' : 'var(--red)')
    : 'var(--border)';

  return `
  <div class="screen">

    <div class="home-hero">
      <div class="home-hero-pattern" aria-hidden="true"></div>
      <div class="home-hero-top">
        <div class="home-logo-wrap">
          <span style="font-size:30px;line-height:1">🏠</span>
        </div>
        <div class="home-hero-titles">
          <div class="home-title">Takken Learning Hub</div>
          <div class="home-subtitle">宅建試験の合格を、ここから一緒に。</div>
        </div>
        <div class="home-hero-bell" aria-hidden="true">🔔</div>
      </div>
    </div>

    <div class="stats-card-large">
      <div class="stat-cell">
        <div class="stat-cell-icon">📚</div>
        <div class="stat-cell-val">${done}</div>
        <div class="stat-cell-label">学習済み</div>
      </div>
      <div class="stat-cell">
        <div class="stat-cell-icon">📝</div>
        <div class="stat-cell-val">${total}</div>
        <div class="stat-cell-label">総回答数</div>
      </div>
      <div class="stat-cell">
        <div class="stat-cell-icon">🎯</div>
        <div class="stat-cell-val">${rate}<span class="stat-cell-unit">%</span></div>
        <div class="stat-cell-label">正答率</div>
      </div>
      <div class="stat-cell">
        <div class="stat-cell-icon">✏️</div>
        <div class="stat-cell-val">${todayCount}</div>
        <div class="stat-cell-label">今日</div>
      </div>
      <div class="stat-cell">
        <div class="stat-cell-icon">🔥</div>
        <div class="stat-cell-val">${streakDays}<span class="stat-cell-unit">日</span></div>
        <div class="stat-cell-label">連続学習</div>
      </div>
    </div>

    <div class="home-body">

      ${isDone
        ? `<div class="home-done-card">
            <div class="home-done-badge">
              <span class="home-done-check">✓</span>
            </div>
            <div class="home-done-text">
              <div class="home-done-title">今日の5問 完了！</div>
              <div class="home-done-sub">また明日も続けましょう</div>
            </div>
          </div>`
        : `<div class="home-daily-card">
            <div class="home-daily-badge">
              <span class="home-daily-badge-num">5</span>
              <span class="home-daily-badge-text">問</span>
            </div>
            <div class="home-daily-content">
              <div class="home-daily-title">今日の5問</div>
              <div class="home-daily-sub">今日の学習を始めましょう</div>
            </div>
            <button class="home-daily-btn" data-action="start-daily">
              <span class="home-daily-btn-label">今日の5問を始める</span>
              <span class="home-daily-btn-arrow">›</span>
            </button>
          </div>`
      }

      <div class="home-plan-card">
        <div class="home-plan-header">
          <div class="home-plan-title-row">
            <span class="home-plan-icon">📅</span>
            <span class="home-plan-title">試験日から逆算</span>
          </div>
          <span class="home-plan-days-badge">残り${daysLeft}日</span>
        </div>
        <div class="home-plan-body">
          <div class="home-plan-days">未学習 <strong>${undone}問</strong> ／ 試験まで <strong>${daysLeft}日</strong></div>
          ${undone > 0 && daysLeft > 0
            ? `<div class="home-plan-pace-need">1日 <strong>${paceNeed}問</strong> ペースで一周できます</div>`
            : (undone === 0 ? `<div class="home-plan-pace-need">全問学習済み。復習で仕上げましょう</div>` : '')}
        </div>
      </div>

      <div class="menu-section">
        <div class="section-label">学習メニュー</div>
        <div class="menu-grid">
          <button class="menu-btn" data-action="go-categories">
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
            <span class="btn-sub">${wrongCnt > 0 ? '復習対象：' + wrongCnt + '問' : '対象なし'}</span>
          </button>
          <button class="menu-btn" data-action="start-bookmark"
            style="${bkCnt === 0 ? 'opacity:0.45;pointer-events:none' : ''}">
            <span class="btn-icon">🔖</span>
            <span class="btn-label">付箋問題</span>
            <span class="btn-sub">${bkCnt > 0 ? bkCnt + '問' : 'なし'}</span>
          </button>
          <button class="menu-btn" data-action="go-exam">
            <span class="btn-icon">🏆</span>
            <span class="btn-label">模擬試験</span>
            <span class="btn-sub">50問・本試験風配分</span>
          </button>
          <button class="menu-btn" data-action="go-stats">
            <span class="btn-icon">📊</span>
            <span class="btn-label">学習記録</span>
            <span class="btn-sub">これまでの記録を見る</span>
          </button>
        </div>
        <button class="menu-btn full" data-action="go-numbers">
          <span class="btn-icon">🔢</span>
          <span class="btn-label">重要数字マップ</span>
          <span class="btn-sub">頻出の数字・期限を整理</span>
        </button>
        <button class="menu-btn full" data-action="go-confusion">
          <span class="btn-icon">🧩</span>
          <span class="btn-label">混同ポイント整理</span>
          <span class="btn-sub">似た制度の違いを比較</span>
        </button>
        <button class="menu-btn full" data-action="go-guide">
          <span class="btn-icon">📘</span>
          <span class="btn-label">アプリの使い方</span>
          <span class="btn-sub">基本操作と機能ガイド</span>
        </button>
      </div>

      <div class="home-section">
        <div class="home-section-title">学習診断</div>
        <div class="weakness-row">
          <div class="weakness-cell weakness-cell-red${wrongCnt === 0 ? ' weakness-cell-muted' : ''}">
            <div class="weakness-cell-val">${wrongCnt}<span class="weakness-cell-unit">問</span></div>
            <div class="weakness-cell-label">苦手問題数</div>
          </div>
          <div class="weakness-cell weakness-cell-blue">
            <div class="weakness-cell-val">${rate}<span class="weakness-cell-unit">%</span></div>
            <div class="weakness-cell-label">全体正答率</div>
          </div>
          <div class="weakness-cell weakness-cell-good${paceGood ? '' : ' weakness-cell-good-warn'}">
            <div class="weakness-cell-msg-label">学習ペース</div>
            <div class="weakness-cell-msg-body">${paceBoxLabel}</div>
          </div>
        </div>
        <div class="weakness-worst">
          ${worstHasData ? `
            <div class="weakness-worst-meta">
              <span class="weakness-worst-label">苦手分野</span>
              <span class="weakness-worst-name">${CAT_ICONS[worstCat.cat]} ${worstCat.cat}</span>
              <span class="weakness-worst-rate">${worstCat.rate}%</span>
            </div>
            <div class="cat-bar-track">
              <div class="cat-bar-fill" style="width:${worstCat.rate}%;background:${worstColor}"></div>
            </div>
          ` : `<div class="weakness-worst-empty">まだ十分なデータがありません</div>`}
        </div>
        <div class="weakness-progress">
          <div class="weakness-progress-meta">
            <span class="weakness-progress-label">学習進捗</span>
            <span class="weakness-progress-val"><strong>${done}</strong> / ${totalQ}問</span>
          </div>
          <div class="cat-bar-track">
            <div class="cat-bar-fill" style="width:${overallPct}%;background:linear-gradient(90deg,var(--blue),var(--blue-light))"></div>
          </div>
        </div>
        <div class="home-pace-status ${paceGood ? 'home-pace-ok' : 'home-pace-info'}">
          ${paceStatus}
        </div>
        <button class="weakness-detail-link" data-action="go-stats">詳しくは学習記録で確認 ›</button>
      </div>

      ${isDone ? `
      <div class="home-tip-card">
        <div class="home-tip-badge">
          <span class="home-tip-icon">${nextTip.icon}</span>
        </div>
        <div class="home-tip-content">
          <div class="home-tip-label">次のおすすめ</div>
          <div class="home-tip-title">${nextTip.title}</div>
          <div class="home-tip-reason">${nextTip.reason}</div>
        </div>
        <button class="home-tip-btn" data-action="${nextTip.action}">${nextTip.btnLabel} ›</button>
      </div>` : ''}

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
    const qs          = QUESTIONS.filter(q => q.category === cat);
    const done        = qs.filter(q => hist[q.id] && hist[q.id].attempts > 0).length;
    const attempts    = qs.reduce((s, q) => s + (hist[q.id]?.attempts || 0), 0);
    const correct     = qs.reduce((s, q) => s + (hist[q.id]?.correct  || 0), 0);
    const wrong       = qs.filter(q => hist[q.id] && hist[q.id].attempts > 0 && hist[q.id].correct < hist[q.id].attempts).length;
    const rate        = attempts > 0 ? Math.round(correct / attempts * 100) : null;
    const progressPct = Math.round(done / qs.length * 100);

    return `
    <div class="cat-card" data-action="start-category" data-value="${escapeHTML(cat)}">
      <div class="cat-icon">${icons[cat] || '📖'}</div>
      <div class="cat-body">
        <div class="cat-name-row">
          <div class="cat-name">${escapeHTML(cat)}</div>
          <div class="cat-total">${qs.length}問</div>
        </div>
        <div class="cat-progress-bar"><div class="cat-progress-fill" style="width:${progressPct}%"></div></div>
        <div class="cat-stats-row">
          <span class="cat-stat-done">済 ${done}問</span>
          <span class="cat-stat-rate">${rate !== null ? rate + '%' : '─'} 正答</span>
          ${wrong > 0 ? `<span class="cat-stat-wrong">復習 ${wrong}問</span>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');

  return `
  <div class="screen">
    <div class="header">
      <button class="btn-back" data-action="go-home">
        <span class="btn-back-arrow">←</span>戻る
      </button>
      <div class="header-title">合格戦略ダッシュボード</div>
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
  <div style="text-align:center;padding:8px;font-size:14px;color:#2563EB;font-weight:700">
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
  <div style="text-align:center;padding:8px;font-size:14px;color:#2563EB;font-weight:700">
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
      body: '全500問からランダムに10・20・30問を出題します。分野を横断した本番に近い練習ができます。',
    },
    {
      icon: '🏆',
      title: '本格模擬試験',
      body: '本試験と同じ50問・分野別配分（宅建業法20問・権利関係14問・法令上の制限8問・税その他8問）で実力確認できます。試験直前の総仕上げに活用しましょう。',
    },
    {
      icon: '⏱️',
      title: 'タイマー機能',
      body: '「時間を測って解く」を選ぶと120分カウントダウンが始まります。「時間制限なしで解く」を選べば、じっくり解説を確認しながら進められます。',
    },
    {
      icon: '💾',
      title: '模試の途中再開',
      body: '模試中にホームへ戻っても、次回「模擬試験」を開くと続きから再開できます。回答状況・出題順・残り時間が保存されます。「最初から解く」を選べば新しい問題順でやり直せます。',
    },
    {
      icon: '📋',
      title: '模試の採点結果',
      body: '模試終了後に正解数・正答率・分野別の正解数を確認できます。35点以上が合格の目安です。間違えた問題はその場でまとめて復習できます。',
    },
    {
      icon: '🔄',
      title: '間違い復習',
      body: '過去に1度でも間違えた問題を、誤答数の多い順に出題します。苦手な問題を集中的に克服できます。',
    },
    {
      icon: '⚠️',
      title: '苦手分野の確認',
      body: 'ホーム画面では、苦手問題数や全体正答率を確認できます。間違えた問題や正答率の低い分野をもとに、優先して復習する内容を判断しましょう。苦手な問題は「間違い復習」や「付箋問題」から効率よく見直せます。',
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
      body: '分野別学習では、各分野をさらに「第1章」〜「第5章」に分けて学習できます。特定の章を集中的に学ぶことで、苦手な単元を効率よく攻略できます。「全章」を選ぶと、その分野の全125問をまとめて出題します。',
    },
    {
      icon: '🧪',
      title: 'ベータ版について',
      body: '本アプリは現在ベータ版です。問題・解説の内容は随時改善・追加されます。現在500問収録しています。お気づきの点があればフィードバックをお寄せください。',
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

// ── NUMBERS MAP ────────────────────────────────────────────────────────
function renderNumbers() {
  const data = [
    {
      category: '宅建業法',
      label: '媒介契約の有効期間（専任・専属専任）',
      value: '3ヶ月以内',
      note: '依頼者からの申出があれば更新できます。一般媒介にこの制限はありません。',
    },
    {
      category: '宅建業法',
      label: '専属専任媒介：業務報告義務',
      value: '1週間に1回以上',
      note: '指定流通機構への登録は契約から5日以内です。',
    },
    {
      category: '宅建業法',
      label: '専任媒介：業務報告義務',
      value: '2週間に1回以上',
      note: '指定流通機構への登録は契約から7日以内です。',
    },
    {
      category: '宅建業法',
      label: 'クーリングオフの行使期限',
      value: '書面告知から8日以内',
      note: '事務所等以外で申込み・契約した場合に問題になります。',
    },
    {
      category: '宅建業法',
      label: '営業保証金',
      value: '本店1,000万円 / 支店ごとに500万円',
      note: '供託所に供託します。保証協会とは金額が違います。',
    },
    {
      category: '宅建業法',
      label: '弁済業務保証金分担金',
      value: '本店60万円 / 支店ごとに30万円',
      note: '保証協会に納付します。営業保証金との混同に注意。',
    },
    {
      category: '宅建業法',
      label: '保証協会加入時の分担金納付期限',
      value: '加入しようとする日まで',
      note: '保証協会に加入する前に分担金を納付します。',
    },
    {
      category: '宅建業法',
      label: '支店設置後の分担金納付期限',
      value: '2週間以内',
      note: '新たに事務所を設置した日から2週間以内です。',
    },
    {
      category: '宅建業法',
      label: '帳簿の保存期間',
      value: '閉鎖後5年 / 新築住宅売主は10年',
      note: '帳簿は各事業年度末に閉鎖します。',
    },
    {
      category: '宅建業法',
      label: '従業者名簿の保存期間',
      value: '最終記載から10年',
      note: '各事務所に備え付けます。',
    },
    {
      category: '宅建業法',
      label: '手付金等の保全措置（未完成物件）',
      value: '5%超または1,000万円超',
      note: '自ら売主の8種規制。受領前に保全措置が必要です。',
    },
    {
      category: '宅建業法',
      label: '手付金等の保全措置（完成物件）',
      value: '10%超または1,000万円超',
      note: '完成物件は未完成物件より基準が緩くなります。',
    },
    {
      category: '法令上の制限',
      label: '農地法3条：許可権者',
      value: '農業委員会',
      note: '農地を農地のまま権利移動する場合です。',
    },
    {
      category: '法令上の制限',
      label: '農地法4条：自己転用',
      value: '農地を農地以外にする',
      note: '所有者が自分の農地を転用する場合です。',
    },
    {
      category: '法令上の制限',
      label: '農地法5条：転用目的の権利移動',
      value: '転用＋権利移動',
      note: '売買などで権利を移し、農地以外にする場合です。',
    },
    {
      category: '法令上の制限',
      label: '農地法4条・5条：許可権者',
      value: '原則、都道府県知事等',
      note: '市街化区域内の農地では、あらかじめ農業委員会へ届け出れば許可は不要です。',
    },
    {
      category: '法令上の制限',
      label: '国土法 事後届出（市街化区域）',
      value: '2,000㎡以上',
      note: '一定規模以上の土地取引は、契約後に届出が必要です。',
    },
    {
      category: '法令上の制限',
      label: '国土法 事後届出（市街化調整区域・非線引区域）',
      value: '5,000㎡以上',
      note: '市街化区域より広い面積基準です。',
    },
    {
      category: '法令上の制限',
      label: '国土法 事後届出（都市計画区域外）',
      value: '10,000㎡以上',
      note: '1ヘクタール以上の土地取引で届出対象になります。',
    },
    {
      category: '税・その他',
      label: '固定資産税の免税点（土地）',
      value: '30万円未満',
      note: '課税標準額が30万円未満の場合は課税されません。',
    },
    {
      category: '税・その他',
      label: '固定資産税の標準税率',
      value: '1.4%',
      note: '市町村が課税します。宅建では都市計画税との混同に注意。',
    },
    {
      category: '税・その他',
      label: '都市計画税の制限税率',
      value: '0.3%',
      note: '市街化区域内の土地・家屋などが対象になります。',
    },
    {
      category: '税・その他',
      label: '小規模住宅用地の特例',
      value: '固定資産税 1/6 / 都市計画税 1/3',
      note: '住宅1戸につき200㎡以下の部分です。',
    },
    {
      category: '税・その他',
      label: '一般住宅用地の特例',
      value: '固定資産税 1/3 / 都市計画税 2/3',
      note: '200㎡を超える住宅用地部分です。',
    },
    {
      category: '税・その他',
      label: '3,000万円特別控除',
      value: '所有期間要件なし',
      note: '居住用財産の譲渡で使う特例です。居住期間の長短は問いません。',
    },
    {
      category: '税・その他',
      label: '不動産取得税の免税点（土地）',
      value: '10万円未満',
      note: '家屋（新築・増改築）は23万円未満、売買等による取得は12万円未満で免税点になります。',
    },
    {
      category: '権利関係',
      label: '消滅時効（債権・一般）',
      value: '知った時から5年 / 権利行使できる時から10年',
      note: 'どちらか先に到来した時点で時効が完成します。',
    },
    {
      category: '権利関係',
      label: '所有権の取得時効',
      value: '10年 / 20年',
      note: '善意無過失なら10年、それ以外は20年で取得時効が完成します。',
    },
    {
      category: '権利関係',
      label: '取消権の期間制限',
      value: '追認できる時から5年 / 行為時から20年',
      note: 'どちらか先に経過すると取消権は消滅します。',
    },
    {
      category: '権利関係',
      label: '即時取得：盗品・遺失物の回復期間',
      value: '盗難・遺失から2年以内',
      note: '被害者・遺失者は2年以内に限り、原則として回復請求できます。',
    },
    {
      category: '権利関係',
      label: '相続放棄・限定承認',
      value: '知った時から3ヶ月以内',
      note: '自己のために相続開始があったことを知った時から起算します。',
    },
    {
      category: '権利関係',
      label: '共有物の重大変更',
      value: '共有者全員の同意',
      note: '形状または効用の著しい変更を伴う場合です。管理は持分価格の過半数、保存行為は各共有者が単独でできます。',
    },
    {
      category: '権利関係',
      label: '区分所有法：建替え決議',
      value: '区分所有者および議決権の各5分の4以上',
      note: '建替えは特に重い決議要件です。',
    },
    {
      category: '権利関係',
      label: '区分所有法：規約の設定・変更・廃止',
      value: '区分所有者および議決権の各4分の3以上',
      note: '共用部分の重大変更や管理組合法人設立とも混同しやすい数字です。',
    },
  ];

  const ORDER = ['宅建業法', '法令上の制限', '税・その他', '権利関係'];
  const CAT_ICONS = { '宅建業法': '🏢', '法令上の制限': '📋', '税・その他': '💴', '権利関係': '⚖️' };

  const selected = App.numbersCategory;

  if (!selected) {
    const catBtns = ORDER.map(cat => {
      const count = data.filter(d => d.category === cat).length;
      return `
      <div class="numbers-cat-btn" data-action="select-numbers-category" data-value="${escapeHTML(cat)}">
        <span class="numbers-cat-btn-icon">${CAT_ICONS[cat] || '📖'}</span>
        <span class="numbers-cat-btn-name">${escapeHTML(cat)}</span>
        <span class="numbers-cat-btn-count">${count}件</span>
      </div>`;
    }).join('');

    return `
    <div class="screen">
      <div class="header">
        <button class="btn-back" data-action="go-home">
          <span class="btn-back-arrow">←</span>戻る
        </button>
        <div class="header-title">重要数字マップ</div>
      </div>
      <div class="numbers-body">
        <div class="numbers-intro">宅建で混同しやすい数字・期限・割合を整理します。</div>
        <div class="numbers-cat-list">${catBtns}</div>
      </div>
    </div>`;
  }

  const items = data.filter(d => d.category === selected);
  const cardsHtml = items.map(item => `
    <div class="numbers-card">
      <div class="numbers-label">${escapeHTML(item.label)}</div>
      <div class="numbers-value">${escapeHTML(item.value)}</div>
      <div class="numbers-note">${escapeHTML(item.note)}</div>
    </div>`).join('');

  return `
  <div class="screen">
    <div class="header">
      <button class="btn-back" data-action="back-numbers-categories">
        <span class="btn-back-arrow">←</span>分野選択へ戻る
      </button>
      <div class="header-title">重要数字マップ</div>
    </div>
    <div class="numbers-body">
      <div class="numbers-cat-heading">${CAT_ICONS[selected] || '📖'} ${escapeHTML(selected)}（${items.length}）</div>
      ${cardsHtml}
    </div>
  </div>`;
}

// ── CONFUSION MAP ──────────────────────────────────────────────────────
function renderConfusion() {
  const data = [
    {
      category: '宅建業法',
      title: '35条書面 vs 37条書面',
      leftLabel: '35条書面（重要事項説明書）',
      rightLabel: '37条書面（契約書面）',
      leftBody: '契約締結前に交付\n宅建士が説明する\n買主・借主に交付',
      rightBody: '契約締結後、遅滞なく交付\n宅建士の記名が必要\n売主・買主など契約当事者に交付',
      rememberPoint: '契約「前」が35条、契約「後」が37条。',
      dangerPoint: '37条書面は説明義務までは不要。ただし宅建士の記名は必要です。',
    },
    {
      category: '宅建業法',
      title: '営業保証金 vs 弁済業務保証金分担金',
      leftLabel: '営業保証金',
      rightLabel: '弁済業務保証金分担金',
      leftBody: '本店1,000万円\n支店ごとに500万円\n供託所に供託',
      rightBody: '本店60万円\n支店ごとに30万円\n保証協会に納付',
      rememberPoint: '営業保証金は高額で供託所、分担金は保証協会に納付。',
      dangerPoint: '金額だけでなく、供託先・納付先も混同しやすいポイントです。',
    },
    {
      category: '法令上の制限',
      title: '農地法3条 vs 農地法5条',
      leftLabel: '農地法3条',
      rightLabel: '農地法5条',
      leftBody: '農地を農地のまま権利移動\n売買・賃貸などで所有権や使用権を移す\n許可権者は農業委員会',
      rightBody: '転用目的で権利移動\n売買などで権利を移し、農地以外にする\n原則として都道府県知事等の許可',
      rememberPoint: '3条は「農地のまま移す」、5条は「転用して移す」。',
      dangerPoint: '5条は「転用」と「権利移動」がセット。自己転用だけなら4条です。',
    },
    {
      category: '法令上の制限',
      title: '市街化区域 vs 市街化調整区域',
      leftLabel: '市街化区域',
      rightLabel: '市街化調整区域',
      leftBody: 'すでに市街地、またはおおむね10年以内に市街化を図る区域\n用途地域は原則として定める\n農地転用は届出で足りる場合がある',
      rightBody: '市街化を抑制すべき区域\n用途地域は原則として定めない\n開発行為や建築が厳しく制限される',
      rememberPoint: '市街化区域は「市街化を進める」、市街化調整区域は「市街化を抑える」。',
      dangerPoint: '市街化調整区域でも絶対に建築不可ではありません。許可や例外が問題になります。',
    },
    {
      category: '税・その他',
      title: '固定資産税 vs 都市計画税',
      leftLabel: '固定資産税',
      rightLabel: '都市計画税',
      leftBody: '土地・家屋・償却資産に課税\n標準税率は1.4%\n市町村が課税',
      rightBody: '原則として市街化区域内の土地・家屋に課税\n制限税率は0.3%\n都市計画事業などの費用に充てる',
      rememberPoint: '固定資産税は広く課税、都市計画税は市街化区域内が中心。',
      dangerPoint: '固定資産税は標準税率1.4%、都市計画税は制限税率0.3%。数字を逆にしないこと。',
    },
    {
      category: '税・その他',
      title: '小規模住宅用地 vs 一般住宅用地',
      leftLabel: '小規模住宅用地',
      rightLabel: '一般住宅用地',
      leftBody: '住宅1戸につき200㎡以下の部分\n固定資産税は1/6\n都市計画税は1/3',
      rightBody: '200㎡を超える住宅用地部分\n固定資産税は1/3\n都市計画税は2/3',
      rememberPoint: '小規模の方が軽減が大きい。200㎡以下は固定資産税1/6。',
      dangerPoint: '固定資産税と都市計画税で軽減割合が違います。1/6・1/3・2/3の混同に注意。',
    },
  ];

  const ORDER = ['宅建業法', '法令上の制限', '税・その他', '権利関係'];

  const makeBody = text => escapeHTML(text).replace(/\n/g, '<br>');

  const cards = data.map(item => `
    <div class="confusion-card">
      <div class="confusion-cat-tag">${escapeHTML(item.category)}</div>
      <div class="confusion-title">${escapeHTML(item.title)}</div>
      <div class="confusion-compare">
        <div class="confusion-side">
          <div class="confusion-side-label">${escapeHTML(item.leftLabel)}</div>
          <div class="confusion-side-body">${makeBody(item.leftBody)}</div>
        </div>
        <div class="confusion-divider"></div>
        <div class="confusion-side">
          <div class="confusion-side-label">${escapeHTML(item.rightLabel)}</div>
          <div class="confusion-side-body">${makeBody(item.rightBody)}</div>
        </div>
      </div>
      <div class="confusion-remember">💡 ${escapeHTML(item.rememberPoint)}</div>
      <div class="confusion-danger">⚠️ ${escapeHTML(item.dangerPoint)}</div>
    </div>`).join('');

  return `
  <div class="screen">
    <div class="header">
      <button class="btn-back" data-action="go-home">
        <span class="btn-back-arrow">←</span>戻る
      </button>
      <div class="header-title">混同ポイント整理</div>
    </div>
    <div class="confusion-body">
      <div class="confusion-intro">似た制度の違いを、左右で見比べて整理します。</div>
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
    case 'go-numbers':
      App.numbersCategory = null;
      go('numbers');
      break;
    case 'go-confusion': go('confusion'); break;
    case 'select-numbers-category':
      App.numbersCategory = el.dataset.value;
      render();
      window.scrollTo(0, 0);
      break;
    case 'back-numbers-categories':
      App.numbersCategory = null;
      render();
      window.scrollTo(0, 0);
      break;
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
    'background:#1E40AF', 'color:#fff',
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
