import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface AddVideoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  onVideoAdded: () => void;
}

export default function AddVideoDialog({ open, onOpenChange, courseId, onVideoAdded }: AddVideoDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");

  const toEmbedUrl = (url: string): string | null => {
    try {
      const u = new URL(url);
      // Support youtu.be/<id>
      if (u.hostname === "youtu.be") {
        const id = u.pathname.replace("/", "");
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
      // Support youtube.com/watch?v=<id>
      if (u.hostname.includes("youtube.com")) {
        const v = u.searchParams.get("v");
        if (v) return `https://www.youtube.com/embed/${v}`;
        // Also support /embed/<id>
        const parts = u.pathname.split("/").filter(Boolean);
        const idx = parts.findIndex((p) => p === "embed");
        if (idx >= 0 && parts[idx + 1]) return `https://www.youtube.com/embed/${parts[idx + 1]}`;
      }
      return null;
    } catch {
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const embedUrl = toEmbedUrl(youtubeUrl.trim());
    if (!embedUrl) {
      toast({
        title: "Invalid YouTube URL",
        description: "Provide a valid YouTube or youtu.be link (unlisted recommended).",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get current max order_index
      const { data: videos } = await supabase
        .from("videos")
        .select("order_index")
        .eq("course_id", courseId)
        .order("order_index", { ascending: false })
        .limit(1);

      const nextOrderIndex = videos && videos.length > 0 ? videos[0].order_index + 1 : 0;

      // Insert video record
      const { error: insertError } = await supabase.from("videos").insert({
        course_id: courseId,
        title,
        description: description || null,
        video_url: embedUrl,
        order_index: nextOrderIndex,
      });

      if (insertError) throw insertError;

      toast({
        title: "Video added!",
        description: "Your YouTube video is now linked and playable in-app",
      });

      setTitle("");
      setDescription("");
      setYoutubeUrl("");
      onOpenChange(false);
      onVideoAdded();
    } catch (error: any) {
      toast({
        title: "Failed to add video",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add YouTube Video</DialogTitle>
          <DialogDescription>Paste an unlisted YouTube link to stream in your course</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="video-title">Video Title</Label>
            <Input
              id="video-title"
              placeholder="Introduction to the Course"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="video-description">Description (Optional)</Label>
            <Textarea
              id="video-description"
              placeholder="Brief description of what this video covers..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="youtube-url">YouTube URL</Label>
            <Input
              id="youtube-url"
              type="url"
              placeholder="https://www.youtube.com/watch?v=VIDEO_ID or https://youtu.be/VIDEO_ID"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">Use an unlisted video for privacy. It will play inside this app.</p>
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Linking..." : "Add YouTube Video"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
