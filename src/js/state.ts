export interface LessonSection {
  id: string;
  name: string;
  icon: string;
  color: string;
  videos: string[];
  lecture?: string;
  completed: boolean;
}

export interface Flashcard { term: string; definition: string; }
export interface Wordle { word: string; hint: string; }
export interface MemoryPair { cardA: string; cardB: string; }
export interface FillBlank { sentence: string; answer: string; hint: string; }
export interface MultipleChoice { question: string; options: string[]; correct: number; explanation: string; }

export interface Questions {
  flashcards: Flashcard[];
  wordle: Wordle[];
  memory: MemoryPair[];
  fillBlank: FillBlank[];
  multipleChoice: MultipleChoice[];
}

export interface AppStateData {
  lesson: {
    title: string;
    subject: string;
    grade: string;
    description: string;
    sections: LessonSection[];
    documentText: string;
    questions: Questions;
  };
  config: {
    geminiKey: string;
    r2AccountId: string;
    r2AccessKey: string;
    r2SecretKey: string;
    r2Bucket: string;
    r2PublicDomain: string;
  };
  student: {
    name: string;
    answers: Record<string, any>;
    completedGames: Record<string, boolean>;
  };
  currentSection: number;
  currentVideo: number;
  activeGame: string | null;
}

type EventCallback = (state: AppStateData) => void;

class StateManager {
  private state: AppStateData = {
    lesson: {
      title: '', subject: '', grade: '', description: '',
      sections: [
        { id: 's1', name: 'Mở bài', icon: '🚀', color: '#1565C0', videos: [], completed: false },
        { id: 's2', name: 'Thân bài 1', icon: '📖', color: '#2E7D32', videos: [], completed: false },
        { id: 's3', name: 'Thân bài 2', icon: '🔬', color: '#6A1B9A', videos: [], completed: false },
        { id: 's4', name: 'Kết luận', icon: '🎯', color: '#E65100', videos: [], completed: false }
      ],
      documentText: '',
      questions: { flashcards: [], wordle: [], memory: [], fillBlank: [], multipleChoice: [] }
    },
    config: { geminiKey: '', r2AccountId: '', r2AccessKey: '', r2SecretKey: '', r2Bucket: '', r2PublicDomain: '' },
    student: { name: '', answers: {}, completedGames: {} },
    currentSection: 0,
    currentVideo: 0,
    activeGame: null
  };

  private listeners: Record<string, EventCallback[]> = {};

  get(): AppStateData {
    return this.state;
  }

  set(updates: Partial<AppStateData>, eventName?: string) {
    this.state = { ...this.state, ...updates };
    if (eventName) this.emit(eventName);
  }

  updateLesson(updates: Partial<AppStateData['lesson']>, eventName?: string) {
    this.state.lesson = { ...this.state.lesson, ...updates };
    if (eventName) this.emit(eventName);
  }

  updateConfig(updates: Partial<AppStateData['config']>, eventName?: string) {
    this.state.config = { ...this.state.config, ...updates };
    if (eventName) this.emit(eventName);
  }

  on(event: string, callback: EventCallback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  emit(event: string) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(this.state));
    }
  }
}

export const AppState = new StateManager();
