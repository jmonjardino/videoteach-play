import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

type Course = Tables<"courses">;

export default function BrowseCourses() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    // Initial load
    (async () => {
      try {
        const { data, error } = await supabase
          .from("courses")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        setCourses(data || []);
      } catch (e: any) {
        toast({ title: "Could not load courses", description: e.message, variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // Debounced server-side search by title
  useEffect(() => {
    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        const term = query.trim();
        const base = supabase
          .from("courses")
          .select("*")
          .order("title", { ascending: true });
        const { data, error } = term
          ? await base.ilike("title", `%${term}%`)
          : await base;
        if (error) throw error;
        setCourses(data || []);
      } catch (e: any) {
        toast({ title: "Search failed", description: e.message, variant: "destructive" });
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  const headerSubtitle = useMemo(() => {
    if (isLoading || searching) return "Loading courses...";
    if (!query) return `${courses.length} courses available`;
    return `${courses.length} results for "${query}"`;
  }, [courses.length, query, isLoading, searching]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Browse Courses</h1>
            <p className="text-muted-foreground">{headerSubtitle}</p>
          </div>
          <Button variant="outline" onClick={() => navigate("/dashboard")}>Go to Dashboard</Button>
        </div>

        <div className="mb-6">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by course title..."
          />
        </div>

        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        ) : courses.length === 0 ? (
          <div className="text-center text-muted-foreground py-20">No courses found.</div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => (
              <Card key={c.id} className="overflow-hidden">
                <CardHeader>
                  <CardTitle className="line-clamp-1">{c.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  {c.thumbnail_url ? (
                    <img
                      src={c.thumbnail_url}
                      alt={c.title}
                      className="w-full h-40 object-cover rounded-md mb-3"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-40 bg-muted rounded-md mb-3" />
                  )}
                  {c.description && (
                    <p className="text-sm text-muted-foreground line-clamp-3 mb-4">{c.description}</p>
                  )}
                  <div className="flex justify-end">
                    <Button onClick={() => navigate(`/course/${c.id}`)}>
                      View Course
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}