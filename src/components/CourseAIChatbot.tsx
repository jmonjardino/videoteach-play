import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Bot, Send, Copy, AlertCircle, History, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Message } from "@/services/courseChatService";
import { sendChatMessage, getChatHistory, createChatSession } from "@/services/courseChatService";
import ChatHistorySidebar from "@/components/ChatHistorySidebar";

interface CourseAIChatbotProps {
  courseId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CourseAIChatbot({ courseId, isOpen, onOpenChange }: CourseAIChatbotProps) {
  const { toast } = useToast();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showHistory, setShowHistory] = useState<boolean>(true);
  const [conversationTitle, setConversationTitle] = useState<string>("New conversation");

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  useEffect(() => {
    const computeTitleFromHistory = (history: Message[]): string => {
      const firstUser = history.find((m) => m.role === "user");
      if (!firstUser || !firstUser.content) return "Conversation";
      const trimmed = firstUser.content.trim();
      return trimmed.length > 50 ? trimmed.slice(0, 50) + "..." : trimmed;
    };

    const load = async () => {
      if (!sessionId) return;
      try {
        const history = await getChatHistory(sessionId);
        setMessages(history);
        setConversationTitle(computeTitleFromHistory(history));
      } catch (err: any) {
        console.error("Failed to load chat history", err);
        toast({ title: "Failed to load conversation", description: err.message ?? String(err), variant: "destructive" });
      }
    };
    load();
  }, [sessionId, toast]);

  const handleSend = async () => {
    setError(null);
    const content = input.trim();
    if (!content) return;
    setInput("");
    const userMsg: Message = { role: "user", content, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    try {
      const resp = await sendChatMessage(courseId, content, sessionId ?? undefined, messages);
      setSessionId(resp.sessionId);
      const aiMsg: Message = { role: "assistant", content: resp.response, timestamp: new Date() };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      console.error("Chat error:", err);
      setError(err.message || "Failed to send message");
      toast({ title: "Chat error", description: err.message || "Failed to send message", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const startNewConversation = async () => {
    try {
      const id = await createChatSession(courseId);
      setSessionId(id);
      setMessages([]);
      setConversationTitle("New conversation");
      setShowHistory(true);
      toast({ title: "New conversation started" });
    } catch (err: any) {
      toast({ title: "Failed to create conversation", description: err.message ?? String(err), variant: "destructive" });
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied", description: "Message copied to clipboard" });
    } catch {
      toast({ title: "Copy failed", description: "Unable to copy message", variant: "destructive" });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[960px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" /> AI Assistant
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowHistory((v) => !v)}>
                <History className="h-4 w-4 mr-1" /> {showHistory ? "Hide" : "Show"} History
              </Button>
              <Button size="sm" onClick={startNewConversation}>
                <Plus className="h-4 w-4 mr-1" /> New Conversation
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex h-[520px]">
          {showHistory && (
            <ChatHistorySidebar
              courseId={courseId}
              activeSessionId={sessionId}
              onSelectSession={(id) => {
                setSessionId(id);
              }}
            />
          )}
          <Card className="border-none shadow-none flex-1">
            <CardContent className="p-0 h-full flex flex-col">
              {error && (
                <div className="mb-2 flex items-center gap-2 text-red-600 text-sm">
                  <AlertCircle className="h-4 w-4" /> {error}
                </div>
              )}
              <div className="px-3 py-2 border-b">
                <div className="text-sm font-medium truncate">{conversationTitle}</div>
              </div>
              <ScrollArea className="flex-1 rounded-md border mx-3 my-3">
                <div ref={scrollRef} className="space-y-3 p-3">
                  {messages.length === 0 && (
                    <div className="text-sm text-muted-foreground">
                      Ask questions about this course. The assistant answers based on the uploaded knowledge base.
                    </div>
                  )}
                  {messages.map((m, idx) => (
                    <div key={idx} className="group">
                    <div className={`flex items-start gap-3 ${m.role === "assistant" ? "" : "flex-row-reverse"}`}>
                      <div className={`max-w-[80%] rounded-md px-3 py-2 text-sm ${m.role === "assistant" ? "bg-muted" : "bg-primary text-primary-foreground"}`}>
                        {m.content}
                      </div>
                    </div>
                    <div className={`mt-1 flex ${m.role === "assistant" ? "" : "justify-end"}`}>
                      <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => copyToClipboard(m.content)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                  {isLoading && (
                    <div className="text-sm text-muted-foreground">Assistant is typing…</div>
                  )}
                </div>
              </ScrollArea>
              <div className="mt-auto px-3 pb-3 flex items-center gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type your question…"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <Button onClick={handleSend} disabled={isLoading || !input.trim()}>
                  <Send className="mr-2 h-4 w-4" /> Send
                </Button>
              </div>
              <div className="px-3 py-2 text-xs text-muted-foreground">Enter to send, Shift+Enter for newline. Answers are based on course materials.</div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}