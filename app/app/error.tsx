'use client'
import { useState } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [copied, setCopied] = useState(false)
  const errorText = `${error?.message || 'Erreur inconnue'}\n\n${error?.stack || ''}`

  function copy() {
    navigator.clipboard.writeText(errorText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        background: '#f0f0ec',
        fontFamily: 'system-ui, sans-serif',
        padding: '24px',
      }}
    >
      <img
        src="/apple-touch-icon.png"
        alt="Idée"
        style={{ width: '48px', height: '48px', borderRadius: '14px' }}
      />
      <p style={{ fontWeight: 700, fontSize: '16px', color: '#1a1714', margin: 0 }}>
        Erreur
      </p>
      <div style={{ position: 'relative', maxWidth: '320px', width: '100%' }}>
        <p style={{
          color: '#6b4f3a',
          fontSize: '13px',
          margin: 0,
          textAlign: 'center',
          wordBreak: 'break-word',
          background: '#fff',
          padding: '10px 14px',
          borderRadius: '8px',
          border: '1px solid #e0d8d0',
        }}>
          {error?.message || 'Erreur inconnue'}
        </p>
        {error?.stack && (
          <pre style={{
            fontSize: '10px',
            color: '#999',
            overflow: 'auto',
            maxHeight: '120px',
            background: '#fff',
            padding: '8px',
            borderRadius: '6px',
            border: '1px solid #e0d8d0',
            marginTop: '6px',
          }}>
            {error.stack}
          </pre>
        )}
        <button
          onClick={copy}
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            padding: '3px 8px',
            borderRadius: '6px',
            background: copied ? '#4a7c59' : '#e0d8d0',
            color: copied ? '#fff' : '#6b4f3a',
            fontSize: '11px',
            fontWeight: 500,
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          {copied ? '✓ Copié' : 'Copier'}
        </button>
      </div>
      <button
        onClick={reset}
        style={{
          marginTop: '4px',
          padding: '8px 20px',
          borderRadius: '10px',
          background: '#6b4f3a',
          color: '#fff',
          fontSize: '14px',
          fontWeight: 500,
          border: 'none',
          cursor: 'pointer',
        }}
      >
        Réessayer
      </button>
    </div>
  )
}
