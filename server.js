// PINNED IMPORTS (Fixes Deno 2.x "Missing version" error)
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

const databaseUrl = Deno.env.get("DATABASE_URL");
const sql = postgres(databaseUrl, { ssl: "require", max: 1 });

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

serve(async (req) => {
  const url = new URL(req.url);
  if (req.method === "OPTIONS") return new Response(null, { headers });

  try {
    // GET DATA FOR THE CHART
    if (url.pathname === "/stats" && req.method === "GET") {
      const logs = await sql`SELECT ping_ms, created_at FROM latency_logs ORDER BY created_at DESC LIMIT 20`;
      return new Response(JSON.stringify(logs.reverse()), {
        headers: { ...headers, "Content-Type": "application/json" }
      });
    }

    // LOG NEW DATA
    if (url.pathname === "/log" && req.method === "POST") {
      const body = await req.json();
      await sql`INSERT INTO latency_logs (ping_ms) VALUES (${body.ping_ms})`;
      return new Response(JSON.stringify({ status: "ok" }), { headers });
    }

    return new Response("Latency API Active", { headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
});
