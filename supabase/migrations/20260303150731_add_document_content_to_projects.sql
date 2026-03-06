
/*
  # Add document_content column to projects

  Adds a `document_content` text column to the `projects` table
  to persist collaborative editor content.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'document_content'
  ) THEN
    ALTER TABLE public.projects ADD COLUMN document_content TEXT DEFAULT '';
  END IF;
END $$;
