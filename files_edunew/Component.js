/**
 * EduPlay Component
 * Base class for all UI components. Provides lifecycle methods,
 * DOM helpers, and automatic subscription cleanup.
 */
import { bus } from './EventBus.js';
import { store } from './Store.js';

export class Component {
  /** @type {HTMLElement|null} */
  el = null;
  /** @type {HTMLElement|null} */
  container = null;
  /** Cleanup functions from subscriptions */
  #cleanups = [];
  /** Abort controller for async operations */
  #abortController = null;

  constructor() {}

  /**
   * Override to return HTML string or HTMLElement.
   * @returns {string|HTMLElement}
   */
  render() { return ''; }

  /**
   * Called after render. Attach event listeners here.
   */
  afterMount() {}

  /**
   * Mount component into container.
   * @param {HTMLElement} container
   */
  async mount(container) {
    this.container = container;
    this.#abortController = new AbortController();

    const content = await this.render();

    if (typeof content === 'string') {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = content;
      this.el = wrapper.firstElementChild || wrapper;
      container.appendChild(this.el);
    } else if (content instanceof HTMLElement) {
      this.el = content;
      container.appendChild(this.el);
    }

    this.el?.classList.add('page-enter');
    await this.afterMount();
  }

  /**
   * Unmount component, remove from DOM, clean up subscriptions.
   */
  async unmount() {
    this.#cleanups.forEach(fn => fn());
    this.#cleanups = [];
    this.#abortController?.abort();
    this.el?.remove();
    this.el = null;
    this.container = null;
  }

  /**
   * Update component by re-rendering into el.
   * @param {Function} [patchFn] - Optional: run this instead of full re-render
   */
  async update(patchFn) {
    if (!this.el) return;
    if (patchFn) { patchFn(this.el); return; }
    const content = await this.render();
    if (typeof content === 'string') {
      this.el.outerHTML = content;
      this.el = this.container?.querySelector('[data-component]') || this.el;
    }
  }

  // --- Store & Bus helpers ---

  /**
   * Subscribe to store path. Auto-cleanup on unmount.
   * @param {string} path
   * @param {Function} handler
   */
  watch(path, handler) {
    const unsub = store.subscribe(path, handler);
    this.#cleanups.push(unsub);
    return unsub;
  }

  /**
   * Listen to bus event. Auto-cleanup on unmount.
   * @param {string} event
   * @param {Function} handler
   */
  listen(event, handler) {
    const unsub = bus.on(event, handler);
    this.#cleanups.push(unsub);
    return unsub;
  }

  // --- DOM helpers ---

  /**
   * Query inside this component's element.
   * @param {string} selector
   * @returns {HTMLElement|null}
   */
  qs(selector) {
    return this.el?.querySelector(selector) ?? null;
  }

  /**
   * Query all matching elements inside this component.
   * @param {string} selector
   * @returns {NodeList}
   */
  qsAll(selector) {
    return this.el?.querySelectorAll(selector) ?? [];
  }

  /**
   * Add an event listener that auto-cleans on unmount.
   * @param {HTMLElement|string} target - Element or CSS selector
   * @param {string} event
   * @param {Function} handler
   * @param {Object} [options]
   */
  on(target, event, handler, options = {}) {
    const el = typeof target === 'string' ? this.qs(target) : target;
    if (!el) return;
    const opts = { signal: this.#abortController?.signal, ...options };
    el.addEventListener(event, handler, opts);
  }

  /**
   * Emit a bus event.
   */
  emit(event, payload) {
    bus.emit(event, payload);
  }

  /**
   * Get store value.
   */
  state(path) {
    return store.get(path);
  }

  /**
   * Set store value.
   */
  setState(path, value) {
    store.set(path, value);
  }

  /**
   * Register a cleanup function to run on unmount.
   * @param {Function} fn
   */
  addCleanup(fn) {
    this.#cleanups.push(fn);
  }

  /** Get the AbortSignal for this component's lifetime */
  get signal() {
    return this.#abortController?.signal;
  }
}
