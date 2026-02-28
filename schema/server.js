import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.3.3/mod.js";

const databaseUrl = Deno.env.get("DATABASE_URL");
const sql = postgres(databaseUrl, { ssl: "require" });

// 🏥 Automatic Table Creator (just in case!)
await sql`
  CREATE TABLE IF NOT EXISTS spins (
    id SERIAL PRIMARY KEY,
    rpm FLOAT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

serve(async (req) => {
  const url = new URL(req.url);

  // 🛡️ CORS HEADERS
  const headers = {
    "content-type": "application/json",
    "Access-Control-Allow-Origin": "*", // Allows any website to call your API
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  // Handle "Preflight" requests (Browsers send these first)
  if (req.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  try {
    // 🏓 PING ROUTE
    if (url.pathname === "/ping" && req.method === "GET") {
      return new Response(JSON.stringify({ status: "pong" }), { headers });
    }

    // 📥 SAVE SPIN ROUTE
    if (url.pathname === "/spins" && req.method === "POST") {
      const { rpm } = await req.json();
      await sql`INSERT INTO spins (rpm) VALUES (${rpm})`;
      return new Response(JSON.stringify({ message: "Success" }), { headers });
    }

    // 📜 HISTORY ROUTE
    if (url.pathname === "/history" && req.method === "GET") {
      const history = await sql`SELECT * FROM spins ORDER BY created_at DESC LIMIT 10`;
      return new Response(JSON.stringify(history), { headers });
    }

    return new Response("Not Found", { status: 404, headers });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
});
