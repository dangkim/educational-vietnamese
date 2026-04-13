/**
 * EduPlay App Bootstrap
 * Entry point — initializes the entire application.
 */
import { Router }        from './core/Router.js';
import { store }         from './core/Store.js';
import { bus, Events }   from './core/EventBus.js';
import { Toast, Modal, SuccessOverlay } from './components/UI.js';
import { HomeView }      from './views/Views.js';
import { TeacherView }   from './views/Views.js';
import { StudentView }   from './views/Views.js';
import { StorageService }from './services/StorageService.js';

// ─── Expose global for game access ───────────────────────────────────────────
window.__eduplay__ = { store, bus, Events };

class EduPlayApp {
  #router;
  #toast;
  #modal;
  #success;

  async init() {
    try {
      // 1. Restore persisted state
      const restored = StorageService.loadLesson();
      if (restored) store.loadLesson(restored);

      const restoredCfg = StorageService.loadConfig();
      if (restoredCfg) store.set('config', { ...store.get('config'), ...restoredCfg });

      // 2. Init UI singletons
      this.#toast   = new Toast();
      this.#modal   = new Modal();
      this.#success = new SuccessOverlay();

      // 3. Set up router
      const appEl = document.getElementById('app');
      this.#router = new Router(appEl)
        .register('/',        () => new HomeView())
        .register('/teacher', () => new TeacherView())
        .register('/student', () => new StudentView())
        .setDefault('/')
        .start();

      // 4. Global error handler
      window.addEventListener('unhandledrejection', (e) => {
        console.error('[EduPlay] Unhandled error:', e.reason);
        bus.emit(Events.TOAST_SHOW, { message: `❌ Lỗi: ${e.reason?.message ?? 'Không xác định'}`, type: 'error' });
      });

      // 5. Hide loader
      setTimeout(() => {
        const loader = document.getElementById('app-loader');
        if (loader) {
          loader.classList.add('fade-out');
          setTimeout(() => loader.remove(), 600);
        }
      }, 900);

      // 6. Register service worker (PWA)
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(() => {/* offline optional */});
      }

      // 7. Accessibility: announce route changes
      bus.on(Events.VIEW_MOUNTED, ({ path }) => {
        const names = { '/':'Trang chủ', '/teacher':'Chế độ giáo viên', '/student':'Chế độ học sinh' };
        document.title = `EduPlay — ${names[path] ?? 'Bài Học Vui Vẻ'}`;
      });

    } catch (e) {
      console.error('[EduPlay] Boot error:', e);
      document.getElementById('app-loader').innerHTML = `
        <div style="text-align:center;color:#fff;padding:40px">
          <p style="font-size:3rem">😥</p>
          <h2 style="font-family:sans-serif;margin:16px 0">Không thể khởi động EduPlay</h2>
          <p style="opacity:.7">${e.message}</p>
          <button onclick="location.reload()" style="margin-top:20px;background:#fff;color:#1A237E;border:none;padding:12px 24px;border-radius:20px;font-weight:700;cursor:pointer">Thử lại</button>
        </div>
      `;
    }
  }
}

// ─── Launch ───────────────────────────────────────────────────────────────────
const app = new EduPlayApp();
app.init();
