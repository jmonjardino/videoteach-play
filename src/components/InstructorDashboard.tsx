import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, LogOut, BookOpen, Users, DollarSign } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import CreateCourseDialog from "./CreateCourseDialog";

interface Course {
  id: string;
  title: string;
  description: string;
  thumbnail_url: string | null;
  created_at: string;
  price?: number;
  enrollment_count?: number;
  revenue?: number;
}

export default function InstructorDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    fetchCourses();
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();
      
      if (data) setUserName(data.full_name || user.email || "Instructor");
    }
  };

  const fetchCourses = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("courses")
      .select("*")
      .eq("instructor_id", user.id)
      .order("created_at", { ascending: false });

    if (data) {
      const augmented = await Promise.all(
        data.map(async (course: any) => {
          const { count } = await supabase
            .from("enrollments")
            .select("*", { count: "exact", head: true })
            .eq("course_id", course.id);

          const price = typeof course.price === "number" ? course.price : 0;
          const enrollments = count ?? 0;
          const revenue = Number((price * enrollments).toFixed(2));

          return {
            ...course,
            enrollment_count: enrollments,
            revenue,
          } as Course;
        })
      );
      setCourses(augmented);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({ title: "Signed out successfully" });
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <BookOpen className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-bold">Viora Instructor</h1>
              <p className="text-sm text-muted-foreground">Welcome back, {userName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate("/profile")}>Edit Profile</Button>
            <Button variant="ghost" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold mb-2">My Courses</h2>
            <p className="text-muted-foreground">Create and manage your courses</p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)} size="lg">
            <Plus className="h-4 w-4 mr-2" />
            Create Course
          </Button>
        </div>

        {courses.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <BookOpen className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No courses yet</h3>
              <p className="text-muted-foreground mb-4">Start creating your first course</p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Course
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <Card 
                key={course.id} 
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate(`/course/${course.id}/manage`)}
              >
                {course.thumbnail_url && (
                  <div className="aspect-video w-full overflow-hidden rounded-t-lg">
                    <img
                      src={course.thumbnail_url}
                      alt={course.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <CardHeader>
                  <CardTitle>{course.title}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {course.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-1 text-sm">
                    <div className="text-muted-foreground flex items-center">
                      <Users className="h-4 w-4 mr-1" />
                      <span>Enrollments: {course.enrollment_count ?? 0}</span>
                    </div>
                    <div className="text-muted-foreground flex items-center">
                      <DollarSign className="h-4 w-4 mr-1" />
                      <span>
                        Price: €{(typeof course.price === "number" ? course.price : 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="font-medium">
                      Revenue: €{(typeof course.revenue === "number" ? course.revenue : 0).toFixed(2)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <CreateCourseDialog 
        open={showCreateDialog} 
        onOpenChange={setShowCreateDialog}
        onCourseCreated={fetchCourses}
      />
    </div>
  );
}
