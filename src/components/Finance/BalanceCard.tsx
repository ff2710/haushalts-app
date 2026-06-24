import { motion } from 'framer-motion'
import { useApp } from '../../context/AppContext'
import { computeBalance, formatMoney } from '../../lib/utils'

type AvatarRole = 'debtor' | 'creditor' | 'neutral'

function Avatar({ name, avatarUrl, role }: { name: string; avatarUrl?: string | null; role: AvatarRole }) {
  const initial = name.trim()[0]?.toUpperCase() ?? '?'

  const circleCls =
    role === 'debtor'   ? 'ring-2 ring-red-400/50' :
    role === 'creditor' ? 'ring-2 ring-emerald-400/50' : ''

  const bgCls =
    role === 'debtor'   ? 'bg-red-500/25 text-red-200' :
    role === 'creditor' ? 'bg-emerald-500/25 text-emerald-200' :
                          'bg-white/[0.08] text-zinc-400'

  const nameCls =
    role === 'debtor'   ? 'text-red-300' :
    role === 'creditor' ? 'text-emerald-300' :
                          'text-zinc-500'

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`h-12 w-12 overflow-hidden rounded-full text-[18px] font-bold transition-all duration-300 ${circleCls}`}>
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} className="h-full w-full object-cover" draggable={false} />
        ) : (
          <div className={`flex h-full w-full items-center justify-center ${bgCls}`}>
            {initial}
          </div>
        )}
      </div>
      <span className={`text-[14px] font-semibold transition-colors duration-300 ${nameCls}`}>
        {name}
      </span>
    </div>
  )
}

export default function BalanceCard() {
  const { expenses, settlements, nameA, nameB, profileA, profileB } = useApp()
  const { net } = computeBalance(expenses, settlements)
  const owed = Math.abs(net)

  // net > 0 → B schuldet A (Pfeil zeigt links ←, scaleX -1)
  // net < 0 → A schuldet B (Pfeil zeigt rechts →, scaleX 1)
  const roleA: AvatarRole = net > 0 ? 'creditor' : net < 0 ? 'debtor' : 'neutral'
  const roleB: AvatarRole = net > 0 ? 'debtor'   : net < 0 ? 'creditor' : 'neutral'
  const arrowDir = net > 0 ? -1 : 1   // -1 = zeigt nach links
  const debtor   = net > 0 ? nameB : nameA
  const creditor = net > 0 ? nameA : nameB

  return (
    <div className="overflow-hidden rounded-3xl bg-zinc-900 p-5 shadow-card-lg">
      <p className="mb-5 text-[12px] font-medium uppercase tracking-[0.06em] text-zinc-500">
        Aktueller Saldo
      </p>

      <div className="flex items-center justify-between">
        {/* Person A — immer links */}
        <Avatar name={nameA} avatarUrl={profileA?.avatar_url} role={roleA} />

        {/* Mitte */}
        {net === 0 ? (
          <div className="flex flex-1 flex-col items-center gap-1.5 px-3">
            <div className="flex w-full items-center gap-1.5">
              <div className="h-px flex-1 bg-emerald-500/40" />
              <span className="text-[18px] text-emerald-400">✓</span>
              <div className="h-px flex-1 bg-emerald-500/40" />
            </div>
            <span className="text-[13px] font-medium text-emerald-500">Ausgeglichen</span>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center gap-2 px-3">
            <span className="text-[22px] font-bold tracking-[-0.5px] text-white tabular-nums">
              {formatMoney(owed)}
            </span>
            <motion.div
              className="flex w-full items-center"
              animate={{ scaleX: arrowDir }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              style={{ originX: '50%' }}
            >
              <div
                className="h-[2px] flex-1"
                style={{ background: 'linear-gradient(to right, rgba(255,255,255,0.06), rgba(255,255,255,0.35))' }}
              />
              <svg width="10" height="16" viewBox="0 0 10 16" className="shrink-0 text-white/40">
                <path d="M0 1L9 8L0 15Z" fill="currentColor" />
              </svg>
            </motion.div>
            <span className="text-center text-[13px] font-medium leading-snug text-zinc-300">
              {debtor}{' schuldet '}{creditor}{' ' + formatMoney(owed)}
            </span>
          </div>
        )}

        {/* Person B — immer rechts */}
        <Avatar name={nameB} avatarUrl={profileB?.avatar_url} role={roleB} />
      </div>

      {/*
        TODO (Roadmap): Zahlungsstatistiken
        paidA / paidB sind über computeBalance verfügbar und könnten hier als
        Balken-/Kreisdiagramm visualisiert oder als monatliche Übersicht
        aufbereitet werden (z. B. "Wer hat diesen Monat mehr ausgegeben?").
      */}
    </div>
  )
}
