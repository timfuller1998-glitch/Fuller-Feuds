# Design Guidelines: Kirk Debates Platform

## Design Approach: Design System Based
**Selected System**: Material Design 3 with refined Discord-inspired discussion patterns
**Justification**: Utility-focused platform requiring excellent readability, clear information hierarchy, and established interaction patterns for multi-format discussions (text, live streams, one-on-one debates).

## Core Design Elements

### Color Palette
**Light Mode:**
- Primary: 220 70% 50% (Professional blue for trust and authority)
- Background: 0 0% 98% (Clean, readable background)
- Surface: 0 0% 100% (Card backgrounds)
- Surface Elevated: 220 5% 96% (Live stream panels, moderation tools)
- Text Primary: 220 15% 15%
- Text Secondary: 220 10% 45%

**Dark Mode:**
- Primary: 220 70% 60% (Slightly lighter for contrast)
- Background: 220 15% 8% (Deep, comfortable dark)
- Surface: 220 12% 12% (Elevated surfaces)
- Surface Elevated: 220 15% 16% (Live stream panels, moderation tools)
- Text Primary: 220 15% 90%
- Text Secondary: 220 10% 70%

**Accent Colors:**
- Success (agreements): 120 60% 45%
- Warning (active debates): 35 80% 55%
- Live indicator: 0 85% 60% (Bright red for live streams)
- AI-generated: 280 60% 65% (Purple for AI cumulative opinions)

### Typography
**Font Family**: Inter via Google Fonts CDN
- Headlines: 600 weight, 1.5rem-2.5rem
- Body text: 400 weight, 1rem, 1.6 line height for readability
- Debate text: 400 weight, 1.125rem, 1.7 line height (enhanced readability)
- Captions/metadata: 400 weight, 0.875rem
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
- Top navigation with prominent search, live debates indicator, user profile
- Left sidebar: topic categories, active debates, followed discussions
- Bottom navigation (mobile): search, debates, live, profile

**Content Cards**
- Opinion cards: clean surface with author, timestamp, engagement metrics
- AI cumulative opinion: distinctive purple accent border, "AI-Generated" label
- Live debate cards: red "LIVE" indicator, viewer count, join button
- One-on-one debate invitations: elevated surface with accept/decline actions

**Live Streaming Interface**
- Video player: 16:9 ratio with chat sidebar
- Participant panel: moderator controls, speaker queue
- Viewer interaction: reactions, question submission, poll voting
- Moderation toolbar: mute, remove, spotlight controls

**Discussion Threads**
- Threaded replies with visual hierarchy (Discord-inspired)
- Quote highlighting and reference linking
- Real-time typing indicators and live updates
- Formal tone indicators and community guidelines integration

**Forms & Interactions**
- Search: prominent with topic/user/debate type filters
- Opinion composer: rich text with formatting, citation tools
- Debate challenge: formal invitation system with topic proposal
- Live stream setup: title, description, participant selection, moderation settings

**Data Displays**
- User reputation scores and debate history
- Topic engagement metrics and trending indicators
- Live viewership counts and interaction rates
- Debate outcome summaries and key point extraction

**Moderation Tools**
- Real-time content flagging system
- Moderator action panel for live streams
- Community guideline enforcement interface
- Automated detection alerts and manual review queue

## Images
**No Large Hero Image**: Content and functionality-focused platform prioritizing efficient information access.

**Supporting Images**:
- Topic thumbnails: 16:9 ratio, 240x135px for topic cards and search results
- User avatars: circular, 32px (threads), 48px (profiles), 64px (live streams)
- Live stream thumbnails: 16:9 ratio with "LIVE" overlay badge
- Empty state illustrations: minimal line art for no search results, inactive debates
- Category icons: consistent iconography using Heroicons library

**Image Placement**:
- Topic thumbnails in browse grids and search results
- User avatars throughout discussion threads and live interfaces
- Live stream thumbnails in active debates section
- Empty state illustrations centered in content areas

## Key Interaction Patterns
- **Multi-modal access**: Quick switching between text debates, live streams, one-on-one challenges
- **Progressive formality**: Informal browsing → structured debate → moderated live discussion
- **Real-time awareness**: Live indicators, typing status, participant presence
- **AI integration**: Clearly labeled AI-generated content with transparency
- **Moderation-first**: Built-in tools for maintaining discourse quality
- **Mobile-optimized**: Touch-friendly live stream controls, collapsible sidebars, gesture navigation

The design balances Discord's familiar discussion patterns with the formality required for serious debate, emphasizing clarity, professionalism, and efficient moderation across all interaction modes.