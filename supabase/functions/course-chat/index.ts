// deno-lint-ignore-file no-explicit-any
// Ambient type shims to satisfy local TypeScript diagnostics without affecting runtime.
// These help editors that don't understand Deno module resolution.
declare const Deno: any;
// Provide Edge Runtime typings so the editor recognizes Deno globals
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// Note: Avoid ambient module augmentations for Deno npm specifiers in this file
// as some editors flag them as invalid. We rely on dynamic imports with
// `@ts-expect-error` annotations where necessary.
// Avoid static npm/jsr imports to reduce local editor diagnostics.
// Dynamically import Supabase client when needed.
async function importSupabaseCreateClient(): Promise<any> {
  // @ts-expect-error Deno resolves npm specifiers at runtime
  const mod: any = await import("npm:@supabase/supabase-js@2");
  return mod.createClient;
}

type Role = "user" | "assistant";

interface HistoryItem {
  role: Role;
  content: string;
}

interface RequestBody {
  courseId: string;
  message: string;
  sessionId?: string;
  conversationHistory?: HistoryItem[];
}

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
// Default to a stable, widely available model for v1
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";
const GEMINI_API_VERSION = Deno.env.get("GEMINI_API_VERSION") ?? "v1"; // prefer v1, fallback to v1beta
function geminiUrlFor(model: string, version?: string): string {
  const v = version ?? GEMINI_API_VERSION;
  return `https://generativelanguage.googleapis.com/${v}/models/${model}:generateContent`;
}

const systemPrompt = `You are a helpful course assistant. Answer questions based ONLY on the provided course knowledge base.\nIf the answer is not in the knowledge base, politely say you don't have that information in the course materials.\nBe concise, clear, and educational in your responses.`;

async function createSupabaseClientFromRequest(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const createClient = await importSupabaseCreateClient();
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: req.headers.get("Authorization") ?? "" },
    },
  });
}

async function createServiceSupabaseClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
  const createClient = await importSupabaseCreateClient();
  return createClient(supabaseUrl, serviceRoleKey);
}

function detectTypeFromUrl(fileUrl: string, fileType?: string): string {
  return (
    fileType ||
    (fileUrl.toLowerCase().endsWith(".txt")
      ? "text/plain"
      : fileUrl.toLowerCase().endsWith(".pdf")
      ? "application/pdf"
      : fileUrl.toLowerCase().endsWith(".docx")
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : "")
  );
}

async function extractTextFromBuffer(buffer: ArrayBuffer, fileUrl: string, fileType?: string): Promise<string> {
  const type = detectTypeFromUrl(fileUrl, fileType);
  if (type === "text/plain") {
    return new TextDecoder().decode(buffer);
  }
  if (type === "application/pdf") {
    try {
      // Use pdfjs legacy build and disable workers for Edge Runtime compatibility
      // @ts-expect-error Deno resolves npm specifiers at runtime
      const pdfjs: any = await import("npm:pdfjs-dist@4.4.168/legacy/build/pdf.mjs");
      const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer), disableWorker: true });
      const pdf: any = await (loadingTask as any).promise;
      const numPages = pdf.numPages || 0;
      let fullText = "";
      for (let i = 1; i <= numPages; i++) {
        const page: any = await pdf.getPage(i);
        const textContent: any = await page.getTextContent();
        const pageText = (textContent.items || [])
          .map((item: any) => (item.str ?? item.string ?? ""))
          .join(" ");
        fullText += pageText + "\n\n";
      }
      try { await pdf.cleanup?.(); } catch (_) { /* noop */ }
      try { await pdf.destroy?.(); } catch (_) { /* noop */ }
      return fullText.trim();
    } catch (e: any) {
      throw new Error(`Failed to extract text from PDF: ${e?.message ?? e}`);
    }
  }
  // For now, avoid heavy Node-only parsers in the Edge Runtime.
  // We can add PDF/DOCX extraction via a compatible approach later.
  throw new Error("Unsupported knowledge base file type. Supported: .txt, .pdf");
}

