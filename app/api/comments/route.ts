import { createClient } from '@/lib/supabase/server'
import { COMMENT_COLUMNS, sanitizeComment } from '@/lib/comments'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const pageId = req.nextUrl.searchParams.get('pageId')
    if (!pageId) return NextResponse.json({ error: 'missing pageId' }, { status: 400 })
    const requesterToken = req.headers.get('x-author-token')
    const supabase = await createClient()

    // Accès : page partagée publiquement, ou propriétaire authentifié.
    const { data: page } = await supabase
      .from('pages')
      .select('id, is_shared, user_id')
      .eq('id', pageId)
      .single()
    if (!page) return NextResponse.json({ error: 'Page introuvable' }, { status: 404 })
    if (!page.is_shared) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || user.id !== page.user_id) {
        return NextResponse.json({ error: 'Page introuvable' }, { status: 404 })
      }
    }

    const { data, error } = await supabase
      .from('page_comments')
      .select(COMMENT_COLUMNS)
      .eq('page_id', pageId)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json((data || []).map(c => sanitizeComment(c, requesterToken)))
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { page_id, author_name, content, selected_text, parent_id, author_token } = body
    if (!page_id || !author_name?.trim() || !content?.trim()) {
      return NextResponse.json({ error: 'Champs manquants' }, { status: 400 })
    }
    const supabase = await createClient()
    const { data: page } = await supabase
      .from('pages')
      .select('id, comments_enabled')
      .eq('id', page_id)
      .eq('is_shared', true)
      .single()
    if (!page) return NextResponse.json({ error: 'Page introuvable ou non partagée' }, { status: 404 })
    if (page.comments_enabled === false) {
      return NextResponse.json({ error: 'Les commentaires sont désactivés sur cette page' }, { status: 403 })
    }

    const row: Record<string, unknown> = {
      page_id,
      author_name: author_name.trim().slice(0, 50),
      content: content.trim().slice(0, 2000),
      selected_text: selected_text?.trim().slice(0, 500) || null,
    }
    if (parent_id) row.parent_id = parent_id
    if (author_token) row.author_token = author_token

    const { data, error } = await supabase
      .from('page_comments')
      .insert(row)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(sanitizeComment({ ...data, reactions: [] }, author_token))
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
  }
}
