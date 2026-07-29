-- Durable automations: complete-to-end + run ledger for catch-up after outages
alter table public.automations
  add column if not exists complete_to_end boolean not null default true;

create table if not exists public.automation_runs (
  id text primary key,
  automation_id text not null references public.automations(id) on delete cascade,
  scheduled_for timestamptz not null,
  status text not null default 'pending',
  attempts integer not null default 0,
  last_error text,
  last_attempt_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint automation_runs_status_check
    check (status in ('pending', 'running', 'succeeded', 'failed', 'abandoned')),
  constraint automation_runs_unique_slot unique (automation_id, scheduled_for)
);

create index if not exists automation_runs_open_idx
  on public.automation_runs (status, scheduled_for)
  where status in ('pending', 'failed', 'running');

create index if not exists automation_runs_automation_idx
  on public.automation_runs (automation_id, scheduled_for desc);

drop trigger if exists automation_runs_set_updated_at on public.automation_runs;
create trigger automation_runs_set_updated_at before update on public.automation_runs
for each row execute function public.set_updated_at();

alter table public.automation_runs enable row level security;

drop policy if exists automation_runs_select_authenticated on public.automation_runs;
create policy automation_runs_select_authenticated on public.automation_runs
  for select to authenticated using (true);

drop policy if exists automation_runs_write_authenticated on public.automation_runs;
create policy automation_runs_write_authenticated on public.automation_runs
  for all to authenticated using (true) with check (true);

drop policy if exists automation_runs_service_all on public.automation_runs;
create policy automation_runs_service_all on public.automation_runs
  for all to service_role using (true) with check (true);
