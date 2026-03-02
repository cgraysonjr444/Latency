import postgres from "https://deno.land/x/postgresjs@v3.3.3/mod.js";

// 1. Initialize the database connection
const sql = postgres(Deno.env.get("DATABASE_URL"), {
  ssl: { rejectUnauthorized: false },
});

async function initializeDatabase() {
  try {
    console.log("Connecting to database...");

    // Ensure the table exists
    await sql`
      CREATE TABLE IF NOT EXISTS spins (
        id SERIAL PRIMARY KEY,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // FIX: Specifically add the 'data' column if it's missing from your existing table
    await sql`
      ALTER TABLE spins ADD COLUMN IF NOT EXISTS data JSONB;
    `;

    console.log("✅ Database ready and schema updated.");
  } catch (err) {
    console.error("❌ Database initialization failed:", err);
  }
}

// Run the DB logic
await initializeDatabase();

// --- SERVER LOGIC ---
const PORT = parseInt(Deno.env.get("PORT") || "10000");

Deno.serve({ port: PORT }, async (req) => {
  const url = new URL(req.url);

  try {
    // 1. Fetch the last 10 entries
    const recentSpins = await sql`
      SELECT id, created_at, data 
      FROM spins 
      ORDER BY created_at DESC 
      LIMIT 10
    `;

    // 2. Handle /data path: Return raw JSON
    if (url.pathname === "/data") {
      return new Response(JSON.stringify(recentSpins, null, 2), {
        headers: { "content-type": "application/json" },
      });
    }

    // 3. Handle root path: Show Status and Count
    const countResult = await sql`SELECT count(*) FROM spins`;
    const count = countResult[0].count;

    const html = `
      <html>
        <body style="font-family: sans-serif; padding: 2rem; line-height: 1.6;">
          <h1>✅ Latency Service: Online</h1>
          <p><strong>Database Status:</strong> Connected</p>
          <p><strong>Total Spins Recorded:</strong> ${count}</p>
          <hr />
          <p>To see raw data, visit: <a href="/data">/data</a></p>
        </body>
      </html>
    `;

    return new Response(html, {
      headers: { "content-type": "text/html" },
    });

  } catch (err) {
    console.error("Query error:", err);
    return new Response(`Database Query Error: ${err.message}`, { status: 500 });
  }
});

console.log(`🚀 Server listening on port ${PORT}`);

// --- HEARTBEAT ---
setInterval(() => {
  console.log(`[${new Date().toISOString()}] Heartbeat: Service is active.`);
}, 1000 * 60 * 60);
