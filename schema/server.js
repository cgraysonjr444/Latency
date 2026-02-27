import postgres from "https://deno.land/x/postgresjs/mod.js";

// 1. Initialize Database Connection
const databaseUrl = Deno.env.get("DATABASE_URL");
if (!databaseUrl) {
    console.error("❌ Error: DATABASE_URL environment variable is not set.");
    Deno.exit(1);
}
const sql = postgres(databaseUrl);

console.log("🚀 Server running at http://localhost:8000");

Deno.serve(async (req) => {
    const url = new URL(req.url);

    try {
        // --- ROUTE 1: The Dashboard (GET /) ---
        if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
            const html = await Deno.readTextFile("./index.html");
            return new Response(html, {
                headers: { "Content-Type": "text/html" },
            });
        }

        // --- ROUTE 2: Dashboard API (GET /api/stats) ---
        if (req.method === "GET" && url.pathname === "/api/stats") {
            // Fetch Latency Stats
            const [latency] = await sql`
                SELECT AVG(value_ms) as avg_lag 
                FROM system_metrics 
                WHERE metric_type = 'network_lag' 
                AND captured_at > NOW() - INTERVAL '24 hours'
            `;

            // Fetch Weekly Workout Minutes
            const [workout] = await sql`
                SELECT SUM(value_ms) / 60000 as weekly_mins 
                FROM system_metrics 
                WHERE metric_type = 'vinyl_workout_time' 
                AND captured_at > date_trunc('week', NOW())
            `;

            // Fetch Weekly Peak BPM
            const [bpm] = await sql`
                SELECT MAX(value_ms) as peak_bpm 
                FROM system_metrics 
                WHERE metric_type = 'vinyl_bpm' 
                AND captured_at > date_trunc('week', NOW())
            `;

            // Fetch Recent Vinyls
            const music = await sql`
                SELECT artist, album, bpm 
                FROM grooves 
                ORDER BY created_at DESC 
                LIMIT 5
            `;

            const stats = {
                latency: {
                    avg_lag: Math.round(latency?.avg_lag || 0)
                },
                workout: {
                    weekly_mins: Math.round(workout?.weekly_mins || 0),
                    peak_bpm: bpm?.peak_bpm || 0
                },
                music: music || []
            };

            return new Response(JSON.stringify(stats), {
                headers: { "Content-Type": "application/json" },
            });
        }

        // --- ROUTE 3: Log Workout (POST /workout) ---
        if (req.method === "POST" && url.pathname === "/workout") {
            const body = await req.json();
            const { bpm, minutes } = body;

            if (!bpm || !minutes) {
                return new Response("Missing bpm or minutes", { status: 400 });
            }

            // Save both metrics to the database
            await sql`
                INSERT INTO system_metrics (metric_type, value_ms) 
                VALUES ('vinyl_workout_time', ${minutes * 60000})
            `;
            await sql`
                INSERT INTO system_metrics (metric_type, value_ms) 
                VALUES ('vinyl_bpm', ${bpm})
            `;

            console.log(`✅ Recorded Workout: ${minutes} mins at ${bpm} BPM`);
            
            return new Response(JSON.stringify({ status: "Success" }), {
                status: 201,
                headers: { "Content-Type": "application/json" },
            });
        }

        // 404 Fallback
        return new Response("Not Found", { status: 404 });

    } catch (error) {
        console.error(`❌ Server Error: ${error.message}`);
        return new Response(JSON.stringify({ error: "Internal Server Error" }), { 
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
});
