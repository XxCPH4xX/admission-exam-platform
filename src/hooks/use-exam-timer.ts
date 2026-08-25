"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Server-authoritative countdown.
 *
 * The server owns `endsAtIso`; the client only renders the delta between
 * now and that deadline (immune to re-render drift). Every autosave ack
 * refreshes `endsAtIso`, so a sleeping tab resyncs on its next save.
 */
export function useExamTimer(
  endsAtIso: string | null,
  { onExpire }: { onExpire: () => void }
): number {
  const [remainingSeconds, setRemaining] = useState(0);
  const expireRef = useRef(onExpire);
  expireRef.current = onExpire;
  const firedRef = useRef(false);

  useEffect(() => {
    firedRef.current = false;
    if (!endsAtIso) {
      setRemaining(0);
      return;
    }

    const deadline = new Date(endsAtIso).getTime();

    const tick = () => {
      const diff = Math.floor((deadline - Date.now()) / 1000);
      const next = Math.max(0, diff);
      setRemaining(next);
      if (next <= 0 && !firedRef.current) {
        firedRef.current = true;
        expireRef.current();
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    // Resync immediately when the tab becomes visible again.
    const onVisible = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [endsAtIso]);

  return remainingSeconds;
}
