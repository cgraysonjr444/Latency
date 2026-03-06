import postgres from "https://deno.land/x/postgresjs@v3.3.3/mod.js";

// --- ENVIRONMENT VARIABLES ---
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

Deno.serve({ port: parseInt(Deno.env.get("PORT") || "10000") }, async (req) => {
  const url = new URL(req.url);
  const path = url.pathname;

  // Handle CORS Preflight
  if (req.method === "OPTIONS") return new Response(null, { headers });

  try {
    // 1. --- LOG A PERFORMANCE ---
    if (path === "/spin" && req.method === "POST") {
      const body = await req.json();
      if (!sql) return new Response("DB Not Configured", { status: 500, headers });
      const res = await sql`INSERT INTO spins (data) VALUES (${sql.json(body)}) RETURNING *`;
      return new Response(JSON.stringify(res[0]), { headers });
    }

    // 2. --- GET HISTORY ---
    if (path === "/data") {
      if (!sql) return new Response("[]", { headers });
      const data = await sql`SELECT * FROM spins ORDER BY created_at DESC LIMIT 20`;
      return new Response(JSON.stringify(data), { headers });
    }

    // 3. --- DISCOGS SEARCH ---
    if (path === "/search-album") {
      const q = url.searchParams.get("q") || "";
      const discogsRes = await fetch(`https://api.discogs.com/database/search?q=${encodeURIComponent(q)}&type=release&per_page=5`, {
        headers: { "Authorization": `Discogs token=${DISCOGS_TOKEN}`, "User-Agent": "VinylPulse/1.1" }
      });
      const discogsData = await discogsRes.json();
      return new Response(JSON.stringify(discogsData.results || []), { headers });
    }

    // 4. --- GOOGLE AUTH: START REDIRECT ---
    if (path === "/auth/google") {
      const scopes = [
        "https://www.googleapis.com/auth/fitness.activity.read",
        "https://www.googleapis.com/auth/fitness.heart_rate.read"
      ].join(" ");

      const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      googleAuthUrl.searchParams.set("client_id", CLIENT_ID);
      googleAuthUrl.searchParams.set("redirect_uri", REDIRECT_URI);
      googleAuthUrl.searchParams.set("response_type", "code");
      googleAuthUrl.searchParams.set("scope", scopes);
      googleAuthUrl.searchParams.set("access_type", "offline");
      googleAuthUrl.searchParams.set("prompt", "consent");

      console.log("Redirecting user to Google OAuth...");
      return Response.redirect(googleAuthUrl.toString(), 302);
    }

    // 5. --- GOOGLE AUTH: CALLBACK ---
    if (path === "/auth/callback") {
      const code = url.searchParams.get("code") || "";
      
      const tokenParams = new URLSearchParams({
        code: code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code"
      });

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: tokenParams.toString()
      });
      
      const tokens = await tokenRes.json();

      // Test fetch to confirm tokens work
      if (tokens.access_token) {
        const now = Date.now();
        const startTimeNanos = (now - (1000 * 60 * 60)) * 1000000;
        const endTimeNanos = now * 1000000;
        
        const fitUrl = `https://www.googleapis.com/fitness/v1/users/me/dataset/derived:com.google.heart_rate.bpm:com.google.android.gms:merge_heart_rate_bpm/${startTimeNanos}-${endTimeNanos}`;
        
        const fitnessRes = await fetch(fitUrl, {
          headers: { "Authorization": `Bearer ${tokens.access_token}` }
        });
        
        const fitnessData = await fitnessRes.json();
        console.log("Sync Status:", fitnessData.point ? "Data Found" : "Connection Active");
      }

      return Response.redirect("https://latency-8zo5.onrender.com/?auth=success");
    }

    // FALLBACK
    return new Response("Vinyl Pulse API Live", { headers });

  } catch (err) {
    console.error("Server Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
});
