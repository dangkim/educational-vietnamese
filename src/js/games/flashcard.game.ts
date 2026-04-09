import { AppState } from '../state';
import { StudentView } from '../views/student.view';
import { qs, escHTML, showToast, showSuccess } from '../utils';

export const FlashcardGame = {
  idx: 0, flipped: false, known: [] as number[], unknown: [] as number[], cards: [] as any[],

  init(container: Element) {
    this.idx = 0; this.flipped = false; this.known = []; this.unknown = [];
    this.cards = AppState.get().lesson.questions.flashcards || [];
    if (!this.cards.length) {
      container.innerHTML = '<div class="empty-state"><div class="icon">🃏</div><p>Chưa có flashcard nào!</p></div>';
      return;
    }
    container.innerHTML = `
      <div class="game-header">
        <span style="font-size:1.5rem">🃏</span>
        <h3>Flashcards</h3>
        <span class="game-progress" id="fc-progress"></span>
      </div>
      <div class="game-body">
        <div class="flashcard-stage">
          <div class="flashcard-progress" id="fc-title">Bấm vào thẻ để lật!</div>
          <div class="flashcard-wrap" id="fc-wrap">
            <div class="flashcard" id="fc-card">
              <div class="flashcard-face flashcard-front">
                <p class="flashcard-label">📌 THUẬT NGỮ</p>
                <h3 id="fc-term"></h3>
              </div>
              <div class="flashcard-face flashcard-back">
                <p class="flashcard-label">💡 GIẢI THÍCH</p>
                <p id="fc-def"></p>
              </div>
            </div>
          </div>
          <div class="fc-known-area">
            <button class="btn-unknown" id="btn-fc-uk">😅 Chưa nhớ</button>
            <button class="btn-known" id="btn-fc-k">😄 Đã nhớ!</button>
          </div>
          <div class="flashcard-nav">
            <button id="fc-prev">◀</button>
            <span id="fc-counter" style="font-weight:700;color:var(--muted)"></span>
            <button id="fc-next">▶</button>
          </div>
          <div style="margin-top:8px;text-align:center;font-size:.85rem;color:var(--muted)">
            😄 Đã nhớ: <strong id="fc-known-count">0</strong> | 😅 Chưa nhớ: <strong id="fc-unknown-count">0</strong>
          </div>
        </div>
      </div>
    `;
    
    qs('#fc-wrap')?.addEventListener('click', () => this.flip());
    qs('#btn-fc-uk')?.addEventListener('click', () => this.markCard(false));
    qs('#btn-fc-k')?.addEventListener('click', () => this.markCard(true));
    qs('#fc-prev')?.addEventListener('click', () => this.prev());
    qs('#fc-next')?.addEventListener('click', () => this.next());

    this.renderCard();
  },

  renderCard() {
    const card = this.cards[this.idx];
    const t = qs('#fc-term'); if (t) t.textContent = card.term;
    const d = qs('#fc-def'); if (d) d.textContent = card.definition;
    const fc = qs('#fc-card');
    if (fc) fc.classList.remove('flipped');
    this.flipped = false;
    
    const count = qs('#fc-counter'); if (count) count.textContent = `${this.idx+1} / ${this.cards.length}`;
    const prog = qs('#fc-progress'); if (prog) prog.textContent = `${this.idx+1}/${this.cards.length}`;
    
    const pbtn = qs<HTMLButtonElement>('#fc-prev'); if (pbtn) pbtn.disabled = this.idx === 0;
    const nbtn = qs<HTMLButtonElement>('#fc-next'); if (nbtn) nbtn.disabled = this.idx === this.cards.length-1;
    
    const tEl = qs('#fc-title'); if (tEl) tEl.textContent = this.flipped ? 'Nhấn để xem mặt trước' : 'Nhấn thẻ để xem giải thích!';
    const kc = qs('#fc-known-count'); if (kc) kc.textContent = this.known.length.toString();
    const ukc = qs('#fc-unknown-count'); if (ukc) ukc.textContent = this.unknown.length.toString();
  },

  flip() {
    this.flipped = !this.flipped;
    qs('#fc-card')?.classList.toggle('flipped', this.flipped);
    const tEl = qs('#fc-title'); if (tEl) tEl.textContent = this.flipped ? 'Nhấn để xem mặt trước' : 'Nhấn thẻ để xem giải thích!';
  },

  prev() { if (this.idx > 0) { this.idx--; this.renderCard(); } },
  next() {
    if (this.idx < this.cards.length-1) { this.idx++; this.renderCard(); }
    else this.finish();
  },

  markCard(isKnown: boolean) {
    if (isKnown) { if (!this.known.includes(this.idx)) this.known.push(this.idx); }
    else { if (!this.unknown.includes(this.idx)) this.unknown.push(this.idx); }
    this.next();
  },

  finish() {
    StudentView.saveAnswer('flashcards', { known: this.known.length, unknown: this.unknown.length, total: this.cards.length });
    if (this.known.length === this.cards.length) {
      showSuccess('⭐', 'Xuất sắc!', 'Bạn đã nhớ tất cả các thẻ!', `${this.known.length}/${this.cards.length} thẻ`);
    } else {
      showToast(`✅ Hoàn thành! Nhớ ${this.known.length}/${this.cards.length} thẻ`, 'success');
    }
  }
};
