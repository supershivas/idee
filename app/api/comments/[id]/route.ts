import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

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
      .select('*, reactions:page_comment_reactions(emoji, author_token)')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  if (action === 'resolve' || action === 'pin') {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const field = action === 'resolve' ? 'resolved' : 'pinned'
    const { data, error } = await supabase.from('page_comments')
      .update({ [field]: value })
      .eq('id', params.id)
      .select('*, reactions:page_comment_reactions(emoji, author_token)')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}))
  const { author_token } = body
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    if (!author_token) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const { data: comment } = await supabase.from('page_comments').select('author_token').eq('id', params.id).single()
    if (!comment || comment.author_token !== author_token) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  const { error } = await supabase.from('page_comments').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
