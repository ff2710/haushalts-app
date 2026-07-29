import { useEffect, useState, type FormEvent } from 'react'
import BottomSheet from '../ui/BottomSheet'
import { TrashIcon } from '../ui/Icon'
import { usePersonal } from '../../context/PersonalContext'
import { parseAmount } from '../../lib/amount'
import type { PfVariableEstimate } from '../../types'

interface Props {
  open: boolean
  onClose: () => void
  estimate: PfVariableEstimate | null
}

/** Grobe Schätzposten fürs Variable (z. B. "Leben", "Spaß") — fließen als
 *  Summe in die Monatsend-Prognose ein. */
export default function EstimateSheet({ open, onClose, estimate }: Props) {
  const { addEstimate, updateEstimate, deleteEstimate } = usePersonal()

  const [name, setName]        = useState('')
  const [amountRaw, setAmount] = useState('')
  const [busy, setBusy]        = useState(false)

  useEffect(() => {
    if (!open) return
    setName(estimate?.name ?? '')
    setAmount(estimate ? String(estimate.amount).replace('.', ',') : '')
    setBusy(false)
  }, [open, estimate])

  const parsed = parseAmount(amountRaw)
  const amount = parsed === null ? null : Math.abs(parsed)
  const valid = !!name.trim() && amount !== null

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    const payload = { name: name.trim(), amount: amount as number }
    if (estimate) await updateEstimate(estimate.id, payload)
    else await addEstimate(payload)
    setBusy(false)
    onClose()
  }

  const remove = async () => {
    if (!estimate || busy) return
    setBusy(true)
    await deleteEstimate(estimate.id)
    setBusy(false)
    onClose()
  }

  const field =
    'mt-1.5 w-full rounded-2xl bg-zinc-100 px-4 py-3 text-[15px] text-zinc-900 outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-brand-400'

  return (
    <BottomSheet open={open} onClose={onClose}>
      <form onSubmit={submit} className="px-5 pt-2">
        <h2 className="text-[17px] font-semibold tracking-[-0.3px] text-zinc-900">
          {estimate ? 'Schätzposten bearbeiten' : 'Neuer Schätzposten'}
        </h2>
        <p className="mt-1 text-[13px] leading-snug text-zinc-500">
          Grober Monatsbetrag fürs Variable — fließt in die Prognose ein.
        </p>

        <label className="mt-4 block text-[13px] font-medium text-zinc-500">Name</label>
        <input
          autoFocus={!estimate}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="z. B. Leben"
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

        <button
          type="submit"
          disabled={!valid || busy}
          className="mt-5 w-full rounded-2xl bg-brand-600 py-3.5 text-[15px] font-semibold text-white transition-opacity duration-150 active:opacity-80 disabled:opacity-40"
        >
          {estimate ? 'Speichern' : 'Anlegen'}
        </button>

        {estimate && (
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
