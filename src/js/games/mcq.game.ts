import { AppState } from '../state';
import { StudentView } from '../views/student.view';
import { qs, escHTML, showToast, showSuccess } from '../utils';

export const MCQGame = {
  selected: {} as Record<number, number>,
  answered: new Set<number>(),
  correctCount: 0,
  checked: false,

  init(container: Element) {
    const items = AppState.get().lesson.questions.multipleChoice || [];
    if (!items.length) {
      container.innerHTML = '<div class="empty-state"><div class="icon">📋</div><p>Chưa có câu trắc nghiệm nào!</p></div>';
      return;
    }
    this.selected = {}; this.checked = false; this.answered.clear(); this.correctCount = 0;
    const letters = ['A','B','C','D'];
    
    container.innerHTML = `
      <div class="game-header">
        <span style="font-size:1.5rem">📋</span>
        <h3>Trắc Nghiệm</h3>
        <span class="game-progress">${items.length} câu</span>
      </div>
      <div class="game-body">
        <div class="mcq-stage">
          ${items.map((item, idx) => `
            <div class="mcq-item">
              <div class="mcq-q-num">Câu ${idx+1}</div>
              <div class="mcq-question">${escHTML(item.question)}</div>
              <div class="mcq-options" id="mcq-opts-${idx}">
                ${(item.options||[]).map((opt: string, oi: number) => `
                  <button class="mcq-option" data-q="${idx}" data-o="${oi}">
                    <span class="mcq-opt-letter">${letters[oi]||oi}</span>
                    <span>${escHTML(opt)}</span>
                  </button>
                `).join('')}
              </div>
              <div class="mcq-explanation" id="mcq-exp-${idx}">💡 ${escHTML(item.explanation||'')}</div>
            </div>
          `).join('')}
          <div class="mcq-submit-row hidden" id="mcq-final-row">
            <button class="btn-mcq-submit" id="btn-mcq-check">🎉 Hoàn thành bài trắc nghiệm!</button>
          </div>
        </div>
      </div>
    `;

    container.querySelectorAll('.mcq-option').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const t = e.currentTarget as HTMLElement;
        this.select(parseInt(t.dataset.q!, 10), parseInt(t.dataset.o!, 10));
      });
    });

    qs('#btn-mcq-check')?.addEventListener('click', () => this.checkAll());
  },

  select(qIdx: number, optIdx: number) {
    if (this.answered.has(qIdx)) return;
    
    const items = AppState.get().lesson.questions.multipleChoice || [];
    const item = items[qIdx];
    this.selected[qIdx] = optIdx;
    this.answered.add(qIdx);
    
    const opts = document.querySelectorAll(`#mcq-opts-${qIdx} .mcq-option`);
    const isCorrect = optIdx === item.correct;
    
    if (isCorrect) this.correctCount++;
    
    opts.forEach((o, i) => {
      if (i === optIdx) {
        o.classList.add(isCorrect ? 'correct-ans' : 'wrong-ans');
      } else if (i === item.correct) {
        o.classList.add('correct-ans');
      }
      (o as HTMLElement).style.pointerEvents = 'none';
      if (i !== optIdx && i !== item.correct) (o as HTMLElement).style.opacity = '0.6';
    });
    
    const expEl = qs(`#mcq-exp-${qIdx}`);
    if (expEl) expEl.classList.add('show');
    
    // Check if all answered
    if (this.answered.size === items.length) {
      setTimeout(() => this.checkAll(), 800);
    }
  },

  checkAll() {
    if (this.checked) return;
    const items = AppState.get().lesson.questions.multipleChoice || [];
    this.checked = true;
    
    const results = items.map((item, idx) => ({
      q: item.question,
      selected: this.selected[idx],
      correct: item.correct,
      isRight: this.selected[idx] === item.correct
    }));
    
    StudentView.saveAnswer('multipleChoice', { score: this.correctCount, total: items.length, results });
    const pct = Math.round(this.correctCount/items.length*100);
    
    if (pct === 100) showSuccess('🏆', 'Xuất sắc!', 'Trả lời đúng tất cả câu hỏi!', `${this.correctCount}/${items.length} câu đúng`);
    else if (pct >= 70) showSuccess('⭐', 'Giỏi lắm!', `Điểm của bạn`, `${this.correctCount}/${items.length} câu đúng`);
    else showToast(`💪 Cố gắng hơn nhé! ${this.correctCount}/${items.length} câu đúng`);
  }
};
