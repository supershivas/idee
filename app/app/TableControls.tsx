'use client'
import { Extension, type Editor } from '@tiptap/core'
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import { EditorView } from '@tiptap/pm/view'
import { CellSelection } from '@tiptap/pm/tables'
import { createRoot } from 'react-dom/client'
import { useState, useEffect, useRef } from 'react'

// Palette de fonds de cellule (partagée avec la feuille mobile d'Editor.tsx).
export const CELL_COLORS: { label: string; value: string | null }[] = [
  { label: 'Aucun', value: null },
  { label: 'Rouge', value: '#fbe4e4' },
  { label: 'Orange', value: '#faebdd' },
  { label: 'Jaune', value: '#fbf3db' },
  { label: 'Vert', value: '#ddedea' },
  { label: 'Bleu', value: '#ddebf1' },
  { label: 'Violet', value: '#eae4f2' },
  { label: 'Gris', value: '#ebeced' },
]

type Rect = { left: number; top: number; width: number; height: number }
type Geometry = {
  table: Rect
  cols: { center: number; index: number }[]
  rows: { center: number; index: number }[]
  colCells: HTMLElement[] // cellule d'en-tête (1re ligne) par colonne
  rowCells: HTMLElement[] // 1re cellule par ligne
}

// Sélectionne toute une colonne (CellSelection) à partir de sa cellule d'en-tête.
// resolve(pos-1) = position juste avant la cellule (nodeAfter === cellule).
function selectColumn(view: EditorView, cellDom: HTMLElement) {
  try {
    const pos = view.posAtDOM(cellDom, 0)
    const $cell = view.state.doc.resolve(pos - 1)
    view.dispatch(view.state.tr.setSelection(CellSelection.colSelection($cell)))
    view.focus()
  } catch (err) { console.warn('selectColumn:', err) }
}
// Sélectionne toute une ligne à partir de sa première cellule.
function selectRow(view: EditorView, cellDom: HTMLElement) {
  try {
    const pos = view.posAtDOM(cellDom, 0)
    const $cell = view.state.doc.resolve(pos - 1)
    view.dispatch(view.state.tr.setSelection(CellSelection.rowSelection($cell)))
    view.focus()
  } catch (err) { console.warn('selectRow:', err) }
}
// Place le curseur dans une cellule (sélection simple).
function putCursorInCell(view: EditorView, cellDom: HTMLElement) {
  try {
    const pos = view.posAtDOM(cellDom, 0)
    view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(pos))))
    view.focus()
  } catch (err) { console.warn('putCursorInCell:', err) }
}

function measure(tableEl: HTMLTableElement): Geometry | null {
  const rows = Array.from(tableEl.rows)
  if (!rows.length) return null
  const headerCells = Array.from(rows[0].cells) as HTMLElement[]
  if (!headerCells.length) return null
  const tRect = tableEl.getBoundingClientRect()
  const cols = headerCells.map((c, index) => {
    const r = c.getBoundingClientRect()
    return { center: r.left + r.width / 2, index }
  })
  const rowInfos = rows.map((tr, index) => {
    const r = tr.getBoundingClientRect()
    return { center: r.top + r.height / 2, index }
  })
  return {
    table: { left: tRect.left, top: tRect.top, width: tRect.width, height: tRect.height },
    cols,
    rows: rowInfos,
    colCells: headerCells,
    rowCells: rows.map(tr => tr.cells[0] as HTMLElement),
  }
}

function IconBtn({ title, onClick, children, danger }: {
  title: string; onClick: () => void; children: React.ReactNode; danger?: boolean
}) {
  return (
    <button
      title={title}
      onMouseDown={e => { e.preventDefault(); e.stopPropagation() }}
      onClick={e => { e.preventDefault(); e.stopPropagation(); onClick() }}
      style={{ pointerEvents: 'auto' }}
      className={`w-6 h-6 flex items-center justify-center rounded text-[12px] transition-colors ${
        danger ? 'text-red-400 hover:bg-red-500/10' : 'hover:bg-white/10'
      }`}
    >{children}</button>
  )
}

function ColorRow({ onPick }: { onPick: (v: string | null) => void }) {
  return (
    <div className="flex items-center gap-1 px-1.5 py-1" style={{ pointerEvents: 'auto' }}>
      {CELL_COLORS.map(c => (
        <button key={c.label} title={c.label}
          onMouseDown={e => { e.preventDefault(); e.stopPropagation() }}
          onClick={e => { e.preventDefault(); e.stopPropagation(); onPick(c.value) }}
          className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center hover:scale-110 transition-transform"
          style={{ background: c.value || 'transparent', border: c.value ? '1px solid rgba(0,0,0,0.15)' : '1px solid rgba(255,255,255,0.3)' }}>
          {c.value === null && <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)' }}>⦸</span>}
        </button>
      ))}
    </div>
  )
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex items-center gap-0.5 rounded-lg shadow-lg px-1 py-0.5"
      style={{ background: '#1f1f22', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)' }}
    >{children}</div>
  )
}