async function sha256Hex(input: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", input);
  const bytes = new Uint8Array(hash);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function rateLimitCheck(serviceSupabase: any, userId: string, courseId: string, limitPerMinute = 10) {
  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { data: sessions, error: sessionsError } = await serviceSupabase
    .from("course_chat_sessions")
    .select("id")
    .eq("user_id", userId)
    .eq("course_id", courseId);

  if (sessionsError) throw sessionsError;
  const sessionIds = (sessions || []).map((s: any) => s.id);
  if (sessionIds.length === 0) return true;

  const { count, error: countError } = await serviceSupabase
    .from("course_chat_messages")
    .select("id", { count: "exact", head: true })
    .in("session_id", sessionIds)
    .gte("created_at", oneMinuteAgo);

  if (countError) throw countError;
  return (count ?? 0) < limitPerMinute;
}

async function callGemini(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error("Gemini API key not configured");
  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: `${systemPrompt}\n\n${prompt}` }],
      },
    ],
  };

  // Helper to call Gemini with model/version
  const call = async (model: string, version?: string) =>
    fetch(`${geminiUrlFor(model, version)}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  let resp = await call(GEMINI_MODEL);

  // Fallbacks for common 404 cases: switch API version, drop -latest suffix
  if (resp.status === 404) {
    const toggledVersion = GEMINI_API_VERSION === "v1beta" ? "v1" : "v1beta";
    resp = await call(GEMINI_MODEL, toggledVersion);
    if (resp.status === 404) {
      const baseModel = GEMINI_MODEL.replace(/-latest$/, "");
      if (baseModel !== GEMINI_MODEL) {
        resp = await call(baseModel, toggledVersion);
      }
    }
  }

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Gemini API error: ${resp.status} ${errText}`);
  }
  const json = await resp.json();
  // Extract text from candidates
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || json?.candidates?.[0]?.output_text || "";
  return text || "(No response)";
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Attempt to download the knowledge base using service credentials when it lives in
// the private `course-knowledge-bases` bucket. Fallback to plain fetch otherwise.
async function fetchKnowledgeBaseBuffer(
  serviceSupabase: any,
  fileUrl: string
): Promise<ArrayBuffer> {
  // Try to detect a storage path like `course-knowledge-bases/<courseId>/<filename>`
  const match = fileUrl.match(/course-knowledge-bases\/(.+)$/);
  if (match && match[1]) {
    const objectPath = match[1];
    const { data, error } = await serviceSupabase.storage
      .from("course-knowledge-bases")
      .download(objectPath);
    if (error) throw error;
    const buf = await data.arrayBuffer();
    return buf;
  }

  // If not a Supabase storage URL, attempt direct fetch
  const fileRes = await fetch(fileUrl);
  if (!fileRes.ok) throw new Error("Failed to fetch knowledge base file");
  return await fileRes.arrayBuffer();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUserClient = await createSupabaseClientFromRequest(req);
    const serviceSupabase = await createServiceSupabaseClient();

    const { data: userData, error: userError } = await supabaseUserClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = userData.user.id;

    const body: RequestBody = await req.json();
    const { courseId, message, sessionId, conversationHistory } = body;
    if (!courseId || !message) {
      return new Response(JSON.stringify({ error: "Missing courseId or message" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Enrollment check
    const { data: enrollment, error: enrollmentError } = await serviceSupabase
      .from("enrollments")
      .select("id")
      .eq("student_id", userId)
      .eq("course_id", courseId)
      .maybeSingle();
    if (enrollmentError) throw enrollmentError;
    if (!enrollment) {
      return new Response(JSON.stringify({ error: "User not enrolled in course" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Rate limit
    const allowed = await rateLimitCheck(serviceSupabase, userId, courseId);
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again in a minute." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Resolve or create session
    let effectiveSessionId = sessionId ?? null;
    if (effectiveSessionId) {
      const { data: existing, error: sessionCheckError } = await serviceSupabase
        .from("course_chat_sessions")
        .select("id, user_id, course_id")
        .eq("id", effectiveSessionId)
        .maybeSingle();
      if (sessionCheckError) throw sessionCheckError;
      if (!existing || existing.user_id !== userId || existing.course_id !== courseId) {
        effectiveSessionId = null; // fallback to create new
      }
    }

    if (!effectiveSessionId) {
      const { data: newSession, error: newSessionError } = await serviceSupabase
        .from("course_chat_sessions")
        .insert({ course_id: courseId, user_id: userId })
        .select("id")
        .single();
      if (newSessionError) throw newSessionError;
      effectiveSessionId = newSession.id;
    }

    // Insert user message
    const { error: insertUserMessageError } = await serviceSupabase
      .from("course_chat_messages")
      .insert({ session_id: effectiveSessionId, role: "user", content: message });
    if (insertUserMessageError) throw insertUserMessageError;

    // Get knowledge base metadata
    const { data: kb, error: kbError } = await serviceSupabase
      .from("course_knowledge_base")
      .select("file_url, file_type")
      .eq("course_id", courseId)
      .maybeSingle();
    if (kbError) throw kbError;
    if (!kb?.file_url) {
      return new Response(JSON.stringify({ error: "No knowledge base document for this course" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Try cache
    let knowledgeText = "";
    const { data: cacheRow } = await serviceSupabase
      .from("course_knowledge_base_cache")
      .select("text")
      .eq("course_id", courseId)
      .maybeSingle();
    if (cacheRow?.text) {
      knowledgeText = cacheRow.text;
    } else {
      // Extract text and cache
      const fileBuffer = await fetchKnowledgeBaseBuffer(serviceSupabase, kb.file_url);
      const text = await extractTextFromBuffer(fileBuffer, kb.file_url, kb.file_type);
      const fileHash = await sha256Hex(fileBuffer);
      const { error: upsertError } = await serviceSupabase
        .from("course_knowledge_base_cache")
        .upsert({ course_id: courseId, text, file_hash: fileHash })
        .eq("course_id", courseId);
      if (upsertError) throw upsertError;
      knowledgeText = text;
    }

    // Build prompt with history
    const historyText = (conversationHistory ?? [])
      .map((h) => `${h.role.toUpperCase()}: ${h.content}`)
      .join("\n\n");

    const prompt = `COURSE KNOWLEDGE BASE:\n\n${knowledgeText}\n\nPREVIOUS CONVERSATION:\n${historyText}\n\nQUESTION:\n${message}`;

    // Call Gemini
    const aiResponse = await callGemini(prompt);

    // Insert assistant message
    const { error: insertAssistantMessageError } = await serviceSupabase
      .from("course_chat_messages")
      .insert({ session_id: effectiveSessionId, role: "assistant", content: aiResponse });
    if (insertAssistantMessageError) throw insertAssistantMessageError;

    return new Response(JSON.stringify({ sessionId: effectiveSessionId, response: aiResponse }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("course-chat error:", err);
    const status = typeof err?.status === "number" ? err.status : 500;
    return new Response(JSON.stringify({ error: err?.message ?? "Internal Server Error" }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});