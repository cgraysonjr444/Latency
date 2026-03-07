import postgres from "https://deno.land/x/postgresjs@v3.3.3/mod.js";

const databaseUrl = Deno.env.get("DATABASE_URL");
const DISCOGS_TOKEN = Deno.env.get("DISCOGS_TOKEN") || "";

// Simplest possible connection setup for Render
let sql;
try {
  if (databaseUrl) {
    sql = postgres(databaseUrl, { 
      ssl: { rejectUnauthorized: false }, // Bypass SSL certificate verification
      connect_timeout: 10,
      max: 1 // Limit to 1 connection to avoid Render 'too many clients' errors
    });
  }
} catch (e) {
  console.error("DB Init Error:", e.message);
}

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

Deno.serve({ port: 10000 }, async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.toLowerCase().replace(/\/$/, "");

  if (req.method === "OPTIONS") return new Response(null, { headers });

  try {
    // 1. Static Assets
    if (path === "/favicon.ico") return new Response(null, { status: 204, headers });
    if (path === "" || path === "/") {
      const html = await Deno.readTextFile("./index.html");
      return new Response(html, { headers: { ...headers, "Content-Type": "text/html" } });
    }

    // 2. Discogs Search
    if (path === "/search-album") {
      const q = url.searchParams.get("q") || "";
      const dRes = await fetch(`https://api.discogs.com/database/search?q=${encodeURIComponent(q)}&type=release&per_page=5`, {
        headers: { "Authorization": `Discogs token=${DISCOGS_TOKEN}`, "User-Agent": "VinylPulse/1.1" }
      });
      const dData = await dRes.json();
      return new Response(JSON.stringify(dData.results || []), { headers: { ...headers, "Content-Type": "application/json" } });
    }

    // 3. Database Routes
    if (path === "/spin" && req.method === "POST") {
      const body = await req.json();
      if (!sql) return new Response(JSON.stringify({ error: "No DB URL" }), { status: 200, headers });
      
      // Attempt Table Creation & Insert
      await sql`CREATE TABLE IF NOT EXISTS spins (id SERIAL PRIMARY KEY, data JSONB, created_at TIMESTAMPTZ DEFAULT NOW())`;
      const res = await sql`INSERT INTO spins (data) VALUES (${sql.json(body)}) RETURNING *`;
      return new Response(JSON.stringify(res[0]), { headers: { ...headers, "Content-Type": "application/json" } });
    }

    if (path === "/data") {
      const user = url.searchParams.get("user") || "guest_user";
      if (!sql) return new Response("[]", { headers: { ...headers, "Content-Type": "application/json" } });
      
      try {
        const data = await sql`SELECT * FROM spins WHERE data->>'user_email' = ${user} ORDER BY created_at DESC LIMIT 20`;
        return new Response(JSON.stringify(data), { headers: { ...headers, "Content-Type": "application/json" } });
      } catch (_e) {
        return new Response("[]", { headers: { ...headers, "Content-Type": "application/json" } });
      }
    }

    return new Response("Not Found", { status: 404, headers });

  } catch (err) {
    // Force a 200 status for errors to stop the JSON.parse crash in the browser
    return new Response(JSON.stringify({ error: true, message: err.message }), { 
      status: 200, 
      headers: { ...headers, "Content-Type": "application/json" } 
    });
  }
});
