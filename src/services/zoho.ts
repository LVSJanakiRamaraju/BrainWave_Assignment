import { api } from "@/lib/api";
import type { ZohoAppResponse } from "@/types";

export function fetchAuthorizedApps(): Promise<{ applications: ZohoAppResponse[]; roles: string[]; zoho_connected: boolean }> { return api.apps(); }
export function launchZohoApp(appName: string): Promise<{ app_name: string; url: string; zoho_connected: boolean }> { return api.launch(appName); }
