import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
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

// Retourne l'offset en px causé par le clavier virtuel iOS/Android
// Utilise visualViewport quand disponible, sinon 0
export function useKeyboardOffset() {
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    function update() {
      // La hauteur du clavier = hauteur de la fenêtre - hauteur du viewport visuel
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
    // Optimistic update
    setPages(prev => prev.map(p => p.id === id ? { ...p, favorite: newVal } : p))
    await createClient().from('pages').update({ favorite: newVal }).eq('id', id)
  }, [pages, setPages])
}
