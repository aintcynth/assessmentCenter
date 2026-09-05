# Assessment Center Accreditation Portal

A Next.js + Supabase app built from the **Client** and **Admin** accreditation
flowcharts, wired to a real production database schema (migrated from an
existing phpMyAdmin/MariaDB dump — see [`supabase/schema.sql`](./supabase/schema.sql)):

- **Client**: Register → Sign up / Log in → Dashboard → Apply for scholarship
  (Apply? → Qualification → Documents required → Application) → Accredited /
  Documents / Profile
- **Admin**: Login → Dashboard → Applications (Documents → Approved? →
  issue certificate) → Accredited / Centers / Certificate of accreditation /
  Qualification / Users

## Database mapping

| Original MySQL table                | Supabase / Postgres table            |
| ------------------------------------ | ------------------------------------- |
| `users`                              | `profiles` (extends `auth.users`)     |
| `tbl_qualifications`                 | `qualifications`                      |
| `assessment_applications`            | `assessment_applications`             |
| `assessment_application_documents`   | `assessment_application_documents`    |
| `assessment_centers`                 | `assessment_centers`                  |
| —                                     | `inspections` (new)                   |
| —                                     | `payment_submissions` (new)           |
| —                                     | `application_activity_log` (new — the "trailsheet") |

## Importing legacy accredited centers

`supabase/006_import_legacy_centers.sql` was generated from a real monitoring
spreadsheet (`AC_MONITORING_2026.xlsx`, `2025`/`2026` tabs) and does three
things:

1. Adds `center_name` and `address` columns to
   `assessment_centers` so a historical record can stand on its own without
   a linked portal account (`user_id` stays null for these).
2. Fixes 16 qualifications whose `level` column didn't match their own name
   (e.g. a row literally named `BOOKKEEPING NC III` had `level = 'II'`) —
   this was a bug inherited from the original source dump, not something
   the spreadsheet introduced, and it affects the live qualification picker
   everywhere in the app, not just this import.
3. Imports 198 accredited-center records (103 from 2025, 95 from 2026),
   matched against the qualifications catalog by code + corrected level,
   adding the one qualification genuinely missing from the catalog
   (Barangay Health Services NC II). The 2026 batch includes a Google Drive
   link to each signed certificate, carried over into `cert_url`. Sector
   lives only on `qualifications.description` — not duplicated per
   center — reached via the `qualification_id` join.

Every read path that displays a center's name (Admin → Centers/Accredited/Certificate
of accreditation) falls back to `center_name`/`address` when there's no
linked `profiles` row, so these show up correctly alongside centers created
through the normal application flow. They won't appear on any client
dashboard, though — there's no account to attach them to.

The insert is idempotent on `cert_number` (safe to re-run if the source
spreadsheet changes and you want to reimport).

## The full workflow (from the hand-drawn client/admin process flows)

1. **Apply** — client picks a qualification, uploads supporting documents,
   submits (`status = 'pending'`).
2. **Documents review** — admin approves or declines. Declined applications
   (`status = 'denied'`) show the admin's remarks; the client can add more
   documents and resubmit, which flips the status back to `pending`.
3. **Inspection** — once approved, the admin sets an inspection date, time,
   and assigns an expert (a new row in `inspections`, `status =
   'inspection_scheduled'`). This automatically generates a draft Pre-Inspection
   Letter of Notification (TESDA-OP-CO-03-F06, `src/lib/preNotificationPdf.js`)
   as a PDF. The admin reviews this unsigned draft, prints and signs it, then
   uploads the scanned signed copy — only the signed version is ever shown to
   the client, and uploading it triggers their notification.
4. **Compliance check** — the admin can only record the inspection report
   and compliance decision on or after the scheduled inspection date. Marking
   compliant or non-compliant automatically generates a draft Post-Inspection
   Letter of Notification (TESDA-OP-CO-03-F09, `src/lib/postNotificationPdf.js`),
   branching on the outcome (lacking items listed vs. cleared for processing);
   same draft-then-signed pattern as the pre-inspection letter — the client
   only ever sees the signed version.
   - **Non-compliant**: lackings are recorded on that `inspections` row: the
     client sees them, and the admin schedules a **reinspection** (a new
     `inspections` row) — this can repeat as many times as needed.
   - **Compliant**: a certificate number is reserved on the application
     (`cert_number`) and the status moves to `certificate_processing`.
5. **Issuance & document generation** — the admin sets an issuance date
   (expiry auto-computes as +2 years); the app generates a draft
   Certificate of Accreditation and a blank AOU template as PDFs
   (`jspdf`, entirely client-side) and uploads both to storage.
6. **Review & notify** — the admin reviews both PDFs in an inline viewer,
   then notifies the client (an in-app notification, plus `notified_at` on
   the application).
7. **Payment / AOU upload & review** — the client uploads a receipt of
   payment and a signed AOU. The admin acknowledges or rejects each
   independently; a rejection requires a reason, notifies the client, and
   resets that document to `pending` so the client can re-upload.
