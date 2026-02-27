import postgres from "https://deno.land/x/postgresjs/mod.js";

const databaseUrl = Deno.env.get("DATABASE_URL");

if (!databaseUrl) {
  console.error("❌ ERROR: DATABASE_URL is missing!");
  Deno.exit(1);
}

const sql = postgres(databaseUrl);

// Test Database Connection immediately
try {
  await sql`SELECT 1`;
  console.log("✅ Database Connection: SUCCESS");
} catch (e) {
  console.error("❌ Database Connection: FAILED", e.message);
}

console.log("🚀 Attempting to start server on http://0.0.0.0:8000");

Deno.serve({ port: 8000, hostname: "0.0.0.0" }, async (req) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);
  const url = new URL(req.url);

  try {
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      const html = await Deno.readTextFile("./index.html");
      return new Response(html, { headers: { "Content-Type": "text/html" } });
    }

    if (req.method === "GET" && url.pathname === "/api/stats") {
      const [latency] = await sql`SELECT AVG(value_ms) as avg_lag FROM system_metrics WHERE metric_type = 'network_lag' AND captured_at > NOW() - INTERVAL '24 hours'`;
      const [workout] = await sql`SELECT SUM(value_ms)/60000 as weekly_mins FROM system_metrics WHERE metric_type = 'vinyl_workout_time' AND captured_at > date_trunc('week', NOW())`;
      const [bpm] = await sql`SELECT MAX(value_ms) as peak_bpm FROM system_metrics WHERE metric_type = 'vinyl_bpm' AND captured_at > date_trunc('week', NOW())`;
      const music = await sql`SELECT artist, album, bpm FROM grooves ORDER BY created_at DESC LIMIT 5`;

      return new Response(JSON.stringify({ 
          latency: { avg_lag: Math.round(latency?.avg_lag || 0) }, 
          workout: { weekly_mins: Math.round(workout?.weekly_mins || 0), peak_bpm: bpm?.peak_bpm || 0 },
          music: music || []
      }), { headers: { "Content-Type": "application/json" } });
    }

    if (req.method === "POST" && url.pathname === "/workout") {
        const { bpm, minutes } = await req.json();
        await sql`INSERT INTO system_metrics (metric_type, value_ms) VALUES ('vinyl_workout_time', ${minutes * 60000})`;
        await sql`INSERT INTO system_metrics (metric_type, value_ms) VALUES ('vinyl_bpm', ${bpm})`;
        return new Response("OK", { status: 201 });
    }

    return new Response("Not Found", { status: 404 });
  } catch (err) {
    console.error("Server Error:", err.message);
    return new Response(err.message, { status: 500 });
  }
});
