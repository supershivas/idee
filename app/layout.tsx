import './globals.css'

export const metadata = { title: 'Idée', description: 'Tes notes' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="bg-gray-50 text-gray-900">{children}</body>
    </html>
  )
}
