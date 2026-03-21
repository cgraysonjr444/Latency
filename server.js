import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

const sql = postgres(Deno.env.get("DATABASE_URL"), { ssl: "require", max: 1 });
const DISCOGS_TOKEN = Deno.env.get("DISCOGS_TOKEN");

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.toLowerCase();

  if (req.method === "OPTIONS") return new Response(null, { headers });

  try {
    // --- ROUTE: SEARCH ---
    if (path.includes("search-album")) {
      const query = url.searchParams.get("q");
      if (!query) return new Response(JSON.stringify({ error: "No query" }), { status: 400, headers });

      const discogsRes = await fetch(
        `https://api.discogs.com/database/search?q=${encodeURIComponent(query)}&type=release&per_page=6`,
        {
          headers: {
            "Authorization": `Discogs token=${DISCOGS_TOKEN}`,
            "User-Agent": "VinylPulse/1.0"
          }
        }
      );

      const data = await discogsRes.json();
      return new Response(JSON.stringify(data), { headers });
    }

    // --- ROUTE: STATS ---
    if (path.includes("stats")) {
      const logs = await sql`SELECT ping_ms, created_at FROM latency_logs ORDER BY created_at DESC LIMIT 20`;
      return new Response(JSON.stringify(logs.reverse()), { headers });
    }

    // --- FALLBACK (Strict JSON) ---
    // This fixed the "unexpected character" error!
    return new Response(JSON.stringify({ status: "Vinyl Pulse Online 🚀" }), { headers });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
});
});
