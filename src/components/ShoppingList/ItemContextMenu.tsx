import { useRef, useState, type FormEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../../context/AppContext'
import type { ShoppingItem } from '../../types'
import { PencilIcon, TrashIcon, MinusCircleIcon, ChevronRightIcon, StoreIcon, TagIcon } from '../ui/Icon'

const MENU_W = 252

type MenuView = 'main' | 'edit' | 'partial' | 'store' | 'category'

export interface PartialInfo {
  id: string
  name: string
  got: number
  unit: string | null
  originalQty: string
  wasMarkedDone: boolean
}

function Check() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="shrink-0 text-brand-600">
      <polyline
        points="2,7.5 5.5,11 13,4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function ItemContextMenu({
  item,
  rect,
  onClose,
  onPartialConfirmed,
  onDelete,
}: {
  item: ShoppingItem
  rect: DOMRect
  onClose: () => void
  onPartialConfirmed: (info: PartialInfo) => void
  onDelete: (item: ShoppingItem) => void
}) {
  const { updateItem, stores, categories, units } = useApp()

  const [view, setView]       = useState<MenuView>('main')
  const [animDir, setAnimDir] = useState(1)

  const [name, setName]           = useState(item.name)
  const [quantity, setQuantity]   = useState(item.quantity ?? '')
  const [unit, setUnit]           = useState(item.unit ?? '')
  const [storeId, setStoreId]     = useState(item.store_id ?? '')
  const [categoryId, setCategoryId] = useState(item.category_id ?? '')
  const [got, setGot]             = useState('')

  const nameRef = useRef(name);     nameRef.current = name
  const qtyRef  = useRef(quantity); qtyRef.current  = quantity
  const itemRef = useRef(item);     itemRef.current = item

  const totalQty = parseFloat((item.quantity ?? '').replace(',', '.'))
  const hasQty   = !isNaN(totalQty) && totalQty > 0
  const qtyLabel = [item.quantity, item.unit].filter(Boolean).join(' ')

  const placeAbove = rect.bottom + 300 > window.innerHeight && rect.top > 300
  const itemCx     = rect.left + rect.width / 2
  const left       = Math.max(12, Math.min(itemCx - MENU_W / 2, window.innerWidth - MENU_W - 12))

  const go = (to: MenuView, forward = true) => {
    if (view === 'edit') {
      const n = nameRef.current.trim()
      if (n && n !== itemRef.current.name) updateItem(item.id, { name: n })
      const q = qtyRef.current.trim()
      if (q !== (itemRef.current.quantity ?? '')) updateItem(item.id, { quantity: q || null })
    }
    setAnimDir(forward ? 1 : -1)
    setView(to)
  }

  const onNameBlur = () => {
    const n = name.trim()
    if (n && n !== item.name) updateItem(item.id, { name: n })
  }
  const onQtyBlur = () => {
    const q = quantity.trim()
    if (q !== (item.quantity ?? '')) updateItem(item.id, { quantity: q || null })
  }
  const onUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setUnit(e.target.value)
    updateItem(item.id, { unit: e.target.value || null })
  }
  const pickStore = (id: string) => {
    setStoreId(id)
    updateItem(item.id, { store_id: id || null })
    go('main', false)
  }
  const pickCategory = (id: string) => {
    setCategoryId(id)
    updateItem(item.id, { category_id: id || null })
    go('main', false)
  }

  const handleDelete = () => { onDelete(item); onClose() }

  const confirmPartial = (e: FormEvent) => {
    e.preventDefault()
    const g = parseFloat(got.replace(',', '.'))
    if (isNaN(g) || g <= 0) return
    const remaining     = Math.round((totalQty - g) * 1000) / 1000
    const wasMarkedDone = remaining <= 0
    if (wasMarkedDone) updateItem(item.id, { is_done: true })
    else               updateItem(item.id, { quantity: String(remaining) })
    onPartialConfirmed({ id: item.id, name: item.name, got: g, unit: item.unit ?? null, originalQty: item.quantity ?? '', wasMarkedDone })
    onClose()
  }

  const currentStore    = stores.find((s) => s.id === storeId)
  const currentCategory = categories.find((c) => c.id === categoryId)

  // ── Wiederverwendbare Bausteine ──────────────────────────────────────
  const rowBase = 'flex w-full items-center gap-3 px-4 text-left select-none transition-colors duration-75 active:bg-zinc-100/70'
  const menuRow = rowBase + ' py-[11px]'
  const sep     = <div className="h-px bg-zinc-100" />

  const backBtn = (label: string, to: MenuView) => (
    <button
      type="button"
      onClick={() => go(to, false)}
      className="flex items-center gap-1 px-4 py-2.5 transition-colors duration-75 active:bg-zinc-100/70"
    >
      <ChevronRightIcon size={14} strokeWidth={2.5} className="shrink-0 rotate-180 text-brand-500" />
      <span className="text-[13px] font-medium text-brand-500">{label}</span>
    </button>
  )

  const pickerList = (
    list: { id: string; name: string }[],
    selected: string,
    onPick: (id: string) => void,
    emptyLabel: string
  ) => (
    <div className="max-h-[220px] overflow-y-auto divide-y divide-zinc-100/80">
      <button type="button" onClick={() => onPick('')} className={menuRow}>
        <span className={`flex-1 text-[14px] ${!selected ? 'font-semibold text-zinc-800' : 'text-zinc-400'}`}>
          {emptyLabel}
        </span>
        {!selected && <Check />}
      </button>
      {list.map((g) => (
        <button key={g.id} type="button" onClick={() => onPick(g.id)} className={menuRow}>
          <span className={`flex-1 text-[14px] ${selected === g.id ? 'font-semibold text-zinc-900' : 'text-zinc-800'}`}>
            {g.name}
          </span>
          {selected === g.id && <Check />}
        </button>
      ))}
    </div>
  )

  // ── Views ─────────────────────────────────────────────────────────────
  const views: Record<MenuView, React.ReactNode> = {

    // ── Hauptmenü ──────────────────────────────────────────────────────
    main: (
      <>
        {/* Bearbeiten */}
        <button type="button" onClick={() => go('edit')} className={menuRow}>
          <PencilIcon size={16} className="shrink-0 text-zinc-500" />
          <span className="flex-1 text-[15px] font-medium text-zinc-900">Bearbeiten</span>
          <ChevronRightIcon size={13} strokeWidth={2.5} className="text-zinc-300" />
        </button>

        {sep}

        {/* Laden */}
        <button type="button" onClick={() => go('store')} className={menuRow}>
          <StoreIcon size={16} className="shrink-0 text-zinc-500" />
          <span className="flex-1 text-[15px] font-medium text-zinc-900">Laden</span>
          <span className={`mr-1 max-w-[76px] truncate text-[13px] ${currentStore ? 'text-zinc-400' : 'text-zinc-300'}`}>
            {currentStore?.name ?? 'Kein'}
          </span>
          <ChevronRightIcon size={13} strokeWidth={2.5} className="text-zinc-300" />
        </button>

        {/* Kategorie */}
        <button type="button" onClick={() => go('category')} className={menuRow}>
          <TagIcon size={16} className="shrink-0 text-zinc-500" />
          <span className="flex-1 text-[15px] font-medium text-zinc-900">Kategorie</span>
          <span className={`mr-1 max-w-[76px] truncate text-[13px] ${currentCategory ? 'text-zinc-400' : 'text-zinc-300'}`}>
            {currentCategory?.name ?? 'Keine'}
          </span>
          <ChevronRightIcon size={13} strokeWidth={2.5} className="text-zinc-300" />
        </button>

        {hasQty && (
          <>
            {sep}
            <button type="button" onClick={() => go('partial')} className={menuRow}>
              <MinusCircleIcon size={16} className="shrink-0 text-zinc-500" />
              <span className="flex-1 text-[15px] font-medium text-zinc-900">Anteil erhalten</span>
            </button>
          </>
        )}

        {sep}

        <button type="button" onClick={handleDelete} className={menuRow}>
          <TrashIcon size={16} className="shrink-0 text-red-400" />
          <span className="text-[15px] font-medium text-red-500">Eintrag löschen</span>
        </button>
      </>
    ),

    // ── Bearbeiten (Name, Menge, Einheit) ──────────────────────────────
    edit: (
      <>
        {backBtn('Zurück', 'main')}
        {sep}
        <div className="space-y-2 p-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={onNameBlur}
            placeholder="Bezeichnung"
            autoFocus
            className="w-full rounded-xl bg-zinc-50 px-3 py-2.5 text-[14px] text-zinc-900 placeholder:text-zinc-400 ring-1 ring-black/[0.08] focus:outline-none focus:ring-2 focus:ring-brand-500 transition-[box-shadow] duration-150"
          />
          <div className="flex gap-2">
            <input
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              onBlur={onQtyBlur}
              placeholder="Menge"
              inputMode="decimal"
              className="w-[4.2rem] shrink-0 rounded-xl bg-zinc-50 px-2 py-2.5 text-center text-[14px] text-zinc-900 placeholder:text-zinc-400 ring-1 ring-black/[0.08] focus:outline-none focus:ring-2 focus:ring-brand-500 transition-[box-shadow] duration-150"
            />
            <select
              value={unit}
              onChange={onUnitChange}
              className="flex-1 rounded-xl bg-zinc-50 px-2 py-2.5 text-[14px] text-zinc-900 ring-1 ring-black/[0.08] focus:outline-none focus:ring-2 focus:ring-brand-500 transition-[box-shadow] duration-150"
            >
              <option value="">Einheit</option>
              {units.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>
      </>
    ),

    // ── Anteil erhalten ────────────────────────────────────────────────
    partial: (
      <>
        {backBtn('Zurück', 'main')}
        {sep}
        <form onSubmit={confirmPartial} className="space-y-3 p-4">
          <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
            Anteil erhalten
          </p>
          <div className="flex items-center gap-2">
            <input
              autoFocus
              inputMode="decimal"
              value={got}
              onChange={(e) => setGot(e.target.value)}
              placeholder="0"
              className="w-16 shrink-0 rounded-xl bg-zinc-50 px-2.5 py-2.5 text-center text-[15px] text-zinc-900 ring-1 ring-black/[0.08] focus:outline-none focus:ring-2 focus:ring-brand-500 transition-[box-shadow] duration-150"
            />
            {item.unit && <span className="text-[14px] text-zinc-500">{item.unit}</span>}
            <span className="text-[13px] text-zinc-300">von {qtyLabel || item.quantity}</span>
            <button
              type="submit"
              disabled={!got.trim()}
              className="ml-auto rounded-xl bg-brand-600 px-4 py-2.5 text-[14px] font-semibold text-white transition-all duration-150 hover:bg-brand-700 active:scale-[0.96] disabled:opacity-40"
            >
              OK
            </button>
          </div>
        </form>
      </>
    ),

    // ── Laden-Picker ───────────────────────────────────────────────────
    store: (
      <>
        {backBtn('Zurück', 'main')}
        {sep}
        {pickerList(stores, storeId, pickStore, 'Ohne Laden')}
      </>
    ),

    // ── Kategorie-Picker ───────────────────────────────────────────────
    category: (
      <>
        {backBtn('Zurück', 'main')}
        {sep}
        {pickerList(categories, categoryId, pickCategory, 'Ohne Kategorie')}
      </>
    ),
  }

  return (
    <>
      {/* Scrim */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
        data-no-swipe
        className="fixed inset-0 z-[30] touch-none bg-black/40 backdrop-blur-[2px]"
      />

      {/* Hervorgehobene Item-Kopie */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16 }}
        data-no-swipe
        className="fixed z-[35] flex items-center gap-2 rounded-2xl bg-white px-3 py-2.5 shadow-card-lg"
        style={{ top: rect.top, left: rect.left, width: rect.width }}
      >
        <span
          className={
            'h-[20px] w-[20px] shrink-0 rounded-full border-2 ' +
            (item.is_done ? 'border-brand-600 bg-brand-600' : 'border-zinc-300 bg-white')
          }
        />
        <div className="flex min-w-0 flex-1 items-baseline gap-1.5">
          <span className={'truncate text-[14px] font-medium leading-tight ' + (item.is_done ? 'text-zinc-300 line-through' : 'text-zinc-900')}>
            {item.name}
          </span>
          {qtyLabel && (
            <span className="shrink-0 text-[14px] leading-tight text-zinc-400">
              <span className="text-zinc-300">|</span> {qtyLabel}
            </span>
          )}
        </div>
      </motion.div>

      {/* Menükarte */}
      <motion.div
        initial={{ opacity: 0, scale: 0.88 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.94 }}
        transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
        data-no-swipe
        className="fixed z-[40] overflow-hidden rounded-[16px] bg-white"
        style={{
          width: MENU_W,
          left,
          boxShadow: '0 8px 48px rgba(0,0,0,0.22), 0 0 0 0.5px rgba(0,0,0,0.06)',
          transformOrigin: placeAbove ? 'bottom center' : 'top center',
          ...(placeAbove
            ? { bottom: window.innerHeight - rect.top + 10 }
            : { top: rect.bottom + 10 }),
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={view}
            initial={{ opacity: 0, x: animDir * 10 }}
            animate={{ opacity: 1, x: 0, transition: { duration: 0.14, ease: [0.25, 0.1, 0.25, 1] } }}
            exit={{ opacity: 0, x: -animDir * 10, transition: { duration: 0.1 } }}
          >
            {views[view]}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </>
  )
}
