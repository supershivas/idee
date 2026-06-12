'use client'
import { useState } from 'react'
import { Page } from './App'

const IconDownload = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none"
    stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6.5 1.5v7M4 6.5l2.5 2.5L9 6.5" />
    <path d="M2 11h9" />
  </svg>
)

function htmlToMarkdown(html: string): string {
  return html
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
    .replace(/<s[^>]*>(.*?)<\/s>/gi, '~~$1~~')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    .replace(/<img[^>]*src="([^"]*)"[^>]*/gi, '![]($1)')
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
    .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, '$1\n')
    .replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, '$1\n')
    .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '> $1\n')
    .replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '```\n$1\n```\n')
    .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
    .replace(/<hr[^>]*/gi, '\n---\n')
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
    .replace(/<br[^>]*/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// Nettoie les styles inline Tiptap qui écrasent le CSS d'impression
function cleanHtmlForPrint(html: string): string {
  return html
    // Supprimer tous les attributs style inline
    .replace(/\s*style="[^"]*"/gi, '')
    // Supprimer classes Tiptap/ProseMirror
    .replace(/\s*class="[^"]*"/gi, '')
    // Supprimer data-attributes
    .replace(/\s*data-[^=]*="[^"]*"/gi, '')
    // Checkbox tiptap → HTML natif
    .replace(/<input[^>]*type="checkbox"[^>]*checked[^>]*>/gi, '<input type="checkbox" checked disabled>')
    .replace(/<input[^>]*type="checkbox"[^>]*>/gi, '<input type="checkbox" disabled>')
}

export default function ExportButton({ page }: { page: Page }) {
  const [open, setOpen] = useState(false)

  function exportMarkdown() {
    const md = `# ${page.title || 'Sans titre'}\n\n${htmlToMarkdown(page.content || '')}`
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${page.title || 'sans-titre'}.md`; a.click()
    URL.revokeObjectURL(url)
    setOpen(false)
  }

  function exportPDF() {
    setOpen(false)
    const w = window.open('', '_blank')
    if (!w) return

    const date = new Date().toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'long', year: 'numeric',
    })

    const cleanContent = cleanHtmlForPrint(page.content || '')

    const css = `
      @page {
        margin: 2cm 2.5cm;
        size: A4;
      }

      /* Reset total — neutralise tout style inline résiduel */
      *, *::before, *::after {
        box-sizing: border-box;
        font-family: inherit;
        font-size: inherit;
        line-height: inherit;
        color: inherit;
        margin: 0;
        padding: 0;
      }

      body {
        font-family: Georgia, 'Times New Roman', serif;
        font-size: 11pt;
        line-height: 1.75;
        color: #111;
      }

      /* ── En-tête ── */
      .doc-header {
        display: flex;
        align-items: flex-start;
        gap: 12pt;
        padding-bottom: 12pt;
        margin-bottom: 18pt;
        border-bottom: 1.5pt solid #222;
      }
      .doc-icon {
        font-size: 24pt;
        line-height: 1.1;
        flex-shrink: 0;
      }
      .doc-title {
        font-size: 22pt;
        font-weight: 700;
        line-height: 1.2;
        font-family: -apple-system, Arial, sans-serif;
        color: #111;
        margin-bottom: 3pt;
      }
      .doc-meta {
        font-size: 8.5pt;
        color: #888;
        font-family: -apple-system, Arial, sans-serif;
      }

      /* ── Corps ── */
      p {
        font-size: 11pt;
        line-height: 1.75;
        margin-bottom: 7pt;
        orphans: 3;
        widows: 3;
      }

      /* Paragraphe vide → espace vertical discret */
      p:empty {
        margin-bottom: 4pt;
      }

      /* ── Titres — proportionnels à 11pt ── */
      h1 {
        font-size: 20pt;
        font-weight: 700;
        line-height: 1.25;
        margin-top: 20pt;
        margin-bottom: 7pt;
        page-break-after: avoid;
        font-family: -apple-system, Arial, sans-serif;
      }
      h2 {
        font-size: 16pt;
        font-weight: 700;
        line-height: 1.3;
        margin-top: 16pt;
        margin-bottom: 6pt;
        page-break-after: avoid;
        font-family: -apple-system, Arial, sans-serif;
      }
      h3 {
        font-size: 13pt;
        font-weight: 700;
        line-height: 1.35;
        margin-top: 13pt;
        margin-bottom: 5pt;
        page-break-after: avoid;
        font-family: -apple-system, Arial, sans-serif;
      }
      h4, h5, h6 {
        font-size: 11pt;
        font-weight: 700;
        margin-top: 10pt;
        margin-bottom: 4pt;
        page-break-after: avoid;
      }

      /* ── Listes ── */
      ul, ol {
        font-size: 11pt;
        padding-left: 1.6em;
        margin-top: 2pt;
        margin-bottom: 8pt;
      }
      li {
        margin-bottom: 3pt;
        line-height: 1.6;
        page-break-inside: avoid;
      }
      li p { margin-bottom: 2pt; }

      /* ── Todo list ── */
      ul[data-type="taskList"],
      .task-list {
        list-style: none;
        padding-left: 0.2em;
      }
      li[data-type="taskItem"],
      .task-item {
        display: flex;
        align-items: flex-start;
        gap: 5pt;
      }
      input[type="checkbox"] {
        margin-top: 3pt;
        flex-shrink: 0;
        width: 9pt;
        height: 9pt;
      }

      /* ── Citation ── */
      blockquote {
        margin: 8pt 0;
        padding: 6pt 12pt;
        border-left: 2.5pt solid #aaa;
        color: #555;
        font-style: italic;
        font-size: 11pt;
        page-break-inside: avoid;
      }
      blockquote p { margin-bottom: 2pt; }

      /* ── Code ── */
      code {
        font-family: 'Courier New', Courier, monospace;
        font-size: 9pt;
        background: #f3f3f3;
        padding: 1pt 3pt;
        border: 0.5pt solid #ddd;
        border-radius: 2pt;
        color: #c7254e;
      }
      pre {
        font-family: 'Courier New', Courier, monospace;
        font-size: 9pt;
        background: #f3f3f3;
        border: 0.5pt solid #ddd;
        padding: 8pt 10pt;
        border-radius: 3pt;
        white-space: pre-wrap;
        word-break: break-all;
        page-break-inside: avoid;
        margin: 6pt 0 10pt;
        line-height: 1.5;
        color: #111;
      }
      pre code {
        background: none;
        border: none;
        padding: 0;
        font-size: 9pt;
        color: inherit;
      }

      /* ── Tableau ── */
      table {
        width: 100%;
        border-collapse: collapse;
        margin: 8pt 0 12pt;
        font-size: 10pt;
        page-break-inside: avoid;
      }
      th, td {
        border: 0.5pt solid #bbb;
        padding: 4pt 8pt;
        text-align: left;
        vertical-align: top;
        line-height: 1.5;
      }
      th {
        background: #f0f0f0;
        font-weight: 700;
        font-size: 10pt;
      }

      /* ── Misc ── */
      img {
        max-width: 100%;
        height: auto;
        display: block;
        margin: 8pt 0;
        page-break-inside: avoid;
      }
      hr {
        border: none;
        border-top: 0.5pt solid #ccc;
        margin: 14pt 0;
      }
      a {
        color: #1a1a1a;
        text-decoration: underline;
      }
      strong, b { font-weight: 700; }
      em, i { font-style: italic; }
      s, del { text-decoration: line-through; color: #666; }
      u { text-decoration: underline; }
    `

    w.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${page.title || 'Sans titre'}</title>
  <style>${css}</style>
</head>
<body>
  <div class="doc-header">
    <span class="doc-icon">${page.icon || '📄'}</span>
    <div>
      <p class="doc-title">${page.title || 'Sans titre'}</p>
      <p class="doc-meta">Exporté le ${date}</p>
    </div>
  </div>
  <div class="doc-body">
    ${cleanContent || '<p><em>Page vide.</em></p>'}
  </div>
  <script>window.onload = () => { window.print(); window.close(); }<\/script>
</body>
</html>`)
    w.document.close()
  }

  return (
    <div>
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2.5 px-2.5 py-2 text-sm rounded-lg transition-colors text-left"
        style={{ color: 'var(--text-secondary)', background: 'transparent' }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-bg)'; e.currentTarget.style.color = 'var(--text-primary)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' }}>
        <span style={{ opacity: 0.55 }}><IconDownload /></span>
        <span className="flex-1">Exporter</span>
        <span style={{ opacity: 0.35, fontSize: '9px' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="ml-5 flex flex-col pb-1">
          {[
            { label: 'Markdown (.md)', action: exportMarkdown },
            { label: 'PDF (impression)', action: exportPDF },
          ].map(({ label, action }) => (
            <button key={label} type="button" onClick={action}
              className="flex items-center px-2.5 py-1.5 text-xs rounded-lg transition-colors text-left"
              style={{ color: 'var(--text-muted)', background: 'transparent' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-bg)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
