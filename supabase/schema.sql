-- ============================================================
-- Supabase Schema for Laundry Pro (multi-device sync)
-- Run ONCE in: Supabase Dashboard > SQL Editor > New query
-- ============================================================

do $block$
begin
  create table if not exists public.customers     ( id bigint primary key, data jsonb not null, updated_at timestamptz not null default now() );
  create table if not exists public.invoices      ( id bigint primary key, data jsonb not null, updated_at timestamptz not null default now() );
  create table if not exists public.transactions  ( id bigint primary key, data jsonb not null, updated_at timestamptz not null default now() );
  create table if not exists public.subscriptions ( id bigint primary key, data jsonb not null, updated_at timestamptz not null default now() );
  create table if not exists public.subpayments   ( id bigint primary key, data jsonb not null, updated_at timestamptz not null default now() );
  create table if not exists public.services      ( id bigint primary key, data jsonb not null, updated_at timestamptz not null default now() );
  create table if not exists public.settings      ( key text primary key, data jsonb not null, updated_at timestamptz not null default now() );
  create table if not exists public.vatrecords    ( id bigint primary key, data jsonb not null, updated_at timestamptz not null default now() );
end $block$;

-- Row Level Security: allow the app (anon key) to read/write all rows
alter table public.customers     enable row level security;
alter table public.invoices      enable row level security;
alter table public.transactions  enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subpayments   enable row level security;
alter table public.services      enable row level security;
alter table public.settings      enable row level security;
alter table public.vatrecords    enable row level security;

create policy "lp_all_customers"     on public.customers     for all to anon using (true) with check (true);
create policy "lp_all_invoices"      on public.invoices      for all to anon using (true) with check (true);
create policy "lp_all_transactions"  on public.transactions  for all to anon using (true) with check (true);
create policy "lp_all_subscriptions" on public.subscriptions for all to anon using (true) with check (true);
create policy "lp_all_subpayments"   on public.subpayments   for all to anon using (true) with check (true);
create policy "lp_all_services"      on public.services      for all to anon using (true) with check (true);
create policy "lp_all_settings"      on public.settings      for all to anon using (true) with check (true);
create policy "lp_all_vatrecords"    on public.vatrecords    for all to anon using (true) with check (true);

grant usage on schema public to anon;
grant select, insert, update, delete on all tables in schema public to anon;

create index if not exists idx_customers_updated     on public.customers     (updated_at);
create index if not exists idx_invoices_updated      on public.invoices      (updated_at);
create index if not exists idx_transactions_updated  on public.transactions  (updated_at);
create index if not exists idx_subscriptions_updated on public.subscriptions (updated_at);
create index if not exists idx_subpayments_updated   on public.subpayments   (updated_at);
create index if not exists idx_services_updated      on public.services      (updated_at);
create index if not exists idx_settings_updated      on public.settings      (updated_at);
create index if not exists idx_vatrecords_updated    on public.vatrecords    (updated_at);