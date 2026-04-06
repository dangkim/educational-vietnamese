import '../css/main.css';
import { AppState } from './state';
import { Router } from './router';
import { HomeView } from './views/home.view';
import { TeacherView } from './views/teacher.view';
import { StudentView } from './views/student.view';
import { StorageService } from './services/storage.service';
import { qs, qsAll } from './utils';

document.addEventListener('DOMContentLoaded', () => {
  Router.setup(
    () => TeacherView.init(),
    () => StudentView.init()
  );

  HomeView.init();
  StorageService.loadLessonLocally();

  const hash = window.location.hash.slice(1);
  if (hash && hash.length > 10) {
    const hl = qs<HTMLElement>('#home-load-lesson');
    if (hl) hl.style.display = 'block';
  }

  setTimeout(() => {
    const loading = qs<HTMLElement>('#loading');
    if (loading) {
      loading.style.opacity = '0';
      setTimeout(() => loading.remove(), 500);
    }
  }, 1200);

  qsAll('.btn-go-home').forEach(btn => {
    btn.addEventListener('click', () => {
      history.pushState("", document.title, window.location.pathname + window.location.search);
      Router.navigate('home');
    });
  });

  // Close success overlay
  qs('#btn-success-continue')?.addEventListener('click', () => {
    qs('#success-overlay')?.classList.add('hidden');
  });
  qs('#success-overlay')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      qs('#success-overlay')?.classList.add('hidden');
    }
  });

  Router.navigate('home');
});
