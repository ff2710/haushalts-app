# All-in-One Finanz- & Haushalts-App — Bauplan

_Stand: 2026-07-29. Geplant in Cowork OS (Jarvis), gebaut in Claude Code in diesem Repo. Nach jedem Feature-Häppchen den globalen `code-reviewer`-Agent laufen lassen. Aktueller Fortschritt steht nicht hier, sondern in `Cowork OS/Persönliche Finanzen/Finanztracker.md`._

## 1. Ziel & Entscheidung

Aus zwei getrennten Apps wird **eine**: die ultimative persönliche Finanz- und Haushalts-WebApp für Fidel — und so gebaut, dass **Caro sie ebenfalls für ihre eigenen persönlichen Finanzen** nutzen kann.

**Bau-Stamm ist dieses Repo (die bisherige Haushalts-App).** Grund: Die Infrastruktur, die der alte Finanztracker-Plan erst aufbauen wollte, läuft hier bereits — Supabase (Auth, Postgres, Realtime, Storage), mobil-first UI, GitHub-Pages-Auto-Deploy. Der alte **Finanztracker** (Original: `dev-workspace/finanztracker/`, lokal + SQLite, nie deployed) liefert nur die **Logik**, die hierher portiert wird; er wird nicht weitergebaut.

**Logik-Quelle liegt im Repo:** Ein eingefrorener Referenz-Schnappschuss des Finanztracker-Quellcodes liegt unter `docs/finanztracker-reference/` (nur Nachschlagen, nicht bauen/deployen). Claude Code portiert aus diesem lokalen Ordner — kein ordnerübergreifender Zugriff nötig. Details/Dateiübersicht: `docs/finanztracker-reference/README.md`. Nach Phasen 1–3 löschbar.

**Zwei-Bereiche-Modell (bestätigt mit Fidel):**

- **Gemeinsam** — geteilter Bereich, beide sehen alles. Enthält die bestehende Einkaufsliste und die gemeinsamen Ausgaben (Splitwise-Saldo, wer-schuldet-wem, PayPal/bar). Bleibt weitgehend wie jetzt.
- **Persönlich** — privater Bereich pro Person, strikt isoliert (`owner_id = auth.uid()`). Hier lebt der portierte Finanztracker: Konten, Spar-Kaskade, Budgets, Töpfe, Prognose, Abo-Tracker, Vermögen/ETF, Reports. Fidel sieht nur seins, Caro nur ihrs.

Bewusst **schlank gehalten**: kein schweres Drei-Wege-Haushaltsmodul mit itemized Settle-up. Das Gemeinschaftskonto ist ein *geteiltes Konto*, das in beiden Ansichten referenziert wird; die monatliche Pauschale ist ein geplanter Transfer in der persönlichen Kaskade jeder Person. Falls später doch feineres Splitting gewünscht ist, wird es additiv draufgesetzt.

## 2. Ausgangslage (was schon steht)

Bestehendes Repo (React · TS · Vite · Tailwind · Supabase · framer-motion · dnd-kit), live auf GitHub Pages, Auto-Deploy bei Push auf `main`.

Bestehende Tabellen (alle aktuell **geteilt**, RLS `authenticated_all`, Personen hart als `A`/`B`): `settings`, `stores`, `categories`, `shopping_items`, `expenses`, `settlements`. Realtime aktiv.

Bestehende Features: Einkaufsliste (Läden/Kategorien, Drag&Drop, 3 Ansichten), Finanzen à la Splitwise (Ausgaben, Live-Saldo, Ausgleich, Verlauf), Settings/Profile.

Der zu portierende Finanztracker hat: `categories`, `transactions`, `monthly_plan`, `savings_goals`, `fixed_costs`, `recurring_income`, `variable_estimates`, `import_batches` — plus regelbasierte Dubletten-Erkennung, Monatsend-Prognose, CSV-Import.

## 3. Zielarchitektur

### Scoping / Sicherheit (Grundlage für alles)

Der Knackpunkt: Das bestehende Modell kennt keine echte Nutzer-Trennung (ein geteilter Datensatz für beide). Der **Persönlich-Bereich** braucht echte Isolation.

