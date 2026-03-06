/*
  # Add foreign key from project_collaborators.user_id to profiles.user_id

  This enables PostgREST to resolve the join
  `profiles:user_id(display_name)` when querying project_collaborators.

  1. Changes
    - Add foreign key constraint on project_collaborators(user_id) -> profiles(user_id)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'project_collaborators_user_id_fkey_profiles'
      AND table_name = 'project_collaborators'
  ) THEN
    ALTER TABLE project_collaborators
      ADD CONSTRAINT project_collaborators_user_id_fkey_profiles
      FOREIGN KEY (user_id) REFERENCES profiles(user_id);
  END IF;
END $$;
