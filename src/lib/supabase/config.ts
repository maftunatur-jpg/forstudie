// Vilket Supabase-projekt appen använder. Standardvärdena pekar på projektet
// som har appens databas; den publika nyckeln får finnas i webbläsaren (RLS
// skyddar datan). Egna namn på variablerna används med flit: Vercels
// Supabase-integration sätter NEXT_PUBLIC_SUPABASE_* automatiskt och kan då
// peka på ett annat, tomt projekt.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_APP_SUPABASE_URL || "https://huondmltclsndwauxros.supabase.co";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_APP_SUPABASE_ANON_KEY || "sb_publishable_HEcwbNnRG-6Gr3rDsD0hIg_BG4m4CCW";
