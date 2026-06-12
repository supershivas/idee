export default function Loading() {
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
      <div style={{ display: 'flex', gap: '6px' }}>
        <span style={{
          display: 'inline-block', width: '7px', height: '7px',
          borderRadius: '50%', background: '#6b4f3a',
          animation: 'idee-bounce 1.2s ease-in-out 0s infinite',
        }} />
        <span style={{
          display: 'inline-block', width: '7px', height: '7px',
          borderRadius: '50%', background: '#6b4f3a',
          animation: 'idee-bounce 1.2s ease-in-out 0.2s infinite',
        }} />
        <span style={{
          display: 'inline-block', width: '7px', height: '7px',
          borderRadius: '50%', background: '#6b4f3a',
          animation: 'idee-bounce 1.2s ease-in-out 0.4s infinite',
        }} />
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes idee-bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}} />
    </div>
  )
}
