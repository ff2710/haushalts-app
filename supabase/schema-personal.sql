-- ============================================================================
-- Persoenlich-Bereich (pf_ = personal finance) — Phase 0: Fundament
--
-- REIN ADDITIV. Diese Datei fasst die Gemeinsam-Tabellen (settings, stores,
-- categories, shopping_items, expenses, settlements, units, profiles) NICHT an:
-- kein drop, kein alter, kein rewrite. Sie legt ausschliesslich neue
-- pf_-Tabellen daneben an.
--
-- Idempotent: mehrfaches Ausfuehren ist gefahrlos (create ... if not exists,
-- drop policy if exists vor jedem create policy, Publication mit Exception).
--
-- Sicherheitsmodell (Gegenstueck zu "authenticated_all" in schema.sql):
--   owner_id uuid not null default auth.uid()  -> vom Server gesetzt
--   Policy "owner_only": using/with check (owner_id = auth.uid())
-- Damit sieht jede Person ausschliesslich ihre eigenen Zeilen. Die Partnerin
-- sieht Privatdaten nie. Das Frontend sendet owner_id NIE selbst mit.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Konten (pf_accounts)
--    is_hub          : Zentrales Verrechnungskonto (DKB Giro) — genau eines.
--    is_shared_ref   : Referenz auf das Gemeinschaftskonto. Nur Anzeige/Bezug,
--                      die gemeinsamen Daten leben weiter im Gemeinsam-Bereich.
-- ---------------------------------------------------------------------------
create table if not exists public.pf_accounts (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name           text not null,
  type           text not null default 'giro'
                 check (type in ('giro','tagesgeld','kreditkarte','depot','festgeld','bar','sonstiges')),
  is_hub         boolean not null default false,
  is_shared_ref  boolean not null default false,
  position       double precision not null default 0,
  created_at     timestamptz not null default now()
);

create index if not exists pf_accounts_owner_idx on public.pf_accounts(owner_id);

-- Hoechstens ein Hub-Konto je Person (Teil-Index, greift nur bei is_hub).
create unique index if not exists pf_accounts_one_hub_per_owner
  on public.pf_accounts(owner_id) where is_hub;

-- ---------------------------------------------------------------------------
-- 2. Kategorien (pf_categories)
--    Port aus finanztracker db.js. BEWUSST eigenstaendig neben der geteilten
--    public.categories — die gehoert der Einkaufsliste. Nicht vermischen.
--    UNIQUE(name,type) des Originals wird pro Person eindeutig.
-- ---------------------------------------------------------------------------
create table if not exists public.pf_categories (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name            text not null,
  type            text not null check (type in ('income','expense')),
  color           text not null default '#8884d8',
  monthly_budget  numeric(12,2) check (monthly_budget is null or monthly_budget >= 0),
  created_at      timestamptz not null default now()
);

create index if not exists pf_categories_owner_idx on public.pf_categories(owner_id);

create unique index if not exists pf_categories_owner_name_type_key
  on public.pf_categories(owner_id, name, type);

-- Hinweis: Die Standard-Kategorien (Gehalt, Lebensmittel, ...) werden NICHT
-- hier geseedet, sondern beim ersten Oeffnen pro Person in der App angelegt —
-- ein globaler Seed haette keinen owner_id.

-- ---------------------------------------------------------------------------
-- Zusammengesetzte Eindeutigkeit (owner_id, id) — Ziel fuer die Fremdschluessel
-- weiter unten. Damit kann eine Transaktion NUR auf ein Konto/eine Kategorie
-- derselben Person zeigen. Reine FKs auf (id) wuerden das nicht verhindern:
-- Fremdschluessel-Pruefungen umgehen RLS, jemand koennte also eine fremde UUID
-- unterschieben. Diese Constraint schliesst das serverseitig aus.
-- ---------------------------------------------------------------------------
create unique index if not exists pf_accounts_owner_id_key
  on public.pf_accounts(owner_id, id);

create unique index if not exists pf_categories_owner_id_key
  on public.pf_categories(owner_id, id);

