/* Iotvex PWA service worker v15 — assets only; never intercept navigations */
const CACHE = "iotvex-shell-v15"
const SHELL = ["/manifest.webmanifest", "/icon-192.png", "/icon-512.png"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      // Activate promptly; page must NOT reload on controllerchange (Safari loop).
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener("message", (event) => {
  // Kept for optional future "Update" UI — do not pair with auto page reload.
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting()
  }
})

self.addEventListener("fetch", (event) => {
  const req = event.request
  if (req.method !== "GET") return

  let url
  try {
    url = new URL(req.url)
  } catch {
    return
  }
  if (url.origin !== self.location.origin) return

  // Navigations / documents: never intercept.
  // HTML is not cached; a network-fail offline stub was falsely shown in Safari
  // tabs when fetch() failed (self-signed TLS / WebKit quirks) while the PWA
  // bookmark still loaded. Let the browser handle documents natively.
  if (req.mode === "navigate" || req.destination === "document") {
    return
  }

  // API / auth / SW itself — never intercept
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/supabase") ||
    url.pathname.startsWith("/auth") ||
    url.pathname === "/sw.js" ||
    url.pathname.startsWith("/login")
  ) {
    return
  }

  // Next bundles + manifest: network-first (no write-through cache)
  if (url.pathname.startsWith("/_next/static/") || url.pathname.endsWith(".webmanifest")) {
    event.respondWith(fetch(req).catch(() => caches.match(req)))
    return
  }

  // Images / icons: cache-first
  if (
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".ico")
  ) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {})
            return res
          }),
      ),
    )
  }
})
