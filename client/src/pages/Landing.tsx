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

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary text-primary-foreground">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-lg">Kirk Debates</h1>
              <p className="text-xs text-muted-foreground">Where Ideas Collide</p>
            </div>
          </div>
          
          <Button 
            onClick={() => window.location.href = "/api/login"}
            data-testid="button-login"
          >
            Sign In
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <Badge variant="secondary" className="mb-4">
            <Zap className="w-3 h-3 mr-1" />
            Powered by AI
          </Badge>
          
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
            Where Ideas 
            <span className="text-primary"> Collide</span>
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Join meaningful debates on topics that matter. Share your opinions, discover different perspectives, 
            and engage in thoughtful discussions with AI-powered insights and live streaming debates.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              onClick={() => window.location.href = "/api/login"}
              data-testid="button-get-started"
            >
              Get Started
            </Button>
            <Button variant="outline" size="lg">
              Learn More
            </Button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 px-6 bg-muted/20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Platform Features</h2>
            <p className="text-muted-foreground">Everything you need for meaningful debates and discussions</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="hover-elevate">
              <CardContent className="p-6">
                <div className="p-3 rounded-lg bg-primary/10 w-fit mb-4">
                  <MessageCircle className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Opinion Sharing</h3>
                <p className="text-muted-foreground">
                  Share your thoughts on important topics and see how others think about the same issues.
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardContent className="p-6">
                <div className="p-3 rounded-lg bg-chart-1/10 w-fit mb-4">
                  <Brain className="w-6 h-6 text-chart-1" />
                </div>
                <h3 className="font-semibold text-lg mb-2">AI-Powered Insights</h3>
                <p className="text-muted-foreground">
                  Get intelligent summaries and analysis of community opinions using advanced AI technology.
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardContent className="p-6">
                <div className="p-3 rounded-lg bg-red-500/10 w-fit mb-4">
                  <Radio className="w-6 h-6 text-red-500" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Live Streaming Debates</h3>
                <p className="text-muted-foreground">
                  Watch and participate in real-time debates with expert moderation and viewer interactions.
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardContent className="p-6">
                <div className="p-3 rounded-lg bg-chart-2/10 w-fit mb-4">
                  <Users className="w-6 h-6 text-chart-2" />
                </div>
                <h3 className="font-semibold text-lg mb-2">One-on-One Debates</h3>
                <p className="text-muted-foreground">
                  Engage in structured discussions with other users in private debate rooms.
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardContent className="p-6">
                <div className="p-3 rounded-lg bg-chart-3/10 w-fit mb-4">
                  <Shield className="w-6 h-6 text-chart-3" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Moderated Discussions</h3>
                <p className="text-muted-foreground">
                  Professional moderation ensures respectful and productive conversations.
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardContent className="p-6">
                <div className="p-3 rounded-lg bg-chart-4/10 w-fit mb-4">
                  <TrendingUp className="w-6 h-6 text-chart-4" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Trending Topics</h3>
                <p className="text-muted-foreground">
                  Discover what topics are generating the most discussion and engagement.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Join a Growing Community</h2>
            <p className="text-muted-foreground">Thousands of people are already having meaningful conversations</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-primary mb-2">1,247</div>
              <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                <MessageCircle className="w-4 h-4" />
                Active Debates
              </div>
            </div>
            <div>
              <div className="text-4xl font-bold text-red-500 mb-2">3</div>
              <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                <Radio className="w-4 h-4" />
                Live Streams
              </div>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">8,923</div>
              <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                <Users className="w-4 h-4" />
                Total Participants
              </div>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">24</div>
              <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                <Globe className="w-4 h-4" />
                Categories
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-primary/5">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <h2 className="text-3xl font-bold">Ready to Join the Conversation?</h2>
          <p className="text-muted-foreground text-lg">
            Sign in with your Replit account and start sharing your opinions today.
          </p>
          <Button 
            size="lg" 
            onClick={() => window.location.href = "/api/login"}
            data-testid="button-cta-signin"
          >
            Sign In to Get Started
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-6">
        <div className="max-w-6xl mx-auto text-center text-muted-foreground">
          <p>&copy; 2024 Kirk Debates. Where Ideas Collide.</p>
        </div>
      </footer>
    </div>
  );
}