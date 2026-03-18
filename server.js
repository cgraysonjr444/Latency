import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

// 1. CONFIGURATION
const databaseUrl = Deno.env.get("DATABASE_URL");
const DISCOGS_TOKEN = Deno.env.get("DISCOGS_TOKEN");

const sql = postgres(databaseUrl, { 
  ssl: "require", 
  max: 1,
  idle_timeout: 20 
});

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

console.log("🚀 Vinyl Pulse Server: Online");

serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.toLowerCase();

  // Handle Browser Pre-flight
  if (req.method === "OPTIONS") return new Response(null, { headers });

  try {
    // --- ROUTE: MUSIC SEARCH (Discogs API) ---
    if (path.includes("search-album")) {
      const query = url.searchParams.get("q");
      
      // Safety Check: Missing Token
      if (!DISCOGS_TOKEN) {
        return new Response(JSON.stringify({ error: "DISCOGS_TOKEN is not set in Render Environment Variables" }), { status: 500, headers });
      }

      if (!query) {
        return new Response(JSON.stringify({ error: "Missing query parameter 'q'" }), { status: 400, headers });
      }

      console.log(`🔍 Searching Discogs for: ${query}`);

      const discogsRes = await fetch(
        `https://api.discogs.com/database/search?q=${encodeURIComponent(query)}&type=release&per_page=6`,
        {
          headers: {
            "Authorization": `Discogs token=${DISCOGS_TOKEN}`,
            // IMPORTANT: Discogs requires a unique User-Agent or it returns a 403
            "User-Agent": "VinylPulseApp/1.0 (cgraysonjr444)" 
          }
        }
      );

      if (!discogsRes.ok) {
        const errorText = await discogsRes.text();
        console.error("Discogs API Error:", errorText);
        return new Response(JSON.stringify({ error: "Discogs API Rejected", details: errorText }), { status: discogsRes.status, headers });
      }

      const data = await discogsRes.json();
      return new Response(JSON.stringify(data), { headers });
    }

    // --- ROUTE: LATENCY STATS (For Chart.js) ---
    if (path.includes("stats")) {
      const logs = await sql`
        SELECT ping_ms, created_at FROM latency_logs 
        ORDER BY created_at DESC LIMIT 20`;
      
      return new Response(JSON.stringify(logs.reverse()), { headers });
    }

    // --- ROUTE: LOG PING ---
    if (path.includes("log") && req.method === "POST") {
      const body = await req.json();
      await sql`INSERT INTO latency_logs (ping_ms) VALUES (${Number(body.ping_ms)})`;
      return new Response(JSON.stringify({ status: "success" }), { headers });
    }

    // --- DEFAULT: HEARTBEAT ---
    return new Response(JSON.stringify({ 
      status: "Online", 
      database: "Connected",
      search_enabled: !!DISCOGS_TOKEN 
    }), { headers });

  } catch (err) {
    console.error("Internal Server Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
});
