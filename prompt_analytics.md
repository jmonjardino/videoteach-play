# TRAE Implementation Prompt: AI Chat History, Learner Dashboard & Instructor Analytics

I need to implement three major features for my Udemy-like learning platform:
1. **Persistent AI chat conversations** - Store and retrieve chat history for each user/course
2. **Learner dashboard** - Display progress, milestones, completion rate, and time tracking
3. **Instructor analytics dashboard** - Monitor course engagement and student progress

---

## PART 1: PERSISTENT AI CHAT CONVERSATIONS

### Overview
Users should be able to view all their previous conversations with the course AI assistant, resume conversations, and start new ones. Each conversation should be saved permanently.

### Database Schema Updates

```sql
-- Chat sessions table already exists, but let's ensure it has all needed fields
ALTER TABLE course_chat_sessions ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE course_chat_sessions ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMP;
ALTER TABLE course_chat_sessions ADD COLUMN IF NOT EXISTS message_count INTEGER DEFAULT 0;

-- Create function to auto-update session metadata
CREATE OR REPLACE FUNCTION update_chat_session_metadata()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE course_chat_sessions
    SET 
        last_message_at = NEW.created_at,
        message_count = message_count + 1,
        updated_at = NOW()
    WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS update_session_on_message ON course_chat_messages;
CREATE TRIGGER update_session_on_message
    AFTER INSERT ON course_chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_chat_session_metadata();

-- Function to auto-generate conversation title from first message
CREATE OR REPLACE FUNCTION generate_conversation_title()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.message_count = 1 THEN
        UPDATE course_chat_sessions
        SET title = SUBSTRING(
            (SELECT content FROM course_chat_messages 
             WHERE session_id = NEW.id 
             AND role = 'user' 
             ORDER BY created_at ASC 
             LIMIT 1
            ), 1, 50
        ) || CASE 
            WHEN LENGTH((SELECT content FROM course_chat_messages WHERE session_id = NEW.id AND role = 'user' ORDER BY created_at ASC LIMIT 1)) > 50 
            THEN '...' 
            ELSE '' 
        END
        WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_title_trigger ON course_chat_sessions;
CREATE TRIGGER auto_title_trigger
    AFTER UPDATE OF message_count ON course_chat_sessions
    FOR EACH ROW
    EXECUTE FUNCTION generate_conversation_title();
```

### UI Components for Chat History

#### Component A: Chat History Sidebar (`ChatHistorySidebar.tsx`)

**Location:** Left side of chat interface or separate tab

**Structure:**
```
┌─────────────────────────────────┐
│  💬 Chat History                │
│  [+ New Conversation]           │
├─────────────────────────────────┤
│  Today                          │
│  ○ Python basics question       │
│  ○ Loop syntax help             │
│                                 │
│  Yesterday                      │
│  ○ Function parameters          │
│                                 │
│  Last 7 Days                    │
│  ○ Error handling help          │
│  ○ File operations              │
│                                 │
│  Older                          │
│  ○ Getting started with...      │
│    [Show more]                  │
└─────────────────────────────────┘
```

**Features:**
- Group conversations by date (Today, Yesterday, Last 7 Days, Older)
- Show conversation title (first 50 chars of first message)
- Display message count and last activity time on hover
- Highlight active conversation
- Search/filter conversations
- Delete conversation option (with confirmation)
- Rename conversation option
- Load more button for pagination (20 conversations per page)

**State Management:**
```typescript
interface ChatSession {
  id: string;
  course_id: string;
  title: string;
  message_count: number;
  last_message_at: string;
  created_at: string;
}

interface ChatHistoryState {
  sessions: ChatSession[];
  activeSessionId: string | null;
  isLoading: boolean;
  searchQuery: string;
  hasMore: boolean;
}
```

#### Component B: Updated Chat Interface

**Changes needed:**
- Add "Chat History" button/toggle to show/hide sidebar
- Display current conversation title at top
- "New Conversation" button that creates new session
- Load selected conversation when clicked in history
- Auto-save every message to database (already done via Edge Function)
- Optimistic UI updates while saving

### API Endpoints for Chat History

Update edge function or create new endpoints:

**1. Get all user's chat sessions for a course**
```typescript
GET /functions/v1/course-chat-history
Query params: { courseId: string, limit?: number, offset?: number }
Response: { sessions: ChatSession[], hasMore: boolean }
```

**2. Get messages for specific session**
```typescript
GET /functions/v1/course-chat-messages
Query params: { sessionId: string }
Response: { messages: Message[] }
```

**3. Delete chat session**
```typescript
DELETE /functions/v1/course-chat-session
Body: { sessionId: string }
Response: { success: boolean }
```

**4. Rename chat session**
```typescript
PATCH /functions/v1/course-chat-session
Body: { sessionId: string, title: string }
Response: { success: boolean, session: ChatSession }
```

**5. Search conversations**
```typescript
GET /functions/v1/course-chat-search
Query params: { courseId: string, query: string }
Response: { sessions: ChatSession[], messages: Message[] }
```

### Implementation Details

**Loading chat history:**
- Fetch all sessions on component mount
- Use pagination (20 per page) with "Load More" button
- Cache sessions in component state
- Real-time updates when new message sent

**Switching conversations:**
- Save current conversation state
- Load selected conversation messages
- Update active session ID
- Scroll to bottom of new conversation

