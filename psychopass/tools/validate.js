// 剧本静态检查：node tools/validate.js [-v] [-ai] [文件名过滤]
// 检查命令、素材 ID、标签跳转、节点、雨雪是否在室内、场景内换装、说话时立绘是否在场、台词长度；-ai 列出所有「AI 味」句式
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const verbose = process.argv.includes('-v'), aiList = process.argv.includes('-ai');
const only = process.argv.slice(2).filter(a => !a.startsWith('-'))[0];
const ctx = { window: {} }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/assets.js'), 'utf8'), ctx);
const A = ctx.window.ASSETS;
const audioSrc = fs.readFileSync(path.join(root, 'js/audio.js'), 'utf8');
const BGM = [...audioSrc.match(/const TITLES = \{([\s\S]*?)\};/)[1].matchAll(/(\w+):/g)].map(m => m[1]);
const AMB = [...audioSrc.match(/const target = \{([^}]*)\}/)[1].matchAll(/(\w+):/g)].map(m => m[1]);
const SE = [...audioSrc.matchAll(/case '(\w+)':/g)].map(m => m[1]);
const FX = ['rain', 'heavyrain', 'snow', 'dust', 'static', 'none'];
const TINT = ['red', 'cold', 'memory', 'sepia', 'dark', 'none'];
const VARS = ['mika', 'keep'];
const CMDS = 'node route face bg cg show hide bgm amb se wait shake flash black white reveal fx tint mode line muffle textbox chapter date center set if jump ending credits totitle autosave scan hue tip countdown glitch scare'.split(' ');
const ANIMS = ['hop', 'shake', 'tremble', 'pop'];
const POS = ['l', 'cl', 'c', 'cr', 'r', 'll', 'rr', 'p1', 'p2', 'p3', 'p4'];
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const files = [...html.matchAll(/src="(script\/[^"?]+)/g)].map(m => m[1]).filter(f => fs.existsSync(path.join(root, f)));
const errs = [], warns = [], miss = [], ai = [];
const labels = new Map(), jumps = [], nodes = new Map();
const stats = {};
const outfit = e => (e.match(/^(home)(_|$)/) || [])[1] || 'base';
// 「AI 味」：见 docs/写手须知.md 的禁止清单
const AI_PATTERNS = [
  [/仿佛|宛如|如同|好似|恍若|犹如/, '比喻词'], [/像是?[^，。「」]{1,14}一样/, '像……一样'],
  [/不是[^，。！？]{1,16}[，,]\s*而是/, '不是X而是Y'], [/与其说[^，。]{1,16}不如说/, '与其说'],
  [/深吸了?一口气|五味杂陈|心头一[紧颤]|鼻子一酸|眼眶(发热|一热|泛红)|寒意|脊背发凉|毛骨悚然|莫名的|复杂的情绪|说不清的/, '情绪套话'],
  [/空气(仿佛)?(凝固|安静)|时间(仿佛)?(静止|停止)|沉默在|嘴角勾起|一抹|眸子|眸中|眼底闪过|眼中闪过|指节泛白|喉咙发紧|瞳孔(骤|猛)缩/, '套话动作'],
  [/^(也许|或许)[，,]?这就是|^原来[，,]|终于明白|有些东西/, '升华'],
  [/某种(东西|感觉|情绪)|什么东西碎/, '抽象名词'], [/脸上写满|做出了一个/, '翻译腔']
];
const SOFT = /微微|轻轻|淡淡|缓缓|静静|默默/g;
for (const f of files) {
  const src = fs.readFileSync(path.join(root, f), 'utf8');
  const lines = src.split(/\r?\n/);
  const st = stats[f] = { chars: 0, lines: 0, dlg: 0, dlgOk: 0, dash: 0, soft: 0, ai: 0 };
  let sprites = new Map(), cg = false, mode = 'normal', line = false, bg = null, label = '';
  const at = i => `${f}:${i + 1}`;
  lines.forEach((raw, i) => {
    const l = raw.trim();
    if (!l || l.startsWith('//') || l.startsWith('SCRIPTS.push') || l.startsWith('`')) return;
    if (l.startsWith('*')) { label = l.slice(1).trim(); if (labels.has(label)) errs.push(`${at(i)} duplicate label ${label}`); labels.set(label, at(i)); return; }
    if (l.startsWith('>')) {
      const parts = l.slice(1).split('|').map(s => s.trim());
      const t = (parts[0].split('=>')[1] || '').trim(); if (t) jumps.push([t, at(i)]);
      parts.slice(1).forEach(p => { if (!p.startsWith('?') && !/^(\w+(\+|-|=)\d+[\s,]*)+$/.test(p.replace(/\s/g, ''))) errs.push(`${at(i)} bad choice effect "${p}"`);
        (p.match(/[a-z_]+(?=[+\-=])/g) || []).forEach(v => { if (!VARS.includes(v)) errs.push(`${at(i)} unknown variable ${v}`); }); });
      return;
    }
    if (l.startsWith('@')) {
      const sp = l.indexOf(' '); const cmd = sp < 0 ? l.slice(1) : l.slice(1, sp); const rest = sp < 0 ? '' : l.slice(sp + 1).trim(); const a = rest ? rest.split(/\s+/) : [];
      if (cmd === 'choice') return;
      if (!CMDS.includes(cmd)) errs.push(`${at(i)} unknown cmd @${cmd}`);
      switch (cmd) {
        case 'node': { const [id] = rest.split('|'); if (nodes.has(id)) errs.push(`${at(i)} duplicate node ${id}`); nodes.set(id, { at: at(i), label }); if (!rest.includes('|')) errs.push(`${at(i)} node needs id|标题`); break; }
        case 'bg': {
          const name = a[0]; if (!(name in A.bg)) errs.push(`${at(i)} bad bg ${name}`);
          else if (A.bg[name] && !fs.existsSync(path.join(root, A.bg[name].src))) miss.push(`bg ${name}`);
          if (a[1] && !['dissolve', 'cut', 'black', 'white', 'holo', 'keep'].includes(a[1])) errs.push(`${at(i)} bad bg transition ${a[1]}`);
          bg = name; line = false;
          if (!a.includes('keep')) { sprites = new Map(); }
          break; }
        case 'cg': if (a[0] !== 'off') { if (!A.cg.find(c => c.id === a[0])) errs.push(`${at(i)} cg not in list ${a[0]}`); else if (!fs.existsSync(path.join(root, 'assets/cg', a[0] + '.png'))) miss.push(`cg ${a[0]}`); } cg = a[0] !== 'off'; break;
        case 'scare': if (!A.cg.find(c => c.id === a[0])) errs.push(`${at(i)} scare cg not in list ${a[0]}`); else if (!fs.existsSync(path.join(root, 'assets/cg', a[0] + '.png'))) miss.push(`cg ${a[0]}`); cg = true; break;
        case 'show': {
          const [id, ex = 'normal', ...r] = a; const c = A.ch[id];
          if (!c) { errs.push(`${at(i)} bad char ${id}`); break; }
          if (!c.exprs.includes(ex)) errs.push(`${at(i)} ${id} has no expr "${ex}"`);
          else if (!fs.existsSync(path.join(root, 'assets/ch', `${id}_${ex}.png`))) miss.push(`ch ${id}_${ex}`);
          r.forEach(t => { if (!POS.includes(t) && !ANIMS.includes(t) && !['close', 'far', 'flip', 'noflip'].includes(t)) errs.push(`${at(i)} bad show arg ${t}`); });
          const prev = sprites.get(id);
          if (prev && outfit(prev) !== outfit(ex)) warns.push(`${at(i)} [${label}] ${id} changes outfit ${prev} -> ${ex} mid-scene`);
          sprites.set(id, ex);
          if (sprites.size > 4) warns.push(`${at(i)} more than 4 sprites on screen`);
          break; }
        case 'hide': if (!a[0] || a[0] === 'all') sprites = new Map(); else { if (!A.ch[a[0]]) errs.push(`${at(i)} bad hide ${a[0]}`); sprites.delete(a[0]); } break;
        case 'face': if (!A.ch[a[0]] || !A.ch[a[0]].exprs.includes(a[1] || 'normal')) errs.push(`${at(i)} bad face ${a.join(' ')}`); break;
        case 'bgm': if (a[0] !== 'stop' && !BGM.includes(a[0])) errs.push(`${at(i)} bad bgm ${a[0]}`); break;
        case 'amb': if (a[0] !== 'stop' && !AMB.includes(a[0])) errs.push(`${at(i)} bad amb ${a[0]}`); if (a[0] === 'stop' && a[1] && !AMB.includes(a[1])) errs.push(`${at(i)} bad amb stop ${a[1]}`); break;
        case 'se': if (!SE.includes(a[0])) errs.push(`${at(i)} bad se ${a[0]}`); break;
        case 'fx': if (!FX.includes(a[0] || 'none')) errs.push(`${at(i)} bad fx ${a[0]}`);
          if (['rain', 'heavyrain', 'snow'].includes(a[0]) && !(A.bg[bg] && A.bg[bg].out)) errs.push(`${at(i)} weather fx ${a[0]} on indoor bg ${bg}`); break;
        case 'tint': if (!TINT.includes(a[0] || 'none')) errs.push(`${at(i)} bad tint ${a[0]}`); break;
        case 'mode': if (!['normal', 'phone'].includes(a[0])) errs.push(`${at(i)} bad mode ${a[0]}`); mode = a[0]; break;
        case 'line': line = !(a[0] === 'off' || !a[0]); break;
        case 'chapter': case 'countdown': sprites = new Map(); cg = false; line = false; if (cmd === 'countdown' && !/^\d+\|.+/.test(rest)) errs.push(`${at(i)} countdown needs N|日期`); break;
        case 'jump': jumps.push([a[0], at(i)]); break;
        case 'if': { const [c, t0] = rest.split('=>'); const t = (t0 || '').trim(); if (!t) errs.push(`${at(i)} bad if`); else jumps.push([t, at(i)]);
          (c.match(/[a-z_]+/g) || []).forEach(v => { if (!VARS.includes(v)) errs.push(`${at(i)} unknown variable ${v}`); }); break; }
        case 'ending': if (!A.endings.find(e => e.id === a[0])) errs.push(`${at(i)} bad ending ${a[0]}`); break;
        case 'credits': if (a[0] && !A.cg.find(c => c.id === a[0])) errs.push(`${at(i)} credits cg not in list ${a[0]}`); break;
        case 'center': st.chars += rest.length; break;
        case 'set': a.forEach(x => { if (!/^\w+(\+|-|=)\d+$/.test(x)) errs.push(`${at(i)} bad set ${x}`); else if (!VARS.includes(x.match(/^\w+?(?=[+\-=])/)[0])) errs.push(`${at(i)} unknown variable ${x}`); }); break;
        case 'scan': if (a[0] !== 'off' && rest.split('|').length !== 3) errs.push(`${at(i)} scan needs 名字|数值|判定 or off`); break;
        case 'hue': if (!['mika', 'akane'].includes(a[0])) errs.push(`${at(i)} bad hue ${a[0]}`); break;
        case 'tip': if (!A.tips.find(t => t.id === a[0])) errs.push(`${at(i)} bad tip ${a[0]}`); break;
      }
      return;
    }
    const m = l.match(/^([^\s：「（]{1,12})：(.+)$/);
    const txt = m ? m[2] : l;
    // 旁白里带「：」的句子会被引擎当成「名字：台词」，名字栏里出现一整句话
    if (m && !A.speakers[m[1]] && m[1] !== A.protagonist && (m[1].length > 5 || /[，。、的是]/.test(m[1]))) warns.push(`${at(i)} narration parsed as speaker name "${m[1]}" (use —— or 。 instead of ：)`);
    if (txt.length > 110) errs.push(`${at(i)} line too long (${txt.length})`);
    if (m && /^「.*」$/.test(m[2])) warns.push(`${at(i)} dialogue wrapped in 「」 — remove the quotes`);
    const clean = txt.replace(/[｛｝〔〕]/g, '');
    st.chars += clean.length; st.lines++;
    st.dash += (clean.match(/——/g) || []).length;
    st.soft += (clean.match(SOFT) || []).length;
    AI_PATTERNS.forEach(([re, tag]) => { if (re.test(clean)) { st.ai++; ai.push(`${at(i)} [${tag}] ${clean.slice(0, 40)}`); } });
    if (m && A.speakers[m[1]] && !line && mode === 'normal') {
      st.dlg++;
      const id = A.speakers[m[1]];
      // 朱不在画面上时，对话框会显示她的头像
      if (sprites.has(id) || cg || id === A.protagonistId) st.dlgOk++;
      else warns.push(`${at(i)} [${label}] ${m[1]} speaks without sprite: ${m[2].slice(0, 20)}`);
    }
  });
}
jumps.forEach(([t, w]) => { if (!labels.has(t)) errs.push(`${w} missing label ${t}`); });
const show = arr => arr.filter(x => !only || x.includes(only));
console.log(errs.length ? 'ERRORS:\n' + show(errs).join('\n') : 'NO ERRORS');
const w = show(warns);
console.log(`WARNINGS: ${w.length}` + (verbose ? '\n' + w.join('\n') : (w.length ? '\n' + w.slice(0, 25).join('\n') + (w.length > 25 ? '\n…（-v 查看全部）' : '') : '')));
const um = [...new Set(miss)];
console.log(`missing image files: ${um.length}` + (verbose && um.length ? '\n  ' + um.join('\n  ') : ''));
let tot = 0;
for (const [f, s] of Object.entries(stats)) {
  if (only && !f.includes(only)) { tot += s.chars; continue; }
  tot += s.chars;
  const k = s.chars / 1000 || 1;
  console.log(`  ${f}: ${s.chars} 字, 台词立绘在场 ${s.dlg ? Math.round(100 * s.dlgOk / s.dlg) : 100}% (${s.dlgOk}/${s.dlg}) | AI味 ${s.ai} 处, —— ${(s.dash / k).toFixed(1)}/千字, 微微轻轻类 ${(s.soft / k).toFixed(1)}/千字`);
}
const ai2 = show(ai);
if (aiList) console.log('AI味句式：\n' + ai2.join('\n'));
else if (ai2.length) console.log(`AI味句式 ${ai2.length} 处（-ai 查看）`);
console.log(`total ${tot} 字, labels ${labels.size}, nodes ${nodes.size}`);
