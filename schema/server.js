import postgres from "https://deno.land/x/postgresjs@v3.3.3/mod.js";

const sql = postgres(Deno.env.get("DATABASE_URL"), {
  ssl: { rejectUnauthorized: false },
});

async function initializeDatabase() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS spins (
        id SERIAL PRIMARY KEY,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        data JSONB
      );
    `;
    console.log("✅ Database ready.");
  } catch (err) {
    console.error("❌ Database initialization failed:", err);
  }
}

await initializeDatabase();

const PORT = parseInt(Deno.env.get("PORT") || "10000");

Deno.serve({ port: PORT }, async (req) => {
  const url = new URL(req.url);

  try {
    // 1. Fetch the last 10 spins from the database
    const recentSpins = await sql`
      SELECT id, created_at, data 
      FROM spins 
      ORDER BY created_at DESC 
      LIMIT 10
    `;

    // 2. If the user visits /data, show the JSON
    if (url.pathname === "/data") {
      return new Response(JSON.stringify(recentSpins, null, 2), {
        headers: { "content-type": "application/json" },
      });
    }

    // 3. Default view: Show status and count
    const countResult = await sql`SELECT count(*) FROM spins`;
    const count = countResult[0].count;

    return new Response(
      `Latency Service: Online\n\nTotal Spins in DB: ${count}\nVisit /data to see the latest entries.`,
      { headers: { "content-type": "text/plain" } }
    );

  } catch (err) {
    console.error("Query error:", err);
    return new Response("Database Query Error", { status: 500 });
  }
});

console.log(`🚀 Server listening on port ${PORT}`);
