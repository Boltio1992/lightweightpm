-- LightPM workflow fields - reference numbers, classification, external links and
-- task members. Phase 1 of docs/redesign/05-light-plan.md.
--
-- Every statement is idempotent - safe to run more than once.
-- Run it in Supabase -> SQL Editor -> New query (or via psql on your own server).

-- ------------------------------------------------------------- 1. columns --

-- Classification for the legacy registers: a human reference, the register the
-- row came from, and the In Plan / New Request split with its request type.
-- All three of type/plan_class/request_type hold keys from configurable lists in
-- the app, never a hard-coded enum.
alter table projects
  add column if not exists reference_no text,
  add column if not exists type text,
  add column if not exists plan_class text,
  add column if not exists request_type text;

-- Their own follow-up items are referenced too.
alter table tasks
  add column if not exists reference_no text;

-- -------------------------------------------------------------- 2. tables --

-- References out to Ticket / Change Request / Change Release. Those records live
-- in their own systems; title and progress_percent are typed by hand for the demo
-- and become values pulled by a direct query once those systems are reachable.
-- kind + reference are the query key, so the shape does not change when that swap
-- happens.
create table if not exists links (
  id uuid primary key default gen_random_uuid(),
  owner_kind text not null check (owner_kind in ('project', 'task')),
  owner_id uuid not null,
  kind text not null check (kind in ('ticket', 'change_request', 'change_release')),
  reference text not null,
  title text,
  progress_percent integer check (progress_percent is null or progress_percent between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- People named on a project-less task; mirrors project_members.
create table if not exists task_members (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null default 'member',
  added_at timestamptz not null default now(),
  unique (task_id, user_id)
);

-- Configurable lists: project type, plan class, request type. One table rather
-- than one per list - they all have the same shape, a stable value plus an
-- editable label in a chosen order. Seeded by the app on first use.
create table if not exists config_options (
  id uuid primary key default gen_random_uuid(),
  list_key text not null,
  value text not null,
  label text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (list_key, value)
);

create index if not exists idx_links_owner on links(owner_kind, owner_id);
create index if not exists idx_task_members_task on task_members(task_id);
create index if not exists idx_config_options_list on config_options(list_key);

-- Defense in depth, like every other table: the API uses the service role, which
-- bypasses RLS, so this only matters if a key is ever exposed.
alter table links enable row level security;
alter table task_members enable row level security;
alter table config_options enable row level security;

-- ------------------------------------------------------------------ 3. done --

-- Without this, PostgREST keeps serving the old shape and the API returns
-- "Could not find the 'x' column of 'y' in the schema cache".
notify pgrst, 'reload schema';
