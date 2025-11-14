Product Requirements Document (PRD)
 Viora - Free AI-Powered Learning Platform
Document Information
Version: 1.0
Last Updated: November 7, 2025
Product Owner: [Your Name]
Status: MVP Complete
1. Executive Summary
Viora is a free, open-access platform where instructors create video-based courses and students enroll at no cost. The MVP delivers secure authentication, role-based dashboards, simple course creation and management, video uploads, knowledge base document support, and one-click student enrollment. Teachers can set a visible course price for context, but enrollment remains free. The platform prioritizes accessibility, simplicity, and scalability using React, Vite, Tailwind, and Supabase. Success is measured by growth in courses and enrollments, completion rates, instructor satisfaction, and reliable performance.
1.1 Product Vision
Viora is a free, open-access online learning platform that enables instructors to create and share educational courses with students worldwide. The platform eliminates financial barriers to education by providing completely free course enrollment while empowering educators to share knowledge through video-based content and AI-powered assistance.

1.2 Product Goals
Democratize access to quality education by making all courses free
Provide instructors with simple tools to create and manage video courses
Enable AI-powered learning assistance through knowledge base documents
Build a scalable platform that supports multiple concurrent users
Create an intuitive user experience for both instructors and students
1.3 Success Metrics
Number of active courses created
Student enrollment rate
Course completion rate
Instructor satisfaction score
Platform uptime and performance
Knowledge base document upload rate
2. Product Overview
2.1 Target Users
Primary User Personas:

Instructors/Teachers

Educators wanting to share knowledge
Subject matter experts
Content creators
Age: 25-60
Technical proficiency: Basic to intermediate
Students/Learners

Self-learners seeking free education
Students supplementing formal education
Career changers and skill developers
Age: 16-65
Technical proficiency: Basic
2.2 Key Differentiators
100% Free: No payment required for any course
AI-Powered Assistance: Knowledge base documents power intelligent chatbot (planned)
Simple Course Creation: Minimal technical barriers for instructors
Video-First Learning: Focus on video content delivery
Open Access: No approval process required to create courses
3. Core Features & Requirements
3.1 User Authentication & Profile Management
Feature Description: Secure user authentication system with role-based access control.

User Stories:

As a new user, I want to sign up with my email so that I can access the platform
As a returning user, I want to log in securely so that I can access my dashboard
As a user, I want to select my role (instructor/student) during signup so that I get the appropriate experience
As a user, I want to update my profile information so that my account reflects current details
Technical Requirements:

Email/password authentication via Supabase Auth
Auto-confirm email signups (enabled for faster testing)
User roles stored in user_roles table (student/instructor)
User profiles stored in profiles table
Session persistence across page refreshes
Secure password handling and validation
Database Schema:


-- profiles table
- id (UUID, FK to auth.users)
- email (text)
- full_name (text, nullable)
- avatar_url (text, nullable)
- created_at (timestamp)
- updated_at (timestamp)

-- user_roles table
- id (UUID)
- user_id (UUID, FK to auth.users)
- role (enum: 'student' | 'instructor')
RLS Policies:

Users can view all profiles
Users can update only their own profile
Users can insert their own role during signup
Users can view all roles
3.2 Course Management (Instructor Features)
3.2.1 Course Creation
Feature Description: Instructors can create courses with title, description, and thumbnail.

User Stories:

As an instructor, I want to create a new course so that I can start adding content
As an instructor, I want to provide a title and description so that students understand what the course offers
As an instructor, I want to see all my created courses so that I can manage them
Technical Requirements:

Course creation dialog with form validation
Required fields: title, description
Optional fields: thumbnail_url
Automatic assignment of instructor_id from authenticated user
Courses ordered by creation date (newest first)
Database Schema:


-- courses table
- id (UUID)
- instructor_id (UUID, FK to auth.users)
- title (text)
- description (text, nullable)
- thumbnail_url (text, nullable)
- created_at (timestamp)
- updated_at (timestamp)
RLS Policies:

Anyone can view all courses (public access)
Only instructors can create courses
Instructors can update only their own courses
Instructors can delete only their own courses
3.2.2 Course Editing
Feature Description: Instructors can edit course title and description after creation.

User Stories:

As an instructor, I want to edit my course title so that I can improve clarity
As an instructor, I want to update the course description so that I can add new information
As an instructor, I want to see my changes reflected immediately
Technical Requirements:

Edit course dialog accessible from course management page
Pre-populated form with current course data
Real-time validation
Automatic update of updated_at timestamp
UI Components:

EditCourseDialog component
Pencil icon button in course header
Success/error toast notifications
3.2.3 Video Management
Feature Description: Instructors can upload, order, and delete video content for their courses.

User Stories:

