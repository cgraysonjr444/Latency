import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

// Environment Variables from Render
const databaseUrl = Deno.env.get("DATABASE_URL");
const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") || "";
const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") || "";
const REDIRECT_URI = "https://latency-8zo5.onrender.com/auth/callback";
const DISCOGS_TOKEN = Deno.env.get("DISCOGS_TOKEN") || "";

// Anti-Cache Headers: Prevents browsers from showing old 404s or stale data
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  "Pragma": "no-cache",
  "Expires": "0",
  "X-Server-Source": "VinylPulse-Render-Server"
};

// Database Runner: Opens and Closes connection per request for stability
async function runQuery(query, params = []) {
  if (!databaseUrl) throw new Error("DATABASE_URL is missing from Render env");
  const client = new Client(databaseUrl);
  try {
    await client.connect();
    const result = await client.queryObject(query, ...params);
    return result.rows;
  } finally {
    try { await client.end(); } catch (_e) { /* ignore closure errors */ }
  }
}

Deno.serve({ port: 10000 }, async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.toLowerCase().replace(/\/$/, "");

  // Handle CORS Pre-flight
  if (req.method === "OPTIONS") return new Response(null, { headers });

  try {
    // 0. Silence Favicon 404s
    if (path === "/favicon.ico") return new Response(null, { status: 204, headers });

    // 1. Serve index.html
    if (path === "" || path === "/") {
      const html = await Deno.readTextFile("./index.html");
      return new Response(html, { headers: { ...headers, "Content-Type": "text/html" } });
    }

    // 2. Google OAuth Start
    if (path.includes("auth/google")) {
      const scopes = [
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/fitness.heart_rate.read"
      ].join(" ");
      const googleUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      googleUrl.searchParams.set("client_id", CLIENT_ID);
      googleUrl.searchParams.set("redirect_uri", REDIRECT_URI);
      googleUrl.searchParams.set("response_type", "code");
      googleUrl.searchParams.set("scope", scopes);
      googleUrl.searchParams.set("access_type", "offline");
      googleUrl.searchParams.set("prompt", "consent");
      return Response.redirect(googleUrl.toString(), 302);
    }

    // 3. OAuth Callback + Health Data Fetch
    if (path.includes("auth/callback")) {
      const code = url.searchParams.get("code") || "";
      const tRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ 
          code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET, 
          redirect_uri: REDIRECT_URI, grant_type: "authorization_code" 
        })
      });
      const tokens = await tRes.json();
      const AT = tokens.access_token;

      // Identify User
      const uRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${AT}` }
      });
      const user = await uRes.json();

      // Fetch Heart Rate (last 5 mins)
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
      } catch (_e) {
        console.log("Fitness data point not found, using default BPM.");
      }

      return Response.redirect(`/?auth=success&user=${encodeURIComponent(user.email)}&bpm=${bpm}`, 302);
    }

    // 4. API: Discogs Search
    if (path === "/search-album") {
      const q = url.searchParams.get("q") || "";
      const dRes = await fetch(`https://api.discogs.com/database/search?q=${encodeURIComponent(q)}&type=release&per_page=5`, {
        headers: { "Authorization": `Discogs token=${DISCOGS_TOKEN}`, "User-Agent": "VinylPulse/1.2" }
      });
      const dData = await dRes.json();
      return new Response(JSON.stringify(dData.results || []), { headers: { ...headers, "Content-Type": "application/json" } });
    }

    // 5. API: Log a "Spin" (POST)
    if (path === "/spin" && req.method === "POST") {
      const body = await req.json();
      // Ensure Table exists
      await runQuery("CREATE TABLE IF NOT EXISTS spins (id SERIAL PRIMARY KEY, data JSONB, created_at TIMESTAMPTZ DEFAULT NOW())");
      // Insert Data
      const res = await runQuery("INSERT INTO spins (data) VALUES ($1) RETURNING *", [body]);
      return new Response(JSON.stringify(res[0]), { headers: { ...headers, "Content-Type": "application/json" } });
    }

    // 6. API: Fetch History (GET)
    if (path === "/data") {
      const user = url.searchParams.get("user") || "guest_user";
      try {
        const rows = await runQuery("SELECT * FROM spins WHERE data->>'user_email' = $1 ORDER BY created_at DESC LIMIT 20", [user]);
        return new Response(JSON.stringify(rows), { headers: { ...headers, "Content-Type": "application/json" } });
      } catch (_e) {
        return new Response("[]", { headers: { ...headers, "Content-Type": "application/json" } });
      }
    }

    return new Response("Not Found", { status: 404, headers });

  } catch (err) {
    console.error("CRITICAL SERVER ERROR:", err.message);
    // Send 200 with JSON to prevent Frontend SyntaxErrors
    return new Response(JSON.stringify({ error: true, message: err.message }), { 
      status: 200, 
      headers: { ...headers, "Content-Type": "application/json" } 
    });
  }
});
