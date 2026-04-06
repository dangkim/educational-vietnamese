import { AppState } from '../state';
import { StudentView } from '../views/student.view';
import { qs, escHTML, showToast, showSuccess } from '../utils';

export const WordleGame = {
  words: [] as any[], wordIdx: 0, guesses: [] as string[], currentGuess: '', maxGuesses: 6,
  ROWS: 6, solved: false, keyColors: {} as Record<string, string>,

  init(container: Element) {
    this.words = AppState.get().lesson.questions.wordle || [];
    if (!this.words.length) {
      container.innerHTML = '<div class="empty-state"><div class="icon">🔤</div><p>Chưa có từ Wordle nào!</p></div>';
      return;
    }
    this.wordIdx = 0;
    container.innerHTML = `
      <div class="game-header">
        <span style="font-size:1.5rem">🔤</span>
        <h3>Wordle</h3>
        <span class="game-progress" id="w-progress"></span>
      </div>
      <div class="game-body">
        <div class="wordle-stage">
          <div class="wordle-hint-box" id="w-hint"></div>
          <div class="wordle-grid" id="w-grid"></div>
          <div class="wordle-status" id="w-status"></div>
          <div class="wordle-input-row">
            <input class="wordle-input" id="w-input" maxlength="20" placeholder="Nhập từ..." />
            <button class="btn-wordle-submit" id="btn-w-submit">→</button>
          </div>
          <div class="wordle-keyboard" id="w-keyboard"></div>
          <div class="wordle-word-nav">
            <button id="w-prev">◀ Từ trước</button>
            <span id="w-word-count" style="font-weight:700;color:var(--muted)"></span>
            <button id="w-next">Từ tiếp ▶</button>
          </div>
        </div>
      </div>
    `;

    qs('#btn-w-submit')?.addEventListener('click', () => this.submitGuess());
    qs('#w-input')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.submitGuess(); });
    qs('#w-prev')?.addEventListener('click', () => this.prevWord());
    qs('#w-next')?.addEventListener('click', () => this.nextWord());

    this.loadWord();
  },

  loadWord() {
    this.guesses = []; this.currentGuess = ''; this.solved = false; this.keyColors = {};
    const word = this.words[this.wordIdx];
    const h = qs('#w-hint'); if (h) h.textContent = '💡 Gợi ý: ' + word.hint;
    const prog = qs('#w-progress'); if (prog) prog.textContent = `${this.wordIdx+1}/${this.words.length}`;
    const c = qs('#w-word-count'); if (c) c.textContent = `Từ ${this.wordIdx+1}/${this.words.length}`;
    
    const pb = qs<HTMLButtonElement>('#w-prev'); if (pb) pb.disabled = this.wordIdx === 0;
    const nb = qs<HTMLButtonElement>('#w-next'); if (nb) nb.disabled = this.wordIdx === this.words.length - 1;
    
    const inp = qs<HTMLInputElement>('#w-input'); if (inp) inp.value = '';
    const st = qs('#w-status'); if (st) st.textContent = '';
    
    this.renderGrid();
    this.renderKeyboard();
    inp?.focus();
  },

  getWordLen() { return [...(this.words[this.wordIdx]?.word || '')].length; },

  renderGrid() {
    const word = this.words[this.wordIdx];
    const wChars = [...word.word.toUpperCase()];
    const len = wChars.length;
    let html = '';
    for (let r = 0; r < this.ROWS; r++) {
      html += '<div class="wordle-row">';
      const guess = this.guesses[r];
      if (guess) {
        const gChars = [...guess.toUpperCase()];
        const colors = Array(len).fill('absent');
        const wCount: any = {};
        wChars.forEach(c => wCount[c] = (wCount[c]||0)+1);
        gChars.forEach((c,i) => { if (c === wChars[i]) { colors[i] = 'correct'; wCount[c]--; } });
        gChars.forEach((c,i) => { if (colors[i] !== 'correct' && wCount[c] > 0) { colors[i] = 'present'; wCount[c]--; } });
        gChars.forEach((c,i) => {
          html += `<div class="wordle-cell ${colors[i]}">${escHTML(c)}</div>`;
          const prev = this.keyColors[c];
          if (!prev || prev === 'absent' || (prev === 'present' && colors[i] === 'correct')) this.keyColors[c] = colors[i];
        });
      } else {
        for (let c = 0; c < len; c++) html += `<div class="wordle-cell ${r === this.guesses.length ? 'current-row' : ''}"></div>`;
      }
      html += '</div>';
    }
    const grid = qs('#w-grid');
    if (grid) grid.innerHTML = html;
    this.renderKeyboard();
  },

  renderKeyboard() {
    const rows = [
      ['Q','W','E','R','T','Y','U','I','O','P'],
      ['A','S','D','F','G','H','J','K','L'],
      ['ENTER','Z','X','C','V','B','N','M','⌫']
    ];
    const kb = qs('#w-keyboard');
    if (!kb) return;
    kb.innerHTML = rows.map(row =>
      `<div class="wordle-key-row">${row.map(k => {
        const cls = this.keyColors[k] || '';
        const wide = k === 'ENTER' || k === '⌫' ? 'wide' : '';
        return `<button class="wordle-key ${cls} ${wide}" data-key="${k}">${k}</button>`;
      }).join('')}</div>`
    ).join('');

    kb.querySelectorAll('.wordle-key').forEach(btn => {
      btn.addEventListener('click', (e) => this.keyPress((e.currentTarget as HTMLElement).dataset.key!));
    });
  },

  keyPress(k: string) {
    if (this.solved || this.guesses.length >= this.ROWS) return;
    const input = qs<HTMLInputElement>('#w-input');
    if (!input) return;
    if (k === '⌫') { input.value = input.value.slice(0,-1); }
    else if (k === 'ENTER') { this.submitGuess(); }
    else { input.value += k; }
    input.focus();
  },

  submitGuess() {
    if (this.solved || this.guesses.length >= this.ROWS) return;
    const input = qs<HTMLInputElement>('#w-input');
    if (!input) return;
    const guess = input.value.trim().toUpperCase();
    const word = this.words[this.wordIdx].word.toUpperCase();
    const len = [...word].length;
    
    if ([...guess].length < len) {
      const st = qs('#w-status'); if (st) st.textContent = `⚠️ Từ cần ${len} ký tự!`;
      qs('#w-grid')?.classList.add('animate-shake');
      setTimeout(() => qs('#w-grid')?.classList.remove('animate-shake'), 400);
      return;
    }

    this.guesses.push(guess);
    input.value = '';
    this.renderGrid();

    const st = qs('#w-status');
    if (guess === word) {
      this.solved = true;
      const pts = (this.ROWS - this.guesses.length + 1) * 10;
      if (st) st.textContent = `🎉 Chính xác! +${pts} điểm`;
      StudentView.saveAnswer(`wordle-${this.wordIdx}`, { word, guesses: this.guesses, solved: true, attempts: this.guesses.length });
      if (this.wordIdx < this.words.length - 1) {
        setTimeout(() => { showToast('✅ Đúng rồi! Từ tiếp theo!', 'success'); this.nextWord(); }, 1500);
      } else {
        setTimeout(() => showSuccess('🔤', 'Giỏi lắm!', 'Bạn đã đoán được tất cả các từ!', `${this.words.length} từ`), 1500);
      }
    } else if (this.guesses.length >= this.ROWS) {
      if (st) st.textContent = `😢 Từ đúng là: ${word}`;
      StudentView.saveAnswer(`wordle-${this.wordIdx}`, { word, guesses: this.guesses, solved: false });
    }
  },

  prevWord() { if (this.wordIdx > 0) { this.wordIdx--; this.loadWord(); } },
  nextWord() { if (this.wordIdx < this.words.length-1) { this.wordIdx++; this.loadWord(); } }
};
