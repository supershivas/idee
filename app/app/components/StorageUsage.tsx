'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

// Unités françaises, une décimale tant que le nombre est petit — « 4,2 Mo » se
// lit, « 4404019 octets » non.
export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '—'
  if (n < 1024) return `${n} o`
  const unites = ['ko', 'Mo', 'Go', 'To']
  let v = n / 1024
  let i = 0
  while (v >= 1024 && i < unites.length - 1) { v /= 1024; i++ }
  // Aucune décimale au-delà de 100, et jamais de « ,0 » traînant, qui donne
  // l'air d'une mesure plus précise qu'elle ne l'est.
  const dec = v >= 100 ? 0 : 1
  return `${v.toFixed(dec).replace(/\.0$/, '').replace('.', ',')} ${unites[i]}`
}

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

type Memo = { u: ServerUsage; date: string }

// localStorage lève en navigation privée sur certains navigateurs : le poids
// s'affiche alors sans jamais être mémorisé, ce qui reste acceptable.
function lireMemo(): Memo | null {
  try {
    const brut = localStorage.getItem(CLE_CACHE)
    if (!brut) return null
    const m = JSON.parse(brut)
    if (!m || typeof m.date !== 'string' || !m.u || typeof m.u.texte !== 'number') return null
    return m as Memo
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
      const m: Memo = { u, date: new Date().toISOString() }
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
      <p className="text-[11px] mt-2.5 leading-relaxed" style={{ color: 'var(--text-faint)' }}>
        {etat === 'erreur'
          ? 'Dernier calcul impossible — chiffres du '
          : 'Texte des notes et images envoyées, mesurés sur le serveur. Mis à jour le '}
        {formatDate(memo.date)}.
      </p>
    </div>
  )
}