function TableOverlay({ view, editor }: { view: EditorView; editor: Editor }) {
  const [geo, setGeo] = useState<Geometry | null>(null)
  const [hoverCol, setHoverCol] = useState<number | null>(null)
  const [hoverRow, setHoverRow] = useState<number | null>(null)
  const [colorFor, setColorFor] = useState<{ type: 'col' | 'row'; index: number } | null>(null)
  const tableRef = useRef<HTMLTableElement | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function clearHide() { if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null } }
  function scheduleHide() {
    clearHide()
    hideTimer.current = setTimeout(() => {
      setGeo(null); setHoverCol(null); setHoverRow(null); setColorFor(null); tableRef.current = null
    }, 250)
  }

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const target = e.target as HTMLElement
      const tableEl = target.closest('table') as HTMLTableElement | null
      if (!tableEl || !view.dom.contains(tableEl)) {
        // En dehors d'un tableau : masquer (sauf si on survole une poignée).
        if (!(target.closest('[data-table-ctl]'))) scheduleHide()
        return
      }
      clearHide()
      tableRef.current = tableEl
      const g = measure(tableEl)
      if (!g) return
      setGeo(g)
      // Colonne / ligne survolée selon la position de la souris.
      let ci: number | null = null, best = Infinity
      g.cols.forEach(c => { const d = Math.abs(c.center - e.clientX); if (d < best) { best = d; ci = c.index } })
      let ri: number | null = null; best = Infinity
      g.rows.forEach(r => { const d = Math.abs(r.center - e.clientY); if (d < best) { best = d; ri = r.index } })
      setHoverCol(ci); setHoverRow(ri)
    }
    const dom = view.dom
    dom.addEventListener('mousemove', onMove)
    dom.addEventListener('mouseleave', scheduleHide)
    return () => {
      dom.removeEventListener('mousemove', onMove)
      dom.removeEventListener('mouseleave', scheduleHide)
      clearHide()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  if (!geo) return null

  function run(fn: () => void) { fn(); scheduleHide() }

  const colCell = hoverCol != null ? geo.colCells[hoverCol] : null
  const rowCell = hoverRow != null ? geo.rowCells[hoverRow] : null
  const colRect = colCell?.getBoundingClientRect()
  const rowRect = rowCell?.getBoundingClientRect()

  return (
    <>
      {/* Poignée de colonne — au-dessus de la colonne survolée */}
      {colCell && colRect && (
        <div data-table-ctl style={{ position: 'fixed', left: colRect.left + colRect.width / 2, top: geo.table.top - 8, transform: 'translate(-50%, -100%)', zIndex: 60, pointerEvents: 'auto' }}
          onMouseEnter={clearHide} onMouseLeave={scheduleHide}>
          {colorFor?.type === 'col' && colorFor.index === hoverCol ? (
            <Pill><ColorRow onPick={v => run(() => { selectColumn(view, colCell); (editor.chain().focus() as any).setCellAttribute('backgroundColor', v).run() })} /></Pill>
          ) : (
            <Pill>
              <IconBtn title="Insérer une colonne à gauche" onClick={() => run(() => { selectColumn(view, colCell); editor.chain().focus().addColumnBefore().run() })}>＋←</IconBtn>
              <IconBtn title="Insérer une colonne à droite" onClick={() => run(() => { selectColumn(view, colCell); editor.chain().focus().addColumnAfter().run() })}>→＋</IconBtn>
              <IconBtn title="Couleur de la colonne" onClick={() => { selectColumn(view, colCell); setColorFor({ type: 'col', index: hoverCol! }) }}>🎨</IconBtn>
              <IconBtn title="Supprimer la colonne" danger onClick={() => run(() => { selectColumn(view, colCell); editor.chain().focus().deleteColumn().run() })}>🗑</IconBtn>
            </Pill>
          )}
        </div>
      )}

      {/* Poignée de ligne — à gauche de la ligne survolée */}
      {rowCell && rowRect && (
        <div data-table-ctl style={{ position: 'fixed', left: geo.table.left - 8, top: rowRect.top + rowRect.height / 2, transform: 'translate(-100%, -50%)', zIndex: 60, pointerEvents: 'auto' }}
          onMouseEnter={clearHide} onMouseLeave={scheduleHide}>
          {colorFor?.type === 'row' && colorFor.index === hoverRow ? (
            <Pill><ColorRow onPick={v => run(() => { selectRow(view, rowCell); (editor.chain().focus() as any).setCellAttribute('backgroundColor', v).run() })} /></Pill>
          ) : (
            <Pill>
              <IconBtn title="Insérer une ligne au-dessus" onClick={() => run(() => { selectRow(view, rowCell); editor.chain().focus().addRowBefore().run() })}>↑＋</IconBtn>
              <IconBtn title="Insérer une ligne en dessous" onClick={() => run(() => { selectRow(view, rowCell); editor.chain().focus().addRowAfter().run() })}>＋↓</IconBtn>
              <IconBtn title="Couleur de la ligne" onClick={() => { selectRow(view, rowCell); setColorFor({ type: 'row', index: hoverRow! }) }}>🎨</IconBtn>
              <IconBtn title="Supprimer la ligne" danger onClick={() => run(() => { selectRow(view, rowCell); editor.chain().focus().deleteRow().run() })}>🗑</IconBtn>
            </Pill>
          )}
        </div>
      )}

      {/* ＋ Ajouter une colonne — bord droit, au niveau de l'en-tête */}
      {geo.colCells.length > 0 && (() => {
        const last = geo.colCells[geo.colCells.length - 1]
        const r = last.getBoundingClientRect()
        return (
          <button data-table-ctl title="Ajouter une colonne"
            onMouseEnter={clearHide} onMouseLeave={scheduleHide}
            onMouseDown={e => e.preventDefault()}
            onClick={() => run(() => { putCursorInCell(view, last); editor.chain().focus().addColumnAfter().run() })}
            style={{ position: 'fixed', left: geo.table.left + geo.table.width + 4, top: r.top + r.height / 2, transform: 'translateY(-50%)', zIndex: 60, pointerEvents: 'auto' }}
            className="w-5 h-5 flex items-center justify-center rounded-full text-xs shadow"
          ><span style={{ background: '#1f1f22', color: '#fff', width: '100%', height: '100%', borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>＋</span></button>
        )
      })()}

      {/* Supprimer le tableau — coin haut-gauche */}
      <button data-table-ctl title="Supprimer le tableau"
        onMouseEnter={clearHide} onMouseLeave={scheduleHide}
        onMouseDown={e => e.preventDefault()}
        onClick={() => run(() => { if (geo.colCells[0]) putCursorInCell(view, geo.colCells[0]); editor.chain().focus().deleteTable().run() })}
        style={{ position: 'fixed', left: geo.table.left - 6, top: geo.table.top - 6, transform: 'translate(-100%, -100%)', zIndex: 60, pointerEvents: 'auto' }}
        className="w-5 h-5 flex items-center justify-center rounded-md text-[11px] shadow"
      ><span style={{ background: '#1f1f22', color: '#f87171', width: '100%', height: '100%', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🗑</span></button>

      {/* ＋ Ajouter une ligne — bas, à gauche */}
      {geo.rowCells.length > 0 && (() => {
        const last = geo.rowCells[geo.rowCells.length - 1]
        const r = last.getBoundingClientRect()
        return (
          <button data-table-ctl title="Ajouter une ligne"
            onMouseEnter={clearHide} onMouseLeave={scheduleHide}
            onMouseDown={e => e.preventDefault()}
            onClick={() => run(() => { putCursorInCell(view, last); editor.chain().focus().addRowAfter().run() })}
            style={{ position: 'fixed', left: geo.table.left + 12, top: geo.table.top + geo.table.height + 4, zIndex: 60, pointerEvents: 'auto' }}
            className="w-5 h-5 flex items-center justify-center rounded-full text-xs shadow"
          ><span style={{ background: '#1f1f22', color: '#fff', width: '100%', height: '100%', borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>＋</span></button>
        )
      })()}
    </>
  )
}

export const TableControlsExtension = Extension.create({
  name: 'tableControls',
  addProseMirrorPlugins() {
    const editor = this.editor
    return [new Plugin({
      key: new PluginKey('tableControls'),
      view(editorView) {
        const container = document.createElement('div')
        container.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;pointer-events:none;z-index:60;'
        document.body.appendChild(container)
        const root = createRoot(container)
        root.render(<TableOverlay view={editorView} editor={editor} />)
        return { destroy() { root.unmount(); container.remove() } }
      },
    })]
  },
})
