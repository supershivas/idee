'use client'
import { useEffect } from 'react'

// Enregistre le service worker (public/sw.js) qui permet de relire les notes
// déjà consultées en ligne quand l'appareil est hors-ligne (lecture seule —
// pas de synchronisation d'édition hors-ligne pour l'instant).
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])

  return null
}
