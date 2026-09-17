'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { QuotaChart, TrendChart, type Point } from './UsageCharts'
import { formatBytes } from './formatBytes'


// ── Poids réel des notes, côté serveur ───────────────────────────────────────
// Deux sources distinctes, et c'est tout l'intérêt de les séparer : le texte
// vit dans la table `pages`, les images dans le bucket `images`. Une note qui
// « pèse » lourd, c'est presque toujours ses images — le texte, lui, dépasse
// rarement quelques mégaoctets pour une vie entière de prise de notes.
//
// Calcul à la demande et non au montage : mesurer le texte suppose de le
// rapatrier entièrement, ce qui ne doit pas se payer à chaque ouverture des
// paramètres. Le dernier résultat est donc conservé, avec sa date : entre deux
// calculs, on lit un chiffre daté plutôt qu'un bouton.
type ServerUsage = {
  texte: number
  corbeille: number
  images: number
  nbImages: number
  pages: number
  journal: number
}

// Séparé du composant pour être éprouvable : la pagination du listage et le
// comptage des octets sont la seule partie où l'on peut se tromper en silence.
export async function computeServerUsage(supabase: any, userId: string): Promise<ServerUsage> {
  const octets = (s: string | null | undefined) => (s ? new TextEncoder().encode(s).length : 0)

  const { data: rows, error } = await supabase.from('pages').select('title, content, summary, type, deleted_at')
  if (error) throw error

  const acc: ServerUsage = { texte: 0, corbeille: 0, images: 0, nbImages: 0, pages: 0, journal: 0 }
  for (const r of rows || []) {
    const n = octets(r.title) + octets(r.content) + octets(r.summary)
    acc.texte += n
    if (r.deleted_at) acc.corbeille += n
    else if (r.type === 'journal') acc.journal += n
    else acc.pages += n
  }

  // Le listage est paginé : sans cette boucle on s'arrêterait aux cent
  // premières images, et le total serait faux sans jamais le dire.
  let offset = 0
  const lot = 100
  for (;;) {
    const { data: fichiers, error: e2 } = await supabase.storage.from('images').list(userId, { limit: lot, offset })
    if (e2) throw e2
    for (const f of fichiers || []) {
      const taille = f?.metadata?.size
      if (typeof taille === 'number') { acc.images += taille; acc.nbImages++ }
    }
    if (!fichiers || fichiers.length < lot) break
    offset += lot
  }
  return acc
}

const CLE_CACHE = 'idee_notes_usage'

type Memo = { u: ServerUsage; date: string; hist?: Point[] }

// Assez de points pour une courbe lisible, pas assez pour peser : quelques
// centaines d'octets dans localStorage.
const MAX_POINTS = 60

// Un point par jour au plus : deux calculs dans la même minute décriraient une
// évolution qui n'existe pas. Le dernier mesuré du jour l'emporte.
function ajouterPoint(hist: Point[], u: ServerUsage, date: string): Point[] {
  const jour = (iso: string) => iso.slice(0, 10)
  const point: Point = { d: date, t: u.texte, i: u.images }
  const sans = hist.filter(p => jour(p.d) !== jour(date))
  return [...sans, point].slice(-MAX_POINTS)
}

// localStorage lève en navigation privée sur certains navigateurs : le poids
// s'affiche alors sans jamais être mémorisé, ce qui reste acceptable.
function lireMemo(): Memo | null {
  try {
    const brut = localStorage.getItem(CLE_CACHE)
    if (!brut) return null
    const m = JSON.parse(brut)
    if (!m || typeof m.date !== 'string' || !m.u || typeof m.u.texte !== 'number') return null
    // `hist` est arrivé après coup : une mémoire enregistrée par une version
    // précédente reste lisible, elle démarre simplement sans historique.
    const hist = Array.isArray(m.hist)
      ? m.hist.filter((p: any) => p && typeof p.d === 'string' && typeof p.t === 'number' && typeof p.i === 'number')
      : []
    return { u: m.u, date: m.date, hist } as Memo
  } catch { return null }
}

