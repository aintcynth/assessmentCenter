-- ============================================================================
-- Assessment Center Accreditation Portal — Supabase schema
-- Migrated from the original phpMyAdmin/MariaDB dump (`application.sql`) to
-- Postgres + Supabase Auth + Row Level Security. Table and column names are
-- kept as close to the original as possible:
--   users                          -> profiles (extends auth.users)
--   tbl_qualifications             -> qualifications
--   assessment_applications        -> assessment_applications
--   assessment_application_documents -> assessment_application_documents
--   assessment_centers             -> assessment_centers
--
-- Flow: applicant registers -> picks a qualification (NC) -> uploads the
-- required documents -> submits (status 'pending') -> admin reviews the
-- documents -> approves (status 'approved', an assessment_centers row with a
-- certificate is created) or denies (status 'denied' + admin_reason, and the
-- applicant can revise and resubmit).
--
-- Run this once in the Supabase SQL editor (or via `supabase db push`).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Profiles (was `users`) — extends auth.users, carries role + AC details
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  ac_name text not null default '',       -- assessment center / applicant name
  email text,
  phone text,
  address text,
  ac_manager text,                        -- assessment center manager's name
  ac_type text check (ac_type in ('TTI', 'TVI')),
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. Qualifications (was `tbl_qualifications`) — NC catalog, admin-managed
--    reference data, readable by any signed-in user.
-- ---------------------------------------------------------------------------
create table if not exists public.qualifications (
  id integer primary key,
  name text not null,
  description text,
  icon text,
  level text not null,
  code text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. Assessment applications (was `assessment_applications`)
-- ---------------------------------------------------------------------------
create table if not exists public.assessment_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  qualification_id integer not null references public.qualifications (id),
  status text not null default 'pending' check (
    status in ('pending', 'denied', 'inspection_scheduled', 'certificate_processing', 'accredited')
  ),
  cert_number text,
  issuance_date date,
  expiration_date date,
  cert_pdf_url text,      -- system-generated draft certificate
  aou_pdf_url text,       -- system-generated blank AOU template
  signed_cert_url text,   -- admin-uploaded signed certificate (final)
  notified_at timestamptz, -- when the client was notified about payment/AOU
  admin_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 4. Application documents (was `assessment_application_documents`)
-- ---------------------------------------------------------------------------
create table if not exists public.assessment_application_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.assessment_applications (id) on delete cascade,
  requirement_index integer,
  filename_original text not null,
  filename_stored text not null,
  file_url text not null,
  mime_type text,
  size_bytes bigint not null default 0,
  uploaded_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 5. Inspections — one row per inspection attempt. Supports the
--    schedule -> compliant? -> (lackings -> reschedule) cycle from the
--    flowcharts; an application can have several rows here if it takes more
--    than one visit to become compliant.
-- ---------------------------------------------------------------------------
create table if not exists public.inspections (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.assessment_applications (id) on delete cascade,
  inspection_date date,
  inspection_time text,
  expert_name text,
  report_url text,          -- signed inspection report, uploaded by admin
  notification_pdf_url text, -- generated pre-inspection notification letter
  compliant boolean,         -- null = outcome not yet recorded
  lackings text,             -- admin's notes when compliant = false
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 6. Payment submissions — receipt of payment + AOU, uploaded by the client
--    once inspection compliance is confirmed.
-- ---------------------------------------------------------------------------
create table if not exists public.payment_submissions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.assessment_applications (id) on delete cascade,
  receipt_url text,
  receipt_uploaded_at timestamptz,
  receipt_status text default 'pending' check (receipt_status in ('pending', 'acknowledged', 'rejected')),
  receipt_reject_reason text,
  aou_url text,
  aou_uploaded_at timestamptz,
  aou_status text default 'pending' check (aou_status in ('pending', 'acknowledged', 'rejected')),
  aou_reject_reason text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 6b. Notifications — simple in-app inbox used to notify the client (and
--     vice versa) at each handoff point.
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  application_id uuid references public.assessment_applications (id) on delete cascade,
  title text not null,
  message text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 6c. App settings — single row holding the certificate logo.
-- ---------------------------------------------------------------------------
create table if not exists public.app_settings (
  id smallint primary key default 1,
  logo_url text,
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id = 1)
);
insert into public.app_settings (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 7. Application activity log ("trailsheet") — a timestamped record of what
--    happened and when, per the handwritten note on the admin flowchart.
-- ---------------------------------------------------------------------------
create table if not exists public.application_activity_log (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.assessment_applications (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  actor_name text,
  action text not null,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 8. Assessment centers (was `assessment_centers`) — the accredited-center +
--    certificate record, created once a certificate is released.
-- ---------------------------------------------------------------------------
create table if not exists public.assessment_centers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  qualification_id integer references public.qualifications (id),
  application_id uuid references public.assessment_applications (id) on delete set null,
  cert_number text unique not null,
  issuance_date date,
  expiration_date date,
  cert_url text,
  status text default 'active' check (status in ('active', 'inactive')),
  center_name text,   -- standalone name for records with no linked portal account
  address text,       -- (e.g. bulk-imported historical/legacy accreditation records)
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.qualifications enable row level security;
alter table public.assessment_applications enable row level security;
alter table public.assessment_application_documents enable row level security;
alter table public.inspections enable row level security;
alter table public.payment_submissions enable row level security;
alter table public.notifications enable row level security;
alter table public.app_settings enable row level security;
alter table public.application_activity_log enable row level security;
alter table public.assessment_centers enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- Profiles
create policy "profiles_self_select" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profiles_self_update" on public.profiles for update using (id = auth.uid() or public.is_admin());
create policy "profiles_self_insert" on public.profiles for insert with check (id = auth.uid());

-- Qualifications: readable by any signed-in user, writable by admin only
create policy "qualifications_select" on public.qualifications for select using (auth.uid() is not null);
create policy "qualifications_admin_write" on public.qualifications for insert with check (public.is_admin());
create policy "qualifications_admin_update" on public.qualifications for update using (public.is_admin());
create policy "qualifications_admin_delete" on public.qualifications for delete using (public.is_admin());

-- Assessment applications: owner + admin
create policy "applications_owner_select" on public.assessment_applications for select using (user_id = auth.uid() or public.is_admin());
create policy "applications_owner_insert" on public.assessment_applications for insert with check (user_id = auth.uid());
create policy "applications_owner_update" on public.assessment_applications for update using (user_id = auth.uid() or public.is_admin());

-- Application documents: owner + admin
create policy "documents_select" on public.assessment_application_documents for select using (
  public.is_admin() or exists (
    select 1 from public.assessment_applications a where a.id = application_id and a.user_id = auth.uid()
  )
);
create policy "documents_insert" on public.assessment_application_documents for insert with check (
  public.is_admin() or exists (
    select 1 from public.assessment_applications a where a.id = application_id and a.user_id = auth.uid()
  )
);

-- Inspections: owner reads, admin manages
create policy "inspections_select" on public.inspections for select using (
  public.is_admin() or exists (
    select 1 from public.assessment_applications a where a.id = application_id and a.user_id = auth.uid()
  )
);
create policy "inspections_admin_write" on public.inspections for insert with check (public.is_admin());
create policy "inspections_admin_update" on public.inspections for update using (public.is_admin());

-- Payment submissions: owner uploads/reads their own, admin reads
create policy "payment_select" on public.payment_submissions for select using (
  public.is_admin() or exists (
    select 1 from public.assessment_applications a where a.id = application_id and a.user_id = auth.uid()
  )
);
create policy "payment_insert" on public.payment_submissions for insert with check (
  exists (select 1 from public.assessment_applications a where a.id = application_id and a.user_id = auth.uid())
);
create policy "payment_update" on public.payment_submissions for update using (
  public.is_admin() or exists (select 1 from public.assessment_applications a where a.id = application_id and a.user_id = auth.uid())
);

-- Notifications: recipient (or admin) reads/marks read; admin can notify
-- anyone, a client can notify about their own application (e.g. flagging
-- the admin when they upload something)
create policy "notifications_select" on public.notifications for select using (
  user_id = auth.uid() or public.is_admin()
);
create policy "notifications_update" on public.notifications for update using (
  user_id = auth.uid() or public.is_admin()
);
create policy "notifications_insert" on public.notifications for insert with check (
  public.is_admin()
  or user_id = auth.uid()
  or exists (
    select 1 from public.assessment_applications a
    where a.id = application_id and a.user_id = auth.uid()
  )
);

-- App settings: any signed-in user can read (used to fetch the logo),
-- only admin can write
create policy "app_settings_select" on public.app_settings for select using (auth.uid() is not null);
create policy "app_settings_admin_update" on public.app_settings for update using (public.is_admin());
create policy "app_settings_admin_insert" on public.app_settings for insert with check (public.is_admin());

-- Activity log (trailsheet): owner + admin read; either can append entries
-- tied to their own application
create policy "activity_select" on public.application_activity_log for select using (
  public.is_admin() or exists (
    select 1 from public.assessment_applications a where a.id = application_id and a.user_id = auth.uid()
  )
);
create policy "activity_insert" on public.application_activity_log for insert with check (
  public.is_admin() or exists (
    select 1 from public.assessment_applications a where a.id = application_id and a.user_id = auth.uid()
  )
);

-- Assessment centers: readable by any signed-in user (public accreditation
-- directory), writable by admin only
create policy "centers_select" on public.assessment_centers for select using (auth.uid() is not null);
create policy "centers_admin_write" on public.assessment_centers for insert with check (public.is_admin());
create policy "centers_admin_update" on public.assessment_centers for update using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Auto-create a profile row whenever a new auth user signs up
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, email, ac_name, phone, address, ac_manager, ac_type, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'ac_name', ''),
    new.raw_user_meta_data ->> 'phone',
    new.raw_user_meta_data ->> 'address',
    new.raw_user_meta_data ->> 'ac_manager',
    new.raw_user_meta_data ->> 'ac_type',
    coalesce(new.raw_user_meta_data ->> 'role', 'user')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Storage bucket for uploaded documents + certificate files
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('accreditation-files', 'accreditation-files', true)
on conflict (id) do nothing;

create policy "files_read_all" on storage.objects for select using (bucket_id = 'accreditation-files');
create policy "files_write_auth" on storage.objects for insert with check (
  bucket_id = 'accreditation-files' and auth.uid() is not null
);

-- ---------------------------------------------------------------------------
-- Seed data: the full NC qualification catalog, carried over from the
-- original `tbl_qualifications` dump.
-- ---------------------------------------------------------------------------
insert into public.qualifications (id, name, description, icon, level, code) values
(16, 'AGRICULTURAL CROPS PRODUCTION NC I', 'Agriculture Forestry and Fishery', 'seedling', 'I', 'ACP'),
(17, 'AGRICULTURAL CROPS PRODUCTION NC II', 'Agriculture Forestry and Fishery', 'seedling', 'II', 'ACP'),
(18, 'AGRICULTURAL CROPS PRODUCTION NC III', 'Agriculture Forestry and Fishery', 'seedling', 'III', 'ACP'),
(19, 'AGROENTREPRENEURSHIP NC II', 'Agriculture Forestry and Fishery', NULL, 'II', 'AGE'),
(20, 'AGROENTREPRENEURSHIP NC III', 'Agriculture Forestry and Fishery', NULL, 'III', 'AGE'),
(21, 'AGROENTREPRENEURSHIP NC IV', 'Agriculture Forestry and Fishery', NULL, 'IV', 'AGE'),
(22, 'ANIMAL HEALTH CARE AND MANAGEMENT NC III', 'Agriculture Forestry and Fishery', NULL, 'III', 'AHC'),
(23, 'ANIMAL PRODUCTION (POULTRY-CHICKEN) NC II', 'Agriculture Forestry and Fishery', NULL, 'II', 'APP'),
(24, 'ANIMAL PRODUCTION (RUMINANTS) NC II', 'Agriculture Forestry and Fishery', NULL, 'II', 'APR'),
(25, 'ANIMAL PRODUCTION (SWINE) NC II', 'Agriculture Forestry and Fishery', NULL, 'II', 'APS'),
(26, 'AQUACULTURE (TILAPIA CULTURE) NC II', 'Agriculture Forestry and Fishery', NULL, 'II', 'ATC'),
(27, 'AUTOMOTIVE SERVICING (ENGINE REPAIR) NC II', 'Automotive and Land Transportation', 'wrench', 'II', 'ATS'),
(28, 'AUTOMOTIVE SERVICING NC I', 'Automotive and Land Transportation', 'wrench', 'I', 'ATS'),
(29, 'AUTOMOTIVE SERVICING NC IV', 'Automotive and Land Transportation', 'wrench', 'IV', 'ATS'),
(30, 'BARANGAY HEALTH SERVICES NC II', 'Human Health / Health Care', NULL, 'II', 'BHC'),
(31, 'BARTENDING NC II', 'Tourism (Hotel and Restaurant)', NULL, 'II', 'BAR'),
(32, 'BEAUTY CARE (NAIL CARE) SERVICES NC II', 'Social, Community Development and Other Services', NULL, 'II', 'BCN'),
(33, 'BOOKKEEPING NC III', 'Social, Community Development and Other Services', NULL, 'III', 'BKP'),
(34, 'BREAD AND PASTRY PRODUCTION NC II', 'Tourism (Hotel and Restaurant)', NULL, 'II', 'BPP'),
(35, 'CAREGIVING NC II', 'Human Health / Health Care', NULL, 'II', 'CGV'),
(36, 'CARPENTRY NC II', 'Construction', NULL, 'II', 'CAR'),
(37, 'CARPENTRY NC III', 'Construction', NULL, 'III', 'CAR'),
(38, 'COMPUTER SYSTEMS SERVICING NC II', 'Electrical & Electronics', NULL, 'II', 'CSS'),
(39, 'COOKERY NC II', 'tourism (Hotel and Restaurant)', NULL, 'II', 'COK'),
(40, 'DOMESTIC WORK NC II', 'Social, Community Development and Other Services', NULL, 'II', 'DOW'),
(41, 'DRESSMAKING NC II', 'Garments', NULL, 'II', 'DRM'),
(42, 'DRIVING (PASSENGER BUS/STRAIGHT TRUCK) NC III', 'Automotive and Land Transportation', NULL, 'III', 'DRB'),
(43, 'DRIVING NC II', 'Automotive and Land Transportation', 'car', 'II', 'DRV'),
(44, 'DRYING AND MILLING PLANT SERVICING NC III', 'Agriculture Forestry and Fishery', NULL, 'III', 'DMS'),
(45, 'ELECTRIC POWER DISTRIBUTION LINE CONSTRUCTION NC II', 'Utilities', NULL, 'II', 'EPD'),
(46, 'ELECTRICAL INSTALLATION AND MAINTENANCE NC II', 'Electrical & Electronics', NULL, 'II', 'EIM'),
(47, 'ELECTRICAL INSTALLATION AND MAINTENANCE NC III', 'Electrical & Electronics', NULL, 'III', 'EIM'),
(48, 'ELECTRONIC PRODUCTS ASSEMBLY AND SERVICING NC II', 'Electrical & Electronics', NULL, 'II', 'EPA'),
(49, 'EVENTS MANAGEMENT SERVICES NC III', 'Tourism (Hotel and Restaurant)', NULL, 'III', 'EVM'),
(50, 'FOOD AND BEVERAGE SERVICES NC II', 'Tourism (Hotel and Restaurant)', NULL, 'II', 'FBS'),
(51, 'FOOD AND BEVERAGE SERVICES NC III', 'Tourism (Hotel and Restaurant)', NULL, 'III', 'FBS'),
(52, 'FOOD PROCESSING NC II', 'Processed Food & Beverages', NULL, 'II', 'FOP'),
(53, 'FRONT OFFICE SERVICES NC II', 'Tourism (Hotel and Restaurant)', NULL, 'II', 'FOS'),
(54, 'GRAINS PRODUCTION NC II', 'Agriculture Forestry and Fishery', NULL, 'II', 'GRP'),
(55, 'HEAVY EQUIPMENT OPERATION (FORKLIFT) NC II', 'Construction', NULL, 'II', 'FOR'),
(56, 'HEAVY EQUIPMENT OPERATION (HYDRAULIC EXCAVATOR) NC II', 'Construction', NULL, 'II', 'HEO'),
(57, 'HEAVY EQUIPMENT OPERATION (MOTOR GRADER) NC II', 'Construction', NULL, 'II', 'MGO'),
(58, 'HEAVY EQUIPMENT OPERATION (RIGID ON-HIGHWAY DUMP TRUCK) NC II', 'Construction', NULL, 'II', 'ROH'),
(59, 'HEAVY EQUIPMENT OPERATION (ROAD ROLLER) NC II', 'Construction', NULL, 'II', 'RRO'),
(60, 'HEAVY EQUIPMENT OPERATION (TRANSIT MIXER) NC II', 'Construction', NULL, 'II', 'TMO'),
(61, 'HEAVY EQUIPMENT OPERATION (WHEEL LOADER) NC II', 'Construction', NULL, 'II', 'WLO'),
(62, 'HILOT (WELLNESS MASSAGE) NC II', 'Human Health / Health Care', NULL, 'II', 'HIL'),
(63, 'HOUSEKEEPING NC II', 'Tourism (Hotel and Restaurant)', NULL, 'II', 'HSK'),
(64, 'HOUSEKEEPING NC III', 'Tourism (Hotel and Restaurant)', NULL, 'III', 'HSK'),
(65, 'LANDSCAPE INSTALLATION AND MAINTENANCE (SOFTSCAPE) NC II', 'Agriculture Forestry and Fishery', NULL, 'II', 'LIM'),
(66, 'MASONRY NC II', 'Construction', NULL, 'II', 'MAS'),
(67, 'MASSAGE THERAPY NC II', 'Human Health / Health Care', NULL, 'II', 'MAT'),
(68, 'MILKING OPERATION NC II', 'Agriculture Forestry and Fishery', NULL, 'II', 'MLO'),
(69, 'MOTORCYCLE/SMALL ENGINE SERVICING NC II', 'Automotive and Land Transportation', NULL, 'II', 'MSE'),
(70, 'ORGANIC AGRICULTURE PRODUCTION NC II', 'Agriculture Forestry and Fishery', NULL, 'II', 'OAP'),
(71, 'PEST MANAGEMENT (VEGETABLES) NC II', 'Agriculture Forestry and Fishery', NULL, 'II', 'PMV'),
(72, 'PHARMACY SERVICES NC III', 'Human Health / Health Care', NULL, 'III', 'PHA'),
(73, 'PLUMBING NC II', 'Construction', NULL, 'II', 'PLM'),
(74, 'PUBLIC EMPLOYMENT SERVICES NC IV', 'Social, Community Development and Other Services', NULL, 'IV', 'PES'),
(75, 'PV SYSTEMS INSTALLATION NC II', 'Construction', NULL, 'II', 'PVI'),
(76, 'PV SYSTEMS SERVICING NC III', 'Construction', NULL, 'III', 'PVS'),
(77, 'RAC SERVICING (DOMRAC) NC II', 'Heating, Ventilation, Airconditioning and Refrigeration', NULL, 'II', 'DRA'),
(78, 'RICE MACHINERY OPERATIONS NC II', 'Agriculture Forestry and Fishery', NULL, 'II', 'RMO'),
(79, 'SHIELDED METAL ARC WELDING (SMAW) NC I', 'Metals and Engineering', NULL, 'I', 'EAW'),
(80, 'SHIELDED METAL ARC WELDING (SMAW) NC II', 'Metals and Engineering', NULL, 'II', 'EAW'),
(81, 'TAILORING NC II', 'Garments', NULL, 'II', 'TLR'),
(82, 'TECHNICAL DRAFTING NC II', 'Construction', NULL, 'II', 'TEC'),
(83, 'TILE SETTING NC II', 'Construction', NULL, 'II', 'TIL'),
(84, 'TOURISM PROMOTION SERVICES NC II', 'Tourism (Hotel and Restaurant)', NULL, 'II', 'TPS'),
(85, 'TRAINERS METHODOLOGY LEVEL I', 'TVET', 'book', 'I', 'TRM'),
(86, 'WEB DEVELOPMENT NC III', 'ICT', NULL, 'III', 'WBD'),
(87, 'TRAINERS METHODOLOGY LEVEL II', 'TVET', NULL, 'II', 'TRM'),
(88, 'HEALTH CARE SERVICES NC II', 'Human Health / Health Care', NULL, 'II', 'HCS'),
(89, 'AUTOMOTIVE PAINTING NC II', 'Automotive and Land Transportation', NULL, 'II', 'ATP'),
(90, 'MASONRY NC III', 'Construction', NULL, 'III', 'MAS'),
(91, 'SCAFFOLDING WORKS (SUPPORTED TYPE SCAFFOLD) NC II', 'Construction', NULL, 'II', 'SCA'),
(92, 'REINFORCING STEEL WORKS NC II', 'Construction', NULL, 'II', 'RSW'),
(93, 'TOUR PACKAGING (FIT AD HOC DOMESTIC) SERVICES NC II', 'Tourism (Hotel and Restaurant)', NULL, 'II', 'TOP'),
(94, 'LOCAL GUIDING SERVICES NC II', 'Tourism (Hotel and Restaurant)', NULL, 'II', 'LOG'),
(95, 'AQUACULTURE NC II', 'Agriculture Forestry and Fishery', NULL, 'II', 'AQC'),
(96, 'AGRICULTURAL MACHINERY OPERATION NC II', 'Agriculture Forestry and Fishery', NULL, 'II', 'AMO'),
(97, 'MANUAL METAL ARC WELDING (MMAW) NC III', 'Metals and Engineering', NULL, 'III', 'MAW'),
(98, 'MANUAL METAL ARC WELDING (MMAW) NC II', 'Metals and Engineering', NULL, 'II', 'MAW'),
(99, 'BARANGAY HEALTH SERVICES NC II', 'Human Health / Health Care', NULL, 'II', 'BHS')
on conflict (id) do nothing;
