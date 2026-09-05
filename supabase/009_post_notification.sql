-- ============================================================================
-- Migration: post-inspection letter (TESDA-OP-CO-03-F09)
--
-- Same draft/signed pattern as the pre-notification letter: the system
-- generates an unsigned draft once the admin marks the inspection compliant
-- or non-compliant, the admin reviews and signs it, then uploads the signed
-- copy — only the signed version is ever shown to the client.
-- ============================================================================

alter table public.inspections
  add column if not exists post_notification_pdf_url text,
  add column if not exists signed_post_notification_pdf_url text;
