import { useEffect, useState, type FormEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../../context/AppContext'
import type { ShoppingItem } from '../../types'

export default function EditItemForm({
  item,
  onClose,
}: {
  item: ShoppingItem | null
  onClose: () => void
}) {
  const { updateItem, stores, categories, units } = useApp()
  const [name, setName]           = useState('')
  const [quantity, setQuantity]   = useState('')
  const [unit, setUnit]           = useState('')
  const [storeId, setStoreId]     = useState('')
  const [categoryId, setCatId]    = useState('')

  // Felder mit dem aktuellen Artikel vorbefüllen
  useEffect(() => {
    if (item) {
      setName(item.name)
      setQuantity(item.quantity ?? '')
      setUnit(item.unit ?? '')
      setStoreId(item.store_id ?? '')
      setCatId(item.category_id ?? '')
    }
  }, [item])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!item) return
    const trimmed = name.trim()
    if (!trimmed) return
    await updateItem(item.id, {
      name:        trimmed,
      quantity:    quantity.trim() || null,
      unit:        unit || null,
      store_id:    storeId || null,
      category_id: categoryId || null,
    })
    onClose()
  }

  const inputCls =
    'rounded-xl bg-zinc-50 ring-1 ring-black/[0.10] px-3.5 py-3 text-[15px] ' +
    'text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 ' +
    'focus:ring-brand-500 transition-[box-shadow] duration-150'

  const narrowCls =
    'w-20 shrink-0 rounded-xl bg-zinc-50 ring-1 ring-black/[0.10] px-3 py-3 text-[15px] ' +
    'text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 ' +
    'focus:ring-brand-500 transition-[box-shadow] duration-150'

  const selectCls =
    'min-w-0 flex-1 rounded-xl bg-zinc-50 ring-1 ring-black/[0.10] px-3 py-3 text-[15px] ' +
    'text-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-[box-shadow] duration-150'

  return (
    <AnimatePresence>
      {item && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            data-no-swipe
            className="fixed inset-0 z-[30] bg-black/35"
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: '110%' }}
            animate={{ y: 0 }}
            exit={{ y: '110%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.45 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 90 || info.velocity.y > 600) onClose()
            }}
            data-no-swipe
            className="fixed inset-x-0 bottom-0 z-[40] mx-auto max-w-2xl rounded-t-3xl bg-white p-5"
            style={{
              paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)',
              boxShadow: '0 -10px 44px rgba(0,0,0,0.16), 0 -1px 0 rgba(0,0,0,0.05)',
            }}
          >
            {/* Greifer */}
            <div className="mx-auto mb-3 h-1.5 w-10 cursor-grab rounded-full bg-zinc-300 active:cursor-grabbing" />

            {/* Titel */}
            <p className="mb-4 text-center text-[13px] font-medium text-zinc-400">
              Eintrag bearbeiten
            </p>

            <form onSubmit={submit} className="space-y-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Bezeichnung"
                className={inputCls + ' w-full'}
              />

              {/* Menge, Einheit, Laden, Kategorie in einer Zeile */}
              <div className="flex gap-2">
                <input
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="Menge"
                  inputMode="decimal"
                  className={narrowCls + ' w-16 text-center'}
                />
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className={narrowCls + ' w-[4.5rem] px-2.5'}
                >
                  <option value="">Einheit</option>
                  {units.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
                <select
                  value={storeId}
                  onChange={(e) => setStoreId(e.target.value)}
                  className={selectCls}
                >
                  <option value="">Ohne Laden</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <select
                  value={categoryId}
                  onChange={(e) => setCatId(e.target.value)}
                  className={selectCls}
                >
                  <option value="">Ohne Kategorie</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={!name.trim()}
                className="w-full rounded-xl bg-brand-600 py-3 text-[15px] font-semibold text-white transition-all duration-150 hover:bg-brand-700 active:scale-[0.98] disabled:opacity-40"
              >
                Speichern
              </button>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
