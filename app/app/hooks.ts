import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from './components/Toast'
import type { Page } from './types'

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
