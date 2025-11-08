# TRAE Implementation Prompt: Course AI Chatbot with Knowledge Base Integration

I need to implement an AI-powered chatbot feature for my Udemy-like learning platform that allows enrolled students to ask questions about course content. The chatbot should use the course's knowledge base document (already uploaded by teachers) to provide accurate, context-aware answers.

## Technical Stack
- **Frontend:** React with TypeScript
- **Backend:** Supabase (Database + Storage + Edge Functions)
- **AI API:** Google Gemini API (free tier)
- **UI Components:** Shadcn/ui + Tailwind CSS
- **Icons:** Lucide React

---

## Feature Overview

### User Flow
1. Student navigates to course page (only if enrolled)
2. Clicks "Ask AI Assistant" button/tab
3. Chat interface opens (modal or sidebar)
4. Student types question about course content
5. AI responds based on knowledge base document
6. Conversation history is maintained during session
7. Student can ask follow-up questions

---

## Implementation Requirements

### 1. Database Schema

Create necessary tables:

```sql
-- Table to store chat conversations
CREATE TABLE course_chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Table to store individual messages
CREATE TABLE course_chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES course_chat_sessions(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_chat_sessions_user_course ON course_chat_sessions(user_id, course_id);
CREATE INDEX idx_chat_messages_session ON course_chat_messages(session_id);

-- RLS Policies
ALTER TABLE course_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_chat_messages ENABLE ROW LEVEL SECURITY;

-- Users can only access their own chat sessions
CREATE POLICY "Users can view own chat sessions"
    ON course_chat_sessions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own chat sessions"
    ON course_chat_sessions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can only access messages from their sessions
CREATE POLICY "Users can view own messages"
    ON course_chat_messages FOR SELECT
    USING (
        session_id IN (
            SELECT id FROM course_chat_sessions WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create own messages"
    ON course_chat_messages FOR INSERT
    WITH CHECK (
        session_id IN (
            SELECT id FROM course_chat_sessions WHERE user_id = auth.uid()
        )
    );
```

---

### 2. Supabase Edge Function for AI Chat

Create an edge function at `supabase/functions/course-chat/index.ts`:

**Purpose:** Handle AI chat requests, fetch knowledge base, call Gemini API

**Key responsibilities:**
- Verify user is enrolled in course
- Fetch and extract knowledge base document text
- Send request to Google Gemini API
- Return AI response
- Handle errors gracefully

**API Endpoint:** `POST /functions/v1/course-chat`

**Request body:**
```typescript
{
  courseId: string,
  message: string,
  sessionId?: string, // Optional, create new if not provided
  conversationHistory?: Array<{role: 'user' | 'assistant', content: string}>
}
```

**Response:**
```typescript
{
  sessionId: string,
  response: string,
  error?: string
}
```

**Implementation details:**
- Use `mammoth` library for DOCX text extraction
- Use `pdf-parse` or similar for PDF text extraction
- Cache extracted knowledge base text in memory or database for performance
- Include conversation history in Gemini prompt for context-aware responses
- Set system prompt to instruct AI to answer only from knowledge base

**Gemini API Integration:**
```typescript
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

// System prompt for AI
const systemPrompt = `You are a helpful course assistant. Answer questions based ONLY on the provided course knowledge base.
If the answer is not in the knowledge base, politely say you don't have that information in the course materials.
Be concise, clear, and educational in your responses.`;
```

**Error handling:**
- Course not found
- User not enrolled
- No knowledge base document
- API rate limits
- Network errors
- Document parsing errors

---

### 3. Frontend Components

#### Component A: Chat Button/Trigger
**Location:** Course page (visible only to enrolled students)

**Features:**
- Floating action button or tab in course interface
- Icon: MessageCircle or Bot from lucide-react
- Badge showing "AI Assistant" or "Ask Questions"
- Opens chat interface on click

#### Component B: Chat Interface (`CourseAIChatbot.tsx`)
**Layout:** Modal or slide-in sidebar (user preference)

