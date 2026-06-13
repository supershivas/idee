import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import App from './App'

export default async function AppPage({ searchParams }: { searchParams: { page?: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: pages } = await supabase
    .from('pages')
    .select('*')
    .order('position', { ascending: true })
  return (
    <App
      initialPages={pages || []}
      userId={user.id}
      userEmail={user.email}
      initialPageId={searchParams.page}
    />
  )
}
