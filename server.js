import postgres from "https://deno.land/x/postgresjs@v3.3.3/mod.js";

// --- CONFIG ---
const databaseUrl = Deno.env.get("DATABASE_URL");
const sql = databaseUrl ? postgres(databaseUrl, { ssl: { rejectUnauthorized: false } }) : null;

const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") || "";
const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") || "";
const REDIRECT_URI = "https://latency-8zo5.onrender.com/auth/callback";
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
    // 0. FRONTEND LOADER
    if (path === "" || path === "/") {
      try {
        const html = await Deno.readTextFile("./index.html");
        return new Response(html, { headers: { ...headers, "Content-Type": "text/html" } });
      } catch (_e) {
        return new Response("index.html missing", { status: 404, headers });
      }
    }

    // 1. GOOGLE AUTH HANDSHAKE
    if (path.includes("auth/google")) {
      const scopes = ["https://www.googleapis.com/auth/fitness.activity.read", "https://www.googleapis.com/auth/fitness.heart_rate.read"].join(" ");
      const googleUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      googleUrl.searchParams.set("client_id", CLIENT_ID);
      googleUrl.searchParams.set("redirect_uri", REDIRECT_URI);
      googleUrl.searchParams.set("response_type", "code");
      googleUrl.searchParams.set("scope", scopes);
      googleUrl.searchParams.set("access_type", "offline");
      googleUrl.searchParams.set("prompt", "consent");
      return Response.redirect(googleUrl.toString(), 302);
    }

    if (path.includes("auth/callback")) {
      const code = url.searchParams.get("code") || "";
      const tRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET, redirect_uri: REDIRECT_URI, grant_type: "authorization_code" })
      });
      const tokens = await tRes.json();
      console.log(tokens.access_token ? "Sync Success" : "Sync Failed");
      return Response.redirect("https://latency-8zo5.onrender.com/?auth=success", 302);
    }

    // 2. DISCOGS BRIDGE (Returns JSON array)
    if (path === "/search-album") {
      const q = url.searchParams.get("q") || "";
      const dRes = await fetch(`https://api.discogs.com/database/search?q=${encodeURIComponent(q)}&type=release&per_page=5`, {
        headers: { "Authorization": `Discogs token=${DISCOGS_TOKEN}`, "User-Agent": "VinylPulse/1.1" }
      });
      const dData = await dRes.json();
      return new Response(JSON.stringify(dData.results || []), { 
        headers: { ...headers, "Content-Type": "application/json" } 
      });
    }

    // 3. DATA LOGGING (Saves plain object)
    if (path === "/spin" && req.method === "POST") {
      const body = await req.json();
      if (!sql) throw new Error("DB Missing");
      const res = await sql`INSERT INTO spins (data) VALUES (${sql.json(body)}) RETURNING *`;
      return new Response(JSON.stringify(res[0]), { headers });
    }

    // 4. DATA FETCH
    if (path === "/data") {
      if (!sql) return new Response("[]", { headers });
      const data = await sql`SELECT * FROM spins ORDER BY created_at DESC LIMIT 20`;
      return new Response(JSON.stringify(data), { headers });
    }

    return new Response("Not Found", { status: 404, headers });
  } catch (err) {
    return new Response(err.message, { status: 500, headers });
  }
});
