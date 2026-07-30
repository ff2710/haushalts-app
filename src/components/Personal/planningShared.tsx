import type { ReactNode } from 'react'
import AddButton from '../ui/AddButton'

// Gemeinsame Bausteine der Planungs-Unteransichten. An einer Stelle, damit
// sechs Ansichten nicht sechsmal leicht verschieden aussehen.

export const card   = 'overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-black/[0.05]'
export const rowCls = 'flex w-full items-center justify-between gap-3 px-4 py-[13px] text-left'
export const sLabel = 'text-[11px] font-semibold uppercase tracking-[0.07em] text-zinc-400'

export const sep = <div className="mx-4 h-px bg-zinc-100" />

/** Abschnittskopf: Titel links, das Plus fuer diesen Abschnitt rechts. */
export function SectionHead({
  title,
  add,
}: {
  title: string
  add?: { label: string; onClick: () => void }
}) {
  return (
    <div className="mb-1.5 flex items-center justify-between gap-3 px-1">
      <p className={sLabel}>{title}</p>
      {add && <AddButton onClick={add.onClick} label={add.label} />}
    </div>
  )
}

export function EmptyRow({ children }: { children: ReactNode }) {
  return <div className="px-4 py-[13px] text-[14px] text-zinc-400">{children}</div>
}

/** Erklaersatz unter einer Ansicht — sagt, wofuer die Zahlen darueber gut sind. */
export function Hint({ children }: { children: ReactNode }) {
  return <p className="px-1 text-[12px] leading-snug text-zinc-400">{children}</p>
}

/** Waagerechter Fortschrittsbalken. `ratio` wird auf 0–1 begrenzt. */
export function Bar({ ratio, className }: { ratio: number; className: string }) {
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
      <span
        className={'block h-full rounded-full ' + className}
        style={{ width: `${Math.min(100, Math.max(0, ratio * 100))}%` }}
      />
    </span>
  )
}
