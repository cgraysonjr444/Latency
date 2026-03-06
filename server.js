import postgres from "https://deno.land/x/postgresjs@v3.3.3/mod.js";

const databaseUrl = Deno.env.get("DATABASE_URL");
const sql = databaseUrl ? postgres(databaseUrl, { ssl: { rejectUnauthorized: false } }) : null;
const DISCOGS_TOKEN = Deno.env.get("DISCOGS_TOKEN") || "";

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
    // Serve Frontend
    if (path === "" || path === "/") {
      const html = await Deno.readTextFile("./index.html");
      return new Response(html, { headers: { ...headers, "Content-Type": "text/html" } });
    }

    // Discogs Search
    if (path === "/search-album") {
      const q = url.searchParams.get("q") || "";
      const dRes = await fetch(`https://api.discogs.com/database/search?q=${encodeURIComponent(q)}&type=release&per_page=5`, {
        headers: { "Authorization": `Discogs token=${DISCOGS_TOKEN}`, "User-Agent": "VinylPulse/1.1" }
      });
      const dData = await dRes.json();
      return new Response(JSON.stringify(dData.results || []), { headers: { ...headers, "Content-Type": "application/json" } });
    }

    // Logging Session
    if (path === "/spin" && req.method === "POST") {
      const body = await req.json();
      console.log("Saving to DB:", body); // Check Render logs for this!
      
      if (!sql) throw new Error("Database connection missing");
      
      const res = await sql`INSERT INTO spins (data) VALUES (${sql.json(body)}) RETURNING *`;
      return new Response(JSON.stringify(res[0]), { headers });
    }

    // Fetch History
    if (path === "/data") {
      const data = await sql`SELECT * FROM spins ORDER BY created_at DESC LIMIT 20`;
      return new Response(JSON.stringify(data), { headers });
    }

    return new Response("Not Found", { status: 404, headers });
  } catch (err) {
    console.error("ERROR:", err.message);
    return new Response(err.message, { status: 500, headers });
  }
});
