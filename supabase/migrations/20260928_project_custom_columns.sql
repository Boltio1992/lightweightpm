-- Makes sure a database created before the project-settings feature has every
-- column the app writes to. Idempotent — safe to run more than once.
--
-- Symptom this fixes: "Could not find the 'accent_color' column of 'projects'
-- in the schema cache" when creating or importing a project.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS accent_color text NOT NULL DEFAULT '#12A594',
  ADD COLUMN IF NOT EXISTS icon text NOT NULL DEFAULT 'folder',
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS default_view text NOT NULL DEFAULT 'kanban',
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS percent_complete integer CHECK (percent_complete IS NULL OR percent_complete BETWEEN 0 AND 100);

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS duration_days integer CHECK (duration_days IS NULL OR duration_days >= 0),
  ADD COLUMN IF NOT EXISTS percent_complete integer NOT NULL DEFAULT 0 CHECK (percent_complete BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT array[]::text[];

CREATE TABLE IF NOT EXISTS project_statuses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  key text not null,
  color text not null default '#9AA1AC',
  sort_order integer not null default 0,
  is_done boolean not null default false,
  unique (project_id, key)
);

-- Refresh PostgREST's schema cache so the columns are visible to the API right
-- away. Without this, PostgREST keeps serving the old shape and keeps reporting
-- "Could not find the '<column>' column ... in the schema cache".
NOTIFY pgrst, 'reload schema';
