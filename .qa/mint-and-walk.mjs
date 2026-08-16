// .qa/mint-and-walk.mjs — mint a valid JWT for the seeded test user and walk the gig state machine
import { createHmac } from 'node:crypto';

const BASE = 'http://localhost:3000';
const EMAIL = 'zanetti@zan.ia.br';
const USER_ID = process.env.USER_ID;
const SECRET = 'change-me-generate-a-random-32-byte-hex-string-here';

function b64url(o) { return Buffer.from(JSON.stringify(o)).toString('base64url'); }
function mint(secret, payload) {
  const h = b64url({ alg: 'HS256', typ: 'JWT' });
  const p = b64url(payload);
  const sig = createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${sig}`;
}
if (!USER_ID) { console.error('USER_ID missing'); process.exit(2); }
const now = Math.floor(Date.now() / 1000);
const token = mint(SECRET, { sub: USER_ID, email: EMAIL, role: 'player', iat: now, exp: now + 900 });
console.log('MINTED_TOKEN length=' + token.length);

async function req(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
}
function line(step, status, summary) { console.log(`${step} => HTTP ${status} | ${summary}`); }

// me
let r = await req('GET', '/api/auth/me');
const char = r.json?.character;
line('me', r.status, `character=${char?.name ?? 'none'} nil=${char?.nil ?? '?'} eddies=${char?.eddies ?? '?'} sc=${char?.street_cred ?? '?'}`);

// board
r = await req('GET', '/api/gigs');
const gigs = r.json?.gigs ?? [];
const active0 = r.json?.activeGig;
line('gigs', r.status, `count=${gigs.length} activeGig=${active0 ? active0.phase : 'null'}`);
const t1 = gigs.filter(g => g.tier === 't1' && g.meetsRequirements);
const g1 = t1[0];
const g2 = t1.find(g => g.id !== g1?.id) ?? t1[1];
if (!g1) { console.log('NO_T1_GIG_AVAILABLE'); process.exit(3); }
line('pick', 0, `g1=${g1.id} (${g1.name}, nilCost=${g1.nilCost}) g2=${g2?.id ?? 'none'}`);

// accept g1
r = await req('POST', `/api/gigs/${g1.id}/accept`, {});
line('accept g1', r.status, `phase=${r.json?.activeGig?.phase ?? r.json?.error} nilRemaining=${r.json?.nilRemaining ?? '?'}`);

// double-accept g1 -> expect ALREADY_ACTIVE_GIG
r = await req('POST', `/api/gigs/${g1.id}/accept`, {});
line('double-accept g1', r.status, `error=${r.json?.error ?? 'none'}`);

// execute direct (meet -> skip legwork)
r = await req('POST', `/api/gigs/${g1.id}/execute`, {});
line('execute g1 (direct)', r.status, `phase=${r.json?.activeGig?.phase} outcome=${r.json?.outcome?.success} roll=${r.json?.outcome?.roll?.toFixed?.(3)}`);

// double-execute g1 -> expect INVALID_PHASE_TRANSITION
r = await req('POST', `/api/gigs/${g1.id}/execute`, {});
line('double-execute g1', r.status, `error=${r.json?.error ?? 'none'}`);

// escape g1
r = await req('POST', `/api/gigs/${g1.id}/escape`, {});
line('escape g1', r.status, `phase=${r.json?.activeGig?.phase} outcome=${r.json?.outcome?.success} heat=${r.json?.heatGenerated}`);

// double-escape g1 (idempotent) -> 200, roll=-1 sentinel
r = await req('POST', `/api/gigs/${g1.id}/escape`, {});
line('double-escape g1', r.status, `phase=${r.json?.activeGig?.phase} rollSentinel=${r.json?.outcome?.roll}`);

// wrapup g1
r = await req('POST', `/api/gigs/${g1.id}/wrapup`, {});
line('wrapup g1', r.status, `outcome=${r.json?.outcome} payout=${r.json?.payout} scGained=${r.json?.streetCredGained} heat=${r.json?.heatAccumulated} balance=${r.json?.newBalance}`);

// double-wrapup g1 -> expect NO_ACTIVE_GIG (404)
r = await req('POST', `/api/gigs/${g1.id}/wrapup`, {});
line('double-wrapup g1', r.status, `error=${r.json?.error ?? 'none'}`);

if (g2) {
  r = await req('POST', `/api/gigs/${g2.id}/accept`, {});
  line('accept g2', r.status, `phase=${r.json?.activeGig?.phase ?? r.json?.error}`);
  r = await req('POST', `/api/gigs/${g2.id}/wrapup`, {});
  line('wrapup-from-meet g2 (out of order)', r.status, `error=${r.json?.error ?? 'none'}`);
  r = await req('POST', `/api/gigs/${g2.id}/legwork`, {});
  line('legwork g2', r.status, `phase=${r.json?.phase ?? r.json?.error}`);
  r = await req('POST', `/api/gigs/${g2.id}/execute`, {});
  line('execute-during-legwork g2', r.status, `error=${r.json?.error ?? 'none'}`);
  r = await req('POST', `/api/gigs/${g2.id}/abandon`, {});
  line('abandon g2', r.status, `outcome=${r.json?.outcome ?? r.json?.error}`);
  r = await req('POST', `/api/gigs/${g2.id}/abandon`, {});
  line('double-abandon g2', r.status, `error=${r.json?.error ?? 'none'}`);
}

r = await req('GET', '/api/gigs');
line('final board', r.status, `activeGig=${r.json?.activeGig ? r.json.activeGig.phase : 'null'}`);

r = await req('GET', '/api/gigs/history');
line('history', r.status, `entries=${r.json?.history?.length} outcomes=${(r.json?.history ?? []).map(h => h.outcome).join(',')}`);
