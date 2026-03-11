import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const databaseUrl = Deno.env.get("DATABASE_URL");
const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") || "";
const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") || "";
const REDIRECT_URI = "https://latency-8zo5.onrender.com/auth/callback";
const DISCOGS_TOKEN = Deno.env.get("DISCOGS_TOKEN") || "";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "X-Server-Source": "VinylPulse-Production"
};

async function runQuery(query, params = []) {
  if (!databaseUrl) throw new Error("DATABASE_URL missing");
  const client = new Client(databaseUrl);
  try {
    await client.connect();
    const result = await client.queryObject(query, ...params);
    return result.rows;
  } finally {
    try { await client.end(); } catch (_e) { /* ignore */ }
  }
}

Deno.serve({ port: 10000 }, async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.toLowerCase().replace(/\/$/, "");

  if (req.method === "OPTIONS") return new Response(null, { headers });

  try {
    if (path === "" || path === "/") {
      const html = await Deno.readTextFile("./index.html");
      return new Response(html, { headers: { ...headers, "Content-Type": "text/html" } });
    }

    if (path.includes("auth/google")) {
      const scopes = ["https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/fitness.heart_rate.read"].join(" ");
      return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=${scopes}&access_type=offline&prompt=consent`, 302);
    }

    if (path.includes("auth/callback")) {
      const code = url.searchParams.get("code") || "";
      const tRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET, redirect_uri: REDIRECT_URI, grant_type: "authorization_code" })
      });
      const tokens = await tRes.json();
      const AT = tokens.access_token;

      const uRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { Authorization: `Bearer ${AT}` } });
      const user = await uRes.json();

      let bpm = 72; 
      try {
        const fitRes = await fetch("https://www.googleapis.com/fitness/v1/users/me/datasetAggregate", {
          method: "POST",
          headers: { Authorization: `Bearer ${AT}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            aggregateBy: [{ dataSourceId: "derived:com.google.heart_rate.bpm:com.google.android.gms:merge_heart_rate_bpm" }],
            bucketByTime: { durationMillis: 300000 },
            startTimeMillis: Date.now() - 300000,
            endTimeMillis: Date.now()
          })
        });
        const fitData = await fitRes.json();
        bpm = Math.round(fitData.bucket[0].dataset[0].point[0].value[0].fpVal);
      } catch (_e) { console.log("Fit data empty"); }

      return Response.redirect(`/?auth=success&user=${encodeURIComponent(user.email)}&bpm=${bpm}`, 302);
    }

    if (path === "/search-album") {
      const q = url.searchParams.get("q") || "";
      const dRes = await fetch(`https://api.discogs.com/database/search?q=${encodeURIComponent(q)}&type=release&per_page=5`, {
        headers: { "Authorization": `Discogs token=${DISCOGS_TOKEN}`, "User-Agent": "VinylPulse/1.2" }
      });
      const dData = await dRes.json();
      return new Response(JSON.stringify(dData.results || []), { headers: { ...headers, "Content-Type": "application/json" } });
    }

    if (path === "/spin" && req.method === "POST") {
      const body = await req.json();
      await runQuery("CREATE TABLE IF NOT EXISTS spins (id SERIAL PRIMARY KEY, data JSONB, created_at TIMESTAMPTZ DEFAULT NOW())");
      const res = await runQuery("INSERT INTO spins (data) VALUES ($1) RETURNING *", [body]);
      return new Response(JSON.stringify(res[0]), { headers: { ...headers, "Content-Type": "application/json" } });
    }

    if (path === "/data") {
      const user = url.searchParams.get("user") || "guest_user";
      const rows = await runQuery("SELECT * FROM spins WHERE data->>'user_email' = $1 ORDER BY created_at DESC LIMIT 20", [user]);
      return new Response(JSON.stringify(rows), { headers: { ...headers, "Content-Type": "application/json" } });
    }

    return new Response("Not Found", { status: 404, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: true, message: err.message }), { status: 200, headers: { ...headers, "Content-Type": "application/json" } });
  }
});
