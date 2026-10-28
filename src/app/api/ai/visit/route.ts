import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { AI_MODEL, SYSTEM_PROMPT, anthropic, authorizeAi, errorResponse, HttpError } from "@/lib/ai/server";

export const maxDuration = 60;

const RatingEnum = z.enum(["good", "acceptable", "deficient", "urgent", "not_assessed"]);

const Body = z.object({
  description: z.string().max(40_000),
  categories: z.array(z.object({ key: z.string(), title: z.string() })).max(60),
  images: z.array(z.string().max(1_000_000)).max(6),
});

const Suggestion = z.object({
  text: z.string().describe("Kort bedömningstext för besöket, 2–6 meningar."),
  ratings: z.array(z.object({ key: z.string(), rating: RatingEnum })).describe("Bedömning per kategori, använd givna nycklar."),
  overall: RatingEnum,
});

export async function POST(req: Request) {
  try {
    await authorizeAi(req, "visit");
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) throw new HttpError(400, "Ogiltig förfrågan.");
    const { description, categories, images } = parsed.data;

    const response = await anthropic().beta.messages.parse({
      model: AI_MODEL,
      max_tokens: 16000,
      // Vid ett avböjande kör API:t om förfrågan på en reservmodell.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            ...images.map((data) => ({ type: "image" as const, source: { type: "base64" as const, media_type: "image/jpeg" as const, data } })),
            {
              type: "text",
              text:
                `Kategorier (nyckel – rubrik):\n${categories.map((c) => `${c.key} – ${c.title}`).join("\n")}\n\n` +
                `Underlag:\n${description}\n\n` +
                "Föreslå en bedömning per kategori (bara kategorier med underlag), en samlad bedömning och en kort text.",
            },
          ],
        },
      ],
      output_config: { format: betaZodOutputFormat(Suggestion) },
    });

    if (response.stop_reason === "refusal") throw new HttpError(422, "AI:n kunde inte ge ett förslag för det här underlaget.");
    if (!response.parsed_output) throw new HttpError(502, "AI-svaret kunde inte tolkas.");
    const keys = new Set(categories.map((c) => c.key));
    const out = response.parsed_output;
    return Response.json({ ...out, ratings: out.ratings.filter((r) => keys.has(r.key)) });
  } catch (err) {
    return errorResponse(err);
  }
}
