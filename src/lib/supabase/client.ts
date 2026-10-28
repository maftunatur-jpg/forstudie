import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

let client: SupabaseClient | null = null;

/**
 * Lokalt läge (NEXT_PUBLIC_LOCAL_ONLY=1): ingen inloggning och ingen synk.
 * Används för e2e-tester och för att prova appen utan Supabase.
 */
export const LOCAL_ONLY = process.env.NEXT_PUBLIC_LOCAL_ONLY === "1";

/**
 * Standard: ingen inloggning. Varje enhet får automatiskt ett eget anonymt
 * Supabase-konto och ser bara sina egna projekt (vanlig RLS).
 * NEXT_PUBLIC_REQUIRE_LOGIN=1 slår på e-postinloggning, team och inbjudningar.
 */
export const REQUIRE_LOGIN = process.env.NEXT_PUBLIC_REQUIRE_LOGIN === "1";

export function supabase(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      // Implicit flöde gör att den magiska länken fungerar även om den öppnas
      // på en annan enhet än där den begärdes (t.ex. dator → mobil) och för inbjudningar.
      auth: { flowType: "implicit", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return client;
}
