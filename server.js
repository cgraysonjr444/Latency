import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const databaseUrl = Deno.env.get("DATABASE_URL");
const DISCOGS_TOKEN = Deno.env.get("DISCOGS_TOKEN") || "";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// 1. Create a safer connection function
async function runQuery(query, params = []) {
  if (!databaseUrl) throw new Error("DATABASE_URL is missing");
  const client = new Client(databaseUrl);
  try {
    await client.connect();
    const result = await client.queryObject(query, ...params);
    return result.rows;
  } finally {
    await client.end();
  }
}

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

    // API: Search
    if (path === "/search-album") {
      const q = url.searchParams.get("q") || "";
      const dRes = await fetch(`https://api.discogs.com/database/search?q=${encodeURIComponent(q)}&type=release&per_page=5`, {
        headers: { "Authorization": `Discogs token=${DISCOGS_TOKEN}`, "User-Agent": "VinylPulse/1.1" }
      });
      const dData = await dRes.json();
      return new Response(JSON.stringify(dData.results || []), { headers: { ...headers, "Content-Type": "application/json" } });
    }

    // DB: Save
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

    // DB: Load
    if (path === "/data") {
      const user = url.searchParams.get("user") || "guest_user";
      try {
        const rows = await runQuery(
          "SELECT * FROM spins WHERE data->>'user_email' = $1 ORDER BY created_at DESC LIMIT 20",
          [user]
        );
        return new Response(JSON.stringify(rows), { headers: { ...headers, "Content-Type": "application/json" } });
      } catch (e) {
        console.log("Table likely doesn't exist yet.");
        return new Response("[]", { headers: { ...headers, "Content-Type": "application/json" } });
      }
    }

    return new Response("Not Found", { status: 404, headers });

  } catch (err) {
    console.error("CRASH:", err.message);
    // Returning 200 so the frontend sees the error as JSON instead of crashing
    return new Response(JSON.stringify({ error: true, message: err.message }), { 
      status: 200, 
      headers: { ...headers, "Content-Type": "application/json" } 
    });
  }
});
