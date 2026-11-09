// 自动通关测试（在页面里执行；页面要带 ?mute=1）
// __auto({ from: '标签', vars: {...}, picks: [选项序号...] }) —— 按 picks 依次选（用完之后默认选第一个）；走到标题画面为止
window.__auto = async function (opt = {}) {
  const sel = s => document.querySelector(s), W = ms => new Promise(r => setTimeout(r, ms));
  const log = []; window.__autoLog = log; const t0 = Date.now();
  window.__autoErr = []; window.__autoDone = null;
  addEventListener('error', e => window.__autoErr.push(String(e.message)));
  const origErr = console.error; console.error = (...a) => { window.__autoErr.push(a.map(String).join(' ')); origErr(...a); };
  __VN.cfg.skipUnread = true; __VN.cfg.textSpeed = 100;
  // from: 'title' = 和玩家一样，从标题画面点「开始游戏」进入；其他值 = 直接跳到标签
  if (opt.from === 'title') { if (!sel('#title-screen.on')) { await __VN.toTitle(); await W(1500); } sel('.title-menu [data-act=new]').click(); await W(2500); }
  else if (opt.from) __VN.jumpTo(opt.from, opt.vars || {});
  const hidden = new Set(); const blackLines = new Set(); window.__autoHidden = hidden;
  const picks = (opt.picks || []).slice();
  const missing = new Set();
  for (let step = 0; step < 200000; step++) {
    await W(20);
    if (sel('#title-screen.on')) { log.push('TITLE after ' + ((Date.now() - t0) / 1000 | 0) + 's'); break; }
    // 文字已经显示，画面却被黑幕盖着（玩家会看到黑屏）
    const tb = sel('#textbox'), cur = document.getElementById('layer-curtain');
    if (tb && !tb.classList.contains('hidden') && document.getElementById('text').textContent && cur.style.opacity === '1') { // 看目标值：窗口在后台时过渡动画不推进，实时值不可靠
      // 正常切场景时最多只有一句旧台词停在黑幕下；连着出现 3 句不同的台词，就是黑屏 bug
      blackLines.add(document.getElementById('text').textContent);
      if (blackLines.size >= 3) hidden.add(__VN.S().chapter + '：' + document.getElementById('text').textContent.slice(0, 16));
    } else blackLines.clear();
    // 缺图检查
    document.querySelectorAll('.sprite img').forEach(i => { if (i.complete && !i.naturalWidth) missing.add(i.src.split('/').pop()); });
    const ch = sel('#choices.on');
    if (ch) {
      const btns = [...ch.querySelectorAll('button')].filter(b => !b.disabled); if (!btns.length) continue; await W(120);
      const pick = picks.length ? picks.shift() : 0;
      log.push('[' + __VN.S().chapter + '] ' + btns.map(b => b.textContent.slice(0, 14)).join(' / ') + ' => ' + pick + ' clue=' + __VN.S().vars.clue);
      btns[Math.min(pick, btns.length - 1)].click(); await W(120); continue;
    }
    if (sel('#chapter-card.on.ending')) { log.push('ENDING ' + sel('.cc-title').textContent + ' vars=' + JSON.stringify(__VN.S().vars)); await W(2600); document.getElementById('stage').click(); await W(1200); continue; }
    if (sel('#credits.on')) { await W(3300); document.getElementById('stage').click(); await W(400); continue; }
    if (sel('#center-text.on')) { document.getElementById('stage').click(); await W(40); continue; }
    const sk = sel('#quickmenu [data-act=skip]');
    if (sk && !sk.classList.contains('on')) sk.click();
  }
  log.push('missing sprites: ' + [...missing].join(', '));
  if (hidden.size) log.push('TEXT UNDER BLACK CURTAIN: ' + [...hidden].slice(0, 5).join(' / '));
  console.error = origErr;
  window.__autoDone = true;
};
