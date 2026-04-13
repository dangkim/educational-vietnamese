/**
 * EduPlay Views — HomeView, TeacherView, StudentView
 */
import { Component }      from '../core/Component.js';
import { bus, Events }    from '../core/EventBus.js';
import { store }          from '../core/Store.js';
import { GeminiService }  from '../services/GeminiService.js';
import { StorageService, R2Service } from '../services/StorageService.js';
import { FlashcardGame }  from '../games/FlashcardGame.js';
import { WordleGame, MemoryGame, FillBlankGame, MCQGame } from '../games/Games.js';
import {
  escHTML, encodeBase64, decodeBase64, resolveVideoUrl,
  uuid, formatDate, shuffle, calcStars, starsDisplay
} from '../utils/helpers.js';

// ─── Shared nav HTML ──────────────────────────────────────────────────────
const buildNav = (title, backLabel = '← Về trang chủ') => `
  <nav class="top-nav" role="navigation">
    <a class="nav-brand" href="#/" aria-label="EduPlay trang chủ">
      <span class="nav-brand-star">⭐</span>
      <span class="nav-brand-name">EduPlay</span>
    </a>
    <span class="nav-title">${escHTML(title)}</span>
    <div class="nav-actions">
      <button class="btn-nav-back" id="nav-back" aria-label="${escHTML(backLabel)}">
        ← Thoát
      </button>
    </div>
  </nav>
`;

// ============================================================
// HOME VIEW
// ============================================================
export class HomeView extends Component {
  render() {
    const hasLesson = !!store.get('lesson.title');
    return `
      <div class="home-view gradient-animated">
        <div class="home-logo-wrap">
          <h1 class="home-logo-title">🌟 EduPlay</h1>
          <p class="home-logo-tagline">Học vui — Dạy hay — Tương tác mỗi ngày!</p>
          <div class="home-decorations">
            <span aria-hidden="true">📚</span>
            <span aria-hidden="true">🎮</span>
            <span aria-hidden="true">🏆</span>
            <span aria-hidden="true">✨</span>
          </div>
        </div>

        <div class="home-cards" role="list">
          <div class="home-card teacher anim-pop delay-1" id="btn-teacher" role="listitem"
               tabindex="0" aria-label="Vào chế độ giáo viên">
            <div class="home-card-icon" aria-hidden="true">👩‍🏫</div>
            <h2>Giáo Viên</h2>
            <p>Soạn bài &amp; tạo câu hỏi với AI</p>
          </div>
          <div class="home-card student anim-pop delay-2" id="btn-student" role="listitem"
               tabindex="0" aria-label="Vào chế độ học sinh">
            <div class="home-card-icon" aria-hidden="true">🧒</div>
            <h2>Học Sinh</h2>
            <p>Học bài &amp; chơi game vui vẻ</p>
          </div>
        </div>

        ${hasLesson ? `
          <div class="anim-fade" style="text-align:center">
            <p style="color:var(--color-muted);font-size:var(--text-sm);font-weight:700;margin-bottom:12px">
              📂 Có bài học đang lưu: <strong style="color:var(--color-dark)">${escHTML(store.get('lesson.title'))}</strong>
            </p>
            <button class="btn btn-ghost btn-sm" id="btn-clear-lesson">🗑️ Xoá &amp; tạo mới</button>
          </div>
        ` : ''}

        <p style="position:absolute;bottom:20px;left:0;right:0;text-align:center;
                  color:var(--color-muted);font-size:var(--text-xs);font-weight:600">
          EduPlay v2.0 — Made with ❤️ for educators
        </p>
      </div>
    `;
  }

  afterMount() {
    this.on('#btn-teacher', 'click',   () => this.#navigate('teacher'));
    this.on('#btn-teacher', 'keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') this.#navigate('teacher'); });
    this.on('#btn-student', 'click',   () => this.#navigate('student'));
    this.on('#btn-student', 'keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') this.#navigate('student'); });
    this.on('#btn-clear-lesson', 'click', () => {
      StorageService.clearLesson();
      store.set('lesson', store.snapshot().lesson);
      window.location.reload();
    });
  }

  #navigate(view) {
    window.location.hash = `#/${view}`;
  }
}

// ============================================================
// TEACHER VIEW
// ============================================================
export class TeacherView extends Component {
  #step      = 1;
  #maxSteps  = 5;
  #stepNames = ['Thông tin', 'Video', 'Tài liệu', 'Cài đặt AI', 'Tạo câu hỏi'];
  #stepIcons = ['📝',        '🎬',    '📄',       '⚙️',         '🤖'];
  #gemini    = new GeminiService('');
  #previewTab= 'flashcards';

  SECTION_COLORS = ['#1565C0','#2E7D32','#6A1B9A','#E65100'];

  render() {
    return `
      <div id="teacher-view">
        ${buildNav(store.get('lesson.title') || 'Tạo Bài Học Mới')}
        <div id="stepper-wrap"></div>
        <div class="wizard-body" style="max-width:var(--max-width-md);margin:0 auto;padding:var(--space-5) var(--space-6) var(--space-16)">
          <div id="wizard-step"></div>
          <div class="wizard-nav" id="wizard-nav">
            <button class="btn btn-ghost" id="btn-prev">← Quay lại</button>
            <button class="btn btn-primary" id="btn-next">Tiếp theo →</button>
          </div>
        </div>
      </div>
    `;
  }

