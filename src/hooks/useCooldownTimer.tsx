import { useState, useCallback, useEffect, useRef } from "react";

const COOLDOWN_SECONDS = 10;

export function useCooldownTimer() {
  const [cooldownEnd, setCooldownEnd] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCooldown = useCallback(() => {
    const end = Date.now() + COOLDOWN_SECONDS * 1000;
    setCooldownEnd(end);
    setRemaining(COOLDOWN_SECONDS);
  }, []);

  useEffect(() => {
    if (!cooldownEnd) return;

    timerRef.current = setInterval(() => {
      const left = Math.ceil((cooldownEnd - Date.now()) / 1000);
      if (left <= 0) {
        setCooldownEnd(null);
        setRemaining(0);
        if (timerRef.current) clearInterval(timerRef.current);
      } else {
        setRemaining(left);
      }
    }, 200);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [cooldownEnd]);

  return {
    isCoolingDown: remaining > 0,
    remaining,
    startCooldown,
  };
}
