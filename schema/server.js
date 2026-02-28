import postgres from "https://deno.land/x/postgresjs@v3.3.3/mod.js";

// 1. Setup Database Connection
const databaseUrl = Deno.env.get("DATABASE_URL");
if (!databaseUrl) {
  console.error("DATABASE_URL is not set!");
}

const sql = postgres(databaseUrl, { ssl: "require" });

// 2. Ensure Table Exists
try {
  await sql`
    CREATE TABLE IF NOT EXISTS spins (
      id SERIAL PRIMARY KEY,
      rpm FLOAT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  console.log("✅ Database table is ready.");
} catch (err) {
  console.error("❌ Database init error:", err);
}

// 3. Start the Server
Deno.serve(async (req) => {
  const url = new URL(req.url);
  const method = req.method;

  // 🛡️ Universal CORS Headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  // Handle browser "Preflight" OPTIONS requests
  if (method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 🏓 GET /ping
    if (url.pathname === "/ping") {
      return new Response(JSON.stringify({ status: "pong" }), { headers: corsHeaders });
    }

    // 📥 POST /spins
    if (url.pathname === "/spins" && method === "POST") {
      const { rpm } = await req.json();
      await sql`INSERT INTO spins (rpm) VALUES (${rpm})`;
      return new Response(JSON.stringify({ message: "Spin saved!" }), { headers: corsHeaders });
    }

    // 📜 GET /history
    if (url.pathname === "/history") {
      const history = await sql`SELECT * FROM spins ORDER BY created_at DESC LIMIT 15`;
      return new Response(JSON.stringify(history), { headers: corsHeaders });
    }

    // 🚫 404 for anything else
    return new Response(JSON.stringify({ error: "Route not found" }), { 
      status: 404, 
      headers: corsHeaders 
    });

  } catch (err) {
    console.error("Server Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: corsHeaders 
    });
  }
});
