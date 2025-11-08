import { supabase } from "@/integrations/supabase/client";

export interface Message {
  id?: string;
  role: "user" | "assistant";
  content: string;
  timestamp?: Date;
}

export interface ChatResponse {
  sessionId: string;
  response: string;
  error?: string;
}

const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export async function sendChatMessage(
  courseId: string,
  message: string,
  sessionId?: string,
  conversationHistory?: Message[]
): Promise<ChatResponse> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) throw new Error("Not authenticated");

  // Basic validation
  const trimmed = message.trim();
  if (!trimmed) throw new Error("Message cannot be empty");
  if (trimmed.length > 2000) throw new Error("Message exceeds 2000 characters");

  const payload = {
    courseId,
    message: trimmed,
    sessionId,
    conversationHistory: conversationHistory?.map((m) => ({ role: m.role, content: m.content })) ?? [],
  };

  const resp = await fetch(`${FUNCTIONS_BASE}/course-chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  const json = (await resp.json()) as ChatResponse;
  if (!resp.ok || json.error) {
    throw new Error(json.error || `Chat request failed (${resp.status})`);
  }
  return json;
}

export async function createChatSession(courseId: string): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("course_chat_sessions")
    .insert({ course_id: courseId, user_id: user.id })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function getChatHistory(sessionId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from("course_chat_messages")
    .select("id, role, content, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((m) => ({ id: m.id, role: m.role as Message["role"], content: m.content, timestamp: new Date(m.created_at) }));
}

export interface ChatSession {
  id: string;
  course_id: string;
  title: string | null;
  message_count: number;
  last_message_at: string | null;
  created_at: string;
}

export async function listChatSessions(courseId: string, limit = 20, offset = 0): Promise<{ sessions: ChatSession[]; hasMore: boolean }> {
  const { data, error, count } = await supabase
    .from("course_chat_sessions")
    .select("id, course_id, title, message_count, last_message_at, created_at", { count: "exact" })
    .eq("course_id", courseId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  const total = count ?? (data?.length ?? 0);
  return { sessions: (data ?? []) as ChatSession[], hasMore: offset + limit < total };
}

export async function renameChatSession(sessionId: string, title: string) {
  const { error } = await supabase
    .from("course_chat_sessions")
    .update({ title: title.trim() || null })
    .eq("id", sessionId);
  if (error) throw error;
}

export async function deleteChatSession(sessionId: string) {
  const { error } = await supabase
    .from("course_chat_sessions")
    .delete()
    .eq("id", sessionId);
  if (error) throw error;
}

export async function searchConversations(courseId: string, query: string): Promise<ChatSession[]> {
  const q = query.trim();
  if (!q) return [];
  const { data, error } = await supabase
    .from("course_chat_sessions")
    .select("id, course_id, title, message_count, last_message_at, created_at")
    .eq("course_id", courseId)
    .ilike("title", `%${q}%`)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ChatSession[];
}