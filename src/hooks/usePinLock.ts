import { useState, useEffect, useCallback } from "react";
import { get, set, del } from "idb-keyval";

const PIN_KEY    = "pin_hash";
const MAX_TRIES  = 3;
const LOCKOUT_MS = 30_000;

async function hashPin(pin: string): Promise<string> {
  const data   = new TextEncoder().encode("aqualog_pin:" + pin);
  const buffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

export function usePinLock() {
  const [hasPin,      setHasPin]      = useState(false);
  const [unlocked,    setUnlocked]    = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [attempts,    setAttempts]    = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);

  useEffect(() => {
    get<string>(PIN_KEY).then(hash => {
      setHasPin(!!hash);
      setLoading(false);
    });
  }, []);

  /** Set (or replace) the PIN. Marks the session as unlocked. */
  const setPin = useCallback(async (pin: string) => {
    const hash = await hashPin(pin);
    await set(PIN_KEY, hash);
    setHasPin(true);
    setUnlocked(true);
    setAttempts(0);
    setLockedUntil(null);
  }, []);

  /**
   * Verify PIN with attempt tracking + lockout.
   * Used on the main unlock screen — wrong guesses count towards the 30s lockout.
   */
  const verifyPin = useCallback(async (pin: string): Promise<boolean> => {
    if (lockedUntil !== null && Date.now() < lockedUntil) return false;

    const stored = await get<string>(PIN_KEY);
    if (!stored) { setUnlocked(true); return true; }

    const hash = await hashPin(pin);
    if (hash === stored) {
      setUnlocked(true);
      setAttempts(0);
      setLockedUntil(null);
      return true;
    }

    // Wrong — track attempts
    setAttempts(prev => {
      const next = prev + 1;
      if (next >= MAX_TRIES) setLockedUntil(Date.now() + LOCKOUT_MS);
      return next;
    });
    return false;
  }, [lockedUntil]);

  /**
   * Pure PIN check without attempt tracking.
   * Used in Settings (change / remove PIN flow).
   */
  const checkPin = useCallback(async (pin: string): Promise<boolean> => {
    const stored = await get<string>(PIN_KEY);
    if (!stored) return true;
    const hash = await hashPin(pin);
    return hash === stored;
  }, []);

  /** Remove the PIN entirely. */
  const clearPin = useCallback(async () => {
    await del(PIN_KEY);
    setHasPin(false);
    setUnlocked(true);
    setAttempts(0);
    setLockedUntil(null);
  }, []);

  return {
    hasPin, unlocked, loading, attempts, lockedUntil,
    setPin, verifyPin, checkPin, clearPin,
  };
}
