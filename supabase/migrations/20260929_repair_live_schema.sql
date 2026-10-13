-- Repair migration for the LIVE database (project lkvbzkbftogwobvyjxhc).
--
-- Written after running `npm run db:check` on 2026-09-29, which reported:
--   missing tables : project_statuses, task_activity, task_comments
--   missing columns: projects.accent_color, projects.archived_at,
--                    projects.default_view, projects.icon, projects.owner_id,
--                    tasks.tags
--
-- Every statement is idempotent — safe to run more than once.
-- Run it in Supabase → SQL Editor → New query.

-- ---------------------------------------------------------------- 1. tables --

create table if not exists project_statuses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  key text not null,
  color text not null default '#9AA1AC',
  sort_order integer not null default 0,
  is_done boolean not null default false,
  unique (project_id, key)
);

create table if not exists task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists task_activity (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  action text not null,
  details text,
  created_at timestamptz not null default now()
);

create index if not exists idx_task_comments_task on task_comments(task_id);
create index if not exists idx_task_activity_task on task_activity(task_id);
create index if not exists idx_project_statuses_project on project_statuses(project_id);

alter table project_statuses enable row level security;
alter table task_comments enable row level security;
alter table task_activity enable row level security;

-- --------------------------------------------------------------- 2. columns --

alter table projects
  add column if not exists accent_color text not null default '#12A594',
  add column if not exists archived_at timestamptz,
  add column if not exists default_view text not null default 'kanban',
  add column if not exists icon text not null default 'folder',
  add column if not exists owner_id uuid references users(id) on delete set null;

alter table tasks
  add column if not exists tags text[] default array[]::text[];

-- ------------------------------------------------- 3. seed default statuses --

-- Existing projects have no statuses yet, so the Kanban would render empty
-- until someone opened project settings. Seed the standard five.
insert into project_statuses (project_id, name, key, color, sort_order, is_done)
select id, 'To Do', 'todo', '#9AA1AC', 0, false from projects
on conflict (project_id, key) do nothing;

insert into project_statuses (project_id, name, key, color, sort_order, is_done)
select id, 'In Progress', 'in_progress', '#12A594', 1, false from projects
on conflict (project_id, key) do nothing;

insert into project_statuses (project_id, name, key, color, sort_order, is_done)
select id, 'Review', 'review', '#F59E0B', 2, false from projects
on conflict (project_id, key) do nothing;

insert into project_statuses (project_id, name, key, color, sort_order, is_done)
select id, 'Blocked', 'blocked', '#EF4444', 3, false from projects
on conflict (project_id, key) do nothing;

insert into project_statuses (project_id, name, key, color, sort_order, is_done)
select id, 'Done', 'done', '#10B981', 4, true from projects
on conflict (project_id, key) do nothing;

-- ------------------------------------------------------------------ 4. done --

-- Without this, PostgREST keeps serving the old shape and the API keeps
-- returning "Could not find the 'x' column of 'y' in the schema cache".
notify pgrst, 'reload schema';
