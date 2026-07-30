import { useEffect, useState, type FormEvent } from 'react'
import BottomSheet from '../ui/BottomSheet'
import { TrashIcon } from '../ui/Icon'
import { usePersonal } from '../../context/PersonalContext'
import { parseAmount } from '../../lib/amount'
import type { PfAllocationStep, PfStepKind } from '../../types'

const KINDS: { id: PfStepKind; label: string; help: string }[] = [
  { id: 'fixed',   label: 'Fester Betrag', help: 'Jeden Monat derselbe Betrag, z. B. die Pauschale fürs Gemeinschaftskonto.' },
  { id: 'percent', label: 'Anteil',        help: 'Ein Prozentsatz des Restgelds, gemessen am Betrag vor der ersten Stufe.' },
  { id: 'debts',   label: 'Schulden',      help: 'Verteilt auf deine Schulden, in deren Reihenfolge, bis zur jeweiligen Wunschrate.' },
  { id: 'pots',    label: 'Töpfe',         help: 'Verteilt auf deine Töpfe, in deren Reihenfolge, bis zum jeweiligen Ziel.' },
  { id: 'rest',    label: 'Rest',          help: 'Nimmt alles, was übrig ist. Sinnvoll als letzte Stufe.' },
]

interface Props {
  open: boolean
  onClose: () => void
  /** null = neue Stufe. */
  step: PfAllocationStep | null
}

export default function StepSheet({ open, onClose, step }: Props) {
  const { allocationSteps, addStep, updateStep, deleteStep } = usePersonal()

  const [name, setName]     = useState('')
  const [kind, setKind]     = useState<PfStepKind>('fixed')
  const [raw, setRaw]       = useState('')
  const [active, setActive] = useState(true)
  const [busy, setBusy]     = useState(false)

  useEffect(() => {
    if (!open) return
    setName(step?.name ?? '')
    setKind(step?.kind ?? 'fixed')
    setRaw(
      step?.kind === 'percent'
        ? step.percent != null ? String(step.percent).replace('.', ',') : ''
        : step?.amount != null ? String(step.amount).replace('.', ',') : '',
    )
    setActive(step?.active ?? true)
    setBusy(false)
  }, [open, step])

  const parsed = parseAmount(raw)
  const value = parsed === null ? null : Math.abs(parsed)
  const needsValue = kind === 'fixed' || kind === 'percent'
  // Das Schema verlangt fuer 'fixed' einen Betrag und fuer 'percent' einen
  // Prozentwert. Ohne diese Pruefung liefe man in einen Datenbankfehler statt
  // in einen verstaendlichen Hinweis.
  const invalid =
    needsValue && (value === null || (kind === 'percent' && value > 100))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || invalid || busy) return
    setBusy(true)
    const payload = {
      name: trimmed,
      kind,
      amount:  kind === 'fixed'   ? (value ?? 0) : null,
      percent: kind === 'percent' ? (value ?? 0) : null,
      position: step?.position ?? allocationSteps.length,
      active,
    }
    if (step) await updateStep(step.id, payload)
    else await addStep(payload)
    setBusy(false)
    onClose()
  }

  const remove = async () => {
    if (!step || busy) return
    setBusy(true)
    await deleteStep(step.id)
    setBusy(false)
    onClose()
  }

  const field =
    'mt-1.5 w-full rounded-2xl bg-zinc-100 px-4 py-3 text-[15px] text-zinc-900 outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-brand-400'
  const chip = (on: boolean) =>
    'rounded-xl px-3 py-2 text-[13px] font-medium transition-colors duration-150 ' +
    (on ? 'bg-brand-600 text-white' : 'bg-zinc-100 text-zinc-600')

  const help = KINDS.find((k) => k.id === kind)?.help ?? ''

  return (
    <BottomSheet open={open} onClose={onClose}>
      <form onSubmit={submit} className="px-5 pt-2">
        <h2 className="text-[17px] font-semibold tracking-[-0.3px] text-zinc-900">
          {step ? 'Stufe bearbeiten' : 'Neue Stufe'}
        </h2>

        <label className="mt-4 block text-[13px] font-medium text-zinc-500">Name</label>
        <input
          autoFocus={!step}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="z. B. Gemeinsam-Pauschale"
          className={field}
        />

        <label className="mt-4 block text-[13px] font-medium text-zinc-500">Art</label>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <button key={k.id} type="button" onClick={() => setKind(k.id)} className={chip(kind === k.id)}>
              {k.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[12px] leading-snug text-zinc-400">{help}</p>

        {needsValue && (
          <>
            <label className="mt-4 block text-[13px] font-medium text-zinc-500">
              {kind === 'percent' ? 'Anteil in Prozent' : 'Betrag je Monat'}
            </label>
            <input
              inputMode="decimal"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder={kind === 'percent' ? '10' : '0,00'}
              className={field}
            />
            {invalid && (
              <p className="mt-1.5 text-[12px] text-red-500">
                {kind === 'percent'
                  ? 'Bitte einen Anteil zwischen 0 und 100 eintragen.'
                  : 'Bitte einen Betrag eintragen.'}
              </p>
            )}
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
            Läuft mit
            <span className="block text-[12px] text-zinc-400">
              Pausierte Stufen bekommen nichts, bleiben aber erhalten
            </span>
          </span>
        </label>

        <button
          type="submit"
          disabled={!name.trim() || invalid || busy}
          className="mt-5 w-full rounded-2xl bg-brand-600 py-3.5 text-[15px] font-semibold text-white transition-opacity duration-150 active:opacity-80 disabled:opacity-40"
        >
          {step ? 'Speichern' : 'Anlegen'}
        </button>

        {step && (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-[15px] font-medium text-red-500 transition-colors duration-150 active:bg-red-50 disabled:opacity-40"
          >
            <TrashIcon size={16} />
            Stufe löschen
          </button>
        )}
      </form>
    </BottomSheet>
  )
}
