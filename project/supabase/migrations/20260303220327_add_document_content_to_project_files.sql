/*
  # Add document_content to project_files

  1. Changes
    - `project_files`: add `document_content` column (text, nullable)
      - Stores the HTML content extracted/edited in the editor for this specific file
      - Null means no edits have been made yet (show original file)

  2. Notes
    - Existing rows will have NULL, meaning they'll fall back to original file view
    - No data loss - purely additive change
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_files' AND column_name = 'document_content'
  ) THEN
    ALTER TABLE project_files ADD COLUMN document_content text;
  END IF;
END $$;
