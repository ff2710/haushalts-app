import { motion } from 'framer-motion'
import { useApp } from '../../context/AppContext'
import AvatarCircle from '../ui/AvatarCircle'
import { computeBalance, formatMoney } from '../../lib/utils'
import type { AvatarRole } from '../../types'

function RoleAvatar({ name, avatarUrl, role }: { name: string; avatarUrl?: string | null; role: AvatarRole }) {
  const circleCls =
    role === 'debtor'   ? 'ring-2 ring-red-400/50' :
    role === 'creditor' ? 'ring-2 ring-emerald-400/50' : ''

  const bgClassName =
    role === 'debtor'   ? 'bg-red-500/25' :
    role === 'creditor' ? 'bg-emerald-500/25' :
                          'bg-white/[0.08]'

  const textClassName =
    role === 'debtor'   ? 'text-red-200' :
    role === 'creditor' ? 'text-emerald-200' :
                          'text-zinc-400'

  const nameCls =
    role === 'debtor'   ? 'text-red-300' :
    role === 'creditor' ? 'text-emerald-300' :
                          'text-zinc-500'

  return (
    <div className="flex flex-col items-center gap-2">
      <AvatarCircle
        name={name}
        avatarUrl={avatarUrl}
        size={48}
        bgClassName={`${bgClassName} transition-all duration-300`}
        textClassName={`${textClassName} text-[18px] font-bold`}
        className={`transition-all duration-300 ${circleCls}`}
      />
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

  const roleA: AvatarRole = net > 0 ? 'creditor' : net < 0 ? 'debtor' : 'neutral'
  const roleB: AvatarRole = net > 0 ? 'debtor'   : net < 0 ? 'creditor' : 'neutral'
  const arrowDir = net > 0 ? -1 : 1
  const debtor   = net > 0 ? nameB : nameA
  const creditor = net > 0 ? nameA : nameB

  return (
    <div className="overflow-hidden rounded-3xl bg-zinc-900 p-5 shadow-card-lg">
      <p className="mb-5 text-[12px] font-medium uppercase tracking-[0.06em] text-zinc-500">
        Aktueller Saldo
      </p>

      <div className="flex items-center justify-between">
        <RoleAvatar name={nameA} avatarUrl={profileA?.avatar_url} role={roleA} />

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

        <RoleAvatar name={nameB} avatarUrl={profileB?.avatar_url} role={roleB} />
      </div>
    </div>
  )
}
