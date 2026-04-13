/**
 * EduPlay Helpers — pure utility functions
 */

// ─── String & Text ────────────────────────────────────────────────────────

/** Escape HTML special characters */
export const escHTML = (str: any): string =>
  String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

/** Remove Vietnamese diacritics for fuzzy matching */
export const removeVietnameseTones = (str: string): string => {
  return str.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D');
};

/** Normalize answer for comparison: lowercase, no accents, trim */
export const normalizeAnswer = (str: any): string =>
  removeVietnameseTones(String(str ?? '').trim().toLowerCase())
    .replace(/\s+/g, ' ');

/** Check if two answers match (with tolerance) */
export const answersMatch = (student: string, correct: string): boolean => {
  const a = normalizeAnswer(student);
  const b = normalizeAnswer(correct);
  if (a === b) return true;
  // Allow 1-char levenshtein for longer words
  if (b.length >= 5 && levenshtein(a, b) <= 1) return true;
  return false;
};

/** Levenshtein distance */
export const levenshtein = (a: string, b: string): number => {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => {
      const row = new Array(n + 1).fill(0);
      row[0] = i;
      return row;
  });
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[m][n];
};

/** Truncate string */
export const truncate = (str: any, maxLen = 80): string =>
  String(str ?? '').length > maxLen ? str.slice(0, maxLen) + '...' : str;

/** Strip HTML tags */
export const stripHTML = (html: string): string =>
  html.replace(/<[^>]*>/g, '').trim();

// ─── Arrays ───────────────────────────────────────────────────────────────

/** Fisher-Yates shuffle (returns new array) */
export const shuffle = <T>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** Pick n random elements from array */
export const sample = <T>(arr: T[], n: number): T[] => shuffle(arr).slice(0, n);

/** Chunk array into pieces */
export const chunk = <T>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

// ─── Numbers & Scoring ────────────────────────────────────────────────────

/** Clamp value between min and max */
export const clamp = (val: number, min: number, max: number): number => Math.min(Math.max(val, min), max);

/** Map a value from one range to another */
export const mapRange = (val: number, inMin: number, inMax: number, outMin: number, outMax: number): number =>
  ((val - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin;

/** Calculate star rating 1-3 from percentage */
export const calcStars = (pct: number): number => {
  if (pct >= 90) return 3;
  if (pct >= 60) return 2;
  return 1;
};

/** Stars string display */
export const starsDisplay = (stars: number): string =>
  '⭐'.repeat(stars) + '☆'.repeat(3 - stars);

/** Format seconds as M:SS */
export const formatTime = (secs: number): string => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

// ─── URL & Encoding ───────────────────────────────────────────────────────

/** Base64 encode a JSON-serializable object */
export const encodeBase64 = (obj: any): string | null => {
  try { return btoa(encodeURIComponent(JSON.stringify(obj)).replace(/%([0-9A-F]{2})/g, (_, p) => String.fromCharCode(parseInt(p, 16)))); }
  catch (e) { return null; }
};

/** Decode a Base64-encoded JSON object */
export const decodeBase64 = (str: string): any | null => {
  try { return JSON.parse(decodeURIComponent(Array.from(atob(str), c => '%' + c.charCodeAt(0).toString(16).padStart(2,'0')).join(''))); }
  catch (e) { return null; }
};

/** Extract YouTube video ID from URL */
export const getYoutubeId = (url: string): string | null => {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/))([^&\s?#]+)/);
  return m?.[1] ?? null;
};

/** Convert YouTube URL to embed URL */
export const toYoutubeEmbed = (url: string): string | null => {
  const id = getYoutubeId(url);
  if (id) return `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`;
  return null;
};

/** Convert Google Drive URL to embed URL */
export const toDriveEmbed = (url: string): string | null => {
  const m = url?.match(/\/d\/([^/]+)/);
  if (m) return `https://drive.google.com/file/d/${m[1]}/preview`;
  return null;
};

/** Resolve a video URL to its embed version */
export const resolveVideoUrl = (url: string): { type: 'iframe' | 'video', url: string } | null => {
  if (!url?.trim()) return null;
  const ytEmbed = toYoutubeEmbed(url);
  if (ytEmbed) return { type: 'iframe', url: ytEmbed };
  const driveEmbed = url.includes('drive.google.com') ? toDriveEmbed(url) : null;
  if (driveEmbed) return { type: 'iframe', url: driveEmbed };
  if (url.match(/\.(mp4|webm|ogg|mov)(\?.*)?$/i)) return { type: 'video', url };
  if (url.startsWith('http')) return { type: 'iframe', url };
  return null;
};

// ─── Date & UUID ──────────────────────────────────────────────────────────

/** Generate a UUID (v4) */
export const uuid = (): string =>
  (crypto as any).randomUUID?.() ??
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });

/** Format date to Vietnamese locale */
export const formatDate = (ts?: number): string =>
  new Date(ts ?? Date.now()).toLocaleString('vi-VN');

// ─── DOM ──────────────────────────────────────────────────────────────────

/** Create element with optional attributes and children */
export const createElement = (tag: string, attrs: Record<string, any> = {}, ...children: any[]): HTMLElement => {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'className') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (v !== false && v !== null && v !== undefined) el.setAttribute(k, v);
  });
  children.flat().forEach(child => {
    if (child instanceof Node) el.appendChild(child);
    else if (child !== null && child !== undefined) el.appendChild(document.createTextNode(String(child)));
  });
  return el;
};

/** Wait for ms milliseconds */
export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Debounce function */
export const debounce = (fn: Function, ms = 300) => {
  let timer: any;
  return (...args: any[]) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
};
