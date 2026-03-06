import postgres from "https://deno.land/x/postgresjs@v3.3.3/mod.js";

// --- CONFIGURATION ---
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

  // Handle CORS
  if (req.method === "OPTIONS") return new Response(null, { headers });

  try {
    // 0. SERVE FRONTEND
    if (path === "" || path === "/") {
      const html = await Deno.readTextFile("./index.html");
      return new Response(html, { headers: { ...headers, "Content-Type": "text/html" } });
    }

    // 1. GOOGLE AUTH START
    if (path.includes("auth/google")) {
      const scopes = [
        "https://www.googleapis.com/auth/fitness.activity.read",
        "https://www.googleapis.com/auth/fitness.heart_rate.read",
        "https://www.googleapis.com/auth/userinfo.email" // Added for user identification
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

    // 2. GOOGLE AUTH CALLBACK (Identity Recovery)
    if (path.includes("auth/callback")) {
      const code = url.searchParams.get("code") || "";
      
      // Swap code for tokens
      const tRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ 
          code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET, 
          redirect_uri: REDIRECT_URI, grant_type: "authorization_code" 
        })
      });
      const tokens = await tRes.json();

      // Use token to get user's email
      const uRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` }
      });
      const userInfo = await uRes.json();
      const email = userInfo.email || "unknown";

      console.log(`User Authenticated: ${email}`);

      // Redirect back with user identifier
      return Response.redirect(`https://latency-8zo5.onrender.com/?auth=success&user=${encodeURIComponent(email)}`, 302);
    }

    // 3. DISCOGS SEARCH
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

    // 4. LOG SPIN (Saves with User Identity)
    if (path === "/spin" && req.method === "POST") {
      const body = await req.json();
      if (!sql) throw new Error("Database not connected");
      
      const res = await sql`INSERT INTO spins (data) VALUES (${sql.json(body)}) RETURNING *`;
      return new Response(JSON.stringify(res[0]), { headers });
    }

    // 5. GET DATA (Filtered by User)
    if (path === "/data") {
      const user = url.searchParams.get("user") || "guest";
      if (!sql) return new Response("[]", { headers });

      // Only fetch logs belonging to this user
      const data = await sql`
        SELECT * FROM spins 
        WHERE data->>'user_email' = ${user} 
        ORDER BY created_at DESC LIMIT 30
      `;
      return new Response(JSON.stringify(data), { headers });
    }

    return new Response("Not Found", { status: 404, headers });

  } catch (err) {
    console.error("Server Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
});
