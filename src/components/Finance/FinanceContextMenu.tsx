import { motion } from 'framer-motion'
import { useApp } from '../../context/AppContext'
import { formatDate, formatMoney } from '../../lib/utils'
import { MoneyFlyIcon, PencilIcon, SwapIcon, TrashIcon } from '../ui/Icon'
import type { HistoryRow } from './History'

const MENU_W = 220

export default function FinanceContextMenu({
  row,
  rect,
  onClose,
  onEdit,
  onDelete,
}: {
  row: HistoryRow
  rect: DOMRect
  onClose: () => void
  onEdit?: () => void
  onDelete: () => void
}) {
  const { nameA, nameB } = useApp()
  const nameOf = (p: 'A' | 'B') => (p === 'A' ? nameA : nameB)

  const placeAbove = rect.bottom + 140 > window.innerHeight && rect.top > 140
  const itemCx     = rect.left + rect.width / 2
  const left       = Math.max(12, Math.min(itemCx - MENU_W / 2, window.innerWidth - MENU_W - 12))

  const rowCls = 'flex w-full items-center gap-3 px-4 py-[11px] text-left select-none transition-colors duration-75 active:bg-zinc-100/70'
  const sep    = <div className="h-px bg-zinc-100" />

  return (
    <>
      {/* Scrim */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
        data-no-swipe
        className="fixed inset-0 z-[30] touch-none bg-black/40 backdrop-blur-[2px]"
      />

      {/* Schwebende Eintrag-Kopie */}
      {row.kind === 'expense' ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          data-no-swipe
          className="fixed z-[35] flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-card-lg ring-1 ring-black/[0.05]"
          style={{ top: rect.top, left: rect.left, width: rect.width }}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <MoneyFlyIcon size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-medium text-zinc-900">{row.data.description}</p>
            <p className="mt-0.5 text-[12px] text-zinc-400">{formatDate(row.data.date)}</p>
          </div>
          <p className="shrink-0 text-[14px] font-semibold text-zinc-900">
            {formatMoney(Number(row.data.amount))}
          </p>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          data-no-swipe
          className="fixed z-[35] flex items-center gap-3 rounded-2xl bg-emerald-50 p-3.5 shadow-card-lg ring-1 ring-emerald-100/80"
          style={{ top: rect.top, left: rect.left, width: rect.width }}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
            <SwapIcon size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-medium text-emerald-900">
              {nameOf(row.data.from_person)} → {nameOf(row.data.to_person)}
            </p>
            <p className="mt-0.5 text-[12px] text-emerald-600/70">{formatDate(row.data.date)}</p>
          </div>
          <p className="shrink-0 text-[14px] font-semibold text-emerald-700">
            {formatMoney(Number(row.data.amount))}
          </p>
        </motion.div>
      )}

      {/* Menükarte */}
      <motion.div
        initial={{ opacity: 0, scale: 0.88 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.94 }}
        transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
        data-no-swipe
        className="fixed z-[40] overflow-hidden rounded-[16px] bg-white"
        style={{
          width: MENU_W,
          left,
          boxShadow: '0 8px 48px rgba(0,0,0,0.22), 0 0 0 0.5px rgba(0,0,0,0.06)',
          transformOrigin: placeAbove ? 'bottom center' : 'top center',
          ...(placeAbove
            ? { bottom: window.innerHeight - rect.top + 10 }
            : { top: rect.bottom + 10 }),
        }}
      >
        {row.kind === 'expense' && onEdit && (
          <>
            <button type="button" onClick={() => { onEdit(); onClose() }} className={rowCls}>
              <PencilIcon size={16} className="shrink-0 text-zinc-500" />
              <span className="text-[15px] font-medium text-zinc-900">Bearbeiten</span>
            </button>
            {sep}
          </>
        )}
        <button type="button" onClick={() => { onDelete(); onClose() }} className={rowCls}>
          <TrashIcon size={16} className="shrink-0 text-red-400" />
          <span className="text-[15px] font-medium text-red-500">Eintrag löschen</span>
        </button>
      </motion.div>
    </>
  )
}
