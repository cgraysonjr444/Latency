import postgres from "https://deno.land/x/postgresjs/mod.js";

const sql = postgres(Deno.env.get("DATABASE_URL"));

async function generateReport() {
    console.log(`\n📊 --- LATENCY & VINYL STATUS REPORT ---`);
    console.log(`Generated on: ${new Date().toLocaleString()}\n`);

    try {
        // 1. QUERY: System Latency Stats (Last 24 Hours)
        const [latencyStats] = await sql`
            SELECT 
                AVG(value_ms) as avg_lag,
                MAX(value_ms) as peak_lag,
                COUNT(*) as data_points
            FROM system_metrics
            WHERE metric_type = 'network_lag' 
            AND captured_at > NOW() - INTERVAL '24 hours'
        `;

        // 2. QUERY: Workout/Vinyl Stats
        const [workoutStats] = await sql`
            SELECT 
                SUM(value_ms) / 60000 as total_minutes,
                AVG(value_ms) / 1000 / 60 as avg_session
            FROM system_metrics
            WHERE metric_type = 'vinyl_workout_time'
        `;

        // 3. QUERY: Specific Vinyl/Music Played (from your 'grooves' table)
        const musicPlayed = await sql`
            SELECT artist, album, bpm
            FROM grooves
            ORDER BY created_at DESC
            LIMIT 5
        `;

        // --- DISPLAY RESULTS ---

        console.log(`🌐 NETWORK HEALTH (Last 24h)`);
        console.log(`   Avg Latency: ${Math.round(latencyStats.avg_lag)}ms`);
        console.log(`   Peak Spike:  ${latencyStats.peak_lag}ms`);
        console.log(`   Data Points: ${latencyStats.data_points}`);
        console.log(`-----------------------------------------`);

        console.log(`💪 WORKOUT SUMMARY`);
        console.log(`   Total Time:  ${Math.round(workoutStats.total_minutes || 0)} mins`);
        console.log(`   Avg Session: ${Math.round(workoutStats.avg_session || 0)} mins`);
        console.log(`-----------------------------------------`);

        console.log(`💿 RECENTLY SPUN`);
        if (musicPlayed.length > 0) {
            musicPlayed.forEach(row => {
                console.log(`   • ${row.artist} - ${row.album} (${row.bpm} BPM)`);
            });
        } else {
            console.log("   No vinyl records logged yet.");
        }

    } catch (err) {
        console.error("❌ Failed to generate report:", err.message);
    } finally {
        // Close connection so the script finishes immediately
        await sql.end();
    }
}

generateReport();

DATABASE_URL="your_connection_string" \
deno run --allow-env --allow-net report.js
