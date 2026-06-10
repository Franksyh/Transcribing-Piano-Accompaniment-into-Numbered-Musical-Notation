const {
  extractSongId,
  fetchSongPayload,
  htmlToText,
  normalize91puUrl,
  normalizeBeat,
  parseEncodedJson
} = require("./_shared/pu");

module.exports = async function handler(req, res) {
  try {
    const idInput = String(firstQueryValue(req.query.id) || "").trim();
    const urlInput = String(firstQueryValue(req.query.url) || "").trim();
    const id = extractSongId(idInput || urlInput);

    if (!id) {
      return json(res, { error: "找不到有效的 91pu 歌曲 ID。" }, 400);
    }

    const referer = normalize91puUrl(urlInput) || `https://www.91pu.com.tw/song/2017/0701/${id}.html`;
    const payload = await fetchSongPayload(id, referer);

    if (payload.done !== "ok") {
      return json(res, { error: payload.done || "91pu 沒有回傳歌曲資料。" }, 502);
    }

    const decodedTone = parseEncodedJson(payload.tone, 50);
    const decodedBrush = parseEncodedJson(payload.sz, 15);
    const sourceText = htmlToText(decodedTone?.lyric || "");

    return json(res, {
      id,
      title: payload.name || "",
      artist: payload.singer || "",
      lyricist: payload.lyrc || "",
      composer: payload.tune || "",
      originalKey: payload.originkey || decodedTone?.org?.k || "",
      playKey: decodedTone?.key?.k || payload.formantone || payload.originkey || "",
      maleKey: payload.formantone || "",
      femaleKey: payload.forgirltone || "",
      tempo: payload.tempo || "",
      beat: normalizeBeat(payload.style || ""),
      sourceText,
      brush: decodedBrush || null,
      url: referer
    });
  } catch (error) {
    return json(res, { error: error.message || "Server error" }, 500);
  }
};

function firstQueryValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function json(res, payload, status = 200) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(payload));
}
