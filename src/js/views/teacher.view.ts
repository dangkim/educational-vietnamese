import { AppState, Questions } from '../state';
import { StorageService } from '../services/storage.service';
import { GeminiService } from '../services/gemini.service';
import { qs, showToast, escHTML, confetti, showSuccess } from '../utils';
import { R2Storage } from '../services/r2.service';
import { Router } from '../router';

export const TeacherView = {
  currentStep: 1,
  totalSteps: 5,
  stepNames: ['Thông tin', 'Đa phương tiện', 'Tài liệu', 'Cài đặt', 'Tạo câu hỏi'],
  previewTab: 'flashcards',

  init() {
    StorageService.loadTeacherState();
    this.renderStepper();
    this.renderLibraryButton();
    this.renderSections();
    this.showStep(1);
    this.bindEvents();
    
    // Restore form values
    setTimeout(() => {
      const s = AppState.get();
      ['title','subject','grade'].forEach(f => {
        const el = qs<HTMLInputElement>(`#lesson-${f}`);
        if (el) el.value = (s.lesson as any)[f] || '';
      });
      const desc = qs<HTMLTextAreaElement>('#lesson-desc');
      if (desc) desc.value = s.lesson.description || '';
      const docText = qs<HTMLTextAreaElement>('#doc-text');
      if (docText) docText.value = s.lesson.documentText || '';
      const gemKey = qs<HTMLInputElement>('#gemini-key');
      if (gemKey) gemKey.value = s.config.geminiKey || '';
      
      const teacherId = qs<HTMLInputElement>('#teacher-id');
      if (teacherId) teacherId.value = s.config.teacherId || '';
    }, 50);
  },

  bindEvents() {
    qs('#btn-prev')?.addEventListener('click', () => this.prevStep());
    const dropArea = qs('#doc-drop-area');
    const docInput = qs<HTMLInputElement>('#doc-file-input');
    
    if (dropArea && docInput) {
      dropArea.addEventListener('click', () => docInput.click());
      dropArea.addEventListener('dragover', e => { e.preventDefault(); dropArea.classList.add('drag-over'); });
      dropArea.addEventListener('dragleave', () => dropArea.classList.remove('drag-over'));
      dropArea.addEventListener('drop', e => {
        e.preventDefault(); dropArea.classList.remove('drag-over');
        if (e.dataTransfer?.files[0]) this.handleFileUpload(e.dataTransfer.files[0]);
      });
      docInput.addEventListener('change', () => {
        if (docInput.files?.[0]) this.handleFileUpload(docInput.files[0]);
      });
    }

    document.querySelectorAll('.eye-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetId = (e.currentTarget as HTMLElement).dataset.target;
        if (targetId) this.toggleEye(targetId, e.currentTarget as HTMLElement);
      });
    });

    qs('#btn-gen')?.addEventListener('click', () => this.generateQuestions());
    qs('.btn-regen')?.addEventListener('click', () => this.generateQuestions());

    qs('#btn-pull-lectures')?.addEventListener('click', () => {
      const lectures = AppState.get().lesson.sections
        .map(sec => sec.lecture?.trim())
        .filter(l => l)
        .join('\n\n');
      if (!lectures) {
        showToast('Chưa có nội dung bài giảng ở Bước 2!', 'error');
        return;
      }
      const el = qs<HTMLTextAreaElement>('#doc-text');
      if (el) {
        el.value = lectures;
        AppState.updateLesson({ documentText: lectures });
        showToast('Đã lấy nội dung từ các phần bài giảng!', 'success');
      }
    });

    qs('#btn-save-draft')?.addEventListener('click', () => this.saveDraft());
    qs('#btn-library')?.addEventListener('click', () => this.openLibrary());

    // Real-time sync for basic info
    ['title', 'subject', 'grade'].forEach(f => {
      qs<HTMLInputElement>(`#lesson-${f}`)?.addEventListener('input', (e) => {
        const val = (e.target as HTMLInputElement).value.trim();
        AppState.updateLesson({ [f]: val });
        if (f === 'title') {
          const tNav = qs('#teacher-nav-title');
          if (tNav) tNav.textContent = val || 'Tạo Bài Học Mới';
        }
      });
    });
    qs<HTMLTextAreaElement>('#lesson-desc')?.addEventListener('input', (e) => {
      AppState.updateLesson({ description: (e.target as HTMLTextAreaElement).value.trim() });
    });

    // Step 3: Document Text
    qs<HTMLTextAreaElement>('#doc-text')?.addEventListener('input', (e) => {
      AppState.updateLesson({ documentText: (e.target as HTMLTextAreaElement).value.trim() });
    });

    // Step 4: Settings
    qs<HTMLInputElement>('#gemini-key')?.addEventListener('input', (e) => {
      AppState.updateConfig({ geminiKey: (e.target as HTMLInputElement).value.trim() });
    });
    qs<HTMLInputElement>('#teacher-id')?.addEventListener('input', (e) => {
      AppState.updateConfig({ teacherId: (e.target as HTMLInputElement).value.trim() });
    });
  },

  renderLibraryButton() {
    const nav = qs('.top-nav');
    if (nav && !qs('#btn-library')) {
      const btn = document.createElement('button');
      btn.id = 'btn-library';
      btn.className = 'nav-back';
      btn.style.marginLeft = '12px';
      btn.style.background = 'var(--sky)';
      btn.style.color = 'white';
      btn.innerHTML = '📚 Thư viện';
      nav.insertBefore(btn, qs('.btn-go-home'));

      const saveBtn = document.createElement('button');
      saveBtn.id = 'btn-save-draft';
      saveBtn.className = 'nav-back';
      saveBtn.style.marginLeft = '12px';
      saveBtn.style.background = 'var(--mint)';
      saveBtn.style.color = 'white';
      saveBtn.innerHTML = '💾 Lưu nháp';
      nav.insertBefore(saveBtn, btn);
    }
  },

  renderStepper() {
    const el = qs('#stepper');
    if (!el) return;
    let html = '';
    for (let i = 1; i <= this.totalSteps; i++) {
      const state = i < this.currentStep ? 'done' : i === this.currentStep ? 'active' : 'pending';
      const icon = i < this.currentStep ? '✓' : i;
      html += `
        <div class="step-item" data-step="${i}">
          <div class="step-circle ${state}">${icon}</div>
          <span class="step-label ${state === 'active' ? 'active' : ''}">${this.stepNames[i-1]}</span>
        </div>
      `;
      if (i < this.totalSteps) {
        html += `<div class="step-connector ${i < this.currentStep ? 'done' : ''}"></div>`;
      }
    }
    el.innerHTML = html;
    el.querySelectorAll('.step-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const step = parseInt((e.currentTarget as HTMLElement).dataset.step || '1', 10);
        this.goToStep(step);
      });
    });
  },

  renderSections() {
    const colors = ['#1565C0','#2E7D32','#6A1B9A','#E65100', '#C62828', '#AD1457', '#00838F', '#2E7D32'];
    const el = qs('#sections-container');
    if (!el) return;
    
    const sections = AppState.get().lesson.sections;
    let html = sections.map((sec, idx) => `
      <div class="section-card">
        <div class="section-header">
          <div class="section-badge" style="background:${colors[idx % colors.length]}">${sec.icon}</div>
          <input class="section-name-input" data-idx="${idx}" value="${escHTML(sec.name)}" style="font-weight:800; border:none; background:transparent; font-family:inherit; font-size:1rem; color:var(--dark); width:150px;" />
          <span style="margin-left:auto;color:var(--muted);font-size:.85rem">${(sec.videos||[]).filter(v=>v).length} video, ${(sec.images||[]).filter(i=>i).length} ảnh</span>
          <button class="btn-icon danger btn-del-section" data-idx="${idx}" style="margin-left:12px; font-size:1rem;">✕</button>
        </div>
        <div class="section-body hidden" id="sec-body-${idx}">
          <div class="form-group" style="padding: 12px; background: #fff; border-radius: 8px; margin-bottom: 12px; border: 1px solid #eee;">
            <label class="form-label" style="font-size: 0.9rem;">📝 Bài giảng (Văn bản)</label>
            <textarea class="form-input lecture-input" data-sec="${idx}" rows="3" placeholder="Nhập nội dung bài giảng cho phần này...">${escHTML(sec.lecture || '')}</textarea>
          </div>
          <div id="vid-list-${idx}">
            ${(sec.videos||[]).map((v,vi) => this.renderVideoItem(idx, vi, v)).join('')}
          </div>
          <div id="img-list-${idx}" style="margin-top:8px">
            ${(sec.images||[]).map((img,ii) => this.renderImageItem(idx, ii, img)).join('')}
          </div>
          <div style="display:flex;gap:8px;margin-top:12px">
            <button class="btn-add-video" data-sec="${idx}" style="flex:1">+ Thêm video</button>
            <button class="btn-add-image" data-sec="${idx}" style="flex:1;background:var(--sky);color:white;border:none;border-radius:8px;padding:8px;cursor:pointer;font-weight:700">+ Thêm ảnh</button>
          </div>
        </div>
      </div>
    `).join('');

    html += `
      <div style="margin-top:20px; text-align:center;">
        <button id="btn-add-section" style="background:var(--mint); color:white; padding:12px 24px; border-radius:12px; font-weight:800; border:none; cursor:pointer;box-shadow:0 4px 12px rgba(76,175,80,0.2)">+ Thêm Phần Bài Giảng</button>
      </div>
    `;

    el.innerHTML = html;

    el.querySelectorAll('.section-header').forEach(header => {
      header.addEventListener('click', () => {
        header.nextElementSibling?.classList.toggle('hidden');
      });
    });
    
    el.querySelectorAll('.section-name-input').forEach(inp => {
      inp.addEventListener('change', (e) => {
        const t = e.target as HTMLInputElement;
        this.renameSection(parseInt(t.dataset.idx!, 10), t.value);
      });
      inp.addEventListener('click', (e) => e.stopPropagation());
    });

    el.querySelectorAll('.btn-del-section').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteSection(parseInt((e.currentTarget as HTMLElement).dataset.idx!, 10));
      });
    });

    qs('#btn-add-section')?.addEventListener('click', () => this.addSection());

    el.querySelectorAll('.btn-add-video').forEach(b => {
      b.addEventListener('click', (e) => this.addVideo(parseInt((e.currentTarget as HTMLElement).dataset.sec || '0', 10)));
    });
    el.querySelectorAll('.btn-add-image').forEach(b => {
      b.addEventListener('click', (e) => this.addImage(parseInt((e.currentTarget as HTMLElement).dataset.sec || '0', 10)));
    });
    el.querySelectorAll('.vid-input').forEach(inp => {
      inp.addEventListener('change', (e) => {
        const t = e.target as HTMLInputElement;
        this.updateVideo(parseInt(t.dataset.sec!), parseInt(t.dataset.vid!), t.value);
      });
    });
    el.querySelectorAll('.img-input').forEach(inp => {
      inp.addEventListener('change', (e) => {
        const t = e.target as HTMLInputElement;
        this.updateImage(parseInt(t.dataset.sec!), parseInt(t.dataset.img!), t.value);
      });
    });
    el.querySelectorAll('.vid-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const t = e.currentTarget as HTMLElement;
        this.removeVideo(parseInt(t.dataset.sec!), parseInt(t.dataset.vid!));
      });
    });
    el.querySelectorAll('.img-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const t = e.currentTarget as HTMLElement;
        this.removeImage(parseInt(t.dataset.sec!), parseInt(t.dataset.img!));
      });
    });
    el.querySelectorAll('.lecture-input').forEach(inp => {
      inp.addEventListener('change', (e) => {
        const t = e.target as HTMLTextAreaElement;
        this.updateLecture(parseInt(t.dataset.sec!), t.value);
      });
    });
  },

  updateLecture(secIdx: number, val: string) {
    const s = AppState.get().lesson;
    s.sections[secIdx].lecture = val;
    AppState.updateLesson({ sections: s.sections });
  },

  addSection() {
    const s = AppState.get().lesson;
    s.sections.push({
      id: 's' + (s.sections.length + 1),
      name: 'Phần mới',
      icon: '📖',
      color: '#2E7D32',
      videos: [],
      images: [],
      completed: false
    });
    AppState.updateLesson({ sections: s.sections });
    this.renderSections();
  },

  deleteSection(idx: number) {
    if (!confirm('Bạn có chắc muốn xoá phần này?')) return;
    const s = AppState.get().lesson;
    s.sections.splice(idx, 1);
    AppState.updateLesson({ sections: s.sections });
    this.renderSections();
  },

  renameSection(idx: number, name: string) {
    const s = AppState.get().lesson;
    s.sections[idx].name = name;
    AppState.updateLesson({ sections: s.sections });
  },

  renderVideoItem(secIdx: number, vidIdx: number, val='') {
    return `
      <div class="video-item" id="vid-${secIdx}-${vidIdx}">
        <span style="font-size:1.2rem">🎬</span>
        <input class="vid-input" data-sec="${secIdx}" data-vid="${vidIdx}" placeholder="Dán link YouTube hoặc URL video..." value="${escHTML(val)}" />
        <button class="btn-icon danger vid-remove" data-sec="${secIdx}" data-vid="${vidIdx}">✕</button>
      </div>
    `;
  },

  renderImageItem(secIdx: number, imgIdx: number, val='') {
    return `
      <div class="video-item" id="img-${secIdx}-${imgIdx}">
        <span style="font-size:1.2rem">🖼️</span>
        <input class="form-input img-input" data-sec="${secIdx}" data-img="${imgIdx}" placeholder="Dán link ảnh (JPG, PNG, GIF, Unsplash...)" value="${escHTML(val)}" />
        <button class="btn-icon danger img-remove" data-sec="${secIdx}" data-img="${imgIdx}">✕</button>
      </div>
    `;
  },

  addVideo(secIdx: number) {
    const s = AppState.get().lesson;
    const sec = s.sections[secIdx];
    sec.videos = sec.videos || [];
    sec.videos.push('');
    AppState.updateLesson({ sections: s.sections });
    this.renderSections();
    qs(`#sec-body-${secIdx}`)?.classList.remove('hidden');
  },

  addImage(secIdx: number) {
    const s = AppState.get().lesson;
    const sec = s.sections[secIdx];
    sec.images = sec.images || [];
    sec.images.push('');
    AppState.updateLesson({ sections: s.sections });
    this.renderSections();
    qs(`#sec-body-${secIdx}`)?.classList.remove('hidden');
  },

  removeVideo(secIdx: number, vidIdx: number) {
    const s = AppState.get().lesson;
    s.sections[secIdx].videos.splice(vidIdx, 1);
    AppState.updateLesson({ sections: s.sections });
    this.renderSections();
    qs(`#sec-body-${secIdx}`)?.classList.remove('hidden');
  },

  removeImage(secIdx: number, imgIdx: number) {
    const s = AppState.get().lesson;
    s.sections[secIdx].images.splice(imgIdx, 1);
    AppState.updateLesson({ sections: s.sections });
    this.renderSections();
    qs(`#sec-body-${secIdx}`)?.classList.remove('hidden');
  },

  updateVideo(secIdx: number, vidIdx: number, val: string) {
    const s = AppState.get().lesson;
    s.sections[secIdx].videos[vidIdx] = val;
    AppState.updateLesson({ sections: s.sections });
  },

  updateImage(secIdx: number, imgIdx: number, val: string) {
    const s = AppState.get().lesson;
    s.sections[secIdx].images[imgIdx] = val;
    AppState.updateLesson({ sections: s.sections });
  },

  showStep(n: number) {
    for (let i = 1; i <= this.totalSteps; i++) {
      const el = qs(`#step-${i}`);
      if (el) el.classList.toggle('hidden', i !== n);
    }
    this.currentStep = n;
    this.renderStepper();
    
    // Nav buttons
    const prev = qs('#btn-prev');
    const next = qs('#btn-next');
    if (prev) prev.style.display = n === 1 ? 'none' : '';
    if (next) {
      // Create new clone for removing previous event listeners
      const newNext = next.cloneNode(true) as HTMLButtonElement;
      next.parentNode?.replaceChild(newNext, next);
      
      if (n === this.totalSteps) {
        newNext.textContent = '📤 Publish Bài Học';
        newNext.className = 'btn-publish';
        newNext.addEventListener('click', () => this.publishLesson());
      } else {
        newNext.textContent = 'Tiếp theo →';
        newNext.className = 'btn-next';
        newNext.addEventListener('click', () => this.nextStep());
      }
    }
    window.scrollTo({top: 0, behavior:'smooth'});
  },

  goToStep(n: number) {
    if (n <= this.currentStep) this.showStep(n);
  },

  gatherStep(n: number): boolean {
    const s = AppState.get();
    if (n === 1) {
      const title = qs<HTMLInputElement>('#lesson-title')?.value?.trim() || '';
      AppState.updateLesson({
        title,
        subject: qs<HTMLInputElement>('#lesson-subject')?.value?.trim() || '',
        grade: qs<HTMLInputElement>('#lesson-grade')?.value?.trim() || '',
        description: qs<HTMLTextAreaElement>('#lesson-desc')?.value?.trim() || ''
      });
      const tNav = qs('#teacher-nav-title');
      if (tNav) tNav.textContent = title || 'Tạo Bài Học Mới';
      if (!title) { showToast('Vui lòng nhập tên bài học!', 'error'); return false; }
    }
    if (n === 3) {
      const textArea = qs<HTMLTextAreaElement>('#doc-text')?.value?.trim();
      if (textArea) AppState.updateLesson({ documentText: textArea });
      if (!AppState.get().lesson.documentText) { showToast('Vui lòng thêm nội dung tài liệu!', 'error'); return false; }
    }
    if (n === 4) {
      const geminiKey = qs<HTMLInputElement>('#gemini-key')?.value?.trim() || '';
      const teacherId = qs<HTMLInputElement>('#teacher-id')?.value?.trim() || '';
      AppState.updateConfig({
        geminiKey,
        teacherId
      });
      if (!geminiKey) { showToast('Vui lòng nhập Gemini API Key!', 'error'); return false; }
    }
    StorageService.saveTeacherState();
    return true;
  },

  nextStep() {
    if (!this.gatherStep(this.currentStep)) return;
    if (this.currentStep < this.totalSteps) this.showStep(this.currentStep + 1);
  },

  prevStep() {
    if (this.currentStep > 1) this.showStep(this.currentStep - 1);
  },

  toggleEye(id: string, btn: HTMLElement) {
    const el = qs<HTMLInputElement>(`#${id}`);
    if (!el) return;
    if (el.type === 'password') { el.type = 'text'; btn.textContent = '🙈'; }
    else { el.type = 'password'; btn.textContent = '👁️'; }
  },

  handleFileUpload(file: File) {
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      AppState.updateLesson({ documentText: text });
      const docInput = qs<HTMLTextAreaElement>('#doc-text');
      if (docInput) docInput.value = text;
      
      const docPreview = qs('#doc-preview-text');
      if (docPreview) docPreview.textContent = text.slice(0, 500) + (text.length > 500 ? '...' : '');
      qs('#doc-preview-section')?.classList.remove('hidden');
      showToast(`📄 Đã tải: ${file.name}`, 'success');
    };
    reader.readAsText(file, 'UTF-8');
  },

  async generateQuestions() {
    const state = AppState.get();
    if (!state.config.geminiKey) {
      showToast('Cần nhập Gemini API Key!', 'error');
      this.showStep(4);
      return;
    }
    if (!state.lesson.documentText) {
      showToast('Cần có tài liệu để tạo câu hỏi!', 'error');
      this.showStep(3);
      return;
    }

    const genBtn = qs<HTMLButtonElement>('#btn-gen');
    const regenBtn = qs<HTMLButtonElement>('.btn-regen');
    const statusEl = qs('#gen-status');
    const statusText = qs('#gen-status-text');
    
    if (genBtn) genBtn.disabled = true;
    if (regenBtn) regenBtn.disabled = true;
    if (statusEl) statusEl.classList.remove('hidden');

    const steps = ['🔗 Đang kết nối Gemini AI...','📖 Đang phân tích tài liệu...','✍️ Đang tạo flashcards...','🎮 Đang tạo Wordle & Memory...','📝 Đang tạo trắc nghiệm...','✅ Hoàn thành!'];
    let si = 0;
    const statusTimer = setInterval(() => { 
      if (si < steps.length-1 && statusText) statusText.textContent = steps[++si]; 
    }, 1200);

    try {
      const questions = await GeminiService.generateQuestions(state.lesson.documentText, state.config.geminiKey);
      
      AppState.updateLesson({ questions });
      StorageService.saveTeacherState();
      
      clearInterval(statusTimer);
      if (statusText) statusText.textContent = '✅ Hoàn thành! ' + (
        (questions.flashcards?.length||0) + (questions.wordle?.length||0) + (questions.memory?.length||0) + (questions.fillBlank?.length||0) + (questions.multipleChoice?.length||0)
      ) + ' câu hỏi đã được tạo!';
      
      if (genBtn) genBtn.disabled = false;
      if (regenBtn) regenBtn.disabled = false;
      this.renderPreview(questions);

    } catch(e: any) {
      clearInterval(statusTimer);
      statusEl?.classList.add('hidden');
      if (genBtn) genBtn.disabled = false;
      if (regenBtn) regenBtn.disabled = false;
      showToast('❌ Lỗi: ' + e.message, 'error', 5000);
    }
  },

  renderPreview(q: Questions) {
    qs('#questions-preview')?.classList.remove('hidden');
    const tabs = [
      { key:'flashcards', label:'Flashcards', icon:'🃏' },
      { key:'wordle', label:'Wordle', icon:'🔤' },
      { key:'memory', label:'Memory', icon:'🧩' },
      { key:'fillBlank', label:'Điền trống', icon:'✏️' },
      { key:'multipleChoice', label:'Trắc nghiệm', icon:'📋' }
    ];
    const tb = qs('#preview-tabs');
    if (tb) {
      tb.innerHTML = tabs.map(t => `
        <button class="q-tab ${t.key===this.previewTab?'active':''}" data-key="${t.key}">
          ${t.icon} ${t.label} <span class="q-count">${(q[t.key as keyof Questions]||[]).length}</span>
        </button>
      `).join('');
      tb.querySelectorAll('.q-tab').forEach(b => {
        b.addEventListener('click', (e) => this.switchPreviewTab((e.currentTarget as HTMLElement).dataset.key!));
      });
    }
    this.renderPreviewContent(q, this.previewTab);
  },

  switchPreviewTab(key: string) {
    this.previewTab = key;
    this.renderPreview(AppState.get().lesson.questions);
  },

  renderPreviewContent(q: Questions, key: string) {
    const items = q[key as keyof Questions] as any[] || [];
    let html = '';
    if (key === 'flashcards') html = items.map(i => `<div class="preview-item"><strong>${escHTML(i.term)}</strong><br>${escHTML(i.definition)}</div>`).join('');
    if (key === 'wordle') html = items.map(i => `<div class="preview-item"><strong>Từ:</strong> ${escHTML(i.word)} — <strong>Gợi ý:</strong> ${escHTML(i.hint)}</div>`).join('');
    if (key === 'memory') html = items.map(i => `<div class="preview-item"><strong>${escHTML(i.cardA)}</strong> ↔ ${escHTML(i.cardB)}</div>`).join('');
    if (key === 'fillBlank') html = items.map(i => `<div class="preview-item">${escHTML(i.sentence)}<br><small>Đáp án: ${escHTML(i.answer)} | Gợi ý: ${escHTML(i.hint)}</small></div>`).join('');
    if (key === 'multipleChoice') html = items.map((i,idx) => `<div class="preview-item"><strong>Câu ${idx+1}:</strong> ${escHTML(i.question)}<br><small>${(i.options||[]).map((o: string,oi: number) => `<span style="color:${oi===i.correct?'var(--mint)':'inherit'}">${escHTML(o)}</span>`).join(' | ')}</small></div>`).join('');
    
    const pc = qs('#preview-content');
    if (pc) pc.innerHTML = html || '<div class="empty-state"><p>Chưa có câu hỏi</p></div>';
  },

  publishLesson() {
    const state = AppState.get();
    if (!state.lesson.title) { showToast('Cần tên bài học!', 'error'); return; }
    if (!state.lesson.questions.flashcards?.length) { showToast('Vui lòng tạo câu hỏi trước!', 'error'); return; }
    
    const encoded = StorageService.saveLessonToUrl();
    const url = `${location.origin}${location.pathname}#${encoded}`;
    const shortUrl = url.length > 2000 ? null : url;
    
    const count = Object.values(state.lesson.questions).reduce((a,b)=>a+(b?.length||0),0);

    const showPublishSuccess = (finalUrl: string, isShort = false) => {
      showSuccess('🎉', 'Bài học sẵn sàng!', `
        <div style="font-size:.9rem">
          <p style="margin-bottom:8px">${isShort ? '🚀 Link rút gọn:' : '🔗 Link chia sẻ (Dài):'}</p>
          <div style="background:#F5F5F5;border-radius:8px;padding:8px;font-size:.78rem;word-break:break-all;margin-bottom:12px;max-height:80px;overflow:auto">${escHTML(finalUrl)}</div>
          <button id="btn-pub-start" style="background:var(--sky);color:white;padding:10px 24px;border-radius:12px;font-weight:800;cursor:pointer;border:none;font-family:inherit">🧒 Vào học ngay!</button>
          <button id="btn-pub-copy" data-url="${escHTML(finalUrl)}" style="margin-left:8px;background:var(--mint);color:white;padding:10px 18px;border-radius:12px;font-weight:800;cursor:pointer;border:none;font-family:inherit">📋 Copy Link</button>
        </div>
      `, `${count} câu hỏi`);

      setTimeout(() => {
        qs('#btn-pub-start')?.addEventListener('click', () => {
          qs('#success-overlay')?.classList.add('hidden');
          Router.navigate('student');
        });
        qs('#btn-pub-copy')?.addEventListener('click', (e) => {
          navigator.clipboard.writeText((e.currentTarget as HTMLElement).dataset.url!);
          showToast('Đã copy!','success');
        });
      }, 100);
    };

    // Try R2 upload if configured
    const r2Bucket = import.meta.env.VITE_R2_BUCKET;
    const r2Configured = import.meta.env.VITE_R2_ACCOUNT_ID && r2Bucket && import.meta.env.VITE_R2_ACCESS_KEY && import.meta.env.VITE_R2_SECRET_KEY;
    if (r2Configured) {
      showToast('⏳ Đang lưu bài học...', '', 5000);
      R2Storage.uploadLesson(state.lesson).then(id => {
        // Extract domain part from https://pub-xxx.r2.dev
        let domain = import.meta.env.VITE_R2_PUBLIC_DOMAIN || '';
        if (domain.includes('://')) {
          domain = new URL(domain).hostname;
        }
        // If it's a pub-xxx.r2.dev, we'll keep the whole hostname
        // Router will handle it correctly if we simplify the check there too

        const shortHash = `r2:${domain}:${id}`;
        const shortUrl = `${location.origin}${location.pathname}#${shortHash}`;
        showPublishSuccess(shortUrl, true);
      }).catch(err => {
        console.error('R2 lesson upload failed', err);
        showToast('⚠️ Lỗi hệ thống, dùng link dài thay thế...', 'error');
        showPublishSuccess(url);
      });
    } else {
      showPublishSuccess(url);
    }
  },

  ensureTeacherId(): boolean {
    const s = AppState.get();
    if (!s.config.teacherId) {
      const id = window.prompt('Vui lòng nhập Mã Giáo Viên (Teacher ID) để có thư viện bản nháp riêng trên Cloud (VD: colan123, thaybinh):');
      if (id && id.trim()) {
        const cleanId = id.trim().replace(/[^a-zA-Z0-9_-]/g, '');
        AppState.updateConfig({ teacherId: cleanId });
        const el = qs<HTMLInputElement>('#teacher-id');
        if (el) el.value = cleanId;
        StorageService.saveTeacherState();
        return true;
      }
      return false; // User cancelled or left empty
    }
    return true;
  },

  async saveDraft() {
    // Sync current step data
    if (!this.gatherStep(this.currentStep)) {
      // If gathering failed (e.g. current step has errors), 
      // check if we at least have a title to allow saving a rough draft
      if (!AppState.get().lesson.title) return; 
    }
    
    const state = AppState.get();
    if (!state.lesson.title) {
      showToast('Vui lòng nhập tên bài học ở Bước 1 trước!', 'error');
      this.showStep(1);
      return;
    }
    
    if (!this.ensureTeacherId()) return;
    
    showToast('⏳ Đang lưu bản nháp...', '', 5000);
    try {
      await R2Storage.saveLessonDraft(state.lesson);
      showToast('✅ Đã lưu bản nháp!', 'success');
    } catch(e: any) {
      showToast('❌ Lỗi lưu nháp: ' + e.message, 'error');
    }
  },

  async openLibrary() {
    if (!this.ensureTeacherId()) return;

    showToast('⏳ Đang tải thư viện...', '', 5000);
    try {
      const index = await R2Storage.fetchLessonIndex();
      if (!index || index.length === 0) {
        showSuccess('📚 Thư viện', 'Trống', 'Chưa có bài học nào được lưu.', '0 bài học');
        return;
      }

      const html = `
        <div style="max-height: 400px; overflow-y: auto; text-align: left;">
          ${index.sort((a,b) => new Date(b.updatedAt!).getTime() - new Date(a.updatedAt!).getTime()).map(item => `
            <div class="library-item" style="padding: 12px; border-bottom: 1px solid #eee; display: flex; align-items: center; justify-content: space-between;">
              <div>
                <div style="font-weight:800; color:var(--dark)">${escHTML(item.title)}</div>
                <div style="font-size:0.75rem; color:var(--muted)">${item.subject || 'Không môn'} • ${item.grade || 'Không lớp'} • ${new Date(item.updatedAt!).toLocaleString()}</div>
              </div>
              <button class="btn-load-draft" data-id="${item.id}" style="background:var(--sky); color:white; border:none; padding:6px 12px; border-radius:8px; cursor:pointer; font-weight:700">Mở</button>
            </div>
          `).join('')}
        </div>
      `;

      showSuccess('📚 Thư viện', 'Chọn bài học', html, `${index.length} bài học`);

      setTimeout(() => {
        document.querySelectorAll('.btn-load-draft').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const id = (e.currentTarget as HTMLElement).dataset.id!;
            qs('#success-overlay')?.classList.add('hidden');
            this.loadDraft(id);
          });
        });
      }, 100);

    } catch(e: any) {
      showToast('❌ Lỗi tải thư viện: ' + e.message, 'error');
    }
  },

  async loadDraft(id: string) {
    showToast('⏳ Đang tải bài học...', '', 5000);
    try {
      const lesson = await R2Storage.fetchLesson(id);
      if (lesson) {
        AppState.updateLesson(lesson);
        // Refresh UI
        this.init();
        showToast('✅ Đã tải bài học thành công!', 'success');
      }
    } catch(e: any) {
      showToast('❌ Lỗi tải bài học: ' + e.message, 'error');
    }
  }
};
