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
    if (!hash) return;

    if (hash.startsWith('r2:')) {
      this.loadFromR2(hash);
      return;
    }

    const lesson = fromBase64<any>(hash);
    if (lesson) {
      AppState.updateLesson(lesson);
      localStorage.setItem('eduplay-lesson', hash);
      this.navigate('student');
    } else {
      showToast('Không tìm thấy bài học trong link!', 'error');
    }
  },

  async loadFromR2(hash: string) {
    const parts = hash.split(':');
    if (parts.length < 3) return;
    const domain = parts[1];
    const lessonId = parts[2];
    
    // Use domain directly as it's extracted correctly in TeacherView
    const url = `https://${domain}/lessons/${lessonId}.json`;

    showToast('⏳ Đang tải bài học từ R2...', '', 10000);
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error();
      const lesson = await resp.json();
      AppState.updateLesson(lesson);
      localStorage.setItem('eduplay-lesson', btoa(JSON.stringify(lesson))); // Optional: backup as base64
      this.navigate('student');
      showToast('✅ Tải bài học thành công!', 'success');
    } catch (e) {
      showToast('❌ Không thể tải bài học từ R2. Hãy kiểm tra lại Public URL và CORS!', 'error', 5000);
    }
  }
};
