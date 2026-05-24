'use client'
import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import { Page } from './types'

// ─── Rendu du bloc sous-page ──────────────────────────────────────────────────
function SubpageView({ node, pages, onNavigate }: {
  node: any, pages: Page[], onNavigate: (p: Page) => void
}) {
  const pageId = node.attrs['data-page-id']
  const page = pages.find(p => p.id === pageId)

  if (!page) {
    return (
      <NodeViewWrapper contentEditable={false}>
        <div className="flex items-center gap-2 px-3 py-2 my-1 rounded-lg border border-dashed border-gray-200 text-gray-400 text-sm select-none">
          <span>📄</span>
          <span className="italic">Page introuvable</span>
        </div>
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper contentEditable={false}>
      <button
        onClick={() => onNavigate(page)}
        className="w-full flex items-center gap-3 px-3 py-2.5 my-1 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all group text-left select-none"
      >
        <span className="text-xl flex-shrink-0">{page.icon || '📄'}</span>
        <span className="flex-1 text-sm font-medium text-gray-800 truncate">
          {page.title || 'Sans titre'}
        </span>
        <span className="text-gray-300 group-hover:text-gray-500 transition-colors text-xs flex-shrink-0">→</span>
      </button>
    </NodeViewWrapper>
  )
}

// ─── Extension ────────────────────────────────────────────────────────────────
export function createSubpageExtension(pages: Page[], onNavigate: (p: Page) => void) {
  return Node.create({
    name: 'subpage',
    group: 'block',
    atom: true,
    selectable: true,
    draggable: true,

    addAttributes() {
      return {
        'data-page-id': { default: null },
      }
    },

    parseHTML() {
      return [{ tag: 'div[data-type="subpage"]' }]
    },

    renderHTML({ HTMLAttributes }) {
      return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'subpage' })]
    },

    addNodeView() {
      return ReactNodeViewRenderer((props: any) => (
        <SubpageView node={props.node} pages={pages} onNavigate={onNavigate} />
      ))
    },
  })
}

// Helper pour insérer un bloc sous-page dans l'éditeur
export function insertSubpageBlock(editor: any, pageId: string) {
  editor.chain().focus().insertContent({
    type: 'subpage',
    attrs: { 'data-page-id': pageId },
  }).run()
}
