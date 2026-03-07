import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const databaseUrl = Deno.env.get("DATABASE_URL");
const DISCOGS_TOKEN = Deno.env.get("DISCOGS_TOKEN") || "";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Safer connection function that handles connect/disconnect per request
async function runQuery(query, params = []) {
  if (!databaseUrl) throw new Error("DATABASE_URL is missing from environment");
  const client = new Client(databaseUrl);
  try {
    await client.connect();
    const result = await client.queryObject(query, ...params);
    return result.rows;
  } finally {
    try {
      await client.end();
    } catch (_e) {
      // Silently ignore closure errors
    }
  }
}

Deno.serve({ port: 10000 }, async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.toLowerCase().replace(/\/$/, "");

  if (req.method === "OPTIONS") return new Response(null, { headers });

  try {
    // 0. Favicon Silence
    if (path === "/favicon.ico") return new Response(null, { status: 204, headers });

    // 1. Frontend
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

    // 3. Save Spin (POST)
    if (path === "/spin" && req.method === "POST") {
      const body = await req.json();
      await runQuery(`
        CREATE TABLE IF NOT EXISTS spins (
          id SERIAL PRIMARY KEY, 
          data JSONB, 
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      const res = await runQuery(
        "INSERT INTO spins (data) VALUES ($1) RETURNING *",
        [body]
      );
      return new Response(JSON.stringify(res[0]), { headers: { ...headers, "Content-Type": "application/json" } });
    }

    // 4. Load Data (GET)
    if (path === "/data") {
      const user = url.searchParams.get("user") || "guest_user";
      try {
        const rows = await runQuery(
          "SELECT * FROM spins WHERE data->>'user_email' = $1 ORDER BY created_at DESC LIMIT 20",
          [user]
        );
        return new Response(JSON.stringify(rows), { headers: { ...headers, "Content-Type": "application/json" } });
      } catch (_e) {
        // Return empty array if table doesn't exist yet
        return new Response("[]", { headers: { ...headers, "Content-Type": "application/json" } });
      }
    }

    return new Response("Not Found", { status: 404, headers });

  } catch (err) {
    console.error("CRITICAL SERVER ERROR:", err.message);
    // Send 200 with JSON to prevent the browser's "unexpected character" crash
    return new Response(JSON.stringify({ error: true, message: err.message }), { 
      status: 200, 
      headers: { ...headers, "Content-Type": "application/json" } 
    });
  }
});
