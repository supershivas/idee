import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const pageId = req.nextUrl.searchParams.get('pageId')
  if (!pageId) return NextResponse.json({ error: 'missing pageId' }, { status: 400 })
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('page_comments')
    .select('*')
    .eq('page_id', pageId)
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { page_id, author_name, content, selected_text } = body
  if (!page_id || !author_name?.trim() || !content?.trim()) {
    return NextResponse.json({ error: 'Champs manquants' }, { status: 400 })
  }
  const supabase = await createClient()
  const { data: page } = await supabase
    .from('pages')
    .select('id')
    .eq('id', page_id)
    .eq('is_shared', true)
    .single()
  if (!page) return NextResponse.json({ error: 'Page introuvable ou non partagée' }, { status: 404 })
  const { data, error } = await supabase
    .from('page_comments')
    .insert({
      page_id,
      author_name: author_name.trim().slice(0, 50),
      content: content.trim().slice(0, 2000),
      selected_text: selected_text?.trim().slice(0, 500) || null,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
