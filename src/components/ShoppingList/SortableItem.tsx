import { useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { motion } from 'framer-motion'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useApp } from '../../context/AppContext'
import { GripIcon } from '../ui/Icon'
import type { ShoppingItem } from '../../types'

const LONG_PRESS_MS = 450

export default function SortableItem({
  item,
  onLongPress,
  dragDisabled = false,
}: {
  item: ShoppingItem
  onLongPress: (item: ShoppingItem, rect: DOMRect) => void
  dragDisabled?: boolean
}) {
  const { updateItem } = useApp()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id, disabled: dragDisabled })

  const rowRef = useRef<HTMLDivElement | null>(null)
  const setRefs = (el: HTMLDivElement | null) => {
    setNodeRef(el)
    rowRef.current = el
  }

  const timer    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startPos = useRef<{ x: number; y: number } | null>(null)

  const clearTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }
  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.button && e.button !== 0) return
    startPos.current = { x: e.clientX, y: e.clientY }
    clearTimer()
    timer.current = setTimeout(() => {
      if (rowRef.current) onLongPress(item, rowRef.current.getBoundingClientRect())
      clearTimer()
    }, LONG_PRESS_MS)
  }
  const onPointerMove = (e: ReactPointerEvent) => {
    const s = startPos.current
    if (s && (Math.abs(e.clientX - s.x) > 10 || Math.abs(e.clientY - s.y) > 10)) clearTimer()
  }

  const style = {
    transform:  CSS.Transform.toString(transform),
    transition,
    opacity:    isDragging ? 0 : 1,
  }

  const qty = [item.quantity, item.unit].filter(Boolean).join(' ')

  return (
    <motion.div
      ref={setRefs}
      style={style}
      initial={false}
      exit={{ opacity: 0, height: 0, paddingTop: 0, paddingBottom: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      className="flex items-center gap-1.5 bg-white px-3 py-0"
    >
      {/* Drag-Handle — nur im Modus "Angepasst" sichtbar */}
      {dragDisabled ? (
        <div className="w-8 shrink-0" />
      ) : (
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="flex h-11 w-8 shrink-0 cursor-grab touch-none items-center justify-center text-zinc-300 transition-colors duration-150 hover:text-zinc-500 active:cursor-grabbing"
          aria-label="Verschieben"
        >
          <GripIcon size={13} />
        </button>
      )}

      {/* Checkbox */}
      <div className="flex shrink-0 items-center justify-center min-h-[44px] min-w-[44px]">
        <div className="relative flex items-center">
          <input
            type="checkbox"
            checked={item.is_done}
            onChange={() => updateItem(item.id, { is_done: !item.is_done })}
            className="peer h-[20px] w-[20px] cursor-pointer appearance-none rounded-full border-2 border-zinc-300 bg-white transition-all duration-150 checked:border-brand-600 checked:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-1"
          />
          <svg
            className="pointer-events-none absolute left-[3px] top-[4px] hidden h-[10px] w-[10px] text-white peer-checked:block"
            viewBox="0 0 10 8"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="1,4 4,7 9,1" />
          </svg>
        </div>
      </div>

      {/* Name + Menge – gedrückt halten zum Bearbeiten */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={clearTimer}
        onPointerLeave={clearTimer}
        onPointerCancel={clearTimer}
        onContextMenu={(e) => e.preventDefault()}
        className="flex min-w-0 flex-1 cursor-pointer select-none items-baseline gap-1.5 py-1"
        style={{ WebkitTouchCallout: 'none' }}
      >
        <span
          className={
            'truncate text-[14px] font-medium leading-tight transition-colors duration-200 ' +
            (item.is_done ? 'text-zinc-300 line-through decoration-zinc-300' : 'text-zinc-900')
          }
        >
          {item.name}
        </span>
        {qty && (
          <span
            className={
              'shrink-0 text-[14px] leading-tight ' +
              (item.is_done ? 'text-zinc-300' : 'text-zinc-400')
            }
          >
            <span className="text-zinc-300">|</span> {qty}
          </span>
        )}
      </div>
    </motion.div>
  )
}
