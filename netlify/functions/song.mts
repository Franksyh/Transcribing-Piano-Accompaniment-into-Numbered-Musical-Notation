import { fetchSongData, isSongAccessError } from "./_shared/pu.mts";

export default async (req) => {
  const url = new URL(req.url);
  const id = (url.searchParams.get("id") || "").trim();
  const sourceUrl = (url.searchParams.get("url") || "").trim();
  const source = sourceUrl || id;

  try {
    if (!id && !sourceUrl) return json({ error: "請提供 91譜歌曲連結。" }, 400);
    console.info("[song-import] started", { song: songReference(source) });
    const payload = await fetchSongData(source);
    console.info("[song-import] completed", { song: payload.id, sourceLength: payload.sourceText.length });
    return json(payload);
  } catch (error) {
    console.error("[song-import] failed", { song: songReference(source), error: error.message || String(error) });
    const needsLogin = isSongAccessError(error);
    return json({
      error: error.message || "匯入失敗",
      code: needsLogin ? "91PU_LOGIN_REQUIRED" : "91PU_IMPORT_FAILED",
      sourceUrl: songUrl(source)
    }, needsLogin ? 403 : 502);
  }
};

export const config = { path: "/api/song" };
function json(payload, status = 200) { return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": status === 200 ? "public, s-maxage=300, stale-while-revalidate=3600" : "no-store" } }); }
function songReference(value) { return String(value || "").match(/[0-9a-f]{8}-[0-9a-f-]{27}/i)?.[0] || String(value || "").slice(0, 80); }
function songUrl(value) { const id = songReference(value); return /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id) ? `https://www.91pu.com.tw/sheet/song/${id}` : ""; }
