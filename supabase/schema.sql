-- LightPM schema
create extension if not exists "pgcrypto";

create table if not exists users (
  id uuid primary key default gen_random_uuid(), username text unique not null check (char_length(username) between 3 and 32),
  password_hash text not null, name text not null default '', title text not null default '', role text not null default 'member',
  is_placeholder boolean not null default false, created_at timestamptz not null default now()
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(), name text not null, description text not null default '',
  status text not null default 'active', start_date date, end_date date,
  percent_complete integer check (percent_complete is null or percent_complete between 0 and 100),
  accent_color text not null default '#12A594', icon text not null default 'folder', owner_id uuid references users(id) on delete set null,
  default_view text not null default 'kanban', archived_at timestamptz,
  created_by uuid references users(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

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

create table if not exists project_members (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade, role text not null default 'member', added_at timestamptz not null default now(), unique (project_id, user_id)
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(), project_id uuid references projects(id) on delete cascade,
  parent_task_id uuid references tasks(id) on delete cascade, title text not null, description text not null default '',
  status text not null default 'todo', priority text not null default 'medium', assignee_id uuid references users(id) on delete set null,
  start_date date, due_date date, duration_days integer check (duration_days is null or duration_days >= 0),
  percent_complete integer not null default 0 check (percent_complete between 0 and 100), sort_order integer not null default 0,
  tags text[] default array[]::text[],
  created_by uuid references users(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
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

create index if not exists idx_tasks_project on tasks(project_id);
create index if not exists idx_tasks_parent on tasks(parent_task_id);
create index if not exists idx_tasks_assignee on tasks(assignee_id);
create index if not exists idx_tasks_status on tasks(status);
create index if not exists idx_task_comments_task on task_comments(task_id);
create index if not exists idx_task_activity_task on task_activity(task_id);
create index if not exists idx_project_members_project on project_members(project_id);
create index if not exists idx_project_members_user on project_members(user_id);
create index if not exists idx_project_statuses_project on project_statuses(project_id);

create or replace function set_updated_at() returns trigger as $$ begin new.updated_at = now(); return new; end; $$ language plpgsql;
drop trigger if exists trg_projects_updated_at on projects;
create trigger trg_projects_updated_at before update on projects for each row execute function set_updated_at();
drop trigger if exists trg_tasks_updated_at on tasks;
create trigger trg_tasks_updated_at before update on tasks for each row execute function set_updated_at();

alter table users enable row level security;
alter table projects enable row level security;
alter table project_statuses enable row level security;
alter table project_members enable row level security;
alter table tasks enable row level security;
alter table task_comments enable row level security;
alter table task_activity enable row level security;

insert into project_statuses (project_id, name, key, color, sort_order, is_done)
select id, 'To Do', 'todo', '#9AA1AC', 0, false
from projects
on conflict (project_id, key) do nothing;

insert into project_statuses (project_id, name, key, color, sort_order, is_done)
select id, 'In Progress', 'in_progress', '#12A594', 1, false
from projects
on conflict (project_id, key) do nothing;

insert into project_statuses (project_id, name, key, color, sort_order, is_done)
select id, 'Review', 'review', '#F59E0B', 2, false
from projects
on conflict (project_id, key) do nothing;

insert into project_statuses (project_id, name, key, color, sort_order, is_done)
select id, 'Blocked', 'blocked', '#EF4444', 3, false
from projects
on conflict (project_id, key) do nothing;

insert into project_statuses (project_id, name, key, color, sort_order, is_done)
select id, 'Done', 'done', '#10B981', 4, true
from projects
on conflict (project_id, key) do nothing;
