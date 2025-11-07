import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { FileText, Upload, Trash2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface KnowledgeBase {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  uploaded_at: string;
}

interface CourseKnowledgeBaseProps {
  courseId: string;
}

const ALLOWED_TYPES = {
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'text/plain': '.txt',
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export default function CourseKnowledgeBase({ courseId }: CourseKnowledgeBaseProps) {
  const { toast } = useToast();
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBase | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    fetchKnowledgeBase();
  }, [courseId]);

  const fetchKnowledgeBase = async () => {
    const { data } = await supabase
      .from("course_knowledge_base")
      .select("*")
      .eq("course_id", courseId)
      .maybeSingle();

    if (data) setKnowledgeBase(data);
  };

  const validateFile = (file: File): string | null => {
    if (!Object.keys(ALLOWED_TYPES).includes(file.type)) {
      return "Invalid file type. Please upload PDF, DOC, DOCX, or TXT files only.";
    }
    if (file.size > MAX_FILE_SIZE) {
      return "File size exceeds 10MB limit.";
    }
    return null;
  };

  const sanitizeFileName = (fileName: string): string => {
    return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  };

  const handleFileUpload = async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      toast({
        title: "Upload failed",
        description: validationError,
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // Delete existing file if replacing
      if (knowledgeBase) {
        await handleDelete(false);
      }

      const sanitizedFileName = sanitizeFileName(file.name);
      const filePath = `${courseId}/${Date.now()}_${sanitizedFileName}`;

      // Upload to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("course-knowledge-bases")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      setUploadProgress(50);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("course-knowledge-bases")
        .getPublicUrl(filePath);

      // Save metadata to database
      const { error: dbError } = await supabase
        .from("course_knowledge_base")
        .insert({
          course_id: courseId,
          file_name: file.name,
          file_url: urlData.publicUrl,
          file_type: file.type,
          file_size: file.size,
        });

      if (dbError) {
        // Rollback storage upload if database insert fails
        await supabase.storage.from("course-knowledge-bases").remove([filePath]);
        throw dbError;
      }

      setUploadProgress(100);

      toast({
        title: "Upload successful",
        description: "Knowledge base document has been uploaded.",
      });

      await fetchKnowledgeBase();
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload document.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async (showToast = true) => {
    if (!knowledgeBase) return;

    try {
      // Extract file path from URL
      const urlParts = knowledgeBase.file_url.split('/');
      const filePath = `${courseId}/${urlParts[urlParts.length - 1]}`;

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("course-knowledge-bases")
        .remove([filePath]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from("course_knowledge_base")
        .delete()
        .eq("id", knowledgeBase.id);

      if (dbError) throw dbError;

      if (showToast) {
        toast({
          title: "Document deleted",
          description: "Knowledge base document has been removed.",
        });
      }

      setKnowledgeBase(null);
    } catch (error: any) {
      console.error("Delete error:", error);
      toast({
        title: "Delete failed",
        description: error.message || "Failed to delete document.",
        variant: "destructive",
      });
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, [courseId, knowledgeBase]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Course Knowledge Base
        </CardTitle>
        <CardDescription>
          Upload a document that will power the AI assistant for this course. Students can ask questions based on this content.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {knowledgeBase ? (
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                <FileText className="h-8 w-8 text-primary mt-1" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{knowledgeBase.file_name}</p>
                  <div className="flex gap-3 text-sm text-muted-foreground mt-1">
                    <span>{formatFileSize(knowledgeBase.file_size)}</span>
                    <span>•</span>
                    <span>Uploaded {formatDate(knowledgeBase.uploaded_at)}</span>
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete()}
                disabled={uploading}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => document.getElementById("knowledge-base-replace")?.click()}
              disabled={uploading}
            >
              <Upload className="h-4 w-4 mr-2" />
              Replace Document
            </Button>
            <input
              id="knowledge-base-replace"
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.txt"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
            />
          </div>
        ) : (
          <div>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">
                {isDragging ? "Drop file here" : "Upload Knowledge Base"}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Drag and drop your file here, or click to browse
              </p>
              <Button
                onClick={() => document.getElementById("knowledge-base-upload")?.click()}
                disabled={uploading}
              >
                Browse Files
              </Button>
              <input
                id="knowledge-base-upload"
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.txt"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
              />
              <p className="text-xs text-muted-foreground mt-4">
                Accepted formats: PDF, DOC, DOCX, TXT • Max size: 10MB
              </p>
            </div>
          </div>
        )}

        {uploading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Uploading...</span>
              <span>{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
