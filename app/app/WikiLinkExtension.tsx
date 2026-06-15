'use client'
import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import { PluginKey } from '@tiptap/pm/state'
import { ReactRenderer } from '@tiptap/react'
import tippy, { type Instance as TippyInstance } from 'tippy.js'
import { forwardRef, useImperativeHandle, useState, useEffect, type MutableRefObject } from 'react'
import { Page } from './types'

const WikiLinkPluginKey = new PluginKey('wikiLink')

const WikiSuggestionList = forwardRef(function WikiSuggestionList(
  props: { pages: Page[]; onSelect: (p: Page) => void; query: string },
  ref
) {
  const [idx, setIdx] = useState(0)
  const filtered = props.pages
    .filter(p => (p.title || '').toLowerCase().includes(props.query.toLowerCase()))
    .slice(0, 8)

  useEffect(() => setIdx(0), [props.query])

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'ArrowDown') { setIdx(i => Math.min(i + 1, filtered.length - 1)); return true }
      if (event.key === 'ArrowUp')   { setIdx(i => Math.max(i - 1, 0)); return true }
      if (event.key === 'Enter')     { filtered[idx] && props.onSelect(filtered[idx]); return true }
      if (event.key === 'Escape')    { return false }
      return false
    },
  }))

  if (!filtered.length) return (
    <div className="p-3 text-sm" style={{ color: 'var(--text-muted)' }}>Aucune page</div>
  )

  return (
    <div>
      {filtered.map((page, i) => (
        <button key={page.id}
          onMouseDown={e => { e.preventDefault(); props.onSelect(page) }}
          className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors"
          style={{
            background: i === idx ? 'var(--selected-bg)' : 'transparent',
            color: 'var(--text-primary)',
          }}>
          <span>{page.icon || '📄'}</span>
          <span className="truncate">{page.title || 'Sans titre'}</span>
        </button>
      ))}
    </div>
  )
})

export function createWikiLinkExtension(pagesRef: MutableRefObject<Page[]>, onNavigate: (p: Page) => void) {
  return Extension.create({
    name: 'wikiLink',
    addProseMirrorPlugins() {
      return [
        Suggestion({
          pluginKey: WikiLinkPluginKey,
          editor: this.editor,
          char: '[[',
          allowSpaces: true,
          startOfLine: false,
          command: ({ editor, range, props }) => {
            const page: Page = props
            editor
              .chain()
              .focus()
              .deleteRange(range)
              .insertContent({
                type: 'text',
                marks: [{ type: 'link', attrs: { href: `#${page.id}`, 'data-page-id': page.id, class: 'page-link', target: null } }],
                text: page.title || 'Sans titre',
              })
              .run()
          },
          items: ({ query }) => {
            return pagesRef.current
              .filter(p => !p.deleted_at && (p.title || '').toLowerCase().includes(query.toLowerCase()))
              .slice(0, 8)
          },
          render: () => {
            let component: ReactRenderer
            let popup: TippyInstance[]

            return {
              onStart(props) {
                component = new ReactRenderer(WikiSuggestionList, {
                  props: { ...props, onSelect: props.command },
                  editor: props.editor,
                })
                popup = tippy('body', {
                  getReferenceClientRect: props.clientRect as () => DOMRect,
                  appendTo: () => document.body,
                  content: component.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: 'manual',
                  placement: 'bottom-start',
                  theme: 'none',
                })
                ;(popup[0].popper.firstChild as HTMLElement)?.setAttribute(
                  'style',
                  'background:var(--card-bg);border:1px solid var(--border);border-radius:12px;overflow:hidden;min-width:200px;box-shadow:0 8px 24px rgba(0,0,0,0.12);'
                )
              },
              onUpdate(props) {
                component.updateProps({ ...props, onSelect: props.command })
                popup[0]?.setProps({ getReferenceClientRect: props.clientRect as () => DOMRect })
              },
              onKeyDown(props) {
                if (props.event.key === 'Escape') { popup[0]?.hide(); return true }
                return (component.ref as { onKeyDown: (p: { event: KeyboardEvent }) => boolean })?.onKeyDown(props) ?? false
              },
              onExit() {
                popup[0]?.destroy()
                component.destroy()
              },
            }
          },
        }),
      ]
    },
  })
}
