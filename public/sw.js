// Service worker minimal pour un mode hors-ligne en lecture seule.
//
// Portée volontairement restreinte : on ne fait QUE mettre en cache les
// réponses déjà vues en ligne pour pouvoir les rejouer hors-ligne. Aucune
// écriture différée, aucune synchronisation — l'édition hors-ligne n'est
// pas gérée (prévue dans une itération future).
//
// Bumper les suffixes de version ci-dessous invalide proprement les anciens
// caches (voir le handler 'activate').
const STATIC_CACHE = 'idee-static-v1'
const RUNTIME_CACHE = 'idee-runtime-v1'
const CURRENT_CACHES = [STATIC_CACHE, RUNTIME_CACHE]

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => !CURRENT_CACHES.includes(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

function isApiRoute(url) {
  return url.origin === self.location.origin && url.pathname.startsWith('/api/')
}

function isStaticAsset(url) {
  return url.origin === self.location.origin && url.pathname.startsWith('/_next/static/')
}

function isSupabaseRequest(url) {
  return /\.supabase\.co$/.test(url.hostname)
}

function isFontOrIconCdn(url) {
  return url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com' || url.hostname === 'cdn.jsdelivr.net'
}

// Immuable (assets hashés, fonts/icônes CDN versionnées) : on sert direct
// depuis le cache si présent, sinon on va chercher et on met en réserve.
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response && response.ok) cache.put(request, response.clone())
  return response
}

// Contenu vivant (pages, données Supabase) : toujours essayer le réseau
// d'abord pour rester à jour ; ne retomber sur le cache qu'hors-ligne.
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  try {
    const response = await fetch(request)
    if (response && response.ok) cache.put(request, response.clone())
    return response
  } catch (err) {
    const cached = await cache.match(request)
    if (cached) return cached
    throw err
  }
}

self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET') return

  let url
  try { url = new URL(request.url) } catch { return }
  if (!url.protocol.startsWith('http')) return

  // Jamais intercepté : routes API internes (dont /api/build-id, qui doit
  // toujours refléter le déploiement réellement en ligne pour PwaUpdater).
  if (isApiRoute(url)) return

  if (isStaticAsset(url) || isFontOrIconCdn(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  if (request.mode === 'navigate' || url.origin === self.location.origin || isSupabaseRequest(url)) {
    event.respondWith(networkFirst(request, RUNTIME_CACHE))
    return
  }

  // Tout le reste (Unsplash à la demande, etc.) : comportement par défaut.
})
