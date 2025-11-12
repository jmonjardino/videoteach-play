import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { getCurrentUserProfile, updateCurrentUserProfile, uploadAvatar, ProfilePreferences } from "@/services/profileService";

export default function Profile() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [preferences, setPreferences] = useState<ProfilePreferences>({
    difficulty: undefined,
    learning_style: undefined,
    favorite_topics: [],
  });

  useEffect(() => {
    (async () => {
      try {
        const profile = await getCurrentUserProfile();
        if (!profile) {
          navigate("/auth");
          return;
        }
        setFullName(profile.full_name || "");
        setEmail(profile.email);
        setAvatarUrl(profile.avatar_url);
        const pref = (profile as any).preferences as ProfilePreferences | null;
        if (pref) setPreferences({ ...pref });
      } catch (e: any) {
        toast({ title: "Failed to load profile", description: e.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  const initials = useMemo(() => {
    const parts = fullName.trim().split(" ").filter(Boolean);
    if (parts.length === 0) return (email || "?").slice(0, 1).toUpperCase();
    return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
  }, [fullName, email]);

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setAvatarFile(file);
  };

  const handleUploadAvatar = async () => {
    if (!avatarFile) return;
    try {
      setSaving(true);
      const publicUrl = await uploadAvatar(avatarFile);
      setAvatarUrl(publicUrl);
      await updateCurrentUserProfile({ avatar_url: publicUrl });
      toast({ title: "Profile picture updated" });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
      setAvatarFile(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await updateCurrentUserProfile({ full_name: fullName || null, avatar_url: avatarUrl, preferences });
      toast({ title: "Profile updated" });
      navigate("/dashboard");
    } catch (e: any) {
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading profile…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <main className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Edit Profile</CardTitle>
          </CardHeader>
          <form onSubmit={handleSave}>
            <CardContent className="space-y-6">
              {/* Avatar */}
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  {avatarUrl ? (
                    <AvatarImage src={avatarUrl} alt={fullName || email} />
                  ) : (
                    <AvatarFallback>{initials}</AvatarFallback>
                  )}
                </Avatar>
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="avatar">Profile picture</Label>
                    <Input id="avatar" type="file" accept="image/*" onChange={handleAvatarFileChange} />
                  </div>
                  <div className="flex items-end gap-2">
                    <Button type="button" onClick={handleUploadAvatar} disabled={!avatarFile || saving}>
                      {saving ? "Uploading…" : "Upload Photo"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setAvatarUrl(null)} disabled={saving}>
                      Remove
                    </Button>
                  </div>
                </div>
              </div>

              {/* Name & Email */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={email} disabled />
                </div>
              </div>

              {/* Preferences */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Learning Preferences</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Difficulty</Label>
                    <Select value={preferences.difficulty} onValueChange={(val) => setPreferences((p) => ({ ...p, difficulty: val as ProfilePreferences["difficulty"] }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select difficulty" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="beginner">Beginner</SelectItem>
                        <SelectItem value="intermediate">Intermediate</SelectItem>
                        <SelectItem value="advanced">Advanced</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Learning style</Label>
                    <Select value={preferences.learning_style} onValueChange={(val) => setPreferences((p) => ({ ...p, learning_style: val as ProfilePreferences["learning_style"] }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select style" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="video">Video</SelectItem>
                        <SelectItem value="reading">Reading</SelectItem>
                        <SelectItem value="practice">Practice</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Favorite topics (comma-separated)</Label>
                    <Input
                      value={(preferences.favorite_topics || []).join(", ")}
                      onChange={(e) => setPreferences((p) => ({ ...p, favorite_topics: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) }))}
                      placeholder="e.g. React, SQL, Algorithms"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => navigate(-1)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save Changes"}</Button>
            </CardFooter>
          </form>
        </Card>
      </main>
    </div>
  );
}