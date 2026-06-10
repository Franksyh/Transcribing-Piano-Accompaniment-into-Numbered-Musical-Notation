const BASE_91PU = "https://www.91pu.com.tw";

async function fetchSearchPage(keyword, pageNo, pageSize) {
  const searchUrl = new URL("/plus/search.php", BASE_91PU);
  searchUrl.searchParams.set("keyword", keyword);
  searchUrl.searchParams.set("pagesize", String(pageSize));
  searchUrl.searchParams.set("PageNo", String(pageNo));
  return fetchText(searchUrl, {
    headers: { "user-agent": "Mozilla/5.0" }
  });
}

async function fetchSongPayload(id, referer) {
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

  return JSON.parse(responseText.replace(/^\uFEFF/, ""));
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

function normalizeBeat(value) {
  const beat = String(value || "").match(/\d+\s*\/\s*\d+/)?.[0];
  return beat ? beat.replace(/\s+/g, "") : "4/4";
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

module.exports = {
  extractSongId,
  fetchSearchPage,
  fetchSongPayload,
  htmlToText,
  normalize91puUrl,
  normalizeBeat,
  parseEncodedJson,
  parseSearchResults,
  parseTotalResults
};
