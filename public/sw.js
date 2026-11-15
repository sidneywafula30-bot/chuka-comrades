/* Chuka Comrades service worker: offline app shell.
   Only same-origin files are cached. API calls (Supabase, Firebase, etc.) always go to the network. */
const VERSION = 'v1'
const CACHE = `comrades-${VERSION}`
const SCOPE = self.registration.scope

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll([SCOPE, SCOPE + 'index.html', SCOPE + 'manifest.webmanifest', SCOPE + 'chukalogo-192.png', SCOPE + 'chukalogo-512.png'])).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // never touch API / third-party calls

  // Pages: network first, fall back to the cached shell when offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(SCOPE, copy)); return res })
        .catch(() => caches.match(SCOPE).then((r) => r || caches.match(SCOPE + 'index.html'))),
    )
    return
  }

  // Static files (JS, CSS, images): serve from cache, refresh in the background.
  e.respondWith(
    caches.match(req).then((cached) => {
      const fresh = fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)) }
        return res
      }).catch(() => cached)
      return cached || fresh
    }),
  )
})
