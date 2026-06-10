const {
  fetchSearchPage,
  parseSearchResults,
  parseTotalResults
} = require("./_shared/pu");

module.exports = async function handler(req, res) {
  try {
    const keyword = String(firstQueryValue(req.query.q) || "").trim();
    const limit = Math.min(Math.max(Number(firstQueryValue(req.query.limit) || 500), 1), 500);
    const pageSize = 100;

    if (!keyword) {
      return json(res, { error: "請輸入歌曲或歌手名稱。" }, 400);
    }

    const firstHtml = await fetchSearchPage(keyword, 1, pageSize);
    const total = parseTotalResults(firstHtml);
    const totalPages = Math.max(1, Math.ceil((total || parseSearchResults(firstHtml).length) / pageSize));
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

    return json(res, {
      keyword,
      total: total || results.length,
      fetched: results.length,
      complete: !total || results.length >= total,
      results
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
