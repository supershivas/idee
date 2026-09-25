'use client'
import { useEffect, useState, useRef, useMemo, Fragment, ReactNode } from 'react'
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import Table from '@tiptap/extension-table'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import TableRow from '@tiptap/extension-table-row'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { Plugin } from '@tiptap/pm/state'
import { CellSelection } from '@tiptap/pm/tables'
import { SlashCommands } from './SlashCommands'
import { PillMark, PILL_COLORS, PillColorId } from './PillMark'
import { DragHandleExtension } from './DragHandle'
import { TableControlsExtension, CELL_COLORS } from './TableControls'
import { createSubpageExtension, insertSubpageBlock } from './SubpageNode'
import { createWikiLinkExtension } from './WikiLinkExtension'
import { CalloutExtension } from './CalloutNode'
import { Extension } from '@tiptap/core'
import { InputRule } from '@tiptap/core'
import { Backlinks } from './Backlinks'

// Attribut de couleur de fond pour les cellules de tableau (cellule + en-tête).
const cellBackgroundAttr = {
  backgroundColor: {
    default: null as string | null,
    parseHTML: (el: HTMLElement) => el.getAttribute('data-bg') || null,
    renderHTML: (attrs: { backgroundColor?: string | null }) =>
      attrs.backgroundColor
        ? { 'data-bg': attrs.backgroundColor, style: `background-color:${attrs.backgroundColor}` }
        : {},
  },
}

const TypographyShortcuts = Extension.create({
  name: 'typographyShortcuts',
  addInputRules() {
    const rules: [RegExp, string][] = [
      [/<->(\s)$/, '↔$1'],
      [/->(\s)$/, '→$1'],
      [/<-(\s)$/, '←$1'],
      [/=>(\s)$/, '⇒$1'],
      [/\.\.\.$/, '…'],
      [/--(\s)$/, '—$1'],
    ]
    return rules.map(([find, replace]) =>
      new InputRule({ find, handler: ({ state, range, match }) => {
        const tr = state.tr.replaceWith(range.from, range.to, state.schema.text(replace.replace('$1', match[1] ?? '')))
        return tr
      }})
    )
  },
})
import { Page } from './types'
import { useKeyboardBarAnchor } from './hooks'
import { toast } from './components/Toast'
import { LinkPicker, LinkChoice } from './LinkPicker'
import { createLinkOnSelection } from './LinkOnSelection'
import { createClient } from '@/lib/supabase/client'

function ToolBtn({ onClick, active, label, title }: { onClick: () => void, active?: boolean, label: ReactNode, title: string }) {
  return (
    // Dimensions en CSS (`.toolbar-btn`) et non en style inline : la pastille
    // mobile a besoin de les resserrer pour sa rangée d'options, ce qu'un
    // style inline rendrait impossible sans `!important`.
    <button onClick={onClick} title={title}
      className={`toolbar-btn flex items-center justify-center rounded text-sm font-medium transition-colors flex-shrink-0
        ${active ? 'is-active' : ''}`}>
      {label}
    </button>
  )
}


// Pastilles de surlignage, partagées par les trois barres (collante,
// flottante, pastille mobile) : mêmes dimensions et même état actif partout.
// Les teintes de bordure viennent de la surface (`--toolbar-swatch-*`), claire
// ou sombre selon la barre.
function PillSwatches({ editor, onPick }: { editor: any, onPick?: () => void }) {
  return (
    <>
      {PILL_COLORS.map(c => {
        const isActive = editor?.isActive('pill', { color: c.id })
        return (
          <button
            key={c.id}
            title={`Surligner ${c.id}`}
            onClick={() => {
              if (isActive) editor?.chain().focus().unsetMark('pill').run()
              else editor?.chain().focus().setMark('pill', { color: c.id }).run()
              onPick?.()
            }}
            className="toolbar-swatch flex items-center justify-center flex-shrink-0"
          >
            <span style={{
              width: 15, height: 15, borderRadius: '50%', background: c.swatch, display: 'block',
              border: isActive
                ? '2px solid var(--toolbar-swatch-active)'
                : '1.5px solid var(--toolbar-swatch-border)',
              transform: isActive ? 'scale(1.2)' : 'scale(1)', transition: 'transform 0.1s',
            }} />
          </button>
        )
      })}
      {editor?.isActive('pill') && (
        <ToolBtn onClick={() => { editor?.chain().focus().unsetMark('pill').run(); onPick?.() }}
          label={<i className="ti ti-x" />} title="Retirer le surlignage" />
      )}
    </>
  )
}

// Dégradé des cinq couleurs, affiché quand aucun surlignage n'est posé : un
// rond vide se lirait comme un bouton désactivé.
const PILL_WHEEL = `conic-gradient(${PILL_COLORS
  .map((c, i) => `${c.swatch} ${(i * 100) / PILL_COLORS.length}% ${((i + 1) * 100) / PILL_COLORS.length}%`)
  .join(', ')})`

// Surlignage replié derrière un seul bouton : cinq pastilles alignées
// coûtaient 150px dans chaque barre pour une action occasionnelle, et la
// barre flottante débordait alors de son volet. Le bouton porte la couleur
// courante, donc l'état reste lisible sans ouvrir le menu.
// Referme un menu de barre au clic en dehors ou sur Échap.
function useDismiss(open: boolean, ref: React.RefObject<HTMLElement>, close: () => void) {
  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent | TouchEvent) {
      if (!ref.current?.contains(e.target as Node)) close()
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') close() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
}

