import { searchSongs } from "./_shared/pu.mts";

export default async (req) => {
  try {
    const url = new URL(req.url);
    const keyword = (url.searchParams.get("q") || "").trim();
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 100), 1), 100);
    if (!keyword) return json({ error: "請輸入歌名、歌詞或歌手名稱。" }, 400);
    const data = await searchSongs(keyword, limit);
    return json({ keyword, total: data.total, fetched: data.results.length, complete: true, results: data.results });
  } catch (error) { return json({ error: error.message || "搜尋失敗" }, 502); }
};

export const config = { path: "/api/search" };
function json(payload, status = 200) { return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } }); }