  afterMount() {
    this.on('#nav-back', 'click', () => { window.location.hash = '#/'; });
    this.#restoreState();
    this.#renderStepper();
    this.#showStep(this.#step);
    this.on('#btn-prev', 'click', () => this.#prev());
    this.on('#btn-next', 'click', () => this.#next());
  }

  #restoreState() {
    const saved = StorageService.loadLesson();
    if (saved) store.loadLesson(saved);
    const cfg = StorageService.loadConfig();
    if (cfg) store.set('config', { ...store.get('config'), ...cfg });
  }

  // ─── Stepper ────────────────────────────────────────────────────────────
  #renderStepper() {
    const wrap = this.qs('#stepper-wrap');
    if (!wrap) return;
    wrap.innerHTML = `
      <div class="stepper" role="progressbar" aria-valuenow="${this.#step}" aria-valuemax="${this.#maxSteps}">
        ${this.#stepNames.map((name, i) => {
          const n = i + 1;
          const state = n < this.#step ? 'done' : n === this.#step ? 'active' : 'pending';
          return `
            ${i > 0 ? `<div class="step-line ${n <= this.#step ? 'done' : ''}"></div>` : ''}
            <div class="step ${state}" data-step="${n}" role="button" aria-label="Bước ${n}: ${name}"
                 ${n < this.#step ? 'tabindex="0"' : 'tabindex="-1"'}>
              <div class="step-circle">${state === 'done' ? '✓' : n}</div>
              <span class="step-label">${this.#stepIcons[i]} ${name}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;
    this.qs('.stepper')?.addEventListener('click', (e) => {
      const step = Number(e.target.closest('[data-step]')?.dataset.step);
      if (step && step < this.#step) this.#showStep(step);
    });
  }

  // ─── Step Navigation ────────────────────────────────────────────────────
  async #next() {
    if (!this.#gatherStep(this.#step)) return;
    if (this.#step < this.#maxSteps) { this.#step++; this.#renderStepper(); this.#showStep(this.#step); }
    else this.#publish();
  }

  #prev() {
    if (this.#step > 1) { this.#step--; this.#renderStepper(); this.#showStep(this.#step); }
  }

  #showStep(n) {
    this.#step = n;
    const body = this.qs('#wizard-step');
    if (!body) return;

    const prev = this.qs('#btn-prev');
    const next = this.qs('#btn-next');
    if (prev) prev.style.display = n === 1 ? 'none' : '';
    if (next) {
      if (n === this.#maxSteps) {
        next.textContent = '📤 Publish Bài Học';
        next.className   = 'btn btn-success btn-lg';
      } else {
        next.textContent = 'Tiếp theo →';
        next.className   = 'btn btn-primary';
      }
    }

    const renderers = {
      1: () => this.#renderStep1(),
      2: () => this.#renderStep2(),
      3: () => this.#renderStep3(),
      4: () => this.#renderStep4(),
      5: () => this.#renderStep5(),
    };
    body.innerHTML = renderers[n]?.() ?? '';
    this.#attachStepEvents(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ─── Step 1: Lesson Info ─────────────────────────────────────────────────
  #renderStep1() {
    const lesson = store.get('lesson');
    return `
      <div class="wizard-card">
        <div class="wizard-card-header">
          <h2 class="wizard-card-title">📝 Thông Tin Bài Học</h2>
          <p class="wizard-card-subtitle">Bước 1/5 — Điền thông tin cơ bản cho bài giảng</p>
        </div>
        <div class="form-group">
          <label class="form-label" for="f-title">Tên bài học <span class="required">*</span></label>
          <input class="form-input" id="f-title" value="${escHTML(lesson.title)}"
            placeholder="VD: Bài 5 — Thế giới động vật" maxlength="120" />
          <div class="char-counter" id="title-counter">${lesson.title?.length ?? 0}/120</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-4)">
          <div class="form-group">
            <label class="form-label" for="f-subject">Môn học</label>
            <input class="form-input" id="f-subject" value="${escHTML(lesson.subject)}" placeholder="VD: Khoa học" />
          </div>
          <div class="form-group">
            <label class="form-label" for="f-grade">Lớp / Khối</label>
            <input class="form-input" id="f-grade" value="${escHTML(lesson.grade)}" placeholder="VD: Lớp 4" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label" for="f-desc">Mô tả ngắn</label>
          <textarea class="form-input" id="f-desc" rows="3" maxlength="300"
            placeholder="VD: Tìm hiểu về các loài động vật hoang dã...">${escHTML(lesson.description)}</textarea>
        </div>
      </div>
    `;
  }

  // ─── Step 2: Videos ───────────────────────────────────────────────────────
  #renderStep2() {
    const sections = store.get('lesson.sections');
    return `
      <div class="wizard-card">
        <div class="wizard-card-header">
          <h2 class="wizard-card-title">🎬 Video Bài Giảng</h2>
          <p class="wizard-card-subtitle">Bước 2/5 — Thêm video cho từng phần bài giảng (YouTube, Drive, hoặc URL trực tiếp)</p>
        </div>
        <div class="info-box tip" style="margin-bottom:var(--space-5)">
          <span class="info-box-icon">💡</span>
          <div>Hỗ trợ link <strong>YouTube</strong>, <strong>Google Drive</strong> (file video dạng chia sẻ), hoặc link video <strong>.mp4/.webm</strong> trực tiếp. Mỗi phần có thể có nhiều video.</div>
        </div>
        <div id="sections-wrap">
          ${sections.map((sec, idx) => this.#renderSectionCard(sec, idx)).join('')}
        </div>
      </div>
    `;
  }

  #renderSectionCard(sec, idx) {
    const color  = this.SECTION_COLORS[idx];
    const videos = sec.videos ?? [];
    return `
      <div class="video-section-card open" data-sec-idx="${idx}">
        <div class="video-section-header" data-toggle="${idx}">
          <div class="video-section-icon" style="background:${color}">${sec.icon}</div>
          <span class="video-section-name">${escHTML(sec.name)}</span>
          <span class="video-section-count">${videos.filter(v=>v).length} video</span>
          <span class="video-section-toggle">▲</span>
        </div>
        <div class="video-section-body" id="sec-body-${idx}">
          <div id="vid-list-${idx}">
            ${videos.map((v, vi) => this.#renderVideoItem(idx, vi, v)).join('')}
          </div>
          <button class="btn-add-video" data-add-sec="${idx}">+ Thêm video</button>
        </div>
      </div>
    `;
  }

  #renderVideoItem(secIdx, vidIdx, val = '') {
    return `
      <div class="video-item" id="vi-${secIdx}-${vidIdx}">
        <span class="video-item-icon">🎬</span>
        <input placeholder="Dán link YouTube hoặc URL video..." value="${escHTML(val)}"
          data-sec="${secIdx}" data-vid="${vidIdx}"
          aria-label="Link video ${vidIdx + 1}" />
        <button class="btn btn-icon-only" data-del-sec="${secIdx}" data-del-vid="${vidIdx}"
                aria-label="Xoá video" style="color:var(--color-coral)">✕</button>
      </div>
    `;
  }