**New conversation flow:**
1. User clicks "New Conversation"
2. Create new session in database
3. Clear current messages
4. Update active session ID
5. Focus on input field

---

## PART 2: LEARNER DASHBOARD

### Overview
A comprehensive dashboard for students showing their learning progress, achievements, time spent, and course completion status.

### Database Schema for Analytics

```sql
-- Table to track course progress
CREATE TABLE IF NOT EXISTS learner_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP,
    time_spent_seconds INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, lesson_id)
);

-- Table to track overall course enrollment and completion
CREATE TABLE IF NOT EXISTS course_enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    completion_percentage DECIMAL(5,2) DEFAULT 0,
    total_time_spent_seconds INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMP,
    certificate_issued BOOLEAN DEFAULT FALSE,
    UNIQUE(user_id, course_id)
);

-- Table to track daily learning streaks
CREATE TABLE IF NOT EXISTS learning_streaks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    lessons_completed INTEGER DEFAULT 0,
    time_spent_seconds INTEGER DEFAULT 0,
    courses_accessed UUID[] DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Table for achievements/badges
CREATE TABLE IF NOT EXISTS learner_achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    achievement_type TEXT NOT NULL, -- 'first_course', 'streak_7', 'streak_30', 'fast_learner', 'course_completed', etc.
    course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
    earned_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Indexes for performance
CREATE INDEX idx_learner_progress_user ON learner_progress(user_id);
CREATE INDEX idx_learner_progress_course ON learner_progress(course_id);
CREATE INDEX idx_learner_progress_user_course ON learner_progress(user_id, course_id);
CREATE INDEX idx_course_enrollments_user ON course_enrollments(user_id);
CREATE INDEX idx_learning_streaks_user_date ON learning_streaks(user_id, date);
CREATE INDEX idx_learner_achievements_user ON learner_achievements(user_id);

-- RLS Policies
ALTER TABLE learner_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE learner_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own progress"
    ON learner_progress FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own progress"
    ON learner_progress FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view own enrollments"
    ON course_enrollments FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own enrollments"
    ON course_enrollments FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view own streaks"
    ON learning_streaks FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own streaks"
    ON learning_streaks FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view own achievements"
    ON learner_achievements FOR SELECT
    USING (auth.uid() = user_id);

-- Function to update enrollment stats
CREATE OR REPLACE FUNCTION update_enrollment_stats()
RETURNS TRIGGER AS $$
DECLARE
    total_lessons INTEGER;
    completed_lessons INTEGER;
    completion_pct DECIMAL(5,2);
BEGIN
    -- Get total lessons in course
    SELECT COUNT(*) INTO total_lessons
    FROM lessons
    WHERE course_id = NEW.course_id;
    
    -- Get completed lessons
    SELECT COUNT(*) INTO completed_lessons
    FROM learner_progress
    WHERE user_id = NEW.user_id 
    AND course_id = NEW.course_id 
    AND completed = TRUE;
    
    -- Calculate percentage
    IF total_lessons > 0 THEN
        completion_pct := (completed_lessons::DECIMAL / total_lessons) * 100;
    ELSE
        completion_pct := 0;
    END IF;
    
    -- Update enrollment
    UPDATE course_enrollments
    SET 
        completion_percentage = completion_pct,
        total_time_spent_seconds = (
            SELECT COALESCE(SUM(time_spent_seconds), 0)
            FROM learner_progress
            WHERE user_id = NEW.user_id AND course_id = NEW.course_id
        ),
        completed_at = CASE 
            WHEN completion_pct = 100 AND completed_at IS NULL THEN NOW()
            ELSE completed_at
        END,
        last_accessed_at = NOW()
    WHERE user_id = NEW.user_id AND course_id = NEW.course_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_enrollment_on_progress ON learner_progress;
CREATE TRIGGER update_enrollment_on_progress
    AFTER INSERT OR UPDATE ON learner_progress
    FOR EACH ROW
    EXECUTE FUNCTION update_enrollment_stats();

-- Function to track daily streaks
CREATE OR REPLACE FUNCTION update_learning_streak()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO learning_streaks (user_id, date, lessons_completed, courses_accessed)
    VALUES (
        NEW.user_id,
        CURRENT_DATE,
        1,
        ARRAY[NEW.course_id]
    )
    ON CONFLICT (user_id, date)
    DO UPDATE SET
        lessons_completed = learning_streaks.lessons_completed + 1,
        courses_accessed = array_append(learning_streaks.courses_accessed, NEW.course_id),
        time_spent_seconds = learning_streaks.time_spent_seconds + NEW.time_spent_seconds;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS track_daily_streak ON learner_progress;
CREATE TRIGGER track_daily_streak
    AFTER UPDATE OF completed ON learner_progress
    FOR EACH ROW
    WHEN (NEW.completed = TRUE AND OLD.completed = FALSE)
    EXECUTE FUNCTION update_learning_streak();
```

### Learner Dashboard UI Components

#### Main Dashboard Layout (`LearnerDashboard.tsx`)

**Route:** `/dashboard/learner` or `/my-learning`

