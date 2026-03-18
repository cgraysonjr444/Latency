// 1. PINNED IMPORTS (Required for Deno 2.x / Exit Code 0)
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.3.3/mod.js";

// 2. DATABASE CONFIG
const databaseUrl = Deno.env.get("DATABASE_URL");
const sql = postgres(databaseUrl, { 
  ssl: "require", 
  max: 1,
  idle_timeout: 20 
});

// 3. CORS HEADERS (Ensures GitHub Pages can talk to Render)
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

console.log("Latency Monitor: Online 📡");

serve(async (req) => {
  const url = new URL(req.url);
  
  // Handle Pre-flight security check
  if (req.method === "OPTIONS") return new Response(null, { headers });

  try {
    // --- ROUTE: LOG LATENCY PULSE ---
    if (url.pathname === "/log" && req.method === "POST") {
      const body = await req.json();
      
      // Safety: Create the latency table if it's missing
      await sql`
        CREATE TABLE IF NOT EXISTS latency_logs (
          id SERIAL PRIMARY KEY,
          user_email TEXT,
          ping_ms INTEGER,
          device_info JSONB,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )`;

      const result = await sql`
        INSERT INTO latency_logs (user_email, ping_ms, device_info)
        VALUES (${body.user_email || 'guest'}, ${body.ping_ms}, ${sql.json(body)})
        RETURNING *`;

      return new Response(JSON.stringify({ status: "captured", data: result[0] }), {
        headers: { ...headers, "Content-Type": "application/json" }
      });
    }

    // --- ROUTE: FETCH STATS ---
    if (url.pathname === "/stats" && req.method === "GET") {
      const logs = await sql`
        SELECT ping_ms, created_at FROM latency_logs 
        ORDER BY created_at DESC LIMIT 50`;
        
      return new Response(JSON.stringify(logs), {
        headers: { ...headers, "Content-Type": "application/json" }
      });
    }

    return new Response("Latency Monitor Active", { headers });

  } catch (err) {
    console.error("Monitor Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" }
    });
  }
});
