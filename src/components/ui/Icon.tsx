// Cleane, dezente Line-Icons (SF-Symbols-/Lucide-Stil) – currentColor.
import type { ReactNode } from 'react'

export interface IconProps {
  size?:        number
  strokeWidth?: number
  className?:   string
}

function IconBase({
  size = 24,
  strokeWidth = 1.75,
  className,
  children,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  )
}

export function MoneyFlyIcon(p: IconProps) {
  return (
    <IconBase {...p}>
      {/* Schein-Rahmen */}
      <rect x="1.5" y="5" width="21" height="14" rx="2" />
      {/* Ecken-Ornamente */}
      <path d="M3,8 A3,3 0 0 1 6,5.5" />
      <path d="M21,8 A3,3 0 0 0 18,5.5" />
      <path d="M3,16 A3,3 0 0 0 6,18.5" />
      <path d="M21,16 A3,3 0 0 1 18,18.5" />
      {/* €-Zeichen */}
      <path d="M16.5,7.8 A5,5 0 1 0 16.5,16.2" />
      <line x1="5" y1="10.5" x2="13" y2="10.5" />
      <line x1="5" y1="13.5" x2="13" y2="13.5" />
    </IconBase>
  )
}

export function BasketIcon(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M6 8h12l-1.2 10.2A2 2 0 0 1 14.8 20H9.2a2 2 0 0 1-2-1.8L6 8Z" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
      <path d="M9.5 11.5v5M14.5 11.5v5" />
    </IconBase>
  )
}

export function EuroIcon(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M16.5 7.8A5 5 0 1 0 16.5 16.2" />
      <path d="M5 10.5h8M5 13.5h8" />
    </IconBase>
  )
}

export function GearIcon(p: IconProps) {
  return (
    <IconBase {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </IconBase>
  )
}

export function HouseIcon(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M4 10.5 12 4l8 6.5" />
      <path d="M6 9.5V19a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9.5" />
    </IconBase>
  )
}

export function HeartIcon(p: IconProps) {
  return (
    <svg
      width={p.size ?? 24}
      height={p.size ?? 24}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={p.className}
    >
      <path d="M12 20s-6.5-4.35-9-8.27C1.3 8.9 2.6 5.5 5.8 5.5c1.9 0 3.2 1.1 4.2 2.5 1-1.4 2.3-2.5 4.2-2.5 3.2 0 4.5 3.4 2.8 6.23C18.5 15.65 12 20 12 20Z" />
    </svg>
  )
}

export function SwapIcon(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M7 8h11M7 8l3-3M7 8l3 3" />
      <path d="M17 16H6m11 0-3-3m3 3-3 3" />
    </IconBase>
  )
}

export function PlusIcon(p: IconProps) {
  return (
    <IconBase strokeWidth={2.25} {...p}>
      <path d="M12 5v14M5 12h14" />
    </IconBase>
  )
}

export function PencilIcon(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M16.4 4.6a2 2 0 0 1 2.83 2.83L8 18.66l-3.5 1 1-3.5L16.4 4.6Z" />
      <path d="M14.5 6.5l3 3" />
    </IconBase>
  )
}

export function TrashIcon(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M4 7h16" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
      <path d="M6.5 7l.8 11a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9L17.5 7" />
      <path d="M10 11v5.5M14 11v5.5" />
    </IconBase>
  )
}

export function MinusCircleIcon(p: IconProps) {
  return (
    <IconBase {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 12h7" />
    </IconBase>
  )
}

export function ChevronRightIcon(p: IconProps) {
  return (
    <IconBase strokeWidth={2.25} {...p}>
      <polyline points="9 6 15 12 9 18" />
    </IconBase>
  )
}

export function StoreIcon(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </IconBase>
  )
}

export function TagIcon(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </IconBase>
  )
}

export function CameraIcon(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </IconBase>
  )
}

export function GripIcon(p: IconProps) {
  return (
    <svg
      width={p.size ?? 10}
      height={p.size ?? 16}
      viewBox="0 0 10 16"
      fill="currentColor"
      className={p.className}
    >
      <circle cx="3" cy="2.5"  r="1.4" />
      <circle cx="7" cy="2.5"  r="1.4" />
      <circle cx="3" cy="8"    r="1.4" />
      <circle cx="7" cy="8"    r="1.4" />
      <circle cx="3" cy="13.5" r="1.4" />
      <circle cx="7" cy="13.5" r="1.4" />
    </svg>
  )
}

export function CalendarIcon(p: IconProps) {
  return (
    <IconBase {...p}>
      <rect x="3" y="4" width="18" height="17" rx="2.5" />
      <path d="M3 9.5h18" />
      <path d="M8 2v4M16 2v4" />
    </IconBase>
  )
}

export function NameSortIcon(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M3 19L8.5 5l5.5 14" />
      <path d="M5.5 13.5h6" />
      <path d="M19 8v11" />
      <polyline points="16.5,16 19,19 21.5,16" />
    </IconBase>
  )
}

export function GroupingIcon(p: IconProps) {
  return (
    <IconBase {...p}>
      <line x1="3" y1="4.5" x2="21" y2="4.5" />
      <line x1="7" y1="9.5" x2="21" y2="9.5" />
      <line x1="7" y1="13.5" x2="16" y2="13.5" />
      <line x1="3" y1="18" x2="21" y2="18" />
      <line x1="7" y1="22" x2="20" y2="22" />
    </IconBase>
  )
}

export function SortingIcon(p: IconProps) {
  return (
    <IconBase {...p}>
      <line x1="8" y1="19" x2="8" y2="5" />
      <polyline points="5,9 8,5 11,9" />
      <line x1="16" y1="5" x2="16" y2="19" />
      <polyline points="13,15 16,19 19,15" />
    </IconBase>
  )
}