**Structure:**
```
┌───────────────────────────────────────────────────────────┐
│  Welcome back, [User Name]! 👋                            │
│  [Current streak: 🔥 5 days]                              │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ 📚 Courses  │  │ ⏱️ Time     │  │ 🏆 Badges   │     │
│  │    5        │  │   12.5h     │  │    8        │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  Continue Learning                                  │ │
│  │  ┌──────────────────────────────────────────────┐  │ │
│  │  │ Python 101          [████████░░] 75%         │  │ │
│  │  │ Last accessed: 2 hours ago                   │  │ │
│  │  │ [Continue →]                                 │  │ │
│  │  └──────────────────────────────────────────────┘  │ │
│  │  ┌──────────────────────────────────────────────┐  │ │
│  │  │ Web Development     [██░░░░░░░░] 25%         │  │ │
│  │  │ Last accessed: Yesterday                     │  │ │
│  │  │ [Continue →]                                 │  │ │
│  │  └──────────────────────────────────────────────┘  │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  Learning Activity (Last 30 Days)                  │ │
│  │  [Bar chart showing daily activity]                │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  Recent Achievements 🏆                            │ │
│  │  🥇 First Course Completed - 2 days ago            │ │
│  │  🔥 7-Day Streak Achieved - 1 week ago             │ │
│  │  ⚡ Fast Learner - 2 weeks ago                     │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  All My Courses                    [View All →]    │ │
│  │  [Grid of enrolled courses with progress]          │ │
│  └─────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────┘
```

#### Dashboard Sections

**1. Stats Cards (`DashboardStatsCards.tsx`)**
Display key metrics in card format:
- **Total Courses Enrolled:** Count of active enrollments
- **Total Time Spent:** Format as hours and minutes (e.g., "12h 30m")
- **Achievements Earned:** Total badges/achievements
- **Current Streak:** Days of consecutive learning (with fire emoji 🔥)
- **Completion Rate:** Average across all enrolled courses

**Visual Design:**
- Use gradient backgrounds for cards
- Add icons from lucide-react
- Animate numbers with count-up effect
- Hover effects showing more details

**2. Continue Learning Section (`ContinueLearningSection.tsx`)**
Show in-progress courses sorted by last accessed:
- Course thumbnail image
- Course title
- Progress bar with percentage
- Last accessed timestamp
- "Continue" button → navigate to last viewed lesson
- Show next lesson title
- Time remaining estimate

**3. Learning Activity Chart (`LearningActivityChart.tsx`)**
Visual representation of learning activity:
- **Type:** Bar chart or heatmap (GitHub-style contribution graph)
- **Data:** Time spent per day for last 30/90 days
- **Library:** Use Recharts or similar
- **Features:**
  - Hover to see exact time for each day
  - Color intensity based on time spent
  - Show streaks visually
  - Toggle between 30/90 days view

**4. Achievements Section (`AchievementsSection.tsx`)**
Display earned badges and locked achievements:
- **Earned badges:** Show with shiny effect, date earned
- **Locked achievements:** Grayed out with unlock criteria
- **Badge types:**
  - 🎓 First Course Completed
  - 🔥 7-Day Streak
  - 🔥 30-Day Streak
  - ⚡ Fast Learner (complete course in < X days)
  - 📚 Bookworm (5 courses completed)
  - 🏅 Subject Master (complete all courses in category)
  - 💬 Curious Mind (ask 50+ AI questions)
  - ⏰ Night Owl (learn after 10 PM)
  - 🌅 Early Bird (learn before 7 AM)

**5. Course Grid (`EnrolledCoursesGrid.tsx`)**
Show all enrolled courses with:
- Course card with thumbnail
- Progress ring/bar
- Completion percentage
- Last lesson title
- Quick action buttons (Continue, Certificate if completed)
- Filter options (In Progress, Completed, Not Started)
- Sort options (Recent, Progress, Name)

#### Individual Course Progress Page

**Route:** `/courses/:courseId/progress`

**Components:**

**1. Course Progress Header**
- Course title and instructor
- Overall completion percentage (large circular progress)
- Time spent on this course
- Certificate button (if 100% complete)

**2. Module/Section Progress (`ModuleProgressList.tsx`)**
```
Module 1: Introduction to Python     [████████░░] 80%
  ✅ Lesson 1: What is Python?       (5:30)
  ✅ Lesson 2: Installing Python     (8:15)
  ⭕ Lesson 3: Your First Program    (Not started)
  
Module 2: Variables and Data Types   [███░░░░░░░] 30%
  ✅ Lesson 1: Variables             (12:45)
  ⭕ Lesson 2: Data Types            (Not started)
```

**Visual Design:**
- Checkmarks for completed lessons
- Empty circles for incomplete
- Time spent per lesson
- Click to jump to lesson
- Expand/collapse modules
- Progress bar for each module

**3. Learning Stats for Course**
- Total time spent
- Lessons completed / Total lessons
- Average time per lesson
- Fastest lesson completion
- Estimated time to completion
- Learning velocity (lessons per week)

**4. Certificate Preview** (if completed)
- Downloadable PDF certificate
- Share buttons (LinkedIn, Twitter)
- Certificate ID for verification

### Backend APIs for Learner Analytics

**1. Get dashboard overview**
```typescript
GET /api/learner/dashboard
Response: {
  stats: {
    totalCourses: number,
    totalTimeSpent: number,
    achievementsCount: number,
    currentStreak: number,
    averageCompletion: number
  },
  inProgressCourses: Course[],
  recentAchievements: Achievement[],
  activityData: { date: string, timeSpent: number }[]
}
```

**2. Get course progress details**
```typescript
GET /api/learner/course/:courseId/progress
Response: {
  course: Course,
  enrollment: Enrollment,
  moduleProgress: ModuleProgress[],
  lessons: LessonProgress[],
  stats: CourseStats
}
```

