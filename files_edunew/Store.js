/**
 * EduPlay Store
 * Centralized reactive state management.
 * Supports typed state, subscriber pattern, and deep cloning.
 */
import { bus } from './EventBus.js';

const INITIAL_STATE = {
  // Lesson data
  lesson: {
    title:       '',
    subject:     '',
    grade:       '',
    description: '',
    sections: [
      { id: 's1', name: 'Mở bài',    icon: '🚀', color: '#1565C0', videos: [] },
      { id: 's2', name: 'Thân bài 1',icon: '📖', color: '#2E7D32', videos: [] },
      { id: 's3', name: 'Thân bài 2',icon: '🔬', color: '#6A1B9A', videos: [] },
      { id: 's4', name: 'Kết luận',  icon: '🎯', color: '#E65100', videos: [] },
    ],
    documentText: '',
    questions: {
      flashcards:     [],
      wordle:         [],
      memory:         [],
      fillBlank:      [],
      multipleChoice: [],
    },
    generatedAt: null,
  },

  // App config (teacher settings)
  config: {
    geminiKey:   '',
    r2AccountId: '',
    r2AccessKey: '',
    r2SecretKey: '',
    r2Bucket:    '',
    r2PublicUrl: '',
  },

  // Student session
  student: {
    name:           '',
    sessionId:      '',
    answers:        {},        // { gameKey: { ... } }
    scores:         {},        // { gameKey: { score, maxScore, stars } }
    completedGames: new Set(),
    sectionProgress:[false, false, false, false],
    startedAt:      null,
  },

  // UI state
  ui: {
    currentView:   'home',
    teacherStep:   1,
    studentSection:0,
    studentVideo:  0,
    activeGame:    null,
    isGenerating:  false,
    isSubmitting:  false,
  },
};

export class Store {
  #state;
  /** @type {Map<string, Set<Function>>} */
  #subscribers = new Map();

  constructor(initial = INITIAL_STATE) {
    this.#state = this.#deepClone(initial);
  }

  /**
   * Get a value from state using dot notation.
   * @param {string} path - e.g. 'lesson.title' or 'ui.currentView'
   * @returns {*}
   */
  get(path) {
    return path.split('.').reduce((obj, key) => obj?.[key], this.#state);
  }

  /**
   * Set a value and notify subscribers.
   * @param {string} path
   * @param {*} value
   */
  set(path, value) {
    const keys   = path.split('.');
    const lastKey= keys.pop();
    let   target = this.#state;

    for (const k of keys) {
      if (target[k] === undefined || target[k] === null) {
        target[k] = {};
      }
      target = target[k];
    }

    const prev = target[lastKey];
    target[lastKey] = value;

    this.#notify(path, value, prev);
    // Also notify parent paths
    keys.forEach((_, i) => this.#notify(keys.slice(0, i + 1).join('.'), this.get(keys.slice(0, i + 1).join('.')), undefined));
  }

  /**
   * Update using a function (for objects/arrays).
   * @param {string} path
   * @param {Function} updater
   */
  update(path, updater) {
    const current = this.get(path);
    const next    = updater(this.#deepClone(current));
    this.set(path, next);
  }

  /**
   * Subscribe to a state path.
   * @param {string} path
   * @param {Function} handler - called with (newValue, prevValue)
   * @returns {Function} unsubscribe
   */
  subscribe(path, handler) {
    if (!this.#subscribers.has(path)) this.#subscribers.set(path, new Set());
    this.#subscribers.get(path).add(handler);
    // Immediate call with current value
    handler(this.get(path), undefined);
    return () => this.#subscribers.get(path)?.delete(handler);
  }

  /**
   * Get a snapshot of the full state (deep clone).
   */
  snapshot() {
    return this.#deepClone(this.#state);
  }

  /**
   * Reset student session state.
   */
  resetStudent() {
    this.set('student', {
      name:            this.get('student.name'),
      sessionId:       crypto.randomUUID?.() || Math.random().toString(36).slice(2),
      answers:         {},
      scores:          {},
      completedGames:  new Set(),
      sectionProgress: [false, false, false, false],
      startedAt:       Date.now(),
    });
  }

  /**
   * Merge a partial lesson object (e.g. from URL hash).
   */
  loadLesson(lessonData) {
    const merged = { ...this.#deepClone(INITIAL_STATE.lesson), ...lessonData };
    this.set('lesson', merged);
  }

  /**
   * Persist critical state to localStorage.
   */
  persist() {
    try {
      const data = {
        lesson:  this.get('lesson'),
        config:  this.get('config'),
        version: '1.0',
      };
      localStorage.setItem('eduplay_state', JSON.stringify(data));
    } catch (e) {
      console.warn('[Store] Failed to persist state:', e.message);
    }
  }

  /**
   * Restore state from localStorage.
   */
  restore() {
    try {
      const raw = localStorage.getItem('eduplay_state');
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (data.lesson) this.set('lesson', { ...INITIAL_STATE.lesson, ...data.lesson });
      if (data.config) this.set('config', { ...INITIAL_STATE.config, ...data.config });
      return true;
    } catch (e) {
      console.warn('[Store] Failed to restore state:', e.message);
      return false;
    }
  }

  // --- Private ---

  #notify(path, value, prev) {
    this.#subscribers.get(path)?.forEach(fn => {
      try { fn(value, prev); }
      catch (e) { console.error(`[Store] Subscriber error for "${path}":`, e); }
    });
  }

  #deepClone(obj) {
    if (obj instanceof Set) return new Set(obj);
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => this.#deepClone(item));
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, this.#deepClone(v)])
    );
  }
}

// Singleton store instance
export const store = new Store();
