// Service worker de Valyo : uniquement les notifications push. Aucune mise en cache :
// le site reste toujours servi par le réseau, jamais par une copie périmée.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* charge illisible : notification générique */ }
  event.waitUntil(
    self.registration.showNotification(data.title || "Valyo", {
      body: data.body || "",
      tag: data.tag,
      icon: "/icone-192.png",
      badge: "/icone-192.png",
      data: { url: data.url || "/notifications" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      // Une fenêtre Valyo déjà ouverte est réutilisée plutôt que d'en ouvrir une de plus.
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) return open.navigate(target).then((w) => (w || open).focus()).catch(() => self.clients.openWindow(target));
      return self.clients.openWindow(target);
    }),
  );
});
