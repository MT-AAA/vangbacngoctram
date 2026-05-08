-- Phase 3 — allow Excel import rollback status.
-- Keeps the import_files history row after deleting sales rows that came from
-- an accidentally imported Excel file.

alter type public.import_status add value if not exists 'rolled_back';
