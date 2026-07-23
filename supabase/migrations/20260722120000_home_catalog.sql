
-- Iotvex home catalog — Supabase is the source of truth
create extension if not exists pgcrypto;

create table if not exists public.areas (
  id text primary key,
  name text not null,
  icon text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  manufacturer text,
  model text,
  area_id text references public.areas(id) on delete set null,
  platform text not null default 'iotvex',
  external_id text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists devices_platform_external_uidx
  on public.devices (platform, external_id)
  where external_id is not null;

create table if not exists public.entities (
  id text primary key,
  device_id uuid references public.devices(id) on delete set null,
  domain text not null,
  name text not null,
  area_id text references public.areas(id) on delete set null,
  capabilities text[] not null default '{}',
  attributes jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists entities_domain_idx on public.entities (domain);
create index if not exists entities_area_idx on public.entities (area_id);

create table if not exists public.entity_states (
  entity_id text primary key references public.entities(id) on delete cascade,
  state text not null default 'unknown',
  attributes jsonb not null default '{}'::jsonb,
  available boolean not null default true,
  last_changed timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.automations (
  id text primary key,
  name text not null,
  description text not null default '',
  enabled boolean not null default true,
  trigger jsonb not null default '{}'::jsonb,
  conditions jsonb not null default '[]'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  mode text not null default 'single',
  ha_entity_id text,
  last_triggered timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scripts (
  id text primary key,
  name text not null,
  description text not null default '',
  sequence jsonb not null default '[]'::jsonb,
  mode text not null default 'single',
  last_triggered timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scenes (
  id text primary key,
  name text not null,
  description text not null default '',
  entities jsonb not null default '{}'::jsonb,
  area_id text references public.areas(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists areas_set_updated_at on public.areas;
create trigger areas_set_updated_at before update on public.areas
for each row execute function public.set_updated_at();

drop trigger if exists devices_set_updated_at on public.devices;
create trigger devices_set_updated_at before update on public.devices
for each row execute function public.set_updated_at();

drop trigger if exists entities_set_updated_at on public.entities;
create trigger entities_set_updated_at before update on public.entities
for each row execute function public.set_updated_at();

drop trigger if exists entity_states_set_updated_at on public.entity_states;
create trigger entity_states_set_updated_at before update on public.entity_states
for each row execute function public.set_updated_at();

drop trigger if exists automations_set_updated_at on public.automations;
create trigger automations_set_updated_at before update on public.automations
for each row execute function public.set_updated_at();

drop trigger if exists scripts_set_updated_at on public.scripts;
create trigger scripts_set_updated_at before update on public.scripts
for each row execute function public.set_updated_at();

drop trigger if exists scenes_set_updated_at on public.scenes;
create trigger scenes_set_updated_at before update on public.scenes
for each row execute function public.set_updated_at();

alter table public.areas enable row level security;
alter table public.devices enable row level security;
alter table public.entities enable row level security;
alter table public.entity_states enable row level security;
alter table public.automations enable row level security;
alter table public.scripts enable row level security;
alter table public.scenes enable row level security;

-- Local single-home: authenticated users can manage catalog
do $$
declare
  t text;
begin
  foreach t in array array['areas','devices','entities','entity_states','automations','scripts','scenes']
  loop
    execute format('drop policy if exists %I_select_authenticated on public.%I', t, t);
    execute format('drop policy if exists %I_write_authenticated on public.%I', t, t);
    execute format(
      'create policy %I_select_authenticated on public.%I for select to authenticated using (true)',
      t, t
    );
    execute format(
      'create policy %I_write_authenticated on public.%I for all to authenticated using (true) with check (true)',
      t, t
    );
  end loop;
end $$;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage on all sequences in schema public to authenticated, service_role;