function PillMenu({ editor, up }: { editor: any, up?: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useDismiss(open, ref, () => setOpen(false))

  const active = PILL_COLORS.find(c => editor?.isActive('pill', { color: c.id }))

  return (
    // `onMouseDown` neutralisé : ouvrir le menu ne doit pas déplacer la
    // sélection, sinon la barre flottante disparaît avec elle — et sur
    // mobile, le clavier se refermerait sous le doigt.
    <div ref={ref} className="relative flex-shrink-0" onMouseDown={e => e.preventDefault()}>
      <button
        title="Surlignage" data-keep-open
        onClick={() => setOpen(v => !v)}
        className={`toolbar-btn flex items-center justify-center rounded text-sm font-medium transition-colors
          ${open || active ? 'is-active' : ''}`}
      >
        <span style={{
          width: 15, height: 15, borderRadius: '50%', display: 'block',
          background: active ? active.swatch : PILL_WHEEL,
          border: '1.5px solid var(--toolbar-swatch-border)',
        }} />
      </button>
      {open && (
        <div className="toolbar-popover" style={{
          left: '50%', transform: 'translateX(-50%)',
          ...(up ? { bottom: '100%', marginBottom: 6 } : { top: '100%', marginTop: 6 }),
        }}>
          <PillSwatches editor={editor} onPick={() => setOpen(false)} />
        </div>
      )}
    </div>
  )
}

// « ⋯ » de la barre desktop : les actions qui ne tiennent plus s'ouvrent
// dans un menu sous le bouton, plutôt que sur une seconde rangée souvent
// presque vide. Un choix referme le menu, sauf l'ouverture du surlignage.
function MoreMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useDismiss(open, ref, () => setOpen(false))
  return (
    <div ref={ref} className="relative flex-shrink-0" onMouseDown={e => e.preventDefault()}>
      <ToolBtn onClick={() => setOpen(v => !v)} active={open} label={<i className="ti ti-dots" />} title="Plus d'options" />
      {open && (
        <div className="toolbar-popover" style={{ right: 0, top: '100%', marginTop: 6, flexWrap: 'wrap', width: 'max-content', maxWidth: 320 }}
          onClick={e => { if (!(e.target as HTMLElement).closest('[data-keep-open]')) setOpen(false) }}>
          {children}
        </div>
      )}
    </div>
  )
}

function TableBottomSheet({ editor, onClose }: { editor: any, onClose: () => void }) {
  const actions = [
    { icon: 'ti-column-insert-left', label: 'Colonne avant', fn: () => editor.chain().focus().addColumnBefore().run() },
    { icon: 'ti-column-insert-right', label: 'Colonne après', fn: () => editor.chain().focus().addColumnAfter().run() },
    { icon: 'ti-row-insert-top', label: 'Ligne avant', fn: () => editor.chain().focus().addRowBefore().run() },
    { icon: 'ti-row-insert-bottom', label: 'Ligne après', fn: () => editor.chain().focus().addRowAfter().run() },
    { icon: 'ti-column-remove', label: 'Supprimer la colonne', fn: () => editor.chain().focus().deleteColumn().run(), danger: true },
    { icon: 'ti-row-remove', label: 'Supprimer la ligne', fn: () => editor.chain().focus().deleteRow().run(), danger: true },
    { icon: 'ti-table-off', label: 'Supprimer le tableau', fn: () => editor.chain().focus().deleteTable().run(), danger: true },
  ]
  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="w-full rounded-t-2xl shadow-2xl" style={{ background: 'var(--card-bg)' }} onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 rounded-full mx-auto mt-3 mb-4" style={{ background: 'var(--border)' }} />
        <p className="text-xs font-medium uppercase tracking-wide px-5 mb-2" style={{ color: 'var(--text-muted)' }}>Couleur de cellule</p>
        <div className="flex items-center gap-2 px-5 pb-3">
          {CELL_COLORS.map(c => (
            <button key={c.label} title={c.label}
              onClick={() => { (editor.chain().focus() as any).setCellAttribute('backgroundColor', c.value).run(); onClose() }}
              className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center"
              style={{
                background: c.swatch || 'linear-gradient(135deg, transparent 45%, var(--text-muted) 45%, var(--text-muted) 55%, transparent 55%)',
                border: c.swatch ? '1px solid rgba(0,0,0,0.15)' : '1px solid var(--border)',
              }} />
          ))}
        </div>
        <p className="text-xs font-medium uppercase tracking-wide px-5 mb-2" style={{ color: 'var(--text-muted)' }}>Tableau</p>
        {actions.map((a, i) => (
          <button key={i} onClick={() => { a.fn(); onClose() }}
            className="w-full flex items-center gap-3 text-left px-5 py-4 text-base transition-colors"
            style={{ borderTop: '1px solid var(--border-light)', color: a.danger ? '#f87171' : 'var(--text-primary)' }}>
            <i className={`ti ${a.icon}`} style={{ fontSize: 18, color: a.danger ? '#f87171' : 'var(--text-muted)' }} />
            {a.label}
          </button>
        ))}
        <button onClick={onClose} className="w-full text-center py-4 text-sm" style={{ borderTop: '1px solid var(--border-light)', color: 'var(--text-muted)' }}>Annuler</button>
        <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
      </div>
    </div>
  )
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5 Mo

