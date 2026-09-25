'use client'
import { Extension, type Editor } from '@tiptap/core'
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import { EditorView } from '@tiptap/pm/view'
import { CellSelection, TableMap, addColumn, addRow, selectedRect } from '@tiptap/pm/tables'
import { createRoot } from 'react-dom/client'
import { useState, useEffect, useRef } from 'react'

// Palette de fonds de cellule (partagée avec la feuille mobile d'Editor.tsx).
// value = couleur RÉELLEMENT appliquée à la cellule (pastel, inchangée).
// swatch = version plus saturée, uniquement pour la pastille des menus
// (les pastels sont peu distinguables entre elles à l'affichage).
export const CELL_COLORS: { label: string; value: string | null; swatch?: string }[] = [
  { label: 'Aucun', value: null },
  { label: 'Rouge', value: '#fbe4e4', swatch: '#ef9a9a' },
  { label: 'Orange', value: '#faebdd', swatch: '#f0b27a' },
  { label: 'Jaune', value: '#fbf3db', swatch: '#f2d16b' },
  { label: 'Vert', value: '#ddedea', swatch: '#80cbc4' },
  { label: 'Bleu', value: '#ddebf1', swatch: '#8fc1de' },
  { label: 'Violet', value: '#eae4f2', swatch: '#b39ddb' },
  { label: 'Gris', value: '#ebeced', swatch: '#b0b4b8' },
]

type Rect = { left: number; top: number; width: number; height: number }
type Geometry = {
  table: Rect
  // Partie visible du tableau : il peut défiler horizontalement dans son cadre.
  visible: { left: number; right: number }
  cols: { center: number; index: number }[]
  rows: { center: number; index: number }[]
  colCells: HTMLElement[] // cellule d'en-tête (1re ligne) par colonne
  rowCells: HTMLElement[] // 1re cellule par ligne
}

// Sélectionne toute une colonne (CellSelection) à partir de sa cellule d'en-tête.
// resolve(pos-1) = position juste avant la cellule (nodeAfter === cellule).
// Sans focus à l'ouverture d'un menu : rendre le focus à l'éditeur peut faire
// défiler la page, ce qui refermerait aussitôt le menu.
function selectColumn(view: EditorView, cellDom: HTMLElement, focus = true) {
  try {
    const pos = view.posAtDOM(cellDom, 0)
    const $cell = view.state.doc.resolve(pos - 1)
    view.dispatch(view.state.tr.setSelection(CellSelection.colSelection($cell)))
    if (focus) view.focus()
  } catch (err) { console.warn('selectColumn:', err) }
}
// Sélectionne toute une ligne à partir de sa première cellule.
function selectRow(view: EditorView, cellDom: HTMLElement, focus = true) {
  try {
    const pos = view.posAtDOM(cellDom, 0)
    const $cell = view.state.doc.resolve(pos - 1)
    view.dispatch(view.state.tr.setSelection(CellSelection.rowSelection($cell)))
    if (focus) view.focus()
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
  const wRect = (tableEl.closest('.tableWrapper') || tableEl).getBoundingClientRect()
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
    visible: { left: Math.max(tRect.left, wRect.left), right: Math.min(tRect.right, wRect.right) },
    cols,
    rows: rowInfos,
    colCells: headerCells,
    rowCells: rows.map(tr => tr.cells[0] as HTMLElement),
  }
}

type GripMenu = { type: 'row' | 'col'; index: number; cell: HTMLElement; left: number; top: number }
// Menu « combien ? » ouvert par un clic long sur une ligne/colonne fantôme.
type AddMenu = { type: 'addRow' | 'addCol'; cell: HTMLElement; left: number; top: number }
type Menu = GripMenu | AddMenu

const LONG_PRESS_MS = 450
const ADD_COUNTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

const MENU_WIDTH = 220
const ADD_MENU_WIDTH = 188
const MENU_HEIGHT = 290 // hauteur approximative, pour le basculer au-dessus en bas d'écran

function MenuItem({ icon, label, onClick, danger }: {
  icon: string; label: string; onClick: () => void; danger?: boolean
}) {
  return (
    <button type="button" className={`table-menu-item${danger ? ' is-danger' : ''}`}
      onMouseDown={e => e.preventDefault()}
      onClick={e => { e.stopPropagation(); onClick() }}>
      <i className={`ti ${icon}`} />
      <span>{label}</span>
    </button>
  )
}

