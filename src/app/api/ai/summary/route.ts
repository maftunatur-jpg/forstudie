import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { AI_MODEL, SYSTEM_PROMPT, anthropic, authorizeAi, errorResponse, HttpError } from "@/lib/ai/server";

export const maxDuration = 60;

const Body = z.object({ description: z.string().max(200_000) });
const Summary = z.object({ summary: z.string().describe("Sammanfattning för rapporten, 1–4 stycken.") });

export async function POST(req: Request) {
  try {
    await authorizeAi(req, "summary");
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) throw new HttpError(400, "Ogiltig förfrågan.");

    const response = await anthropic().beta.messages.parse({
      model: AI_MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content:
            `Här är en sammanställning av alla besök i en förstudie:\n\n${parsed.data.description}\n\n` +
            "Skriv en sammanfattning för rapporten: övergripande skick, återkommande brister, akuta åtgärder och rekommenderade nästa steg.",
        },
      ],
      output_config: { format: betaZodOutputFormat(Summary) },
    });

    if (response.stop_reason === "refusal") throw new HttpError(422, "AI:n kunde inte ge ett förslag för det här underlaget.");
    if (!response.parsed_output) throw new HttpError(502, "AI-svaret kunde inte tolkas.");
    return Response.json(response.parsed_output);
  } catch (err) {
    return errorResponse(err);
  }
}
