-- Adds project customization fields and the review workflow stage.
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS accent_color text NOT NULL DEFAULT '#12A594',
  ADD COLUMN IF NOT EXISTS icon text NOT NULL DEFAULT 'folder',
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS default_view text NOT NULL DEFAULT 'kanban',
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

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

CREATE INDEX IF NOT EXISTS idx_project_statuses_project ON project_statuses(project_id);

INSERT INTO project_statuses (project_id, name, key, color, sort_order, is_done)
SELECT id, 'To Do', 'todo', '#9AA1AC', 0, false
FROM projects
ON CONFLICT (project_id, key) DO NOTHING;

INSERT INTO project_statuses (project_id, name, key, color, sort_order, is_done)
SELECT id, 'In Progress', 'in_progress', '#12A594', 1, false
FROM projects
ON CONFLICT (project_id, key) DO NOTHING;

INSERT INTO project_statuses (project_id, name, key, color, sort_order, is_done)
SELECT id, 'Review', 'review', '#F59E0B', 2, false
FROM projects
ON CONFLICT (project_id, key) DO NOTHING;

INSERT INTO project_statuses (project_id, name, key, color, sort_order, is_done)
SELECT id, 'Blocked', 'blocked', '#EF4444', 3, false
FROM projects
ON CONFLICT (project_id, key) DO NOTHING;

INSERT INTO project_statuses (project_id, name, key, color, sort_order, is_done)
SELECT id, 'Done', 'done', '#10B981', 4, true
FROM projects
ON CONFLICT (project_id, key) DO NOTHING;
