export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center" style={{ background: 'var(--app-bg)' }}>
      <div className="text-center">
        <p className="mb-4"><i className="ti ti-file-off" style={{ fontSize: 48, color: 'var(--text-faint)' }} /></p>
        <p className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Page introuvable</p>
        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
          Cette page n'existe pas ou a été supprimée.
        </p>
        <a
          href="/app"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
          style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)' }}
        >
          <i className="ti ti-arrow-left" />Retour à mes notes
        </a>
      </div>
    </main>
  )
}
