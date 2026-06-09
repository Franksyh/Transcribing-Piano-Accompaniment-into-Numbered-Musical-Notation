import {
  extractSongId,
  fetchSongPayload,
  htmlToText,
  normalize91puUrl,
  normalizeBeat,
  parseEncodedJson
} from "./_shared/pu.mts";

export default async (req) => {
  try {
    const url = new URL(req.url);
    const idInput = (url.searchParams.get("id") || "").trim();
    const urlInput = (url.searchParams.get("url") || "").trim();
    const id = extractSongId(idInput || urlInput);

    if (!id) {
      return json({ error: "找不到有效的 91pu 歌曲 ID。" }, 400);
    }

    const referer = normalize91puUrl(urlInput) || `https://www.91pu.com.tw/song/2017/0701/${id}.html`;
    const payload = await fetchSongPayload(id, referer);

    if (payload.done !== "ok") {
      return json({ error: payload.done || "91pu 沒有回傳歌曲資料。" }, 502);
    }

    const decodedTone = parseEncodedJson(payload.tone, 50);
    const decodedBrush = parseEncodedJson(payload.sz, 15);
    const sourceText = htmlToText(decodedTone?.lyric || "");

    return json({
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
    return json({ error: error.message || "Server error" }, 500);
  }
};

export const config = {
  path: "/api/song"
};

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
