'use client'
import { useEffect, useRef, useState } from 'react'

export default function EmojiPicker({ onSelect, onClose }: { onSelect: (emoji: string) => void, onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [Picker, setPicker] = useState<any>(null)
  const [data, setData] = useState<any>(null)

  // Import dynamique pour éviter les erreurs TypeScript avec @emoji-mart
  useEffect(() => {
    Promise.all([
      import('@emoji-mart/react'),
      import('@emoji-mart/data'),
    ]).then(([pickerModule, dataModule]) => {
      setPicker(() => pickerModule.default)
      setData(dataModule.default)
    })
  }, [])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  return (
    <div ref={ref} className="absolute z-50 shadow-2xl rounded-xl mt-2">
      {Picker && data ? (
        <Picker
          data={data}
          onEmojiSelect={(emoji: any) => onSelect(emoji.native)}
          locale="fr"
          theme="light"
        />
      ) : (
        <div className="w-64 h-40 flex items-center justify-center bg-white rounded-xl border text-sm text-gray-400">
          Chargement…
        </div>
      )}
    </div>
  )
}
