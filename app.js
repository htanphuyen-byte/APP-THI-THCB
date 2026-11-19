// App State & Logic for "Ôn Thi Trắc Nghiệm Tin Học - 10 Bộ Đề Cố Định"

const app = {
  db: null,
  progress: {
    setStats: {},         // { [setId]: { attempts: 0, bestScore10: 0, lastScore10: 0, lastCorrect: 0, total: 40 } }
    wrongQuestionIds: [], // array of question IDs user got wrong
    inProgressSessions: {}, // { [setId]: { questionIds, currentIndex, userAnswers, updatedAt } }
    lastActiveSetId: null
  },

  // Active Quiz Session
  activeSet: null,
  quizQuestions: [],     // Shuffled list of questions for current session
  currentIndex: 0,
  userAnswers: {},       // { [index]: { selectedLetter, isCorrect, displayedOptions } }
  shuffleOptions: false,
  resultFilter: 'all',

  async init() {
    await this.loadDatabase();
    await this.loadProgress();
    this.setupKeyboardShortcuts();
    this.populateBankSetFilter();

    document.getElementById('btn-home-logo').addEventListener('click', () => {
      this.showDashboard();
    });

    const chkOpt = document.getElementById('chk-shuffle-options');
    chkOpt.checked = localStorage.getItem('tn_shuffle_options') === 'true';
    this.shuffleOptions = chkOpt.checked;
    chkOpt.addEventListener('change', (e) => {
      this.shuffleOptions = e.target.checked;
      localStorage.setItem('tn_shuffle_options', String(this.shuffleOptions));
    });

    // If user was right in the middle of a quiz when they refreshed or accidentally closed the tab, restore it immediately!
    if (this.progress.lastActiveSetId && this.progress.inProgressSessions[this.progress.lastActiveSetId]) {
      this.resumeSavedSession(this.progress.lastActiveSetId);
    } else {
      this.renderDashboard();
    }
  },

  async loadDatabase() {
    try {
      const res = await fetch('./questions_db.json');
      if (res.ok) {
        this.db = await res.json();
        return;
      }
      throw new Error('Static fetch failed');
    } catch (err) {
      const res = await fetch('/api/db');
      this.db = await res.json();
    }
  },

  async loadProgress() {
    try {
      const local = localStorage.getItem('tn_user_progress');
      if (local) {
        this.progress = JSON.parse(local);
      } else {
        const res = await fetch('/api/progress');
        if (res.ok) {
          const serverProg = await res.json();
          if (serverProg && serverProg.setStats && Object.keys(serverProg.setStats).length > 0) {
            this.progress = serverProg;
            localStorage.setItem('tn_user_progress', JSON.stringify(this.progress));
          }
        }
      }
    } catch (e) {
      // Ignore offline error
    }
    if (!this.progress.setStats) this.progress.setStats = {};
    if (!Array.isArray(this.progress.wrongQuestionIds)) this.progress.wrongQuestionIds = [];
    if (!this.progress.inProgressSessions) this.progress.inProgressSessions = {};
    this.updateHeaderBadges();
  },

  async saveProgress() {
    localStorage.setItem('tn_user_progress', JSON.stringify(this.progress));
    this.updateHeaderBadges();
    try {
      await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.progress)
      });
    } catch (e) {
      // Ignore if static host
    }
  },

  // Save current active quiz session state so refreshing or closing tab never loses progress!
  saveCurrentQuizSession() {
    if (!this.activeSet || !this.quizQuestions || this.quizQuestions.length === 0) return;
    const setId = this.activeSet.id;
    this.progress.inProgressSessions[setId] = {
      setMeta: {
        id: this.activeSet.id,
        number: this.activeSet.number,
        title: this.activeSet.title,
        badge: this.activeSet.badge
      },
      questionIds: this.quizQuestions.map(q => q.id),
      currentIndex: this.currentIndex,
      userAnswers: this.userAnswers,
      updatedAt: Date.now()
    };
    this.progress.lastActiveSetId = setId;
    this.saveProgress();
  },

  clearSavedQuizSession(setId) {
    if (setId && this.progress.inProgressSessions && this.progress.inProgressSessions[setId]) {
      delete this.progress.inProgressSessions[setId];
    }
    if (this.progress.lastActiveSetId === setId) {
      this.progress.lastActiveSetId = null;
    }
    this.saveProgress();
  },

  resumeSavedSession(setId) {
    const saved = this.progress.inProgressSessions[setId];
    if (!saved || !saved.questionIds || saved.questionIds.length === 0) {
      this.showDashboard();
      return;
    }

    const foundSet = this.db.sets.find(s => s.id === setId) || saved.setMeta;
    if (!foundSet) {
      this.showDashboard();
      return;
    }

    this.activeSet = foundSet;
    this.quizQuestions = saved.questionIds.map(id => this.db.questions[id]).filter(Boolean);
    this.currentIndex = Math.min(saved.currentIndex || 0, this.quizQuestions.length - 1);
    this.userAnswers = saved.userAnswers || {};
    this.progress.lastActiveSetId = setId;
    this.saveProgress();

    this.openQuizView();
  },

  updateHeaderBadges() {
    const wrongBadge = document.getElementById('wrong-count-badge');
    if (wrongBadge) {
      wrongBadge.textContent = this.progress.wrongQuestionIds.length;
    }

    const stats = Object.values(this.progress.setStats);
    const completedCount = stats.filter(s => s.attempts > 0).length;
    const elCompleted = document.getElementById('stat-completed-sets');
    if (elCompleted) elCompleted.textContent = `${completedCount}/10`;

    const elAvg = document.getElementById('stat-avg-score');
    if (elAvg) {
      if (completedCount === 0) {
        elAvg.textContent = '--';
      } else {
        const sum = stats.reduce((acc, s) => acc + (s.bestScore10 || 0), 0);
        elAvg.textContent = (sum / completedCount).toFixed(1);
      }
    }
  },

  // Fisher-Yates shuffle
  shuffleArray(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  },

  setActiveNav(navId) {
    ['nav-sets', 'nav-wrong', 'nav-bank'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('active', id === navId);
    });
  },

  switchView(viewId) {
    ['view-dashboard', 'view-quiz', 'view-result', 'view-bank'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('hidden', id !== viewId);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  showDashboard() {
    // User explicitly returned to dashboard, so don't force auto-redirect on reload,
    // but keep their inProgressSessions[setId] intact so they can click "Tiếp tục làm" anytime!
    this.progress.lastActiveSetId = null;
    this.saveProgress();
    this.setActiveNav('nav-sets');
    this.renderDashboard();
    this.switchView('view-dashboard');
  },

  renderDashboard() {
    this.updateHeaderBadges();
    const grid = document.getElementById('sets-grid');
    if (!grid || !this.db) return;

    grid.innerHTML = this.db.sets.map(set => {
      const st = this.progress.setStats[set.id];
      const savedSession = this.progress.inProgressSessions && this.progress.inProgressSessions[set.id];
      const questions = set.questionIds.map(id => this.db.questions[id]).filter(Boolean);

      // Count how many questions answered in saved session
      let answeredInSession = 0;
      if (savedSession && savedSession.userAnswers) {
        answeredInSession = Object.values(savedSession.userAnswers).filter(a => a && a.answered).length;
      }
      const hasResume = savedSession && answeredInSession > 0 && answeredInSession < set.questionIds.length;

      // Count topics inside this fixed set
      const topicCounts = {};
      questions.forEach(q => {
        topicCounts[q.topic] = (topicCounts[q.topic] || 0) + 1;
      });

      const topicChipsHtml = Object.entries(topicCounts)
        .map(([topic, cnt]) => `<span class="topic-chip">${topic}: <b>${cnt}</b></span>`)
        .join('');

      let statsHtml = `
        <span>Chưa làm lần nào</span>
        <span><strong>${set.questionIds.length} câu cố định</strong></span>
      `;
      if (st && st.attempts > 0) {
        statsHtml = `
          <span>Đã luyện: <strong>${st.attempts} lần</strong></span>
          <span>Cao nhất: <strong style="color: var(--success)">${st.bestScore10.toFixed(1)}/10</strong> (${st.bestCorrect}/${st.total} câu)</span>
        `;
      }
      if (hasResume) {
        statsHtml = `
          <span style="color: var(--warning); font-weight: 700;">⏳ Đang làm dở: ${answeredInSession}/${set.questionIds.length} câu</span>
          <span>${st && st.attempts > 0 ? `Cao nhất: <b>${st.bestScore10.toFixed(1)}/10</b>` : `<strong>${set.questionIds.length} câu</strong>`}</span>
        `;
      }

      const actionsHtml = hasResume
        ? `
          <button class="btn-start-set" style="background: var(--success);" onclick="app.resumeSavedSession('${set.id}')" title="Làm tiếp từ câu ${answeredInSession + 1} đang làm dở">
            ▶️ Làm Tiếp (${answeredInSession}/${set.questionIds.length})
          </button>
          <button class="btn-preview-set" onclick="app.startFixedSet('${set.id}', true)" title="Xáo lại câu hỏi và làm mới từ câu 1">
            🔀 Làm Mới
          </button>
          <button class="btn-preview-set" onclick="app.openSetPreview('${set.id}')" title="Xem danh sách 40 câu cố định của đề này">
            👁️
          </button>
        `
        : `
          <button class="btn-start-set" onclick="app.startFixedSet('${set.id}')">
            🔀 Vào Làm Đề (Xáo Câu)
          </button>
          <button class="btn-preview-set" onclick="app.openSetPreview('${set.id}')" title="Xem danh sách 40 câu cố định của đề này">
            👁️ Xem Đề
          </button>
        `;

      return `
        <article class="set-card">
          <div class="set-card-top">
            <div class="set-badges-row">
              <span class="set-num-badge ${set.color}">📌 Đề số ${set.number} • ${set.badge}</span>
              <span class="set-fixed-tag">🔒 Cố định ${set.questionIds.length} câu</span>
            </div>
            <h4 class="set-title">${set.title}</h4>
            <p class="set-subtitle">${set.subtitle}</p>
            <div class="set-topic-chips">${topicChipsHtml}</div>
          </div>

          <div>
            <div class="set-stats-bar">${statsHtml}</div>
            <div class="set-card-actions">
              ${actionsHtml}
            </div>
          </div>
        </article>
      `;
    }).join('');
  },

  // Start one of the 10 fixed exam sets
  // Always keeps the exact fixed question set of that exam, and shuffles question order every time user clicks!
  startFixedSet(setId, confirmResetIfInProgress = false) {
    const foundSet = this.db.sets.find(s => s.id === setId);
    if (!foundSet) return;

    if (confirmResetIfInProgress) {
      const saved = this.progress.inProgressSessions[setId];
      const answeredCount = saved && saved.userAnswers
        ? Object.values(saved.userAnswers).filter(a => a && a.answered).length
        : 0;
      if (answeredCount > 0) {
        if (!confirm(`Bạn đang làm dở ${answeredCount}/${foundSet.questionIds.length} câu ở đề này. Bạn có muốn xáo câu làm mới lại từ câu 1 không?`)) {
          return;
        }
      }
    }

    this.closeSetPreview();
    this.activeSet = foundSet;

    // Fetch exact fixed questions of this exam set, then shuffle their order!
    const fixedQuestions = foundSet.questionIds
      .map(id => this.db.questions[id])
      .filter(Boolean);

    this.quizQuestions = this.shuffleArray(fixedQuestions);
    this.currentIndex = 0;
    this.userAnswers = {};

    this.saveCurrentQuizSession();
    this.openQuizView();
  },

  // Start custom quiz for wrong questions
  startWrongReview() {
    const wrongIds = this.progress.wrongQuestionIds;
    if (!wrongIds || wrongIds.length === 0) {
      alert('🎉 Tuyệt vời! Hiện tại bạn chưa có câu trả lời sai nào cần ôn lại. Hãy chọn 1 trong 10 bộ đề để bắt đầu luyện tập nhé!');
      return;
    }

    const questions = wrongIds.map(id => this.db.questions[id]).filter(Boolean);
    this.activeSet = {
      id: 'wrong_review',
      number: '🔥',
      title: `Ôn Tập Các Câu Hay Sai (${questions.length} câu)`,
      badge: 'Ôn Câu Sai'
    };

    this.quizQuestions = this.shuffleArray(questions);
    this.currentIndex = 0;
    this.userAnswers = {};
    this.saveCurrentQuizSession();
    this.setActiveNav('nav-wrong');
    this.openQuizView();
  },

  openQuizView() {
    document.getElementById('quiz-set-badge').textContent = this.activeSet.badge || `Bộ Đề ${this.activeSet.number}`;
    document.getElementById('quiz-set-title').textContent = this.activeSet.title;
    document.getElementById('q-total-num').textContent = this.quizQuestions.length;

    this.switchView('view-quiz');
    this.renderCurrentQuestion();
  },

  getDisplayedOptionsForIndex(index, q) {
    if (this.userAnswers[index] && this.userAnswers[index].displayedOptions) {
      return this.userAnswers[index].displayedOptions;
    }
    const letters = ['A', 'B', 'C', 'D'];
    let items = letters.map(origLetter => ({
      origLetter,
      text: q.options[origLetter]
    }));

    if (this.shuffleOptions) {
      items = this.shuffleArray(items);
    }

    // Assign display letters A, B, C, D
    const displayed = items.map((item, idx) => ({
      displayLetter: letters[idx],
      origLetter: item.origLetter,
      text: item.text
    }));

    if (!this.userAnswers[index]) {
      this.userAnswers[index] = {
        answered: false,
        selectedDisplayLetter: null,
        selectedOrigLetter: null,
        isCorrect: false,
        displayedOptions: displayed
      };
    } else {
      this.userAnswers[index].displayedOptions = displayed;
    }

    return displayed;
  },

  renderCurrentQuestion() {
    const q = this.quizQuestions[this.currentIndex];
    if (!q) return;

    const total = this.quizQuestions.length;
    const displayedOptions = this.getDisplayedOptionsForIndex(this.currentIndex, q);
    const ansState = this.userAnswers[this.currentIndex];

    // Update top counters
    document.getElementById('q-current-num').textContent = this.currentIndex + 1;
    const pct = ((this.currentIndex + 1) / total) * 100;
    document.getElementById('quiz-progress-fill').style.width = `${pct}%`;

    this.updateLiveScoreCounters();
    this.renderQuestionDots();

    // Update Question header & text
    document.getElementById('q-topic-tag').textContent = `📌 Chủ đề: ${q.topic}`;
    document.getElementById('q-source-tag').textContent = `Nguồn đề gốc: ${q.source} • Câu ${q.num}`;
    document.getElementById('q-text').textContent = `Câu ${this.currentIndex + 1}: ${q.question}`;

    // Optional Image
    const imgWrap = document.getElementById('q-image-wrap');
    const imgEl = document.getElementById('q-image');
    if (q.image) {
      imgEl.src = q.image.startsWith('/') ? `.${q.image}` : q.image;
      imgWrap.classList.remove('hidden');
    } else {
      imgEl.src = '';
      imgWrap.classList.add('hidden');
    }

    // Render 4 options
    const optContainer = document.getElementById('options-container');
    optContainer.innerHTML = displayedOptions.map(opt => {
      let btnClass = 'option-btn';
      let statusTagHtml = '';

      if (ansState && ansState.answered) {
        btnClass += ' disabled';
        const isThisCorrect = opt.origLetter === q.answer;
        const isThisSelected = opt.displayLetter === ansState.selectedDisplayLetter;

        if (isThisCorrect) {
          btnClass += ' is-correct';
          statusTagHtml = `<span class="option-status-tag" style="background:#dcfce7;color:#15803d;">✓ Đáp án đúng</span>`;
        } else if (isThisSelected && !isThisCorrect) {
          btnClass += ' is-wrong';
          statusTagHtml = `<span class="option-status-tag" style="background:#fee2e2;color:#b91c1c;">✗ Bạn đã chọn</span>`;
        }
      }

      return `
        <button
          class="${btnClass}"
          onclick="app.selectOption('${opt.displayLetter}')"
          ${ansState && ansState.answered ? 'disabled' : ''}
        >
          <span class="option-letter">${opt.displayLetter}</span>
          <span class="option-content">${this.escapeHtml(opt.text)}</span>
          ${statusTagHtml}
        </button>
      `;
    }).join('');

    // Render Explanation Box if answered
    const expBox = document.getElementById('explanation-box');
    const btnNext = document.getElementById('btn-next-q');
    const btnPrev = document.getElementById('btn-prev-q');
    const hintText = document.getElementById('quiz-hint-text');

    btnPrev.disabled = this.currentIndex === 0;

    if (ansState && ansState.answered) {
      const correctOpt = displayedOptions.find(o => o.origLetter === q.answer);
      expBox.classList.remove('hidden', 'exp-correct', 'exp-wrong');
      expBox.classList.add(ansState.isCorrect ? 'exp-correct' : 'exp-wrong');

      document.getElementById('exp-icon').textContent = ansState.isCorrect ? '✅' : '❌';
      const statusTitle = document.getElementById('exp-status-title');
      if (ansState.isCorrect) {
        statusTitle.textContent = 'Chính xác! Bạn đã chọn đúng đáp án.';
        statusTitle.style.color = '#15803d';
      } else {
        statusTitle.textContent = `Chưa chính xác! Bạn đã chọn ${ansState.selectedDisplayLetter}.`;
        statusTitle.style.color = '#b91c1c';
      }

      document.getElementById('exp-correct-answer-line').innerHTML =
        `Đáp án đúng là: <strong>${correctOpt.displayLetter}. ${this.escapeHtml(correctOpt.text)}</strong>`;
      document.getElementById('exp-text').textContent = q.explanation;

      // Enable Next button ONLY after current question is answered!
      btnNext.disabled = false;
      btnNext.textContent = (this.currentIndex === total - 1)
        ? '🏁 Hoàn thành & Xem kết quả →'
        : 'Câu tiếp theo (Enter) →';
      hintText.innerHTML = '✨ Đã lưu tự động! Nhấn <b>Câu tiếp theo</b> hoặc phím <b>Enter / Mũi tên phải</b> để qua câu mới.';
    } else {
      expBox.classList.add('hidden');
      // Strictly enforce: must finish current question before moving to a new one
      btnNext.disabled = true;
      btnNext.textContent = (this.currentIndex === total - 1)
        ? '🔒 Chọn đáp án để hoàn thành'
        : '🔒 Chọn đáp án để qua câu mới →';
      hintText.innerHTML = '💡 Hãy tick chọn 1 đáp án (hoặc nhấn phím <b>A, B, C, D</b>) để xem giải thích lý thuyết';
    }
  },

  selectOption(displayLetter) {
    const ansState = this.userAnswers[this.currentIndex];
    if (!ansState || ansState.answered) return;

    const q = this.quizQuestions[this.currentIndex];
    const chosenOpt = ansState.displayedOptions.find(o => o.displayLetter === displayLetter);
    if (!chosenOpt) return;

    const isCorrect = chosenOpt.origLetter === q.answer;
    ansState.answered = true;
    ansState.selectedDisplayLetter = displayLetter;
    ansState.selectedOrigLetter = chosenOpt.origLetter;
    ansState.isCorrect = isCorrect;

    // Update wrongQuestions list
    const wrongIdx = this.progress.wrongQuestionIds.indexOf(q.id);
    if (!isCorrect && wrongIdx === -1) {
      this.progress.wrongQuestionIds.push(q.id);
    } else if (isCorrect && this.activeSet && this.activeSet.id === 'wrong_review' && wrongIdx !== -1) {
      // Remove from wrong list if mastered in Wrong Review mode
      this.progress.wrongQuestionIds.splice(wrongIdx, 1);
    }

    this.saveCurrentQuizSession();
    this.renderCurrentQuestion();
  },

  nextQuestion() {
    const ansState = this.userAnswers[this.currentIndex];
    if (!ansState || !ansState.answered) {
      return; // Must complete current question before advancing
    }

    if (this.currentIndex < this.quizQuestions.length - 1) {
      this.currentIndex++;
      this.saveCurrentQuizSession();
      this.renderCurrentQuestion();
    } else {
      this.finishQuiz();
    }
  },

  prevQuestion() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.saveCurrentQuizSession();
      this.renderCurrentQuestion();
    }
  },

  jumpToQuestion(targetIndex) {
    // User can jump to any already-answered question, or the first unanswered question
    // Cannot skip past an unanswered question!
    let firstUnanswered = 0;
    while (
      firstUnanswered < this.quizQuestions.length &&
      this.userAnswers[firstUnanswered] &&
      this.userAnswers[firstUnanswered].answered
    ) {
      firstUnanswered++;
    }

    if (targetIndex <= firstUnanswered && targetIndex < this.quizQuestions.length) {
      this.currentIndex = targetIndex;
      this.saveCurrentQuizSession();
      this.renderCurrentQuestion();
    }
  },

  renderQuestionDots() {
    const dotsWrap = document.getElementById('question-dots');
    if (!dotsWrap) return;

    let firstUnanswered = 0;
    while (
      firstUnanswered < this.quizQuestions.length &&
      this.userAnswers[firstUnanswered] &&
      this.userAnswers[firstUnanswered].answered
    ) {
      firstUnanswered++;
    }

    dotsWrap.innerHTML = this.quizQuestions.map((q, idx) => {
      const st = this.userAnswers[idx];
      let cls = 'q-dot';
      if (idx === this.currentIndex) cls += ' current';
      if (st && st.answered) {
        cls += st.isCorrect ? ' answered-correct' : ' answered-wrong';
      } else if (idx > firstUnanswered) {
        cls += ' locked';
      }
      const title = (idx > firstUnanswered)
        ? `Hãy hoàn thành câu ${firstUnanswered + 1} trước khi chuyển sang câu ${idx + 1}`
        : `Câu ${idx + 1}`;
      return `<button class="${cls}" onclick="app.jumpToQuestion(${idx})" title="${title}">${idx + 1}</button>`;
    }).join('');
  },

  updateLiveScoreCounters() {
    const total = this.quizQuestions.length;
    let correct = 0;
    let wrong = 0;
    Object.values(this.userAnswers).forEach(a => {
      if (a && a.answered) {
        if (a.isCorrect) correct++;
        else wrong++;
      }
    });

    const score10 = total > 0 ? ((correct / total) * 10).toFixed(1) : '0.0';
    document.getElementById('count-correct').textContent = correct;
    document.getElementById('count-wrong').textContent = wrong;
    document.getElementById('live-score').textContent = score10;
  },

  finishQuiz() {
    const total = this.quizQuestions.length;
    let correct = 0;
    let wrong = 0;
    Object.values(this.userAnswers).forEach(a => {
      if (a && a.answered) {
        if (a.isCorrect) correct++;
        else wrong++;
      }
    });

    const score10 = total > 0 ? Number(((correct / total) * 10).toFixed(2)) : 0;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

    // Clear in-progress session for this set because it's now completed!
    if (this.activeSet) {
      this.clearSavedQuizSession(this.activeSet.id);
    }

    // Save set stats if this is one of the 10 fixed sets
    if (this.activeSet && this.activeSet.id.startsWith('de_')) {
      const prev = this.progress.setStats[this.activeSet.id] || {
        attempts: 0,
        bestScore10: 0,
        bestCorrect: 0,
        total
      };
      const isBetter = score10 >= (prev.bestScore10 || 0);
      this.progress.setStats[this.activeSet.id] = {
        attempts: (prev.attempts || 0) + 1,
        bestScore10: isBetter ? score10 : prev.bestScore10,
        bestCorrect: isBetter ? correct : (prev.bestCorrect || correct),
        lastScore10: score10,
        lastCorrect: correct,
        total
      };
      this.saveProgress();
    }

    // Populate Result View
    document.getElementById('res-set-name').textContent = this.activeSet.title;
    document.getElementById('res-score-10').textContent = score10.toFixed(1);
    document.getElementById('res-correct').textContent = `${correct}/${total}`;
    document.getElementById('res-wrong').textContent = wrong;
    document.getElementById('res-accuracy').textContent = `${accuracy}%`;

    const emojiEl = document.getElementById('res-emoji');
    const titleEl = document.getElementById('res-title');
    if (score10 >= 9) {
      emojiEl.textContent = '🏆';
      titleEl.textContent = 'Xuất Sắc! Bạn Nắm Rất Chắc Kiến Thức!';
    } else if (score10 >= 7) {
      emojiEl.textContent = '🎉';
      titleEl.textContent = 'Khá Tốt! Chỉ Cần Ôn Thêm Vài Câu Sai!';
    } else if (score10 >= 5) {
      emojiEl.textContent = '💪';
      titleEl.textContent = 'Đạt Yêu Cầu! Hãy Xem Kỹ Giải Thích Bên Dưới Nhé!';
    } else {
      emojiEl.textContent = '📚';
      titleEl.textContent = 'Cần Cố Gắng Thêm! Hãy Luyện Lại Đề Này Nhé!';
    }

    const btnRetryWrong = document.getElementById('btn-retry-wrong-in-set');
    document.getElementById('res-wrong-btn-count').textContent = wrong;
    btnRetryWrong.style.display = wrong > 0 ? 'inline-flex' : 'none';

    this.resultFilter = 'all';
    this.renderResultReviewList();
    this.switchView('view-result');
  },

  filterResultReview(filterType) {
    this.resultFilter = filterType;
    ['flt-all', 'flt-wrong', 'flt-correct'].forEach(id => {
      document.getElementById(id).classList.toggle('active', id === `flt-${filterType}`);
    });
    this.renderResultReviewList();
  },

  renderResultReviewList() {
    const container = document.getElementById('result-review-container');
    if (!container) return;

    const itemsHtml = this.quizQuestions.map((q, idx) => {
      const ans = this.userAnswers[idx];
      const isCorrect = ans && ans.isCorrect;

      if (this.resultFilter === 'wrong' && isCorrect) return '';
      if (this.resultFilter === 'correct' && !isCorrect) return '';

      const displayedOpts = (ans && ans.displayedOptions) || ['A', 'B', 'C', 'D'].map(l => ({
        displayLetter: l,
        origLetter: l,
        text: q.options[l]
      }));

      const optsHtml = displayedOpts.map(opt => {
        const isRight = opt.origLetter === q.answer;
        const isUserWrong = ans && ans.selectedDisplayLetter === opt.displayLetter && !isRight;
        let cls = 'ri-opt';
        if (isRight) cls += ' opt-correct';
        else if (isUserWrong) cls += ' opt-user-wrong';

        return `<div class="${cls}">
          <b>${opt.displayLetter}.</b> ${this.escapeHtml(opt.text)}
          ${isRight ? ' ✓ (Đáp án đúng)' : ''}
          ${isUserWrong ? ' ✗ (Bạn chọn)' : ''}
        </div>`;
      }).join('');

      return `
        <div class="review-item ${isCorrect ? 'item-correct' : 'item-wrong'}">
          <div class="ri-top">
            <span class="q-topic-tag">${isCorrect ? '✅ Đúng' : '❌ Sai'} • Câu ${idx + 1} (${q.topic})</span>
            <span class="q-source-tag">Nguồn: ${q.source} - Câu ${q.num}</span>
          </div>
          <div class="ri-qtitle">${this.escapeHtml(q.question)}</div>
          ${q.image ? `<div class="q-image-wrap"><img src="${q.image.startsWith('/') ? '.' + q.image : q.image}" alt="Hình minh họa" /></div>` : ''}
          <div class="ri-options">${optsHtml}</div>
          <div class="ri-exp"><strong>📘 Giải thích lý thuyết:</strong> ${this.escapeHtml(q.explanation)}</div>
        </div>
      `;
    }).filter(Boolean).join('');

    container.innerHTML = itemsHtml || `<div class="review-item">Không có câu hỏi nào trong mục lọc này.</div>`;
  },

  restartCurrentQuiz(reshuffle = true) {
    if (!this.activeSet) return;
    if (this.activeSet.id.startsWith('de_')) {
      this.startFixedSet(this.activeSet.id, false);
    } else {
      if (reshuffle) {
        this.quizQuestions = this.shuffleArray(this.quizQuestions);
      }
      this.currentIndex = 0;
      this.userAnswers = {};
      this.saveCurrentQuizSession();
      this.openQuizView();
    }
  },

  retryWrongInCurrentSet() {
    const wrongQuestions = this.quizQuestions.filter((q, idx) => {
      const a = this.userAnswers[idx];
      return a && !a.isCorrect;
    });
    if (wrongQuestions.length === 0) return;

    this.activeSet = {
      id: 'retry_wrong_subset',
      number: '🔥',
      title: `Làm Lại ${wrongQuestions.length} Câu Vừa Sai (${this.activeSet.title})`,
      badge: 'Luyện Câu Sai'
    };
    this.quizQuestions = this.shuffleArray(wrongQuestions);
    this.currentIndex = 0;
    this.userAnswers = {};
    this.saveCurrentQuizSession();
    this.openQuizView();
  },

  confirmExitQuiz() {
    // Save current state before returning to dashboard so user can resume anytime!
    this.saveCurrentQuizSession();
    this.showDashboard();
  },

  // Modal Preview Fixed Set
  openSetPreview(setId) {
    const set = this.db.sets.find(s => s.id === setId);
    if (!set) return;

    document.getElementById('preview-set-badge').textContent = `Đề số ${set.number} • ${set.badge}`;
    document.getElementById('preview-set-title').textContent = set.title;

    const btnStart = document.getElementById('preview-start-btn');
    btnStart.onclick = () => this.startFixedSet(set.id);

    const listEl = document.getElementById('preview-questions-list');
    listEl.innerHTML = set.questionIds.map((qid, idx) => {
      const q = this.db.questions[qid];
      if (!q) return '';
      return `
        <div class="preview-q-row">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:0.78rem;color:var(--text-muted);">
            <span><b>Câu cố định #${idx + 1}</b> • Chủ đề: ${q.topic}</span>
            <span>Nguồn gốc: ${q.source} (Câu ${q.num})</span>
          </div>
          <div style="font-weight:700;margin-bottom:6px;">${this.escapeHtml(q.question)}</div>
          <div style="font-size:0.83rem;color:var(--success);font-weight:600;">
            ✓ Đáp án đúng: ${q.answer}. ${this.escapeHtml(q.options[q.answer])}
          </div>
        </div>
      `;
    }).join('');

    document.getElementById('modal-set-preview').classList.remove('hidden');
  },

  closeSetPreview() {
    document.getElementById('modal-set-preview').classList.add('hidden');
  },

  // Question Bank View (All 120 questions)
  populateBankSetFilter() {
    const sel = document.getElementById('bank-set-filter');
    if (!sel || !this.db) return;

    const setOptions = this.db.sets.map(s =>
      `<option value="${s.id}">📌 ${s.title} (${s.questionIds.length} câu cố định)</option>`
    ).join('');

    sel.innerHTML = `
      <option value="all">Tất cả 120 câu gốc (Ca 1 + Ca 2 + Ca 3)</option>
      ${setOptions}
    `;
  },

  showQuestionBank() {
    this.progress.lastActiveSetId = null;
    this.saveProgress();
    this.setActiveNav('nav-bank');
    this.renderQuestionBank();
    this.switchView('view-bank');
  },

  renderQuestionBank() {
    if (!this.db) return;
    const keyword = (document.getElementById('bank-search-input').value || '').trim().toLowerCase();
    const setFilter = document.getElementById('bank-set-filter').value;
    const topicFilter = document.getElementById('bank-topic-filter').value;

    let pool = this.db.questionsList;
    if (setFilter !== 'all') {
      const foundSet = this.db.sets.find(s => s.id === setFilter);
      if (foundSet) {
        pool = foundSet.questionIds.map(id => this.db.questions[id]).filter(Boolean);
      }
    }

    const filtered = pool.filter(q => {
      if (topicFilter !== 'all' && q.topic !== topicFilter) return false;
      if (!keyword) return true;
      const haystack = `${q.question} ${q.options.A} ${q.options.B} ${q.options.C} ${q.options.D} ${q.explanation} ${q.source}`.toLowerCase();
      return haystack.includes(keyword);
    });

    document.getElementById('bank-match-count').textContent = filtered.length;
    const container = document.getElementById('bank-list-container');

    container.innerHTML = filtered.map((q, idx) => {
      const optsHtml = ['A', 'B', 'C', 'D'].map(letter => {
        const isRight = letter === q.answer;
        return `<div class="ri-opt ${isRight ? 'opt-correct' : ''}">
          <b>${letter}.</b> ${this.escapeHtml(q.options[letter])}
          ${isRight ? ' ✓' : ''}
        </div>`;
      }).join('');

      return `
        <div class="review-item item-correct">
          <div class="ri-top">
            <span class="q-topic-tag">#${idx + 1} • ${q.topic}</span>
            <span class="q-source-tag">Đề gốc: ${q.source} • Câu ${q.num}</span>
          </div>
          <div class="ri-qtitle">${this.escapeHtml(q.question)}</div>
          ${q.image ? `<div class="q-image-wrap"><img src="${q.image.startsWith('/') ? '.' + q.image : q.image}" alt="Hình minh họa" /></div>` : ''}
          <div class="ri-options">${optsHtml}</div>
          <div class="ri-exp"><strong>📘 Giải thích lý thuyết:</strong> ${this.escapeHtml(q.explanation)}</div>
        </div>
      `;
    }).join('');
  },

  async resetAllProgress() {
    if (!confirm('Bạn có chắc muốn xóa toàn bộ lịch sử điểm số, tiến độ đang làm dở và danh sách câu sai để làm lại từ đầu không?')) {
      return;
    }
    this.progress = {
      setStats: {},
      wrongQuestionIds: [],
      inProgressSessions: {},
      lastActiveSetId: null
    };
    await this.saveProgress();
    this.renderDashboard();
  },

  setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      const quizView = document.getElementById('view-quiz');
      if (!quizView || quizView.classList.contains('hidden')) return;

      // Ignore if typing in input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;

      const key = e.key.toUpperCase();
      const ansState = this.userAnswers[this.currentIndex];

      // Answer selection keys: A, B, C, D or 1, 2, 3, 4
      if (!ansState || !ansState.answered) {
        const keyMap = { 'A': 'A', 'B': 'B', 'C': 'C', 'D': 'D', '1': 'A', '2': 'B', '3': 'C', '4': 'D' };
        if (keyMap[key]) {
          e.preventDefault();
          this.selectOption(keyMap[key]);
          return;
        }
      } else {
        // Already answered current question: Enter, Space, or ArrowRight moves to next question
        if (e.key === 'Enter' || e.key === 'ArrowRight' || e.key === ' ') {
          e.preventDefault();
          this.nextQuestion();
          return;
        }
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        this.prevQuestion();
      }
    });
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
};

window.addEventListener('DOMContentLoaded', () => {
  app.init();
});
