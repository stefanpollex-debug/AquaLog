import { Capacitor } from "@capacitor/core";

/** Absolute base URL for API calls.
 *  Native (iOS/Android): requests must go to the Vercel deployment.
 *  Web/PWA: relative path works fine. */
export const API_BASE = Capacitor.isNativePlatform()
  ? "https://pool-bericht.vercel.app"
  : "";
