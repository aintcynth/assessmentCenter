-- ============================================================================
-- Migration: inspection cycle, payment/AOU uploads, certificate release,
-- and the application activity log ("trailsheet").
--
-- Run this ONCE in the Supabase SQL editor if your project already has the
-- base schema (schema.sql) applied. It's additive — safe to run even if you
-- have existing applications, though any application currently sitting in
-- the old 'approved' status won't automatically map to the new pipeline;
-- see the note at the bottom.
-- ============================================================================

-- 1. Widen assessment_applications.status and add a cert_number column that
--    gets populated once an inspection is marked compliant (ahead of the
--    certificate actually being released).
alter table public.assessment_applications
  drop constraint if exists assessment_applications_status_check;

alter table public.assessment_applications
  add constraint assessment_applications_status_check
  check (status in ('pending', 'denied', 'inspection_scheduled', 'awaiting_payment', 'accredited', 'approved'));
  -- 'approved' is kept as a legacy allowed value so old rows don't violate
  -- the constraint; new code never writes it. Feel free to migrate any
  -- 'approved' rows to 'inspection_scheduled' by hand and drop 'approved'
  -- from this list afterwards.

alter table public.assessment_applications
  add column if not exists cert_number text;

-- 2. Inspections — one row per inspection attempt.
create table if not exists public.inspections (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.assessment_applications (id) on delete cascade,
  inspection_date date,
  expert_name text,
  report_url text,
  compliant boolean,
  lackings text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.inspections enable row level security;

-- 3. Payment submissions — receipt of payment + AOU.
create table if not exists public.payment_submissions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.assessment_applications (id) on delete cascade,
  receipt_url text,
  receipt_uploaded_at timestamptz,
  aou_url text,
  aou_uploaded_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.payment_submissions enable row level security;

-- 4. Application activity log ("trailsheet").
create table if not exists public.application_activity_log (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.assessment_applications (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  actor_name text,
  action text not null,
  notes text,
  created_at timestamptz not null default now()
);
alter table public.application_activity_log enable row level security;

-- 5. RLS policies for the three new tables (drop-then-create so this
--    migration is safe to re-run).
drop policy if exists "inspections_select" on public.inspections;
create policy "inspections_select" on public.inspections for select using (
  public.is_admin() or exists (
    select 1 from public.assessment_applications a where a.id = application_id and a.user_id = auth.uid()
  )
);
drop policy if exists "inspections_admin_write" on public.inspections;
create policy "inspections_admin_write" on public.inspections for insert with check (public.is_admin());
drop policy if exists "inspections_admin_update" on public.inspections;
create policy "inspections_admin_update" on public.inspections for update using (public.is_admin());

drop policy if exists "payment_select" on public.payment_submissions;
create policy "payment_select" on public.payment_submissions for select using (
  public.is_admin() or exists (
    select 1 from public.assessment_applications a where a.id = application_id and a.user_id = auth.uid()
  )
);
drop policy if exists "payment_insert" on public.payment_submissions;
create policy "payment_insert" on public.payment_submissions for insert with check (
  exists (select 1 from public.assessment_applications a where a.id = application_id and a.user_id = auth.uid())
);
drop policy if exists "payment_update" on public.payment_submissions;
create policy "payment_update" on public.payment_submissions for update using (
  exists (select 1 from public.assessment_applications a where a.id = application_id and a.user_id = auth.uid())
);

drop policy if exists "activity_select" on public.application_activity_log;
create policy "activity_select" on public.application_activity_log for select using (
  public.is_admin() or exists (
    select 1 from public.assessment_applications a where a.id = application_id and a.user_id = auth.uid()
  )
);
drop policy if exists "activity_insert" on public.application_activity_log;
create policy "activity_insert" on public.application_activity_log for insert with check (
  public.is_admin() or exists (
    select 1 from public.assessment_applications a where a.id = application_id and a.user_id = auth.uid()
  )
);
