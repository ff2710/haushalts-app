import { useEffect, useState, type FormEvent } from 'react'
import BottomSheet from '../ui/BottomSheet'
import { TrashIcon } from '../ui/Icon'
import { usePersonal } from '../../context/PersonalContext'
import { parseAmount } from '../../lib/amount'
import type { PfPot } from '../../types'

interface Props {
  open: boolean
  onClose: () => void
  /** null = neuer Topf. */
  pot: PfPot | null
}

export default function PotSheet({ open, onClose, pot }: Props) {
  const { pots, accounts, addPot, updatePot, deletePot } = usePersonal()

  const [name, setName]       = useState('')
  const [currentRaw, setCurrent] = useState('')
  const [targetRaw, setTarget]   = useState('')
  const [capRaw, setCap]         = useState('')
  const [accountId, setAccount]  = useState<string | null>(null)
  const [active, setActive]      = useState(true)
  const [busy, setBusy]          = useState(false)

  useEffect(() => {
    if (!open) return
    setName(pot?.name ?? '')
    setCurrent(pot ? String(pot.current_amount).replace('.', ',') : '')
    setTarget(pot?.target_amount != null ? String(pot.target_amount).replace('.', ',') : '')
    setCap(pot?.monthly_cap != null ? String(pot.monthly_cap).replace('.', ',') : '')
    setAccount(pot?.account_id ?? null)
    setActive(pot?.active ?? true)
    setBusy(false)
  }, [open, pot])

  const num = (raw: string) => {
    const p = parseAmount(raw)
    return p === null ? null : Math.abs(p)
  }
  const target = targetRaw.trim() === '' ? null : num(targetRaw)
  const cap    = capRaw.trim() === '' ? null : num(capRaw)

  // Das Schema verlangt ein Ziel > 0, wenn eines gesetzt ist. Ein Ziel von 0
  // waere sofort erreicht und der Fortschrittsbalken darueber sinnlos.
  const targetInvalid = targetRaw.trim() !== '' && (target === null || target === 0)
  const capInvalid    = capRaw.trim() !== '' && (cap === null || cap === 0)
  const valid = !!name.trim() && !targetInvalid && !capInvalid

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    const payload = {
      name: name.trim(),
      current_amount: num(currentRaw) ?? 0,
      target_amount: target,
      monthly_cap: cap,
      priority: pot?.priority ?? pots.length,
      account_id: accountId,
      active,
    }
    if (pot) await updatePot(pot.id, payload)
    else await addPot(payload)
    setBusy(false)
    onClose()
  }

  const remove = async () => {
    if (!pot || busy) return
    setBusy(true)
    await deletePot(pot.id)
    setBusy(false)
    onClose()
  }

  const field =
    'mt-1.5 w-full rounded-2xl bg-zinc-100 px-4 py-3 text-[15px] text-zinc-900 outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-brand-400'
  const chip = (on: boolean) =>
    'rounded-xl px-3 py-2 text-[13px] font-medium transition-colors duration-150 ' +
    (on ? 'bg-brand-600 text-white' : 'bg-zinc-100 text-zinc-600')

  return (
    <BottomSheet open={open} onClose={onClose}>
      <form onSubmit={submit} className="px-5 pt-2">
        <h2 className="text-[17px] font-semibold tracking-[-0.3px] text-zinc-900">
          {pot ? 'Topf bearbeiten' : 'Neuer Topf'}
        </h2>

        <label className="mt-4 block text-[13px] font-medium text-zinc-500">Name</label>
        <input
          autoFocus={!pot}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="z. B. Notgroschen"
          className={field}
        />

        <label className="mt-4 block text-[13px] font-medium text-zinc-500">
          Wie viel liegt drin?
        </label>
        <input
          inputMode="decimal"
          value={currentRaw}
          onChange={(e) => setCurrent(e.target.value)}
          placeholder="0,00"
          className={field}
        />

        <label className="mt-4 block text-[13px] font-medium text-zinc-500">
          Ziel <span className="text-zinc-400">(leer = ohne Ziel)</span>
        </label>
        <input
          inputMode="decimal"
          value={targetRaw}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="z. B. 5.000"
          className={field}
        />
        {targetInvalid && (
          <p className="mt-1.5 text-[12px] text-red-500">
            Ein Ziel über 0 eintragen — oder das Feld leer lassen.
          </p>
        )}

        <label className="mt-4 block text-[13px] font-medium text-zinc-500">
          Höchstens je Monat <span className="text-zinc-400">(optional)</span>
        </label>
        <input
          inputMode="decimal"
          value={capRaw}
          onChange={(e) => setCap(e.target.value)}
          placeholder="kein Deckel"
          className={field}
        />
        {capInvalid && (
          <p className="mt-1.5 text-[12px] text-red-500">
            Einen Deckel über 0 eintragen — oder das Feld leer lassen.
          </p>
        )}

        {accounts.length > 0 && (
          <>
            <label className="mt-4 block text-[13px] font-medium text-zinc-500">
              Liegt auf <span className="text-zinc-400">(optional)</span>
            </label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              <button type="button" onClick={() => setAccount(null)} className={chip(accountId === null)}>
                Ohne Konto
              </button>
              {accounts.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAccount(a.id)}
                  className={chip(accountId === a.id)}
                >
                  {a.name}
                </button>
              ))}
            </div>
          </>
        )}

        <label className="mt-4 flex items-center gap-3 rounded-2xl bg-zinc-50 px-4 py-3">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 accent-brand-600"
          />
          <span className="text-[14px] text-zinc-700">
            Wird befüllt
            <span className="block text-[12px] text-zinc-400">
              Pausierte Töpfe bleiben stehen, bekommen aber nichts mehr
            </span>
          </span>
        </label>

        <button
          type="submit"
          disabled={!valid || busy}
          className="mt-5 w-full rounded-2xl bg-brand-600 py-3.5 text-[15px] font-semibold text-white transition-opacity duration-150 active:opacity-80 disabled:opacity-40"
        >
          {pot ? 'Speichern' : 'Anlegen'}
        </button>

        {pot && (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-[15px] font-medium text-red-500 transition-colors duration-150 active:bg-red-50 disabled:opacity-40"
          >
            <TrashIcon size={16} />
            Topf löschen
          </button>
        )}
      </form>
    </BottomSheet>
  )
}
