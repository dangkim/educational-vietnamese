/**
 * EduPlay EventBus
 * Lightweight publish/subscribe event system for decoupled module communication.
 */
export class EventBus {
  /** @type {Map<string, Set<Function>>} */
  #listeners = new Map();
  #onceListeners = new Map();

  /**
   * Subscribe to an event.
   * @param {string} event
   * @param {Function} handler
   * @returns {Function} unsubscribe function
   */
  on(event, handler) {
    if (!this.#listeners.has(event)) this.#listeners.set(event, new Set());
    this.#listeners.get(event).add(handler);
    return () => this.off(event, handler);
  }

  /**
   * Subscribe once; auto-removes after first call.
   * @param {string} event
   * @param {Function} handler
   */
  once(event, handler) {
    const wrapper = (...args) => {
      handler(...args);
      this.off(event, wrapper);
      this.#onceListeners.get(event)?.delete(wrapper);
    };
    if (!this.#onceListeners.has(event)) this.#onceListeners.set(event, new Set());
    this.#onceListeners.get(event).add(wrapper);
    this.on(event, wrapper);
  }

  /**
   * Unsubscribe a handler from an event.
   * @param {string} event
   * @param {Function} handler
   */
  off(event, handler) {
    this.#listeners.get(event)?.delete(handler);
  }

  /**
   * Emit an event with optional payload.
   * @param {string} event
   * @param {*} payload
   */
  emit(event, payload) {
    this.#listeners.get(event)?.forEach(fn => {
      try { fn(payload); }
      catch (e) { console.error(`[EventBus] Error in handler for "${event}":`, e); }
    });

    // Wildcard listeners
    if (event !== '*') {
      this.#listeners.get('*')?.forEach(fn => {
        try { fn(event, payload); }
        catch (e) { console.error(`[EventBus] Error in wildcard handler:`, e); }
      });
    }
  }

  /**
   * Remove all listeners for an event, or all events if none specified.
   * @param {string} [event]
   */
  clear(event) {
    if (event) { this.#listeners.delete(event); this.#onceListeners.delete(event); }
    else       { this.#listeners.clear(); this.#onceListeners.clear(); }
  }

  /** Debug: list all active event names */
  get activeEvents() {
    return [...this.#listeners.keys()].filter(k => this.#listeners.get(k).size > 0);
  }
}

// Singleton global bus
export const bus = new EventBus();

/** @enum {string} EduPlay global event constants */
export const Events = {
  // Navigation
  NAVIGATE:         'navigate',
  VIEW_MOUNTED:     'view:mounted',
  VIEW_UNMOUNTED:   'view:unmounted',

  // Lesson lifecycle
  LESSON_LOADED:    'lesson:loaded',
  LESSON_PUBLISHED: 'lesson:published',

  // Teacher
  STEP_CHANGED:     'teacher:step_changed',
  DOC_LOADED:       'teacher:doc_loaded',
  AI_START:         'ai:generate_start',
  AI_STEP:          'ai:generate_step',
  AI_DONE:          'ai:generate_done',
  AI_ERROR:         'ai:generate_error',

  // Student
  SECTION_CHANGED:  'student:section_changed',
  SECTION_DONE:     'student:section_done',
  GAME_SELECTED:    'student:game_selected',
  GAME_COMPLETE:    'student:game_complete',
  ANSWER_SAVED:     'student:answer_saved',

  // UI
  TOAST_SHOW:       'toast:show',
  MODAL_OPEN:       'modal:open',
  MODAL_CLOSE:      'modal:close',
  SUCCESS_SHOW:     'success:show',
  CONFETTI_TRIGGER: 'confetti:trigger',
};
