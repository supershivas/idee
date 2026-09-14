'use client'
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Page } from './types'
import { pageIdFromUrl, looksLikeUrl, toHref } from './linkUtils'

// Deux raccourcis vers le même geste : lier un texte déjà écrit.
//
// D — le collage. Coller une adresse sur une sélection la transforme en lien,
//     sans ouvrir quoi que ce soit. Si l'adresse désigne une page de l'app,
//     c'est un lien de page qui est posé, pas un lien externe qui rechargerait
//     l'application.
// E — `[[` sur une sélection, et ⌘/Ctrl+K. Ouvrent le sélecteur en
//     conservant le texte sélectionné, là où `[[` au curseur insère le titre
//     de la page.
export function createLinkOnSelection({ pagesRef, openPicker }: {
  pagesRef: { current: Page[] }
  openPicker: (initialQuery: string) => void
}) {
  return Extension.create({
    name: 'linkOnSelection',
    // Au-dessus de l'extension Link (priorité 100), qui pose sinon son propre
    // gestionnaire de collage et transformait l'adresse d'une page de l'app en
    // lien externe — lequel aurait rechargé l'application au clic.
    priority: 1000,

    addKeyboardShortcuts() {
      return {
        // Le raccourci universel pour poser un lien. Plus sûr que `[[` : aucun
        // caractère à intercepter, donc rien à réinsérer si l'on se ravise.
        'Mod-k': () => {
          const { from, to } = this.editor.state.selection
          if (from === to) return false
          openPicker(this.editor.state.doc.textBetween(from, to, ' '))
          return true
        },
      }
    },

    addProseMirrorPlugins() {
      const editor = this.editor
      // `[[` tapé sur une sélection remplacerait le texte dès le premier
      // crochet. On retient donc ce premier crochet sans l'insérer : si le
      // second arrive, on ouvre le sélecteur ; sinon on le réinsère tel qu'il
      // aurait été, pour ne pas voler une frappe à qui voulait vraiment un
      // crochet.
      let pending: { text: string; timer: ReturnType<typeof setTimeout> } | null = null
      const clear = () => { if (pending) { clearTimeout(pending.timer); pending = null } }

      return [new Plugin({
        key: new PluginKey('linkOnSelection'),
        props: {
          handleKeyDown(view, event) {
            if (event.key !== '[') { clear(); return false }
            const { from, to } = view.state.selection
            if (from === to) { clear(); return false }

            if (pending) {
              const text = pending.text
              clear()
              event.preventDefault()
              openPicker(text)
              return true
            }

            const text = view.state.doc.textBetween(from, to, ' ')
            event.preventDefault()
            pending = {
              text,
              timer: setTimeout(() => {
                pending = null
                // Le second crochet n'est pas venu : on insère le premier,
                // qui remplace la sélection comme l'aurait fait la frappe.
                view.dispatch(view.state.tr.insertText('['))
              }, 600),
            }
            return true
          },

          handlePaste(view, event) {
            const { from, to } = view.state.selection
            if (from === to) return false
            const raw = event.clipboardData?.getData('text/plain')?.trim()
            if (!raw || !looksLikeUrl(raw)) return false

            const pageId = pageIdFromUrl(raw, pagesRef.current)
            event.preventDefault()
            // `setLink` plutôt qu'une marque posée à la main : les liens créés
            // par collage sortent alors avec exactement les mêmes attributs
            // que ceux créés par le sélecteur.
            editor.chain().focus().setLink(pageId
              ? { href: `#${pageId}`, 'data-page-id': pageId, class: 'page-link', target: null, rel: null } as any
              : { href: toHref(raw) }
            ).run()
            return true
          },
        },
      })]
    },
  })
}
