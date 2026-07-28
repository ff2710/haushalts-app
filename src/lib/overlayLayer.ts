// Zaehlt Overlays, die ueber dem Einstellungen-Dialog liegen: Sheets
// (`elevated`) und das "Haushalt zuruecksetzen"-Modal.
//
// Hintergrund: Nur der Dialog selbst hoert global auf Escape. Ohne diesen
// Zaehler wuerde Escape den kompletten Dialog schliessen, obwohl darueber noch
// ein Sheet offen ist — der Nutzer erwartet aber, dass zuerst nur die oberste
// Ebene verschwindet. Ein simpler Zaehler genuegt, weil diese Overlays
// ausschliesslich AUS dem Dialog heraus geoeffnet werden, also immer darueber
// liegen.

let count = 0

export const pushOverlay = (): void => {
  count += 1
}

export const popOverlay = (): void => {
  count = Math.max(0, count - 1)
}

export const hasOverlayAbove = (): boolean => count > 0