**3. Track lesson progress**
```typescript
POST /api/learner/track-progress
Body: {
  lessonId: string,
  timeSpent: number,
  completed?: boolean
}
Response: { success: boolean, newAchievements?: Achievement[] }
```

**4. Get achievements**
```typescript
GET /api/learner/achievements
Response: {
  earned: Achievement[],
  available: AchievementDefinition[]
}
```

---

## PART 3: INSTRUCTOR ANALYTICS DASHBOARD

### Overview
Comprehensive analytics for course instructors to monitor student engagement, progress, and course performance.

### Database Schema for Instructor Analytics

```sql
-- Table to track detailed course analytics
CREATE TABLE IF NOT EXISTS course_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_enrollments INTEGER DEFAULT 0,
    active_learners INTEGER DEFAULT 0,
    lessons_completed INTEGER DEFAULT 0,
    total_time_spent_seconds INTEGER DEFAULT 0,
    completion_rate DECIMAL(5,2) DEFAULT 0,
    ai_questions_asked INTEGER DEFAULT 0,
    average_progress DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(course_id, date)
);

-- Table to track individual lesson analytics
CREATE TABLE IF NOT EXISTS lesson_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    views INTEGER DEFAULT 0,
    completions INTEGER DEFAULT 0,
    average_time_seconds INTEGER DEFAULT 0,
    drop_off_rate DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(lesson_id, date)
);

-- Indexes
CREATE INDEX idx_course_analytics_course_date ON course_analytics(course_id, date);
CREATE INDEX idx_lesson_analytics_lesson_date ON lesson_analytics(lesson_id, date);
CREATE INDEX idx_lesson_analytics_course ON lesson_analytics(course_id);

-- RLS Policies
ALTER TABLE course_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Instructors can view own course analytics"
    ON course_analytics FOR SELECT
    USING (
        course_id IN (
            SELECT id FROM courses WHERE instructor_id = auth.uid()
        )
    );

CREATE POLICY "Instructors can view own lesson analytics"
    ON lesson_analytics FOR SELECT
    USING (
        course_id IN (
            SELECT id FROM courses WHERE instructor_id = auth.uid()
        )
    );

-- Function to aggregate daily course analytics
CREATE OR REPLACE FUNCTION aggregate_course_analytics()
RETURNS void AS $$
DECLARE
    course_record RECORD;
BEGIN
    FOR course_record IN SELECT id FROM courses LOOP
        INSERT INTO course_analytics (
            course_id,
            date,
            total_enrollments,
            active_learners,
            lessons_completed,
            total_time_spent_seconds,
            ai_questions_asked,
            average_progress
        )
        SELECT
            course_record.id,
            CURRENT_DATE,
            COUNT(DISTINCT ce.user_id),
            COUNT(DISTINCT CASE WHEN ce.last_accessed_at >= CURRENT_DATE THEN ce.user_id END),
            COUNT(CASE WHEN lp.completed THEN 1 END),
            COALESCE(SUM(lp.time_spent_seconds), 0),
            COUNT(DISTINCT ccm.id),
            COALESCE(AVG(ce.completion_percentage), 0)
        FROM course_enrollments ce
        LEFT JOIN learner_progress lp ON ce.user_id = lp.user_id AND ce.course_id = lp.course_id
        LEFT JOIN course_chat_messages ccm ON EXISTS (
            SELECT 1 FROM course_chat_sessions ccs 
            WHERE ccs.id = ccm.session_id 
            AND ccs.user_id = ce.user_id 
            AND ccs.course_id = ce.course_id
            AND ccm.created_at::date = CURRENT_DATE
        )
        WHERE ce.course_id = course_record.id
        ON CONFLICT (course_id, date) 
        DO UPDATE SET
            total_enrollments = EXCLUDED.total_enrollments,
            active_learners = EXCLUDED.active_learners,
            lessons_completed = EXCLUDED.lessons_completed,
            total_time_spent_seconds = EXCLUDED.total_time_spent_seconds,
            ai_questions_asked = EXCLUDED.ai_questions_asked,
            average_progress = EXCLUDED.average_progress;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Schedule this to run daily via pg_cron or external scheduler
```

### Instructor Analytics Dashboard UI

#### Main Analytics Dashboard (`InstructorAnalytics.tsx`)

**Route:** `/instructor/courses/:courseId/analytics`

