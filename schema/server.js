import postgres from "https://deno.land/x/postgresjs@v3.3.3/mod.js";

// 1. Database Connection with a 10-second timeout to prevent "White Screen hangs"
const databaseUrl = Deno.env.get("DATABASE_URL");
const sql = databaseUrl 
  ? postgres(databaseUrl, { ssl: { rejectUnauthorized: false }, connect_timeout: 10 }) 
  : null;

const PORT = parseInt(Deno.env.get("PORT") || "10000");

Deno.serve({ port: PORT }, async (req) => {
  const url = new URL(req.url);
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "text/html",
  };

  // Handle /data requests for your GitHub frontend
  if (url.pathname === "/data") {
    try {
      const data = sql ? await sql`SELECT * FROM spins LIMIT 10` : [];
      return new Response(JSON.stringify(data), { 
        headers: { ...headers, "Content-Type": "application/json" } 
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { headers: { ...headers, "Content-Type": "application/json" } });
    }
  }

  // MAIN DASHBOARD (The "Safe" Version)
  let dbStatus = "Checking...";
  let spinCount = "Unknown";

  try {
    if (!sql) {
      dbStatus = "❌ DATABASE_URL missing in Render Env Vars";
    } else {
      const result = await sql`SELECT count(*) FROM spins`.trim(); // Quick ping
      dbStatus = "✅ Connected to Postgres";
      spinCount = result[0].count;
    }
  } catch (err) {
    dbStatus = `❌ Database Error: ${err.message}`;
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <head><title>Latency Status</title></head>
      <body style="font-family:sans-serif; background:#121212; color:white; padding:2rem; text-align:center;">
        <h1 style="color:#00ffcc;">💿 Latency Service</h1>
        <div style="background:#222; padding:2rem; border-radius:10px; display:inline-block; border:1px solid #333;">
          <p><strong>Server Status:</strong> <span style="color:#00ffcc;">ONLINE</span></p>
          <p><strong>Database:</strong> ${dbStatus}</p>
          <p><strong>Spins Recorded:</strong> ${spinCount}</p>
        </div>
        <p style="margin-top:2rem; color:#666;">If you see this, the server is working!</p>
      </body>
    </html>
  `;

  return new Response(html, { headers });
});

console.log(`🚀 Diagnostic Server running on ${PORT}`);
