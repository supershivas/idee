import AppSplash from './AppSplash'

// Layout du segment `/app`, dont la seule raison d'être est de porter
// l'ouverture : placée ici, elle survit à la résolution du composant serveur
// de la page — sinon l'écran d'attente et l'app se remplaceraient l'un l'autre,
// avec une couture au milieu de l'animation.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppSplash />
      {children}
    </>
  )
}
