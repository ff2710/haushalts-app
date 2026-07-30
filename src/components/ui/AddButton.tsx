import { PlusIcon } from './Icon'

// Das Muster fuers Hinzufuegen — app-weit dasselbe.
//
// Vorher stand am Ende jeder Liste eine gestrichelte Karte ueber die volle
// Breite. Die hat optisch so viel Gewicht wie ein echter Eintrag, ohne einer
// zu sein, und in der Planung standen davon vier untereinander: der Blick
// findet die Liste nicht mehr, weil ueberall gleich grosse Kaesten stehen.
//
// Stattdessen ein kleiner, gefuellter Kreis. Klein genug, um der Liste nicht
// die Aufmerksamkeit zu nehmen, farbig genug, um sofort gefunden zu werden.

interface Props {
  onClick: () => void
  /** Was hier entsteht — wird vorgelesen und als Tooltip gezeigt. */
  label: string
  /** Zurueckhaltende Variante fuer verschachtelte Aktionen (Unterkategorie). */
  subtle?: boolean
}

export default function AddButton({ onClick, label, subtle = false }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={
        'flex shrink-0 items-center justify-center rounded-full transition-all duration-150 active:scale-90 ' +
        // Grau statt Anthrazit: das Plus soll gefunden werden, aber nicht mit
        // den echten Aktionsknoepfen der App um Aufmerksamkeit streiten.
        //
        // Die zurueckhaltende Variante steht direkt neben dem Chevron der
        // Zeile. Ohne eigene Flaeche saehe sie wie ein zweites Zeichen derselben
        // Zeile aus statt wie ein eigener Knopf.
        (subtle
          ? 'h-8 w-8 bg-black/[0.04] text-zinc-500 active:bg-black/[0.09]'
          : 'h-7 w-7 bg-zinc-200 text-zinc-600 active:bg-zinc-300')
      }
    >
      <PlusIcon size={subtle ? 16 : 15} strokeWidth={2.5} />
    </button>
  )
}

/**
 * Variante fuer Listen ohne eigene Ueberschrift, an die sich ein Plus haengen
 * liesse: sieht aus wie eine weitere Zeile der Liste und traegt deshalb den
 * Namen dessen, was entsteht.
 */
export function AddRow({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-2xl bg-white px-3.5 py-3 text-left shadow-card ring-1 ring-black/[0.05] transition-transform duration-150 active:scale-[0.99]"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-zinc-600">
        <PlusIcon size={15} strokeWidth={2.5} />
      </span>
      <span className="text-[14px] font-medium text-zinc-600">{label}</span>
    </button>
  )
}
