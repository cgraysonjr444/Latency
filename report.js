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

        // 2. QUERY: Weekly Goal Progress (Starting Monday)
        const [weeklyProgress] = await sql`
            SELECT SUM(value_ms) / 60000 as minutes
            FROM system_metrics
            WHERE metric_type = 'vinyl_workout_time'
            AND captured_at > date_trunc('week', NOW())
        `;

        // 3. QUERY: Lifetime Workout Stats
        const [workoutStats] = await sql`
            SELECT 
                SUM(value_ms) / 60000 as total_minutes,
                AVG(value_ms) / 60000 as avg_session
            FROM system_metrics
            WHERE metric_type = 'vinyl_workout_time'
        `;

        // 4. QUERY: Recently Spun Vinyls (from 'grooves' table)
        const musicPlayed = await sql`
            SELECT artist, album, bpm
            FROM grooves
            ORDER BY created_at DESC
            LIMIT 5
        `;

        // 5. MAINTENANCE: Delete latency noise older than 30 days
        const deleted = await sql`
            DELETE FROM system_metrics 
            WHERE captured_at < NOW() - INTERVAL '30 days'
            AND metric_type NOT LIKE 'vinyl_%'
        `;

        // --- DISPLAY RESULTS ---

        if (deleted && deleted.count > 0) {
            console.log(`🧹 Maintenance: Cleared ${deleted.count} old latency records.`);
            console.log(`-----------------------------------------`);
        }

        console.log(`🌐 NETWORK HEALTH (Last 24h)`);
        console.log(`   Avg Latency: ${Math.round(latencyStats?.avg_lag || 0)}ms`);
        console.log(`   Peak Spike:  ${latencyStats?.peak_lag || 0}ms`);
        console.log(`   Data Points: ${latencyStats?.data_points || 0}`);
        console.log(`-----------------------------------------`);

        const goal = 300; // 5 hours in minutes
        const current = Math.round(weeklyProgress?.minutes || 0);
        const remaining = Math.max(0, goal - current);

        console.log(`🎯 WEEKLY GOAL PROGRESS (Target: 5hrs)`);
        console.log(`   Done:      ${current} / ${goal} mins`);
        console.log(`   Remaining: ${remaining} mins ${remaining === 0 ? '🔥 GOAL MET!' : ''}`);
        console.log(`-----------------------------------------`);

        console.log(`💪 LIFETIME WORKOUTS`);
        console.log(`   Total Time:  ${Math.round(workoutStats?.total_minutes || 0)} mins`);
        console.log(`   Avg Session: ${Math.round(workoutStats?.avg_session || 0)} mins`);
        console.log(`-----------------------------------------`);

        console.log(`💿 RECENTLY SPUN`);
        if (musicPlayed && musicPlayed.length > 0) {
            musicPlayed.forEach(row => {
                console.log(`   • ${row.artist} - ${row.album} (${row.bpm} BPM)`);
            });
        } else {
            console.log("   No vinyl records logged yet.");
        }

    } catch (err) {
        console.error("❌ Failed to generate report:", err.message);
    } finally {
        await sql.end();
    }
}

generateReport();
