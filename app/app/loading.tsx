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
      <span
        style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: '22px',
          fontWeight: 700,
          color: '#1a1714',
          letterSpacing: '-0.01em',
        }}
      >
        Idée
      </span>
      <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
        {[0, 1, 2].map(i => (
          <div
            key={i}
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: '#6b4f3a',
              animation: 'bounce 1.2s ease-in-out infinite',
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&display=swap');
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40%            { transform: scale(1);   opacity: 1;   }
        }
      `}</style>
    </div>
  )
}
