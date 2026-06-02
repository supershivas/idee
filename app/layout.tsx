import './globals.css'

export const metadata = { title: 'Idée', description: 'Home-made note app', icons: {
    icon: '/favicon-32x32.png',
    apple: '/favicon-512x512.png',
  } }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="bg-gray-50 text-gray-900">{children}</body>
    </html>
  )
}
