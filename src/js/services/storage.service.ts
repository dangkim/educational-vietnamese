import { AppState } from '../state';

export const StorageService = {
  saveTeacherState() {
    const state = AppState.get();
    localStorage.setItem('eduplay-teacher', JSON.stringify({ 
      lesson: state.lesson, 
      config: state.config 
    }));
  },

  loadTeacherState() {
    const saved = localStorage.getItem('eduplay-teacher');
    if (saved) {
      try {
        const d = JSON.parse(saved);
        if (d.lesson) AppState.updateLesson(d.lesson);
        if (d.config) AppState.updateConfig(d.config);
      } catch (e) {
        console.error('Failed to parse teacher state', e);
      }
    }
  },

  saveLessonToUrl() {
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(AppState.get().lesson))));
    localStorage.setItem('eduplay-lesson', encoded);
    return encoded;
  },

  loadLessonLocally() {
    const saved = localStorage.getItem('eduplay-lesson');
    if (saved) {
      try {
        const lesson = JSON.parse(decodeURIComponent(escape(atob(saved))));
        if (lesson) AppState.updateLesson(lesson);
      } catch(e) {
        console.error('Failed to parse lesson state', e);
      }
    }
  }
};
