// A simple "Heartbeat" monitor for your IT Infrastructure
import ping from "npm:ping";

async function checkSystemLatency() {
    const host = '192.168.1.1'; // Your Router
    
    // Track start time to calculate fetch latency
    const start = performance.now();
    const res = await fetch("https://api.latency.app/grooves");
    const end = performance.now();
    
    // Calculate actual request duration
    const requestLatency = Math.round(end - start);
    
    // Use the 'ping' variable to check your local gateway
    const pingRes = await ping.promise.probe(host);
    
    console.log(`Current IT Latency: ${requestLatency}ms`);
    console.log(`Router Ping (${host}): ${pingRes.time}ms`);
    
    // LOGIC BRIDGE: If latency is > 50ms, flag it for the dashboard
    if (requestLatency > 50) {
        // Assuming saveMetric is defined globally or imported
        saveMetric('network_lag', requestLatency);
    }
}

// Helper for the flag logic (placeholder if not defined elsewhere)
function saveMetric(type, value) {
    console.warn(`[METRIC] Recording ${type}: ${value}ms`);
}

// Run every 60 seconds
setInterval(checkSystemLatency, 60000);

// Initial run
checkSystemLatency();
