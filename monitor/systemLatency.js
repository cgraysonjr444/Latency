// A simple "Heartbeat" monitor for your IT Infrastructure
import postgres from "https://deno.land/x/postgresjs/mod.js";
import ping from "npm:ping";

// 1. Initialize a single, persistent connection pool
const databaseUrl = Deno.env.get("DATABASE_URL");
if (!databaseUrl) {
    console.error("❌ Error: DATABASE_URL environment variable is not set.");
    Deno.exit(1);
}

const sql = postgres(databaseUrl);

/**
 * Save metrics to the PostgreSQL 'system_metrics' table
 */
async function saveMetric(type, value) {
    try {
        await sql`
            INSERT INTO system_metrics (metric_type, value_ms)
            VALUES (${type}, ${value})
        `;
        console.log(`✅ Persisted ${type}: ${value}ms`);
    } catch (err) {
        console.error(`❌ Database Save Failed for ${type}:`, err.message);
    }
}

async function checkSystemLatency() {
    const host = '192.168.1.1'; // Your Router
    
    try {
        const start = performance.now();
        
        // 2. Measure API Latency
        const response = await fetch("https://api.latency.app/grooves");
        if (!response.ok) throw new Error(`API Status: ${response.status}`);
        
        // Use the response to satisfy the linter/ensure completion
        await response.body?.cancel(); 

        const end = performance.now();
        const requestLatency = Math.round(end - start);
        
        // 3. Measure Router Ping
        const pingRes = await ping.promise.probe(host);
        const routerLatency = Math.round(pingRes.time);
        
        console.log(`--- Report: ${new Date().toLocaleTimeString()} ---`);
        console.log(`IT Latency: ${requestLatency}ms | Router: ${routerLatency}ms`);
        
        // 4. Record to Database
        await saveMetric('network_lag', requestLatency);
        await saveMetric('router_ping', routerLatency);

        // Logic Bridge: Alert if lag is high
        if (requestLatency > 50) {
            console.warn("⚠️ High Latency Detected!");
        }

    } catch (error) {
        console.error("[MONITOR ERROR]:", error.message);
        await saveMetric('system_status', 0); // Log offline status
    }
}

// Initial execution
checkSystemLatency();

// Run every 60 seconds
setInterval(checkSystemLatency, 60000);
