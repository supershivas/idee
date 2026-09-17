'use client'
import { useState, useEffect, useCallback } from 'react'

// État du stockage local — ce que l'app occupe sur l'appareil pour fonctionner
// hors ligne (cache du service worker, données locales), et ce que le
// navigateur lui accorde. Ce n'est PAS le poids des notes sur le serveur :
// celles-ci vivent chez Supabase et ne comptent pas dans ce quota.
type Estimate = {
  usage: number
  quota: number
  details?: Record<string, number>
}

// Unités françaises, une décimale au-delà du mégaoctet — « 4,2 Mo » se lit,
// « 4404019 octets » non.
export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '—'
  if (n < 1024) return `${n} o`
  const unites = ['ko', 'Mo', 'Go', 'To']
  let v = n / 1024
  let i = 0
  while (v >= 1024 && i < unites.length - 1) { v /= 1024; i++ }
  // Une décimale tant que le nombre est petit, aucune au-delà de 100 — et
  // jamais de « ,0 » traînant, qui donne l'air d'une mesure plus précise
  // qu'elle ne l'est.
  const dec = v >= 100 ? 0 : 1
  return `${v.toFixed(dec).replace(/\.0$/, '').replace('.', ',')} ${unites[i]}`
}

const LIBELLES: Record<string, string> = {
  caches: 'Cache hors-ligne',
  indexedDB: 'Base locale',
  serviceWorkerRegistrations: 'Service worker',
  fileSystem: 'Fichiers',
}

export function StorageUsage() {
  const [est, setEst] = useState<Estimate | null>(null)
  // `null` tant qu'on n'a pas tranché, pour ne pas afficher l'indisponibilité
  // le temps de la première mesure.
  const [dispo, setDispo] = useState<boolean | null>(null)

  const mesurer = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.storage?.estimate) { setDispo(false); return }
    try {
      const r: any = await navigator.storage.estimate()
      if (typeof r?.usage !== 'number' || typeof r?.quota !== 'number') { setDispo(false); return }
      setEst({ usage: r.usage, quota: r.quota, details: r.usageDetails })
      setDispo(true)
    } catch { setDispo(false) }
  }, [])

  useEffect(() => { void mesurer() }, [mesurer])

  if (dispo === null) return null
  if (dispo === false) {
    return (
      <p className="text-xs mt-2 px-1" style={{ color: 'var(--text-muted)' }}>
        Ce navigateur ne communique pas son état de stockage.
      </p>
    )
  }

  const { usage, quota, details } = est!
  // Le quota est souvent immense : un pourcentage à l'entier afficherait 0 %
  // en permanence et n'apprendrait rien. On garde une décimale sous 10 %.
  const pct = quota > 0 ? (usage / quota) * 100 : 0
  const pctTexte = pct >= 10 ? `${Math.round(pct)} %` : `${pct.toFixed(1).replace('.', ',')} %`
  // Une barre à zéro pixel ne se lit pas comme « presque rien » mais comme un
  // défaut d'affichage : on lui garde une amorce. Trois pour cent et non deux,
  // car en dessous le remplissage devient plus large que haut et se lit comme
  // une puce, pas comme une barre.
  const largeur = Math.max(usage > 0 ? 3 : 0, Math.min(100, pct))
  const lignes = Object.entries(details || {})
    .filter(([, v]) => typeof v === 'number' && v > 0)
    .sort((a, b) => b[1] - a[1])

  return (
    <div className="mt-2 rounded-xl px-3 py-3" style={{ background: 'var(--selected-bg)' }}>
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {formatBytes(usage)} <span className="font-normal" style={{ color: 'var(--text-muted)' }}>sur {formatBytes(quota)}</span>
        </p>
        <p className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>{pctTexte}</p>
      </div>

      <div className="rounded-full overflow-hidden" style={{ height: 6, background: 'var(--border)' }}>
        <div style={{ width: `${largeur}%`, height: '100%', background: 'var(--accent)', transition: 'width 300ms ease' }} />
      </div>

      {lignes.length > 0 && (
        <div className="mt-2.5 flex flex-col gap-1">
          {lignes.map(([cle, v]) => (
            <div key={cle} className="flex items-center justify-between text-[11px]">
              <span style={{ color: 'var(--text-muted)' }}>{LIBELLES[cle] || cle}</span>
              <span className="tabular-nums" style={{ color: 'var(--text-secondary)' }}>{formatBytes(v)}</span>
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] mt-2.5 leading-relaxed" style={{ color: 'var(--text-faint)' }}>
        Place occupée sur cet appareil pour la lecture hors ligne. Tes notes,
        elles, sont conservées sur le serveur et ne comptent pas ici.
      </p>
    </div>
  )
}
