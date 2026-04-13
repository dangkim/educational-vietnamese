/**
 * EduPlay R2Service — Cloudflare R2 / S3-compatible upload using AWS SigV4
 */
export class R2Service {
  #cfg;

  constructor(config = {}) { this.#cfg = config; }
  configure(config)        { this.#cfg = { ...this.#cfg, ...config }; }
  get isConfigured()       { return !!(this.#cfg.accountId && this.#cfg.accessKey && this.#cfg.secretKey && this.#cfg.bucket); }

  async upload(filename, data, contentType = 'application/json') {
    if (!this.isConfigured) throw new Error('R2 chưa được cấu hình.');
    const body    = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    const key     = `answers/${filename}`;
    const host    = `${this.#cfg.accountId}.r2.cloudflarestorage.com`;
    const region  = 'auto';
    const service = 's3';
    const now     = new Date();
    const datestamp  = now.toISOString().slice(0,10).replace(/-/g,'');
    const amzDate    = now.toISOString().replace(/[-:]/g,'').slice(0,15)+'Z';
    const payloadHash= await this.#sha256(body);
    const path       = `/${this.#cfg.bucket}/${key}`;
    const canonical  = [
      'PUT', path, '',
      `content-type:${contentType}\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`,
      'content-type;host;x-amz-content-sha256;x-amz-date', payloadHash
    ].join('\n');
    const credScope = `${datestamp}/${region}/${service}/aws4_request`;
    const strToSign = ['AWS4-HMAC-SHA256', amzDate, credScope, await this.#sha256(canonical)].join('\n');

    let sigKey = await this.#hmac(`AWS4${this.#cfg.secretKey}`, datestamp);
    sigKey = await this.#hmac(sigKey, region);
    sigKey = await this.#hmac(sigKey, service);
    sigKey = await this.#hmac(sigKey, 'aws4_request');
    const signature = this.#hex(await this.#hmac(sigKey, strToSign));
    const auth = `AWS4-HMAC-SHA256 Credential=${this.#cfg.accessKey}/${credScope}, SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date, Signature=${signature}`;

    const resp = await fetch(`https://${host}${path}`, {
      method: 'PUT',
      headers: { Authorization: auth, 'x-amz-date': amzDate, 'x-amz-content-sha256': payloadHash, 'Content-Type': contentType },
      body,
    });
    if (!resp.ok) throw new Error(`R2 upload thất bại: HTTP ${resp.status}`);
    return `https://${host}${path}`;
  }

  async #sha256(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return this.#hex(new Uint8Array(buf));
  }
  async #hmac(key, msg) {
    const k   = typeof key === 'string' ? new TextEncoder().encode(key) : key;
    const imp = await crypto.subtle.importKey('raw', k, { name:'HMAC', hash:'SHA-256' }, false, ['sign']);
    return new Uint8Array(await crypto.subtle.sign('HMAC', imp, new TextEncoder().encode(msg)));
  }
  #hex(u8) { return Array.from(u8).map(b => b.toString(16).padStart(2,'0')).join(''); }
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * EduPlay StorageService — localStorage with versioning and fallback
 */
const KEYS = {
  STATE:   'eduplay_v1_state',
  LESSON:  'eduplay_v1_lesson',
  CONFIG:  'eduplay_v1_config',
  SESSION: 'eduplay_v1_session',
};

export const StorageService = {
  saveLesson(lesson) { this.#set(KEYS.LESSON, lesson); },
  loadLesson()       { return this.#get(KEYS.LESSON); },

  saveConfig(cfg) {
    // Never persist secret key directly — store a flag
    const safe = { ...cfg, r2SecretKey: cfg.r2SecretKey ? '***saved***' : '' };
    this.#set(KEYS.CONFIG, safe);
  },
  loadConfig() { return this.#get(KEYS.CONFIG); },

  saveSession(session) {
    const s = { ...session, completedGames: [...(session.completedGames ?? [])] };
    this.#set(KEYS.SESSION, s);
  },
  loadSession() {
    const s = this.#get(KEYS.SESSION);
    if (s?.completedGames) s.completedGames = new Set(s.completedGames);
    return s;
  },

  clearLesson() { localStorage.removeItem(KEYS.LESSON); },
  clearAll()    { Object.values(KEYS).forEach(k => localStorage.removeItem(k)); },

  #set(key, value) {
    try { localStorage.setItem(key, JSON.stringify({ v: 1, ts: Date.now(), data: value })); }
    catch (e) { console.warn('[Storage] Write failed:', e.message); }
  },
  #get(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      return obj.data ?? null;
    } catch { return null; }
  },
};
