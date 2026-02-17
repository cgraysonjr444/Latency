// A simple "Heartbeat" monitor for your IT Infrastructure
const ping = require('ping');

async function checkSystemLatency() {
    const host = '192.168.1.1'; // Your Router
    let res = await ping.promise.probe(host);
    
    // Store this in our Time-Series 'System_Metrics' table
    console.log(`Current IT Latency: ${res.time}ms`);
    
    // LOGIC BRIDGE: If latency is > 50ms, flag it for the dashboard
    if (res.time > 50) {
        saveMetric('network_lag', res.time);
    }
}

// Run every 60 seconds
setInterval(checkSystemLatency, 60000);