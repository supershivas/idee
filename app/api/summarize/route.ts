import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ ok: true, groq: !!process.env.GROQ_API_KEY })
}

// Rate-limit partagé (10 req/min par IP) via une fonction Postgres atomique
// (voir supabase/migrations/0001_rate_limits.sql). Contrairement à l'ancien
// compteur in-memory, il fonctionne sur Vercel où chaque requête peut tomber
// sur une instance serverless différente.
// Fail-open : si la fonction n'est pas encore déployée ou que la base est
// injoignable, on laisse passer plutôt que de casser la fonctionnalité.
const RATE_WINDOW_SECONDS = 60
const RATE_LIMIT = 10

async function isRateLimited(ip: string): Promise<boolean> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_bucket: `summarize:${ip}`,
      p_max: RATE_LIMIT,
      p_window_seconds: RATE_WINDOW_SECONDS,
    })
    if (error) { console.error('check_rate_limit error:', error.message); return false }
    return data === false // la fonction renvoie true tant que c'est autorisé
  } catch (err) {
    console.error('Rate limit check failed:', err)
    return false
  }
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (await isRateLimited(ip)) {
    return NextResponse.json({ error: 'Trop de requêtes, réessaie dans une minute.' }, { status: 429 })
  }

  const { content, title } = await req.json()
  if (!content) return NextResponse.json({ error: 'No content' }, { status: 400 })

  if (!process.env.GROQ_API_KEY) {
    console.error('GROQ_API_KEY is not set')
    return NextResponse.json({ error: 'Résumé IA non configuré (clé API manquante).' }, { status: 503 })
  }

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
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        max_tokens: 150,
        messages: [{
          role: 'user',
          content: `Tu es un assistant de prise de notes. Résume le contenu suivant en maximum 1-2 phrases directes en français. Commence directement par le contenu, sans introduction ni mention du mot "résumé". Titre : "${title}"\n\n${text}`,
        }],
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error('Groq error:', res.status, body)
      let detail = ''
      try {
        const parsed = JSON.parse(body)
        detail = parsed?.error?.message || parsed?.message || parsed?.detail || body.slice(0, 200)
      } catch { detail = body.slice(0, 200) }
      return NextResponse.json(
        { error: `Groq ${res.status}${detail ? ` : ${detail}` : ''}` },
        { status: 502 }
      )
    }

    const data = await res.json()
    const summary = data.choices?.[0]?.message?.content?.trim() || ''
    if (!summary) {
      return NextResponse.json({ error: 'Pas de résumé généré (contenu trop court ?)' }, { status: 422 })
    }
    return NextResponse.json({ summary })
  } catch (err) {
    console.error('Summarize error:', err)
    return NextResponse.json({ error: `Erreur serveur : ${err instanceof Error ? err.message : String(err)}` }, { status: 500 })
  }
}
