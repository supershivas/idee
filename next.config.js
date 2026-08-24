const { execSync } = require('child_process')

// Empreinte du build (affichée dans Paramètres > Informations) : SHA court
// du commit et sa date, lus depuis le dépôt git au moment du build — pas de
// numéro de version à maintenir manuellement.
function gitInfo() {
  try {
    return {
      sha: execSync('git rev-parse --short HEAD').toString().trim(),
      date: execSync('git log -1 --format=%cI').toString().trim(),
    }
  } catch {
    return { sha: null, date: null }
  }
}
const { sha, date } = gitInfo()

// Nomenclature CalVer : AAAA.MM.JJ-<sha court>. Le SHA n'est là que pour
// distinguer plusieurs déploiements le même jour (fréquent ici) ; la date
// suffit à elle seule à donner une idée immédiate de la fraîcheur du build.
// Fonctionne même en clone git superficiel (fetch-depth 1) puisqu'on ne lit
// que le commit courant, jamais l'historique.
const version = date ? `${date.slice(0, 10).replace(/-/g, '.')}-${sha}` : 'dev'

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
    NEXT_PUBLIC_APP_UPDATED_AT: date || '',
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
