// Tamil Harmonic Trader Raj — Vercel /api/capi
// Set META_CAPI_TOKEN in Vercel. Optional during testing: META_TEST_EVENT_CODE.
const PIXEL_ID = '2129324751124192';
const ALLOWED_EVENTS = new Set(['PageView', 'Subscribe']);

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const token = process.env.META_CAPI_TOKEN;
  if (!token) return res.status(503).json({ error: 'META_CAPI_TOKEN missing' });

  const body = typeof req.body === 'string' ? (() => { try { return JSON.parse(req.body); } catch { return null; } })() : req.body;
  if (!body || !ALLOWED_EVENTS.has(body.event_name) ||
      typeof body.event_id !== 'string' ||
      !/^(pv_|sub_)[a-zA-Z0-9-]{8,80}$/.test(body.event_id) ||
      (body.event_name === 'PageView' && !body.event_id.startsWith('pv_')) ||
      (body.event_name === 'Subscribe' && !body.event_id.startsWith('sub_'))) {
    return res.status(400).json({ error: 'Invalid event name or event_id' });
  }

  let pageUrl;
  try { pageUrl = new URL(body.event_source_url); }
  catch { return res.status(400).json({ error: 'Invalid event_source_url' }); }
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  if (pageUrl.host !== host || !['https:', 'http:'].includes(pageUrl.protocol)) {
    return res.status(403).json({ error: 'Origin mismatch' });
  }

  const user_data = {
    client_ip_address: String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim(),
    client_user_agent: String(req.headers['user-agent'] || '')
  };
  if (typeof body.fbp === 'string' && body.fbp.length <= 200 && body.fbp) user_data.fbp = body.fbp;
  if (typeof body.fbc === 'string' && body.fbc.length <= 200 && body.fbc) user_data.fbc = body.fbc;

  const event = {
    event_name: body.event_name,
    event_time: Math.floor(Date.now() / 1000),
    event_id: body.event_id, // MUST match browser fbq eventID
    action_source: 'website',
    event_source_url: pageUrl.href,
    user_data
  };
  const payload = { data: [event] };
  if (process.env.META_TEST_EVENT_CODE?.trim()) {
    payload.test_event_code = process.env.META_TEST_EVENT_CODE.trim();
  }

  try {
    const response = await fetch(`https://graph.facebook.com/v25.0/${PIXEL_ID}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(7000)
    });
    const result = await response.json();
    if (!response.ok || !result.events_received) {
      console.error('Meta CAPI rejected event:', JSON.stringify({
        event_name: event.event_name, event_id: event.event_id,
        http_status: response.status, error: result.error || result
      }));
      return res.status(502).json({ ok: false, error: 'Meta did not accept event' });
    }
    console.info('Meta CAPI accepted event:', JSON.stringify({
      event_name: event.event_name, event_id: event.event_id,
      events_received: result.events_received,
      test_mode: !!payload.test_event_code,
      fbtrace_id: result.fbtrace_id || null
    }));
    return res.status(200).json({ ok: true, events_received: result.events_received });
  } catch (error) {
    console.error('Meta CAPI request failed:', error.message);
    return res.status(502).json({ ok: false, error: 'CAPI request failed' });
  }
};
