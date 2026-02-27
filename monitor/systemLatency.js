// A simple "Heartbeat" monitor for your IT Infrastructure
import ping from "npm:ping";

async function checkSystemLatency() {
    const host = '192.168.1.1'; // Your Router
    
    // Track start time to calculate fetch latency
    const start = performance.now();
    
    // Using '_res' tells the linter we are intentionally not using the response body
    const _res = await fetch("https://api.latency.app/grooves");
    
    const end = performance.now();
    
    // Calculate actual request duration in milliseconds
    const requestLatency = Math.round(end - start);
    
    // Perform the local ping
    const pingRes = await ping.promise.probe(host);
    
    console.log(`Current IT Latency: ${requestLatency}ms`);
    console.log(`Router Ping (${host}): ${pingRes.time}ms`);
    
    // LOGIC BRIDGE: If latency is > 50ms, flag it for the dashboard
    if (requestLatency > 50) {
        saveMetric('network_lag', requestLatency);
    }
}

/**
 * Placeholder for storing metrics. 
 * In production, this would hit your PostgreSQL 'system_metrics' table.
 */
function saveMetric(type, value) {
    console.warn(`[METRIC] Recording ${type}: ${value}ms`);
}

// Initial run
checkSystemLatency();

// Run every 60 seconds
setInterval(checkSystemLatency, 60000);
