import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

export default async function SharePage({ params }: { params: { token: string } }) {
  const supabase = await createClient()

  const { data: page } = await supabase
    .from('pages')
    .select('*')
    .eq('share_token', params.token)
    .eq('is_shared', true)
    .single()

  if (!page) notFound()

  const { data: subpages } = await supabase
    .from('pages')
    .select('id, title, icon, share_token, is_shared')
    .eq('parent_id', page.id)

  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-5xl">{page.icon || '📄'}</span>
      </div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">{page.title || 'Sans titre'}</h1>

      {subpages && subpages.length > 0 && (
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
      )}

      <div
        className="prose max-w-none"
        dangerouslySetInnerHTML={{ __html: page.content || '<p class="text-gray-400">Page vide.</p>' }}
      />

      <div className="mt-12 pt-6 border-t border-gray-100 text-center">
        <p className="text-xs text-gray-400">Créé avec <a href="/" className="hover:text-gray-600">Idée</a></p>
      </div>
    </main>
  )
}
