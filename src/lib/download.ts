// Datei im Browser herunterladen.
//
// Bewusst getrennt von lib/backup.ts: dort steht reine Logik, die sich ohne
// Browser pruefen laesst. Hier ist das bisschen DOM, das es dafuer braucht.

/** Laedt ein Objekt als eingerueckte JSON-Datei herunter. */
export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Erst freigeben, wenn der Download angestossen ist — sonst bricht er in
  // manchen Browsern ab, bevor er begonnen hat.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
