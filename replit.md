# Opinion Feud Platform

## Overview
Opinion Feud is a modern platform designed to facilitate meaningful discussions on important topics. It combines traditional text-based debates with live streaming capabilities and AI-powered insights. Users can create and participate in debates, share opinions, and engage in real-time discussions across multiple formats. The platform features topic-based debate matching that automatically connects users with opposing viewpoints, privacy controls for debate participants, AI-generated cumulative opinions that summarize community perspectives and track debate sentiment, and support for attaching reference links to opinions to cite sources.

## Recent Changes
- **November 1, 2025**:
  - **Facebook Messenger-Style Debate System**: Implemented backend infrastructure for persistent debate footer, slide-up panels, and popup windows
  - **Notifications System**: Created notifications and push_subscriptions tables with full CRUD operations
  - **Read Receipts**: Added participant1LastReadAt, participant2LastReadAt, and lastMessageAt fields to debate_rooms for tracking message status
  - **Grouped Debates API**: New endpoint `/api/debates/grouped` returns debates grouped by opponent with recent/inactive sections (30-day threshold)
  - **Archived Debates**: Auto-archive system with manual archive endpoint and dedicated GET `/api/debates/archived` endpoint
  - **Auto-Archive Cron Job**: Scheduled job runs daily at 3:00 AM UTC to archive ended debates with no activity for 7+ days
  - **Push Notifications**: Full web-push integration with VAPID keys, service worker, and smart online/offline detection
  - **Enhanced WebSocket**: Global user tracking (onlineUsers map), authentication with session validation, broadcastToUser for targeted notifications
  - **Security**: WebSocket authentication requires valid session cookie, prevents impersonation attacks
  - **Notification Flow**: New debate messages trigger WebSocket notifications to online users and push notifications to offline users only

## Recent Changes
- **October 31, 2025**: 
  - **Recommendation Fallback System**: Enhanced `/api/users/:userId/recommended-topics` endpoint with trending topic fallback. When category-based recommendations return fewer than 5 results, system adds trending topics created in the last 30 days (scored by opinionCount × 10 + participantCount × 5 + 20 bonus if < 7 days old, with creation date as tiebreaker). Fallback includes topics user has participated in, allowing re-engagement with updated AI summaries.
  - **Profile Section Reordering**: Reorganized profile page sections for better discovery flow: (1) Recommended for You, (2) My Topics, (3) From People You Follow (mixed topics & opinions), (4) Active Debates, (5) My Opinions.
  - **Mixed Following Feed**: "From People You Follow" section now displays both topics created AND opinions posted by followed users, sorted by timestamp (most recent first). Provides comprehensive view of followed users' activity.
  - **Political Diversity Score System**: Implemented Shannon entropy-based diversity scoring (0-100%) across 4 political quadrants for all topics. Backend `getPoliticalDiversityScore()` and `calculatePoliticalDiversityScore()` methods calculate diversity from opinion political distributions.
  - **Diversity Badges**: Added purple diversity score badges to top-right corner of all topic cards site-wide (Home, Categories, Hot Debates, Search, Topic pages). Shows percentage even for 0% diversity (all opinions in one quadrant).
  - **Hot Debates Redesign**: Replaced for/against/neutral metrics with 4-quadrant political distribution bars (Red=Auth. Cap., Blue=Auth. Soc., Yellow=Lib. Cap., Green=Lib. Soc.) matching political compass colors.
  - **Performance Optimization**: Eliminated N+1 query problem by passing `politicalDistribution` as prop to TopicCard instead of individual API fetches. Backend `enrichTopicWithPreview()` includes distribution data in all topic responses.
  - **GPT-5 Analysis Fix**: Fixed admin backfill tool GPT-5 analysis failure. GPT-5 has two API limitations: (1) only supports default temperature (1) unlike GPT-4 which supports custom values (0.3), and (2) doesn't support `response_format` parameter for JSON output. Backend now conditionally omits both parameters for GPT-5 requests and includes robust JSON extraction to handle GPT-5's freeform responses.
  - Created CardContainer wrapper component for unified card sizing (280px mobile, 300px desktop) across entire site
  - Replaced all manual card wrappers with CardContainer in Home, Topic, AllCategoriesPage, and RecentOpinions pages
  - Updated backend storage layer with enrichTopicWithPreview helper for consistent preview data
  - Swapped yellow and green positions on political compass for cleaner color blending. Yellow now represents Libertarian Capitalist (bottom-right), Green represents Libertarian Socialist (bottom-left). This prevents muddy brown colors from red-green mixing and creates cleaner transitions (red↔yellow=orange, blue↔green=cyan).
