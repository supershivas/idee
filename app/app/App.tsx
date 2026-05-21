'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Editor from './Editor'
import ShareButton from './ShareButton'

export type Page = {
  id: string
  parent_id: string | null
  title: string
  content: string
  icon: string
  position: number
  updated_at: string
}

const ICON_OPTIONS = ['📄', '📝', '💡', '🗂️', '📌', '🔖', '⭐', '🚀', '🎯', '💬', '🏠', '🔧', '📊', '🎨', '📚', '🌿', '🔍', '💼', '🎵', '🧪']

function IconPicker({ current, onChange, onClose }: { current: string, onChange: (icon: string) => void, onClose: () => void }) {
  return (
    <div className="absolute top-full left-0 mt-1 bg-white border rounded-xl shadow-xl p-3 z-50 w-52">
      <div className="grid grid-cols-5 gap-1">
        {ICON_OPTIONS.map(icon => (
          <button key={icon} onClick={() => { onChange(icon); onClose() }}
            className={`w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-lg transition-colors ${current === icon ? 'bg-gray-200' : ''}`}>
            {icon}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-gray-400 text-center">
        Tous les emojis : Mac ⌘+Ctrl+Espace · Win ⊞+.
      </p>
    </div>
  )
}

function SearchBar({ pages, onSelect }: { pages: Page[], onSelect: (p: Page) => void }) {
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const results = query.length > 1
    ? pages.filter(p =>
        (p.title || '').toLowerCase().includes(query.toLowerCase()) ||
        (p.content || '').toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : []
  return (
    <div className="relative px-2 py-2 border-b border-gray-200">
      <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1.5">
        <span className="text-gray-400 text-sm">🔍</span>
        <input value={query} onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="Rechercher..."
          className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder-gray-400" />
        {query && <button onClick={() => setQuery('')} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>}
      </div>
      {focused && results.length > 0 && (
        <div className="absolute left-2 right-2 top-full mt-1 bg-white border rounded-lg shadow-xl z-50 overflow-hidden">
          {results.map(page => (
            <button key={page.id} onClick={() => { onSelect(page); setQuery('') }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 border-b last:border-0">
              <span>{page.icon || '📄'}</span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{page.title || 'Sans titre'}</p>
                {(page.content || '').toLowerCase().includes(query.toLowerCase()) && (
                  <p className="text-xs text-gray-400 truncate">{page.content.replace(/<[^>]+>/g, '').slice(0, 60)}...</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
      {focused && query.length > 1 && results.length === 0 && (
        <div className="absolute left-2 right-2 top-full mt-1 bg-white border rounded-lg shadow-xl z-50 p-3">
          <p className="text-sm text-gray-400 text-center">Aucun résultat</p>
        </div>
      )}
    </div>
  )
}

function PageTree({ pages, parentId, depth, selectedId, onSelect, onAdd, onUpdateIcon }:
  { pages: Page[], parentId: string | null, depth: number, selectedId: string | null, onSelect: (p: Page) => void, onAdd: (parentId: string | null) => void, onUpdateIcon: (id: string, icon: string) => void }
) {
  const children = pages.filter(p => p.parent_id === parentId)
  const [open, setOpen] = useState<Record<string, boolean>>({})
  if (!children.length) return null
  return (
    <div>
      {children.map(page => {
        const hasChildren = pages.some(p => p.parent_id === page.id)
        const isOpen = open[page.id]
        const isSelected = selectedId === page.id
        return (
          <div key={page.id}>
            <div
              className={`flex items-center gap-1 pr-2 py-0.5 rounded-md cursor-pointer group hover:bg-gray-200/60 transition-colors ${isSelected ? 'bg-gray-200' : ''}`}
              style={{ paddingLeft: `${depth * 14 + 6}px` }}
            >
              <button onClick={() => setOpen(o => ({ ...o, [page.id]: !o[page.id] }))}
                className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 flex-shrink-0 text-xs">
                {hasChildren ? (isOpen ? '▾' : '▸') : ''}
              </button>
              <span className="text-base flex-shrink-0">{page.icon || '📄'}</span>
              <span onClick={() => onSelect(page)} className="flex-1 text-sm truncate py-1 text-gray-700">
                {page.title || 'Sans titre'}
              </span>
              <button onClick={() => onAdd(page.id)}
                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-700 text-base leading-none flex-shrink-0 w-5 h-5 flex items-center justify-center"
                title="Ajouter une sous-page">+</button>
            </div>
            {isOpen && (
              <PageTree pages={pages} parentId={page.id} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} onAdd={onAdd} onUpdateIcon={onUpdateIcon} />
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
    <div className="flex items-center gap-1 text-sm text-gray-400 px-4 md:px-8 py-2 overflow-x-auto">
      {crumbs.map((crumb, i) => (
        <span key={crumb.id} className="flex items-center gap-1 flex-shrink-0">
          {i > 0 && <span className="text-gray-300">/</span>}
          <button onClick={() => onSelect(crumb)} className={`hover:text-gray-700 transition-colors flex items-center gap-1 ${i === crumbs.length - 1 ? 'text-gray-600 font-medium' : ''}`}>
            <span>{crumb.icon || '📄'}</span>
            <span className="whitespace-nowrap">{crumb.title || 'Sans titre'}</span>
          </button>
        </span>
      ))}
    </div>
  )
}

function SubpagesList({ subpages, onSelect }: { subpages: Page[], onSelect: (p: Page) => void }) {
  if (!subpages.length) return null
  return (
    <div className="px-4 md:px-8 pb-3 border-b border-gray-100">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Sous-pages</p>
      <div className="flex flex-col gap-0.5">
        {subpages.map(sub => (
          <button key={sub.id} onClick={() => onSelect(sub)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-100 transition-colors text-sm text-gray-700 text-left group w-full">
            <span className="text-base">{sub.icon || '📄'}</span>
            <span className="flex-1 truncate">{sub.title || 'Sans titre'}</span>
            <span className="opacity-0 group-hover:opacity-100 text-gray-400 text-xs">→</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function App({ initialPages, userId }: { initialPages: Page[], userId: string }) {
  const [pages, setPages] = useState<Page[]>(initialPages)
  const [selected, setSelected] = useState<Page | null>(null)
  const [saving, setSaving] = useState(false)
  const [showIconPicker, setShowIconPicker] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  async function addPage(parentId: string | null) {
    const supabase = createClient()
    const icons = ['📄', '📝', '💡', '🗂️', '📌', '🔖', '⭐', '🚀', '🎯', '💬']
    const icon = icons[Math.floor(Math.random() * icons.length)]
    const { data } = await supabase
      .from('pages')
      .insert({ title: 'Sans titre', content: '', user_id: userId, parent_id: parentId, position: pages.length, icon })
      .select()
      .single()
    if (data) {
      setPages(prev => [...prev, data])
      setSelected(data)
      setSidebarOpen(false)
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

  async function updateIcon(id: string, icon: string) {
    setPages(prev => prev.map(p => p.id === id ? { ...p, icon } : p))
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, icon } : null)
    const supabase = createClient()
    await supabase.from('pages').update({ icon }).eq('id', id)
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

  async function logout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const subpages = selected ? pages.filter(p => p.parent_id === selected.id) : []

  const sidebar = (
    <div className="w-60 bg-gray-50 flex flex-col h-full">
      <div className="px-4 py-3 flex items-center justify-between border-b border-gray-200">
        <span className="font-semibold text-gray-800 text-sm">Idée</span>
        <div className="flex items-center gap-1">
          <button onClick={() => addPage(null)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-200 text-gray-500 hover:text-gray-800 transition-colors text-lg" title="Nouvelle page">+</button>
          <button onClick={logout} className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors text-sm" title="Se déconnecter">⎋</button>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden w-6 h-6 flex items-center justify-center rounded hover:bg-gray-200 text-gray-400 ml-1">✕</button>
        </div>
      </div>
      <SearchBar pages={pages} onSelect={(p) => { setSelected(p); setSidebarOpen(false) }} />
      <div className="flex-1 overflow-y-auto sidebar-scroll py-2 px-2">
        {pages.filter(p => p.parent_id === null).length === 0 && (
          <p className="text-xs text-gray-400 px-3 py-3">Clique sur + pour créer une page.</p>
        )}
        <PageTree pages={pages} parentId={null} depth={0} selectedId={selected?.id || null}
          onSelect={(p) => { setSelected(p); setSidebarOpen(false) }}
          onAdd={addPage} onUpdateIcon={updateIcon} />
      </div>
    </div>
  )

  return (
    <div className="flex w-full h-screen bg-white overflow-hidden">

      {/* Sidebar desktop */}
      <div className="hidden md:flex border-r flex-shrink-0">
        {sidebar}
      </div>

      {/* Sidebar mobile — overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="flex-shrink-0 border-r shadow-xl">
            {sidebar}
          </div>
          <div className="flex-1 bg-black/30" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      {/* Contenu */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Header mobile */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-500 hover:text-gray-800 text-xl leading-none">☰</button>
          <span className="text-sm font-medium text-gray-700 truncate">{selected?.title || 'Idée'}</span>
        </div>

        {selected ? (
          <>
            <Breadcrumb pages={pages} selected={selected} onSelect={setSelected} />
            <div className="px-4 md:px-8 pt-4 pb-2 flex items-start gap-3 relative">
              <div className="relative">
                <button onClick={() => setShowIconPicker(v => !v)}
                  className="text-4xl hover:opacity-70 transition-opacity leading-none" title="Changer l'icône">
                  {selected.icon || '📄'}
                </button>
                {showIconPicker && (
                  <IconPicker current={selected.icon || '📄'} onChange={(icon) => updateIcon(selected.id, icon)} onClose={() => setShowIconPicker(false)} />
                )}
              </div>
              <div className="flex-1 flex items-center justify-between min-w-0">
                <input
                  className="text-2xl md:text-3xl font-bold outline-none w-full bg-transparent text-gray-900 placeholder-gray-300"
                  value={selected.title}
                  onChange={e => updateTitle(e.target.value)}
                  placeholder="Sans titre"
                />
                <div className="flex items-center gap-2 ml-4 flex-shrink-0">
  {saving && <span className="text-xs text-gray-400">Sauvegarde...</span>}
  <ShareButton page={selected as any} onUpdate={(updates) => {
    setSelected(prev => prev ? { ...prev, ...updates } : null)
    setPages(prev => prev.map(p => p.id === selected.id ? { ...p, ...updates } : p))
  }} />
  <button onClick={() => deletePage(selected.id)} className="text-sm text-red-400 hover:text-red-500 transition-colors">Supprimer</button>
</div>
              </div>
            </div>
            <SubpagesList subpages={subpages} onSelect={setSelected} />
            <Editor key={selected.id} page={selected} pages={pages} onUpdate={updateContent} onAddSubpage={() => addPage(selected.id)} onNavigate={setSelected} userId={userId} />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <p className="text-4xl mb-3">💡</p>
              <p className="text-lg font-medium mb-1 text-gray-500">Aucune page sélectionnée</p>
              <button onClick={() => addPage(null)} className="text-sm text-blue-500 hover:text-blue-700 underline">Créer une page</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
