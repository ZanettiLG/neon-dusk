// .qa/api-walkthrough.mjs — live API walkthrough of the gig state machine
const BASE = 'http://localhost:3000';
const EMAIL = 'zanetti@zan.ia.br';
const PASS = 'Zan12345';

let token = '';
async function req(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
}
function line(step, status, summary) {
  console.log(`${step} => HTTP ${status} | ${summary}`);
}

// 1. login
let r = await req('POST', '/api/auth/login', { email: EMAIL, password: PASS });
token = r.json?.accessToken;
line('login', r.status, `token=${token ? 'ok' : 'MISSING'}`);

// 2. me
r = await req('GET', '/api/auth/me');
const char = r.json?.character;
line('me', r.status, `character=${char?.name ?? 'none'} nil=${char?.nil ?? '?'} eddies=${char?.eddies ?? '?'} sc=${char?.street_cred ?? '?'}`);

// 3. board
r = await req('GET', '/api/gigs');
const gigs = r.json?.gigs ?? [];
const active0 = r.json?.activeGig;
line('gigs', r.status, `count=${gigs.length} activeGig=${active0 ? active0.phase : 'null'}`);
const t1 = gigs.filter(g => g.tier === 't1' && g.meetsRequirements);
const g1 = t1[0];
const g2 = t1.find(g => g.id !== g1?.id) ?? t1[1];
if (!g1) { console.log('NO_T1_GIG_AVAILABLE'); process.exit(3); }
line('pick', 0, `g1=${g1.id} (${g1.name}, nilCost=${g1.nilCost}) g2=${g2?.id ?? 'none'}`);

// 4. accept g1
r = await req('POST', `/api/gigs/${g1.id}/accept`, {});
line('accept g1', r.status, `phase=${r.json?.activeGig?.phase ?? r.json?.error} nilRemaining=${r.json?.nilRemaining ?? '?'}`);

// 5. double-accept g1 -> expect ALREADY_ACTIVE_GIG
r = await req('POST', `/api/gigs/${g1.id}/accept`, {});
line('double-accept g1', r.status, `error=${r.json?.error ?? 'none'}`);

// 6. execute direct (meet -> skip legwork)
r = await req('POST', `/api/gigs/${g1.id}/execute`, {});
line('execute g1 (direct)', r.status, `phase=${r.json?.activeGig?.phase} outcome=${r.json?.outcome?.success} roll=${r.json?.outcome?.roll?.toFixed?.(3)}`);

// 7. double-execute g1 -> expect INVALID_PHASE_TRANSITION
r = await req('POST', `/api/gigs/${g1.id}/execute`, {});
line('double-execute g1', r.status, `error=${r.json?.error ?? 'none'}`);

// 8. escape g1
r = await req('POST', `/api/gigs/${g1.id}/escape`, {});
line('escape g1', r.status, `phase=${r.json?.activeGig?.phase} outcome=${r.json?.outcome?.success} heat=${r.json?.heatGenerated}`);

// 9. double-escape g1 (idempotent) -> 200, roll=-1 sentinel
r = await req('POST', `/api/gigs/${g1.id}/escape`, {});
line('double-escape g1', r.status, `phase=${r.json?.activeGig?.phase} rollSentinel=${r.json?.outcome?.roll}`);

// 10. wrapup g1
r = await req('POST', `/api/gigs/${g1.id}/wrapup`, {});
line('wrapup g1', r.status, `outcome=${r.json?.outcome} payout=${r.json?.payout} scGained=${r.json?.streetCredGained} heat=${r.json?.heatAccumulated} balance=${r.json?.newBalance}`);

// 11. double-wrapup g1 -> expect NO_ACTIVE_GIG (404)
r = await req('POST', `/api/gigs/${g1.id}/wrapup`, {});
line('double-wrapup g1', r.status, `error=${r.json?.error ?? 'none'}`);

if (g2) {
  // 12. accept g2
  r = await req('POST', `/api/gigs/${g2.id}/accept`, {});
  line('accept g2', r.status, `phase=${r.json?.activeGig?.phase ?? r.json?.error}`);

  // 13. out-of-order: wrapup from meet -> expect INVALID_PHASE_TRANSITION
  r = await req('POST', `/api/gigs/${g2.id}/wrapup`, {});
  line('wrapup-from-meet g2 (out of order)', r.status, `error=${r.json?.error ?? 'none'}`);

  // 14. legwork g2
  r = await req('POST', `/api/gigs/${g2.id}/legwork`, {});
  line('legwork g2', r.status, `phase=${r.json?.phase ?? r.json?.error}`);

  // 15. execute during legwork timer -> expect LEGWORK_IN_PROGRESS
  r = await req('POST', `/api/gigs/${g2.id}/execute`, {});
  line('execute-during-legwork g2', r.status, `error=${r.json?.error ?? 'none'}`);

  // 16. abandon g2
  r = await req('POST', `/api/gigs/${g2.id}/abandon`, {});
  line('abandon g2', r.status, `outcome=${r.json?.outcome ?? r.json?.error}`);

  // 17. double-abandon g2 -> expect NO_ACTIVE_GIG
  r = await req('POST', `/api/gigs/${g2.id}/abandon`, {});
  line('double-abandon g2', r.status, `error=${r.json?.error ?? 'none'}`);
}

// 18. final board state
r = await req('GET', '/api/gigs');
line('final board', r.status, `activeGig=${r.json?.activeGig ? r.json.activeGig.phase : 'null'}`);

// 19. history
r = await req('GET', '/api/gigs/history');
line('history', r.status, `entries=${r.json?.history?.length} outcomes=${(r.json?.history ?? []).map(h => h.outcome).join(',')}`);