**Structure:**
```
┌─────────────────────────────────┐
│  📚 Course AI Assistant    [X]  │
├─────────────────────────────────┤
│                                 │
│  [Chat message history]         │
│  - User messages (right)        │
│  - AI messages (left)           │
│  - Timestamps                   │
│  - Loading indicators           │
│                                 │
├─────────────────────────────────┤
│  [Type your question...]  [📤] │
└─────────────────────────────────┘
```

**UI Requirements:**
- **Header:**
  - Course name or "AI Assistant"
  - Close button
  - Optional: Clear chat button

- **Message Area:**
  - Scrollable container with auto-scroll to bottom
  - User messages: Right-aligned, blue background
  - AI messages: Left-aligned, gray background
  - Avatar icons (User icon, Bot icon)
  - Timestamp for each message
  - Loading animation while AI is thinking (typing indicator)
  - Error messages displayed inline
  - Empty state: "Ask me anything about this course!"

- **Input Area:**
  - Textarea with placeholder: "Ask a question about the course..."
  - Auto-resize based on content (max 4-5 lines)
  - Send button (disabled when empty or loading)
  - Enter to send, Shift+Enter for new line
  - Character limit indicator (optional)

**State Management:**
```typescript
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatState {
  sessionId: string | null;
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  isOpen: boolean;
}
```

