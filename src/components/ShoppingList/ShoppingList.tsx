import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useApp } from '../../context/AppContext'
import type { ShoppingItem, ViewMode, ItemSort } from '../../types'
import AddItemForm from './AddItemForm'
import ItemContextMenu, { type PartialInfo } from './ItemContextMenu'
import SortableItem from './SortableItem'
import { PlusIcon, ChevronRightIcon, StoreIcon, TagIcon, GripIcon, CalendarIcon, NameSortIcon, GroupingIcon, SortingIcon } from '../ui/Icon'

const REMOVE_DELAY = 4000

interface Group {
  key:   string
  title: string
  items: ShoppingItem[]
}

const MODES: { value: ViewMode; label: string }[] = [
  { value: 'all',      label: 'Ohne'  },
  { value: 'store',    label: 'Laden' },
  { value: 'category', label: 'Kat.'  },
]

const SORT_MODES: { value: ItemSort; label: string }[] = [
  { value: 'custom',  label: 'Manuell' },
  { value: 'created', label: 'Datum'   },
  { value: 'alpha',   label: 'Name'    },
]

interface Pending {
  key:   string
  title: string
}

interface UndoPartialState {
  id:           string
  label:        string
  originalQty:  string | null
  wasMarkedDone: boolean
}


function GripDots() {
  return (
    <svg width="9" height="15" viewBox="0 0 9 15" fill="currentColor">
      <circle cx="2.5" cy="2.5"  r="1.3" />
      <circle cx="6.5" cy="2.5"  r="1.3" />
      <circle cx="2.5" cy="7.5"  r="1.3" />
      <circle cx="6.5" cy="7.5"  r="1.3" />
      <circle cx="2.5" cy="12.5" r="1.3" />
      <circle cx="6.5" cy="12.5" r="1.3" />
    </svg>
  )
}

function OverlayRow({ item }: { item: ShoppingItem }) {
  const qty = [item.quantity, item.unit].filter(Boolean).join(' ')
  return (
    <div className="flex cursor-grabbing items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-soft ring-1 ring-black/[0.06]">
      <span className="flex h-7 w-4 items-center justify-center text-zinc-400">
        <GripDots />
      </span>
      <span
        className={
          'h-[20px] w-[20px] shrink-0 rounded-full border-2 ' +
          (item.is_done ? 'border-brand-600 bg-brand-600' : 'border-zinc-300 bg-white')
        }
      />
      <div className="flex min-w-0 flex-1 items-baseline gap-1.5">
        <span
          className={
            'truncate text-[14px] font-medium leading-tight ' +
            (item.is_done ? 'text-zinc-300 line-through' : 'text-zinc-900')
          }
        >
          {item.name}
        </span>
        {qty && (
          <span className="shrink-0 text-[14px] leading-tight text-zinc-400">
            <span className="text-zinc-300">|</span> {qty}
          </span>
        )}
      </div>
    </div>
  )
}

