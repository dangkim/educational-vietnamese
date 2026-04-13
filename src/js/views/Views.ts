/**
 * EduPlay Views — HomeView, TeacherView, StudentView
 */
import { Component } from '../core/Component';
import { bus, Events } from '../core/EventBus';
import { store } from '../core/Store';
import { 
  escHTML, 
  resolveVideoUrl, 
  decodeBase64, 
  encodeBase64, 
  starsDisplay, 
  calcStars, 
  formatTime 
} from '../utils/helpers';
import { GeminiService } from '../services/GeminiService';
import { R2Service } from '../services/StorageService';
import { FlashcardGame } from '../games/FlashcardGame';
import { WordleGame, MemoryGame, FillBlankGame, MCQGame } from '../games/Games';

const GAME_DEFS = [
  { key: 'flashcard', label: 'Flashcards',    icon: '🃏', qKey: 'flashcards',     cls: FlashcardGame,   sub: 'Nhớ thuật ngữ' },
  { key: 'wordle',    label: 'Wordle',        icon: '🔤', qKey: 'wordle',         cls: WordleGame,      sub: 'Đoán từ vựng' },
  { key: 'memory',    label: 'Memory',        icon: '🧩', qKey: 'memory',         cls: MemoryGame,      sub: 'Ghép cặp đúng' },
  { key: 'fillblank', label: 'Điền trống',     icon: '✏️', qKey: 'fillBlank',      cls: FillBlankGame,   sub: 'Hoàn thành câu' },
  { key: 'mcq',       label: 'Trắc nghiệm',    icon: '📋', qKey: 'multipleChoice', cls: MCQGame,         sub: 'Chọn đáp án' },
];

// ─────────────────────────────────────────────────────────────────────────────
// HOME VIEW
// ─────────────────────────────────────────────────────────────────────────────

export class HomeView extends Component {
  render(): string {
    return `
      <div class="view-home fade-in">
        <section class="hero-section">
          <div class="hero-content">
            <h1 class="hero-title">Học Tập <span class="text-gradient">Sáng Tạo</span> Cùng AI</h1>
            <p class="hero-subtitle">Biến mọi bài học khô khan thành trò chơi tương tác thú vị chỉ trong vài giây. Dành cho cả Giáo viên và Học sinh.</p>
            <div class="hero-actions">
              <button class="btn btn-primary btn-lg" id="go-teacher">👨‍🏫 Tôi là Giáo viên</button>
              <button class="btn btn-secondary btn-lg" id="go-student">🎓 Tôi là Học sinh</button>
            </div>
          </div>
          <div class="hero-visual">
            <div class="hero-floating-card fc-1">🃏 Flashcards</div>
            <div class="hero-floating-card fc-2">🧩 Memory</div>
            <div class="hero-floating-card fc-3">📋 MCQ</div>
            <div class="hero-floating-card fc-4">🔤 Wordle</div>
          </div>
        </section>

        <section class="features-grid">
          <div class="feature-card">
            <div class="f-icon">⚡</div>
            <h3>Tự động hóa</h3>
            <p>Tạo bộ câu hỏi từ bất kỳ văn bản nào bằng trí tuệ nhân tạo Gemini 2.0 Flash.</p>
          </div>
          <div class="feature-card">
            <div class="f-icon">🎮</div>
            <h3>Trò chơi hóa</h3>
            <p>5 dạng bài tập tương tác giúp học sinh tiếp thu kiến thức một cách tự nhiên.</p>
          </div>
          <div class="feature-card">
            <div class="f-icon">📱</div>
            <h3>PWA & Offline</h3>
            <p>Hoạt động mượt mà như ứng dụng di động, hỗ trợ khi không có internet.</p>
          </div>
        </section>
      </div>
    `;
  }

