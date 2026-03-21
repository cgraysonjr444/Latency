import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

// 1. DATABASE & API CONFIG
const sql = postgres(Deno.env.get("DATABASE_URL"), { ssl: "require", max: 1 });
const DISCOGS_TOKEN = Deno.env.get("DISCOGS_TOKEN");

// 2. GLOBAL CORS HEADERS
const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

console.log("🚀 Vinyl Pulse Backend: Initialized");

serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.toLowerCase();

  // Handle Browser Pre-flight Security
  if (req.method === "OPTIONS") return new Response(null, { headers });

  try {
    // --- ROUTE: MUSIC SEARCH (Discogs API Bridge) ---
    if (path.includes("search-album")) {
      const query = url.searchParams.get("q");
      
      if (!DISCOGS_TOKEN) {
        return new Response(JSON.stringify({ error: "DISCOGS_TOKEN missing on Render" }), { status: 500, headers });
      }
      if (!query) {
        return new Response(JSON.stringify({ error: "Query 'q' required" }), { status: 400, headers });
      }

      console.log(`🔍 Searching Discogs for: ${query}`);

      const discogsRes = await fetch(
        `https://api.discogs.com/database/search?q=${encodeURIComponent(query)}&type=release&per_page=6`,
        {
          headers: {
            "Authorization": `Discogs token=${DISCOGS_TOKEN}`,
            // Discogs strictly requires a unique User-Agent
            "User-Agent": "VinylPulseApp/1.0 (cgraysonjr444)" 
          }
        }
      );

      if (!discogsRes.ok) {
        const errorText = await discogsRes.text();
        console.error("Discogs API Error:", errorText);
        return new Response(JSON.stringify({ error: "Discogs Rejected Request", details: errorText }), { status: discogsRes.status, headers });
      }

      const data = await discogsRes.json();
      return new Response(JSON.stringify(data), { headers });
    }

    // --- ROUTE: LATENCY STATS (For Chart.js) ---
    if (path.includes("stats")) {
      const logs = await sql`
        SELECT ping_ms, created_at FROM latency_logs 
        ORDER BY created_at DESC LIMIT 20`;
      
      // Reverse so the chart draws chronologically (Left to Right)
      return new Response(JSON.stringify(logs.reverse()), { headers });
    }
