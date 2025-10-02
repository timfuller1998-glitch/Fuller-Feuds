import { Switch, Route, useLocation, useSearch } from "wouter";
import { useEffect, useState, createContext, useContext } from "react";
import { queryClient, apiRequest } from "./lib/queryClient";
import { QueryClientProvider, useMutation } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AppSidebar from "@/components/AppSidebar";
import SearchBar from "@/components/SearchBar";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertTopicSchema } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import Home from "@/pages/Home";
import Landing from "@/pages/Landing";
import Profile from "@/pages/Profile";
import Settings from "@/pages/Settings";
import Topic from "@/pages/Topic";
import Trending from "@/pages/Trending";
import LiveDebates from "@/pages/LiveDebates";
import HotDebates from "@/pages/HotDebates";
import MyDebates from "@/pages/MyDebates";
import Search from "@/pages/Search";
import AllCategoriesPage from "@/pages/AllCategoriesPage";
import CategoryPage from "@/pages/CategoryPage";
import LiveStreamPage from "@/pages/LiveStreamPage";
import DebateRoomPage from "@/pages/DebateRoomPage";
import NotFound from "@/pages/not-found";

interface TopicCreationContextType {
  openTopicCreation: (prefillTitle?: string) => void;
}

const TopicCreationContext = createContext<TopicCreationContextType | null>(null);

export const useTopicCreation = () => {
  const context = useContext(TopicCreationContext);
  if (!context) {
    return { openTopicCreation: () => console.warn('Topic creation not available') };
  }
  return context;
};

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading || !isAuthenticated) {
    return (
      <Switch>
        <Route path="/" component={Landing} />
        <Route component={Landing} />
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/search" component={Search} />
      <Route path="/trending" component={Trending} />
      <Route path="/live" component={LiveDebates} />
      <Route path="/hot-debates" component={HotDebates} />
      <Route path="/debates" component={MyDebates} />
      <Route path="/categories" component={AllCategoriesPage} />
      <Route path="/category/:category" component={CategoryPage} />
      <Route path="/topic/:id" component={Topic} />
      <Route path="/profile/:userId" component={Profile} />
      <Route path="/settings" component={Settings} />
      <Route path="/live-stream/:id" component={LiveStreamPage} />
      <Route path="/debate-room/:id" component={DebateRoomPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

const topicFormSchema = insertTopicSchema.omit({
  createdById: true,  // Server will set this from authenticated user
}).extend({
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  description: z.string().min(1, "Description is required"),
  categories: z.array(z.string()).min(1, "At least one category is required"),
});

const categories = [
  "Politics", "Technology", "Science", "Economics", "Social Issues", 
  "Environment", "Education", "Healthcare", "Ethics", "Culture"
];

function AuthenticatedApp() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const searchParams = useSearch();
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateTopic, setShowCreateTopic] = useState(false);
  const [categoryInput, setCategoryInput] = useState("");
  const { toast } = useToast();
  
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

  // Topic creation form
  const topicForm = useForm<z.infer<typeof topicFormSchema>>({
    resolver: zodResolver(topicFormSchema),
    defaultValues: {
      title: "",
      description: "",
      categories: [],
    },
  });

  // Create topic mutation
  const createTopicMutation = useMutation({
    mutationFn: async (data: z.infer<typeof topicFormSchema>) => {
      const response = await apiRequest('POST', '/api/topics', data);
      return response.json();
    },
    onSuccess: (newTopic: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/topics"] });
      setShowCreateTopic(false);
      topicForm.reset();
      setCategoryInput("");
      setLocation(`/topic/${newTopic.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateTopic = (searchQuery?: string) => {
    topicForm.reset({
      title: searchQuery || "",
      description: "",
      categories: [],
    });
    setCategoryInput("");
    setShowCreateTopic(true);
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
          onCreateTopic={() => handleCreateTopic()}
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
                onCreateTopic={handleCreateTopic}
                placeholder="Search debate topics..."
                className=""
              />
            </div>
          </header>
          <main className="flex-1 overflow-auto p-3 sm:p-4 md:p-6">
            <div className="max-w-7xl mx-auto">
              <TopicCreationContext.Provider value={{ openTopicCreation: handleCreateTopic }}>
                <Router />
              </TopicCreationContext.Provider>
            </div>
          </main>
        </div>
      </div>

      {/* Global Topic Creation Dialog */}
      <Dialog open={showCreateTopic} onOpenChange={setShowCreateTopic}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Topic</DialogTitle>
            <DialogDescription>
              Start a new debate topic for the community to discuss.
            </DialogDescription>
          </DialogHeader>
          <Form {...topicForm}>
            <form onSubmit={topicForm.handleSubmit((data) => createTopicMutation.mutate(data))} className="space-y-4">
              <FormField
                control={topicForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter debate topic..." {...field} data-testid="input-topic-title" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={topicForm.control}
                name="categories"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categories</FormLabel>
                    <FormControl>
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <Input 
                            placeholder="Type a category and press Enter..."
                            value={categoryInput}
                            onChange={(e) => setCategoryInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const trimmed = categoryInput.trim();
                                if (trimmed && !field.value.includes(trimmed)) {
                                  field.onChange([...field.value, trimmed]);
                                  setCategoryInput("");
                                }
                              }
                            }}
                            data-testid="input-topic-categories"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const trimmed = categoryInput.trim();
                              if (trimmed && !field.value.includes(trimmed)) {
                                field.onChange([...field.value, trimmed]);
                                setCategoryInput("");
                              }
                            }}
                            data-testid="button-add-category"
                          >
                            Add
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {field.value.map((category) => (
                            <Badge 
                              key={category} 
                              variant="secondary"
                              className="cursor-pointer hover-elevate"
                              onClick={() => {
                                field.onChange(field.value.filter((c) => c !== category));
                              }}
                              data-testid={`badge-category-${category}`}
                            >
                              {category} ×
                            </Badge>
                          ))}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Suggested: {categories.filter(c => !field.value.includes(c)).slice(0, 3).join(", ")}
                        </p>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={topicForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Provide more details about this topic..." 
                        {...field} 
                        data-testid="textarea-topic-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <p className="text-sm text-muted-foreground">
                An AI-generated image will be created automatically based on your topic title.
              </p>
              
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowCreateTopic(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createTopicMutation.isPending} data-testid="button-submit-topic">
                  {createTopicMutation.isPending ? "Creating..." : "Create Topic"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
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
