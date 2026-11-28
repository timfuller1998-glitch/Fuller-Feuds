import { useEffect, useSyncExternalStore } from "react";
import {
  DEFAULT_COMPASS_COLOR_SCHEME,
  parseCompassColorScheme,
  type CompassColorScheme,
} from "@shared/politicalCompass";
import { useAuth } from "@/hooks/useAuth";

const STORAGE_KEY = "compassColorScheme";

let current: CompassColorScheme = DEFAULT_COMPASS_COLOR_SCHEME;
const listeners = new Set<() => void>();

function emit(next: CompassColorScheme) {
  if (current === next) return;
  current = next;
  listeners.forEach((listener) => listener());
}

export function getCompassColorScheme(): CompassColorScheme {
  return current;
}

export function subscribeCompassColorScheme(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

export function applyCompassColorScheme(
  scheme: CompassColorScheme,
  opts?: { persistLocal?: boolean },
): void {
  emit(scheme);
  if (typeof localStorage === "undefined") return;
  if (opts?.persistLocal) {
    try {
      localStorage.setItem(STORAGE_KEY, scheme);
    } catch {
      // ignore quota / private mode
    }
  }
}

export function resetCompassColorSchemeToStandard(): void {
  emit(DEFAULT_COMPASS_COLOR_SCHEME);
}

export function useCompassColorScheme(): CompassColorScheme {
  return useSyncExternalStore(
    subscribeCompassColorScheme,
    getCompassColorScheme,
    () => DEFAULT_COMPASS_COLOR_SCHEME,
  );
}

/**
 * Keep the in-memory scheme in sync with the signed-in account.
 * Logged-out users always get Standard — leftover localStorage is not applied.
 */
export function CompassColorSchemeSync() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const accountScheme = (user as { compassColorScheme?: unknown } | null | undefined)?.compassColorScheme;
  const userId = (user as { id?: string } | null | undefined)?.id;
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || !userId) {
      resetCompassColorSchemeToStandard();
      return;
    }
    applyCompassColorScheme(parseCompassColorScheme(accountScheme), { persistLocal: true });
  }, [isLoading, isAuthenticated, userId, accountScheme]);
  return null;
}
