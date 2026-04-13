/**
 * EduPlay Router
 * Hash-based SPA router. Manages view lifecycles and navigation.
 */
import { bus, Events } from './EventBus.js';
import { store } from './Store.js';

export class Router {
  /** @type {Map<string, Function>} route path -> ViewClass factory */
  #routes = new Map();
  /** @type {import('./Component.js').Component|null} */
  #currentView = null;
  #container;
  #defaultRoute = '/';
  #isNavigating = false;

  /**
   * @param {HTMLElement} container
   */
  constructor(container) {
    this.#container = container;
  }

  /**
   * Register a route.
   * @param {string} path - e.g. '/', '/teacher', '/student'
   * @param {Function} viewFactory - () => new SomeView()
   */
  register(path, viewFactory) {
    this.#routes.set(path, viewFactory);
    return this; // fluent
  }

  /** Set the fallback route */
  setDefault(path) {
    this.#defaultRoute = path;
    return this;
  }

  /** Start listening for hash changes */
  start() {
    window.addEventListener('hashchange', () => this.#handleChange());
    window.addEventListener('popstate',   () => this.#handleChange());
    this.#handleChange();
    return this;
  }

  /**
   * Navigate to a route programmatically.
   * @param {string} path
   * @param {Object} [params]
   */
  navigate(path, params = {}) {
    if (this.#isNavigating) return;
    const hash = params ? `${path}?${new URLSearchParams(params).toString()}` : path;
    window.location.hash = hash;
  }

  /** Navigate back to previous hash or default */
  back() {
    const prev = window.location.hash;
    history.back();
    // If no previous, go to default
    setTimeout(() => {
      if (window.location.hash === prev) this.navigate(this.#defaultRoute);
    }, 100);
  }

  /** Current route path */
  get currentPath() {
    return this.#parsePath(window.location.hash);
  }

  // --- Private ---

  async #handleChange() {
    if (this.#isNavigating) return;
    this.#isNavigating = true;

    const { path, params } = this.#parseHash(window.location.hash);
    const factory = this.#routes.get(path) || this.#routes.get(this.#defaultRoute);

    if (!factory) {
      console.warn(`[Router] No route for "${path}"`);
      this.#isNavigating = false;
      return;
    }

    // Unmount current view
    if (this.#currentView) {
      await this.#currentView.unmount?.();
      this.#currentView = null;
    }

    // Update store
    store.set('ui.currentView', path.replace('/', '') || 'home');

    // Mount new view
    try {
      this.#currentView = factory(params);
      this.#container.innerHTML = '';
      await this.#currentView.mount(this.#container);
      bus.emit(Events.VIEW_MOUNTED, { path, params });
    } catch (e) {
      console.error(`[Router] Error mounting view for "${path}":`, e);
      this.#renderError(path, e);
    }

    this.#isNavigating = false;
  }

  #parseHash(hash) {
    const raw   = hash.startsWith('#') ? hash.slice(1) : hash;
    const [full = '/', queryStr = ''] = raw.split('?');
    const path  = full || '/';
    const params = Object.fromEntries(new URLSearchParams(queryStr));
    return { path, params };
  }

  #parsePath(hash) {
    const raw = hash.startsWith('#') ? hash.slice(1) : hash;
    return raw.split('?')[0] || '/';
  }

  #renderError(path, err) {
    this.#container.innerHTML = `
      <div class="empty-state" style="min-height:60vh">
        <div class="empty-state-icon">⚠️</div>
        <h3>Không thể tải trang</h3>
        <p>${err.message}</p>
        <button class="btn btn-primary" onclick="window.location.hash='/'">Về trang chủ</button>
      </div>
    `;
  }
}
