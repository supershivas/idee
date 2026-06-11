import { NextRequest, NextResponse } from 'next/server'

// In-memory rate limiter: 10 req/min par IP
const rateMap = new Map<string, number[]>()

function checkRate(ip: string): boolean {
  const now = Date.now()
  const window = 60_000
  const limit = 10
  const hits = (rateMap.get(ip) || []).filter(t => now - t < window)
  if (hits.length >= limit) return false
  rateMap.set(ip, [...hits, now])
  return true
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!checkRate(ip)) {
    return NextResponse.json({ error: 'Trop de requêtes, réessaie dans une minute.' }, { status: 429 })
  }

  const { content, title } = await req.json()
  if (!content) return NextResponse.json({ error: 'No content' }, { status: 400 })

  const text = content
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 4000)

  try {
    const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        max_tokens: 120,
        messages: [{
          role: 'user',
          content: `Tu es un assistant de prise de notes. Résume le contenu suivant en maximum 1-2 phrases directes en français. Commence directement par le contenu, sans introduction ni mention du mot "résumé".Titre : "${title}"\n\n${text}`,
        }],
      }),
    })

    if (!res.ok) {
      console.error('Mistral error:', res.status, await res.text().catch(() => ''))
      return NextResponse.json({ error: 'Erreur Mistral' }, { status: 502 })
    }

    const data = await res.json()
    const summary = data.choices?.[0]?.message?.content?.trim() || ''
    return NextResponse.json({ summary })
  } catch (err) {
    console.error('Summarize error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
