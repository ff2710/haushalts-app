import { useEffect, useMemo, useState, type FormEvent } from 'react'
import BottomSheet from '../ui/BottomSheet'
import { TrashIcon } from '../ui/Icon'
import { usePersonal } from '../../context/PersonalContext'
import { PF_CATEGORY_COLORS } from '../../constants'
import { categoryColorMap } from '../../lib/categoryColors'
import type { PfCategory, PfCategoryType } from '../../types'

interface Props {
  open: boolean
  onClose: () => void
  /** null = neue Kategorie anlegen. */
  category: PfCategory | null
  /** Vorauswahl beim Anlegen (der Abschnitt, aus dem heraus geklickt wurde). */
  defaultType?: PfCategoryType
  /** Vorauswahl beim Anlegen: direkt als Unterkategorie hierunter. */
  defaultParentId?: string | null
}

/**
 * Kategorien anlegen und bearbeiten — inklusive Unterkategorien (eine Ebene
 * tief, mehr laesst die Datenbank nicht zu).
 *
 * Die Oberflaeche bietet erst gar nicht an, was die DB-Regeln verbieten:
 * Unterkategorien erscheinen nicht als moegliches Elternteil, eine Kategorie
 * mit Kindern kann selbst keins bekommen, und der Typ ist gesperrt, solange
 * Kinder daran haengen. Die Fehlermeldungen aus der Datenbank sind trotzdem
 * das Sicherheitsnetz, falls zwei Geraete gleichzeitig arbeiten.
 */
