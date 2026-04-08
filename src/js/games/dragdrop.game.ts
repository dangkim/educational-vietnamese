import { AppState } from '../state';
import { StudentView } from '../views/student.view';
import { qs, escHTML, showSuccess, showToast } from '../utils';

export const DragDropGame = {
  pairs: [] as { term: string; def: string; id: number }[],
  matched: new Set<number>(),
  startTime: 0,
  timerInterval: null as any,
  seconds: 0,
  dragSourceId: null as number | null,
  // Touch drag state
  touchDragEl: null as HTMLElement | null,
  touchClone: null as HTMLElement | null,

  init(container: Element) {
    const rawPairs = AppState.get().lesson.questions.memory || [];
    if (!rawPairs.length) {
      container.innerHTML = '<div class="empty-state"><div class="icon">🎯</div><p>Chưa có dữ liệu để chơi Kéo & Thả! Hãy tạo câu hỏi Memory trước.</p></div>';
      return;
    }

    // Pick up to 6 pairs and shuffle
    const shuffled = [...rawPairs].sort(() => Math.random() - 0.5).slice(0, 6);
    this.pairs = shuffled.map((p, i) => ({ term: p.cardA, def: p.cardB, id: i }));
    this.matched = new Set();
    this.seconds = 0;
    this.dragSourceId = null;
    if (this.timerInterval) clearInterval(this.timerInterval);

    // Shuffle just the definitions for the right column
    const shuffledDefs = [...this.pairs].sort(() => Math.random() - 0.5);

    container.innerHTML = `
      <div class="game-header">
        <span style="font-size:1.5rem">🎯</span>
        <h3>Kéo &amp; Thả</h3>
        <span class="game-progress" id="dd-progress">0/${this.pairs.length} cặp</span>
      </div>
      <div class="game-body">
        <div class="dd-stats-bar">
          <div class="dd-stat"><span id="dd-matched">0</span><label>Đúng</label></div>
          <div class="dd-stat"><span id="dd-timer">0:00</span><label>Thời gian</label></div>
          <div class="dd-stat"><span id="dd-errors">0</span><label>Sai</label></div>
        </div>
        <p class="dd-instruction">👆 Kéo thẻ <strong>Đáp án</strong> sang thả vào ô <strong>Câu hỏi</strong> phù hợp</p>
        <div class="dd-arena">
          <div class="dd-column dd-terms-col">
            <div class="dd-col-header">📌 Câu hỏi / Khái niệm</div>
            ${this.pairs.map(p => `
              <div class="dd-drop-zone ${''}" id="dd-zone-${p.id}" data-pair-id="${p.id}">
                <div class="dd-term-text">${escHTML(p.term)}</div>
                <div class="dd-slot" id="dd-slot-${p.id}">Thả đáp án vào đây…</div>
              </div>
            `).join('')}
          </div>
          <div class="dd-column dd-defs-col">
            <div class="dd-col-header">✋ Đáp án (Kéo thẻ này)</div>
            <div class="dd-chips-pool" id="dd-chips-pool">
              ${shuffledDefs.map(p => `
                <div class="dd-chip" id="dd-chip-${p.id}" data-pair-id="${p.id}" draggable="true">
                  <span class="dd-chip-grip">⠿</span>
                  <span class="dd-chip-text">${escHTML(p.def)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    this.startTimer();
    this.bindDragEvents(container);
    this.bindTouchEvents(container);
  },

  startTimer() {
    this.startTime = Date.now();
    this.timerInterval = setInterval(() => {
      this.seconds++;
      const m = Math.floor(this.seconds / 60), s = this.seconds % 60;
      const el = qs('#dd-timer');
      if (el) el.textContent = `${m}:${s.toString().padStart(2, '0')}`;
    }, 1000);
  },

  bindDragEvents(container: Element) {
    let errorCount = 0;

    // Source: chips
    container.querySelectorAll<HTMLElement>('.dd-chip').forEach(chip => {
      chip.addEventListener('dragstart', e => {
        this.dragSourceId = parseInt(chip.dataset.pairId!);
        chip.classList.add('dd-dragging');
        e.dataTransfer!.effectAllowed = 'move';
        e.dataTransfer!.setData('text/plain', chip.dataset.pairId!);
      });
      chip.addEventListener('dragend', () => {
        chip.classList.remove('dd-dragging');
      });
    });

    // Targets: drop zones
    container.querySelectorAll<HTMLElement>('.dd-drop-zone').forEach(zone => {
      zone.addEventListener('dragover', e => {
        e.preventDefault();
        if (!zone.classList.contains('dd-matched')) zone.classList.add('dd-over');
        e.dataTransfer!.dropEffect = 'move';
      });
      zone.addEventListener('dragleave', () => zone.classList.remove('dd-over'));
      zone.addEventListener('drop', e => {
        e.preventDefault();
        zone.classList.remove('dd-over');
        const pairId = parseInt(e.dataTransfer!.getData('text/plain'));
        const zonePairId = parseInt(zone.dataset.pairId!);
        errorCount = this.handleDrop(pairId, zonePairId, errorCount);
      });
    });
  },

  bindTouchEvents(container: Element) {
    let errorCount = 0;
    let currentTarget: HTMLElement | null = null;

    container.querySelectorAll<HTMLElement>('.dd-chip').forEach(chip => {
      chip.addEventListener('touchstart', e => {
        if (chip.classList.contains('dd-chip-locked')) return;
        e.preventDefault();
        this.dragSourceId = parseInt(chip.dataset.pairId!);

        // Create floating clone
        const clone = chip.cloneNode(true) as HTMLElement;
        clone.id = 'dd-touch-clone';
        clone.style.cssText = `
          position:fixed; pointer-events:none; z-index:9999; opacity:0.85;
          width:${chip.offsetWidth}px; transform:scale(1.05);
          transition:none; box-shadow:0 12px 32px rgba(0,0,0,0.25);
        `;
        const t = e.touches[0];
        clone.style.left = (t.clientX - chip.offsetWidth / 2) + 'px';
        clone.style.top = (t.clientY - chip.offsetHeight / 2) + 'px';
        document.body.appendChild(clone);
        this.touchClone = clone;
        chip.classList.add('dd-dragging');
        this.touchDragEl = chip;
      }, { passive: false });

      chip.addEventListener('touchmove', e => {
        e.preventDefault();
        const t = e.touches[0];
        if (this.touchClone) {
          this.touchClone.style.left = (t.clientX - (this.touchClone.offsetWidth / 2)) + 'px';
          this.touchClone.style.top = (t.clientY - (this.touchClone.offsetHeight / 2)) + 'px';
        }

        // Detect drop zone under finger
        this.touchClone!.style.display = 'none';
        const el = document.elementFromPoint(t.clientX, t.clientY);
        this.touchClone!.style.display = '';
        const zone = el?.closest<HTMLElement>('.dd-drop-zone');
        container.querySelectorAll('.dd-drop-zone').forEach(z => z.classList.remove('dd-over'));
        if (zone && !zone.classList.contains('dd-matched')) {
          zone.classList.add('dd-over');
          currentTarget = zone;
        } else {
          currentTarget = null;
        }
      }, { passive: false });

      chip.addEventListener('touchend', e => {
        e.preventDefault();
        if (this.touchClone) { this.touchClone.remove(); this.touchClone = null; }
        if (this.touchDragEl) this.touchDragEl.classList.remove('dd-dragging');
        container.querySelectorAll('.dd-drop-zone').forEach(z => z.classList.remove('dd-over'));

        if (currentTarget && this.dragSourceId !== null) {
          const zonePairId = parseInt(currentTarget.dataset.pairId!);
          errorCount = this.handleDrop(this.dragSourceId, zonePairId, errorCount);
        }
        currentTarget = null;
        this.dragSourceId = null;
      }, { passive: false });
    });
  },

  handleDrop(pairId: number, zonePairId: number, errorCount: number): number {
    const zone = qs<HTMLElement>(`#dd-zone-${zonePairId}`);
    const chip = qs<HTMLElement>(`#dd-chip-${pairId}`);
    if (!zone || !chip) return errorCount;
    if (zone.classList.contains('dd-matched')) return errorCount;

    const isCorrect = pairId === zonePairId;

    if (isCorrect) {
      // Lock the answer in
      this.matched.add(pairId);
      const slot = zone.querySelector<HTMLElement>('.dd-slot');
      if (slot) {
        slot.textContent = this.pairs.find(p => p.id === pairId)?.def || '';
        slot.classList.add('dd-slot-filled');
      }
      zone.classList.add('dd-matched');
      chip.classList.add('dd-chip-locked');
      chip.setAttribute('draggable', 'false');
      chip.style.opacity = '0.3';
      chip.style.pointerEvents = 'none';

      // Update stats
      const matchedEl = qs('#dd-matched');
      if (matchedEl) matchedEl.textContent = this.matched.size.toString();
      const progEl = qs('#dd-progress');
      if (progEl) progEl.textContent = `${this.matched.size}/${this.pairs.length} cặp`;

      // Check win
      if (this.matched.size === this.pairs.length) {
        clearInterval(this.timerInterval);
        const m = Math.floor(this.seconds / 60), s = this.seconds % 60;
        StudentView.saveAnswer('dragdrop', {
          matched: this.matched.size,
          total: this.pairs.length,
          errors: errorCount,
          timeSeconds: this.seconds
        });
        setTimeout(() => showSuccess('🎯', 'Tuyệt vời!',
          `Ghép xong toàn bộ trong ${m}:${s.toString().padStart(2, '0')}!`,
          `${errorCount} lần sai — Thật xuất sắc!`), 500);
      }
    } else {
      // Wrong match animation
      errorCount++;
      const errEl = qs('#dd-errors');
      if (errEl) errEl.textContent = errorCount.toString();
      zone.classList.add('dd-shake');
      chip.classList.add('dd-chip-wrong');
      setTimeout(() => {
        zone.classList.remove('dd-shake');
        chip.classList.remove('dd-chip-wrong');
      }, 600);
    }

    return errorCount;
  }
};
