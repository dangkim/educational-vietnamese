import { AppState } from '../state';
import { StudentView } from '../views/student.view';
import { qs, escHTML, showToast, showSuccess } from '../utils';

export const FillBlankGame = {
  checked: false,

  init(container: Element) {
    const items = AppState.get().lesson.questions.fillBlank || [];
    if (!items.length) {
      container.innerHTML = '<div class="empty-state"><div class="icon">✏️</div><p>Chưa có câu điền trống nào!</p></div>';
      return;
    }
    container.innerHTML = `
      <div class="game-header">
        <span style="font-size:1.5rem">✏️</span>
        <h3>Điền vào chỗ trống</h3>
        <span class="game-progress">${items.length} câu</span>
      </div>
      <div class="game-body">
        <div class="fill-stage" id="fill-stage"></div>
        <div class="fill-check-row">
          <button class="btn-check" id="btn-fill-check">✅ Kiểm tra đáp án</button>
        </div>
        <div class="fill-result hidden" id="fill-result"></div>
      </div>
    `;
    this.checked = false;
    
    const stage = qs('#fill-stage');
    if (stage) {
      stage.innerHTML = items.map((item, idx) => {
        const parts = item.sentence.split('[___]');
        const before = escHTML(parts[0] || '');
        const after = escHTML(parts[1] || '');
        return `
          <div class="fill-item">
            <div class="fill-item-num">Câu ${idx+1}</div>
            <div class="fill-sentence">
              ${before}<input class="fill-input-inline" id="fill-${idx}" placeholder="..." style="width:${Math.max(80, (item.answer||'').length*14)}px" />${after}
            </div>
            <div class="fill-hint">💡 Gợi ý: ${escHTML(item.hint||'')}</div>
          </div>
        `;
      }).join('');
    }

    qs('#btn-fill-check')?.addEventListener('click', () => this.checkAll());
  },

  checkAll() {
    const items = AppState.get().lesson.questions.fillBlank || [];
    let correct = 0;
    const results: any[] = [];
    items.forEach((item, idx) => {
      const input = qs<HTMLInputElement>(`#fill-${idx}`);
      if (!input) return;
      const val = input.value.trim().toLowerCase();
      const ans = (item.answer || '').trim().toLowerCase();
      const isRight = val === ans || (ans.includes(val) && val.length > 2);
      if (isRight) { correct++; input.classList.add('correct'); input.classList.remove('wrong'); }
      else { input.classList.add('wrong'); input.classList.remove('correct'); }
      results.push({ q: item.sentence, answer: item.answer, student: input.value, correct: isRight });
    });
    this.checked = true;
    const resEl = qs('#fill-result');
    if (!resEl) return;
    resEl.classList.remove('hidden');
    const pct = Math.round(correct/items.length*100);
    resEl.className = `fill-result ${pct >= 70 ? 'good' : 'bad'}`;
    resEl.textContent = `${correct}/${items.length} câu đúng (${pct}%)`;
    
    StudentView.saveAnswer('fillBlank', { score: correct, total: items.length, results });
    
    if (pct === 100) showSuccess('🌟', 'Hoàn hảo!', 'Bạn điền đúng tất cả các câu!', `${correct}/${items.length} câu đúng`);
    else if (pct >= 70) showToast(`✅ Tốt lắm! ${correct}/${items.length} câu đúng`, 'success');
    else showToast(`💪 Cố gắng thêm! ${correct}/${items.length} câu đúng`);
  }
};
