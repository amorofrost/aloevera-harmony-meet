// Service worker for Web Push notifications.
// Registered via navigator.serviceWorker.register('/sw.js') in src/lib/webPush.ts.
// Vite serves /public assets at the root path; build copies sw.js to /dist/sw.js.

self.addEventListener('install', () => {
  // Activate immediately for new versions
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Take control of clients without requiring page reload
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'AloeVera Harmony Meet', body: 'You have a new notification' };
  }

  const title = data.title || 'AloeVera Harmony Meet';
  const options = {
    body: data.body || '',
    icon: data.icon || '/icon-192.png',
    badge: '/badge.png',
    data: { url: data.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open at this URL, focus it
      for (const client of clientList) {
        try {
          const clientUrl = new URL(client.url);
          const targetParsed = new URL(targetUrl, self.location.origin);
          if (clientUrl.pathname === targetParsed.pathname && 'focus' in client) {
            return client.focus();
          }
        } catch {
          // ignore URL parse errors
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
