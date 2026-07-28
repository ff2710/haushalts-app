export type TxType = "income" | "expense";

export interface Category {
  id: number;
  name: string;
  type: TxType;
  color: string;
  monthly_budget: number | null;
}

export interface Transaction {
  id: number;
  date: string; // YYYY-MM-DD
  type: TxType;
  amount: number;
  category_id: number | null;
  category_name: string | null;
  category_color: string | null;
  description: string;
  source: "manual" | "csv";
  import_batch_id: number | null;
  created_at: string;
}

export interface TransactionInput {
  date: string;
  type: TxType;
  amount: number;
  category_id: number | null;
  description: string;
}

export interface CategoryInput {
  name: string;
  type: TxType;
  color: string;
  monthly_budget: number | null;
}

export interface MonthlyPlan {
  year_month: string;
  planned_income: number;
  planned_expense: number;
  notes: string;
}

export interface Summary {
  month: string;
  income: number;
  expense: number;
  net: number;
  planned_income: number;
  planned_expense: number;
  byCategory: { name: string; color: string; total: number }[];
  byIncomeCategory: { name: string; color: string; total: number }[];
}

export interface TrendPoint {
  month: string;
  income: number;
  expense: number;
}

export interface SavingsGoal {
  id: number;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string | null;
  created_at: string;
}

// Eine für den Import vorbereitete Zeile (Frontend → Backend).
export interface ImportRow {
  date: string;
  type: TxType;
  amount: number;
  description: string;
}

export interface PreviewRow extends ImportRow {
  index: number;
  duplicate: boolean;
  reason: string | null;
  matched: { id: number; date: string; description: string } | null;
}

export interface PreviewResult {
  rows: PreviewRow[];
  total: number;
  duplicates: number;
  errors: { index: number; error: string }[];
}

export interface ImportBatch {
  id: number;
  filename: string;
  imported_at: string;
  row_count: number;
}

export type Cadence = "monthly" | "quarterly" | "half_yearly" | "yearly" | "once";

export interface FixedCost {
  id: number;
  name: string;
  amount: number;
  cadence: Cadence;
  due_month: string | null;
  start_month: string | null;
  amortize: number; // 0/1
  category_id: number | null;
  active: number;
  // vom Backend für den gewählten Monat berechnet:
  monthlyEquivalent: number;
  dueThisMonth: boolean;
  appliedThisMonth: boolean;
}

export interface FixedCostInput {
  name: string;
  amount: number;
  cadence: Cadence;
  due_month: string | null;
  start_month: string | null;
  amortize: boolean;
  category_id: number | null;
}

export interface RecurringIncomeItem {
  id: number;
  category_id: number | null;
  category_name: string | null;
  category_color: string | null;
  amount: number;
  start_month: string;
  end_month: string | null;
  active: number;
  amountThisMonth: number;
  appliedThisMonth: boolean;
}

export interface RecurringIncomeInput {
  category_id: number | null;
  amount: number;
  start_month: string;
  end_month: string | null;
}

export interface VariableEstimateItem {
  id: number;
  name: string;
  amount: number;
}

export interface Forecast {
  month: string;
  expectedIncome: number;
  fixedMonthly: number;
  fixedBreakdown: { id: number; name: string; monthly: number }[];
  variableEstimate: number;
  variableItems: VariableEstimateItem[];
  leftover: number;
  variableSuggestion: number | null;
}
