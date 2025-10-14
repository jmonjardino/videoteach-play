import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { GraduationCap, BookOpen, Users, Video } from "lucide-react";
import heroImage from "@/assets/hero-education.jpg";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20 opacity-50" />
        <div className="container mx-auto px-4 py-20 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h1 className="text-5xl md:text-6xl font-bold leading-tight">
                Learn Anything,
                <span className="text-primary"> Anytime</span>
              </h1>
              <p className="text-xl text-muted-foreground">
                Join thousands of learners and instructors on LearnHub. 
                Access free courses, share knowledge, and grow together.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button size="lg" onClick={() => navigate("/auth")}>
                  Get Started Free
                </Button>
                <Button size="lg" variant="outline" onClick={() => navigate("/auth")}>
                  Become an Instructor
                </Button>
              </div>
            </div>
            <div className="relative">
              <img
                src={heroImage}
                alt="Online learning"
                className="rounded-2xl shadow-2xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">Why Choose LearnHub?</h2>
          <p className="text-xl text-muted-foreground">
            Everything you need to learn and teach online
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <Card>
            <CardContent className="pt-6">
              <div className="p-3 bg-primary/10 rounded-full w-fit mb-4">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Free Courses</h3>
              <p className="text-muted-foreground">
                Access a wide range of courses completely free. Learn at your own pace.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="p-3 bg-accent/10 rounded-full w-fit mb-4">
                <Video className="h-6 w-6 text-accent" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Video Learning</h3>
              <p className="text-muted-foreground">
                Watch high-quality video lessons from expert instructors worldwide.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="p-3 bg-primary/10 rounded-full w-fit mb-4">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Share Knowledge</h3>
              <p className="text-muted-foreground">
                Become an instructor and share your expertise with eager learners.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-primary to-accent text-primary-foreground">
        <div className="container mx-auto px-4 py-16 text-center">
          <GraduationCap className="h-16 w-16 mx-auto mb-6" />
          <h2 className="text-4xl font-bold mb-4">Ready to Start Learning?</h2>
          <p className="text-xl mb-8 opacity-90">
            Join our community today and unlock endless learning opportunities
          </p>
          <Button 
            size="lg" 
            variant="secondary"
            onClick={() => navigate("/auth")}
          >
            Sign Up Now - It's Free
          </Button>
        </div>
      </section>
    </div>
  );
};

export default Index;
