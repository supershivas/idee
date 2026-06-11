'use client'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

type ToastType = 'success' | 'error' | 'info'
type ToastItem = { id: number; message: string; type: ToastType }

let _id = 0

export function toast(message: string, type: ToastType = 'info') {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('idee:toast', { detail: { message, type, id: ++_id } }))
  }
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([])

  useEffect(() => {
    const handler = (e: Event) => {
      const { message, type, id } = (e as CustomEvent<ToastItem>).detail
      setItems(prev => [...prev.slice(-4), { id, message, type }])
      setTimeout(() => setItems(prev => prev.filter(t => t.id !== id)), 3500)
    }
    window.addEventListener('idee:toast', handler)
    return () => window.removeEventListener('idee:toast', handler)
  }, [])

  if (!items.length) return null

  const icons = { success: '✓', error: '✕', info: 'ℹ' }
  const colors = {
    success: { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
    error:   { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
    info:    { bg: 'var(--card-bg)', text: 'var(--text-primary)', border: 'var(--border)' },
  }

  return createPortal(
    <>
      <style>{`@keyframes _toast_in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div className="fixed bottom-5 right-4 z-[300] flex flex-col gap-2 pointer-events-none">
        {items.map(item => {
          const c = colors[item.type]
          return (
            <div key={item.id}
              className="flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium pointer-events-auto"
              style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}`, maxWidth: '320px', animation: '_toast_in 180ms ease' }}>
              <span className="flex-shrink-0">{icons[item.type]}</span>
              <span>{item.message}</span>
            </div>
          )
        })}
      </div>
    </>,
    document.body
  )
}
