-- ============================================================================
-- Migration: signed pre-notification letter
--
-- The system-generated pre-notification letter (notification_pdf_url) is a
-- draft the admin reviews and physically signs; this column holds the
-- scanned signed version the admin uploads back. The client only ever sees
-- this signed version, never the unsigned draft.
-- ============================================================================

alter table public.inspections
  add column if not exists signed_notification_pdf_url text;
