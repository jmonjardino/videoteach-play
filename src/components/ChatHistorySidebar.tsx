import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Trash2, Pencil, MessageSquare } from "lucide-react";

export interface ChatSession {
  id: string;
  course_id: string;
  title: string | null;
  message_count: number;
  last_message_at: string | null;
  created_at: string;
}

interface ChatHistorySidebarProps {
  courseId: string;
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
}

export default function ChatHistorySidebar({ courseId, activeSessionId, onSelectSession }: ChatHistorySidebarProps) {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  const loadSessions = async (reset = false) => {
    try {
      setIsLoading(true);
      const from = reset ? 0 : page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let query = supabase
        .from("course_chat_sessions")
        .select("id, course_id, title, message_count, last_message_at, created_at", { count: "exact" })
        .eq("course_id", courseId)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (searchQuery.trim()) {
        query = query.ilike("title", `%${searchQuery.trim()}%`);
      }

      const { data, error, count } = await query.range(from, to);
      if (error) throw error;
      const newSessions = (data ?? []) as ChatSession[];
      setSessions((prev) => (reset ? newSessions : [...prev, ...newSessions]));
      const total = count ?? newSessions.length;
      setHasMore(to + 1 < total);
      if (reset) setPage(0);
    } catch (err: any) {
      console.error("Failed to load sessions", err);
      toast({ title: "Failed to load chat history", description: err.message ?? String(err), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSessions(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  useEffect(() => {
    const handle = setTimeout(() => {
      loadSessions(true);
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const grouped = useMemo(() => {
    const groups: Record<string, ChatSession[]> = { Today: [], Yesterday: [], "Last 7 Days": [], Older: [] };
    const now = new Date();
    const todayStr = now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);

    for (const s of sessions) {
      const d = new Date(s.last_message_at ?? s.created_at);
      const label = d.toDateString() === todayStr
        ? "Today"
        : d.toDateString() === yesterday.toDateString()
        ? "Yesterday"
        : d >= weekAgo
        ? "Last 7 Days"
        : "Older";
      groups[label].push(s);
    }
    return groups;
  }, [sessions]);

  const formatTimeAgo = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const onLoadMore = async () => {
    setPage((p) => p + 1);
    await loadSessions(false);
  };

  const createNewConversation = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user?.id) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("course_chat_sessions")
        .insert({ course_id: courseId, user_id: userData.user.id })
        .select("id")
        .single();
      if (error) throw error;
      const newId = data?.id as string;
      toast({ title: "New conversation", description: "Start typing to begin." });
      onSelectSession(newId);
      await loadSessions(true);
    } catch (err: any) {
      toast({ title: "Failed to create conversation", description: err.message ?? String(err), variant: "destructive" });
    }
  };

  const renameSession = async (session: ChatSession) => {
    const next = prompt("Rename conversation", session.title ?? "");
    if (next === null) return;
    const trimmed = next.trim();
    try {
      const { error } = await supabase
        .from("course_chat_sessions")
        .update({ title: trimmed || null })
        .eq("id", session.id);
      if (error) throw error;
      toast({ title: "Renamed", description: "Conversation title updated." });
      setSessions((prev) => prev.map((s) => (s.id === session.id ? { ...s, title: trimmed || null } : s)));
    } catch (err: any) {
      toast({ title: "Rename failed", description: err.message ?? String(err), variant: "destructive" });
    }
  };

  const deleteSession = async (session: ChatSession) => {
    const ok = confirm("Delete this conversation? This cannot be undone.");
    if (!ok) return;
    try {
      const { error } = await supabase
        .from("course_chat_sessions")
        .delete()
        .eq("id", session.id);
      if (error) throw error;
      toast({ title: "Deleted", description: "Conversation removed." });
      setSessions((prev) => prev.filter((s) => s.id !== session.id));
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message ?? String(err), variant: "destructive" });
    }
  };

  return (
    <div className="h-full border-r w-[280px] flex flex-col">
      <div className="p-2 flex items-center gap-2">
        <Button size="sm" variant="secondary" onClick={createNewConversation} className="shrink-0">
          <Plus className="h-4 w-4 mr-1" /> New
        </Button>
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-2 top-2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations"
            className="pl-7 h-8"
          />
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="px-2 pb-2 space-y-4">
          {(["Today", "Yesterday", "Last 7 Days", "Older"] as const).map((label) => (
            <div key={label}>
              <div className="text-xs font-semibold text-muted-foreground px-2 mb-1">{label}</div>
              <div className="space-y-1">
                {grouped[label].length === 0 ? (
                  <div className="text-xs text-muted-foreground px-2">No conversations</div>
                ) : (
                  grouped[label].map((s) => (
                    <Card
                      key={s.id}
                      className={`p-2 cursor-pointer transition-colors ${s.id === activeSessionId ? "bg-primary/10" : "hover:bg-muted"}`}
                      onClick={() => onSelectSession(s.id)}
                      title={`${s.message_count} messages • ${formatTimeAgo(s.last_message_at ?? s.created_at)}`}
                    >
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{s.title ?? "Untitled conversation"}</div>
                          <div className="text-xs text-muted-foreground">{s.message_count} messages • {formatTimeAgo(s.last_message_at ?? s.created_at)}</div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); renameSession(s); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); deleteSession(s); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </div>
          ))}
          {hasMore && (
            <div className="px-2">
              <Button variant="outline" size="sm" onClick={onLoadMore} disabled={isLoading} className="w-full">
                {isLoading ? "Loading…" : "Load more"}
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}