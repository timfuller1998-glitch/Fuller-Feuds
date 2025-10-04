# Kirk Debates Platform

## Overview

Kirk Debates is a modern debate platform designed to facilitate meaningful discussions on important topics. The platform combines traditional text-based debates with live streaming capabilities and AI-powered insights. Users can create and participate in debates, share opinions, and engage in real-time discussions across multiple formats including text debates, live streams, and structured debate rooms.

The application serves as a comprehensive discussion platform where ideas can "collide" in a constructive environment, featuring AI-generated cumulative opinions that summarize community perspectives and track debate sentiment over time.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### Sidebar Navigation Cleanup (October 2025)
- **Logo as Home Button**: Kirk Debates logo in sidebar header now links to home page
  - Removed redundant "Home" link from navigation list
  - Logo has hover and active states for better interactivity
- **Profile in Footer**: User avatar and name in sidebar footer now link to profile page
  - Removed redundant "My Profile" link from navigation list
  - Footer profile area has hover and active states
- **Cleaner Navigation**: Removed duplicate navigation items for streamlined UX

### Profile Page Redesign & Mobile Optimization (October 2025)
- **Clickable Stats Navigation**: Removed tab buttons - stats (Opinions, Debates, Followers, Following) are now clickable and control content display
  - Replaced "Likes" stat with "Debates" count showing user's debate room participation
  - Active section highlighted with subtle background color (bg-primary/10)
  - Mobile layout: 2-column grid for stats on small screens, horizontal row on desktop
- **Political Leaning Display**: Redesigned as colored ring around profile avatar
  - Colored border (4px) based on political leaning score
  - Colors: Blue (progressive), Purple (moderate), Red (conservative)
  - Political position and confidence displayed as text under user's name
  - Format: "{position} • {confidence} confidence" (e.g., "Progressive • high confidence")
  - Removed slider and badge designs in favor of cleaner visual approach
- **Mobile Layout Optimization**: Profile header fully responsive
  - Header stacks vertically on mobile, horizontal on desktop
  - Avatar: 80px mobile, 96px desktop
  - Text sizes scale appropriately across breakpoints
  - Email truncates with ellipsis to prevent overflow
  - All content fits properly within mobile viewport
- **Auto-Updating Political Analysis**: Political leaning updates automatically when users add opinions
  - Removed manual "Update Analysis" button
  - Analysis runs asynchronously after opinion creation without blocking response
  - Ensures political leaning stays current with user's latest opinions
