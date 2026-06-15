'use client'
import { createPortal } from 'react-dom'

export type Template = {
  icon: string
  title: string
  content: string
}

export const TEMPLATES: Template[] = [
  {
    icon: '📋',
    title: 'Compte-rendu de réunion',
    content: '<h2>Participants</h2><ul><li></li></ul><h2>Ordre du jour</h2><ul><li></li></ul><h2>Notes</h2><p></p><h2>Actions</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul>',
  },
  {
    icon: '🎯',
    title: 'Objectifs hebdo',
    content: '<h2>Semaine du …</h2><h3>Objectifs principaux</h3><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul><h3>Objectifs secondaires</h3><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul><h3>Bilan</h3><p></p>',
  },
  {
    icon: '📐',
    title: 'Spec technique',
    content: '<h2>Contexte</h2><p></p><h2>Objectif</h2><p></p><h2>Solution proposée</h2><p></p><h2>Alternatives considérées</h2><p></p><h2>Risques</h2><p></p>',
  },
  {
    icon: '📓',
    title: 'Journal quotidien',
    content: '<h2>Comment je me sens</h2><p></p><h2>Ce qui s\'est passé</h2><p></p><h2>Ce que j\'ai appris</h2><p></p><h2>Demain</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul>',
  },
  {
    icon: '🧠',
    title: 'Brainstorm',
    content: '<h2>Problème / Question</h2><p></p><h2>Idées brutes</h2><ul><li></li><li></li><li></li></ul><h2>Idées à approfondir</h2><ul><li></li></ul>',
  },
]

export default function TemplateModal({ onSelect, onClose }: {
  onSelect: (t: Template) => void
  onClose: () => void
}) {
  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl p-5 shadow-xl"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Nouveau depuis un template</p>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-md transition-opacity hover:opacity-70"
            style={{ color: 'var(--text-muted)' }}>✕</button>
        </div>
        <div className="flex flex-col gap-1">
          <button
            onClick={() => onSelect({ icon: '📄', title: 'Sans titre', content: '' })}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <span className="text-lg">📄</span>
            <div>
              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Page vide</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Commence from scratch</p>
            </div>
          </button>
          {TEMPLATES.map(t => (
            <button key={t.title}
              onClick={() => onSelect(t)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left transition-colors"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <span className="text-lg">{t.icon}</span>
              <div>
                <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{t.title}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}