As an instructor, I want to add videos to my course so that students can learn
As an instructor, I want to provide titles and descriptions for each video
As an instructor, I want to order videos sequentially so that learning follows a path
As an instructor, I want to delete videos that are no longer relevant
Technical Requirements:

Video file upload to Supabase Storage bucket course-videos
Support for common video formats (MP4, WEBM, etc.)
Video metadata storage (title, description, order_index)
Automatic ordering with manual override capability
Video deletion removes both database record and storage file
Database Schema:


-- videos table
- id (UUID)
- course_id (UUID, FK to courses)
- title (text)
- description (text, nullable)
- video_url (text)
- duration (integer, nullable)
- order_index (integer, default 0)
- created_at (timestamp)
Storage:

Bucket: course-videos
Path: {course_id}/{video_id}/{filename}
Public access for enrolled students
RLS Policies:

Instructors can manage all video operations for their own courses
Enrolled students can view videos
Course instructors can view videos
3.2.4 Knowledge Base Document Upload
Feature Description: Instructors can upload a single document (PDF, DOCX, TXT) to power AI assistance for the course.

User Stories:

As an instructor, I want to upload a knowledge base document so that students can get AI-powered help
As an instructor, I want to replace the knowledge base document so that I can update course materials
As an instructor, I want to see the current document details so that I know what's uploaded
As an instructor, I want to delete the knowledge base document if it's no longer needed
Technical Requirements:

File Type Validation:

Allowed: PDF (.pdf), Word (.doc, .docx), Plain text (.txt)
Display clear error for unsupported formats
File Size Validation:

Maximum: 10MB
Display file size in human-readable format
Upload Features:

Drag-and-drop zone with visual feedback
Alternative "Browse Files" button
Upload progress indicator
Success/error notifications
File Management:

One document per course (auto-replace on new upload)
Delete functionality with confirmation
Display current file metadata (name, size, upload date)
Clean up old files from storage on replace/delete
Database Schema:


-- course_knowledge_base table
- id (UUID)
- course_id (UUID, FK to courses)
- file_name (text)
- file_url (text)
- file_type (text)
- file_size (bigint)
- uploaded_at (timestamp)
- processed (boolean, default false)
Storage:

Bucket: course-knowledge-bases
Path: {course_id}/{file_name}
Private access (instructor only)
RLS Policies:

Instructors can upload knowledge base for their own courses
Instructors can view their own course knowledge bases
Instructors can update their own knowledge bases
Instructors can delete their own knowledge bases
UI Components:

CourseKnowledgeBase component
File upload dropzone with file type icons
Progress bar during upload
File information card when document exists
Replace/Delete action buttons
3.3 Course Discovery & Enrollment (Student Features)
3.3.1 Course Browsing
Feature Description: Students can browse all available courses and view detailed information.

User Stories:

As a student, I want to see all available courses so that I can find interesting topics
As a student, I want to see course details (title, description, instructor) so that I can make informed decisions
As a student, I want to see which courses I'm already enrolled in so that I don't enroll twice
Technical Requirements:

Display all courses with thumbnails, titles, and descriptions
Show instructor name for each course
Visual indication of enrollment status
Filter between "All Courses" and "My Enrollments"
Responsive grid layout (mobile to desktop)
UI Components:

StudentDashboard component
CourseCard component
Tab navigation for filtering
3.3.2 Course Enrollment
Feature Description: Students can enroll in any course with a single click, completely free.

User Stories:

As a student, I want to enroll in a course so that I can access the content
As a student, I want instant enrollment without payment so that I can start learning immediately
As a student, I want confirmation of my enrollment so that I know it succeeded
Technical Requirements:

One-click enrollment (no payment required)
Prevent duplicate enrollments
Automatic enrollment record creation
Enrollment timestamp tracking
Success toast notification
Database Schema:


-- enrollments table
- id (UUID)
- student_id (UUID, FK to auth.users)
- course_id (UUID, FK to courses)
- enrolled_at (timestamp)
RLS Policies:

Students can enroll in any course
Students can view their own enrollments
Instructors can view enrollments for their courses
No updates or deletions allowed
3.3.3 Video Learning
Feature Description: Enrolled students can watch course videos in a structured player interface.

User Stories:

As a student, I want to watch course videos so that I can learn
As a student, I want to see the course content list so that I know what's available
As a student, I want to switch between videos easily so that I can navigate the course
As a student, I want to see video descriptions so that I understand what each video covers
Technical Requirements:

Video player with native controls (play, pause, seek, volume, fullscreen)
Course content sidebar with all videos
Visual indication of currently playing video
Video metadata display (title, description)
Responsive layout (sidebar below on mobile)
Enrollment verification (redirect if not enrolled)
UI Components:

CoursePage component
Video player area with embedded HTML5 video
Course content sidebar
Video selection buttons
3.4 Dashboard & Navigation
3.4.1 Instructor Dashboard
Feature Description: Central hub for instructors to manage all their courses.

