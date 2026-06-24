export function SkeletonBlock({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-2xl bg-zinc-100 ${className}`} />
  )
}
