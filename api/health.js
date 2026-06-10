module.exports = async function handler(_req, res) {
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify({
    ok: true,
    mode: "vercel-functions",
    service: "91pu-piano-score-converter",
    dynamicApis: ["/api/search", "/api/song", "/api/health"],
    collaboration: "peerjs-room-sync",
    generatedAt: new Date().toISOString()
  }));
};
