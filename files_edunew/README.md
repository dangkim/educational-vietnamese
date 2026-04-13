# 🌟 EduPlay — Nền Tảng Học Tập Tương Tác

> **Production-ready** modular HTML5 web app for interactive education.  
> Zero backend. Zero build step. Open `index.html` and go.

---

## 📁 Project Structure

```
eduplay/
├── index.html              # App shell (single entry point)
├── manifest.json           # PWA manifest
├── sw.js                   # Service Worker (offline support)
│
├── css/
│   ├── main.css            # Design system: tokens, reset, animations
│   ├── components.css      # All UI components: buttons, forms, cards, nav
│   └── games.css           # Game-specific styles (all 5 games)
│
└── js/
    ├── app.js              # Bootstrap: init router, UI, SW
    │
    ├── core/
    │   ├── EventBus.js     # Pub/sub system (decoupled communication)
    │   ├── Store.js        # Reactive state management (dot-path access)
    │   ├── Router.js       # Hash-based SPA router with view lifecycle
    │   └── Component.js    # Base class: lifecycle, DOM helpers, cleanup
    │
    ├── utils/
    │   └── helpers.js      # Pure utilities: string, array, URL, DOM, scoring
    │
    ├── services/
    │   ├── GeminiService.js    # Gemini 2.0 Flash API + prompt engineering
    │   └── StorageService.js   # localStorage + Cloudflare R2 (SigV4)
    │
    ├── components/
    │   └── UI.js           # Toast, Modal, SuccessOverlay, Confetti canvas
    │
    ├── games/
    │   ├── BaseGame.js     # Abstract game: scoring, timer, lifecycle
    │   ├── FlashcardGame.js# 3D flip cards + spaced repetition
    │   └── Games.js        # Wordle, Memory, FillBlank, MCQ
    │
    └── views/
        └── Views.js        # HomeView, TeacherView, StudentView
```

---

## 🚀 Quick Start

### Option A — Local (no server needed)
```bash
# Just open in browser (Chrome/Firefox/Safari)
open index.html
```

> ⚠️ Some browsers restrict ES Modules from `file://`. If you see import errors:

### Option B — Local dev server (recommended)
```bash
# Using Python
python3 -m http.server 8080

# Using Node.js
npx serve .

# Using VS Code
# Install "Live Server" extension → Right-click index.html → Open with Live Server
```

Then open `http://localhost:8080`

---

## 🔑 API Keys Setup

### Gemini AI (Required — Free)
1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Create a new API key (free tier: **1500 requests/day**)
3. Paste into Teacher Wizard → Step 4

### Cloudflare R2 (Optional — for saving student answers)
1. Create an R2 bucket in your Cloudflare dashboard
2. Create an API token with R2 Object Write permission
3. Configure CORS on your bucket:
```json
[{
  "AllowedOrigins": ["*"],
  "AllowedMethods": ["PUT", "GET"],
  "AllowedHeaders": ["*"],
  "MaxAgeSeconds": 3600
}]
```
4. Enter credentials in Teacher Wizard → Step 4

---

## 🏗️ Architecture Principles

| Pattern         | Implementation |
|----------------|---------------|
| **State**       | Centralized reactive Store with dot-path access |
| **Events**      | Global EventBus — zero direct coupling between modules |
| **Routing**     | Hash-based SPA Router with full view lifecycle |
| **Components**  | Base Component class with auto-cleanup of subscriptions |
| **Games**       | BaseGame class — all 5 games share timer, scoring, submission |
| **AI**          | GeminiService with retry logic + structured output validation |
| **Storage**     | localStorage + optional R2 with full AWS SigV4 signing |
| **PWA**         | Service Worker with cache-first strategy for offline use |

---

## 🎮 Game Features

| Game | Questions | Features |
|------|-----------|----------|
| **Flashcards** | 10 cards | 3D flip, spaced repetition, swipe support |
| **Wordle** | 8 words | Color feedback, on-screen keyboard, word-by-word progress |
| **Memory** | 8 pairs (16 cards) | Combo multiplier, move counter, timer |
| **Fill Blank** | 8 sentences | Word bank, fuzzy matching (Vietnamese diacritics) |
| **MCQ** | 10 questions | Per-question timer, streak bonus, full summary |

---

## 🌐 Deployment

### GitHub Pages
```bash
git init && git add . && git commit -m "EduPlay v2"
git remote add origin https://github.com/YOUR_USER/eduplay.git
git push -u origin main
# Enable Pages in Settings → Source: main branch
```

### Netlify / Vercel
Drag and drop the `eduplay/` folder into the dashboard. Done.

### Cloudflare Pages
```bash
# Direct upload via wrangler or dashboard
```

---

## 📱 PWA Installation
- **Chrome/Edge**: Address bar → install icon → Add to Home Screen
- **iOS Safari**: Share → Add to Home Screen

---

## ♿ Accessibility
- ARIA roles and labels on all interactive elements
- Keyboard navigation support (Tab, Enter, Space, Arrow keys)
- `prefers-reduced-motion` respected for all animations
- Focus-visible indicators for keyboard users
- Screen reader announcements for game results

---

## 🛠️ Extending the App

### Adding a new game
```js
// js/games/MyGame.js
import { BaseGame } from './BaseGame.js';
export class MyGame extends BaseGame {
  gameKey   = 'mygame';
  gameTitle = 'My Game';
  gameIcon  = '🎯';
  
  setup() {
    const data = this.state('lesson.questions.myGameData');
    this.maxScore = data.length * 10;
    this.body.innerHTML = `...`;
  }
  
  getAnswerData() { return { /* ... */ }; }
}
```

Then register it in `GAME_DEFS` inside `Views.js` and add the `qKey` to the Gemini prompt.

---

*EduPlay v2.0 — Built for educators, with love.*
