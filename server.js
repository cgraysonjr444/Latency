import postgres from "https://deno.land/x/postgresjs@v3.3.3/mod.js";

const databaseUrl = Deno.env.get("DATABASE_URL");
const DISCOGS_TOKEN = Deno.env.get("DISCOGS_TOKEN") || "";

// Initialize SQL only once to avoid multiple connections
let sql;
function getSql() {
  if (sql) return sql;
  if (!databaseUrl) return null;
  // This configuration is the most compatible for Render + Deno
  sql = postgres(databaseUrl, { 
    ssl: { rejectUnauthorized: false }, 
    prepare: false,
    connect_timeout: 10
  });
  return sql;
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
    if (path === "/favicon.ico") return new Response(null, { status: 204, headers });

    if (path === "" || path === "/") {
      const html = await Deno.readTextFile("./index.html");
      return new Response(html, { headers: { ...headers, "Content-Type": "text/html" } });
    }

    // API: Search Album
    if (path === "/search-album") {
      const q = url.searchParams.get("q") || "";
      const dRes = await fetch(`https://api.discogs.com/database/search?q=${encodeURIComponent(q)}&type=release&per_page=5`, {
        headers: { "Authorization": `Discogs token=${DISCOGS_TOKEN}`, "User-Agent": "VinylPulse/1.1" }
      });
      const dData = await dRes.json();
      return new Response(JSON.stringify(dData.results || []), { headers: { ...headers, "Content-Type": "application/json" } });
    }

    // DB: Save Data
    if (path === "/spin" && req.method === "POST") {
      const body = await req.json();
      const db = getSql();
      if (!db) throw new Error("DATABASE_URL_MISSING");
      
      // Auto-create table on first attempt
      await db`CREATE TABLE IF NOT EXISTS spins (id SERIAL PRIMARY KEY, data JSONB, created_at TIMESTAMPTZ DEFAULT NOW())`;
      const res = await db`INSERT INTO spins (data) VALUES (${db.json(body)}) RETURNING *`;
      return new Response(JSON.stringify(res[0]), { headers: { ...headers, "Content-Type": "application/json" } });
    }

    // DB: Load Data
    if (path === "/data") {
      const user = url.searchParams.get("user") || "guest_user";
      const db = getSql();
      if (!db) return new Response("[]", { headers: { ...headers, "Content-Type": "application/json" } });
      
      try {
        const data = await db`SELECT * FROM spins WHERE data->>'user_email' = ${user} ORDER BY created_at DESC LIMIT 20`;
        return new Response(JSON.stringify(data), { headers: { ...headers, "Content-Type": "application/json" } });
      } catch (e) {
        // If table doesn't exist yet, return empty list instead of 500
        return new Response("[]", { headers: { ...headers, "Content-Type": "application/json" } });
      }
    }

    return new Response("Not Found", { status: 404, headers });

  } catch (err) {
    console.error("ERROR:", err.message);
    return new Response(JSON.stringify({ error: true, message: err.message }), { 
      status: 200, // Send 200 so the frontend doesn't throw a "JSON parse" error
      headers: { ...headers, "Content-Type": "application/json" } 
    });
  }
});
});