  // ─── Step 3: Document ─────────────────────────────────────────────────────
  #renderStep3() {
    const hasDoc = !!store.get('lesson.documentText');
    return `
      <div class="wizard-card">
        <div class="wizard-card-header">
          <h2 class="wizard-card-title">📄 Tài Liệu Bài Học</h2>
          <p class="wizard-card-subtitle">Bước 3/5 — Upload hoặc dán nội dung để AI sinh câu hỏi</p>
        </div>
        <div class="drop-zone" id="drop-zone" role="button" tabindex="0" aria-label="Upload file tài liệu">
          <span class="drop-zone-icon">📂</span>
          <p class="drop-zone-text">Kéo thả file hoặc <u>bấm để chọn</u></p>
          <span class="drop-zone-hint">Hỗ trợ: .txt · .md · .pdf (text) · .doc</span>
        </div>
        <input type="file" id="doc-file" accept=".txt,.md,.pdf,.doc,.docx" style="display:none" aria-hidden="true" />
        <div style="text-align:center;padding:var(--space-4) 0;color:var(--color-muted);font-weight:700">— hoặc —</div>
        <div class="form-group">
          <label class="form-label" for="doc-text">Dán nội dung tài liệu trực tiếp</label>
          <textarea class="form-input" id="doc-text" rows="12"
            placeholder="Dán nội dung bài học vào đây...&#10;&#10;VD: Chương 5: Thế giới Động Vật&#10;5.1 Khái niệm&#10;Động vật là sinh vật đa bào...">${escHTML(store.get('lesson.documentText'))}</textarea>
          <div class="char-counter" id="doc-counter">${(store.get('lesson.documentText')?.length ?? 0).toLocaleString()} ký tự</div>
        </div>
        ${hasDoc ? `<div class="info-box success"><span class="info-box-icon">✅</span><div>Tài liệu đã sẵn sàng — AI sẽ dùng nội dung này để tạo câu hỏi.</div></div>` : ''}
      </div>
    `;
  }

