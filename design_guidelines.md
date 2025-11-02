# Design Guidelines: Fuller Feuds Platform

## Design Approach: Reference-Based (Linear/Vercel Aesthetic)
**Selected References**: Linear, Vercel, Arc Browser
**Justification**: Modern SaaS platforms that balance sophisticated dark aesthetics with exceptional utility. These references excel at creating depth through subtle elevation, refined color usage, and glass morphism effects while maintaining outstanding readability and user focus.

## Core Design Elements

### Color Palette

**Dark Mode (Primary):**
- Background Base: 220 15% 9%
- Surface: 220 12% 13%
- Surface Elevated: 220 10% 16%
- Surface Overlay (glass): 220 15% 18% with 60% opacity + backdrop blur
- Primary Accent: 220 75% 58%
- Text Primary: 220 8% 95%
- Text Secondary: 220 8% 65%
- Text Tertiary: 220 6% 45%
- Border Subtle: 220 10% 22%
- Border Default: 220 10% 28%

**Light Mode (Secondary):**
- Background Base: 220 15% 98%
- Surface: 0 0% 100%
- Surface Elevated: 220 10% 96%
- Primary Accent: 220 75% 52%
- Text Primary: 220 15% 15%
- Text Secondary: 220 10% 45%
- Border Subtle: 220 10% 88%

**Semantic Colors:**
- Success: 142 70% 45%
- Warning: 35 85% 55%
- Live Indicator: 0 85% 58%
- AI Purple: 270 65% 62%
- Danger: 0 75% 55%

### Typography
**Font Family**: Inter (primary), JetBrains Mono (code/technical)

**Hierarchy:**
- Display (hero titles): 700 weight, 3rem (48px), -0.03em tracking, 1.1 line-height
- H1 (page titles): 700 weight, 2.25rem (36px), -0.02em tracking
- H2 (section headers): 600 weight, 1.5rem (24px), -0.01em tracking
- H3 (card headers): 600 weight, 1.125rem (18px)
- Body Large: 400 weight, 1.125rem (18px), 1.7 line-height
- Body Default: 400 weight, 1rem (16px), 1.6 line-height
- Body Small: 400 weight, 0.875rem (14px), 1.5 line-height
- Caption: 500 weight, 0.75rem (12px), 0.02em tracking, uppercase

### Layout System
**Spacing Primitives**: 2, 4, 6, 8, 12, 16, 20, 24
- Micro: 2, 4 (inline elements, tight groupings)
- Standard: 6, 8 (component padding, list spacing)
- Section: 12, 16 (card spacing, section gaps)
- Large: 20, 24 (page sections, major divisions)

**Container System:**
- Max-width: 1440px (7xl)
- Content max-width: 1280px (6xl)
- Prose max-width: 720px

### Visual Depth & Elevation

**Shadows:**
- Subtle: 0 1px 3px rgba(0,0,0,0.12)
- Default: 0 4px 12px rgba(0,0,0,0.15)
- Elevated: 0 12px 24px rgba(0,0,0,0.20)
- Dramatic: 0 24px 48px rgba(0,0,0,0.25)

**Glass Morphism:**
- Overlays: backdrop-blur-xl with surface overlay color at 60% opacity
- Navigation: backdrop-blur-lg with 80% opacity
- Modal backgrounds: backdrop-blur-md with 40% opacity

### Component Library

**Navigation:**
- Top bar: Glass effect with backdrop blur, sticky positioning, 64px height
- Sidebar: Surface elevated background, 280px width, collapsible with smooth transition
- Mobile: Bottom sheet navigation with glass effect, 56px height

**Content Cards:**
- Opinion cards: Surface background, subtle shadow, 16px border-radius, 1px border
- AI opinions: Purple accent border-left (3px), glass surface overlay
- Live debates: Elevated shadow, red live pulse animation on indicator
- Featured cards: Elevated surface with dramatic shadow, gradient border accent

**Live Streaming:**
- Video container: 16:9 ratio, elevated shadow, rounded corners
- Chat sidebar: Glass effect surface, 360px width (desktop)
- Control bar: Glass bottom overlay with backdrop blur
- Participant grid: Surface elevated cards with hover lift effect

**Discussion Threads:**
- Thread container: Surface background with subtle border
- Reply indentation: 32px per level, connecting line at border-subtle color
- Hover state: Surface elevated transition with subtle lift
- Active typing: Animated gradient border pulse

**Interactive Elements:**
- Primary buttons: Primary accent background, 40px height, 12px border-radius, smooth scale on hover
- Secondary buttons: Border-default border, surface hover, subtle shadow
- Ghost buttons: Transparent with text-secondary, surface-elevated on hover
- Icon buttons: 40px square, rounded-lg, smooth state transitions

**Forms:**
- Input fields: Surface elevated background, border-default border, 44px height
- Focus state: Primary accent border, subtle glow effect
- Search bar: Glass effect with backdrop blur, icon prefix
- Rich text editor: Surface background with elevated toolbar

**Data Display:**
- Metric cards: Surface elevated, large number in display weight, label in caption style
- Progress bars: Surface track with primary accent fill, 8px height, rounded-full
- Charts: Muted accent colors with subtle gradients
- Leaderboards: Alternating surface/surface-elevated rows, hover lift

### Animations & Transitions

**Timing Functions:**
- Standard: cubic-bezier(0.4, 0, 0.2, 1) - 200ms
- Smooth: cubic-bezier(0.4, 0, 0.1, 1) - 300ms
- Bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55) - 400ms

**Motion Patterns:**
- Card hover: Translate-y by -2px, shadow elevation increase
- Button interactions: Scale to 0.98 on active
- Page transitions: Fade + slight vertical slide
- Live indicators: Continuous pulse animation with opacity 0.6-1
- Loading states: Shimmer gradient animation
- Modal entry: Scale from 0.95 with fade, backdrop blur-in

### Images

**Hero Section:**
- Full-width gradient overlay (primary accent to background) with abstract geometric pattern
- Height: 480px (desktop), 320px (mobile)
- Glass effect platform preview cards floating over gradient

**Supporting Images:**
- User avatars: Circular, 32px (threads), 48px (cards), 64px (live), subtle ring border
- Topic thumbnails: 16:9 ratio, 280x158px, rounded-lg, subtle shadow
- Live stream thumbnails: Red gradient overlay on bottom-left with "LIVE" badge
- Debate participant cards: 1:1 ratio, 120x120px, elevated shadow
- Empty states: Minimal monochromatic illustrations with primary accent highlights

**Image Treatment:**
- All images: Subtle border (border-subtle), smooth loading fade-in
- Hover states: Slight scale (1.02) with shadow increase
- Live content: Animated gradient border

### Accessibility
- Minimum contrast ratio: 4.5:1 for body text, 3:1 for large text
- Focus indicators: 2px primary accent outline with 4px offset
- Reduced motion: Disable animations when prefers-reduced-motion is active
- Dark mode as default with light mode toggle
- Keyboard navigation: Visible focus states, logical tab order

### Key Interaction Patterns
- Instant feedback: All interactions respond within 100ms
- Optimistic updates: Show changes immediately, revert on error
- Progressive disclosure: Collapsed states with smooth expand animations
- Contextual actions: Show on hover with fade-in transition
- Real-time sync: Subtle pulse indicators for live updates
- Multi-select: Checkbox fade-in on hover, selected items with accent border

The design creates a sophisticated, modern debate platform that feels premium and polished while maintaining exceptional usability and accessibility across all features.