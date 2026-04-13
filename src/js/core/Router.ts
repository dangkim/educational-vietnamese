/**
 * EduPlay Router
 * Hash-based SPA router with view lifecycle management.
 */
import { bus, Events } from './EventBus';

export type ViewFactory = () => { mount: (el: HTMLElement) => void; unmount: () => void; render: () => string; afterMount?: () => void };

export class Router {
  #routes = new Map<string, ViewFactory>();
  #currentPath: string | null = null;
  #currentViewInstance: any = null;
  #appElement: HTMLElement;
  #defaultPath = '/';

  constructor(appElement: HTMLElement) {
    this.#appElement = appElement;
    window.addEventListener('hashchange', () => this.handleRoute());
  }

  register(path: string, factory: ViewFactory): Router {
    this.#routes.set(path, factory);
    return this;
  }

  setDefault(path: string): Router {
    this.#defaultPath = path;
    return this;
  }

  start(): Router {
    this.handleRoute();
    return this;
  }

  navigate(path: string): void {
    window.location.hash = `#${path}`;
  }

  async handleRoute(): Promise<void> {
    const hash = window.location.hash.slice(1) || this.#defaultPath;
    const path = hash.split('?')[0];

    if (this.#currentPath === path) return;

    // 1. Unmount current view
    if (this.#currentViewInstance) {
      bus.emit(Events.VIEW_UNMOUNTED, { path: this.#currentPath });
      this.#currentViewInstance.unmount();
      this.#currentViewInstance = null;
    }

    // 2. Resolve new view
    const factory = this.#routes.get(path) || this.#routes.get(this.#defaultPath);
    if (!factory) {
        console.error(`[Router] No route found for ${path}`);
        return;
    }

    this.#currentPath = path;
    this.#currentViewInstance = factory();

    // 3. Render and Mount
    this.#appElement.innerHTML = this.#currentViewInstance.render();
    this.#currentViewInstance.mount(this.#appElement);

    if (this.#currentViewInstance.afterMount) {
        this.#currentViewInstance.afterMount();
    }

    bus.emit(Events.VIEW_MOUNTED, { path: this.#currentPath, instance: this.#currentViewInstance });
  }

  get currentPath(): string | null {
    return this.#currentPath;
  }
}