  afterMount(): void {
    this.on('#go-teacher', 'click', () => bus.emit(Events.NAVIGATE, '/teacher'));
    this.on('#go-student', 'click', () => bus.emit(Events.NAVIGATE, '/student'));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TEACHER VIEW
// ─────────────────────────────────────────────────────────────────────────────

export class TeacherView extends Component {
  #gemini = new GeminiService('');
  #step = 1;

  render(): string {
    const lesson = store.get('lesson');
    return `
      <div class="view-teacher fade-in">
        <header class="v-header">
          <div class="v-header-left">
            <button class="btn btn-icon-only" id="back-home">◀</button>
            <h2>Bảng Điều Khiển <span class="text-gradient">Giáo Viên</span></h2>
          </div>
          <div class="v-header-right">
            <button class="btn btn-ghost" id="btn-config">⚙️ Cấu hình</button>
          </div>
        </header>

        <div class="teacher-steps">
          <div class="t-step active" data-step="1">1. Tài liệu & Thông tin</div>
          <div class="t-step" data-step="2">2. Kiểm tra & Chỉnh sửa</div>
          <div class="t-step" data-step="3">3. Chia sẻ & Xuất bản</div>
        </div>

        <div class="teacher-content">
          <!-- STEP 1 -->
          <div id="step-1" class="t-panel">
            <div class="form-section">
              <h3>Thông Tin Bài Học</h3>
              <div class="grid-2">
                <div class="form-group">
                  <label>Tên bài dạy</label>
                  <input class="form-input" id="t-title" value="${escHTML(lesson.title)}" placeholder="VD: Lịch sử nhà Trần">
                </div>
                <div class="grid-2">
                  <div class="form-group">
                    <label>Môn học</label>
                    <input class="form-input" id="t-subject" value="${escHTML(lesson.subject)}">
                  </div>
                  <div class="form-group">
                    <label>Khối lớp</label>
                    <input class="form-input" id="t-grade" value="${escHTML(lesson.grade)}">
                  </div>
                </div>
              </div>
            </div>

            <div class="form-section">
              <h3>Nội Dung Tài Liệu (AI sẽ phân tích từ đây)</h3>
              <textarea class="form-input" id="t-doc" style="height:250px" placeholder="Dán nội dung bài học vào đây...">${escHTML(lesson.documentText)}</textarea>
              <div style="margin-top:12px; display:flex; gap:12px">
                <button class="btn btn-primary" id="btn-generate">✨ Tạo Bộ Câu Hỏi (AI)</button>
              </div>
            </div>
          </div>

          <!-- STEP 2 -->
          <div id="step-2" class="t-panel hidden">
            <div class="form-section">
              <h3>Video & Hình Ảnh Minh Họa</h3>
              <p class="text-muted">Gắn các link YouTube hoặc video trực tiếp để học sinh xem.</p>
              <div id="section-media-list"></div>
            </div>

            <div class="form-section">
              <h3>Bộ Câu Hỏi Đã Tạo</h3>
              <div class="q-summary-grid" id="q-summary"></div>
              <p style="margin-top:16px;text-align:right">
                <button class="btn btn-primary" id="btn-to-step3">Tiếp tục →</button>
              </p>
            </div>
          </div>

          <!-- STEP 3 -->
          <div id="step-3" class="t-panel hidden">
            <div class="success-box">
              <div style="font-size:3rem">🚀</div>
              <h3>Sẵn Sàng Xuất Bản!</h3>
              <p>Bài học của bạn đã được cấu hình xong. Chọn phương thức chia sẻ:</p>
            </div>

            <div class="share-options">
              <div class="share-card">
                <h4>🔗 Link Chia Sẻ Trực Tiếp</h4>
                <p>Học sinh chỉ cần nhấn vào link để học ngay.</p>
                <div class="copy-box">
                  <input readonly id="share-link" class="form-input">
                  <button class="btn btn-primary" id="btn-copy">Copy</button>
                </div>
              </div>
              <div class="share-card">
                <h4>📂 Xuất File Offline</h4>
                <p>Tải file bài học (.json) để lưu trữ hoặc nộp.</p>
                <button class="btn btn-secondary" id="btn-export">Tải File</button>
              </div>
            </div>

            <p style="text-align:center;margin-top:32px">
              <button class="btn btn-ghost" id="preview-student">👁️ Xem trước (Giao diện học sinh)</button>
            </p>
          </div>
        </div>
        
        <!-- Generation Overlay -->
        <div id="gen-overlay" class="overlay hidden">
          <div class="gen-card">
            <div class="gen-spinner"></div>
            <h3 id="gen-status">Đang tạo...</h3>
            <div class="progress-base"><div id="gen-progress" class="progress-fill"></div></div>
          </div>
        </div>
      </div>
    `;
  }

  afterMount(): void {
    const key = store.get('config.geminiKey');
    this.#gemini.setApiKey(key);

    this.on('#back-home', 'click', () => bus.emit(Events.NAVIGATE, '/'));
    this.on('#btn-config', 'click', () => this.#openConfig());
    this.on('#btn-generate', 'click', () => this.#generate());
    this.on('#btn-to-step3', 'click', () => this.#setStep(3));
    this.on('#btn-export', 'click', () => this.#exportLesson());
    this.on('#btn-copy', 'click', () => this.#copyLink());
    this.on('#preview-student', 'click', () => bus.emit(Events.NAVIGATE, '/student'));

    // Sync form to store
    this.on('#t-title',   'input', (e) => store.set('lesson.title', e.target.value));
    this.on('#t-subject', 'input', (e) => store.set('lesson.subject', e.target.value));
    this.on('#t-grade',   'input', (e) => store.set('lesson.grade', e.target.value));
    this.on('#t-doc',     'input', (e) => store.set('lesson.documentText', e.target.value));

    // AI Events
    this.listen(Events.AI_START, ({ steps }) => {
      this.qs('#gen-overlay')?.classList.remove('hidden');
    });
    this.listen(Events.AI_STEP, ({ step, index, total }) => {
      if (this.qs('#gen-status')) this.qs('#gen-status')!.textContent = step.label;
      const fill = this.qs('#gen-progress');
      if (fill) fill.style.width = `${((index + 1) / total) * 100}%`;
    });
    this.listen(Events.AI_DONE, () => {
      this.qs('#gen-overlay')?.classList.add('hidden');
      bus.emit(Events.TOAST_SHOW, { message: '🎉 Đã tạo bộ câu hỏi thành công!', type: 'success' });
      this.#setStep(2);
      this.#renderMediaList();
      this.#renderQSummary();
    });
    this.listen(Events.AI_ERROR, (err) => {
      this.qs('#gen-overlay')?.classList.add('hidden');
      bus.emit(Events.MODAL_OPEN, { title: 'Lỗi AI', body: `<p style="color:red">${err.message}</p>`, icon: '❌' });
    });

    if (store.get('lesson.generatedAt')) {
      this.#renderMediaList();
      this.#renderQSummary();
    }
  }

  #setStep(s: number): void {
    this.#step = s;
    this.qsAll('.t-step').forEach((el, i) => el.classList.toggle('active', i + 1 === s));
    this.qsAll('.t-panel').forEach((el, i) => el.classList.toggle('hidden', i + 1 !== s));
    if (s === 3) this.#updateShareLink();
  }

  #openConfig(): void {
    const cfg = store.get('config');
    bus.emit(Events.MODAL_OPEN, {
      title: 'Cấu Hình Hệ Thống',
      body: `
        <div class="form-group">
          <label>Gemini API Key</label>
          <input class="form-input" id="cfg-key" type="password" value="${cfg.geminiKey ?? ''}" placeholder="Nhập key...">
        </div>
        <hr style="margin:20px 0; opacity:.1">
        <label>Cloudflare R2 (Tùy chọn - Để nộp bài)</label>
        <div class="form-group"><input class="form-input" id="cfg-r2-acc" value="${cfg.r2AccountId ?? ''}" placeholder="Account ID"></div>
        <div class="form-group"><input class="form-input" id="cfg-r2-bucket" value="${cfg.r2Bucket ?? ''}" placeholder="Bucket Name"></div>
        <div class="form-group"><input class="form-input" id="cfg-r2-pub" value="${cfg.r2AccessKey ?? ''}" placeholder="Access Key"></div>
        <div class="form-group"><input class="form-input" id="cfg-r2-sec" type="password" value="${cfg.r2SecretKey === '***saved***' ? '' : (cfg.r2SecretKey ?? '')}" placeholder="Secret Key"></div>
      `,
      actions: [{ label: 'Lưu thay đổi', type: 'btn-primary', onClick: () => {
        const geminiKey = (document.getElementById('cfg-key') as HTMLInputElement).value;
        const r2AccountId = (document.getElementById('cfg-r2-acc') as HTMLInputElement).value;
        const r2Bucket = (document.getElementById('cfg-r2-bucket') as HTMLInputElement).value;
        const r2AccessKey = (document.getElementById('cfg-r2-pub') as HTMLInputElement).value;
        const s = (document.getElementById('cfg-r2-sec') as HTMLInputElement).value;
        
        const newCfg = { 
          geminiKey, 
          r2AccountId, 
          r2Bucket, 
          r2AccessKey, 
          r2SecretKey: s || (cfg.r2SecretKey === '***saved***' ? cfg.r2SecretOriginal : '') 
        };
        store.set('config', newCfg);
        this.#gemini.setApiKey(geminiKey);
        bus.emit(Events.TOAST_SHOW, { message: '✅ Đã lưu cấu hình!', type: 'success' });
      }}]
    });
  }

  async #generate(): Promise<void> {
    const text = store.get('lesson.documentText');
    const meta = { title: store.get('lesson.title'), subject: store.get('lesson.subject'), grade: store.get('lesson.grade') };
    try {
      const qs = await this.#gemini.generateQuestions(text, meta);
      store.update('lesson', (l: any) => ({ ...l, questions: qs, generatedAt: Date.now() }));
    } catch (e) {}
  }

  #renderMediaList(): void {
    const list = this.qs('#section-media-list');
    if (!list) return;
    const sections = store.get('lesson.sections');
    list.innerHTML = sections.map((sec: any, i: number) => `
      <div class="media-item">
        <div class="media-item-header">
          <span class="m-icon">${sec.icon}</span>
          <strong>Phần ${i + 1}: ${escHTML(sec.name)}</strong>
        </div>
        <div class="form-group">
          <label>Link Video (YouTube, MP4...)</label>
          <input class="form-input m-vid-input" data-idx="${i}" value="${escHTML(sec.videos?.[0] || '')}" placeholder="Dán URL video...">
        </div>
      </div>
    `).join('');

    list.querySelectorAll('.m-vid-input').forEach(input => {
      input.addEventListener('input', (e: any) => {
        const idx = Number(input.getAttribute('data-idx'));
        store.update('lesson.sections', (s: any) => {
          const copy = [...s];
          copy[idx] = { ...copy[idx], videos: [e.target.value] };
          return copy;
        });
      });
    });
  }

  #renderQSummary(): void {
    const el = this.qs('#q-summary');
    if (!el) return;
    const q = store.get('lesson.questions');
    el.innerHTML = [
      { l: 'Flashcards', c: q.flashcards.length, i: '🃏' },
      { l: 'Wordle',     c: q.wordle.length,     i: '🔤' },
      { l: 'Memory',     c: q.memory.length,     i: '🧩' },
      { l: 'Điền trống',  c: q.fillBlank.length,  i: '✏️' },
      { l: 'Trắc nghiệm', c: q.multipleChoice.length, i: '📋' },
    ].map(item => `
      <div class="q-stat-card">
        <span style="font-size:1.5rem">${item.i}</span>
        <div class="q-stat-val">${item.c}</div>
        <div class="q-stat-label">${item.l}</div>
      </div>
    `).join('');
  }

  #updateShareLink(): void {
    const lesson = store.get('lesson');
    const base = window.location.origin + window.location.pathname;
    const encoded = encodeBase64(lesson);
    const link = `${base}#student?lesson=${encoded}`;
    if (this.qs('#share-link')) (this.qs('#share-link') as HTMLInputElement).value = link;
  }

  #copyLink(): void {
    const el = this.qs('#share-link') as HTMLInputElement;
    el.select();
    document.execCommand('copy');
    bus.emit(Events.TOAST_SHOW, { message: '📋 Đã sao chép link!', type: 'success' });
  }

