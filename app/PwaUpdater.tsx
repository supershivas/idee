'use client'
import { useEffect, useRef } from 'react'

const CHECK_MIN_INTERVAL_MS = 30_000

// Vérifie qu'une nouvelle version de l'app est en ligne et recharge la page
// automatiquement quand c'est le cas — utile pour la PWA installée, dont le
// WebView reste souvent ouvert en arrière-plan sur une ancienne version au
// lieu de refaire une vraie navigation à chaque réouverture.
export default function PwaUpdater({ currentBuildId }: { currentBuildId: string | null }) {
  const lastCheckRef = useRef(0)
  const reloadingRef = useRef(false)

  useEffect(() => {
    if (!currentBuildId) return

    async function checkForUpdate() {
      if (reloadingRef.current) return
      const now = Date.now()
      if (now - lastCheckRef.current < CHECK_MIN_INTERVAL_MS) return
      lastCheckRef.current = now
      try {
        const res = await fetch('/api/build-id', { cache: 'no-store' })
        if (!res.ok) return
        const { buildId } = await res.json()
        if (!buildId || buildId === currentBuildId) return
        // Ne tente qu'une seule fois par version détectée : si le rechargement
        // ne suffit pas à récupérer la nouvelle version (HTML mis en cache en
        // amont), on évite une boucle de reload toutes les 30 s.
        const key = 'pwa_reload_attempted'
        if (sessionStorage.getItem(key) === buildId) return
        sessionStorage.setItem(key, buildId)
        reloadingRef.current = true
        window.location.reload()
      } catch {}
    }

    void checkForUpdate()

    function onVisible() {
      if (document.visibilityState === 'visible') void checkForUpdate()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    window.addEventListener('pageshow', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      window.removeEventListener('pageshow', onVisible)
    }
  }, [currentBuildId])

  return null
}
