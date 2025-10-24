import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProfilePictureUpload } from "@/components/ProfilePictureUpload";
import { ThemeEditorDialog } from "@/components/ThemeEditorDialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { Save, User, Cloudy, Sun, Moon, Palette, Edit, Trash2, Plus, Heart, TrendingUp, Check } from "lucide-react";
import type { Theme } from "@shared/schema";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

const profileFormSchema = z.object({
  displayFirstName: z.string().min(1, "First name is required").max(50, "First name must be 50 characters or less"),
  displayLastName: z.string().max(50, "Last name must be 50 characters or less").optional().or(z.literal("")),
  bio: z.string().max(500, "Bio must be less than 500 characters").optional(),
  opinionSortPreference: z.enum(["newest", "oldest", "most_liked", "most_controversial"]).optional(),
  categorySortPreference: z.enum(["popular", "alphabetical", "newest", "oldest"]).optional(),
});

interface ProfileData {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    profileImageUrl?: string;
    createdAt: string;
  };
  profile?: {
    id: string;
    userId: string;
    bio?: string;
    displayFirstName?: string;
    displayLastName?: string;
    opinionSortPreference?: string;
    categorySortPreference?: string;
    politicalLeaning?: number;
    politicalLeaningLabel?: string;
  };
}

export default function Settings() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const { currentTheme, applyTheme: applyCustomTheme } = useTheme();
  const [themePreference, setThemePreference] = useState<"light" | "medium" | "dark">("light");
  const [themeEditorOpen, setThemeEditorOpen] = useState(false);
  const [editingTheme, setEditingTheme] = useState<Theme | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [themeToDelete, setThemeToDelete] = useState<Theme | null>(null);

  // Fetch current user's profile
  const { data: profileData, isLoading } = useQuery<ProfileData>({
    queryKey: ['/api/profile', currentUser?.id],
    queryFn: () => fetch(`/api/profile/${currentUser?.id}`, { credentials: 'include' }).then(res => res.json()),
    enabled: !!currentUser?.id,
  });

  // Fetch user's custom themes
  const { data: userThemes = [], isLoading: themesLoading } = useQuery<Theme[]>({
    queryKey: ['/api/themes/my-themes'],
    queryFn: () => fetch('/api/themes/my-themes', { credentials: 'include' }).then(res => res.json()),
    enabled: !!currentUser?.id,
  });

  // Profile update form
  const form = useForm<z.infer<typeof profileFormSchema>>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      displayFirstName: "",
      displayLastName: "",
      bio: "",
      opinionSortPreference: "newest",
      categorySortPreference: "popular",
    },
  });

  // Update form when profile data loads (only if not currently editing)
  useEffect(() => {
    if (profileData && !form.formState.isDirty) {
      form.reset({
        displayFirstName: profileData.profile?.displayFirstName || profileData.user?.firstName || "",
        displayLastName: profileData.profile?.displayLastName || profileData.user?.lastName || "",
        bio: profileData.profile?.bio || "",
        opinionSortPreference: (profileData.profile?.opinionSortPreference || "newest") as "newest" | "oldest" | "most_liked" | "most_controversial",
        categorySortPreference: (profileData.profile?.categorySortPreference || "popular") as "popular" | "alphabetical" | "newest" | "oldest",
      });
    }
  }, [profileData, form]);

  // Load theme preference from localStorage
  useEffect(() => {
    const savedTheme = (localStorage.getItem("theme") as "light" | "medium" | "dark") || "light";
    setThemePreference(savedTheme);
    applyTheme(savedTheme);
  }, []);

  // Apply theme based on preference
  const applyTheme = (preference: "light" | "medium" | "dark") => {
    const root = document.documentElement;
    
    // Remove all theme classes
    root.classList.remove("light", "medium", "dark");
    
    // Add the new theme class (except for light which is default)
    if (preference !== "light") {
      root.classList.add(preference);
    }
    
    localStorage.setItem("theme", preference);
  };

  // Handle theme preference change
  const handleThemeChange = (value: "light" | "medium" | "dark") => {
    setThemePreference(value);
    applyTheme(value);
  };

  // Profile picture upload is now handled by ProfilePictureUpload component

  // Profile update mutation
  const updateProfileMutation = useMutation({
    mutationFn: (data: z.infer<typeof profileFormSchema>) => 
      fetch(`/api/profile/${currentUser?.id}`, { 
        method: 'PATCH', 
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/profile', currentUser?.id] });
    },
    onError: (error) => {
      console.error("Failed to update profile:", error);
    }
  });

  // Delete theme mutation
  const deleteThemeMutation = useMutation({
    mutationFn: (themeId: string) => 
      apiRequest('DELETE', `/api/themes/${themeId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/themes/my-themes'] });
      toast({
        title: "Theme deleted",
        description: "Your theme has been deleted successfully.",
      });
      setDeleteDialogOpen(false);
      setThemeToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete theme",
        variant: "destructive",
      });
    }
  });

  // Apply theme mutation
  const applyThemeMutation = useMutation({
    mutationFn: (themeId: string) => 
      apiRequest('POST', `/api/themes/${themeId}/apply`),
    onSuccess: (_, themeId) => {
      const theme = userThemes.find(t => t.id === themeId);
      if (theme) {
        applyCustomTheme(theme);
        toast({
          title: "Theme applied",
          description: `"${theme.name}" has been applied successfully.`,
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to apply theme",
        variant: "destructive",
      });
    }
  });

  const onSubmit = (data: z.infer<typeof profileFormSchema>) => {
    updateProfileMutation.mutate(data);
  };

  const handleCreateTheme = () => {
    setEditingTheme(null);
    setThemeEditorOpen(true);
  };

  const handleEditTheme = (theme: Theme) => {
    setEditingTheme(theme);
    setThemeEditorOpen(true);
  };

  const handleDeleteClick = (theme: Theme) => {
    setThemeToDelete(theme);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (themeToDelete) {
      deleteThemeMutation.mutate(themeToDelete.id);
    }
  };

  const handleApplyTheme = (theme: Theme) => {
    applyThemeMutation.mutate(theme.id);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 max-w-4xl">
        <div className="animate-pulse space-y-6">
          <div className="h-32 bg-muted rounded-lg"></div>
          <div className="h-96 bg-muted rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account settings and preferences</p>
      </div>

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Profile Information
          </CardTitle>
          <CardDescription>Update your profile bio and personal information</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Profile Picture Section */}
          <div className="mb-6 pb-6 border-b">
            <h3 className="text-sm font-medium mb-4">Profile Picture</h3>
            <ProfilePictureUpload
              currentImageUrl={profileData?.user?.profileImageUrl}
              userId={currentUser?.id || ''}
              fallbackInitial={profileData?.user?.firstName?.[0]?.toUpperCase() || profileData?.user?.email?.[0]?.toUpperCase() || '?'}
            />
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="displayFirstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display First Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter your first name"
                          data-testid="input-display-first-name"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        This name will be displayed on your profile
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="displayLastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display Last Name (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter your last name"
                          data-testid="input-display-last-name"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Optional last name
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="bio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bio</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Tell us about yourself and your interests..."
                        className="resize-none min-h-[120px]"
                        data-testid="input-bio"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      A brief description about yourself (max 500 characters)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="opinionSortPreference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Opinion Sorting Preference</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-opinion-sort">
                          <SelectValue placeholder="Select sorting preference" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="newest" data-testid="option-sort-newest">Newest First</SelectItem>
                        <SelectItem value="oldest" data-testid="option-sort-oldest">Oldest First</SelectItem>
                        <SelectItem value="most_liked" data-testid="option-sort-most-liked">Most Liked</SelectItem>
                        <SelectItem value="most_controversial" data-testid="option-sort-controversial">Most Controversial</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Choose how opinions are sorted when viewing topics and profiles
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="categorySortPreference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category Sorting Preference</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-category-sort">
                          <SelectValue placeholder="Select sorting preference" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="popular" data-testid="option-sort-popular">Most Popular</SelectItem>
                        <SelectItem value="alphabetical" data-testid="option-sort-alphabetical">Alphabetical</SelectItem>
                        <SelectItem value="newest" data-testid="option-sort-cat-newest">Newest First</SelectItem>
                        <SelectItem value="oldest" data-testid="option-sort-cat-oldest">Oldest First</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Choose how categories are sorted on the Browse All page
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                disabled={updateProfileMutation.isPending}
                data-testid="button-save-profile"
              >
                <Save className="w-4 h-4 mr-2" />
                {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* User Preferences */}
      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>Customize your Opinion Feud experience</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Theme Preference */}
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-medium mb-1">Theme</h3>
              <p className="text-sm text-muted-foreground">
                Choose how Opinion Feud looks to you
              </p>
            </div>
            <Select value={themePreference} onValueChange={handleThemeChange}>
              <SelectTrigger className="w-full sm:w-80" data-testid="select-theme">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light" data-testid="option-theme-light">
                  <div className="flex items-center gap-2">
                    <Sun className="w-4 h-4" />
                    <span>Light</span>
                  </div>
                </SelectItem>
                <SelectItem value="medium" data-testid="option-theme-medium">
                  <div className="flex items-center gap-2">
                    <Cloudy className="w-4 h-4" />
                    <span>Medium</span>
                  </div>
                </SelectItem>
                <SelectItem value="dark" data-testid="option-theme-dark">
                  <div className="flex items-center gap-2">
                    <Moon className="w-4 h-4" />
                    <span>Dark</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Custom Themes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5" />
            Custom Themes
          </CardTitle>
          <CardDescription>Create and manage your own custom color themes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handleCreateTheme}
            className="w-full sm:w-auto"
            data-testid="button-create-theme"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create New Theme
          </Button>

          {themesLoading ? (
            <div className="grid grid-cols-1 gap-4">
              {[1, 2].map((i) => (
                <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : userThemes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Palette className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No custom themes yet</p>
              <p className="text-sm">Create your first theme to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {userThemes.map((theme) => {
                const colors = theme.colors as any;
                const isApplied = currentTheme?.id === theme.id;
                
                return (
                  <Card key={theme.id} className={isApplied ? "border-primary" : ""} data-testid={`card-theme-${theme.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          {/* Color preview swatch */}
                          <div
                            className="w-12 h-12 rounded-md border flex-shrink-0"
                            style={{
                              backgroundColor: colors.background 
                                ? `hsl(${colors.background.h}, ${colors.background.s}%, ${colors.background.l}%)`
                                : '#ffffff'
                            }}
                            data-testid={`swatch-theme-${theme.id}`}
                          />
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold truncate" data-testid={`text-theme-name-${theme.id}`}>
                                {theme.name}
                              </h4>
                              {isApplied && (
                                <Check className="w-4 h-4 text-primary flex-shrink-0" data-testid={`icon-applied-${theme.id}`} />
                              )}
                            </div>
                            {theme.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                                {theme.description}
                              </p>
                            )}
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Heart className="w-3 h-3" />
                                {theme.likesCount || 0}
                              </span>
                              <span className="flex items-center gap-1">
                                <TrendingUp className="w-3 h-3" />
                                {theme.usageCount || 0}
                              </span>
                              <span className="capitalize">{theme.visibility}</span>
                            </div>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {!isApplied && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleApplyTheme(theme)}
                              disabled={applyThemeMutation.isPending}
                              data-testid={`button-apply-theme-${theme.id}`}
                            >
                              Apply
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditTheme(theme)}
                            data-testid={`button-edit-theme-${theme.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteClick(theme)}
                            disabled={deleteThemeMutation.isPending}
                            data-testid={`button-delete-theme-${theme.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Theme Editor Dialog */}
      <ThemeEditorDialog
        open={themeEditorOpen}
        onOpenChange={setThemeEditorOpen}
        editingTheme={editingTheme}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Theme</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{themeToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
