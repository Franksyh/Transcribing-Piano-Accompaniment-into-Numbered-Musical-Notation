const BASE_91PU = "https://www.91pu.com.tw";
const UUID_PATTERN = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

export async function searchSongs(keyword, limit = 100) {
  const url = new URL("/api/search/search", BASE_91PU);
  url.searchParams.set("keyword", keyword);
  url.searchParams.set("size", String(Math.min(Math.max(limit, 1), 100)));
  url.searchParams.set("searchType", "song");
  const payload = await fetchJson(url);
  const results = (payload.list || []).filter((item) => item.doc_type === "song").map(mapSearchResult);
  return { total: Number(payload.pager?.total_count || results.length), results };
}

export async function fetchSongData(idOrUrl) {
  const id = await resolveSongId(idOrUrl);
  if (!id) throw new Error("請貼上有效的 91譜歌曲連結，或從搜尋結果點選匯入。");
  const info = await fetchJson(`${BASE_91PU}/api/song/${id}/info`);
  const song = info.song || {};
  const sheets = [...(song.sheets || [])]
    .filter((item) => item?.id && item?.type)
    .sort((left, right) => Number(right.type === "guitar") - Number(left.type === "guitar") || Number(Boolean(right.is_default)) - Number(Boolean(left.is_default)));
  if (!sheets.length) throw new Error("這首歌沒有可讀取的公開和弦譜。");

  let lastError;
  for (const sheet of sheets) {
    try {
      const sheetPayload = await fetchJson(`${BASE_91PU}/api/song/${id}/sheet/${sheet.type}/${sheet.id}`);
      const sheetData = sheetPayload.sheet?.sheet_data || {};
      const sourceText = (sheetData.content?.chord?.parse || []).map((line) => line.content || "").filter(Boolean).join("\n");
      if (!sourceText) throw new Error(`譜別 ${sheet.id} 沒有公開和弦內容。`);
      const tonalities = sheetData.tonalities || {};
      const original = tonalities.list?.find((item) => item.is_default)?.sheet_key?.[0]?.key || "";
      const playKey = tonalities.editorKey?.[0]?.key || original;
      return {
        id, title: song.title || "", artist: names(song.singers), lyricist: names(song.lyricists), composer: names(song.composers),
        originalKey: original, playKey, tempo: String(sheetData.rhythm?.bpm || ""),
        beat: Array.isArray(sheetData.rhythm?.measure) ? sheetData.rhythm.measure.join("/") : "4/4",
        sourceText, brush: sheetData.rhythm?.strums?.length ? { count: sheetData.rhythm.strums.length } : null,
        url: `${BASE_91PU}/sheet/song/${id}`
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("這首歌沒有可讀取的公開和弦譜。");
}

export async function resolveSongId(input) {
  const raw = String(input || "").trim();
  if (new RegExp(`^${UUID_PATTERN}$`, "i").test(raw)) return raw;
  const direct = raw.match(new RegExp(`/sheet/song/(${UUID_PATTERN})`, "i"))?.[1];
  if (direct) return direct;
  const safeUrl = normalize91puUrl(raw);
  if (!safeUrl) return "";
  const response = await fetch(safeUrl, { headers: { "user-agent": "Mozilla/5.0" }, redirect: "follow" });
  return response.url.match(new RegExp(`/sheet/song/(${UUID_PATTERN})`, "i"))?.[1] || "";
}

function mapSearchResult(item) { return { id: item.id, title: item.title || "", artist: names(item.singers), lyricist: names(item.lyricists), composer: names(item.composers), views: 0, url: `${BASE_91PU}/sheet/song/${item.id}` }; }
async function fetchJson(url) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          accept: "application/json",
          "accept-language": "zh-TW,zh;q=0.9,en;q=0.8",
          referer: `${BASE_91PU}/`,
          "user-agent": "Mozilla/5.0"
        },
        signal: AbortSignal.timeout(8000)
      });
      if (response.ok) return response.json();
      lastError = new Error(`91譜資料讀取失敗：${response.status}`);
      if (![408, 429, 500, 502, 503, 504].includes(response.status)) throw lastError;
    } catch (error) {
      lastError = error;
    }
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
  }
  throw lastError || new Error("91譜資料讀取失敗，請稍後再試。");
}
function normalize91puUrl(input) { try { const url = new URL(String(input), BASE_91PU); return /(^|\.)91pu\.com\.tw$/i.test(url.hostname) ? url.toString() : ""; } catch { return ""; } }
function names(items) { return (items || []).map((item) => String(item.name || "").trim()).filter(Boolean).join(" / "); }
