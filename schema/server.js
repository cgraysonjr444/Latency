import postgres from "https://deno.land/x/postgresjs@v3.3.3/mod.js";

// 1. Initialize the database connection
const databaseUrl = Deno.env.get("DATABASE_URL");
const sql = databaseUrl 
  ? postgres(databaseUrl, { ssl: { rejectUnauthorized: false }, connect_timeout: 10 }) 
  : null;

async function initializeDatabase() {
  if (!sql) return;
  try {
    // Ensure table and the 'data' column exist
    await sql`CREATE TABLE IF NOT EXISTS spins (id SERIAL PRIMARY KEY, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);`;
    await sql`ALTER TABLE spins ADD COLUMN IF NOT EXISTS data JSONB;`;
    console.log("✅ Database schema is ready.");
  } catch (err) {
    console.error("❌ Database init error:", err);
  }
}
await initializeDatabase();

const PORT = parseInt(Deno.env.get("PORT") || "10000");

Deno.serve({ port: PORT }, async (req) => {
  const url = new URL(req.url);

  // 2. Mandatory CORS Headers for GitHub Pages
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  // Handle Browser "Pre-flight" security check
  if (req.method === "OPTIONS") return new Response(null, { headers });

  try {
    // --- ROUTE: POST /spin (Save new data) ---
    if (url.pathname === "/spin" && req.method === "POST") {
      const body = await req.json();
      const result = await sql`
        INSERT INTO spins (data) 
        VALUES (${body}) 
        RETURNING id, created_at
      `;
      return new Response(JSON.stringify({ success: true, saved: result[0] }), { 
        headers: { ...headers, "Content-Type": "application/json" } 
      });
    }

    // --- ROUTE: GET /data (Fetch last 10 for frontend) ---
    if (url.pathname === "/data") {
      const data = sql ? await sql`SELECT * FROM spins ORDER BY created_at DESC LIMIT 10` : [];
      return new Response(JSON.stringify(data), { 
        headers: { ...headers, "Content-Type": "application/json" } 
      });
    }

    // --- ROUTE: / (Visual Dashboard) ---
    let dbStatus = "Checking...";
    let spinCount = "0";

    if (!sql) {
      dbStatus = "❌ DATABASE_URL missing";
    } else {
      const countData = await sql`SELECT count(*) FROM spins`;
      dbStatus = "✅ Connected to Postgres";
      spinCount = countData[0].count;
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Latency Status</title><meta charset="UTF-8"></head>
        <body style="font-family:sans-serif; background:#121212; color:white; padding:2rem; text-align:center;">
          <h1 style="color:#00ffcc;">💿 Latency Service</h1>
          <div style="background:#222; padding:2rem; border-radius:10px; display:inline-block; border:1px solid #333;">
            <p><strong>Server Status:</strong> <span style="color:#00ffcc;">ONLINE</span></p>
            <p><strong>Database:</strong> ${dbStatus}</p>
            <p><strong>Spins Recorded:</strong> <span style="color:#00ffcc; font-size:1.5rem;">${spinCount}</span></p>
          </div>
          <p style="margin-top:2rem;"><a href="/data" style="color:#00ffcc;">View API Data</a></p>
        </body>
      </html>
    `;

    return new Response(html, { headers: { ...headers, "Content-Type": "text/html" } });

  } catch (err) {
    console.error("Server Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: { ...headers, "Content-Type": "application/json" } 
    });
  }
}); // <--- THIS WAS THE MISSING LINE!

console.log(`🚀 Server live on port ${PORT}`);