- **October 24, 2025**: Removed user-created theme personalization system. Platform now uses uniform design with basic light/dark/medium theme preferences. Removed `themes` and `themeLikes` database tables, theme-related backend routes, and frontend theme creation/management UI. Focus shifted to political gradient system for topic cards.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite
- **UI Framework**: Shadcn/ui built on Radix UI
- **Styling**: Tailwind CSS with custom design system based on Material Design 3
- **State Management**: TanStack Query for server state
- **Routing**: Wouter
- **Form Handling**: React Hook Form with Zod validation
- **Design System**: Material Design 3 principles with Discord-inspired patterns, supporting light, dark, and time-based themes. Inter font family, HSL-based color tokens, and Tailwind spacing units.
- **Component Architecture**: Atomic Design principles, with feature-specific and layout components.
- **Card Sizing Standard**: CardContainer component (`client/src/components/CardContainer.tsx`) ensures consistent card dimensions (280px mobile, 300px desktop) across all horizontal scrolling sections site-wide.

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM
- **Authentication**: Replit Auth integration with session management
- **API Design**: RESTful endpoints with structured error handling
- **Core Data Models**: Users, Topics, Opinions, Debate Rooms, Live Streams, Cumulative Opinions.
- **Admin & Moderation**: Role-Based Access Control (user, moderator, admin), content status management (opinions, challenges, topics), flagging system, and a comprehensive admin dashboard with audit trails.

### Debate Matching & Privacy System
- **Topic-Based Matching**: Automatic debate matching connects users with opposing viewpoints on specific topics.
- **Direct Debate Initiation**: Users can click "Change My Mind" button on any opinion card to immediately start a debate with the opinion author. The system validates that users have opposite stances before creating the debate room.
- **Privacy Controls**: Each participant can independently set their side of debate as "public" or "private".
- **Active Debates Visibility**: "My Active Debates" page displays all ongoing debate rooms for the current user.

### 2D Political Compass System
- **AI-Powered Analysis**: Uses OpenAI GPT-5 to analyze users' last 50 opinions and calculate political positioning on two independent axes
- **Economic Axis**: Ranges from -100 (capitalist) to +100 (socialist), measuring economic policy preferences
- **Authoritarian Axis**: Ranges from -100 (libertarian) to +100 (authoritarian), measuring views on government authority
- **Automatic Updates**: Analysis runs in background every 5 opinions posted, incrementing opinionCount and updating scores asynchronously
- **Profile Management**: User profiles are created automatically using UPSERT pattern to ensure opinion counts stay synchronized with actual opinion records
- **Visual Representation**: 
  - **Avatar Rings**: Color-coded rings around user avatars using 4-quadrant blending system
  - **Political Compass Chart**: Interactive SVG visualization showing user position on 2D compass with quadrant gradients
  - **Profile Popover**: Hoverable chart on profile page confidence metric displays full compass visualization
- **Color Scheme**:
  - **Red** (H=0): Authoritarian Capitalist (economic < 0, authoritarian > 0)
  - **Blue** (H=220): Authoritarian Socialist (economic > 0, authoritarian > 0)
  - **Yellow** (H=50): Libertarian Capitalist (economic < 0, authoritarian < 0)
  - **Green** (H=140): Libertarian Socialist (economic > 0, authoritarian < 0)
  - **Blending**: Colors blend smoothly with minimal white only at center (±15% radius). Clean edge blending: red↔blue (purple), yellow↔green (lime), red↔yellow (orange), blue↔green (cyan)
  - **Extremist Fade**: At ±85 on either axis, colors fade to black (up to 70% darker) to indicate extreme positions
