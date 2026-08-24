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

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: sha || 'dev',
    NEXT_PUBLIC_APP_UPDATED_AT: date || '',
  },
}
module.exports = nextConfig
