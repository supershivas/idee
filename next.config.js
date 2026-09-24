const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

// Numéro de version : public/version.json est la seule source de vérité
// (conventions du design system). Servi tel quel, il sert aussi de référence
// aux autres apps et outils ; ici on le lit au build.
const { version } = require('./public/version.json')

// Les 5 dernières versions de public/CHANGELOG.md, pour les Réglages.
// Format : « ## 1.4.2 — 2026-09-24 » suivi de lignes « - … ».
function recentChangelog() {
  try {
    const md = fs.readFileSync(path.join(__dirname, 'public/CHANGELOG.md'), 'utf8')
    return md.split(/^## /m).slice(1, 6).map(block => {
      const [title, ...lines] = block.split('\n')
      const [v, date] = title.split('—').map(s => s.trim())
      const changes = lines.filter(l => l.startsWith('- ')).map(l => l.slice(2).trim())
      return { version: v, date: date || '', changes }
    })
  } catch {
    return []
  }
}

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
    NEXT_PUBLIC_APP_VERSION: version,
    NEXT_PUBLIC_APP_CHANGELOG: JSON.stringify(recentChangelog()),
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
