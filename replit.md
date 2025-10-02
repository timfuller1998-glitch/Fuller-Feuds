# Kirk Debates Platform

## Overview

Kirk Debates is a modern debate platform designed to facilitate meaningful discussions on important topics. The platform combines traditional text-based debates with live streaming capabilities and AI-powered insights. Users can create and participate in debates, share opinions, and engage in real-time discussions across multiple formats including text debates, live streams, and structured debate rooms.

The application serves as a comprehensive discussion platform where ideas can "collide" in a constructive environment, featuring AI-generated cumulative opinions that summarize community perspectives and track debate sentiment over time.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### Category System and Live Streams Integration (October 2025)
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

### Search and Topic Creation Flow (October 2025)
- **Streamlined Home Screen**: Removed dedicated search bar, trending button, and new topic button from hero section to simplify the UI
- **Universal Search Enhancement**: Header search bar now displays "Create New Topic" button in dropdown when search returns no results
- **Global Topic Creation**: Moved topic creation dialog to App.tsx with TopicCreationContext for global accessibility
  - SearchBar and Search page both trigger the same global dialog
  - Dialog title auto-fills with search query when opened from search
- **Search Page Integration**: Added "Create New Topic" button to Search page for no-results scenarios
- **Database Query Fix**: Updated topic filtering to use categories array with PostgreSQL array containment operator
- **Router Updates**: Restructured Router to properly handle authenticated vs unauthenticated access to /search route

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