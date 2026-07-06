import { createClient } from '@/lib/supabase/server'
import { PAGE_META_COLUMNS } from '@/lib/pageColumns'
import { redirect } from 'next/navigation'
import App from './App'

export default async function AppPage({ searchParams }: { searchParams: { page?: string } }) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) redirect('/login')

    const { data: pages, error: pagesError } = await supabase
      .from('pages')
      .select(PAGE_META_COLUMNS)
      .order('position', { ascending: true })

    if (pagesError) throw pagesError

    // Contenu de la page ouverte via l'URL (chemin critique : affichage
    // immédiat sans attendre l'hydratation de fond).
    let initialContent: string | null = null
    if (searchParams.page) {
      const { data } = await supabase
        .from('pages')
        .select('content')
        .eq('id', searchParams.page)
        .single()
      initialContent = data?.content ?? null
    }

    const initialPages = (pages || []).map(p =>
      p.id === searchParams.page && initialContent != null
        ? { ...p, content: initialContent }
        : p
    )

    return (
      <App
        initialPages={initialPages as any}
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