8. **Signed certificate & release** — once both documents are acknowledged,
   the admin uploads the physically signed certificate, reviews it in the
   PDF viewer, and releases it: this creates the `assessment_centers` row
   (using the signed certificate as `cert_url`) and flips the application to
   `status = 'accredited'`. The client is notified and can view the final
   certificate inline.

Every step above writes a row to `application_activity_log` (the
"trailsheet") — visible to both the client and the admin on the
application detail pages (`/application/[id]` and
`/admin/applications/[id]`), showing what happened, when, and by whom.

Notes on the migration:
- `users.password` is gone — Supabase Auth handles credentials, so `profiles`
  only stores `ac_name`, `email`, `phone`, `address`, and `role` (`user` /
  `admin`, matching the original enum).
- `assessment_applications.status` keeps the original three values:
  `pending` → `approved` / `denied`, with `admin_reason` shown to the
  applicant when denied.
- The full 83-row `tbl_qualifications` catalog from the dump is seeded
  automatically by `schema.sql`.
- Sample `assessment_applications`/`assessment_centers`/`users` rows from the
  dump were **not** migrated (their bcrypt password hashes aren't usable with
  Supabase Auth, and some referenced qualification IDs outside the seeded
  catalog). Create real accounts via sign-up instead.
- The original dump had no inspection, proof-of-identity, or payment-proof
  tables, so those admin sections from the first draft of this app were
  removed to match the real schema.

## Stack

- **Next.js 14** (App Router, JavaScript, Tailwind CSS)
- **Supabase** — Postgres database, Auth, Row Level Security, Storage
- **Vercel** — hosting

## 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run the contents of [`supabase/schema.sql`](./supabase/schema.sql)
   — for a **brand-new** project only. It creates every table, RLS policy,
   and seeds the full NC qualification catalog.
   - If you already have this project running from an earlier version,
     instead run [`supabase/002_inspection_workflow.sql`](./supabase/002_inspection_workflow.sql)
     followed by [`supabase/003_certificate_pipeline.sql`](./supabase/003_certificate_pipeline.sql)
     and [`supabase/004_ac_profile_fields.sql`](./supabase/004_ac_profile_fields.sql)
     and [`supabase/005_app_settings.sql`](./supabase/005_app_settings.sql),
     then optionally [`supabase/006_import_legacy_centers.sql`](./supabase/006_import_legacy_centers.sql)
     if you want the historical 2025/2026 accredited-center records imported (see below),
     then [`supabase/007_pre_notification.sql`](./supabase/007_pre_notification.sql)
     and [`supabase/008_signed_pre_notification.sql`](./supabase/008_signed_pre_notification.sql)
     and [`supabase/009_post_notification.sql`](./supabase/009_post_notification.sql),
     which additively add everything from the inspection cycle through
     certificate issuance without touching your existing data.
3. In **Project Settings → API**, copy the **Project URL** and **anon public
   key**.
4. To create your first administrator: sign up normally through the app,
   then in the SQL editor run:
   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```
   From then on, any admin can promote other users from **Admin → Users**.

## 2. Configure environment variables

Copy `.env.local.example` to `.env.local` and fill in your Supabase values:

```bash
cp .env.local.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## 3. Run locally

```bash
npm install
npm run dev
```

Visit `http://localhost:3000` — applicants land on `/login`, `/signup`;
admins use `/admin/login`.

## 4. Deploy to Vercel

1. Push this project to a GitHub repository.
2. In [Vercel](https://vercel.com), click **Add New → Project** and import
   the repo.
3. Under **Environment Variables**, add the same two Supabase variables from
   step 2.
4. Deploy. Vercel builds the Next.js app automatically — no extra config
   needed.
5. In Supabase, add your Vercel domain (e.g. `https://your-app.vercel.app`)
   under **Authentication → URL Configuration → Redirect URLs** so email
   confirmation links work in production.

## Project structure

```
src/
  app/
    login/, signup/                Client auth
    dashboard/, apply/, accredited/, documents/, profile/   Client area
    admin/
      login/, dashboard/, applications/, applications/[id]/
      accredited/, centers/, certificates/, qualification/, users/  Admin area
  components/
    ClientShell.js, AdminShell.js, StatusPill.js
  lib/supabase/
    client.js, server.js, middleware.js
supabase/
  schema.sql                        Full DB schema, RLS policies + qualification seed data
```

## Notes

- `src/middleware.js` mirrors the flowchart's "Logged in?" / "Login" decision
  diamonds — it redirects signed-out visitors away from protected routes and
  keeps non-admins out of `/admin/*`.
- Applying uploads documents to Supabase Storage first, then creates the
  `assessment_applications` row plus one `assessment_application_documents`
  row per file on final submit (`status = 'pending'`).
- Approving an application inserts a new `assessment_centers` row with a
  generated `cert_number`, a 2-year validity window, and `status = 'active'`,
  then flips the application to `approved`. Denying requires a reason, stored
  in `admin_reason` and shown back to the applicant.
- File uploads (application documents, certificates) go to the
  `accreditation-files` Supabase Storage bucket.