function ecrireMemo(m: Memo) {
  try { localStorage.setItem(CLE_CACHE, JSON.stringify(m)) } catch {}
}

// « Mis à jour le 17 septembre 2026 à 14:03 » — la date seule suffirait si le
// calcul était rare, mais on peut le relancer à la minute.
export function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function ServerUsage({ userId, client }: { userId: string; client?: any }) {
  const [etat, setEtat] = useState<'repos' | 'calcul' | 'erreur'>('repos')
  const [memo, setMemo] = useState<Memo | null>(null)

  // Lecture au montage et non à l'initialisation de l'état : le rendu serveur
  // n'a pas de localStorage, et un état initial divergent casserait l'hydratation.
  useEffect(() => { setMemo(lireMemo()) }, [])

  async function calculer() {
    setEtat('calcul')
    try {
      const u = await computeServerUsage(client || createClient(), userId)
      const date = new Date().toISOString()
      const m: Memo = { u, date, hist: ajouterPoint(memo?.hist || [], u, date) }
      ecrireMemo(m)
      setMemo(m)
      setEtat('repos')
    } catch {
      setEtat('erreur')
    }
  }

  // Aucun chiffre encore mesuré : il n'y a rien à afficher qu'une invitation.
  if (!memo) {
    return (
      <button onClick={calculer} disabled={etat === 'calcul'}
        className="mt-2 w-full flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm disabled:opacity-60"
        style={{ background: 'var(--selected-bg)', color: etat === 'erreur' ? 'var(--text-muted)' : 'var(--text-secondary)' }}>
        <i className="ti ti-cloud" style={{ fontSize: 15 }} />
        {etat === 'calcul' ? 'Calcul en cours…' : etat === 'erreur' ? 'Calcul impossible — réessayer' : 'Calculer le poids de mes notes'}
      </button>
    )
  }

  const { texte, corbeille, images, nbImages, pages, journal } = memo.u
  const lignes: [string, string][] = [
    ['Pages', formatBytes(pages)],
    ['Journal', formatBytes(journal)],
    ...(corbeille > 0 ? [['Corbeille', formatBytes(corbeille)] as [string, string]] : []),
    ['Images', `${formatBytes(images)}${nbImages ? ` · ${nbImages}` : ''}`],
  ]

  return (
    <div className="mt-2 rounded-xl px-3 py-3" style={{ background: 'var(--selected-bg)' }}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {formatBytes(texte + images)} <span className="font-normal" style={{ color: 'var(--text-muted)' }}>au total</span>
        </p>
        <button onClick={calculer} disabled={etat === 'calcul'} title="Recalculer"
          aria-label="Recalculer le poids de mes notes"
          className="shrink-0 -mt-0.5 -mr-1 p-1 rounded-lg disabled:opacity-60"
          style={{ color: 'var(--text-muted)' }}>
          <i className={`ti ti-refresh${etat === 'calcul' ? ' animate-spin' : ''}`} style={{ fontSize: 14, display: 'block' }} />
        </button>
      </div>
      <div className="flex flex-col gap-1">
        {lignes.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between text-[11px]">
            <span style={{ color: 'var(--text-muted)' }}>{k}</span>
            <span className="tabular-nums" style={{ color: 'var(--text-secondary)' }}>{v}</span>
          </div>
        ))}
      </div>
      <QuotaChart texte={texte} images={images} />
      <TrendChart points={memo.hist || []} />

      <p className="text-[11px] mt-2.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        {etat === 'erreur'
          ? 'Dernier calcul impossible — chiffres du '
          : 'Texte des notes et images envoyées, mesurés sur le serveur. Mis à jour le '}
        {formatDate(memo.date)}.
      </p>
    </div>
  )
}
