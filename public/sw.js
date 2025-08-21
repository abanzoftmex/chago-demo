// Service Worker vacío para evitar errores 404
// Si no necesitas PWA, este archivo puede permanecer vacío

self.addEventListener('install', function(event) {
  // Instalar inmediatamente
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  // Activar inmediatamente
  event.waitUntil(self.clients.claim());
});