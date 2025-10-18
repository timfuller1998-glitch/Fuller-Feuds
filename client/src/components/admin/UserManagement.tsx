import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import { Users, Search, Shield, User, Ban, Unlock, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function UserManagement() {
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [newRole, setNewRole] = useState<string>("");
  const [statusChangeUser, setStatusChangeUser] = useState<any>(null);
  const [newStatus, setNewStatus] = useState<string>("");
  const [deleteUser, setDeleteUser] = useState<any>(null);

  // Fetch users with filters
  const { data: users, isLoading } = useQuery({
    queryKey: ['/api/admin/users', { role: roleFilter, status: statusFilter, search: searchQuery }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (roleFilter && roleFilter.trim()) params.append('role', roleFilter);
      if (statusFilter && statusFilter.trim()) params.append('status', statusFilter);
      if (searchQuery) params.append('search', searchQuery);
      
      const url = `/api/admin/users${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    },
  });

  // Update user role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      return await apiRequest('PUT', `/api/admin/users/${userId}/role`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/audit-log'] });
      setSelectedUser(null);
      setNewRole("");
    },
  });

  // Update user status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: string }) => {
      return await apiRequest('PUT', `/api/admin/users/${userId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/audit-log'] });
      setStatusChangeUser(null);
      setNewStatus("");
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await apiRequest('DELETE', `/api/admin/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/audit-log'] });
      setDeleteUser(null);
    },
  });

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'destructive';
      case 'moderator':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default';
      case 'suspended':
        return 'secondary';
      case 'banned':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            User Management
          </CardTitle>
          <CardDescription>Manage user roles and account status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-users"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-role-filter">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value=" ">All Roles</SelectItem>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="moderator">Moderator</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-status-filter">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value=" ">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="banned">Banned</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* User List */}
      <div className="space-y-3">
        {isLoading ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">Loading users...</p>
            </CardContent>
          </Card>
        ) : users?.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">No users found</p>
            </CardContent>
          </Card>
        ) : (
          users?.map((user: any) => (
            <Card key={user.id} data-testid={`card-user-${user.id}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <Avatar>
                      <AvatarImage src={user.profileImageUrl} />
                      <AvatarFallback>
                        {user.firstName?.[0]}{user.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium truncate" data-testid={`text-username-${user.id}`}>
                          {user.firstName} {user.lastName}
                        </p>
                        <Badge variant={getRoleBadgeVariant(user.role)} data-testid={`badge-role-${user.id}`}>
                          {user.role}
                        </Badge>
                        <Badge variant={getStatusBadgeVariant(user.status)} data-testid={`badge-status-${user.id}`}>
                          {user.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate" data-testid={`text-email-${user.id}`}>
                        {user.email}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Joined {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedUser(user);
                        setNewRole(user.role);
                      }}
                      data-testid={`button-manage-role-${user.id}`}
                    >
                      <Shield className="h-4 w-4 mr-2" />
                      Role
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setStatusChangeUser(user);
                        setNewStatus(user.status);
                      }}
                      data-testid={`button-manage-status-${user.id}`}
                    >
                      {user.status === 'banned' ? <Unlock className="h-4 w-4 mr-2" /> : <Ban className="h-4 w-4 mr-2" />}
                      Status
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setDeleteUser(user)}
                      data-testid={`button-delete-user-${user.id}`}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Role Change Dialog */}
      <AlertDialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update User Role</AlertDialogTitle>
            <AlertDialogDescription>
              Change the role for {selectedUser?.firstName} {selectedUser?.lastName}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger data-testid="select-new-role">
                <SelectValue placeholder="Select new role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="moderator">Moderator</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-role-change">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedUser && newRole) {
                  updateRoleMutation.mutate({
                    userId: selectedUser.id,
                    role: newRole,
                  });
                }
              }}
              disabled={!newRole || newRole === selectedUser?.role || updateRoleMutation.isPending}
              data-testid="button-confirm-role-change"
            >
              {updateRoleMutation.isPending ? "Updating..." : "Update Role"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Status Change Dialog */}
      <AlertDialog open={!!statusChangeUser} onOpenChange={() => setStatusChangeUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update User Status</AlertDialogTitle>
            <AlertDialogDescription>
              Change the account status for {statusChangeUser?.firstName} {statusChangeUser?.lastName}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger data-testid="select-new-status">
                <SelectValue placeholder="Select new status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="banned">Banned</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground mt-3">
              {newStatus === 'banned' && 'User will be permanently banned from the platform.'}
              {newStatus === 'suspended' && 'User will be temporarily suspended from the platform.'}
              {newStatus === 'active' && 'User will have full access to the platform.'}
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-status-change">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (statusChangeUser && newStatus) {
                  updateStatusMutation.mutate({
                    userId: statusChangeUser.id,
                    status: newStatus,
                  });
                }
              }}
              disabled={!newStatus || newStatus === statusChangeUser?.status || updateStatusMutation.isPending}
              data-testid="button-confirm-status-change"
            >
              {updateStatusMutation.isPending ? "Updating..." : "Update Status"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete User Confirmation Dialog */}
      <AlertDialog open={!!deleteUser} onOpenChange={() => setDeleteUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete the account for {deleteUser?.firstName} {deleteUser?.lastName}?
              <br /><br />
              <strong className="text-destructive">This action cannot be undone.</strong> All user data, opinions, debates, and associated content will be permanently removed from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-user">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteUser) {
                  deleteUserMutation.mutate(deleteUser.id);
                }
              }}
              disabled={deleteUserMutation.isPending}
              data-testid="button-confirm-delete-user"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteUserMutation.isPending ? "Deleting..." : "Delete Account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
