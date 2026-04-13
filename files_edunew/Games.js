/**
 * EduPlay — WordleGame, MemoryGame, FillBlankGame, MCQGame
 */
import { BaseGame } from './BaseGame.js';
import { escHTML, shuffle, answersMatch, formatTime, calcStars, starsDisplay } from '../utils/helpers.js';

// ─── Helper to read store ─────────────────────────────────────────────────
function storeGet(path) { return window.__eduplay__.store.get(path); }

// ============================================================
// WORDLE GAME
// ============================================================
export class WordleGame extends BaseGame {
  gameKey   = 'wordle';
  gameTitle = 'Wordle';
  gameIcon  = '🔤';

  #words    = [];
  #wordIdx  = 0;
  #guesses  = [];
  #solved   = false;
  #keyColors= {};
  MAX_GUESSES = 6;

  setup() {
    this.#words = shuffle(storeGet('lesson.questions.wordle') ?? []);
    if (!this.#words.length) {
      this.body.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🔤</div><h3>Chưa có từ Wordle</h3></div>`;
      return;
    }
    this.maxScore = this.#words.length * 30;
    this.#loadWord();
  }

  #loadWord() {
    this.#guesses   = [];
    this.#solved    = false;
    this.#keyColors = {};
    this.#renderAll();
  }

  get #word() { return (this.#words[this.#wordIdx]?.word ?? '').toUpperCase(); }
  get #hint() { return this.#words[this.#wordIdx]?.hint ?? ''; }
  get #wordChars() { return [...this.#word]; }

  #renderAll() {
    const total = this.#words.length;
    this.body.innerHTML = `
      <div class="wordle-stage">
        <div class="wordle-word-nav">
          <button class="btn btn-ghost btn-sm" id="w-prev" ${this.#wordIdx===0?'disabled':''}>◀</button>
          <span>Từ ${this.#wordIdx+1} / ${total}</span>
          <button class="btn btn-ghost btn-sm" id="w-next" ${this.#wordIdx===total-1?'disabled':''}>▶</button>
        </div>
        <div class="wordle-hint-banner">💡 ${escHTML(this.#hint)}</div>
        <div class="wordle-grid" id="w-grid"></div>
        <div class="wordle-status" id="w-status" aria-live="polite"></div>
        <div style="display:flex;gap:8px;align-items:center">
          <input class="form-input" id="w-input" maxlength="12"
            placeholder="Nhập từ..."
            style="width:180px;font-family:var(--font-display);letter-spacing:4px;text-transform:uppercase;text-align:center"
            aria-label="Nhập từ đoán" />
          <button class="btn btn-primary btn-sm" id="w-submit">→ Đoán</button>
        </div>
        <div class="wordle-keyboard" id="w-kb"></div>
      </div>
    `;
    this.#renderGrid();
    this.#renderKeyboard();
    this.#attachEvents();
  }

  #renderGrid() {
    const len = this.#wordChars.length;
    const grid = this.qs('#w-grid');
    if (!grid) return;
    let html = '';
    for (let r = 0; r < this.MAX_GUESSES; r++) {
      html += '<div class="wordle-row" id="wr-' + r + '">';
      const guess = this.#guesses[r];
      if (guess) {
        const gChars = [...guess.toUpperCase()];
        const colors = this.#evaluate(gChars, this.#wordChars);
        gChars.forEach((c, i) => { html += `<div class="wordle-cell ${colors[i]}">${escHTML(c)}</div>`; });
        // Track key colors
        gChars.forEach((c, i) => {
          const prev = this.#keyColors[c];
          const priority = { correct:3, present:2, absent:1 };
          if (!prev || (priority[colors[i]] ?? 0) > (priority[prev] ?? 0)) this.#keyColors[c] = colors[i];
        });
      } else {
        for (let c = 0; c < len; c++) {
          html += `<div class="wordle-cell ${r===this.#guesses.length?'current':''}"></div>`;
        }
      }
      html += '</div>';
    }
    grid.innerHTML = html;
  }

  #evaluate(guess, word) {
    const colors = Array(word.length).fill('absent');
    const freq   = {};
    word.forEach(c => freq[c] = (freq[c]||0)+1);
    // Correct pass
    guess.forEach((c,i) => { if (c===word[i]) { colors[i]='correct'; freq[c]--; } });
    // Present pass
    guess.forEach((c,i) => { if (colors[i]!=='correct' && freq[c]>0) { colors[i]='present'; freq[c]--; } });
    return colors;
  }

  #renderKeyboard() {
    const rows=[['Q','W','E','R','T','Y','U','I','O','P'],['A','S','D','F','G','H','J','K','L'],['ENTER','Z','X','C','V','B','N','M','⌫']];
    const kb = this.qs('#w-kb');
    if (!kb) return;
    kb.innerHTML = rows.map(row =>
      `<div class="wordle-key-row">${row.map(k => {
        const cls = this.#keyColors[k] ?? '';
        return `<button class="wordle-key ${cls} ${k.length>1?'wide':''}" data-key="${k}">${escHTML(k)}</button>`;
      }).join('')}</div>`
    ).join('');
    kb.querySelectorAll('.wordle-key').forEach(btn => {
      btn.addEventListener('click', () => this.#keyPress(btn.dataset.key));
    });
  }

  #attachEvents() {
    this.qs('#w-prev')?.addEventListener('click', () => { if (this.#wordIdx>0){ this.#wordIdx--; this.#loadWord(); } });
    this.qs('#w-next')?.addEventListener('click', () => this.#nextWord());
    this.qs('#w-submit')?.addEventListener('click', () => this.#submitGuess());
    this.qs('#w-input')?.addEventListener('keydown', e => { if(e.key==='Enter') this.#submitGuess(); });
  }

  #keyPress(k) {
    const input = this.qs('#w-input');
    if (!input) return;
    if (k==='⌫') input.value=input.value.slice(0,-1);
    else if (k==='ENTER') this.#submitGuess();
    else if (/^[A-Z]$/.test(k)) input.value += k;
    input.focus();
  }

  #submitGuess() {
    if (this.#solved || this.#guesses.length >= this.MAX_GUESSES) return;
    const input = this.qs('#w-input');
    const guess = input.value.trim().toUpperCase();
    const len   = this.#wordChars.length;

    if ([...guess].length !== len) {
      this.qs('#w-status').textContent = `⚠️ Nhập đúng ${len} ký tự!`;
      this.qs('#w-grid')?.classList.add('anim-shake');
      setTimeout(() => this.qs('#w-grid')?.classList.remove('anim-shake'), 400);
      return;
    }

    this.#guesses.push(guess);
    input.value = '';
    this.#renderGrid();
    this.#renderKeyboard();

    if (guess === this.#word) {
      this.#solved = true;
      const pts  = Math.max(10, (this.MAX_GUESSES - this.#guesses.length + 1) * 10);
      this.addScore(pts);
      this.qs('#w-status').textContent = `🎉 Đúng rồi! +${pts} điểm`;
      this.qs('#w-grid')?.querySelector('#wr-'+(this.#guesses.length-1))?.classList.add('won');
      setTimeout(() => this.#nextWord(), 2000);
    } else if (this.#guesses.length >= this.MAX_GUESSES) {
      this.qs('#w-status').textContent = `😢 Từ đúng là: ${this.#word}`;
      setTimeout(() => this.#nextWord(), 2500);
    }
  }

  #nextWord() {
    if (this.#wordIdx < this.#words.length - 1) { this.#wordIdx++; this.#loadWord(); }
    else this.complete(`Đoán được ${this.score / 10} từ trong ${formatTime(this.elapsedSeconds)}`);
  }

  getAnswerData() {
    return { words: this.#words.length, score: this.score };
  }
}

// ============================================================
// MEMORY GAME
// ============================================================
export class MemoryGame extends BaseGame {
  gameKey   = 'memory';
  gameTitle = 'Memory Match';
  gameIcon  = '🧩';

  #deck     = [];
  #flipped  = [];  // indices of currently-revealed cards
  #matched  = new Set(); // pair IDs
  #moves    = 0;
  #locked   = false;
  #combo    = 0;

  setup() {
    const pairs = storeGet('lesson.questions.memory') ?? [];
    if (!pairs.length) {
      this.body.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🧩</div><h3>Chưa có cặp Memory</h3></div>`;
      return;
    }
    // Build deck: each pair → 2 cards
    this.#deck = shuffle(pairs.flatMap((p, i) => [
      { id: i*2,   pairId: i, text: p.cardA, type:'A' },
      { id: i*2+1, pairId: i, text: p.cardB, type:'B' },
    ]));
    this.maxScore = pairs.length * 20;
    this.#renderAll();
  }

  #renderAll() {
    const n    = this.#deck.length;
    const cols = n <= 8 ? 4 : n <= 12 ? 4 : 6;
    this.body.innerHTML = `
      <div class="memory-stage">
        <div class="memory-stats">
          <div class="memory-stat">
            <div class="memory-stat-value" id="m-moves">0</div>
            <div class="memory-stat-label">Lượt</div>
          </div>
          <div class="memory-stat">
            <div class="memory-stat-value" id="m-match">${this.#matched.size}/${n/2}</div>
            <div class="memory-stat-label">Cặp đúng</div>
          </div>
          <div class="memory-stat">
            <div class="memory-stat-value" id="m-combo">×1</div>
            <div class="memory-stat-label">Combo</div>
          </div>
        </div>
        <div class="memory-grid" id="m-grid" style="grid-template-columns:repeat(${cols},1fr);width:100%"></div>
      </div>
    `;
    this.#renderGrid();
  }

  #renderGrid() {
    const grid   = this.qs('#m-grid');
    const cellH  = Math.min(100, Math.max(60, 420 / Math.ceil(this.#deck.length / 4)));
    grid.innerHTML = this.#deck.map((card, idx) => {
      const isFlipped  = this.#flipped.includes(idx) || this.#matched.has(card.pairId);
      const isMatched  = this.#matched.has(card.pairId);
      const fontSize   = card.text.length > 12 ? '.7rem' : card.text.length > 8 ? '.8rem' : '.9rem';
      return `
        <div class="mem-card-wrap" style="height:${cellH}px" data-idx="${idx}">
          <div class="mem-card ${isFlipped?'flipped':''} ${isMatched?'matched':''}" id="mc-${idx}">
            <div class="mem-card-face mem-face-back">?</div>
            <div class="mem-card-face mem-face-front" style="font-size:${fontSize}">${escHTML(card.text)}</div>
          </div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.mem-card-wrap').forEach(wrap => {
      wrap.addEventListener('click', () => this.#flip(Number(wrap.dataset.idx)));
    });
  }

  #flip(idx) {
    if (this.#locked) return;
    if (this.#flipped.includes(idx)) return;
    if (this.#matched.has(this.#deck[idx].pairId)) return;

    this.#flipped.push(idx);
    this.qs(`#mc-${idx}`)?.classList.add('flipped');

    if (this.#flipped.length === 2) {
      this.#locked = true;
      this.#moves++;
      this.qs('#m-moves').textContent = this.#moves;

      const [a, b] = this.#flipped;
      if (this.#deck[a].pairId === this.#deck[b].pairId) {
        // Match!
        this.#combo++;
        const pts = 10 * this.#combo; // combo multiplier
        this.addScore(pts);
        this.#matched.add(this.#deck[a].pairId);
        this.qs('#m-match').textContent = `${this.#matched.size}/${this.#deck.length/2}`;
        this.qs('#m-combo').textContent = `×${this.#combo}`;
        [a,b].forEach(i => this.qs(`#mc-${i}`)?.classList.add('matched'));
        this.#flipped = [];
        this.#locked  = false;

        if (this.#matched.size === this.#deck.length / 2) {
          setTimeout(() => this.complete(`${this.#moves} lượt — Combo max ×${this.#combo}`), 600);
        }
      } else {
        this.#combo = 0;
        this.qs('#m-combo').textContent = '×1';
        setTimeout(() => {
          [a,b].forEach(i => {
            const el = this.qs(`#mc-${i}`);
            if (el) { el.classList.add('wrong'); setTimeout(() => { el.classList.remove('flipped','wrong'); }, 300); }
          });
          this.#flipped = [];
          this.#locked  = false;
        }, 900);
      }
    }
  }

  getAnswerData() {
    return { moves: this.#moves, matched: this.#matched.size, total: this.#deck.length / 2 };
  }
}

// ============================================================
// FILL IN THE BLANK GAME
// ============================================================
export class FillBlankGame extends BaseGame {
  gameKey   = 'fillblank';
  gameTitle = 'Điền vào chỗ trống';
  gameIcon  = '✏️';

  #items  = [];
  #checked= false;
  #results= [];

  setup() {
    this.#items = storeGet('lesson.questions.fillBlank') ?? [];
    if (!this.#items.length) {
      this.body.innerHTML = `<div class="empty-state"><div class="empty-state-icon">✏️</div><h3>Chưa có câu điền trống</h3></div>`;
      return;
    }
    this.maxScore = this.#items.length * 10;
    this.#renderAll();
  }

  #renderAll() {
    // Build word bank from all answers (shuffled)
    const wordBank = shuffle(this.#items.map(i => i.answer));

    this.body.innerHTML = `
      <div class="fill-stage">
        <div class="fill-word-bank">
          <div class="fill-word-bank-title">📚 Ngân hàng từ</div>
          <div class="fill-word-chips" id="fill-bank">
            ${wordBank.map(w => `<button class="fill-word-chip" data-word="${escHTML(w)}">${escHTML(w)}</button>`).join('')}
          </div>
        </div>
        <div id="fill-items">
          ${this.#items.map((item, i) => {
            const parts = item.sentence.split('[___]');
            return `
              <div class="fill-item">
                <div class="fill-q-num">Câu ${i+1}</div>
                <div class="fill-sentence">
                  ${escHTML(parts[0]??'')}
                  <span class="fill-blank">
                    <input class="fill-input" id="fi-${i}" data-idx="${i}"
                      placeholder="..." aria-label="Điền vào chỗ trống câu ${i+1}"
                      style="min-width:${Math.max(80,(item.answer?.length??6)*12)}px" />
                  </span>
                  ${escHTML(parts[1]??'')}
                </div>
                <div class="fill-hint-text">💡 Gợi ý: ${escHTML(item.hint??'')}</div>
              </div>
            `;
          }).join('')}
        </div>
        <div class="game-check-row">
          <button class="btn btn-warning" id="fill-check">✅ Kiểm tra đáp án</button>
        </div>
        <div id="fill-result" class="game-result-banner" style="display:none"></div>
      </div>
    `;

    // Word bank click-to-fill
    let activeInput = null;
    this.qsAll('.fill-input').forEach(input => {
      input.addEventListener('focus', () => activeInput = input);
    });
    this.qs('#fill-bank')?.addEventListener('click', (e) => {
      const chip = e.target.closest('.fill-word-chip');
      if (!chip || chip.classList.contains('used')) return;
      if (activeInput) {
        if (activeInput.value) {
          // Un-use the old chip
          this.qs(`[data-word="${activeInput.value}"]`)?.classList.remove('used');
        }
        activeInput.value = chip.dataset.word;
        chip.classList.add('used');
        // Move focus to next empty input
        const inputs = [...this.qsAll('.fill-input')];
        const idx    = inputs.indexOf(activeInput);
        const next   = inputs.slice(idx+1).find(el => !el.value);
        if (next) next.focus();
      }
    });

    this.qs('#fill-check')?.addEventListener('click', () => this.#check());
  }

  #check() {
    if (this.#checked) return;
    this.#checked = true;
    let correct = 0;
    this.#results = this.#items.map((item, i) => {
      const input  = this.qs(`#fi-${i}`);
      const val    = input?.value ?? '';
      const isRight= answersMatch(val, item.answer);
      if (isRight) { correct++; input?.classList.add('correct'); }
      else         { input?.classList.add('wrong'); }
      return { question: item.sentence, answer: item.answer, student: val, correct: isRight };
    });

    this.addScore(correct * 10);
    const pct = Math.round(correct / this.#items.length * 100);
    const res = this.qs('#fill-result');
    if (res) {
      res.style.display = '';
      res.className = `game-result-banner ${pct>=80?'result-great':pct>=50?'result-ok':'result-poor'}`;
      res.textContent = `${correct}/${this.#items.length} câu đúng (${pct}%) ${pct===100?'🎉 Hoàn hảo!':pct>=80?'⭐ Giỏi lắm!':'💪 Cố gắng hơn!'}`;
    }
    this.qs('#fill-check').disabled = true;
    setTimeout(() => this.complete(`${correct}/${this.#items.length} câu đúng`), 800);
  }

  getAnswerData() { return { results: this.#results }; }
}

// ============================================================
// MCQ GAME (one-at-a-time with timer per question)
// ============================================================
export class MCQGame extends BaseGame {
  gameKey   = 'mcq';
  gameTitle = 'Trắc Nghiệm';
  gameIcon  = '📋';

  #questions   = [];
  #currentQ    = 0;
  #selected    = null;
  #streak      = 0;
  #results     = [];
  #questionTimer = null;
  #timeLeft    = 30;
  QUESTION_TIME = 30;

  setup() {
    this.#questions = storeGet('lesson.questions.multipleChoice') ?? [];
    if (!this.#questions.length) {
      this.body.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📋</div><h3>Chưa có câu trắc nghiệm</h3></div>`;
      return;
    }
    this.maxScore = this.#questions.length * 20;
    this.#renderQuestion();
  }

  get #q() { return this.#questions[this.#currentQ]; }
  get #total() { return this.#questions.length; }

  #renderQuestion() {
    if (!this.#q) { this.#showSummary(); return; }
    this.#selected  = null;
    this.#timeLeft  = this.QUESTION_TIME;
    const letters   = ['A','B','C','D','E'];
    const pct       = Math.round((this.#currentQ / this.#total) * 100);

    this.body.innerHTML = `
      <div class="mcq-stage">
        <div class="mcq-slide">
          <div class="mcq-timer-bar">
            <div class="mcq-timer-fill" id="mcq-timer" style="width:100%"></div>
          </div>
          <div class="mcq-q-num">
            <span>Câu ${this.#currentQ+1} / ${this.#total}</span>
            <span class="mcq-streak">${'🔥'.repeat(Math.min(this.#streak,5))} ${this.#streak > 0 ? `×${this.#streak}` : ''}</span>
          </div>
          <div style="background:var(--color-bg);border-radius:var(--radius);height:6px;margin-bottom:var(--space-4)">
            <div style="background:var(--color-purple);height:100%;border-radius:var(--radius);width:${pct}%;transition:width .4s ease"></div>
          </div>
          <div class="mcq-question">${escHTML(this.#q.question)}</div>
          <div class="mcq-options" id="mcq-opts">
            ${this.#q.options.map((opt, i) => `
              <button class="mcq-option" data-idx="${i}" aria-label="Chọn đáp án ${letters[i]}">
                <span class="mcq-opt-letter">${letters[i]}</span>
                <span class="mcq-opt-text">${escHTML(opt)}</span>
              </button>
            `).join('')}
          </div>
          <div class="mcq-explanation hidden" id="mcq-exp">
            💡 ${escHTML(this.#q.explanation ?? '')}
          </div>
          <div class="mcq-next-row hidden" id="mcq-next-row">
            <button class="btn btn-primary" id="mcq-next">
              ${this.#currentQ < this.#total-1 ? 'Câu tiếp theo →' : '📊 Xem kết quả'}
            </button>
          </div>
        </div>
      </div>
    `;

    this.qs('#mcq-opts')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.mcq-option');
      if (!btn || this.#selected !== null) return;
      this.#answer(Number(btn.dataset.idx));
    });
    this.qs('#mcq-next')?.addEventListener('click', () => { this.#currentQ++; this.#renderQuestion(); });

    this.#startQuestionTimer();
  }

  #startQuestionTimer() {
    clearInterval(this.#questionTimer);
    this.#questionTimer = setInterval(() => {
      this.#timeLeft--;
      const pct  = (this.#timeLeft / this.QUESTION_TIME) * 100;
      const fill = this.qs('#mcq-timer');
      if (fill) {
        fill.style.width = pct + '%';
        fill.className   = `mcq-timer-fill ${pct<30?'danger':pct<60?'warn':''}`;
      }
      if (this.#timeLeft <= 0) {
        clearInterval(this.#questionTimer);
        if (this.#selected === null) this.#answer(-1); // time up
      }
    }, 1000);
  }

  #answer(idx) {
    clearInterval(this.#questionTimer);
    this.#selected = idx;
    const correct  = this.#q.correct;
    const isRight  = idx === correct;

    if (isRight) {
      this.#streak++;
      const bonus = Math.min(this.#streak - 1, 5) * 2; // streak bonus
      this.addScore(20 + bonus);
    } else {
      this.#streak = 0;
    }

    this.#results.push({
      question: this.#q.question,
      options:  this.#q.options,
      correct,
      selected: idx,
      isRight,
      timeLeft: this.#timeLeft,
    });

    // Visual feedback
    this.qsAll('.mcq-option').forEach((btn, i) => {
      btn.classList.add('disabled');
      if (i === correct)       btn.classList.add('correct');
      else if (i === idx)      btn.classList.add('wrong');
    });

    if (this.#q.explanation) this.qs('#mcq-exp')?.classList.remove('hidden');
    this.qs('#mcq-next-row')?.classList.remove('hidden');
  }

  #showSummary() {
    const correct = this.#results.filter(r => r.isRight).length;
    const pct     = Math.round(correct / this.#total * 100);

    this.body.innerHTML = `
      <div class="mcq-stage">
        <div style="text-align:center;margin-bottom:var(--space-6)">
          <div style="font-size:3rem;margin-bottom:var(--space-3)">${pct>=90?'🏆':pct>=60?'⭐':'💪'}</div>
          <h3 style="font-size:var(--text-2xl)">Kết quả: ${correct}/${this.#total}</h3>
          <p style="color:var(--color-muted);font-weight:700">${pct}% câu đúng</p>
          <div style="font-size:1.5rem;margin-top:var(--space-3)">${starsDisplay(calcStars(pct))}</div>
        </div>
        <div class="mcq-summary">
          ${this.#results.map((r, i) => `
            <div class="mcq-summary-item ${r.isRight?'correct':'wrong'}">
              <span class="mcq-summary-icon"></span>
              <div>
                <div class="mcq-summary-q">Câu ${i+1}: ${escHTML(r.question)}</div>
                <div class="mcq-summary-a">
                  Đáp án đúng: <strong>${escHTML(r.options[r.correct]??'')}</strong>
                  ${!r.isRight && r.selected>=0 ? ` | Bạn chọn: <span style="color:var(--color-coral)">${escHTML(r.options[r.selected]??'')}</span>` : ''}
                  ${r.selected<0 ? ' | <em>Hết giờ</em>' : ''}
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    this.complete(`${correct}/${this.#total} câu đúng (${pct}%)`);
  }

  getAnswerData() { return { results: this.#results }; }

  destroy() {
    clearInterval(this.#questionTimer);
    super.destroy();
  }
}