  // ─── Step 4: API Settings ─────────────────────────────────────────────────
  #renderStep4() {
    const cfg = store.get('config');
    return `
      <div class="wizard-card">
        <div class="wizard-card-header">
          <h2 class="wizard-card-title">⚙️ Cài Đặt API</h2>
          <p class="wizard-card-subtitle">Bước 4/5 — Cấu hình Gemini AI và Cloudflare R2 (lưu bài học sinh)</p>
        </div>

        <div class="info-box tip" style="margin-bottom:var(--space-5)">
          <span class="info-box-icon">🤖</span>
          <div><strong>Gemini 2.0 Flash (Miễn phí)</strong> — 1500 requests/ngày. Lấy key tại
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener"
               style="color:var(--color-purple);text-decoration:underline">Google AI Studio ↗</a>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="f-gemini">Gemini API Key <span class="required">*</span></label>
          <div class="input-group">
            <input class="form-input" id="f-gemini" type="password"
              value="${escHTML(cfg.geminiKey)}" placeholder="AIza..." autocomplete="off" />
            <button class="input-group-addon" id="toggle-gemini" aria-label="Hiện/ẩn key">👁️</button>
          </div>
        </div>

        <div style="border-top:1.5px solid var(--color-bg);margin:var(--space-6) 0;padding-top:var(--space-6)">
          <div class="info-box" style="margin-bottom:var(--space-5)">
            <span class="info-box-icon">☁️</span>
            <div><strong>Cloudflare R2 (Tùy chọn)</strong> — Lưu bài làm học sinh lên cloud. Để trống nếu chỉ cần download JSON.</div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-4)">
            <div class="form-group">
              <label class="form-label" for="f-r2-account">Account ID</label>
              <input class="form-input" id="f-r2-account" value="${escHTML(cfg.r2AccountId)}" placeholder="abc123..." />
            </div>
            <div class="form-group">
              <label class="form-label" for="f-r2-bucket">Bucket Name</label>
              <input class="form-input" id="f-r2-bucket" value="${escHTML(cfg.r2Bucket)}" placeholder="eduplay-answers" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="f-r2-access">Access Key ID</label>
            <div class="input-group">
              <input class="form-input" id="f-r2-access" type="password" value="${escHTML(cfg.r2AccessKey)}" placeholder="Access Key..." />
              <button class="input-group-addon" id="toggle-r2a" aria-label="Hiện/ẩn key">👁️</button>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="f-r2-secret">Secret Access Key</label>
            <div class="input-group">
              <input class="form-input" id="f-r2-secret" type="password" value="${escHTML(cfg.r2SecretKey)}" placeholder="Secret..." />
              <button class="input-group-addon" id="toggle-r2s" aria-label="Hiện/ẩn key">👁️</button>
            </div>
          </div>
          <div class="info-box warn">
            <span class="info-box-icon">⚠️</span>
            <div>Cần bật <strong>CORS trên R2 bucket</strong> cho phép PUT từ domain này. Xem hướng dẫn trong README.</div>
          </div>
        </div>
      </div>
    `;
  }

  // ─── Step 5: Generate ─────────────────────────────────────────────────────
  #renderStep5() {
    const hasQ = !!store.get('lesson.questions.flashcards')?.length;
    return `
      <div class="wizard-card">
        <div class="wizard-card-header">
          <h2 class="wizard-card-title">🤖 Tạo Câu Hỏi với AI</h2>
          <p class="wizard-card-subtitle">Bước 5/5 — Gemini AI sẽ tạo 5 dạng bài tập từ tài liệu của bạn</p>
        </div>

        <div style="text-align:center;padding:var(--space-6) 0">
          <button class="btn-generate" id="btn-gen">✨ Bắt Đầu Tạo Câu Hỏi</button>
        </div>

        <div id="gen-progress" class="hidden">
          <div class="gen-steps" id="gen-steps"></div>
        </div>

        <div id="questions-preview" class="${hasQ ? '' : 'hidden'}" style="margin-top:var(--space-6)">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-4)">
            <h3 style="font-size:var(--text-lg)">📋 Câu hỏi đã tạo</h3>
            <button class="btn btn-ghost btn-sm" id="btn-regen">🔄 Tạo lại</button>
          </div>
          <div class="preview-tabs" id="preview-tabs"></div>
          <div class="preview-list" id="preview-list"></div>
        </div>
      </div>
    `;
  }

  // ─── Attach events per step ───────────────────────────────────────────────
  #attachStepEvents(n) {
    if (n === 1) {
      const titleInput = this.qs('#f-title');
      titleInput?.addEventListener('input', (e) => {
        const counter = this.qs('#title-counter');
        if (counter) counter.textContent = `${e.target.value.length}/120`;
      });
    }

    if (n === 2) {
      // Toggle section open/close
      this.qs('#sections-wrap')?.addEventListener('click', (e) => {
        const toggle = e.target.closest('[data-toggle]');
        if (toggle) {
          const card = toggle.closest('.video-section-card');
          card?.classList.toggle('open');
          const body = this.qs(`#sec-body-${toggle.dataset.toggle}`);
          body && (body.style.display = card.classList.contains('open') ? '' : 'none');
        }
        // Add video
        const addBtn = e.target.closest('[data-add-sec]');
        if (addBtn) {
          const si = Number(addBtn.dataset.addSec);
          store.update(`lesson.sections.${si}.videos`, v => [...(v||[]), '']);
          const list = this.qs(`#vid-list-${si}`);
          if (list) {
            const idx = (store.get(`lesson.sections.${si}.videos`) ?? []).length - 1;
            list.insertAdjacentHTML('beforeend', this.#renderVideoItem(si, idx, ''));
          }
        }
        // Delete video
        const delBtn = e.target.closest('[data-del-sec]');
        if (delBtn) {
          const si = Number(delBtn.dataset.delSec), vi = Number(delBtn.dataset.delVid);
          store.update(`lesson.sections.${si}.videos`, v => v.filter((_, i) => i !== vi));
          delBtn.closest('.video-item')?.remove();
        }
      });

      // Update video URLs on input change
      this.qs('#sections-wrap')?.addEventListener('input', (e) => {
        const input = e.target.closest('input[data-sec]');
        if (input) {
          const si = Number(input.dataset.sec), vi = Number(input.dataset.vid);
          store.update(`lesson.sections.${si}.videos`, v => {
            const copy = [...(v||[])]; copy[vi] = input.value; return copy;
          });
        }
      });
    }

    if (n === 3) {
      // Drop zone
      const zone  = this.qs('#drop-zone');
      const input = this.qs('#doc-file');
      zone?.addEventListener('click', () => input?.click());
      zone?.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') input?.click(); });
      zone?.addEventListener('dragover',  (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
      zone?.addEventListener('dragleave', ()  => zone.classList.remove('drag-over'));
      zone?.addEventListener('drop', (e) => {
        e.preventDefault(); zone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file) this.#readFile(file);
      });
      input?.addEventListener('change', (e) => { if (e.target.files[0]) this.#readFile(e.target.files[0]); });

      // Doc textarea counter
      const docText = this.qs('#doc-text');
      docText?.addEventListener('input', (e) => {
        const counter = this.qs('#doc-counter');
        if (counter) counter.textContent = `${e.target.value.length.toLocaleString()} ký tự`;
      });
    }

    if (n === 4) {
      // Eye toggles
      [['#toggle-gemini','#f-gemini'],['#toggle-r2a','#f-r2-access'],['#toggle-r2s','#f-r2-secret']].forEach(([btn, inp]) => {
        this.qs(btn)?.addEventListener('click', () => {
          const el = this.qs(inp);
          if (el) { el.type = el.type === 'password' ? 'text' : 'password'; }
        });
      });
    }

    if (n === 5) {
      this.qs('#btn-gen')?.addEventListener('click',   () => this.#generate());
      this.qs('#btn-regen')?.addEventListener('click', () => this.#generate());
      this.listen(Events.AI_STEP, ({ step, index, total }) => this.#renderGenStep(step, index, total));

      // Restore preview if already generated
      const q = store.get('lesson.questions');
      if (q?.flashcards?.length) this.#renderPreview(q);
    }
  }

  // ─── File reading ─────────────────────────────────────────────────────────
  #readFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      store.set('lesson.documentText', text);
      const ta = this.qs('#doc-text');
      if (ta) ta.value = text;
      const counter = this.qs('#doc-counter');
      if (counter) counter.textContent = `${text.length.toLocaleString()} ký tự`;
      bus.emit(Events.TOAST_SHOW, { message: `📄 Đã tải: ${file.name}`, type: 'success' });
    };
    reader.onerror = () => bus.emit(Events.TOAST_SHOW, { message: 'Không đọc được file!', type: 'error' });
    reader.readAsText(file, 'UTF-8');
  }

  // ─── Gather step data ─────────────────────────────────────────────────────
  #gatherStep(n) {
    if (n === 1) {
      const title = this.qs('#f-title')?.value?.trim() ?? '';
      if (!title) { bus.emit(Events.TOAST_SHOW, { message: '⚠️ Vui lòng nhập tên bài học!', type: 'error' }); return false; }
      store.set('lesson.title',       title);
      store.set('lesson.subject',     this.qs('#f-subject')?.value?.trim() ?? '');
      store.set('lesson.grade',       this.qs('#f-grade')?.value?.trim()   ?? '');
      store.set('lesson.description', this.qs('#f-desc')?.value?.trim()    ?? '');
      this.qs('.nav-title') && (this.qs('.nav-title').textContent = title);
    }

    if (n === 3) {
      const text = this.qs('#doc-text')?.value?.trim() ?? '';
      if (!text) { bus.emit(Events.TOAST_SHOW, { message: '⚠️ Vui lòng thêm nội dung tài liệu!', type: 'error' }); return false; }
      store.set('lesson.documentText', text);
    }

    if (n === 4) {
      const key = this.qs('#f-gemini')?.value?.trim() ?? '';
      if (!key) { bus.emit(Events.TOAST_SHOW, { message: '⚠️ Vui lòng nhập Gemini API Key!', type: 'error' }); return false; }
      store.set('config.geminiKey',   key);
      store.set('config.r2AccountId', this.qs('#f-r2-account')?.value?.trim() ?? '');
      store.set('config.r2Bucket',    this.qs('#f-r2-bucket')?.value?.trim()  ?? '');
      store.set('config.r2AccessKey', this.qs('#f-r2-access')?.value?.trim()  ?? '');
      store.set('config.r2SecretKey', this.qs('#f-r2-secret')?.value?.trim()  ?? '');
      StorageService.saveConfig(store.get('config'));
    }

    StorageService.saveLesson(store.get('lesson'));
    return true;
  }

  // ─── AI Generation ────────────────────────────────────────────────────────
  async #generate() {
    const key  = store.get('config.geminiKey');
    const text = store.get('lesson.documentText');
    if (!key)  { bus.emit(Events.TOAST_SHOW, { message: '⚠️ Cần nhập Gemini API Key (bước 4)!', type: 'error' }); return; }
    if (!text) { bus.emit(Events.TOAST_SHOW, { message: '⚠️ Cần có tài liệu (bước 3)!', type: 'error' }); return; }

    const genBtn = this.qs('#btn-gen');
    const regenBtn = this.qs('#btn-regen');
    if (genBtn)  { genBtn.disabled = true; genBtn.textContent = '⏳ Đang tạo...'; }
    if (regenBtn) regenBtn.disabled = true;
    this.qs('#gen-progress')?.classList.remove('hidden');
    this.qs('#questions-preview')?.classList.add('hidden');

    this.#gemini.setApiKey(key);
    try {
      const q = await this.#gemini.generateQuestions(text, {
        title: store.get('lesson.title'), subject: store.get('lesson.subject'), grade: store.get('lesson.grade')
      });
      store.set('lesson.questions', q);
      store.set('lesson.generatedAt', Date.now());
      StorageService.saveLesson(store.get('lesson'));
      this.#renderPreview(q);
      this.qs('#questions-preview')?.classList.remove('hidden');
      bus.emit(Events.TOAST_SHOW, { message: `✅ Đã tạo ${Object.values(q).flat().length} câu hỏi!`, type: 'success' });
    } catch (e) {
      bus.emit(Events.TOAST_SHOW, { message: `❌ ${e.message}`, type: 'error', duration: 6000 });
    } finally {
      if (genBtn) { genBtn.disabled = false; genBtn.textContent = '✨ Bắt Đầu Tạo Câu Hỏi'; }
      if (regenBtn) regenBtn.disabled = false;
    }
  }

  #renderGenStep(step, index, total) {
    const stepsEl = this.qs('#gen-steps');
    if (!stepsEl) return;
    const steps = stepsEl.querySelectorAll('.gen-step');
    steps.forEach((el, i) => {
      el.classList.toggle('done',   i < index);
      el.classList.toggle('active', i === index);
    });
    if (!steps.length) {
      stepsEl.innerHTML = `<div class="gen-step active"><div class="gen-step-icon"><div class="spinner"></div></div>${escHTML(step.label)}</div>`;
    } else {
      const active = stepsEl.querySelector('.active');
      if (active) active.querySelector('.gen-step-icon').innerHTML = '<div class="spinner"></div>';
      if (active) active.querySelector('.gen-step-icon').insertAdjacentText('afterbegin', '');
    }
  }

  #renderPreview(q) {
    const tabs = [
      { key:'flashcards',     label:'Flashcards', icon:'🃏' },
      { key:'wordle',         label:'Wordle',     icon:'🔤' },
      { key:'memory',         label:'Memory',     icon:'🧩' },
      { key:'fillBlank',      label:'Điền trống', icon:'✏️' },
      { key:'multipleChoice', label:'Trắc nghiệm',icon:'📋' },
    ];
    const tabsEl    = this.qs('#preview-tabs');
    const listEl    = this.qs('#preview-list');
    if (!tabsEl || !listEl) return;

    tabsEl.innerHTML = tabs.map(t => `
      <button class="preview-tab ${t.key===this.#previewTab?'active':''}" data-ptab="${t.key}">
        ${t.icon} ${t.label} <span class="tab-count">${(q[t.key]||[]).length}</span>
      </button>
    `).join('');
    tabsEl.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-ptab]');
      if (!tab) return;
      this.#previewTab = tab.dataset.ptab;
      tabsEl.querySelectorAll('.preview-tab').forEach(b => b.classList.toggle('active', b.dataset.ptab === this.#previewTab));
      this.#renderPreviewContent(q, this.#previewTab, listEl);
    });
    this.#renderPreviewContent(q, this.#previewTab, listEl);
  }

  #renderPreviewContent(q, key, container) {
    const items = q[key] ?? [];
    if (!items.length) { container.innerHTML = '<p style="color:var(--color-muted);text-align:center;padding:20px">Chưa có câu hỏi</p>'; return; }

    const renderers = {
      flashcards:     (i) => `<div class="preview-item-term">${escHTML(i.term)}</div><div class="preview-item-def">${escHTML(i.definition)}</div>`,
      wordle:         (i) => `<div class="preview-item-term">Từ: <code style="background:var(--color-mint-light);padding:2px 8px;border-radius:4px">${escHTML(i.word)}</code></div><div class="preview-item-def">💡 ${escHTML(i.hint)}</div>`,
      memory:         (i) => `<div class="preview-item-term">${escHTML(i.cardA)}</div><div class="preview-item-def">↔ ${escHTML(i.cardB)}</div>`,
      fillBlank:      (i) => `<div class="preview-item-term">${escHTML(i.sentence)}</div><div class="preview-item-def">✅ ${escHTML(i.answer)} | 💡 ${escHTML(i.hint)}</div>`,
      multipleChoice: (i, idx) => `<div class="preview-item-term">Câu ${idx+1}: ${escHTML(i.question)}</div><div class="preview-item-def">${i.options.map((o,oi) => `<span style="color:${oi===i.correct?'var(--color-mint)':'var(--color-muted)'};margin-right:8px">${escHTML(o)}</span>`).join('')}</div>`,
    };

    container.innerHTML = items.map((item, idx) => `
      <div class="preview-item">${(renderers[key]??((i)=>`<div>${escHTML(JSON.stringify(i))}</div>`))(item, idx)}</div>
    `).join('');
  }

  // ─── Publish ──────────────────────────────────────────────────────────────
  #publish() {
    if (!store.get('lesson.title'))                        { bus.emit(Events.TOAST_SHOW, { message: '⚠️ Cần tên bài học!', type:'error' }); return; }
    if (!store.get('lesson.questions.flashcards')?.length) { bus.emit(Events.TOAST_SHOW, { message: '⚠️ Hãy tạo câu hỏi trước!', type:'error' }); return; }

    const lesson  = store.get('lesson');
    const encoded = encodeBase64(lesson);
    if (encoded) StorageService.saveLesson(lesson);

    const url = encoded ? `${location.origin}${location.pathname}#/student?lesson=${encoded}` : null;
    const total = Object.values(lesson.questions).reduce((a,b) => a + (b?.length ?? 0), 0);

    bus.emit(Events.MODAL_OPEN, {
      icon:  '🎉',
      title: 'Bài học đã sẵn sàng!',
      body:  `
        <div style="text-align:center">
          <p style="color:var(--color-muted);margin-bottom:var(--space-4)">
            <strong>${total} câu hỏi</strong> đã được tạo cho bài
            "<strong>${escHTML(lesson.title)}</strong>"
          </p>
          ${url ? `
            <div class="form-group">
              <label class="form-label">🔗 Link chia sẻ cho học sinh</label>
              <div class="publish-link-box" id="pub-link">${escHTML(url)}</div>
            </div>
          ` : '<p style="color:var(--color-muted);font-size:.85rem">Bài học được lưu trong trình duyệt này.</p>'}
          <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:var(--space-5)">
            ${url ? `<button class="btn btn-success btn-sm" id="pub-copy">📋 Copy Link</button>` : ''}
            <button class="btn btn-primary" id="pub-go">🧒 Vào học ngay!</button>
          </div>
        </div>
      `,
      actions: [],
    });
    setTimeout(() => {
      document.getElementById('pub-copy')?.addEventListener('click', () => {
        navigator.clipboard.writeText(url).then(() => bus.emit(Events.TOAST_SHOW, { message: '✅ Đã copy link!', type:'success' }));
      });
      document.getElementById('pub-go')?.addEventListener('click', () => {
        bus.emit(Events.MODAL_CLOSE);
        window.location.hash = '#/student';
      });
    }, 100);
    bus.emit(Events.CONFETTI_TRIGGER);
  }
}

