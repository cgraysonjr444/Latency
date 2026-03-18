// PINNED IMPORTS for Deno 2.x
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

const sql = postgres(Deno.env.get("DATABASE_URL"), { 
  ssl: "require", 
  max: 1,
  idle_timeout: 20 
});

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

console.log("🚀 Server Online");

serve(async (req) => {
  const url = new URL(req.url);
  if (req.method === "OPTIONS") return new Response(null, { headers });

  try {
    // --- NEW: EASY TEST ROUTE ---
    if (url.pathname === "/test") {
      const result = await sql`SELECT 1 as connected`;
      return new Response(JSON.stringify({ status: "Database Connected", result }), { headers });
    }

    // --- CHART DATA ROUTE ---
    if (url.pathname === "/stats") {
      const logs = await sql`SELECT ping_ms, created_at FROM latency_logs ORDER BY created_at DESC LIMIT 20`;
      return new Response(JSON.stringify(logs.reverse()), {
        headers: { ...headers, "Content-Type": "application/json" }
      });
    }

    // --- LOG DATA ROUTE ---
    if (url.pathname === "/log" && req.method === "POST") {
      const body = await req.json();
      await sql`CREATE TABLE IF NOT EXISTS latency_logs (id SERIAL, ping_ms INTEGER, created_at TIMESTAMPTZ DEFAULT NOW())`;
      await sql`INSERT INTO latency_logs (ping_ms) VALUES (${Number(body.ping_ms)})`;
      return new Response(JSON.stringify({ status: "ok" }), { headers });
    }

    return new Response("API Active", { headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
});
