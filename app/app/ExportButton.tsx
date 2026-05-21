'use client'
import { useState } from 'react'
import { Page } from './App'

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
    .replace(/<ul[^>]*>(.*?)<\/ul>/gis, '$1\n')
    .replace(/<ol[^>]*>(.*?)<\/ol>/gis, '$1\n')
    .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, '> $1\n')
    .replace(/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/gis, '```\n$1\n```\n')
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
  const [showMenu, setShowMenu] = useState(false)

  function exportMarkdown() {
    const md = `# ${page.title || 'Sans titre'}\n\n${htmlToMarkdown(page.content || '')}`
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${page.title || 'sans-titre'}.md`
    a.click()
    URL.revokeObjectURL(url)
    setShowMenu(false)
  }

  function exportPDF() {
    setShowMenu(false)
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${page.title || 'Sans titre'}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 40px auto; padding: 0 24px; color: #1f2937; line-height: 1.7; }
          h1 { font-size: 2rem; font-weight: 700; margin-bottom: 0.5rem; }
          h2 { font-size: 1.5rem; font-weight: 600; margin-top: 1.5rem; }
          h3 { font-size: 1.2rem; font-weight: 600; margin-top: 1rem; }
          p { margin: 0.5rem 0; }
          ul, ol { padding-left: 1.5rem; }
          blockquote { border-left: 3px solid #d1d5db; padding-left: 1rem; color: #6b7280; font-style: italic; }
          code { background: #f3f4f6; padding: 0.1rem 0.3rem; border-radius: 4px; font-size: 0.9em; }
          pre { background: #1e1e2e; color: #cdd6f4; padding: 1rem; border-radius: 8px; overflow-x: auto; }
          img { max-width: 100%; border-radius: 8px; }
          a { color: #3b5bdb; }
          .title-row { display: flex; align-items: center; gap: 12px; margin-bottom: 2rem; border-bottom: 1px solid #e5e7eb; padding-bottom: 1rem; }
          .icon { font-size: 2.5rem; }
        </style>
      </head>
      <body>
        <div class="title-row">
          <span class="icon">${page.icon || '📄'}</span>
          <h1>${page.title || 'Sans titre'}</h1>
        </div>
        ${page.content || '<p>Page vide.</p>'}
        <script>window.onload = () => { window.print(); window.close(); }<\/script>
      </body>
      </html>
    `)
    printWindow.document.close()
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(v => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm text-gray-600 transition-colors"
      >
        <span>⬇️</span>
        <span className="hidden sm:inline">Exporter</span>
      </button>

      {showMenu && (
        <div className="absolute right-0 top-full mt-2 bg-white border rounded-xl shadow-xl overflow-hidden w-44 z-50">
          <button
            onClick={exportMarkdown}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 text-sm text-gray-700"
          >
            <span>📝</span>
            <div>
              <p className="font-medium">Markdown</p>
              <p className="text-xs text-gray-400">Fichier .md</p>
            </div>
          </button>
          <button
            onClick={exportPDF}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 text-sm text-gray-700 border-t"
          >
            <span>📄</span>
            <div>
              <p className="font-medium">PDF</p>
              <p className="text-xs text-gray-400">Via impression</p>
            </div>
          </button>
        </div>
      )}
    </div>
  )
}