**Structure:**
```
┌─────────────────────────────────────────────────────────────┐
│  📊 Course Analytics: Python 101                            │
│  [Last 30 days ▼] [Export Report]                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │ 👥 Total │ │ 📈 Active│ │ ✅ Avg   │ │ ⏱️ Total │     │
│  │ Students │ │ Learners │ │ Progress │ │ Time     │     │
│  │   245    │ │    89    │ │   62%    │ │  1,234h  │     │
│  │ +12 ↑   │ │ +5 ↑    │ │ +3% ↑   │ │ +45h ↑  │     │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘     │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  📈 Enrollment & Engagement Over Time              │   │
│  │  [Line chart: enrollments vs active learners]      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌───────────────────────┐ ┌─────────────────────────┐   │
│  │  Completion Funnel    │ │  Learning Activity      │   │
│  │  Started:     245     │ │  [Heatmap by day/hour]  │   │
│  │  50% done:    120 ▼   │ │                         │   │
│  │  Completed:    45 ▼   │ │                         │   │
│  └───────────────────────┘ └─────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Lesson Performance                                 │   │
│  │  ┌────────────────────────────────────────────┐    │   │
│  │  │ Lesson 1: Intro        👁️ 245  ✅ 230  ⏱️ 8m │    │   │
│  │  │ Lesson 2: Variables    👁️ 230  ✅ 210  ⏱️ 12m│    │   │
│  │  │ Lesson 3: Loops        👁️ 210  ✅ 180  ⏱️ 15m│    │   │
│  │  │ Lesson 4: Functions    👁️ 180  ✅ 150  ⏱️ 18m│    │   │
│  │  │ ⚠️ High drop-off →    👁️ 150  ✅ 90   ⏱️ 22m│    │   │
│  │  └────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Student Progress Distribution                      │   │
│  │  [Bar chart showing # students at each % complete]  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  🤖 AI Assistant Usage                             │   │
│  │  Total questions: 1,234                            │   │
│  │  Most asked topics: [Tag cloud or list]           │   │
│  │  Avg questions per student: 5.2                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Top Performing Students          [View All →]     │   │
│  │  1. Alice Johnson    - 100% ⚡ 2 weeks              │   │
│  │  2. Bob Smith        - 95%  ⚡ 3 weeks              │   │
│  │  3. Carol Williams   - 90%  ⚡ 4 weeks              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Students Needing Help         [View All →]        │   │
│  │  • David Brown - Stuck at 30% for 2 weeks          │   │
│  │  • Eve Davis - Low activity (last seen 10 days)   │   │
│  │  • Frank Miller - Multiple incomplete attempts     │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘


```

#### Analytics Components

**1. Overview Stats Cards (`AnalyticsStatsCards.tsx`)**

Display key metrics with comparison to previous period:
- **Total Students:** Count of all enrollments
- **Active Learners:** Students who accessed course in last 7 days
- **Average Progress:** Mean completion percentage across all students
- **Total Time Spent:** Sum of all student time
- **Completion Rate:** Percentage who finished the course
- **Average Time to Complete:** For students who finished

**Features:**
- Show trend indicators (↑ +12% from last period)
- Color coding (green for positive, red for negative)
- Click to see detailed breakdown
- Tooltip with additional context

**2. Enrollment & Engagement Chart (`EnrollmentEngagementChart.tsx`)**

**Type:** Multi-line chart (Recharts)
**Data:**
- Line 1: Total enrollments over time
- Line 2: Active learners over time
- Line 3: Completion rate over time

**Features:**
- Date range selector (7 days, 30 days, 90 days, All time)
- Hover to see exact values
- Zoom and pan capabilities
- Export as image

**3. Completion Funnel (`CompletionFunnel.tsx`)**

**Type:** Funnel chart showing student drop-off
**Stages:**
1. Enrolled: X students
2. Started (watched first lesson): Y students (% of enrolled)
3. 25% complete: Z students
4. 50% complete: W students
5. 75% complete: V students
6. Completed: U students

**Features:**
- Show percentage and absolute numbers
- Highlight stages with high drop-off
- Click stage to see student list
- Suggestions for improvement

**4. Learning Activity Heatmap (`LearningActivityHeatmap.tsx`)**

**Type:** GitHub-style contribution heatmap
**Data:** Time spent or lessons completed per day
**Features:**
- Last 12 weeks or custom range
- Color intensity based on activity level
- Hover to see exact data
- Identify peak learning days/times

**5. Lesson Performance Table (`LessonPerformanceTable.tsx`)**

**Columns:**
- Lesson title
- Views count (👁️)
- Completions count (✅)
- Completion rate (%)
- Average time spent
- Drop-off rate
- Action buttons (View details, Edit lesson)

**Features:**
- Sort by any column
- Filter by module/section
- Highlight problematic lessons (high drop-off, low engagement)
- Click lesson to see detailed analytics

**6. Student Progress Distribution (`ProgressDistribution.tsx`)**

**Type:** Histogram/Bar chart
**X-axis:** Completion percentage (0-10%, 10-20%, ..., 90-100%)
**Y-axis:** Number of students

**Insights:**
- Shows where most students are in the course
- Identifies common sticking points
- Helps plan targeted interventions

**7. AI Assistant Analytics (`AIAssistantAnalytics.tsx`)**

**Metrics:**
- Total questions asked
- Questions per student (average)
- Most common topics (word cloud or ranked list)
- Unanswered or poorly answered questions
- Peak question times

**Features:**
- Click topic to see actual questions
- Identify knowledge gaps in course material
- Export question data for analysis

**8. Top Students List (`TopStudentsList.tsx`)**

**Display:**
- Student name/avatar
- Completion percentage
- Time to complete
- Badges earned
- Last active date

**Sort options:**
- Fastest completion
- Highest engagement
- Most questions asked
- Recent activity

**9. Students Needing Help (`StudentsNeedingHelp.tsx`)**

**Criteria for flagging:**
- Stuck at same progress for > X days
- Low activity (not accessed in > 7 days)
- Multiple incomplete lesson attempts
- Low time spent relative to progress
- High number of AI questions on same topic

**Actions:**
- Send encouragement email
- Offer 1-on-1 help
- View student's detailed progress
- Add note about student

#### Detailed Student View

**Route:** `/instructor/courses/:courseId/students/:studentId`