// Pastilles identiques à celles du surlignage (`PillSwatches` d'Editor.tsx) :
// même bouton `.toolbar-swatch`, même rond de 15px, même bordure.
function CellColorSwatches({ onPick }: { onPick: (v: string | null) => void }) {
  return (
    <div className="flex items-center flex-wrap px-1">
      {CELL_COLORS.map(c => (
        <button key={c.label} type="button" title={c.label}
          onMouseDown={e => e.preventDefault()}
          onClick={e => { e.stopPropagation(); onPick(c.value) }}
          className="toolbar-swatch flex items-center justify-center flex-shrink-0">
          <span style={{
            width: 15, height: 15, borderRadius: '50%', display: 'block',
            background: c.swatch || 'linear-gradient(135deg, transparent 44%, var(--sidebar-muted) 44%, var(--sidebar-muted) 56%, transparent 56%)',
            border: '1.5px solid var(--toolbar-swatch-border)',
          }} />
        </button>
      ))}
    </div>
  )
}

// Contrôles des tableaux (bureau). Une petite poignée apparaît à gauche de la
// ligne survolée et au-dessus de la colonne survolée ; un clic ouvre le menu
// de la ligne ou de la colonne, qui reste ouvert jusqu'à un clic ailleurs ou
// Échap. Les anciennes barres s'ouvraient au survol et se refermaient dès que
// la souris s'écartait de quelques pixels.
function TableOverlay({ view, editor }: { view: EditorView; editor: Editor }) {
  const [geo, setGeo] = useState<Geometry | null>(null)
  const [hoverCol, setHoverCol] = useState<number | null>(null)
  const [hoverRow, setHoverRow] = useState<number | null>(null)
  const [menu, setMenu] = useState<Menu | null>(null)
  // Miroir pour les écouteurs posés une seule fois.
  const menuRef = useRef<Menu | null>(null)
  const openedAt = useRef(0)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Clic long sur une ligne/colonne fantôme « + ».
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressed = useRef(false)

  function openMenu(m: Menu | null) {
    menuRef.current = m
    if (m) openedAt.current = Date.now()
    setMenu(m)
  }
  function hideAll() {
    openMenu(null); setGeo(null); setHoverCol(null); setHoverRow(null)
  }
  function clearHide() { if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null } }
  function scheduleHide() {
    if (menuRef.current) return
    clearHide()
    hideTimer.current = setTimeout(() => { if (!menuRef.current) hideAll() }, 400)
  }

  useEffect(() => {
    // Écouté sur tout le document, et non via `onMouseEnter` sur les
    // poignées : l'overlay est une racine React à part, qui ne reçoit pas le
    // `mouseout` de l'éditeur — `onMouseEnter` n'y partait jamais, et les
    // contrôles disparaissaient sous la souris.
    function onMove(e: MouseEvent) {
      if (menuRef.current) return // menu ouvert : la poignée reste sur sa ligne
      const target = e.target as HTMLElement | null
      if (!target?.closest) return
      if (target.closest('[data-table-ctl]')) { clearHide(); return }
      const tableEl = target.closest('table') as HTMLTableElement | null
      if (!tableEl || !view.dom.contains(tableEl)) { scheduleHide(); return }
      clearHide()
      const g = measure(tableEl)
      if (!g) return
      setGeo(g)
      let ci: number | null = null, best = Infinity
      g.cols.forEach(c => { const d = Math.abs(c.center - e.clientX); if (d < best) { best = d; ci = c.index } })
      let ri: number | null = null; best = Infinity
      g.rows.forEach(r => { const d = Math.abs(r.center - e.clientY); if (d < best) { best = d; ri = r.index } })
      setHoverCol(ci); setHoverRow(ri)
    }
    function onDown(e: MouseEvent) {
      if (!menuRef.current) return
      if ((e.target as HTMLElement).closest('[data-table-ctl]')) return
      openMenu(null); scheduleHide()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && menuRef.current) { openMenu(null); scheduleHide() }
    }
    // Positions en `fixed` mesurées au survol : au moindre défilement elles
    // deviennent fausses, on masque tout. Le court délai ignore le défilement
    // éventuel provoqué par l'ouverture du menu elle-même.
    function onScroll() {
      if (menuRef.current && Date.now() - openedAt.current < 300) return
      hideAll()
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      clearHide()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  if (!geo) return null

  // Chaque action re-sélectionne sa ligne ou colonne (la sélection a pu
  // bouger depuis l'ouverture), puis referme tout : la géométrie a changé.
  // Le focus n'est rendu qu'une fois la commande passée, et avec un simple
  // curseur : rendu sur la sélection de cellules, le navigateur la
  // remplaçait par un bout de texte sélectionné, et la barre de mise en forme
  // surgissait par-dessus le tableau. Le focus garde Ctrl+Z à portée.
  function act(m: GripMenu, command: () => void) {
    if (m.type === 'row') selectRow(view, m.cell, false); else selectColumn(view, m.cell, false)
    command()
    try {
      view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.selection.$from)))
    } catch (err) { console.warn('table menu cursor:', err) }
    view.focus()
    hideAll()
  }
  const chain = () => editor.chain() as any

  function toggleMenu(type: 'row' | 'col', index: number, cell: HTMLElement, grip: HTMLElement) {
    if (menu && menu.type === type && menu.index === index) { openMenu(null); return }
    const r = grip.getBoundingClientRect()
    const left = Math.max(8, Math.min(r.left, window.innerWidth - MENU_WIDTH - 8))
    const below = r.bottom + 4
    const top = below + MENU_HEIGHT > window.innerHeight ? Math.max(8, r.top - 4 - MENU_HEIGHT) : below
    if (type === 'row') selectRow(view, cell, false); else selectColumn(view, cell, false)
    openMenu({ type, index, cell, left, top })
  }

  // Ajoute `count` lignes (ou colonnes) à la fin du tableau, en une seule
  // transaction : un seul Ctrl+Z les retire toutes. Les deux fonctions de
  // prosemirror-tables ne raisonnent pas pareil : `addRow` lit les positions
  // du document courant (d'où un tableau relu à chaque tour), `addColumn`
  // remappe celles du document de départ (d'où le même rectangle d'origine
  // à chaque tour — les cellules s'ajoutent alors l'une après l'autre).
  function addMany(type: 'row' | 'col', cell: HTMLElement, count: number) {
    putCursorInCell(view, cell)
    try {
      const start = selectedRect(view.state)
      const tr = view.state.tr
      for (let i = 0; i < count; i++) {
        if (type === 'col') { addColumn(tr, start, start.map.width); continue }
        const table = tr.doc.nodeAt(start.tableStart - 1)
        if (!table) break
        const map = TableMap.get(table)
        addRow(tr, { ...start, map, table }, map.height)
      }
      view.dispatch(tr)
      view.focus()
    } catch (err) { console.warn('addMany:', err) }
    hideAll()
  }

  // Clic : ajoute une ligne/colonne. Clic long : ouvre le choix du nombre, à
  // l'endroit du pointeur. Le clic qui suit le relâchement est alors ignoré.
  function cancelPress() { if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null } }
  function addHandlers(type: 'row' | 'col', cell: HTMLElement) {
    return {
      onMouseDown: (e: React.MouseEvent) => {
        e.preventDefault()
        if (e.button !== 0) return
        longPressed.current = false
        const { clientX, clientY } = e
        cancelPress()
        pressTimer.current = setTimeout(() => {
          pressTimer.current = null
          longPressed.current = true
          const left = Math.max(8, Math.min(clientX - 20, window.innerWidth - ADD_MENU_WIDTH - 8))
          const top = clientY + 12 + 130 > window.innerHeight ? clientY - 12 - 130 : clientY + 12
          openMenu({ type: type === 'row' ? 'addRow' : 'addCol', cell, left, top })
        }, LONG_PRESS_MS)
      },
      onMouseUp: cancelPress,
      onMouseLeave: cancelPress,
      onClick: () => {
        if (longPressed.current) { longPressed.current = false; return }
        cancelPress()
        addMany(type, cell, 1)
      },
    }
  }

  const gripMenu = menu && (menu.type === 'row' || menu.type === 'col') ? menu : null
  const addMenu = menu && (menu.type === 'addRow' || menu.type === 'addCol') ? menu : null

  // Menu ouvert : seule sa poignée reste affichée.
  const colIndex = menu ? (menu.type === 'col' ? menu.index : null) : hoverCol
  const rowIndex = menu ? (menu.type === 'row' ? menu.index : null) : hoverRow
  const colCell = colIndex != null ? geo.colCells[colIndex] : null
  const rowCell = rowIndex != null ? geo.rowCells[rowIndex] : null
  const colRect = colCell?.getBoundingClientRect()
  const rowRect = rowCell?.getBoundingClientRect()
  const lastCol = geo.colCells[geo.colCells.length - 1]
  const lastRow = geo.rowCells[geo.rowCells.length - 1]

  return (
    <>
      {/* Poignée de colonne — au-dessus de la colonne survolée */}
      {colCell && colRect && (
        <button type="button" data-table-ctl title="Options de la colonne"
          className={`table-grip is-col${menu?.type === 'col' ? ' is-active' : ''}`}
          onMouseDown={e => e.preventDefault()}
          onClick={e => toggleMenu('col', colIndex!, colCell, e.currentTarget)}
          style={{ left: colRect.left + colRect.width / 2, top: geo.table.top }}>
          <span className="table-grip-bar"><i className="ti ti-grip-horizontal" /></span>
        </button>
      )}

      {/* Poignée de ligne — à gauche de la ligne survolée */}
      {rowCell && rowRect && (
        <button type="button" data-table-ctl title="Options de la ligne"
          className={`table-grip is-row${menu?.type === 'row' ? ' is-active' : ''}`}
          onMouseDown={e => e.preventDefault()}
          onClick={e => toggleMenu('row', rowIndex!, rowCell, e.currentTarget)}
          style={{ left: geo.table.left, top: rowRect.top + rowRect.height / 2 }}>
          <span className="table-grip-bar"><i className="ti ti-grip-vertical" /></span>
        </button>
      )}

      {gripMenu && (() => { const menu = gripMenu; return (
        <div data-table-ctl className="table-menu" style={{ left: menu.left, top: menu.top, width: MENU_WIDTH }}>
          {menu.type === 'row' ? (
            <>
              <MenuItem icon="ti-row-insert-top" label="Insérer au-dessus" onClick={() => act(menu, () => chain().addRowBefore().run())} />
              <MenuItem icon="ti-row-insert-bottom" label="Insérer en dessous" onClick={() => act(menu, () => chain().addRowAfter().run())} />
            </>
          ) : (
            <>
              <MenuItem icon="ti-column-insert-left" label="Insérer à gauche" onClick={() => act(menu, () => chain().addColumnBefore().run())} />
              <MenuItem icon="ti-column-insert-right" label="Insérer à droite" onClick={() => act(menu, () => chain().addColumnAfter().run())} />
            </>
          )}
          <div className="table-menu-sep" />
          <div className="table-menu-label">Couleur {menu.type === 'row' ? 'de la ligne' : 'de la colonne'}</div>
          <CellColorSwatches onPick={v => act(menu, () => chain().setCellAttribute('backgroundColor', v).run())} />
          <div className="table-menu-sep" />
          <MenuItem icon="ti-trash" danger
            label={menu.type === 'row' ? 'Supprimer la ligne' : 'Supprimer la colonne'}
            onClick={() => act(menu, () => menu.type === 'row' ? chain().deleteRow().run() : chain().deleteColumn().run())} />
          <MenuItem icon="ti-table-off" danger label="Supprimer le tableau"
            onClick={() => act(menu, () => chain().deleteTable().run())} />
        </div>
      ) })()}

      {addMenu && (
        <div data-table-ctl className="table-menu" style={{ left: addMenu.left, top: addMenu.top, width: ADD_MENU_WIDTH }}>
          <div className="table-menu-label" style={{ paddingBottom: 4 }}>
            {addMenu.type === 'addRow' ? 'Ajouter des lignes' : 'Ajouter des colonnes'}
          </div>
          <div className="table-menu-counts">
            {ADD_COUNTS.map(n => (
              <button key={n} type="button" className="table-menu-count"
                onMouseDown={e => e.preventDefault()}
                onClick={() => addMany(addMenu.type === 'addRow' ? 'row' : 'col', addMenu.cell, n)}
              >{n}</button>
            ))}
          </div>
        </div>
      )}

      {/* ＋ Ajouter une colonne — fine colonne fantôme le long du bord droit,
          sur toute la hauteur du tableau. */}
      {lastCol && (!menu || menu.type === 'addCol') && (
        <button type="button" data-table-ctl title="Ajouter une colonne — clic long : en ajouter plusieurs"
          className={`table-add${menu ? ' is-active' : ''}`}
          {...addHandlers('col', lastCol)}
          style={{ left: geo.visible.right + 6, top: geo.table.top, width: 18, height: geo.table.height }}
        ><i className="ti ti-plus" /></button>
      )}

      {/* ＋ Ajouter une ligne — fine ligne fantôme sous le tableau, sur toute
          sa largeur visible. */}
      {lastRow && (!menu || menu.type === 'addRow') && (
        <button type="button" data-table-ctl title="Ajouter une ligne — clic long : en ajouter plusieurs"
          className={`table-add${menu ? ' is-active' : ''}`}
          {...addHandlers('row', lastRow)}
          style={{ left: geo.visible.left, top: geo.table.top + geo.table.height + 6, width: geo.visible.right - geo.visible.left, height: 18 }}
        ><i className="ti ti-plus" /></button>
      )}
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
