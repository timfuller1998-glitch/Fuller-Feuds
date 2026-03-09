import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { FileText, Shield, Eye, EyeOff, Ban, CheckCircle, XCircle, Archive, ArchiveRestore } from "lucide-react";

export function AuditLog() {
  const [actionTypeFilter, setActionTypeFilter] = useState<string>("");

  // Fetch audit log
  const { data: auditLog, isLoading } = useQuery({
    queryKey: ['/api/admin/audit-log', { actionType: actionTypeFilter }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (actionTypeFilter && actionTypeFilter.trim()) params.append('actionType', actionTypeFilter);
      
      const url = `/api/admin/audit-log${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch audit log');
      return res.json();
    },
  });

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'approve':
        return <CheckCircle className="h-4 w-4" />;
      case 'hide':
        return <EyeOff className="h-4 w-4" />;
      case 'reject':
        return <XCircle className="h-4 w-4" />;
      case 'suspend':
      case 'ban':
        return <Ban className="h-4 w-4" />;
      case 'reinstate':
        return <CheckCircle className="h-4 w-4" />;
      case 'archive':
        return <Archive className="h-4 w-4" />;
      case 'restore':
        return <ArchiveRestore className="h-4 w-4" />;
      case 'role_change':
        return <Shield className="h-4 w-4" />;
      default:
        return <Eye className="h-4 w-4" />;
    }
  };

  const getActionBadgeVariant = (actionType: string) => {
    switch (actionType) {
      case 'approve':
      case 'reinstate':
      case 'restore':
        return 'default';
      case 'hide':
      case 'suspend':
        return 'secondary';
      case 'ban':
      case 'reject':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const formatActionText = (action: any) => {
    const type = action.action.actionType;
    const target = action.action.targetType;
    
    switch (type) {
      case 'approve':
        return `Approved ${target}`;
      case 'hide':
        return `Hid ${target}`;
      case 'reject':
        return `Rejected ${target}`;
      case 'suspend':
        return `Suspended user`;
      case 'ban':
        return `Banned user`;
      case 'reinstate':
        return `Reinstated user`;
      case 'archive':
        return `Archived ${target}`;
      case 'restore':
        return `Restored ${target}`;
      case 'role_change':
        return `Changed user role`;
      default:
        return `${type} ${target}`;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Audit Log
              </CardTitle>
              <CardDescription>View moderation actions and platform changes</CardDescription>
            </div>
            <Select value={actionTypeFilter} onValueChange={setActionTypeFilter}>
              <SelectTrigger className="w-[200px]" data-testid="select-action-filter">
                <SelectValue placeholder="Filter by action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value=" ">All Actions</SelectItem>
                <SelectItem value="approve">Approve</SelectItem>
                <SelectItem value="hide">Hide</SelectItem>
                <SelectItem value="reject">Reject</SelectItem>
                <SelectItem value="suspend">Suspend</SelectItem>
                <SelectItem value="ban">Ban</SelectItem>
                <SelectItem value="reinstate">Reinstate</SelectItem>
                <SelectItem value="archive">Archive</SelectItem>
                <SelectItem value="restore">Restore</SelectItem>
                <SelectItem value="role_change">Role Change</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      {/* Audit Log List */}
      <div className="space-y-3">
        {isLoading ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">Loading audit log...</p>
            </CardContent>
          </Card>
        ) : auditLog?.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">No actions recorded</p>
            </CardContent>
          </Card>
        ) : (
          auditLog?.map((entry: any) => (
            <Card key={entry.action.id} data-testid={`card-audit-${entry.action.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge 
                        variant={getActionBadgeVariant(entry.action.actionType)}
                        className="flex items-center gap-1"
                        data-testid={`badge-action-${entry.action.id}`}
                      >
                        {getActionIcon(entry.action.actionType)}
                        {entry.action.actionType}
                      </Badge>
                      <span className="text-sm font-medium" data-testid={`text-action-${entry.action.id}`}>
                        {formatActionText(entry)}
                      </span>
                    </div>
                    
                    {entry.action.reason && (
                      <p className="text-sm text-muted-foreground mb-2" data-testid={`text-reason-${entry.action.id}`}>
                        Reason: {entry.action.reason}
                      </p>
                    )}
                    
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {entry.moderator && (
                        <div className="flex items-center gap-2">
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={entry.moderator.profileImageUrl} />
                            <AvatarFallback className="text-xs">
                              {entry.moderator.firstName?.[0]}{entry.moderator.lastName?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <span data-testid={`text-moderator-${entry.action.id}`}>
                            {entry.moderator.firstName} {entry.moderator.lastName}
                          </span>
                        </div>
                      )}
                      <span>•</span>
                      <span data-testid={`text-timestamp-${entry.action.id}`}>
                        {formatDistanceToNow(new Date(entry.action.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
