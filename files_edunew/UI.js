/**
 * EduPlay Toast — notification system
 */
import { bus, Events } from '../core/EventBus.js';

const ICONS = { default:'💬', success:'✅', error:'❌', warning:'⚠️' };

export class Toast {
  #container;
  #timers = new Map();

  constructor() {
    this.#container = document.getElementById('toast-container');
    bus.on(Events.TOAST_SHOW, ({ message, type = 'default', duration = 3500 }) =>
      this.show(message, type, duration));
  }

  show(message, type = 'default', duration = 3500) {
    const id  = Date.now().toString();
    const el  = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.dataset.id = id;
    el.innerHTML  = `
      <span class="toast-icon">${ICONS[type] ?? ICONS.default}</span>
      <span class="toast-message">${message}</span>
      <button class="toast-close" aria-label="Đóng" data-toast-id="${id}">✕</button>
    `;

    el.querySelector('.toast-close').addEventListener('click', () => this.dismiss(id));
    this.#container.appendChild(el);

    const timer = setTimeout(() => this.dismiss(id), duration);
    this.#timers.set(id, timer);
    return id;
  }

  dismiss(id) {
    const el = this.#container.querySelector(`[data-id="${id}"]`);
    if (!el) return;
    el.classList.add('removing');
    clearTimeout(this.#timers.get(id));
    this.#timers.delete(id);
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }

  success(msg, duration) { return this.show(msg, 'success', duration); }
  error(msg, duration)   { return this.show(msg, 'error',   duration ?? 5000); }
  warning(msg, duration) { return this.show(msg, 'warning', duration); }
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * EduPlay Modal — accessible dialog system
 */
import { escHTML } from '../utils/helpers.js';

export class Modal {
  #container;
  #activeModal = null;

  constructor() {
    this.#container = document.getElementById('modal-container');
    bus.on(Events.MODAL_OPEN,  (cfg) => this.open(cfg));
    bus.on(Events.MODAL_CLOSE, ()    => this.close());

    // Close on backdrop click
    this.#container.addEventListener('click', (e) => {
      if (e.target === this.#activeModal?.backdrop) this.close();
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.#activeModal) this.close();
    });
  }

  /**
   * @param {Object} cfg
   * @param {string} cfg.title
   * @param {string} cfg.body - HTML string
   * @param {Array}  [cfg.actions] - [{ label, type, onClick }]
   * @param {boolean}[cfg.closeOnBackdrop]
   */
  open({ title, body, actions = [], icon = '' }) {
    this.close(); // Ensure only one modal at a time

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.setAttribute('aria-hidden', 'false');

    backdrop.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-label="${escHTML(title)}">
        <div class="modal-header">
          ${icon ? `<span style="font-size:1.5rem">${icon}</span>` : ''}
          <h3 class="modal-title">${escHTML(title)}</h3>
          <button class="btn btn-icon-only modal-close-btn" aria-label="Đóng">✕</button>
        </div>
        <div class="modal-body">${body}</div>
        ${actions.length ? `
          <div class="modal-footer">
            ${actions.map((a, i) =>
              `<button class="btn ${a.type ?? 'btn-ghost'}" data-action="${i}">${escHTML(a.label)}</button>`
            ).join('')}
          </div>` : ''}
      </div>
    `;

    backdrop.querySelector('.modal-close-btn').addEventListener('click', () => this.close());
    actions.forEach((action, i) => {
      backdrop.querySelector(`[data-action="${i}"]`)?.addEventListener('click', () => {
        action.onClick?.();
        if (action.closes !== false) this.close();
      });
    });

    this.#container.appendChild(backdrop);
    this.#container.setAttribute('aria-hidden', 'false');
    this.#activeModal = { backdrop };

    // Focus trap
    setTimeout(() => backdrop.querySelector('button')?.focus(), 50);
    document.body.style.overflow = 'hidden';
  }

  close() {
    if (!this.#activeModal) return;
    this.#activeModal.backdrop.style.opacity = '0';
    this.#activeModal.backdrop.style.transition = 'opacity .2s ease';
    setTimeout(() => {
      this.#activeModal?.backdrop.remove();
      this.#activeModal = null;
      this.#container.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }, 200);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * EduPlay SuccessOverlay — celebration screen with confetti
 */
import { starsDisplay, calcStars } from '../utils/helpers.js';

export class SuccessOverlay {
  #el;
  #confettiCanvas;
  #confettiCtx;

  constructor() {
    this.#el = document.getElementById('success-overlay');
    this.#confettiCanvas = document.getElementById('confetti-canvas');
    this.#confettiCtx = this.#confettiCanvas?.getContext('2d');

    bus.on(Events.SUCCESS_SHOW, (cfg) => this.show(cfg));
    bus.on(Events.CONFETTI_TRIGGER, () => this.#launchConfetti());

    this.#el?.addEventListener('click', (e) => {
      if (e.target === this.#el) this.hide();
    });
  }

  /**
   * @param {Object} cfg
   * @param {string} cfg.icon
   * @param {string} cfg.title
   * @param {string} [cfg.message]
   * @param {number} [cfg.score] 0-100 percentage
   * @param {string} [cfg.detail]
   * @param {Function} [cfg.onContinue]
   */
  show({ icon = '🏆', title, message = '', score, detail = '', onContinue }) {
    const stars = score !== undefined ? calcStars(score) : null;

    this.#el.innerHTML = `
      <div class="success-card">
        <span class="s-icon">${icon}</span>
        <h2>${escHTML(title)}</h2>
        ${message ? `<p>${escHTML(message)}</p>` : ''}
        ${stars !== null ? `<div class="success-stars">${starsDisplay(stars)}</div>` : ''}
        ${detail ? `<div class="success-score">${escHTML(detail)}</div>` : ''}
        <div style="display:flex;gap:12px;justify-content:center;margin-top:24px;flex-wrap:wrap">
          <button class="btn btn-primary" id="success-continue">Tiếp tục 🎉</button>
          <button class="btn btn-ghost" id="success-close">Đóng</button>
        </div>
      </div>
    `;

    this.#el.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    this.#el.querySelector('#success-continue')?.addEventListener('click', () => {
      this.hide();
      onContinue?.();
    });
    this.#el.querySelector('#success-close')?.addEventListener('click', () => this.hide());

    this.#launchConfetti();
  }

  hide() {
    this.#el.classList.add('hidden');
    document.body.style.overflow = '';
    this.#stopConfetti();
  }

  #particles = [];
  #raf;

  #launchConfetti() {
    if (!this.#confettiCtx) return;
    const canvas = this.#confettiCanvas;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#FFD54F','#E91E63','#4CAF50','#2196F3','#FF5722','#9C27B0','#FF9800'];
    this.#particles = Array.from({ length: 80 }, () => ({
      x: Math.random() * canvas.width,
      y: -10 - Math.random() * 100,
      w: 6 + Math.random() * 8,
      h: 6 + Math.random() * 8,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - .5) * 4,
      vy: 2 + Math.random() * 3,
      rot: Math.random() * 360,
      rotV: (Math.random() - .5) * 8,
      opacity: 1,
    }));

    this.#animateConfetti();
  }

  #animateConfetti() {
    const ctx = this.#confettiCtx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.#confettiCanvas.width, this.#confettiCanvas.height);

    this.#particles = this.#particles.filter(p => p.y < this.#confettiCanvas.height + 20 && p.opacity > 0.05);

    this.#particles.forEach(p => {
      p.x   += p.vx;
      p.y   += p.vy;
      p.rot += p.rotV;
      p.vy  += 0.06; // gravity
      if (p.y > this.#confettiCanvas.height * 0.6) p.opacity -= 0.015;

      ctx.save();
      ctx.globalAlpha = p.opacity;
      ctx.translate(p.x + p.w/2, p.y + p.h/2);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
      ctx.restore();
    });

    if (this.#particles.length > 0) {
      this.#raf = requestAnimationFrame(() => this.#animateConfetti());
    } else {
      ctx.clearRect(0, 0, this.#confettiCanvas.width, this.#confettiCanvas.height);
    }
  }

  #stopConfetti() {
    cancelAnimationFrame(this.#raf);
    this.#confettiCtx?.clearRect(0, 0, this.#confettiCanvas.width, this.#confettiCanvas.height);
    this.#particles = [];
  }
}
