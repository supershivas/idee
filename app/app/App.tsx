'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Editor from './Editor'

export type Page = {
  id: string
  parent_id: string | null
  title: string
  content: string
  icon: string
  position: number
  updated_at: string
}

const DEFAULT_ICONS = ['📄', '📝', '💡', '🗂️', '📌', '🔖', '⭐', '🚀', '🎯', '💬']
const ICON_OPTIONS = ['📄', '📝', '💡', '🗂️', '📌', '🔖', '⭐', '🚀', '🎯', '💬', '🏠', '🔧', '📊', '🎨', '📚', '🌿', '🔍', '💼', '🎵', '🧪']

function IconPicker({ current, onChange, onClose }: { current: string, onChange: (icon: string) => void, onClose: () => void }) {
  return (
    <div className="absolute top-full left-0 mt-1 bg-white border rounded-xl shadow-xl p-3 z-50 w-52">
      <div className="grid grid-cols-5 gap-1">
        {ICON_OPTIONS.map(icon => (
          <button
            key={icon}
            onClick={() => { onChange(icon); onClose() }}
            className={`w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-lg transition-colors ${current === icon ? 'bg-gray-200' : ''}`}
          >
            {icon}
          </button>
        ))}
      </div>
    </div>
  )
}

function PageTree({ pages, parentId, depth, selectedId, onSelect, onAdd, onUpdateIcon }:
  { pages: Page[], parentId: string | null, depth: number, selectedId: string | null, onSelect: (p: Page) => void, onAdd: (parentId: string | null) => void, onUpdateIcon: (id: string, icon: string) => void }
) {
  const children = pages.filter(p => p.parent_id === parentId)
  const [open, setOpen] = useState<Record<string, boolean>>({})

  if (!children.length) return null

  return (
    <div>
      {children.map(page => {
        const hasChildren = pages.some(p => p.parent_id === page.id)
