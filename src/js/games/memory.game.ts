import { AppState } from '../state';
import { StudentView } from '../views/student.view';
import { qs, escHTML, showSuccess } from '../utils';

export const MemoryGame = {
  cards: [] as any[], flipped: [] as number[], matched: [] as number[], moves: 0, timer: null as any, seconds: 0, isPeek: false, peekTime: 10,

  init(container: Element) {
    const rawPairs = AppState.get().lesson.questions.memory || [];
    if (!rawPairs.length) {
      container.innerHTML = '<div class="empty-state"><div class="icon">🧩</div><p>Chưa có cặp Memory nào!</p></div>';
      return;
    }
    
    // Choose 6 pairs for 4x3 layout (12 cards)
    const shuffledPairs = [...rawPairs].sort(() => Math.random() - .5);
    const pairs = shuffledPairs.slice(0, 6);

    const deck: any[] = [];
    pairs.forEach((p, i) => {
      deck.push({ id: i*2, pairId: i, text: p.cardA, type:'A' });
      deck.push({ id: i*2+1, pairId: i, text: p.cardB, type:'B' });
    });
    this.cards = deck.sort(() => Math.random() - .5);
    this.flipped = []; this.matched = []; this.moves = 0; this.seconds = 0;
    if (this.timer) clearInterval(this.timer);

    const cols = 4;
    container.innerHTML = `
      <div class="game-header">
        <span style="font-size:1.5rem">🧩</span>
        <h3>Memory</h3>
        <span class="game-progress" id="mem-progress">0/${pairs.length}</span>
      </div>
      <div class="game-body">
        <div class="memory-stage">
          <div class="memory-info">
            <div class="memory-stat"><div class="memory-stat-num" id="mem-moves">0</div><div class="memory-stat-label">Lượt</div></div>
            <div class="memory-stat"><div class="memory-stat-num" id="mem-matches">0/${pairs.length}</div><div class="memory-stat-label">Cặp đúng</div></div>
            <div class="memory-stat"><div class="memory-stat-num" id="mem-time">0:00</div><div class="memory-stat-label">Thời gian</div></div>
          </div>
          <div id="peek-timer" style="text-align:center; margin-bottom:12px; font-weight:800; color:var(--sky); font-size:1.2rem;">Ghi nhớ: 10s</div>
          <div class="memory-grid" id="mem-grid" style="grid-template-columns:repeat(${cols},1fr)"></div>
        </div>
      </div>
    `;

    this.isPeek = true;
    this.renderGrid();

    let peekLeft = this.peekTime;
    const peekInterval = setInterval(() => {
      peekLeft--;
      const pEl = qs('#peek-timer');
      if (pEl) pEl.textContent = `Ghi nhớ: ${peekLeft}s`;
      if (peekLeft <= 0) {
        clearInterval(peekInterval);
        this.isPeek = false;
        if (pEl) pEl.style.display = 'none';
        this.renderGrid();
        this.startTimer();
      }
    }, 1000);
  },

  startTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.seconds++;
      const m = Math.floor(this.seconds/60), s = this.seconds%60;
      const el = qs('#mem-time');
      if (el) el.textContent = `${m}:${s.toString().padStart(2,'0')}`;
    }, 1000);
  },

  renderGrid() {
    const grid = qs('#mem-grid');
    if (!grid) return;
    grid.innerHTML = this.cards.map((card, idx) => {
      const isFlipped = this.isPeek || this.flipped.includes(idx) || this.matched.includes(card.pairId);
      const isMatched = this.matched.includes(card.pairId);
      const fontSize = card.text.length > 20 ? '.95rem' : card.text.length > 10 ? '1.2rem' : '1.5rem';
      return `
      <div class="mem-card-wrap" data-idx="${idx}">
        <div class="mem-card ${isFlipped?'flipped':''} ${isMatched?'matched':''}" id="mc-${idx}">
          <div class="mem-card-face mem-card-back-face"><div class="mem-card-back-inner">${idx + 1}</div></div>
          <div class="mem-card-face mem-card-front-face" style="font-size:${fontSize}">${escHTML(card.text)}</div>
        </div>
      </div>`;
    }).join('');

    grid.querySelectorAll('.mem-card-wrap').forEach(wrap => {
      wrap.addEventListener('click', (e) => this.flip(parseInt((e.currentTarget as HTMLElement).dataset.idx!, 10)));
    });
  },

  flip(idx: number) {
    if (this.isPeek) return;
    if (this.flipped.length >= 2) return;
    if (this.flipped.includes(idx)) return;
    if (this.matched.includes(this.cards[idx].pairId)) return;

    this.flipped.push(idx);
    qs(`#mc-${idx}`)?.classList.add('flipped');

    if (this.flipped.length === 2) {
      this.moves++;
      const mEl = qs('#mem-moves'); if (mEl) mEl.textContent = this.moves.toString();
      const [a, b] = this.flipped;
      if (this.cards[a].pairId === this.cards[b].pairId) {
        this.matched.push(this.cards[a].pairId);
        this.flipped = [];
        setTimeout(() => {
          qs(`#mc-${a}`)?.classList.add('matched');
          qs(`#mc-${b}`)?.classList.add('matched');
          const pairs = this.cards.length / 2;
          const matchEl = qs('#mem-matches'); if (matchEl) matchEl.textContent = `${this.matched.length}/${pairs}`;
          const progEl = qs('#mem-progress'); if (progEl) progEl.textContent = `${this.matched.length}/${pairs}`;
          if (this.matched.length === pairs) {
            clearInterval(this.timer);
            StudentView.saveAnswer('memory', { pairs, moves: this.moves, seconds: this.seconds });
            setTimeout(() => showSuccess('🧩', 'Ghép xong!', `Hoàn thành trong ${this.moves} lượt!`, `⏱ ${Math.floor(this.seconds/60)}:${(this.seconds%60).toString().padStart(2,'0')}`), 500);
          }
        }, 300);
      } else {
        setTimeout(() => {
          [a,b].forEach(i => {
            const el = qs(`#mc-${i}`);
            if (el) { el.classList.add('wrong-flash'); setTimeout(() => { el.classList.remove('flipped','wrong-flash'); }, 300); }
          });
          this.flipped = [];
        }, 800);
      }
    }
  }
};
