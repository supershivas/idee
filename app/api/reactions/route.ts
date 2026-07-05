import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { comment_id, emoji, author_token } = await req.json()
  if (!comment_id || !emoji || !author_token) return NextResponse.json({ error: 'Invalid' }, { status: 400 })
  const supabase = await createClient()

  // Le commentaire doit appartenir à une page partagée publiquement.
  const { data: comment } = await supabase
    .from('page_comments')
    .select('id, page_id')
    .eq('id', comment_id)
    .single()
  if (!comment) return NextResponse.json({ error: 'Commentaire introuvable' }, { status: 404 })
  const { data: page } = await supabase
    .from('pages')
    .select('id')
    .eq('id', comment.page_id)
    .eq('is_shared', true)
    .single()
  if (!page) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const { data: existing } = await supabase
    .from('page_comment_reactions')
    .select('id')
    .eq('comment_id', comment_id)
    .eq('emoji', emoji)
    .eq('author_token', author_token)
    .single()

  if (existing) {
    await supabase.from('page_comment_reactions').delete().eq('id', existing.id)
    return NextResponse.json({ action: 'removed' })
  } else {
    await supabase.from('page_comment_reactions').insert({ comment_id, emoji, author_token })
    return NextResponse.json({ action: 'added' })
  }
}
