/**
 * EduPlay BaseGame
 * Abstract base class for all game types.
 * Provides: scoring, timer, progress tracking, lifecycle hooks.
 */
import { bus, Events } from '../core/EventBus.js';
import { store } from '../core/Store.js';
import { calcStars, starsDisplay, formatTime } from '../utils/helpers.js';

export class BaseGame {
  /** @type {HTMLElement} */
  container = null;
  gameKey   = 'base';
  gameTitle = 'Game';
  gameIcon  = '🎮';

  // Scoring
  score    = 0;
  maxScore = 0;

  // Timer
  #timerEl     = null;
  #timerInterval = null;
  #seconds     = 0;
  #timerActive = false;

  // State
  _answers = [];
  _isComplete = false;

  /**
   * @param {HTMLElement} container
   */
  init(container) {
    this.container  = container;
    this._answers   = [];
    this._isComplete= false;
    this.score      = 0;
    this.#seconds   = 0;
    this.container.innerHTML = this.#buildShell();
    this.#timerEl = this.container.querySelector('.game-timer-val');
    this.setup();
    this.startTimer();
  }

  /** Override in subclass: build game content into .game-body */
  setup() {}

  /** Override: return answer data object */
  getAnswerData() { return { answers: this._answers }; }

  /** Override: called when game needs destruction */
  destroy() {
    this.stopTimer();
    this.container = null;
  }

  // ─── Scoring ──────────────────────────────────────────────────────────────

  addScore(pts) {
    this.score = Math.min(this.score + pts, this.maxScore || Infinity);
    this.updateScoreDisplay();
  }

  get percentage() {
    return this.maxScore > 0 ? Math.round((this.score / this.maxScore) * 100) : 0;
  }

  get stars() { return calcStars(this.percentage); }

  updateScoreDisplay() {
    const el = this.container?.querySelector('.game-score-val');
    if (el) el.textContent = this.score;
  }

  // ─── Timer ────────────────────────────────────────────────────────────────

  startTimer() {
    this.#timerActive = true;
    this.#timerInterval = setInterval(() => {
      this.#seconds++;
      if (this.#timerEl) this.#timerEl.textContent = formatTime(this.#seconds);
    }, 1000);
  }

  stopTimer() {
    this.#timerActive = false;
    clearInterval(this.#timerInterval);
    this.#timerInterval = null;
  }

  get elapsedSeconds() { return this.#seconds; }

  // ─── Completion ───────────────────────────────────────────────────────────

  complete(message = '') {
    if (this._isComplete) return;
    this._isComplete = true;
    this.stopTimer();

    const answerData = {
      gameKey:  this.gameKey,
      score:    this.score,
      maxScore: this.maxScore,
      stars:    this.stars,
      pct:      this.percentage,
      time:     this.#seconds,
      data:     this.getAnswerData(),
    };

    // Persist to store
    store.update('student.answers', (ans) => ({ ...ans, [this.gameKey]: answerData }));
    store.update('student.scores',  (sc)  => ({ ...sc,  [this.gameKey]: { score: this.score, maxScore: this.maxScore, stars: this.stars } }));
    store.update('student.completedGames', (set) => { set.add(this.gameKey); return set; });

    bus.emit(Events.GAME_COMPLETE, answerData);
    bus.emit(Events.SUCCESS_SHOW, {
      icon:    this.#getCompletionIcon(this.stars),
      title:   this.#getCompletionTitle(this.stars),
      message: message || `${this.gameTitle} hoàn thành trong ${formatTime(this.#seconds)}`,
      score:   this.percentage,
      detail:  `${this.score}/${this.maxScore} điểm`,
    });
  }

  #getCompletionIcon(stars) {
    return ['💪', '⭐', '🏆'][stars - 1] ?? '🎉';
  }
  #getCompletionTitle(stars) {
    return ['Cố gắng hơn nhé!', 'Làm tốt lắm!', 'Xuất sắc!'][stars - 1] ?? 'Hoàn thành!';
  }

  // ─── Shell HTML ───────────────────────────────────────────────────────────

  #buildShell() {
    return `
      <div class="game-container">
        <div class="game-header">
          <span class="game-header-icon">${this.gameIcon}</span>
          <h3 class="game-header-title">${this.gameTitle}</h3>
          <div class="game-progress">
            <div class="stat-chip">
              ⏱ <span class="game-timer-val">0:00</span>
            </div>
            <div class="stat-chip">
              ⭐ <span class="game-score-val">0</span>
            </div>
          </div>
        </div>
        <div class="game-body" id="game-body-${this.gameKey}"></div>
      </div>
    `;
  }

  /** Helper: get the game body element */
  get body() {
    return this.container?.querySelector(`#game-body-${this.gameKey}`);
  }

  /** Helper: query inside container */
  qs(sel) { return this.container?.querySelector(sel); }
  qsAll(sel) { return this.container?.querySelectorAll(sel) ?? []; }
}
