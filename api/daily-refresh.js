// Called once a day by Vercel Cron (see vercel.json). Triggers a fresh production build through a Deploy Hook,
// which refetches auctions, news, videos and TLD data and rebuilds every page.
// Needs two environment variables: CRON_SECRET (Vercel sends it as a Bearer token) and DEPLOY_HOOK_URL.
module.exports = async (req, res) => {
  const send = (code, body) => {
    res.statusCode = code;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(body));
  };
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) return send(401, { ok: false });
  const hook = process.env.DEPLOY_HOOK_URL;
  if (!hook) return send(200, { ok: false, reason: 'DEPLOY_HOOK_URL is not set' });
  try {
    const r = await fetch(hook, { method: 'POST' });
    return send(r.ok ? 200 : 502, { ok: r.ok, status: r.status, at: new Date().toISOString() });
  } catch (e) {
    return send(502, { ok: false, error: String(e) });
  }
};
