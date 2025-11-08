-- Migration: Chat history metadata, triggers, and RLS updates
-- Adds title, last_message_at, message_count to sessions and implements
-- trigger-based updates and auto-title generation. Also adds update/delete policies.

-- Add metadata columns to chat sessions
ALTER TABLE IF EXISTS public.course_chat_sessions
    ADD COLUMN IF NOT EXISTS title TEXT,
    ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS message_count INTEGER NOT NULL DEFAULT 0;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_chat_sessions_last_message ON public.course_chat_sessions(last_message_at);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_message_count ON public.course_chat_sessions(message_count);

-- Function: update session metadata on new message
CREATE OR REPLACE FUNCTION public.update_chat_session_metadata()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.course_chat_sessions
  SET 
    last_message_at = NEW.created_at,
    message_count = COALESCE(public.course_chat_sessions.message_count, 0) + 1,
    updated_at = now()
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: after insert on messages, update session metadata
DROP TRIGGER IF EXISTS update_session_on_message ON public.course_chat_messages;
CREATE TRIGGER update_session_on_message
AFTER INSERT ON public.course_chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_chat_session_metadata();

-- Function: auto-generate conversation title based on the first user message
CREATE OR REPLACE FUNCTION public.generate_conversation_title()
RETURNS TRIGGER AS $$
DECLARE
  first_user_msg TEXT;
BEGIN
  -- Only set title when message_count becomes 1 and title is null
  IF NEW.message_count = 1 THEN
    SELECT content INTO first_user_msg
    FROM public.course_chat_messages
    WHERE session_id = NEW.id AND role = 'user'
    ORDER BY created_at ASC
    LIMIT 1;

    IF first_user_msg IS NOT NULL THEN
      UPDATE public.course_chat_sessions
      SET title = CASE
        WHEN length(first_user_msg) > 50 THEN substring(first_user_msg FROM 1 FOR 50) || '...'
        ELSE first_user_msg
      END
      WHERE id = NEW.id AND title IS NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: after message_count update, try to set auto title
DROP TRIGGER IF EXISTS auto_title_trigger ON public.course_chat_sessions;
CREATE TRIGGER auto_title_trigger
AFTER UPDATE OF message_count ON public.course_chat_sessions
FOR EACH ROW
WHEN (NEW.message_count = 1)
EXECUTE FUNCTION public.generate_conversation_title();

-- RLS policies: allow owners to update and delete their sessions
DROP POLICY IF EXISTS "Users can update own chat sessions" ON public.course_chat_sessions;
CREATE POLICY "Users can update own chat sessions"
  ON public.course_chat_sessions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own chat sessions" ON public.course_chat_sessions;
CREATE POLICY "Users can delete own chat sessions"
  ON public.course_chat_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Optional: allow message deletes by session owners (not strictly needed if session delete cascades)
DROP POLICY IF EXISTS "Users can delete own messages" ON public.course_chat_messages;
CREATE POLICY "Users can delete own messages"
  ON public.course_chat_messages FOR DELETE
  USING (
    session_id IN (
      SELECT id FROM public.course_chat_sessions WHERE user_id = auth.uid()
    )
  );