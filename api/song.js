const { fetchSongData } = require("./_shared/pu");

module.exports = async function handler(req, res) {
  try {
    const id = String(Array.isArray(req.query.id) ? req.query.id[0] : req.query.id || "").trim();
    const url = String(Array.isArray(req.query.url) ? req.query.url[0] : req.query.url || "").trim();
    if (!id && !url) return json(res, { error: "請提供 91譜歌曲連結。" }, 400);
    return json(res, await fetchSongData(url || id));
  } catch (error) { return json(res, { error: error.message || "匯入失敗" }, 502); }
};

function json(res, payload, status = 200) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(payload));
}
