// 剧本流程模拟：按选项序列走完一条路线，报告经过的节点、变量变化和最后的结局。不渲染画面，几毫秒跑完。
// node tools/paths.js            —— 跑预设的全部路线
// node tools/paths.js 0,1,1,1    —— 跑一条自定义路线（选项序号，从 0 开始）
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const files = [...html.matchAll(/src="(script\/[^"?]+)/g)].map(m => m[1]);
const src = files.map(f => { const t = fs.readFileSync(path.join(root, f), 'utf8'); return t.slice(t.indexOf('`') + 1, t.lastIndexOf('`')); }).join('\n');
// 和引擎一样的解析
const ops = [], labels = {};
const lines = src.split(/\r?\n/);
for (let i = 0; i < lines.length; i++) {
  const raw = lines[i].trim();
  if (!raw || raw.startsWith('//')) continue;
  if (raw.startsWith('*')) { labels[raw.slice(1).trim()] = ops.length; continue; }
  if (raw.startsWith('@choice')) {
    const opts = [];
    while (i + 1 < lines.length && lines[i + 1].trim().startsWith('>')) {
      i++; const parts = lines[i].trim().slice(1).split('|').map(s => s.trim());
      const [txt, target] = parts[0].split('=>').map(s => s.trim());
      opts.push({ text: txt, target: target || null, fx: parts.slice(1).flatMap(p => p.split(/[\s,]+/)).filter(Boolean) });
    }
    ops.push({ t: 'choice', opts }); continue;
  }
  if (raw.startsWith('@')) { const sp = raw.indexOf(' '); ops.push({ t: 'cmd', cmd: sp < 0 ? raw.slice(1) : raw.slice(1, sp), rest: sp < 0 ? '' : raw.slice(sp + 1).trim() }); continue; }
  ops.push({ t: 'say' });
}
function applyFx(vars, list) { list.forEach(f => { const m = f.match(/^(\w+)(\+|-|=)(-?\d+)$/); if (!m) return; const [, k, o, v] = m, c = vars[k] || 0; vars[k] = o === '=' ? +v : o === '+' ? c + +v : c - +v; }); }
function cond(vars, c) { const e = c.replace(/[A-Za-z_]\w*/g, k => String(vars[k] || 0)); return !!Function('return (' + e + ')')(); }
function run(picks) {
  const vars = {}, trail = [], mikaLog = [];
  let pc = labels.start, steps = 0, k = 0, ending = null, says = 0;
  while (pc < ops.length && steps++ < 200000) {
    const op = ops[pc++];
    if (op.t === 'say') { says++; continue; }
    if (op.t === 'choice') {
      const p = k < picks.length ? picks[k] : 0; k++;
      const o = op.opts[Math.min(p, op.opts.length - 1)];
      applyFx(vars, o.fx); trail.push(`[${o.text.slice(0, 10)}]`);
      if (o.fx.some(f => f.startsWith('mika'))) mikaLog.push(vars.mika);
      if (o.target) { if (!(o.target in labels)) return { error: 'missing label ' + o.target }; pc = labels[o.target]; }
      continue;
    }
    const { cmd, rest } = op;
    if (cmd === 'set') { applyFx(vars, rest.split(/\s+/)); if (/mika/.test(rest)) mikaLog.push(vars.mika); }
    else if (cmd === 'if') { const [c, t] = rest.split('=>').map(s => s.trim()); if (cond(vars, c)) { if (!(t in labels)) return { error: 'missing label ' + t }; pc = labels[t]; } }
    else if (cmd === 'jump') { if (!(rest in labels)) return { error: 'missing label ' + rest }; pc = labels[rest]; }
    else if (cmd === 'node') trail.push(rest.split('|')[0]);
    else if (cmd === 'ending') ending = rest;
    else if (cmd === 'totitle') break;
  }
  return { ending, vars, choices: k, trail, mikaLog, says, minutes: Math.round(says * 30 / 3600 * 60) / 60 };
}
const ROUTES = {
  'TRUE（三条线索）': [0, 0, 0, 1, 1, 1],
  'TRUE（门链+车牌）': [0, 0, 1, 1, 1, 1],
  'TRUE（车牌+风希）': [1, 0, 0, 1, 1, 1],
  'NORMAL（一条线索）': [0, 1, 1, 1, 1, 1],
  'NORMAL（没有线索）': [1, 1, 1, 1, 1, 1],
  'BAD 交换': [0, 0, 0, 0],
  'BAD 空房间': [0, 0, 0, 1, 0],
  'BAD 实弹': [0, 0, 0, 1, 1, 0]
};
const arg = process.argv[2];
const routes = arg ? { '自定义': arg.split(',').map(Number) } : ROUTES;
for (const [name, picks] of Object.entries(routes)) {
  const r = run(picks);
  if (r.error) { console.log(`${name}: ERROR ${r.error}`); continue; }
  console.log(`${name.padEnd(14)} → ${String(r.ending).padEnd(7)} clue=${r.vars.clue || 0}  选项 ${r.choices}  台词/旁白 ${r.says} 行  ${r.trail.filter(t => t.startsWith('[')).join(' ')}`);
}
