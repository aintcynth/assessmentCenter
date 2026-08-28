-- ============================================================================
-- Migration: certificate issuance pipeline
--
-- Adds everything needed for: set issuance/expiry -> generate draft
-- certificate + AOU PDFs -> notify client -> client uploads receipt/AOU ->
-- admin acknowledges or rejects each -> admin uploads the signed
-- certificate -> release.
--
-- Run this once in the Supabase SQL editor. Additive — safe on an existing
-- project with data already in it.
-- ============================================================================

-- 1. assessment_applications: issuance/expiry, generated draft PDFs, the
--    signed certificate, and when the client was notified.
alter table public.assessment_applications
  add column if not exists issuance_date date,
  add column if not exists expiration_date date,
  add column if not exists cert_pdf_url text,      -- system-generated draft certificate
  add column if not exists aou_pdf_url text,        -- system-generated blank AOU template
  add column if not exists signed_cert_url text,    -- admin-uploaded signed certificate (final)
  add column if not exists notified_at timestamptz; -- when the client was notified about payment/AOU

alter table public.assessment_applications
  drop constraint if exists assessment_applications_status_check;

alter table public.assessment_applications
  add constraint assessment_applications_status_check
  check (status in (
    'pending', 'denied', 'inspection_scheduled', 'awaiting_payment',
    'certificate_processing', 'accredited', 'approved'
  ));
  -- 'awaiting_payment' and 'approved' are kept for backward compatibility
  -- with rows written by earlier versions of the app; new code only writes
  -- 'certificate_processing' for this stage.

-- 2. payment_submissions: independent acknowledge/reject per document.
alter table public.payment_submissions
  add column if not exists receipt_status text default 'pending'
    check (receipt_status in ('pending', 'acknowledged', 'rejected')),
  add column if not exists receipt_reject_reason text,
  add column if not exists aou_status text default 'pending'
    check (aou_status in ('pending', 'acknowledged', 'rejected')),
  add column if not exists aou_reject_reason text;

-- 3. Notifications — simple in-app inbox used to notify the client (and, in
--    the other direction, to flag the admin when the client uploads
--    something for review).
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  application_id uuid references public.assessment_applications (id) on delete cascade,
  title text not null,
  message text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;

drop policy if exists "notifications_select" on public.notifications;
create policy "notifications_select" on public.notifications for select using (
  user_id = auth.uid() or public.is_admin()
);
drop policy if exists "notifications_update" on public.notifications;
create policy "notifications_update" on public.notifications for update using (
  user_id = auth.uid() or public.is_admin()
);
drop policy if exists "notifications_insert" on public.notifications;
create policy "notifications_insert" on public.notifications for insert with check (
  public.is_admin()
  or user_id = auth.uid()
  or exists (
    select 1 from public.assessment_applications a
    where a.id = application_id and a.user_id = auth.uid()
  )
);

-- 4. Fix payment_submissions update policy so the admin can acknowledge or
--    reject (the original migration only allowed the owning applicant to
--    update this row).
drop policy if exists "payment_update" on public.payment_submissions;
create policy "payment_update" on public.payment_submissions for update using (
  public.is_admin()
  or exists (select 1 from public.assessment_applications a where a.id = application_id and a.user_id = auth.uid())
);

-- 5. Storage bucket already exists (accreditation-files) and its policies
--    already allow any signed-in user to read/write, so generated PDFs and
--    the signed certificate upload need no additional storage policy.
