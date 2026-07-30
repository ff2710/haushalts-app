import { useState } from 'react'
import { usePersonal } from '../../context/PersonalContext'
import { formatMoney } from '../../lib/utils'
import { ChevronRightIcon } from '../ui/Icon'
import { Bar, EmptyRow, Hint, SectionHead, card, rowCls, sep } from './planningShared'
import PotSheet from './PotSheet'
import type { PfPot } from '../../types'

// Ruecklagen mit Ziel. Die Reihenfolge entscheidet, wer zuerst gefuellt wird,
// wenn das Geld nicht fuer alle reicht — deshalb steht sie sichtbar an jeder
// Zeile und nicht in einem Untermenue.

export default function PlanningPots() {
  const { pots, accounts } = usePersonal()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<PfPot | null>(null)

  const show = (pot: PfPot | null) => {
    setEditing(pot)
    setOpen(true)
  }

  const accountName = (id: string | null) =>
    id ? (accounts.find((a) => a.id === id)?.name ?? null) : null

  const gesamt = pots.filter((p) => p.active).reduce((s, p) => s + Number(p.current_amount), 0)
  const ziel = pots
    .filter((p) => p.active && p.target_amount != null)
    .reduce((s, p) => s + Number(p.target_amount), 0)

  return (
    <div className="space-y-6">
      <section>
        <SectionHead title="Töpfe" add={{ label: 'Topf hinzufügen', onClick: () => show(null) }} />
        <div className={card}>
          {pots.length === 0 ? (
            <EmptyRow>Noch keine Töpfe — z. B. Notgroschen, Urlaub, Jahresabos</EmptyRow>
          ) : (
            pots.map((p, i) => {
              const current = Number(p.current_amount)
              const target = p.target_amount == null ? null : Number(p.target_amount)
              const full = target !== null && current >= target
              return (
                <div key={p.id}>
                  {i > 0 && sep}
                  <button
                    onClick={() => show(p)}
                    className={`${rowCls} transition-colors duration-100 active:bg-zinc-50`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span
                          className={
                            'truncate text-[15px] font-medium ' +
                            (p.active ? 'text-zinc-900' : 'text-zinc-400')
                          }
                        >
                          {p.name}
                          {!p.active && ' · pausiert'}
                        </span>
                        <span className="shrink-0 text-[15px] font-semibold tabular-nums text-zinc-900">
                          {formatMoney(current)}
                        </span>
                      </span>

                      {target !== null ? (
                        <>
                          <span className="mt-1.5 block">
                            <Bar
                              ratio={target > 0 ? current / target : 0}
                              className={full ? 'bg-emerald-500' : 'bg-teal-500'}
                            />
                          </span>
                          <span className="mt-1 block text-[12px] text-zinc-400">
                            {full ? (
                              <span className="text-emerald-600">Ziel erreicht</span>
                            ) : (
                              <>noch {formatMoney(target - current)} bis {formatMoney(target)}</>
                            )}
                            {p.monthly_cap != null && ` · höchstens ${formatMoney(Number(p.monthly_cap))}/Monat`}
                            {accountName(p.account_id) && ` · ${accountName(p.account_id)}`}
                          </span>
                        </>
                      ) : (
                        <span className="mt-1 block text-[12px] text-zinc-400">
                          ohne Ziel — nimmt auf, was übrig bleibt
                          {accountName(p.account_id) && ` · ${accountName(p.account_id)}`}
                        </span>
                      )}
                    </span>
                    <ChevronRightIcon size={14} strokeWidth={2.5} className="shrink-0 text-zinc-300" />
                  </button>
                </div>
              )
            })
          )}
        </div>
      </section>

      {pots.length > 0 && (
        <section>
          <div className={`${card} p-4`}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[14px] text-zinc-500">In allen Töpfen</span>
              <span className="text-[17px] font-semibold tabular-nums text-zinc-900">
                {formatMoney(gesamt)}
              </span>
            </div>
            {ziel > 0 && (
              <p className="mt-1 text-[12px] text-zinc-400">
                von {formatMoney(ziel)} angestrebt
              </p>
            )}
          </div>
        </section>
      )}

      <Hint>
        Der Stand wird eingetragen, nicht aus Buchungen gerechnet — ein Topf auf dem
        Tagesgeldkonto hat keine eigene Historie. Die Kaskade zeigt nur, was nach Plan
        hineinfließen würde; eingetragen wird es, wenn es wirklich passiert ist.
      </Hint>

      <PotSheet open={open} onClose={() => setOpen(false)} pot={editing} />
    </div>
  )
}
