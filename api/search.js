const { searchSongs } = require("./_shared/pu");

module.exports = async function handler(req, res) {
  try {
    const keyword = String(Array.isArray(req.query.q) ? req.query.q[0] : req.query.q || "").trim();
    const limit = Math.min(Math.max(Number(req.query.limit || 100), 1), 100);
    if (!keyword) return json(res, { error: "請輸入歌名、歌詞或歌手名稱。" }, 400);
    const data = await searchSongs(keyword, limit);
    return json(res, { keyword, total: data.total, fetched: data.results.length, complete: true, results: data.results });
  } catch (error) { return json(res, { error: error.message || "搜尋失敗" }, 502); }
};

function json(res, payload, status = 200) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(payload));
}
