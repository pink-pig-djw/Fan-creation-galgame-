// 分支图截图（静音、无界面 Edge）：node tools/flowshot.js 输出.jpg [all|half] [滚动x]
// 环境变量：W / H = 窗口大小，HOVER = 悬停的节点 id，CLICK = 点击的节点 id，MOBILE=1 = 手机界面
// all = 全部节点当作已看过；half = 只看过前一半（检查「？？？」的样子）。需要本地服务器在 8768 端口
const { spawn } = require('child_process'), fs = require('fs'), path = require('path'), os = require('os');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9335, URL = 'http://localhost:8768/index.html?mute=1' + (process.env.MOBILE ? '&mobile=1' : '');
const [out, mode = 'all', scrollX = '0'] = process.argv.slice(2);
const W = +(process.env.W || 1920), H = +(process.env.H || 1080);
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'lycflow-'));
  const br = spawn(EDGE, ['--headless=new', '--mute-audio', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, `--window-size=${W},${H}`, URL], { stdio: 'ignore' });
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
  const waitReady = async () => { for (let i = 0; i < 240 && !(await ev(`!!document.querySelector('#loading .click-start')`)); i++) await sleep(500); };
  await waitReady();
  await ev(`document.querySelector('#loading').click()`);
  await sleep(1500);
  // 把节点标成已看过（只在这个临时配置里）：all = 全部；half = 前一半，最后到达的那个当作「现在」
  await ev(`(() => { const g = __VN.flow(); const ids = g.nodes.filter(n => !n.end).map(n => n.id);
    const half = ${JSON.stringify(mode)} === 'half';
    const take = half ? ids.slice(0, Math.floor(ids.length / 2)) : ids;
    const ends = half ? ['trade'] : g.nodes.filter(n => n.end).map(n => n.end);
    __VN.debugSeen(take, ends, take[take.length - 1], true); return 1; })()`);
  await ev(`document.querySelector('.title-menu [data-act=flow]').click()`);
  await sleep(1500);
  // HOVER=节点id：模拟鼠标移到这个节点上（检查预览卡片）
  if (process.env.HOVER) { await ev(`document.querySelector('.fl-node[data-id="${process.env.HOVER}"]').dispatchEvent(new MouseEvent('mouseenter')); 1`); await sleep(600); }
  // CLICK=节点id：点一下这个节点，看确认框有没有出来（不会真的跳过去）
  if (process.env.CLICK) { await ev(`document.querySelector('.fl-node[data-id="${process.env.CLICK}"]').click(); 1`); await sleep(700);
    console.log('confirm:', await ev(`JSON.stringify({ on: document.getElementById('confirm').classList.contains('on') || getComputedStyle(document.getElementById('confirm')).display !== 'none', msg: document.querySelector('#confirm .confirm-msg').textContent })`)); }
  if (+scrollX) await ev(`document.querySelector('#flow-screen .flow-wrap').scrollLeft = ${+scrollX}; 1`);
  await sleep(800);
  const info = await ev(`JSON.stringify({ w: document.querySelector('#flow-screen .flow-canvas').style.width, h: document.querySelector('#flow-screen .flow-canvas').style.height, n: document.querySelectorAll('.fl-node').length })`);
  const shot = await call('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
  fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
  console.log(out, info);
  ws.close(); br.kill();
})();
