/**
 * EduPlay Store
 * Centralized reactive state management with dot-path support.
 */

export interface LessonSection {
  id: string;
  name: string;
  icon: string;
  color: string;
  videos: string[];
  images?: string[];
  lecture?: string;
  completed?: boolean;
}

export interface Flashcard { term: string; definition: string; }
export interface Wordle { word: string; hint: string; }
export interface MemoryPair { cardA: string; cardB: string; }
export interface FillBlank { sentence: string; answer: string; hint: string; }
export interface MultipleChoice { question: string; options: string[]; correct: number; explanation?: string; }

export interface Questions {
  flashcards: Flashcard[];
  wordle: Wordle[];
  memory: MemoryPair[];
  fillBlank: FillBlank[];
  multipleChoice: MultipleChoice[];
}

export interface AppConfig {
  geminiKey: string;
  r2AccountId?: string;
  r2AccessKey?: string;
  r2SecretKey?: string;
  r2Bucket?: string;
  r2PublicUrl?: string;
}

export interface AppState {
  lesson: {
    title: string;
    subject: string;
    grade: string;
    description: string;
    sections: LessonSection[];
    documentText: string;
    questions: Questions;
    generatedAt?: number | null;
  };
  config: AppConfig;
  student: {
    name: string;
    sessionId: string;
    answers: Record<string, any>;
    scores: Record<string, any>;
    completedGames: Set<string> | string[]; // Set is better, but JSON needs string[]
    sectionProgress: boolean[];
    startedAt: number | null;
  };
  ui: {
    currentView: string;
    teacherStep: number;
    studentSection: number;
    studentVideo: number;
    activeGame: string | null;
    isGenerating: boolean;
    isSubmitting: boolean;
  };
}

const INITIAL_STATE: AppState = {
  lesson: {
    title: '', subject: '', grade: '', description: '',
    sections: [
      { id: 's1', name: 'Mở bài',     icon: '🚀', color: '#1565C0', videos: [] },
      { id: 's2', name: 'Thân bài 1', icon: '📖', color: '#2E7D32', videos: [] },
      { id: 's3', name: 'Thân bài 2', icon: '🔬', color: '#6A1B9A', videos: [] },
      { id: 's4', name: 'Kết luận',   icon: '🎯', color: '#E65100', videos: [] },
    ],
    documentText: '',
    questions: { flashcards: [], wordle: [], memory: [], fillBlank: [], multipleChoice: [] },
    generatedAt: null
  },
  config: {
    geminiKey: '',
  },
  student: {
    name: '',
    sessionId: '',
    answers: {},
    scores: {},
    completedGames: [],
    sectionProgress: [false, false, false, false],
    startedAt: null
  },
  ui: {
    currentView: 'home',
    teacherStep: 1,
    studentSection: 0,
    studentVideo: 0,
    activeGame: null,
    isGenerating: false,
    isSubmitting: false
  }
};

export type StoreHandler = (newValue: any, prevValue: any) => void;

export class Store {
  #state: AppState;
  #subscribers = new Map<string, Set<StoreHandler>>();

  constructor(initial: AppState = INITIAL_STATE) {
    this.#state = this.#deepClone(initial);
  }

  get(path: string): any {
    return path.split('.').reduce((obj: any, key) => obj?.[key], this.#state);
  }

  set(path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    let target = this.#state as any;

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
    keys.forEach((_, i) => {
      const parentPath = keys.slice(0, i + 1).join('.');
      this.#notify(parentPath, this.get(parentPath), undefined);
    });
  }

  update(path: string, updater: (current: any) => any): void {
    const current = this.get(path);
    const next = updater(this.#deepClone(current));
    this.set(path, next);
  }

  subscribe(path: string, handler: StoreHandler): () => void {
    if (!this.#subscribers.has(path)) {
      this.#subscribers.set(path, new Set());
    }
    this.#subscribers.get(path)!.add(handler);
    // Immediate call
    handler(this.get(path), undefined);
    return () => this.#subscribers.get(path)?.delete(handler);
  }

  snapshot(): AppState {
    return this.#deepClone(this.#state);
  }

  #notify(path: string, value: any, prev: any): void {
    this.#subscribers.get(path)?.forEach(fn => {
      try { fn(value, prev); }
      catch (e) { console.error(`[Store] Subscriber error for "${path}":`, e); }
    });
  }

  #deepClone<T>(obj: T): T {
    if (obj instanceof Set) return new Set(obj) as any;
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => this.#deepClone(item)) as any;
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, this.#deepClone(v)])
    ) as any;
  }

  resetStudent(): void {
    this.set('student', {
      name:            this.get('student.name'),
      sessionId:       crypto.randomUUID?.() || Math.random().toString(36).slice(2),
      answers:         {},
      scores:          {},
      completedGames:  [],
      sectionProgress: [false, false, false, false],
      startedAt:       Date.now(),
    });
  }

  loadLesson(lessonData: Partial<AppState['lesson']>): void {
    const merged = { ...this.#deepClone(INITIAL_STATE.lesson), ...lessonData };
    this.set('lesson', merged);
  }
}

export const store = new Store();
