import { useState, type FormEvent } from 'react'
import { useApp } from '../../context/AppContext'
import { todayISO } from '../../lib/utils'
import type { Person, Split } from '../../types'

export default function AddExpenseForm() {
  const { addExpense, settings } = useApp()
  const [amount, setAmount]           = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate]               = useState(todayISO())
  const [paidBy, setPaidBy]           = useState<Person>('A')
  const [split, setSplit]             = useState<Split>('both')
  const [busy, setBusy]               = useState(false)

  const nameA = settings?.person_a ?? 'Person A'
  const nameB = settings?.person_b ?? 'Person B'

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const value = parseFloat(amount.replace(',', '.'))
    if (!description.trim() || !value || value <= 0) return
    setBusy(true)
    await addExpense({
      amount:      value,
      description: description.trim(),
      date,
      paid_by:     paidBy,
      split,
    })
    setAmount('')
    setDescription('')
    setDate(todayISO())
    setBusy(false)
  }

  const inputCls =
    'w-full rounded-xl bg-zinc-50 ring-1 ring-black/[0.10] px-3.5 py-2.5 text-[14px] ' +
    'text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 ' +
    'focus:ring-brand-500 transition-[box-shadow] duration-150'

  // Segment-Button: aktiv vs. inaktiv
  const seg = (active: boolean) =>
    'flex-1 rounded-xl px-2 py-2 text-[13px] font-medium transition-all duration-150 active:scale-[0.97] ' +
    (active
      ? 'bg-brand-600 text-white shadow-sm'
      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200')

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-2xl bg-white p-5 shadow-card ring-1 ring-black/[0.05]"
    >
      {/* Betrag + Beschreibung */}
      <div className="flex gap-2.5">
        <div className="w-28 shrink-0">
          <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.05em] text-zinc-400">
            Betrag
          </label>
          <div className="relative">
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              className={inputCls + ' pr-7'}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-zinc-400">
              €
            </span>
          </div>
        </div>
        <div className="flex-1">
          <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.05em] text-zinc-400">
            Beschreibung
          </label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="z. B. Wocheneinkauf"
            className={inputCls}
          />
        </div>
      </div>

      {/* Datum */}
      <div>
        <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.05em] text-zinc-400">
          Datum
        </label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={inputCls}
        />
      </div>

      {/* Bezahlt von */}
      <div>
        <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.05em] text-zinc-400">
          Bezahlt von
        </label>
        <div className="flex gap-2">
          <button type="button" onClick={() => setPaidBy('A')} className={seg(paidBy === 'A')}>
            {nameA}
          </button>
          <button type="button" onClick={() => setPaidBy('B')} className={seg(paidBy === 'B')}>
            {nameB}
          </button>
        </div>
      </div>

      {/* Gilt für */}
      <div>
        <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.05em] text-zinc-400">
          Gilt für
        </label>
        <div className="flex gap-2">
          <button type="button" onClick={() => setSplit('both')} className={seg(split === 'both')}>
            Beide (50/50)
          </button>
          <button type="button" onClick={() => setSplit('A')} className={seg(split === 'A')}>
            Nur {nameA}
          </button>
          <button type="button" onClick={() => setSplit('B')} className={seg(split === 'B')}>
            Nur {nameB}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl bg-brand-600 py-3 text-[15px] font-semibold text-white transition-all duration-150 hover:bg-brand-700 active:scale-[0.98] disabled:opacity-50"
      >
        {busy ? 'Speichern…' : 'Ausgabe eintragen'}
      </button>
    </form>
  )
}
