Deno.serve({ port: parseInt(Deno.env.get("PORT") || "10000") }, async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.toLowerCase();

  // --- LOGGING FOR DEBUGGING ---
  console.log(`PATH DETECTED: ${path}`);

  // 1. IMMEDIATE REDIRECT CHECK (Move this to the top)
  if (path.includes("/auth/google")) {
    const scopes = [
      "https://www.googleapis.com/auth/fitness.activity.read",
      "https://www.googleapis.com/auth/fitness.heart_rate.read"
    ].join(" ");

    const googleUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent`;
    
    return Response.redirect(googleUrl, 302);
  }

  // 2. CALLBACK CHECK
  if (path.includes("/auth/callback")) {
    // ... (Your callback logic here)
    return Response.redirect("https://latency-8zo5.onrender.com/?auth=success", 302);
  }

  // 3. CORS
  if (req.method === "OPTIONS") return new Response(null, { headers });

  try {
    // 4. API ROUTES
    if (path === "/spin" && req.method === "POST") {
       // ... existing spin logic
    }
    if (path === "/data") {
       // ... existing data logic
    }

    // 5. DEFAULT FALLBACK (The page you keep seeing)
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
