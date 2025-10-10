import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Heart, Copy, Palette, Plus, Search } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { formatHSL } from "@shared/colorUtils";

interface ThemeWithUser {
  id: string;
  name: string;
  description: string | null;
  userId: string;
  colors: Record<string, any>;
  baseTheme: 'light' | 'medium' | 'dark';
  visibility: 'public' | 'private';
  likesCount: number;
  usageCount: number;
  forkedFromThemeId: string | null;
  createdAt: Date;
  userEmail?: string;
  userFirstName?: string;
  userLastName?: string;
  liked?: boolean;
}

export default function ThemeGallery() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [forkingTheme, setForkingTheme] = useState<ThemeWithUser | null>(null);
  const [forkName, setForkName] = useState("");
  const [forkDescription, setForkDescription] = useState("");
  const { applyTheme, currentTheme } = useTheme();
  const { toast } = useToast();
  const { user } = useAuth();

  // Fetch public themes
  const { data: themes, isLoading } = useQuery<ThemeWithUser[]>({
    queryKey: ['/api/themes/public', { search: searchQuery }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      const response = await fetch(`/api/themes/public?${params}`, { credentials: 'include' });
      if (!response.ok) throw new Error("Failed to fetch themes");
      return response.json();
    },
  });

  // Like mutation
  const likeMutation = useMutation({
    mutationFn: async (themeId: string) => {
      return apiRequest('POST', `/api/themes/${themeId}/like`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/themes/public'] });
      toast({
        title: "Theme liked",
        description: "You liked this theme",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to like theme",
        variant: "destructive",
      });
    },
  });

  // Unlike mutation
  const unlikeMutation = useMutation({
    mutationFn: async (themeId: string) => {
      return apiRequest('DELETE', `/api/themes/${themeId}/like`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/themes/public'] });
      toast({
        title: "Theme unliked",
        description: "You unliked this theme",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to unlike theme",
        variant: "destructive",
      });
    },
  });

  // Apply theme mutation
  const applyMutation = useMutation({
    mutationFn: async (theme: ThemeWithUser) => {
      await apiRequest('POST', `/api/themes/${theme.id}/apply`, {});
      return theme;
    },
    onSuccess: (theme) => {
      applyTheme(theme as any);
      queryClient.invalidateQueries({ queryKey: ['/api/themes/public'] });
      toast({
        title: "Theme applied",
        description: `${theme.name} has been applied to your account`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to apply theme",
        variant: "destructive",
      });
    },
  });

  // Fork theme mutation
  const forkMutation = useMutation({
    mutationFn: async ({ themeId, name, description }: { themeId: string; name: string; description?: string }) => {
      return apiRequest('POST', `/api/themes/${themeId}/fork`, { name, description });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/themes/public'] });
      queryClient.invalidateQueries({ queryKey: ['/api/themes/my-themes'] });
      setForkingTheme(null);
      setForkName("");
      setForkDescription("");
      toast({
        title: "Theme forked",
        description: "Theme has been forked to your account. You can edit it in Settings.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to fork theme",
        variant: "destructive",
      });
    },
  });

  const handleLikeToggle = (theme: ThemeWithUser) => {
    if (theme.liked) {
      unlikeMutation.mutate(theme.id);
    } else {
      likeMutation.mutate(theme.id);
    }
  };

  const handleApplyTheme = (theme: ThemeWithUser) => {
    applyMutation.mutate(theme);
  };

  const handleForkTheme = (theme: ThemeWithUser) => {
    setForkingTheme(theme);
    setForkName(`${theme.name} (Copy)`);
    setForkDescription(theme.description || "");
  };

  const handleForkSubmit = () => {
    if (!forkingTheme || !forkName.trim()) return;
    forkMutation.mutate({
      themeId: forkingTheme.id,
      name: forkName.trim(),
      description: forkDescription.trim() || undefined,
    });
  };

  const getCreatorName = (theme: ThemeWithUser) => {
    if (theme.userFirstName || theme.userLastName) {
      return `${theme.userFirstName || ''} ${theme.userLastName || ''}`.trim();
    }
    return theme.userEmail || 'Anonymous';
  };

  const getColorSwatch = (colors: Record<string, any>) => {
    // Extract primary colors for preview
    const background = colors.background || { h: 0, s: 0, l: 100 };
    const primary = colors.primary || { h: 220, s: 75, l: 58 };
    
    return (
      <div className="flex gap-1 mt-2">
        <div
          className="w-8 h-8 rounded-md border border-border"
          style={{ backgroundColor: `hsl(${background.h}, ${background.s}%, ${background.l}%)` }}
          title="Background color"
        />
        <div
          className="w-8 h-8 rounded-md border border-border"
          style={{ backgroundColor: `hsl(${primary.h}, ${primary.s}%, ${primary.l}%)` }}
          title="Primary color"
        />
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Theme Gallery</h1>
            <p className="text-muted-foreground">Browse and apply custom themes created by the community</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-muted rounded w-3/4 mb-2" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Theme Gallery</h1>
          <p className="text-muted-foreground">Browse and apply custom themes created by the community</p>
        </div>
        <Button
          onClick={() => setLocation('/settings')}
          data-testid="button-create-theme"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create New Theme
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search themes by name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
          data-testid="input-search-themes"
        />
      </div>

      {themes && themes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Palette className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No themes found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery ? "Try a different search term" : "Be the first to create a custom theme!"}
            </p>
            <Button onClick={() => setLocation('/settings')} data-testid="button-create-first-theme">
              Create Theme
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {themes?.map((theme) => (
            <Card key={theme.id} data-testid={`card-theme-${theme.id}`}>
              <CardHeader>
                <CardTitle className="flex items-start justify-between gap-2">
                  <span className="flex-1 line-clamp-1">{theme.name}</span>
                  {currentTheme?.id === theme.id && (
                    <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded-md">
                      Active
                    </span>
                  )}
                </CardTitle>
                <CardDescription className="line-clamp-2">
                  {theme.description || 'No description'}
                </CardDescription>
                <div className="text-sm text-muted-foreground pt-2">
                  by {getCreatorName(theme)}
                </div>
              </CardHeader>
              <CardContent>
                {getColorSwatch(theme.colors)}
                <div className="flex items-center gap-3 mt-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Heart className="w-4 h-4" />
                    {theme.likesCount}
                  </span>
                  <span>
                    {theme.usageCount} {theme.usageCount === 1 ? 'use' : 'uses'}
                  </span>
                </div>
              </CardContent>
              <CardFooter className="flex flex-wrap gap-2">
                <Button
                  variant={theme.liked ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleLikeToggle(theme)}
                  disabled={likeMutation.isPending || unlikeMutation.isPending}
                  data-testid={`button-like-${theme.id}`}
                >
                  <Heart className={`w-4 h-4 mr-1 ${theme.liked ? 'fill-current' : ''}`} />
                  {theme.liked ? 'Liked' : 'Like'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleApplyTheme(theme)}
                  disabled={applyMutation.isPending || currentTheme?.id === theme.id}
                  data-testid={`button-apply-${theme.id}`}
                >
                  <Palette className="w-4 h-4 mr-1" />
                  {currentTheme?.id === theme.id ? 'Applied' : 'Apply'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleForkTheme(theme)}
                  disabled={forkMutation.isPending}
                  data-testid={`button-fork-${theme.id}`}
                >
                  <Copy className="w-4 h-4 mr-1" />
                  Fork
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Fork Dialog */}
      <Dialog open={!!forkingTheme} onOpenChange={(open) => !open && setForkingTheme(null)}>
        <DialogContent data-testid="dialog-fork-theme">
          <DialogHeader>
            <DialogTitle>Fork Theme</DialogTitle>
            <DialogDescription>
              Create a copy of "{forkingTheme?.name}" that you can customize
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="fork-name" className="text-sm font-medium">
                Theme Name
              </label>
              <Input
                id="fork-name"
                value={forkName}
                onChange={(e) => setForkName(e.target.value)}
                placeholder="Enter theme name"
                data-testid="input-fork-name"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="fork-description" className="text-sm font-medium">
                Description (optional)
              </label>
              <Input
                id="fork-description"
                value={forkDescription}
                onChange={(e) => setForkDescription(e.target.value)}
                placeholder="Enter description"
                data-testid="input-fork-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setForkingTheme(null)}
              data-testid="button-cancel-fork"
            >
              Cancel
            </Button>
            <Button
              onClick={handleForkSubmit}
              disabled={!forkName.trim() || forkMutation.isPending}
              data-testid="button-submit-fork"
            >
              {forkMutation.isPending ? 'Forking...' : 'Fork Theme'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