-- ---------------------------------------------------------------------------
-- 3. Import-Batches (pf_import_batches)
--    Ein CSV-Import ist ein Batch und bleibt dadurch rueckgaengig machbar:
--    Batch loeschen -> zugehoerige Transaktionen verschwinden (cascade).
--    Muss VOR pf_transactions stehen (Fremdschluessel-Ziel).
-- ---------------------------------------------------------------------------
create table if not exists public.pf_import_batches (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade default auth.uid(),
  filename    text not null,
  row_count   integer not null default 0 check (row_count >= 0),
  imported_at timestamptz not null default now()
);

create index if not exists pf_import_batches_owner_idx
  on public.pf_import_batches(owner_id, imported_at desc);

create unique index if not exists pf_import_batches_owner_id_key
  on public.pf_import_batches(owner_id, id);

-- ---------------------------------------------------------------------------
-- 4. Transaktionen (pf_transactions) — Port aus finanztracker db.js
--
--    NICHT VERHANDELBAR: amount ist IMMER >= 0. Die Richtung steckt
--    ausschliesslich in `type` (income|expense). Nie negative Betraege.
--
--    dedup_key: stabiler Schluessel aus date|type|cents|normalisiertem Text
--    (siehe src/lib/dedup.ts). Das +/-3-Tage-Fenster wird beim Import
--    zusaetzlich per Abfrage geprueft.
--    source_ref: Herkunft uebernommener Buchungen (z. B. "fixed_cost:3"),
--    fuer eintragsgenaue Idempotenz ab Phase 2.
-- ---------------------------------------------------------------------------
create table if not exists public.pf_transactions (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users(id) on delete cascade default auth.uid(),
  date            date not null,
  type            text not null check (type in ('income','expense')),
  amount          numeric(12,2) not null check (amount >= 0),
  description     text not null default '',
  account_id      uuid,
  category_id     uuid,
  import_batch_id uuid,
  source          text not null default 'manual' check (source in ('manual','csv')),
  source_ref      text,
  dedup_key       text not null,
  created_at      timestamptz not null default now(),

  -- Verweise nur auf EIGENE Zeilen (siehe Kommentar oben).
  constraint pf_transactions_account_fk
    foreign key (owner_id, account_id)
    references public.pf_accounts(owner_id, id)
    on delete set null (account_id),

  constraint pf_transactions_category_fk
    foreign key (owner_id, category_id)
    references public.pf_categories(owner_id, id)
    on delete set null (category_id),

  constraint pf_transactions_batch_fk
    foreign key (owner_id, import_batch_id)
    references public.pf_import_batches(owner_id, id)
    on delete cascade
);

create index if not exists pf_transactions_owner_date_idx
  on public.pf_transactions(owner_id, date desc);

create index if not exists pf_transactions_owner_dedup_idx
  on public.pf_transactions(owner_id, dedup_key);

create index if not exists pf_transactions_owner_batch_idx
  on public.pf_transactions(owner_id, import_batch_id);

-- ---------------------------------------------------------------------------
-- 5. Planungs-Ebene (Phase 2) — Port aus finanztracker db.js
--
--    Monate durchgaengig als 'YYYY-MM' (Konvention aus CLAUDE.md), per
--    Check-Constraint abgesichert, damit die Prognose-Logik sich darauf
--    verlassen kann.
-- ---------------------------------------------------------------------------

-- Budget-Warnschwelle. Das Budget selbst steckt bereits in
-- pf_categories.monthly_budget (Port aus dem Finanztracker) — bewusst KEINE
-- zweite Budget-Tabelle, sonst gaebe es zwei Quellen fuer denselben Wert.
alter table public.pf_categories
  add column if not exists warn_ratio numeric(4,2) not null default 0.80
    check (warn_ratio > 0 and warn_ratio <= 1);

create table if not exists public.pf_fixed_costs (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name         text not null,
  amount       numeric(12,2) not null check (amount >= 0),
  cadence      text not null default 'monthly'
               check (cadence in ('monthly','quarterly','half_yearly','yearly','once')),
  due_month    text check (due_month   is null or due_month   ~ '^\d{4}-\d{2}$'),
  start_month  text check (start_month is null or start_month ~ '^\d{4}-\d{2}$'),
  -- auf einen Monatsbeitrag umrechnen statt erst im Faelligkeitsmonat buchen
  amortize     boolean not null default true,
  category_id  uuid,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),

  constraint pf_fixed_costs_category_fk
    foreign key (owner_id, category_id)
    references public.pf_categories(owner_id, id)
    on delete set null (category_id)
);

