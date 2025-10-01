import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Save, User } from "lucide-react";

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
        <CardContent>
          <p className="text-sm text-muted-foreground">Additional preferences coming soon...</p>
        </CardContent>
      </Card>
    </div>
  );
}
