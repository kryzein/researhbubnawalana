
/*
  # Create Storage Bucket and Project Files Table

  1. Storage
    - Creates `project-papers` public bucket for file uploads
    - Policies: users can upload/view/delete only their own files (enforced by folder path)

  2. New Tables
    - `project_files` - tracks uploaded file metadata per project

  3. Security
    - RLS enabled on project_files
    - Users can only access their own file records
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('project-papers', 'project-papers', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can upload their own project papers' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Users can upload their own project papers"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'project-papers' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own project papers' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Users can view their own project papers"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'project-papers' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete their own project papers' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Users can delete their own project papers"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'project-papers' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.project_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own project files"
ON public.project_files FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own project files"
ON public.project_files FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own project files"
ON public.project_files FOR DELETE
USING (auth.uid() = user_id);
