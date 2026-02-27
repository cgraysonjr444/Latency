import postgres from "https://deno.land/x/postgresjs/mod.js";

// 1. Setup Database Connection
const sql = postgres(Deno.env.get("DATABASE_URL"));

console.log("🚀 API Server starting on http://localhost:8000");

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // 2. The Endpoint: POST /workout
  if (req.method === "POST" && url.pathname === "/workout") {
    try {
      const body = await req.json();
      const { bpm, minutes } = body;

      // Logic Bridge: Convert minutes to ms for our system_metrics table
      const durationMs = minutes * 60 * 1000;

      // 3. Save to Database
      await sql`
        INSERT INTO system_metrics (metric_type, value_ms) 
        VALUES ('vinyl_workout_time', ${durationMs})
      `;
      
      // Also save BPM as a separate metric
      await sql`
        INSERT INTO system_metrics (metric_type, value_ms) 
        VALUES ('vinyl_bpm', ${bpm})
      `;

      return new Response(JSON.stringify({ status: "Success", message: "Workout Recorded!" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 400 });
    }
  }

  return new Response("Latency API is Live. Send POST to /workout", { status: 200 });
});
