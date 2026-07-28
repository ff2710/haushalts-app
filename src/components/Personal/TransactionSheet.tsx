import { useEffect, useState, type FormEvent } from 'react'
import BottomSheet from '../ui/BottomSheet'
import { TrashIcon } from '../ui/Icon'
import { usePersonal } from '../../context/PersonalContext'
import { parseAmount } from '../../lib/amount'
import { todayISO } from '../../lib/utils'
import type { PfCategoryType, PfTransaction } from '../../types'

interface Props {
  open: boolean
  onClose: () => void
  /** null = neuer Umsatz */
  transaction: PfTransaction | null
}

export default function TransactionSheet({ open, onClose, transaction }: Props) {
  const { accounts, categories, addTransaction, updateTransaction, deleteTransaction } =
    usePersonal()

  const [type, setType]         = useState<PfCategoryType>('expense')
  const [amountRaw, setAmount]  = useState('')
  const [description, setDesc]  = useState('')
  const [date, setDate]         = useState(todayISO())
  const [accountId, setAccount] = useState<string | null>(null)
  const [categoryId, setCat]    = useState<string | null>(null)
  const [busy, setBusy]         = useState(false)

  useEffect(() => {
    if (!open) return
    setType(transaction?.type ?? 'expense')
    // Beim Bearbeiten den Betrag im deutschen Format vorbelegen.
    setAmount(transaction ? String(transaction.amount).replace('.', ',') : '')
    setDesc(transaction?.description ?? '')
    setDate(transaction?.date ?? todayISO())
    setAccount(transaction?.account_id ?? accounts.find((a) => a.is_hub)?.id ?? null)
    setCat(transaction?.category_id ?? null)
    setBusy(false)
  }, [open, transaction, accounts])

  // Betrag immer positiv speichern — die Richtung steckt in `type`.
  const parsed = parseAmount(amountRaw)
  const amount = parsed === null ? null : Math.abs(parsed)
  const valid = amount !== null && amount > 0 && !!date

  const visibleCategories = categories.filter((c) => c.type === type)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!valid || busy) return
    setBusy(true)

    const payload = {
      date,
      type,
      amount: amount as number,
      description: description.trim(),
      account_id: accountId,
      category_id: categoryId,
      import_batch_id: null,
      source: 'manual' as const,
      source_ref: null,
    }

    if (transaction) await updateTransaction(transaction.id, payload)
    else await addTransaction(payload)

    setBusy(false)
    onClose()
  }

  const remove = async () => {
    if (!transaction || busy) return
    setBusy(true)
    await deleteTransaction(transaction.id)
    setBusy(false)
    onClose()
  }

  const chip = (active: boolean) =>
    'rounded-xl px-3 py-2 text-[13px] font-medium transition-colors duration-150 ' +
    (active ? 'bg-brand-600 text-white' : 'bg-zinc-100 text-zinc-600')

  return (
    <BottomSheet open={open} onClose={onClose}>
      <form onSubmit={submit} className="px-5 pt-2">
        <h2 className="text-[17px] font-semibold tracking-[-0.3px] text-zinc-900">
          {transaction ? 'Umsatz bearbeiten' : 'Neuer Umsatz'}
        </h2>

        {/* Richtung */}
        <div className="mt-4 flex gap-1 rounded-2xl bg-zinc-100 p-1">
          {(
            [
              { id: 'expense' as const, label: 'Ausgabe' },
              { id: 'income' as const,  label: 'Einnahme' },
            ]
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setType(t.id)
                setCat(null) // Kategorien sind nach Richtung getrennt
              }}
              className={
                'flex-1 rounded-xl py-2 text-[14px] font-semibold transition-colors duration-150 ' +
                (type === t.id ? 'bg-white text-brand-600 shadow-sm' : 'text-zinc-400')
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        <label className="mt-4 block text-[13px] font-medium text-zinc-500">Betrag</label>
        <div className="relative mt-1.5">
          <input
            autoFocus={!transaction}
            inputMode="decimal"
            value={amountRaw}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0,00"
            className="w-full rounded-2xl bg-zinc-100 px-4 py-3 pr-10 text-[17px] font-semibold tabular-nums text-zinc-900 outline-none placeholder:font-normal placeholder:text-zinc-400 focus:ring-2 focus:ring-brand-400"
          />
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[15px] text-zinc-400">
            €
          </span>
        </div>
        {amountRaw && amount === null && (
          <p className="mt-1.5 text-[12px] text-red-500">Betrag nicht erkannt.</p>
        )}

        <label className="mt-4 block text-[13px] font-medium text-zinc-500">Beschreibung</label>
        <input
          value={description}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="z. B. Wocheneinkauf"
          className="mt-1.5 w-full rounded-2xl bg-zinc-100 px-4 py-3 text-[15px] text-zinc-900 outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-brand-400"
        />

        <label className="mt-4 block text-[13px] font-medium text-zinc-500">Datum</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1.5 w-full rounded-2xl bg-zinc-100 px-4 py-3 text-[15px] text-zinc-900 outline-none focus:ring-2 focus:ring-brand-400"
        />

        {accounts.length > 0 && (
          <>
            <label className="mt-4 block text-[13px] font-medium text-zinc-500">Konto</label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {accounts.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAccount(accountId === a.id ? null : a.id)}
                  className={chip(accountId === a.id)}
                >
                  {a.name}
                </button>
              ))}
            </div>
          </>
        )}

        {visibleCategories.length > 0 && (
          <>
            <label className="mt-4 block text-[13px] font-medium text-zinc-500">Kategorie</label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {visibleCategories.map((c) => (
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
          {transaction ? 'Speichern' : 'Umsatz erfassen'}
        </button>

        {transaction && (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-[15px] font-medium text-red-500 transition-colors duration-150 active:bg-red-50 disabled:opacity-40"
          >
            <TrashIcon size={16} />
            Umsatz löschen
          </button>
        )}
      </form>
    </BottomSheet>
  )
}