create index if not exists pf_fixed_costs_owner_idx on public.pf_fixed_costs(owner_id);

create table if not exists public.pf_recurring_income (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  -- Ergaenzung gegenueber der Referenz: dort haengt die Anzeige allein an der
  -- Kategorie, wodurch zwei Einnahmen derselben Kategorie ununterscheidbar sind.
  name         text not null default '',
  amount       numeric(12,2) not null check (amount >= 0),
  start_month  text not null check (start_month ~ '^\d{4}-\d{2}$'),
  end_month    text check (end_month is null or end_month ~ '^\d{4}-\d{2}$'),
  category_id  uuid,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),

  constraint pf_recurring_income_category_fk
    foreign key (owner_id, category_id)
    references public.pf_categories(owner_id, id)
    on delete set null (category_id)
);

create index if not exists pf_recurring_income_owner_idx on public.pf_recurring_income(owner_id);

-- Grobe Schaetzposten fuers Variable (Referenz seedet "Leben"/"Spass").
create table if not exists public.pf_variable_estimates (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name       text not null,
  amount     numeric(12,2) not null default 0 check (amount >= 0),
  created_at timestamptz not null default now()
);

create index if not exists pf_variable_estimates_owner_idx
  on public.pf_variable_estimates(owner_id);

-- Monatsplan: laut Bauplan Teil des Phase-2-Ports. Aktuell noch ohne
-- Oberflaeche — die Prognose braucht ihn nicht (sie rechnet aus Einnahmen,
-- Fixkosten und Schaetzposten, genau wie das Original). Liegt bereit fuer eine
-- spaetere "Plan gegen Ist"-Ansicht.
create table if not exists public.pf_monthly_plan (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users(id) on delete cascade default auth.uid(),
  year_month      text not null check (year_month ~ '^\d{4}-\d{2}$'),
  planned_income  numeric(12,2) not null default 0 check (planned_income  >= 0),
  planned_expense numeric(12,2) not null default 0 check (planned_expense >= 0),
  notes           text not null default '',
  created_at      timestamptz not null default now()
);

-- Je Person hoechstens ein Plan pro Monat (Referenz: UNIQUE year_month).
create unique index if not exists pf_monthly_plan_owner_month_key
  on public.pf_monthly_plan(owner_id, year_month);

-- ---------------------------------------------------------------------------
-- 6. Unterkategorien (Phase 2.5) — pf_categories.parent_id
--
--    Genau ZWEI Ebenen: Hauptkategorie (parent_id is null) -> Unterkategorie.
--    Eine Unterkategorie darf nie selbst Elternteil werden. Ein Check-Constraint
--    kann das nicht leisten (er sieht nur die eigene Zeile) — deshalb der
--    Trigger weiter unten.
--
--    Rein additiv: neue Spalte, neue Constraints, neuer Index. Bestehende
--    Zeilen bleiben unveraendert Hauptkategorien (parent_id bleibt null).
-- ---------------------------------------------------------------------------
alter table public.pf_categories
  add column if not exists parent_id uuid;

-- Verweis nur auf eine EIGENE Kategorie — gleiches Muster wie bei den
-- Transaktionen: Fremdschluessel-Pruefungen umgehen RLS, ein FK auf (id) allein
-- liesse also eine fremde UUID durch. Deshalb ueber (owner_id, id).
--
-- Beim Loeschen einer Hauptkategorie werden ihre Unterkategorien wieder zu
-- Hauptkategorien (set null), statt still mit geloescht zu werden.
-- Randfall: traegt dann eine hochgestufte Unterkategorie denselben Namen wie
-- eine bestehende Hauptkategorie, scheitert das Loeschen am Unique-Index
-- weiter unten. Das ist gewollt — lieber eine sichtbare Fehlermeldung als
-- stilles Verschwinden von Kategorien.
--
-- "add constraint" kennt kein "if not exists"; das do-Block-Muster mit
-- duplicate_object macht es idempotent.
do $$
begin
  alter table public.pf_categories
    add constraint pf_categories_parent_fk
    foreign key (owner_id, parent_id)
    references public.pf_categories(owner_id, id)
    on delete set null (parent_id);
