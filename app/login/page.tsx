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
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login')
  const router = useRouter()

  async function handleLogin() {
    if (!email || !password) return
    setLoading(true); setError(''); setInfo('')
    const { error } = await createClient().auth.signInWithPassword({ email, password })
    if (error) { setError('Email ou mot de passe incorrect'); setLoading(false) }
    else { router.push('/app'); router.refresh() }
  }

  async function handleSignup() {
    if (!email || !password) return
    setLoading(true); setError(''); setInfo('')
    const { error } = await createClient().auth.signUp({ email, password })
    if (error) { setError(error.message); setLoading(false) }
    else { setInfo('Vérifie tes emails pour confirmer ton compte !'); setLoading(false) }
  }

  async function handleReset() {
    if (!email) { setError('Entre ton adresse email.'); return }
    setLoading(true); setError(''); setInfo('')
    const { error } = await createClient().auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` })
    if (error) { setError(error.message); setLoading(false) }
    else { setInfo('Lien de réinitialisation envoyé — vérifie tes emails.'); setLoading(false) }
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key !== 'Enter') return
    if (mode === 'login') handleLogin()
    else if (mode === 'signup') handleSignup()
    else handleReset()
  }

  return (
    <main style={{ background: '#1C1C1E', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '32px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '38px', fontWeight: 700, color: 'rgba(255,255,255,0.92)', letterSpacing: '-0.02em', lineHeight: 1 }}>
            Idée
          </h1>
          <p style={{ marginTop: '8px', fontSize: '13px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.01em' }}>
            {mode === 'login' ? 'Bienvenue' : mode === 'signup' ? 'Créer un compte' : 'Réinitialiser le mot de passe'}
          </p>
        </div>

        {/* Form card */}
        <div style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={onKey}
            autoFocus
            style={{
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '10px',
              padding: '11px 14px',
              fontSize: '14px',
              color: 'rgba(255,255,255,0.88)',
              outline: 'none',
              width: '100%',
              boxSizing: 'border-box',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = 'rgba(192,57,43,0.7)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')}
          />
          {mode !== 'reset' && (
            <input
              type="password"
              placeholder="Mot de passe"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={onKey}
              style={{
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '10px',
                padding: '11px 14px',
                fontSize: '14px',
                color: 'rgba(255,255,255,0.88)',
                outline: 'none',
                width: '100%',
                boxSizing: 'border-box',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = 'rgba(192,57,43,0.7)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')}
            />
          )}

          {error && <p style={{ fontSize: '13px', color: '#E8887E', margin: 0 }}>{error}</p>}
          {info  && <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', margin: 0 }}>{info}</p>}

          <button
            onClick={mode === 'login' ? handleLogin : mode === 'signup' ? handleSignup : handleReset}
            disabled={loading}
            style={{
              background: '#C0392B',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              padding: '11px 14px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
              transition: 'opacity 0.15s, background 0.15s',
              width: '100%',
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#a93226' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#C0392B' }}
          >
            {loading ? '…' : mode === 'login' ? 'Se connecter' : mode === 'signup' ? 'Créer le compte' : 'Envoyer le lien'}
          </button>
        </div>

        {/* Mode switchers */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          {mode !== 'login' && (
            <button onClick={() => { setMode('login'); setError(''); setInfo('') }}
              style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', background: 'none', border: 'none', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.75)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}>
              ← Retour à la connexion
            </button>
          )}
          {mode === 'login' && (
            <>
              <button onClick={() => { setMode('signup'); setError(''); setInfo('') }}
                style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', background: 'none', border: 'none', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.75)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}>
                Créer un compte
              </button>
              <button onClick={() => { setMode('reset'); setError(''); setInfo('') }}
                style={{ fontSize: '13px', color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}>
                Mot de passe oublié ?
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
