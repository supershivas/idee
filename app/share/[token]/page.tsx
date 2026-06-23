import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import sanitizeHtml from 'sanitize-html'
import ShareContent from './ShareContent'

export async function generateMetadata({ params }: { params: { token: string } }) {
  const supabase = await createClient()
  const { data: page } = await supabase
    .from('pages')
    .select('title, icon')
    .eq('share_token', params.token)
    .eq('is_shared', true)
    .single()
  if (!page) return {}
  return { title: `${page.icon || '📄'} ${page.title || 'Sans titre'} — Idée` }
}

export default async function SharePage({ params }: { params: { token: string } }) {
  const supabase = await createClient()

  const { data: page } = await supabase
    .from('pages')
    .select('*')
    .eq('share_token', params.token)
    .eq('is_shared', true)
    .single()

  if (!page) notFound()

  const safeContent = sanitizeHtml(page.content || '', {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'h3', 'u', 's', 'del', 'mark', 'details', 'summary', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'ul', 'ol', 'li', 'input', 'blockquote', 'pre', 'code']),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ['src', 'alt', 'width', 'height', 'class'],
      '*': ['class', 'type', 'checked', 'disabled'],
      a: ['href', 'rel', 'target'],
      span: ['class', 'style', 'data-pill'],
      div: ['class', 'data-callout', 'data-color', 'color', 'emoji'],
    },
    allowedSchemes: ['https', 'http', 'data'],
    allowedSchemesAppliedToAttributes: ['href', 'src'],
  })

  const { data: subpages } = await supabase
    .from('pages')
    .select('id, title, icon, share_token, is_shared')
    .eq('parent_id', page.id)

  const { data: comments } = await supabase
    .from('page_comments')
    .select('*')
    .eq('page_id', page.id)
    .order('created_at', { ascending: true })

  const subpagesBlock = subpages && subpages.length > 0 ? (
    <div className="mb-6 pb-6 border-b border-gray-100">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Sous-pages</p>
      <div className="flex flex-col gap-1">
        {subpages.map(sub => (
          <div key={sub.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-gray-700">
            <span>{sub.icon || '📄'}</span>
            {sub.is_shared && sub.share_token ? (
              <a href={`/share/${sub.share_token}`} className="hover:text-blue-600 hover:underline">
                {sub.title || 'Sans titre'}
              </a>
            ) : (
              <span className="text-gray-400">{sub.title || 'Sans titre'} (non partagé)</span>
            )}
          </div>
        ))}
      </div>
    </div>
  ) : null

  return (
    <main className="max-w-5xl mx-auto px-6 py-12 relative">
      <ShareContent
        pageId={page.id}
        pageIcon={page.icon || '📄'}
        pageTitle={page.title || 'Sans titre'}
        safeContent={safeContent}
        initialComments={(comments || []) as any}
        commentsEnabled={page.comments_enabled !== false}
        subpagesBlock={subpagesBlock}
      />
    </main>
  )
}
