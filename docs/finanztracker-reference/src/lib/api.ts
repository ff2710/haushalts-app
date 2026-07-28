import type {
  Category,
  CategoryInput,
  FixedCost,
  FixedCostInput,
  Forecast,
  ImportBatch,
  ImportRow,
  MonthlyPlan,
  PreviewResult,
  RecurringIncomeInput,
  RecurringIncomeItem,
  SavingsGoal,
  Summary,
  Transaction,
  TransactionInput,
  TrendPoint,
  VariableEstimateItem,
} from "./types";

async function req<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Fehler ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  categories: () => req<Category[]>("/api/categories"),

  transactions: (month?: string) =>
    req<Transaction[]>(`/api/transactions${month ? `?month=${month}` : ""}`),

  addTransaction: (input: TransactionInput) =>
    req<Transaction>("/api/transactions", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  updateTransaction: (id: number, input: TransactionInput) =>
    req<Transaction>(`/api/transactions/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),

  deleteTransaction: (id: number) =>
    req<{ ok: true }>(`/api/transactions/${id}`, { method: "DELETE" }),

  addCategory: (input: CategoryInput) =>
    req<Category>("/api/categories", { method: "POST", body: JSON.stringify(input) }),

  updateCategory: (id: number, input: CategoryInput) =>
    req<Category>(`/api/categories/${id}`, { method: "PUT", body: JSON.stringify(input) }),

  deleteCategory: (id: number) =>
    req<{ ok: true }>(`/api/categories/${id}`, { method: "DELETE" }),

  monthlyPlan: (month: string) => req<MonthlyPlan>(`/api/monthly-plan/${month}`),

  saveMonthlyPlan: (month: string, plan: Omit<MonthlyPlan, "year_month">) =>
    req<MonthlyPlan>(`/api/monthly-plan/${month}`, {
      method: "PUT",
      body: JSON.stringify(plan),
    }),

  summary: (month: string) => req<Summary>(`/api/summary/${month}`),

  trend: (months = 6) => req<TrendPoint[]>(`/api/trend?months=${months}`),

  savingsGoals: () => req<SavingsGoal[]>("/api/savings-goals"),

  addSavingsGoal: (input: { name: string; target_amount: number; target_date: string | null }) =>
    req<SavingsGoal>("/api/savings-goals", { method: "POST", body: JSON.stringify(input) }),

  contributeSavingsGoal: (id: number, amount: number) =>
    req<SavingsGoal>(`/api/savings-goals/${id}/contribute`, {
      method: "POST",
      body: JSON.stringify({ amount }),
    }),

  deleteSavingsGoal: (id: number) =>
    req<{ ok: true }>(`/api/savings-goals/${id}`, { method: "DELETE" }),

  importPreview: (rows: ImportRow[]) =>
    req<PreviewResult>("/api/import/preview", {
      method: "POST",
      body: JSON.stringify({ rows }),
    }),

  importCommit: (filename: string, rows: ImportRow[], category_id: number | null) =>
    req<{ ok: true; imported: number }>("/api/import/commit", {
      method: "POST",
      body: JSON.stringify({ filename, rows, category_id }),
    }),

  importBatches: () => req<ImportBatch[]>("/api/import-batches"),

  deleteImportBatch: (id: number) =>
    req<{ ok: true }>(`/api/import-batches/${id}`, { method: "DELETE" }),

  // --- Planung (v1.2) ---
  fixedCosts: (month: string) => req<FixedCost[]>(`/api/fixed-costs?month=${month}`),
  addFixedCost: (input: FixedCostInput) =>
    req<FixedCost>("/api/fixed-costs", { method: "POST", body: JSON.stringify(input) }),
  updateFixedCost: (id: number, input: FixedCostInput) =>
    req<FixedCost>(`/api/fixed-costs/${id}`, { method: "PUT", body: JSON.stringify(input) }),
  deleteFixedCost: (id: number) =>
    req<{ ok: true }>(`/api/fixed-costs/${id}`, { method: "DELETE" }),
  applyFixedCost: (id: number, month: string) =>
    req<{ ok: true; skipped: boolean }>(`/api/fixed-costs/${id}/apply?month=${month}`, { method: "POST" }),

  recurringIncome: (month: string) =>
    req<RecurringIncomeItem[]>(`/api/recurring-income?month=${month}`),
  addRecurringIncome: (input: RecurringIncomeInput) =>
    req<RecurringIncomeItem>("/api/recurring-income", { method: "POST", body: JSON.stringify(input) }),
  updateRecurringIncome: (id: number, input: RecurringIncomeInput) =>
    req<RecurringIncomeItem>(`/api/recurring-income/${id}`, { method: "PUT", body: JSON.stringify(input) }),
  deleteRecurringIncome: (id: number) =>
    req<{ ok: true }>(`/api/recurring-income/${id}`, { method: "DELETE" }),
  applyRecurringIncome: (id: number, month: string) =>
    req<{ ok: true; skipped: boolean }>(`/api/recurring-income/${id}/apply?month=${month}`, { method: "POST" }),

  variableEstimates: () => req<VariableEstimateItem[]>("/api/variable-estimates"),
  saveVariableEstimates: (items: { name: string; amount: number }[]) =>
    req<VariableEstimateItem[]>("/api/variable-estimates", { method: "PUT", body: JSON.stringify({ items }) }),

  forecast: (month: string) => req<Forecast>(`/api/forecast/${month}`),
};
