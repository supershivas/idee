import './globals.css'
import PwaUpdater from './PwaUpdater'
import ServiceWorkerRegister from './ServiceWorkerRegister'
import { getBuildId } from '@/lib/buildId'

export const metadata = {
  title: 'Idée',
  description: 'Home-made note app',
  icons: {
    icon: '/favicon-32x32.png',
  },
}

// Déclaré via l'API Next et non à la main dans le <head> : Next émet de
// toute façon sa propre balise viewport, et la nôtre se retrouvait doublée
// — donc `viewport-fit=cover` ignoré, `env(safe-area-inset-*)` à zéro, et
// la bande de la barre d'état peinte par iOS au lieu de l'être par l'app.
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover' as const,
  themeColor: '#f0f0ec',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <head>
        {/* Applique le thème avant le premier rendu. Le thème est posé par une
            classe sur <html> depuis un effet React : au démarrage à froid, la
            page était donc peinte en clair le temps que le JS s'exécute — un
            éclair blanc à chaque ouverture en mode sombre. Ce script bloque le
            rendu (il est dans le <head>), donc la classe est là avant la
            première peinture. Il ne connaît aucune couleur : elles restent
            dans globals.css, il ne fait que basculer la classe. */}
        <script dangerouslySetInnerHTML={{ __html: "try{var t=localStorage.getItem('idee-theme')||'system';if(t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}" }} />

        {/* Favicon standard */}
        <link rel="icon" href="/favicon-32x32.png" />

        {/* PWA manifest */}
        <link rel="manifest" href="/manifest.json" />


        {/* iOS / iPadOS home screen icon */}
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

        {/* iOS PWA */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Idée" />
        {/* `black-translucent` : la page s'étend sous la barre d'état, qu'elle
            peint donc elle-même — avec `default`, iOS peignait cette bande de
            sa propre couleur, d'où la démarcation en haut de l'écran. Les
            en-têtes réservent déjà `env(safe-area-inset-top)`. */}
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />

        {/* Polices Playfair Display / Inter */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />

        {/* Tabler Icons */}
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css"/>
      </head>

      <body className="bg-gray-50 text-gray-900">
        <PwaUpdater currentBuildId={getBuildId()} />
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  )
}