exception
  when duplicate_object then null;  -- bereits vorhanden
end $$;

do $$
begin
  alter table public.pf_categories
    add constraint pf_categories_no_self_parent
    check (parent_id is null or parent_id <> id);
exception
  when duplicate_object then null;
end $$;

create index if not exists pf_categories_owner_parent_idx
  on public.pf_categories(owner_id, parent_id);

-- Eindeutigkeit MIT Elternteil: derselbe Name darf unter verschiedenen Eltern
-- vorkommen ("Transport" unter Mobilitaet UND unter Reisen), aber nicht zweimal
-- unter demselben.
--
-- NULLS NOT DISTINCT (PG 15+) ist hier der entscheidende Teil: standardmaessig
-- behandelt Postgres zwei NULL-parent_id als verschieden — zwei gleichnamige
-- HAUPTkategorien waeren dann erlaubt, und der Seed der Standard-Kategorien
-- verloere seine Idempotenz (er verlaesst sich auf die Unique-Verletzung).
create unique index if not exists pf_categories_owner_parent_name_type_key
  on public.pf_categories (owner_id, parent_id, name, type) nulls not distinct;

-- Loest den alten Index ab: (owner_id, name, type) haette denselben Namen unter
-- zwei verschiedenen Eltern verboten. Ein Index traegt keine Daten, und die
-- Eindeutigkeit uebernimmt vollstaendig der Index darueber — fuer
-- Hauptkategorien dank NULLS NOT DISTINCT deckungsgleich mit dem alten.
drop index if exists public.pf_categories_owner_name_type_key;

-- ---------------------------------------------------------------------------
-- 7. Planungs-Topf (50/30/20)
--
--    Die dritte, groebste Ebene ueber der Hauptkategorie — aber KEIN zweiter
--    Baum, sondern eine Spalte an der Kategorie. Damit gibt es genau eine
--    Kette: Buchung -> Unterkategorie -> Hauptkategorie -> Topf. Jeder Euro
--    zaehlt in jeder Ansicht genau einmal, und es gibt nichts abzugleichen.
--
--    Nur an HAUPTkategorien gepflegt; Unterkategorien erben ihn ueber ihr
--    Elternteil, genau wie die Farbe. null = noch nicht zugeordnet.
-- ---------------------------------------------------------------------------
alter table public.pf_categories
  add column if not exists planning_bucket text;

do $$
begin
  alter table public.pf_categories
    add constraint pf_categories_planning_bucket_check
    check (planning_bucket is null or planning_bucket in ('fix','freizeit','sparen'));
exception
  when duplicate_object then null;
end $$;

-- Zwei-Ebenen-Regel + Typgleichheit. Laeuft als aufrufende Rolle (kein
-- security definer), die Abfragen sehen also nur eigene Zeilen — genau richtig,
-- denn Eltern und Kinder gehoeren per FK ohnehin derselben Person.
create or replace function public.pf_categories_enforce_two_levels()
returns trigger
language plpgsql
as $$
declare
  parent_parent uuid;
  parent_type   text;
