import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, Flag, Shield } from "lucide-react";

export function DashboardOverview() {
  // Fetch platform stats
  const { data: users } = useQuery({
    queryKey: ['/api/admin/users', { limit: 1000 }],
  });

  const { data: topics } = useQuery({
    queryKey: ['/api/admin/topics', { limit: 1000 }],
  });

  const { data: opinions } = useQuery({
    queryKey: ['/api/admin/opinions', { limit: 1000 }],
  });

  const { data: flaggedOpinions } = useQuery({
    queryKey: ['/api/admin/flagged-opinions'],
  });

  const stats = [
    {
      title: "Total Users",
      value: users?.length || 0,
      icon: Users,
      description: "Registered platform users",
      testId: "stat-users"
    },
    {
      title: "Active Topics",
      value: topics?.filter((t: any) => t.status === 'active').length || 0,
      icon: FileText,
      description: "Currently active debates",
      testId: "stat-topics"
    },
    {
      title: "Total Opinions",
      value: opinions?.length || 0,
      icon: Shield,
      description: "User opinions shared",
      testId: "stat-opinions"
    },
    {
      title: "Flagged Content",
      value: flaggedOpinions?.length || 0,
      icon: Flag,
      description: "Items requiring review",
      testId: "stat-flagged"
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Platform Overview</h2>
        <p className="text-muted-foreground">Key metrics and platform statistics</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid={stat.testId}>{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>User Distribution</CardTitle>
            <CardDescription>Breakdown by role</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Regular Users</span>
                <span className="text-sm font-medium" data-testid="count-regular-users">
                  {users?.filter((u: any) => u.role === 'user').length || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Moderators</span>
                <span className="text-sm font-medium" data-testid="count-moderators">
                  {users?.filter((u: any) => u.role === 'moderator').length || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Admins</span>
                <span className="text-sm font-medium" data-testid="count-admins">
                  {users?.filter((u: any) => u.role === 'admin').length || 0}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Content Status</CardTitle>
            <CardDescription>Topics and opinions by status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Active Topics</span>
                <span className="text-sm font-medium" data-testid="count-active-topics">
                  {topics?.filter((t: any) => t.status === 'active').length || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Hidden Content</span>
                <span className="text-sm font-medium" data-testid="count-hidden-content">
                  {(topics?.filter((t: any) => t.status === 'hidden').length || 0) + 
                   (opinions?.filter((o: any) => o.status === 'hidden').length || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Flagged for Review</span>
                <span className="text-sm font-medium" data-testid="count-flagged-review">
                  {(opinions?.filter((o: any) => o.status === 'flagged').length || 0)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
