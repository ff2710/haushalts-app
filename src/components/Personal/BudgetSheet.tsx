import { useEffect, useState, type FormEvent } from 'react'
import BottomSheet from '../ui/BottomSheet'
import { usePersonal } from '../../context/PersonalContext'
import { parseAmount } from '../../lib/amount'
import { formatMoney } from '../../lib/utils'
import type { PfCategory } from '../../types'

const WARN_STEPS = [0.5, 0.7, 0.8, 0.9]

interface Props {
  open: boolean
  onClose: () => void
  category: PfCategory | null
}

/** Monatsbudget einer Kategorie + Warnschwelle. Das Budget liegt bewusst an
 *  der Kategorie selbst (pf_categories.monthly_budget) — keine zweite Tabelle,
 *  also nur eine Quelle der Wahrheit. */
export default function BudgetSheet({ open, onClose, category }: Props) {
  const { updateCategory } = usePersonal()

  const [amountRaw, setAmount] = useState('')
  const [warnRatio, setWarn]   = useState(0.8)
  const [busy, setBusy]        = useState(false)

  useEffect(() => {
    if (!open) return
    setAmount(
      category?.monthly_budget != null ? String(category.monthly_budget).replace('.', ',') : '',
    )
    setWarn(category?.warn_ratio ?? 0.8)
    setBusy(false)
  }, [open, category])

  const parsed = parseAmount(amountRaw)
  const empty = amountRaw.trim() === ''
  const budget = empty || parsed === null ? null : Math.abs(parsed)
  // Ein Budget von 0 waere sofort ueberschritten und damit sinnlos — leer
  // lassen heisst "kein Budget".
  const invalid = !empty && (parsed === null || Math.abs(parsed) === 0)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!category || invalid || busy) return
    setBusy(true)
    await updateCategory(category.id, {
      name: category.name,
      type: category.type,
      color: category.color,
      monthly_budget: budget,
      warn_ratio: warnRatio,
    })
    setBusy(false)
    onClose()
  }

  const field =
    'mt-1.5 w-full rounded-2xl bg-zinc-100 px-4 py-3 text-[15px] text-zinc-900 outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-brand-400'

  return (
    <BottomSheet open={open} onClose={onClose}>
      <form onSubmit={submit} className="px-5 pt-2">
        <h2 className="text-[17px] font-semibold tracking-[-0.3px] text-zinc-900">
          Budget: {category?.name}
        </h2>

        <label className="mt-4 block text-[13px] font-medium text-zinc-500">
          Monatsbudget <span className="text-zinc-400">(leer = kein Budget)</span>
        </label>
        <input
          autoFocus
          inputMode="decimal"
          value={amountRaw}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0,00"
          className={field}
        />
        {invalid && (
          <p className="mt-1.5 text-[12px] text-red-500">
            Bitte einen Betrag über 0 eintragen — oder das Feld leer lassen.
          </p>
        )}

        <label className="mt-4 block text-[13px] font-medium text-zinc-500">Warnen ab</label>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {WARN_STEPS.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWarn(w)}
              className={
                'rounded-xl px-3 py-2 text-[13px] font-medium transition-colors duration-150 ' +
                (warnRatio === w ? 'bg-brand-600 text-white' : 'bg-zinc-100 text-zinc-600')
              }
            >
              {Math.round(w * 100)} %
            </button>
          ))}
        </div>
        {budget !== null && budget > 0 && (
          <p className="mt-2 text-[12px] text-zinc-400">
            Hinweis erscheint ab {formatMoney(budget * warnRatio)}.
          </p>
        )}

        <button
          type="submit"
          disabled={invalid || busy}
          className="mt-5 w-full rounded-2xl bg-brand-600 py-3.5 text-[15px] font-semibold text-white transition-opacity duration-150 active:opacity-80 disabled:opacity-40"
        >
          Speichern
        </button>
      </form>
    </BottomSheet>
  )
}
