import { AppState } from '../state';
import { StudentView } from '../views/student.view';
import { qs, escHTML, showToast, showSuccess } from '../utils';

export const MCQGame = {
  selected: {} as Record<number, number>,
  checked: false,

  init(container: Element) {
    const items = AppState.get().lesson.questions.multipleChoice || [];
    if (!items.length) {
      container.innerHTML = '<div class="empty-state"><div class="icon">📋</div><p>Chưa có câu trắc nghiệm nào!</p></div>';
      return;
    }
    this.selected = {}; this.checked = false;
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
          <div class="mcq-submit-row">
            <button class="btn-mcq-submit" id="btn-mcq-check">📋 Nộp trắc nghiệm</button>
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
    if (this.checked) return;
    this.selected[qIdx] = optIdx;
    const opts = document.querySelectorAll(`#mcq-opts-${qIdx} .mcq-option`);
    opts.forEach((o, i) => o.classList.toggle('selected', i === optIdx));
  },

  checkAll() {
    const items = AppState.get().lesson.questions.multipleChoice || [];
    let correct = 0;
    this.checked = true;
    const results: any[] = [];
    
    items.forEach((item, idx) => {
      const selected = this.selected[idx];
      const opts = document.querySelectorAll(`#mcq-opts-${idx} .mcq-option`);
      opts.forEach((o, oi) => {
        o.classList.remove('selected');
        if (oi === item.correct) o.classList.add('correct-ans');
        else if (oi === selected && selected !== item.correct) o.classList.add('wrong-ans');
      });
      const expEl = qs(`#mcq-exp-${idx}`);
      if (expEl) expEl.classList.add('show');
      const isRight = selected === item.correct;
      if (isRight) correct++;
      results.push({ q: item.question, selected, correct: item.correct, isRight });
    });
    
    StudentView.saveAnswer('multipleChoice', { score: correct, total: items.length, results });
    const pct = Math.round(correct/items.length*100);
    
    if (pct === 100) showSuccess('🏆', 'Xuất sắc!', 'Trả lời đúng tất cả câu hỏi!', `${correct}/${items.length} câu đúng`);
    else if (pct >= 70) showSuccess('⭐', 'Giỏi lắm!', `Điểm của bạn`, `${correct}/${items.length} câu đúng`);
    else showToast(`💪 Cố gắng hơn nhé! ${correct}/${items.length} câu đúng`);
  }
};
