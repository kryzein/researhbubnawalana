
/*
  # Fix Security Issues: Indexes and RLS Performance

  ## Summary
  This migration addresses two categories of issues:

  1. **Missing Indexes on Foreign Keys**
     - `project_files.project_id` → adds index for faster joins/lookups
     - `projects.owner_id` → adds index for faster user-scoped queries
     - `saved_papers.user_id` → adds index for faster user-scoped queries

  2. **RLS Policy Performance (Auth Initialization Plan)**
     Replaces `auth.uid()` with `(select auth.uid())` in all policies across:
     - `public.profiles` (view, insert, update, delete)
     - `public.projects` (view, insert, update, delete)
     - `public.saved_papers` (view, insert, update, delete)
     - `public.project_files` (view, insert, delete)

     This change ensures auth functions are evaluated once per query rather than once per row,
     significantly improving performance at scale.
*/

-- Add missing indexes on foreign key columns
CREATE INDEX IF NOT EXISTS idx_project_files_project_id ON public.project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON public.projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_saved_papers_user_id ON public.saved_papers(user_id);

-- Fix RLS policies on profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

CREATE POLICY "Users can delete own profile"
  ON public.profiles FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = id);

-- Fix RLS policies on projects
DROP POLICY IF EXISTS "Users can view own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can insert own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON public.projects;

CREATE POLICY "Users can view own projects"
  ON public.projects FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = owner_id);

CREATE POLICY "Users can insert own projects"
  ON public.projects FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = owner_id);

CREATE POLICY "Users can update own projects"
  ON public.projects FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = owner_id)
  WITH CHECK ((select auth.uid()) = owner_id);

CREATE POLICY "Users can delete own projects"
  ON public.projects FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = owner_id);

-- Fix RLS policies on saved_papers
DROP POLICY IF EXISTS "Users can view own papers" ON public.saved_papers;
DROP POLICY IF EXISTS "Users can insert own papers" ON public.saved_papers;
DROP POLICY IF EXISTS "Users can update own papers" ON public.saved_papers;
DROP POLICY IF EXISTS "Users can delete own papers" ON public.saved_papers;

CREATE POLICY "Users can view own papers"
  ON public.saved_papers FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own papers"
  ON public.saved_papers FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own papers"
  ON public.saved_papers FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own papers"
  ON public.saved_papers FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- Fix RLS policies on project_files
DROP POLICY IF EXISTS "Users can view own project files" ON public.project_files;
DROP POLICY IF EXISTS "Users can insert own project files" ON public.project_files;
DROP POLICY IF EXISTS "Users can update own project files" ON public.project_files;
DROP POLICY IF EXISTS "Users can delete own project files" ON public.project_files;

CREATE POLICY "Users can view own project files"
  ON public.project_files FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_files.project_id
      AND projects.owner_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can insert own project files"
  ON public.project_files FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_files.project_id
      AND projects.owner_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can delete own project files"
  ON public.project_files FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_files.project_id
      AND projects.owner_id = (select auth.uid())
    )
  );
