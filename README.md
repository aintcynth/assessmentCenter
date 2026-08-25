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
2. Open **SQL Editor** and run the contents of [`supabase/schema.sql`](./supabase/schema.sql).
   This creates every table in the flow (`profiles`, `applications`,
   `documents`, `inspections`, `poi_requirements`, `payment_proofs`,
   `centers`, `certificates`), enables Row Level Security so applicants can
   only see their own records while admins see everything, adds a trigger
   that auto-creates a `profiles` row on sign-up, and creates a public
   storage bucket (`accreditation-files`) for uploaded documents.
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
