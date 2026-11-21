import { useQuery } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StackSection from "@/components/StackSection";
import { useAuth } from "@/hooks/useAuth";
import type { TopicWithCounts } from "@shared/schema";
import type { HomeSectionKey } from "@shared/homeFeed";
import {
  TrendingUp,
  Flame,
  MessageCircle,
  Grid,
  Calendar,
  MessageSquare,
  Users,
  Search as SearchIcon,
  X,
  type LucideIcon,
} from "lucide-react";

const PUBLIC_SECTIONS: { title: string; icon: LucideIcon; feed: HomeSectionKey }[] = [
  { title: "Trending", icon: TrendingUp, feed: "trending" },
  { title: "Hot Debates", icon: Flame, feed: "hot-debates" },
  { title: "New This Week", icon: Calendar, feed: "new-this-week" },
  { title: "Most Debated", icon: MessageSquare, feed: "most-debated" },
  { title: "Diverse Perspectives", icon: Users, feed: "diverse-perspectives" },
];

const USER_SECTIONS: { title: string; icon: LucideIcon; feed: HomeSectionKey }[] = [
  { title: "My Topics", icon: MessageCircle, feed: "my-topics" },
  { title: "My Current Debates", icon: MessageCircle, feed: "my-current-debates" },
];

export default function Home() {
  const { user } = useAuth();
  // Enter in the header search on "/" sets ?filter=... (see SearchBar); the home deck then shows only matches.
  const homeFilter = (new URLSearchParams(useSearch()).get("filter") || "").trim();

  // Only fetch the full topic list when the user is actually filtering — the default
  // home sections load themselves from /api/feed/home and should not wait on this.
  const { data: apiTopics, isLoading: topicsLoading } = useQuery<TopicWithCounts[]>({
    queryKey: ["/api/topics"],
    enabled: !!homeFilter,
  });

  const topicsSource = Array.isArray(apiTopics) ? apiTopics : [];
  const filterTerms = homeFilter.toLowerCase().split(/\s+/).filter(Boolean);
  const topics = filterTerms.length === 0 ? topicsSource : topicsSource.filter((t) => {
    const hay = [t.title, (t as any).description, ...((t as any).categories || [])].filter(Boolean).join(" ").toLowerCase();
    return filterTerms.every((term) => hay.includes(term));
  });

  const sections = homeFilter
    ? PUBLIC_SECTIONS.length && topics.length
      ? [{ title: "Search results", icon: SearchIcon, topics, feed: undefined as HomeSectionKey | undefined }]
      : []
    : [
        ...PUBLIC_SECTIONS.map((s) => ({ ...s, topics: undefined as TopicWithCounts[] | undefined })),
        ...(user ? USER_SECTIONS.map((s) => ({ ...s, topics: undefined as TopicWithCounts[] | undefined })) : []),
      ];

  if (homeFilter && topicsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading debates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 overflow-y-auto overflow-x-hidden snap-y snap-mandatory -webkit-overflow-scrolling-touch">
      {homeFilter && (
        <div className="absolute top-0 left-0 right-0 z-20 flex justify-center pt-2 pointer-events-none">
          <div className="pointer-events-auto inline-flex items-center gap-2 border border-foreground bg-background px-3 py-1 font-ui text-xs uppercase tracking-[0.08em]" data-testid="chip-home-filter">
            <SearchIcon className="h-3.5 w-3.5" />
            <span>{topics.length} {topics.length === 1 ? "topic" : "topics"} matching “{homeFilter}”</span>
            <Link href="/" className="inline-flex items-center hover:text-primary" aria-label="Clear filter" data-testid="button-clear-home-filter"><X className="h-3.5 w-3.5" /></Link>
          </div>
        </div>
      )}
      {homeFilter && sections.length === 0 ? (
        <section className="h-full snap-start shrink-0 flex items-center justify-center px-4">
          <Card>
            <CardContent className="py-12 text-center space-y-3" data-testid="empty-home-filter">
              <SearchIcon className="w-10 h-10 text-muted-foreground mx-auto" />
              <p className="text-lg font-medium">No topics match “{homeFilter}”</p>
              <div className="flex gap-2 justify-center flex-wrap">
                <Button asChild><Link href={`/create-topic?title=${encodeURIComponent(homeFilter)}`}>Create this topic</Link></Button>
                <Button asChild variant="outline"><Link href="/">Clear search</Link></Button>
              </div>
            </CardContent>
          </Card>
        </section>
      ) : sections.length === 0 ? (
        <section className="h-full snap-start shrink-0 flex items-center justify-center">
          <Card>
            <CardContent className="py-12 text-center">
              <Grid className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-lg font-medium mb-2">No debates yet</p>
              <p className="text-muted-foreground">
                Be the first to create a topic and start a debate
              </p>
            </CardContent>
          </Card>
        </section>
      ) : (
        sections.map((section, index) => (
          <StackSection
            key={section.title + homeFilter}
            title={section.title}
            icon={section.icon}
            sectionKey={section.title.toLowerCase().replace(/\s+/g, "-")}
            topics={homeFilter ? section.topics : undefined}
            feedSection={homeFilter ? undefined : (section as { feed?: HomeSectionKey }).feed}
            showNextHint={index < sections.length - 1}
            eager={index < 2}
          />
        ))
      )}

      <section className="h-full snap-start shrink-0 flex flex-col items-center justify-center px-4 py-8">
        <div className="text-center space-y-3 sm:space-y-4">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">
            Every opinion. One fair fight.
          </h1>
          <div className="text-sm sm:text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed space-y-1">
            <p>Submit your opinion. Change the summary</p>
            <p>Debate 1v1. no comments, no crowd.</p>
            <p>See both sides or step in to change minds.</p>
            <p>Break echo chamber, one fair fight at a time.</p>
          </div>
        </div>
        <p className="mt-8 font-ui text-xs text-muted-foreground" data-testid="home-legal-links">
          <Link href="/privacy" className="hover:text-foreground hover:underline" data-testid="link-home-privacy">Privacy</Link>
          <span aria-hidden="true"> · </span>
          <Link href="/terms" className="hover:text-foreground hover:underline" data-testid="link-home-terms">Terms</Link>
        </p>
      </section>
    </div>
  );
}