// ============================================================
// STUDENT VIEW
// ============================================================
const GAME_DEFS = [
  { key:'flashcard', label:'Flashcards',   icon:'🃏', cls: FlashcardGame,  sub:'Lật thẻ học từ',      qKey:'flashcards'     },
  { key:'wordle',    label:'Wordle',        icon:'🔤', cls: WordleGame,     sub:'Đoán từ bí ẩn',       qKey:'wordle'         },
  { key:'memory',    label:'Memory',        icon:'🧩', cls: MemoryGame,     sub:'Ghép đôi thẻ',        qKey:'memory'         },
  { key:'fillblank', label:'Điền trống',    icon:'✏️', cls: FillBlankGame,  sub:'Hoàn thành câu',      qKey:'fillBlank'      },
  { key:'mcq',       label:'Trắc nghiệm',   icon:'📋', cls: MCQGame,        sub:'Chọn đáp án',         qKey:'multipleChoice' },
];

export class StudentView extends Component {
  #currentSection = 0;
  #currentVideo   = 0;
  #activeGame     = null;
  #activeGameInst = null;
  #r2             = new R2Service();

  render() {
    const lesson = store.get('lesson');
    return `
      <div id="student-view">
        ${buildNav(lesson.title || 'Bài Học')}

        <div class="lesson-hero gradient-hero">
          <h1>${escHTML(lesson.title || 'Bài Học Hôm Nay')}</h1>
          <p>${escHTML(lesson.description || 'Cùng học và khám phá nhé! 🎉')}</p>
          <div class="lesson-meta">
            ${lesson.subject ? `<span class="lesson-meta-chip">📚 ${escHTML(lesson.subject)}</span>` : ''}
            ${lesson.grade   ? `<span class="lesson-meta-chip">🎓 ${escHTML(lesson.grade)}</span>`   : ''}
            <span class="lesson-meta-chip" id="lesson-time">⏱ 0:00</span>
          </div>
        </div>

        <div class="section-nav" id="section-nav" role="tablist"></div>

        <div style="max-width:var(--max-width-lg);margin:0 auto;padding:var(--space-6) var(--space-6) 0">
          <!-- Video Area -->
          <div id="video-area">
            <div style="display:flex;align-items:center;gap:var(--space-3);margin-bottom:var(--space-4)">
              <span style="font-size:1.5rem" id="curr-sec-icon">🚀</span>
              <h2 style="font-size:var(--text-xl)" id="curr-sec-name">Mở bài</h2>
            </div>
            <div class="video-player-wrap" id="video-player"></div>
            <div class="video-nav-bar hidden" id="video-nav-bar">
              <button class="btn btn-ghost btn-sm" id="vid-prev">◀ Trước</button>
              <div class="video-dots" id="video-dots"></div>
              <button class="btn btn-ghost btn-sm" id="vid-next">Tiếp ▶</button>
            </div>
            <div style="display:flex;justify-content:center;margin:var(--space-6) 0">
              <button class="btn btn-success" id="btn-complete-section">
                ✅ Xem xong — Phần tiếp theo!
              </button>
            </div>
          </div>

          <!-- Activities Area (hidden until after videos) -->
          <div id="activities-area" class="hidden" style="padding-bottom:var(--space-16)">
            <div style="text-align:center;margin-bottom:var(--space-8)">
              <h2 style="font-size:var(--text-3xl);margin-bottom:var(--space-2)">🎮 Chọn Bài Tập</h2>
              <p style="color:var(--color-muted);font-weight:700">Chọn dạng bài để luyện tập!</p>
            </div>

            <!-- Student name -->
            <div class="student-name-row" style="margin-bottom:var(--space-6)">
              <label class="student-name-label" for="student-name">👤 Họ tên:</label>
              <input class="form-input" id="student-name" placeholder="Nhập tên của bạn..."
                     value="${escHTML(store.get('student.name') ?? '')}"
                     style="max-width:280px" aria-label="Nhập tên học sinh" />
            </div>

            <!-- Game grid -->
            <div class="game-grid" id="game-grid" role="list"></div>

            <!-- Game container -->
            <div id="game-container" style="margin-top:var(--space-6)"></div>

            <!-- Submit row -->
            <div style="display:flex;justify-content:center;gap:var(--space-4);margin-top:var(--space-8);flex-wrap:wrap">
              <button class="btn btn-ghost" id="btn-download">⬇️ Tải về JSON</button>
              <button class="btn btn-cta" id="btn-submit">🚀 Nộp Bài</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  afterMount() {
    this.on('#nav-back', 'click', () => { window.location.hash = '#/'; });

    // Init student session
    if (!store.get('student.sessionId')) store.resetStudent();

    // Session timer
    const lessonStart = Date.now();
    const timerEl     = this.qs('#lesson-time');
    const timerID     = setInterval(() => {
      const s = Math.floor((Date.now() - lessonStart) / 1000);
      if (timerEl) timerEl.textContent = `⏱ ${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
    }, 1000);
    this.addCleanup(() => clearInterval(timerID));

