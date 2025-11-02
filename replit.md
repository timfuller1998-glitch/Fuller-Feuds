# Fuller Feuds Platform

## Overview
Fuller Feuds is a modern platform for facilitating meaningful 1v1 debates with no comments, no noise, and no crowd. Users submit opinions that change the summary, engage in structured debates, and see both sides or step in to change some minds. The platform features X-style (Twitter-like) public content browsing for SEO, topic-based debate matching, privacy controls, AI-generated cumulative opinions summarizing community perspectives, and clean 1v1 debate experiences that break echo chambers one fair fight at a time.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite
- **UI Framework**: Shadcn/ui built on Radix UI
- **Styling**: Tailwind CSS with custom design system based on Material Design 3 (supporting light, dark, and time-based themes)
- **State Management**: TanStack Query for server state
- **Routing**: Wouter
- **Form Handling**: React Hook Form with Zod validation
- **Component Architecture**: Atomic Design principles, utilizing a `CardContainer` component for consistent card sizing (280px mobile, 300px desktop).
- **Debate UI**: Messenger-style interface with draggable, minimizable popup windows, real-time messaging via WebSockets, and push notifications for offline users.

### Progressive Web App (PWA)
- **Mobile-First Design**: Optimized for mobile devices with installable app experience
- **Offline Support**: Service worker with offline caching for static assets and API responses
- **App Icons**: Multiple sizes (64x64, 192x192, 512x512) including maskable icons for adaptive display
- **Install Prompt**: Smart install prompt that appears when app is installable on supported browsers
- **Update Notifications**: Automatic detection and notification of app updates with one-click update
- **Push Notifications**: Web Push API integration for real-time debate notifications (preserved from original implementation)
- **Service Worker Features**:
  - Precaching of static assets (HTML, CSS, JS, fonts)
  - Runtime caching with Network First strategy for API calls
  - Cache First strategy for images and static assets
  - Automatic cache cleanup and version management
- **Installation Process**: 
  - Desktop: Click install button in browser address bar or via in-app prompt
  - Mobile: "Add to Home Screen" prompt appears automatically or via share menu
  - PWA displays as standalone app without browser UI chrome
- **Implementation**: Manual service worker setup (vite-plugin-pwa installed but not configured in vite.config.ts due to system restrictions)

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM
- **Authentication**: Replit Auth integration with session management
- **API Design**: RESTful endpoints with structured error handling
- **Core Data Models**: Users, Topics, Opinions, Debate Rooms, Live Streams, Cumulative Opinions.
- **Admin & Moderation**: Role-Based Access Control (user, moderator, admin), content status management, flagging system, and admin dashboard.

### X-Style Public Browsing & SEO
- **Public Content Access**: All pages (Home, Topics, Profiles, Recent Opinions) are viewable without authentication for maximum SEO exposure. The Home page serves as the landing page for both authenticated and unauthenticated users.
- **Login-Gated Interactions**: Interactive features (like, share opinion, debate, flag) require authentication with context-aware login prompts.
- **SEO Metadata**: Dynamic page titles, meta descriptions, Open Graph tags, and Twitter Cards for better search engine indexing and social sharing.
- **Guest Experience**: Unauthenticated users see a "Sign In" button in the header and are prompted to login when attempting any interaction.
- **Hidden Messenger UI**: DebateFooter and all messenger components are hidden for unauthenticated users.

### Debate Matching & Privacy System
- **Topic-Based Matching**: Automatically connects users with opposing viewpoints on specific topics.
- **Direct Debate Initiation**: "Change My Mind" button on opinions initiates debates with the author, validating opposing stances.
- **Privacy Controls**: Participants can set their debate side as "public" or "private".
- **Active Debates Visibility**: "My Active Debates" page lists all ongoing debates.

### 2D Political Compass System
- **AI-Powered Analysis**: Uses OpenAI GPT-5 to analyze users' last 50 opinions and position them on economic (-100 Capitalist to +100 Socialist) and authoritarian (-100 Libertarian to +100 Authoritarian) axes.
- **Automatic Updates**: Analysis runs every 5 opinions posted.
- **Visual Representation**: Color-coded avatar rings, interactive SVG political compass charts on profiles, and diversity score badges on topic cards using a 4-quadrant blending system (Red: Auth. Cap., Blue: Auth. Soc., Yellow: Lib. Cap., Green: Lib. Soc.). Colors fade to black for extreme positions.

### Gamification System
- **Badge System**: Awards users for participation (Debate, Opinion, Topic Creation) and quality (Logical Thinker).
- **Leaderboard System**: Ranks users across categories like "Most Opinionated Users" and "Most Active Debaters".

### Data Storage Solutions
- **Primary Database**: PostgreSQL via Neon Database
- **Session Storage**: PostgreSQL-based session store
- **Schema Management**: Drizzle migrations

### Authentication and Authorization
- **Provider**: Replit Auth (OpenID Connect)
- **Session Management**: Express sessions with PostgreSQL storage
- **Security**: HTTP-only cookies with CSRF protection
- **User Management**: Automatic user creation and profile management.

### AI Summary Auto-Generation
- **Automatic Updates**: AI summaries regenerate automatically after each new opinion, running asynchronously.
- **Smart Regeneration**: Updates only if new opinions exist since the last summary.
- **Frontend Polling**: UI polls for updates and shows loading states during generation.

### Topic Similarity Search
- **Semantic Embeddings**: Every topic has a 1536-dimension embedding vector generated using OpenAI's `text-embedding-3-small`.
- **Automatic Generation**: Embeddings are generated upon topic creation.
- **Search Endpoint**: Returns similar topics using cosine similarity with configurable thresholds for search bars (0.3), topic page recommendations (0.4), and duplicate detection (0.5).

## External Dependencies

### Database Services
- **Neon Database**: Serverless PostgreSQL hosting
- **Drizzle Kit**: Schema migration and database management

### Authentication Services
- **Replit Auth**: OpenID Connect authentication provider
- **Express Session**: Session management

### AI Services
- **OpenAI API**:
  - **GPT-4o-mini**: AI-generated cumulative opinion summaries.
  - **text-embedding-3-small**: Semantic embeddings for topic similarity search.
  - **GPT-5**: Political compass analysis and content moderation.

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