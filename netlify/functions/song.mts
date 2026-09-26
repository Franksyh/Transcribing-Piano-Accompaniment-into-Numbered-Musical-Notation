import { fetchSongData } from "./_shared/pu.mts";

export default async (req) => {
  try {
    const url = new URL(req.url);
    const id = (url.searchParams.get("id") || "").trim();
    const sourceUrl = (url.searchParams.get("url") || "").trim();
    if (!id && !sourceUrl) return json({ error: "請提供 91譜歌曲連結。" }, 400);
    return json(await fetchSongData(sourceUrl || id));
  } catch (error) { return json({ error: error.message || "匯入失敗" }, 502); }
};

export const config = { path: "/api/song" };
function json(payload, status = 200) { return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } }); }
