import { useEffect, useMemo, useState, type FormEvent } from 'react'
import BottomSheet from '../ui/BottomSheet'
import { TrashIcon } from '../ui/Icon'
import { usePersonal } from '../../context/PersonalContext'
import { PF_CATEGORY_COLORS } from '../../constants'
import { categoryColorMap } from '../../lib/categoryColors'
import type { PfCategory, PfCategoryType, PfPlanningBucket } from '../../types'

const BUCKETS: [PfPlanningBucket, string][] = [
  ['fix', 'Fixkosten'],
  ['freizeit', 'Freizeit'],
  ['sparen', 'Sparen'],
]

interface Props {
  open: boolean
  onClose: () => void
  /** null = neu anlegen. */
  category: PfCategory | null
  /** Bindend beim Anlegen — kommt aus dem Abschnitt, aus dem heraus geklickt
   *  wurde. Beim Bearbeiten steht die Art ohnehin schon fest. */
  type: PfCategoryType
  /** Bindend beim Anlegen: null = Hauptkategorie, sonst die Elternkategorie. */
  parentId: string | null
}

/**
 * Kategorien anlegen und bearbeiten.
 *
 * Beim Anlegen gibt es bewusst KEINE Auswahl fuer Art und Einordnung: wer auf
 * „+ Ausgaben-Kategorie" tippt, will eine Ausgaben-Hauptkategorie, und wer das
 * Plus an „Freizeit" antippt, will eine Unterkategorie darunter. Beides noch
 * einmal zur Wahl zu stellen waere nur eine Gelegenheit, es falsch zu machen.
 *
 * Bleibt genau ein Feld, das immer noetig ist — der Name — und die Farbe bei
 * Hauptkategorien. Verschoben wird nur beim Bearbeiten, wo es auch gebraucht
 * wird (versehentlich falsch einsortiert).
 */
