import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, BookOpen, GraduationCap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface Course {
  id: string;
  title: string;
  description: string;
  thumbnail_url: string | null;
  instructor_id: string;
  instructor_name?: string | null;
}

export default function StudentDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [enrolledCourses, setEnrolledCourses] = useState<Course[]>([]);
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
      
      if (data) setUserName(data.full_name || user.email || "Student");
    }
  };

  const fetchCourses = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch all courses with instructor info
    const { data: coursesData } = await supabase
      .from("courses")
      .select("*")
      .order("created_at", { ascending: false });

    if (coursesData) {
      // Fetch instructor names separately
      const coursesWithInstructors = await Promise.all(
        coursesData.map(async (course) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", course.instructor_id)
            .single();
          
          return {
            ...course,
            instructor_name: profile?.full_name,
          };
        })
      );
      setAllCourses(coursesWithInstructors);
    }

    // Fetch enrolled courses
    const { data: enrollmentsData } = await supabase
      .from("enrollments")
      .select("course_id, courses(*)")
      .eq("student_id", user.id);

    if (enrollmentsData) {
      const enrolled = await Promise.all(
        enrollmentsData.map(async (enrollment: any) => {
          const course = enrollment.courses;
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", course.instructor_id)
            .single();
          
          return {
            ...course,
            instructor_name: profile?.full_name,
          };
        })
      );
      setEnrolledCourses(enrolled);
    }
  };

  const handleEnroll = async (courseId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("enrollments")
      .insert({ student_id: user.id, course_id: courseId });

    if (error) {
      if (error.code === "23505") {
        toast({
          title: "Already enrolled",
          description: "You're already enrolled in this course",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Enrollment failed",
          description: error.message,
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Enrolled successfully!",
        description: "You can now access the course",
      });
      fetchCourses();
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({ title: "Signed out successfully" });
    navigate("/");
  };

  const isEnrolled = (courseId: string) => {
    return enrolledCourses.some((c) => c.id === courseId);
  };

  const CourseCard = ({ course, showEnroll }: { course: Course; showEnroll: boolean }) => (
    <Card className="hover:shadow-lg transition-shadow">
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
        <p className="text-sm text-muted-foreground">
          by {course.instructor_name || "Unknown Instructor"}
        </p>
      </CardHeader>
      <CardContent>
        {showEnroll ? (
          isEnrolled(course.id) ? (
            <Button 
              className="w-full" 
              onClick={() => navigate(`/course/${course.id}`)}
            >
              View Course
            </Button>
          ) : (
            <Button 
              className="w-full" 
              onClick={() => handleEnroll(course.id)}
            >
              Enroll Now
            </Button>
          )
        ) : (
          <Button 
            className="w-full" 
            onClick={() => navigate(`/course/${course.id}`)}
          >
            Continue Learning
          </Button>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <GraduationCap className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-bold">LearnHub</h1>
              <p className="text-sm text-muted-foreground">Welcome back, {userName}</p>
            </div>
          </div>
          <Button variant="ghost" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="browse" className="w-full">
          <TabsList className="mb-8">
            <TabsTrigger value="browse">Browse Courses</TabsTrigger>
            <TabsTrigger value="enrolled">My Courses</TabsTrigger>
          </TabsList>

          <TabsContent value="browse">
            <div className="mb-6">
              <h2 className="text-3xl font-bold mb-2">All Courses</h2>
              <p className="text-muted-foreground">Discover and enroll in courses</p>
            </div>
            {allCourses.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <BookOpen className="h-16 w-16 text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No courses available</h3>
                  <p className="text-muted-foreground">Check back later for new courses</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {allCourses.map((course) => (
                  <CourseCard key={course.id} course={course} showEnroll={true} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="enrolled">
            <div className="mb-6">
              <h2 className="text-3xl font-bold mb-2">My Courses</h2>
              <p className="text-muted-foreground">Continue your learning journey</p>
            </div>
            {enrolledCourses.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <GraduationCap className="h-16 w-16 text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No enrolled courses</h3>
                  <p className="text-muted-foreground mb-4">Start learning by enrolling in a course</p>
                  <Button onClick={() => document.querySelector<HTMLButtonElement>('[value="browse"]')?.click()}>
                    Browse Courses
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {enrolledCourses.map((course) => (
                  <CourseCard key={course.id} course={course} showEnroll={false} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
