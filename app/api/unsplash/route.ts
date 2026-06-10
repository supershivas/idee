import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('query')?.trim()
  if (!query) return NextResponse.json({ results: [] })

  const key = process.env.UNSPLASH_ACCESS_KEY
  if (!key) return NextResponse.json({ error: 'Unsplash non configuré' }, { status: 500 })

  const page = searchParams.get('page') || '1'
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=24&page=${page}&orientation=landscape&content_filter=high`

  try {
    const res = await fetch(url, { headers: { Authorization: `Client-ID ${key}` } })
    if (!res.ok) return NextResponse.json({ error: 'Erreur Unsplash' }, { status: res.status })
    const data = await res.json()
    const results = (data.results || []).map((p: any) => ({
      id: p.id,
      thumb: p.urls?.thumb,
      small: p.urls?.small,
      regular: p.urls?.regular,
      alt: p.alt_description || p.description || 'Photo Unsplash',
      author: p.user?.name,
      authorUrl: p.user?.links?.html,
    }))
    return NextResponse.json({ results })
  } catch {
    return NextResponse.json({ error: 'Erreur réseau Unsplash' }, { status: 500 })
  }
}
