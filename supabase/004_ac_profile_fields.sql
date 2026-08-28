-- ============================================================================
-- Migration: AC Manager and AC Type on profiles
-- ============================================================================

alter table public.profiles
  add column if not exists ac_manager text,
  add column if not exists ac_type text check (ac_type in ('TTI', 'TVI'));
