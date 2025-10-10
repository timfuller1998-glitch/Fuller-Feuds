import { useState, useEffect } from "react";
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

export default function Onboarding() {
  const [, navigate] = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  const [canProceed, setCanProceed] = useState(false);

  // Step 1: Profile data
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [profileImageUrl, setProfileImageUrl] = useState("");

  // Step 2: Category data
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [categorySearch, setCategorySearch] = useState("");

  // Step 3: Opinion data
  const [createdOpinions, setCreatedOpinions] = useState<Set<string>>(new Set());

  const { data: user } = useQuery({
    queryKey: ['/api/auth/user'],
  });

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
      return await apiRequest('PUT', '/api/onboarding/profile', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    }
  });

  // Update categories mutation
  const updateCategoriesMutation = useMutation({
    mutationFn: async (categories: string[]) => {
      return await apiRequest('PUT', '/api/onboarding/categories', { categories });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    }
  });

  // Update onboarding progress mutation
  const updateProgressMutation = useMutation({
    mutationFn: async ({ step, complete }: { step: number; complete: boolean }) => {
      return await apiRequest('PUT', '/api/onboarding/progress', { step, complete });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    }
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
      setCreatedOpinions(prev => new Set([...prev, variables.topicId]));
      queryClient.invalidateQueries({ queryKey: ['/api/topics'] });
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

  // Redirect users who have already completed onboarding
  useEffect(() => {
    if (user && user.onboardingComplete) {
      navigate("/");
    }
  }, [user, navigate]);

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
    await updateProgressMutation.mutateAsync({
      step: 4,
      complete: true
    });
    // Wait for user data to refresh before navigating
    await queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    await queryClient.refetchQueries({ queryKey: ['/api/auth/user'] });
    navigate("/");
  };

  const handleSkip = async () => {
    await updateProgressMutation.mutateAsync({
      step: currentStep,
      complete: true
    });
    // Wait for user data to refresh before navigating
    await queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    await queryClient.refetchQueries({ queryKey: ['/api/auth/user'] });
    navigate("/");
  };

  const toggleCategory = (category: string) => {
    if (selectedCategories.includes(category)) {
      setSelectedCategories(selectedCategories.filter(c => c !== category));
    } else {
      setSelectedCategories([...selectedCategories, category]);
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

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header with progress */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Welcome to Kirk Debates</h1>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              data-testid="button-skip-onboarding"
            >
              Skip for now
            </Button>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Step {currentStep} of 4</span>
              <span>{Math.round(progressPercentage)}%</span>
            </div>
            <Progress value={progressPercentage} className="h-2" data-testid="progress-onboarding" />
          </div>
        </div>

        {/* Step content */}
        {currentStep === 1 && (
          <Card data-testid="card-onboarding-step-1">
            <CardHeader>
              <CardTitle>Set Up Your Profile</CardTitle>
              <CardDescription>
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
                <Button variant="outline" size="sm" data-testid="button-upload-profile-picture">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Photo
                </Button>
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
                            setCreatedOpinions(prev => new Set([...prev, topic.id]));
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
                Here's what you can do on Kirk Debates
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
