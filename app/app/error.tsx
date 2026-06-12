'use client'
import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#f0f0ec',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '24px', gap: '12px',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{ fontSize: '32px' }}>⚠️</div>
      <p style={{ fontSize: '16px', fontWeight: 600, color: '#1a1714', margin: 0 }}>
        Une erreur est survenue
      </p>
      <pre style={{
        fontSize: '11px', color: '#6b4f3a',
        background: '#fff', border: '1px solid #e5e7eb',
        borderRadius: '8px', padding: '12px',
        maxWidth: '100%', overflowX: 'auto',
        whiteSpace: 'pre-wrap', wordBreak: 'break-all',
        maxHeight: '40vh', overflowY: 'auto',
        margin: 0,
      }}>
        {error?.message || 'Erreur inconnue'}
        {'\n\n'}
        {error?.stack || ''}
      </pre>
      <button
        onClick={reset}
        style={{
          marginTop: '8px', padding: '10px 24px',
          background: '#6b4f3a', color: '#fdf6ee',
          border: 'none', borderRadius: '10px',
          fontSize: '14px', fontWeight: 600, cursor: 'pointer',
        }}
      >
        Réessayer
      </button>
    </div>
  )
}
