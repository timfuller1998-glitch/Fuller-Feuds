# Kirk Debate Platform

## Overview

Kirk is a modern debate platform designed to facilitate meaningful discussions on important topics. The platform combines traditional text-based debates with live streaming capabilities and AI-powered insights. Users can create and participate in debates, share opinions, and engage in real-time discussions across multiple formats including text debates, live streams, and structured debate rooms.

The application serves as a comprehensive discussion platform where ideas can "collide" in a constructive environment, featuring AI-generated cumulative opinions that summarize community perspectives and track debate sentiment over time.

## User Preferences

Preferred communication style: Simple, everyday language.

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
- **Theme Support**: Light and dark mode with CSS custom properties
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