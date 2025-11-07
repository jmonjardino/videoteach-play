-- Create storage bucket for knowledge base documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('course-knowledge-bases', 'course-knowledge-bases', false);

-- Create course_knowledge_base table
CREATE TABLE public.course_knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(course_id)
);

-- Enable RLS
ALTER TABLE public.course_knowledge_base ENABLE ROW LEVEL SECURITY;

-- RLS Policies for course_knowledge_base table
-- Only course instructors can view their course knowledge base
CREATE POLICY "Instructors can view own course knowledge base"
ON public.course_knowledge_base
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.courses
    WHERE courses.id = course_knowledge_base.course_id
    AND courses.instructor_id = auth.uid()
  )
);

-- Only course instructors can insert knowledge base
CREATE POLICY "Instructors can upload knowledge base"
ON public.course_knowledge_base
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.courses
    WHERE courses.id = course_knowledge_base.course_id
    AND courses.instructor_id = auth.uid()
    AND has_role(auth.uid(), 'instructor'::app_role)
  )
);

-- Only course instructors can update their knowledge base
CREATE POLICY "Instructors can update own knowledge base"
ON public.course_knowledge_base
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.courses
    WHERE courses.id = course_knowledge_base.course_id
    AND courses.instructor_id = auth.uid()
  )
);

-- Only course instructors can delete their knowledge base
CREATE POLICY "Instructors can delete own knowledge base"
ON public.course_knowledge_base
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.courses
    WHERE courses.id = course_knowledge_base.course_id
    AND courses.instructor_id = auth.uid()
  )
);

-- Storage policies for course-knowledge-bases bucket
-- Instructors can upload to their own course folder
CREATE POLICY "Instructors can upload knowledge base files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'course-knowledge-bases'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.courses WHERE instructor_id = auth.uid()
  )
);

-- Instructors can view their own course knowledge base files
CREATE POLICY "Instructors can view own knowledge base files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'course-knowledge-bases'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.courses WHERE instructor_id = auth.uid()
  )
);

-- Instructors can delete their own course knowledge base files
CREATE POLICY "Instructors can delete own knowledge base files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'course-knowledge-bases'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.courses WHERE instructor_id = auth.uid()
  )
);