- **Backend Updates**:
  - New endpoint: GET /api/profile/:userId/debate-rooms (fetches user's debate room participation)
  - Storage method: getUserDebateRooms() using OR condition for participant matching
  - Auto-analysis trigger in opinion creation endpoint

### Opinion Voting & Challenge System (October 2025)
- **Like/Dislike Voting**: Users can vote on opinions with thumbs up/down
  - Vote toggle: clicking same vote type removes it (sends null to backend)
  - Vote switch: clicking different type changes the vote
  - Backend: POST /api/opinions/:opinionId/vote with {voteType: 'like'|'dislike'|null}
  - Database: uniqueIndex on (opinionId, userId) ensures one vote per user
  - Real-time updates via React Query cache invalidation
- **Challenge System**: Users can add context when opinions misrepresent data
  - Challenge button opens dialog with context textarea
  - Challenges displayed in collapsible section under opinions
  - Shows challenge author, timestamp, and context text
  - Backend: POST /api/opinions/:opinionId/challenge with {context: string}
- **User Vote State**: GET /api/topics/:topicId/opinions includes userVote when authenticated
  - Frontend receives current user's vote state with each opinion
  - OpinionCard uses props directly (no local state) for perfect server sync
- **Implemented Everywhere**: Voting and challenges now work on both Home page and Topic detail pages
  - Topic page now uses OpinionCard component for consistent UX
  - All opinion displays have like/dislike/challenge functionality
  - Future: Batch getUserVoteOnOpinion queries for better performance

### UX Improvements - Inline Topic Creation & Toast Removal (October 2025)
- **Inline Topic Creation**: Completely redesigned topic creation experience
  - Removed modal dialog popup that grayed out the screen
  - Topic creation form now appears seamlessly inline within the search bar dropdown
  - When no search results are found, users can expand the form directly in the dropdown
  - Form includes title, description, and category management with real-time validation
  - Auto-fills title field with search query for faster topic creation
  - Users navigate directly to new topic page upon successful creation
- **Auto-Generated Categories**: AI-powered category suggestions for new topics
  - When creating a topic, 3 relevant categories are automatically generated using OpenAI GPT-4o-mini
  - Categories are pre-selected in the creation form for convenience
  - Users can still remove or add additional categories (up to 5 total)
  - Fallback to generic categories if AI generation fails
  - Backend endpoint: POST /api/topics/generate-categories
- **Toast Notifications Removed**: Eliminated all toast notifications throughout the application
  - Replaced with silent success and instant UI updates
  - Actions now provide feedback through navigation and visual state changes
  - Improved UX by removing disruptive popup messages
  - Error handling now uses console logging for debugging without user-facing toasts

### Category System Enhancements (October 2025)
- **Dynamic Categories in Sidebar**: Sidebar categories are now fully dynamic
  - Shows all categories from database (not hardcoded preset list)
  - Categories sorted by popularity with accurate topic counts
  - Smart icon mapping for common categories
- **Dynamic All Categories Page with Sorting**: Complete redesign of All Categories page
  - Shows all categories dynamically from database
  - 4 sorting options: Most Popular, Alphabetical, Most Recent, Oldest First
  - Compact mobile layout: smaller spacing, icons, and text
  - Shows 5 topic cards per category (not 6)
  - "View All" button moved from header to last card in horizontal scroll
  - Fixed-width cards (280px) prevent horizontal page scrolling
  - Individual category sections scroll horizontally for cards
- **Multi-Category Support**: Fixed category pages to work with multi-category topics
  - CategoryPage.tsx now properly uses categories array instead of single category field
  - AllCategoriesPage.tsx groups topics correctly, allowing topics to appear in multiple categories
  - TopicCard component safely handles categories array with default values and optional chaining
- **Live Streams in Categories**: Integrated live streams into the category system
  - Added backend support for filtering live streams by category through their topic's categories
  - CategoryPage now fetches and displays live streams for each category
  - Live streams inherit categories from their associated topics via topicId
  - Storage layer properly joins topics table when category filter is needed
- **Mobile Sidebar Enhancement**: Sidebar now auto-closes on mobile when navigation links are clicked
- **Database Query Optimization**: Backend uses PostgreSQL array containment operator for efficient category filtering

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Framework**: Shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design system based on Material Design 3
- **State Management**: TanStack Query for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express.js server
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM with type-safe database operations
- **Authentication**: Replit Auth integration with session management
- **API Design**: RESTful endpoints with structured error handling

### Data Storage Solutions
- **Primary Database**: PostgreSQL via Neon Database
- **Session Storage**: PostgreSQL-based session store using connect-pg-simple
- **Schema Management**: Drizzle migrations with shared schema definitions
- **Connection Pooling**: Neon serverless connection pooling

### Authentication and Authorization
- **Provider**: Replit Auth using OpenID Connect
- **Session Management**: Express sessions with PostgreSQL storage
- **Security**: HTTP-only cookies with CSRF protection
- **User Management**: Automatic user creation and profile management

### Design System
- **Base**: Material Design 3 principles with Discord-inspired patterns
- **Theme Support**: Light, dark, and time-based (auto) modes with CSS custom properties
  - Theme preferences managed in Settings page
  - Time-based mode switches between light (6 AM - 6 PM) and dark (6 PM - 6 AM)
  - Preferences persist across sessions via localStorage
- **Typography**: Inter font family for readability
- **Color System**: HSL-based color tokens for consistent theming
- **Spacing**: Tailwind spacing units with 8px base grid

### Core Data Models
- **Users**: Authentication and profile management
- **Topics**: Debate subjects with categories and metadata
- **Opinions**: User-generated content with stance tracking
- **Debate Rooms**: Real-time structured debates between participants
- **Live Streams**: Video/audio debates with chat functionality
- **Cumulative Opinions**: AI-generated summaries of community perspectives

### Component Architecture
- **Atomic Design**: Reusable UI components with consistent interfaces
- **Feature Components**: Domain-specific components for debates, opinions, and streaming
- **Layout Components**: Sidebar navigation with collapsible design
- **Form Components**: Type-safe forms with validation and error handling

## External Dependencies

### Database Services
- **Neon Database**: Serverless PostgreSQL hosting with connection pooling
- **Drizzle Kit**: Schema migration and database management tools

### Authentication Services
- **Replit Auth**: OpenID Connect authentication provider
- **Express Session**: Session management with PostgreSQL storage

### AI Services
- **OpenAI API**: GPT-based AI for generating cumulative opinion summaries and content analysis

### UI and Design Libraries
- **Radix UI**: Accessible component primitives for complex UI patterns
- **Tailwind CSS**: Utility-first CSS framework with custom configuration
- **Lucide React**: Consistent icon library for the interface
- **Class Variance Authority**: Type-safe component variant management

### Development Tools
- **Vite**: Fast build tool with HMR and development server
- **TypeScript**: Type safety across client and server code
- **TanStack Query**: Server state management with caching and synchronization
- **React Hook Form**: Performant form handling with validation
- **Zod**: Runtime type validation and schema definition

### Production Services
- **Google Fonts**: Inter and JetBrains Mono font delivery
- **Asset Management**: Static asset serving with Vite optimization