// .qa/cdp-boot-test.mjs — headless CDP: boot + login attempt
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const RUN_ID = 'nd-20260816-120000-dev-startup-fix';
const SHOT_DIR = path.join(REPO, '.qa', 'screenshots', RUN_ID);
const LOG_DIR = path.join(REPO, '.qa', 'logs', RUN_ID);
fs.mkdirSync(SHOT_DIR, { recursive: true });
fs.mkdirSync(LOG_DIR, { recursive: true });

const APP = 'http://localhost:5173';
const EMAIL = 'zanetti@zan.ia.br';
const PASS = 'Zan12345';
const DEBUG_PORT = 9224;

const CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];
const browserPath = CANDIDATES.find(p => fs.existsSync(p));
if (!browserPath) { console.error('NO_BROWSER_FOUND'); process.exit(2); }

const profile = path.join(LOG_DIR, 'cdp-boot-profile');
fs.rmSync(profile, { recursive: true, force: true });

const proc = spawn(browserPath, [
  '--headless=new',
  `--remote-debugging-port=${DEBUG_PORT}`,
  `--user-data-dir=${profile}`,
  '--no-first-run',
  '--disable-gpu',
  '--window-size=1280,720',
  'about:blank',
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getPageWs() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
      const targets = await res.json();
      const page = targets.find(t => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(500);
  }
  throw new Error('CDP page target not found');
}

const wsUrl = await getPageWs();
const ws = new WebSocket(wsUrl);
let msgId = 0;
const pending = new Map();
const consoleErrors = [];
const jsExceptions = [];
const requests = [];   // {method,url}
const responses = [];  // {method,url,status}

ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
    return;
  }
  if (m.method === 'Runtime.consoleAPICalled') {
    const type = m.params.type;
    if (type === 'error' || type === 'warning') {
      const text = m.params.args.map(a => a.value ?? a.description ?? '').join(' ');
      consoleErrors.push({ type, text });
    }
  } else if (m.method === 'Runtime.exceptionThrown') {
    jsExceptions.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text ?? 'exception');
  } else if (m.method === 'Network.requestWillBeSent') {
    const u = m.params.request.url;
    if (u.includes('/api/')) requests.push({ method: m.params.request.method, url: u });
  } else if (m.method === 'Network.responseReceived') {
    const u = m.params.response.url;
    if (u.includes('/api/')) responses.push({ method: m.params.response.requestHeaders?.[':method'] ?? '', url: u, status: m.params.response.status });
  }
});

await new Promise((resolve, reject) => { ws.addEventListener('open', resolve); ws.addEventListener('error', reject); });

function send(method, params = {}) {
  const id = ++msgId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evalJS(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'eval error');
  return r.result?.value;
}
async function waitFor(expr, timeoutMs = 15000, label = expr) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { if (await evalJS(expr)) return true; } catch {}
    await sleep(300);
  }
  throw new Error('waitFor timeout: ' + label);
}
async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(SHOT_DIR, `${name}.png`), Buffer.from(r.data, 'base64'));
}
async function nav(url) {
  await send('Page.navigate', { url });
  await waitFor(`document.readyState === 'complete'`, 10000, 'load');
  await sleep(2000);
}

await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');

// 1. Boot login page
await nav(APP + '/login');
const rendered = await evalJS(`!!document.querySelector('input[type=email]')`);
await shot('01-login-page');
console.log('BOOT_RENDERED=' + rendered);

// 2. Fill + submit login
await evalJS(`(() => {
  const setVal = (el, v) => { const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
  const e = document.querySelector('input[type=email]'); setVal(e, ${JSON.stringify(EMAIL)});
  const p = document.querySelector('input[type=password]'); setVal(p, ${JSON.stringify(PASS)});
  return true;
})()`);
await shot('02-login-filled');
await evalJS(`(() => { const b = [...document.querySelectorAll('button')].find(x => /entrar/i.test(x.textContent)); if (!b) return false; b.click(); return true; })()`);

// 3. Wait for either an error message or a redirect
let outcome = 'unknown';
try {
  await waitFor(`location.pathname !== '/login'`, 12000, 'redirect after login');
  outcome = 'redirected:' + (await evalJS('location.pathname'));
} catch {
  outcome = 'no-redirect';
}
await sleep(1500);
const bodyText = await evalJS(`document.body.innerText.slice(0, 600)`);
await shot('03-after-login-attempt');
console.log('LOGIN_OUTCOME=' + outcome);
console.log('PAGE_TEXT=' + JSON.stringify(bodyText));

// 4. Wait a moment more for any late console errors
await sleep(1500);

console.log('CONSOLE_ERRORS=' + JSON.stringify(consoleErrors));
console.log('JS_EXCEPTIONS=' + JSON.stringify(jsExceptions));
console.log('API_REQUESTS=' + JSON.stringify(requests));
console.log('API_RESPONSES=' + JSON.stringify(responses));

fs.writeFileSync(path.join(LOG_DIR, 'cdp-boot-report.json'), JSON.stringify({ consoleErrors, jsExceptions, requests, responses, pageText: bodyText }, null, 2));
console.log('REPORT_SAVED=' + path.join(LOG_DIR, 'cdp-boot-report.json'));

ws.close();
proc.kill();
process.exit(0);