User Stories:

As an instructor, I want to see all my courses in one place
As an instructor, I want quick access to course management
As an instructor, I want to create new courses from the dashboard
As an instructor, I want to sign out securely
Technical Requirements:

Display all instructor's courses in grid layout
Show course thumbnails, titles, descriptions
"Create Course" button prominently displayed
Course click navigates to management page
Sign out functionality
Welcome message with instructor name
UI Components:

InstructorDashboard component
Course grid with cards
Create course button
Header with sign out
3.4.2 Student Dashboard
Feature Description: Central hub for students to browse courses and access enrolled content.

User Stories:

As a student, I want to see all available courses
As a student, I want to quickly access my enrolled courses
As a student, I want to enroll in new courses from the dashboard
As a student, I want to sign out securely
Technical Requirements:

Tab navigation: "All Courses" and "My Enrollments"
Course grid with enrollment status
Enroll/Continue Learning buttons
Instructor name display
Sign out functionality
Welcome message with student name
UI Components:

StudentDashboard component
Tabs for filtering
Course cards with conditional actions
Header with sign out
3.4.3 Course Management Page
Feature Description: Detailed course management interface for instructors.

User Stories:

As an instructor, I want to see all course details in one place
As an instructor, I want to edit course information easily
As an instructor, I want to manage videos and knowledge base from one page
As an instructor, I want to return to my dashboard easily
Technical Requirements:

Display course title and description
Edit course button (pencil icon)
Knowledge base upload section
Video list with order indicators
Add video button
Delete video functionality
Back to dashboard navigation
UI Components:

ManageCoursePage component
EditCourseDialog
CourseKnowledgeBase component
AddVideoDialog component
Video cards with controls
4. Technical Architecture
4.1 Technology Stack
Frontend:

Framework: React 18.3.1
Build Tool: Vite
Language: TypeScript
Styling: Tailwind CSS
UI Components: Shadcn/ui (Radix UI primitives)
Routing: React Router DOM 6.30.1
State Management: React hooks + Tanstack Query
Forms: React Hook Form + Zod validation
Icons: Lucide React
Backend (Lovable Cloud):

Database: Supabase PostgreSQL
Authentication: Supabase Auth
Storage: Supabase Storage
Edge Functions: Supabase Edge Functions (Deno runtime)
Real-time: Supabase Realtime (available, not yet implemented)
4.2 Database Schema Summary
Tables:

profiles - User profile information
user_roles - User role assignments (student/instructor)
courses - Course metadata
videos - Video content for courses
enrollments - Student course enrollments
course_knowledge_base - Knowledge base documents
Key Relationships:

profiles.id → auth.users.id (1:1)
courses.instructor_id → auth.users.id (1:many)
videos.course_id → courses.id (many:1)
enrollments.student_id → auth.users.id (many:1)
enrollments.course_id → courses.id (many:1)
course_knowledge_base.course_id → courses.id (1:1)
4.3 Security Model
Row Level Security (RLS): All tables have RLS enabled with specific policies:

Principle of Least Privilege: Users can only access data they own or are authorized to view
Public Course Discovery: Anyone can view course listings
Enrollment Verification: Only enrolled students can access course videos
Instructor Ownership: Instructors can only manage their own courses
Profile Privacy: Users control their own profile data
Authentication:

Email/password authentication
Session persistence in localStorage
Auto-confirm email (configurable)
Secure password hashing (handled by Supabase)
File Storage Security:

course-videos: Public access for enrolled students
course-knowledge-bases: Private access, instructor only
File type validation on upload
File size limits enforced
4.4 Application Routes
/ - Landing page (Index)
/auth - Authentication (sign up/sign in)
/dashboard - Role-based dashboard (instructor/student)
/course/:courseId - Course viewing page (students)
/course/:courseId/manage - Course management page (instructors)
5. User Flows
5.1 Instructor User Flow
1. Sign Up → Select "Instructor" role → Dashboard
2. Click "Create Course" → Fill form → Submit
3. Navigate to course management
4. Upload knowledge base document
5. Add videos one by one
6. Edit course details as needed
7. Students can now enroll and view content
5.2 Student User Flow
1. Sign Up → Select "Student" role → Dashboard
2. Browse available courses
3. Click "Enroll" on desired course
4. Navigate to course page
5. Watch videos sequentially
6. Return to dashboard to find more courses
6. Future Enhancements (Roadmap)
6.1 Phase 2 Features (Planned)
AI-Powered Chat Assistant:

Process uploaded knowledge base documents
Text extraction from PDFs, DOCX, TXT
Vector embeddings for semantic search
Chatbot interface for students
Context-aware responses based on course content
Integration with Lovable AI supported models
Course Progress Tracking:

