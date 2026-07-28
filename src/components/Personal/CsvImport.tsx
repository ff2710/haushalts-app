import { useMemo, useRef, useState } from 'react'
import BottomSheet from '../ui/BottomSheet'
import { usePersonal } from '../../context/PersonalContext'
import * as personalService from '../../services/personalService'
import { parseCsv, parseDate } from '../../lib/csv'
import { parseAmount } from '../../lib/amount'
import { dedupWindow, findDuplicate, type DedupRow } from '../../lib/dedup'
import { formatDate, formatMoney } from '../../lib/utils'
import type { ImportRow, PfTransaction } from '../../types'

// CSV-Import in drei Schritten: Datei -> Spalten zuordnen -> Review -> Import.
//
// NICHT VERHANDELBAR (CLAUDE.md): Die Dubletten-Erkennung ist deterministisch
// (Betrag + Datum +/-3 Tage + normalisierter Text). Was sie findet, wird dem
// Menschen im Review gezeigt und standardmaessig ABGEWAEHLT — nichts wird still
// doppelt angelegt, nichts still geloescht. Der Import ist ein Batch und
// dadurch komplett rueckgaengig machbar.

type Step = 'pick' | 'map' | 'review'

interface Props {
  open: boolean
  onClose: () => void
}

/** Rät die passende Spalte anhand typischer Bank-Überschriften. */
function guessColumn(headers: string[], candidates: string[]): number {
  const lower = headers.map((h) => h.toLowerCase())
  for (const c of candidates) {
    const i = lower.findIndex((h) => h.includes(c))
    if (i !== -1) return i
  }
  return -1
}

