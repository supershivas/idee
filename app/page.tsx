import Link from 'next/link'

export default function Home() {
  return (
    <main style={{ background: '#1C1C1E', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '32px' }}>
      <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '48px', fontWeight: 700, color: 'rgba(255,255,255,0.92)', letterSpacing: '-0.02em', margin: 0 }}>
        Idée
      </h1>
      <Link
        href="/login"
        style={{
          background: '#C0392B',
          color: '#fff',
          borderRadius: '10px',
          padding: '11px 28px',
          fontSize: '14px',
          fontWeight: 600,
          textDecoration: 'none',
        }}
      >
        Se connecter
      </Link>
    </main>
  )
}
