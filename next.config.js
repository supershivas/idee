const { execSync } = require('child_process')
const { version } = require('./package.json')

// Date du dernier déploiement (affichée dans Paramètres > Informations),
// lue depuis le commit courant au moment du build — fonctionne même en
// clone git superficiel (fetch-depth 1, utilisé par la CI) puisqu'on ne lit
// que les métadonnées du commit courant, jamais l'historique.
function buildDate() {
  try {
    return execSync('git log -1 --format=%cI').toString().trim()
  } catch {
    return ''
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    // Numéro de version (major.minor.patch) : maintenu à la main dans
    // package.json — bump patch pour un correctif, minor pour une
    // nouvelle fonctionnalité, major pour un changement notable.
    NEXT_PUBLIC_APP_VERSION: version,
    NEXT_PUBLIC_APP_UPDATED_AT: buildDate(),
  },
  async headers() {
    return [
      {
        // Le navigateur re-vérifie déjà sw.js au moins toutes les 24h, mais
        // on force une revalidation à chaque visite pour que les mises à
        // jour du service worker se propagent aussi vite que celles de l'app.
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
      },
    ]
  },
}
module.exports = nextConfig
