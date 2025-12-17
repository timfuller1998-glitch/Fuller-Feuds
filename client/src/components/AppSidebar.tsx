import { Link, useLocation } from "wouter";
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
  Plus,
  User,
  Grid,
  Shield,
  Clock,
  Star
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
      const newFollowedCategories = isFollowing
        ? savedCategories.filter(c => c !== category)
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
      'General': Grid,
    };
    return iconMap[categoryName] || MessageCircle; // Default icon
  };

  // Extract all unique categories from all topics with their counts
  const allCategories: CategoryItem[] = topics
    ? Array.from(
        topics.reduce((acc, topic) => {
          topic.categories.forEach(cat => {
            if (!acc.has(cat)) {
              acc.set(cat, { title: cat, count: 0 });
            }
            acc.get(cat)!.count++;
          });
          return acc;
        }, new Map<string, { title: string; count: number }>())
      )
      .map(([_, data]) => ({
        ...data,
        icon: getCategoryIcon(data.title),
      }))
      .sort((a, b) => b.count - a.count) // Sort by count descending
    : [];

  // Get saved categories with their details (up to 10)
  const savedCategoryItems = savedCategories
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
    .filter(cat => !savedCategories.includes(cat))
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
      <SidebarHeader className="border-b p-4">
        <Link href="/" onClick={handleLinkClick} data-testid="link-home-logo">
          <div className="flex items-center gap-3 hover-elevate active-elevate-2 rounded-lg p-2 -m-2 transition-colors">
            <div className="p-2 rounded-lg bg-primary text-primary-foreground">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-lg">Fuller Feuds</h2>
              <p className="text-xs text-muted-foreground">Every opinion. One fair fight.</p>
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
                    <span>Browse All</span>
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
                          checked={savedCategories.includes(category.title)}
                          onCheckedChange={() => {
                            toggleCategoryMutation.mutate({
                              category: category.title,
                              isFollowing: savedCategories.includes(category.title),
                            });
                          }}
                          data-testid={`checkbox-category-${category.title.toLowerCase()}`}
                          className="flex-shrink-0"
                        />
                        <Link 
                          href={`/category/${category.title}`} 
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
                          href={`/category/${category.title}`} 
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
                console.log('Logout clicked');
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