import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import sanitizeHtml from 'sanitize-html'
import ShareContent from './ShareContent'

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
<<<<<<< HEAD
      div: ['class', 'data-callout', 'data-color', 'color', 'emoji'],
=======
      div: ['class', 'data-callout', 'data-color', 'color', 'emoji'],
>>>>>>> origin/main
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
<<<<<<< HEAD
        ))}
=======
        </div>
      )}

      <style>{`
        .prose [data-callout] {
          display: flex;
          gap: 12px;
          padding: 12px 16px;
          border-radius: 12px;
          margin: 8px 0;
          background: rgba(245,200,66,0.12);
          border-left: 3px solid #f5c842;
          font-size: 0.9em;
        }
        .prose [data-callout][color="blue"]   { background: rgba(96,165,250,0.12); border-left-color: #60a5fa; }
        .prose [data-callout][color="red"]    { background: rgba(239,68,68,0.12);  border-left-color: #ef4444; }
        .prose [data-callout][color="green"]  { background: rgba(34,197,94,0.12);  border-left-color: #22c55e; }
      `}</style>
      <div
        className="prose max-w-none"
        dangerouslySetInnerHTML={{ __html: safeContent || '<p class="text-gray-400">Page vide.</p>' }}
      />

      <div className="mt-12 pt-6 border-t border-gray-100 text-center">
        <p className="text-xs text-gray-400">Créé avec <a href="/" className="hover:text-gray-600">Idée</a></p>
>>>>>>> origin/main
      </div>
    </div>
  ) : null

  return (
    <main className="max-w-3xl mx-auto px-6 py-12 relative">
      <ShareContent
        pageId={page.id}
        pageIcon={page.icon || '📄'}
        pageTitle={page.title || 'Sans titre'}
        safeContent={safeContent}
        initialComments={comments || []}
        subpagesBlock={subpagesBlock}
      />
    </main>
  )
}
