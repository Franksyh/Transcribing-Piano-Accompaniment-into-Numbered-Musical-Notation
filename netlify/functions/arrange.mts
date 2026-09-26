import { chooseArrangement } from "./_shared/arrangement.mts";
import OpenAI from "openai";

export default async (req: Request) => {
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  try {
    const body = await req.json();
    const fallback = chooseArrangement(body.metadata || {}, body.sourceText || "", body.preferredStyle || "auto");
    const baseUrl = Netlify.env.get("OPENAI_BASE_URL");
    if (!baseUrl) return Response.json(fallback);

    const completion = await new OpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [{
        role: "user",
        content: `Choose a piano accompaniment style from ballad, pop, waltz, jazz. Return JSON with style, label, summary. Use these song facts only: ${JSON.stringify({ metadata: body.metadata || {}, chordCount: chordCount(body.sourceText || ""), preferredStyle: body.preferredStyle || "auto" })}`
      }]
    });
    const proposed = JSON.parse(completion.choices[0]?.message?.content || "{}");
    const allowed = ["ballad", "pop", "waltz", "jazz"];
    if (!allowed.includes(proposed.style)) return Response.json(fallback);
    return Response.json({
      style: proposed.style,
      label: String(proposed.label || fallback.label).slice(0, 40),
      summary: String(proposed.summary || fallback.summary).slice(0, 220),
      source: "ai"
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "伴奏分析失敗" }, { status: 400 });
  }
};

export const config = { path: "/api/arrange", method: "POST" };

function chordCount(sourceText) {
  return (String(sourceText).match(/[A-G](?:#|b)?(?:maj|min|dim|aug|sus|add|m)?\d*(?:[#b]?\d+)*/g) || []).length;
}
