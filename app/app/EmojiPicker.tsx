'use client'
import { useEffect, useRef } from 'react'
import { Picker } from '@emoji-mart/react'

// On charge les données dynamiquement avec un require pour court-circuiter le compilateur TypeScript
// @ts-ignore
import data from '@emoji-mart/data'

export default function EmojiPicker({ onSelect, onClose }: { onSelect: (emoji: string) => void, onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)

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
      <Picker 
        data={data} 
        onEmojiSelect={(emoji: any) => onSelect(emoji.native)}
        locale="fr"
        theme="light"
      />
    </div>
  )
}'use client'
import { useEffect, useRef } from 'react'
import data from '@emoji-mart/data'
import { Picker } from '@emoji-mart/react'

export default function EmojiPicker({ onSelect, onClose }: { onSelect: (emoji: string) => void, onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)

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
      <Picker 
        data={data} 
        onEmojiSelect={(emoji: any) => onSelect(emoji.native)}
        locale="fr"
        theme="light"
      />
    </div>
  )
}
