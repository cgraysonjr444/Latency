import postgres from "https://deno.land/x/postgresjs@v3.3.3/mod.js";

const databaseUrl = Deno.env.get("DATABASE_URL");
const sql = databaseUrl ? postgres(databaseUrl, { ssl: { rejectUnauthorized: false } }) : null;

const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") || "";
const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") || "";
const REDIRECT_URI = "https://latency-8zo5.onrender.com/auth/callback";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

Deno.serve({ port: parseInt(Deno.env.get("PORT") || "10000") }, async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/$/, ""); // Removes trailing slash for better matching

  console.log(`Incoming Request: ${req.method} ${path}`); // This will show up in your Render Logs!

  if (req.method === "OPTIONS") return new Response(null, { headers });

  try {
    // 1. --- LOG A PERFORMANCE ---
    if (path === "/spin" && req.method === "POST") {
      const body = await req.json();
      const res = await sql`INSERT INTO spins (data) VALUES (${sql.json(body)}) RETURNING *`;
      return new Response(JSON.stringify(res[0]), { headers });
    }

    // 2. --- GET HISTORY ---
    if (path === "/data") {
      const data = await sql`SELECT * FROM spins ORDER BY created_at DESC LIMIT 20`;
      return new Response(JSON.stringify(data), { headers });
    }

    // 3. --- DISCOGS SEARCH ---
    if (path === "/search-album") {
      const q = url.searchParams.get("q") || "";
      const dRes = await fetch(`https://api.discogs.com/database/search?q=${encodeURIComponent(q)}&type=release&per_page=5`, {
        headers: { "Authorization": `Discogs token=${Deno.env.get("DISCOGS_TOKEN")}`, "User-Agent": "VinylPulse/1.1" }
      });
      const dData = await dRes.json();
      return new Response(JSON.stringify(dData.results || []), { headers });
    }

    // 4. --- GOOGLE AUTH: THE REDIRECT (CRITICAL FIX) ---
    // We use .includes or .startsWith to ensure it catches the route
    if (path.includes("/auth/google")) {
      console.log("MATCHED: /auth/google - Starting Redirect...");
      
      const scopes = [
        "https://www.googleapis.com/auth/fitness.activity.read",
        "https://www.googleapis.com/auth/fitness.heart_rate.read"
      ].join(" ");

      const googleUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent`;
      
      return Response.redirect(googleUrl, 302);
    }

    // 5. --- GOOGLE AUTH: CALLBACK ---
    if (path.includes("/auth/callback")) {
      const code = url.searchParams.get("code") || "";
      const tParams = new URLSearchParams({
        code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET, redirect_uri: REDIRECT_URI, grant_type: "authorization_code"
      });

      const tRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: tParams.toString()
      });
      
      const tokens = await tRes.json();
      console.log("Tokens Received:", tokens.access_token ? "YES" : "NO");

      return Response.redirect("https://latency-8zo5.onrender.com/?auth=success", 302);
    }

    // --- DEFAULT FALLBACK (What you were seeing) ---
    const stats = await sql`SELECT count(*) FROM spins`;
    return new Response(`
      💿 Latency Service Online
      -------------------------
      Database: ✅ Connected
      Spins Recorded: ${stats[0].count}
      Current Path: ${path}
    `, { headers: { ...headers, "Content-Type": "text/plain" } });

  } catch (err) {
    return new Response(`Error: ${err.message}`, { status: 500, headers });
  }
});
