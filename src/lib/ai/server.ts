// Gemensamt för AI-routes: autentisering, rate limiting och klient.
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

export const AI_MODEL = "claude-opus-5-5";
const LIMIT_PER_HOUR = 30;

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Kontrollerar inloggning via användarens token och räknar mot timgränsen. */
export async function authorizeAi(req: Request, kind: string) {
  if (!process.env.ANTHROPIC_API_KEY) throw new HttpError(503, "AI-förslag är inte aktiverat (ANTHROPIC_API_KEY saknas).");
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new HttpError(401, "Inte inloggad.");
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: user, error } = await sb.auth.getUser(token);
  if (error || !user.user) throw new HttpError(401, "Inte inloggad.");
  const { data: allowed, error: rlError } = await sb.rpc("ai_rate_check", { p_kind: kind, p_limit: LIMIT_PER_HOUR, p_window_minutes: 60 });
  if (rlError) throw new HttpError(500, rlError.message);
  if (!allowed) throw new HttpError(429, `Max ${LIMIT_PER_HOUR} AI-förslag per timme. Försök igen senare.`);
}

let client: Anthropic | null = null;
export function anthropic() {
  if (!client) client = new Anthropic();
  return client;
}

export function errorResponse(err: unknown) {
  if (err instanceof HttpError) return Response.json({ error: err.message }, { status: err.status });
  if (err instanceof Anthropic.RateLimitError) return Response.json({ error: "AI-tjänsten är överbelastad. Försök igen strax." }, { status: 429 });
  if (err instanceof Anthropic.APIError) return Response.json({ error: `AI-fel (${err.status}).` }, { status: 502 });
  console.error(err);
  return Response.json({ error: "Oväntat fel." }, { status: 500 });
}

export const SYSTEM_PROMPT = `Du är en erfaren besiktningsperson som hjälper projektledare med förstudier inom bygg och fastighet (stambyte, fönster, fasad, tak, ventilation, badrum).
Du får en okulär inventering av ett objekt: ifyllda svar, anteckningar och foton. Bedömningen bygger på okulär besiktning utan ingrepp.
Skriv på svenska, sakligt och kortfattat. Hitta inte på fakta som inte stöds av underlaget; skriv hellre att något inte kan bedömas.
Bedömningsskala: good = God, acceptable = Acceptabel, deficient = Brister, urgent = Akut åtgärd, not_assessed = Ej bedömt.
Använd urgent bara när underlaget visar pågående skada eller risk (t.ex. aktivt läckage). Inkludera inga personuppgifter.`;