**Features:**
- Persist session ID in component state
- Store messages in local state (don't need to fetch history on every render)
- Optimistic UI updates (show user message immediately)
- Retry failed messages
- Copy message to clipboard option
- Rate limiting feedback (if API limit reached)

---

### 4. API Integration Layer

Create a service file `src/services/courseChatService.ts`:

```typescript
export async function sendChatMessage(
  courseId: string,
  message: string,
  sessionId?: string,
  conversationHistory?: Message[]
): Promise<ChatResponse> {
  // Call Supabase Edge Function
  // Handle response and errors
  // Return formatted data
}

export async function createChatSession(
  courseId: string,
  userId: string
): Promise<string> {
  // Create new chat session in database
  // Return session ID
}

export async function getChatHistory(
  sessionId: string
): Promise<Message[]> {
  // Fetch message history for session
  // Return messages array
}
```

---

### 5. Environment Variables

Add to `.env` and Supabase Edge Function secrets:

```
GEMINI_API_KEY=your_google_gemini_api_key_here
```

**Instructions for getting Gemini API key:**
1. Visit https://aistudio.google.com/app/apikey
2. Sign in with Google account
3. Click "Create API Key"
4. Copy key and add to environment variables

---

### 6. Knowledge Base Text Extraction

**For PDF files:**
```typescript
// Use pdf-parse or similar library
import pdfParse from 'pdf-parse';

const extractPdfText = async (buffer: ArrayBuffer): Promise<string> => {
  const data = await pdfParse(Buffer.from(buffer));
  return data.text;
};
```

**For DOCX files:**
```typescript
// Use mammoth library
import mammoth from 'mammoth';

const extractDocxText = async (buffer: ArrayBuffer): Promise<string> => {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
};
```

**For TXT files:**
```typescript
const extractTxtText = async (buffer: ArrayBuffer): Promise<string> => {
  return new TextDecoder().decode(buffer);
};
```

**Caching strategy:**
- Store extracted text in a separate database table `course_knowledge_base_cache`
- Include file hash to detect when document is updated
- Regenerate cache when document changes

---

### 7. Security Considerations

**Must implement:**
- ✅ Verify user is enrolled in course before allowing chat
- ✅ Rate limiting per user (e.g., 10 messages per minute)
- ✅ Validate message length (max 2000 characters)
- ✅ Sanitize user input before sending to API
- ✅ Don't expose API keys in frontend
- ✅ Use RLS policies to prevent unauthorized access
- ✅ Log suspicious activity (excessive requests, etc.)

---

### 8. User Experience Enhancements

**Nice-to-have features:**
- Markdown rendering in AI responses (code blocks, lists, bold, etc.)
- Syntax highlighting for code snippets
- Copy code button for code blocks
- "Suggested questions" to get users started
- Feedback buttons (👍 👎) on AI responses
- "New conversation" button to start fresh
- Session history list (previous conversations)
- Export conversation as text/PDF
- Voice input option (browser speech recognition)

---

### 9. Error Handling & Edge Cases

**Handle these scenarios gracefully:**
- No knowledge base uploaded yet → Show message: "This course doesn't have an AI assistant yet. Please check back later."
- Knowledge base is empty or corrupted → Log error, show friendly message
- Gemini API is down → Retry with exponential backoff, show error if persists
- User is not enrolled → Don't show chat button at all
- Rate limit exceeded → Show countdown timer until next message allowed
- Network error → Show retry button
- Session expired → Create new session automatically

---

### 10. Testing Checklist

Before marking as complete, test:
- [ ] Enrolled student can open chat interface
- [ ] Non-enrolled student cannot see chat button
- [ ] User can send message and receive AI response
- [ ] Conversation history is maintained
- [ ] AI answers are relevant to knowledge base
- [ ] Error messages display correctly
- [ ] Loading states work properly
- [ ] Chat persists during page navigation (if modal)
- [ ] Mobile responsive design
- [ ] API rate limiting works
- [ ] Knowledge base extraction works for PDF, DOCX, TXT
- [ ] Cache invalidation when knowledge base is updated

---

### 11. Accessibility Requirements

- Keyboard navigation (Tab, Enter, Escape)
- ARIA labels for screen readers
- Focus management (trap focus in modal)
- Skip to chat content option
- High contrast mode support
- Proper heading hierarchy

---

### 12. Performance Optimization

- Lazy load chat component (only when opened)
- Virtualize message list for long conversations
- Debounce typing indicator
- Compress knowledge base text before sending to API
- Use streaming responses if Gemini supports it (optional)
- Cache API responses for identical questions (optional)

---

## Implementation Order

1. **Setup Gemini API** - Get API key, test basic request
2. **Create database schema** - Tables, indexes, RLS policies
3. **Build Edge Function** - Document extraction, Gemini integration
4. **Create chat UI components** - Basic chat interface
5. **Integrate API calls** - Connect frontend to backend
6. **Add error handling** - Graceful failures, retry logic
7. **Implement caching** - Knowledge base text caching
8. **Security hardening** - Rate limiting, validation
9. **Polish UX** - Loading states, animations, empty states
10. **Testing** - All scenarios from checklist

---

## Example Prompts for AI

**System prompt to Gemini:**
```
You are a helpful AI assistant for an online course. Your role is to answer student questions based ONLY on the provided course knowledge base document.

Guidelines:
- Be concise and educational
- Use examples from the knowledge base when relevant
- If a question cannot be answered from the knowledge base, politely say: "I don't have that specific information in the course materials, but I'd recommend checking with your instructor."
- Format code snippets with proper markdown
- Break down complex topics into simple explanations
- Encourage learning and curiosity

Knowledge Base:
{knowledgeBaseText}

Previous conversation:
{conversationHistory}

Student question: {userQuestion}

Provide a helpful, accurate answer based on the knowledge base above.
```

---

## Success Criteria

This feature is complete when:
✅ Students can open AI chat from course page
✅ AI provides accurate answers from knowledge base
✅ Conversation history is maintained
✅ All error cases are handled gracefully
✅ Performance is smooth (< 5 second response time)
✅ UI is intuitive and accessible
✅ Security measures are in place
✅ Mobile experience is good

---

## Notes
- Start with basic functionality, then enhance
- Gemini 1.5 Flash is recommended for speed (free tier)
- Consider upgrading to Gemini 1.5 Pro if need longer context
- Monitor API usage to stay within free tier limits
- Document any API errors for debugging

---

Please implement this feature with production-ready code, proper error handling, and a polished user experience. Use Shadcn/ui components where possible for consistency with the rest of the application.