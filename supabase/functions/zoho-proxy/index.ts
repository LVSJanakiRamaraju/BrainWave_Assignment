import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const userId = userData.user.id;

    // Fetch user's roles
    const { data: userRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select("roles(name)")
      .eq("user_id", userId);

    if (rolesError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch user roles" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const roleNames = (userRoles as unknown as { roles: { name: string } }[])
      .map((r) => r.roles.name)
      .filter(Boolean);

    if (roleNames.length === 0) {
      return new Response(
        JSON.stringify({ error: "No roles assigned. Contact your administrator." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const url = new URL(req.url);
    const path = url.pathname.replace("/functions/v1/zoho-proxy", "");
    const action = path.replace("/", "") || "apps";

    // GET /zoho-proxy/apps — list authorized Zoho apps for this user
    if (action === "apps" && req.method === "GET") {
      const { data: roleRows } = await supabase
        .from("roles")
        .select("id")
        .in("name", roleNames);

      const roleIds = (roleRows || []).map((r: { id: string }) => r.id);

      const { data: apps, error: appsError } = await supabase
        .from("zoho_applications")
        .select("name, url, category, icon, description")
        .in("role_id", roleIds);

      if (appsError) {
        return new Response(
          JSON.stringify({ error: "Failed to fetch applications" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Check if Zoho credentials are configured
      const hasZohoConfig = !!(
        Deno.env.get("ZOHO_CLIENT_ID") &&
        Deno.env.get("ZOHO_CLIENT_SECRET") &&
        Deno.env.get("ZOHO_REFRESH_TOKEN")
      );

      return new Response(
        JSON.stringify({
          applications: apps,
          roles: roleNames,
          zoho_connected: hasZohoConfig,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // POST /zoho-proxy/launch — get a SSO launch URL for a specific Zoho app
    if (action === "launch" && req.method === "POST") {
      const body = await req.json();
      const appName: string | undefined = body.app_name;

      if (!appName) {
        return new Response(
          JSON.stringify({ error: "app_name is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Verify this user's roles permit access to this app
      const { data: roleRows } = await supabase
        .from("roles")
        .select("id")
        .in("name", roleNames);

      const roleIds = (roleRows || []).map((r: { id: string }) => r.id);

      const { data: app } = await supabase
        .from("zoho_applications")
        .select("name, url")
        .eq("name", appName)
        .in("role_id", roleIds)
        .maybeSingle();

      if (!app) {
        // Log unauthorized access attempt
        await supabase.from("audit_logs").insert({
          action: "zoho.access.denied",
          actor_id: userId,
          details: { requested_app: appName },
        });
        return new Response(
          JSON.stringify({ error: "Access denied: Your role does not permit access to this application." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Try to get a Zoho access token if credentials are configured
      let zohoConnected = false;

      const clientId = Deno.env.get("ZOHO_CLIENT_ID");
      const clientSecret = Deno.env.get("ZOHO_CLIENT_SECRET");
      const refreshToken = Deno.env.get("ZOHO_REFRESH_TOKEN");

      if (clientId && clientSecret && refreshToken) {
        zohoConnected = true;
        try {
          const tokenResponse = await fetch("https://accounts.zoho.com/oauth/v2/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              refresh_token: refreshToken,
              client_id: clientId,
              client_secret: clientSecret,
              grant_type: "refresh_token",
            }),
          });

          if (tokenResponse.ok) {
            const tokenData = await tokenResponse.json();
            zohoConnected = Boolean(tokenData.access_token);
          }
        } catch {
          // Token refresh failed — still return the app URL for direct access
        }
      }

      // Log successful access
      await supabase.from("audit_logs").insert({
        action: "zoho.access.granted",
        actor_id: userId,
        details: { app_name: appName, app_url: (app as { url: string }).url },
      });

      return new Response(
        JSON.stringify({
          app_name: (app as { name: string }).name,
          url: (app as { url: string }).url,
          zoho_connected: zohoConnected,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown endpoint. Use /apps or /launch." }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
