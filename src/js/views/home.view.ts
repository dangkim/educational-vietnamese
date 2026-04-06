import { Router } from '../router';
import { qs } from '../utils';

export const HomeView = {
  init() {
    qs('#btn-enter-teacher')?.addEventListener('click', () => Router.navigate('teacher'));
    qs('#btn-enter-student')?.addEventListener('click', () => Router.navigate('student'));
    qs('#btn-load-lesson')?.addEventListener('click', () => Router.loadFromURL());
  }
};