begin
  -- Die Regel unten prueft per SELECT, ob ein Elternteil selbst Kinder hat.
  -- Zwei gleichzeitige Transaktionen (zwei offene Tabs) koennten sich sonst
  -- gegenseitig ueberholen: A haengt X unter Y, B haengt gleichzeitig Z unter
  -- X — jede sieht den Stand vor der anderen, am Ende steht Y->X->Z. Der
  -- Lock je Person macht solche Umhaengungen zueinander seriell. Er kostet
  -- nichts Messbares (Kategorien aendern sich selten) und ist an Ende der
  -- Transaktion automatisch wieder weg.
  perform pg_advisory_xact_lock(hashtext('pf_categories'), hashtext(new.owner_id::text));

  if new.parent_id is not null then
    select c.parent_id, c.type
      into parent_parent, parent_type
      from public.pf_categories c
     where c.id = new.parent_id;

    if not found then
      raise exception 'Elternkategorie existiert nicht.'
        using errcode = 'foreign_key_violation';
    end if;

    if parent_parent is not null then
      raise exception 'Maximal zwei Ebenen: eine Unterkategorie kann selbst kein Elternteil sein.'
        using errcode = 'check_violation';
    end if;

    if parent_type is distinct from new.type then
      raise exception 'Unter- und Hauptkategorie muessen denselben Typ haben (income/expense).'
        using errcode = 'check_violation';
    end if;

    -- Die andere Richtung derselben Regel: was schon Kinder hat, darf nicht
    -- selbst unter ein Elternteil rutschen.
    if exists (select 1 from public.pf_categories c where c.parent_id = new.id) then
      raise exception 'Diese Kategorie hat Unterkategorien und kann daher selbst keine werden.'
        using errcode = 'check_violation';
    end if;
  end if;

  -- Typwechsel einer Hauptkategorie wuerde ihre Unterkategorien auf dem alten
  -- Typ zuruecklassen — dann stimmten Sankey und Donut nicht mehr ueberein.
  if tg_op = 'UPDATE'
     and new.type is distinct from old.type
     and exists (select 1 from public.pf_categories c where c.parent_id = new.id) then
    raise exception 'Typ laesst sich nicht aendern, solange Unterkategorien daran haengen.'
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists pf_categories_two_levels on public.pf_categories;
create trigger pf_categories_two_levels
  before insert or update on public.pf_categories
  for each row execute function public.pf_categories_enforce_two_levels();

-- ---------------------------------------------------------------------------
-- 8. Bargeld-Bestand
--
--    Bei einem Girokonto ergibt sich der Stand aus den Buchungen. Bargeld
--    zaehlt man dagegen nachschauend im Geldbeutel — dafuer erst Buchungen
--    anzulegen waere genau die Reibung, an der so eine App im Alltag stirbt.
--    Deshalb ein selbst gesetzter Betrag.
--
--    stated_balance gilt ausschliesslich fuer Konten vom Typ 'bar'; bei allen
--    anderen bleibt der Stand aus den Umsaetzen gerechnet.
-- ---------------------------------------------------------------------------
alter table public.pf_accounts
  add column if not exists stated_balance numeric(12,2);

-- Betraege sind auch hier immer positiv — als Zusage der Datenbank, nicht als
-- Konvention des Frontends.
do $$
begin
  alter table public.pf_accounts
    add constraint pf_accounts_stated_balance_check
    check (stated_balance is null or stated_balance >= 0);
exception
  when duplicate_object then null;
end $$;

-- Genau EIN Bargeld-Konto je Person, serverseitig. Die App stellt beim Laden
-- sicher, dass eines existiert; ohne diesen Index koennten zwei gleichzeitig
-- ladende Geraete beide eines anlegen. Gleiches Muster wie beim Hub-Konto.
-- Wer sein Bargeld getrennt fuehren will, nutzt dafuer die Orte weiter unten.
create unique index if not exists pf_accounts_one_cash_per_owner
  on public.pf_accounts(owner_id) where type = 'bar';

-- Optionale Aufteilung auf Orte ("Geldbeutel", "Schublade", "Urlaubskasse").
--
-- Entweder ODER, nie beides: sobald es Orte gibt, ist der Bargeld-Stand ihre
-- Summe und stated_balance wird nicht mehr angezeigt. Zwei sichtbare Zahlen
-- fuer denselben Betrag waeren zwei Quellen der Wahrheit.
create table if not exists public.pf_cash_locations (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade default auth.uid(),
  account_id uuid not null,
  name       text not null,
  amount     numeric(12,2) not null default 0 check (amount >= 0),
  position   double precision not null default 0,
  created_at timestamptz not null default now(),

  -- Nur auf ein EIGENES Konto, gleiches Muster wie ueberall hier.
  constraint pf_cash_locations_account_fk
    foreign key (owner_id, account_id)
    references public.pf_accounts(owner_id, id)
    on delete cascade
);

create index if not exists pf_cash_locations_owner_idx
  on public.pf_cash_locations(owner_id, account_id, position);

