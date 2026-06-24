import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { motion, AnimatePresence, useAnimation } from 'framer-motion'
import { useApp } from '../../context/AppContext'
import { MoneyFlyIcon, SwapIcon } from '../ui/Icon'
import { computeBalance, formatDate, todayISO } from '../../lib/utils'
import type { Person, Split } from '../../types'

// ── Animated tab (like ShoppingList sort pills) ───────────────────────────────
function TypeTab({
  label,
  icon,
  active,
  onClick,
}: {
  label: string
  icon: ReactNode
  active: boolean
  onClick: () => void
}) {
  const controls  = useAnimation()
  const wasActive = useRef(false)

  useEffect(() => {
    if (active && !wasActive.current) {
      void controls.start({
        rotate: [0, -14, 0],
        scale:  [1, 1.25, 1],
        transition: { duration: 0.32, times: [0, 0.4, 1], ease: 'easeInOut' },
      })
    }
    wasActive.current = active
  }, [active, controls])

  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 transition-all duration-200 active:scale-[0.97] ' +
        (active ? 'bg-white shadow-sm' : '')
      }
    >
      <motion.span animate={controls} className="inline-flex shrink-0">
        <span className={active ? 'text-violet-600' : 'text-zinc-400'}>{icon}</span>
      </motion.span>
      <span className={
        'text-[14px] font-semibold tracking-[-0.1px] transition-colors duration-200 ' +
        (active ? 'text-violet-600' : 'text-zinc-400')
      }>
        {label}
      </span>
    </button>
  )
}

// ── Person avatar circle ──────────────────────────────────────────────────────
function PersonAvatar({
  name,
  avatarUrl,
  selected,
  onClick,
}: {
  name: string
  avatarUrl?: string | null
  selected: boolean
  onClick: () => void
}) {
  const initial = name.trim()[0]?.toUpperCase() ?? '?'
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 px-4 py-1 transition-all duration-150 active:scale-95"
    >
      <div className={
        'h-14 w-14 overflow-hidden rounded-full text-[20px] font-bold transition-all duration-200 ' +
        (selected ? 'shadow-md ring-4 ring-brand-100' : '')
      }>
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} className="h-full w-full object-cover" draggable={false} />
        ) : (
          <div className={
            'flex h-full w-full items-center justify-center ' +
            (selected ? 'bg-brand-600 text-white' : 'bg-zinc-100 text-zinc-400')
          }>
            {initial}
          </div>
        )}
      </div>
      <span className={
        'text-[13px] font-medium transition-colors duration-200 ' +
        (selected ? 'text-brand-700' : 'text-zinc-400')
      }>
        {name}
      </span>
    </button>
  )
}

