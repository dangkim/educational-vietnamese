/**
 * EduPlay EventBus
 * Type-safe lightweight publish/subscribe event system.
 */

export type Handler = (payload?: any) => void;

export class EventBus {
  #listeners = new Map<string, Set<Handler>>();
  #onceListeners = new Map<string, Set<Handler>>();

  /**
   * Subscribe to an event.
   * @param event The event name
   * @param handler The callback function
   * @returns unsubscribe function
   */
  on(event: string, handler: Handler): () => void {
    if (!this.#listeners.has(event)) {
      this.#listeners.set(event, new Set());
    }
    this.#listeners.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  /**
   * Subscribe once; auto-removes after first call.
   */
  once(event: string, handler: Handler): void {
    const wrapper: Handler = (...args) => {
      handler(...args);
      this.off(event, wrapper);
      this.#onceListeners.get(event)?.delete(wrapper);
    };
    if (!this.#onceListeners.has(event)) {
      this.#onceListeners.set(event, new Set());
    }
    this.#onceListeners.get(event)!.add(wrapper);
    this.on(event, wrapper);
  }

  /**
   * Unsubscribe a handler.
   */
  off(event: string, handler: Handler): void {
    this.#listeners.get(event)?.delete(handler);
  }

  /**
   * Emit an event with optional payload.
   */
  emit(event: string, payload?: any): void {
    this.#listeners.get(event)?.forEach(fn => {
      try { fn(payload); }
      catch (e) { console.error(`[EventBus] Error in handler for "${event}":`, e); }
    });

    // Wildcard listeners
    if (event !== '*') {
      this.#listeners.get('*')?.forEach(fn => {
        try { (fn as any)(event, payload); }
        catch (e) { console.error(`[EventBus] Error in wildcard handler:`, e); }
      });
    }
  }

  /**
   * Remove all listeners for an event, or all events.
   */
  clear(event?: string): void {
    if (event) {
      this.#listeners.delete(event);
      this.#onceListeners.delete(event);
    } else {
      this.#listeners.clear();
      this.#onceListeners.clear();
    }
  }

  get activeEvents(): string[] {
    return [...this.#listeners.keys()].filter(k => (this.#listeners.get(k)?.size ?? 0) > 0);
  }
}

// Singleton global bus
export const bus = new EventBus();

/** Global event constants */
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
} as const;
