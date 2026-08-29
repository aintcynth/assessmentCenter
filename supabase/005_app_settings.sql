-- ============================================================================
-- Migration: app_settings (single row) for the certificate logo
-- ============================================================================

create table if not exists public.app_settings (
  id smallint primary key default 1,
  logo_url text,
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id = 1)
);

insert into public.app_settings (id) values (1) on conflict (id) do nothing;

alter table public.app_settings enable row level security;

drop policy if exists "app_settings_select" on public.app_settings;
create policy "app_settings_select" on public.app_settings for select using (auth.uid() is not null);

drop policy if exists "app_settings_admin_update" on public.app_settings;
create policy "app_settings_admin_update" on public.app_settings for update using (public.is_admin());

drop policy if exists "app_settings_admin_insert" on public.app_settings;
create policy "app_settings_admin_insert" on public.app_settings for insert with check (public.is_admin());
