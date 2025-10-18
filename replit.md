# Kirk Debates Platform

## Overview
Kirk Debates is a modern platform designed to facilitate meaningful discussions on important topics. It combines traditional text-based debates with live streaming capabilities and AI-powered insights. Users can create and participate in debates, share opinions, and engage in real-time discussions across multiple formats. The platform features topic-based debate matching that automatically connects users with opposing viewpoints, privacy controls for debate participants, AI-generated cumulative opinions that summarize community perspectives and track debate sentiment, and support for attaching reference links to opinions to cite sources.

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
- **Topic-Based Matching**: Automatic debate matching connects users with opposing viewpoints on specific topics.
- **Direct Debate Initiation**: Users can click "Change My Mind" button on any opinion card to immediately start a debate with the opinion author. The system validates that users have opposite stances before creating the debate room.
- **Privacy Controls**: Each participant can independently set their side of debate as "public" or "private".
- **Active Debates Visibility**: "My Active Debates" page displays all ongoing debate rooms for the current user.

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
- **OpenAI API**: GPT-based AI for cumulative opinion summaries and content analysis.

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