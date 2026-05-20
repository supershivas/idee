import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AppPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold">Bienvenue 👋</h1>
      <p className="text-gray-500">{user.email}</p>
      <p className="text-gray-400">Tes notes arrivent bientôt...</p>
    </main>
  )
}
