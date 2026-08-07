const CACHE = "epaper-admin-v9";
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
  if (url.origin !== self.location.origin || !url.pathname.startsWith("/admin")) {
    return;
  }

  // Never cache the service worker itself
  if (url.pathname.endsWith("/sw.js")) {
    event.respondWith(fetch(event.request));
    return;
  }

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
  // Must always show a notification, or browsers may drop the subscription.
  const fallback = {
    title: "새 문의 접수",
    body: "문의가 접수되었습니다.",
    url: "/admin/",
  };

  const show = async () => {
    let data = { ...fallback };
    try {
      if (event.data) {
        const parsed = event.data.json();
        data = { ...fallback, ...parsed };
      }
    } catch (_) {
      try {
        const text = event.data && event.data.text();
        if (text) data.body = text;
      } catch (_) {
        // keep fallback
      }
    }

    await self.registration.showNotification(data.title || fallback.title, {
      body: data.body || fallback.body,
      icon: "/admin/icons/icon-192.png",
      badge: "/admin/icons/icon-192.png",
      tag: "epaper-inquiry",
      renotify: true,
      requireInteraction: true,
      vibrate: [120, 60, 120],
      data: { url: data.url || "/admin/" },
    });
  };

  event.waitUntil(show());
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

self.addEventListener("pushsubscriptionchange", (event) => {
  // Browser rotated the subscription; ask pages to re-sync.
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      clients.forEach((client) => client.postMessage({ type: "pushsubscriptionchange" }));
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
      requireInteraction: true,
      data: { url: "/admin/" },
    })
  );
});
