-- ============================================================================
-- Migration: pre-notification letter (TESDA-OP-CO-03-F06)
-- ============================================================================

alter table public.inspections
  add column if not exists inspection_time text,
  add column if not exists notification_pdf_url text;