**Components:**

**1. Student Profile Header**
- Name, email, avatar
- Enrollment date
- Last active timestamp
- Contact button

**2. Progress Timeline**
```
Nov 1  ✅ Completed Lesson 1: Introduction
Nov 2  ✅ Completed Lesson 2: Variables
Nov 3  ✅ Completed Lesson 3: Data Types
Nov 5  ⏸️  Started Lesson 4: Loops (incomplete)
Nov 8  💬 Asked 3 questions to AI assistant
...
```

**3. Detailed Stats**
- Total time spent
- Lessons completed / Total
- Current streak
- Questions asked
- Average session duration
- Most active time of day

**4. Lesson-by-Lesson Breakdown**
Table showing:
- Lesson name
- Status (Not started, In progress, Completed)
- Time spent
- Attempts
- Last accessed

**5. AI Chat History**
- List of all questions asked
- Ability to view full conversations
- Identify topics of confusion

**6. Instructor Notes**
- Private notes about student
- Interaction history
- Action items

#### Analytics Export & Reports

**Component:** `AnalyticsExport.tsx`

**Export formats:**
- PDF report (formatted, charts included)
- CSV (raw data for external analysis)
- Excel (multiple sheets for different metrics)

**Report sections:**
- Executive summary
- Enrollment trends
- Engagement metrics
- Lesson performance
- Student progress distribution
- Top performers and at-risk students
- Recommendations

**Schedule reports:**
- Weekly email digest
- Monthly comprehensive report
- Custom schedule

### Backend APIs for Instructor Analytics

**1. Get course analytics overview**
```typescript
GET /api/instructor/courses/:courseId/analytics
Query params: { 
  startDate?: string, 
  endDate?: string,
  period?: '7d' | '30d' | '90d' | 'all'
}
Response: {
  stats: {
    totalStudents: number,
    activeStudents: number,
    averageProgress: number,
    totalTimeSpent: number,
    completionRate: number
  },
  trends: {
    enrollmentData: { date: string, count: number }[],
    engagementData: { date: string, active: number }[],
    completionData: { date: string, rate: number }[]
  },
  funnelData: FunnelStage[],
  activityHeatmap: { date: string, value: number }[]
}
```

**2. Get lesson analytics**
```typescript
GET /api/instructor/courses/:courseId/lessons/analytics
Response: {
  lessons: Array<{
    id: string,
    title: string,
    views: number,
    completions: number,
    completionRate: number,
    averageTimeSpent: number,
    dropOffRate: number
  }>
}
```

**3. Get student list with progress**
```typescript
GET /api/instructor/courses/:courseId/students
Query params: {
  sort?: 'progress' | 'recent' | 'name' | 'timeSpent',
  filter?: 'all' | 'active' | 'completed' | 'atRisk',
  page?: number,
  limit?: number
}
Response: {
  students: Array<{
    id: string,
    name: string,
    email: string,
    progress: number,
    timeSpent: number,
    lastActive: string,
    status: 'active' | 'inactive' | 'completed'
  }>,
  pagination: { total: number, page: number, pages: number }
}
```

**4. Get individual student details**
```typescript
GET /api/instructor/courses/:courseId/students/:studentId
Response: {
  student: StudentProfile,
  enrollment: Enrollment,
  progressTimeline: TimelineEvent[],
  lessonProgress: LessonProgress[],
  stats: {
    totalTime: number,
    lessonsCompleted: number,
    questionsAsked: number,
    currentStreak: number,
    averageSessionDuration: number
  },
  aiChatSummary: {
    totalQuestions: number,
    commonTopics: string[],
    recentQuestions: string[]
  }
}
```

**5. Get AI assistant analytics**
```typescript
GET /api/instructor/courses/:courseId/ai-analytics
Response: {
  totalQuestions: number,
  questionsPerStudent: number,
  topTopics: Array<{ topic: string, count: number }>,
  recentQuestions: Array<{
    question: string,
    student: string,
    timestamp: string
  }>,
  unansweredRate: number
}
```

**6. Export analytics report**
```typescript
POST /api/instructor/courses/:courseId/export
Body: {
  format: 'pdf' | 'csv' | 'excel',
  sections: string[],
  dateRange: { start: string, end: string }
}
Response: {
  downloadUrl: string,
  expiresAt: string
}
```

**7. Get students needing help**
```typescript
GET /api/instructor/courses/:courseId/students/at-risk
Response: {
  students: Array<{
    id: string,
    name: string,
    reason: 'stuck' | 'inactive' | 'struggling',
    details: string,
    lastActive: string,
    progress: number
  }>
}
```

**8. Add instructor note**
```typescript
POST /api/instructor/students/:studentId/notes
Body: {
  courseId: string,
  note: string
}
Response: { success: boolean, note: Note }
```

---

## PART 4: PROGRESS TRACKING IMPLEMENTATION

### Automatic Progress Tracking

**Component:** `LessonProgressTracker.tsx` (wrapper or hook)

**Purpose:** Automatically track when user views/completes lessons

**Implementation:**

