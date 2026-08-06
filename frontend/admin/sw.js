const CACHE = "epaper-admin-v1";
const ASSETS = [
  "/admin/",
  "/admin/index.html",
  "/admin/css/admin.css",
  "/admin/js/config.js",
  "/admin/js/app.js",
  "/admin/manifest.webmanifest",
  "/admin/icons/icon-192.png",
  "/admin/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "notify") return;
  const { title, body } = event.data;
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/admin/icons/icon-192.png",
      badge: "/admin/icons/icon-192.png",
      tag: "epaper-inquiry",
      renotify: true,
    })
  );
});
