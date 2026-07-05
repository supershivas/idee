'use client'
import { SaveState } from '../types'

const LABELS: Record<SaveState, string> = {
  saved: 'Enregistré',
  pending: 'Modifications non enregistrées',
  saving: 'Enregistrement…',
  error: 'Erreur de sauvegarde — nouvel essai automatique',
}

// Pastille d'état de sauvegarde : invisible quand tout est enregistré,
// ambre pulsante quand des modifications sont en attente ou en cours
// d'écriture, rouge en cas d'échec (retenté automatiquement).
export function SaveIndicator({ saveState }: { saveState: SaveState }) {
  return (
    <span
      title={LABELS[saveState]}
      className={`w-4 h-4 flex items-center justify-center transition-opacity ${saveState !== 'saved' ? 'opacity-100' : 'opacity-0'}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${saveState === 'error' ? 'bg-red-500' : 'bg-amber-400 animate-pulse'}`} />
    </span>
  )
}
