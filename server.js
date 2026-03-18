import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

const sql = postgres(Deno.env.get("DATABASE_URL"), { ssl: "require", max: 1 });

const headers = {
  "Access-Control-Allow-Origin": "https://cgraysonjr444.github.io", // Allow your specific site
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

serve(async (req) => {
  const url = new URL(req.url);
  if (req.method === "OPTIONS") return new Response(null, { headers });

  try {
    // HEARTBEAT ROUTE: Check if server is awake
    if (url.pathname === "/") {
      return new Response("Backend is Awake 🚀", { headers });
    }

    // DATA ROUTE: Fetch last 20 pings
    if (url.pathname === "/stats") {
      const logs = await sql`SELECT ping_ms, created_at FROM latency_logs ORDER BY created_at DESC LIMIT 20`;
      return new Response(JSON.stringify(logs.reverse()), {
        headers: { ...headers, "Content-Type": "application/json" }
      });
    }

    // LOG ROUTE: Save new ping
    if (url.pathname === "/log" && req.method === "POST") {
      const { ping_ms } = await req.json();
      await sql`INSERT INTO latency_logs (ping_ms) VALUES (${ping_ms})`;
      return new Response(JSON.stringify({ status: "saved" }), { headers });
    }

    return new Response("Not Found", { status: 404, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
});