// ── Split picker — visual bar showing who carries the cost ────────────────────
function SplitPicker({
  split,
  onSelect,
  nameA,
  nameB,
}: {
  split: Split
  onSelect: (s: Split) => void
  nameA: string
  nameB: string
}) {
  const initA  = nameA.trim()[0]?.toUpperCase() ?? '?'
  const initB  = nameB.trim()[0]?.toUpperCase() ?? '?'
  const spring = { type: 'spring' as const, stiffness: 380, damping: 28 }
  // scaleY: 1 = trägt 100%, 0.5 = trägt 50%, 0 = trägt nichts
  // → Gesamt-Lila-Fläche bleibt konstant (leftScale + rightScale = 1 immer)
  const leftScale  = split === 'A' ? 1 : split === 'both' ? 0.5 : 0
  const rightScale = split === 'B' ? 1 : split === 'both' ? 0.5 : 0

  const pct = (who: 'A' | 'B') =>
    split === 'both' ? '50 %' : split === who ? '100 %' : '—'

  return (
    <div className="flex items-center">
      {/* Person A */}
      <button
        type="button"
        onClick={() => onSelect('A')}
        className="flex flex-col items-center gap-1 transition-all duration-150 active:scale-95"
      >
        <div className={
          'flex h-12 w-12 items-center justify-center rounded-full text-[20px] font-bold transition-all duration-200 ' +
          (split === 'A' ? 'bg-brand-600 text-white ring-4 ring-brand-100' : 'bg-zinc-100 text-zinc-400')
        }>
          {initA}
        </div>
        <span className={
          'text-[11px] font-semibold tabular-nums transition-colors duration-200 ' +
          (split !== 'B' ? 'text-brand-600' : 'text-zinc-300')
        }>
          {pct('A')}
        </span>
      </button>

      {/* Linker Balken — dicker wenn A mehr trägt */}
      <div className="mx-2 h-[8px] flex-1 overflow-hidden rounded-full bg-zinc-100">
        <motion.div
          className="h-full w-full rounded-full bg-brand-500"
          animate={{ scaleY: leftScale }}
          transition={spring}
          style={{ originY: '50%' }}
        />
      </div>

      {/* 50/50-Kreis — etwas kleiner als A & B */}
      <button
        type="button"
        onClick={() => onSelect('both')}
        className="flex flex-col items-center transition-all duration-150 active:scale-95"
      >
        <div className={
          'flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200 ' +
          (split === 'both' ? 'bg-brand-600 text-white ring-2 ring-brand-100' : 'bg-zinc-100 text-zinc-400')
        }>
          <div className="flex flex-col items-center gap-[2px] text-[10px] font-bold leading-none">
            <span>50</span>
            <div className="h-px w-4 rounded-full bg-current opacity-50" />
            <span>50</span>
          </div>
        </div>
      </button>

      {/* Rechter Balken — dicker wenn B mehr trägt */}
      <div className="mx-2 h-[8px] flex-1 overflow-hidden rounded-full bg-zinc-100">
        <motion.div
          className="h-full w-full rounded-full bg-brand-500"
          animate={{ scaleY: rightScale }}
          transition={spring}
          style={{ originY: '50%' }}
        />
      </div>

      {/* Person B */}
      <button
        type="button"
        onClick={() => onSelect('B')}
        className="flex flex-col items-center gap-1 transition-all duration-150 active:scale-95"
      >
        <div className={
          'flex h-12 w-12 items-center justify-center rounded-full text-[20px] font-bold transition-all duration-200 ' +
          (split === 'B' ? 'bg-brand-600 text-white ring-4 ring-brand-100' : 'bg-zinc-100 text-zinc-400')
        }>
          {initB}
        </div>
        <span className={
          'text-[11px] font-semibold tabular-nums transition-colors duration-200 ' +
          (split !== 'A' ? 'text-brand-600' : 'text-zinc-300')
        }>
          {pct('B')}
        </span>
      </button>
    </div>
  )
}

