import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Play } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Video {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  order_index: number;
}

interface Course {
  id: string;
  title: string;
  description: string;
  instructor_id: string;
}

export default function CoursePage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [currentVideo, setCurrentVideo] = useState<Video | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (courseId) {
      fetchCourseData();
    }
  }, [courseId]);

  const fetchCourseData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    // Check enrollment
    const { data: enrollment } = await supabase
      .from("enrollments")
      .select("*")
      .eq("student_id", user.id)
      .eq("course_id", courseId)
      .single();

    if (!enrollment) {
      navigate("/dashboard");
      return;
    }

    // Fetch course
    const { data: courseData } = await supabase
      .from("courses")
      .select("*")
      .eq("id", courseId)
      .single();

    if (courseData) setCourse(courseData);

    // Fetch videos
    const { data: videosData } = await supabase
      .from("videos")
      .select("*")
      .eq("course_id", courseId)
      .order("order_index", { ascending: true });

    if (videosData) {
      setVideos(videosData);
      if (videosData.length > 0) {
        setCurrentVideo(videosData[0]);
      }
    }

    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <Skeleton className="h-12 w-64 mb-8" />
        <Skeleton className="h-96 mb-4" />
        <Skeleton className="h-24" />
      </div>
    );
  }

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
        <h1 className="text-4xl font-bold mb-2">{course?.title}</h1>
        <p className="text-muted-foreground mb-8">{course?.description}</p>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {currentVideo ? (
              <Card>
                <CardHeader>
                  <CardTitle>{currentVideo.title}</CardTitle>
                  {currentVideo.description && (
                    <p className="text-muted-foreground">{currentVideo.description}</p>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                    <video
                      src={currentVideo.video_url}
                      controls
                      className="w-full h-full rounded-lg"
                    >
                      Your browser does not support the video tag.
                    </video>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Play className="h-16 w-16 text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No videos yet</h3>
                  <p className="text-muted-foreground">
                    The instructor hasn't added any videos to this course
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle>Course Content</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {videos.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No videos available</p>
                ) : (
                  videos.map((video) => (
                    <button
                      key={video.id}
                      onClick={() => setCurrentVideo(video)}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        currentVideo?.id === video.id
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <Play className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{video.title}</p>
                          {video.description && (
                            <p className="text-sm opacity-90 line-clamp-1">
                              {video.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
