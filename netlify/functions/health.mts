export default async () => {
  return new Response(JSON.stringify({
    ok: true,
    mode: "netlify-functions",
    service: "91pu-piano-score-converter",
    dynamicApis: ["/api/search", "/api/song", "/api/health"],
    generatedAt: new Date().toISOString()
  }), {
    headers: { "content-type": "application/json; charset=utf-8" }
  });
};

export const config = {
  path: "/api/health"
};
