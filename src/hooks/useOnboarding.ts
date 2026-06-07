import { useState, useEffect } from "react";
import { get, set } from "idb-keyval";

const KEY = "onboardingComplete";

export function useOnboarding() {
  /** null = still loading from IndexedDB */
  const [done, setDone] = useState<boolean | null>(null);

  useEffect(() => {
    get<boolean>(KEY).then(v => setDone(!!v));
  }, []);

  const complete = async () => {
    await set(KEY, true);
    setDone(true);
  };

  return { onboardingDone: done, completeOnboarding: complete };
}
