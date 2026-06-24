export default function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-zinc-400">
      <div className="h-6 w-6 animate-spin rounded-full border-[2.5px] border-zinc-200 border-t-brand-600" />
      {label && (
        <p className="text-[13px] font-medium text-zinc-400">{label}</p>
      )}
    </div>
  )
}