// ── Date row ──────────────────────────────────────────────────────────────────
function DateRow({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const today    = todayISO()
  const label    = value === today ? 'Heute' : formatDate(value)

  return (
    <div>
      <button
        type="button"
        onClick={() => setTimeout(() => inputRef.current?.showPicker?.(), 60)}
        className="flex w-full items-center justify-between py-1 transition-opacity duration-100 active:opacity-60"
      >
        <span className="text-[13px] text-zinc-400">Datum</span>
        <span className="text-[13px] font-medium text-zinc-600">{label} ›</span>
      </button>
      <input ref={inputRef} type="date" value={value}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only" tabIndex={-1} />
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function EntrySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addExpense, addSettlement, expenses, settlements, nameA, nameB, myRole, profileA, profileB } = useApp()

  const myPerson: Person = myRole ?? 'A'

  const [type, setType]               = useState<'expense' | 'settlement'>('expense')
  const [amount, setAmount]           = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate]               = useState(todayISO())
  const [paidBy, setPaidBy]           = useState<Person>(myPerson)
  const [split, setSplit]             = useState<Split>('both')
  const [payAmount, setPayAmount]     = useState('')
  const [payFrom, setPayFrom]         = useState<Person>(myPerson)
  const [payDate, setPayDate]         = useState(todayISO())
  const [busy, setBusy]               = useState(false)

  const payTo: Person = payFrom === 'A' ? 'B' : 'A'
  const { net }       = computeBalance(expenses, settlements)

  const prefillPayment = () => {
    if (Math.abs(net) > 0.005) {
      setPayAmount(Math.abs(net).toFixed(2).replace('.', ','))
      setPayFrom(net > 0 ? 'B' : 'A')
    }
  }

  useEffect(() => {
    if (!open) {
      setAmount(''); setDescription(''); setDate(todayISO())
      setPaidBy(myPerson); setSplit('both')
      setPayAmount(''); setPayDate(todayISO()); setPayFrom(myPerson)
      setBusy(false); setType('expense')
    }
  }, [open, myPerson])

  useEffect(() => {
    if (open && type === 'settlement' && !payAmount) prefillPayment()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type])

  const submitExpense = async (e: FormEvent) => {
    e.preventDefault()
    const value = parseFloat(amount.replace(',', '.'))
    if (!description.trim() || !value || value <= 0) return
    setBusy(true)
    await addExpense({ amount: value, description: description.trim(), date, paid_by: paidBy, split })
    setBusy(false)
    onClose()
  }

  const submitPayment = async (e: FormEvent) => {
    e.preventDefault()
    const value = parseFloat(payAmount.replace(',', '.'))
    if (!value || value <= 0) return
    setBusy(true)
    await addSettlement({ amount: value, from_person: payFrom, to_person: payTo, date: payDate, note: null })
    setBusy(false)
    onClose()
  }

  const sectionLabel = 'mb-3 text-[11px] font-semibold uppercase tracking-[0.07em] text-zinc-400'
  const divider      = <div className="mx-5 h-px bg-zinc-100" />

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-[30] bg-black/35"
          />

          <motion.div
            initial={{ y: '110%' }}
            animate={{ y: 0 }}
            exit={{ y: '110%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.45 }}
            onDragEnd={(_, info) => { if (info.offset.y > 90 || info.velocity.y > 600) onClose() }}
            className="fixed inset-x-0 bottom-0 z-[40] mx-auto max-w-2xl overflow-y-auto rounded-t-3xl bg-white"
            style={{
              maxHeight: 'calc(100dvh - 56px)',
              paddingBottom: 'calc(env(safe-area-inset-bottom) + 64px)',
              boxShadow: '0 -10px 44px rgba(0,0,0,0.16), 0 -1px 0 rgba(0,0,0,0.05)',
            }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1.5 w-10 cursor-grab rounded-full bg-zinc-200 active:cursor-grabbing" />
            </div>

            {/* Type toggle — icons + animation */}
            <div className="mx-5 mt-3 flex rounded-2xl bg-zinc-100 p-1">
              <TypeTab
                label="Ausgabe"
                icon={<MoneyFlyIcon size={16} />}
                active={type === 'expense'}
                onClick={() => setType('expense')}
              />
              <TypeTab
                label="Zahlung"
                icon={<SwapIcon size={16} />}
                active={type === 'settlement'}
                onClick={() => { setType('settlement'); if (!payAmount) prefillPayment() }}
              />
            </div>

            {/*
              CSS Grid stacking: both forms occupy the same grid cell.
              Container height = taller form (Ausgabe). Sheet never resizes on tab switch.
              Inactive form: opacity 0 + pointer-events none (still in DOM, still sizing).
            */}
            <div className="grid">

              {/* ── Ausgabe ── */}
              <form
                onSubmit={submitExpense}
                className="col-start-1 row-start-1 flex flex-col transition-opacity duration-150"
                style={{ opacity: type === 'expense' ? 1 : 0, pointerEvents: type === 'expense' ? 'auto' : 'none' }}
              >
                <div className="px-5 pt-6 pb-4 text-center">
                  <div className="flex items-baseline justify-center gap-1.5">
                    <span className="text-[44px] font-light text-zinc-300">€</span>
                    <input
                      inputMode="decimal" value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0,00"
                      className="w-[240px] bg-transparent text-center text-[72px] font-bold tracking-tight text-zinc-900 placeholder:text-zinc-200 focus:outline-none"
                    />
                  </div>
                </div>

                {divider}

                <div className="px-5 py-4">
                  <input
                    value={description} onChange={(e) => setDescription(e.target.value)}
                    placeholder="Wofür?"
                    className="w-full bg-transparent text-center text-[20px] font-medium text-zinc-700 placeholder:text-zinc-300 focus:outline-none"
                  />
                </div>

                {divider}

                <div className="px-5 pt-4">
                  <p className={sectionLabel}>Bezahlt von</p>
                  <div className="flex justify-around">
                    <PersonAvatar name={nameA} avatarUrl={profileA?.avatar_url} selected={paidBy === 'A'} onClick={() => setPaidBy('A')} />
                    <PersonAvatar name={nameB} avatarUrl={profileB?.avatar_url} selected={paidBy === 'B'} onClick={() => setPaidBy('B')} />
                  </div>
                </div>

                <div className="mx-5 my-4 h-px bg-zinc-100" />

                <div className="px-5">
                  <p className={sectionLabel}>Wer trägt die Kosten?</p>
                  <SplitPicker split={split} onSelect={setSplit} nameA={nameA} nameB={nameB} />
                </div>

                <div className="mx-5 my-4 h-px bg-zinc-100" />

                <div className="px-5">
                  <DateRow value={date} onChange={setDate} />
                </div>

                <div className="mx-5 mt-auto pt-5 pb-1">
                  <button
                    type="submit"
                    disabled={busy || !amount.trim() || !description.trim()}
                    className="w-full rounded-2xl bg-brand-600 py-4 text-[16px] font-bold tracking-[-0.2px] text-white transition-all duration-150 hover:bg-brand-700 active:scale-[0.98] disabled:opacity-30"
                  >
                    {busy ? 'Speichern…' : 'Eintragen'}
                  </button>
                </div>
              </form>

              {/* ── Zahlung ── */}
              <form
                onSubmit={submitPayment}
                className="col-start-1 row-start-1 flex flex-col transition-opacity duration-150"
                style={{ opacity: type === 'settlement' ? 1 : 0, pointerEvents: type === 'settlement' ? 'auto' : 'none' }}
              >
                <div className="px-5 pt-6 pb-4 text-center">
                  <div className="flex items-baseline justify-center gap-1.5">
                    <span className="text-[44px] font-light text-zinc-300">€</span>
                    <input
                      inputMode="decimal" value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      placeholder="0,00"
                      className="w-[240px] bg-transparent text-center text-[72px] font-bold tracking-tight text-zinc-900 placeholder:text-zinc-200 focus:outline-none"
                    />
                  </div>
                </div>

                {divider}

                <div className="px-5 pt-4">
                  <p className={sectionLabel}>Wer zahlt wem?</p>
                  <div className="flex items-center">
                    <div className="flex flex-1 justify-center">
                      <PersonAvatar name={nameA} avatarUrl={profileA?.avatar_url} selected={payFrom === 'A'} onClick={() => setPayFrom('A')} />
                    </div>
                    <motion.svg
                      animate={{ scaleX: payFrom === 'A' ? 1 : -1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      width="36" height="16" viewBox="0 0 36 16" fill="none"
                      className="shrink-0 text-zinc-400"
                      style={{ originX: '50%' }}
                    >
                      <path d="M2 8h32M24 2l8 6-8 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </motion.svg>
                    <div className="flex flex-1 justify-center">
                      <PersonAvatar name={nameB} avatarUrl={profileB?.avatar_url} selected={payFrom === 'B'} onClick={() => setPayFrom('B')} />
                    </div>
                  </div>
                  <div className="mt-1 flex text-[11px] text-zinc-400">
                    <span className="flex-1 text-center font-medium">{payFrom === 'A' ? 'zahlt' : 'bekommt'}</span>
                    <span className="w-9" />
                    <span className="flex-1 text-center font-medium">{payFrom === 'B' ? 'zahlt' : 'bekommt'}</span>
                  </div>
                </div>

                <div className="mx-5 my-4 h-px bg-zinc-100" />

                <div className="px-5">
                  <DateRow value={payDate} onChange={setPayDate} />
                </div>

                <div className="mx-5 mt-auto pt-5 pb-1">
                  <button
                    type="submit"
                    disabled={busy || !payAmount.trim()}
                    className="w-full rounded-2xl bg-brand-600 py-4 text-[16px] font-bold tracking-[-0.2px] text-white transition-all duration-150 hover:bg-brand-700 active:scale-[0.98] disabled:opacity-30"
                  >
                    {busy ? 'Speichern…' : 'Zahlung vermerken'}
                  </button>
                </div>
              </form>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
