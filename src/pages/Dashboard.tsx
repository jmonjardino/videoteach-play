import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import InstructorDashboard from "@/components/InstructorDashboard";
import StudentDashboard from "@/components/StudentDashboard";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState<"instructor" | "student" | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .single();

    if (roleData) {
      setUserRole(roleData.role);
    } else {
      // No role row yet (likely due to email confirmation being enabled at sign-up).
      // Read the intended role from user metadata and insert now.
      const metaRole = (session.user.user_metadata?.role as "instructor" | "student") ?? "student";
      const { error: insertError } = await supabase
        .from("user_roles")
        .insert({ user_id: session.user.id, role: metaRole });

      if (!insertError) {
        setUserRole(metaRole);
      } else {
        // Fallback: still allow navigation, default to student
        setUserRole("student");
      }
    }
    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <Skeleton className="h-12 w-64 mb-8" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return userRole === "instructor" ? <InstructorDashboard /> : <StudentDashboard />;
}
