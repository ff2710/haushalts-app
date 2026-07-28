import { useEffect, useState, type FormEvent } from 'react'
import BottomSheet from '../ui/BottomSheet'
import { TrashIcon } from '../ui/Icon'
import { usePersonal } from '../../context/PersonalContext'
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

interface Props {
  open: boolean
  onClose: () => void
  /** null = neues Konto anlegen */
  account: PfAccount | null
}

export default function AccountSheet({ open, onClose, account }: Props) {
  const { accounts, addAccount, updateAccount, deleteAccount } = usePersonal()

  const [name, setName]       = useState('')
  const [type, setType]       = useState<PfAccountType>('giro')
  const [isHub, setIsHub]     = useState(false)
  const [isShared, setIsShared] = useState(false)
  const [busy, setBusy]       = useState(false)

  // Beim Öffnen auf den zu bearbeitenden Eintrag (oder leer) zurücksetzen.
  useEffect(() => {
    if (!open) return
    setName(account?.name ?? '')
    setType(account?.type ?? 'giro')
    setIsHub(account?.is_hub ?? false)
    setIsShared(account?.is_shared_ref ?? false)
    setBusy(false)
  }, [open, account])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || busy) return
    setBusy(true)

    if (account) {
      await updateAccount(account.id, {
        name: trimmed,
        type,
        is_hub: isHub,
        is_shared_ref: isShared,
        position: account.position,
      })
    } else {
      await addAccount({
        name: trimmed,
        type,
        is_hub: isHub,
        is_shared_ref: isShared,
        position: accounts.length,
      })
    }
    setBusy(false)
    onClose()
  }

  const remove = async () => {
    if (!account || busy) return
    setBusy(true)
    await deleteAccount(account.id)
    setBusy(false)
    onClose()
  }

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
          className="mt-1.5 w-full rounded-2xl bg-zinc-100 px-4 py-3 text-[15px] text-zinc-900 outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-brand-400"
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

        {account && (
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
      </form>
    </BottomSheet>
  )
}
