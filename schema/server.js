import postgres from "https://deno.land/x/postgresjs@v3.3.3/mod.js";

// 1. Initialize the database connection
// It will pull the connection string from your Render Environment Variables
const sql = postgres(Deno.env.get("DATABASE_URL"), {
  ssl: { rejectUnauthorized: false }, // Matches your current working config
});

async function initializeDatabase() {
  try {
    console.log("Connecting to database...");

    // 2. Your Table Schema Logic
    // Using 'IF NOT EXISTS' is the standard way to avoid the "already exists" error
    await sql`
      CREATE TABLE IF NOT EXISTS spins (
        id SERIAL PRIMARY KEY,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        data JSONB
      );
    `;

    console.log("✅ Database connected and table 'spins' is ready!");

    // Optional: Test query to confirm access
    const result = await sql`SELECT NOW()`;
    console.log("Current DB Time:", result[0].now);

  } catch (err) {
    console.error("❌ Database initialization failed:");
    console.error(err);
    // We don't exit here so you can see the logs on Render
  }
}

// Execute the DB logic
await initializeDatabase();

// --- PATH C: KEEP-ALIVE ---
console.log("🚀 Background task started. Keeping process alive...");

// This interval prevents the Deno event loop from finishing.
// It logs a heartbeat every hour to keep the logs clean but the process active.
setInterval(() => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Heartbeat: Latency service is still active.`);
}, 1000 * 60 * 60);

// Note: If Render shows a "Port scan failed" error, 
// change the Service Type in Render settings to "Background Worker".

// ... rest of your Deno.serve code ...
