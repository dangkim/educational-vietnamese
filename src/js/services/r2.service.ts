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

  async uploadToR2(key: string, data: any): Promise<boolean> {
    const { r2AccountId, r2AccessKey, r2SecretKey, r2Bucket } = AppState.get().config;
    if (!r2AccountId || !r2AccessKey || !r2SecretKey || !r2Bucket) throw new Error('R2 not configured');

    const body = JSON.stringify(data, null, 2);
    const host = `${r2AccountId}.r2.cloudflarestorage.com`;
    const region = 'auto';
    const service = 's3';
    const now = new Date();
    const dateStamp = now.toISOString().slice(0,10).replace(/-/g,'');
    const amzDate = now.toISOString().replace(/[-:]/g,'').slice(0,15)+'Z';
    const payloadHash = await this.sha256(body);
    const path = `/${r2Bucket}/${key}`;
    const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
    const canonicalReq = ['PUT', path, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
    const credScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const strToSign = ['AWS4-HMAC-SHA256', amzDate, credScope, await this.sha256(canonicalReq)].join('\n');

    let sigKey = await this.hmacSHA256(`AWS4${r2SecretKey}`, dateStamp);
    sigKey = await this.hmacSHA256(sigKey, region);
    sigKey = await this.hmacSHA256(sigKey, service);
    sigKey = await this.hmacSHA256(sigKey, 'aws4_request');
    const signature = this.toHex(await this.hmacSHA256(sigKey, strToSign));

    const authHeader = `AWS4-HMAC-SHA256 Credential=${r2AccessKey}/${credScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    const resp = await fetch(`https://${host}${path}`, {
      method: 'PUT',
      headers: { 'Authorization': authHeader, 'x-amz-date': amzDate, 'x-amz-content-sha256': payloadHash, 'Content-Type': 'application/json' },
      body
    });
    if (!resp.ok) throw new Error(`R2 upload failed: ${resp.status}`);
    return true;
  },

  async uploadAnswer(data: any): Promise<boolean> {
    const key = `answers/${Date.now()}-${(data.student||'unknown').replace(/\s+/g,'-')}.json`;
    return this.uploadToR2(key, data);
  },

  async uploadLesson(lessonData: any): Promise<string> {
    const id = Math.random().toString(36).substring(2, 11);
    const key = `lessons/${id}.json`;
    await this.uploadToR2(key, lessonData);
    return id;
  }
};