-- ---------------------------------------------------------------------------
-- 9. Spar-Kaskade, Toepfe, Schulden (Phase 3)
--
--    Die Kaskade verteilt das prognostizierte Restgeld eines Monats der Reihe
--    nach auf Stufen: erst die Pflichten, dann die Ruecklagen, dann der Rest.
--    Was eine Stufe nicht mehr bekommt, weil das Geld vorher aufgebraucht war,
--    bleibt sichtbar leer — die Kaskade beschoenigt nichts.
--
--    WICHTIG zur Abgrenzung: Fixkosten und die variable Schaetzung sind hier
--    KEINE Stufen. Sie sind bereits vom Restgeld abgezogen (siehe
--    lib/forecast.ts), ein zweites Mal abzuziehen waere Doppelzaehlung.
-- ---------------------------------------------------------------------------

-- Toepfe: Ruecklagen mit Ziel und Befuellreihenfolge.
--
-- current_amount ist wie beim Bargeld ein selbst gesetzter Stand. Ein Topf auf
-- dem Tagesgeldkonto hat keine eigene Buchungshistorie — man schaut nach und
-- traegt ein.
create table if not exists public.pf_pots (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name           text not null,
  -- Zielbetrag; null = ohne Ziel, nimmt auf was kommt. Wenn gesetzt, dann
  -- groesser als null: ein Ziel von 0 waere sofort erreicht und der
  -- Fortschrittsbalken darueber eine Division durch null.
  target_amount  numeric(12,2) check (target_amount is null or target_amount > 0),
  current_amount numeric(12,2) not null default 0 check (current_amount >= 0),
  -- Hoechstens so viel je Monat hineinfuellen; null = kein Deckel.
  monthly_cap    numeric(12,2) check (monthly_cap is null or monthly_cap >= 0),
  -- Kleiner = zuerst befuellen.
  priority       double precision not null default 0,
  account_id     uuid,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),

  constraint pf_pots_account_fk
    foreign key (owner_id, account_id)
    references public.pf_accounts(owner_id, id)
    on delete set null (account_id)
);

create index if not exists pf_pots_owner_idx on public.pf_pots(owner_id, priority);

-- Schulden bei Bekannten. Getilgt wird ueber die Kaskadenstufe 'debts'.
--
-- Bewusst zwei Felder statt eines Restbetrags: der Ausgangsbetrag bleibt
-- stehen, damit der Fortschritt ("1.240 von 3.000 getilgt") ueberhaupt
-- darstellbar ist. Ein blosser Restbetrag verliert diese Bezugsgroesse.
create table if not exists public.pf_debts (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users(id) on delete cascade default auth.uid(),
  creditor       text not null,
  -- Groesser als null: der Ausgangsbetrag ist die Bezugsgroesse jedes
  -- Fortschrittsbalkens ("1.240 von 3.000"), und durch null teilt man nicht.
  initial_amount numeric(12,2) not null check (initial_amount > 0),
  paid_amount    numeric(12,2) not null default 0 check (paid_amount >= 0),
  -- Wunschrate je Monat; null = nimmt, was die Kaskade uebrig laesst.
  monthly_rate   numeric(12,2) check (monthly_rate is null or monthly_rate >= 0),
  priority       double precision not null default 0,
  note           text not null default '',
  active         boolean not null default true,
  created_at     timestamptz not null default now(),

  -- Mehr getilgt als aufgenommen ergibt keinen Sinn und wuerde jeden
  -- Fortschrittsbalken ueber 100 Prozent treiben.
  constraint pf_debts_paid_not_over check (paid_amount <= initial_amount)
);

create index if not exists pf_debts_owner_idx on public.pf_debts(owner_id, priority);

