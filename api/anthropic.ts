export const config = { runtime: "edge" };

const ALLOWED_MODELS = new Set(["claude-sonnet-4-6"]);
const MAX_TOKENS_CAP = 1200;
const ALLOWED_ORIGINS = [
  "https://pool-bericht.vercel.app",
  "http://localhost:5173",
];

// Best-effort In-Memory Rate-Limit pro Edge-Instanz — kein verteilter Speicher,
// bremst aber einfache Skript-Angriffe gegen eine einzelne Region deutlich aus.
const RATE_LIMIT = 12;          // Requests
const RATE_WINDOW_MS = 60_000;  // pro Minute
const hits = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  timestamps.push(now);
  hits.set(ip, timestamps);
  return timestamps.length > RATE_LIMIT;
}

function isAllowedOrigin(req: Request): boolean {
  const origin = req.headers.get("origin") ?? req.headers.get("referer") ?? "";
  return ALLOWED_ORIGINS.some((o) => origin.startsWith(o));
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!isAllowedOrigin(req)) {
    return new Response(
      JSON.stringify({ error: { message: "Origin not allowed" } }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return new Response(
      JSON.stringify({ error: { message: "Zu viele Anfragen — bitte kurz warten." } }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }

  const apiKey =
    process.env.ANTHROPIC_API_KEY ?? process.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: { message: "API key not configured on server" } }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: { message: "Invalid JSON body" } }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (typeof body.model !== "string" || !ALLOWED_MODELS.has(body.model)) {
    return new Response(
      JSON.stringify({ error: { message: "Model not allowed" } }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (typeof body.max_tokens !== "number" || body.max_tokens > MAX_TOKENS_CAP) {
    body.max_tokens = MAX_TOKENS_CAP;
  }

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
