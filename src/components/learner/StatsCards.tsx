import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getLearnerStats, LearnerStats } from "@/services/learnerAnalyticsService";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m}m`;
}

export default function StatsCards() {
  const [stats, setStats] = useState<LearnerStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      try {
        const s = await getLearnerStats(user.id);
        setStats(s);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader>
          <CardTitle>Completion Rate</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? <div className="h-6 w-24 bg-muted animate-pulse rounded" /> :
            <p className="text-2xl font-bold">{Math.round((stats?.completionRate ?? 0) * 100)}%</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Time Spent</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? <div className="h-6 w-24 bg-muted animate-pulse rounded" /> :
            <p className="text-2xl font-bold">{formatDuration(stats?.totalTimeSeconds ?? 0)}</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Current Streak</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? <div className="h-6 w-24 bg-muted animate-pulse rounded" /> :
            <p className="text-2xl font-bold">{stats?.currentStreak ?? 0} days</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Longest Streak</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? <div className="h-6 w-24 bg-muted animate-pulse rounded" /> :
            <p className="text-2xl font-bold">{stats?.longestStreak ?? 0} days</p>}
        </CardContent>
      </Card>
    </div>
  );
}