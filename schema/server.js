import postgres from "https://deno.land/x/postgresjs@v3.3.3/mod.js";

const sql = postgres(Deno.env.get("DATABASE_URL"), {
  ssl: { rejectUnauthorized: false },
});

// Initialize DB and ensure columns exist
async function initializeDatabase() {
  try {
    await sql`CREATE TABLE IF NOT EXISTS spins (id SERIAL PRIMARY KEY, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);`;
    await sql`ALTER TABLE spins ADD COLUMN IF NOT EXISTS data JSONB;`;
    console.log("✅ Database ready.");
  } catch (err) {
    console.error("❌ Database error:", err);
  }
}
await initializeDatabase();

const PORT = parseInt(Deno.env.get("PORT") || "10000");

Deno.serve({ port: PORT }, async (req) => {
  const url = new URL(req.url);

  // 1. Mandatory CORS Headers (Fixes the "Connection Error" on GitHub)
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  // Handle Browser Security Pre-flight
  if (req.method === "OPTIONS") return new Response(null, { headers });

  try {
    // 2. Fetch Data
    const recentSpins = await sql`SELECT * FROM spins ORDER BY created_at DESC LIMIT 10`;
    const countResult = await sql`SELECT count(*) FROM spins`;
    const count = countResult[0].count;

    // 3. ROUTE: JSON Data (for your GitHub frontend)
    if (url.pathname === "/data") {
      return new Response(JSON.stringify(recentSpins), { 
        headers: { ...headers, "Content-Type": "application/json" } 
      });
    }

    // 4. ROUTE: Root Path (The visual dashboard so it's not a white screen)
    const html = `
      <html>
        <body style="font-family:sans-serif; padding:2rem; background:#121212; color:white; line-height:1.6;">
          <h1 style="color:#00ffcc;">💿 Latency Server: Online</h1>
          <p><strong>Database Status:</strong> Connected</p>
          <p><strong>Total Spins in DB:</strong> <span style="font-size:1.5rem; color:#00ffcc;">${count}</span></p>
          <hr style="border:0; border-top:1px solid #333; margin:2rem 0;"/>
          <p>Frontend Connection URL: <code style="background:#222; padding:5px;">${url.origin}</code></p>
          <p><a href="/data" style="color:#00ffcc;">View Raw JSON Data</a></p>
        </body>
      </html>
    `;

    return new Response(html, { 
      headers: { ...headers, "Content-Type": "text/html" } 
    });

  } catch (err) {
    return new Response(`Error: ${err.message}`, { status: 500, headers });
  }
});

console.log(`🚀 Server live on port ${PORT}`);
