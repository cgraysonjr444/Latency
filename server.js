import postgres from "https://deno.land/x/postgresjs@v3.3.3/mod.js";

// --- CONFIGURATION & DATABASE CONNECTION ---
const databaseUrl = Deno.env.get("DATABASE_URL");

// Use SSL "require" and disable "prepare" for maximum compatibility with Render Postgres
const sql = databaseUrl ? postgres(databaseUrl, { 
  ssl: "require", 
  prepare: false,
  idle_timeout: 20,
  connect_timeout: 10
}) : null;

// --- AUTO-INITIALIZE TABLE ---
if (sql) {
  (async () => {
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS spins (
          id SERIAL PRIMARY KEY,
          data JSONB NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;
      console.log("✅ Database table 'spins' is ready.");
    } catch (err) {
      console.error("❌ Database Initialization Error:", err.message);
    }
  })();
}

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
    // 0. Silence Favicon 404s
    if (path === "/favicon.ico") {
      return new Response(null, { status: 204, headers });
    }

    // 1. Serve Frontend
    if (path === "" || path === "/") {
      const html = await Deno.readTextFile("./index.html");
      return new Response(html, { headers: { ...headers, "Content-Type": "text/html" } });
    }

    // 2. Google Auth
    if (path.includes("auth/google")) {
      const scopes = ["https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/fitness.heart_rate.read"].join(" ");
      const googleUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      googleUrl.searchParams.set("client_id", CLIENT_ID);
      googleUrl.searchParams.set("redirect_uri", REDIRECT_URI);
      googleUrl.searchParams.set("response_type", "code");
      googleUrl.searchParams.set("scope", scopes);
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
      const uRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` }
      });
      const user = await uRes.json();
      return Response.redirect(`/?auth=success&user=${encodeURIComponent(user.email)}`, 302);
    }

    // 3. API Routes
    if (path === "/search-album") {
      const q = url.searchParams.get("q") || "";
      const dRes = await fetch(`https://api.discogs.com/database/search?q=${encodeURIComponent(q)}&type=release&per_page=5`, {
        headers: { "Authorization": `Discogs token=${DISCOGS_TOKEN}`, "User-Agent": "VinylPulse/1.1" }
      });
      const dData = await dRes.json();
      return new Response(JSON.stringify(dData.results || []), { headers: { ...headers, "Content-Type": "application/json" } });
    }

    // Save Data
    if (path === "/spin" && req.method === "POST") {
      const body = await req.json();
      if (!sql) throw new Error("Database URL not found in environment.");
      const res = await sql`INSERT INTO spins (data) VALUES (${sql.json(body)}) RETURNING *`;
      return new Response(JSON.stringify(res[0]), { headers: { ...headers, "Content-Type": "application/json" } });
    }

    // Load Data
    if (path === "/data") {
      const user = url.searchParams.get("user") || "guest_user";
      if (!sql) return new Response(JSON.stringify([]), { headers: { ...headers, "Content-Type": "application/json" } });
      const data = await sql`SELECT * FROM spins WHERE data->>'user_email' = ${user} ORDER BY created_at DESC LIMIT 20`;
      return new Response(JSON.stringify(data), { headers: { ...headers, "Content-Type": "application/json" } });
    }

    return new Response("Not Found", { status: 404, headers });

  } catch (err) {
    console.error("SERVER ERROR:", err.message);
    // Return a JSON error so the frontend doesn't crash on "unexpected character"
    return new Response(JSON.stringify({ error: true, message: err.message }), { 
      status: 500, 
      headers: { ...headers, "Content-Type": "application/json" } 
    });
  }
});
