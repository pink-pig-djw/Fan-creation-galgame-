// 用无界面的 Edge 把全部结局自动跑一遍（静音，后台不降速）：node tools/headless.js
// 需要本地服务器在 8767 端口（python tools/serve.py 8767）
const { spawn } = require('child_process'), fs = require('fs'), path = require('path'), os = require('os');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9333, URL = 'http://localhost:8767/index.html?mute=1';
const ROUTES = {
  TRUE: [0, 1, 1, 1, 1, 0, 2, 1, 1], NORMAL: [0, 1, 0, 1, 1, 0, 2, 1, 1], ROOM: [0, 1, 1, 0], TARGET: [0, 1, 1, 1, 1, 0, 0],
  TARGET2: [0, 1, 1, 1, 1, 0, 1], HOME: [0, 1, 1, 1, 1, 0, 2, 0], TURBID: [1, 0, 1, 1, 0, 2, 2, 1, 0]
};
const only = process.argv.slice(2);
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'p49-'));
  const br = spawn(EDGE, ['--headless=new', '--mute-audio', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-sync', '--disable-features=msEdgeSyncConsent,EdgeSync', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, '--window-size=1280,720', URL], { stdio: 'ignore' });
  let ws;
  for (let i = 0; i < 40 && !ws; i++) {
    await sleep(500);
    try { const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); const pg = list.find(t => t.type === 'page' && t.url.includes('localhost:8767')); if (pg) ws = new WebSocket(pg.webSocketDebuggerUrl); } catch (e) { }
  }
  await new Promise(r => ws.onopen = r);
  let id = 0; const pend = {};
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; } };
  const ev = expr => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression: expr, awaitPromise: true, returnByValue: true } })); }).then(d => d.result && d.result.result && d.result.result.value);
  await sleep(3000);
  await ev(`document.querySelector('#loading').click()`);
  await sleep(1500);
  await ev(`fetch('tools/auto.js?'+Date.now()).then(r=>r.text()).then(eval)`);
  for (const [name, picks] of Object.entries(ROUTES)) {
    if (only.length && !only.includes(name)) continue;
    const t0 = Date.now();
    await ev(`window.__autoDone=null; __auto({ from: 'title', picks: ${JSON.stringify(picks)} }); 1`);
    let done = null;
    while (!done && Date.now() - t0 < 30 * 60 * 1000) { await sleep(2000); done = await ev(`window.__autoDone ? JSON.stringify({ log: __autoLog, err: __autoErr.filter(e => !/404|Failed to load/.test(e)) }) : null`); }
    const r = done ? JSON.parse(done) : { log: ['TIMEOUT'], err: [] };
    const end = r.log.filter(l => /^ENDING|^TITLE|^missing|^TEXT UNDER/.test(l));
    console.log(`${name.padEnd(8)} ${((Date.now() - t0) / 1000 | 0)}s  ${end.join(' | ').replace(/vars=\{.*?\}/, m => m.slice(0, 60))}  errors: ${r.err.length ? r.err.slice(0, 3).join(' / ') : 0}`);
  }
  ws.close(); br.kill();
})();
