import postgres from "https://deno.land/x/postgresjs@v3.3.3/mod.js";

// 1. Initialize the database connection
const sql = postgres(Deno.env.get("DATABASE_URL"), {
  ssl: { rejectUnauthorized: false },
});

async function initializeDatabase() {
  try {
    console.log("Connecting to database...");

    // 2. Ensure table exists
    await sql`
      CREATE TABLE IF NOT EXISTS spins (
        id SERIAL PRIMARY KEY,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        data JSONB
      );
    `;

    console.log("✅ Database connected and table 'spins' is ready!");

    // Test query
    const result = await sql`SELECT NOW()`;
    console.log("Current DB Time:", result[0].now);

  } catch (err) {
    console.error("❌ Database initialization failed:");
    console.error(err);
  }
}

// Run the DB logic
await initializeDatabase();

// --- OPTION 2: PORT BINDING FOR RENDER ---
// This opens a tiny web server so Render's "Port Scan" succeeds.
const PORT = parseInt(Deno.env.get("PORT") || "10000");

console.log(`🚀 Port binding active on port ${PORT}. Service is staying alive.`);

Deno.serve({ port: PORT }, (req) => {
  return new Response("Latency Service: Online", { status: 200 });
});

// --- HEARTBEAT ---
setInterval(() => {
  console.log(`[${new Date().toISOString()}] Heartbeat: Service is active.`);
}, 1000 * 60 * 60);
