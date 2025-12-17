import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { 
  Upload, 
  Search, 
  Check, 
  ThumbsUp, 
  ThumbsDown, 
  MessageCircle, 
  Video, 
  Users, 
  Sparkles,
  ChevronLeft,
  ChevronRight,
  X
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Topic, Opinion } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";

interface User {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role?: string | null;
  status?: string | null;
  onboardingStep?: number | null;
  onboardingComplete?: boolean | null;
  bio?: string | null;
  location?: string | null;
  profileImageUrl?: string | null;
  followedCategories?: string[] | null;
}

export default function Onboarding() {
  const [, navigate] = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  const [canProceed, setCanProceed] = useState(false);
  const stepRestoredRef = useRef(false); // Track if we've restored the step

  // Step 1: Profile data
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [profileImageUrl, setProfileImageUrl] = useState("");
  
  // Photo upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showPhotoPreview, setShowPhotoPreview] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2: Category data
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [categorySearch, setCategorySearch] = useState("");

  // Step 3: Opinion data
  const [createdOpinions, setCreatedOpinions] = useState<Set<string>>(new Set());

  // Use useAuth hook to get user data consistently with the rest of the app
  const { user, isLoading: isUserLoading } = useAuth();

  const { data: topics = [] } = useQuery<Topic[]>({
    queryKey: ['/api/topics'],
  });

  // Derive unique categories from topics
  const categories = Array.from(
    new Set(
      topics.flatMap(topic => topic.categories || [])
    )
  ).sort();

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('PUT', '/api/users/onboarding/profile', data);
    },
    onSuccess: () => {
      // Use exact query key format to match useAuth
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"], exact: true });
    }
  });

  // Update categories mutation
  const updateCategoriesMutation = useMutation({
    mutationFn: async (categories: string[]) => {
      return await apiRequest('PUT', '/api/users/onboarding/categories', { categories });
    },
    onSuccess: () => {
      // Use exact query key format to match useAuth
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"], exact: true });
    }
  });

  // Update onboarding progress mutation
  const updateProgressMutation = useMutation({
    mutationFn: async ({ step, complete }: { step: number; complete: boolean }) => {
      const response = await apiRequest('PUT', '/api/users/onboarding/progress', { step, complete });
      
      // Check content type from headers (without reading body)
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        // Clone response to read the body for error message
        const clonedResponse = response.clone();
        const text = await clonedResponse.text();
        console.error('Expected JSON but got:', contentType);
        console.error('Response body:', text.substring(0, 500));
        throw new Error(`Server returned ${contentType} instead of JSON. This usually means the API endpoint '/api/users/onboarding/progress' was not found. Response: ${text.substring(0, 200)}`);
      }
      
      // Parse JSON response
      const data = await response.json();
      return data;
    },
    // Don't invalidate here - we'll handle refetch in the completion handlers
    // to ensure we wait for fresh data before navigating
  });

  // Create opinion mutation
  const createOpinionMutation = useMutation({
    mutationFn: async (data: { topicId: string; content: string; stance: string }) => {
      return await apiRequest('POST', `/api/topics/${data.topicId}/opinions`, {
        content: data.content,
        stance: data.stance
      });
    },
    onSuccess: (_, variables) => {
      setCreatedOpinions(prev => new Set([...Array.from(prev), variables.topicId]));
      queryClient.invalidateQueries({ queryKey: ['/api/topics'] });
      // Invalidate opinions for this specific topic
      queryClient.invalidateQueries({ queryKey: ['/api/topics', variables.topicId, 'opinions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats/platform'] });
    }
  });

  // Check if user can proceed based on current step
  useEffect(() => {
    switch (currentStep) {
      case 1:
        setCanProceed(firstName.trim().length > 0 && lastName.trim().length > 0);
        break;
      case 2:
        setCanProceed(selectedCategories.length >= 3);
        break;
      case 3:
        // Opinions are encouraged but not required
        setCanProceed(true);
        break;
      case 4:
        setCanProceed(true);
        break;
      default:
        setCanProceed(false);
    }
  }, [currentStep, firstName, lastName, selectedCategories, createdOpinions]);

  const redirectLockRef = useRef(false); // Prevent redirect loops
  
  // Redirect users who have already completed onboarding
  // Also redirect if user data hasn't loaded yet but we're loading (to prevent flash)
  useEffect(() => {
    // Wait for user data to load
    if (isUserLoading) {
      return;
    }

    // If user is not authenticated, let the app handle navigation
    if (!user) {
      redirectLockRef.current = false;
      return;
    }

    // Prevent redirect loops
    if (redirectLockRef.current) {
      return;
    }

    // Explicitly check for === true to handle null/undefined cases properly
    // Server always returns a boolean (never null/undefined), so this check is safe
    if (user.onboardingComplete === true) {
      redirectLockRef.current = true;
      navigate("/");
      // Release lock after navigation
      setTimeout(() => {
        redirectLockRef.current = false;
      }, 1000);
    }
  }, [user, isUserLoading, navigate]);

  // Pre-fill user data if available
  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || "");
      setLastName(user.lastName || "");
      setBio(user.bio || "");
      setLocation(user.location || "");
      setProfileImageUrl(user.profileImageUrl || "");
      if (user.followedCategories && user.followedCategories.length > 0) {
        setSelectedCategories(user.followedCategories);
      }
      // Restore onboarding step progress (only once, only if not completed)
      // Explicitly check for !== true to handle null/undefined cases properly
      if (!stepRestoredRef.current && user.onboardingStep && user.onboardingStep > 0 && user.onboardingComplete !== true) {
        setCurrentStep(user.onboardingStep);
        stepRestoredRef.current = true; // Mark as restored
      }
    }
  }, [user]);

  const handleNext = async () => {
    // Save progress for current step
    if (currentStep === 1) {
      await updateProfileMutation.mutateAsync({
        firstName,
        lastName,
        bio,
        location,
        profileImageUrl
      });
    } else if (currentStep === 2) {
      await updateCategoriesMutation.mutateAsync(selectedCategories);
    }

    await updateProgressMutation.mutateAsync({
      step: currentStep,
      complete: false
    });

    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    try {
      // First, update the onboarding progress in the database
      const response = await updateProgressMutation.mutateAsync({
        step: 4,
        complete: true
      });
      
      console.log("Onboarding completion response:", response);
      
      // Verify the response contains the updated values
      if (response && typeof response === 'object') {
        if ('onboardingComplete' in response && !response.onboardingComplete) {
          console.error("Database update did not set onboardingComplete to true!", response);
          alert("Failed to save onboarding completion. Please try again.");
          return;
        }
        console.log("Response shows onboardingComplete:", response.onboardingComplete);
      }
      
      // Wait a moment for the database to commit
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Invalidate the query cache to mark it as stale
      queryClient.invalidateQueries({ 
        queryKey: ["/api/auth/user"],
        exact: true 
      });
      
      // Force a refetch of the user query to get updated onboarding status
      // This ensures we have the latest data from the server
      const refetchResult = await queryClient.refetchQueries({ 
        queryKey: ["/api/auth/user"],
        exact: true
      });
      
      console.log("Refetch result:", refetchResult);
      
      // Wait a bit more to ensure React state has updated
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Verify the user data is updated before navigating
      const updatedUser = queryClient.getQueryData(["/api/auth/user"]) as any;
      console.log("Updated user data after refetch:", updatedUser);
      
      // Double-check that onboarding is actually completed
      if (updatedUser && updatedUser.onboardingComplete !== true) {
        console.error("Onboarding completion not saved! User data:", updatedUser);
        alert("Warning: Onboarding completion may not have been saved. Please refresh the page and check.");
        // Still navigate, but log the error
      }
      
      // Now navigate - the App component will handle redirect if still needed
      navigate("/");
    } catch (error) {
      console.error("Error completing onboarding:", error);
      alert("Failed to complete onboarding. Please try again.");
      // Don't navigate on error - let user see the error
    }
  };

  const handleSkip = async () => {
    try {
      // First, update the onboarding progress in the database
      const response = await updateProgressMutation.mutateAsync({
        step: currentStep,
        complete: true
      });
      
      console.log("Onboarding skip response:", response);
      
      // Invalidate the query cache to mark it as stale
      queryClient.invalidateQueries({ 
        queryKey: ["/api/auth/user"],
        exact: true 
      });
      
      // Force a refetch of the user query to get updated onboarding status
      const refetchResult = await queryClient.refetchQueries({ 
        queryKey: ["/api/auth/user"],
        exact: true
      });
      
      console.log("Refetch result:", refetchResult);
      
      // Wait a bit more to ensure React state has updated
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Verify the user data is updated before navigating
      const updatedUser = queryClient.getQueryData(["/api/auth/user"]);
      console.log("Updated user data after refetch:", updatedUser);
      
      // Now navigate - the App component will handle redirect if still needed
      navigate("/");
    } catch (error) {
      console.error("Error skipping onboarding:", error);
      alert("Failed to skip onboarding. Please try again.");
      // Don't navigate on error - let user see the error
    }
  };

  const toggleCategory = (category: string) => {
    if (selectedCategories.includes(category)) {
      setSelectedCategories(selectedCategories.filter(c => c !== category));
    } else {
      setSelectedCategories([...selectedCategories, category]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      if (file.size > 10485760) { // 10MB
        alert('File size must be less than 10MB');
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setShowPhotoPreview(true);
    }
  };

  const handlePhotoUpload = async () => {
    if (!selectedFile) return;

    setIsUploadingPhoto(true);
    try {
      // Get upload URL
      const uploadParamsResponse = await apiRequest("POST", "/api/objects/upload");
      const uploadParams = await uploadParamsResponse.json();
      
      // Upload file directly to storage
      const uploadResponse = await fetch(uploadParams.uploadURL, {
        method: 'PUT',
        body: selectedFile,
        headers: {
          'Content-Type': selectedFile.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Upload failed');
      }

      // Extract object ID from upload URL
      const url = new URL(uploadParams.uploadURL);
      const pathParts = url.pathname.split('/');
      const objectId = pathParts[pathParts.length - 1];

      // Associate uploaded image with profile
      const response = await apiRequest("PUT", "/api/profile-picture", {
        objectId: objectId,
      });
      const data = await response.json();

      // Update local state with the new image URL
      setProfileImageUrl(data.objectPath);

      // Clean up
      setShowPhotoPreview(false);
      setSelectedFile(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(null);
      
      // Invalidate queries to refresh user data
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleCancelPhotoUpload = () => {
    setShowPhotoPreview(false);
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const filteredCategories = categories.filter(cat =>
    cat.toLowerCase().includes(categorySearch.toLowerCase())
  );

  const popularCategories = categories.slice(0, 12);

  // Get topics for selected categories
  const topicsByCategory = selectedCategories.reduce((acc, category) => {
    const categoryTopics = topics.filter(t => 
      t.categories?.includes(category)
    ).slice(0, 8);
    if (categoryTopics.length > 0) {
      acc[category] = categoryTopics;
    }
    return acc;
  }, {} as Record<string, Topic[]>);

  const progressPercentage = (currentStep / 4) * 100;

  // Show loading state while user data is loading to prevent flash
  if (isUserLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render onboarding content if user is not authenticated
  // (let the app handle redirect to login)
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
        {/* Header with progress */}
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <h1 className="text-4xl font-bold tracking-tight">Welcome to Fuller Feuds</h1>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              data-testid="button-skip-onboarding"
              className="transition-smooth"
            >
              Skip for now
            </Button>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Step {currentStep} of 4</span>
              <span>{Math.round(progressPercentage)}%</span>
            </div>
            <Progress value={progressPercentage} className="h-3 shadow-sm" data-testid="progress-onboarding" />
          </div>
        </div>

        {/* Step content */}
        {currentStep === 1 && (
          <Card data-testid="card-onboarding-step-1" className="border border-border/50 shadow-md">
            <CardHeader className="space-y-2">
              <CardTitle className="text-2xl">Set Up Your Profile</CardTitle>
              <CardDescription className="text-base">
                Tell us a bit about yourself to personalize your experience
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Profile picture */}
              <div className="flex items-center gap-4">
                <Avatar className="w-20 h-20">
                  <AvatarImage src={profileImageUrl} />
                  <AvatarFallback>
                    {firstName?.[0]?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-muted-foreground">
                    Upload a profile picture (max 10MB)
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                    data-testid="input-profile-picture-file"
                  />
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="button-upload-profile-picture"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Photo
                  </Button>
                </div>
              </div>

              {/* Name fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="John"
                    data-testid="input-first-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                    data-testid="input-last-name"
                  />
                </div>
              </div>

              {/* Bio */}
              <div className="space-y-2">
                <Label htmlFor="bio">Bio (optional)</Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell us about yourself..."
                  rows={3}
                  data-testid="textarea-bio"
                />
              </div>

              {/* Location */}
              <div className="space-y-2">
                <Label htmlFor="location">Location (optional)</Label>
                <Input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="San Francisco, CA"
                  data-testid="input-location"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 2 && (
          <Card data-testid="card-onboarding-step-2">
            <CardHeader>
              <CardTitle>Choose Your Interests</CardTitle>
              <CardDescription>
                Select at least 3 categories to customize your debate feed
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Search bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                  placeholder="Search for more categories..."
                  className="pl-10"
                  data-testid="input-search-categories"
                />
              </div>

              {/* Selected count */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {selectedCategories.length} {selectedCategories.length === 1 ? 'category' : 'categories'} selected
                </p>
                {selectedCategories.length >= 3 && (
                  <Badge variant="secondary" className="gap-1">
                    <Check className="w-3 h-3" />
                    Ready to continue
                  </Badge>
                )}
              </div>

              {/* Suggested categories */}
              {categorySearch === "" && (
                <div>
                  <h3 className="font-medium mb-3">Popular Categories</h3>
                  <div className="flex flex-wrap gap-2">
                    {popularCategories.map((category) => (
                      <Badge
                        key={category}
                        variant={selectedCategories.includes(category) ? "default" : "outline"}
                        className="cursor-pointer hover-elevate active-elevate-2 px-3 py-1.5"
                        onClick={() => toggleCategory(category)}
                        data-testid={`badge-category-${category}`}
                      >
                        {selectedCategories.includes(category) && (
                          <Check className="w-3 h-3 mr-1" />
                        )}
                        {category}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Search results */}
              {categorySearch !== "" && (
                <div>
                  <h3 className="font-medium mb-3">Search Results</h3>
                  {filteredCategories.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {filteredCategories.map((category) => (
                        <Badge
                          key={category}
                          variant={selectedCategories.includes(category) ? "default" : "outline"}
                          className="cursor-pointer hover-elevate active-elevate-2 px-3 py-1.5"
                          onClick={() => toggleCategory(category)}
                          data-testid={`badge-category-${category}`}
                        >
                          {selectedCategories.includes(category) && (
                            <Check className="w-3 h-3 mr-1" />
                          )}
                          {category}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No categories found</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {currentStep === 3 && (
          <Card data-testid="card-onboarding-step-3">
            <CardHeader>
              <CardTitle>Share Your First Opinions</CardTitle>
              <CardDescription>
                Swipe through topics and share your thoughts on the ones you care about
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Opinion count */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {createdOpinions.size} {createdOpinions.size === 1 ? 'opinion' : 'opinions'} shared
                </p>
                {createdOpinions.size > 0 && (
                  <Badge variant="secondary" className="gap-1">
                    <Check className="w-3 h-3" />
                    Great start!
                  </Badge>
                )}
              </div>

              {/* Topics by category */}
              {Object.entries(topicsByCategory).length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Select categories in the previous step to see topics here
                </p>
              ) : (
                Object.entries(topicsByCategory).map(([category, categoryTopics]) => (
                  <div key={category} className="space-y-3">
                    <h3 className="font-medium">{category}</h3>
                    <div className="flex gap-3 overflow-x-auto pb-2">
                      {categoryTopics.map((topic) => (
                        <TopicOpinionCard
                          key={topic.id}
                          topic={topic}
                          hasOpinion={createdOpinions.has(topic.id)}
                          onOpinionCreated={() => {
                            setCreatedOpinions(prev => new Set([...Array.from(prev), topic.id]));
                          }}
                          createOpinionMutation={createOpinionMutation}
                        />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )}

        {currentStep === 4 && (
          <Card data-testid="card-onboarding-step-4">
            <CardHeader>
              <CardTitle>You're All Set!</CardTitle>
              <CardDescription>
                Here's what you can do on Fuller Feuds
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FeatureCard
                icon={<MessageCircle className="w-5 h-5" />}
                title="Share Opinions"
                description="Express your stance on any topic and engage in meaningful discussions"
              />
              <FeatureCard
                icon={<ThumbsUp className="w-5 h-5" />}
                title="Vote & Engage"
                description="Like, dislike, or challenge viewpoints to shape the conversation"
              />
              <FeatureCard
                icon={<Video className="w-5 h-5" />}
                title="Join Live Debates"
                description="Watch or participate in real-time streaming debates"
              />
              <FeatureCard
                icon={<Users className="w-5 h-5" />}
                title="One-on-One Chats"
                description="Debate directly with people who have different perspectives"
              />
              <FeatureCard
                icon={<Sparkles className="w-5 h-5" />}
                title="AI Insights"
                description="See cumulative perspectives generated from community opinions"
              />
            </CardContent>
          </Card>
        )}

        {/* Navigation buttons */}
        <div className="flex items-center justify-between pt-4">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={currentStep === 1}
            data-testid="button-back"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          {currentStep < 4 ? (
            <Button
              onClick={handleNext}
              disabled={!canProceed || updateProfileMutation.isPending || updateCategoriesMutation.isPending}
              data-testid="button-next"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleComplete}
              disabled={updateProgressMutation.isPending}
              data-testid="button-complete"
            >
              Get Started
            </Button>
          )}
        </div>
      </div>

      {/* Photo Preview Dialog */}
      <Dialog open={showPhotoPreview} onOpenChange={setShowPhotoPreview}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Preview Profile Picture</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {previewUrl && (
              <div className="relative">
                <Avatar className="w-48 h-48">
                  <AvatarImage src={previewUrl} className="object-cover" />
                </Avatar>
              </div>
            )}
            <p className="text-sm text-muted-foreground text-center">
              This is how your profile picture will appear
            </p>
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancelPhotoUpload}
              disabled={isUploadingPhoto}
              data-testid="button-cancel-photo-upload"
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handlePhotoUpload}
              disabled={isUploadingPhoto}
              data-testid="button-confirm-photo-upload"
            >
              <Upload className="w-4 h-4 mr-2" />
              {isUploadingPhoto ? "Uploading..." : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Helper component for topic opinion cards
function TopicOpinionCard({ 
  topic, 
  hasOpinion, 
  onOpinionCreated,
  createOpinionMutation 
}: { 
  topic: Topic; 
  hasOpinion: boolean;
  onOpinionCreated: () => void;
  createOpinionMutation: any;
}) {
  const [showOpinionForm, setShowOpinionForm] = useState(false);
  const [stance, setStance] = useState<'for' | 'against' | null>(null);
  const [content, setContent] = useState("");

  const handleStanceSelect = (selectedStance: 'for' | 'against') => {
    setStance(selectedStance);
    setShowOpinionForm(true);
  };

  const handleSubmit = async () => {
    if (!stance || !content.trim()) return;

    await createOpinionMutation.mutateAsync({
      topicId: topic.id,
      content: content.trim(),
      stance
    });

    onOpinionCreated();
    setShowOpinionForm(false);
    setContent("");
    setStance(null);
  };

  return (
    <Card className="min-w-[280px] max-w-[280px] flex-shrink-0" data-testid={`card-topic-${topic.id}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base line-clamp-2">{topic.title}</CardTitle>
        <CardDescription className="line-clamp-2 text-sm">
          {topic.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {hasOpinion ? (
          <Badge variant="secondary" className="w-full justify-center gap-1">
            <Check className="w-3 h-3" />
            Opinion shared
          </Badge>
        ) : showOpinionForm ? (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Badge 
                variant={stance === 'for' ? 'default' : 'outline'} 
                className="cursor-pointer"
                onClick={() => setStance('for')}
              >
                For
              </Badge>
              <Badge 
                variant={stance === 'against' ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => setStance('against')}
              >
                Against
              </Badge>
            </div>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Share your opinion..."
              rows={3}
              className="text-sm"
              data-testid={`textarea-opinion-${topic.id}`}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={!stance || !content.trim() || createOpinionMutation.isPending}
                className="flex-1"
                data-testid={`button-submit-opinion-${topic.id}`}
              >
                Submit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowOpinionForm(false);
                  setStance(null);
                  setContent("");
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleStanceSelect('for')}
              className="flex-1"
              data-testid={`button-for-${topic.id}`}
            >
              <ThumbsUp className="w-4 h-4 mr-1" />
              For
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleStanceSelect('against')}
              className="flex-1"
              data-testid={`button-against-${topic.id}`}
            >
              <ThumbsDown className="w-4 h-4 mr-1" />
              Against
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Helper component for feature cards
function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex gap-3 p-3 rounded-lg border bg-card">
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
        {icon}
      </div>
      <div className="space-y-1">
        <h4 className="font-medium">{title}</h4>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
