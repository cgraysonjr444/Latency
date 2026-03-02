import postgres from "https://deno.land/x/postgresjs@v3.3.3/mod.js";

const databaseUrl = Deno.env.get("DATABASE_URL");
const sql = databaseUrl 
  ? postgres(databaseUrl, { ssl: { rejectUnauthorized: false }, connect_timeout: 10 }) 
  : null;

const PORT = parseInt(Deno.env.get("PORT") || "10000");

Deno.serve({ port: PORT }, async (req) => {
  const url = new URL(req.url);
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (req.method === "OPTIONS") return new Response(null, { headers });

  // ROUTE: /data (JSON for GitHub)
  if (url.pathname === "/data") {
    try {
      const data = sql ? await sql`SELECT * FROM spins ORDER BY created_at DESC LIMIT 10` : [];
      return new Response(JSON.stringify(data), { 
        headers: { ...headers, "Content-Type": "application/json" } 
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { 
        headers: { ...headers, "Content-Type": "application/json" },
        status: 500
      });
    }
  }

  // ROUTE: Root (Visual Dashboard)
  let dbStatus = "Checking...";
  let spinCount = "0";

  try {
    if (!sql) {
      dbStatus = "❌ DATABASE_URL missing";
    } else {
      const result = await sql`SELECT count(*) FROM spins`;
      dbStatus = "✅ Connected to Postgres";
      spinCount = result[0].count;
    }
  } catch (err) {
    dbStatus = `❌ Database Error: ${err.message}`;
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Latency Status</title>
        <meta charset="UTF-8">
      </head>
      <body style="font-family:sans-serif; background:#121212; color:white; padding:2rem; text-align:center;">
        <h1 style="color:#00ffcc;">💿 Latency Service</h1>
        <div style="background:#222; padding:2rem; border-radius:10px; display:inline-block; border:1px solid #333;">
          <p><strong>Server Status:</strong> <span style="color:#00ffcc;">ONLINE</span></p>
          <p><strong>Database:</strong> ${dbStatus}</p>
          <p><strong>Spins Recorded:</strong> <span style="color:#00ffcc; font-size:1.2rem;">${spinCount}</span></p>
        </div>
        <p style="margin-top:2rem;"><a href="/data" style="color:#00ffcc;">View API Data</a></p>
      </body>
    </html>
  `;

  return new Response(html, { headers: { ...headers, "Content-Type": "text/html" } });
});
