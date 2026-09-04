import { supabase } from "@/lib/supabase";
import type { ZohoAppResponse } from "@/types";

const FUNCTIONS_BASE_URL = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL
  || `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const FUNCTION_URL = `${FUNCTIONS_BASE_URL}/zoho-proxy`;

async function getAuthToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function fetchAuthorizedApps(): Promise<{
  applications: ZohoAppResponse[];
  roles: string[];
  zoho_connected: boolean;
}> {
  const accessToken = await getAuthToken();
  if (!accessToken) throw new Error("Not authenticated");

  const response = await fetch(`${FUNCTION_URL}/apps`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || `Request failed (${response.status})`);
  }

  return response.json();
}

export async function launchZohoApp(appName: string): Promise<{
  app_name: string;
  url: string;
  access_token: string | null;
  zoho_connected: boolean;
}> {
  const accessToken = await getAuthToken();
  if (!accessToken) throw new Error("Not authenticated");

  const response = await fetch(`${FUNCTION_URL}/launch`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ app_name: appName }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || `Request failed (${response.status})`);
  }

  return response.json();
}
