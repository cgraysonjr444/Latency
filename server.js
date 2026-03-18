import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.3.3/mod.js";

// 1. Database Connection (Optimized for Render Free Tier)
const databaseUrl = Deno.env.get("DATABASE_URL");
const sql = postgres(databaseUrl, { 
  ssl: "require", 
  max: 1,
  idle_timeout: 20,
  connect_timeout: 30 
});

// 2. Global CORS Headers
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

console.log("Vinyl Pulse API is starting up...");

serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname;

  // Handle Browser CORS Pre-flight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  try {
    // --- ROUTE: SAVE A SPIN (POST) ---
    if (path === "/spin" && req.method === "POST") {
      const body = await req.json();
      
      // Safety: Ensure the table exists
      await sql`
        CREATE TABLE IF NOT EXISTS spins (
          id SERIAL PRIMARY KEY, 
          user_email TEXT,
          data JSONB, 
          created_at TIMESTAMPTZ DEFAULT NOW()
        )`;

      // Insert the data into Postgres
      const result = await sql`
        INSERT INTO spins (user_email, data) 
        VALUES (${body.user_email || 'guest_user'}, ${sql.json(body)}) 
        RETURNING *`;

      return new Response(JSON.stringify({ success: true, entry: result[0] }), {
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    // --- ROUTE: GET HISTORY (GET) ---
    if (path === "/data" && req.method === "GET") {
      const user = url.searchParams.get("user") || "guest_user";
      
      // Fetch the last 20 spins for this specific user
      const rows = await sql`
        SELECT data FROM spins 
        WHERE user_email = ${user} 
        ORDER BY created_at DESC 
        LIMIT 20`;

      return new Response(JSON.stringify(rows), {
        headers: { 
          ...headers, 
          "Content-Type": "application/json",
          "Cache-Control": "no-cache" // Ensures the browser always gets fresh data
        },
      });
    }

    // --- ROUTE: DISCOGS SEARCH (GET) ---
    if (path === "/search-album" && req.method === "GET") {
      const query = url.searchParams.get("q");
      const token = Deno.env.get("DISCOGS_TOKEN");

      const discogsRes = await fetch(
        `https://api.discogs.com/database/search?q=${encodeURIComponent(query)}&type=release&per_page=1`,
        { 
          headers: { 
            "User-Agent": "VinylPulse/1.0", 
            "Authorization": `Discogs token=${token}` 
          } 
        }
      );

      const data = await discogsRes.json();
      return new Response(JSON.stringify(data.results || []), {
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    // Health Check / Default Root
    return new Response("Vinyl Pulse API Online 💿", { 
      status: 200, 
      headers 
    });

  } catch (err) {
    console.error("Critical Server Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});
