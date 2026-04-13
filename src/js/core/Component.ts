/**
 * EduPlay Component
 * Base class for all UI components and views.
 * Handles lifecycle, event delegation, and state subscriptions.
 */
import { bus } from './EventBus';

export abstract class Component {
  protected el: HTMLElement | null = null;
  protected unsubscribers: Array<() => void> = [];

  constructor() {}

  /**
   * Render the component's HTML template.
   */
  abstract render(): string;

  /**
   * Mount the component to a DOM element.
   */
  mount(el: HTMLElement): void {
    this.el = el;
    this.afterMount?.();
  }

  /**
   * Unmount the component and cleanup subscriptions.
   */
  unmount(): void {
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
    this.el = null;
    this.beforeUnmount?.();
  }

  /**
   * Lifecycle hook called after the component is added to the DOM.
   */
  afterMount?(): void;

  /**
   * Lifecycle hook called before the component is removed from the DOM.
   */
  beforeUnmount?(): void;

  /**
   * Utility to find elements within the component.
   */
  protected qs<T extends HTMLElement>(selector: string): T | null {
    return this.el?.querySelector(selector) ?? null;
  }

  /**
   * Utility to find all elements matching a selector within the component.
   */
  protected qsAll<T extends HTMLElement>(selector: string): NodeListOf<T> | [] {
    return this.el?.querySelectorAll(selector) ?? [];
  }

  /**
   * Add a scoped event listener.
   */
  protected on(selector: string, event: string, handler: (e: any) => void): void {
    const elements = this.el?.querySelectorAll(selector);
    elements?.forEach(el => {
      el.addEventListener(event, handler);
      this.unsubscribers.push(() => el.removeEventListener(event, handler));
    });
  }

  /**
   * Subscribe to global event bus.
   */
  protected listen(event: string, handler: (payload?: any) => void): void {
    const unsub = bus.on(event, handler);
    this.unsubscribers.push(unsub);
  }
}
