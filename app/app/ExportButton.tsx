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

    const css = `
      @page { margin: 2cm 2.5cm; size: A4; }
      *, *::before, *::after { box-sizing: border-box; }
      body {
        font-family: Georgia, 'Times New Roman', serif;
        font-size: 11pt;
        line-height: 1.7;
        color: #111;
        margin: 0;
        padding: 0;
        max-width: 100%;
      }
      .doc-header {
        display: flex;
        align-items: flex-start;
        gap: 14px;
        padding-bottom: 14pt;
        margin-bottom: 20pt;
        border-bottom: 1.5pt solid #222;
      }
      .doc-icon { font-size: 26pt; line-height: 1.1; flex-shrink: 0; }
      .doc-title { font-size: 20pt; font-weight: 700; margin: 0 0 3pt; line-height: 1.2; font-family: -apple-system, Arial, sans-serif; }
      .doc-meta { font-size: 9pt; color: #777; margin: 0; }
      h1 { font-size: 17pt; font-weight: 700; margin: 18pt 0 6pt; page-break-after: avoid; line-height: 1.3; }
      h2 { font-size: 14pt; font-weight: 700; margin: 14pt 0 5pt; page-break-after: avoid; line-height: 1.3; }
      h3 { font-size: 12pt; font-weight: 700; margin: 12pt 0 4pt; page-break-after: avoid; }
      p { margin: 0 0 7pt; orphans: 3; widows: 3; }
      ul, ol { padding-left: 1.5em; margin: 3pt 0 8pt; }
      li { margin-bottom: 3pt; page-break-inside: avoid; }
      blockquote {
        margin: 6pt 0 8pt;
        padding: 5pt 10pt;
        border-left: 2.5pt solid #999;
        color: #444;
        font-style: italic;
        page-break-inside: avoid;
      }
      blockquote p { margin: 0; }
      code {
        font-family: 'Courier New', Courier, monospace;
        font-size: 9pt;
        background: #f4f4f4;
        padding: 1pt 3pt;
        border: 0.5pt solid #ddd;
        border-radius: 2pt;
      }
      pre {
        font-family: 'Courier New', Courier, monospace;
        font-size: 9pt;
        background: #f4f4f4;
        border: 0.5pt solid #ddd;
        padding: 8pt 10pt;
        border-radius: 3pt;
        white-space: pre-wrap;
        word-break: break-all;
        page-break-inside: avoid;
        margin: 6pt 0 10pt;
        line-height: 1.5;
      }
      pre code { background: none; border: none; padding: 0; font-size: inherit; }
      table {
        width: 100%;
        border-collapse: collapse;
        margin: 6pt 0 10pt;
        font-size: 10pt;
        page-break-inside: avoid;
      }
      th, td { border: 0.5pt solid #bbb; padding: 4pt 8pt; text-align: left; vertical-align: top; }
      th { background: #f0f0f0; font-weight: 700; }
      img { max-width: 100%; height: auto; display: block; margin: 8pt 0; page-break-inside: avoid; }
      hr { border: none; border-top: 0.5pt solid #ccc; margin: 12pt 0; }
      a { color: #1a1a1a; text-decoration: underline; }
      input[type="checkbox"] { margin-right: 4pt; }
      s, del { text-decoration: line-through; color: #666; }
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
  ${page.content || '<p><em>Page vide.</em></p>'}
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
