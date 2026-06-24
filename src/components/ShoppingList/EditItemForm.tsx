import { useEffect, useState, type FormEvent } from 'react'
import { useApp } from '../../context/AppContext'
import BottomSheet from '../ui/BottomSheet'
import type { ShoppingItem } from '../../types'

export default function EditItemForm({
  item,
  onClose,
}: {
  item: ShoppingItem | null
  onClose: () => void
}) {
  const { updateItem, stores, categories, units } = useApp()
  const [name, setName]         = useState('')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit]         = useState('')
  const [storeId, setStoreId]   = useState('')
  const [categoryId, setCatId]  = useState('')

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
    <BottomSheet
      open={!!item}
      onClose={onClose}
      paddingBottom="calc(env(safe-area-inset-bottom) + 24px)"
    >
      <p className="mb-4 text-center text-[13px] font-medium text-zinc-400 px-5">
        Eintrag bearbeiten
      </p>

      <form onSubmit={submit} className="space-y-3 px-5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Bezeichnung"
          className={inputCls + ' w-full'}
        />

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
    </BottomSheet>
  )
}
