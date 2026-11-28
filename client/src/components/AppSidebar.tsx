import { Link, useLocation } from "wouter";
import { MAJOR_CATEGORIES, getMajor, resolveHome, resolveTag } from "@shared/topicTaxonomy";
import { openTutorial } from "@/lib/tutorial";
import { openFeedback } from "@/lib/feedback";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Sidebar, 
  SidebarContent, 
  SidebarGroup, 
  SidebarGroupContent, 
  SidebarGroupLabel, 
  SidebarMenu, 
  SidebarMenuButton, 
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AvatarWithBadge } from "./AvatarWithBadge";
import { 
  Home, 
  Search, 
  TrendingUp,
  Radio,
  Flame,
  MessageCircle,
  Globe,
  Briefcase,
  GraduationCap,
  Heart,
  Gavel,
  Cpu,
  Settings,
  LogOut,
  HelpCircle,
  MessageSquarePlus,
  Plus,
  User,
  Grid,
  Shield,
  Clock,
  Star,
  Crown,
  PenLine, Car, UtensilsCrossed, Church, Lightbulb
} from "lucide-react";
import type { Topic } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface CategoryItem {
  title: string;
  icon: any;
  count: number;
  isActive?: boolean;
}

interface AppSidebarProps {
  currentUser?: {
    id: string;
    name: string;
    avatar?: string;
    isOnline: boolean;
    economicScore?: number;
    authoritarianScore?: number;
  };
  onNavigate?: (path: string) => void;
  onLogout?: () => void;
}

