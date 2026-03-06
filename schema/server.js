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
  // Normalize the path (lowercase and remove trailing slashes)
  const path = url.pathname.toLowerCase().replace(/\/$/, "");

  // --- DEBUG LOG: Check Render Dashboard Logs to see this ---
  console.log(`Incoming: ${req.method} ${path}`);

  // 1. --- THE ABSOLUTE PRIORITY: GOOGLE AUTH REDIRECT ---
  // We check for "auth/google" anywhere in the path
  if (path.includes("auth/google")) {
    const scopes = [
      "https://www.googleapis.com/auth/fitness.activity.read",
      "https://www.googleapis.com/auth/fitness.heart_rate.read"
    ].join(" ");

    const googleUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent`;
    
    console.log("Redirecting to Google...");
    return Response.redirect(googleUrl, 302);
  }

  // 2. --- THE CALLBACK ---
  if (path.includes("auth/callback")) {
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
    console.log(tokens.access_token ? "Sync: Tokens Received" : "Sync: Failed");

    return Response.redirect("https://latency-8zo5.onrender.com/?auth=success", 302);
  }

  // 3. --- STANDARD API LOGIC ---
  if (req.method === "OPTIONS") return new Response(null, { headers });

  try {
    if (path === "/spin" && req.method === "POST") {
      const body = await req.json();
      const res = await sql`INSERT INTO spins (data) VALUES (${sql.json(body)}) RETURNING *`;
      return new Response(JSON.stringify(res[0]), { headers });
    }

    if (path === "/data") {
      const data = await sql`SELECT * FROM spins ORDER BY created_at DESC LIMIT 20`;
      return new Response(JSON.stringify(data), { headers });
    }

    // 4. --- THE FALLBACK (The page you're currently stuck on) ---
    const stats = await sql`SELECT count(*) FROM spins`;
    return new Response(`
      💿 VINYL PULSE API
      ------------------
      Status: ONLINE
      Database: ✅ Connected
      Logs: ${stats[0].count}
      Debug Path: ${path}
    `, { headers: { ...headers, "Content-Type": "text/plain" } });

  } catch (err) {
    return new Response(`Error: ${err.message}`, { status: 500, headers });
  }
});
