'use client'
import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import { Page } from './types'

function SubpageView({ node, pages, onNavigate }: {
  node: any, pages: Page[], onNavigate: (p: Page) => void
}) {
  const pageId = node.attrs['data-page-id']
  const page = pages.find(p => p.id === pageId)

  if (!page) {
    return (
      <NodeViewWrapper contentEditable={false}>
        <div className="flex items-center gap-2 px-3 py-2 my-1 rounded-xl border border-dashed border-gray-200 text-gray-400 text-sm select-none">
          <span>📄</span>
          <span className="italic">Page introuvable</span>
        </div>
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper contentEditable={false}>
      {/* Même style que les cartes SortableSubpageCard */}
      <button
        onClick={() => onNavigate(page)}
        className="w-full flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 hover:shadow-sm hover:border-gray-300 transition-all group text-left select-none my-1"
        style={{ minHeight: '44px' }}
      >
        <span className="text-base flex-shrink-0">{page.icon || '📄'}</span>
        <span className="flex-1 text-sm text-gray-700 truncate">{page.title || 'Sans titre'}</span>
        <span className="opacity-0 group-hover:opacity-100 text-gray-400 text-xs flex-shrink-0 transition-opacity">→</span>
      </button>
    </NodeViewWrapper>
  )
}

export function createSubpageExtension(pages: Page[], onNavigate: (p: Page) => void) {
  return Node.create({
    name: 'subpage',
    group: 'block',
    atom: true,
    selectable: true,
    draggable: true,

    addAttributes() {
      return { 'data-page-id': { default: null } }
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

export function insertSubpageBlock(editor: any, pageId: string) {
  editor.chain().focus().insertContent({
    type: 'subpage',
    attrs: { 'data-page-id': pageId },
  }).run()
}
