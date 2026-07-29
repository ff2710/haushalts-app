import { useEffect, useState, type FormEvent } from 'react'
import BottomSheet from '../ui/BottomSheet'
import { TrashIcon } from '../ui/Icon'
import { usePersonal } from '../../context/PersonalContext'
import { parseAmount } from '../../lib/amount'
import { todayISO } from '../../lib/utils'
import type { PfRecurringIncome } from '../../types'

interface Props {
  open: boolean
  onClose: () => void
  income: PfRecurringIncome | null
}

export default function IncomeSheet({ open, onClose, income }: Props) {
  const { categories, addIncome, updateIncome, deleteIncome } = usePersonal()

  const [name, setName]        = useState('')
  const [amountRaw, setAmount] = useState('')
  const [startMonth, setStart] = useState('')
  const [endMonth, setEnd]     = useState('')
  const [categoryId, setCat]   = useState<string | null>(null)
  const [active, setActive]    = useState(true)
  const [busy, setBusy]        = useState(false)

  useEffect(() => {
    if (!open) return
    setName(income?.name ?? '')
    setAmount(income ? String(income.amount).replace('.', ',') : '')
    setStart(income?.start_month ?? todayISO().slice(0, 7))
    setEnd(income?.end_month ?? '')
    setCat(income?.category_id ?? null)
    setActive(income?.active ?? true)
    setBusy(false)
  }, [open, income])

  const parsed = parseAmount(amountRaw)
  const amount = parsed === null ? null : Math.abs(parsed)
  // Ein Ende vor dem Start würde die Einnahme dauerhaft unwirksam machen.
  const rangeOk = !endMonth || !startMonth || endMonth >= startMonth
  const valid = !!name.trim() && amount !== null && amount > 0 && !!startMonth && rangeOk

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    const payload = {
      name: name.trim(),
      amount: amount as number,
      start_month: startMonth,
      end_month: endMonth || null,
      category_id: categoryId,
      active,
    }
    if (income) await updateIncome(income.id, payload)
    else await addIncome(payload)
    setBusy(false)
    onClose()
  }

  const remove = async () => {
    if (!income || busy) return
    setBusy(true)
    await deleteIncome(income.id)
    setBusy(false)
    onClose()
  }

  const chip = (on: boolean) =>
    'rounded-xl px-3 py-2 text-[13px] font-medium transition-colors duration-150 ' +
    (on ? 'bg-brand-600 text-white' : 'bg-zinc-100 text-zinc-600')

  const field =
    'mt-1.5 w-full rounded-2xl bg-zinc-100 px-4 py-3 text-[15px] text-zinc-900 outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-brand-400'

  const incomeCats = categories.filter((c) => c.type === 'income')

  return (
    <BottomSheet open={open} onClose={onClose}>
      <form onSubmit={submit} className="px-5 pt-2">
        <h2 className="text-[17px] font-semibold tracking-[-0.3px] text-zinc-900">
          {income ? 'Einnahme bearbeiten' : 'Neue regelmäßige Einnahme'}
        </h2>

        <label className="mt-4 block text-[13px] font-medium text-zinc-500">Name</label>
        <input
          autoFocus={!income}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="z. B. Gehalt"
          className={field}
        />

        <label className="mt-4 block text-[13px] font-medium text-zinc-500">Betrag pro Monat</label>
        <input
          inputMode="decimal"
          value={amountRaw}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0,00"
          className={field}
        />

        <label className="mt-4 block text-[13px] font-medium text-zinc-500">Ab Monat</label>
        <input type="month" value={startMonth} onChange={(e) => setStart(e.target.value)} className={field} />

        <label className="mt-4 block text-[13px] font-medium text-zinc-500">
          Bis Monat <span className="text-zinc-400">(optional, leer = laufend)</span>
        </label>
        <input type="month" value={endMonth} onChange={(e) => setEnd(e.target.value)} className={field} />
        {!rangeOk && (
          <p className="mt-1.5 text-[12px] text-red-500">
            Das Ende darf nicht vor dem Start liegen.
          </p>
        )}

        <label className="mt-4 flex items-center gap-3 rounded-2xl bg-zinc-50 px-4 py-3">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 accent-brand-600"
          />
          <span className="text-[14px] text-zinc-700">Aktiv</span>
        </label>

        {incomeCats.length > 0 && (
          <>
            <label className="mt-4 block text-[13px] font-medium text-zinc-500">
              Kategorie <span className="text-zinc-400">(optional)</span>
            </label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {incomeCats.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCat(categoryId === c.id ? null : c.id)}
                  className={chip(categoryId === c.id)}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={!valid || busy}
          className="mt-5 w-full rounded-2xl bg-brand-600 py-3.5 text-[15px] font-semibold text-white transition-opacity duration-150 active:opacity-80 disabled:opacity-40"
        >
          {income ? 'Speichern' : 'Anlegen'}
        </button>

        {income && (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-[15px] font-medium text-red-500 transition-colors duration-150 active:bg-red-50 disabled:opacity-40"
          >
            <TrashIcon size={16} />
            Löschen
          </button>
        )}
      </form>
    </BottomSheet>
  )
}
