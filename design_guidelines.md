# Design Guidelines: Debate Platform

## Design Approach: Design System Based
**Selected System**: Material Design 3 with Discord-inspired discussion patterns
**Justification**: Utility-focused platform requiring excellent readability, clear information hierarchy, and established interaction patterns for discussions and debates.

## Core Design Elements

### Color Palette
**Light Mode:**
- Primary: 220 70% 50% (Professional blue for trust and authority)
- Background: 0 0% 98% (Clean, readable background)
- Surface: 0 0% 100% (Card backgrounds)
- Text Primary: 220 15% 15%
- Text Secondary: 220 10% 45%

**Dark Mode:**
- Primary: 220 70% 60% (Slightly lighter for contrast)
- Background: 220 15% 8% (Deep, comfortable dark)
- Surface: 220 12% 12% (Elevated surfaces)
- Text Primary: 220 15% 90%
- Text Secondary: 220 10% 70%

**Accent Colors:**
- Success (agreements): 120 60% 45%
- Warning (debates): 35 80% 55%
- Neutral (cumulative): 220 15% 60%

### Typography
**Font Family**: Inter via Google Fonts CDN
- Headlines: 600 weight, 1.5rem-2.5rem
- Body text: 400 weight, 1rem, 1.6 line height for readability
- Captions: 400 weight, 0.875rem
- Code/quotes: JetBrains Mono, 400 weight

### Layout System
**Spacing Units**: Tailwind spacing - primary units of 2, 4, 6, 8, 12, 16
- Micro spacing: p-2, m-2 (8px)
- Standard spacing: p-4, m-4 (16px) 
- Component spacing: p-6, m-6 (24px)
- Section spacing: p-8, m-8 (32px)
- Large spacing: p-12, m-12 (48px)
- Hero/Major: p-16, m-16 (64px)

### Component Library

**Navigation**
- Top navigation bar with search prominently featured
- Sidebar for topic categories (collapsible on mobile)
- Breadcrumb navigation for topic > debate path

**Cards & Content**
- Opinion cards: clean white/dark surface with subtle shadow
- Cumulative opinion: distinctive elevated card with accent border
- Debate thread: threaded conversation layout similar to Discord
- Topic cards: grid layout with engagement metrics

**Forms & Inputs**
- Search bar: prominent, full-width with icon
- Opinion editor: rich text editor with formatting toolbar
- Real-time chat: bottom-anchored input with send button

**Data Display**
- User avatars: circular, consistent sizing (32px, 48px variants)
- Engagement metrics: vote counts, participant numbers
- Topic tags: pill-shaped with category colors
- Debate status indicators: online/offline, typing indicators

**Overlays**
- Modal for detailed opinion viewing
- Slide-out panels for user profiles
- Toast notifications for real-time updates

## Images
**No Large Hero Image**: This is a content-focused platform where functionality takes precedence over visual marketing.

**Supporting Images**:
- Topic thumbnails: 16:9 ratio, 240x135px for topic cards
- User avatars: circular profile photos
- Empty state illustrations: simple, minimal line art for empty search results or no active debates
- Category icons: simple, consistent iconography for topic categories

**Image Placement**:
- Topic thumbnails in search results and browse grids
- User avatars in opinion cards, debate threads, and navigation
- Empty state illustrations centered in content areas when no data available

## Key Interaction Patterns
- **Search-first**: Prominent search functionality on every page
- **Progressive disclosure**: Show topic summary → individual opinions → detailed debate threads
- **Real-time updates**: Live indicators for active debates and new opinions
- **Clear hierarchy**: Cumulative opinions visually distinct from individual opinions
- **Mobile-responsive**: Collapsible sidebar, stacked cards, touch-friendly debate interface

The design prioritizes readability, clear information architecture, and efficient content consumption while maintaining a professional, trustworthy appearance suitable for meaningful discourse.