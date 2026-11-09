// 用无界面的 Edge 截图检查画面（静音）：node tools/shot.js 输出目录 标签:前进次数 [标签:前进次数 ...]
// 例：node tools/shot.js out/shots start:12 c1:30
// 「标签」也可以是 title（标题画面）。需要本地服务器在 8768 端口（python tools/serve.py 8768）
const { spawn } = require('child_process'), fs = require('fs'), path = require('path'), os = require('os');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9334, URL = 'http://localhost:8768/index.html?mute=1';
const [outDir, ...jobs] = process.argv.slice(2);
const W = +(process.env.W || 1920), H = +(process.env.H || 1080);
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'lycshot-'));
  const br = spawn(EDGE, ['--headless=new', '--mute-audio', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-sync', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, `--window-size=${W},${H}`, URL], { stdio: 'ignore' });
  let ws;
  for (let i = 0; i < 40 && !ws; i++) {
    await sleep(500);
    try { const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); const pg = list.find(t => t.type === 'page' && t.url.includes('localhost:8768')); if (pg) ws = new WebSocket(pg.webSocketDebuggerUrl); } catch (e) { }
  }
  await new Promise(r => ws.onopen = r);
  let id = 0; const pend = {};
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; } };
  const call = (method, params = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = expr => call('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }).then(d => d.result && d.result.result && d.result.result.value);
  await call('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  for (let i = 0; i < 240 && !(await ev(`!!document.querySelector('#loading .click-start')`)); i++) await sleep(500); // 等预读完
  await ev(`document.querySelector('#loading').click()`);
  await sleep(2000);
  for (const job of jobs) {
    const [label, n = '0'] = job.split(':');
    if (label !== 'title') {
      await ev(`__VN.cfg.textSpeed = 100; __VN.jumpTo(${JSON.stringify(label)}); 1`);
      await sleep(2500);
      for (let i = 0; i < +n; i++) {
        await ev(`(() => { const c = document.querySelector('#choices.on button'); if (c) c.click(); else document.getElementById('stage').click(); })()`);
        await sleep(450);
      }
      await sleep(+(process.env.WAIT || 1600));
    }
    const shot = await call('Page.captureScreenshot', { format: 'jpeg', quality: 80 });
    const f = path.join(outDir, `${label}_${n}.jpg`);
    fs.writeFileSync(f, Buffer.from(shot.result.data, 'base64'));
    const info = await ev(`JSON.stringify({ text: document.getElementById('text').textContent.slice(0, 30), sprites: [...document.querySelectorAll('.sprite')].map(s => s.id + ' op=' + getComputedStyle(s).opacity + ' imgs=' + [...s.querySelectorAll('img')].map(i => i.src.split('/').pop() + ':' + i.naturalWidth + ':' + getComputedStyle(i).opacity).join(',')), cg: getComputedStyle(document.getElementById('layer-cg')).opacity + ' ' + [...document.querySelectorAll('#layer-cg .bg-img')].map(e => e.style.backgroundImage + ' ' + getComputedStyle(e).opacity).join(' | ') })`);
    console.log(f, info);
  }
  ws.close(); br.kill();
})();
