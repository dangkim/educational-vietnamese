import { AppState } from '../state';

export const R2Storage = {
  async hmacSHA256(key: string | Uint8Array, data: string): Promise<Uint8Array> {
    const keyBuf = typeof key === 'string' ? new TextEncoder().encode(key) : key;
    const k = await crypto.subtle.importKey('raw', keyBuf as any, { name:'HMAC', hash:'SHA-256' }, false, ['sign']);
    return new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data)));
  },
  
  async sha256(str: string): Promise<string> {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
  },
  
  toHex(bytes: Uint8Array): string { 
    return Array.from(bytes).map(b => b.toString(16).padStart(2,'0')).join(''); 
  },

  async requestR2(method: 'GET' | 'PUT', key: string, data?: any): Promise<any> {
    const r2Bucket = import.meta.env.VITE_R2_BUCKET;
    const r2AccountId = import.meta.env.VITE_R2_ACCOUNT_ID;
    const r2AccessKey = import.meta.env.VITE_R2_ACCESS_KEY;
    const r2SecretKey = import.meta.env.VITE_R2_SECRET_KEY;

    if (!r2AccountId || !r2AccessKey || !r2SecretKey || !r2Bucket) {
      console.error('R2 missing config:', { hasBucket: !!r2Bucket, hasAccount: !!r2AccountId, hasAccess: !!r2AccessKey, hasSecret: !!r2SecretKey });
      throw new Error('R2 not configured (Check .env)');
    }

    const host = `${r2AccountId}.r2.cloudflarestorage.com`;
    const region = 'auto';
    const service = 's3';
    const now = new Date();
    const dateStamp = now.toISOString().slice(0,10).replace(/-/g,'');
    const amzDate = now.toISOString().replace(/[-:]/g,'').slice(0,15)+'Z';
    
    let payloadHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    let bodyStr;
    let canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
    let signedHeaders = 'host;x-amz-content-sha256;x-amz-date';

    if (method === 'PUT') {
      bodyStr = JSON.stringify(data, null, 2);
      payloadHash = await this.sha256(bodyStr);
      canonicalHeaders = `content-type:application/json\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
      signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
    }

    const path = `/${r2Bucket}/${key}`;
    const canonicalReq = [method, path, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
    const credScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const strToSign = ['AWS4-HMAC-SHA256', amzDate, credScope, await this.sha256(canonicalReq)].join('\n');

    let sigKey = await this.hmacSHA256(`AWS4${r2SecretKey}`, dateStamp);
    sigKey = await this.hmacSHA256(sigKey, region);
    sigKey = await this.hmacSHA256(sigKey, service);
    sigKey = await this.hmacSHA256(sigKey, 'aws4_request');
    const signature = this.toHex(await this.hmacSHA256(sigKey, strToSign));

    const authHeader = `AWS4-HMAC-SHA256 Credential=${r2AccessKey}/${credScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    const headers: Record<string, string> = {
      'Authorization': authHeader,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash
    };
    if (method === 'PUT') headers['Content-Type'] = 'application/json';

    const resp = await fetch(`https://${host}${path}`, { method, headers, body: method === 'PUT' ? bodyStr : undefined });
    if (!resp.ok) {
      if (resp.status === 404 && method === 'GET') return null;
      throw new Error(`R2 request failed: ${resp.status}`);
    }
    if (method === 'GET') return resp.json();
    return true;
  },

  async uploadAnswer(data: any): Promise<boolean> {
    const key = `answers/${Date.now()}-${(data.student||'unknown').replace(/\s+/g,'-')}.json`;
    return this.requestR2('PUT', key, data);
  },

  async uploadLesson(lessonData: any): Promise<string> {
    const id = lessonData.id || Math.random().toString(36).substring(2, 11);
    lessonData.id = id;
    const key = `lessons/${id}.json`;
    await this.requestR2('PUT', key, lessonData);
    
    // Attempt to update the public index for history
    try { await this.saveLessonDraft(lessonData); } catch(e) { console.warn('Could not update lessons index', e); }
    
    return id;
  },

  getIndexFileName(): string {
    const teacherId = AppState.get().config.teacherId || 'default';
    return `drafts-index_${teacherId.replace(/[^a-zA-Z0-9_-]/g, '')}.json`;
  },

  async fetchLessonIndex(): Promise<any[]> {
    const idxFileName = this.getIndexFileName();
    const idx = await this.requestR2('GET', idxFileName);
    return Array.isArray(idx) ? idx : [];
  },

  async fetchLesson(id: string): Promise<any> {
    return await this.requestR2('GET', `lessons/${id}.json`);
  },

  async saveLessonDraft(lesson: any) {
    if (!lesson.id) lesson.id = Math.random().toString(36).substring(2, 11);
    lesson.updatedAt = new Date().toISOString();
    
    await this.requestR2('PUT', `lessons/${lesson.id}.json`, lesson);
    
    const index = await this.fetchLessonIndex();
    const existing = index.findIndex((i: any) => i.id === lesson.id);
    const meta = { id: lesson.id, title: lesson.title, subject: lesson.subject, grade: lesson.grade, updatedAt: lesson.updatedAt };
    if (existing >= 0) index[existing] = meta;
    else index.push(meta);
    
    const idxFileName = this.getIndexFileName();
    await this.requestR2('PUT', idxFileName, index);
  }
};