  #exportLesson(): void {
    const lesson = store.get('lesson');
    const blob = new Blob([JSON.stringify(lesson, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bai-hoc-${(lesson.title || 'giao-an').replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STUDENT VIEW
// ─────────────────────────────────────────────────────────────────────────────

export class StudentView extends Component {
  #currentSection = 0;
  #currentVideo = 0;
  #activeGame = '';
  #activeGameInst: any = null;
  #r2 = new R2Service();
  
  #unsubs: Array<() => void> = [];

  render(): string {
    const lesson = store.get('lesson');
    if (!lesson.generatedAt && !new URLSearchParams(window.location.hash.split('?')[1]).get('lesson')) {
        return `
          <div class="view-student fade-in">
            <div class="empty-state">
              <div class="empty-state-icon">🎓</div>
              <h3>Chưa có bài học nào được tải</h3>
              <p>Vui lòng quay lại Trang Chủ hoặc nhận link từ Giáo Viên.</p>
              <button class="btn btn-primary" onclick="window.location.hash='#/'">Về Trang Chủ</button>
            </div>
          </div>
        `;
    }

    return `
      <div class="view-student fade-in">
        <header class="student-header">
          <div class="s-header-left">
            <h1 class="lesson-title-badge">${escHTML(lesson.title)}</h1>
            <div class="lesson-meta-chips">
              <span class="chip chip-purple">${escHTML(lesson.subject)}</span>
              <span class="chip chip-blue">Lớp ${escHTML(lesson.grade)}</span>
            </div>
          </div>
          <div class="s-header-right">
             <div class="stat-chip" id="lesson-time">⏱ 0:00</div>
          </div>
        </header>

        <main class="student-layout">
          <aside class="student-sidebar">
            <nav class="section-nav" id="section-nav" role="tablist"></nav>
            <div class="student-info-card">
              <label>Học sinh:</label>
              <input class="form-input" id="student-name" value="${escHTML(store.get('student.name'))}" placeholder="Nhập tên của em...">
            </div>
          </aside>

          <section class="student-main">
            <!-- VIDEO AREA -->
            <div id="video-area" class="student-panel">
              <div class="panel-header">
                <div style="display:flex;align-items:center;gap:12px">
                   <span class="panel-icon" id="curr-sec-icon"></span>
                   <h2 id="curr-sec-name"></h2>
                </div>
                <button class="btn btn-mint btn-sm" id="btn-complete-section">Xem xong — Phần tiếp theo! →</button>
              </div>
              <div class="video-container" id="video-player"></div>
              <div class="video-nav-bar hidden" id="video-nav-bar">
                 <button class="btn btn-icon-only" id="vid-prev">◀</button>
                 <div class="video-dots" id="video-dots"></div>
                 <button class="btn btn-icon-only" id="vid-next">▶</button>
              </div>
            </div>

            <!-- ACTIVITIES AREA -->
            <div id="activities-area" class="student-panel hidden">
              <div class="panel-header">
                <div style="display:flex;align-items:center;gap:12px">
                   <span class="panel-icon">🎮</span>
                   <h2>Khu Vực Bài Tập</h2>
                </div>
                <div style="display:flex;gap:8px">
                  <button class="btn btn-ghost btn-sm" id="btn-download">📥 Lưu bài</button>
                  <button class="btn btn-primary btn-sm" id="btn-submit">🚀 Nộp Bài</button>
                </div>
              </div>
              
              <div class="game-grid" id="game-grid" role="list"></div>
              
              <div class="game-viewport" id="game-container">
                <div class="empty-state">
                  <div class="empty-state-icon">🖱️</div>
                  <p>Chọn một trò chơi ở trên để bắt đầu luyện tập!</p>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    `;
  }

  afterMount(): void {
    if (!store.get('student.sessionId')) store.resetStudent();

    // Session timer
    const lessonStart = Date.now();
    const timerEl = this.qs('#lesson-time');
    const timerID = setInterval(() => {
      const s = Math.floor((Date.now() - lessonStart) / 1000);
      if (timerEl) timerEl.textContent = `⏱ ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    }, 1000);
    this.#unsubs.push(() => clearInterval(timerID));

    // Load lesson from URL if present
    const hashParts = window.location.hash.split('?');
    if (hashParts.length > 1) {
        const params = new URLSearchParams(hashParts[1]);
        const encoded = params.get('lesson');
        if (encoded) {
          const lesson = decodeBase64(encoded);
          if (lesson) store.loadLesson(lesson);
        }
    }

    this.#renderSectionNav();
    this.#showSection(0);
    this.#renderGameGrid();

    // Events
    this.on('#btn-complete-section', 'click', () => this.#completeSection());
    this.on('#vid-prev', 'click', () => { this.#currentVideo--; this.#renderVideo(); });
    this.on('#vid-next', 'click', () => { this.#currentVideo++; this.#renderVideo(); });
    this.on('#student-name', 'input', (e: any) => store.set('student.name', e.target.value.trim()));
    this.on('#btn-download', 'click', () => this.#download());
    this.on('#btn-submit',   'click', () => this.#submit());

    // React to game completion badges
    this.listen(Events.GAME_COMPLETE, ({ gameKey }) => {
      const badge = this.qs(`[data-game="${gameKey}"] .game-card-badge`) as HTMLElement;
      if (badge) badge.style.background = 'var(--color-mint)';
      const stars = this.qs(`[data-game="${gameKey}"] .game-card-stars`) as HTMLElement;
      if (stars) {
        const sc = store.get(`student.scores.${gameKey}`);
        stars.textContent = sc ? starsDisplay(sc.stars) : '';
      }
    });
  }
  
  beforeUnmount(): void {
      this.#unsubs.forEach(fn => fn());
      this.#unsubs = [];
  }

  #renderSectionNav(): void {
    const nav = this.qs('#section-nav');
    const sections = store.get('lesson.sections');
    const progress = store.get('student.sectionProgress');
    if (!nav) return;
    nav.innerHTML = sections.map((sec: any, i: number) => `
      <button class="section-tab ${i === this.#currentSection ? 'active' : ''} ${progress[i] ? 'completed' : ''}"
              data-sec-tab="${i}" role="tab" aria-selected="${i === this.#currentSection}">
        ${sec.icon} ${escHTML(sec.name)} ${progress[i] ? '✓' : ''}
      </button>
    `).join('') + `
      <button class="section-tab ${this.#currentSection === 4 ? 'active' : ''}"
              id="tab-activities" role="tab">
        🎮 Bài Tập
      </button>
    `;
    nav.querySelectorAll('[data-sec-tab]').forEach(btn => {
      btn.addEventListener('click', () => this.#showSection(Number((btn as HTMLElement).dataset.secTab)));
    });
    this.qs('#tab-activities')?.addEventListener('click', () => this.#showActivities());
  }

  #showSection(idx: number): void {
    this.#currentSection = idx;
    this.#currentVideo = 0;
    this.qs('#video-area')?.classList.remove('hidden');
    this.qs('#activities-area')?.classList.add('hidden');
    this.#renderSectionNav();

    const sec = store.get(`lesson.sections.${idx}`);
    if (!sec) return;
    const iconEl = this.qs('#curr-sec-icon');
    const nameEl = this.qs('#curr-sec-name');
    if (iconEl) iconEl.textContent = sec.icon;
    if (nameEl) nameEl.textContent = sec.name;
    this.#renderVideo();
  }

  #completeSection(): void {
    store.update('student.sectionProgress', (p: boolean[]) => {
      const copy = [...p]; 
      copy[this.#currentSection] = true; 
      return copy;
    });
    const next = this.#currentSection + 1;
    if (next < 4) {
      this.#showSection(next);
      bus.emit(Events.TOAST_SHOW, { message: `✅ Xong! Chuyển sang "${store.get(`lesson.sections.${next}.name`)}"`, type: 'success' });
    } else {
      this.#showActivities();
      bus.emit(Events.TOAST_SHOW, { message: '🎉 Đã xem xong tất cả! Làm bài tập nhé!', type: 'success' });
    }
  }

  #showActivities(): void {
    this.#currentSection = 4;
    this.qs('#video-area')?.classList.add('hidden');
    const actArea = this.qs('#activities-area');
    if (actArea) {
        actArea.classList.remove('hidden');
        this.#renderSectionNav();
        actArea.scrollIntoView({ behavior: 'smooth' });
    }
  }

  #renderVideo(): void {
    const sec = store.get(`lesson.sections.${this.#currentSection}`);
    const videos = (sec?.videos ?? []).filter((v: string) => v?.trim());
    const player = this.qs('#video-player');
    const navBar = this.qs('#video-nav-bar');
    if (!player) return;

    player.innerHTML = '';
    if (!videos.length) {
      player.innerHTML = `
        <div class="video-placeholder">
          <span class="video-placeholder-icon">🎬</span>
          <span class="video-placeholder-text">Chưa có video cho phần này</span>
        </div>
      `;
      navBar?.classList.add('hidden');
      return;
    }

    const idx = Math.max(0, Math.min(this.#currentVideo, videos.length - 1));
    this.#currentVideo = idx;
    const resolved = resolveVideoUrl(videos[idx]);

    if (!resolved) {
      player.innerHTML = `<div class="video-placeholder"><span class="video-placeholder-icon">⚠️</span><span class="video-placeholder-text">Link không hợp lệ</span></div>`;
    } else if (resolved.type === 'iframe') {
      player.innerHTML = `<iframe src="${escHTML(resolved.url)}" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" loading="lazy"></iframe>`;
    } else {
      player.innerHTML = `<video src="${escHTML(resolved.url)}" controls preload="metadata" style="width:100%;height:100%"></video>`;
    }

    // Dot navigation
    if (videos.length > 1) {
      navBar?.classList.remove('hidden');
      const dotsEl = this.qs('#video-dots');
      if (dotsEl) {
          dotsEl.innerHTML = videos.map((_: any, i: number) => `<div class="video-dot ${i === idx ? 'active' : ''}" data-dot="${i}" role="button" tabindex="0" aria-label="Video ${i + 1}"></div>`).join('');
          dotsEl.querySelectorAll('.video-dot').forEach(d => {
            d.addEventListener('click', () => { this.#currentVideo = Number((d as HTMLElement).dataset.dot); this.#renderVideo(); });
          });
      }
      const prev = this.qs('#vid-prev') as HTMLButtonElement;
      const next = this.qs('#vid-next') as HTMLButtonElement;
      if (prev) prev.disabled = idx === 0;
      if (next) next.disabled = idx === videos.length - 1;
    } else {
      navBar?.classList.add('hidden');
    }
  }

  #renderGameGrid(): void {
    const grid = this.qs('#game-grid');
    if (!grid) return;
    const q = store.get('lesson.questions');
    grid.innerHTML = GAME_DEFS.map(g => {
      const count = (q[g.qKey as keyof typeof q] ?? []).length;
      const scores = store.get(`student.scores.${g.key}`);
      const completed = store.get('student.completedGames');
      const done = Array.isArray(completed) ? completed.includes(g.key) : completed?.has?.(g.key);
      
      return `
        <div class="game-card ${done ? 'selected' : ''}" data-game="${g.key}" role="listitem" tabindex="0"
             aria-label="Chơi ${g.label}, ${count} câu hỏi">
          ${done ? `<div class="game-card-badge">✓</div>` : count > 0 ? `<div class="game-card-badge">${count}</div>` : ''}
          <div class="game-card-inner">
            <span class="game-card-icon">${g.icon}</span>
            <div class="game-card-label">${g.label}</div>
            <div class="game-card-sub">${g.sub}</div>
          </div>
          ${done && scores ? `<div class="game-card-stars">${starsDisplay(scores.stars)}</div>` : ''}
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.game-card').forEach(card => {
      card.addEventListener('click', () => this.#selectGame((card as HTMLElement).dataset.game!));
      card.addEventListener('keydown', (e: any) => { if (e.key === 'Enter' || e.key === ' ') this.#selectGame((card as HTMLElement).dataset.game!); });
    });
  }

  #selectGame(key: string): void {
    this.#activeGameInst?.destroy?.();
    this.qsAll('.game-card').forEach(c => c.classList.toggle('selected', (c as HTMLElement).dataset.game === key));
    this.#activeGame = key;

    const container = this.qs('#game-container');
    if (!container) return;
    container.innerHTML = '';
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });

    const def = GAME_DEFS.find(g => g.key === key);
    if (!def) return;

    this.#activeGameInst = new def.cls();
    this.#activeGameInst.init(container);
    bus.emit(Events.GAME_SELECTED, { gameKey: key });
  }

  #buildPayload(): any {
    const completedGames = store.get('student.completedGames');
    return {
      lessonTitle: store.get('lesson.title'),
      student:     store.get('student.name') || 'Ẩn danh',
      sessionId:   store.get('student.sessionId'),
      submittedAt: new Date().toISOString(),
      scores:      store.get('student.scores'),
      answers:     store.get('student.answers'),
    };
  }

  #download(): void {
    const data = this.#buildPayload();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bai-lam-${(data.student).replace(/\s+/g, '-')}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    bus.emit(Events.TOAST_SHOW, { message: '⬇️ Đã tải file bài làm!', type: 'success' });
  }

  async #submit(): Promise<void> {
    if (!store.get('student.name')) {
      bus.emit(Events.TOAST_SHOW, { message: '⚠️ Vui lòng nhập tên trước khi nộp!', type: 'error' });
      const nameInput = this.qs('#student-name') as HTMLElement;
      nameInput?.focus();
      return;
    }
    const payload = this.#buildPayload();
    const cfg = store.get('config');

    if (cfg.r2AccountId && cfg.r2Bucket && cfg.r2AccessKey && cfg.r2SecretKey) {
      const btn = this.qs('#btn-submit') as HTMLButtonElement;
      if (btn) { btn.disabled = true; btn.textContent = '⏳ Đang nộp...'; }
      this.#r2.configure({ accountId: cfg.r2AccountId, accessKey: cfg.r2AccessKey, secretKey: cfg.r2SecretKey, bucket: cfg.r2Bucket });
      try {
        const filename = `${payload.student.replace(/\s+/g, '-')}-${Date.now()}.json`;
        await this.#r2.upload(filename, payload);
        const scores = payload.scores;
        const keys = Object.keys(scores);
        const completedCount = keys.length;
        const avgPct = completedCount > 0
          ? Math.round(keys.reduce((acc, k) => acc + (scores[k].pct ?? 0), 0) / completedCount)
          : 0;
        bus.emit(Events.SUCCESS_SHOW, {
          icon: '🚀', title: 'Nộp bài thành công!',
          message: `${payload.student} — bài làm đã được lưu lên cloud!`,
          score: avgPct,
          detail: `${completedCount} dạng bài hoàn thành`,
        });
        return;
      } catch (e: any) {
        bus.emit(Events.TOAST_SHOW, { message: `⚠️ R2 lỗi: ${e.message}. Tải file thay thế...`, type: 'warning', duration: 5000 });
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = '🚀 Nộp Bài'; }
      }
    }

    this.#download();
    const completedCount = Object.keys(payload.scores).length;
    bus.emit(Events.SUCCESS_SHOW, {
      icon: '📥', title: 'Đã lưu bài làm!',
      message: 'File JSON đã được tải về máy của bạn.',
      score: 0,
      detail: `${completedCount} dạng bài`,
    });
  }
}
