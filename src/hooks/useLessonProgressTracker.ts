import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { recordProgress } from "@/services/learnerAnalyticsService";

type Options = {
  lessonId: string;
  courseId: string;
  idleMs?: number; // default 60s
  syncIntervalMs?: number; // default 30s
};

export function useLessonProgressTracker({ lessonId, courseId, idleMs = 60_000, syncIntervalMs = 30_000 }: Options) {
  const [isIdle, setIsIdle] = useState(false);
  const [secondsActive, setSecondsActive] = useState(0);
  const lastActivityRef = useRef<number>(Date.now());
  const timerRef = useRef<number | null>(null);
  const syncRef = useRef<number | null>(null);
  const lastSyncedRef = useRef<number>(0);

  // Activity listeners
  useEffect(() => {
    const bump = () => { lastActivityRef.current = Date.now(); setIsIdle(false); };
    const onVisibility = () => { if (document.visibilityState === "hidden") setIsIdle(true); else bump(); };
    window.addEventListener("mousemove", bump);
    window.addEventListener("keydown", bump);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("mousemove", bump);
      window.removeEventListener("keydown", bump);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // Idle detection + tick
  useEffect(() => {
    timerRef.current = window.setInterval(() => {
      const idle = Date.now() - lastActivityRef.current > idleMs;
      setIsIdle(idle);
      if (!idle) setSecondsActive((s) => s + 1);
    }, 1000);
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, [idleMs]);

  // Sync progress periodically
  useEffect(() => {
    const startSync = () => {
      syncRef.current = window.setInterval(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        try {
          // simplistic mapping: every 60 seconds counts as 1% progression chunk demo
          const progressionPct = Math.min(100, Math.floor((secondsActive / 60) * 1));
          const deltaSeconds = Math.max(0, secondsActive - lastSyncedRef.current);
          if (deltaSeconds === 0) return; // nothing new to sync
          await recordProgress({
            userId: user.id,
            courseId,
            videoId: lessonId,
            status: progressionPct >= 100 ? "completed" : "in_progress",
            seconds: deltaSeconds,
          });
          lastSyncedRef.current = secondsActive;
        } catch (e) {
          // swallow transient errors; a more robust impl could queue offline
          console.warn("Progress sync failed", e);
        }
      }, syncIntervalMs);
    };
    startSync();
    return () => { if (syncRef.current) window.clearInterval(syncRef.current); };
  }, [courseId, lessonId, secondsActive, syncIntervalMs]);

  return { isIdle, secondsActive };
}