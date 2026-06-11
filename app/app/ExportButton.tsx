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
    w.document.write(`<!DOCTYPE html><html><head><title>${page.title || 'Sans titre'}</title>
      <style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:800px;margin:40px auto;padding:0 24px;color:#1f2937;line-height:1.7}h1{font-size:2rem;font-weight:700}h2{font-size:1.5rem;font-weight:600;margin-top:1.5rem}p{margin:.5rem 0}ul,ol{padding-left:1.5rem}blockquote{border-left:3px solid #d1d5db;padding-left:1rem;color:#6b7280;font-style:italic}code{background:#f3f4f6;padding:.1rem .3rem;border-radius:4px}pre{background:#1e1e2e;color:#cdd6f4;padding:1rem;border-radius:8px}img{max-width:100%;border-radius:8px}.title-row{display:flex;align-items:center;gap:12px;margin-bottom:2rem;border-bottom:1px solid #e5e7eb;padding-bottom:1rem}.icon{font-size:2.5rem}</style>
      </head><body>
      <div class="title-row"><span class="icon">${page.icon || '📄'}</span><h1>${page.title || 'Sans titre'}</h1></div>
      ${page.content || '<p>Page vide.</p>'}
      <script>window.onload=()=>{window.print();window.close()}<\/script></body></html>`)
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
