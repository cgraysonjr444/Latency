import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

// 1. DATABASE & API TOKEN CONFIG
const sql = postgres(Deno.env.get("DATABASE_URL"), { ssl: "require", max: 1 });
const DISCOGS_TOKEN = Deno.env.get("DISCOGS_TOKEN");

// 2. GLOBAL HEADERS (Allows GitHub Pages and Browser Access)
const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

console.log("🚀 Server Starting: Monitoring /stats and /search-album");

serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.toLowerCase(); // Standardize to lowercase

  // Handle Browser Pre-flight Security
  if (req.method === "OPTIONS") return new Response(null, { headers });

  try {
    // --- ROUTE: ALBUM SEARCH (Checks if "search-album" is in the path) ---
    if (path.includes("search-album")) {
      const query = url.searchParams.get("q");
      if (!query) {
        return new Response(JSON.stringify({ error: "Missing query parameter 'q'" }), { status: 400, headers });
      }

      const discogsRes = await fetch(
        `https://api.discogs.com/database/search?q=${encodeURIComponent(query)}&type=release&per_page=5`,
        {
          headers: {
            "Authorization": `Discogs token=${DISCOGS_TOKEN}`,
            "User-Agent": "LatencyApp/1.0"
          }
        }
      );
      
      const data = await discogsRes.json();
      return new Response(JSON.stringify(data), { headers });
    }

    // --- ROUTE: LATENCY STATS (Checks if "stats" is in the path) ---
    if (path.includes("stats")) {
      const logs = await sql`
        SELECT ping_ms, created_at FROM latency_logs 
        ORDER BY created_at DESC LIMIT 20`;
      
      // Reverse so the chart draws from left to right (chronological)
      return new Response(JSON.stringify(logs.reverse()), { headers });
    }

    // --- ROUTE: LOG PING (Checks if "log" is in the path) ---
    if (path.includes("log") && req.method === "POST") {
      const body = await req.json();
      await sql`INSERT INTO latency_logs (ping_ms) VALUES (${Number(body.ping_ms)})`;
      return new Response(JSON.stringify({ status: "ok" }), { headers });
    }

    // --- FALLBACK: HOME / HEARTBEAT ---
    // This only runs if the path does NOT contain "stats", "search-album", or "log"
    return new Response(JSON.stringify({ 
        message: "Backend is Awake 🚀", 
        current_path: path,
        endpoints: ["/stats", "/search-album?q=jid", "/log"] 
    }), { status: 200, headers });

  } catch (err) {
    console.error("Server Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), { 
        status: 500, 
        headers 
    });
  }
});
