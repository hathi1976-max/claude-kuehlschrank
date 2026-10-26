/* Frischfach Service Worker

   Eigene Dateien: Netz zuerst, damit Updates sofort ankommen; der Cache ist
   der Offline-Rückfall. Das Claude-SDK vom CDN: Cache zuerst, die Version
   steckt fest in der URL. Anfragen an api.anthropic.com laufen nie über den
   Cache (POST, wird ohnehin übergangen). */

const VERSION = 'v1';
const CACHE = 'frischfach-' + VERSION;
const VENDOR = 'frischfach-vendor';

const SHELL = [
  './',
  './index.html',
  './style.css',
  './js/app.js',
  './js/haltbarkeit.js',
  './js/speicher.js',
  './js/erkennung.js',
  './manifest.webmanifest',
  './icon.svg',
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    await (await caches.open(CACHE)).addAll(SHELL);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE && k !== VENDOR).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.hostname === 'cdn.jsdelivr.net'){ e.respondWith(vendor(e.request)); return; }
  if (url.origin === self.location.origin) e.respondWith(eigenes(e.request));
});

async function eigenes(request){
  try {
    const resp = await fetch(request);
    if (resp.ok){
      const kopie = resp.clone();
      caches.open(CACHE).then(c => c.put(request, kopie)).catch(() => {});
    }
    return resp;
  } catch {
    return (await caches.match(request)) || (await caches.match('./index.html'));
  }
}

async function vendor(request){
  const c = await caches.open(VENDOR);
  const hit = await c.match(request);
  if (hit) return hit;
  const resp = await fetch(request);
  if (resp.ok) c.put(request, resp.clone()).catch(() => {});
  return resp;
}
