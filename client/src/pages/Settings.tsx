import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProfilePictureUpload } from "@/components/ProfilePictureUpload";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Save, User, Monitor, Sun, Moon } from "lucide-react";

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
  const [themePreference, setThemePreference] = useState<"light" | "dark" | "auto">("light");

  // Fetch current user's profile
  const { data: profileData, isLoading } = useQuery<ProfileData>({
    queryKey: ['/api/profile', currentUser?.id],
    queryFn: () => fetch(`/api/profile/${currentUser?.id}`, { credentials: 'include' }).then(res => res.json()),
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
    const savedTheme = localStorage.getItem("themePreference") as "light" | "dark" | "auto" || "auto";
    setThemePreference(savedTheme);
    applyTheme(savedTheme);
  }, []);

  // Apply theme based on preference
  const applyTheme = (preference: "light" | "dark" | "auto") => {
    const root = document.documentElement;
    
    if (preference === "auto") {
      // Check system time (6 AM to 6 PM = light, otherwise dark)
      const hour = new Date().getHours();
      const isDay = hour >= 6 && hour < 18;
      if (isDay) {
        root.classList.remove("dark");
      } else {
        root.classList.add("dark");
      }
    } else if (preference === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    
    localStorage.setItem("themePreference", preference);
    // Also save to old "theme" key for backward compatibility
    if (preference !== "auto") {
      localStorage.setItem("theme", preference);
    }
  };

  // Handle theme preference change
  const handleThemeChange = (value: "light" | "dark" | "auto") => {
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

  const onSubmit = (data: z.infer<typeof profileFormSchema>) => {
    updateProfileMutation.mutate(data);
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
          <CardDescription>Customize your Kirk Debates experience</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Theme Preference */}
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-medium mb-1">Theme</h3>
              <p className="text-sm text-muted-foreground">
                Choose how Kirk Debates looks to you
              </p>
            </div>
            <Select value={themePreference} onValueChange={handleThemeChange}>
              <SelectTrigger className="w-full sm:w-80" data-testid="select-theme">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">
                  <div className="flex items-center gap-2">
                    <Sun className="w-4 h-4" />
                    <span>Light</span>
                  </div>
                </SelectItem>
                <SelectItem value="dark">
                  <div className="flex items-center gap-2">
                    <Moon className="w-4 h-4" />
                    <span>Dark</span>
                  </div>
                </SelectItem>
                <SelectItem value="auto">
                  <div className="flex items-center gap-2">
                    <Monitor className="w-4 h-4" />
                    <span>Time-based (6 AM - 6 PM light, rest dark)</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
