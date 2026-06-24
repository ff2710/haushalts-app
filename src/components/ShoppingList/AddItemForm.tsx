import { useEffect, useRef, useState, type FormEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../../context/AppContext'
import { PlusIcon } from '../ui/Icon'
import BottomSheet from '../ui/BottomSheet'

export default function AddItemForm({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { addItem, stores, categories, addStore, addCategory, units } = useApp()
  const [name, setName]               = useState('')
  const [quantity, setQuantity]       = useState('')
  const [unit, setUnit]               = useState('')
  const [storeId, setStoreId]         = useState('')
  const [categoryId, setCategoryId]   = useState('')
  const [addingFor, setAddingFor]     = useState<'store' | 'category' | null>(null)
  const [newGroupName, setNewGroupName] = useState('')
  const [groupError, setGroupError]   = useState('')
  const [busy, setBusy]               = useState(false)

  const nameRef        = useRef<HTMLInputElement>(null)
  const newStoreRef    = useRef<HTMLInputElement>(null)
  const newCategoryRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => nameRef.current?.focus(), 120)
      return () => clearTimeout(t)
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      setName(''); setQuantity(''); setUnit('')
      setStoreId(''); setCategoryId('')
      setAddingFor(null); setNewGroupName(''); setGroupError('')
      setBusy(false)
    }
  }, [open])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setBusy(true)
    await addItem({
      name:        trimmed,
      quantity:    quantity.trim() || null,
      unit:        unit || null,
      store_id:    storeId    || null,
      category_id: categoryId || null,
    })
    setName('')
    setQuantity('')
    setUnit('')
    setStoreId('')
    setCategoryId('')
    setBusy(false)
    nameRef.current?.focus()
  }

  const startAddNew = (for_: 'store' | 'category') => {
    setAddingFor(for_)
    setNewGroupName('')
    setGroupError('')
    setTimeout(() => {
      if (for_ === 'store') newStoreRef.current?.focus()
      else newCategoryRef.current?.focus()
    }, 80)
  }

  const confirmNewGroup = async () => {
    const trimmed = newGroupName.trim()
    if (!trimmed) return
    const list = addingFor === 'store' ? stores : categories
    if (list.some((g) => g.name.toLowerCase() === trimmed.toLowerCase())) {
      setGroupError(addingFor === 'store' ? 'Laden bereits vorhanden' : 'Kategorie bereits vorhanden')
      return
    }
    setGroupError('')
    const created = addingFor === 'store' ? await addStore(trimmed) : await addCategory(trimmed)
    if (created) {
      if (addingFor === 'store') setStoreId(created.id)
      else setCategoryId(created.id)
    }
    setAddingFor(null)
    setNewGroupName('')
  }

  const pill = (active: boolean) =>
    'shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-all duration-150 active:scale-95 ' +
    (active ? 'bg-brand-600 text-white' : 'bg-zinc-100 text-zinc-500')

  const pillNew =
    'shrink-0 flex items-center gap-1 rounded-full border border-dashed border-zinc-300 px-3.5 py-1.5 ' +
    'text-[13px] font-semibold text-zinc-400 transition-all duration-150 active:scale-95 hover:border-zinc-400 hover:text-zinc-500'

  const sectionLabel = 'mb-2.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-zinc-400'
  const divider      = <div className="h-px bg-zinc-100" />

  const newGroupInput = (for_: 'store' | 'category') => (
    <AnimatePresence>
      {addingFor === for_ && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.18 }}
          className="overflow-hidden"
        >
          <div className="mt-2.5 flex gap-2 px-px pb-px">
            <input
              ref={for_ === 'store' ? newStoreRef : newCategoryRef}
              value={newGroupName}
              onChange={(e) => { setNewGroupName(e.target.value); setGroupError('') }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void confirmNewGroup() } }}
              placeholder={for_ === 'store' ? 'Neuer Laden…' : 'Neue Kategorie…'}
              className={
                'min-w-0 flex-1 rounded-xl px-3.5 py-2.5 text-[15px] text-zinc-900 placeholder:text-zinc-400 ' +
                'focus:outline-none focus:ring-2 transition-[box-shadow] duration-150 ' +
                (groupError ? 'bg-red-50 ring-2 ring-red-400' : 'bg-zinc-50 ring-1 ring-black/[0.08] focus:ring-brand-500')
              }
            />
            <button
              type="button"
              onClick={() => void confirmNewGroup()}
              className="shrink-0 rounded-xl bg-brand-600 px-4 text-[14px] font-semibold text-white transition-all duration-150 active:scale-95"
            >
              OK
            </button>
          </div>
          {groupError && (
            <p className="mt-1 pl-1 text-[12px] font-medium text-red-500">{groupError}</p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )

  return (
    <BottomSheet open={open} onClose={onClose}>
      <form onSubmit={(e) => void submit(e)} className="flex flex-col">

              {/* Artikelname — groß und zentriert */}
              <div className="px-5 pt-5 pb-5 text-center">
                <input
                  ref={nameRef}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Was wird gebraucht?"
                  className="w-full bg-transparent text-center text-[22px] font-semibold tracking-tight text-zinc-900 placeholder:text-zinc-300 focus:outline-none"
                />
              </div>

              {divider}

              {/* Menge & Einheit */}
              <div className="px-5 pt-4 pb-4">
                <p className={sectionLabel}>Menge &amp; Einheit</p>
                <div className="flex gap-2">
                  <input
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="Menge"
                    inputMode="decimal"
                    className="w-24 shrink-0 rounded-xl bg-zinc-50 px-3.5 py-2.5 text-[15px] text-zinc-900 ring-1 ring-black/[0.08] placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-[box-shadow] duration-150"
                  />
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-24 shrink-0 rounded-xl bg-zinc-50 px-3 py-2.5 text-[15px] text-zinc-900 ring-1 ring-black/[0.08] focus:outline-none focus:ring-2 focus:ring-brand-500 transition-[box-shadow] duration-150"
                  >
                    <option value="">Einheit</option>
                    {units.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              {divider}

              {/* Laden */}
              <div className="px-5 pt-4 pb-4">
                <p className={sectionLabel}>Laden</p>
                <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none" data-no-swipe>
                  <button type="button" onClick={() => setStoreId('')} className={pill(storeId === '')}>
                    Keiner
                  </button>
                  {stores.map((s) => (
                    <button key={s.id} type="button" onClick={() => setStoreId(s.id)} className={pill(storeId === s.id)}>
                      {s.name}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => startAddNew('store')}
                    className={pillNew}
                  >
                    <PlusIcon size={11} strokeWidth={2.5} />
                    Neu
                  </button>
                </div>
                {newGroupInput('store')}
              </div>

              {divider}

              {/* Kategorie */}
              <div className="px-5 pt-4 pb-4">
                <p className={sectionLabel}>Kategorie</p>
                <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none" data-no-swipe>
                  <button type="button" onClick={() => setCategoryId('')} className={pill(categoryId === '')}>
                    Keine
                  </button>
                  {categories.map((c) => (
                    <button key={c.id} type="button" onClick={() => setCategoryId(c.id)} className={pill(categoryId === c.id)}>
                      {c.name}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => startAddNew('category')}
                    className={pillNew}
                  >
                    <PlusIcon size={11} strokeWidth={2.5} />
                    Neu
                  </button>
                </div>
                {newGroupInput('category')}
              </div>

              {divider}

              {/* Submit */}
              <div className="mx-5 pt-5 pb-1">
                <button
                  type="submit"
                  disabled={busy || !name.trim()}
                  className="w-full rounded-2xl bg-brand-600 py-4 text-[16px] font-bold tracking-[-0.2px] text-white transition-all duration-150 hover:bg-brand-700 active:scale-[0.98] disabled:opacity-30"
                >
                  {busy ? 'Hinzufügen…' : 'Hinzufügen'}
                </button>
              </div>

      </form>
    </BottomSheet>
  )
}
