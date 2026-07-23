-- Per-user UI preferences (theme / accent / locale) — sync across devices & PWA
create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'system'
    check (theme in ('light', 'dark', 'system')),
  color_theme text not null default 'default',
  locale text not null default 'en',
  updated_at timestamptz not null default now()
);

drop trigger if exists user_preferences_set_updated_at on public.user_preferences;
create trigger user_preferences_set_updated_at before update on public.user_preferences
for each row execute function public.set_updated_at();

alter table public.user_preferences enable row level security;

drop policy if exists user_preferences_select_own on public.user_preferences;
drop policy if exists user_preferences_write_own on public.user_preferences;

create policy user_preferences_select_own on public.user_preferences
  for select to authenticated
  using (auth.uid() = user_id);

create policy user_preferences_write_own on public.user_preferences
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.user_preferences to authenticated, service_role;
