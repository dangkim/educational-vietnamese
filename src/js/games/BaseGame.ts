/**
 * EduPlay BaseGame
 * Abstract base class for all game types.
 * Provides: scoring, timer, progress tracking, lifecycle hooks.
 */
import { bus, Events } from '../core/EventBus';
import { store } from '../core/Store';
import { calcStars, formatTime } from '../utils/helpers';

export interface GameResult {
  gameKey: string;
  score: number;
  maxScore: number;
  stars: number;
  pct: number;
  time: number;
  data: any;
}

export abstract class BaseGame {
  container: HTMLElement | null = null;
  gameKey = 'base';
  gameTitle = 'Game';
  gameIcon = '🎮';

  // Scoring
  score = 0;
  maxScore = 0;

  // Timer
  #timerEl: HTMLElement | null = null;
  #timerInterval: any = null;
  #seconds = 0;
  #timerActive = false;

  // State
  _answers: any[] = [];
  _isComplete = false;

  constructor() {}

  init(container: HTMLElement): void {
    this.container = container;
    this._answers = [];
    this._isComplete = false;
    this.score = 0;
    this.#seconds = 0;
    this.container.innerHTML = this.#buildShell();
    this.#timerEl = this.container.querySelector('.game-timer-val');
    this.setup();
    this.startTimer();
  }

  /** Override in subclass: build game content into .game-body */
  abstract setup(): void;

  /** Override: return answer data object */
  getAnswerData(): any { return { answers: this._answers }; }

  /** Override: called when game needs destruction */
  destroy(): void {
    this.stopTimer();
    this.container = null;
  }

  // ─── Scoring ──────────────────────────────────────────────────────────────

  addScore(pts: number): void {
    this.score = Math.min(this.score + pts, this.maxScore || Infinity);
    this.updateScoreDisplay();
  }

  get percentage(): number {
    return this.maxScore > 0 ? Math.round((this.score / this.maxScore) * 100) : 0;
  }

  get stars(): number { return calcStars(this.percentage); }

  updateScoreDisplay(): void {
    const el = this.container?.querySelector('.game-score-val');
    if (el) el.textContent = String(this.score);
  }

  // ─── Timer ────────────────────────────────────────────────────────────────

  startTimer(): void {
    this.#timerActive = true;
    this.#timerInterval = setInterval(() => {
      this.#seconds++;
      if (this.#timerEl) this.#timerEl.textContent = formatTime(this.#seconds);
    }, 1000);
  }

  stopTimer(): void {
    this.#timerActive = false;
    clearInterval(this.#timerInterval);
    this.#timerInterval = null;
  }

  get elapsedSeconds(): number { return this.#seconds; }

  // ─── Completion ───────────────────────────────────────────────────────────

  complete(message = ''): void {
    if (this._isComplete) return;
    this._isComplete = true;
    this.stopTimer();

    const answerData: GameResult = {
      gameKey:  this.gameKey,
      score:    this.score,
      maxScore: this.maxScore,
      stars:    this.stars,
      pct:      this.percentage,
      time:     this.#seconds,
      data:     this.getAnswerData(),
    };

    // Persist to store
    store.update('student.answers', (ans: any) => ({ ...ans, [this.gameKey]: answerData }));
    store.update('student.scores', (sc: any) => ({ ...sc, [this.gameKey]: { score: this.score, maxScore: this.maxScore, stars: this.stars } }));
    store.update('student.completedGames', (games: string[] | Set<string>) => {
      if (Array.isArray(games)) {
        if (!games.includes(this.gameKey)) games.push(this.gameKey);
        return games;
      } else {
        games.add(this.gameKey);
        return games;
      }
    });

    bus.emit(Events.GAME_COMPLETE, answerData);
    bus.emit(Events.SUCCESS_SHOW, {
      icon:    this.#getCompletionIcon(this.stars),
      title:   this.#getCompletionTitle(this.stars),
      message: message || `${this.gameTitle} hoàn thành trong ${formatTime(this.#seconds)}`,
      score:   this.percentage,
      detail:  `${this.score}/${this.maxScore} điểm`,
    });
  }

  #getCompletionIcon(stars: number): string {
    return ['💪', '⭐', '🏆'][stars - 1] ?? '🎉';
  }
  #getCompletionTitle(stars: number): string {
    return ['Cố gắng hơn nhé!', 'Làm tốt lắm!', 'Xuất sắc!'][stars - 1] ?? 'Hoàn thành!';
  }

  // ─── Shell HTML ───────────────────────────────────────────────────────────

  #buildShell(): string {
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
  get body(): HTMLElement | null {
    return this.container?.querySelector(`#game-body-${this.gameKey}`) ?? null;
  }

  /** Helper: query inside container */
  protected qs<T extends HTMLElement>(sel: string): T | null {
    return this.container?.querySelector(sel) ?? null;
  }

  protected qsAll<T extends HTMLElement>(sel: string): NodeListOf<T> | [] {
    return this.container?.querySelectorAll(sel) ?? [];
  }
}
