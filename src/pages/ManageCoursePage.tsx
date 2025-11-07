import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus, Trash2, Upload, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AddVideoDialog from "@/components/AddVideoDialog";
import CourseKnowledgeBase from "@/components/CourseKnowledgeBase";
import EditCourseDialog from "@/components/EditCourseDialog";

interface Video {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  order_index: number;
}

export default function ManageCoursePage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [videos, setVideos] = useState<Video[]>([]);
  const [courseTitle, setCourseTitle] = useState("");
  const [courseDescription, setCourseDescription] = useState("");
  const [showAddVideo, setShowAddVideo] = useState(false);
  const [showEditCourse, setShowEditCourse] = useState(false);

  useEffect(() => {
    if (courseId) {
      fetchCourseData();
    }
  }, [courseId]);

  const fetchCourseData = async () => {
    const { data: courseData } = await supabase
      .from("courses")
      .select("title, description")
      .eq("id", courseId)
      .single();

    if (courseData) {
      setCourseTitle(courseData.title);
      setCourseDescription(courseData.description || "");
    }

    const { data: videosData } = await supabase
      .from("videos")
      .select("*")
      .eq("course_id", courseId)
      .order("order_index", { ascending: true });

    if (videosData) setVideos(videosData);
  };

  const handleDeleteVideo = async (videoId: string) => {
    const { error } = await supabase.from("videos").delete().eq("id", videoId);

    if (error) {
      toast({
        title: "Failed to delete video",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Video deleted successfully" });
      fetchCourseData();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-start mb-8">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-4xl font-bold">{courseTitle}</h1>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowEditCourse(true)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
            {courseDescription && (
              <p className="text-muted-foreground mb-2">{courseDescription}</p>
            )}
            <p className="text-sm text-muted-foreground">Manage course content</p>
          </div>
          <Button onClick={() => setShowAddVideo(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Video
          </Button>
        </div>

        <CourseKnowledgeBase courseId={courseId!} />

        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-4">Course Videos</h2>
          {videos.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Upload className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">No videos yet</h3>
                <p className="text-muted-foreground mb-4">Start adding videos to your course</p>
                <Button onClick={() => setShowAddVideo(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Video
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {videos.map((video, index) => (
                <Card key={video.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <span className="text-muted-foreground text-sm">#{index + 1}</span>
                          {video.title}
                        </CardTitle>
                        {video.description && (
                          <p className="text-muted-foreground mt-1">{video.description}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteVideo(video.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                      <video src={video.video_url} controls className="w-full h-full">
                        Your browser does not support the video tag.
                      </video>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      <AddVideoDialog
        open={showAddVideo}
        onOpenChange={setShowAddVideo}
        courseId={courseId!}
        onVideoAdded={fetchCourseData}
      />

      <EditCourseDialog
        open={showEditCourse}
        onOpenChange={setShowEditCourse}
        courseId={courseId!}
        currentTitle={courseTitle}
        currentDescription={courseDescription}
        onCourseUpdated={fetchCourseData}
      />
    </div>
  );
}
