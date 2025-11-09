import { supabase } from "@/integrations/supabase/client";
import type { Database, Tables, TablesInsert } from "@/integrations/supabase/types";

export type Timeframe = "day" | "week" | "month";

export interface LearnerStats {
  completionRate: number; // 0..1
  totalTimeSeconds: number;
  currentStreak: number;
  longestStreak: number;
}

export async function getLearnerStats(userId: string): Promise<LearnerStats> {
  const { data: progressRows, error: progressErr } = await supabase
    .from("learner_progress")
    .select("status,time_spent_seconds")
    .eq("user_id", userId);

  if (progressErr) throw progressErr;

  const total = progressRows?.length ?? 0;
  const completed = progressRows?.filter((r) => r.status === "completed").length ?? 0;
  const completionRate = total === 0 ? 0 : completed / total;
  const totalTimeSeconds = (progressRows || []).reduce((acc, r) => acc + (r.time_spent_seconds || 0), 0);

  const { data: streak, error: streakErr } = await supabase
    .from("learning_streaks")
    .select("current_streak,longest_streak")
    .eq("user_id", userId)
    .maybeSingle();

  if (streakErr) throw streakErr;

  return {
    completionRate,
    totalTimeSeconds,
    currentStreak: streak?.current_streak ?? 0,
    longestStreak: streak?.longest_streak ?? 0,
  };
}

export interface ContinueLearningItem {
  course: Tables<"courses">;
  latestStatus: Tables<"learner_progress">["status"];
  timeSpentSeconds: number;
}

export async function getContinueLearning(userId: string): Promise<ContinueLearningItem[]> {
  // Fetch in-progress or not-started items grouped by course
  const { data, error } = await supabase
    .from("learner_progress")
    .select("course_id,status,time_spent_seconds")
    .eq("user_id", userId)
    .in("status", ["not_started", "in_progress"]);
  if (error) throw error;

  const byCourse = new Map<string, { status: Tables<"learner_progress">["status"], time: number }>();
  (data || []).forEach((r) => {
    const prev = byCourse.get(r.course_id) || { status: r.status, time: 0 };
    byCourse.set(r.course_id, { status: r.status, time: prev.time + (r.time_spent_seconds || 0) });
  });

  const courseIds = Array.from(byCourse.keys());
  if (courseIds.length === 0) return [];

  const { data: courses, error: cErr } = await supabase
    .from("courses")
    .select("*")
    .in("id", courseIds);
  if (cErr) throw cErr;

  const courseById = new Map((courses || []).map((c) => [c.id, c]));
  return courseIds.map((cid) => ({
    course: courseById.get(cid)!,
    latestStatus: byCourse.get(cid)!.status,
    timeSpentSeconds: byCourse.get(cid)!.time,
  }));
}

export interface ActivityPoint { date: string; seconds: number }

export async function getActivitySeries(userId: string, timeframe: Timeframe): Promise<ActivityPoint[]> {
  // Define range
  const now = new Date();
  let days = 7;
  if (timeframe === "day") days = 1;
  if (timeframe === "month") days = 30;

  const since = new Date(now);
  since.setDate(now.getDate() - days + 1);
  const sinceISO = since.toISOString();

  const { data, error } = await supabase
    .from("learner_progress")
    .select("created_at,time_spent_seconds")
    .eq("user_id", userId)
    .gte("created_at", sinceISO);
  if (error) throw error;

  const buckets = new Map<string, number>();
  (data || []).forEach((r) => {
    const d = new Date(r.created_at).toISOString().slice(0, 10);
    buckets.set(d, (buckets.get(d) || 0) + (r.time_spent_seconds || 0));
  });

  // Fill missing days
  const points: ActivityPoint[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    points.push({ date: key, seconds: buckets.get(key) || 0 });
  }

  return points;
}

export interface RecordProgressInput {
  userId: string;
  courseId: string;
  videoId?: string;
  seconds: number;
  status: Tables<"learner_progress">["status"];
  score?: number;
}

export async function recordProgress(input: RecordProgressInput) {
  // Prevent status downgrade from 'completed' and accumulate time
  let select = supabase
    .from("learner_progress")
    .select("status,time_spent_seconds,completed_at")
    .eq("user_id", input.userId)
    .eq("course_id", input.courseId);
  if (typeof input.videoId === "string") {
    select = select.eq("video_id", input.videoId);
  } else {
    select = select.is("video_id", null);
  }
  const { data: existing, error: getErr } = await select.maybeSingle();
  if (getErr) throw getErr;

  const existingSeconds = existing?.time_spent_seconds ?? 0;
  const newSeconds = existingSeconds + input.seconds;
  const newStatus = existing?.status === "completed"
    ? "completed"
    : input.status === "completed"
      ? "completed"
      : input.status;
  const completedAt = existing?.completed_at ?? (newStatus === "completed" ? new Date().toISOString() : null);

  const payload: TablesInsert<"learner_progress"> = {
    user_id: input.userId,
    course_id: input.courseId,
    video_id: input.videoId ?? null,
    status: newStatus,
    time_spent_seconds: newSeconds,
    score: input.score ?? null,
    completed_at: completedAt,
  };
  const { error } = await supabase
    .from("learner_progress")
    .upsert(payload, { onConflict: "user_id,course_id,video_id" });
  if (error) throw error;
}

export async function getCompletedVideoIds(userId: string, courseId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("learner_progress")
    .select("video_id,status")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .eq("status", "completed");
  if (error) throw error;
  return (data || [])
    .map((r) => r.video_id)
    .filter((id): id is string => typeof id === "string");
}

export async function markLessonCompleted(params: { userId: string; courseId: string; videoId: string }) {
  const payload: Partial<TablesInsert<"learner_progress">> & Pick<TablesInsert<"learner_progress">, "user_id" | "course_id" | "video_id"> = {
    user_id: params.userId,
    course_id: params.courseId,
    video_id: params.videoId,
    status: "completed",
    completed_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from("learner_progress")
    .upsert(payload as TablesInsert<"learner_progress">, { onConflict: "user_id,course_id,video_id" });
  if (error) throw error;
}