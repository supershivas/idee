'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)

  const router = useRouter()

  async function handleLogin() {
    setLoading(true)
    setError('')
    setInfo('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Email ou mot de passe incorrect')
      setLoading(false)
    } else {
      router.push('/app')
      router.refresh()
    }
  }

  async function handleSignup() {
    setLoading(true)
    setError('')
    setInfo('')
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({ email, password })

    if (error) {
      setError(error.message)
    } else {
      setInfo('Vérifie tes emails pour confirmer ton compte !')
    }
    setLoading(false)
  }

  const inputClass =
    'border rounded-lg px-4 py-2 outline-none text-sm t-border bg-transparent focus:ring-2'
  const inputStyle = { '--tw-ring-color': 'var(--accent)' } as React.CSSProperties

  const primaryBtnClass = 'rounded-lg px-6 py-2 text-sm font-medium disabled:opacity-50'
  const primaryBtnStyle = { background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)' }

  const secondaryBtnClass = 'rounded-lg border t-border px-6 py-2 text-sm hover:opacity-80 disabled:opacity-50'

  return (
    <main className="t-bg-app flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold t-text" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>Idée</h1>
      <div className="t-bg-card rounded-xl p-6 flex flex-col gap-3 w-80" style={{ boxShadow: 'var(--card-shadow)' }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
          className={inputClass}
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
          className={inputClass}
          style={inputStyle}
        />
        {error && <p className="text-sm" style={{ color: 'var(--s-sent-fg)' }}>{error}</p>}
        {info && <p className="text-sm" style={{ color: 'var(--s-done-fg)' }}>{info}</p>}
        <button onClick={handleLogin} disabled={loading} className={primaryBtnClass} style={primaryBtnStyle}>
          {loading ? 'Connexion…' : 'Se connecter'}
        </button>
        <button onClick={handleSignup} disabled={loading} className={secondaryBtnClass}>
          Créer un compte
        </button>
      </div>
    </main>
  )
}
