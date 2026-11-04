import { useEffect, useRef, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validateHandle, normalizeHandleInput, HANDLE_MAX } from "@shared/handle";

export type HandleStatus = "idle" | "checking" | "available" | "unavailable";

type Check = { handle: string; valid: boolean; available: boolean; reason?: string; suggestion?: string };

/**
 * @handle picker with live (debounced) availability. Used at sign-up, onboarding and in Settings.
 * `current` is the user's existing handle (shown as available without a round trip).
 * `suggestFrom` (e.g. the typed first name) pre-fills a free suggestion while the field is still empty/untouched.
 */
export function HandleField({
  value,
  onChange,
  onStatusChange,
  current,
  suggestFrom,
  disabled,
  id = "handle",
  label = "Handle",
}: {
  value: string;
  onChange: (v: string) => void;
  onStatusChange?: (s: HandleStatus) => void;
  current?: string | null;
  suggestFrom?: string;
  disabled?: boolean;
  id?: string;
  label?: string;
}) {
  const [status, setStatus] = useState<HandleStatus>("idle");
  const [msg, setMsg] = useState<string | undefined>();
  const [suggestion, setSuggestion] = useState<string | undefined>();
  const touched = useRef(false);
  const seq = useRef(0);

  const set = (s: HandleStatus) => {
    setStatus(s);
    onStatusChange?.(s);
  };

  // Suggest a handle from the name until the user types their own.
  useEffect(() => {
    if (touched.current || !suggestFrom?.trim() || current) return;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/handles/suggest?name=${encodeURIComponent(suggestFrom)}`, { credentials: "include" });
        const j = await r.json();
        if (!touched.current && j?.suggestion) onChange(j.suggestion);
      } catch {}
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestFrom, current]);

  // Debounced availability check.
  useEffect(() => {
    const h = normalizeHandleInput(value);
    if (!h) {
      set("idle");
      setMsg(undefined);
      setSuggestion(undefined);
      return;
    }
    if (current && h === current) {
      set("available");
      setMsg("This is your current handle");
      setSuggestion(undefined);
      return;
    }
    const localErr = validateHandle(h);
    if (localErr) {
      set("unavailable");
      setMsg(localErr);
      setSuggestion(undefined);
      return;
    }
    set("checking");
    setMsg(undefined);
    const my = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/handles/check?handle=${encodeURIComponent(h)}`, { credentials: "include" });
        const j: Check = await r.json();
        if (my !== seq.current) return;
        if (j.available) {
          set("available");
          setMsg(`@${j.handle} is available`);
          setSuggestion(undefined);
        } else {
          set("unavailable");
          setMsg(j.reason || "Not available");
          setSuggestion(j.suggestion);
        }
      } catch {
        if (my === seq.current) {
          set("idle");
          setMsg("Couldn't check right now");
        }
      }
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, current]);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
        <Input
          id={id}
          value={value}
          onChange={(e) => {
            touched.current = true;
            onChange(normalizeHandleInput(e.target.value).replace(/\s/g, "").slice(0, HANDLE_MAX));
          }}
          className="pl-7 pr-9"
          placeholder="yourhandle"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          disabled={disabled}
          aria-invalid={status === "unavailable"}
          data-testid="input-handle"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2">
          {status === "checking" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {status === "available" && <Check className="h-4 w-4 text-success" />}
          {status === "unavailable" && <X className="h-4 w-4 text-destructive" />}
        </span>
      </div>
      <div className="min-h-[1.25rem] text-xs flex flex-wrap items-center gap-x-2" data-testid="text-handle-status">
        {msg ? (
          <span className={status === "unavailable" ? "text-destructive" : "text-muted-foreground"}>{msg}</span>
        ) : (
          <span className="text-muted-foreground">3–20 letters, numbers or _. Unique to you; your display name can repeat.</span>
        )}
        {suggestion && (
          <button
            type="button"
            className="text-xs font-medium text-primary underline-offset-2 hover:underline"
            onClick={() => {
              touched.current = true;
              onChange(suggestion);
            }}
            data-testid="button-use-suggested-handle"
          >
            Try @{suggestion}
          </button>
        )}
      </div>
    </div>
  );
}
