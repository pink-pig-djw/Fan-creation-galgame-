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
  const waitDone = async () => { let d = null; const t0 = Date.now(); while (!d && Date.now() - t0 < 20 * 60 * 1000) { await sleep(2000); d = await ev(`window.__autoDone ? JSON.stringify(__autoLog.filter(l => /ENDING|TEXT UNDER/.test(l))) : null`); } return d; };
  // 1. 先走 TRUE 线，分支图记下一整条 keep=1 的存档
  await ev(`window.__autoDone=null; __auto({ from: 'title', picks: [0,1,1,1,1,0,2,1,1] }); 1`);
  console.log('1st run:', await waitDone());
  console.log('e_tape keep before:', await ev(`JSON.parse(localStorage.p49_nodes).e_tape.S.vars.keep`));
  // 2. 从标题打开分支图，点「账号」，确认
  await ev(`document.querySelector('.title-menu [data-act=flow]').click(); 1`); await sleep(800);
  await ev(`document.querySelector('.fl-node[data-id=c2_keep]').click(); 1`); await sleep(800);
  await ev(`document.querySelector('#confirm button[data-v="1"]').click(); 1`); await sleep(2500);
  // 3. 选「删除」（只玩到这个选项），再从分支图直接跳到最后的「结案」节点，看是否走进 NORMAL
  await ev(`window.__autoDone=null; window.__stopAfterPick=true; 1`);
  for (let i = 0; i < 60; i++) { await sleep(500); const on = await ev(`!!document.querySelector('#choices.on')`); if (on) break; await ev(`document.getElementById('stage').click(); 1`); }
  console.log('choice shown:', await ev(`[...document.querySelectorAll('#choices button')].map(b=>b.textContent).join(' / ')`));
  await ev(`document.querySelectorAll('#choices button')[0].click(); 1`); await sleep(1500);
  console.log('keep now:', await ev(`__VN.S().vars.keep`));
  await ev(`dispatchEvent(new KeyboardEvent('keydown', { key: 'f' })); 1`); await sleep(800);
  await ev(`document.querySelector('.fl-node[data-id=e_kasei]').click(); 1`); await sleep(800);
  await ev(`document.querySelector('#confirm button[data-v="1"]').click(); 1`); await sleep(2500);
  console.log('after jump to e_kasei: keep =', await ev(`__VN.S().vars.keep`), ' mika =', await ev(`__VN.S().vars.mika`));
  await ev(`window.__autoDone=null; __auto({}); 1`);
  console.log('ending:', await waitDone());
  ws.close(); br.kill();
})();
