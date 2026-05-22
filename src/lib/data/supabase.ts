import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient | null | undefined;
let publicClient: SupabaseClient | null | undefined;

export function getSupabaseAdmin() {
  if (adminClient !== undefined) return adminClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    adminClient = null;
    return null;
  }
  adminClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return adminClient;
}

export function getSupabasePublic() {
  if (publicClient !== undefined) return publicClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    publicClient = null;
    return null;
  }
  publicClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return publicClient;
}
