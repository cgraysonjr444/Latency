// A simple "Heartbeat" monitor for your IT Infrastructure
// 1. TOOLS: Import the drivers
import postgres from "https://deno.land/x/postgresjs/mod.js";
import ping from "npm:ping";

// 2. CONNECTION: Initialize the bridge to your database
const databaseUrl = Deno.env.get("DATABASE_URL");

if (!databaseUrl) {
    console.error("❌ Error: DATABASE_URL environment variable is not set.");
    console.log("Tip: Run with DATABASE_URL=postgres://user:pass@localhost:5432/db");
    Deno.exit(1);
}

// Single persistent connection pool for the life of the script
const sql = postgres(databaseUrl);

/**
 * Persists metrics (Latency, BPM, Workout Time) to PostgreSQL
 */
async function saveMetric(type, value) {
    try {
        await sql`
            INSERT INTO system_metrics (metric_type, value_ms)
            VALUES (${type}, ${value})
        `;
        console.log(`✅ [DB] Saved ${type}: ${value}`);
    } catch (err) {
        console.error(`❌ [DB ERROR] Failed to save ${type}:`, err.message);
    }
}

/**
 * Main Monitor Logic
 */
async function checkSystemLatency() {
    const host = '192.168.1.1'; // Change to your router IP if different
    
    try {
        console.log(`\n--- Report: ${new Date().toLocaleTimeString()} ---`);

        // A. Measure External API Latency
        const start = performance.now();
        const response = await fetch("https://api.latency.app/grooves");
        
        if (!response.ok) {
            throw new Error(`API responded with status: ${response.status}`);
        }
        
        // Finalize fetch to satisfy Deno's resources
        await response.body?.cancel(); 

        const end = performance.now();
        const requestLatency = Math.round(end - start);
        
        // B. Measure Local Router Ping
        const pingRes = await ping.promise.probe(host);
        const routerLatency = Math.round(pingRes.time);
        
        console.log(`IT Latency: ${requestLatency}ms | Router: ${routerLatency}ms`);
        
        // C. LOGIC BRIDGE: Save to Database
        await saveMetric('network_lag', requestLatency);
        await saveMetric('router_ping', routerLatency);

        // Warning trigger for high lag
        if (requestLatency > 50) {
            console.warn("⚠️ High Latency Detected! System potentially under load.");
        }

    } catch (error) {
        // FAILSAFE: Catch network/API drops without crashing the script
        console.error("[MONITOR ERROR]: System potentially offline or API unreachable.");
        console.error(`Details: ${error.message}`);
        
        // Log "0" or "offline" status to your metrics table
        await saveMetric('system_status', 0); 
    }
}

// 3. EXECUTION: Run immediately on start
checkSystemLatency();

// 4. INTERVAL: Repeat every 60 seconds
setInterval(checkSystemLatency, 60000);

console.log("🚀 Latency Monitor is active and connected to DB.");
