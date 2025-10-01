import { useState } from "react";
import { Link, useLocation } from "wouter";
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
  SidebarFooter
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
  User
} from "lucide-react";

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
  onCreateTopic?: () => void;
  onLogout?: () => void;
}

export default function AppSidebar({ 
  currentUser,
  onNavigate, 
  onCreateTopic,
  onLogout 
}: AppSidebarProps) {
  const [location] = useLocation();

  const mainItems = [
    { title: "Home", icon: Home, path: "/" },
    { title: "Trending", icon: TrendingUp, path: "/trending" },
    { title: "Live Debates", icon: Radio, path: "/live" },
    { title: "Hot Debates", icon: Flame, path: "/hot-debates" },
    { title: "My Debates", icon: MessageCircle, path: "/debates" },
  ];

  const categories: CategoryItem[] = [
    { title: "Politics", icon: Gavel, count: 142 },
    { title: "Technology", icon: Cpu, count: 89 },
    { title: "Environment", icon: Globe, count: 76 },
    { title: "Business", icon: Briefcase, count: 54 },
    { title: "Education", icon: GraduationCap, count: 43 },
    { title: "Health", icon: Heart, count: 38 },
  ];

  return (
    <Sidebar>
      <SidebarHeader className="border-b p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary text-primary-foreground">
            <MessageCircle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-lg">Kirk</h2>
            <p className="text-xs text-muted-foreground">Where Ideas Collide</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {currentUser && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href={`/profile/${currentUser.id}`} data-testid="link-user-profile">
                      <User className="w-4 h-4" />
                      <span>My Profile</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.path}>
                    <Link href={item.path} data-testid={`link-nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center justify-between">
            Categories
            <Button 
              size="sm" 
              variant="ghost" 
              className="h-6 w-6 p-0"
              onClick={() => {
                onCreateTopic?.();
                console.log('Create topic clicked');
              }}
              data-testid="button-create-topic"
            >
              <Plus className="w-3 h-3" />
            </Button>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {categories.map((category) => (
                <SidebarMenuItem key={category.title}>
                  <SidebarMenuButton asChild>
                    <Link href={`/?category=${category.title}`} data-testid={`link-category-${category.title.toLowerCase()}`}>
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
          <div className="flex items-center gap-3 mb-3">
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
          
          <div className="flex gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className="flex-1"
              onClick={() => {
                console.log('Settings clicked');
              }}
              data-testid="button-settings"
            >
              <Settings className="w-4 h-4" />
            </Button>
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