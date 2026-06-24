-- ============================================================================
-- Haushalts-App – Vollstaendiges Datenbankschema
-- Ein gemeinsamer Haushalts-Datensatz fuer beide Accounts.
-- Im Supabase-Dashboard unter "SQL Editor" einfuegen und ausfuehren.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Einstellungen (Single-Row: Namen von Person A und B)
-- ---------------------------------------------------------------------------
create table if not exists public.settings (
  id           int primary key default 1,
  person_a     text not null default 'Person A',
  person_b     text not null default 'Person B',
  updated_at   timestamptz not null default now(),
  constraint settings_single_row check (id = 1)
);

-- Standardzeile anlegen
insert into public.settings (id) values (1)
  on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Laeden (Stores)
-- ---------------------------------------------------------------------------
create table if not exists public.stores (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  position    double precision not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. Kategorien (Categories)
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  position    double precision not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 4. Einkaufsliste (Shopping Items)
-- ---------------------------------------------------------------------------
create table if not exists public.shopping_items (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  quantity     text,
  unit         text,
  is_done      boolean not null default false,
  store_id     uuid references public.stores(id) on delete set null,
  category_id  uuid references public.categories(id) on delete set null,
  position     double precision not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists shopping_items_store_idx    on public.shopping_items(store_id);
create index if not exists shopping_items_category_idx on public.shopping_items(category_id);

-- ---------------------------------------------------------------------------
-- 5. Ausgaben (Expenses)
--    paid_by: 'A' | 'B'   (wer hat bezahlt)
--    split:   'both' | 'A' | 'B'   (fuer wen gilt die Ausgabe)
-- ---------------------------------------------------------------------------
create table if not exists public.expenses (
  id           uuid primary key default gen_random_uuid(),
  amount       numeric(12,2) not null check (amount > 0),
  description  text not null,
  date         date not null default current_date,
  paid_by      text not null check (paid_by in ('A','B')),
  split        text not null check (split in ('both','A','B')),
  created_at   timestamptz not null default now()
);

create index if not exists expenses_date_idx on public.expenses(date desc);

-- ---------------------------------------------------------------------------
-- 6. Ausgleichszahlungen (Settlements)
--    from_person zahlt Betrag an to_person, um Schulden auszugleichen.
-- ---------------------------------------------------------------------------
create table if not exists public.settlements (
  id           uuid primary key default gen_random_uuid(),
  amount       numeric(12,2) not null check (amount > 0),
  from_person  text not null check (from_person in ('A','B')),
  to_person    text not null check (to_person in ('A','B')),
  date         date not null default current_date,
  note         text,
  created_at   timestamptz not null default now(),
  constraint settlement_distinct check (from_person <> to_person)
);

create index if not exists settlements_date_idx on public.settlements(date desc);

-- ============================================================================
-- ROW LEVEL SECURITY
-- Nur eingeloggte (authentifizierte) Nutzer duerfen lesen & schreiben.
-- Es gibt KEINE Trennung nach User – beide Accounts teilen alle Daten.
-- ============================================================================
alter table public.settings       enable row level security;
alter table public.stores         enable row level security;
alter table public.categories     enable row level security;
alter table public.shopping_items enable row level security;
alter table public.expenses       enable row level security;
alter table public.settlements    enable row level security;

-- Hilfs-Makro: eine Policy je Tabelle, die allen authentifizierten Nutzern
-- vollen Zugriff (SELECT/INSERT/UPDATE/DELETE) gewaehrt.
do $$
declare
  t text;
begin
  foreach t in array array[
    'settings','stores','categories','shopping_items','expenses','settlements'
  ]
  loop
    execute format('drop policy if exists "authenticated_all" on public.%I;', t);
    execute format($f$
      create policy "authenticated_all" on public.%I
        for all
        to authenticated
        using (true)
        with check (true);
    $f$, t);
  end loop;
end $$;

-- ============================================================================
-- REALTIME
-- Tabellen zur Realtime-Publication hinzufuegen, damit Aenderungen sofort
-- per Subscription bei beiden Geraeten ankommen.
-- ============================================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'settings','stores','categories','shopping_items','expenses','settlements'
  ]
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I;', t);
    exception
      when duplicate_object then null;  -- bereits hinzugefuegt
    end;
  end loop;
end $$;

-- REPLICA IDENTITY FULL: liefert auch bei DELETE die alten Zeilenwerte,
-- damit das Frontend geloeschte Datensaetze korrekt entfernen kann.
alter table public.settings       replica identity full;
alter table public.stores         replica identity full;
alter table public.categories     replica identity full;
alter table public.shopping_items replica identity full;
alter table public.expenses       replica identity full;
alter table public.settlements    replica identity full;
