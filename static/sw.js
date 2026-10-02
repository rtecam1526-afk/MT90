// Service worker mínimo — solo existe para que el navegador considere el CRM
// "instalable" como app. A propósito NO cachea nada: el sistema se actualiza
// seguido (deploys casi diarios) y cachear respuestas viejas terminaría
// mostrándole a un agente una versión vieja del CRM sin que nadie lo note.
// Si en el futuro se agregan notificaciones push, la lógica va acá.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
