import { useEffect, useMemo, useState, type FormEvent } from 'react'
import BottomSheet from '../ui/BottomSheet'
import { TrashIcon, MinusCircleIcon } from '../ui/Icon'
import AddButton from '../ui/AddButton'
import { usePersonal } from '../../context/PersonalContext'
import { parseAmount } from '../../lib/amount'
import { formatMoney } from '../../lib/utils'
import type { PfAccount, PfAccountType } from '../../types'

export const ACCOUNT_TYPES: { id: PfAccountType; label: string }[] = [
  { id: 'giro',        label: 'Girokonto' },
  { id: 'tagesgeld',   label: 'Tagesgeld' },
  { id: 'kreditkarte', label: 'Kreditkarte' },
  { id: 'depot',       label: 'Depot' },
  { id: 'festgeld',    label: 'Festgeld' },
  { id: 'bar',         label: 'Bargeld' },
  { id: 'sonstiges',   label: 'Sonstiges' },
]

/** Ein Ort im Bearbeiten-Zustand. Ohne id = noch nicht gespeichert. */
interface LocationDraft {
  id?: string
  name: string
  amount: string
}

interface Props {
  open: boolean
  onClose: () => void
  /** null = neues Konto anlegen */
  account: PfAccount | null
}

export default function AccountSheet({ open, onClose, account }: Props) {
  const {
    accounts,
    cashLocations,
    addAccount,
    updateAccount,
    deleteAccount,
    addCashLocation,
    updateCashLocation,
    deleteCashLocation,
  } = usePersonal()

  const [name, setName]       = useState('')
  const [type, setType]       = useState<PfAccountType>('giro')
  const [isHub, setIsHub]     = useState(false)
  const [isShared, setIsShared] = useState(false)
  const [cashRaw, setCashRaw] = useState('')
  const [locations, setLocations] = useState<LocationDraft[]>([])
  const [busy, setBusy]       = useState(false)

  const savedLocations = useMemo(
    () => (account ? cashLocations.filter((l) => l.account_id === account.id) : []),
    [cashLocations, account],
  )

  // Beim Öffnen auf den zu bearbeitenden Eintrag (oder leer) zurücksetzen.
  useEffect(() => {
    if (!open) return
    setName(account?.name ?? '')
    setType(account?.type ?? 'giro')
    setIsHub(account?.is_hub ?? false)
    setIsShared(account?.is_shared_ref ?? false)
    setCashRaw(
      account?.stated_balance != null ? String(account.stated_balance).replace('.', ',') : '',
    )
    setLocations(
      savedLocations.map((l) => ({
        id: l.id,
        name: l.name,
        amount: String(l.amount).replace('.', ','),
      })),
    )
    setBusy(false)
  }, [open, account, savedLocations])

  const isCash = type === 'bar'
  const num = (raw: string) => Math.abs(parseAmount(raw) ?? 0)
  const locationTotal = locations.reduce((s, l) => s + num(l.amount), 0)
  /** Letztes Bargeld-Konto: nicht löschbar, es soll immer eines geben. */
  const isLastCash =
    !!account && account.type === 'bar' && accounts.filter((a) => a.type === 'bar').length === 1

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || busy) return
    setBusy(true)

    // Sind Orte im Spiel, gilt deren Summe — stated_balance ruht dann.
    const stated = isCash && locations.length === 0 ? num(cashRaw) : null

    if (account) {
      await updateAccount(account.id, {
        name: trimmed,
        type,
        is_hub: isHub,
        is_shared_ref: isShared,
        stated_balance: stated,
        position: account.position,
      })

      // Orte abgleichen: geänderte aktualisieren, neue anlegen, entfernte löschen.
      const keptIds = new Set(locations.filter((l) => l.id).map((l) => l.id as string))
      for (const saved of savedLocations) {
        if (!keptIds.has(saved.id)) await deleteCashLocation(saved.id)
      }
      for (const [i, draft] of locations.entries()) {
        const amount = num(draft.amount)
        const label = draft.name.trim() || `Ort ${i + 1}`
        if (!draft.id) {
          await addCashLocation({
            account_id: account.id,
            name: label,
            amount,
            position: i,
          })
          continue
        }
        const before = savedLocations.find((l) => l.id === draft.id)
        if (!before) continue
        if (before.name !== label || Number(before.amount) !== amount || before.position !== i) {
          await updateCashLocation(draft.id, { name: label, amount, position: i })
        }
      }
    } else {
      await addAccount({
        name: trimmed,
        type,
        is_hub: isHub,
        is_shared_ref: isShared,
        stated_balance: stated,
        position: accounts.length,
      })
    }
    setBusy(false)
    onClose()
  }

  const remove = async () => {
    if (!account || busy || isLastCash) return
    setBusy(true)
    await deleteAccount(account.id)
    setBusy(false)
    onClose()
  }

  const field =
    'w-full rounded-2xl bg-zinc-100 px-4 py-3 text-[15px] text-zinc-900 outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-brand-400'

  return (
    <BottomSheet open={open} onClose={onClose}>
      <form onSubmit={submit} className="px-5 pt-2">
        <h2 className="text-[17px] font-semibold tracking-[-0.3px] text-zinc-900">
          {account ? 'Konto bearbeiten' : 'Neues Konto'}
        </h2>

        <label className="mt-4 block text-[13px] font-medium text-zinc-500">Name</label>
        <input
          autoFocus={!account}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="z. B. DKB Giro"
          className={'mt-1.5 ' + field}
        />

        <label className="mt-4 block text-[13px] font-medium text-zinc-500">Art</label>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {ACCOUNT_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setType(t.id)}
              className={
                'rounded-xl px-3 py-2 text-[13px] font-medium transition-colors duration-150 ' +
                (type === t.id ? 'bg-brand-600 text-white' : 'bg-zinc-100 text-zinc-600')
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Bargeld ───────────────────────────────────────────────────────
            Ein Girokonto rechnet seinen Stand aus den Buchungen. Bargeld
            zählt man nachschauend — hier also eine Zahl eintragen, fertig.
            Die Aufteilung auf Orte ist bewusst nur ein Zusatz und steht
            niemandem im Weg, der einfach nur den Betrag eintragen will. */}
        {isCash && (
          <>
            {locations.length === 0 ? (
              <>
                <label className="mt-4 block text-[13px] font-medium text-zinc-500">
                  Wie viel hast du gerade?
                </label>
                <input
                  inputMode="decimal"
                  value={cashRaw}
                  onChange={(e) => setCashRaw(e.target.value)}
                  placeholder="0,00"
                  className={'mt-1.5 ' + field}
                />
                <p className="mt-1.5 text-[12px] leading-snug text-zinc-400">
                  Selbst gezählt — Buchungen auf dieses Konto verändern den Stand nicht.
                </p>
              </>
            ) : (
              <div className="mt-4 flex items-baseline justify-between">
                <span className="text-[13px] font-medium text-zinc-500">Bestand</span>
                <span className="text-[15px] font-semibold tabular-nums text-zinc-900">
                  {formatMoney(locationTotal)}
                </span>
              </div>
            )}

            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="text-[13px] font-medium text-zinc-500">
                Orte <span className="text-zinc-400">(optional)</span>
              </span>
              <AddButton
                subtle
                label="Ort hinzufügen"
                onClick={() =>
                  setLocations((l) => [
                    ...l,
                    { name: '', amount: l.length === 0 ? cashRaw : '' },
                  ])
                }
              />
            </div>

            {locations.length === 0 ? (
              <p className="mt-1 text-[12px] leading-snug text-zinc-400">
                Nur falls du getrennt führen willst, was wo liegt — Geldbeutel, Schublade,
                Urlaubskasse. Dann ist der Bestand deren Summe.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {locations.map((loc, i) => (
                  <li key={loc.id ?? `neu-${i}`} className="flex items-center gap-2">
                    <input
                      value={loc.name}
                      onChange={(e) =>
                        setLocations((l) =>
                          l.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)),
                        )
                      }
                      placeholder={`Ort ${i + 1}`}
                      className="min-w-0 flex-1 rounded-2xl bg-zinc-100 px-3.5 py-2.5 text-[14px] text-zinc-900 outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-brand-400"
                    />
                    <input
                      inputMode="decimal"
                      value={loc.amount}
                      onChange={(e) =>
                        setLocations((l) =>
                          l.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)),
                        )
                      }
                      placeholder="0,00"
                      className="w-24 shrink-0 rounded-2xl bg-zinc-100 px-3 py-2.5 text-right text-[14px] tabular-nums text-zinc-900 outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-brand-400"
                    />
                    <button
                      type="button"
                      aria-label={`Ort ${i + 1} entfernen`}
                      onClick={() => setLocations((l) => l.filter((_, j) => j !== i))}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-400 transition-colors duration-150 active:bg-black/[0.06]"
                    >
                      <MinusCircleIcon size={18} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        <div className="mt-4 space-y-2">
          <label className="flex items-center gap-3 rounded-2xl bg-zinc-50 px-4 py-3">
            <input
              type="checkbox"
              checked={isHub}
              onChange={(e) => setIsHub(e.target.checked)}
              className="h-4 w-4 accent-brand-600"
            />
            <span className="text-[14px] text-zinc-700">
              Hauptkonto (Hub)
              <span className="block text-[12px] text-zinc-400">
                Zentrales Verrechnungskonto — nur eines möglich
              </span>
            </span>
          </label>

          <label className="flex items-center gap-3 rounded-2xl bg-zinc-50 px-4 py-3">
            <input
              type="checkbox"
              checked={isShared}
              onChange={(e) => setIsShared(e.target.checked)}
              className="h-4 w-4 accent-brand-600"
            />
            <span className="text-[14px] text-zinc-700">
              Gemeinschaftskonto
              <span className="block text-[12px] text-zinc-400">
                Nur als Bezug — die gemeinsamen Daten bleiben im Gemeinsam-Bereich
              </span>
            </span>
          </label>
        </div>

        <button
          type="submit"
          disabled={!name.trim() || busy}
          className="mt-5 w-full rounded-2xl bg-brand-600 py-3.5 text-[15px] font-semibold text-white transition-opacity duration-150 active:opacity-80 disabled:opacity-40"
        >
          {account ? 'Speichern' : 'Konto anlegen'}
        </button>

        {account && !isLastCash && (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-[15px] font-medium text-red-500 transition-colors duration-150 active:bg-red-50 disabled:opacity-40"
          >
            <TrashIcon size={16} />
            Konto löschen
          </button>
        )}
        {isLastCash && (
          <p className="mt-2 text-center text-[12px] leading-snug text-zinc-400">
            Dein einziges Bargeld-Konto bleibt erhalten — es soll immer eines geben.
          </p>
        )}
      </form>
    </BottomSheet>
  )
}
