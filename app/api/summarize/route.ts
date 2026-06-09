import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
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
  
  const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'mistral-small-latest',
      max_tokens: 120,
      messages: [
        {
          role: 'user',
          content: `Tu es un assistant de prise de notes. Résume le contenu suivant en 2-3 phrases directes en français. Commence directement par le contenu, sans introduction ni mention du mot "résumé".`,        },
      ],
    }),
  })

  const data = await res.json()
  const summary = data.choices?.[0]?.message?.content?.trim() || ''
  return NextResponse.json({ summary })
}