export default function ShoppingList() {
  const {
    items, stores, categories,
    reorderItems, updateItem, deleteItem,
    addStore, addCategory, deleteCategory,
  } = useApp()

  const [mode, setMode]             = useState<ViewMode>('all')
  const [sort, setSort]             = useState<ItemSort>('custom')
  const [sheetOpen, setSheetOpen]   = useState(false)
  const [addingGroup, setAdding]    = useState(false)
  const [groupName, setGroupName]   = useState('')
  const [groupError, setGroupError] = useState('')
  const [pending, setPending]       = useState<Pending | null>(null)
  const [activeId, setActiveId]     = useState<string | null>(null)
  const [undoItem, setUndoItem]     = useState<{ id: string; name: string } | null>(null)
  const [undoPartial, setUndoPartial] = useState<UndoPartialState | null>(null)
  const [undoDelete, setUndoDelete] = useState<{ id: string; name: string } | null>(null)
  const [menu, setMenu]             = useState<{ item: ShoppingItem; rect: DOMRect } | null>(null)
  const [collapsed, setCollapsed]   = useState<Set<string>>(new Set())

  const dismissed          = useRef<Set<string>>(new Set())
  const groupInputRef      = useRef<HTMLInputElement>(null)
  const prevCounts         = useRef<Map<string, number>>(new Map())
  const deleteTimers       = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const suppressUndoIds    = useRef<Set<string>>(new Set())
  const pendingDeleteId    = useRef<string | null>(null)
  const directDeleteTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Stabile Referenz auf Context-Funktionen
  const fns = useRef({ updateItem, deleteItem })
  fns.current = { updateItem, deleteItem }

  // Timer-Callback kann setUndoPartial aufrufen
  const clearPartialUndo = useRef<(id: string) => void>(() => {})
  clearPartialUndo.current = (id: string) => {
    setUndoPartial((u) => (u?.id === id ? null : u))
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const sorted = useMemo(() => {
    const arr = [...items]
    if (sort === 'alpha')   return arr.sort((a, b) => a.name.localeCompare(b.name, 'de'))
    if (sort === 'created') return arr.sort((a, b) => a.created_at.localeCompare(b.created_at))
    return arr.sort((a, b) => a.position - b.position)
  }, [items, sort])

  const groups: Group[] = useMemo(() => {
    if (mode === 'all') {
      return [{ key: 'all', title: '', items: sorted }]
    }
    if (mode === 'store') {
      const result: Group[] = stores.map((s) => ({
        key: s.id, title: s.name,
        items: sorted.filter((i) => i.store_id === s.id),
      }))
      const orphans = sorted.filter((i) => !i.store_id || !stores.some((s) => s.id === i.store_id))
      if (orphans.length) result.push({ key: 'none', title: 'Ohne Laden', items: orphans })
      return result.filter((g) => g.items.length > 0)
    }
    const result: Group[] = categories.map((c) => ({
      key: c.id, title: c.name,
      items: sorted.filter((i) => i.category_id === c.id),
    }))
    const orphans = sorted.filter(
      (i) => !i.category_id || !categories.some((c) => c.id === i.category_id)
    )
    if (orphans.length) result.push({ key: 'none', title: 'Ohne Kategorie', items: orphans })
    return result.filter((g) => g.items.length > 0)
  }, [mode, sorted, stores, categories])

  const activeItem = activeId ? items.find((i) => i.id === activeId) ?? null : null

  // Abgehakte Artikel nach kurzer Verzögerung automatisch entfernen
  useEffect(() => {
    const timers = deleteTimers.current
    for (const it of items) {
      if (it.is_done && !timers.has(it.id)) {
        const id = it.id
        const t = setTimeout(() => {
          fns.current.deleteItem(id)
          timers.delete(id)
          setUndoItem((u) => (u?.id === id ? null : u))
          clearPartialUndo.current(id)
          suppressUndoIds.current.delete(id)
        }, REMOVE_DELAY)
        timers.set(id, t)
        // Regulären Undo-Toast nur zeigen wenn nicht von "Anteil erhalten" ausgelöst
        if (!suppressUndoIds.current.has(it.id)) {
          setUndoItem({ id, name: it.name })
        }
      }
    }
    for (const [id, t] of timers) {
      const cur = items.find((i) => i.id === id)
      if (!cur || !cur.is_done) {
        clearTimeout(t)
        timers.delete(id)
        setUndoItem((u) => (u?.id === id ? null : u))
      }
    }
  }, [items])

  useEffect(() => {
    const timers = deleteTimers.current
    return () => {
      timers.forEach((t) => clearTimeout(t))
      timers.clear()
    }
  }, [])

  // Partial-Undo-Toast nach 3 Sekunden automatisch ausblenden
  useEffect(() => {
    if (!undoPartial) return
    const t = setTimeout(() => setUndoPartial(null), REMOVE_DELAY)
    return () => clearTimeout(t)
  }, [undoPartial])

  const undoCheck = () => {
    if (!undoItem) return
    const t = deleteTimers.current.get(undoItem.id)
    if (t) {
      clearTimeout(t)
      deleteTimers.current.delete(undoItem.id)
    }
    fns.current.updateItem(undoItem.id, { is_done: false })
    setUndoItem(null)
  }

  const undoPartialAction = () => {
    if (!undoPartial) return
    const t = deleteTimers.current.get(undoPartial.id)
    if (t) {
      clearTimeout(t)
      deleteTimers.current.delete(undoPartial.id)
    }
    suppressUndoIds.current.delete(undoPartial.id)
    if (undoPartial.wasMarkedDone) {
      fns.current.updateItem(undoPartial.id, { is_done: false, quantity: undoPartial.originalQty })
    } else {
      fns.current.updateItem(undoPartial.id, { quantity: undoPartial.originalQty })
    }
    setUndoPartial(null)
  }

  const handleDirectDelete = useCallback((item: ShoppingItem) => {
    // Wenn noch ein vorheriger Löschvorgang aussteht, sofort committen
    if (directDeleteTimer.current) {
      clearTimeout(directDeleteTimer.current)
      directDeleteTimer.current = null
      if (pendingDeleteId.current) fns.current.deleteItem(pendingDeleteId.current)
    }
    pendingDeleteId.current = item.id
    setUndoDelete({ id: item.id, name: item.name })
    directDeleteTimer.current = setTimeout(() => {
      fns.current.deleteItem(item.id)
      pendingDeleteId.current = null
      directDeleteTimer.current = null
      setUndoDelete(null)
    }, REMOVE_DELAY)
  }, [])

  const undoDeleteAction = useCallback(() => {
    if (directDeleteTimer.current) {
      clearTimeout(directDeleteTimer.current)
      directDeleteTimer.current = null
    }
    pendingDeleteId.current = null
    setUndoDelete(null)
  }, [])

  const handlePartialConfirmed = useCallback((info: PartialInfo) => {
    if (info.wasMarkedDone) suppressUndoIds.current.add(info.id)
    const gotStr = info.unit ? `${info.got} ${info.unit}` : String(info.got)
    setUndoPartial({
      id:            info.id,
      label:         `„${info.name}" erhalten (${gotStr})`,
      originalQty:   info.originalQty || null,
      wasMarkedDone: info.wasMarkedDone,
    })
  }, [])

  // Auto-Abfrage für leere Kategorien
  useEffect(() => {
    if (mode !== 'category') {
      prevCounts.current.clear()
      return
    }
    const counts = new Map<string, number>()
    for (const c of categories) {
      const n = items.filter((i) => i.category_id === c.id).length
      counts.set(c.id, n)
      if (n > 0) dismissed.current.delete(c.id)
    }
    if (!pending) {
      for (const c of categories) {
        const prev = prevCounts.current.get(c.id) ?? 0
        const now  = counts.get(c.id) ?? 0
        if (prev > 0 && now === 0 && !dismissed.current.has(c.id)) {
          setPending({ key: c.id, title: c.name })
          break
        }
      }
    }
    prevCounts.current = counts
  }, [items, categories, mode, pending])

  const confirmDelete = async () => {
    if (!pending) return
    const p = pending
    setPending(null)
    await deleteCategory(p.key)
  }

  const keepGroup = () => {
    if (pending) dismissed.current.add(pending.key)
    setPending(null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over) return
    const activeIdStr = active.id as string
    const overId      = over.id  as string

    const sourceGroup = groups.find((g) => g.items.some((i) => i.id === activeIdStr))
    const targetGroup = groups.find((g) => g.items.some((i) => i.id === overId))
    if (!sourceGroup || !targetGroup) return

    if (mode !== 'all' && sourceGroup.key !== targetGroup.key) {
      const newId = targetGroup.key === 'none' ? null : targetGroup.key
      updateItem(activeIdStr, mode === 'store' ? { store_id: newId } : { category_id: newId })
      return
    }
    if (activeIdStr === overId) return

    const ids      = sourceGroup.items.map((i) => i.id)
    const oldIndex = ids.indexOf(activeIdStr)
    const newIndex = ids.indexOf(overId)
    if (oldIndex === -1 || newIndex === -1) return

    const newOrderIds = arrayMove(ids, oldIndex, newIndex)
    const groupSet    = new Set(ids)
    let qi = 0
    const byId    = new Map(sorted.map((i) => [i.id, i]))
    const newFull = sorted.map((it) =>
      groupSet.has(it.id) ? byId.get(newOrderIds[qi++])! : it
    )
    reorderItems(newFull)
  }

  const toggleCollapse = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const toggleAddGroup = () => {
    setAdding((v) => !v)
    setGroupName('')
    setGroupError('')
  }

  const submitGroup = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = groupName.trim()
    if (!trimmed) return
    const list = mode === 'store' ? stores : categories
    if (list.some((g) => g.name.toLowerCase() === trimmed.toLowerCase())) {
      setGroupError(mode === 'store' ? 'Laden bereits vorhanden' : 'Kategorie bereits vorhanden')
      return
    }
    setGroupError('')
    if (mode === 'store') await addStore(trimmed)
    else if (mode === 'category') await addCategory(trimmed)
    setGroupName('')
    groupInputRef.current?.focus()
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4" pb-24>
      {/* Steuerleiste: Sortierung (links) + Gruppierung (rechts) */}
      <div className="space-y-1.5">
        <div className="flex justify-end px-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.07em] tabular-nums text-zinc-400">
            {items.length} {items.length === 1 ? 'Eintrag' : 'Einträge'}
          </p>
        </div>
        <div className="flex gap-2">
          {/* Sortierung */}
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-1 px-0.5">
              <SortingIcon size={11} strokeWidth={1.75} className="shrink-0 text-zinc-400" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-zinc-400">
                Sortierung
              </span>
            </div>
            <div className="rounded-2xl bg-black/[0.055] p-1">
              <div className="flex">
                {SORT_MODES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setSort(s.value)}
                    className={
                      'flex flex-1 items-center justify-center gap-1 rounded-xl px-1 py-[7px] text-[13px] font-medium tracking-[-0.1px] transition-all duration-200 ' +
                      (sort === s.value
                        ? 'bg-white text-brand-700 shadow-card'
                        : 'text-zinc-500 hover:text-zinc-700')
                    }
                  >
                    {s.value === 'custom'  && <GripIcon    size={10} />}
                    {s.value === 'created' && <CalendarIcon size={13} strokeWidth={1.75} />}
                    {s.value === 'alpha'   && <NameSortIcon size={13} strokeWidth={1.75} />}
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Gruppierung */}
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-1 px-0.5">
              <GroupingIcon size={11} strokeWidth={1.75} className="shrink-0 text-zinc-400" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-zinc-400">
                Gruppierung
              </span>
            </div>
            <div className="rounded-2xl bg-black/[0.055] p-1">
              <div className="flex">
                {MODES.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => {
                      setMode(m.value)
                      setAdding(false)
                      setGroupError('')
                    }}
                    className={
                      'flex flex-1 items-center justify-center gap-1 rounded-xl px-1 py-[7px] text-[13px] font-medium tracking-[-0.1px] transition-all duration-200 ' +
                      (mode === m.value
                        ? 'bg-white text-brand-700 shadow-card'
                        : 'text-zinc-500 hover:text-zinc-700')
                    }
                  >
                    {m.value === 'store'    && <StoreIcon size={13} strokeWidth={1.75} />}
                    {m.value === 'category' && <TagIcon   size={13} strokeWidth={1.75} />}
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Liste */}
      {items.length === 0 ? (
        <div className="rounded-2xl bg-white py-14 text-center shadow-card ring-1 ring-black/[0.05]">
          <p className="text-[15px] text-zinc-400">Noch keine Artikel.</p>
          <p className="mt-1 text-[13px] text-zinc-300">Tippe unten auf das Plus.</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={(e: DragStartEvent) => setActiveId(e.active.id as string)}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <div className="space-y-3">
            {groups.map((group) => {
              const isCollapsed = collapsed.has(group.key)
              return (
                <div
                  key={group.key}
                  className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-black/[0.05]"
                >
                  {/* Gruppen-Header (nur wenn Titel vorhanden) */}
                  {group.title && (
                    <>
                      <button
                        onClick={() => toggleCollapse(group.key)}
                        className="flex w-full items-center justify-between px-4 py-3.5 transition-colors duration-150 active:bg-zinc-50"
                      >
                        <span className="flex items-baseline gap-1.5">
                          <span className="text-[14px] font-semibold tracking-[-0.2px] text-zinc-800">
                            {group.title}
                          </span>
                          {isCollapsed && (
                            <span className="text-[12px] font-normal text-zinc-400">
                              ({group.items.length} {group.items.length === 1 ? 'Eintrag' : 'Einträge'})
                            </span>
                          )}
                        </span>
                        <motion.span
                          animate={{ rotate: isCollapsed ? 0 : 90 }}
                          transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
                          className="text-zinc-400"
                        >
                          <ChevronRightIcon size={15} strokeWidth={2.5} />
                        </motion.span>
                      </button>
                      {!isCollapsed && <div className="h-px bg-zinc-100" />}
                    </>
                  )}

                  {/* Items – collapsible */}
                  <AnimatePresence initial={false}>
                    {!isCollapsed && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                        style={{ overflow: 'hidden' }}
                      >
                        <SortableContext
                          items={group.items.map((i) => i.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="divide-y divide-zinc-100">
                            <AnimatePresence initial={false}>
                              {group.items.map((item) => (
                                <SortableItem
                                  key={item.id}
                                  item={item}
                                  onLongPress={(it, rect) => setMenu({ item: it, rect })}
                                  dragDisabled={sort !== 'custom'}
                                />
                              ))}
                            </AnimatePresence>
                          </div>
                        </SortableContext>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>

          <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.25,0.1,0.25,1)' }}>
            {activeItem ? <OverlayRow item={activeItem} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Neue Gruppe – erscheint als natürlicher letzter Eintrag unter der Liste */}
      <AnimatePresence mode="wait" initial={false}>
        {mode !== 'all' && (
          addingGroup ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            >
              <div className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-black/[0.05]">
                <form onSubmit={submitGroup} className="flex gap-2">
                  <input
                    ref={groupInputRef}
                    autoFocus
                    value={groupName}
                    onChange={(e) => { setGroupName(e.target.value); setGroupError('') }}
                    placeholder={mode === 'store' ? 'Neuer Laden…' : 'Neue Kategorie…'}
                    className={
                      'min-w-0 flex-1 rounded-xl px-3.5 py-2.5 text-[14px] text-zinc-900 ' +
                      'placeholder:text-zinc-400 focus:outline-none focus:ring-2 transition-[box-shadow] duration-150 ' +
                      (groupError
                        ? 'bg-red-50 ring-2 ring-red-400'
                        : 'bg-zinc-50 ring-1 ring-black/[0.08] focus:ring-brand-500')
                    }
                  />
                  <button
                    type="submit"
                    disabled={!groupName.trim()}
                    className="shrink-0 rounded-xl bg-brand-600 px-4 py-2.5 text-[14px] font-semibold text-white transition-all duration-150 hover:bg-brand-700 active:scale-[0.96] disabled:opacity-40"
                  >
                    Anlegen
                  </button>
                </form>
                {groupError && (
                  <p className="mt-1.5 pl-1 text-[12px] font-medium text-red-500">{groupError}</p>
                )}
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => { setAdding(false); setGroupError(''); setGroupName('') }}
                    className="text-[13px] font-medium text-zinc-400 transition-colors duration-150 hover:text-zinc-600"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.button
              key="add-btn"
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={toggleAddGroup}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-zinc-200 py-3.5 text-[14px] font-medium text-zinc-400 transition-colors duration-150 hover:border-brand-300 hover:text-brand-500 active:opacity-70"
            >
              <PlusIcon size={15} strokeWidth={2.5} />
              {mode === 'store' ? 'Neuer Laden' : 'Neue Kategorie'}
            </motion.button>
          )
        )}
      </AnimatePresence>

      {/* FAB */}
      <button
        onClick={() => setSheetOpen(true)}
        className="fixed right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-card-lg transition-transform duration-150 active:scale-90"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 74px)' }}
        aria-label="Artikel hinzufügen"
      >
        <PlusIcon size={26} />
      </button>

      {/* Undo-Toast: Eintrag löschen */}
      <AnimatePresence>
        {undoDelete && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            data-no-swipe
            className="pointer-events-none fixed inset-x-0 z-30 flex justify-center px-4"
            style={{ bottom: 'calc(env(safe-area-inset-bottom) + 86px)' }}
          >
            <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-zinc-900 py-2 pl-4 pr-2 shadow-card-lg">
              <span className="max-w-[160px] truncate text-[13px] font-medium text-white">
                „{undoDelete.name}" gelöscht
              </span>
              <button
                onClick={undoDeleteAction}
                className="rounded-full bg-white/15 px-3 py-1 text-[13px] font-semibold text-white transition-colors duration-150 hover:bg-white/25"
              >
                Rückgängig
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Undo-Toast: normales Abhaken */}
      <AnimatePresence>
        {undoItem && !undoPartial && !undoDelete && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            data-no-swipe
            className="pointer-events-none fixed inset-x-0 z-30 flex justify-center px-4"
            style={{ bottom: 'calc(env(safe-area-inset-bottom) + 86px)' }}
          >
            <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-zinc-900 py-2 pl-4 pr-2 shadow-card-lg">
              <span className="max-w-[160px] truncate text-[13px] font-medium text-white">
                „{undoItem.name}" eingekauft
              </span>
              <button
                onClick={undoCheck}
                className="rounded-full bg-white/15 px-3 py-1 text-[13px] font-semibold text-white transition-colors duration-150 hover:bg-white/25"
              >
                Rückgängig
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Undo-Toast: Anteil erhalten */}
      <AnimatePresence>
        {undoPartial && !undoDelete && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            data-no-swipe
            className="pointer-events-none fixed inset-x-0 z-30 flex justify-center px-4"
            style={{ bottom: 'calc(env(safe-area-inset-bottom) + 86px)' }}
          >
            <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-zinc-900 py-2 pl-4 pr-2 shadow-card-lg">
              <span className="max-w-[180px] truncate text-[13px] font-medium text-white">
                {undoPartial.label}
              </span>
              <button
                onClick={undoPartialAction}
                className="rounded-full bg-white/15 px-3 py-1 text-[13px] font-semibold text-white transition-colors duration-150 hover:bg-white/25"
              >
                Rückgängig
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Eingabe-Sheet */}
      <AddItemForm open={sheetOpen} onClose={() => setSheetOpen(false)} />

      {/* Kontextmenü */}
      <AnimatePresence>
        {menu && (
          <ItemContextMenu
            item={menu.item}
            rect={menu.rect}
            onClose={() => setMenu(null)}
            onPartialConfirmed={handlePartialConfirmed}
            onDelete={handleDirectDelete}
          />
        )}
      </AnimatePresence>

      {/* Auto-Lösch-Abfrage (nur Kategorie) */}
      <AnimatePresence>
        {pending && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={keepGroup}
              data-no-swipe
              className="fixed inset-0 z-[70] bg-black/25 backdrop-blur-[2px]"
            />
            <div data-no-swipe className="pointer-events-none fixed inset-0 z-[80] flex items-center justify-center px-6">
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 8 }}
                transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
                className="pointer-events-auto w-full max-w-xs rounded-3xl bg-white p-6 text-center shadow-card-lg"
              >
                <p className="text-[16px] font-semibold tracking-[-0.3px] text-zinc-900">
                  Alles eingekauft
                </p>
                <p className="mt-1.5 text-[14px] leading-snug text-zinc-500">
                  „{pending.title}" ist leer. Kategorie jetzt entfernen?
                </p>
                <div className="mt-5 flex flex-col gap-2">
                  <button
                    onClick={confirmDelete}
                    className="w-full rounded-xl bg-red-500 py-2.5 text-[14px] font-semibold text-white transition-all duration-150 hover:bg-red-600 active:scale-[0.97]"
                  >
                    Löschen
                  </button>
                  <button
                    onClick={keepGroup}
                    className="w-full rounded-xl bg-zinc-100 py-2.5 text-[14px] font-semibold text-zinc-700 transition-all duration-150 hover:bg-zinc-200 active:scale-[0.97]"
                  >
                    Behalten
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
