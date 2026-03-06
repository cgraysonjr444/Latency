import postgres from "https://deno.land/x/postgresjs@v3.3.3/mod.js";

// --- CONFIGURATION & ENV VARS ---
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

  console.log(`Incoming: ${req.method} | Path: ${path || "/"}`);

  // Handle CORS Preflight
  if (req.method === "OPTIONS") return new Response(null, { headers });

  try {
    // --- 0. SERVE THE FRONTEND ---
    if (path === "" || path === "/") {
      try {
        const html = await Deno.readTextFile("./index.html");
        return new Response(html, { 
          headers: { ...headers, "Content-Type": "text/html" } 
        });
      } catch (_e) { // Linter-safe unused variable
        return new Response("index.html not found.", { status: 404, headers });
      }
    }

    // --- 1. GOOGLE AUTH START (The Redirect) ---
    if (path.includes("auth/google")) {
      const scopes = [
        "https://www.googleapis.com/auth/fitness.activity.read",
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

    // --- 2. GOOGLE AUTH CALLBACK ---
    if (path.includes("auth/callback")) {
      const code = url.searchParams.get("code") || "";
      const tParams = new URLSearchParams({
        code, 
        client_id: CLIENT_ID, 
        client_secret: CLIENT_SECRET, 
        redirect_uri: REDIRECT_URI, 
        grant_type: "authorization_code"
      });

      const tRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: tParams.toString()
      });
      
      const tokens = await tRes.json();
      console.log(tokens.access_token ? "Auth Success" : "Auth Failed");

      // Redirect back to main page with success flag
      return Response.redirect("https://latency-8zo5.onrender.com/?auth=success", 302);
    }

    // --- 3. LOG PERFORMANCE DATA ---
    if (path === "/spin" && req.method === "POST") {
      const body = await req.json();
      if (!sql) throw new Error("Database not connected");
      const res = await sql`INSERT INTO spins (data) VALUES (${sql.json(body)}) RETURNING *`;
      return new Response(JSON.stringify(res[0]), { headers });
    }

    // --- 4. GET HISTORY ---
    if (path === "/data") {
      if (!sql) return new Response("[]", { headers });
      const data = await sql`SELECT * FROM spins ORDER BY created_at DESC LIMIT 20`;
      return new Response(JSON.stringify(data), { headers });
    }

    // --- 5. DISCOGS SEARCH ---
    if (path === "/search-album") {
      const q = url.searchParams.get("q") || "";
      const dRes = await fetch(`https://api.discogs.com/database/search?q=${encodeURIComponent(q)}&type=release&per_page=5`, {
        headers: { "Authorization": `Discogs token=${DISCOGS_TOKEN}`, "User-Agent": "VinylPulse/1.1" }
      });
      const dData = await dRes.json();
      return new Response(JSON.stringify(dData.results || []), { headers });
    }

    // --- 6. API FALLBACK ---
    return new Response(`Vinyl Pulse API: ${path} ignored.`, { headers });

  } catch (err) {
    console.error("Server Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
});
