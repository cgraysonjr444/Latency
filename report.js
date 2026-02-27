import postgres from "https://deno.land/x/postgresjs/mod.js";

// Initialize connection
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

        // 2. QUERY: Workout/Vinyl Stats (All time)
        const [workoutStats] = await sql`
            SELECT 
                SUM(value_ms) / 60000 as total_minutes,
                AVG(value_ms) / 60000 as avg_session
            FROM system_metrics
            WHERE metric_type = 'vinyl_workout_time'
        `;

        // 3. QUERY: Recently Spun Vinyls (Joined from your 'grooves' table)
        const musicPlayed = await sql`
            SELECT artist, album, bpm
            FROM grooves
            ORDER BY created_at DESC
            LIMIT 5
        `;

        // 4. MAINTENANCE: Delete latency noise older than 30 days
        // We PROTECT 'vinyl_%' metrics so your workout history is permanent.
        const deleted = await sql`
            DELETE FROM system_metrics 
            WHERE captured_at < NOW() - INTERVAL '30 days'
            AND metric_type NOT LIKE 'vinyl_%'
        `;

        // --- DISPLAY RESULTS ---

        if (deleted.count > 0) {
            console.log(`🧹 Maintenance: Cleared ${deleted.count} old latency records.`);
            console.log(`-----------------------------------------`);
        }

        console.log(`🌐 NETWORK HEALTH (Last 24h)`);
        console.log(`   Avg Latency: ${Math.round(latencyStats?.avg_lag || 0)}ms`);
        console.log(`   Peak Spike:  ${latencyStats?.peak_lag || 0}ms`);
        console.log(`   Data Points: ${latencyStats?.data_points || 0}`);
        console.log(`-----------------------------------------`);

        console.log(`💪 WORKOUT SUMMARY`);
        console.log(`   Total Time:  ${Math.round(workoutStats?.total_minutes || 0)} mins`);
        console.log(`   Avg Session: ${Math.round(workoutStats?.avg_session || 0)} mins`);
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

