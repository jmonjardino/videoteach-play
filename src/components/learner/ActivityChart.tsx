import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getActivitySeries, Timeframe, ActivityPoint } from "@/services/learnerAnalyticsService";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function Bars({ points }: { points: ActivityPoint[] }) {
  const max = Math.max(1, ...points.map((p) => p.seconds));
  return (
    <div role="img" aria-label="Learning activity chart" className="flex items-end gap-2 h-40">
      {points.map((p) => (
        <div key={p.date} className="flex flex-col items-center">
          <div className="w-6 bg-primary/70" style={{ height: `${(p.seconds / max) * 100}%` }} />
          <span className="text-[10px] text-muted-foreground mt-1">{p.date.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

export default function ActivityChart() {
  const [timeframe, setTimeframe] = useState<Timeframe>("week");
  const [points, setPoints] = useState<ActivityPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      try {
        const s = await getActivitySeries(user.id, timeframe);
        setPoints(s);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [timeframe]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Activity</CardTitle>
        <div className="flex gap-2">
          {(["day", "week", "month"] as Timeframe[]).map((tf) => (
            <Button key={tf} variant={tf === timeframe ? "default" : "outline"} size="sm" onClick={() => setTimeframe(tf)}>
              {tf[0].toUpperCase() + tf.slice(1)}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <div className="h-40 bg-muted animate-pulse rounded" /> : <Bars points={points} />}
      </CardContent>
    </Card>
  );
}