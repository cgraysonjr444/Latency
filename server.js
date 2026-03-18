// 1. PINNED IMPORTS (Required for Deno 2.x / GitHub Actions)
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

// 2. DATABASE CONFIG
const databaseUrl = Deno.env.get("DATABASE_URL");
const sql = postgres(databaseUrl, { 
  ssl: "require", 
  max: 1,
  idle_timeout: 20 
});

// 3. CORS HEADERS (Crucial for GitHub Pages to see the data)
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

console.log("🚀 Latency Backend: Online");

serve(async (req) => {
  const url = new URL(req.url);
  
  if (req.method === "OPTIONS") return new Response(null, { headers });

  try {
    // --- ROUTE: FETCH STATS (For Chart.js) ---
    if (url.pathname === "/stats" && req.method === "GET") {
      const logs = await sql`
        SELECT ping_ms, created_at FROM latency_logs 
        ORDER BY created_at DESC LIMIT 20`;
      
      // Ensure we send back an array, even if empty
      const data = logs.length > 0 ? logs.reverse() : [];
      return new Response(JSON.stringify(data), {
        headers: { ...headers, "Content-Type": "application/json" }
      });
    }

    // --- ROUTE: LOG NEW PULSE ---
    if (url.pathname === "/log" && req.method === "POST") {
      const body = await req.json();
      await sql`CREATE TABLE IF NOT EXISTS latency_logs (
        id SERIAL PRIMARY KEY, ping_ms INTEGER, created_at TIMESTAMPTZ DEFAULT NOW()
      )`;
      await sql`INSERT INTO latency_logs (ping_ms) VALUES (${Number(body.ping_ms)})`;
      return new Response(JSON.stringify({ status: "ok" }), { headers });
    }

    return new Response("API Active", { headers });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
});
