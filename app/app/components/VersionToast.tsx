'use client'
import { useEffect } from 'react'
import { toast } from './Toast'

const STORAGE_KEY = 'idee_app_version'

// Une seule annonce par chargement de page. En développement, StrictMode monte
// puis remonte chaque composant : sans ce garde, le second passage relisait la
// version déjà réécrite par le premier et n'annonçait plus rien.
let announced = false

// Signale une mise à jour de l'app. `PwaUpdater` recharge la page tout seul
// quand un nouveau build est en ligne : sans rien, la version change sous les
// pieds de l'utilisateur sans qu'il le sache. On compare donc la version du
// bundle courant à celle mémorisée au dernier lancement, et on annonce l'écart.
//
// Doit être monté à côté de `<Toaster />` (le toast passe par un événement
// window : sans Toaster dans l'arbre, personne ne l'écoute). Le délai laisse
// le temps au Toaster de s'abonner et évite de rivaliser avec le premier
// rendu de l'app ; il n'est volontairement pas annulé au démontage, sans quoi
// le remontage de StrictMode escamoterait le toast.
export default function VersionToast() {
  useEffect(() => {
    if (announced) return
    announced = true
    const current = process.env.NEXT_PUBLIC_APP_VERSION
    if (!current) return
    let previous: string | null = null
    try {
      previous = localStorage.getItem(STORAGE_KEY)
      localStorage.setItem(STORAGE_KEY, current)
    } catch {
      // Stockage indisponible (navigation privée) : pas de comparaison possible.
      return
    }
    // Première ouverture sur cet appareil : rien à annoncer, on se contente
    // de mémoriser la version pour la prochaine fois.
    if (!previous || previous === current) return
    setTimeout(() => toast(`Mise à jour installée — version ${current}`, 'success'), 600)
  }, [])

  return null
}
