-- =========================================================================
-- LightPM: Clear Database SQL Script
-- =========================================================================
-- This script safely removes data from your LightPM database.
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- or via psql.
-- =========================================================================

-- OPTION 1: CLEAR ALL WORKSPACE DATA (PRESERVES USERS & LOGIN ACCOUNTS)
-- Recommended: Clears all tasks, comments, activity logs, project members,
-- custom statuses, and projects while keeping your user accounts intact so
-- you and your team can still log in without re-registering.

TRUNCATE TABLE 
  task_activity,
  task_comments,
  tasks,
  project_statuses,
  project_members,
  projects
CASCADE;

-- Reset any auto-incrementing sequences if applicable
-- (All tables use UUIDs so no sequence reset is needed)


-- =========================================================================
-- OPTION 2: COMPLETE DATABASE WIPE (DELETES USERS & ALL DATA)
-- =========================================================================
-- WARNING: Uncomment the lines below ONLY if you want to permanently delete
-- all user accounts and start with a completely empty database.

/*
TRUNCATE TABLE 
  task_activity,
  task_comments,
  tasks,
  project_statuses,
  project_members,
  projects,
  users
CASCADE;
*/
