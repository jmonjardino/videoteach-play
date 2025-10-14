import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Upload } from "lucide-react";

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
  const [videoFile, setVideoFile] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoFile) {
      toast({
        title: "No video selected",
        description: "Please select a video file to upload",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Upload video to storage
      const fileExt = videoFile.name.split(".").pop();
      const fileName = `${user.id}/${courseId}/${Date.now()}.${fileExt}`;

      const { error: uploadError, data } = await supabase.storage
        .from("course-videos")
        .upload(fileName, videoFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("course-videos")
        .getPublicUrl(fileName);

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
        video_url: publicUrl,
        order_index: nextOrderIndex,
      });

      if (insertError) throw insertError;

      toast({
        title: "Video added!",
        description: "Your video has been uploaded successfully",
      });

      setTitle("");
      setDescription("");
      setVideoFile(null);
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
          <DialogTitle>Add Video</DialogTitle>
          <DialogDescription>Upload a new video to your course</DialogDescription>
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
            <Label htmlFor="video-file">Video File</Label>
            <div className="flex items-center gap-2">
              <Input
                id="video-file"
                type="file"
                accept="video/*"
                onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                required
              />
              <Upload className="h-5 w-5 text-muted-foreground" />
            </div>
            {videoFile && (
              <p className="text-sm text-muted-foreground">
                Selected: {videoFile.name} ({(videoFile.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Uploading..." : "Upload Video"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
