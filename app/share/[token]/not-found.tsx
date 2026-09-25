export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="text-center text-gray-400">
        <p className="mb-3"><i className="ti ti-lock" style={{ fontSize: 36, color: 'var(--text-faint)' }} /></p>
        <p className="text-lg font-medium text-gray-500 mb-1">Page introuvable</p>
        <p className="text-sm">Ce lien n'existe pas ou n'est plus partagé.</p>
      </div>
    </main>
  )
}
