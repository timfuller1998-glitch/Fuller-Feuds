import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import { Filter, Plus, Trash2, AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function ContentFilters() {
  const [newPhrase, setNewPhrase] = useState("");
  const [newSeverity, setNewSeverity] = useState<"block" | "flag">("block");
  const [newCategory, setNewCategory] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);

  // Fetch banned phrases
  const { data: bannedPhrases, isLoading } = useQuery({
    queryKey: ['/api/admin/banned-phrases'],
  });

  // Add banned phrase mutation
  const addPhraseMutation = useMutation({
    mutationFn: async (data: { phrase: string; severity: string; category?: string }) => {
      return await apiRequest('POST', '/api/admin/banned-phrases', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/banned-phrases'] });
      setNewPhrase("");
      setNewCategory("");
      setNewSeverity("block");
      setShowAddDialog(false);
    },
  });

  // Delete banned phrase mutation
  const deletePhraseMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/admin/banned-phrases/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/banned-phrases'] });
    },
  });

  const getSeverityBadgeVariant = (severity: string) => {
    return severity === 'block' ? 'destructive' : 'secondary';
  };

  const getSeverityDescription = (severity: string) => {
    return severity === 'block' 
      ? 'Prevents posting content containing this phrase'
      : 'Flags content for moderator review';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Content Filters
              </CardTitle>
              <CardDescription>Manage banned phrases and content filtering rules</CardDescription>
            </div>
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-phrase">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Phrase
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Banned Phrase</DialogTitle>
                  <DialogDescription>
                    Add a new phrase to filter from user content
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Phrase</label>
                    <Input
                      placeholder="Enter banned phrase..."
                      value={newPhrase}
                      onChange={(e) => setNewPhrase(e.target.value)}
                      data-testid="input-phrase"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Severity</label>
                    <Select value={newSeverity} onValueChange={(value: "block" | "flag") => setNewSeverity(value)}>
                      <SelectTrigger data-testid="select-severity">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="block">Block (Prevent posting)</SelectItem>
                        <SelectItem value="flag">Flag (Mark for review)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Category (optional)</label>
                    <Input
                      placeholder="e.g., profanity, spam, hate-speech..."
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      data-testid="input-category"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => {
                      if (newPhrase.trim()) {
                        addPhraseMutation.mutate({
                          phrase: newPhrase.trim(),
                          severity: newSeverity,
                          category: newCategory.trim() || undefined,
                        });
                      }
                    }}
                    disabled={!newPhrase.trim() || addPhraseMutation.isPending}
                    data-testid="button-confirm-add-phrase"
                  >
                    {addPhraseMutation.isPending ? "Adding..." : "Add Phrase"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
      </Card>

      {/* Phrase List */}
      <div className="space-y-3">
        {isLoading ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">Loading banned phrases...</p>
            </CardContent>
          </Card>
        ) : bannedPhrases?.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <div className="text-center">
                <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground mb-2">No banned phrases configured</p>
                <p className="text-sm text-muted-foreground">
                  Add phrases to automatically filter offensive content
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          bannedPhrases?.map((phrase: any) => (
            <Card key={phrase.id} data-testid={`card-phrase-${phrase.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <code className="text-sm font-mono bg-muted px-2 py-1 rounded" data-testid={`text-phrase-${phrase.id}`}>
                        {phrase.phrase}
                      </code>
                      <Badge variant={getSeverityBadgeVariant(phrase.severity)} data-testid={`badge-severity-${phrase.id}`}>
                        {phrase.severity}
                      </Badge>
                      {phrase.category && (
                        <Badge variant="outline" data-testid={`badge-category-${phrase.id}`}>
                          {phrase.category}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">
                      {getSeverityDescription(phrase.severity)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Added {formatDistanceToNow(new Date(phrase.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" data-testid={`button-delete-${phrase.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Banned Phrase</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to remove "{phrase.phrase}" from the banned phrases list?
                          This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deletePhraseMutation.mutate(phrase.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
