import { useState, useEffect } from "react";

/**
 * Detects when a new Service Worker has taken control of the page.
 * With skipWaiting: true + clientsClaim: true in the workbox config,
 * the new SW activates immediately after install and fires `controllerchange`
 * on all existing clients — that's our signal to prompt a reload.
 */
export function useSwUpdate() {
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const onControllerChange = () => setUpdateReady(true);
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  const applyUpdate = () => window.location.reload();

  return { updateReady, applyUpdate };
}