```typescript
// Hook to track lesson progress
const useLessonProgress = (lessonId: string, courseId: string) => {
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    // Track lesson view
    trackLessonView(lessonId, courseId);

    // Start timer
    const timer = setInterval(() => {
      const timeSpent = Math.floor((Date.now() - startTime) / 1000);
      updateProgress(lessonId, courseId, timeSpent, false);
    }, 30000); // Update every 30 seconds

    return () => {
      clearInterval(timer);
      // Final time update on unmount
      const finalTime = Math.floor((Date.now() - startTime) / 1000);
      updateProgress(lessonId, courseId, finalTime, isCompleted);
    };
  }, [lessonId, courseId]);

  const markComplete = () => {
    setIsCompleted(true);
    const timeSpent = Math.floor((Date.now() - startTime) / 1000);
    updateProgress(lessonId, courseId, timeSpent, true);
  };

  return { markComplete, isCompleted };
};
```

**Tracking triggers:**
- Lesson view (on page load)
- Time spent (update every 30 seconds)
- Completion (manual button or video end)
- Page visibility (pause timer when tab inactive)

**API endpoint:**
```typescript
POST /api/learner/track-lesson
Body: {
  lessonId: string,
  courseId: string,
  timeSpentSeconds: number,
  completed?: boolean,
  videoProgress?: number // for video lessons
}
```

### Video Progress Tracking

**For video lessons:**
```typescript
const useVideoProgress = (lessonId: string) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleProgress = () => {
      const progress = (video.currentTime / video.duration) * 100;
      saveVideoProgress(lessonId, progress);
    };

    const handleEnded = () => {
      markLessonComplete(lessonId);
    };

    video.addEventListener('timeupdate', handleProgress);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', handleProgress);
      video.removeEventListener('ended', handleEnded);
    };
  }, [lessonId]);

  return videoRef;
};
```

