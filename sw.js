// ============================================
// KEYJI — Service Worker (PWA + Offline)
// ============================================

const CACHE_NAME = 'keyji-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/onboarding.html',
  '/chats.html',
  '/chat.html',
  '/settings.html',
  '/profile.html',
  '/bots.html',
  '/channels.html',
  '/groups.html',
  '/admin.html',
  '/firebase.js',
  '/manifest.json'
];

// Install — кэшируем все файлы
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[Keyji SW] Кэшируем файлы...');
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate — удаляем старый кэш
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
  console.log('[Keyji SW] Активирован ✅');
});

// Fetch — сначала сеть, потом кэш
self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

// Push уведомления
self.addEventListener('push', e => {
  const data = e.data?.json() || {};
  e.waitUntil(
    self.registration.showNotification(data.title || 'Keyji', {
      body: data.body || 'Новое сообщение',
      icon: 'https://i.ibb.co/GQ3T21qm/file-00000000ea2472469cbca4c0cbe8b34e.jpg',
      badge: 'https://i.ibb.co/GQ3T21qm/file-00000000ea2472469cbca4c0cbe8b34e.jpg',
      vibrate: [200, 100, 200],
      data: { url: data.url || '/chats.html' }
    })
  );
});

// Клик по уведомлению — открыть приложение
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data.url));
});
