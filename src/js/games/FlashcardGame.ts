/**
 * FlashcardGame — 3D flip cards with spaced repetition tracking
 */
import { BaseGame } from './BaseGame';
import { store } from '../core/Store';
import { escHTML, shuffle } from '../utils/helpers';

export class FlashcardGame extends BaseGame {
  override gameKey = 'flashcard';
  override gameTitle = 'Flashcards';
  override gameIcon = '🃏';

  #cards: any[] = [];
  #queue: number[] = [];  // Spaced repetition queue
  #idx = 0;
  #flipped = false;
  #known = new Set<number>();
  #unknown = new Set<number>();
  #swipeStartX = 0;

  #boundOnKey: ((e: KeyboardEvent) => void) | null = null;

  override setup(): void {
    this.#cards = shuffle(store.get('lesson.questions.flashcards') ?? []);
    if (!this.#cards.length) {
      if (this.body) this.body.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🃏</div><h3>Chưa có flashcard</h3></div>`;
      return;
    }
    this.#queue = [...this.#cards.map((_, i) => i)];
    this.maxScore = this.#cards.length * 10;
    this.#render();
    this.#attachEvents();
  }

  #render(): void {
    if (!this.body) return;
    const card = this.#cards[this.#currentIdx()];
    const total = this.#cards.length;
    const doneCount = this.#known.size + this.#unknown.size;
    const pct = Math.round((this.#known.size / total) * 100);

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

  #attachEvents(): void {
    const wrap = this.qs('#fc-wrap');
    if (!wrap) return;

    // Click/tap to flip
    wrap.addEventListener('click', () => this.#flip());
    wrap.addEventListener('keydown', (e: any) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); this.#flip(); } });

    // Swipe support
    wrap.addEventListener('touchstart', (e: any) => { this.#swipeStartX = e.touches[0].clientX; }, { passive: true });
    wrap.addEventListener('touchend', (e: any) => {
      const dx = e.changedTouches[0].clientX - this.#swipeStartX;
      if (Math.abs(dx) > 50) { dx < 0 ? this.#next() : this.#prev(); }
    }, { passive: true });

    // Nav buttons
    this.qs('#fc-prev')?.addEventListener('click', () => this.#prev());
    this.qs('#fc-next')?.addEventListener('click', () => this.#next());
    this.qs('#fc-known')?.addEventListener('click', () => this.#markKnown());
    this.qs('#fc-unknown')?.addEventListener('click', () => this.#markUnknown());

    // Keyboard
    if (!this.#boundOnKey) {
        this.#boundOnKey = this.#onKey.bind(this);
        document.addEventListener('keydown', this.#boundOnKey);
    }
  }

  #onKey(e: KeyboardEvent): void {
    if (!this.body) { this.#removeKeyHandler(); return; }
    if (e.key === 'ArrowLeft')  this.#prev();
    if (e.key === 'ArrowRight') this.#next();
    if (e.key === 'y' || e.key === 'Y') this.#markKnown();
    if (e.key === 'n' || e.key === 'N') this.#markUnknown();
    if (e.key === ' ') { e.preventDefault(); this.#flip(); }
  }

  #removeKeyHandler(): void {
    if (this.#boundOnKey) {
        document.removeEventListener('keydown', this.#boundOnKey);
        this.#boundOnKey = null;
    }
  }

  #flip(): void {
    this.#flipped = !this.#flipped;
    this.qs('#fc-card')?.classList.toggle('flipped', this.#flipped);
  }

  #currentIdx(): number { return this.#queue[this.#idx] ?? this.#idx; }

  #prev(): void {
    if (this.#idx > 0) { this.#idx--; this.#flipped = false; this.#render(); this.#attachEvents(); }
  }

  #next(): void {
    if (this.#idx < this.#cards.length - 1) {
      this.#idx++;
      this.#flipped = false;
      this.#render();
      this.#attachEvents();
    } else {
      this.#finish();
    }
  }

  #markKnown(): void {
    const idx = this.#currentIdx();
    this.#known.add(idx);
    this.#unknown.delete(idx);
    this.addScore(10);
    this.#next();
  }

  #markUnknown(): void {
    const idx = this.#currentIdx();
    this.#unknown.add(idx);
    if (!this.#queue.slice(this.#idx + 1).includes(idx)) this.#queue.push(idx);
    this.#next();
  }

  #finish(): void {
    const knownPct = Math.round((this.#known.size / this.#cards.length) * 100);
    this.complete(`Nhớ ${this.#known.size}/${this.#cards.length} thẻ (${knownPct}%)`);
  }

  override getAnswerData(): any {
    return {
      known:   [...this.#known].map(i => this.#cards[i]?.term),
      unknown: [...this.#unknown].map(i => this.#cards[i]?.term),
      total:   this.#cards.length,
    };
  }

  override destroy(): void {
    this.#removeKeyHandler();
    super.destroy();
  }
}
