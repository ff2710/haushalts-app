// Runder Avatar: Bild (object-cover) wenn vorhanden, sonst Anfangsbuchstabe.
interface AvatarCircleProps {
  name:       string
  avatarUrl?: string | null
  size?:      number   // px, default 48
  className?: string
}

export default function AvatarCircle({ name, avatarUrl, size = 48, className = '' }: AvatarCircleProps) {
  const initial = name.trim()[0]?.toUpperCase() ?? '?'
  const style   = { width: size, height: size, fontSize: size * 0.38 }

  return (
    <div
      className={`shrink-0 overflow-hidden rounded-full ${className}`}
      style={style}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name}
          className="h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center font-bold">
          {initial}
        </div>
      )}
    </div>
  )
}
