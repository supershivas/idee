import { Mark, mergeAttributes } from '@tiptap/core'

export const PILL_COLORS = [
  { id: 'blue',   bg: '#dbeafe', text: '#1d4ed8', border: '#bfdbfe' },
  { id: 'green',  bg: '#dcfce7', text: '#15803d', border: '#bbf7d0' },
  { id: 'yellow', bg: '#fef9c3', text: '#a16207', border: '#fef08a' },
  { id: 'pink',   bg: '#fce7f3', text: '#be185d', border: '#fbcfe8' },
  { id: 'purple', bg: '#ede9fe', text: '#6d28d9', border: '#ddd6fe' },
] as const

export type PillColorId = (typeof PILL_COLORS)[number]['id']

export const PillMark = Mark.create({
  name: 'pill',

  addAttributes() {
    return {
      color: { default: 'blue' },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-pill]' }]
  },

  renderHTML({ HTMLAttributes }) {
    const c = PILL_COLORS.find(p => p.id === HTMLAttributes.color) ?? PILL_COLORS[0]
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-pill': HTMLAttributes.color,
        style: `background:${c.bg};color:${c.text};border:1px solid ${c.border};border-radius:9999px;padding:1px 8px;font-size:0.88em;white-space:nowrap;`,
      }),
      0,
    ]
  },
})
