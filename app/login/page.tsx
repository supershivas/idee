'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  
  const router = useRouter()

  async function handleLogin() {
    setLoading(true)
    setError('')
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
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({ email, password })
    
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setError('Vérifie tes emails pour confirmer ton compte !')
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold">Idée</h1>
      <div className="flex flex-col gap-3 w-80">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="border rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-black"
        />
        <input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="border rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-black"
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          onClick={handleLogin}
          disabled={loading}
          className="rounded-lg bg-black px-6 py-2 text-white hover:bg-gray-800 disabled:opacity-50"
        >
          Se connecter
        </button>
        <button
          onClick={handleSignup}
          disabled={loading}
          className="rounded-lg border px-6 py-2 hover:bg-gray-50 disabled:opacity-50"
        >
          Créer un compte
        </button>
      </div>
    </main>
  )
}