**Features:**
- Save progress every 10 seconds
- Resume from last position
- Auto-complete when 95% watched
- Handle seeking (don't skip required content)

---

## PART 5: ACHIEVEMENT SYSTEM

### Achievement Definitions

Create a configuration file or database table for achievements:

```typescript
const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: 'first_course',
    type: 'first_course',
    title: 'First Steps',
    description: 'Enroll in your first course',
    icon: '🎓',
    criteria: { enrollments: 1 }
  },
  {
    id: 'course_complete',
    type: 'course_completed',
    title: 'Course Conqueror',
    description: 'Complete your first course',
    icon: '🏆',
    criteria: { coursesCompleted: 1 }
  },
  {
    id: 'streak_7',
    type: 'streak_7',
    title: 'Week Warrior',
    description: 'Learn for 7 days in a row',
    icon: '🔥',
    criteria: { streakDays: 7 }
  },
  {
    id: 'streak_30',
    type: 'streak_30',
    title: 'Monthly Master',
    description: 'Maintain a 30-day learning streak',
    icon: '🔥🔥',
    criteria: { streakDays: 30 }
  },
  {
    id: 'fast_learner',
    type: 'fast_learner',
    title: 'Speed Demon',
    description: 'Complete a course in under 7 days',
    icon: '⚡',
    criteria: { completionDays: 7 }
  },
  {
    id: 'bookworm',
    type: 'bookworm',
    title: 'Bookworm',
    description: 'Complete 5 courses',
    icon: '📚',
    criteria: { coursesCompleted: 5 }
  },
  {
    id: 'curious_mind',
    type: 'curious_mind',
    title: 'Curious Mind',
    description: 'Ask 50 questions to the AI assistant',
    icon: '💬',
    criteria: { aiQuestions: 50 }
  },
  {
    id: 'night_owl',
    type: 'night_owl',
    title: 'Night Owl',
    description: 'Complete 10 lessons after 10 PM',
    icon: '🦉',
    criteria: { lateNightLessons: 10 }
  },
  {
    id: 'early_bird',
    type: 'early_bird',
    title: 'Early Bird',
    description: 'Complete 10 lessons before 7 AM',
    icon: '🌅',
    criteria: { earlyMorningLessons: 10 }
  },
  {
    id: 'marathon',
    type: 'marathon',
    title: 'Marathon Learner',
    description: 'Study for 4+ hours in a single day',
    icon: '🏃',
    criteria: { singleDayHours: 4 }
  }
];
```

### Achievement Check Logic

**Backend function to check and award achievements:**

```typescript
// Edge function or API endpoint
async function checkAndAwardAchievements(userId: string) {
  const newAchievements: Achievement[] = [];

  // Get user's current stats
  const stats = await getUserStats(userId);

  // Check each achievement
  for (const def of ACHIEVEMENTS) {
    // Check if already earned
    const alreadyEarned = await hasAchievement(userId, def.type);
    if (alreadyEarned) continue;

    // Check if criteria met
    if (meetsAchievementCriteria(stats, def.criteria)) {
      const achievement = await awardAchievement(userId, def);
      newAchievements.push(achievement);
    }
  }

  return newAchievements;
}
```

**Trigger achievement checks:**
- After completing a lesson
- After enrolling in a course
- After completing a course
- After asking an AI question
- Daily cron job for streak checks
- After any significant user action

### Achievement Notification

**Component:** `AchievementToast.tsx`

**Display:**
- Animated toast/modal when achievement earned
- Show badge with shine effect
- Achievement name and description
- Confetti animation (optional)
- Share button

**Features:**
- Queue multiple achievements
- Auto-dismiss after 5 seconds
- Click to view all achievements
- Sound effect (optional, with mute option)

---

## PART 6: INTEGRATION & USER EXPERIENCE

### Navigation Updates

**Add new menu items:**

**For Students:**
- "My Learning" or "Dashboard" → Learner dashboard
- "Progress" under each course
- Badge counter in header (show new achievements)

**For Instructors:**
- "Analytics" tab in course management
- "Students" tab to view enrolled students
- Notification for at-risk students

### Real-time Updates

**Use Supabase Realtime for:**
- New student enrollments (instructor view)
- Course progress updates (refresh stats)
- New AI questions (instructor notifications)
- Achievement unlocks (show toast immediately)

```typescript
// Subscribe to course analytics updates
supabase
  .channel('course-analytics')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'course_enrollments',
    filter: `course_id=eq.${courseId}`
  }, (payload) => {
    // Refresh analytics
    refetchAnalytics();
  })
  .subscribe();
```

### Mobile Responsiveness

**Ensure all components work well on mobile:**
- Stack stats cards vertically
- Collapsible sections
- Simplified charts on small screens
- Touch-friendly interactions
- Responsive tables (horizontal scroll or card view)

### Loading States & Skeletons

**For all data-heavy components:**
- Skeleton loaders while fetching
- Progressive loading (show available data first)
- Retry buttons on errors
- Empty states with helpful messages

### Performance Optimization

**Strategies:**
- Lazy load analytics components
- Paginate large data sets
- Cache frequently accessed data
- Debounce real-time updates
- Use React.memo for expensive components
- Virtualize long lists (react-window)

---

## PART 7: TESTING & VALIDATION

### Test Scenarios

**Chat History:**
- [ ] Create new conversation
- [ ] Switch between conversations
- [ ] Delete conversation
- [ ] Search conversations
- [ ] Load more (pagination)
- [ ] Rename conversation
- [ ] Resume conversation after page reload

**Learner Dashboard:**
- [ ] View all enrolled courses
- [ ] See accurate progress percentages
- [ ] Track time spent correctly
- [ ] View and earn achievements
- [ ] See learning activity chart
- [ ] Continue from last lesson
- [ ] View course-specific progress

**Instructor Analytics:**
- [ ] View all course metrics
- [ ] Export reports
- [ ] See real-time enrollment updates
- [ ] Identify at-risk students
- [ ] View individual student progress
- [ ] Track lesson performance
- [ ] Monitor AI assistant usage

**Progress Tracking:**
- [ ] Auto-track lesson views
- [ ] Update time spent accurately
- [ ] Mark lessons complete
- [ ] Handle video progress
- [ ] Pause tracking on tab blur
- [ ] Resume tracking correctly

**Achievements:**
- [ ] Award achievements correctly
- [ ] Show achievement notifications
- [ ] Display in dashboard
- [ ] No duplicate awards
- [ ] Trigger on correct actions

---

## PART 8: SECURITY & PRIVACY

### Data Access Controls

**Ensure proper RLS:**
- Students can only see their own data
- Instructors can only see their course data
- No cross-tenant data leaks
- Validate permissions on every request

### Privacy Considerations

**For instructor analytics:**
- Anonymize student data if needed
- Respect privacy settings
- Allow students to opt out of detailed tracking
- Don't expose sensitive information
- GDPR compliance (data export, deletion)

### Rate Limiting

**Protect APIs:**
- Limit analytics queries per instructor
- Throttle progress updates
- Prevent abuse of chat history

---

## PART 9: DOCUMENTATION & HELP

### User Guides

**Create help docs for:**
- How to use learner dashboard
- Understanding progress metrics
- How achievements work
- Interpreting instructor analytics
- Using AI chat history

### Tooltips & Help Text

**Add throughout UI:**
- Explain metrics on hover
- Help icons next to complex charts
- Onboarding tour for first-time users
- Contextual help buttons

---

## SUCCESS CRITERIA

This implementation is complete when:

**Chat History:**
✅ Users can view all past conversations
✅ Conversations persist across sessions
✅ Can search and filter conversations
✅ Can delete unwanted conversations
✅ Performance is good with 100+ conversations

**Learner Dashboard:**
✅ Shows accurate progress for all courses
✅ Tracks time spent correctly
✅ Displays achievement system
✅ Shows meaningful learning analytics
✅ Mobile-responsive and fast
✅ Updates in real-time or near real-time

**Instructor Analytics:**
✅ Provides comprehensive course insights
✅ Identifies at-risk students
✅ Shows lesson performance metrics
✅ Tracks AI assistant usage
✅ Exports work correctly
✅ Real-time or near real-time updates
✅ Handles courses with 1000+ students

**Overall:**
✅ All database operations are efficient
✅ RLS policies prevent unauthorized access
✅ UI is polished and intuitive
✅ No performance issues with large datasets
✅ Proper error handling everywhere
✅ Mobile experience is excellent

---

## IMPLEMENTATION PRIORITY

**Phase 1 (Core Functionality):**
1. Chat history storage and retrieval
2. Basic learner dashboard
3. Progress tracking system
4. Basic instructor analytics

**Phase 2 (Enhanced Features):**
1. Achievement system
2. Detailed analytics charts
3. Export functionality
4. At-risk student detection

**Phase 3 (Polish):**
1. Real-time updates
2. Mobile optimization
3. Advanced filters and search
4. Help documentation

---

Please implement these features with production-ready code, comprehensive error handling, optimized database queries, and a polished user experience. Use Shadcn/ui components and Recharts for data visualization. Ensure all features are secure, performant, and accessible.

As this is a very big file you can split it into parts and implement one part at a time
