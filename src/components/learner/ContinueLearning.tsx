import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getContinueLearning, ContinueLearningItem } from "@/services/learnerAnalyticsService";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

function ProgressBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, Math.round(value)));
  return (
    <div className="w-full h-2 bg-muted rounded">
      <div className="h-2 bg-primary rounded" style={{ width: `${pct}%` }} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} />
    </div>
  );
}

export default function ContinueLearning() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ContinueLearningItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      try {
        const res = await getContinueLearning(user.id);
        setItems(res);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}><CardContent className="p-6"><div className="h-24 bg-muted animate-pulse rounded" /></CardContent></Card>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-muted-foreground">No active learning items. Start a course to continue.</CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {items.map(({ course, latestStatus, timeSpentSeconds }) => (
        <Card key={course.id} className="hover:shadow-sm">
          <CardHeader>
            <CardTitle className="line-clamp-1">{course.title}</CardTitle>
            <p className="text-sm text-muted-foreground">Status: {latestStatus.replace('_', ' ')}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <ProgressBar value={Math.min(100, (timeSpentSeconds / 3600) * 10)} />
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => navigate(`/course/${course.id}`)}>Continue</Button>
              <Button variant="outline" onClick={() => navigate(`/course/${course.id}`)}>View</Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}