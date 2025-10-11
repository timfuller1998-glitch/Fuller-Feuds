import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
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
import UserAvatar from "./UserAvatar";
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
  Clock
} from "lucide-react";
import type { Topic } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";

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
    { title: "My Debates", icon: MessageCircle, path: "/debates" },
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
  const categories: CategoryItem[] = topics
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

  return (
    <Sidebar>
      <SidebarHeader className="border-b p-4">
        <Link href="/" onClick={handleLinkClick} data-testid="link-home-logo">
          <div className="flex items-center gap-3 hover-elevate active-elevate-2 rounded-lg p-2 -m-2 transition-colors">
            <div className="p-2 rounded-lg bg-primary text-primary-foreground">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-lg">Kirk Debates</h2>
              <p className="text-xs text-muted-foreground">Where Ideas Collide</p>
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
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/categories"}>
                  <Link href="/categories" onClick={handleLinkClick} data-testid="link-browse-all-categories">
                    <Grid className="w-4 h-4" />
                    <span>Browse All</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {categories.map((category) => (
                <SidebarMenuItem key={category.title}>
                  <SidebarMenuButton asChild>
                    <Link href={`/category/${category.title}`} onClick={handleLinkClick} data-testid={`link-category-${category.title.toLowerCase()}`}>
                      <category.icon className="w-4 h-4" />
                      <span>{category.title}</span>
                      <Badge variant="secondary" className="ml-auto text-xs">
                        {category.count}
                      </Badge>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {currentUser && (
        <SidebarFooter className="border-t p-4">
          <Link href={`/profile/${currentUser.id}`} onClick={handleLinkClick} data-testid="link-user-profile">
            <div className="flex items-center gap-3 mb-3 hover-elevate active-elevate-2 rounded-lg p-2 -m-2 transition-colors">
              <UserAvatar 
                name={currentUser.name} 
                imageUrl={currentUser.avatar}
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