interface AvatarCircleProps {
  name:        string
  avatarUrl?:  string | null
  size?:       number
  bgClassName?: string
  textClassName?: string
  className?:  string
}

export default function AvatarCircle({
  name,
  avatarUrl,
  size = 48,
  bgClassName   = 'bg-brand-600/10',
  textClassName = 'text-brand-600',
  className     = '',
}: AvatarCircleProps) {
  const initial   = name.trim()[0]?.toUpperCase() ?? '?'
  const fontSize  = Math.round(size * 0.38)

  return (
    <div
      className={`shrink-0 overflow-hidden rounded-full ${bgClassName} ${className}`}
      style={{ width: size, height: size }}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name}
          className="h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <div
          className={`flex h-full w-full items-center justify-center font-bold ${textClassName}`}
          style={{ fontSize }}
        >
          {initial}
        </div>
      )}
    </div>
  )
}
