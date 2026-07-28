// Amortisierungs-Logik für Fixkosten: rechnet aus, welchen Monatsbeitrag ein
// Fixkosten-Eintrag für einen bestimmten Monat zur Prognose beisteuert.

const PERIOD = { monthly: 1, quarterly: 3, half_yearly: 6, yearly: 12, once: 0 };

// "YYYY-MM" -> fortlaufender Monatsindex (Jahr*12 + Monat).
export function monthIndex(ym) {
  const [y, m] = String(ym).split("-").map(Number);
  return y * 12 + (m - 1);
}

export function indexToMonth(idx) {
  const y = Math.floor(idx / 12);
  const m = (idx % 12) + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

// Monatsbeitrag eines Fixkostens für den Monat `month` (YYYY-MM). Immer >= 0.
export function monthlyContribution(fc, month) {
  const M = monthIndex(month);
  const amount = Number(fc.amount) || 0;
  if (!amount || !fc.active) return 0;

  // Monatliche Fixkosten: ab dem Startmonat (oder immer) der volle Betrag.
  if (fc.cadence === "monthly") {
    const start = fc.start_month ? monthIndex(fc.start_month) : -Infinity;
    return M >= start ? amount : 0;
  }

  // Nicht-monatlich: es braucht ein Fälligkeitsdatum.
  if (!fc.due_month) return 0;
  let due = monthIndex(fc.due_month);
  let start = fc.start_month ? monthIndex(fc.start_month) : due;

  // Einmalig: kein Zyklus, nur das eine Fenster [start..due].
  if (fc.cadence === "once") {
    if (M < start || M > due) return 0;
    if (fc.amortize) {
      const N = due - start + 1;
      return N > 0 ? amount / N : amount;
    }
    return M === due ? amount : 0;
  }

  // Zyklisch (jährlich/halbjährlich/vierteljährlich): Fenster vorrollen, bis
  // die Fälligkeit >= gesuchtem Monat liegt (= aktueller Spar-Zyklus).
  const period = PERIOD[fc.cadence];
  let guard = 0;
  while (due < M && guard < 2000) {
    start = due + 1;            // neues Fenster beginnt direkt nach alter Fälligkeit
    due = due + period;
    guard++;
  }

  if (M < start) return 0; // Sparen für dieses Fenster hat noch nicht begonnen
  if (fc.amortize) {
    const N = due - start + 1;
    return N > 0 ? amount / N : amount;
  }
  return M === due ? amount : 0;
}

// Ist ein Fixkosten im gegebenen Monat tatsächlich fällig (Zahlungsmonat)?
export function isDueInMonth(fc, month) {
  if (fc.cadence === "monthly") {
    const start = fc.start_month ? monthIndex(fc.start_month) : -Infinity;
    return monthIndex(month) >= start;
  }
  if (!fc.due_month) return false;
  const M = monthIndex(month);
  let due = monthIndex(fc.due_month);
  if (fc.cadence === "once") return due === M;
  const period = PERIOD[fc.cadence];
  let guard = 0;
  while (due < M && guard < 2000) {
    due += period;
    guard++;
  }
  return due === M;
}
