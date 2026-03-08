/*
  # Fix Infinite Recursion in project_collaborators RLS Policies

  ## Problem
  The `projects` SELECT policy checks `project_collaborators` via EXISTS subquery.
  The `project_collaborators` SELECT policy checks ownership via a reference that
  can loop back through projects, causing "infinite recursion detected in policy
  for relation project_collaborators".

  ## Solution
  1. Create a SECURITY DEFINER helper function `is_project_collaborator` that
     queries `project_collaborators` bypassing RLS, breaking the recursion cycle.
  2. Rebuild the `projects` SELECT and UPDATE policies to use this function.
  3. Rebuild the `project_collaborators` SELECT policy to avoid triggering
     the projects policy recursively.

  ## Changes
  - New function: `public.is_project_collaborator(project_uuid uuid)` - SECURITY DEFINER
  - New function: `public.is_project_owner(project_uuid uuid)` - SECURITY DEFINER
  - Replaced projects SELECT policy: uses helper function
  - Replaced projects UPDATE policy: uses helper function
  - Replaced project_collaborators SELECT policy: uses auth.uid() directly
  - Added project_collaborators UPDATE policy (was missing)
*/

-- Helper: check if current user is the owner of a project (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_project_owner(project_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = project_uuid
    AND owner_id = auth.uid()
  );
$$;

-- Helper: check if current user is a collaborator on a project (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_project_collaborator(project_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_collaborators
    WHERE project_id = project_uuid
    AND user_id = auth.uid()
  );
$$;

-- Helper: check if current user is a collaborator with a specific role
CREATE OR REPLACE FUNCTION public.is_project_collaborator_with_role(project_uuid uuid, required_role text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_collaborators
    WHERE project_id = project_uuid
    AND user_id = auth.uid()
    AND role = required_role
  );
$$;

-- Rebuild projects SELECT policy to use helper (breaks recursion)
DROP POLICY IF EXISTS "Users can view own or shared projects" ON public.projects;
CREATE POLICY "Users can view own or shared projects"
  ON public.projects FOR SELECT
  TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    OR public.is_project_collaborator(id)
  );

-- Rebuild projects UPDATE policy to use helper (breaks recursion)
DROP POLICY IF EXISTS "Owners and editor collaborators can update projects" ON public.projects;
CREATE POLICY "Owners and editor collaborators can update projects"
  ON public.projects FOR UPDATE
  TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    OR public.is_project_collaborator_with_role(id, 'editor')
  )
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    OR public.is_project_collaborator_with_role(id, 'editor')
  );

-- Rebuild project_collaborators SELECT policy — only check auth.uid() directly, no project table join
DROP POLICY IF EXISTS "Collaborators can view their own records" ON public.project_collaborators;
CREATE POLICY "Collaborators can view their own records"
  ON public.project_collaborators FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR invited_by = (SELECT auth.uid())
    OR public.is_project_owner(project_id)
  );

-- Add missing UPDATE policy for project_collaborators
DROP POLICY IF EXISTS "Project owners can update collaborator roles" ON public.project_collaborators;
CREATE POLICY "Project owners can update collaborator roles"
  ON public.project_collaborators FOR UPDATE
  TO authenticated
  USING (public.is_project_owner(project_id))
  WITH CHECK (public.is_project_owner(project_id));
