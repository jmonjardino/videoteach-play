import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface EditCourseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  currentTitle: string;
  currentDescription: string;
  currentPrice?: number;
  onCourseUpdated: () => void;
}

export default function EditCourseDialog({
  open,
  onOpenChange,
  courseId,
  currentTitle,
  currentDescription,
  currentPrice,
  onCourseUpdated,
}: EditCourseDialogProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState(currentTitle);
  const [description, setDescription] = useState(currentDescription);
  const [price, setPrice] = useState<string>(
    typeof currentPrice === "number" ? currentPrice.toFixed(2) : "0"
  );
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      toast({
        title: "Validation error",
        description: "Course title is required",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const priceValue = parseFloat(price);
      const safePrice = isNaN(priceValue) || priceValue < 0 ? 0 : Number(priceValue.toFixed(2));

      const { error } = await supabase
        .from("courses")
        .update({
          title: title.trim(),
          description: description.trim() || null,
          price: safePrice,
        })
        .eq("id", courseId);

      if (error) throw error;

      toast({
        title: "Course updated",
        description: "Course information has been updated successfully",
      });

      onCourseUpdated();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Update error:", error);
      toast({
        title: "Update failed",
        description: error.message || "Failed to update course",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Course</DialogTitle>
          <DialogDescription>
            Update your course title, description, and price
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Course Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Introduction to Web Development"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Course Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what students will learn in this course..."
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="price">Course Price</Label>
            <Input
              id="price"
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Shown to users, but enrollment remains free.</p>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
