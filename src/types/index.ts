export type Person   = 'A' | 'B'
export type Split    = 'both' | 'A' | 'B'
export type ViewMode = 'all' | 'store' | 'category'
export type ItemSort = 'custom' | 'created' | 'alpha'

export type AvatarRole = 'debtor' | 'creditor' | 'neutral'

export type SettingsView = 'list' | 'profile' | 'stores' | 'categories' | 'units'

export interface Profile {
  id: string
  name: string
  email: string | null
  avatar_url: string | null
  created_at: string
}

export interface Settings {
  id: number
  person_a: string
  person_b: string
  person_a_id: string | null
  person_b_id: string | null
  updated_at: string
}

export interface Store {
  id: string
  name: string
  position: number
  created_at: string
}

export interface Category {
  id: string
  name: string
  position: number
  created_at: string
}

export interface ShoppingItem {
  id: string
  name: string
  quantity: string | null
  unit: string | null
  is_done: boolean
  store_id: string | null
  category_id: string | null
  position: number
  created_at: string
}

export interface Expense {
  id: string
  amount: number
  description: string
  date: string
  paid_by: Person
  split: Split
  created_at: string
}

export interface Settlement {
  id: string
  amount: number
  from_person: Person
  to_person: Person
  date: string
  note: string | null
  created_at: string
}

// ---------------------------------------------------------------------------
// Persoenlich-Bereich (pf_ = personal finance) — privat pro Person, RLS-isoliert.
// owner_id setzt die Datenbank per Default auth.uid(); das Frontend sendet ihn
// NIE mit. Deshalb ist er in den Insert-Typen unten ausgeschlossen.
// ---------------------------------------------------------------------------
export type Area = 'shared' | 'personal'

export type PfAccountType =
  | 'giro'
  | 'tagesgeld'
  | 'kreditkarte'
  | 'depot'
  | 'festgeld'
  | 'bar'
  | 'sonstiges'

export type PfCategoryType = 'income' | 'expense'

/** Die drei groben Töpfe der 50/30/20-Planung. */
export type PfPlanningBucket = 'fix' | 'freizeit' | 'sparen'

export interface PfAccount {
  id: string
  owner_id: string
  name: string
  type: PfAccountType
  is_hub: boolean
  is_shared_ref: boolean
  /** Selbst gesetzter Stand — nur bei Konten vom Typ 'bar' benutzt. Bargeld
   *  zählt man nachschauend, statt es aus Buchungen herzuleiten. Gibt es
   *  Orte (PfCashLocation), gilt deren Summe und dieses Feld ruht. */
  stated_balance: number | null
  position: number
  created_at: string
}

/** Optionale Aufteilung eines Bargeld-Kontos auf Orte („Geldbeutel", „Schublade"). */
export interface PfCashLocation {
  id: string
  owner_id: string
  account_id: string
  name: string
  amount: number
  position: number
  created_at: string
}

export interface PfCategory {
  id: string
  owner_id: string
  name: string
  type: PfCategoryType
  color: string
  /** Elternkategorie; null = Hauptkategorie. Genau zwei Ebenen — eine
   *  Unterkategorie kann selbst kein Elternteil sein (per Trigger gesichert). */
  parent_id: string | null
  /** Planungs-Topf (50/30/20). Nur an Hauptkategorien gepflegt,
   *  Unterkategorien erben ihn über ihr Elternteil. null = nicht zugeordnet. */
  planning_bucket: PfPlanningBucket | null
  /** Monatsbudget der Kategorie; null = kein Budget gesetzt. */
  monthly_budget: number | null
  /** Ab welchem Anteil des Budgets gewarnt wird (0–1, Standard 0,8). */
  warn_ratio: number
  created_at: string
}

export type PfTransactionSource = 'manual' | 'csv'

export interface PfTransaction {
  id: string
  owner_id: string
  date: string
  /** Richtung. Der Betrag ist IMMER positiv — nie negativ in der DB. */
  type: PfCategoryType
  amount: number
  description: string
  account_id: string | null
  category_id: string | null
  import_batch_id: string | null
  source: PfTransactionSource
  source_ref: string | null
  dedup_key: string
  created_at: string
}

export interface PfImportBatch {
  id: string
  owner_id: string
  filename: string
  row_count: number
  imported_at: string
}

