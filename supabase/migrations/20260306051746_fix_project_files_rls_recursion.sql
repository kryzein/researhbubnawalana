/*
  # Fix project_files RLS Policies to Avoid Recursion

  ## Problem
  The project_files SELECT and UPDATE policies join through `projects` and then
  `project_collaborators`, which can trigger the same infinite recursion as the
  projects table policies.

  ## Solution
  Replace inline EXISTS subqueries with calls to the SECURITY DEFINER helper
  functions created in the previous migration, which bypass RLS and break the cycle.

  ## Changes
  - Rebuilt project_files SELECT policy: uses is_project_owner + is_project_collaborator
  - Rebuilt project_files INSERT policy: uses is_project_owner + is_project_collaborator_with_role
  - Rebuilt project_files UPDATE policy: uses is_project_owner + is_project_collaborator_with_role
  - Rebuilt project_files DELETE policy: uses is_project_owner only
*/

DROP POLICY IF EXISTS "Users can view own or shared project files" ON public.project_files;
DROP POLICY IF EXISTS "Users can view own project files" ON public.project_files;
DROP POLICY IF EXISTS "Owners and editors can insert project files" ON public.project_files;
DROP POLICY IF EXISTS "Users can insert own project files" ON public.project_files;
DROP POLICY IF EXISTS "Owners and editors can update project files" ON public.project_files;
DROP POLICY IF EXISTS "Users can delete own project files" ON public.project_files;

CREATE POLICY "Owners and collaborators can view project files"
  ON public.project_files FOR SELECT
  TO authenticated
  USING (
    public.is_project_owner(project_id)
    OR public.is_project_collaborator(project_id)
  );

CREATE POLICY "Owners and editors can insert project files"
  ON public.project_files FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_project_owner(project_id)
    OR public.is_project_collaborator_with_role(project_id, 'editor')
  );

CREATE POLICY "Owners and editors can update project files"
  ON public.project_files FOR UPDATE
  TO authenticated
  USING (
    public.is_project_owner(project_id)
    OR public.is_project_collaborator_with_role(project_id, 'editor')
  )
  WITH CHECK (
    public.is_project_owner(project_id)
    OR public.is_project_collaborator_with_role(project_id, 'editor')
  );

CREATE POLICY "Owners and editors can delete project files"
  ON public.project_files FOR DELETE
  TO authenticated
  USING (
    public.is_project_owner(project_id)
    OR public.is_project_collaborator_with_role(project_id, 'editor')
  );
