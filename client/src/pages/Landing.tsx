import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  MessageCircle, 
  Users, 
  TrendingUp, 
  Brain,
  Radio,
  Shield,
  Zap,
  Globe
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { LoginDialog } from "@/components/LoginDialog";

interface PlatformStats {
  totalTopics: number;
  liveStreams: number;
  totalParticipants: number;
  totalCategories: number;
}

export default function Landing() {
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);

  // Fetch platform statistics
  const { data: stats } = useQuery<PlatformStats>({
    queryKey: ['/api/stats/platform'],
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Login Dialog */}
      <LoginDialog open={loginDialogOpen} onOpenChange={setLoginDialogOpen} />

      {/* Header with glass effect */}
      <header className="sticky top-0 z-50 border-b border-border/40 glass">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 animate-fade-in">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
              <MessageCircle className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-bold text-lg">Fuller Feuds</h1>
              <p className="text-xs text-muted-foreground">Every opinion. One fair fight.</p>
            </div>
          </div>
          
          <Button 
            onClick={() => setLoginDialogOpen(true)}
            data-testid="button-login"
            className="transition-smooth"
          >
            Sign In
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-32 px-6 overflow-hidden">
        {/* Subtle gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-muted/5 pointer-events-none" />
        
        <div className="relative max-w-4xl mx-auto text-center space-y-8 animate-fade-in">
          <Badge variant="secondary" className="mb-4 shadow-sm">
            <Zap className="w-3 h-3 mr-1" />
            Powered by AI
          </Badge>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-tight">
            Every opinion. 
            <span className="text-gradient"> One fair fight.</span>
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Submit your opinion, change the summary. <br />
            Debate 1v1 — no comments, no noise, no crowd. <br />
            See both sides or step into change some minds.<br />
            Break echo chambers, one fair fight at a time.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button 
              size="lg" 
              onClick={() => setLoginDialogOpen(true)}
              data-testid="button-get-started"
              className="shadow-lg transition-smooth hover:shadow-xl"
            >
              Get Started
            </Button>
            <Button variant="outline" size="lg" className="transition-smooth">
              Learn More
            </Button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Platform Features</h2>
            <p className="text-lg text-muted-foreground">Everything you need for meaningful debates and discussions</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="hover-elevate border border-border/50 shadow-md transition-smooth">
              <CardContent className="p-8">
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 w-fit mb-4">
                  <MessageCircle className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-3">Opinion Sharing</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Share your thoughts on important topics and see how others think about the same issues.
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate border border-border/50 shadow-md transition-smooth">
              <CardContent className="p-8">
                <div className="p-3 rounded-lg bg-chart-1/10 border border-chart-1/20 w-fit mb-4">
                  <Brain className="w-6 h-6 text-chart-1" />
                </div>
                <h3 className="font-semibold text-lg mb-3">AI-Powered Insights</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Get intelligent summaries and analysis of community opinions using advanced AI technology.
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate border border-border/50 shadow-md transition-smooth">
              <CardContent className="p-8">
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 w-fit mb-4">
                  <Radio className="w-6 h-6 text-red-500" />
                </div>
                <h3 className="font-semibold text-lg mb-3">Live Streaming Debates</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Watch and participate in real-time debates with expert moderation and viewer interactions.
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate border border-border/50 shadow-md transition-smooth">
              <CardContent className="p-8">
                <div className="p-3 rounded-lg bg-chart-2/10 border border-chart-2/20 w-fit mb-4">
                  <Users className="w-6 h-6 text-chart-2" />
                </div>
                <h3 className="font-semibold text-lg mb-3">One-on-One Debates</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Engage in structured discussions with other users in private debate rooms.
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate border border-border/50 shadow-md transition-smooth">
              <CardContent className="p-8">
                <div className="p-3 rounded-lg bg-chart-3/10 border border-chart-3/20 w-fit mb-4">
                  <Shield className="w-6 h-6 text-chart-3" />
                </div>
                <h3 className="font-semibold text-lg mb-3">Moderated Discussions</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Professional moderation ensures respectful and productive conversations.
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate border border-border/50 shadow-md transition-smooth">
              <CardContent className="p-8">
                <div className="p-3 rounded-lg bg-chart-4/10 border border-chart-4/20 w-fit mb-4">
                  <TrendingUp className="w-6 h-6 text-chart-4" />
                </div>
                <h3 className="font-semibold text-lg mb-3">Trending Topics</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Discover what topics are generating the most discussion and engagement.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-24 px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-muted/10 to-transparent pointer-events-none" />
        <div className="relative max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Join a Growing Community</h2>
            <p className="text-lg text-muted-foreground">Thousands of people are already having meaningful conversations</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="text-center p-6 rounded-lg surface-elevated border border-border/30 hover-elevate transition-smooth">
              <div className="text-5xl font-bold text-primary mb-3">{stats?.totalTopics || 0}</div>
              <div className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                <MessageCircle className="w-4 h-4" />
                Active Debates
              </div>
            </div>
            <div className="text-center p-6 rounded-lg surface-elevated border border-border/30 hover-elevate transition-smooth">
              <div className="text-5xl font-bold text-red-500 mb-3 flex items-center justify-center gap-2">
                {stats?.liveStreams || 0}
                {stats?.liveStreams && stats.liveStreams > 0 && (
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse-live" />
                )}
              </div>
              <div className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                <Radio className="w-4 h-4" />
                Live Streams
              </div>
            </div>
            <div className="text-center p-6 rounded-lg surface-elevated border border-border/30 hover-elevate transition-smooth">
              <div className="text-5xl font-bold text-primary mb-3">{stats?.totalParticipants || 0}</div>
              <div className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                <Users className="w-4 h-4" />
                Total Participants
              </div>
            </div>
            <div className="text-center p-6 rounded-lg surface-elevated border border-border/30 hover-elevate transition-smooth">
              <div className="text-5xl font-bold text-primary mb-3">{stats?.totalCategories || 0}</div>
              <div className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                <Globe className="w-4 h-4" />
                Categories
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-32 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-chart-3/10 pointer-events-none" />
        <div className="relative max-w-2xl mx-auto text-center space-y-8">
          <h2 className="text-4xl md:text-5xl font-bold">Ready to Join the Conversation?</h2>
          <p className="text-xl text-muted-foreground leading-relaxed">
            Sign in with your Replit account and start sharing your opinions today.
          </p>
          <Button 
            size="lg" 
            onClick={() => setLoginDialogOpen(true)}
            data-testid="button-cta-signin"
            className="shadow-lg transition-smooth hover:shadow-xl"
          >
            Sign In to Get Started
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-12 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-muted-foreground">&copy; 2024 Opinion Feud. Where Ideas Collide.</p>
        </div>
      </footer>
    </div>
  );
}