import { AppState, Questions } from '../state';

export const GeminiService = {
  async generateQuestions(documentText: string, apiKey: string): Promise<Questions> {
    const prompt = `Bạn là giáo viên chuyên nghiệp. Dựa vào tài liệu sau, tạo bộ câu hỏi cho học sinh theo 5 dạng.

DẠNG 1 - FLASHCARDS: Tạo 8 thẻ học với từ khóa/khái niệm quan trọng và giải thích ngắn gọn.
DẠNG 2 - WORDLE: Tạo 6 từ vựng quan trọng (4-8 ký tự, không dấu cách), mỗi từ kèm gợi ý.
DẠNG 3 - MEMORY: Tạo 8 cặp (term - definition ngắn) để ghép đôi.
DẠNG 4 - ĐIỀN VÀO CHỖ TRỐNG: Tạo 6 câu, mỗi câu có một chỗ trống được đánh dấu bằng [___].
DẠNG 5 - TRẮC NGHIỆM: Tạo 8 câu hỏi trắc nghiệm A/B/C/D, chỉ ra đáp án đúng và giải thích ngắn.

TÀI LIỆU:
${documentText.slice(0, 4000)}

Trả lời CHỈ bằng JSON (không markdown, không backtick). TRẢ LỜI TRỰC TIẾP, KHÔNG CẦN SUY NGHĨ DÀI DÒNG:
{
  "flashcards": [{"term":"...","definition":"..."}],
  "wordle": [{"word":"...","hint":"..."}],
  "memory": [{"cardA":"...","cardB":"..."}],
  "fillBlank": [{"sentence":"... [___] ...","answer":"...","hint":"..."}],
  "multipleChoice": [{"question":"...","options":["A. ...","B. ...","C. ...","D. ..."],"correct":0,"explanation":"..."}]
}`;

    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        contents: [{ parts: [{ text: prompt }] }], 
        generationConfig: { temperature: 0.7, maxOutputTokens: 8192 } 
      })
    });

    if (!resp.ok) {
      const err = await resp.json();
      throw new Error(err.error?.message || `HTTP ${resp.status}`);
    }

    const data = await resp.json();
    let raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Robust JSON extraction: find the first '{' and the last '}'
    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      raw = raw.substring(firstBrace, lastBrace + 1);
    }

    try {
      return JSON.parse(raw) as Questions;
    } catch (e) {
      console.error('Failed to parse Gemini response:', raw);
      throw new Error('Không thể đọc kết quả từ AI. Vui lòng thử lại với tài liệu ngắn hơn.');
    }
  }
};
