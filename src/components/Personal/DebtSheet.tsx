import { useEffect, useState, type FormEvent } from 'react'
import BottomSheet from '../ui/BottomSheet'
import { TrashIcon } from '../ui/Icon'
import { usePersonal } from '../../context/PersonalContext'
import { parseAmount } from '../../lib/amount'
import { formatMoney } from '../../lib/utils'
import type { PfDebt } from '../../types'

interface Props {
  open: boolean
  onClose: () => void
  /** null = neue Schuld. */
  debt: PfDebt | null
}

export default function DebtSheet({ open, onClose, debt }: Props) {
  const { debts, addDebt, updateDebt, deleteDebt } = usePersonal()

  const [creditor, setCreditor] = useState('')
  const [initialRaw, setInitial] = useState('')
  const [paidRaw, setPaid]       = useState('')
  const [rateRaw, setRate]       = useState('')
  const [note, setNote]          = useState('')
  const [active, setActive]      = useState(true)
  const [busy, setBusy]          = useState(false)

  useEffect(() => {
    if (!open) return
    setCreditor(debt?.creditor ?? '')
    setInitial(debt ? String(debt.initial_amount).replace('.', ',') : '')
    setPaid(debt ? String(debt.paid_amount).replace('.', ',') : '')
    setRate(debt?.monthly_rate != null ? String(debt.monthly_rate).replace('.', ',') : '')
    setNote(debt?.note ?? '')
    setActive(debt?.active ?? true)
    setBusy(false)
  }, [open, debt])

  const num = (raw: string) => {
    const p = parseAmount(raw)
    return p === null ? null : Math.abs(p)
  }
  const initial = num(initialRaw)
  const paid = paidRaw.trim() === '' ? 0 : num(paidRaw)
  const rate = rateRaw.trim() === '' ? null : num(rateRaw)

  // Beide Regeln stehen so auch in der Datenbank. Hier vorab gemeldet, damit
  // man einen Satz liest statt eines Fehlercodes.
  const initialInvalid = initial === null || initial === 0
  const paidInvalid = paid === null || (initial !== null && paid > initial)
  const valid = !!creditor.trim() && !initialInvalid && !paidInvalid

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    const payload = {
      creditor: creditor.trim(),
      initial_amount: initial as number,
      paid_amount: paid as number,
      monthly_rate: rate,
      priority: debt?.priority ?? debts.length,
      note: note.trim(),
      active,
    }
    if (debt) await updateDebt(debt.id, payload)
    else await addDebt(payload)
    setBusy(false)
    onClose()
  }

  const remove = async () => {
    if (!debt || busy) return
    setBusy(true)
    await deleteDebt(debt.id)
    setBusy(false)
    onClose()
  }

  const field =
    'mt-1.5 w-full rounded-2xl bg-zinc-100 px-4 py-3 text-[15px] text-zinc-900 outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-brand-400'

  const rest =
    initial !== null && paid !== null && !paidInvalid ? Math.max(0, initial - paid) : null

  return (
    <BottomSheet open={open} onClose={onClose}>
      <form onSubmit={submit} className="px-5 pt-2">
        <h2 className="text-[17px] font-semibold tracking-[-0.3px] text-zinc-900">
          {debt ? 'Schuld bearbeiten' : 'Neue Schuld'}
        </h2>

        <label className="mt-4 block text-[13px] font-medium text-zinc-500">Bei wem</label>
        <input
          autoFocus={!debt}
          value={creditor}
          onChange={(e) => setCreditor(e.target.value)}
          placeholder="z. B. Papa"
          className={field}
        />

        <label className="mt-4 block text-[13px] font-medium text-zinc-500">
          Ursprünglicher Betrag
        </label>
        <input
          inputMode="decimal"
          value={initialRaw}
          onChange={(e) => setInitial(e.target.value)}
          placeholder="0,00"
          className={field}
        />
        {initialInvalid && initialRaw.trim() !== '' && (
          <p className="mt-1.5 text-[12px] text-red-500">Bitte einen Betrag über 0 eintragen.</p>
        )}

        <label className="mt-4 block text-[13px] font-medium text-zinc-500">
          Davon schon getilgt
        </label>
        <input
          inputMode="decimal"
          value={paidRaw}
          onChange={(e) => setPaid(e.target.value)}
          placeholder="0,00"
          className={field}
        />
        {paidInvalid ? (
          <p className="mt-1.5 text-[12px] text-red-500">
            Es lässt sich nicht mehr tilgen, als aufgenommen wurde.
          </p>
        ) : (
          rest !== null && (
            <p className="mt-1.5 text-[12px] text-zinc-400">
              Offen bleiben {formatMoney(rest)}.
            </p>
          )
        )}

        <label className="mt-4 block text-[13px] font-medium text-zinc-500">
          Rate je Monat <span className="text-zinc-400">(leer = was übrig bleibt)</span>
        </label>
        <input
          inputMode="decimal"
          value={rateRaw}
          onChange={(e) => setRate(e.target.value)}
          placeholder="z. B. 150"
          className={field}
        />

        <label className="mt-4 block text-[13px] font-medium text-zinc-500">
          Notiz <span className="text-zinc-400">(optional)</span>
        </label>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="wofür, seit wann …"
          className={field}
        />

        <label className="mt-4 flex items-center gap-3 rounded-2xl bg-zinc-50 px-4 py-3">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 accent-brand-600"
          />
          <span className="text-[14px] text-zinc-700">
            Wird getilgt
            <span className="block text-[12px] text-zinc-400">
              Pausierte Schulden bleiben stehen, bekommen aber nichts aus der Kaskade
            </span>
          </span>
        </label>

        <button
          type="submit"
          disabled={!valid || busy}
          className="mt-5 w-full rounded-2xl bg-brand-600 py-3.5 text-[15px] font-semibold text-white transition-opacity duration-150 active:opacity-80 disabled:opacity-40"
        >
          {debt ? 'Speichern' : 'Anlegen'}
        </button>

        {debt && (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-[15px] font-medium text-red-500 transition-colors duration-150 active:bg-red-50 disabled:opacity-40"
          >
            <TrashIcon size={16} />
            Schuld löschen
          </button>
        )}
      </form>
    </BottomSheet>
  )
}
