import './globals.css'

export const metadata = {
  title: 'Idée',
  description: 'Home-made note app',
  icons: {
    icon: '/favicon-32x32.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <head>
        {/* Favicon standard */}
        <link rel="icon" href="/favicon-32x32.png" />

        {/* iOS / iPadOS home screen icon (CRUCIAL) */}
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

        {/* Optionnel mais propre pour iOS */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Idée" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />

        {/* Polices Playfair Display / Inter */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />

        {/* Tabler Icons */}
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css"/>
      </head>

      <body className="bg-gray-50 text-gray-900">
        {children}
      </body>
    </html>
  )
}
