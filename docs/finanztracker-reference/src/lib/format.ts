const euro = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

export function formatEuro(amount: number): string {
  return euro.format(amount);
}

// Betrag mit Vorzeichen je nach Typ, fürs Anzeigen in Listen.
export function formatSigned(amount: number, type: "income" | "expense"): string {
  const sign = type === "income" ? "+" : "−";
  return `${sign}${euro.format(amount)}`;
}

const dateFmt = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return dateFmt.format(new Date(y, m - 1, d));
}

// Heutiges Datum als YYYY-MM-DD (lokal, nicht UTC).
export function today(): string {
  const now = new Date();
  const off = now.getTimezoneOffset();
  return new Date(now.getTime() - off * 60000).toISOString().slice(0, 10);
}

// Aktueller Monat als YYYY-MM — leitet sich aus today() ab, damit Monat und
// Tagesdatum in derselben (lokalen) Zeitzone konsistent bleiben.
export function currentMonth(): string {
  return today().slice(0, 7);
}

// YYYY-MM lesbar, z. B. "Juli 2026".
export function formatMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }).format(
    new Date(y, m - 1, 1)
  );
}
