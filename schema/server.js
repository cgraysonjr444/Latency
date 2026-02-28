import postgres from "https://deno.land/x/postgresjs@v3.3.3/mod.js";

const databaseUrl = Deno.env.get("DATABASE_URL");

const sql = postgres(databaseUrl, {
  // We use 'require' but the Deno flag above will handle the handshake error
  ssl: 'require', 
  connect_timeout: 30,
  // This helps prevent the driver from hanging if the handshake is weird
  idle_timeout: 20,
  max: 10
});

// Test connection immediately
try {
  await sql`SELECT 1`;
  console.log("✅ Database connected successfully!");
  
  await sql`
    CREATE TABLE IF NOT EXISTS spins (
      id SERIAL PRIMARY KEY,
      rpm FLOAT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
} catch (err) {
  console.error("❌ Database init error:", err.message);
}

// ... rest of your Deno.serve code ...
