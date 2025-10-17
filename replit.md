# Kirk Debates Platform

## Overview
Kirk Debates is a modern platform designed to facilitate meaningful discussions on important topics. It combines traditional text-based debates with live streaming capabilities and AI-powered insights. Users can create and participate in debates, share opinions, and engage in real-time discussions across multiple formats. The platform features topic-based debate matching that automatically connects users with opposing viewpoints, privacy controls for debate participants, and AI-generated cumulative opinions that summarize community perspectives and track debate sentiment.

## Recent Changes

### Logical Fallacy Flagging System (October 17, 2025)
- **Comprehensive Flagging**: Users can now flag topics, opinions, and debate messages with specific logical fallacy types
- **11 Fallacy Types**: Ad Hominem, Straw Man, Misinformation, False Dilemma, Slippery Slope, Appeal to Authority, Hasty Generalization, Red Herring, Circular Reasoning, False Cause, Bandwagon
- **Visual Indicators**: Fallacy badges display next to flagged content with icons, counts, and educational tooltips
- **Database Schema**: Added topicFlags, opinionFlags (updated), and debateMessageFlags tables with fallacyType column
- **Reusable Components**: FallacyFlagDialog for flagging UI, FallacyBadges for display, shared across all content types
- **API Endpoints**: 
  - POST /api/topics/:id/flag - Flag a topic
  - POST /api/opinions/:id/flag - Flag an opinion
  - POST /api/debate-messages/:id/flag - Flag a debate message
- **Performance**: Batched SQL aggregation for efficient fallacy count calculation

### Search Bar Topic Creation (October 17, 2025)
- **Auto-Open Form**: Search bar now automatically opens topic creation form when no results are found
- **No Manual Trigger**: Removed "Create New Topic" button - form opens immediately after search completes
- **Smart Dismissal**: Cancel button properly dismisses the form; typing a different query re-enables auto-trigger
- **Race Condition Prevention**: Implemented pendingMutationQuery tracking to prevent stale mutations from showing outdated forms
- **Single API Call**: Refactored to ensure exactly one API call per unique search query
- **Z-Index & Sticky Header Fix**: 
  - Made header sticky with z-index 100000 to stay at top when scrolling
  - Set popup z-index to 999999 to stay above all scrolling content
  - Prevents topic cards from appearing above popup when scrolling on mobile

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

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM
- **Authentication**: Replit Auth integration with session management
- **API Design**: RESTful endpoints with structured error handling
- **Core Data Models**: Users, Topics, Opinions, Debate Rooms, Live Streams, Cumulative Opinions.
- **Admin & Moderation**: Role-Based Access Control (user, moderator, admin), content status management (opinions, challenges, topics), flagging system, and a comprehensive admin dashboard with audit trails.

### Debate Matching & Privacy System
- **Topic-Based Matching**: Automatic debate matching connects users with opposing viewpoints on specific topics
- **Auto-Match Flow**: Click "Start a Debate" → System finds random user with opposite opinion → Creates debate room → User navigated to chat
- **Manual Opponent Selection**: Users can choose specific opponents from list of available users with opposing views
- **Opponent Switching**: "End & Match New" button allows users to close current debate and match with new opponent (random or chosen)
- **Privacy Controls**: 
  - Each participant can independently set their side of debate as "public" or "private"
  - Private debates redact that user's messages from opponent's view and public profiles
  - Messages show as "[Message redacted]" when privacy is enabled
  - Privacy toggle available in debate room sidebar
- **Active Debates Visibility**:
  - "My Active Debates" page displays all ongoing debate rooms for the current user
  - Shows topic title, opponent details, stances, message count, and time since start
  - Real-time badge in sidebar shows count of active debates (updates every 10 seconds)
  - Enriched data includes full topic information and opponent profile details
- **Database Schema**: Debate rooms track `participant1Privacy` and `participant2Privacy` (values: 'public' or 'private')
- **API Endpoints**:
  - `POST /api/topics/:topicId/match-debate` - Auto-match with random opposing user
  - `GET /api/topics/:topicId/available-opponents` - List users with opposite opinions
  - `POST /api/debate-rooms/:roomId/switch-opponent` - Switch to new opponent
  - `PUT /api/debate-rooms/:roomId/privacy` - Update privacy setting
  - `GET /api/users/me/debate-rooms` - Get enriched list of user's active debate rooms

### Data Storage Solutions
- **Primary Database**: PostgreSQL via Neon Database
- **Session Storage**: PostgreSQL-based session store using `connect-pg-simple`
- **Schema Management**: Drizzle migrations
- **Connection Pooling**: Neon serverless connection pooling

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
- **OpenAI API**: GPT-based AI for cumulative opinion summaries and content analysis (e.g., category generation).

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