export function showToast(msg: string, type: 'success' | 'error' | '' = '', duration = 3000): void {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = `toast show ${type}`;
  setTimeout(() => t.className = 'toast', duration);
}

export function qs<T extends HTMLElement>(sel: string): T | null {
  return document.querySelector(sel);
}

export function qsAll<T extends HTMLElement>(sel: string): NodeListOf<T> {
  return document.querySelectorAll(sel);
}

export function escHTML(str: any): string {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function toBase64(obj: any): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
}

export function fromBase64<T>(str: string): T | null {
  try {
    return JSON.parse(decodeURIComponent(escape(atob(str))));
  } catch (e) {
    return null;
  }
}

export function getYTEmbedUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([^&\s?]+)/);
  if (m) return `https://www.youtube.com/embed/${m[1]}?rel=0`;
  if (url.includes('drive.google.com/file/d/')) {
    const id = url.match(/\/d\/([^/]+)/)?.[1];
    if (id) return `https://drive.google.com/file/d/${id}/preview`;
  }
  return url; // raw URL fallback
}

export function isValidURL(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch (e) {
    return false;
  }
}

export function isImageUrl(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  // Check common image extensions
  if (/\.(jpe?g|png|gif|webp|svg|bmp|ico|avif)(\?.*)?$/i.test(lower)) return true;
  // Check known image hosting services
  if (lower.includes('imgur.com') || lower.includes('i.imgur.com')) return true;
  if (lower.includes('unsplash.com/photos') || lower.includes('images.unsplash.com')) return true;
  return false;
}

export function confetti(): void {
  const colors = ['#FFD54F', '#E91E63', '#4CAF50', '#2196F3', '#FF5722', '#9C27B0'];
  for (let i = 0; i < 60; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.style.cssText = `
      left:${Math.random() * 100}vw; 
      background:${colors[Math.floor(Math.random() * colors.length)]};
      width:${6 + Math.random() * 8}px; 
      height:${6 + Math.random() * 8}px;
      animation-duration:${2 + Math.random() * 2}s; 
      animation-delay:${Math.random() * .5}s;
      border-radius:${Math.random() > 0.5 ? '50%' : '2px'};
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 5000);
  }
}

export function showSuccess(icon: string, title: string, msg: string, score = ''): void {
  const iconEl = document.getElementById('success-icon');
  const titleEl = document.getElementById('success-title');
  const msgEl = document.getElementById('success-msg');
  const scoreEl = document.getElementById('success-score');
  const overlay = document.getElementById('success-overlay');

  if (iconEl) iconEl.textContent = icon;
  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.innerHTML = msg; // Allows HTML like links in success
  if (scoreEl) scoreEl.textContent = score;
  if (overlay) overlay.classList.remove('hidden');
  
  confetti();
}
