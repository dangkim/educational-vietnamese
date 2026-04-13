/**
 * EduPlay Service Worker — PWA offline support
 */
const CACHE_NAME = 'eduplay-v2';
const STATIC_ASSETS = [
  './',
  './index.html',
  './css/main.css',
  './css/components.css',
  './css/games.css',
  './js/app.js',
  './js/core/EventBus.js',
  './js/core/Store.js',
  './js/core/Router.js',
  './js/core/Component.js',
  './js/utils/helpers.js',
  './js/services/GeminiService.js',
  './js/services/StorageService.js',
  './js/components/UI.js',
  './js/games/BaseGame.js',
  './js/games/FlashcardGame.js',
  './js/games/Games.js',
  './js/views/Views.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Skip cross-origin (API calls etc.)
  if (!e.request.url.startsWith(self.location.origin)) return;
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        if (resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return resp;
      }).catch(() => cached ?? new Response('Offline', { status: 503 }));
    })
  );
});
