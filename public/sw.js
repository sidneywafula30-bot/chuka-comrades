/* Chuka Comrades service worker: offline app shell.
   Only same-origin files are cached. API calls (Supabase, Firebase, etc.) always go to the network. */
const VERSION = 'v5'
const CACHE = `comrades-${VERSION}`
const SCOPE = self.registration.scope



self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all([SCOPE, SCOPE + 'manifest.webmanifest', SCOPE + 'icon-192.png', SCOPE + 'icon-512.png'].map((u) => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting()),
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

  // Manifest and app icons: always try the network first so updates show up.
  if (/manifest\.webmanifest$|\/(icon|apple-touch-icon)[^/]*\.png$/.test(url.pathname)) {
    e.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res }).catch(() => caches.match(req)))
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

// Start (or continue) a scan job when the browser lets the service worker run in the background.
self.addEventListener('sync', (e) => {
  if (e.tag === 'comrades-scan' && self.__scanRunner) e.waitUntil(self.__scanRunner.resumeAll())
})

// Fallback for browsers without Background Sync: the page asks the worker to run the job.
self.addEventListener('message', (e) => {
  const d = e.data || {}
  if (d.type !== 'scan-run' || !self.__scanRunner) return
  if (e.ports && e.ports[0]) e.ports[0].postMessage('ok')
  e.waitUntil(self.__scanRunner.run(d.id))
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = (e.notification.data && e.notification.data.url) || SCOPE
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ('focus' in c) { c.navigate?.(url).catch(() => {}); return c.focus() } }
      return self.clients.openWindow(url)
    }),
  )
})