async function uploadFileToSupabase(file: File, userId: string): Promise<string | null> {
  if (!file.type.startsWith('image/')) {
    toast('Seules les images peuvent être insérées.', 'error')
    return null
  }
  if (file.size > MAX_IMAGE_BYTES) {
    toast('Image trop lourde (max 5 Mo).', 'error')
    return null
  }
  try {
    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const path = `${userId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('images').upload(path, file)
    if (error) throw error
    const { data } = supabase.storage.from('images').getPublicUrl(path)
    return data.publicUrl
  } catch (error) {
    console.error('Erreur upload:', error)
    toast("Échec de l'envoi de l'image — vérifiez votre connexion.", 'error')
    return null
  }
}
function ImageNodeView({ node, editor, getPos }: any) {
  const [hovered, setHovered] = useState(false)
  function insertAfter() {
    if (!editor || typeof getPos !== 'function') return
    const pos = getPos() + node.nodeSize
    editor.chain().focus().insertContentAt(pos, { type: 'paragraph' }).run()
  }
  return (
    <NodeViewWrapper className="relative inline-block w-full">
      <div
        className="relative"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <img
          src={node.attrs.src}
          alt={node.attrs.alt || ''}
          className="max-w-full rounded-lg"
          style={{ display: 'block', margin: '1.5rem 0' }}
        />
        {hovered && (
          <button
            onClick={insertAfter}
            contentEditable={false}
            className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center rounded-full shadow-md text-sm font-bold transition-all"
            style={{
              bottom: '-14px',
              width: '28px',
              height: '28px',
              background: 'var(--card-bg)',
              border: '1.5px solid var(--border)',
              color: 'var(--text-muted)',
              zIndex: 10,
              cursor: 'pointer',
            }}
            title="Ajouter un bloc après"
          ><i className="ti ti-plus" /></button>
        )}
      </div>
    </NodeViewWrapper>
  )
}
// Distance entre le bas d'un tableau et le « + » d'ajout de bloc : sous la
// ligne fantôme d'ajout de ligne (6px + 18px), avec de l'air. Doit tenir dans
// la marge basse de `.tableWrapper` (bureau).
const TABLE_PLUS_OFFSET = 30
const PLUS_SIZE = 22

// Le « + » d'ajout de bloc vit dans la marge gauche, centré sur la limite
// basse du bloc survolé : les blocs ne sont séparés que de 8 à 10px, aucun
// bouton n'y tient, et centré sur le texte il en masquait la dernière ligne.
// Sous un tableau, il descend sous la ligne fantôme « ajouter une ligne ».
function plusTop(block: Element): number {
  const bottom = block.getBoundingClientRect().bottom
  return block.classList.contains('tableWrapper') ? bottom + TABLE_PLUS_OFFSET : bottom - PLUS_SIZE / 2
}

function EditorZone({ editor, page, pages, onNavigate, isMobile }: any) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [plusPos, setPlusPos] = useState<{ top: number; blockEl: Element } | null>(null)
  const plusRef = useRef<HTMLButtonElement>(null)
  const plusBlockRef = useRef<Element | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container || !editor) return

    function onMouseMove(e: MouseEvent) {
      if (!editor) return
      const el = document.elementFromPoint(e.clientX, e.clientY)
      if (!el) return
      // Ignore le bouton + lui-même
      if (plusRef.current?.contains(el as Node)) return
      // On garde le « + » tant que la souris va vers lui : vers la marge
      // gauche, ou vers le bas pour un tableau.
      const prev = plusBlockRef.current
      if (prev?.isConnected) {
        const r = prev.getBoundingClientRect()
        const bottom = plusTop(prev) + PLUS_SIZE
        if (e.clientY >= r.top && e.clientY <= bottom && e.clientX < r.left) return
        if (prev.classList.contains('tableWrapper') && e.clientY > r.bottom && e.clientY <= bottom) return
      }

      const proseMirror = container.querySelector('.ProseMirror')
      if (!proseMirror) return

      // Trouve le bloc direct de ProseMirror le plus proche
      const block = (el as HTMLElement).closest(
        '.ProseMirror > p, .ProseMirror > h1, .ProseMirror > h2, .ProseMirror > h3, .ProseMirror > ul, .ProseMirror > ol, .ProseMirror > blockquote, .ProseMirror > pre, .ProseMirror > hr, .ProseMirror > .tableWrapper, .ProseMirror > [data-type="taskList"]'
      )
      if (!block) {
        plusBlockRef.current = null
        setPlusPos(null)
        return
      }

      const containerRect = container.getBoundingClientRect()
      plusBlockRef.current = block
      setPlusPos({ top: plusTop(block) - containerRect.top + container.scrollTop, blockEl: block })
    }

function onMouseLeave(e: MouseEvent) {
  if (plusRef.current?.contains(e.relatedTarget as Node)) return
  // Passage sur les contrôles du tableau (hors de ce conteneur).
  if ((e.relatedTarget as HTMLElement | null)?.closest?.('[data-table-ctl]')) return
  // Laisser un délai pour que le curseur puisse atteindre le bouton
  setTimeout(() => {
    if (!plusRef.current?.matches(':hover')) setPlusPos(null)
  }, 200)
}

    container.addEventListener('mousemove', onMouseMove)
    container.addEventListener('mouseleave', onMouseLeave)
    return () => {
      container.removeEventListener('mousemove', onMouseMove)
      container.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [editor])

  function insertAfterBlock() {
    if (!editor || !plusPos) return
    const proseMirror = containerRef.current?.querySelector('.ProseMirror')
    if (!proseMirror) return
    // Trouve la position ProseMirror du nœud correspondant
    const blockEl = plusPos.blockEl
    const pos = editor.view.posAtDOM(blockEl, 0)
    const resolved = editor.state.doc.resolve(pos)
    const nodeEnd = resolved.node(1) ? resolved.before(1) + resolved.node(1).nodeSize : pos
    editor.chain().focus().insertContentAt(nodeEnd, { type: 'paragraph' }).run()
    setPlusPos(null)
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto relative">
      <EditorContent
        editor={editor}
        className="prose max-w-none py-6 md:py-6"
        style={{ paddingLeft: isMobile ? '16px' : '52px', paddingRight: isMobile ? '16px' : '52px' }}
      />
      {plusPos && !isMobile && (
        <button
          ref={plusRef}
          onClick={insertAfterBlock}
          onMouseEnter={() => {}}
          onMouseLeave={() => setPlusPos(null)}
          className="absolute flex items-center justify-center rounded-full shadow-md transition-all pointer-events-auto"
          style={{
            top: `${plusPos.top}px`,
            left: 6,
            width: PLUS_SIZE,
            height: PLUS_SIZE,
            fontSize: 14,
            background: 'var(--card-bg)',
            border: '1.5px solid var(--border)',
            color: 'var(--text-muted)',
            zIndex: 10,
            cursor: 'pointer',
          }}
          title="Ajouter un bloc après"
        ><i className="ti ti-plus" /></button>
      )}
      <Backlinks currentPage={page} pages={pages} onNavigate={onNavigate} />
    </div>
  )
}
export default function Editor({ page, pages, onUpdate, onAddSubpage, onNavigate, onCreatePage, userId, isMobile, focusMode }: {
  page: Page, pages: Page[], onUpdate: (content: string) => void
  onAddSubpage: () => void, onNavigate: (page: Page) => void, userId: string, isMobile: boolean
  // Crée une page et la renvoie, sans y naviguer : on est en train d'écrire ici.
  onCreatePage?: (title: string, parentId: string | null) => Promise<Page | null>
  focusMode?: boolean
}) {
  // `null` = fermée. Une chaîne = ouverte, avec cette saisie initiale — `[[`
  // sur une sélection la pré-remplit du texte sélectionné.
  const [linkQuery, setLinkQuery] = useState<string | null>(null)
  const [creatingPage, setCreatingPage] = useState(false)

  const [showTableSheet, setShowTableSheet] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [wordCount, setWordCount] = useState(0)
  const [headings, setHeadings] = useState<{ level: number; text: string; idx: number }[]>([])
  const [tocOpen, setTocOpen] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Ancrage de la barre de style : bas de la zone visible, moins la place de
  // la barre d'accessoires iOS posée au-dessus du clavier.
  const kbAnchor = useKeyboardBarAnchor()
  // La barre de style mobile n'a de sens que pendant l'édition : elle flotte
  // alors juste au-dessus du clavier. Le retard au blur évite qu'un appui sur
  // un bouton (qui sort brièvement du champ) la fasse disparaître sous le
  // doigt.
  const [editing, setEditing] = useState(false)
  // Pastille mobile : 9 actions courantes visibles, « … » bascule la rangée
  // sur les autres.
  const [moreTools, setMoreTools] = useState(false)
  // Barre desktop : autant d'actions que la largeur du volet en permet, le
  // reste dans le menu « ⋯ » — tant que tout tient, aucun « ⋯ ». Les
  // largeurs viennent d'une copie invisible de la barre complète : la barre
  // visible, une fois repliée, ne peut plus dire combien il lui manquait.
  const [fitCount, setFitCount] = useState(Infinity)
  const desktopBarRef = useRef<HTMLDivElement>(null)
  const measureRowRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const bar = desktopBarRef.current, row = measureRowRef.current
    if (isMobile || !bar || !row) return
    function measure() {
      if (!bar || !row) return
      const GAP = 2, MORE = 9 + 36 + 2 * GAP // séparateur, bouton « ⋯ » et leurs espacements
      const style = getComputedStyle(bar)
      const avail = bar.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      const widths = Array.from(row.children).map(c => c.getBoundingClientRect().width)
      const total = widths.reduce((sum, w) => sum + w, 0) + GAP * Math.max(0, widths.length - 1)
      if (total <= avail) { setFitCount(Infinity); return }
      let used = 0, n = 0
      for (const w of widths) {
        if (used + w + GAP + MORE > avail) break
        used += w + GAP; n++
      }
      setFitCount(n)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(bar)
    ro.observe(row)
    return () => ro.disconnect()
  }, [isMobile])
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (blurTimerRef.current) clearTimeout(blurTimerRef.current) }, [])
  // On repart replié à chaque nouvelle session d'édition.
  useEffect(() => { if (!editing) setMoreTools(false) }, [editing])
  function onEditorFocus() {
    if (blurTimerRef.current) { clearTimeout(blurTimerRef.current); blurTimerRef.current = null }
    setEditing(true)
  }
  function onEditorBlur() {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current)
    blurTimerRef.current = setTimeout(() => { blurTimerRef.current = null; setEditing(false) }, 200)
  }

  const subpageExtension = useMemo(
    () => createSubpageExtension(pages, onNavigate),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pages.map(p => p.id + p.title + p.icon).join(',')]
  )

  const wikiPagesRef = useRef(pages)
  useEffect(() => { wikiPagesRef.current = pages }, [pages])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const wikiLinkExtension = useMemo(() => createWikiLinkExtension(wikiPagesRef, onNavigate), [])
  // Collage d'une adresse sur une sélection, `[[` sur une sélection, ⌘K. La
  // référence aux pages est partagée avec l'extension wiki : le plugin est
  // créé une fois, mais lit toujours la bibliothèque à jour.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const linkOnSelection = useMemo(
    () => createLinkOnSelection({ pagesRef: wikiPagesRef, openPicker: q => setLinkQuery(q) }),
    []
  )

  function updateStats(ed: any) {
    const text = ed.state.doc.textContent || ''
    setWordCount(text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0)
    const h: { level: number; text: string; idx: number }[] = []
    let i = 0
    ed.state.doc.forEach((node: any) => {
      if (node.type.name === 'heading') h.push({ level: node.attrs.level, text: node.textContent, idx: i++ })
    })
    setHeadings(h)
  }

  const editor = useEditor({
    extensions: [
      StarterKit,
      TypographyShortcuts,
      Underline,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: 'Écris quelque chose ou tape / pour les commandes...' }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: null },
        protocols: ['https', 'http', '#'],
      }).extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            'data-page-id': { default: null },
            class: { default: null },
          }
        },
      }),
      Table.configure({ resizable: !isMobile }),
      // Cellules colorées : attribut backgroundColor sérialisé en data-bg +
      // style inline (l'inline l'emporte sur le survol de ligne du CSS).
      TableHeader.extend({ addAttributes() { return { ...this.parent?.(), ...cellBackgroundAttr } } }),
      TableCell.extend({ addAttributes() { return { ...this.parent?.(), ...cellBackgroundAttr } } }),
      TableRow,
      subpageExtension,
      wikiLinkExtension,
      linkOnSelection,
      CalloutExtension,
Image.extend({
  addAttributes() {
    return { ...this.parent?.(), class: { default: null } }
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView)
  },
  addProseMirrorPlugins() {
    return [new Plugin({
      props: {
        handlePaste(view, event) {
          const items = Array.from(event.clipboardData?.items || [])
          for (const item of items) {
            if (item.type.indexOf('image') === 0) {
              event.preventDefault()
              const file = item.getAsFile()
              if (file) {
                setUploading(true)
                uploadFileToSupabase(file, userId).then(url => {
                  if (url) view.dispatch(view.state.tr.replaceSelectionWith(view.state.schema.nodes.image.create({ src: url })))
                  setUploading(false)
                })
              }
              return true
            }
          }
          return false
        },
        handleDrop(view, event) {
          const images = Array.from(event.dataTransfer?.files || []).filter(f => /image/i.test(f.type))
          if (!images.length) return false
          event.preventDefault()
          const coords = view.posAtCoords({ left: event.clientX, top: event.clientY })
          images.forEach(file => {
            setUploading(true)
            uploadFileToSupabase(file, userId).then(url => {
              if (url && coords) view.dispatch(view.state.tr.insert(coords.pos, view.state.schema.nodes.image.create({ src: url })))
              setUploading(false)
            })
          })
          return true
        }
      }
    })]
  }
}),
      SlashCommands.configure({
        onAddSubpage,
        pages,
        onUploadImage: () => fileInputRef.current?.click(),
        onInsertSubpage: (pageId: string) => {
          if (editor) insertSubpageBlock(editor, pageId)
        },
      }),
      PillMark,
      ...(!isMobile ? [DragHandleExtension, TableControlsExtension] : []),
    ],
    content: page.content || '',
    onCreate: ({ editor: ed }) => { updateStats(ed) },
    onUpdate: ({ editor: ed }) => { onUpdate(ed.getHTML()); updateStats(ed) },
    onFocus: () => onEditorFocus(),
    onBlur: () => onEditorBlur(),
  })

  // Initialise les stats dès que l'éditeur est prêt (plus fiable qu'onCreate seul)
  useEffect(() => {
    if (editor) updateStats(editor)
  }, [editor]) // eslint-disable-line react-hooks/exhaustive-deps

  // En-tête de tableau sticky sans double barre : on marque `.table-fits` les
  // wrappers dont le tableau tient dans la largeur → le CSS repasse alors le
  // wrapper en overflow visible et rend l'en-tête sticky (sur le panneau de la
  // page). Les tableaux plus larges gardent le scroll horizontal, sans sticky.
  useEffect(() => {
    if (!editor) return
    const root = editor.view.dom as HTMLElement
    function syncTableFit() {
      root.querySelectorAll('.tableWrapper').forEach(w => {
        const wrap = w as HTMLElement
        const table = wrap.querySelector('table')
        if (!table) return
        // tolérance de 1px pour les arrondis sub-pixel
        wrap.classList.toggle('table-fits', table.scrollWidth <= wrap.clientWidth + 1)
      })
    }
    syncTableFit()
    const ro = new ResizeObserver(syncTableFit)
    ro.observe(root)
    editor.on('update', syncTableFit)
    window.addEventListener('resize', syncTableFit)
    return () => {
      ro.disconnect()
      editor.off('update', syncTableFit)
      window.removeEventListener('resize', syncTableFit)
    }
  }, [editor])

  useEffect(() => {
    if (editor && editor.getHTML() !== (page.content || '')) {
      editor.commands.setContent(page.content || '', false)
    }
  }, [page.id])

  // Ouvre le sélecteur pré-rempli du texte sélectionné : le plus souvent, la
  // page cherchée porte un titre proche des mots qu'on vient de sélectionner.
  // Les quatre déclencheurs (barre d'outils, barre de sélection, ⌘K, `[[`)
  // passent par ici, pour qu'ils se comportent tous pareil.
  function openLinkPicker() {
    const sel = editor?.state.selection
    const text = sel && !sel.empty ? editor!.state.doc.textBetween(sel.from, sel.to, ' ').trim() : ''
    // Au-delà d'une poignée de mots, la sélection est une phrase et non le nom
    // d'une page : la pré-remplir ne rendrait service à personne.
    setLinkQuery(text.split(/\s+/).length <= 5 && text.length <= 60 ? text : '')
  }

  // Pose le lien sur la sélection, sans toucher au texte : contrairement à
  // `[[` et à la commande `/`, qui insèrent le titre de la page, on conserve
  // la formulation de l'auteur.
  function linkToPage(id: string) {
    editor?.chain().focus()
      .setLink({ href: `#${id}`, 'data-page-id': id, class: 'page-link', target: null, rel: null } as any)
      .run()
  }

  async function applyLink(choice: LinkChoice) {
    if (choice.kind === 'create') {
      if (!onCreatePage) return
      setCreatingPage(true)
      // La nouvelle page devient une sous-page de celle où l'on écrit : à la
      // racine, elle serait orpheline et introuvable autrement que par le lien
      // qu'on vient de poser. Une entrée de journal, elle, n'a pas d'enfants
      // dans l'arborescence — sa page va donc à la racine.
      const created = await onCreatePage(choice.title, page.type === 'journal' ? null : page.id)
      setCreatingPage(false)
      setLinkQuery(null)
      if (created) linkToPage(created.id)
      return
    }
    setLinkQuery(null)
    if (choice.kind === 'page') {
      linkToPage(choice.page.id)
    } else {
      editor?.chain().focus().setLink({ href: choice.href }).run()
    }
  }

  useEffect(() => {
    if (!editor) return
    const el = editor.view.dom

    function handleNav(target: HTMLElement) {
      const link = target.closest('[data-page-id]') as HTMLElement | null
      if (!link) return
      const pageId = link.getAttribute('data-page-id')
      const linked = pages.find(p => p.id === pageId)
      if (linked) onNavigate(linked)
    }

    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (target.closest('[data-page-id]')) {
        e.preventDefault()
        handleNav(target)
        return
      }
      const anchor = target.closest('a') as HTMLAnchorElement | null
      if (anchor?.href && !anchor.getAttribute('data-page-id')) {
        e.preventDefault()
        window.open(anchor.href, '_blank', 'noopener,noreferrer')
      }
    }

    function onTouchEnd(e: TouchEvent) {
      handleNav(e.target as HTMLElement)
    }

    el.addEventListener('click', onClick)
    el.addEventListener('touchend', onTouchEnd)
    return () => {
      el.removeEventListener('click', onClick)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [editor, pages, onNavigate])

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !editor) return
    setUploading(true)
    try {
      const url = await uploadFileToSupabase(file, userId)
      if (url) editor.chain().focus().setImage({ src: url }).run()
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Trait court et centré plutôt que pleine hauteur : dans la pastille
  // mobile, un séparateur pleine hauteur la découpe en segments et fait
  // lourd.
  const Sep = () => <div className="toolbar-sep w-px self-center flex-shrink-0 mx-1" style={{ height: 18, background: 'var(--sidebar-border)', opacity: 0.7 }} />

  // Ordre d'usage : ce qu'on applique le plus souvent en écrivant une note
  // reste visible, le reste attend derrière « … » — une pastille de 19
  // actions obligeait à la faire défiler pour atteindre la moitié d'entre
  // elles.
  const toolbarMobilePrimary = (
    <>
      <ToolBtn onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive('bold')} label={<i className="ti ti-bold" />} title="Gras" />
      <ToolBtn onClick={() => editor?.chain().focus().toggleItalic().run()} active={editor?.isActive('italic')} label={<i className="ti ti-italic" />} title="Italique" />
      <Sep />
      <ToolBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} active={editor?.isActive('heading', { level: 1 })} label={<i className="ti ti-h-1" />} title="Titre 1" />
      <ToolBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} active={editor?.isActive('heading', { level: 2 })} label={<i className="ti ti-h-2" />} title="Titre 2" />
      <Sep />
      <ToolBtn onClick={() => editor?.chain().focus().toggleBulletList().run()} active={editor?.isActive('bulletList')} label={<i className="ti ti-list" />} title="Liste" />
      <ToolBtn onClick={() => (editor?.chain().focus() as any).toggleTaskList().run()} active={editor?.isActive('taskList')} label={<i className="ti ti-list-check" />} title="Cases à cocher" />
      <ToolBtn onClick={openLinkPicker} active={editor?.isActive('link')} label={<i className="ti ti-link" />} title="Lien" />
      <ToolBtn onClick={() => fileInputRef.current?.click()} active={false} label={<i className={`ti ${uploading ? 'ti-loader-2 animate-spin' : 'ti-photo'}`} />} title="Image" />
      <ToolBtn
        onClick={() => editor?.isActive('table') ? setShowTableSheet(true) : editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        active={editor?.isActive('table')} label={<i className="ti ti-table" />} title="Tableau" />
    </>
  )

  // Remplace la rangée principale au lieu de s'ouvrir dessous : une seconde
  // rangée à moitié vide faisait sauter la pastille au-dessus du clavier.
  const toolbarMobileSecondary = (
    <>
      <ToolBtn onClick={() => editor?.chain().focus().toggleUnderline().run()} active={editor?.isActive('underline')} label={<i className="ti ti-underline" />} title="Souligné" />
      <ToolBtn onClick={() => editor?.chain().focus().toggleStrike().run()} active={editor?.isActive('strike')} label={<i className="ti ti-strikethrough" />} title="Barré" />
      <ToolBtn onClick={() => editor?.chain().focus().toggleCode().run()} active={editor?.isActive('code')} label={<i className="ti ti-code" />} title="Code en ligne" />
      <ToolBtn onClick={() => editor?.chain().focus().toggleBlockquote().run()} active={editor?.isActive('blockquote')} label={<i className="ti ti-quote" />} title="Citation" />
      <Sep />
      <ToolBtn onClick={() => editor?.chain().focus().toggleOrderedList().run()} active={editor?.isActive('orderedList')} label={<i className="ti ti-list-numbers" />} title="Numérotée" />
      <ToolBtn onClick={() => editor?.chain().focus().toggleCodeBlock().run()} active={editor?.isActive('codeBlock')} label={<i className="ti ti-source-code" />} title="Bloc de code" />
      <Sep />
      <ToolBtn onClick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()} active={false}
        label={<i className="ti ti-clear-formatting" />} title="Effacer la mise en forme" />
      <Sep />
      <PillMenu editor={editor} up />
    </>
  )

  // Une entrée par bouton (ou séparateur), dans l'ordre d'usage : ce qui ne
  // tient pas passe dans « ⋯ » en partant de la fin.
  const desktopItems: { key: string; node: ReactNode; sep?: boolean }[] = [
    { key: 'bold', node: <ToolBtn onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive('bold')} label={<i className="ti ti-bold" />} title="Gras" /> },
    { key: 'italic', node: <ToolBtn onClick={() => editor?.chain().focus().toggleItalic().run()} active={editor?.isActive('italic')} label={<i className="ti ti-italic" />} title="Italique" /> },
    { key: 'underline', node: <ToolBtn onClick={() => editor?.chain().focus().toggleUnderline().run()} active={editor?.isActive('underline')} label={<i className="ti ti-underline" />} title="Souligné" /> },
    { key: 'strike', node: <ToolBtn onClick={() => editor?.chain().focus().toggleStrike().run()} active={editor?.isActive('strike')} label={<i className="ti ti-strikethrough" />} title="Barré" /> },
    { key: 's1', node: <Sep />, sep: true },
    { key: 'h1', node: <ToolBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} active={editor?.isActive('heading', { level: 1 })} label={<i className="ti ti-h-1" />} title="Titre 1" /> },
    { key: 'h2', node: <ToolBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} active={editor?.isActive('heading', { level: 2 })} label={<i className="ti ti-h-2" />} title="Titre 2" /> },
    { key: 's2', node: <Sep />, sep: true },
    { key: 'bullet', node: <ToolBtn onClick={() => editor?.chain().focus().toggleBulletList().run()} active={editor?.isActive('bulletList')} label={<i className="ti ti-list" />} title="Liste à puces" /> },
    { key: 'ordered', node: <ToolBtn onClick={() => editor?.chain().focus().toggleOrderedList().run()} active={editor?.isActive('orderedList')} label={<i className="ti ti-list-numbers" />} title="Liste numérotée" /> },
    { key: 'task', node: <ToolBtn onClick={() => (editor?.chain().focus() as any).toggleTaskList().run()} active={editor?.isActive('taskList')} label={<i className="ti ti-list-check" />} title="Cases à cocher" /> },
    { key: 's3', node: <Sep />, sep: true },
    { key: 'quote', node: <ToolBtn onClick={() => editor?.chain().focus().toggleBlockquote().run()} active={editor?.isActive('blockquote')} label={<i className="ti ti-quote" />} title="Citation" /> },
    { key: 'link', node: <ToolBtn onClick={openLinkPicker} active={editor?.isActive('link')} label={<i className="ti ti-link" />} title="Lien" /> },
    { key: 'image', node: <ToolBtn onClick={() => fileInputRef.current?.click()} active={false} label={<i className={`ti ${uploading ? 'ti-loader-2 animate-spin' : 'ti-photo'}`} />} title="Image" /> },
    { key: 'table', node: <ToolBtn onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} active={editor?.isActive('table')} label={<i className="ti ti-table" />} title="Tableau 3×3" /> },
    // Surlignage : n'existait que dans la barre de sélection, donc
    // inatteignable tant qu'on n'avait pas déjà sélectionné du texte.
    { key: 'pill', node: <PillMenu editor={editor} /> },
    { key: 's4', node: <Sep />, sep: true },
    { key: 'codeBlock', node: <ToolBtn onClick={() => editor?.chain().focus().toggleCodeBlock().run()} active={editor?.isActive('codeBlock')} label={<i className="ti ti-source-code" />} title="Bloc de code" /> },
    // Remet la sélection en texte nu : `unsetAllMarks` retire gras, italique,
    // couleurs, liens ; `clearNodes` ramène titres, listes et citations au
    // paragraphe. Il fallait sinon désactiver chaque style un par un, en
    // devinant lesquels étaient posés.
    { key: 'clear', node: <ToolBtn onClick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()} active={false}
        label={<i className="ti ti-clear-formatting" />} title="Effacer la mise en forme" /> },
  ]
  // Pas de séparateur orphelin en bout de barre ni en tête du menu.
  const trimSeps = (items: typeof desktopItems) => {
    let a = 0, b = items.length
    while (a < b && items[a].sep) a++
    while (b > a && items[b - 1].sep) b--
    return items.slice(a, b)
  }
  const desktopVisible = trimSeps(desktopItems.slice(0, fitCount))
  const desktopOverflow = trimSeps(desktopItems.slice(fitCount))

  return (
    <div className={`flex flex-col flex-1${isMobile ? ' overflow-hidden' : ''}${focusMode ? ' focus-mode-content' : ''}`}>
      {linkQuery !== null && (
        <LinkPicker pages={pages} initialQuery={linkQuery} busy={creatingPage}
          onPick={applyLink} onClose={() => { if (!creatingPage) setLinkQuery(null) }} />
      )}
      {showTableSheet && isMobile && <TableBottomSheet editor={editor} onClose={() => setShowTableSheet(false)} />}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

      {editor && (
        <BubbleMenu
          editor={editor}
          pluginKey="formatMenu"
          shouldShow={({ editor, state }) => {
            // Sur mobile, une barre flottant près de la sélection est perdue
            // d'avance : iOS pose son menu Couper/Copier/Coller exactement au
            // même endroit, et la largeur d'un téléphone ne suffit pas — les
            // couleurs sortaient de l'écran. Tout passe par la barre ancrée
            // au-dessus du clavier, qui a désormais les mêmes actions.
            if (isMobile) return false
            const { selection } = state
            const { empty } = selection
            // Sélection de texte (y compris dans une cellule) → mise en forme.
            // Sélection de cellules → c'est la barre Tableau qui prend le relais.
            if (selection instanceof CellSelection) return false
            return !empty
          }}
          tippyOptions={{ placement: 'top', offset: [0, 8], animation: 'fade', maxWidth: 'none' }}
        >
          {/* Mêmes boutons, mêmes séparateurs et mêmes pastilles que la barre
              collante : seule la surface diffère (pastille flottante), via
              `.editor-toolbar-bubble`. Tout était auparavant réécrit ici en
              dur — d'où deux barres qui divergeaient à chaque retouche. */}
          <div className="editor-toolbar editor-toolbar-bubble flex items-center gap-0.5 px-1.5 py-1.5">
            <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} label={<i className="ti ti-bold" />} title="Gras" />
            <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} label={<i className="ti ti-italic" />} title="Italique" />
            <ToolBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} label={<i className="ti ti-underline" />} title="Souligné" />
            <ToolBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} label={<i className="ti ti-strikethrough" />} title="Barré" />
            <Sep />
            <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} label={<i className="ti ti-h-1" />} title="Titre 1" />
            <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} label={<i className="ti ti-h-2" />} title="Titre 2" />
            <Sep />
            <ToolBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} label={<i className="ti ti-quote" />} title="Citation" />
            {/* Sur une sélection, « code » veut dire code en ligne — le bloc de
                code, lui, s'applique depuis la barre collante. */}
            <ToolBtn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} label={<i className="ti ti-code" />} title="Code en ligne" />
            <Sep />
            <ToolBtn
              onClick={() => {
                if (editor.isActive('link')) editor.chain().focus().unsetLink().run()
                else openLinkPicker()
              }}
              active={editor.isActive('link')} label={<i className={`ti ${editor.isActive('link') ? 'ti-link-off' : 'ti-link'}`} />}
              title={editor.isActive('link') ? 'Retirer le lien' : 'Ajouter un lien'} />
            <Sep />
            <PillMenu editor={editor} up />
            <Sep />
            <ToolBtn onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} active={false}
              label={<i className="ti ti-clear-formatting" />} title="Effacer la mise en forme" />
          </div>
        </BubbleMenu>
      )}


      {/* Barre de style desktop, collante sous l'en-tête de note (44px,
          `--table-sticky-top`) : sur une note longue elle partait avec le
          défilement, et il fallait remonter en haut pour changer un style. */}
      {!isMobile && (
        // Pas de défilement : le repli garantit que tout tient, et un
        // conteneur qui défile rognerait les menus (surlignage, « ⋯ »).
        <div ref={desktopBarRef}
          className="editor-toolbar sticky z-10 flex items-center gap-0.5 px-2 flex-shrink-0 flex-nowrap"
          style={{ minHeight: '48px', top: 'var(--table-sticky-top, 44px)', overflow: 'visible' }}>
          {desktopVisible.map(i => <Fragment key={i.key}>{i.node}</Fragment>)}
          {desktopOverflow.length > 0 && (
            <>
              <Sep />
              <MoreMenu>{desktopOverflow.map(i => <Fragment key={i.key}>{i.node}</Fragment>)}</MoreMenu>
            </>
          )}
          {/* Copie invisible de la barre complète, pour mesurer chaque bouton. */}
          <div ref={measureRowRef} aria-hidden className="absolute left-0 top-0 flex items-center gap-0.5 flex-nowrap"
            style={{ visibility: 'hidden', pointerEvents: 'none', height: 0, overflow: 'hidden', width: 'max-content' }}>
            {desktopItems.map(i => <Fragment key={i.key}>{i.node}</Fragment>)}
          </div>
        </div>
      )}
      {!isMobile && headings.length >= 2 && (
        <div className="flex-shrink-0 px-[52px] py-2" style={{ borderBottom: '1px solid var(--border-light)' }}>
          <button
            onClick={() => setTocOpen(v => !v)}
            className="flex items-center gap-1.5 text-xs font-medium mb-1.5 transition-opacity hover:opacity-100 opacity-60"
            style={{ color: 'var(--text-secondary)' }}
          >
            <span style={{ fontSize: '9px' }}><i className={`ti ${tocOpen ? 'ti-chevron-down' : 'ti-chevron-right'}`} /></span>
            Table des matières
          </button>
          {tocOpen && (
            <div className="flex flex-col gap-0.5">
              {headings.map((h, i) => (
                <button
                  key={i}
                  onClick={() => {
                    const els = document.querySelectorAll('.ProseMirror h1, .ProseMirror h2, .ProseMirror h3')
                    els[h.idx]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                  className="text-xs text-left transition-opacity hover:opacity-100 opacity-55 truncate"
                  style={{ paddingLeft: `${(h.level - 1) * 14}px`, color: 'var(--text-secondary)' }}
                >
                  {h.text || '—'}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
{/* Assez de marge sous le texte pour que sa dernière ligne puisse toujours
          remonter au-dessus du clavier, de la barre d'accessoires iOS et de
          notre barre de style — sinon la fin d'une note reste inatteignable. */}
      <div style={isMobile && editing ? { paddingBottom: kbAnchor.hidden + 64 } : undefined}>
        <EditorZone editor={editor} page={page} pages={pages} onNavigate={onNavigate} isMobile={isMobile} />
      </div>

      {/* Barre de style mobile : fixée juste au-dessus du clavier pendant
          l'édition, et masquée le reste du temps. Elle était `sticky` dans le
          flux du document, donc collée au bas de la page : hors écran tant
          qu'on n'avait pas fait défiler la note jusqu'au bout — inatteignable
          au moment précis où l'on écrit. `onMouseDown` neutralisé pour que
          l'appui ne sorte pas du champ (sinon le clavier se referme et la
          barre s'en va sous le doigt). */}
      {isMobile && editing && (
        <div className="editor-toolbar editor-toolbar-pill flex items-center gap-0.5 px-1.5 flex-nowrap overflow-x-auto"
          onMouseDown={e => e.preventDefault()}
          style={{
            position: 'fixed',
            left: 8,
            right: 8,
            // Ancrée par son bas sur le bas de la zone visible (d'où le
            // translate) : `top` seul suffit alors, quelle que soit la
            // hauteur réelle de la barre. Les 8px du translate la décollent
            // de la barre d'accessoires iOS posée juste en dessous.
            ...(kbAnchor.bottom != null
              ? { top: kbAnchor.bottom, transform: 'translateY(calc(-100% - 8px))' }
              : { bottom: 8 }),
            zIndex: 45,
            minHeight: '40px',
            transition: 'top 0.2s ease',
          }}>
          {moreTools ? toolbarMobileSecondary : toolbarMobilePrimary}
          {/* Ressort : garde le bouton de bascule calé à droite du rang. */}
          <div className="flex-1 min-w-0" />
          <ToolBtn onClick={() => setMoreTools(v => !v)} active={moreTools}
            label={<i className={`ti ${moreTools ? 'ti-x' : 'ti-dots'}`} />} title={moreTools ? 'Revenir aux actions courantes' : 'Plus d\'options'} />
        </div>
      )}

      {wordCount > 0 && !isMobile && (
        <div className="flex-shrink-0 flex justify-end px-[52px] py-2" style={{ borderTop: '1px solid var(--border-light)' }}>
          <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
            {wordCount} mot{wordCount > 1 ? 's' : ''} · {Math.max(1, Math.ceil(wordCount / 200))} min
          </span>
        </div>
      )}
      <style>{`
        /* Largeur adaptée au contenu : les colonnes courtes restent étroites,
           les longues plafonnent et passent à la ligne, et le tableau peut
           dépasser la largeur de la note (défilement dans le cadre). */
        .ProseMirror table { border-collapse: collapse; table-layout: auto; width: max-content; min-width: 100%; margin: 0; }
        .ProseMirror table td, .ProseMirror table th {
          min-width: 6ch;
          border: 1px solid var(--prose-table-border);
          padding: 6px 10px; vertical-align: top;
          box-sizing: border-box; position: relative; font-size: 0.9em;
          color: var(--prose-color);
          overflow-wrap: break-word; word-break: break-word;
        }
        /* Cap de largeur sur le contenu → colonne longue repliée, courtes
           gardées ; max-width sur td étant ignoré en dimensionnement auto. */
        .ProseMirror table td > *, .ProseMirror table th > * { max-width: 22rem; margin: 0; }
        .ProseMirror table th {
          background-color: var(--prose-table-th); font-weight: 600; text-align: left;
        }
        .ProseMirror table tr:hover td { background-color: var(--prose-row-hover); }
        .ProseMirror table .selectedCell:after {
          z-index: 2; position: absolute; content: "";
          left: 0; right: 0; top: 0; bottom: 0;
          background: rgba(96,165,250,0.1); pointer-events: none;
        }
        .ProseMirror table .column-resize-handle {
          position: absolute; right: -2px; top: 0; bottom: 0;
          width: 4px; background-color: var(--prose-link); cursor: col-resize; z-index: 20;
        }
        /* Défilement HORIZONTAL seulement → une seule barre verticale (page). */
        .ProseMirror .tableWrapper { overflow-x: auto; margin: 1rem 0; }
        /* Bureau : place pour la ligne fantôme d'ajout et le « + » de bloc. */
        @media (hover: hover) and (pointer: fine) { .ProseMirror .tableWrapper { margin-bottom: 64px; } }
        /* En-tête sticky quand le tableau tient (classe .table-fits posée en
           JS) : wrapper en overflow visible → sticky résolu sur le panneau. */
        .ProseMirror .tableWrapper.table-fits { overflow: visible; }
        .ProseMirror .tableWrapper.table-fits th {
          position: sticky; top: var(--table-sticky-top, 44px); z-index: 2;
          box-shadow: inset 0 -1px 0 var(--prose-table-border);
        }
        .resize-cursor { cursor: col-resize; }
        .ProseMirror img { max-width: 100%; height: auto; border-radius: 8px; margin: 1.5rem 0; display: block; }
        .ProseMirror a {
          color: var(--prose-link);
          text-decoration: none;
          border-radius: 3px;
          padding: 0 2px;
          transition: color 0.15s, background 0.15s;
          cursor: pointer;
        }
        .ProseMirror a:hover {
          color: var(--prose-link-hover);
          background: var(--hover-bg);
        }
        .ProseMirror a.page-link {
          color: var(--pagelink-fg);
          text-decoration: none;
          background: var(--pagelink-bg);
          border-radius: 5px;
          padding: 6px 8px;
          font-weight: 500;
          cursor: pointer;
        }
        .ProseMirror a.page-link:hover {
          background: var(--pagelink-hover);
          color: var(--pagelink-fg);
        }
        .ProseMirror ul[data-type="taskList"] { list-style: none; padding-left: 0.25rem; }
        .ProseMirror ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: 0.5rem; }
        .ProseMirror ul[data-type="taskList"] li > label { flex-shrink: 0; margin-top: 0.2rem; cursor: pointer; }
        .ProseMirror ul[data-type="taskList"] li > label input[type="checkbox"] { cursor: pointer; width: 1rem; height: 1rem; }
        .ProseMirror ul[data-type="taskList"] li > div { flex: 1; }
        .ProseMirror ul[data-type="taskList"] li[data-checked="true"] > div { opacity: 0.6; text-decoration: line-through; }
        .drag-handle { margin-left: -28px; padding-right: 8px; }
        @media (max-width: 767px) { .ProseMirror { font-size: 16px; line-height: 1.7; } .ProseMirror p { margin: 0.6em 0; } }
      `}</style>
    </div>
  )
}