export default function CategorySheet({
  open,
  onClose,
  category,
  defaultType = 'expense',
  defaultParentId = null,
}: Props) {
  const { categories, addCategory, updateCategory, deleteCategory } = usePersonal()

  const [name, setName]     = useState('')
  const [type, setType]     = useState<PfCategoryType>(defaultType)
  const [color, setColor]   = useState<string>(PF_CATEGORY_COLORS[0])
  const [parentId, setParent] = useState<string | null>(null)
  const [busy, setBusy]     = useState(false)

  useEffect(() => {
    if (!open) return
    setName(category?.name ?? '')
    setType(category?.type ?? defaultType)
    setColor(category?.color ?? PF_CATEGORY_COLORS[0])
    setParent(category ? category.parent_id : defaultParentId)
    setBusy(false)
  }, [open, category, defaultType, defaultParentId])

  const children = useMemo(
    () => (category ? categories.filter((c) => c.parent_id === category.id) : []),
    [categories, category],
  )
  const hasChildren = children.length > 0

  // Moegliche Elternteile: nur Hauptkategorien desselben Typs, und niemals
  // die Kategorie selbst.
  const parentOptions = useMemo(
    () =>
      categories.filter(
        (c) => c.parent_id === null && c.type === type && c.id !== category?.id,
      ),
    [categories, type, category],
  )

  const parent = parentId ? (categories.find((c) => c.id === parentId) ?? null) : null

  // Vorschau der abgeleiteten Farbe: dieselbe Funktion, die auch Sankey und
  // Donut benutzen — was hier zu sehen ist, steht spaeter so im Diagramm.
  const derivedColor = useMemo(() => {
    if (!parent) return null
    const siblings = categories.filter((c) => c.parent_id === parent.id && c.id !== category?.id)
    const provisional = { id: category?.id ?? '__neu', name: name.trim() || 'Neu', color, parent_id: parent.id }
    return categoryColorMap([parent, ...siblings, provisional]).get(provisional.id) ?? parent.color
  }, [parent, categories, category, name, color])

  const trimmed = name.trim()

  // Doppelte Namen faengt der Unique-Index ohnehin ab; hier vorab gemeldet,
  // damit man es sieht, bevor man auf Speichern drueckt.
  const duplicate = categories.some(
    (c) =>
      c.id !== category?.id &&
      c.type === type &&
      c.parent_id === parentId &&
      c.name.toLowerCase() === trimmed.toLowerCase(),
  )

  const valid = trimmed.length > 0 && !duplicate

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    const payload = {
      name: trimmed,
      type,
      // Unterkategorien tragen die abgeleitete Farbe des Elternteils. Der Wert
      // wird trotzdem gespeichert, damit eine spaeter hochgestufte Kategorie
      // (Elternteil geloescht) nicht farblos dasteht.
      color: parent ? (derivedColor ?? parent.color) : color,
      parent_id: parentId,
      monthly_budget: category?.monthly_budget ?? null,
      warn_ratio: category?.warn_ratio ?? 0.8,
    }
    const ok = category
      ? await updateCategory(category.id, payload)
      : await addCategory(payload)
    setBusy(false)
    if (ok) onClose()
  }

  const remove = async () => {
    if (!category || busy) return
    setBusy(true)
    const ok = await deleteCategory(category.id)
    setBusy(false)
    if (ok) onClose()
  }

  const field =
    'mt-1.5 w-full rounded-2xl bg-zinc-100 px-4 py-3 text-[15px] text-zinc-900 outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-brand-400'

  const chip = (on: boolean, disabled = false) =>
    'rounded-xl px-3 py-2 text-[13px] font-medium transition-colors duration-150 ' +
    (disabled
      ? 'bg-zinc-50 text-zinc-300'
      : on
        ? 'bg-brand-600 text-white'
        : 'bg-zinc-100 text-zinc-600')

  return (
    <BottomSheet open={open} onClose={onClose}>
      <form onSubmit={submit} className="px-5 pt-2">
        <h2 className="text-[17px] font-semibold tracking-[-0.3px] text-zinc-900">
          {category
            ? category.parent_id
              ? 'Unterkategorie bearbeiten'
              : 'Kategorie bearbeiten'
            : parentId
              ? 'Neue Unterkategorie'
              : 'Neue Kategorie'}
        </h2>

        <label className="mt-4 block text-[13px] font-medium text-zinc-500">Name</label>
        <input
          autoFocus={!category}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="z. B. Lebensmittel"
          className={field}
        />
        {duplicate && (
          <p className="mt-1.5 text-[12px] text-red-500">
            {parent
              ? `Unter „${parent.name}" gibt es diesen Namen schon.`
              : 'Diesen Namen gibt es als Hauptkategorie schon.'}
          </p>
        )}

        {/* ── Typ ──────────────────────────────────────────────────────────── */}
        <label className="mt-4 block text-[13px] font-medium text-zinc-500">Art</label>
        <div className="mt-1.5 flex gap-2">
          {(['expense', 'income'] as PfCategoryType[]).map((t) => (
            <button
              key={t}
              type="button"
              disabled={hasChildren}
              onClick={() => {
                setType(t)
                // Ein Elternteil des anderen Typs waere nicht erlaubt.
                if (parent && parent.type !== t) setParent(null)
              }}
              className={chip(type === t, hasChildren && type !== t)}
            >
              {t === 'expense' ? 'Ausgabe' : 'Einnahme'}
            </button>
          ))}
        </div>
        {hasChildren && (
          <p className="mt-1.5 text-[12px] text-zinc-400">
            Die Art lässt sich nicht ändern, solange {children.length}{' '}
            {children.length === 1 ? 'Unterkategorie' : 'Unterkategorien'} daran hängen.
          </p>
        )}

        {/* ── Einordnung ───────────────────────────────────────────────────── */}
        <label className="mt-4 block text-[13px] font-medium text-zinc-500">Gehört zu</label>
        {hasChildren ? (
          <p className="mt-1.5 rounded-2xl bg-zinc-50 px-4 py-3 text-[13px] leading-snug text-zinc-500">
            Diese Kategorie hat selbst Unterkategorien und bleibt deshalb eine
            Hauptkategorie — mehr als zwei Ebenen gibt es nicht.
          </p>
        ) : (
          <div className="mt-1.5 flex flex-wrap gap-2">
            <button type="button" onClick={() => setParent(null)} className={chip(parentId === null)}>
              Hauptkategorie
            </button>
            {parentOptions.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setParent(c.id)}
                className={chip(parentId === c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        {/* ── Farbe ────────────────────────────────────────────────────────── */}
        <label className="mt-4 block text-[13px] font-medium text-zinc-500">Farbe</label>
        {parent ? (
          <div className="mt-1.5 flex items-center gap-3 rounded-2xl bg-zinc-50 px-4 py-3">
            <span
              className="h-6 w-6 shrink-0 rounded-full ring-1 ring-black/10"
              style={{ backgroundColor: derivedColor ?? parent.color }}
            />
            <span className="text-[13px] leading-snug text-zinc-500">
              Wird aus „{parent.name}" abgeleitet — so bleibt im Diagramm sichtbar,
              was zusammengehört.
            </span>
          </div>
        ) : (
          <div className="mt-1.5 flex flex-wrap gap-2.5">
            {PF_CATEGORY_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Farbe ${c}`}
                onClick={() => setColor(c)}
                style={{ backgroundColor: c }}
                className={
                  'h-8 w-8 rounded-full transition-transform duration-150 active:scale-90 ' +
                  (color === c ? 'ring-2 ring-brand-600 ring-offset-2' : 'ring-1 ring-black/10')
                }
              />
            ))}
          </div>
        )}

        <button
          type="submit"
          disabled={!valid || busy}
          className="mt-5 w-full rounded-2xl bg-brand-600 py-3.5 text-[15px] font-semibold text-white transition-opacity duration-150 active:opacity-80 disabled:opacity-40"
        >
          {category ? 'Speichern' : 'Anlegen'}
        </button>

        {category && (
          <>
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-[15px] font-medium text-red-500 transition-colors duration-150 active:bg-red-50 disabled:opacity-40"
            >
              <TrashIcon size={16} />
              Löschen
            </button>
            <p className="mt-1 text-center text-[12px] leading-snug text-zinc-400">
              {hasChildren
                ? 'Die Unterkategorien bleiben erhalten und werden wieder zu Hauptkategorien.'
                : 'Bereits gebuchte Umsätze bleiben erhalten, sie verlieren nur ihre Kategorie.'}
            </p>
          </>
        )}
      </form>
    </BottomSheet>
  )
}