/** Felder, die das Frontend beim Anlegen schicken darf (ohne owner_id!). */
export type PfAccountInput = Omit<PfAccount, 'id' | 'owner_id' | 'created_at'>
export type PfCashLocationInput = Omit<PfCashLocation, 'id' | 'owner_id' | 'created_at'>
export type PfCategoryInput = Omit<PfCategory, 'id' | 'owner_id' | 'created_at'>

/** dedup_key fehlt bewusst: den berechnet der personalService zentral, damit
 *  ihn kein Aufrufpfad vergessen kann. */
export type PfTransactionInput = Omit<
  PfTransaction,
  'id' | 'owner_id' | 'created_at' | 'dedup_key'
>

// ── Planungs-Ebene (Phase 2) ────────────────────────────────────────────────

export type PfCadence = 'monthly' | 'quarterly' | 'half_yearly' | 'yearly' | 'once'

export interface PfFixedCost {
  id: string
  owner_id: string
  name: string
  amount: number
  cadence: PfCadence
  /** Fälligkeitsmonat 'YYYY-MM' — nur bei nicht-monatlichen Posten. */
  due_month: string | null
  /** Ab wann zurückgelegt wird ('YYYY-MM'). */
  start_month: string | null
  /** true = auf einen Monatsbeitrag umrechnen statt erst bei Fälligkeit. */
  amortize: boolean
  category_id: string | null
  active: boolean
  created_at: string
}

export interface PfRecurringIncome {
  id: string
  owner_id: string
  name: string
  amount: number
  start_month: string
  end_month: string | null
  category_id: string | null
  active: boolean
  created_at: string
}

export interface PfVariableEstimate {
  id: string
  owner_id: string
  name: string
  amount: number
  created_at: string
}

export interface PfMonthlyPlan {
  id: string
  owner_id: string
  year_month: string
  planned_income: number
  planned_expense: number
  notes: string
  created_at: string
}

// ── Spar-Kaskade, Toepfe, Schulden (Phase 3) ────────────────────────────────

export type PfStepKind = 'fixed' | 'percent' | 'debts' | 'pots' | 'rest'

export interface PfPot {
  id: string
  owner_id: string
  name: string
  /** Zielbetrag; null = ohne Ziel. Wenn gesetzt, immer > 0. */
  target_amount: number | null
  /** Selbst gesetzter Stand — ein Topf hat keine eigene Buchungshistorie. */
  current_amount: number
  /** Höchstens so viel je Monat hineinfüllen; null = kein Deckel. */
  monthly_cap: number | null
  /** Kleiner = zuerst befüllen. */
  priority: number
  account_id: string | null
  active: boolean
  created_at: string
}

export interface PfDebt {
  id: string
  owner_id: string
  creditor: string
  initial_amount: number
  paid_amount: number
  /** Wunschrate je Monat; null = nimmt, was die Kaskade übrig lässt. */
  monthly_rate: number | null
  priority: number
  note: string
  active: boolean
  created_at: string
}

export interface PfAllocationStep {
  id: string
  owner_id: string
  name: string
  kind: PfStepKind
  /** Nur bei kind='fixed'. */
  amount: number | null
  /** Nur bei kind='percent'. */
  percent: number | null
  position: number
  active: boolean
  created_at: string
}

export type PfPotInput = Omit<PfPot, 'id' | 'owner_id' | 'created_at'>
export type PfDebtInput = Omit<PfDebt, 'id' | 'owner_id' | 'created_at'>
export type PfAllocationStepInput = Omit<PfAllocationStep, 'id' | 'owner_id' | 'created_at'>

export type PfFixedCostInput = Omit<PfFixedCost, 'id' | 'owner_id' | 'created_at'>
export type PfRecurringIncomeInput = Omit<PfRecurringIncome, 'id' | 'owner_id' | 'created_at'>
export type PfVariableEstimateInput = Omit<PfVariableEstimate, 'id' | 'owner_id' | 'created_at'>

/** Eine Zeile aus der CSV, nachdem sie zugeordnet und geprüft wurde. */
export interface ImportRow {
  date: string
  type: PfCategoryType
  amount: number
  description: string
  /** Gesetzt, wenn die Dubletten-Regel eine Übereinstimmung gefunden hat —
   *  entweder im Bestand oder weiter oben in derselben Datei. Bewusst nur die
   *  fürs Review nötigen Felder, damit hier keine halbe Transaktion vorgetäuscht
   *  wird. */
  duplicateOf: { date: string; description?: string | null } | null
  /** Entscheidung des Menschen im Review-Screen. */
  include: boolean
}
