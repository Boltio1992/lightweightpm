-- Brings existing databases in line with supabase/schema.sql.
--
-- These columns were added to schema.sql without a migration, so databases
-- created earlier are missing them. PostgREST then rejects queries that name
-- them explicitly ("column tasks.tags does not exist" / PGRST204), which
-- surfaces as a 500 on the Tasks and Projects pages.
--
-- Safe to run more than once.

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS duration_days integer CHECK (duration_days IS NULL OR duration_days >= 0),
  ADD COLUMN IF NOT EXISTS percent_complete integer NOT NULL DEFAULT 0 CHECK (percent_complete BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT array[]::text[];

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS percent_complete integer CHECK (percent_complete IS NULL OR percent_complete BETWEEN 0 AND 100);

-- Make PostgREST pick up the new columns immediately (otherwise the schema
-- cache can serve the old shape for a while).
NOTIFY pgrst, 'reload schema';
