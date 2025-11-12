import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type ProfileRow = Tables<"profiles">;

export interface ProfilePreferences {
  difficulty?: "beginner" | "intermediate" | "advanced";
  learning_style?: "video" | "reading" | "practice";
  favorite_topics?: string[];
}

export async function getCurrentUserProfile(): Promise<ProfileRow | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,full_name,avatar_url,preferences")
    .eq("id", user.id)
    .single();
  if (error) throw error;
  return data as ProfileRow;
}

export async function updateCurrentUserProfile(update: {
  full_name?: string | null;
  avatar_url?: string | null;
  preferences?: ProfilePreferences | null;
}): Promise<ProfileRow | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .update({
      full_name: update.full_name ?? null,
      avatar_url: update.avatar_url ?? null,
      preferences: update.preferences ?? null,
    })
    .eq("id", user.id)
    .select("id,email,full_name,avatar_url,preferences")
    .single();
  if (error) throw error;
  return data as ProfileRow;
}

export async function uploadAvatar(file: File): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const path = `${user.id}/${Date.now()}_${file.name}`;
  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, file, {
      upsert: true,
      cacheControl: "3600",
      contentType: file.type,
    });
  if (error) throw error;
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}