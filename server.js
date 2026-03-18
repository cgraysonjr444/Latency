import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

// 1. DB & API CONFIG
const sql = postgres(Deno.env.get("DATABASE_URL"), { ssl: "require", max: 1 });
const DISCOGS_TOKEN = Deno.env.get("DISCOGS_TOKEN");

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

console.log("🚀 Server Starting: Monitoring /stats and /search-album");

serve(async (req) => {
  const url = new URL(req.url);
  // Clean the path to prevent matching errors
  const path = url.pathname.replace(/\/$/, ""); 

  // Handle CORS Pre-flight
  if (req.method === "OPTIONS") return new Response(null, { headers });

  try {
    // --- ROUTE: MUSIC SEARCH ---
    if (path === "/search-album") {
      const query = url.searchParams.get("q");
      if (!query) return new Response(JSON.stringify({ error: "No query" }), { status: 400, headers });

      const discogsRes = await fetch(
        `https://api.discogs.com/database/search?q=${encodeURIComponent(query)}&type=release&per_page=5`,
        {
          headers: {
            "Authorization": `Discogs token=${DISCOGS_TOKEN}`,
            "User-Agent": "LatencyMonitor/1.0"
          }
        }
      );
      const data = await discogsRes.json();
      return new Response(JSON.stringify(data), { headers });
    }

    // --- ROUTE: CHART DATA ---
    if (path === "/stats") {
      const logs = await sql`
        SELECT ping_ms, created_at FROM latency_logs 
        ORDER BY created_at DESC LIMIT 20`;
      
      // We reverse so the chart reads left-to-right (Oldest to Newest)
      return new Response(JSON.stringify(logs.reverse()), { headers });
    }

    // --- ROUTE: LOG PING ---
    if (path === "/log" && req.method === "POST") {
      const body = await req.json();
      await sql`INSERT INTO latency_logs (ping_ms) VALUES (${Number(body.ping_ms)})`;
      return new Response(JSON.stringify({ status: "ok" }), { headers });
    }

    // --- FALLBACK: ONLY SHOW IF NO OTHER PATH MATCHES ---
    return new Response(JSON.stringify({ 
        message: "Backend is Awake 🚀", 
        active_endpoints: ["/stats", "/search-album", "/log"] 
    }), { status: 200, headers });

  } catch (err) {
    console.error("Server Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), { 
        status: 500, 
        headers 
    });
  }
});
