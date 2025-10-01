import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ObjectUploader } from "@/components/ObjectUploader";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Save, User, Monitor, Sun, Moon, Upload } from "lucide-react";
import type { UploadResult } from "@uppy/core";

const profileFormSchema = z.object({
  bio: z.string().max(500, "Bio must be less than 500 characters").optional(),
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
    politicalLeaning?: number;
    politicalLeaningLabel?: string;
  };
}

export default function Settings() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
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
      bio: "",
    },
  });

  // Update form when profile data loads (only if not currently editing)
  useEffect(() => {
    if (profileData?.profile?.bio && !form.formState.isDirty) {
      form.reset({
        bio: profileData.profile.bio,
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
    toast({
      title: "Theme updated",
      description: `Theme preference set to ${value === "auto" ? "time-based" : value} mode.`
    });
  };

  // Profile picture upload
  const handleGetUploadParameters = async () => {
    const response = await apiRequest("POST", "/api/objects/upload");
    return {
      method: "PUT" as const,
      url: response.uploadURL,
    };
  };

  const handleProfilePictureComplete = async (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    if (result.successful && result.successful.length > 0) {
      const uploadedFile = result.successful[0];
      try {
        // Extract object ID from the upload URL
        // URL format: https://storage.googleapis.com/.../uploads/{objectId}?...
        const url = new URL(uploadedFile.uploadURL);
        const pathParts = url.pathname.split('/');
        const objectId = pathParts[pathParts.length - 1]; // Get the last part (object ID)
        
        await apiRequest("PUT", "/api/profile-picture", {
          objectId: objectId,
        });
        queryClient.invalidateQueries({ queryKey: ['/api/profile', currentUser?.id] });
        queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
        toast({
          title: "Profile picture updated",
          description: "Your profile picture has been updated successfully."
        });
      } catch (error) {
        console.error("Error updating profile picture:", error);
        toast({
          title: "Update failed",
          description: "Failed to update profile picture.",
          variant: "destructive"
        });
      }
    }
  };

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
      toast({ title: "Profile updated successfully!" });
    },
    onError: () => {
      toast({ 
        title: "Update failed", 
        description: "Unable to update profile.",
        variant: "destructive" 
      });
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
            <div className="flex items-center gap-6">
              <Avatar className="w-24 h-24" data-testid="avatar-profile-picture">
                <AvatarImage src={profileData?.user?.profileImageUrl} />
                <AvatarFallback className="text-2xl">
                  {profileData?.user?.firstName?.[0]?.toUpperCase() || profileData?.user?.email?.[0]?.toUpperCase() || '?'}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">
                  Upload a new profile picture (max 10MB)
                </p>
                <ObjectUploader
                  maxNumberOfFiles={1}
                  maxFileSize={10485760}
                  onGetUploadParameters={handleGetUploadParameters}
                  onComplete={handleProfilePictureComplete}
                  buttonVariant="outline"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Image
                </ObjectUploader>
              </div>
            </div>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
          <CardDescription>Customize your Kirk experience</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Theme Preference */}
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-medium mb-1">Theme</h3>
              <p className="text-sm text-muted-foreground">
                Choose how Kirk looks to you
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
