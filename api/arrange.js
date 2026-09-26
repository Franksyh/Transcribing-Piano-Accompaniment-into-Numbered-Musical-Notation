const { chooseArrangement } = require("./_shared/arrangement");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("allow", "POST");
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  try {
    const body = await readBody(req);
    const metadata = body.metadata || {};
    const sourceText = String(body.sourceText || "").slice(0, 12000);
    const preferredStyle = body.preferredStyle || "auto";
    const fallback = chooseArrangement(metadata, sourceText, preferredStyle);
    const result = await getAiArrangement(metadata, sourceText, preferredStyle, fallback);
    res.statusCode = 200;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("cache-control", "no-store");
    res.end(JSON.stringify(result));
  } catch (error) {
    res.statusCode = 400;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: error.message || "伴奏分析失敗" }));
  }
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch { reject(new Error("請提供有效資料")); }
    });
    req.on("error", reject);
  });
}

async function getAiArrangement(metadata, sourceText, preferredStyle, fallback) {
  if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) return fallback;

  try {
    const { generateText } = await import("ai");
    const safeFacts = {
      title: String(metadata.title || "").slice(0, 100),
      tempo: String(metadata.tempo || ""),
      beat: String(metadata.beat || ""),
      key: String(metadata.playKey || metadata.originalKey || ""),
      chordCount: (sourceText.match(/[A-G](?:#|b)?(?:maj|min|dim|aug|sus|add|m)?\d*(?:[#b]?\d+)*/g) || []).length,
      preferredStyle
    };
    const { text } = await generateText({
      model: "openai/gpt-5.4",
      maxOutputTokens: 180,
      temperature: 0.25,
      providerOptions: {
        gateway: { tags: ["feature:piano-arrangement"], cacheControl: "max-age=3600" }
      },
      prompt: `You are a piano accompanist. Based only on ${JSON.stringify(safeFacts)}, choose one style: ballad, pop, waltz, or jazz. Reply with strict JSON: {"style":"...","label":"Traditional Chinese short title","summary":"Traditional Chinese practical playing advice under 90 characters"}.`
    });
    const proposal = JSON.parse(text);
    if (!["ballad", "pop", "waltz", "jazz"].includes(proposal.style)) return fallback;
    return {
      style: proposal.style,
      label: String(proposal.label || fallback.label).slice(0, 40),
      summary: String(proposal.summary || fallback.summary).slice(0, 180),
      source: "ai"
    };
  } catch {
    return fallback;
  }
}
