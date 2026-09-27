const { fetchSongData } = require("./_shared/pu");

module.exports = async function handler(req, res) {
  const id = String(Array.isArray(req.query.id) ? req.query.id[0] : req.query.id || "").trim();
  const url = String(Array.isArray(req.query.url) ? req.query.url[0] : req.query.url || "").trim();
  const source = url || id;

  try {
    if (!id && !url) return json(res, { error: "請提供 91譜歌曲連結。" }, 400);
    console.info("[song-import] started", { song: songReference(source) });
    const payload = await fetchSongData(source);
    console.info("[song-import] completed", { song: payload.id, sourceLength: payload.sourceText.length });
    return json(res, payload);
  } catch (error) {
    console.error("[song-import] failed", { song: songReference(source), error: error.message || String(error) });
    return json(res, { error: error.message || "匯入失敗" }, 502);
  }
};

function json(res, payload, status = 200) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", status === 200 ? "public, s-maxage=300, stale-while-revalidate=3600" : "no-store");
  res.end(JSON.stringify(payload));
}

function songReference(value) {
  return String(value || "").match(/[0-9a-f]{8}-[0-9a-f-]{27}/i)?.[0] || String(value || "").slice(0, 80);
}
