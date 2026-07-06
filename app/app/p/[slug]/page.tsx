import { createClient } from '@/lib/supabase/server'
import { PAGE_META_COLUMNS } from '@/lib/pageColumns'
import { redirect, notFound } from 'next/navigation'
import App from '../../App'

function slugify(title: string) {
  return title
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    || 'sans-titre'
}

export default async function PageSlugRoute({ params }: { params: { slug: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Extraire l'ID : dernière partie après '--'
  const parts = params.slug.split('--')
  const pageId = parts[parts.length - 1]

  const { data: pages } = await supabase
    .from('pages')
    .select(PAGE_META_COLUMNS)
    .order('position', { ascending: true })

  // Vérifier que la page existe et appartient à l'utilisateur
  const page = (pages || []).find(p => p.id === pageId && !p.deleted_at)
  if (!page) notFound()

  // Canonicaliser l'URL si le slug du titre a changé
  const canonical = `${slugify(page.title || 'sans-titre')}--${page.id}`
  if (params.slug !== canonical) redirect(`/app/p/${canonical}`)

  // Contenu de la page ouverte (chemin critique : affichage immédiat).
  const { data: contentRow } = await supabase
    .from('pages')
    .select('content')
    .eq('id', pageId)
    .single()
  const initialPages = (pages || []).map(p =>
    p.id === pageId ? { ...p, content: contentRow?.content ?? '' } : p
  )

  return (
    <App
      initialPages={initialPages as any}
      userId={user.id}
      userEmail={user.email}
      initialPageId={pageId}
    />
  )
}
