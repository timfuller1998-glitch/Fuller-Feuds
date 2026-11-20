import { useCallback, useEffect, useRef, useState } from "react";
import { isBareOpinion } from "@shared/opinionStrength";

/**
 * Intercepts a submit so a one-word / very bare opinion gets a gentle
 * "Add your reason?" tip. Posting is never blocked: the user can post anyway.
 */
export function useBareOpinionGuard(text: string) {
  const [showTip, setShowTip] = useState(false);
  const pendingRef = useRef<(() => void) | null>(null);
  const triggerTextRef = useRef<string | null>(null);

  useEffect(() => {
    if (showTip && text !== triggerTextRef.current) {
      setShowTip(false);
      pendingRef.current = null;
    }
  }, [text, showTip]);

  const guard = useCallback(
    (submit: () => void) => {
      if (isBareOpinion(text)) {
        pendingRef.current = submit;
        triggerTextRef.current = text;
        setShowTip(true);
        return;
      }
      setShowTip(false);
      pendingRef.current = null;
      submit();
    },
    [text],
  );

  const keepWriting = useCallback(() => {
    setShowTip(false);
    pendingRef.current = null;
  }, []);

  const postAnyway = useCallback(() => {
    const submit = pendingRef.current;
    pendingRef.current = null;
    setShowTip(false);
    submit?.();
  }, []);

  return { showTip, guard, keepWriting, postAnyway };
}
