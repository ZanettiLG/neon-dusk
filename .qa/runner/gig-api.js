const fs = require("fs");
const BASE = "http://localhost:3000";

function envKey(key) {
  const txt = fs.readFileSync("C:/Users/luisg/Projects/neon-dusk/server/.env", "utf8");
  const line = txt.split(/\r?\n/).find((l) => l.startsWith(key + "="));
  return line ? line.slice(key.length + 1).trim() : "";
}
const email = envKey("TEST_USER_EMAIL");
const password = envKey("TEST_USER_PASSWORD");

async function req(method, path, body, token) {
  const r = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let j = null;
  try { j = await r.json(); } catch {}
  return { status: r.status, keys: j ? Object.keys(j) : null, body: j };
}

(async () => {
  const out = {};
  const login = await req("POST", "/api/auth/login", { email, password });
  out.login = { status: login.status, keys: login.keys };
  const token = login.body && login.body.accessToken;
  if (!token) { console.log(JSON.stringify(out, null, 2)); return; }

  const board = await req("GET", "/api/gigs", null, token);
  const gigs = board.body && board.body.gigs ? board.body.gigs : [];
  out.board = { status: board.status, gigCount: gigs.length, activeGig: board.body && board.body.activeGig ? "present" : null };
  out.sample = gigs.slice(0, 6).map((g) => ({ id: g.id, name: g.name, tier: g.tier, meetsRequirements: g.meetsRequirements, cooldownRemaining: g.cooldownRemaining }));

  const gig = gigs.find((g) => g.meetsRequirements === true && Number(g.cooldownRemaining) === 0);
  if (!gig) { out.note = "no eligible gig found"; console.log(JSON.stringify(out, null, 2)); return; }
  const templateId = gig.id;
  out.chosen = { id: templateId, name: gig.name, tier: gig.tier };

  const accept = await req("POST", `/api/gigs/${templateId}/accept`, {}, token);
  out.accept = { status: accept.status, error: accept.body && accept.body.error, phase: accept.body && accept.body.activeGig && accept.body.activeGig.phase, nilRemaining: accept.body && accept.body.nilRemaining };

  const execute = await req("POST", `/api/gigs/${templateId}/execute`, {}, token);
  out.execute = { status: execute.status, error: execute.body && execute.body.error, phase: execute.body && execute.body.activeGig && execute.body.activeGig.phase, outcome: execute.body && execute.body.outcome ? execute.body.outcome.success : null, roll: execute.body && execute.body.outcome ? execute.body.outcome.roll : null };

  const executeAgain = await req("POST", `/api/gigs/${templateId}/execute`, {}, token);
  out.executeAgain = { status: executeAgain.status, error: executeAgain.body && executeAgain.body.error, message: executeAgain.body && executeAgain.body.message };

  const escape = await req("POST", `/api/gigs/${templateId}/escape`, {}, token);
  out.escape = { status: escape.status, error: escape.body && escape.body.error, phase: escape.body && escape.body.activeGig && escape.body.activeGig.phase, outcome: escape.body && escape.body.outcome ? escape.body.outcome.success : null, heat: escape.body && escape.body.heatGenerated };

  const wrapup = await req("POST", `/api/gigs/${templateId}/wrapup`, {}, token);
  out.wrapup = { status: wrapup.status, error: wrapup.body && wrapup.body.error, keys: wrapup.keys, outcome: wrapup.body && wrapup.body.outcome, payout: wrapup.body && wrapup.body.payout, streetCredGained: wrapup.body && wrapup.body.streetCredGained, heatAccumulated: wrapup.body && wrapup.body.heatAccumulated, newBalance: wrapup.body && wrapup.body.newBalance };

  console.log(JSON.stringify(out, null, 2));
})();
