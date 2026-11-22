const scope = self.registration.scope;
const revision = new URL(self.location.href).searchParams.get('v');
const prefix = `flappyfy:${scope}:`;
const cacheName = `${prefix}${revision}`;
const entry = new URL('./index.html', scope).href;
const assets = [entry, ...['app.js', 'app.css', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png']
  .map(path => new URL(path, scope).href)];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(
    assets.map(url => new Request(url, { cache: 'reload' })),
  )));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith(prefix) && key !== cacheName)
    .map(key => caches.delete(key)))));
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (request.mode === 'navigate' && (request.url.split(/[?#]/, 1)[0] === scope || request.url.split(/[?#]/, 1)[0] === entry)) {
    event.respondWith(fetch(request).catch(async () => (await caches.open(cacheName)).match(entry)));
  } else if (assets.includes(request.url)) {
    event.respondWith(fetch(request).catch(async () => (await caches.open(cacheName)).match(request)));
  }
});
