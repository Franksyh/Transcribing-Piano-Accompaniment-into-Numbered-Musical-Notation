const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { URL } = require("node:url");

const PORT = Number(process.env.PORT || 5173);
const PUBLIC_DIR = path.join(__dirname, "public");
const MAIN_HTML = "91吉他譜 ➜ 鋼琴雙模簡譜智能轉換器.html";
const BASE_91PU = "https://www.91pu.com.tw";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".ico": "image/x-icon"
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === "/api/search") {
      await handleSearch(url, res);
      return;
    }

    if (url.pathname === "/api/song") {
      await handleSong(url, res);
      return;
    }

    if (url.pathname === "/api/health") {
      handleHealth(res);
      return;
    }

    await serveStatic(url.pathname, res);
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Server error" });
  }
});

server.listen(PORT, () => {
  console.log(`鋼琴雙模簡譜轉換器已啟動：http://localhost:${PORT}`);
});

async function handleSearch(url, res) {
  const keyword = (url.searchParams.get("q") || "").trim();
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 500), 1), 500);
  const pageSize = 100;

  if (!keyword) {
    sendJson(res, 400, { error: "請輸入歌曲或歌手名稱。" });
    return;
  }

  const firstHtml = await fetchSearchPage(keyword, 1, pageSize);
  const total = parseTotalResults(firstHtml);
  const firstResults = parseSearchResults(firstHtml);
  const totalPages = Math.max(1, Math.ceil((total || firstResults.length) / pageSize));
  const pagesToFetch = Math.min(totalPages, Math.ceil(limit / pageSize));

  const pageHtmlList = [firstHtml];
  if (pagesToFetch > 1) {
    const rest = await Promise.all(
      Array.from({ length: pagesToFetch - 1 }, (_, index) => fetchSearchPage(keyword, index + 2, pageSize))
    );
    pageHtmlList.push(...rest);
  }

  const seen = new Set();
  const results = pageHtmlList
    .flatMap((html) => parseSearchResults(html))
    .filter((item) => {
      if (!item.id || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .slice(0, limit);

  sendJson(res, 200, {
    keyword,
    total: total || results.length,
    fetched: results.length,
    complete: !total || results.length >= total,
    results
  });
}

async function handleSong(url, res) {
  const idInput = (url.searchParams.get("id") || "").trim();
  const urlInput = (url.searchParams.get("url") || "").trim();
  const id = extractSongId(idInput || urlInput);

  if (!id) {
    sendJson(res, 400, { error: "找不到有效的 91pu 歌曲 ID。" });
    return;
  }

  const referer = normalize91puUrl(urlInput) || `${BASE_91PU}/song/2017/0701/${id}.html`;
  const body = new URLSearchParams({
    dopost: "ajax",
    action: "getinfo",
    itype: "big5Kk.wei",
    id
  });

  const responseText = await fetchText(`${BASE_91PU}/91pubig5/song_ajax.php`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=utf-8",
      referer,
      "user-agent": "Mozilla/5.0"
    },
    body
  });

  let payload;
  try {
    payload = JSON.parse(responseText.replace(/^\uFEFF/, ""));
  } catch {
    sendJson(res, 502, { error: "91pu 回傳格式無法解析。" });
    return;
  }

  if (payload.done !== "ok") {
    sendJson(res, 502, { error: payload.done || "91pu 沒有回傳歌曲資料。" });
    return;
  }

  const decodedTone = parseEncodedJson(payload.tone, 50);
  const decodedBrush = parseEncodedJson(payload.sz, 15);
  const sourceText = htmlToText(decodedTone?.lyric || "");

  sendJson(res, 200, {
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
}

function handleHealth(res) {
  sendJson(res, 200, {
    ok: true,
    mode: "local-node",
    service: "91pu-piano-score-converter",
    dynamicApis: ["/api/search", "/api/song", "/api/health"],
    generatedAt: new Date().toISOString()
  });
}

async function fetchSearchPage(keyword, pageNo, pageSize) {
  const searchUrl = new URL("/plus/search.php", BASE_91PU);
  searchUrl.searchParams.set("keyword", keyword);
  searchUrl.searchParams.set("pagesize", String(pageSize));
  searchUrl.searchParams.set("PageNo", String(pageNo));
  return fetchText(searchUrl, {
    headers: { "user-agent": "Mozilla/5.0" }
  });
}

async function serveStatic(requestPath, res) {
  const cleanPath = decodeURIComponent(requestPath.split("?")[0]);
  const targetPath = cleanPath === "/" ? `/${MAIN_HTML}` : cleanPath;
  const filePath = path.normalize(path.join(PUBLIC_DIR, targetPath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    sendText(res, 404, "Not found");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { "content-type": mimeTypes[ext] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`連線失敗：${response.status} ${response.statusText}`);
  }
  return response.text();
}

function parseSearchResults(html) {
  const tbody = html.match(/<tbody[^>]*id=["']songlist["'][^>]*>([\s\S]*?)<\/tbody>/i)?.[1] || "";
  const rows = tbody.match(/<tr[\s\S]*?<\/tr>/gi) || [];

  return rows.map((row) => {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => match[1]);
    const href = cells[0]?.match(/href=["']([^"']+)["']/i)?.[1] || "";
    const absoluteUrl = normalize91puUrl(href);
    const id = extractSongId(absoluteUrl);

    return {
      id,
      title: stripHtml(cells[0] || ""),
      artist: stripHtml(cells[1] || ""),
      lyricist: stripHtml(cells[2] || ""),
      composer: stripHtml(cells[3] || ""),
      views: Number(stripHtml(cells[4] || "0").replace(/[^\d]/g, "")) || 0,
      url: absoluteUrl
    };
  }).filter((item) => item.id && item.title);
}

function parseTotalResults(html) {
  const totalText = html.match(/有\s*<code>\s*(\d+)\s*<\/code>\s*個結果/i)?.[1]
    || html.match(/TotalResult=(\d+)/i)?.[1];
  return Number(totalText || 0) || 0;
}

function extractSongId(input) {
  if (!input) return "";
  const text = String(input);
  const direct = text.match(/^\d+$/)?.[0];
  if (direct) return direct;
  return text.match(/\/song\/(?:\d+\/){2}(\d+)\.html/i)?.[1]
    || text.match(/[?&]id=(\d+)/i)?.[1]
    || text.match(/(\d{3,})/)?.[1]
    || "";
}

function normalize91puUrl(input) {
  if (!input) return "";
  if (String(input).startsWith("http")) return String(input);
  if (String(input).startsWith("/")) return `${BASE_91PU}${input}`;
  return `${BASE_91PU}/${input}`;
}

function parseEncodedJson(value, interval) {
  const decoded = decode91Payload(value, interval);
  if (!decoded) return null;
  try {
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function decode91Payload(value, interval) {
  if (!value || !String(value).startsWith("B:")) return value || "";

  let text = String(value).slice(2);
  const prefixLength = Number(text.slice(0, 3));
  text = text.slice(3);
  text = text.slice(1);

  let base64 = "";
  if (prefixLength > 0) {
    base64 = text.slice(0, prefixLength);
    text = text.slice(prefixLength + 1);
  }

  while (text.length > 0) {
    base64 = text.slice(0, interval) + base64;
    text = text.slice(interval + 1);
  }

  return Buffer.from(base64, "base64").toString("utf8");
}

function htmlToText(html) {
  return decodeEntities(String(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim());
}

function stripHtml(html) {
  return decodeEntities(String(html)
    .replace(/<[^>]+>/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim());
}

function decodeEntities(text) {
  const named = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " " };
  return String(text)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (_, name) => named[name] || `&${name};`);
}

function normalizeBeat(value) {
  const beat = String(value || "").match(/\d+\s*\/\s*\d+/)?.[0];
  return beat ? beat.replace(/\s+/g, "") : "4/4";
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function sendText(res, status, text) {
  res.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
  res.end(text);
}
