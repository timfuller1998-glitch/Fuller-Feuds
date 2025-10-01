import { Switch, Route, useLocation, useSearch } from "wouter";
import { useEffect, useState } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AppSidebar from "@/components/AppSidebar";
import ThemeToggle from "@/components/ThemeToggle";
import SearchBar from "@/components/SearchBar";
import { useAuth } from "@/hooks/useAuth";
import Home from "@/pages/Home";
import Landing from "@/pages/Landing";
import Profile from "@/pages/Profile";
import Topic from "@/pages/Topic";
import Trending from "@/pages/Trending";
import LiveDebates from "@/pages/LiveDebates";
import HotDebates from "@/pages/HotDebates";
import MyDebates from "@/pages/MyDebates";
import Search from "@/pages/Search";
import LiveStreamPage from "@/pages/LiveStreamPage";
import DebateRoomPage from "@/pages/DebateRoomPage";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {isLoading || !isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/" component={Home} />
          <Route path="/search" component={Search} />
          <Route path="/trending" component={Trending} />
          <Route path="/live" component={LiveDebates} />
          <Route path="/hot-debates" component={HotDebates} />
          <Route path="/debates" component={MyDebates} />
          <Route path="/topic/:id" component={Topic} />
          <Route path="/profile/:userId" component={Profile} />
          <Route path="/live-stream/:id" component={LiveStreamPage} />
          <Route path="/debate-room/:id" component={DebateRoomPage} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedApp() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const searchParams = useSearch();
  const [searchQuery, setSearchQuery] = useState("");
  
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

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar
          currentUser={{
            id: user?.id || "",
            name: displayName,
            avatar: user?.profileImageUrl,
            isOnline: true
          }}
          onNavigate={(path) => console.log('Navigate to:', path)}
          onCreateTopic={() => console.log('Create topic clicked')}
          onLogout={() => {
            window.location.href = "/api/logout";
          }}
        />
        <div className="flex flex-col flex-1">
          <header className="flex items-center gap-2 sm:gap-4 p-2 sm:p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex-1 max-w-2xl mx-auto px-2 sm:px-0">
              <SearchBar 
                value={searchQuery}
                onSearch={handleSearch}
                placeholder="Search debate topics..."
                className=""
              />
            </div>
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto p-3 sm:p-4 md:p-6">
            <div className="max-w-7xl mx-auto">
              <Router />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

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

  if (isAuthenticated) {
    return <AuthenticatedApp />;
  }

  return <Router />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppContent />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