    // Load lesson from URL if present
    const params = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
    const encoded = params.get('lesson');
    if (encoded) {
      const lesson = decodeBase64(encoded);
      if (lesson) store.loadLesson(lesson);
    }

    this.#renderSectionNav();
    this.#showSection(0);
    this.#renderGameGrid();

    // Events
    this.on('#btn-complete-section', 'click', () => this.#completeSection());
    this.on('#vid-prev', 'click', () => { this.#currentVideo--; this.#renderVideo(); });
    this.on('#vid-next', 'click', () => { this.#currentVideo++; this.#renderVideo(); });
    this.on('#student-name', 'input', (e) => store.set('student.name', e.target.value.trim()));
    this.on('#btn-download', 'click', () => this.#download());
    this.on('#btn-submit',   'click', () => this.#submit());

    // React to game completion badges
    this.listen(Events.GAME_COMPLETE, ({ gameKey }) => {
      const badge = this.qs(`[data-game="${gameKey}"] .game-card-badge`);
      if (badge) badge.style.background = 'var(--color-mint)';
      const stars = this.qs(`[data-game="${gameKey}"] .game-card-stars`);
      if (stars) {
        const sc = store.get(`student.scores.${gameKey}`);
        stars.textContent = sc ? starsDisplay(sc.stars) : '';
      }
    });
  }

  // ─── Section Navigation ───────────────────────────────────────────────────
  #renderSectionNav() {
    const nav      = this.qs('#section-nav');
    const sections = store.get('lesson.sections');
    const progress = store.get('student.sectionProgress');
    if (!nav) return;
    nav.innerHTML = sections.map((sec, i) => `
      <button class="section-tab ${i===this.#currentSection?'active':''} ${progress[i]?'completed':''}"
              data-sec-tab="${i}" role="tab" aria-selected="${i===this.#currentSection}">
        ${sec.icon} ${escHTML(sec.name)} ${progress[i]?'✓':''}
      </button>
    `).join('') + `
      <button class="section-tab ${this.#currentSection===4?'active':''}"
              id="tab-activities" role="tab">
        🎮 Bài Tập
      </button>
    `;
    nav.querySelectorAll('[data-sec-tab]').forEach(btn => {
      btn.addEventListener('click', () => this.#showSection(Number(btn.dataset.secTab)));
    });
    this.qs('#tab-activities')?.addEventListener('click', () => this.#showActivities());
  }

  #showSection(idx) {
    this.#currentSection = idx;
    this.#currentVideo   = 0;
    this.qs('#video-area')?.classList.remove('hidden');
    this.qs('#activities-area')?.classList.add('hidden');
    this.#renderSectionNav();

    const sec = store.get(`lesson.sections.${idx}`);
    if (this.qs('#curr-sec-icon')) this.qs('#curr-sec-icon').textContent = sec.icon;
    if (this.qs('#curr-sec-name')) this.qs('#curr-sec-name').textContent = sec.name;
    this.#renderVideo();
  }

  #completeSection() {
    store.update('student.sectionProgress', p => {
      const copy = [...p]; copy[this.#currentSection] = true; return copy;
    });
    const next = this.#currentSection + 1;
    if (next < 4) {
      this.#showSection(next);
      bus.emit(Events.TOAST_SHOW, { message: `✅ Xong! Chuyển sang "${store.get(`lesson.sections.${next}.name`)}"`, type:'success' });
    } else {
      this.#showActivities();
      bus.emit(Events.TOAST_SHOW, { message: '🎉 Đã xem xong tất cả! Làm bài tập nhé!', type:'success' });
    }
  }

  #showActivities() {
    this.#currentSection = 4;
    this.qs('#video-area')?.classList.add('hidden');
    this.qs('#activities-area')?.classList.remove('hidden');
    this.#renderSectionNav();
    this.qs('#activities-area')?.scrollIntoView({ behavior:'smooth' });
  }

  // ─── Video Player ─────────────────────────────────────────────────────────
  #renderVideo() {
    const sec    = store.get(`lesson.sections.${this.#currentSection}`);
    const videos = (sec?.videos ?? []).filter(v => v?.trim());
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

    const idx      = Math.max(0, Math.min(this.#currentVideo, videos.length - 1));
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
      if (dotsEl) dotsEl.innerHTML = videos.map((_, i) => `<div class="video-dot ${i===idx?'active':''}" data-dot="${i}" role="button" tabindex="0" aria-label="Video ${i+1}"></div>`).join('');
      dotsEl?.querySelectorAll('.video-dot').forEach(d => {
        d.addEventListener('click', () => { this.#currentVideo = Number(d.dataset.dot); this.#renderVideo(); });
      });
      const prev = this.qs('#vid-prev');
      const next = this.qs('#vid-next');
      if (prev) prev.disabled = idx === 0;
      if (next) next.disabled = idx === videos.length - 1;
    } else {
      navBar?.classList.add('hidden');
    }
  }

  // ─── Game Grid ────────────────────────────────────────────────────────────
  #renderGameGrid() {
    const grid = this.qs('#game-grid');
    if (!grid) return;
    const q = store.get('lesson.questions');
    grid.innerHTML = GAME_DEFS.map(g => {
      const count   = (q[g.qKey] ?? []).length;
      const scores  = store.get(`student.scores.${g.key}`);
      const done    = store.get('student.completedGames')?.has?.(g.key);
      return `
        <div class="game-card ${done?'selected':''}" data-game="${g.key}" role="listitem" tabindex="0"
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
      card.addEventListener('click', () => this.#selectGame(card.dataset.game));
      card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') this.#selectGame(card.dataset.game); });
    });
  }

  #selectGame(key) {
    // Deactivate old game
    this.#activeGameInst?.destroy?.();
    this.qsAll('.game-card').forEach(c => c.classList.toggle('selected', c.dataset.game === key));
    this.#activeGame = key;

    const container = this.qs('#game-container');
    if (!container) return;
    container.innerHTML = '';
    container.scrollIntoView({ behavior:'smooth', block:'start' });

    const def = GAME_DEFS.find(g => g.key === key);
    if (!def) return;

    this.#activeGameInst = new def.cls();
    this.#activeGameInst.init(container);
    bus.emit(Events.GAME_SELECTED, { gameKey: key });
  }

  // ─── Submit / Download ────────────────────────────────────────────────────
  #buildPayload() {
    return {
      lessonTitle: store.get('lesson.title'),
      student:     store.get('student.name') || 'Ẩn danh',
      sessionId:   store.get('student.sessionId'),
      submittedAt: new Date().toISOString(),
      scores:      store.get('student.scores'),
      answers:     store.get('student.answers'),
    };
  }

  #download() {
    const data = this.#buildPayload();
    const blob  = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement('a');
    a.href      = url;
    a.download  = `bai-lam-${(data.student).replace(/\s+/g,'-')}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    bus.emit(Events.TOAST_SHOW, { message: '⬇️ Đã tải file bài làm!', type:'success' });
  }

  async #submit() {
    if (!store.get('student.name')) {
      bus.emit(Events.TOAST_SHOW, { message: '⚠️ Vui lòng nhập tên trước khi nộp!', type:'error' });
      this.qs('#student-name')?.focus();
      return;
    }
    const payload = this.#buildPayload();
    const cfg     = store.get('config');

    if (cfg.r2AccountId && cfg.r2Bucket && cfg.r2AccessKey && cfg.r2SecretKey) {
      const btn = this.qs('#btn-submit');
      if (btn) { btn.disabled = true; btn.textContent = '⏳ Đang nộp...'; }
      this.#r2.configure({ accountId: cfg.r2AccountId, accessKey: cfg.r2AccessKey, secretKey: cfg.r2SecretKey, bucket: cfg.r2Bucket });
      try {
        const filename = `${payload.student.replace(/\s+/g,'-')}-${Date.now()}.json`;
        await this.#r2.upload(filename, payload);
        const completedCount = Object.keys(payload.scores).length;
        const avgPct = completedCount > 0
          ? Math.round(Object.values(payload.scores).reduce((a,b) => a + (b.pct ?? 0), 0) / completedCount)
          : 0;
        bus.emit(Events.SUCCESS_SHOW, {
          icon: '🚀', title: 'Nộp bài thành công!',
          message: `${payload.student} — bài làm đã được lưu lên cloud!`,
          score: avgPct,
          detail: `${completedCount} dạng bài hoàn thành`,
        });
        return;
      } catch (e) {
        bus.emit(Events.TOAST_SHOW, { message: `⚠️ R2 lỗi: ${e.message}. Tải file thay thế...`, type:'warning', duration:5000 });
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = '🚀 Nộp Bài'; }
      }
    }

    // Fallback: download
    this.#download();
    const completedCount = Object.keys(payload.scores).length;
    bus.emit(Events.SUCCESS_SHOW, {
      icon: '📥', title: 'Đã lưu bài làm!',
      message: 'File JSON đã được tải về máy của bạn.',
      score: null,
      detail: `${completedCount} dạng bài`,
    });
  }
}
