const crypto = require('node:crypto');
const PIXEL_ID = '1125928203446313';
const allowed = new Set(['PageView', 'Subscribe']);
function sha256(v){return crypto.createHash('sha256').update(v.trim().toLowerCase()).digest('hex');}
module.exports = async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  if(!process.env.META_CAPI_TOKEN) return res.status(503).json({error:'CAPI token not configured'});
  const body = req.body || {};
  if(!allowed.has(body.event_name) || typeof body.event_id!=='string' || !/^(pv_|sub_)[a-zA-Z0-9-]{8,80}$/.test(body.event_id)) return res.status(400).json({error:'Invalid event'});
  const ip = (req.headers['x-forwarded-for']||'').split(',')[0].trim() || req.socket?.remoteAddress || '';
  const ua = req.headers['user-agent']||'';
  const fbp = typeof body.fbp==='string' ? body.fbp.slice(0,200) : '';
  const fbc = typeof body.fbc==='string' ? body.fbc.slice(0,200) : '';
  const url = typeof body.event_source_url==='string' ? body.event_source_url : '';
  // Only accept events originating from this deployment's host.
  let parsed;
  try{parsed=new URL(url);}catch{return res.status(400).json({error:'Invalid URL'});}
  const host = (req.headers['x-forwarded-host']||req.headers.host||'').split(',')[0].trim();
  if(parsed.host!==host || !['https:','http:'].includes(parsed.protocol)) return res.status(403).json({error:'Origin mismatch'});
  const user_data={client_ip_address:ip,client_user_agent:ua};
  if(fbp)user_data.fbp=fbp;
  if(fbc)user_data.fbc=fbc;
  const event={event_name:body.event_name,event_time:Math.floor(Date.now()/1000),event_id:body.event_id,action_source:'website',event_source_url:url,user_data};
  try{
    const endpoint=`https://graph.facebook.com/v25.0/${PIXEL_ID}/events`;
    const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${process.env.META_CAPI_TOKEN}`},body:JSON.stringify({data:[event],...(process.env.META_TEST_EVENT_CODE?{test_event_code:process.env.META_TEST_EVENT_CODE}:{})}),signal:AbortSignal.timeout(5000)});
    const result=await response.json();
    if(!response.ok){console.error('Meta CAPI error',response.status,JSON.stringify(result));return res.status(502).json({error:'Meta CAPI request failed'});}
    return res.status(200).json({ok:true});
  }catch(e){console.error('Meta CAPI network error',e.message);return res.status(502).json({error:'CAPI unavailable'});}
};
