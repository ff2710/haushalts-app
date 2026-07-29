import { useEffect, useState, type FormEvent } from 'react'
import BottomSheet from '../ui/BottomSheet'
import { TrashIcon } from '../ui/Icon'
import { usePersonal } from '../../context/PersonalContext'
import { parseAmount } from '../../lib/amount'
import { monthlyContribution } from '../../lib/forecast'
import { formatMoney, todayISO } from '../../lib/utils'
import type { PfCadence, PfFixedCost } from '../../types'

export const CADENCES: { id: PfCadence; label: string }[] = [
  { id: 'monthly',     label: 'Monatlich' },
  { id: 'quarterly',   label: 'Vierteljährlich' },
  { id: 'half_yearly', label: 'Halbjährlich' },
  { id: 'yearly',      label: 'Jährlich' },
  { id: 'once',        label: 'Einmalig' },
]

interface Props {
  open: boolean
  onClose: () => void
  fixedCost: PfFixedCost | null
}

export default function FixedCostSheet({ open, onClose, fixedCost }: Props) {
  const { categories, addFixedCost, updateFixedCost, deleteFixedCost } = usePersonal()

  const [name, setName]         = useState('')
  const [amountRaw, setAmount]  = useState('')
  const [cadence, setCadence]   = useState<PfCadence>('monthly')
  const [dueMonth, setDue]      = useState('')
  const [startMonth, setStart]  = useState('')
  const [amortize, setAmortize] = useState(true)
  const [categoryId, setCat]    = useState<string | null>(null)
  const [active, setActive]     = useState(true)
  const [busy, setBusy]         = useState(false)

  useEffect(() => {
    if (!open) return
    setName(fixedCost?.name ?? '')
    setAmount(fixedCost ? String(fixedCost.amount).replace('.', ',') : '')
    setCadence(fixedCost?.cadence ?? 'monthly')
    setDue(fixedCost?.due_month ?? '')
    setStart(fixedCost?.start_month ?? '')
    setAmortize(fixedCost?.amortize ?? true)
    setCat(fixedCost?.category_id ?? null)
    setActive(fixedCost?.active ?? true)
    setBusy(false)
  }, [open, fixedCost])

  const parsed = parseAmount(amountRaw)
  const amount = parsed === null ? null : Math.abs(parsed)
  const needsDue = cadence !== 'monthly'
  const valid = !!name.trim() && amount !== null && amount > 0 && (!needsDue || !!dueMonth)

  // Live-Vorschau: was steuert der Posten diesen Monat zur Prognose bei?
  const preview =
    amount !== null && (!needsDue || dueMonth)
      ? monthlyContribution(
          {
            amount,
            cadence,
            due_month: dueMonth || null,
            start_month: startMonth || null,
            amortize,
            active,
          },
          todayISO().slice(0, 7),
        )
      : 0

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    const payload = {
      name: name.trim(),
      amount: amount as number,
      cadence,
      due_month: needsDue ? dueMonth : null,
      start_month: startMonth || null,
      amortize,
      category_id: categoryId,
      active,
    }
    if (fixedCost) await updateFixedCost(fixedCost.id, payload)
    else await addFixedCost(payload)
    setBusy(false)
    onClose()
  }

  const remove = async () => {
    if (!fixedCost || busy) return
    setBusy(true)
    await deleteFixedCost(fixedCost.id)
    setBusy(false)
    onClose()
  }

  const chip = (on: boolean) =>
    'rounded-xl px-3 py-2 text-[13px] font-medium transition-colors duration-150 ' +
    (on ? 'bg-brand-600 text-white' : 'bg-zinc-100 text-zinc-600')

  const field =
    'mt-1.5 w-full rounded-2xl bg-zinc-100 px-4 py-3 text-[15px] text-zinc-900 outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-brand-400'

  return (
    <BottomSheet open={open} onClose={onClose}>
      <form onSubmit={submit} className="px-5 pt-2">
        <h2 className="text-[17px] font-semibold tracking-[-0.3px] text-zinc-900">
          {fixedCost ? 'Fixkosten bearbeiten' : 'Neue Fixkosten'}
        </h2>

        <label className="mt-4 block text-[13px] font-medium text-zinc-500">Name</label>
        <input
          autoFocus={!fixedCost}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="z. B. Miete"
          className={field}
        />

        <label className="mt-4 block text-[13px] font-medium text-zinc-500">Betrag</label>
        <input
          inputMode="decimal"
          value={amountRaw}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0,00"
          className={field}
        />

        <label className="mt-4 block text-[13px] font-medium text-zinc-500">Rhythmus</label>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {CADENCES.map((c) => (
            <button key={c.id} type="button" onClick={() => setCadence(c.id)} className={chip(cadence === c.id)}>
              {c.label}
            </button>
          ))}
        </div>

        {needsDue && (
          <>
            <label className="mt-4 block text-[13px] font-medium text-zinc-500">
              Fällig im Monat
            </label>
            <input type="month" value={dueMonth} onChange={(e) => setDue(e.target.value)} className={field} />
          </>
        )}

        <label className="mt-4 block text-[13px] font-medium text-zinc-500">
          Ab wann zurücklegen <span className="text-zinc-400">(optional)</span>
        </label>
        <input type="month" value={startMonth} onChange={(e) => setStart(e.target.value)} className={field} />

        {needsDue && (
          <label className="mt-4 flex items-center gap-3 rounded-2xl bg-zinc-50 px-4 py-3">
            <input
              type="checkbox"
              checked={amortize}
              onChange={(e) => setAmortize(e.target.checked)}
              className="h-4 w-4 accent-brand-600"
            />
            <span className="text-[14px] text-zinc-700">
              Auf Monate verteilen
              <span className="block text-[12px] text-zinc-400">
                Sonst schlägt der volle Betrag erst im Fälligkeitsmonat zu
              </span>
            </span>
          </label>
        )}

        <label className="mt-2 flex items-center gap-3 rounded-2xl bg-zinc-50 px-4 py-3">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 accent-brand-600"
          />
          <span className="text-[14px] text-zinc-700">Aktiv</span>
        </label>

        {categories.filter((c) => c.type === 'expense').length > 0 && (
          <>
            <label className="mt-4 block text-[13px] font-medium text-zinc-500">
              Kategorie <span className="text-zinc-400">(optional)</span>
            </label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {categories
                .filter((c) => c.type === 'expense')
                .map((c) => (
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

        {preview > 0 && (
          <p className="mt-4 rounded-2xl bg-brand-50 px-4 py-3 text-[13px] leading-snug text-zinc-600">
            Zählt diesen Monat mit{' '}
            <span className="font-semibold text-zinc-900">{formatMoney(preview)}</span> in die
            Prognose.
          </p>
        )}

        <button
          type="submit"
          disabled={!valid || busy}
          className="mt-5 w-full rounded-2xl bg-brand-600 py-3.5 text-[15px] font-semibold text-white transition-opacity duration-150 active:opacity-80 disabled:opacity-40"
        >
          {fixedCost ? 'Speichern' : 'Anlegen'}
        </button>

        {fixedCost && (
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