Video completion tracking
Progress percentage per course
Resume from last watched position
Completion certificates
Enhanced Video Features:

Video duration capture and display
Playback speed controls
Quality settings
Subtitles/captions support
Thumbnail generation
6.2 Phase 3 Features (Consideration)
Social Features:

Course ratings and reviews
Student comments on videos
Discussion forums per course
Instructor Q&A sections
Advanced Course Management:

Course categories and tags
Course prerequisites
Course difficulty levels
Multi-section courses with modules
Quiz and assessment creation
Analytics Dashboard:

Instructor analytics (enrollments, completion rates)
Student learning analytics
Popular courses tracking
Engagement metrics
Platform Enhancements:

Search functionality
Course recommendations
Email notifications
Mobile app (React Native)
Course export/import
Bulk video upload
7. Constraints & Assumptions
7.1 Technical Constraints
Video Hosting: Relies on Supabase Storage (costs scale with usage)
File Size Limits: Knowledge base documents limited to 10MB
Browser Compatibility: Modern browsers only (Chrome, Firefox, Safari, Edge)
Video Format: Native HTML5 video support required
No Offline Mode: Requires internet connection
7.2 Business Constraints
Free Platform: No revenue model currently implemented
No Content Moderation: Instructors self-regulate content
No Instructor Verification: Anyone can become an instructor
No Course Approval: Courses go live immediately
7.3 Assumptions
Users have reliable internet connections for video streaming
Instructors have video content prepared in compatible formats
Students are comfortable with self-paced learning
Users have basic computer/mobile literacy
Knowledge base documents are text-based (for future AI processing)
8. Success Criteria
8.1 MVP Success Metrics
Functional Requirements:

✅ Users can sign up and sign in
✅ Instructors can create courses
✅ Instructors can upload videos
✅ Instructors can upload knowledge base documents
✅ Students can enroll in courses
✅ Students can watch course videos
✅ All features work without payment
Non-Functional Requirements:

Page load time < 3 seconds
Video playback starts within 5 seconds
Platform supports 100+ concurrent users
99% uptime
Mobile-responsive design
8.2 User Acceptance Criteria
For Instructors:

Can create a course in < 2 minutes
Can upload videos without technical knowledge
Can edit course information easily
Clear feedback on all actions
For Students:

Can find and enroll in courses quickly
Video player is intuitive
Course content is easy to navigate
Can track which courses they're enrolled in
9. Open Questions & Risks
9.1 Open Questions
Content Moderation: How will inappropriate content be handled?
Storage Costs: What happens when storage exceeds free tier limits?
Instructor Incentives: Why would instructors use this over paid platforms?
Quality Control: How to ensure course quality?
Scalability: At what user count do we need infrastructure changes?
9.2 Risks & Mitigation
Risk	Impact	Mitigation
Storage costs exceed budget	High	Monitor usage, implement limits, consider CDN
Low-quality course content	Medium	Add rating system, featured courses
Copyright violations	High	Terms of service, DMCA process, content reporting
Platform abuse (spam)	Medium	Rate limiting, user reporting, moderation tools
Poor video streaming performance	High	Optimize storage bucket, consider video CDN
10. Appendices
10.1 Glossary
RLS: Row Level Security - Database-level access control
UUID: Universally Unique Identifier
Storage Bucket: Container for files in Supabase Storage
Knowledge Base: Reference document for AI assistance
Enrollment: Student's registration in a course
Order Index: Numeric value determining video sequence
10.2 References
Lovable Documentation
Supabase Documentation
React Documentation
Shadcn/ui Components
Document End

This PRD represents the current state of Viora as an MVP. It should be treated as a living document and updated as features are added or requirements change.

<lov-actions> <lov-suggestion message="Implement the AI chatbot feature using the uploaded knowledge base documents. Process PDFs/DOCX to extract text, store embeddings, and create a chat interface for students to ask questions about course content using Lovable AI.">Add AI Course Assistant</lov-suggestion> <lov-suggestion message="Add course progress tracking for students. Track video completion status, calculate progress percentage, show resume points, and issue completion certificates when students finish all videos.">Add Progress Tracking</lov-suggestion> <lov-suggestion message="Implement a rating and review system for courses. Allow students to rate courses (1-5 stars), write reviews, and display average ratings on course cards to help other students choose courses.">Add Course Ratings & Reviews</lov-suggestion> <lov-suggestion message="Create a search and filter system for courses. Add search bar, filter by category/difficulty/instructor, sort by newest/popular/rating, and implement full-text search across course titles and descriptions.">Add Course Search & Filters</lov-suggestion> <lov-suggestion message="Build an instructor analytics dashboard showing enrollment metrics, video view counts, student progress statistics, popular courses, and engagement trends with charts and visualizations.">Add Analytics Dashboard</lov-suggestion>