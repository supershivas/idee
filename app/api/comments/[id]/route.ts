import { createClient } from '@/lib/supabase/server'
import { COMMENT_COLUMNS, sanitizeComment } from '@/lib/comments'
import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

// Le demandeur authentifié possède-t-il la page de ce commentaire ?
async function isPageOwner(supabase: SupabaseClient, pageId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: page } = await supabase.from('pages').select('user_id').eq('id', pageId).single()
  return page?.user_id === user.id
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const { action, content, author_token, value } = body
  const supabase = await createClient()

  if (action === 'edit') {
    if (!author_token || !content?.trim()) return NextResponse.json({ error: 'Invalid' }, { status: 400 })
    const { data: comment } = await supabase.from('page_comments').select('author_token').eq('id', params.id).single()
    if (!comment || comment.author_token !== author_token) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    const { data, error } = await supabase.from('page_comments')
      .update({ content: content.trim().slice(0, 2000), edited_at: new Date().toISOString() })
      .eq('id', params.id)
      .select(COMMENT_COLUMNS)
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(sanitizeComment(data, author_token))
  }

  if (action === 'resolve' || action === 'pin') {
    const { data: comment } = await supabase.from('page_comments').select('page_id').eq('id', params.id).single()
    if (!comment) return NextResponse.json({ error: 'Commentaire introuvable' }, { status: 404 })
    if (!(await isPageOwner(supabase, comment.page_id))) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }
    const field = action === 'resolve' ? 'resolved' : 'pinned'
    const { data, error } = await supabase.from('page_comments')
      .update({ [field]: value })
      .eq('id', params.id)
      .select(COMMENT_COLUMNS)
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(sanitizeComment(data, author_token))
  }

  return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}))
  const { author_token } = body
  const supabase = await createClient()

  const { data: comment } = await supabase.from('page_comments').select('author_token, page_id').eq('id', params.id).single()
  if (!comment) return NextResponse.json({ error: 'Commentaire introuvable' }, { status: 404 })

  // Autorisé si : auteur du commentaire (token), ou propriétaire de la page.
  const isAuthor = !!author_token && comment.author_token === author_token
  if (!isAuthor && !(await isPageOwner(supabase, comment.page_id))) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  const { error } = await supabase.from('page_comments').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
