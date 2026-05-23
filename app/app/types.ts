export type Page = {
  id: string
  parent_id: string | null
  title: string
  content: string
  icon: string
  color?: string | null   // ex: 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink' | null
  position: number
  updated_at: string
  deleted_at?: string | null
}

export const PAGE_COLORS: { name: string, value: string, bg: string, dot: string }[] = [
  { name: 'Aucune',  value: '',       bg: 'bg-gray-100',   dot: 'bg-gray-400' },
  { name: 'Rouge',   value: 'red',    bg: 'bg-red-50',     dot: 'bg-red-400' },
  { name: 'Orange',  value: 'orange', bg: 'bg-orange-50',  dot: 'bg-orange-400' },
  { name: 'Jaune',   value: 'yellow', bg: 'bg-yellow-50',  dot: 'bg-yellow-400' },
  { name: 'Vert',    value: 'green',  bg: 'bg-green-50',   dot: 'bg-green-400' },
  { name: 'Bleu',    value: 'blue',   bg: 'bg-blue-50',    dot: 'bg-blue-400' },
  { name: 'Violet',  value: 'purple', bg: 'bg-purple-50',  dot: 'bg-purple-400' },
  { name: 'Rose',    value: 'pink',   bg: 'bg-pink-50',    dot: 'bg-pink-400' },
]

export function colorBg(color?: string | null) {
  return PAGE_COLORS.find(c => c.value === color)?.bg || ''
}