- **Data Flow**: Backend analysis → user_profiles.economicScore/authoritarianScore → API responses → Frontend avatar rings and charts
- **Opinion Count Tracking**: 
  - **Dual-Field System**: Maintains two synchronized fields: `opinionCount` (triggers AI analysis every 5 opinions) and `totalOpinions` (displayed on frontend)
  - **Automatic Counting**: Both fields incremented on creation (UPSERT), both counted from database on deletion
  - **Data Integrity**: deleteOpinionAdmin counts actual remaining opinions within transaction to ensure accuracy of both fields
  - **Sync Utility**: syncOpinionCounts() recalculates and syncs both fields to actual counts, fixes orphaned profiles with stale counts
  - **Admin Endpoint**: POST /api/admin/sync-opinion-counts (requires admin auth) for manual synchronization of both fields

### Gamification System
- **Badge System**: Awards users for participation (Debate Participation, Opinion Sharing, Topic Creation) and quality (Logical Thinker). Badges are automatically awarded and can be displayed on user avatars.
- **Leaderboard System**: Ranks users across categories such as "Most Opinionated Users", "Most Active Debaters", "Top Topic Creators", and "Logical Reasoning Champions".

### Data Storage Solutions
- **Primary Database**: PostgreSQL via Neon Database
- **Session Storage**: PostgreSQL-based session store
- **Schema Management**: Drizzle migrations

### Authentication and Authorization
- **Provider**: Replit Auth using OpenID Connect
- **Session Management**: Express sessions with PostgreSQL storage
- **Security**: HTTP-only cookies with CSRF protection
- **User Management**: Automatic user creation and profile management

## External Dependencies

### Database Services
- **Neon Database**: Serverless PostgreSQL hosting
- **Drizzle Kit**: Schema migration and database management

### Authentication Services
- **Replit Auth**: OpenID Connect authentication provider
- **Express Session**: Session management

### AI Services
- **OpenAI API**: 
  - **GPT-4o-mini**: AI-generated cumulative opinion summaries with automatic background generation
  - **text-embedding-3-small**: Semantic embeddings for topic similarity search (1536 dimensions)
  - **GPT-5**: Political compass analysis and content moderation

### Topic Similarity Search
- **Semantic Embeddings**: Every topic has a 1536-dimension embedding vector generated using OpenAI's text-embedding-3-small model
- **Automatic Generation**: Embeddings automatically generated on topic creation
- **Admin Backfill**: POST /api/admin/backfill-embeddings endpoint to generate embeddings for existing topics (accessible via button in Admin Dashboard Topics tab)
- **Search Endpoint**: GET /api/topics/search-similar?query=...&threshold=... returns top similar topics using cosine similarity
- **Similarity Thresholds**:
  - **SearchBar Dropdown**: 0.3 (very broad for showing semantically related topics while typing)
  - **Topic Page "Similar Topics"**: 0.4 (broad recommendations for discovering related content)
  - **Duplicate Detection**: 0.5 (fairly broad to catch topics like "climate crisis" and "global warming effects")
- **SearchBar Integration**: 
  - Dropdown uses semantic search to show related topics (not just exact text matches)
  - "Create New Topic" button always visible when typing 2+ characters
  - Clicking "Create New Topic" triggers duplicate detection modal if similar topics exist
  - Users can navigate to existing topics or proceed with "Create New Topic Anyway" button
- **Cost Optimization**: Embeddings trimmed from API responses to reduce bandwidth

### AI Summary Auto-Generation
- **Automatic Updates**: AI summaries automatically regenerate after each new opinion is posted
- **Non-Blocking**: Summary generation runs asynchronously without delaying opinion creation
- **Smart Regeneration**: Only updates summary if new opinions exist since last summary timestamp
- **Frontend Polling**: UI polls for updates every 3 seconds (max 45 seconds) to detect completed summaries
- **Loading States**: Shows skeleton loading animation and "Updating..." indicator during generation
- **No Manual Buttons**: Manual Generate/Refresh buttons removed - everything is automatic

### UI and Design Libraries
- **Radix UI**: Accessible component primitives
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library
- **Class Variance Authority**: Type-safe component variant management

### Development Tools
- **Vite**: Build tool
- **TypeScript**: Type safety
- **TanStack Query**: Server state management
- **React Hook Form**: Form handling
- **Zod**: Runtime type validation

### Production Services
- **Google Fonts**: Font delivery