-- Die Stufen der Kaskade, in Reihenfolge.
--
--   fixed   — ein fester Betrag (z. B. Gemeinsam-Pauschale)
--   percent — ein Anteil des ANFAENGLICHEN Restgelds, nicht des Rests an
--             dieser Stelle; sonst haengt die Altersvorsorge davon ab, wie
--             viel die Stufen davor zufaellig verbraucht haben
--   debts   — verteilt auf pf_debts nach priority
--   pots    — verteilt auf pf_pots nach priority
--   rest    — alles, was uebrig ist (Auffangstufe, sinnvollerweise zuletzt)
--
-- Mehrere Stufen derselben Art sind erlaubt und eindeutig: die Engine merkt
-- sich innerhalb eines Durchlaufs, was ein Topf bzw. eine Schuld schon bekommen
-- hat (siehe src/lib/cascade.ts). Eine zweite 'pots'-Stufe findet deshalb nur
-- noch, was die erste offen gelassen hat, statt dieselbe Luecke ein zweites Mal
-- zu fuellen. Gegen Gleichstand bei position/priority sortiert die Engine
-- zusaetzlich nach Name bzw. id, damit die Reihenfolge zwischen zwei
-- Durchlaeufen nicht zufaellig kippt.
create table if not exists public.pf_allocation_steps (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name       text not null,
  kind       text not null check (kind in ('fixed','percent','debts','pots','rest')),
  amount     numeric(12,2) check (amount  is null or amount >= 0),
  percent    numeric(5,2)  check (percent is null or (percent >= 0 and percent <= 100)),
  position   double precision not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now(),

  -- Jede Art braucht genau das Feld, das zu ihr gehoert. Ohne das koennte eine
  -- 'fixed'-Stufe ohne Betrag dastehen und stillschweigend 0 verteilen.
  constraint pf_allocation_steps_shape check (
    (kind = 'fixed'   and amount  is not null and percent is null) or
    (kind = 'percent' and percent is not null and amount  is null) or
    (kind in ('debts','pots','rest') and amount is null and percent is null)
  )
);

create index if not exists pf_allocation_steps_owner_idx
  on public.pf_allocation_steps(owner_id, position);

-- ============================================================================
-- ROW LEVEL SECURITY — die eigentliche Isolation
-- ============================================================================
alter table public.pf_accounts           enable row level security;
alter table public.pf_categories         enable row level security;
alter table public.pf_import_batches     enable row level security;
alter table public.pf_transactions       enable row level security;
alter table public.pf_fixed_costs        enable row level security;
alter table public.pf_recurring_income   enable row level security;
alter table public.pf_variable_estimates enable row level security;
alter table public.pf_monthly_plan       enable row level security;
alter table public.pf_cash_locations     enable row level security;
alter table public.pf_pots               enable row level security;
alter table public.pf_debts              enable row level security;
alter table public.pf_allocation_steps   enable row level security;
alter table public.pf_pots               enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['pf_accounts','pf_categories','pf_import_batches','pf_transactions',
                        'pf_fixed_costs','pf_recurring_income','pf_variable_estimates','pf_monthly_plan',
                        'pf_cash_locations','pf_pots','pf_debts','pf_allocation_steps']
  loop
    execute format('drop policy if exists "owner_only" on public.%I;', t);
    execute format($f$
      create policy "owner_only" on public.%I
        for all
        to authenticated
        using (owner_id = auth.uid())
        with check (owner_id = auth.uid());
    $f$, t);
  end loop;
end $$;

-- ============================================================================
-- REALTIME (gleiches Muster wie schema.sql)
-- ============================================================================
do $$
declare
  t text;
begin
  foreach t in array array['pf_accounts','pf_categories','pf_import_batches','pf_transactions',
                        'pf_fixed_costs','pf_recurring_income','pf_variable_estimates','pf_monthly_plan',
                        'pf_cash_locations','pf_pots','pf_debts','pf_allocation_steps']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I;', t);
    exception
      when duplicate_object then null;  -- bereits hinzugefuegt
    end;
  end loop;
end $$;

alter table public.pf_accounts           replica identity full;
alter table public.pf_categories         replica identity full;
alter table public.pf_import_batches     replica identity full;
alter table public.pf_transactions       replica identity full;
alter table public.pf_fixed_costs        replica identity full;
alter table public.pf_recurring_income   replica identity full;
alter table public.pf_variable_estimates replica identity full;
alter table public.pf_monthly_plan       replica identity full;
alter table public.pf_cash_locations     replica identity full;
alter table public.pf_pots               replica identity full;
alter table public.pf_debts              replica identity full;
alter table public.pf_allocation_steps   replica identity full;
