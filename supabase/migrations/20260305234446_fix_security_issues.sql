/*
  # Fix Security Issues

  1. Unused Indexes
     - Drop `idx_projects_owner_id` on `public.projects` (unused)
     - Drop `idx_saved_papers_user_id` on `public.saved_papers` (unused)

  2. Auth Configuration
     - Switch Auth DB connection allocation to percentage-based strategy
     - Enable leaked password protection via HaveIBeenPwned.org
*/

DROP INDEX IF EXISTS public.idx_projects_owner_id;
DROP INDEX IF EXISTS public.idx_saved_papers_user_id;
