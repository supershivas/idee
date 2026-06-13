'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        background: '#f0f0ec',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <img
        src="/apple-touch-icon.png"
        alt="Idée"
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '18px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
        }}
      />
      <p
        style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: '22px',
          fontWeight: 700,
          color: '#1a1714',
          letterSpacing: '-0.01em',
          margin: 0,
        }}
      >
        Idée
      </p>
      <p style={{ color: '#6b4f3a', fontSize: '14px', margin: 0 }}>
        Une erreur est survenue.
      </p>
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
