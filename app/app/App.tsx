import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import App from './App'

export default async function AppPage({ searchParams }: { searchParams: { page?: string } }) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) redirect('/login')

    const { data: pages, error: pagesError } = await supabase
      .from('pages')
      .select('*')
      .order('position', { ascending: true })

    if (pagesError) throw pagesError

    return (
      <App
        initialPages={pages || []}
        userId={user.id}
        userEmail={user.email}
        initialPageId={searchParams.page}
      />
    )
  } catch (e: any) {
    // Erreur d'auth → retour login
    if (e?.message === 'NEXT_REDIRECT') throw e
    redirect('/login')
  }
}
