-- Migration: Course AI Chatbot tables and cache
-- Creates chat sessions, messages, and knowledge base text cache with RLS policies

-- Enable required extension for uuid if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Chat sessions
CREATE TABLE IF NOT EXISTS public.course_chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Chat messages
CREATE TABLE IF NOT EXISTS public.course_chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES public.course_chat_sessions(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Cache of extracted knowledge base text (for performance)
CREATE TABLE IF NOT EXISTS public.course_knowledge_base_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    file_hash TEXT NOT NULL,
    text TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(course_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_course ON public.course_chat_sessions(user_id, course_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON public.course_chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.course_chat_messages(created_at);

-- RLS enable
ALTER TABLE public.course_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_knowledge_base_cache ENABLE ROW LEVEL SECURITY;

-- Policies: Users can see and create only their own sessions
DROP POLICY IF EXISTS "Users can view own chat sessions" ON public.course_chat_sessions;
CREATE POLICY "Users can view own chat sessions"
    ON public.course_chat_sessions FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own chat sessions" ON public.course_chat_sessions;
CREATE POLICY "Users can create own chat sessions"
    ON public.course_chat_sessions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policies: Users can view/create only messages tied to their sessions
DROP POLICY IF EXISTS "Users can view own messages" ON public.course_chat_messages;
CREATE POLICY "Users can view own messages"
    ON public.course_chat_messages FOR SELECT
    USING (
        session_id IN (
            SELECT id FROM public.course_chat_sessions WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can create own messages" ON public.course_chat_messages;
CREATE POLICY "Users can create own messages"
    ON public.course_chat_messages FOR INSERT
    WITH CHECK (
        session_id IN (
            SELECT id FROM public.course_chat_sessions WHERE user_id = auth.uid()
        )
    );

-- Cache policies: allow select for enrolled users via joining enrollments; inserts/updates only via service role
DROP POLICY IF EXISTS "Enrolled users can read cache" ON public.course_knowledge_base_cache;
CREATE POLICY "Enrolled users can read cache"
    ON public.course_knowledge_base_cache FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.enrollments e
            WHERE e.course_id = course_knowledge_base_cache.course_id
              AND e.student_id = auth.uid()
        )
    );

-- No insert/update/delete policy for cache; rely on service role