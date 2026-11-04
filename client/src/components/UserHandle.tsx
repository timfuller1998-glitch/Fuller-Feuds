import { cn } from "@/lib/utils";

/** "@handle" in small muted text, shown under a display name. Renders nothing if the user has no handle. */
export function UserHandle({ handle, className, testId }: { handle?: string | null; className?: string; testId?: string }) {
  if (!handle) return null;
  return (
    <span className={cn("block text-xs leading-tight text-muted-foreground truncate", className)} data-testid={testId}>
      @{handle}
    </span>
  );
}
