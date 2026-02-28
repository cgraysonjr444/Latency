import postgres from "https://deno.land/x/postgresjs@v3.3.3/mod.js";

// 1. Setup Database Connection with SSL fix
const databaseUrl = Deno.env.get("DATABASE_URL");

// The fix is here: rejectUnauthorized: false
const sql = postgres(databaseUrl, { 
  ssl: { rejectUnauthorized: false } 
});

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

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (url.pathname === "/ping") {
      return new Response(JSON.stringify({ status: "pong" }), { headers: corsHeaders });
    }

    if (url.pathname === "/spins" && method === "POST") {
      const { rpm } = await req.json();
      await sql`INSERT INTO spins (rpm) VALUES (${rpm})`;
      return new Response(JSON.stringify({ message: "Spin saved!" }), { headers: corsHeaders });
    }

    if (url.pathname === "/history") {
      const history = await sql`SELECT * FROM spins ORDER BY created_at DESC LIMIT 15`;
      return new Response(JSON.stringify(history), { headers: corsHeaders });
    }

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
