/**
 * FlashcardGame — 3D flip cards with spaced repetition tracking
 */
import { BaseGame } from './BaseGame.js';
import { escHTML, shuffle } from '../utils/helpers.js';

export class FlashcardGame extends BaseGame {
  gameKey   = 'flashcard';
  gameTitle = 'Flashcards';
  gameIcon  = '🃏';

  #cards    = [];
  #queue    = [];  // Spaced repetition queue
  #idx      = 0;
  #flipped  = false;
  #known    = new Set();
  #unknown  = new Set();
  #swipeStartX = 0;

  setup() {
    this.#cards = shuffle(this.state('lesson.questions.flashcards') ?? []);
    if (!this.#cards.length) {
      this.body.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🃏</div><h3>Chưa có flashcard</h3></div>`;
      return;
    }
    this.#queue  = [...this.#cards.map((_, i) => i)];
    this.maxScore = this.#cards.length * 10;
    this.#render();
    this.#attachEvents();
  }

  #render() {
    const card   = this.#cards[this.#currentIdx()];
    const total  = this.#cards.length;
    const doneCount = this.#known.size + this.#unknown.size;
    const pct    = Math.round((this.#known.size / total) * 100);

    this.body.innerHTML = `
      <div class="flashcard-stage">

        <div style="width:100%;max-width:500px">
          <div class="flashcard-progress-row">
            <span style="font-weight:700;font-size:.85rem;color:var(--color-muted)">${doneCount}/${total}</span>
            <div class="fc-progress-bar">
              <div class="fc-progress-fill" style="width:${pct}%"></div>
            </div>
            <span style="font-weight:700;font-size:.85rem;color:var(--color-mint)">${pct}%</span>
          </div>
        </div>

        <p style="font-size:.82rem;font-weight:700;color:var(--color-muted);text-align:center">
          Nhấn thẻ để lật • Dùng ← → để chuyển thẻ
        </p>

        <div class="flashcard-wrap" id="fc-wrap" role="button" aria-label="Lật thẻ flashcard" tabindex="0">
          <div class="flashcard" id="fc-card">
            <div class="flashcard-face flashcard-front">
              <p class="flashcard-face-label">📌 Thuật ngữ</p>
              <h3 class="flashcard-term">${escHTML(card?.term ?? '')}</h3>
              <p class="flashcard-hint-tip">👆 Nhấn để xem giải thích</p>
            </div>
            <div class="flashcard-face flashcard-back">
              <p class="flashcard-face-label">💡 Giải thích</p>
              <p class="flashcard-def">${escHTML(card?.definition ?? '')}</p>
              <p class="flashcard-hint-tip">👆 Nhấn để xem lại thuật ngữ</p>
            </div>
          </div>
        </div>

        <div class="fc-known-row">
          <button class="btn-fc-unknown" id="fc-unknown" aria-label="Chưa nhớ">
            😅 Chưa nhớ
          </button>
          <button class="btn-fc-known" id="fc-known" aria-label="Đã nhớ">
            😄 Đã nhớ!
          </button>
        </div>

        <div class="flashcard-nav">
          <button class="fc-btn-nav" id="fc-prev" aria-label="Thẻ trước" ${this.#idx === 0 ? 'disabled' : ''}>◀</button>
          <span class="fc-counter">${this.#idx + 1} / ${total}</span>
          <button class="fc-btn-nav" id="fc-next" aria-label="Thẻ tiếp">▶</button>
        </div>

        <div class="fc-legend">
          <span>😄 Đã nhớ: <strong style="color:var(--color-mint)">${this.#known.size}</strong></span>
          <span>😅 Chưa nhớ: <strong style="color:var(--color-coral)">${this.#unknown.size}</strong></span>
        </div>
      </div>
    `;
  }

  #attachEvents() {
    const wrap = this.qs('#fc-wrap');
    const card = this.qs('#fc-card');
    if (!wrap || !card) return;

    // Click/tap to flip
    wrap.addEventListener('click', () => this.#flip());
    wrap.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); this.#flip(); } });

    // Swipe support
    wrap.addEventListener('touchstart', (e) => { this.#swipeStartX = e.touches[0].clientX; }, { passive: true });
    wrap.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - this.#swipeStartX;
      if (Math.abs(dx) > 50) { dx < 0 ? this.#next() : this.#prev(); }
    }, { passive: true });

    // Nav buttons
    this.qs('#fc-prev')?.addEventListener('click', () => this.#prev());
    this.qs('#fc-next')?.addEventListener('click', () => this.#next());
    this.qs('#fc-known')?.addEventListener('click', () => this.#markKnown());
    this.qs('#fc-unknown')?.addEventListener('click', () => this.#markUnknown());

    // Keyboard
    document.addEventListener('keydown', this.#onKey.bind(this));
    // Store cleanup
    this._keyCleanup = () => document.removeEventListener('keydown', this.#onKey.bind(this));
  }

  #onKey(e) {
    if (!this.body) { this._keyCleanup?.(); return; }
    if (e.key === 'ArrowLeft')  this.#prev();
    if (e.key === 'ArrowRight') this.#next();
    if (e.key === 'y' || e.key === 'Y') this.#markKnown();
    if (e.key === 'n' || e.key === 'N') this.#markUnknown();
    if (e.key === ' ') { e.preventDefault(); this.#flip(); }
  }

  #flip() {
    this.#flipped = !this.#flipped;
    this.qs('#fc-card')?.classList.toggle('flipped', this.#flipped);
  }

  #currentIdx() { return this.#queue[this.#idx] ?? this.#idx; }

  #prev() {
    if (this.#idx > 0) { this.#idx--; this.#flipped = false; this.#render(); this.#attachEvents(); }
  }

  #next() {
    if (this.#idx < this.#cards.length - 1) {
      this.#idx++;
      this.#flipped = false;
      this.#render();
      this.#attachEvents();
    } else {
      this.#finish();
    }
  }

  #markKnown() {
    const idx = this.#currentIdx();
    this.#known.add(idx);
    this.#unknown.delete(idx);
    this.addScore(10);
    this.#next();
  }

  #markUnknown() {
    const idx = this.#currentIdx();
    this.#unknown.add(idx);
    // Re-queue this card at the end (spaced repetition)
    if (!this.#queue.slice(this.#idx + 1).includes(idx)) this.#queue.push(idx);
    this.#next();
  }

  #finish() {
    const knownPct = Math.round((this.#known.size / this.#cards.length) * 100);
    this.complete(`Nhớ ${this.#known.size}/${this.#cards.length} thẻ (${knownPct}%)`);
  }

  getAnswerData() {
    return {
      known:   [...this.#known].map(i => this.#cards[i]?.term),
      unknown: [...this.#unknown].map(i => this.#cards[i]?.term),
      total:   this.#cards.length,
    };
  }

  state(path) {
    const { store } = window.__eduplay__;
    return store.get(path);
  }
  destroy() {
    this._keyCleanup?.();
    super.destroy();
  }
}
