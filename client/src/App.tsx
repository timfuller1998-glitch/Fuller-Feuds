import { Switch, Route, useLocation, useSearch } from "wouter";
import { useEffect, useState } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import AppSidebar from "@/components/AppSidebar";
import SearchBar from "@/components/SearchBar";
import { ActiveBackgroundGradient } from "@/components/ActiveBackgroundGradient";
import { useAuth } from "@/hooks/useAuth";
import { DebateProvider } from "@/contexts/DebateContext";
import { DebateFooter } from "@/components/debates/DebateFooter";
import { AllActiveDebatesPanel } from "@/components/debates/AllActiveDebatesPanel";
import { ArchivedDebatesPanel } from "@/components/debates/ArchivedDebatesPanel";
import { OpponentDebateList } from "@/components/debates/OpponentDebateList";
import { DebateWindowManager } from "@/components/debates/DebateWindowManager";
import { useDebateWebSocket } from "@/hooks/useDebateWebSocket";
import Home from "@/pages/Home";
import Profile from "@/pages/Profile";
import Settings from "@/pages/Settings";
import Topic from "@/pages/Topic";
import Trending from "@/pages/Trending";
import LiveDebates from "@/pages/LiveDebates";
import HotDebates from "@/pages/HotDebates";
import Search from "@/pages/Search";
import AllCategoriesPage from "@/pages/AllCategoriesPage";
import CategoryPage from "@/pages/CategoryPage";
import LiveStreamPage from "@/pages/LiveStreamPage";
import AdminDashboard from "@/pages/AdminDashboard";
import Onboarding from "@/pages/Onboarding";
import RecentOpinions from "@/pages/RecentOpinions";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated } = useAuth();

  return (
    <Switch>
      {/* Authenticated-only routes */}
      {isAuthenticated && <Route path="/onboarding" component={Onboarding} />}
      {isAuthenticated && <Route path="/settings" component={Settings} />}
      {isAuthenticated && <Route path="/admin" component={AdminDashboard} />}
      
      {/* Public routes - visible to everyone */}
      <Route path="/" component={Home} />
      <Route path="/search" component={Search} />
      <Route path="/trending" component={Trending} />
      <Route path="/live" component={LiveDebates} />
      <Route path="/hot-debates" component={HotDebates} />
      <Route path="/categories" component={AllCategoriesPage} />
      <Route path="/category/:category" component={CategoryPage} />
      <Route path="/recent-opinions" component={RecentOpinions} />
      <Route path="/topic/:id" component={Topic} />
      <Route path="/profile/:userId" component={Profile} />
      <Route path="/live-stream/:id" component={LiveStreamPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppWithSidebar({ 
  user, 
  displayName, 
  searchQuery, 
  handleSearch,
  isAuthenticated
}: {
  user: any;
  displayName: string;
  searchQuery: string;
  handleSearch: (query: string) => void;
  isAuthenticated: boolean;
}) {
  return (
    <div className="flex h-screen w-full overflow-x-hidden">
      <AppSidebar
        currentUser={{
          id: user?.id || "",
          name: displayName,
          avatar: user?.profileImageUrl,
          isOnline: true
        }}
        onNavigate={(path) => console.log('Navigate to:', path)}
        onLogout={() => {
          window.location.href = "/api/logout";
        }}
      />
      <div className="flex flex-col flex-1 min-w-0">
        <header className="sticky top-0 z-10 flex items-center gap-2 sm:gap-4 p-2 sm:p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <SidebarTrigger data-testid="button-sidebar-toggle" />
          <div className="flex flex-1 max-w-2xl mx-auto px-2 sm:px-0">
            <SearchBar 
              value={searchQuery}
              onSearch={handleSearch}
              className="w-full"
            />
          </div>
          {!isAuthenticated && (
            <a href="/api/login" className="flex-shrink-0">
              <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 font-medium" data-testid="button-sign-in">
                Sign In
              </button>
            </a>
          )}
        </header>
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-6 pb-20">
          <div className="max-w-7xl mx-auto w-full">
            <Router />
          </div>
        </main>
        {/* Only show debate messenger UI for authenticated users */}
        {isAuthenticated && (
          <>
            <DebateFooter />
            <AllActiveDebatesPanel />
            <ArchivedDebatesPanel />
            <OpponentDebateList />
            <DebateWindowManager />
          </>
        )}
      </div>
    </div>
  );
}

function WebSocketManager() {
  const { user } = useAuth();
  useDebateWebSocket(user?.id);
  return null;
}

function MainApp() {
  const { user, isAuthenticated } = useAuth();
  const [location, setLocation] = useLocation();
  const searchParams = useSearch();
  const [searchQuery, setSearchQuery] = useState("");
  
  // Redirect to onboarding if authenticated but not completed
  useEffect(() => {
    if (user && !user.onboardingComplete && location !== "/onboarding") {
      setLocation("/onboarding");
    }
  }, [user, location, setLocation]);
  
  // Initialize search query from URL on mount and location change
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    const q = params.get("q") || "";
    setSearchQuery(q);
  }, [searchParams, location]);
  
  // Custom sidebar width for debate application
  const style = {
    "--sidebar-width": "20rem",       // 320px for better content
    "--sidebar-width-icon": "4rem",   // default icon width
  };

  const displayName = user?.firstName && user?.lastName 
    ? `${user.firstName} ${user.lastName}`
    : user?.email || "User";

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    const params = new URLSearchParams(searchParams);
    if (query) {
      params.set("q", query);
    } else {
      params.delete("q");
    }
    // Update URL with new search params (avoid double-? by using basePath)
    const basePath = location.split("?")[0];
    const newSearch = params.toString();
    setLocation(`${basePath}${newSearch ? `?${newSearch}` : ""}`);
  };

  // Onboarding page doesn't need sidebar
  if (isAuthenticated && location === "/onboarding") {
    return <Router />;
  }

  return (
    <DebateProvider>
      <SidebarProvider style={style as React.CSSProperties}>
        {isAuthenticated && <WebSocketManager />}
        <AppWithSidebar 
          user={user}
          displayName={displayName}
          searchQuery={searchQuery}
          handleSearch={handleSearch}
          isAuthenticated={isAuthenticated}
        />
      </SidebarProvider>
    </DebateProvider>
  );
}

function AppContent() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return <MainApp />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ActiveBackgroundGradient>
          <AppContent />
        </ActiveBackgroundGradient>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
