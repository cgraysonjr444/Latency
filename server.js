// 1. PINNED IMPORTS (Essential for Deno 2.x / GitHub Actions Success)
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

// 2. DATABASE CONFIG (Render provides DATABASE_URL automatically)
const databaseUrl = Deno.env.get("DATABASE_URL");
const sql = postgres(databaseUrl, { 
  ssl: "require", 
  max: 1,           // Optimized for Free Tier connection limits
  idle_timeout: 20 
});

// 3. CORS HEADERS (Crucial: Allows the website to talk to this server)
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

console.log("🚀 Latency Backend: Online and listening...");

serve(async (req) => {
  const url = new URL(req.url);
  
  // Handle Browser Pre-flight checks
  if (req.method === "OPTIONS") return new Response(null, { headers });

  try {
    // --- ROUTE: FETCH DATA FOR CHART ---
    if (url.pathname === "/stats" && req.method === "GET") {
      const logs = await sql`
        SELECT ping_ms, created_at FROM latency_logs 
        ORDER BY created_at DESC LIMIT 20`;
      
      // Ensure we always return an array (reverse for left-to-right drawing)
      const data = logs.length > 0 ? logs.reverse() : [];
      return new Response(JSON.stringify(data), {
        headers: { ...headers, "Content-Type": "application/json" }
      });
    }

    // --- ROUTE: LOG NEW LATENCY PULSE ---
    if (url.pathname === "/log" && req.method === "POST") {
      const body = await req.json();
      
      // Auto-setup table if it doesn't exist
      await sql`CREATE TABLE IF NOT EXISTS latency_logs (
        id SERIAL PRIMARY KEY, 
        ping_ms INTEGER NOT NULL, 
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`;

      const result = await sql`
        INSERT INTO latency_logs (ping_ms) 
        VALUES (${Number(body.ping_ms)}) 
        RETURNING *`;

      return new Response(JSON.stringify({ status: "success", data: result[0] }), {
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