export default function AppSidebar({ 
  currentUser,
  onNavigate, 
  onLogout 
}: AppSidebarProps) {
  const [location] = useLocation();
  const { setOpenMobile, isMobile } = useSidebar();
  const { user } = useAuth();

  // Fetch all topics to calculate category counts
  const { data: topics } = useQuery<Topic[]>({
    queryKey: ["/api/topics"],
  });

  // Fetch user's saved (followed) categories
  const { data: userData } = useQuery<{ followedCategories: string[] }>({
    queryKey: ["/api/users/me"],
    enabled: !!user,
  });

  const savedCategories = userData?.followedCategories || [];
  const toGroupName = (c: string) => getMajor(resolveTag(c)?.majorId)?.name ?? null;
  const savedGroupNames = Array.from(new Set(savedCategories.map(toGroupName).filter((n): n is string => !!n)));

  // Fetch recently viewed categories
  const { data: recentCategories } = useQuery({
    queryKey: ["/api/users/me/recent-categories"],
    enabled: !!user,
    select: (data: any): string[] => {
      // Handle both array response and object with categories property (backward compatibility)
      if (!data) return [];
      if (Array.isArray(data)) {
        return data;
      }
      if (typeof data === 'object' && 'categories' in data && Array.isArray(data.categories)) {
        return data.categories;
      }
      return [];
    },
  });

  // Mutation to toggle category follow status
  const toggleCategoryMutation = useMutation({
    mutationFn: async ({ category, isFollowing }: { category: string; isFollowing: boolean }) => {
      // Followed categories are official groups. Older follows saved as raw tags count toward the group they belong to.
      const newFollowedCategories = isFollowing
        ? savedCategories.filter(c => toGroupName(c) !== category)
        : [...savedCategories, category];
      
      return apiRequest("PATCH", "/api/users/me", { followedCategories: newFollowedCategories });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/me"] });
    },
  });

  // Close sidebar on mobile when link is clicked
  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const mainItems = [
    { title: "Trending", icon: TrendingUp, path: "/trending" },
    { title: "Live Debates", icon: Radio, path: "/live" },
    { title: "Hot Debates", icon: Flame, path: "/hot-debates" },
    { title: "Recent Opinions", icon: Clock, path: "/recent-opinions" },
  ];

  // Check if user is admin or moderator
  const isAdminOrModerator = user?.role === 'admin' || user?.role === 'moderator';

  // Get icon for category (with fallback)
  const getCategoryIcon = (categoryName: string) => {
    const iconMap: Record<string, any> = {
      'Politics': Gavel,
      'Technology': Cpu,
      'Environment': Globe,
      'Business': Briefcase,
      'Education': GraduationCap,
      'Health': Heart,
      'Science': Cpu,
      'Sports': TrendingUp,
      'Entertainment': Radio,
      'Law': Gavel,
      'Economics': Briefcase,
      'Energy': Flame,
      'Climate': Globe,
      'Society': MessageCircle,
      'Vehicles': Car,
      'Food & Cooking': UtensilsCrossed,
      'Religion': Church,
      'Social Policy': MessageCircle,
      'Ideas': Lightbulb,
      'Culture': Globe,
      'General': Grid,
    };
    return iconMap[categoryName] || MessageCircle; // Default icon
  };

  // Official groups (each topic's home major) with their topic counts, biggest first
  const allCategories: CategoryItem[] = topics
    ? MAJOR_CATEGORIES
        .map((m) => ({
          title: m.name,
          count: topics.filter((t: any) => resolveHome({ id: t.id, title: t.title, description: t.description, categories: t.categories ?? [], homeMajor: t.homeMajor, homeSub: t.homeSub }).majorId === m.id).length,
          icon: getCategoryIcon(m.name),
        }))
        .filter((c) => c.count > 0)
        .sort((a, b) => b.count - a.count)
    : [];

  // Get saved categories with their details (up to 10)
  const savedCategoryItems = savedGroupNames
    .slice(0, 10)
    .map(cat => {
      const categoryData = allCategories.find(c => c.title === cat);
      return {
        title: cat,
        icon: getCategoryIcon(cat),
        count: categoryData?.count || 0,
      };
    });

  // Get recently viewed categories that aren't already in saved categories (up to 5)
  const recentCategoryItems = (recentCategories || [])
    .filter(cat => !savedGroupNames.includes(cat))
    .slice(0, 5)
    .map(cat => {
      const categoryData = allCategories.find(c => c.title === cat);
      return {
        title: cat,
        icon: getCategoryIcon(cat),
        count: categoryData?.count || 0,
      };
    });

  return (
    <Sidebar>
      <SidebarHeader className="border-b-[3px] border-double border-foreground p-4">
        <Link href="/" onClick={handleLinkClick} data-testid="link-home-logo">
          <div className="flex items-center gap-3 hover-elevate active-elevate-2 rounded-lg p-2 -m-2 transition-colors">
            <div className="flex items-center justify-center w-9 h-9 min-w-9 shrink-0 overflow-hidden">
              <img src="/logo.png" alt="Fuller Feuds" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display font-normal uppercase leading-none tracking-[0.02em] text-[1.45rem]" data-testid="text-wordmark">Fuller<span className="text-primary"> Feuds</span></h2>
              <p className="mt-1 text-xs italic text-muted-foreground">Where opposing views feud over the fuller picture.</p>
            </div>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.path}>
                    <Link href={item.path} onClick={handleLinkClick} data-testid={`link-nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                      {'badge' in item && item.badge !== undefined && item.badge > 0 && (
                        <Badge variant="default" className="ml-auto text-xs" data-testid="badge-active-debates-count">
                          {item.badge}
                        </Badge>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {(user?.founderNumber != null || user?.role === 'admin') && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/founders"}>
                    <Link href="/founders" onClick={handleLinkClick} data-testid="link-nav-founders-room">
                      <Crown className="w-4 h-4" />
                      <span>Founders' Room</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {!user && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/apply"}>
                    <Link href="/apply" onClick={handleLinkClick} data-testid="link-nav-apply">
                      <PenLine className="w-4 h-4" />
                      <span>Become a founding member</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {isAdminOrModerator && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/admin"}>
                    <Link href="/admin" onClick={handleLinkClick} data-testid="link-nav-admin-dashboard">
                      <Shield className="w-4 h-4" />
                      <span>Admin Dashboard</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => {
                    handleLinkClick();
                    openTutorial();
                  }}
                  data-testid="button-nav-how-it-works"
                >
                  <HelpCircle className="w-4 h-4" />
                  <span>How it works</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => {
                    handleLinkClick();
                    openFeedback();
                  }}
                  data-testid="button-nav-feedback"
                >
                  <MessageSquarePlus className="w-4 h-4" />
                  <span>Report a bug / idea</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <div className="flex items-center gap-2 px-2 py-1 font-ui text-xs text-muted-foreground" data-testid="nav-legal-links">
                  <Link href="/privacy" onClick={handleLinkClick} className="hover:text-foreground hover:underline" data-testid="link-nav-privacy">Privacy</Link>
                  <span aria-hidden="true">·</span>
                  <Link href="/terms" onClick={handleLinkClick} className="hover:text-foreground hover:underline" data-testid="link-nav-terms">Terms</Link>
                </div>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>
            Categories
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Browse All Categories - always at top */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/categories"}>
                  <Link href="/categories" onClick={handleLinkClick} data-testid="link-browse-all-categories">
                    <Grid className="w-4 h-4" />
                    <span>Explore Topics</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Saved Categories with checkboxes (up to 10) */}
              {savedCategoryItems.length > 0 && (
                <>
                  {savedCategoryItems.map((category) => (
                    <SidebarMenuItem key={`saved-${category.title}`}>
                      <div className="flex items-center gap-2 px-2 py-1.5 w-full">
                        <Checkbox
                          checked={savedGroupNames.includes(category.title)}
                          onCheckedChange={() => {
                            toggleCategoryMutation.mutate({
                              category: category.title,
                              isFollowing: savedGroupNames.includes(category.title),
                            });
                          }}
                          data-testid={`checkbox-category-${category.title.toLowerCase()}`}
                          className="flex-shrink-0"
                        />
                        <Link 
                          href={`/categories?focus=${encodeURIComponent(category.title)}`} 
                          onClick={handleLinkClick}
                          className="flex items-center gap-2 flex-1 min-w-0 hover-elevate active-elevate-2 rounded-md px-2 py-1 -mx-2 -my-1"
                          data-testid={`link-saved-category-${category.title.toLowerCase()}`}
                        >
                          <category.icon className="w-4 h-4 flex-shrink-0" />
                          <span className="flex-1 truncate text-sm">{category.title}</span>
                          <Badge variant="secondary" className="text-xs flex-shrink-0">
                            {category.count}
                          </Badge>
                        </Link>
                      </div>
                    </SidebarMenuItem>
                  ))}
                </>
              )}

              {/* Recently Viewed Categories (up to 5, excluding saved) */}
              {recentCategoryItems.length > 0 && (
                <>
                  <SidebarMenuItem>
                    <div className="px-2 py-1 text-xs text-muted-foreground font-medium">
                      Recently Viewed
                    </div>
                  </SidebarMenuItem>
                  {recentCategoryItems.map((category) => (
                    <SidebarMenuItem key={`recent-${category.title}`}>
                      <div className="flex items-center gap-2 px-2 py-1.5 w-full">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 flex-shrink-0"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleCategoryMutation.mutate({
                              category: category.title,
                              isFollowing: false, // Adding to saved list
                            });
                          }}
                          data-testid={`button-follow-category-${category.title.toLowerCase()}`}
                        >
                          <Star className="w-4 h-4" />
                        </Button>
                        <Link 
                          href={`/categories?focus=${encodeURIComponent(category.title)}`} 
                          onClick={handleLinkClick}
                          className="flex items-center gap-2 flex-1 min-w-0 hover-elevate active-elevate-2 rounded-md px-2 py-1 -mx-2 -my-1"
                          data-testid={`link-recent-category-${category.title.toLowerCase()}`}
                        >
                          <category.icon className="w-4 h-4 flex-shrink-0" />
                          <span className="flex-1 truncate text-sm">{category.title}</span>
                          <Badge variant="secondary" className="text-xs flex-shrink-0">
                            {category.count}
                          </Badge>
                        </Link>
                      </div>
                    </SidebarMenuItem>
                  ))}
                </>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {currentUser && (
        <SidebarFooter className="border-t p-4">
          <Link href={`/profile/${currentUser.id}`} onClick={handleLinkClick} data-testid="link-user-profile">
            <div className="flex items-center gap-3 mb-3 hover-elevate active-elevate-2 rounded-lg p-2 -m-2 transition-colors">
              <AvatarWithBadge 
                userId={currentUser.id}
                name={currentUser.name} 
                profileImageUrl={currentUser.avatar}
                size="sm"
                showOnlineStatus
                isOnline={currentUser.isOnline}
                economicScore={currentUser.economicScore}
                authoritarianScore={currentUser.authoritarianScore}
                showPoliticalLeaning={true}
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{currentUser.name}</p>
                <p className="text-xs text-muted-foreground">
                  {currentUser.isOnline ? "Online" : "Offline"}
                </p>
              </div>
            </div>
          </Link>
          
          <div className="flex gap-2">
            <Link href="/settings" onClick={handleLinkClick} className="flex-1">
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full"
                data-testid="button-settings"
              >
                <Settings className="w-4 h-4" />
              </Button>
            </Link>
            <Button 
              variant="ghost" 
              size="sm" 
              className="flex-1"
              onClick={() => {
                onLogout?.();
              }}
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}