import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NotesList from './NotesList'

export default async function AppPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: notes } = await supabase
    .from('notes')
    .select('*')
    .order('updated_at', { ascending: false })

  return (
    <main className="flex min-h-screen">
      <NotesList initialNotes={notes || []} userId={user.id} />
    </main>
  )
}
