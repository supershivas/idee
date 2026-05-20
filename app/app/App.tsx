'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Editor from './Editor'

export type Page = {
  id: string
  parent_id: string | null
  title: string
  content: string
  position: number
  updated_at: string
}

function PageTree({
  pages,
  parentId,
  depth,
  selectedId,
  onSelect,
  onAdd,
}: {
  pages: Page[]
  parentId: string | null
  depth: number
  selectedId: string | null
  onSelect: (page: Page) => void
  onAdd: (parentId: string | null) => void
}) {
  const children = pages.filter(p => p.parent_id === parentId)
  const [open, setOpen] = useState<Record<string, boolean>>({})

  if (!children.length && depth > 0) return null

  return (
    <div>
      {children.map(page => {
        const hasChildren = pages.some(p => p.parent_id === page.id)
        const isOpen = open[page.id]
        const isSelected = selectedId === page.id

        return (
          <div key={page.id}>
            <div
              className={`flex items-center gap-1 px-2 py-1 rounded cursor-pointer group hover:bg-gray-100 ${isSelected ? 'bg-gray-200' : ''}`}
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
            >
              <button
                onClick={() => setOpen(o => ({ ...o, [page.id]: !o[page.id] }))}
                className="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-gray-600 flex-shrink-0"
              >
                {hasChildren ? (isOpen ? '▾' : '▸') : <span className="w-4" />}
              </button>
              <span
                onClick={() => onSelect(page)}
                className="flex-1 text-sm truncate"
              >
                {page.title || 'Sans titre'}
              </span>
              <button
                onClick={() => onAdd(page.id)}
                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-700 text-lg leading-none flex-shrink-0"
                title="Ajouter une sous-page"
              >
                +
              </button>
            </div>
            {isOpen && (
              <PageTree
                pages={pages}
                parentId={page.id}
                depth={depth + 1}
                selectedId={selectedId}
                onSelect={onSelect}
                onAdd={onAdd}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

function Breadcrumb({ pages, selected, onSelect }: { pages: Page[], selected: Page | null, onSelect: (p: Page) => void }) {
  if (!selected) return null

  const crumbs: Page[] = []
  let current: Page | undefined = selected
  while (current) {
    crumbs.unshift(current)
    current = pages.find(p => p.id === current!.parent_id)
  }

  return (
    <div className="flex items-center gap-1 text-sm text-gray-400 px-6 py-2 border-b">
      {crumbs.map((crumb, i) => (
        <span key={crumb.id} className="flex items-center gap-1">
          {i > 0 && <span>/</span>}
          <button
            onClick={() => onSelect(crumb)}
            className={`hover:text-gray-700 ${i === crumbs.length - 1 ? 'text-gray-700 font-medium' : ''}`}
          >
            {crumb.title || 'Sans titre'}
          </button>
        </span>
      ))}
    </div>
  )
}

export default function App({ initialPages, userId }: { initialPages: Page[], userId: string }) {
  const [pages, setPages] = useState<Page[]>(initialPages)
  const [selected, setSelected] = useState<Page | null>(null)
  const [saving, setSaving] = useState(false)

  async function addPage(parentId: string | null) {
    const supabase = createClient()
    const { data } = await supabase
      .from('pages')
      .insert({ title: 'Sans titre', content: '', user_id: userId, parent_id: parentId, position: pages.length })
      .select()
      .single()
    if (data) {
      setPages(prev => [...prev, data])
      setSelected(data)
      // Auto-ouvre le parent dans la sidebar
    }
  }

  async function updateTitle(value: string) {
    if (!selected) return
    const updated = { ...selected, title: value, updated_at: new Date().toISOString() }
    setSelected(updated)
    setPages(prev => prev.map(p => p.id === updated.id ? updated : p))
    setSaving(true)
    const supabase = createClient()
    await supabase.from('pages').update({ title: value, updated_at: updated.updated_at }).eq('id', selected.id)
    setSaving(false)
  }

  async function updateContent(content: string) {
    if (!selected) return
    const updated = { ...selected, content, updated_at: new Date().toISOString() }
    setSelected(prev => prev ? { ...prev, content } : null)
    setPages(prev => prev.map(p => p.id === updated.id ? updated : p))
    setSaving(true)
    const supabase = createClient()
    await supabase.from('pages').update({ content, updated_at: updated.updated_at }).eq('id', selected.id)
    setSaving(false)
  }

  async function deletePage(id: string) {
    const supabase = createClient()
    await supabase.from('pages').delete().eq('id', id)
    const remaining = pages.filter(p => p.id !== id && p.parent_id !== id)
    setPages(remaining)
    setSelected(remaining[0] || null)
  }

  const subpages = selected ? pages.filter(p => p.parent_id === selected.id) : []

  async function logout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="flex w-full h-screen">
      {/* Sidebar */}
      <div className="w-64 border-r bg-gray-50 flex flex-col flex-shrink-0">
        <div className="p-4 border-b flex items-center justify-between">
          <span className="font-semibold">Idée</span>
          <div className="flex items-center gap-2">
            <button onClick={() => addPage(null)} className="text-xl font-light hover:text-gray-500" title="Nouvelle page">+</button>
            <button onClick={logout} className="text-xs text-gray-400 hover:text-gray-600" title="Se déconnecter">⎋</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-2 px-1">
          {pages.filter(p => p.parent_id === null).length === 0 && (
            <p className="text-sm text-gray-400 p-4">Clique sur + pour créer une page.</p>
          )}
          <PageTree
            pages={pages}
            parentId={null}
            depth={0}
            selectedId={selected?.id || null}
            onSelect={setSelected}
            onAdd={addPage}
          />
        </div>
      </div>

      {/* Éditeur */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selected ? (
          <>
            <Breadcrumb pages={pages} selected={selected} onSelect={setSelected} />
            <div className="px-6 pt-6 pb-2 flex items-center justify-between">
              <input
                className="text-3xl font-bold outline-none w-full bg-transparent"
                value={selected.title}
                onChange={e => updateTitle(e.target.value)}
                placeholder="Sans titre"
              />
              <div className="flex items-center gap-3 ml-4">
                {saving && <span className="text-xs text-gray-400">Sauvegarde...</span>}
                <button onClick={() => deletePage(selected.id)} className="text-sm text-red-400 hover:text-red-600 whitespace-nowrap">Supprimer</button>
              </div>
            </div>

            {/* Sous-pages */}
            {subpages.length > 0 && (
              <div className="px-6 pb-4 flex flex-wrap gap-2">
                {subpages.map(sub => (
                  <button
                    key={sub.id}
                    onClick={() => setSelected(sub)}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-50 border rounded-lg hover:bg-gray-100 text-sm"
                  >
                    <span>📄</span>
                    <span>{sub.title || 'Sans titre'}</span>
                  </button>
                ))}
              </div>
            )}

            <Editor
              key={selected.id}
              page={selected}
              pages={pages}
              onUpdate={updateContent}
              onAddSubpage={() => addPage(selected.id)}
              onNavigate={setSelected}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <p className="text-lg mb-2">Aucune page sélectionnée</p>
              <button onClick={() => addPage(null)} className="text-sm underline hover:text-gray-600">Créer une page</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
