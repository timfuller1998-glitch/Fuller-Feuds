import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FALLACY_OPTIONS, type FallacyType } from "@shared/fallacies";
import { Loader2 } from "lucide-react";

interface FallacyFlagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (fallacyType: FallacyType) => void;
  isPending?: boolean;
  entityType: 'opinion' | 'topic' | 'message';
}

export default function FallacyFlagDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending = false,
  entityType,
}: FallacyFlagDialogProps) {
  const [selectedFallacy, setSelectedFallacy] = useState<FallacyType | ''>('');

  const handleSubmit = () => {
    if (selectedFallacy) {
      onSubmit(selectedFallacy);
      setSelectedFallacy('');
    }
  };

  const handleCancel = () => {
    setSelectedFallacy('');
    onOpenChange(false);
  };

  const entityText = entityType === 'opinion' ? 'opinion' : entityType === 'topic' ? 'topic' : 'message';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="dialog-flag">
        <DialogHeader>
          <DialogTitle>Flag {entityText} for logical fallacy</DialogTitle>
          <DialogDescription>
            Help keep debates productive by identifying logical fallacies. Select the type of fallacy you've observed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label htmlFor="fallacy-select" className="text-sm font-medium">
              Fallacy Type
            </label>
            <Select value={selectedFallacy} onValueChange={(value) => setSelectedFallacy(value as FallacyType)}>
              <SelectTrigger id="fallacy-select" data-testid="select-fallacy-type">
                <SelectValue placeholder="Select a fallacy type..." />
              </SelectTrigger>
              <SelectContent>
                {FALLACY_OPTIONS.map((fallacy) => (
                  <SelectItem 
                    key={fallacy.id} 
                    value={fallacy.id}
                    data-testid={`select-item-${fallacy.id}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{fallacy.icon}</span>
                      <div className="flex-1">
                        <div className="font-medium">{fallacy.name}</div>
                        <div className="text-xs text-muted-foreground">{fallacy.description}</div>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedFallacy && (
            <div className="rounded-lg bg-muted/50 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xl">{FALLACY_OPTIONS.find(f => f.id === selectedFallacy)?.icon}</span>
                <div className="font-semibold">{FALLACY_OPTIONS.find(f => f.id === selectedFallacy)?.name}</div>
              </div>
              <p className="text-sm text-muted-foreground">
                {FALLACY_OPTIONS.find(f => f.id === selectedFallacy)?.description}
              </p>
              {FALLACY_OPTIONS.find(f => f.id === selectedFallacy)?.example && (
                <p className="text-xs text-muted-foreground italic mt-2">
                  Example: {FALLACY_OPTIONS.find(f => f.id === selectedFallacy)?.example}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isPending}
            data-testid="button-cancel-flag"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedFallacy || isPending}
            data-testid="button-submit-flag"
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Flag
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
