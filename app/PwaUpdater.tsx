'use client'
import { useEffect, useRef } from 'react'

const CHECK_MIN_INTERVAL_MS = 30_000

// Le cache d'exécution du service worker contient le HTML des visites
// précédentes. Après un déploiement, ce HTML référence les chunks d'un build
// révolu : le servir ramènerait l'app dans la version qu'on cherche justement
// à quitter. Les assets hashés (`/_next/static/`), eux, restent valides et
// gardent leur cache.
async function clearRuntimeCache() {
  try {
    if (!('caches' in window)) return
    const keys = await caches.keys()
    await Promise.all(keys.filter(k => k.includes('runtime')).map(k => caches.delete(k)))
  } catch {}
}

// Un chunk chargé à la demande peut manquer à l'appel : réseau qui lâche au
// mauvais moment, ou onglet resté ouvert sur un build dont les assets ne sont
// plus servis. Next remonte alors « Loading chunk N failed » et l'écran reste
// bloqué là.
function isChunkLoadError(err: unknown) {
  const msg = err instanceof Error ? `${err.name} ${err.message}` : String(err ?? '')
  return /ChunkLoadError|Loading chunk \S+ failed|Loading CSS chunk/i.test(msg)
}

// Vérifie qu'une nouvelle version de l'app est en ligne et recharge la page
// automatiquement quand c'est le cas — utile pour la PWA installée, dont le
// WebView reste souvent ouvert en arrière-plan sur une ancienne version au
// lieu de refaire une vraie navigation à chaque réouverture.
export default function PwaUpdater({ currentBuildId }: { currentBuildId: string | null }) {
  const lastCheckRef = useRef(0)
  const reloadingRef = useRef(false)

  // Rattrapage d'un chunk manquant : un rechargement repart du HTML courant et
  // suffit presque toujours. Une seule tentative par build, pour ne pas boucler
  // si le chunk manque vraiment. Volontairement hors de l'effet ci-dessous :
  // il doit fonctionner même sans identifiant de build.
  useEffect(() => {
    async function recover(err: unknown) {
      if (reloadingRef.current || !isChunkLoadError(err)) return
      const key = 'pwa_chunk_reload'
      if (sessionStorage.getItem(key) === (currentBuildId || '1')) return
      sessionStorage.setItem(key, currentBuildId || '1')
      reloadingRef.current = true
      await clearRuntimeCache()
      window.location.reload()
    }
    const onError = (e: ErrorEvent) => { void recover(e.error || e.message) }
    const onRejection = (e: PromiseRejectionEvent) => { void recover(e.reason) }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [currentBuildId])

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
        await clearRuntimeCache()
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
