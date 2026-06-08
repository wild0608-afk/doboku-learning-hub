const CHAPTER_SIZE = 25;

const CHAPTER_LABELS = {
  '土工・基礎・舗装': [
    '土の性質・土工基礎・盛土・切土',
    '法面・軟弱地盤対策・土留め',
    '直接基礎・杭基礎・ケーソン基礎',
    '舗装の種類・構造・施工',
    '土工・基礎・舗装 総合',
  ],
  'コンクリート・構造物': [
    'コンクリートの材料・配合設計',
    '打設・養生・品質管理',
    '鉄筋工・型枠・支保工',
    '劣化・ひび割れ・補修・構造物全般',
    'コンクリート・構造物 総合',
  ],
  '工程・品質・施工管理': [
    '施工計画・施工体制・施工記録',
    'ネットワーク工程表・バーチャート',
    '品質管理・試験・検査',
    '環境管理・建設副産物・廃棄物',
    '工程・品質・施工管理 総合',
  ],
  '法規・安全管理': [
    '建設業法・監理技術者・施工体制台帳',
    '労働安全衛生法・特定建設作業',
    '道路法・河川法・その他関連法規',
    '足場・型枠・掘削作業の安全管理',
    '法規・安全管理 総合',
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
  KEY: 'doboku1_hub_v1',

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
        { cat: '土工・基礎・舗装',      n: 15 },
        { cat: 'コンクリート・構造物',   n: 15 },
        { cat: '工程・品質・施工管理',   n: 10 },
        { cat: '法規・安全管理',        n: 10 },
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
  const CAT_ICONS = { '土工・基礎・舗装':'⛏️', 'コンクリート・構造物':'🏗️', '工程・品質・施工管理':'📊', '法規・安全管理':'⚖️' };
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

  // 1級土木施工管理技士 第一次検定（翌年更新時はここ1行を変更。月は0始まりなので7月は6）
  const EXAM_DATE = new Date(2026, 6, 5);
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
          <span style="font-size:30px;line-height:1">🏗️</span>
        </div>
        <div class="home-hero-titles">
          <div class="home-title">1級土木施工管理 Learning Hub</div>
          <div class="home-subtitle">1級土木施工管理技士の合格を、ここから一緒に。</div>
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
    '土工・基礎・舗装': '⛏️',
    'コンクリート・構造物': '🏗️',
    '工程・品質・施工管理': '📊',
    '法規・安全管理': '⚖️',
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
    '土工・基礎・舗装': '⛏️', 'コンクリート・構造物': '🏗️',
    '工程・品質・施工管理': '📊', '法規・安全管理': '⚖️',
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
        <div class="stats-card-title">🏆 模擬試験</div>
        <div style="font-size:14px;line-height:1.85;color:var(--text-mid);margin-bottom:10px">
          4分野から50問を出題します。
        </div>
        <div class="exam-alloc-grid">
          <div class="exam-alloc-item"><span>⛏️ 土工・基礎・舗装</span><strong>15問</strong></div>
          <div class="exam-alloc-item"><span>🏗️ コンクリート・構造物</span><strong>15問</strong></div>
          <div class="exam-alloc-item"><span>📊 工程・品質・施工管理</span><strong>10問</strong></div>
          <div class="exam-alloc-item"><span>⚖️ 法規・安全管理</span><strong>10問</strong></div>
        </div>
        <div style="margin-top:10px;padding:8px 12px;background:var(--g50);border-radius:var(--r-sm);font-size:13px;color:var(--text-mid)">
          合格ライン目安：<strong style="color:var(--g700)">30点以上 / 50点満点（60%）</strong>
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
  const PASS_LINE = 30;
  const passed   = correct >= PASS_LINE;

  const EXAM_ALLOC = [
    { cat: '土工・基礎・舗装',      n: 15, icon: '⛏️' },
    { cat: 'コンクリート・構造物',   n: 15, icon: '🏗️' },
    { cat: '工程・品質・施工管理',   n: 10, icon: '📊' },
    { cat: '法規・安全管理',        n: 10, icon: '⚖️' },
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
    : `<div class="exam-pass-badge fail">📚 合格ライン未達（目安 30点以上・60%）</div>`;

  // ── review block ────────────────────────────────────────────────────
  const REVIEW_LINES = [
    { cat: '土工・基礎・舗装',      n: 15, weakLine:  9 },
    { cat: 'コンクリート・構造物',   n: 15, weakLine:  9 },
    { cat: '工程・品質・施工管理',   n: 10, weakLine:  6 },
    { cat: '法規・安全管理',        n: 10, weakLine:  6 },
  ];

  const catScores = {};
  REVIEW_LINES.forEach(({ cat }) => {
    const qIds = App.quizQuestions.filter(q => q.category === cat).map(q => q.id);
    catScores[cat] = App.sessionResults.filter(r => qIds.includes(r.qid) && r.correct).length;
  });

  const weakCats = REVIEW_LINES
    .filter(({ cat, weakLine }) => catScores[cat] <= weakLine)
    .map(({ cat }) => cat);

  const scoreLevel = correct >= 30 ? 'pass' : correct >= 25 ? 'near' : correct >= 20 ? 'work' : 'base';
  const SCORE_COMMENT = {
    pass: '合格圏です。この水準を維持しましょう。',
    near: '合格まであと少しです。弱点分野の集中強化が鍵です。',
    work: '基礎固めが必要な状態です。各分野を丁寧に見直しましょう。',
    base: '全体的な見直しが必要です。一問一問の解説を丁寧に確認しましょう。',
  };

  const nextActions = [];
  if (wrong === 0) {
    nextActions.push('全問正解です。この調子で維持しましょう。');
  } else if (weakCats.length === 0 && correct >= 35) {
    nextActions.push('苦手を残さないよう、間違えた問題だけ確認しましょう。');
  } else {
    nextActions.push('まずは間違えた問題を復習しましょう。');
  }
  if (weakCats.includes('法規・安全管理') || weakCats.includes('工程・品質・施工管理')) {
    nextActions.push('数字・期限・基準値は重要数字マップで整理すると効果的です。');
  }
  if (weakCats.includes('土工・基礎・舗装') || weakCats.includes('コンクリート・構造物')) {
    nextActions.push('似た工法・材料の違いは混同ポイント整理で確認しましょう。');
  }

  const weakTagsHtml = weakCats.length > 0
    ? `<div class="exam-review-tags">
        <span class="exam-review-tag-label">⚠️ 優先復習：</span>
        ${weakCats.map(c => `<span class="exam-review-tag">${escapeHTML(c)}</span>`).join('')}
      </div>`
    : '';

  const reviewBlock = `
  <div style="padding:0 16px 12px">
    <div class="exam-review">
      <div class="exam-review-title">📋 今回のレビュー</div>
      <div class="exam-review-comment">${SCORE_COMMENT[scoreLevel]}</div>
      ${weakTagsHtml}
      <ul class="exam-review-actions">
        ${nextActions.map(a => `<li>${escapeHTML(a)}</li>`).join('')}
      </ul>
    </div>
  </div>`;

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
    ${reviewBlock}
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
    '土工・基礎・舗装': '⛏️', 'コンクリート・構造物': '🏗️',
    '工程・品質・施工管理': '📊', '法規・安全管理': '⚖️',
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
      body: '土工・基礎・舗装／コンクリート・構造物／工程・品質・施工管理／法規・安全管理の4分野から選んで学習できます。各分野は25問ずつの章に分かれており、進捗を確認しながら進められます。',
    },
    {
      icon: '🎲',
      title: 'ランダムテスト',
      body: '全問題からランダムに10・20・30問を出題します。分野を横断した本番に近い練習ができます。',
    },
    {
      icon: '🏆',
      title: '模擬試験',
      body: '4分野から50問（土工・基礎・舗装15問・コンクリート・構造物15問・工程・品質・施工管理10問・法規・安全管理10問）を出題します。合格ライン目安は30点以上（60%）です。',
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
      body: '模試終了後に正解数・正答率・分野別の正解数を確認できます。30点以上（60%）が合格の目安です。間違えた問題はその場でまとめて復習できます。また、得点状況をもとに優先復習分野と次にやることも自動で表示されます。',
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
      icon: '🔢',
      title: '重要数字マップ',
      body: '1級土木施工管理技士試験に頻出の数値・基準・期限を分野別に整理できます。試験直前の確認や、数字が混同しやすいときに使います。分野を選んでカード形式で確認できます。',
    },
    {
      icon: '🧩',
      title: '混同ポイント整理',
      body: '似た工法・材料・制度の違いを左右比較で確認できます。知っているのに間違えやすい論点の整理に使います。',
    },
    {
      icon: '🗓️',
      title: '試験日逆算プラン',
      body: '試験日までの残り日数と未学習問題数から、1日あたりのペース目標を確認できます。苦手問題がある場合は、まず間違い復習から進めるのがおすすめです。',
    },
    {
      icon: '💡',
      title: '学習のコツ',
      body: 'まず「今日の5問」を毎日続けることが最優先です。連続学習日数を積み重ねることが合格への近道です。慣れてきたら分野別学習やランダムテストで実力を確認しましょう。',
    },
    {
      icon: '📚',
      title: '分野・章ごとに学ぶ',
      body: '分野別学習では、各分野をさらに章に分けて学習できます。特定の章を集中的に学ぶことで、苦手な単元を効率よく攻略できます。「全章」を選ぶと、その分野の全問をまとめて出題します。',
    },
    {
      icon: '🧪',
      title: 'ベータ版について',
      body: '本アプリは現在ベータ版です。社内教育用として運用しています。問題・解説の内容は随時改善・追加されます。お気づきの点があればフィードバックをお寄せください。',
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
      category: '土工・基礎・舗装',
      label: 'トラフィカビリティ（建設機械の走行性）',
      value: 'コーン指数 qc の目安は機種で異なる',
      note: '一般的な目安は、超湿地ブルドーザ200／湿地ブルドーザ300／普通ブルドーザ500／ダンプトラック1,200（kN/m²）以上。値が小さいほど軟弱で走行が困難です。',
    },
    {
      category: '土工・基礎・舗装',
      label: '盛土の締固め度',
      value: '締固め度 ≥ 90%',
      note: '締固め度 = 現場の乾燥密度 ÷ 最大乾燥密度 × 100%。路床・路体で管理基準が異なる場合があります。',
    },
    {
      category: '土工・基礎・舗装',
      label: 'アスファルト舗装 初転圧温度',
      value: '110〜140℃',
      note: '温度が下がりすぎると転圧不良になります。二次転圧は70〜90℃が目安。',
    },
    {
      category: '土工・基礎・舗装',
      label: 'アスファルト舗装 交通開放温度',
      value: '舗装表面温度 50℃以下',
      note: '舗装表面温度が50℃以下になってから交通開放します。',
    },
    {
      category: 'コンクリート・構造物',
      label: 'コンクリート 水セメント比の上限',
      value: '原則 65% 以下',
      note: '耐久性確保のための基本ルール。海洋環境など厳しい条件ではさらに低く設定します。',
    },
    {
      category: 'コンクリート・構造物',
      label: '寒中コンクリート 養生温度下限',
      value: '打込み後 5℃ 以上を保持',
      note: '5℃を下回ると初期凍害の危険があります。普通セメントでの養生期間目安は5日以上。',
    },
    {
      category: 'コンクリート・構造物',
      label: '暑中コンクリート 打込み温度上限',
      value: '打込み時 35℃ 以下',
      note: '35℃を超えるとスランプ低下・急速乾燥・強度低下のリスクが高まります。',
    },
    {
      category: 'コンクリート・構造物',
      label: 'コンクリート 1層の打込み高さ（内部振動機）',
      value: '40〜50cm 以下',
      note: '振動機の挿入間隔は40〜50cm以下、挿入時間は5〜15秒が目安です。',
    },
    {
      category: '工程・品質・施工管理',
      label: '施工体制台帳 作成義務（下請け総額）',
      value: '5,000万円以上（建築一式：8,000万円以上）',
      note: '特定建設業者が元請けとして一定金額以上を下請けに出す場合に作成義務が発生します。',
    },
    {
      category: '工程・品質・施工管理',
      label: '施工体制台帳 保存期間',
      value: '原則 5年間（住宅新築工事は10年間）',
      note: '帳簿の添付書類として原則5年間保存します。住宅を新築する建設工事に係るものは10年間保存が必要となる場合があります。',
    },
    {
      category: '工程・品質・施工管理',
      label: '産業廃棄物管理票（マニフェスト）保存期間',
      value: '5年間',
      note: '排出事業者・収集運搬業者・処分業者それぞれが5年間保存する義務があります。',
    },
    {
      category: '法規・安全管理',
      label: '足場 作業床の墜落防止（設置義務高さ）',
      value: '高さ 2m 以上の箇所',
      note: '高さ2m以上の作業床の縁には、高さ85cm以上の手すりと中さん等が必要です。',
    },
    {
      category: '法規・安全管理',
      label: '型枠支保工 計画届（設置届）の基準',
      value: '支柱高さ 3.5m 以上',
      note: '支柱高さ3.5m以上の型枠支保工は、組立開始前に労働基準監督署へ計画届が必要です。組立て等作業主任者の選任は、高さに関わらず必要です。',
    },
    {
      category: '法規・安全管理',
      label: '建設業法 主任技術者・監理技術者 専任義務',
      value: '請負金額 4,500万円以上（建築一式：9,000万円以上）',
      note: '公共性のある施設または多数の者が利用する施設の建設工事が対象。専任の技術者が必要です。',
    },
    {
      category: '法規・安全管理',
      label: '特定建設作業 騒音規制 作業時間',
      value: '区域・時間帯に規制あり（深夜は原則禁止）',
      note: '指定地域内の特定建設作業は、作業時間帯・1日の作業時間・連続日数・休日作業に制限があり、区域（第1号・第2号）で基準が異なります。具体値は条例等で確認します。',
    },
    {
      category: '法規・安全管理',
      label: '掘削作業 地山の掘削面の高さと勾配（岩盤・堅固な地盤）',
      value: '高さ 5m 未満：勾配 90° 以下',
      note: '地盤の種類・掘削高さによって許容勾配が異なります。軟岩などは別基準があります。',
    },
  ];

  const ORDER = ['土工・基礎・舗装', 'コンクリート・構造物', '工程・品質・施工管理', '法規・安全管理'];
  const CAT_ICONS = { '土工・基礎・舗装': '⛏️', 'コンクリート・構造物': '🏗️', '工程・品質・施工管理': '📊', '法規・安全管理': '⚖️' };

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
        <div class="numbers-intro">1級土木施工管理技士試験に頻出の数値・基準・期限を整理します。</div>
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
      category: '土工・基礎・舗装',
      title: '盛土管理 vs 切土管理',
      leftLabel: '盛土',
      rightLabel: '切土',
      leftBody: '材料の品質・含水比の管理が重要\n締固め度の確認（≥90%が目安）\n軟弱地盤では地盤改良が必要',
      rightBody: '法面の安定勾配の確保が重要\n排水処理（切土面の雨水流出対策）\n地質に基づく勾配設定',
      rememberPoint: '盛土は「締固め管理」、切土は「法面安定・排水管理」が主眼。',
      dangerPoint: '締固め度の管理基準と切土法面勾配の許容値を混同しないこと。',
    },
    {
      category: 'コンクリート・構造物',
      title: '寒中コンクリート vs 暑中コンクリート',
      leftLabel: '寒中コンクリート',
      rightLabel: '暑中コンクリート',
      leftBody: '打込み後 5℃ 以上を保持\n初期凍害の防止が目的\n養生期間を延長する（普通セメント5日以上）',
      rightBody: '打込み時 35℃ 以下に抑制\nスランプ低下・急速乾燥の防止\n打込み後の急激な乾燥防止養生',
      rememberPoint: '寒中は「温度を上げる管理（5℃以上）」、暑中は「温度を下げる管理（35℃以下）」。',
      dangerPoint: '養生温度の目標値（5℃・35℃）を逆にしないこと。',
    },
    {
      category: 'コンクリート・構造物',
      title: 'PCコンクリート vs RCコンクリート',
      leftLabel: 'PCコンクリート',
      rightLabel: 'RCコンクリート',
      leftBody: 'PC鋼材に緊張力を与える\n引張応力を打ち消してひび割れを防ぐ\n長スパン・薄型断面が可能',
      rightBody: '鉄筋がコンクリートの引張力を負担\n設計・施工が比較的シンプル\n一般的な構造物に広く使用',
      rememberPoint: 'PCは「事前にプレストレス（圧縮力）を与える」、RCは「鉄筋で引張を負担」。',
      dangerPoint: 'PC鋼材の緊張管理（プレテンション・ポストテンション）の違いを混同しないこと。',
    },
    {
      category: '工程・品質・施工管理',
      title: 'バーチャート vs ネットワーク工程表',
      leftLabel: 'バーチャート',
      rightLabel: 'ネットワーク工程表',
      leftBody: '横軸に時間、縦軸に工種を記載\n視覚的に分かりやすく進捗管理が容易\nクリティカルパスの把握には不向き',
      rightBody: 'イベント（丸）と作業（矢印）で表現\nクリティカルパスの特定が可能\nフロートの計算で余裕時間を把握できる',
      rememberPoint: 'バーチャートは「見やすさ」、ネットワークは「クリティカルパス分析」に強み。',
      dangerPoint: 'フリーフロートとトータルフロートの違いを混同しないこと（前者は後続に影響しない余裕）。',
    },
    {
      category: '工程・品質・施工管理',
      title: '全数検査 vs 抜取検査',
      leftLabel: '全数検査',
      rightLabel: '抜取検査',
      leftBody: 'すべての製品を検査する\n不良の見逃しが少ない\n破壊検査や多量・多項目には不向き',
      rightBody: 'ロットから一部を抜き取って検査\nロット単位で合否を判定する\n破壊検査・多量品に適する（一定の不良混入を前提）',
      rememberPoint: '全数は「1個でも不良が許されない」とき、抜取は「破壊検査・多量品をロットで判定」するとき。',
      dangerPoint: '抜取検査は不良ゼロを保証しない点に注意。重大な欠点は全数検査を選ぶ。',
    },
    {
      category: '工程・品質・施工管理',
      title: 'ヒストグラム vs 管理図',
      leftLabel: 'ヒストグラム',
      rightLabel: '管理図',
      leftBody: 'データのばらつき（分布）を柱状で表す\nある時点の全体の姿を見る（静的）\n規格値との関係で工程の良否を判断',
      rightBody: '時間の経過に沿って点を打つ\n工程が安定しているかを見る（動的）\n管理限界線の外れや「くせ」で異常を判断',
      rememberPoint: 'ヒストグラムは「分布のかたち」、管理図は「時間的な安定・異常」を見る。',
      dangerPoint: '時間変化の異常検出は管理図の役割。ヒストグラムと取り違えないこと。',
    },
    {
      category: '法規・安全管理',
      title: '主任技術者 vs 監理技術者',
      leftLabel: '主任技術者',
      rightLabel: '監理技術者',
      leftBody: 'すべての建設工事で配置義務あり\n下請け契約金額に関わらず必要\n一般建設業者も配置する',
      rightBody: '特定建設業者が元請けの場合に配置\n下請け総額が一定金額以上の場合\n監理技術者資格証が必要',
      rememberPoint: '主任技術者はすべての工事、監理技術者は大規模工事の元請けに必要。',
      dangerPoint: '専任義務の発生する請負金額の基準（4,500万円・9,000万円）を混同しないこと。',
    },
    {
      category: '法規・安全管理',
      title: '特定建設業 vs 一般建設業',
      leftLabel: '特定建設業',
      rightLabel: '一般建設業',
      leftBody: '元請けとして5,000万円以上を下請けに出す場合（建築工事業は8,000万円以上）\n財産的基礎の要件が厳しい\n監理技術者の設置義務あり',
      rightBody: '特定建設業以外のすべての建設業者\n財産的基礎の要件が緩い\n主任技術者の設置義務（全工事）',
      rememberPoint: '特定建設業は「大きな下請け発注をする元請け向け」の許可区分。',
      dangerPoint: '許可区分の違いと施工体制台帳の作成義務の発生要件を混同しないこと。',
    },
  ];

  const ORDER = ['土工・基礎・舗装', 'コンクリート・構造物', '工程・品質・施工管理', '法規・安全管理'];

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
      <div class="confusion-intro">似た工法・材料・制度の違いを、左右で見比べて整理します。</div>
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
