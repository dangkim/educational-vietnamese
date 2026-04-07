import { AppState } from '../state';
import { StorageService } from '../services/storage.service';
import { R2Storage } from '../services/r2.service';
import { qs, showToast, showSuccess, getYTEmbedUrl, escHTML, isImageUrl } from '../utils';

// We will import game initializers
import { FlashcardGame } from '../games/flashcard.game';
import { WordleGame } from '../games/wordle.game';
import { MemoryGame } from '../games/memory.game';
import { FillBlankGame } from '../games/fillblank.game';
import { MCQGame } from '../games/mcq.game';

export const StudentView = {
  init() {
    const lesson = AppState.get().lesson;
    const sName = qs<HTMLInputElement>('#student-name');
    if (sName) {
      sName.value = AppState.get().student.name;
      sName.addEventListener('change', (e) => AppState.updateLesson({}, 'student_name')); // Wait, actually update student
      sName.addEventListener('change', (e) => AppState.set({ student: { ...AppState.get().student, name: (e.target as HTMLInputElement).value } }));
    }

    const t = qs('#hero-title'); if (t) t.textContent = lesson.title || 'Bài Học Hôm Nay';
    const d = qs('#hero-desc'); if (d) d.textContent = lesson.description || `${lesson.subject || ''} ${lesson.grade || ''} — Cùng học và khám phá nhé! 🎉`.trim();
    const l = qs('#student-lesson-title'); if (l) l.textContent = lesson.title || 'Bài Học';
    
    this.bindEvents();
    this.renderSectionNav();
    this.showSection(0);
    this.renderGameGrid();
  },

  bindEvents() {
    qs('#btn-complete-section')?.addEventListener('click', () => this.completeSection());
    qs('#vid-prev')?.addEventListener('click', () => this.prevVideo());
    qs('#vid-next')?.addEventListener('click', () => this.nextVideo());
    qs('#btn-download-answers')?.addEventListener('click', () => this.downloadAnswers());
    qs('#btn-submit-answers')?.addEventListener('click', () => this.submitAnswers());
  },

  renderSectionNav() {
    const nav = qs('#section-nav');
    if (!nav) return;
    const state = AppState.get();
    nav.innerHTML = state.lesson.sections.map((sec, idx) => `
      <button class="section-tab ${idx === state.currentSection ? 'active' : ''} ${sec.completed ? 'completed' : ''}" data-idx="${idx}">
        ${sec.icon} ${sec.name} ${sec.completed ? '✓' : ''}
      </button>
    `).join('');
    // Add Activities tab
    nav.innerHTML += `<button class="section-tab ${state.currentSection === 4 ? 'active' : ''}" data-act="true">🎮 Bài Tập</button>`;

    nav.querySelectorAll('.section-tab').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const t = e.currentTarget as HTMLElement;
        if (t.dataset.act) this.showActivities();
        else this.showSection(parseInt(t.dataset.idx!, 10));
      });
    });
  },

  showSection(idx: number) {
    AppState.set({ currentSection: idx, currentVideo: 0 });
    qs('#activities-section')?.classList.add('hidden');
    const vs = qs<HTMLElement>('.video-section');
    if (vs) vs.style.display = '';
    this.renderSectionNav();
    
    const sec = AppState.get().lesson.sections[idx];
    if (!sec) return; // Safegaurd
    const iEl = qs('#curr-section-icon'); if (iEl) iEl.textContent = sec.icon;
    const nEl = qs('#curr-section-name'); if (nEl) nEl.textContent = sec.name;

    const lw = qs<HTMLElement>('#lecture-wrapper');
    if (lw) {
      if (sec.lecture && sec.lecture.trim()) {
        // Simple line break support
        lw.innerHTML = escHTML(sec.lecture).replace(/\n/g, '<br>');
        lw.style.display = 'block';
      } else {
        lw.style.display = 'none';
        lw.innerHTML = '';
      }
    }

    this.renderVideo();
  },

  renderVideo() {
    const state = AppState.get();
    const sec = state.lesson.sections[state.currentSection];
    const videos = (sec.videos || []).filter(v => v.trim());
    const images = (sec.images || []).filter(i => i.trim());
    const media = [...videos, ...images];
    
    const wrapper = qs('#video-wrapper');
    const controls = qs('#video-controls');
    const dots = qs('#video-dots');
    
    if (!wrapper || !controls || !dots) return;

    const vc = qs<HTMLElement>('#video-carousel-container');

    if (!media.length) {
      if (vc) vc.style.display = (sec.lecture && sec.lecture.trim()) ? 'none' : '';
      wrapper.innerHTML = `<div class="no-video-placeholder"><span style="font-size:3rem">🎬</span><span>Chưa có video hoặc hình ảnh cho phần này</span></div>`;
      controls.style.display = 'none';
      return;
    }
    
    if (vc) vc.style.display = '';
    
    const idx = state.currentVideo;
    const itemUrl = media[idx];
    
    if (isImageUrl(itemUrl)) {
      wrapper.innerHTML = `<img src="${escHTML(itemUrl)}" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:12px;" />`;
    } else {
      const url = getYTEmbedUrl(itemUrl);
      if (url && (url.includes('youtube.com/embed') || url.includes('drive.google.com'))) {
        wrapper.innerHTML = `<iframe src="${escHTML(url)}" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>`;
      } else if (url) {
        wrapper.innerHTML = `<video src="${escHTML(url)}" controls style="width:100%;height:100%"></video>`;
      } else {
        wrapper.innerHTML = `<div class="no-video-placeholder"><span style="font-size:3rem">⚠️</span><span>Link không hợp lệ</span></div>`;
      }
    }
    
    if (media.length > 1) {
      controls.style.display = 'flex';
      dots.innerHTML = media.map((_,i) => `<div class="video-dot ${i===idx?'active':''}" data-idx="${i}"></div>`).join('');
      dots.querySelectorAll('.video-dot').forEach(d => {
        d.addEventListener('click', (e) => this.goToVideo(parseInt((e.currentTarget as HTMLElement).dataset.idx!, 10)));
      });
      const p = qs<HTMLButtonElement>('#vid-prev'); if (p) p.disabled = idx === 0;
      const n = qs<HTMLButtonElement>('#vid-next'); if (n) n.disabled = idx === media.length - 1;
    } else {
      controls.style.display = 'none';
    }
  },

  prevVideo() { 
    if (AppState.get().currentVideo > 0) { 
      AppState.set({ currentVideo: AppState.get().currentVideo - 1 }); 
      this.renderVideo(); 
    } 
  },
  nextVideo() {
    const s = AppState.get();
    const sec = s.lesson.sections[s.currentSection];
    const mediaCount = (sec.videos||[]).filter(v=>v).length + (sec.images||[]).filter(i=>i).length;
    if (s.currentVideo < mediaCount - 1) { 
      AppState.set({ currentVideo: s.currentVideo + 1 }); 
      this.renderVideo(); 
    }
  },
  goToVideo(idx: number) { AppState.set({ currentVideo: idx }); this.renderVideo(); },

  completeSection() {
    const s = AppState.get();
    const sections = s.lesson.sections;
    sections[s.currentSection].completed = true;
    AppState.updateLesson({ sections });
    
    const next = s.currentSection + 1;
    if (next < sections.length) {
      this.showSection(next);
      showToast(`✅ Hoàn thành! Chuyển sang "${sections[next].name}"`, 'success');
    } else {
      this.showActivities();
      showToast('🎉 Đã xem xong tất cả phần! Đến phần bài tập nhé!', 'success');
    }
  },

  showActivities() {
    AppState.set({ currentSection: 4 });
    qs('#activities-section')?.classList.remove('hidden');
    const vs = qs<HTMLElement>('.video-section');
    if (vs) vs.style.display = 'none';
    this.renderSectionNav();
    qs('#activities-section')?.scrollIntoView({behavior:'smooth'});
  },

  renderGameGrid() {
    const q = AppState.get().lesson.questions;
    const games = [
      { key:'flashcards', label:'Flashcards', icon:'🃏', cls:'flashcard-btn', sub:'Lật thẻ học từ', count: q.flashcards?.length||0 },
      { key:'wordle', label:'Wordle', icon:'🔤', cls:'wordle-btn', sub:'Đoán từ bí ẩn', count: q.wordle?.length||0 },
      { key:'memory', label:'Memory', icon:'🧩', cls:'memory-btn', sub:'Ghép đôi thẻ', count: q.memory?.length||0 },
      { key:'fillblank', label:'Điền trống', icon:'✏️', cls:'fillblank-btn', sub:'Hoàn thành câu', count: q.fillBlank?.length||0 },
      { key:'mcq', label:'Trắc nghiệm', icon:'📋', cls:'mcq-btn', sub:'Chọn đáp án', count: q.multipleChoice?.length||0 }
    ];
    const grid = qs('#game-grid');
    if (!grid) return;
    grid.innerHTML = games.map(g => `
      <div class="game-btn ${g.cls}" id="game-btn-${g.key}" data-key="${g.key}">
        ${g.count > 0 ? `<div class="game-badge">${g.count}</div>` : ''}
        <div class="game-btn-content">
          <div class="game-icon">${g.icon}</div>
          <div class="game-label">${g.label}</div>
          <div class="game-sub">${g.sub}</div>
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('.game-btn').forEach(b => {
      b.addEventListener('click', (e) => this.selectGame((e.currentTarget as HTMLElement).dataset.key!));
    });
  },

  selectGame(key: string) {
    AppState.set({ activeGame: key });
    document.querySelectorAll('.game-btn').forEach(b => b.classList.remove('active'));
    qs(`#game-btn-${key}`)?.classList.add('active');
    
    const container = qs('#game-container');
    if (!container) return;
    container.classList.remove('hidden');
    container.innerHTML = '';
    container.scrollIntoView({behavior:'smooth', block:'start'});
    
    switch(key) {
      case 'flashcards': FlashcardGame.init(container); break;
      case 'wordle': WordleGame.init(container); break;
      case 'memory': MemoryGame.init(container); break;
      case 'fillblank': FillBlankGame.init(container); break;
      case 'mcq': MCQGame.init(container); break;
    }
  },

  saveAnswer(gameKey: string, data: any) {
    const s = AppState.get().student;
    s.answers[gameKey] = data;
    s.completedGames[gameKey] = true;
    AppState.set({ student: s });
    // Update badge
    const btn = qs(`#game-btn-${gameKey}`);
    if (btn) { const b = btn.querySelector<HTMLElement>('.game-badge'); if (b) b.style.background = 'var(--mint)'; }
  },

  downloadAnswers() {
    const s = AppState.get();
    const data = {
      lesson: s.lesson.title,
      student: s.student.name || 'Ẩn danh',
      timestamp: new Date().toISOString(),
      answers: s.student.answers
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `bai-lam-${(s.student.name||'hoc-sinh').replace(/\\s+/g,'-')}.json`;
    a.click(); URL.revokeObjectURL(url);
  },

  async submitAnswers() {
    const s = AppState.get();
    if (!s.student.name) {
      showToast('Vui lòng nhập tên học sinh!', 'error');
      qs('#student-name')?.focus();
      return;
    }
    const data = {
      lesson: s.lesson.title,
      student: s.student.name,
      timestamp: new Date().toISOString(),
      answers: s.student.answers
    };

    // Try R2 if configured
    if (s.config.r2AccountId && s.config.r2Bucket && s.config.r2AccessKey) {
      showToast('⏳ Đang nộp bài...', '', 10000);
      try {
        await R2Storage.uploadAnswer(data);
        showToast('✅ Nộp bài thành công!', 'success');
        showSuccess('🚀', 'Nộp bài thành công!', `${s.student.name} — bài làm đã được lưu!`, '⭐⭐⭐⭐⭐');
        return;
      } catch(e) {
        showToast('⚠️ Không thể lên R2, tải file thay thế...', 'error', 4000);
      }
    }

    // Fallback: download
    this.downloadAnswers();
    showSuccess('📥', 'Đã tải bài làm!', 'File JSON đã được lưu về máy của bạn.', Object.keys(s.student.answers).length + ' bài tập');
  }
};
