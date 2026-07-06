import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from './components/Toast'
import type { Page, SaveState } from './types'

// ── Synchronisation temps réel de `pages` (multi-onglets / multi-appareils) ──
// S'abonne aux changements Postgres de la table `pages` pour l'utilisateur et
// délègue à des handlers stockés dans une ref (abonnement unique, pas de
// réabonnement à chaque render). Le filtrage DELETE se fait côté client :
// la ligne `old` d'un DELETE ne contient que la clé primaire (pas user_id),
// donc on ne peut pas filtrer sur user_id côté serveur — on ne retire que
// les pages déjà présentes dans l'état local (donc déjà autorisées).
export function useRealtimePages(userId: string, handlers: {
  onUpsert: (row: Page) => void
  onDelete: (id: string) => void
}) {
  const ref = useRef(handlers)
  useEffect(() => { ref.current = handlers })

  useEffect(() => {
    const client = createClient()
    const channel = client
      .channel(`pages-sync:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pages', filter: `user_id=eq.${userId}` },
        payload => ref.current.onUpsert(payload.new as Page))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pages', filter: `user_id=eq.${userId}` },
        payload => ref.current.onUpsert(payload.new as Page))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'pages' },
        payload => { const id = (payload.old as { id?: string })?.id; if (id) ref.current.onDelete(id) })
      .subscribe()
    return () => { client.removeChannel(channel) }
  }, [userId])
}

// ── Sauvegarde différée (contenu + titre) ───────────────────────────────────
// L'état local est mis à jour à chaque frappe par l'appelant, mais l'écriture
// Supabase est bufferisée par page et débouncée : une rafale de frappes ne
// produit qu'un seul UPDATE. Les flushs sont sérialisés (promesse chaînée)
// pour garantir l'ordre des écritures, et les entrées en échec sont remises
// en file puis retentées automatiquement. Flush immédiat quand l'onglet passe
// en arrière-plan ; à la fermeture avec des modifications en attente, flush +
// confirmation native du navigateur.
const SAVE_DEBOUNCE_MS = 500
const SAVE_RETRY_MS = 5000

export function usePageSaver(userId: string, pages: Page[]) {
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const pendingSavesRef = useRef<Map<string, { content?: string; title?: string }>>(new Map())
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveChainRef = useRef<Promise<void>>(Promise.resolve())
  const lastHistoryAtRef = useRef<Map<string, number>>(new Map())
  const pagesRef = useRef(pages)
  useEffect(() => { pagesRef.current = pages }, [pages])

  const flushSaves = useCallback((): Promise<void> => {
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null }
    if (pendingSavesRef.current.size === 0) return saveChainRef.current
    const entries = Array.from(pendingSavesRef.current.entries())
    pendingSavesRef.current.clear()
    setSaveState('saving')
    saveChainRef.current = saveChainRef.current.then(async () => {
      let hadError = false
      for (const [pageId, patch] of entries) {
        try {
          const updated_at = new Date().toISOString()
          const { error } = await createClient().from('pages').update({ ...patch, updated_at }).eq('id', pageId)
          if (error) throw error
          // Snapshot d'historique au plus toutes les 2 minutes, par page
          if (patch.content !== undefined) {
            const now = Date.now()
            if (now - (lastHistoryAtRef.current.get(pageId) || 0) > 2 * 60 * 1000) {
              lastHistoryAtRef.current.set(pageId, now)
              const page = pagesRef.current.find(p => p.id === pageId)
              await createClient().from('page_history').insert({
                page_id: pageId, user_id: userId,
                title: patch.title ?? page?.title ?? '', content: patch.content,
              })
            }
          }
        } catch {
          hadError = true
          // Remet en file, sans écraser des modifications plus récentes
          const newer = pendingSavesRef.current.get(pageId) || {}
          pendingSavesRef.current.set(pageId, { ...patch, ...newer })
        }
      }
      if (hadError) {
        setSaveState('error')
        toast('Erreur de sauvegarde — nouvel essai dans quelques secondes.', 'error')
        if (!saveTimerRef.current) {
          saveTimerRef.current = setTimeout(() => { saveTimerRef.current = null; void flushSaves() }, SAVE_RETRY_MS)
        }
      } else {
        setSaveState(pendingSavesRef.current.size > 0 ? 'pending' : 'saved')
      }
    })
    return saveChainRef.current
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const queueSave = useCallback((pageId: string, patch: { content?: string; title?: string }) => {
    pendingSavesRef.current.set(pageId, { ...(pendingSavesRef.current.get(pageId) || {}), ...patch })
    setSaveState('pending')
    // Onglet en arrière-plan : les timers sont throttlés, on écrit tout de suite
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') { void flushSaves(); return }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => { saveTimerRef.current = null; void flushSaves() }, SAVE_DEBOUNCE_MS)
  }, [flushSaves])

  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') void flushSaves()
    }
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (pendingSavesRef.current.size > 0) {
        void flushSaves()
        e.preventDefault()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [flushSaves])

  return { saveState, queueSave, flushSaves }
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return isMobile
}

export function useKeyboardOffset() {
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    function update() {
      const keyboardHeight = window.innerHeight - vv!.height - vv!.offsetTop
      setOffset(Math.max(0, keyboardHeight))
    }

    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  return offset
}

export function useToggleFavorite(
  pages: Page[],
  setPages: React.Dispatch<React.SetStateAction<Page[]>>
) {
  return useCallback(async (id: string) => {
    const page = pages.find(p => p.id === id)
    if (!page) return
    const newVal = !page.favorite
    const newPos = newVal
      ? Math.max(0, ...pages.filter(p => p.favorite && p.id !== id).map(p => p.favorite_position ?? 0)) + 1
      : null
    setPages(prev => prev.map(p => p.id === id ? { ...p, favorite: newVal, favorite_position: newPos } : p))
    const { error } = await createClient().from('pages').update({ favorite: newVal, favorite_position: newPos }).eq('id', id)
    if (error) toast('Erreur de sauvegarde du favori — vérifiez votre connexion.', 'error')
  }, [pages, setPages])
}

export function useReorderFavorites(
  setPages: React.Dispatch<React.SetStateAction<Page[]>>
) {
  return useCallback(async (orderedIds: string[]) => {
    setPages(prev => prev.map(p => {
      const idx = orderedIds.indexOf(p.id)
      if (idx === -1) return p
      return { ...p, favorite_position: idx }
    }))
    const results = await Promise.all(
      orderedIds.map((id, idx) =>
        createClient().from('pages').update({ favorite_position: idx }).eq('id', id)
      )
    )
    if (results.some(r => r.error)) toast('Erreur lors du réordonnancement des favoris.', 'error')
  }, [setPages])
}
