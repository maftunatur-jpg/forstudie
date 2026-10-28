import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/**
 * Lokalt läge (NEXT_PUBLIC_LOCAL_ONLY=1): ingen inloggning och ingen synk.
 * Används för e2e-tester och för att prova appen utan Supabase.
 */
export const LOCAL_ONLY = process.env.NEXT_PUBLIC_LOCAL_ONLY === "1";

export function supabase(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL och NEXT_PUBLIC_SUPABASE_ANON_KEY saknas.");
    client = createClient(url, key, {
      // Implicit flöde gör att den magiska länken fungerar även om den öppnas
      // på en annan enhet än där den begärdes (t.ex. dator → mobil) och för inbjudningar.
      auth: { flowType: "implicit", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return client;
}
