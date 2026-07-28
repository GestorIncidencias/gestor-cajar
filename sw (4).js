const CACHE = 'gestor-cajar-v2';
const ARCHIVOS = ['./', './index.html', './app.js', './manifest.json', './escudo.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

// Network-first para que los datos siempre estén al día; cae a caché si no hay red
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return; // no cachear llamadas POST a la API
  e.respondWith(
    fetch(e.request).then(resp => {
      const clone = resp.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return resp;
    }).catch(() => caches.match(e.request))
  );
});
