import { useState, useEffect, useRef } from 'react'

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
