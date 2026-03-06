
-- Add a column to store document content for the collaborative editor
ALTER TABLE public.projects ADD COLUMN document_content text DEFAULT '';
