/**
 * EduPlay GeminiService
 * Handles all AI question generation via Gemini API.
 * Supports prompt engineering, retry, and structured output.
 */
import { bus, Events } from '../core/EventBus.js';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const GENERATION_STEPS = [
  { id: 'connect',  label: '🔗 Đang kết nối Gemini AI...' },
  { id: 'analyze',  label: '📖 Đang phân tích tài liệu...' },
  { id: 'flash',    label: '🃏 Đang tạo Flashcards...' },
  { id: 'wordle',   label: '🔤 Đang tạo từ cho Wordle...' },
  { id: 'memory',   label: '🧩 Đang tạo thẻ Memory...' },
  { id: 'fill',     label: '✏️ Đang tạo câu điền trống...' },
  { id: 'mcq',      label: '📋 Đang tạo trắc nghiệm...' },
  { id: 'done',     label: '✅ Hoàn thành!' },
];

export class GeminiService {
  #apiKey;
  #maxRetries = 2;

  constructor(apiKey) {
    this.#apiKey = apiKey;
  }

  setApiKey(key) { this.#apiKey = key; }

  /**
   * Generate all 5 question types from document text.
   * @param {string} documentText
   * @param {Object} lessonMeta - { title, subject, grade }
   * @returns {Promise<Object>} structured questions object
   */
  async generateQuestions(documentText, lessonMeta = {}) {
    if (!this.#apiKey) throw new Error('Gemini API key chưa được thiết lập!');
    if (!documentText?.trim()) throw new Error('Tài liệu không được để trống!');

    bus.emit(Events.AI_START, { steps: GENERATION_STEPS });

    const steps = [...GENERATION_STEPS];
    let stepIdx = 0;

    const advanceStep = () => {
      stepIdx = Math.min(stepIdx + 1, steps.length - 1);
      bus.emit(Events.AI_STEP, { step: steps[stepIdx], index: stepIdx, total: steps.length });
    };

    const stepTimer = setInterval(advanceStep, 1500);

    try {
      const prompt = this.#buildPrompt(documentText, lessonMeta);
      const raw = await this.#callWithRetry(prompt);
      const parsed = this.#parseResponse(raw);

      clearInterval(stepTimer);
      bus.emit(Events.AI_STEP, { step: steps[steps.length - 1], index: steps.length - 1, total: steps.length });
      bus.emit(Events.AI_DONE, parsed);

      return parsed;
    } catch (e) {
      clearInterval(stepTimer);
      bus.emit(Events.AI_ERROR, e);
      throw e;
    }
  }

  #buildPrompt(text, meta) {
    const ctx = [meta.title, meta.subject, meta.grade].filter(Boolean).join(' — ');
    const excerpt = text.slice(0, 6000).trim();

    return `Bạn là chuyên gia giáo dục. Dựa trên tài liệu dưới đây${ctx ? ` về "${ctx}"` : ''}, hãy tạo 5 dạng bài tập tương tác cho học sinh.

QUY TẮC QUAN TRỌNG:
- Từ cho WORDLE: chỉ dùng chữ cái Latin không dấu (a-z A-Z), 4–8 ký tự, không có khoảng cách.
- Tất cả câu hỏi phải xuất phát từ nội dung tài liệu cung cấp.
- Ngôn ngữ: Tiếng Việt (trừ từ Wordle dùng không dấu).
- Giải thích MCQ ngắn gọn, dễ hiểu cho học sinh.

DẠNG 1 - FLASHCARDS: Tạo 10 thẻ học với thuật ngữ/khái niệm và giải thích.
DẠNG 2 - WORDLE: Tạo 8 từ vựng quan trọng (KHÔNG DẤU, 4-8 ký tự), kèm gợi ý bằng tiếng Việt.
DẠNG 3 - MEMORY: Tạo 8 cặp (khái niệm ngắn ↔ định nghĩa ngắn) để ghép đôi.
DẠNG 4 - ĐIỀN TRỐNG: Tạo 8 câu có [___] đánh dấu chỗ trống, kèm đáp án và gợi ý.
DẠNG 5 - TRẮC NGHIỆM: Tạo 10 câu hỏi A/B/C/D, đánh dấu đáp án đúng (index 0-3) và giải thích.

TÀI LIỆU:
---
${excerpt}
---

Trả lời CHỈ bằng JSON hợp lệ (KHÔNG dùng markdown, KHÔNG backtick, KHÔNG giải thích):
{
  "flashcards": [
    {"term": "...", "definition": "..."}
  ],
  "wordle": [
    {"word": "TULIP", "hint": "Một loài hoa đẹp"}
  ],
  "memory": [
    {"cardA": "Quang hợp", "cardB": "Quá trình cây xanh tổng hợp chất hữu cơ từ ánh sáng mặt trời"}
  ],
  "fillBlank": [
    {"sentence": "Cây xanh thực hiện quá trình [___] để tạo ra thức ăn.", "answer": "quang hợp", "hint": "Quá trình liên quan đến ánh sáng"}
  ],
  "multipleChoice": [
    {
      "question": "Cơ quan quang hợp chính của cây là gì?",
      "options": ["A. Rễ cây", "B. Lá cây", "C. Thân cây", "D. Hoa"],
      "correct": 1,
      "explanation": "Lá cây chứa diệp lục (chlorophyll) là nơi diễn ra quang hợp."
    }
  ]
}`;
  }

  async #callWithRetry(prompt, attempt = 0) {
    try {
      const resp = await fetch(`${GEMINI_API_URL}?key=${this.#apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature:     0.7,
            maxOutputTokens: 8192,
            candidateCount:  1,
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
          ],
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        const msg = errData?.error?.message || `HTTP ${resp.status}`;
        if (resp.status === 429 && attempt < this.#maxRetries) {
          await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
          return this.#callWithRetry(prompt, attempt + 1);
        }
        throw new Error(`Gemini API error: ${msg}`);
      }

      const data = await resp.json();
      return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      if (attempt < this.#maxRetries) {
        await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
        return this.#callWithRetry(prompt, attempt + 1);
      }
      throw e;
    }
  }

  #parseResponse(raw) {
    // Strip any markdown code fences
    let cleaned = raw.trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

    // Find the outermost JSON object
    const firstBrace = cleaned.indexOf('{');
    const lastBrace  = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    }

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      throw new Error(`AI trả về dữ liệu không hợp lệ. Vui lòng thử lại.\n(${e.message})`);
    }

    // Validate and sanitize
    return {
      flashcards:     this.#sanitizeFlashcards(parsed.flashcards),
      wordle:         this.#sanitizeWordle(parsed.wordle),
      memory:         this.#sanitizeMemory(parsed.memory),
      fillBlank:      this.#sanitizeFillBlank(parsed.fillBlank),
      multipleChoice: this.#sanitizeMCQ(parsed.multipleChoice),
    };
  }

  #sanitizeFlashcards(arr) {
    return (Array.isArray(arr) ? arr : []).filter(i => i?.term && i?.definition).slice(0, 15).map(i => ({
      term:       String(i.term).trim(),
      definition: String(i.definition).trim(),
    }));
  }

  #sanitizeWordle(arr) {
    return (Array.isArray(arr) ? arr : []).filter(i => i?.word).map(i => ({
      word: String(i.word).replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 8),
      hint: String(i.hint || '').trim(),
    })).filter(i => i.word.length >= 3).slice(0, 10);
  }

  #sanitizeMemory(arr) {
    return (Array.isArray(arr) ? arr : []).filter(i => i?.cardA && i?.cardB).slice(0, 12).map(i => ({
      cardA: String(i.cardA).trim(),
      cardB: String(i.cardB).trim(),
    }));
  }

  #sanitizeFillBlank(arr) {
    return (Array.isArray(arr) ? arr : []).filter(i => i?.sentence && i?.answer && i.sentence.includes('[___]')).slice(0, 10).map(i => ({
      sentence: String(i.sentence).trim(),
      answer:   String(i.answer).trim(),
      hint:     String(i.hint || '').trim(),
    }));
  }

  #sanitizeMCQ(arr) {
    return (Array.isArray(arr) ? arr : []).filter(i => i?.question && Array.isArray(i.options) && i.options.length >= 2).slice(0, 12).map(i => ({
      question:    String(i.question).trim(),
      options:     i.options.slice(0, 4).map(o => String(o).trim()),
      correct:     Math.min(Number(i.correct ?? 0), i.options.length - 1),
      explanation: String(i.explanation || '').trim(),
    }));
  }
}
