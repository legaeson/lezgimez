const CACHE_NAME = 'lezgin-pwa-v44'; // Согласованность темных фонов теории и практики
const CRITICAL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './output.css',
  './words.json',
  './grammar.json',
];

const NON_CRITICAL_ASSETS = [
  './icons/icon.svg',
  './fa/all.min.css',
  './fa/webfonts/fa-solid-900.woff2',
  './fa/webfonts/fa-regular-400.woff2',
  './fa/webfonts/fa-brands-400.woff2'
];

const AUDIO_ASSETS = [
  './audio/alphabet/в.wav',
  './audio/alphabet/гъ.wav',
  './audio/alphabet/гь.wav',
  './audio/alphabet/къ.wav',
  './audio/alphabet/кь.wav',
  './audio/alphabet/к1.wav',
  './audio/alphabet/п1.wav',
  './audio/alphabet/т1.wav',
  './audio/alphabet/уь.wav',
  './audio/alphabet/х.wav',
  './audio/alphabet/хъ.wav',
  './audio/alphabet/хь.wav',
  './audio/alphabet/ц1.wav',
  './audio/alphabet/ч1.wav',
  './audio/alphabet/ы.wav'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching core assets');
        
        // Cache non-critical assets one by one so single failures don't block SW installation
        NON_CRITICAL_ASSETS.forEach(asset => {
            cache.add(asset).catch(err => console.warn('[SW] Non-critical asset failed:', asset, err));
        });
        
        // Cache audio assets one by one
        AUDIO_ASSETS.forEach(asset => {
            cache.add(asset).catch(err => console.warn('[SW] Audio asset failed:', asset, err));
        });

        // At least critical assets must load successfully
        return cache.addAll(CRITICAL_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// === PUSH NOTIFICATIONS LOGIC ===

const REMINDER_MESSAGES = [
  "Пора повторить слова!",
  "У вас есть слова для повторения сегодня.",
  "Лезгинский язык ждет вас! Проведите 5 минут в приложении.",
  "Не забывайте тренировать память — загляните в словарь.",
  "Прогресс сам себя не сделает. Пора учиться!"
];

async function getConfig(key) {
  return new Promise((resolve) => {
    const request = indexedDB.open('lezgi_db', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('config');
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('config', 'readonly');
      const get = tx.objectStore('config').get(key);
      get.onsuccess = () => resolve(get.result);
      get.onerror = () => resolve(null);
    };
    request.onerror = () => resolve(null);
  });
}

async function setConfig(key, value) {
  return new Promise((resolve) => {
    const request = indexedDB.open('lezgi_db', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('config');
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('config', 'readwrite');
      tx.objectStore('config').put(value, key);
      tx.oncomplete = () => resolve();
    };
  });
}

async function checkAndNotify() {
  const enabled = await getConfig('notif_enabled');
  if (enabled !== '1') return;

  const now = new Date();
  const hour = now.getHours();
  const today = now.toISOString().split('T')[0];
  const lastDate = await getConfig('last_notif_date');

  // Проверка: время 18:00-21:00 и уведомление еще не отправлялось сегодня
  if (hour >= 18 && hour <= 21 && lastDate !== today) {
    const body = REMINDER_MESSAGES[Math.floor(Math.random() * REMINDER_MESSAGES.length)];
    
    self.registration.showNotification("LezgiMez", {
      body: body,
      icon: "./icons/icon.svg",
      badge: "./icons/icon.svg",
      tag: "daily-reminder",
      data: { url: "./index.html#vocabulary" }
    });

    await setConfig('last_notif_date', today);
  }
}

// Использование Periodic Background Sync
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'daily-reminder') {
    event.waitUntil(checkAndNotify());
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = new URL(event.notification.data.url, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if (client.url === urlToOpen && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(urlToOpen);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin requests — no CDN proxy
  if (url.origin !== location.origin) return;

  // Audio files должны обновляться сразу, чтобы новые записи не заменялись старым кэшем
  if (url.pathname.endsWith('.wav')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then((response) => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(event.request);
          if (cachedResponse) return cachedResponse;
          throw new Error(`[SW] Audio request failed: ${event.request.url}`);
        })
    );
    return;
  }

  // Network-first for navigate + data that changes
  if (
    event.request.mode === 'navigate' ||
    url.pathname.endsWith('/index.html') ||
    url.pathname.endsWith('/words.json') ||
    url.pathname.endsWith('/grammar.json')
  ) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          if (url.pathname.endsWith('/words.json')) return caches.match('./words.json');
          if (url.pathname.endsWith('/grammar.json')) return caches.match('./grammar.json');
          return caches.match('./index.html');
        })
    );
    return;
  }

  // All other local assets (CSS, fonts, icons, JS) use network-first strategy
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      })
  );
});
