// 1. PINNED IMPORTS (Required for Deno 2.x / GitHub Actions Pass)
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

// 2. DATABASE CONFIG
const databaseUrl = Deno.env.get("DATABASE_URL");
const sql = postgres(databaseUrl, { 
  ssl: "require", 
  max: 1,
  idle_timeout: 20 
});

// 3. CORS HEADERS (Crucial: Allows your website to "see" the data)
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

console.log("🚀 Latency Backend: Online");

serve(async (req) => {
  const url = new URL(req.url);
  
  // Handle security pre-flight
  if (req.method === "OPTIONS") return new Response(null, { headers });

  try {
    // --- ROUTE: LOG NEW PULSE ---
    if (url.pathname === "/log" && req.method === "POST") {
      const body = await req.json();
      
      // Auto-create table
      await sql`CREATE TABLE IF NOT EXISTS latency_logs (
        id SERIAL PRIMARY KEY,
        ping_ms INTEGER NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`;

      await sql`INSERT INTO latency_logs (ping_ms) VALUES (${body.ping_ms})`;
      return new Response(JSON.stringify({ status: "logged" }), {
        headers: { ...headers, "Content-Type": "application/json" }
      });
    }

    // --- ROUTE: FETCH STATS (Used by Chart.js) ---
    if (url.pathname === "/stats" && req.method === "GET") {
      const logs = await sql`
        SELECT ping_ms, created_at FROM latency_logs 
        ORDER BY created_at DESC LIMIT 20`;
      
      // .reverse() makes the chart draw from left (oldest) to right (newest)
      return new Response(JSON.stringify(logs.reverse()), {
        headers: { ...headers, "Content-Type": "application/json" }
      });
    }

    return new Response("Latency API Active", { headers });

  } catch (err) {
    console.error("Server Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" }
    });
  }
});
