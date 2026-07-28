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

-- ============================================================================
-- ROW LEVEL SECURITY — die eigentliche Isolation
-- ============================================================================
alter table public.pf_accounts       enable row level security;
alter table public.pf_categories     enable row level security;
alter table public.pf_import_batches enable row level security;
alter table public.pf_transactions   enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['pf_accounts','pf_categories','pf_import_batches','pf_transactions']
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
  foreach t in array array['pf_accounts','pf_categories','pf_import_batches','pf_transactions']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I;', t);
    exception
      when duplicate_object then null;  -- bereits hinzugefuegt
    end;
  end loop;
end $$;

alter table public.pf_accounts       replica identity full;
alter table public.pf_categories     replica identity full;
alter table public.pf_import_batches replica identity full;
alter table public.pf_transactions   replica identity full;
