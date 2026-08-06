const CACHE = "epaper-admin-v5";
const ASSETS = [
  "/admin/",
  "/admin/index.html",
  "/admin/css/admin.css",
  "/admin/manifest.webmanifest",
  "/admin/icons/icon-192.png",
  "/admin/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  // Always network-first for JS so notification logic stays fresh
  if (url.pathname.startsWith("/admin/js/")) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

self.addEventListener("push", (event) => {
  let data = { title: "새 문의 접수", body: "문의가 접수되었습니다.", url: "/admin/" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (_) {
    // ignore
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "새 문의 접수", {
      body: data.body || "",
      icon: "/admin/icons/icon-192.png",
      badge: "/admin/icons/icon-192.png",
      tag: "epaper-inquiry",
      renotify: true,
      data: { url: data.url || "/admin/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/admin/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
      return undefined;
    })
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
      data: { url: "/admin/" },
    })
  );
});
