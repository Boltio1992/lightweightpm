-- Additive migration for existing installations.
-- Run this after the original schema.sql.
alter table projects add column if not exists percent_complete integer;
alter table tasks add column if not exists duration_days integer;
alter table tasks add column if not exists percent_complete integer not null default 0;

update tasks set percent_complete = case when status = 'done' then 100 else 0 end
where percent_complete is null;

alter table projects drop constraint if exists projects_percent_complete_check;
alter table projects add constraint projects_percent_complete_check
  check (percent_complete is null or percent_complete between 0 and 100);
alter table tasks drop constraint if exists tasks_percent_complete_check;
alter table tasks add constraint tasks_percent_complete_check
  check (percent_complete between 0 and 100);
alter table tasks drop constraint if exists tasks_duration_days_check;
alter table tasks add constraint tasks_duration_days_check
  check (duration_days is null or duration_days >= 0);