export default function CategorySheet({ open, onClose, category, type, parentId }: Props) {
  const { categories, addCategory, updateCategory, deleteCategory } = usePersonal()

  const [name, setName]       = useState('')
  const [color, setColor]     = useState<string>(PF_CATEGORY_COLORS[0])
  const [parent, setParentId] = useState<string | null>(null)
  const [bucket, setBucket]   = useState<PfPlanningBucket | null>(null)
  const [busy, setBusy]       = useState(false)

  // Beim Bearbeiten gilt die Art der Kategorie, beim Anlegen die des Abschnitts.
  const effectiveType = category?.type ?? type

  useEffect(() => {
    if (!open) return
    setName(category?.name ?? '')
    setColor(category?.color ?? PF_CATEGORY_COLORS[0])
    setParentId(category ? category.parent_id : parentId)
    setBucket(category?.planning_bucket ?? null)
    setBusy(false)
  }, [open, category, parentId])

  const children = useMemo(
    () => (category ? categories.filter((c) => c.parent_id === category.id) : []),
    [categories, category],
  )
  const hasChildren = children.length > 0

  const parentCategory = parent ? (categories.find((c) => c.id === parent) ?? null) : null

  // Ziele zum Verschieben: nur Hauptkategorien derselben Art, nie man selbst.
  const moveTargets = useMemo(
    () =>
      categories.filter(
        (c) => c.parent_id === null && c.type === effectiveType && c.id !== category?.id,
      ),
    [categories, effectiveType, category],
  )

  // Vorschau der abgeleiteten Farbe: dieselbe Funktion, die auch Sankey und
  // Donut benutzen — was hier zu sehen ist, steht spaeter so im Diagramm.
  const derivedColor = useMemo(() => {
    if (!parentCategory) return null
    const siblings = categories.filter(
      (c) => c.parent_id === parentCategory.id && c.id !== category?.id,
    )
    const own = {
      id: category?.id ?? '__neu',
      name: name.trim() || 'Neu',
      color,
      parent_id: parentCategory.id,
    }
    return categoryColorMap([parentCategory, ...siblings, own]).get(own.id) ?? parentCategory.color
  }, [parentCategory, categories, category, name, color])

  const trimmed = name.trim()

  // Doppelte Namen faengt der Unique-Index ohnehin ab; hier vorab gemeldet,
  // damit man es sieht, bevor man auf Speichern drueckt.
  //
  // Bewusst strenger als die Datenbank: die vergleicht Gross-/Kleinschreibung
  // mit, "Auto" neben "auto" waere dort also erlaubt. Zwei Kategorien, die sich
  // nur darin unterscheiden, sind in einer Liste aber nicht auseinanderzuhalten.
  const duplicate = categories.some(
    (c) =>
      c.id !== category?.id &&
      c.type === effectiveType &&
      c.parent_id === parent &&
      c.name.toLowerCase() === trimmed.toLowerCase(),
  )

  const valid = trimmed.length > 0 && !duplicate

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    const payload = {
      name: trimmed,
      type: effectiveType,
      // Unterkategorien tragen die abgeleitete Farbe des Elternteils. Der Wert
      // wird trotzdem gespeichert, damit eine spaeter hochgestufte Kategorie
      // (Elternteil geloescht) nicht farblos dasteht.
      color: parentCategory ? (derivedColor ?? parentCategory.color) : color,
      parent_id: parent,
      // Der Topf haengt an der Hauptkategorie. Eine Unterkategorie erbt ihn
      // ueber ihr Elternteil und traegt deshalb selbst keinen.
      planning_bucket: parentCategory ? null : bucket,
      monthly_budget: category?.monthly_budget ?? null,
      warn_ratio: category?.warn_ratio ?? 0.8,
    }
    const ok = category ? await updateCategory(category.id, payload) : await addCategory(payload)
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

  const chip = (on: boolean) =>
    'rounded-xl px-3 py-2 text-[13px] font-medium transition-colors duration-150 ' +
    (on ? 'bg-brand-600 text-white' : 'bg-zinc-100 text-zinc-600')

  const kindLabel = effectiveType === 'expense' ? 'Ausgaben' : 'Einnahme'
  const title = category
    ? category.parent_id
      ? 'Unterkategorie bearbeiten'
      : 'Kategorie bearbeiten'
    : parentCategory
      ? 'Neue Unterkategorie'
      : `Neue ${kindLabel}-Kategorie`

  return (
    <BottomSheet open={open} onClose={onClose}>
      <form onSubmit={submit} className="px-5 pt-2">
        <h2 className="text-[17px] font-semibold tracking-[-0.3px] text-zinc-900">{title}</h2>
        {/* Statt einer Auswahl: der Kontext steht als Satz da, damit klar ist,
            wo das hier landet. */}
        {!category && (
          <p className="mt-1 text-[13px] text-zinc-500">
            {parentCategory ? (
              <>
                unter{' '}
                <span className="font-medium text-zinc-700">{parentCategory.name}</span>
              </>
            ) : (
              `Eigenständige ${kindLabel === 'Ausgaben' ? 'Ausgaben-Kategorie' : 'Einnahme-Kategorie'}`
            )}
          </p>
        )}

        <label className="mt-4 block text-[13px] font-medium text-zinc-500">Name</label>
        <input
          autoFocus={!category}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={parentCategory ? 'z. B. Media & Entertainment' : 'z. B. Freizeit'}
          className={field}
        />
        {duplicate && (
          <p className="mt-1.5 text-[12px] text-red-500">
            {parentCategory
              ? `Unter „${parentCategory.name}" gibt es diesen Namen schon.`
              : 'Diesen Namen gibt es als Hauptkategorie schon.'}
          </p>
        )}

        {/* ── Planungs-Topf ────────────────────────────────────────────────
            Die grobe Ebene ueber der Kategorie (50/30/20). Nur an
            Hauptkategorien gepflegt — Unterkategorien erben ihn. */}
        {effectiveType === 'expense' && !parentCategory && (
          <>
            <label className="mt-4 block text-[13px] font-medium text-zinc-500">
              Planungs-Topf <span className="text-zinc-400">(optional)</span>
            </label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {BUCKETS.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setBucket(bucket === id ? null : id)}
                  className={chip(bucket === id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[12px] leading-snug text-zinc-400">
              {bucket === 'sparen'
                ? 'Zählt in der Übersicht als gespartes Geld, nicht als Ausgabe.'
                : 'Bestimmt später, in welchen der drei Töpfe (50/30/20) diese Ausgaben fallen.'}
            </p>
          </>
        )}
        {parentCategory && (
          <p className="mt-4 rounded-2xl bg-zinc-50 px-4 py-3 text-[13px] leading-snug text-zinc-500">
            Planungs-Topf und Art kommen von „{parentCategory.name}".
          </p>
        )}

        {/* ── Farbe ────────────────────────────────────────────────────────── */}
        <label className="mt-4 block text-[13px] font-medium text-zinc-500">Farbe</label>
        {parentCategory ? (
          <div className="mt-1.5 flex items-center gap-3 rounded-2xl bg-zinc-50 px-4 py-3">
            <span
              className="h-6 w-6 shrink-0 rounded-full ring-1 ring-black/10"
              style={{ backgroundColor: derivedColor ?? parentCategory.color }}
            />
            <span className="text-[13px] leading-snug text-zinc-500">
              Wird aus „{parentCategory.name}" abgeleitet — so bleibt im Diagramm sichtbar,
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

        {/* ── Verschieben (nur beim Bearbeiten) ─────────────────────────────
            Beim Anlegen steht die Einordnung durch den Kontext fest. Beim
            Bearbeiten braucht es den Weg, um falsch Einsortiertes zu heilen. */}
        {category && !hasChildren && moveTargets.length > 0 && (
          <>
            <label className="mt-5 block text-[13px] font-medium text-zinc-500">
              Einordnung
            </label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              <button type="button" onClick={() => setParentId(null)} className={chip(parent === null)}>
                Eigenständig
              </button>
              {moveTargets.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setParentId(c.id)}
                  className={chip(parent === c.id)}
                >
                  unter {c.name}
                </button>
              ))}
            </div>
          </>
        )}
        {category && hasChildren && (
          <p className="mt-4 rounded-2xl bg-zinc-50 px-4 py-3 text-[13px] leading-snug text-zinc-500">
            {children.length === 1 ? 'Eine Unterkategorie hängt' : `${children.length} Unterkategorien hängen`}{' '}
            hier dran — deshalb bleibt das eine Hauptkategorie.
          </p>
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
