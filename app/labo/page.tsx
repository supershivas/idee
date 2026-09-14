'use client'
import { useState } from 'react'
import { PanelA, PanelB, Result } from './panels'
import './labo.css'

const AVANT = 'Pour la suite du chantier, voir '
const SELECTION = 'le plan de printemps'
const APRES = ' — la liste des essences y est à jour.'

// Rend la phrase avec la sélection telle qu'elle sera : lien de page (pastille
// colorée, comme `.page-link`) ou lien externe (souligné discret, comme
// `.prose a`). C'est le vrai point de comparaison — le reste n'est que
// l'emballage qui y mène.
function Phrase({ result }: { result: Result }) {
  return (
    <p className="text-[15px] leading-relaxed" style={{ color: 'var(--prose-color)' }}>
      {AVANT}
      {result === null ? (
        <span style={{ background: 'var(--search-highlight)', borderRadius: 3, padding: '1px 2px' }}>{SELECTION}</span>
      ) : result.kind === 'page' ? (
        <span className="labo-pagelink">{result.page.icon} {SELECTION}</span>
      ) : (
        <span className="labo-weblink">{SELECTION}</span>
      )}
      {APRES}
    </p>
  )
}

function Legende({ result }: { result: Result }) {
  if (!result) return <p className="text-xs" style={{ color: 'var(--text-faint)' }}>Sélection en attente d’un lien.</p>
  return result.kind === 'page'
    ? <p className="text-xs" style={{ color: 'var(--text-muted)' }}>→ lien de page vers <b>{result.page.title}</b>{result.page.parent ? ` (${result.page.parent})` : ''}</p>
    : <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>→ lien externe vers <b>{result.href}</b></p>
}

// ── A et B : une modale, deux présentations ──────────────────────────────────
function Carte({ n, titre, note, children }: { n: string; titre: string; note: string; children: React.ReactNode }) {
  return (
    <figure className="flex flex-col" style={{ width: 340 }}>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>{n}</span>
        <figcaption className="font-medium">{titre}</figcaption>
      </div>
      {children}
      <p className="text-xs mt-3 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{note}</p>
    </figure>
  )
}

function Boite({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
      {children}
    </div>
  )
}

export default function LaboLiens() {
  const [rA, setRA] = useState<Result>(null)
  const [rB, setRB] = useState<Result>(null)
  const [rC, setRC] = useState<Result>(null)
  const [ouvertC, setOuvertC] = useState(false)
  const [dark, setDark] = useState(false)
  const [keyA, setKeyA] = useState(0)
  const [keyB, setKeyB] = useState(0)
  const [keyC, setKeyC] = useState(0)

  function reset() {
    setRA(null); setRB(null); setRC(null); setOuvertC(false)
    setKeyA(k => k + 1); setKeyB(k => k + 1); setKeyC(k => k + 1)
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--app-bg)', color: 'var(--text-primary)' }}>
      <header className="sticky top-0 z-30 px-6 py-4 flex flex-wrap items-center gap-x-5 gap-y-3"
        style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--border)' }}>
        <div className="mr-auto">
          <h1 className="text-xl font-semibold" style={{ fontFamily: 'var(--font-title)' }}>Labo — lier une sélection</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Trois façons d’offrir le choix entre une page et le web. Elles marchent : tape, navigue aux flèches, valide.
          </p>
        </div>
        <button onClick={reset} className="text-sm font-medium px-3 py-2 rounded-xl"
          style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)' }}>Réinitialiser</button>
        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <input type="checkbox" checked={dark} onChange={e => { setDark(e.target.checked); document.documentElement.classList.toggle('dark', e.target.checked) }} /> Thème sombre
        </label>
      </header>

      <p className="px-6 pt-6 text-xs" style={{ color: 'var(--text-faint)' }}>
        Essais utiles : <b>plan</b> (une page) · <b>notes</b> (deux homonymes, départagés par leur parent) ·
        <b> lemonde.fr</b> (adresse sans protocole) · <b>été</b> (accent).
      </p>

      <div className="px-6 py-6 flex flex-wrap gap-10 justify-center items-start">
        <Carte n="A" titre="Un seul champ qui devine"
          note="Aucun mode à choisir. La ligne « lien externe » n’apparaît que si ce que tu tapes ressemble à une adresse, et passe alors en tête, sous la touche Entrée. Le cas le plus fréquent — lier vers une de tes pages — devient le cas par défaut.">
          <Boite>
            <Phrase result={rA} />
            <div className="h-px my-3" style={{ background: 'var(--border-light)' }} />
            <PanelA key={keyA} onDone={setRA} />
            <div className="mt-2"><Legende result={rA} /></div>
          </Boite>
        </Carte>

        <Carte n="B" titre="Deux onglets"
          note="Explicite, impossible à mal comprendre. Mais il faut trancher avant de commencer à taper, pour une question dont la réponse est presque toujours déductible — et l’onglet actif au prochain lien devient une question de plus.">
          <Boite>
            <Phrase result={rB} />
            <div className="h-px my-3" style={{ background: 'var(--border-light)' }} />
            <PanelB key={keyB} onDone={setRB} />
            <div className="mt-2"><Legende result={rB} /></div>
          </Boite>
        </Carte>

        <Carte n="C" titre="Une bulle ancrée à la sélection"
          note="Même champ qu’en A, mais rien ne recouvre la page : on voit le texte qu’on est en train de lier. C’est la présentation la plus soignée et la plus coûteuse — positionnement, bords d’écran, clavier iOS. À voir comme l’emballage de A, pas comme une autre logique.">
          <Boite>
            <div className="labo-ancre">
              <Phrase result={rC} />
              {!ouvertC && (
                <button onClick={() => setOuvertC(true)} className="labo-bulle-btn">
                  <i className="ti ti-link" style={{ fontSize: 14 }} /> Lier
                </button>
              )}
              {ouvertC && (
                <div className="labo-bulle">
                  <PanelA key={keyC} onDone={r => { setRC(r); setOuvertC(false) }} />
                </div>
              )}
            </div>
            {/* Réserve la place de la bulle, qui flotte au-dessus du texte :
                sans cela elle débordait sur la légende de la carte. */}
            <div className="mt-2" style={{ paddingTop: ouvertC ? 300 : 0 }}><Legende result={rC} /></div>
          </Boite>
        </Carte>
      </div>

      <div className="px-6 pb-12 max-w-3xl mx-auto">
        <h2 className="font-medium mb-2">Deux compléments, indépendants du choix ci-dessus</h2>
        <ul className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          <li className="mb-1"><b>D · Le collage.</b> Sélectionner du texte puis coller une adresse la transforme en lien, sans ouvrir quoi que ce soit. Colle l’adresse d’une de tes pages : elle devient un lien de page. Aucune interface, et c’est ainsi que se pose la majorité des liens.</li>
          <li><b>E · <code>[[</code> sur une sélection.</b> Ouvre la recherche de pages pré-remplie avec le texte sélectionné, et conserve ta formulation au lieu de la remplacer par le titre de la page.</li>
        </ul>
      </div>

      <p className="text-xs text-center pb-10" style={{ color: 'var(--text-faint)' }}>
        Page temporaire — à retirer une fois le choix fait.
      </p>
    </div>
  )
}
