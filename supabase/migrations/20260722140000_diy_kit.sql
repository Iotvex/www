
-- DIY kit extensions
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  title text not null,
  detail text not null default '',
  entity_id text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists events_created_idx on public.events (created_at desc);

create table if not exists public.dashboard_widgets (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  title text not null default '',
  config jsonb not null default '{}'::jsonb,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.modules (
  id text primary key,
  name text not null,
  description text not null default '',
  source_url text,
  enabled boolean not null default true,
  manifest jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists dashboard_widgets_set_updated_at on public.dashboard_widgets;
create trigger dashboard_widgets_set_updated_at before update on public.dashboard_widgets
for each row execute function public.set_updated_at();

drop trigger if exists modules_set_updated_at on public.modules;
create trigger modules_set_updated_at before update on public.modules
for each row execute function public.set_updated_at();

alter table public.events enable row level security;
alter table public.dashboard_widgets enable row level security;
alter table public.modules enable row level security;

do $$
declare t text;
begin
  foreach t in array array['events','dashboard_widgets','modules']
  loop
    execute format('drop policy if exists %I_select_authenticated on public.%I', t, t);
    execute format('drop policy if exists %I_write_authenticated on public.%I', t, t);
    execute format('create policy %I_select_authenticated on public.%I for select to authenticated using (true)', t, t);
    execute format('create policy %I_write_authenticated on public.%I for all to authenticated using (true) with check (true)', t, t);
  end loop;
end $$;

grant select, insert, update, delete on public.events, public.dashboard_widgets, public.modules to authenticated, service_role;

-- wipe demo / preset catalog
delete from public.entity_states;
delete from public.entities where coalesce(attributes->>'platform','') = 'demo' or id like 'sensor.%' or id like 'binary_sensor.%' or id like 'weather.%' or id like 'person.%';
delete from public.automations;
delete from public.scripts;
delete from public.scenes;
delete from public.areas;
delete from public.devices where platform = 'demo';
