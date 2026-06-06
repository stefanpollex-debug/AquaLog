/** Absolute base URL for API calls.
 *  Always points to the Vercel deployment — same-origin in the browser (no CORS),
 *  and correct absolute URL in the native Capacitor app where relative paths
 *  would resolve to capacitor://localhost which has no API handler. */
export const API_BASE = "https://pool-bericht.vercel.app";