export default function CsvImport({ open, onClose }: Props) {
  const { accounts, importRows } = usePersonal()
  const fileInput = useRef<HTMLInputElement>(null)

  const [step, setStep]       = useState<Step>('pick')
  const [filename, setFile]   = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<string[][]>([])
  const [colDate, setColDate] = useState(-1)
  const [colAmount, setColAmt] = useState(-1)
  const [colDesc, setColDesc] = useState(-1)
  const [rows, setRows]       = useState<ImportRow[]>([])
  const [accountId, setAcc]   = useState<string | null>(null)
  const [busy, setBusy]       = useState(false)
  const [error, setError]     = useState('')

  const reset = () => {
    setStep('pick')
    setFile('')
    setHeaders([])
    setRawRows([])
    setColDate(-1)
    setColAmt(-1)
    setColDesc(-1)
    setRows([])
    setBusy(false)
    setError('')
  }

  const close = () => {
    reset()
    onClose()
  }

  const onFile = async (file: File) => {
    setError('')
    const text = await file.text()
    const parsed = parseCsv(text)
    if (parsed.headers.length === 0 || parsed.rows.length === 0) {
      setError('Die Datei enthält keine auswertbaren Zeilen.')
      return
    }
    setFile(file.name)
    setHeaders(parsed.headers)
    setRawRows(parsed.rows)
    setColDate(guessColumn(parsed.headers, ['buchungstag', 'datum', 'date', 'valuta']))
    setColAmt(guessColumn(parsed.headers, ['betrag', 'amount', 'umsatz', 'wert']))
    setColDesc(
      guessColumn(parsed.headers, ['verwendungszweck', 'beschreibung', 'buchungstext', 'description', 'empfänger', 'empfaenger']),
    )
    setStep('map')
  }

  const mappingValid = colDate >= 0 && colAmount >= 0

  /** Zuordnung anwenden, Zeilen prüfen und gegen den Bestand auf Dubletten testen. */
  const buildReview = async () => {
    if (!mappingValid || busy) return
    setBusy(true)
    setError('')

    const candidates: ImportRow[] = []
    let skipped = 0

    for (const r of rawRows) {
      const iso = parseDate(r[colDate] ?? '')
      const amt = parseAmount(r[colAmount] ?? '')
      // Betrag 0 wird wie in der Referenz verworfen — eine Buchung ohne Betrag
      // ist kein Umsatz, sondern Rauschen (z. B. Saldo-Zeilen der Bank).
      if (!iso || amt === null || amt === 0) {
        skipped++
        continue
      }
      candidates.push({
        date: iso,
        // Vorzeichen der Bank -> Richtung. In der DB liegt der Betrag positiv.
        type: amt < 0 ? 'expense' : 'income',
        amount: Math.abs(amt),
        description: (colDesc >= 0 ? r[colDesc] ?? '' : '').trim(),
        duplicateOf: null,
        include: true,
      })
    }

    if (candidates.length === 0) {
      setBusy(false)
      setError('Keine Zeile hatte ein erkennbares Datum und einen Betrag. Stimmt die Zuordnung?')
      return
    }

    // Vergleichsdaten nur im relevanten Zeitfenster laden (+/-3 Tage).
    const win = dedupWindow(candidates)
    let existing: PfTransaction[] = []
    if (win) {
      const { data, error: err } = await personalService.fetchTransactionsInRange(win.from, win.to)
      if (err) {
        setBusy(false)
        setError('Bestand konnte für die Dubletten-Prüfung nicht geladen werden.')
        return
      }
      existing = (data ?? []) as PfTransaction[]
    }

    // Bereits im selben Import enthaltene Zeilen zählen mit, damit auch
    // Dubletten INNERHALB der Datei auffallen.
    const seen: DedupRow[] = [...existing]
    const checked = candidates.map((c) => {
      const hit = findDuplicate(seen, c)
      if (!hit) seen.push(c)
      return { ...c, duplicateOf: hit, include: !hit } // Dubletten standardmäßig AUS
    })

    setRows(checked)
    setStep('review')
    setBusy(false)
    if (skipped > 0) {
      setError(`${skipped} Zeile(n) ohne erkennbares Datum/Betrag werden übersprungen.`)
    }
  }

  const stats = useMemo(() => {
    const dups = rows.filter((r) => r.duplicateOf).length
    const sel = rows.filter((r) => r.include).length
    return { dups, sel, total: rows.length }
  }, [rows])

  const toggle = (i: number) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, include: !r.include } : r)))

  const runImport = async () => {
    if (busy || stats.sel === 0) return
    setBusy(true)
    const batch = await importRows(rows, filename, accountId)
    setBusy(false)
    if (batch) close()
  }

  return (
    <BottomSheet open={open} onClose={close}>
      <div className="px-5 pt-2">
        <h2 className="text-[17px] font-semibold tracking-[-0.3px] text-zinc-900">
          Umsätze importieren
        </h2>

        {error && (
          <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-[13px] leading-snug text-amber-700">
            {error}
          </p>
        )}

        {/* ---------- Schritt 1: Datei ---------- */}
        {step === 'pick' && (
          <>
            <p className="mt-2 text-[13px] leading-snug text-zinc-500">
              CSV-Datei aus dem Online-Banking auswählen. Nichts wird sofort gespeichert — du
              siehst vorher jede Zeile.
            </p>
            <input
              ref={fileInput}
              type="file"
              accept=".csv,text/csv,text/plain"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void onFile(f)
                e.target.value = ''
              }}
            />
            <button
              onClick={() => fileInput.current?.click()}
              className="mt-4 w-full rounded-2xl bg-brand-600 py-3.5 text-[15px] font-semibold text-white transition-opacity duration-150 active:opacity-80"
            >
              Datei auswählen
            </button>
          </>
        )}

        {/* ---------- Schritt 2: Spalten zuordnen ---------- */}
        {step === 'map' && (
          <>
            <p className="mt-2 truncate text-[13px] text-zinc-500">
              {filename} — {rawRows.length} Zeile(n)
            </p>

            {[
              { label: 'Datum',         value: colDate,   set: setColDate,  required: true },
              { label: 'Betrag',        value: colAmount, set: setColAmt,   required: true },
              { label: 'Beschreibung',  value: colDesc,   set: setColDesc,  required: false },
            ].map((f) => (
              <div key={f.label} className="mt-4">
                <label className="block text-[13px] font-medium text-zinc-500">
                  {f.label}
                  {!f.required && <span className="text-zinc-400"> (optional)</span>}
                </label>
                <select
                  value={f.value}
                  onChange={(e) => f.set(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-2xl bg-zinc-100 px-4 py-3 text-[15px] text-zinc-900 outline-none focus:ring-2 focus:ring-brand-400"
                >
                  <option value={-1}>— nicht zugeordnet —</option>
                  {headers.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `Spalte ${i + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            ))}

            {accounts.length > 0 && (
              <div className="mt-4">
                <label className="block text-[13px] font-medium text-zinc-500">
                  Konto (optional)
                </label>
                <select
                  value={accountId ?? ''}
                  onChange={(e) => setAcc(e.target.value || null)}
                  className="mt-1.5 w-full rounded-2xl bg-zinc-100 px-4 py-3 text-[15px] text-zinc-900 outline-none focus:ring-2 focus:ring-brand-400"
                >
                  <option value="">— keins —</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={buildReview}
              disabled={!mappingValid || busy}
              className="mt-5 w-full rounded-2xl bg-brand-600 py-3.5 text-[15px] font-semibold text-white transition-opacity duration-150 active:opacity-80 disabled:opacity-40"
            >
              {busy ? 'Prüfe…' : 'Weiter zur Prüfung'}
            </button>
          </>
        )}

        {/* ---------- Schritt 3: Review ---------- */}
        {step === 'review' && (
          <>
            <div className="mt-3 rounded-2xl bg-zinc-50 px-4 py-3">
              <p className="text-[13px] text-zinc-600">
                <span className="font-semibold text-zinc-900">{stats.sel}</span> von {stats.total}{' '}
                Zeilen ausgewählt
              </p>
              {stats.dups > 0 && (
                <p className="mt-0.5 text-[12px] leading-snug text-amber-700">
                  {stats.dups} mögliche Dublette(n) gefunden und vorsorglich abgewählt. Du
                  entscheidest.
                </p>
              )}
            </div>

            <ul className="mt-3 max-h-[46vh] space-y-1.5 overflow-y-auto">
              {rows.map((r, i) => (
                <li key={i}>
                  <button
                    onClick={() => toggle(i)}
                    className={
                      'flex w-full items-start gap-3 rounded-2xl p-3 text-left transition-colors duration-150 ' +
                      (r.include ? 'bg-white shadow-soft' : 'bg-zinc-100/70')
                    }
                  >
                    <span
                      className={
                        'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[11px] font-bold ' +
                        (r.include
                          ? 'border-brand-600 bg-brand-600 text-white'
                          : 'border-zinc-300 text-transparent')
                      }
                    >
                      ✓
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium text-zinc-900">
                        {r.description || '(ohne Beschreibung)'}
                      </span>
                      <span className="mt-0.5 block text-[12px] text-zinc-400">
                        {formatDate(r.date)}
                      </span>
                      {r.duplicateOf && (
                        <span className="mt-1 block rounded-lg bg-amber-50 px-2 py-1 text-[11px] leading-snug text-amber-700">
                          Sieht aus wie „{r.duplicateOf.description || 'ohne Beschreibung'}" vom{' '}
                          {formatDate(r.duplicateOf.date)}
                        </span>
                      )}
                    </span>
                    <span
                      className={
                        'shrink-0 text-[14px] font-semibold tabular-nums ' +
                        (r.type === 'income' ? 'text-emerald-600' : 'text-zinc-900')
                      }
                    >
                      {r.type === 'income' ? '+' : '−'}
                      {formatMoney(r.amount)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            <button
              onClick={runImport}
              disabled={busy || stats.sel === 0}
              className="mt-4 w-full rounded-2xl bg-brand-600 py-3.5 text-[15px] font-semibold text-white transition-opacity duration-150 active:opacity-80 disabled:opacity-40"
            >
              {busy ? 'Importiere…' : `${stats.sel} Umsätze importieren`}
            </button>
            <button
              onClick={() => setStep('map')}
              disabled={busy}
              className="mt-2 w-full rounded-2xl py-3 text-[15px] font-medium text-zinc-500 transition-colors duration-150 active:bg-zinc-100"
            >
              Zurück
            </button>
          </>
        )}
      </div>
    </BottomSheet>
  )
}
