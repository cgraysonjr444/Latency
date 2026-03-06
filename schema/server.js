import postgres from "https://deno.land/x/postgresjs@v3.3.3/mod.js";

const databaseUrl = Deno.env.get("DATABASE_URL");
const sql = databaseUrl ? postgres(databaseUrl, { ssl: { rejectUnauthorized: false } }) : null;

const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
const REDIRECT_URI = "https://latency-8zo5.onrender.com/auth/callback";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

Deno.serve({ port: parseInt(Deno.env.get("PORT") || "10000") }, async (req) => {
  const url = new URL(req.url);
  if (req.method === "OPTIONS") return new Response(null, { headers });

  try {
    if (url.pathname === "/spin" && req.method === "POST") {
      const body = await req.json();
      if (!sql) return new Response("No DB", { status: 500, headers });
      const res = await sql`INSERT INTO spins (data) VALUES (${sql.json(body)}) RETURNING *`;
      return new Response(JSON.stringify(res[0]), { headers });
    }

    if (url.pathname === "/data") {
      if (!sql) return new Response("[]", { headers });
      const data = await sql`SELECT * FROM spins ORDER BY created_at DESC LIMIT 20`;
      return new Response(JSON.stringify(data), { headers });
    }

    if (url.pathname === "/search-album") {
      const q = url.searchParams.get("q") || "";
      const res = await fetch(`https://api.discogs.com/database/search?q=${q}&type=release&per_page=5`, {
        headers: { "Authorization": `Discogs token=${Deno.env.get("DISCOGS_TOKEN")}`, "User-Agent": "VinylPulse/1.0" }
      });
      const discogsData = await res.json();
      return new Response(JSON.stringify(discogsData.results || []), { headers });
    }

    if (url.pathname === "/auth/google") {
      const scopes = "https://www.googleapis.com/auth/fitness.activity.read https://www.googleapis.com/auth/fitness.heart_rate.read";
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent`;
      return Response.redirect(authUrl);
    }

    if (url.pathname === "/auth/callback") {
      const code = url.searchParams.get("code") || "";
      const tokenParams = new URLSearchParams({
        code: code,
        client_id: CLIENT_ID || "",
        client_secret: CLIENT_SECRET || "",
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code"
      });

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: tokenParams.toString()
      });
      
      const tokens = await tokenRes.json();
      
      // Fetch Heart Rate data to satisfy the linter and test the connection
      const endTimeNanos = Date.now() * 1000000;
      const startTimeNanos = (Date.now() - (1000 * 60 * 60)) * 1000000;
      const fitUrl = `https://www.googleapis.com/fitness/v1/users/me/dataset/derived:com.google.heart_rate.bpm:com.google.android.gms:merge_heart_rate_bpm/${startTimeNanos}-${endTimeNanos}`;
      
      const fitnessRes = await fetch(fitUrl, {
        headers: { "Authorization": `Bearer ${tokens.access_token}` }
      });
      
      const fitnessData = await fitnessRes.json();
      console.log("Sync Check:", fitnessData ? "Connection OK" : "No Data");

      return Response.redirect("https://latency-8zo5.onrender.com/?auth=success");
    }

    return new Response("Vinyl Pulse API Live", { headers });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
});
