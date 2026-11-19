// Service Worker untuk Notifikasi Tablet & Latar Belakang Ayam Dubrak
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Tangani klik pada notifikasi tablet -> fokus atau buka kembali halaman kasir
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/kasir';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Jika tab kasir sudah ada di background, bawa ke depan
      for (const client of windowClients) {
        if (client.url.includes('/kasir') && 'focus' in client) {
          return client.focus();
        }
      }
      // Jika belum ada, buka jendela baru
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Tangani pesan dari halaman kasir (saat tab di background mengirim pesan ke SW)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    self.registration.showNotification(title, {
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      vibrate: [300, 100, 300, 100, 400],
      requireInteraction: true,
      tag: options.tag || 'dubrak-order',
      renotify: true,
      ...options,
    });
  }
});
