import { usePersonal } from '../../context/PersonalContext'
import { SkeletonBlock } from '../ui/Skeleton'
import { MoneyFlyIcon } from '../ui/Icon'

// Phase 0 — Platzhalter des Persoenlich-Bereichs (Walking Skeleton).
// Zeigt bewusst schon echte Daten aus den pf_-Tabellen: damit ist sichtbar
// belegt, dass Laden, RLS-Isolation und Realtime durchgaengig funktionieren.
// Die eigentlichen Features (Konten, Umsaetze, Budgets) folgen in Phase 1+.

export default function PersonalHome() {
  const { loading, accounts, categories } = usePersonal()

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <SkeletonBlock className="h-28 w-full rounded-3xl" />
        <SkeletonBlock className="h-20 w-full rounded-3xl" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <section className="rounded-3xl bg-white p-6 shadow-soft">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-100 text-brand-600">
            <MoneyFlyIcon size={20} />
          </div>
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold tracking-[-0.3px] text-zinc-900">
              Dein privater Bereich
            </h2>
            <p className="text-[13px] leading-snug text-zinc-500">
              Nur für dich sichtbar — niemand sonst kann diese Daten sehen.
            </p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-3xl bg-white p-5 shadow-soft">
          <div className="text-[28px] font-semibold leading-none tracking-[-0.6px] text-zinc-900">
            {accounts.length}
          </div>
          <div className="mt-1.5 text-[13px] text-zinc-500">
            {accounts.length === 1 ? 'Konto' : 'Konten'}
          </div>
        </div>
        <div className="rounded-3xl bg-white p-5 shadow-soft">
          <div className="text-[28px] font-semibold leading-none tracking-[-0.6px] text-zinc-900">
            {categories.length}
          </div>
          <div className="mt-1.5 text-[13px] text-zinc-500">
            {categories.length === 1 ? 'Kategorie' : 'Kategorien'}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-dashed border-black/10 bg-white/50 p-6 text-center">
        <p className="text-[14px] font-medium text-zinc-700">Hier entsteht dein Finanzbereich</p>
        <p className="mt-1 text-[13px] leading-snug text-zinc-500">
          Als Nächstes: Konten anlegen, Umsätze erfassen und importieren.
        </p>
      </section>
    </div>
  )
}
