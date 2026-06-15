'use client'
import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import { useState } from 'react'

const CALLOUT_COLORS = [
  { id: 'yellow', bg: 'rgba(245,200,66,0.12)', border: '#f5c842', emoji: '💡' },
  { id: 'blue',   bg: 'rgba(96,165,250,0.12)', border: '#60a5fa', emoji: 'ℹ️' },
  { id: 'red',    bg: 'rgba(239,68,68,0.12)',  border: '#ef4444', emoji: '⚠️' },
  { id: 'green',  bg: 'rgba(34,197,94,0.12)',  border: '#22c55e', emoji: '✅' },
]

function CalloutView({ node, updateAttributes }: any) {
  const [showPicker, setShowPicker] = useState(false)
  const color = CALLOUT_COLORS.find(c => c.id === node.attrs.color) || CALLOUT_COLORS[0]

  return (
    <NodeViewWrapper>
      <div
        className="flex gap-3 px-4 py-3 rounded-xl my-2"
        style={{ background: color.bg, borderLeft: `3px solid ${color.border}` }}
      >
        <div className="relative flex-shrink-0">
          <button
            contentEditable={false}
            onClick={() => setShowPicker(v => !v)}
            className="text-lg leading-none cursor-pointer hover:opacity-70 transition-opacity select-none"
          >
            {node.attrs.emoji || color.emoji}
          </button>
          {showPicker && (
            <div
              contentEditable={false}
              className="absolute top-7 left-0 z-50 flex gap-1 p-1.5 rounded-xl shadow-xl"
              style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}
            >
              {CALLOUT_COLORS.map(c => (
                <button
                  key={c.id}
                  onClick={() => { updateAttributes({ color: c.id, emoji: c.emoji }); setShowPicker(false) }}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-base hover:opacity-80"
                  style={{ background: c.bg }}
                >
                  {c.emoji}
                </button>
              ))}
            </div>
          )}
        </div>
        <NodeViewContent className="flex-1 text-sm" style={{ color: 'var(--text-primary)', minWidth: 0 }} />
      </div>
    </NodeViewWrapper>
  )
}

export const CalloutExtension = Node.create({
  name: 'callout',
  group: 'block',
  content: 'inline*',
  defining: true,

  addAttributes() {
    return {
      color: { default: 'yellow' },
      emoji: { default: '💡' },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-callout]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-callout': true }), 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutView)
  },
})