- Jede private Tabelle bekommt `owner_id uuid not null references auth.users(id) default auth.uid()`.
- RLS-Policy privat: `using (owner_id = auth.uid()) with check (owner_id = auth.uid())`. Kein Fremdzugriff, auch nicht durch die Partnerin.
- Geteilte Tabellen bleiben `authenticated_all` (Gemeinsam-Bereich).
- Kein Service-Role-Key im Frontend. `.env` nur `VITE_SUPABASE_URL` + Anon-Key. Explizit gegen RLS-Leaks testen (User B darf Zeilen von User A **nie** sehen).

### Datenmodell Persönlich-Bereich (neu, Supabase/Postgres)

Port + Erweiterung des Finanztrackers, alles `owner_id`-scoped:

- `pf_accounts` — Konten: DKB Giro (Hub), Gemeinschaftskonto (Referenz/geteilt), Ayvens Tagesgeld, Kreditkarte, Extra-Tagesgeld (Jahresabos), Depot, Festgeld. Felder: `type`, `name`, `is_hub`, `is_shared_ref`.
- `pf_transactions` — Umsätze. Betrag **immer positiv**, Richtung über `type` (`income`|`expense`). Verweis auf `pf_accounts` + Kategorie.
- `pf_categories`, `pf_fixed_costs`, `pf_recurring_income`, `pf_variable_estimates`, `pf_monthly_plan` — Port aus Finanztracker. `pf_categories` bekommt in Phase 2.5 zusätzlich `parent_id` (Unterkategorien, siehe dort).
- ~~`pf_budgets`~~ — **verworfen in Phase 2.** Das Budget liegt bereits als `pf_categories.monthly_budget` im Port; eine zweite Tabelle wären zwei Quellen für denselben Wert. Die Warnschwelle sitzt stattdessen als `pf_categories.warn_ratio` an derselben Zeile.
- `pf_pots` — Tagesgeld-Töpfe (Notgroschen, Urlaub, Gönnerreserve, Jahresabo, Festgeld), mit Zielbetrag + `priority` (Reihenfolge des Befüllens), Zuordnung zu einem `pf_accounts`.
- `pf_allocation_steps` — die konfigurierbare Spar-Kaskade (geordnete Stufen, siehe §4 Phase 3).
- `pf_debts` — Schulden bei Bekannten (Kaskadenstufe „Schuldentilgung").
- `pf_subscriptions` — Abos/Verträge: Betrag, Zyklus, nächste Fälligkeit, Kündigungsfrist.
- `pf_investments` — ETF-/Depot-Positionen, Festgeld; für Vermögensübersicht.
- `pf_account_flows` — Nodes (Konten) + Edges (regelmäßige Flüsse) fürs editierbare Konten-Board.
- `pf_import_batches` — Import als rückgängig machbarer Batch.

## 4. Feature-Reihenfolge (Review-Häppchen)

Jede Phase ist ein abgeschlossenes, testbares Häppchen. Nach jeder: `code-reviewer` + Verifikation, dann Deploy, dann nächste Phase. Reihenfolge = Priorität; früh Nutzbares zuerst.

**Phase 0 — Fundament Persönlich-Bereich (Walking Skeleton)**
**Allererster Schritt: vollständiges Supabase-Backup/Export der Live-Daten ziehen** (Einkaufsliste, Ausgaben, Ausgleich) — Sicherheitsnetz, bevor irgendeine Schema-Änderung passiert. Die bestehenden Gemeinsam-Tabellen bleiben **unangetastet**; die private Ebene wird rein additiv daneben angelegt. Dann: Per-User-Scoping-Pattern (`owner_id` + RLS) einführen. App-Shell um Tab-Trennung **Gemeinsam / Persönlich** erweitern (Bottom-Nav). Persönlich zunächst leerer Platzhalter.
_Verify:_ Vor/nach dem Schema-Migrationsschritt sind Einkaufsliste, Ausgaben und Saldo unverändert (Zeilen-Zähler + Stichprobe); zwei Testnutzer → privater Bereich strikt isoliert; Gemeinsam-Bereich weiter geteilt; bestehende Features unverändert.

**Phase 1 — Persönlich: Konten + Transaktionen (Kern)**
`pf_accounts` + Kontenverwaltung. `pf_transactions` + Schnellerfassung + Liste + Kategorien. CSV-Import + **deterministische** Dubletten-Erkennung portieren (Regel: gleicher Betrag + Datum ±3 Tage + normalisierter Text → Review-Screen, Mensch entscheidet, nichts still doppelt/gelöscht). Zusätzlich (kleiner, unabhängiger Baustein): **Passwort-Reset-Flow** — „Passwort vergessen" auf dem Login (Supabase `resetPasswordForEmail`) + Recovery-Screen zum Neusetzen. Schließt die Lücke, die heute manuelle DB-Handarbeit nötig macht.
_Verify:_ Umsätze erfassen/importieren; verdächtige Dubletten landen im Review; Import als Batch rückgängig machbar; „Passwort vergessen" schickt Mail und Neusetzen funktioniert.

**Phase 2 — Persönlich: Fixkosten, Einnahmen, Budgets, Prognose**
`pf_fixed_costs`, `pf_recurring_income`, `pf_variable_estimates`, `pf_monthly_plan` portieren. Kategorie-Budgets + Warnungen (neu). Monatsend-Prognose-Dashboard.
_Verify:_ Prognose deckt sich mit unabhängiger Nachrechnung (programmatisch prüfen).

**Phase 2.5 — Analyse-Ansicht: Sankey + Donut (Unterkategorien)**
Vorbild ist der Finanzfluss-Copilot-Cashflow-Analyzer (Referenz-Screenshots liegen bei Fidel). Bewusst **vor** Phase 3 eingeschoben: baut nur auf Daten, die seit Phase 1/2 schon da sind, ist also sofort nutzbar; die Schema-Änderung an `pf_categories` ist jetzt billiger als nachdem die Kaskade darauf aufsetzt; und der Sankey-Baustein wird in Phase 4 wiederverwendet.

- **Schema:** `pf_categories.parent_id uuid references pf_categories(id)` — self-referencing, additiv. **Maximal 2 Ebenen** (Haupt- → Unterkategorie); per Check/Trigger absichern, dass eine Unterkategorie nicht selbst Elternteil wird. Ergibt im Sankey mit den Einnahme-Strömen 3 sichtbare Ausgabe-Ebenen (Einnahmen → Budget → Hauptkategorie → Unterkategorie), genau wie in der Referenz.
- **Achtung, bestehender Index:** `pf_categories_owner_name_type_key` ist heute `(owner_id, name, type)`. Mit Unterkategorien muss derselbe Name unter verschiedenen Eltern erlaubt sein („Transport" unter Mobilität *und* unter Reisen). Index auf `(owner_id, parent_id, name, type)` erweitern — und dabei beachten, dass Postgres NULLs standardmäßig als verschieden behandelt: für Hauptkategorien (`parent_id is null`) sonst Duplikate möglich. Also `nulls not distinct` (PG 15+) oder Ausdrucks-Index über `coalesce(parent_id, ...)`.
- **Farbsystem:** eine Basisfarbe je Hauptkategorie (steckt schon in `pf_categories.color`), Unterkategorien als abgestufte Helligkeits-/Sättigungsvarianten daraus abgeleitet — nicht frei wählbar, sonst zerfällt die visuelle Zuordnung. Ableitung deterministisch in einer Hilfsfunktion, nicht pro Komponente.
- **Sankey:** Einnahmen-Ströme links → Budget-Knoten → Hauptkategorie → Unterkategorie. Hover hebt den Pfad hervor und dimmt den Rest (Referenz-Screenshot 3). Klick auf einen Knoten öffnet ein Seitenpanel mit den Transaktionen dieser (Unter-)Kategorie im gewählten Zeitraum (Screenshot 4) — dafür existiert mit `BottomSheet`/`Modal` schon Infrastruktur.
- **Donut** darunter: Umschalter Ausgaben / Einnahmen / Unterkategorien, plus Kategorieliste mit Beträgen und Anzahl Buchungen daneben (Screenshot 5).
- **€/%-Toggle** oben rechts, wirkt auf Sankey *und* Donut. Standard: €.
- **Zeitraum:** Monat / Quartal / Jahr + Vor-/Zurück-Blättern, dazu Kopfzeile mit Einnahmen, Ausgaben, Saldo, Gespart, Sparquote (Screenshot 1). Die Werte kommen aus vorhandener Logik (`forecast.ts`, `budget.ts`) — nicht neu herleiten.
- **Bibliothek:** Das Repo hat **keine** Chart-Bibliothek (nur dnd-kit + framer-motion), und Icons sind bewusst handgezeichnet in `ui/Icon.tsx`. Passend dazu: `d3-sankey` + `d3-shape` (winzig, liefert das Layout und `arc()` für den Donut gleich mit), gerendert als eigenes SVG. Kein recharts/Chart.js — ein ganzes Chart-Framework für zwei Diagramme wäre für eine Mobile-App zu teuer und stilistisch ein Fremdkörper.
- **Mobile-first ist hier der Knackpunkt:** Die Referenz ist Desktop. Ein 4-spaltiger Sankey mit Textlabels ist auf einem Telefon unlesbar. Vor dem Bauen entscheiden, was auf schmalen Screens passiert — Vorschlag: unter `sm` nur Einnahmen → Hauptkategorie zeigen und per Tap in eine Hauptkategorie hineinzoomen (dann deren Unterkategorien), statt alles gleichzeitig zu quetschen. Querformat/Scroll als Notlösung ist schlechter.
- **Nebenbei, unabhängig und klein:** Im Gemeinsam-Bereich den Tab „Finanzen" in **„Split"** umbenennen und das Symbol von `EuroIcon` auf ein neues Waage-/Gleichgewichts-Icon wechseln. Nur Label + Icon in `App.tsx` und ein neues `ScaleIcon` in `ui/Icon.tsx` im Stil der übrigen Line-Icons; die interne Tab-ID `'finance'` und der Ordner `components/Finance/` bleiben, um den Diff klein zu halten.

_Verify:_ Summen im Sankey stimmen exakt mit dem Donut und den Kopfzahlen überein (Kanten einer Ebene summieren sich auf ihren Elternknoten, programmatisch prüfen); Kategorien ohne Unterkategorie erscheinen trotzdem korrekt; €- und %-Ansicht beschreiben dieselben Daten (Prozente summieren sich auf 100); Klick-Panel zeigt genau die Buchungen, die in die Kante eingeflossen sind; Darstellung auf schmalem Viewport geprüft (Screenshot), nicht nur auf Desktop.

**Phase 3 — Spar-Kaskade + Töpfe (Herzstück)**
`pf_pots` (Ziel + Reihenfolge). `pf_allocation_steps`: konfigurierbare Prioritäts-Kaskade in der Reihenfolge Fixkosten → Gemeinsam-Pauschale → Jahresabo-Rücklage → Alltag/Freizeit → Schuldentilgung (`pf_debts`) → Töpfe (Notgroschen → Urlaub → Gönner) → Altersvorsorge. Engine: prognostiziertes Rest-Geld entlang der Kaskade verteilen und pro Stufe/Topf zeigen, wieviel diesen Monat reinfließt.
**Gehört mit in diese Phase, nicht daneben:** Die **50/30/20-Ansicht** (Zielbalken + Verlauf auf `pf_categories.planning_bucket`, in Phase 2.5 vorgezogen) ist die Lesart genau der Buckets, in die die Kaskade einzahlt — und die **Schuldentilgung** als Fortschrittstracker ist die Kaskadenstufe `pf_debts`. Beides als Teil von Phase 3 bauen. Separat gebaut entstehen zwei halbe Allokationslogiken, die sich später widersprechen.

_Verify:_ Kaskade rechnet korrekt durch und deckt sich mit dem abgestimmten Flowchart; Restgeld-Logik stimmt bei Kantenfällen (zu wenig Geld, Topf voll). 50/30/20-Ansicht und Kaskade beziehen ihre Bucket-Summen aus derselben Quelle (keine zweite Rechenstelle).

**Phase 4 — Konten-Flow-Board (editierbar, „Miro mit Rahmen")**
`pf_account_flows`: grafische, per Drag anpassbare Darstellung der Geldflüsse zwischen den Konten (dnd-kit ist vorhanden). Vorgegebener Rahmen (DKB-Hub zentral), Nodes/Edges anpassbar, Anordnung persistiert.
_Nicht verwechseln mit dem Sankey aus Phase 2.5:_ dort fließt Geld nach **Kategorien**, hier zwischen **Konten**, und hier ist es editierbar. Gleiche Optik, andere Daten — die Render-/Farb-Bausteine aus 2.5 wiederverwenden statt neu bauen.
_Verify:_ Board bildet Fidels reale Kontenlandschaft ab; Anpassungen bleiben nach Reload erhalten.

**Phase 5 — Abo-/Vertrags-Tracker**
`pf_subscriptions`: wiederkehrende Zahlungen aus `pf_transactions` erkennen; Jahresabos, Kündigungsfristen, Reminder. Speist die Jahresabo-Rücklage in der Kaskade (Phase 3).
_Verify:_ Erkennt wiederkehrende Zahlungen zuverlässig; Fristen-Übersicht korrekt.

**Phase 6 — Vermögen: ETF/Depot + Übersicht**
`pf_investments`: ETF-Positionen, Festgeld, Netto-Vermögen über Zeit. Altersvorsorge-Zielsplit 70 % ETF / 30 % Festgeld abbildbar. Kurse zunächst manuell, API später (offene Entscheidung).
_Verify:_ Vermögensübersicht summiert korrekt über alle Konten/Positionen.

**Phase 7 — Reports & Export + Automatischer Bank-Import**
Monats-/Jahresberichte, PDF-/CSV-Export. Automatischer Bank-Import: Methode offen (FinTS/HBCI vs. Aggregator wie GoCardless Bank Account Data / Tink / finAPI) — Datenschutz + evtl. Kosten prüfen. Bis dahin bleibt CSV-Import der Weg.
_Verify:_ Report-Zahlen stimmen mit Dashboard überein.

**Querschnitt (durchgängig, nicht am Ende):**
- **Sicherheit:** RLS strikt testen (privat = nur eigener `auth.uid()`), kein Secret im Frontend.
- **Backup:** „Backup jetzt"-Funktion, die den kompletten Datenbestand als JSON/CSV exportiert; zusätzlich regelmäßiger Supabase-Export. Bei Geld nicht verhandelbar. **Repo ist öffentlich → Backups/Exporte nie in den Repo-Baum** (außerhalb ablegen; `docs/backups/` gitignored).
- **Navigation/IA:** IA-Pass ist **erledigt** (28.07.) — Einstellungen hängen global im Header statt in einem Gemeinsam-Tab, Tab-Titel/Icons je Welt klar unterscheidbar. Bleibt als Daueraufgabe: Jede weitere Phase bringt Persönlich-Tabs dazu (Kaskade, Töpfe, Vermögen, Reports); eine Tab-Leiste skaliert nicht auf 6+, also rechtzeitig gruppieren statt endlos anhängen. Offen aus der Ideensammlung: Gemeinsam-Tab „Finanzen" → **„Split"** samt Waage-Icon (Details in Phase 2.5).

## 5. Offene Entscheidungen (nicht blockierend, im Bau zu klären)

- **App-Name:** Repo + Live-URL (`ff2710.github.io/haushalts-app`) behalten (spart CI-/Deploy-Umbau), aber neuer **Anzeigename**, da es keine reine Haushalts-App mehr ist. Vorschläge sammeln.
- **Bank-Import (Phase 7):** FinTS vs. Aggregator — Kosten/Datenschutz.
- **ETF-Kursquelle (Phase 6):** manuell vs. API.
- **Migration bestehender Daten:** Fidels lokale `finanztracker.db` — einmalig nach Supabase importieren oder frisch starten?

## 6. Nicht verhandelbare Prinzipien (bei Geld)

- **Bestandsdaten unantastbar:** Die Live-Daten der Gemeinsam-Tabellen (Einkaufsliste, Ausgaben, Ausgleich/Saldo) werden **nie gelöscht oder überschrieben**, sondern übernommen. Schema-Änderungen sind additiv & idempotent — kein `drop`/`rewrite` bestehender Tabellen oder Spalten, keine destruktiven Migrationen. Der aktuelle Schuldenstand wird aus `expenses` + `settlements` berechnet und bleibt damit erhalten, solange diese Tabellen unangetastet bleiben.
- Beträge in Transaktionen **immer positiv**, Richtung über `type`. Nie negative Beträge in der DB.
- Dubletten-Erkennung **deterministisch/regelbasiert**, nie geraten. Verdächtiges in den Review-Screen; Mensch entscheidet.
- Löschen/Überschreiben von Finanzdaten immer nachvollziehbar (Import = rückgängig machbarer Batch).
- Privatdaten strikt per RLS isoliert — die Partnerin sieht sie nie.
- Vor „fertig" je Häppchen: `code-reviewer`.
