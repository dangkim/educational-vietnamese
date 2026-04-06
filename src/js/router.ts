import { AppState } from './state';
import { fromBase64, showToast } from './utils';

// We will import these types later
let teacherInit: () => void;
let studentInit: () => void;

export const Router = {
  setup(initTeacher: () => void, initStudent: () => void) {
    teacherInit = initTeacher;
    studentInit = initStudent;
  },

  navigate(view: 'home' | 'teacher' | 'student') {
    document.getElementById('view-home')?.classList.add('hidden');
    document.getElementById('view-teacher')?.classList.add('hidden');
    document.getElementById('view-student')?.classList.add('hidden');

    document.getElementById(`view-${view}`)?.classList.remove('hidden');

    if (view === 'teacher') {
      teacherInit?.();
    } else if (view === 'student') {
      studentInit?.();
    }
  },

  loadFromURL() {
    const hash = window.location.hash.slice(1);
    if (hash) {
      const lesson = fromBase64<any>(hash);
      if (lesson) {
        AppState.updateLesson(lesson);
        localStorage.setItem('eduplay-lesson', hash);
        this.navigate('student');
        return;
      }
    }
    showToast('Không tìm thấy bài học trong link!', 'error');
  }
};
