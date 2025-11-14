import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { GraduationCap, BookOpen, Users, Video, Bot, Sparkles, Quote, Star } from "lucide-react";
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
              <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm text-primary bg-primary/5 w-fit">
                <Sparkles className="h-4 w-4" /> AI-powered learning assistant
              </div>
              <h1 className="text-5xl md:text-6xl font-bold leading-tight">
                Learn Anything with <span className="text-primary">AI</span>
              </h1>
              <p className="text-xl text-muted-foreground">
                Unlike Udemy, your learning here is guided by an adaptive AI tutor that answers questions, recommends content, and personalizes your path.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button size="lg" onClick={() => navigate("/auth")}>
                  Get Started Free
                </Button>
                <Button size="lg" variant="outline" onClick={() => navigate("/auth")}>
                  Become an Instructor
                </Button>
                <Button size="lg" variant="secondary" onClick={() => navigate("/courses")}> 
                  Try the AI Demo
                </Button>
              </div>
            </div>
            <div className="relative">
              <img
                src={heroImage}
                alt="Online learning"
                className="rounded-2xl shadow-2xl"
              />
              <div className="absolute -bottom-4 left-6 right-auto bg-background/90 backdrop-blur-md border rounded-xl px-4 py-3 shadow-sm flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                <span className="text-sm text-muted-foreground">Ask AI anything while you learn</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Proof of Concept Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-10">
          <h2 className="text-4xl font-bold mb-3">Proof of Concept with Real Users</h2>
          <p className="text-lg text-muted-foreground">Our AI assistant already helps learners stay engaged and finish more courses.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="pt-6">
              <div className="p-3 bg-primary/10 rounded-full w-fit mb-4">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Early Users</h3>
              <p className="text-muted-foreground">100+ learners in pilot cohorts actively using AI Q&A.</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="p-3 bg-accent/10 rounded-full w-fit mb-4">
                <Bot className="h-6 w-6 text-accent" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Higher Completion</h3>
              <p className="text-muted-foreground">Learners using AI complete lessons 25% more often in trials.</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="p-3 bg-primary/10 rounded-full w-fit mb-4">
                <GraduationCap className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Satisfaction</h3>
              <p className="text-muted-foreground">92% of pilot users would recommend AI-assisted learning.</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">Why Choose Viora?</h2>
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

      {/* Testimonials Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-10">
          <h2 className="text-4xl font-bold mb-3">What Learners Say</h2>
          <p className="text-lg text-muted-foreground">How AI made the difference compared to other platforms</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {/* Testimonial 1 */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src="/placeholder.svg" alt="Ana Silva" />
                  <AvatarFallback>AS</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">Ana Silva</p>
                  <p className="text-sm text-muted-foreground">Computer Science Student</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Quote className="h-5 w-5 text-primary mt-1" />
                <p className="text-muted-foreground">
                  The AI tutor answers my questions instantly and keeps me moving forward. On other platforms I drop out when I get stuck.
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Star className="h-4 w-4 text-yellow-500" />
                <span className="text-muted-foreground">Unlike Udemy: real-time AI Q&A inside lessons</span>
              </div>
            </CardContent>
          </Card>

          {/* Testimonial 2 */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src="/placeholder.svg" alt="Marco Duarte" />
                  <AvatarFallback>MD</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">Marco Duarte</p>
                  <p className="text-sm text-muted-foreground">Frontend Developer</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Quote className="h-5 w-5 text-primary mt-1" />
                <p className="text-muted-foreground">
                  It personalizes my path and recommends exactly what to watch next. Other platforms feel like a static catalog.
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Star className="h-4 w-4 text-yellow-500" />
                <span className="text-muted-foreground">Unlike Udemy: adaptive recommendations tailored to my goals</span>
              </div>
            </CardContent>
          </Card>

          {/* Testimonial 3 */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src="/placeholder.svg" alt="Rita Gomes" />
                  <AvatarFallback>RG</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">Rita Gomes</p>
                  <p className="text-sm text-muted-foreground">Data Analyst</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Quote className="h-5 w-5 text-primary mt-1" />
                <p className="text-muted-foreground">
                  The weekly AI digest and gentle nudges keep me accountable. I actually finish courses now.
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Star className="h-4 w-4 text-yellow-500" />
                <span className="text-muted-foreground">Unlike Udemy: progress nudges based on your learning behavior</span>
              </div>
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
