// 1. PINNED IMPORTS (Stable for Deno 2.x)
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

// 2. CONFIGURATION
const databaseUrl = Deno.env.get("DATABASE_URL");
const DISCOGS_TOKEN = Deno.env.get("DISCOGS_TOKEN");

const sql = postgres(databaseUrl, { 
  ssl: "require", 
  max: 1,
  idle_timeout: 20 
});

// 3. GLOBAL CORS HEADERS
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

console.log("🚀 Server Online: Handling Latency & Music Search");

serve(async (req) => {
  const url = new URL(req.url);
  
  // Handle Browser Pre-flight Security
  if (req.method === "OPTIONS") return new Response(null, { headers });

  try {
    // --- ROUTE 1: MUSIC SEARCH (Discogs API) ---
    // Fixes the 404 for /search-album?q=...
    if (url.pathname === "/search-album") {
      const query = url.searchParams.get("q");
      if (!query) {
        return new Response(JSON.stringify({ error: "No query provided" }), { status: 400, headers });
      }

      console.log(`🔍 Searching Discogs for: ${query}`);
      
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
      return new Response(JSON.stringify(data), {
        headers: { ...headers, "Content-Type": "application/json" }
      });
    }

    // --- ROUTE 2: FETCH LATENCY STATS (For Chart.js) ---
    if (url.pathname === "/stats") {
      const logs = await sql`
        SELECT ping_ms, created_at FROM latency_logs 
        ORDER BY created_at DESC LIMIT 20`;
      
      const data = logs.length > 0 ? logs.reverse() : [];
      return new Response(JSON.stringify(data), {
        headers: { ...headers, "Content-Type": "application/json" }
      });
    }

    // --- ROUTE 3: LOG NEW PING ---
    if (url.pathname === "/log" && req.method === "POST") {
      const body = await req.json();
      
      // Auto-create table if missing
      await sql`CREATE TABLE IF NOT EXISTS latency_logs (
        id SERIAL PRIMARY KEY, 
        ping_ms INTEGER NOT NULL, 
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`;

      await sql`INSERT INTO latency_logs (ping_ms) VALUES (${Number(body.ping_ms)})`;
      
      return new Response(JSON.stringify({ status: "success" }), {
        headers: { ...headers, "Content-Type": "application/json" }
      });
    }

    // --- DEFAULT ROUTE ---
    return new Response("API Active: Ready for Latency & Music Search", { headers });

  } catch (err) {
    console.error("Critical Server Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" }
    });
  }
});
