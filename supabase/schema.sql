-- LightPM database schema
-- Run this whole file once in Supabase: Project -> SQL Editor -> New query -> paste -> Run

create extension if not exists "pgcrypto";

-- ========== USERS ==========
-- Custom username/password auth (NOT Supabase Auth). All access goes through
-- server-side API routes using the service role key, so RLS is not required
-- for correctness, but we enable it and lock it down anyway as defense in depth.
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null check (char_length(username) between 3 and 32),
  password_hash text not null,
  name text not null default '',
  title text not null default '',
  role text not null default 'member', -- e.g. admin, member
  -- "data members" are typed in by hand (name/title/role) so they can be
  -- assigned tasks without ever logging in. They have an unusable password.
  is_placeholder boolean not null default false,
  created_at timestamptz not null default now()
);

-- ========== PROJECTS ==========
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  status text not null default 'active', -- active, on_hold, done, archived
  start_date date,
  end_date date,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ========== PROJECT MEMBERS ==========
create table if not exists project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null default 'member', -- project-specific role, e.g. owner, member, viewer
  added_at timestamptz not null default now(),
  unique (project_id, user_id)
);

-- ========== TASKS ==========
-- A task with project_id = null is a standalone (non-project) task.
-- A task with parent_task_id set is a sub-task of another task.
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  parent_task_id uuid references tasks(id) on delete cascade,
  title text not null,
  description text not null default '',
  status text not null default 'todo', -- todo, in_progress, blocked, done
  priority text not null default 'medium', -- low, medium, high, urgent
  assignee_id uuid references users(id) on delete set null,
  start_date date,
  due_date date,
  sla_date date, -- deadline used for SLA / on-time reporting
  sort_order integer not null default 0,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tasks_project on tasks(project_id);
create index if not exists idx_tasks_parent on tasks(parent_task_id);
create index if not exists idx_tasks_assignee on tasks(assignee_id);
create index if not exists idx_tasks_status on tasks(status);
create index if not exists idx_project_members_project on project_members(project_id);
create index if not exists idx_project_members_user on project_members(user_id);

-- keep updated_at fresh
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_projects_updated_at on projects;
create trigger trg_projects_updated_at before update on projects
  for each row execute function set_updated_at();

drop trigger if exists trg_tasks_updated_at on tasks;
create trigger trg_tasks_updated_at before update on tasks
  for each row execute function set_updated_at();

-- ========== ROW LEVEL SECURITY ==========
-- The app never queries Supabase from the browser: every request goes through
-- Next.js API routes using the service role key (which bypasses RLS). We still
-- enable RLS and deny-all for the anon/public key as defense in depth, in case
-- that key is ever exposed to the client by mistake.
alter table users enable row level security;
alter table projects enable row level security;
alter table project_members enable row level security;
alter table tasks enable row level security;

drop policy if exists "deny all" on users;
create policy "deny all" on users for all using (false);
drop policy if exists "deny all" on projects;
create policy "deny all" on projects for all using (false);
drop policy if exists "deny all" on project_members;
create policy "deny all" on project_members for all using (false);
drop policy if exists "deny all" on tasks;
create policy "deny all" on tasks for all using (false);
