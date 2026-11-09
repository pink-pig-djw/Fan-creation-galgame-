// 四十九日（PSYCHO-PASS 同人视觉小说）—— 引擎
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const stage = $('#stage');
  const A = window.ASSETS;
  const PROTAG = A.protagonist;
  const QS = new URLSearchParams(location.search);
  // ================= 手机 =================
  // NATIVE：安卓 app（Capacitor）；MOBILE：手机（触屏小屏幕），界面放大、手势操作、不整包预读图片。?mobile=1 可在电脑上模拟
  const CAP = window.Capacitor;
  const NATIVE = !!(CAP && CAP.isNativePlatform && CAP.isNativePlatform());
  const MOBILE = NATIVE || QS.get('mobile') === '1' || (matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 900);
  if (MOBILE) document.body.classList.add('mobile');
  if (NATIVE) document.body.classList.add('native');

  // ================= 缩放 =================
  // 舞台跟着窗口 / 屏幕的比例变：比 16:9 宽就加宽（最宽 2560），比 16:9 高就加高（最高 1440），画面铺满不留黑边。
  // 人物、界面都以中间的 1920×1080 为准；CG 完整显示，空出来的地方用模糊的同一张图补满（#stage.fill）
  let stageW = 1920, stageH = 1080;
  function fit() {
    const ar = innerWidth / innerHeight;
    const SW = Math.round(Math.min(2560, Math.max(1920, 1080 * ar)));
    const SH = Math.round(Math.min(1440, Math.max(1080, 1920 / ar)));
    if (SW !== stageW || SH !== stageH) {
      stageW = SW; stageH = SH;
      stage.style.width = SW + 'px'; stage.style.height = SH + 'px';
      stage.style.setProperty('--sw', SW + 'px'); stage.style.setProperty('--sh', SH + 'px');
      stage.classList.toggle('fill', SW !== 1920 || SH !== 1080);
      const fc = document.getElementById('layer-fx'); if (fc) { fc.width = SW; fc.height = SH; try { if (fxType !== 'none') setFx(fxType); } catch (e) { /* 启动时特效还没初始化 */ } }
    }
    const s = Math.min(innerWidth / stageW, innerHeight / stageH);
    stage.style.transform = `scale(${s})`;
    stage.style.setProperty('--scale', `scale(${s})`);
  }
  addEventListener('resize', fit); fit();
  try { new ResizeObserver(fit).observe(document.getElementById('viewport')); } catch (e) { }

  // ================= 持久化 =================
  const PREFIX = 'lyc_';
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(PREFIX + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); } catch (e) { } }
  };
  const cfg = Object.assign({ textSpeed: 60, autoSpeed: 50, boxOpacity: 82, bgmVol: 60, ambVol: 55, seVol: 70, scare: 2, skipUnread: false, fullscreen: false }, LS.get('cfg', {}));
  const glob = Object.assign({ read: [], cg: [], endings: [], cleared: false, tips: [] }, LS.get('global', {}));
  const readSet = new Set(glob.read);
  let globDirty = false;
  function saveGlobal() { glob.read = Array.from(readSet); LS.set('global', glob); globDirty = false; }
  setInterval(() => { if (globDirty) saveGlobal(); }, 3000);
  addEventListener('beforeunload', saveGlobal);
  function applyCfg() {
    stage.style.setProperty('--box-opacity', cfg.boxOpacity / 100);
    try { AudioSys.setVolume('bgm', cfg.bgmVol / 100); AudioSys.setVolume('amb', cfg.ambVol / 100); AudioSys.setVolume('se', cfg.seVol / 100); } catch (e) { }
  }

  // ================= 脚本解析 =================
  const ops = [], labels = {}, keyIndex = {};
  (function parse() {
    let lastLabel = '_start', off = 0;
    const lines = window.SCRIPTS.join('\n').split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      let raw = lines[i].trim();
      if (!raw || raw.startsWith('//')) continue;
      let op;
      if (raw.startsWith('*')) { lastLabel = raw.slice(1).trim(); off = 0; labels[lastLabel] = ops.length; continue; }
      if (raw.startsWith('@choice')) {
        const opts = [];
        while (i + 1 < lines.length && lines[i + 1].trim().startsWith('>')) {
          i++;
          const parts = lines[i].trim().slice(1).split('|').map(s => s.trim());
          let [txt, target] = parts[0].split('=>').map(s => s.trim());
          const o = { text: txt, target: target || null, fx: [], cond: null };
          parts.slice(1).forEach(p => { if (p.startsWith('?!')) o.lock = p.slice(2).trim(); else if (p.startsWith('?')) o.cond = p.slice(1).trim(); else o.fx.push(...p.split(/[\s,]+/).filter(Boolean)); });
          opts.push(o);
        }
        op = { t: 'choice', opts };
      } else if (raw.startsWith('@')) {
        const sp = raw.indexOf(' ');
        const cmd = sp < 0 ? raw.slice(1) : raw.slice(1, sp);
        const rest = sp < 0 ? '' : raw.slice(sp + 1).trim();
        op = { t: 'cmd', cmd, rest, args: rest ? rest.split(/\s+/) : [] };
      } else {
        const m = raw.match(/^([^\s：「（]{1,12})：(.+)$/);
        if (m) op = { t: 'say', name: m[1], text: m[2] };
        else op = { t: 'say', name: '', text: raw };
      }
      op.key = lastLabel + ':' + (off++);
      op.line = i + 1;
      keyIndex[op.key] = ops.length;
      ops.push(op);
    }
  })();

  // ================= 状态 =================
  let S = freshState();
  function freshState() { return { lastExpr: {}, bg: null, cg: null, sprites: {}, bgm: null, amb: [], fx: 'none', tint: 'none', mode: 'normal', vars: {}, picks: {}, chapter: '', lastText: '', lastName: '', muffle: false, line: null, scan: null, pov: null }; }
  let pc = 0, runId = 0;
  let backlog = [];
  let autoMode = false, skipMode = false, ctrlHeld = false, uiHidden = false;
  let pendingReveal = false;
  let inGame = false;

  let clickResolver = null;
  function waitClick() { return new Promise(r => { clickResolver = r; }); }
  function fireClick(v = 'click') { if (clickResolver) { const r = clickResolver; clickResolver = null; r(v); } }
  function abortWaits() { fireClick('abort'); if (timedResolver) { const r = timedResolver; timedResolver = null; r('abort'); } }
  let timedResolver = null;
  function wait(ms, clickable = true) {
    return new Promise(r => {
      let done = false;
      const fin = v => { if (done) return; done = true; timedResolver = null; if (clickable && clickResolver === fin2) clickResolver = null; r(v); };
      const fin2 = v => fin(v);
      timedResolver = fin;
      if (clickable) clickResolver = fin2;
      setTimeout(() => fin('time'), isSkipping() ? Math.min(ms, 60) : ms);
    });
  }
  const isSkipping = () => (skipMode || ctrlHeld) && inGame;

  // ================= 背景 / CG =================
  let bgFront = 'a', cgFront = 'a';
  const bgSrc = name => { const b = A.bg[name]; return b ? (typeof b === 'string' ? b : b.src) : null; };
  const isOutdoor = name => { const b = A.bg[name]; return !!(b && typeof b === 'object' && b.out); };
  function imgUrl(kind, name) {
    if (kind === 'bg') { const s = bgSrc(name); return s ? `url("${s}")` : 'none'; }
    return `url("assets/cg/${name}.webp")`;
  }
  function bgColor(name) { return name === 'white' ? '#fff' : '#000'; }
  async function setBg(name, trans = 'dissolve', ms = 900) {
    if (isSkipping()) ms = Math.min(ms, 120);
    const front = $('#bg-' + bgFront), back = $('#bg-' + (bgFront === 'a' ? 'b' : 'a'));
    const apply = el => { el.style.backgroundImage = imgUrl('bg', name); el.style.backgroundColor = bgColor(name); };
    S.bg = name;
    updateSpriteTint();
    if (trans === 'cut' || ms <= 0) {
      apply(front); front.style.transition = 'none'; front.style.opacity = 1; back.style.opacity = 0; return;
    }
    if (trans === 'black' || trans === 'white') {
      await curtain(true, ms / 2, trans === 'white' ? '#fff' : '#000');
      apply(front); front.style.transition = 'none'; front.style.opacity = 1; back.style.opacity = 0;
      await sleep(isSkipping() ? 0 : 200);
      await curtain(false, ms / 2);
      return;
    }
    if (trans === 'holo') {
      // 全息装潢开关：新画面从上往下扫出来，带一条亮线和闪烁
      if (!isSkipping()) { ms = Math.max(ms, 1300); AudioSys.se(/_off$/.test(name) ? 'holo_off' : 'holo_on'); }
      apply(back); back.style.transition = 'none'; back.style.opacity = 1; back.style.zIndex = 2; front.style.zIndex = 1;
      back.style.setProperty('--holo-ms', ms + 'ms');
      back.classList.remove('holo-in'); void back.offsetWidth; back.classList.add('holo-in');
      bgFront = bgFront === 'a' ? 'b' : 'a';
      await sleep(ms);
      back.classList.remove('holo-in');
      front.style.transition = 'none'; front.style.opacity = 0;
      return;
    }
    apply(back); back.style.transition = 'none'; back.style.opacity = 0; back.style.zIndex = 2; front.style.zIndex = 1;
    void back.offsetWidth;
    back.style.transition = `opacity ${ms}ms ease`; back.style.opacity = 1;
    bgFront = bgFront === 'a' ? 'b' : 'a';
    await sleep(ms);
    front.style.transition = 'none'; front.style.opacity = 0;
  }
  async function setCg(name, ms = 1000) {
    if (isSkipping()) ms = Math.min(ms, 120);
    const front = $('#cg-' + cgFront), back = $('#cg-' + (cgFront === 'a' ? 'b' : 'a'));
    if (!name || name === 'off') {
      S.cg = null; front.style.transition = `opacity ${ms}ms ease`; front.style.opacity = 0; back.style.opacity = 0; await sleep(ms); return;
    }
    S.cg = name;
    if (!glob.cg.includes(name)) { glob.cg.push(name); globDirty = true; }
    back.style.backgroundImage = imgUrl('cg', name); back.style.transition = 'none'; back.style.opacity = 0; back.style.zIndex = 2; front.style.zIndex = 1;
    void back.offsetWidth;
    back.style.transition = `opacity ${ms}ms ease`; back.style.opacity = 1;
    cgFront = cgFront === 'a' ? 'b' : 'a';
    await sleep(ms);
    front.style.transition = 'none'; front.style.opacity = 0;
  }
  async function curtain(on, ms = 600, color = '#000') {
    const c = $('#layer-curtain');
    if (isSkipping()) ms = Math.min(ms, 80);
    c.style.background = color;
    c.style.transition = `opacity ${ms}ms ease`;
    c.style.opacity = on ? 1 : 0;
    await sleep(ms);
  }

  // ================= 立绘 =================
  // 四人同框用 p1~p4，三人用 l c r
  const posLeft = p => `calc(50% + ${((POS[p] - 50) * 19.2).toFixed(1)}px)`;
  const POS = { l: 27, cl: 38, c: 50, cr: 62, r: 73, ll: 17, rr: 83, p1: 19, p2: 39.5, p3: 60.5, p4: 81 };
  // 人多的时候自动拉开：保持剧本写的左右顺序，相邻两人中心至少隔 23%（按两人的身高比例放大），不出画面边缘。
  // 两个人站左右这种本来就够宽的，位置不变；新出场的人直接站到算好的位置，其他人平滑挪过去
  function layoutSprites(freshId) {
    const items = Object.keys(S.sprites).map(id => ({ id, el: document.getElementById('sp-' + id), v: S.sprites[id] }))
      .filter(x => x.el && x.v.size !== 'close')
      .map((x, k) => Object.assign(x, { p: POS[x.v.pos] != null ? POS[x.v.pos] : 50, k, sc: (A.ch[x.id] && A.ch[x.id].scale) || 1 }))
      .sort((a, b) => a.p - b.p || a.k - b.k);
    const LO = 13, HI = 87;
    for (let it = 0; it < 60 && items.length > 1; it++) {
      let moved = false;
      for (let i = 0; i < items.length - 1; i++) {
        const a = items[i], b = items[i + 1], need = 23 * (a.sc + b.sc) / 2, gap = b.p - a.p;
        if (gap < need - 0.05) { const d = (need - gap) / 2; a.p -= d; b.p += d; moved = true; }
      }
      items.forEach(x => { x.p = Math.max(LO, Math.min(HI, x.p)); });
      if (!moved) break;
    }
    items.forEach(x => {
      const left = `calc(50% + ${((x.p - 50) * 19.2).toFixed(1)}px)`;
      if (x.id === freshId) { x.el.style.transition = 'none'; x.el.style.left = left; void x.el.offsetWidth; x.el.style.transition = ''; }
      else x.el.style.left = left;
    });
  }
  function spritePath(id, expr) { return `assets/ch/${id}_${expr}.webp`; }
  function updateSpriteTint() {
    const b = A.bg[S.bg], tint = b && typeof b === 'object' ? b.tint : '';
    $$('.sprite').forEach(el => { el.classList.remove('tint-night', 'tint-dim', 'tint-cold', 'tint-warm'); if (tint) el.classList.add('tint-' + tint); });
  }
  function applySpriteSize(el, id, size) {
    const sc = (A.ch[id] && A.ch[id].scale) || 1;
    const close = size === 'close';
    el.style.height = (close ? 1720 : 1110) * sc + 'px';
    el.style.bottom = (close ? -620 : -90) * sc + 'px';
    el.classList.toggle('close', close);
  }
  const isHolo = (id, expr) => { const c = A.ch[id]; return !!(c && c.holo && c.holo.includes(expr)); };
  function showSprite(id, expr = 'normal', pos, anim, size, flip) {
    let el = document.getElementById('sp-' + id);
    const prev = S.sprites[id];
    pos = pos || (prev && prev.pos) || 'c';
    size = size || (prev && prev.size) || 'normal';
    if (flip == null) flip = !!(prev && prev.flip);
    S.sprites[id] = { expr, pos, size, flip };
    (S.lastExpr = S.lastExpr || {})[id] = expr;
    if (!el) {
      el = document.createElement('div'); el.className = 'sprite'; el.id = 'sp-' + id;
      const img = document.createElement('img'); img.draggable = false;
      img.onerror = () => { if (!img.src.endsWith('_normal.webp')) img.src = spritePath(id, 'normal'); };
      img.src = spritePath(id, expr); el.appendChild(img);
      el.style.left = posLeft(pos);
      applySpriteSize(el, id, size);
      if (!isSkipping()) el.classList.add('enter');
      $('#layer-ch').appendChild(el);
      updateSpriteTint();
      layoutSprites(id);
      void el.offsetWidth; el.style.opacity = 1;
    } else {
      el.style.opacity = 1;
      el.classList.remove('enter');
      layoutSprites();
      applySpriteSize(el, id, size);
      const imgs = el.querySelectorAll('img'), cur = imgs[imgs.length - 1];
      const want = spritePath(id, expr);
      if (!cur || !cur.src.endsWith(want)) {
        const img = document.createElement('img'); img.draggable = false; img.style.opacity = 0;
        img.onerror = () => { if (!img.src.endsWith('_normal.webp')) img.src = spritePath(id, 'normal'); };
        // 新表情淡入后，只删掉它下面更旧的图层（快进时连续换表情也不会把图层删光）
        img.onload = () => {
          if (!img.isConnected) return;
          img.style.opacity = 1;
          setTimeout(() => { let p = img.previousElementSibling; while (p) { const q = p.previousElementSibling; if (p.tagName === 'IMG') p.remove(); p = q; } }, isSkipping() ? 0 : 260);
        };
        img.src = want; el.appendChild(img);
      }
    }
    el.classList.toggle('flip', !!flip);
    el.classList.toggle('holo', isHolo(id, expr));
    if (anim && !isSkipping()) { el.classList.remove(anim); void el.offsetWidth; el.classList.add(anim); setTimeout(() => el.classList.remove(anim), 1600); }
  }
  function hideSprite(id) {
    const ids = id === 'all' || !id ? Object.keys(S.sprites) : [id];
    ids.forEach(i => {
      delete S.sprites[i];
      const el = document.getElementById('sp-' + i);
      if (el) { el.style.opacity = 0; setTimeout(() => { if (!S.sprites[i]) el.remove(); }, 500); }
    });
    layoutSprites();
  }
  function clearSpritesNow() { S.sprites = {}; $('#layer-ch').innerHTML = ''; }
  function speakerId(name) { return A.speakers[name]; }
  function focusSpeaker(name) {
    const id = speakerId(name);
    $$('.sprite').forEach(el => {
      const sid = el.id.slice(3);
      if (id && S.sprites[id] && sid !== id) el.classList.add('dim'); else el.classList.remove('dim');
    });
  }

  // ================= 粒子特效 =================
  const fxCanvas = $('#layer-fx'), fxCtx = fxCanvas.getContext('2d');
  let fxParts = [], fxType = 'none';
  const WEATHER = ['rain', 'heavyrain', 'snow'];
  function setFx(type) {
    if (WEATHER.includes(type) && !isOutdoor(S.bg)) { console.warn('室内场景不显示天气粒子：', S.bg, type); type = 'none'; }
    S.fx = type; fxType = type; fxParts = [];
    const n = { rain: 260, heavyrain: 520, snow: 150, sparkle: 46, lights: 7, dust: 60, confetti: 140, petals: 70, static: 1 }[type] || 0;
    for (let i = 0; i < n; i++) fxParts.push(newPart(true, i));
  }
  function newPart(init, i) {
    const W = stageW, H = stageH, r = Math.random, X0 = (stageW - 1920) / 2;
    switch (fxType) {
      case 'rain': case 'heavyrain': return { x: r() * W * 1.2, y: init ? r() * H : -40, v: 28 + r() * 18, l: 30 + r() * 40, a: 0.15 + r() * 0.3 };
      case 'snow': return { x: r() * W, y: init ? r() * H : -10, v: 0.6 + r() * 1.4, s: 2 + r() * 5, ph: r() * 6.28, a: 0.5 + r() * 0.5 };
      case 'petals': return { x: r() * W * 1.3, y: init ? r() * H : -20, v: 1 + r() * 1.6, s: 6 + r() * 7, ph: r() * 6.28, rot: r() * 6.28 };
      case 'sparkle': return { x: r() * W, y: r() * H * 0.85, s: 6 + r() * 16, ph: r() * 6.28, sp: 0.03 + r() * 0.05, hue: r() < 0.5 ? 48 : 330 };
      case 'lights': return { x: X0 + 120 + (i || 0) * 270 * stageW / 1920, ang: -0.6 + r() * 1.2, sp: 0.004 + r() * 0.006, ph: r() * 6.28, hue: [330, 50, 210, 0, 280, 190, 40][(i || 0) % 7] };
      case 'dust': return { x: r() * W, y: r() * H, v: 0.15 + r() * 0.3, s: 1 + r() * 2.5, ph: r() * 6.28, a: r() };
      case 'confetti': return { x: r() * W, y: init ? -r() * H : -20, v: 2 + r() * 3, s: 8 + r() * 8, ph: r() * 6.28, rot: r() * 6.28, hue: [330, 50, 210, 0][Math.floor(r() * 4)] };
    }
    return {};
  }
  function fxLoop() {
    requestAnimationFrame(fxLoop);
    fxCtx.clearRect(0, 0, stageW, stageH);
    if (fxType === 'none' || !fxParts.length) return;
    const c = fxCtx;
    if (fxType === 'static') {
      // 噪点：每帧随机的小方块，偶尔一条横向的干扰带
      const r = Math.random;
      for (let i = 0; i < 700; i++) { const v = (r() * 255) | 0; c.fillStyle = `rgba(${v},${v},${v},${0.05 + r() * 0.1})`; c.fillRect(r() * stageW, r() * stageH, 2 + r() * 3, 2 + r() * 3); }
      if (r() < 0.08) { const y = r() * stageH; c.fillStyle = `rgba(200,230,255,${0.05 + r() * 0.08})`; c.fillRect(0, y, stageW, 4 + r() * 26); }
      return;
    }
    fxParts.forEach((p, i) => {
      switch (fxType) {
        case 'rain': case 'heavyrain':
          c.strokeStyle = `rgba(200,215,235,${p.a})`; c.lineWidth = fxType === 'heavyrain' ? 1.6 : 1.1;
          c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.l * 0.18, p.y + p.l); c.stroke();
          p.y += p.v; p.x -= p.v * 0.18; if (p.y > stageH + 20) fxParts[i] = newPart(); break;
        case 'snow':
          p.ph += 0.01; p.y += p.v; p.x += Math.sin(p.ph) * 0.6;
          c.fillStyle = `rgba(255,255,255,${p.a})`; c.beginPath(); c.arc(p.x, p.y, p.s, 0, 6.28); c.fill();
          if (p.y > stageH + 10) fxParts[i] = newPart(); break;
        case 'petals':
          p.ph += 0.02; p.rot += 0.03; p.y += p.v; p.x += Math.sin(p.ph) * 1.2 - 0.8;
          c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillStyle = 'rgba(255,200,215,.85)';
          c.beginPath(); c.ellipse(0, 0, p.s, p.s * 0.55 * Math.abs(Math.cos(p.ph)), 0, 0, 6.28); c.fill(); c.restore();
          if (p.y > 1100 || p.x < -30) fxParts[i] = newPart(); break;
        case 'sparkle': {
          // 喜多的「光环」
          p.ph += p.sp; const k = Math.max(0, Math.sin(p.ph)), s = p.s * k;
          if (s > 0.5) {
            c.save(); c.translate(p.x, p.y); c.globalAlpha = k * 0.9;
            c.fillStyle = `hsl(${p.hue},100%,88%)`; c.shadowColor = `hsl(${p.hue},100%,70%)`; c.shadowBlur = 14;
            c.beginPath(); c.moveTo(0, -s); c.quadraticCurveTo(0, 0, s, 0); c.quadraticCurveTo(0, 0, 0, s); c.quadraticCurveTo(0, 0, -s, 0); c.quadraticCurveTo(0, 0, 0, -s); c.fill(); c.restore();
          }
          if (p.ph > 6.28 * 2) fxParts[i] = newPart(); break;
        }
        case 'lights': {
          // 舞台灯光
          p.ph += p.sp; const ang = p.ang + Math.sin(p.ph) * 0.35;
          c.save(); c.translate(p.x, -40); c.rotate(ang); c.globalCompositeOperation = 'screen';
          const g = c.createLinearGradient(0, 0, 0, 1250);
          g.addColorStop(0, `hsla(${p.hue},100%,75%,.42)`); g.addColorStop(1, `hsla(${p.hue},100%,60%,0)`);
          c.fillStyle = g; c.beginPath(); c.moveTo(-14, 0); c.lineTo(14, 0); c.lineTo(190, 1250); c.lineTo(-190, 1250); c.fill(); c.restore();
          break;
        }
        case 'confetti':
          p.ph += 0.05; p.rot += 0.08; p.y += p.v; p.x += Math.sin(p.ph) * 1.6;
          c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillStyle = `hsl(${p.hue},85%,65%)`;
          c.fillRect(-p.s / 2, -p.s / 4 * Math.abs(Math.cos(p.ph)), p.s, p.s / 2 * Math.abs(Math.cos(p.ph)) + 1); c.restore();
          if (p.y > stageH + 20) fxParts[i] = newPart(); break;
        case 'dust':
          p.ph += 0.01; p.y -= p.v * 0.3; p.x += Math.sin(p.ph) * 0.3;
          c.fillStyle = `rgba(255,240,210,${0.25 + Math.sin(p.ph * 2) * 0.2})`; c.beginPath(); c.arc(p.x, p.y, p.s, 0, 6.28); c.fill();
          if (p.y < -10) { p.y = 1090; } break;
      }
    });
  }
  fxLoop();

  function setTint(t) {
    S.tint = t;
    stage.classList.remove('tint-sepia', 'tint-memory', 'tint-dark', 'tint-red', 'tint-cold');
    if (t && t !== 'none') stage.classList.add('tint-' + t);
  }

  // ================= LINE 聊天 =================
  const phone = $('#phone'), phoneBody = $('#phone .ph-body'), phoneTitle = $('#phone .ph-title');
  function faceStyle(id, px) {
    const c = A.ch[id]; if (!c || !c.face) return '';
    const expr = c.exprs[0], [cx, cy, size] = c.face, k = px / (size || 400);
    return `background-image:url("${spritePath(id, expr)}");background-size:${1024 * k}px ${1536 * k}px;background-position:${-(cx * k - px / 2)}px ${-(cy * k - px / 2)}px`;
  }
  function lineOpen(title) {
    S.line = { title, msgs: [] };
    phoneTitle.textContent = title; phoneBody.innerHTML = '';
    phone.classList.add('on');
  }
  function lineClose() { S.line = null; phone.classList.remove('on'); }
  function lineAdd(name, text, animate = true) {
    const me = name === PROTAG;
    const id = speakerId(name);
    const d = document.createElement('div'); d.className = 'ph-msg' + (me ? ' me' : '') + (animate ? ' pop' : '');
    const sticker = text.match(/^\[贴图[:：](.+)\]$/);
    const prevMsg = S.line.msgs[S.line.msgs.length - 1];
    const cont = prevMsg && prevMsg.name === name;
    d.innerHTML = (me ? '' : `<div class="ph-icon" style='${cont ? '' : faceStyle(id, 64)}'></div>`) +
      `<div class="ph-col">${(!me && !cont) ? '<div class="ph-name"></div>' : ''}<div class="${sticker ? 'ph-sticker' : 'ph-bubble'}"></div></div>`;
    if (cont && !me) d.querySelector('.ph-icon').classList.add('blank');
    const nm = d.querySelector('.ph-name'); if (nm) nm.textContent = (A.ch[id] && A.ch[id].lineName) || name;
    d.querySelector(sticker ? '.ph-sticker' : '.ph-bubble').textContent = sticker ? sticker[1] : text;
    phoneBody.appendChild(d);
    S.line.msgs.push({ name, text }); if (S.line.msgs.length > 40) S.line.msgs.shift();
    phoneBody.scrollTop = phoneBody.scrollHeight;
  }
  function lineRestore() {
    if (!S.line) { phone.classList.remove('on'); return; }
    const msgs = S.line.msgs; S.line.msgs = [];
    phoneTitle.textContent = S.line.title; phoneBody.innerHTML = ''; phone.classList.add('on');
    msgs.forEach(m => lineAdd(m.name, m.text, false));
  }

  // ================= 文本 =================
  const tb = $('#textbox'), textEl = $('#text'), nameEl = $('#name'), waitMark = $('#wait-mark');
  let typing = false, typeSkip = false;
  function charDelay() { return Math.max(0, 80 - cfg.textSpeed * 0.8); }
  function renderText(str) {
    // ｛…｝= 小声嘀咕；〔…〕= 被干扰、发出杂音的字（全息影像说话时）
    textEl.innerHTML = '';
    const spans = [];
    let small = false, gl = false;
    for (const ch of str) {
      if (ch === '｛') { small = true; continue; }
      if (ch === '｝') { small = false; continue; }
      if (ch === '〔') { gl = true; continue; }
      if (ch === '〕') { gl = false; continue; }
      const s = document.createElement('span'); s.className = 'ch' + (small ? ' small' : '') + (gl ? ' gl' : ''); s.textContent = ch;
      if (gl) s.style.animationDelay = (-Math.random()).toFixed(2) + 's';
      textEl.appendChild(s); spans.push(s);
    }
    return spans;
  }
  const faceBox = $('#facebox'), faceImg = $('#facebox .face-img');
  // 对话框头像：不在画面上的人说话时显示（电话、留言）。主角朱说话、或者心声（整行括号）时也显示她的头像
  function updateFace(name, thought) {
    const id = speakerId(name) || (thought ? (S.pov || A.protagonistId) : null), c = id && A.ch[id];
    if (!c || !c.face || S.sprites[id] || S.cg) { faceBox.classList.remove('on'); return; }
    const expr = (S.lastExpr && S.lastExpr[id]) || c.exprs[0];
    const [cx, cy, size] = c.face, k = 172 / (size || 400);
    faceImg.style.backgroundImage = `url("${spritePath(id, expr)}"), url("${spritePath(id, c.exprs[0])}")`;
    faceImg.style.backgroundSize = `${1024 * k}px ${1536 * k}px`;
    faceImg.style.backgroundPosition = `${-(cx * k - 86)}px ${-(cy * k - 86)}px`;
    faceBox.style.setProperty('--accent', c.color || '#f29bb8');
    faceBox.classList.add('on');
  }
  function nameColor(name) {
    const id = speakerId(name); const c = id && A.ch[id];
    return c && c.color ? c.color : (name === PROTAG ? '#cfe3ff' : '#ffe3c2');
  }
  async function showText(name, text) {
    if (pendingReveal) { pendingReveal = false; await revealFromCard(); }
    tb.classList.remove('hidden');
    nameEl.textContent = name;
    tb.style.setProperty('--name-color', nameColor(name));
    const thought = !name && /^（.*）$/.test(text);
    textEl.classList.toggle('thought', thought);
    focusSpeaker(name);
    updateFace(name, thought);
    S.lastText = text; S.lastName = name;
    backlog.push({ name, text: text.replace(/[｛｝〔〕]/g, '') }); if (backlog.length > 400) backlog.shift();
    const spans = renderText(text);
    waitMark.classList.remove('on');
    const d = charDelay();
    if (isSkipping() || d === 0) { spans.forEach(s => s.classList.add('on')); }
    else {
      typing = true; typeSkip = false;
      for (let i = 0; i < spans.length; i++) {
        if (typeSkip || isSkipping()) { spans.slice(i).forEach(s => s.classList.add('on')); break; }
        spans[i].classList.add('on');
        const ch = spans[i].textContent;
        await sleep(/[。！？…—]/.test(ch) ? d * 3 : /[，、；：]/.test(ch) ? d * 2 : d);
      }
      typing = false;
    }
    waitMark.classList.add('on');
  }

  // ================= 运行 =================
  async function run(id) {
    while (id === runId) {
      const op = ops[pc];
      if (!op) { await toTitle(); return; }
      pc++;
      try { await exec(op, id); } catch (e) { console.error('脚本错误 @', op.line, op, e); }
    }
  }
  function jump(label) {
    if (!(label in labels)) { console.error('未找到标签', label); return; }
    pc = labels[label];
  }
  function applyFx(list) {
    list.forEach(f => {
      const m = f.match(/^(\w+)(\+=|-=|\+|-|=)(-?\d+)$/);
      if (!m) return;
      const [, k, o, v] = m, n = +v, cur = S.vars[k] || 0;
      S.vars[k] = o === '=' ? n : (o[0] === '+' ? cur + n : cur - n);
    });
  }

  // ================= 色相 =================
  // 朱的犯罪系数从头到尾都是 24（祖母死后一次都没动过）；美佳的是变量 mika
  function hueValue(who) {
    if (who === 'mika') return S.vars.mika == null ? null : Math.max(0, S.vars.mika);
    return 24;
  }
  function hueInfo(v) {
    if (v == null) return { color: '#555b66', label: '——' };
    if (v < 40) return { color: '#bfe9ff', label: '清澈' };
    if (v < 60) return { color: '#8fd6c8', label: '良好' };
    if (v < 80) return { color: '#d8c56a', label: '轻度浑浊' };
    if (v < 100) return { color: '#d98a4a', label: '浑浊　需要护理' };
    return { color: '#7a3b3b', label: '潜在犯判定' };
  }
  const HUE_WHO = { akane: { id: 'akane', name: '常守 朱', sub: '公安局刑事课一系　监视官' }, mika: { id: 'mika', name: '霜月 美佳', sub: '公安局刑事课一系　监视官' } };
  function hueRow(who, big) {
    const w = HUE_WHO[who], v = hueValue(who), h = hueInfo(v);
    return `<div class="hue-row${big ? ' big' : ''}" style="--hc:${h.color}"><div class="hue-face" style='${faceStyle(w.id, big ? 120 : 84)}'></div>
      <div class="hue-info"><div class="hue-name">${w.name}</div><div class="hue-sub">${w.sub}</div><div class="hue-bar"><span style="width:${v == null ? 0 : Math.min(100, v / 1.5)}%"></span><i></i></div></div>
      <div class="hue-num"><small>犯罪系数</small><b>${v == null ? '—' : v}</b><em>${h.label}</em></div></div>`;
  }
  function showHue(who) {
    if (!HUE_WHO[who]) return;
    const box = $('#hue-pop');
    box.innerHTML = '<div class="hue-head">PSYCHO-PASS　色相检查</div>' + hueRow(who);
    box.classList.remove('on'); void box.offsetWidth; box.classList.add('on');
    if (!isSkipping()) AudioSys.se('hue');
    clearTimeout(showHue.t); showHue.t = setTimeout(() => box.classList.remove('on'), isSkipping() ? 600 : 4800);
  }
  function openHue() {
    $('#hue-screen .hue-list').innerHTML = hueRow('akane', true) + (S.vars.mika == null ? '' : hueRow('mika', true));
    showScreen('hue-screen');
  }

  // ================= 搜查档案 =================
  function unlockTip(id) {
    const t = A.tips.find(x => x.id === id); if (!t) return;
    if (glob.tips.includes(id)) return;
    glob.tips.push(id); globDirty = true;
    const p = $('#tip-pop'); p.querySelector('b').textContent = t.title;
    p.classList.remove('on'); void p.offsetWidth; p.classList.add('on');
    if (!isSkipping()) AudioSys.se('tip');
    clearTimeout(unlockTip.t); unlockTip.t = setTimeout(() => p.classList.remove('on'), 2600);
  }
  function openTips(sel) {
    const list = $('#tips-screen .tips-list'), body = $('#tips-screen .tips-body');
    list.innerHTML = '';
    const open = A.tips.filter(t => glob.tips.includes(t.id));
    const cur = sel || (open[0] && open[0].id);
    A.tips.forEach(t => {
      const ok = glob.tips.includes(t.id), b = document.createElement('button');
      b.className = 'tip-item' + (ok ? '' : ' locked') + (t.id === cur ? ' on' : '');
      b.textContent = ok ? t.title : '？？？';
      if (ok) b.onclick = e => { e.stopPropagation(); openTips(t.id); };
      list.appendChild(b);
    });
    const t = A.tips.find(x => x.id === cur);
    body.innerHTML = t ? '<h3></h3><p></p>' : '<p class="tips-empty">还没有档案。</p>';
    if (t) { body.querySelector('h3').textContent = t.title; body.querySelector('p').textContent = t.text; }
    $('#tips-screen .tips-count').textContent = `${open.length} / ${A.tips.length}`;
    showScreen('tips-screen');
  }

  // ================= 主宰者 =================
  // @scan 名字|数值|判定 —— 一直显示到 @scan off
  async function showScan([name = '', val = '—', verdict = ''], instant) {
    const box = $('#scan');
    S.scan = [name, val, verdict];
    const num = box.querySelector('.sc-num'), vd = box.querySelector('.sc-verdict');
    box.querySelector('.sc-name').textContent = name;
    const lethal = /处决|分解/.test(verdict), para = /瘫痪/.test(verdict), lock = /对象外|锁定/.test(verdict);
    vd.querySelector('small').textContent = lock ? 'NOT A TARGET ── TRIGGER LOCKED' : /分解/.test(verdict) ? 'ENFORCEMENT MODE ── DESTROY DECOMPOSER' : lethal ? 'ENFORCEMENT MODE ── LETHAL ELIMINATOR' : para ? 'ENFORCEMENT MODE ── NON-LETHAL PARALYZER' : 'ENFORCEMENT MODE';
    vd.querySelector('span').textContent = verdict;
    box.classList.toggle('lethal', lethal); box.classList.toggle('para', para); box.classList.toggle('lock', lock);
    const n = parseInt(val, 10), fin = isNaN(n) ? val : String(n);
    if (instant || isSkipping()) { num.textContent = fin; vd.classList.add('on'); box.classList.add('on'); return; }
    vd.classList.remove('on'); num.textContent = '';
    box.classList.remove('on'); void box.offsetWidth; box.classList.add('on');
    AudioSys.se('dom_scan');
    const t0 = Date.now();
    while (Date.now() - t0 < 1300) {
      num.textContent = isNaN(n) ? ['—', '…', '·'][(Date.now() / 90 | 0) % 3] : String(Math.floor(Math.random() * 399)).padStart(3, '0');
      const v = await wait(60, true); if (v === 'abort') return; if (v === 'click') break;
    }
    num.textContent = fin; vd.classList.add('on');
    AudioSys.se(lethal ? 'dom_lethal' : lock ? 'dom_lock' : 'tip');
    await wait(500, true);
  }
  function hideScan() { S.scan = null; $('#scan').classList.remove('on'); }

  // ================= 倒数卡 / 故障 / 惊吓 =================
  async function countdownCard([n, date]) {
    tb.classList.add('hidden'); hideSprite('all'); lineClose(); hideScan();
    const card = $('#countdown'), zero = +n === 0;
    card.classList.toggle('zero', zero);
    card.querySelector('.cd-num').textContent = zero ? '四十九日' : n;
    card.querySelector('.cd-date').textContent = date || '';
    await curtain(true, 700);
    card.classList.add('on');
    autoSave();
    if (!isSkipping()) AudioSys.se('countdown');
    await wait(isSkipping() ? 300 : 3600, true);
    clearSpritesNow();
    card.classList.remove('on');
    await sleep(isSkipping() ? 0 : 800);
    pendingReveal = true;
  }
  function glitch(ms = 600) {
    if (isSkipping()) return;
    stage.style.setProperty('--gl-ms', ms + 'ms');
    stage.classList.remove('glitch'); void stage.offsetWidth; stage.classList.add('glitch');
    AudioSys.se('glitch');
    clearTimeout(glitch.t); glitch.t = setTimeout(() => stage.classList.remove('glitch'), ms);
  }
  // 枪声：音效 + 闪光 + 震动；快进时只留一下闪光
  async function shots(n, kind) {
    const f = $('#layer-flash');
    for (let i = 0; i < n; i++) {
      if (!isSkipping()) AudioSys.se(kind === 'rifle' ? 'shot_rifle' : kind === 'silenced' ? 'shot_silenced' : 'shot');
      f.style.background = kind === 'silenced' ? 'rgba(255,240,220,.35)' : '#fff6e0'; f.style.transition = 'none'; f.style.opacity = kind === 'silenced' ? 0.25 : 0.55; void f.offsetWidth;
      f.style.transition = 'opacity .18s ease'; f.style.opacity = 0;
      if (kind !== 'silenced') { stage.classList.remove('shake'); void stage.offsetWidth; stage.classList.add('shake'); }
      if (isSkipping()) break;
      await sleep(kind === 'rifle' ? 300 : 140 + Math.random() * 90);
    }
  }
  // 千束的心跳：边缘红色脉动两下
  function heartPulse() {
    if (!isSkipping()) AudioSys.se('heartbeat');
    const p = $('#layer-pulse'); if (!p) return;
    p.classList.remove('on'); void p.offsetWidth; p.classList.add('on');
  }
  async function scare(id) {
    if (pendingReveal) { pendingReveal = false; await revealFromCard(); }
    if (isSkipping() || cfg.scare === 0) { await setCg(id, 300); return; }
    await setCg(id, 0);
    AudioSys.se('scare');
    if (cfg.scare >= 2) { stage.classList.remove('shake'); void stage.offsetWidth; stage.classList.add('shake'); const f = $('#layer-flash'); f.style.background = '#600'; f.style.transition = 'none'; f.style.opacity = 0.7; void f.offsetWidth; f.style.transition = 'opacity .7s ease'; f.style.opacity = 0; }
    glitch(cfg.scare >= 2 ? 450 : 200);
    await wait(700, false);
  }
  function evalCond(c) {
    try {
      const expr = c.replace(/[A-Za-z_]\w*/g, k => (k === 'true' || k === 'false') ? k : String(S.vars[k] || 0));
      if (/[^\d\s<>=!&|()+\-*.]/.test(expr)) return false;
      return !!Function('return (' + expr + ')')();
    } catch (e) { console.error('条件错误', c); return false; }
  }

  async function exec(op, id) {
    if (op.t === 'say') {
      const wasRead = readSet.has(op.key);
      if (isSkipping() && !wasRead && !cfg.skipUnread) { skipMode = false; updateIndicators(); }
      if (S.line && op.name) {
        // LINE 消息
        if (pendingReveal) { pendingReveal = false; await revealFromCard(); }
        tb.classList.add('hidden');
        if (!isSkipping()) AudioSys.se(op.name === PROTAG ? 'line_send' : 'line_recv');
        lineAdd(op.name, op.text);
        backlog.push({ name: op.name + '（LINE）', text: op.text });
        S.lastText = op.text; S.lastName = op.name;
        readSet.add(op.key); globDirty = true;
        await waitAdvance(op.text, id);
        return;
      }
      await showText(op.name, op.text);
      readSet.add(op.key); globDirty = true;
      await waitAdvance(op.text, id);
      return;
    }
    if (op.t === 'choice') {
      skipMode = false; updateIndicators();
      if (pendingReveal) { pendingReveal = false; await revealFromCard(); }
      autoSave();
      const box = $('#choices'); box.innerHTML = '';
      const opts = op.opts.filter(o => !o.cond || evalCond(o.cond));
      const pick = await new Promise(res => {
        opts.forEach((o, i) => {
          const b = document.createElement('button'); b.textContent = o.text; b.style.animationDelay = (i * 0.12) + 's';
          if (o.lock && !evalCond(o.lock)) {
            // 条件不满足：显示，但不能选
            b.textContent = o.text + '（条件未满足）';
            b.classList.add('locked'); b.disabled = true;
            b.onclick = e => { e.stopPropagation(); AudioSys.se('click'); };
          } else b.onclick = e => { e.stopPropagation(); AudioSys.se('select'); res(o); };
          box.appendChild(b);
        });
        box.classList.add('on');
        const abortCheck = setInterval(() => { if (id !== runId) { clearInterval(abortCheck); res(null); } }, 200);
      });
      box.classList.remove('on'); box.innerHTML = '';
      if (!pick || id !== runId) return;
      backlog.push({ name: '▶', text: pick.text });
      applyFx(pick.fx, op.key + '/' + op.opts.indexOf(pick));
      // 记下这次的选择。glob.picks 是每个选项「最后一次」选的答案：从分支图跳到任何节点时都按它来算（见 applyLatestPicks）
      const pi = op.opts.indexOf(pick); (S.picks = S.picks || {})[op.key] = pi;
      (glob.picks = glob.picks || {})[op.key] = pi; globDirty = true;
      if (pick.target) jump(pick.target);
      return;
    }
    const a = op.args, r = op.rest;
    switch (op.cmd) {
      case 'bg': {
        const keep = a.includes('keep');
        const args = a.filter(x => x !== 'keep');
        if (!keep) { hideSprite('all'); setFx('none'); hideScan(); }
        if (S.line) lineClose();
        await setBg(args[0], args[1] || 'dissolve', args[2] ? +args[2] : (args[1] === 'black' ? 1400 : 900));
        if (!keep) clearSpritesNow();
        else if (WEATHER.includes(S.fx) && !isOutdoor(S.bg)) setFx('none');
        break;
      }
      case 'cg': await setCg(a[0], a[1] ? +a[1] : 1000); break;
      case 'show': {
        const [cid, expr, ...rest] = a;
        let pos, anim, size, flip;
        rest.forEach(t => { if (POS[t]) pos = t; else if (t === 'close' || t === 'far') size = t === 'close' ? 'close' : 'normal'; else if (t === 'flip') flip = true; else if (t === 'noflip') flip = false; else anim = t; });
        showSprite(cid, expr || 'normal', pos, anim, size, flip);
        await sleep(isSkipping() ? 0 : 120);
        break;
      }
      case 'hide': hideSprite(a[0] || 'all'); await sleep(isSkipping() ? 0 : 250); break;
      // 淡入淡出时长：小于 50 的数按秒算，否则按毫秒算（剧本里两种写法都有）
      case 'bgm': { const sec0 = v => v == null ? null : (+v < 50 ? +v : +v / 1000), sec = v => isSkipping() ? 0.1 : sec0(v); // 快进时换曲不做长淡入淡出
        if (a[0] === 'stop') { AudioSys.stopTheme(sec(a[1]) ?? 2); S.bgm = null; } else { AudioSys.playTheme(a[0], sec(a[1]) ?? 1.5); S.bgm = a[0]; } break; }
      case 'amb': { const sec = v => v == null || isNaN(+v) ? null : (+v < 50 ? +v : +v / 1000);
        if (a[0] === 'stop') { AudioSys.stopAmb(a[1], 2); S.amb = a[1] ? S.amb.filter(x => x !== a[1]) : []; }
        else { AudioSys.startAmb(a[0], sec(a[1]) ?? 2); if (!S.amb.includes(a[0])) S.amb.push(a[0]); }
        break; }
      case 'se': if (!isSkipping()) AudioSys.se(a[0]); break;
      case 'wait': if (pendingReveal) { pendingReveal = false; await revealFromCard(); } await wait(+a[0] || 500); break;
      case 'shake': stage.classList.remove('shake'); void stage.offsetWidth; stage.classList.add('shake'); break;
      case 'flash': { const f = $('#layer-flash'); f.style.background = a[0] || '#fff'; f.style.transition = 'none'; f.style.opacity = 0.9; void f.offsetWidth; f.style.transition = 'opacity .9s ease'; f.style.opacity = 0; break; }
      case 'black': await curtain(true, a[0] ? +a[0] : 800); break;
      case 'white': await curtain(true, a[0] ? +a[0] : 800, '#fff'); break;
      case 'reveal': await curtain(false, a[0] ? +a[0] : 800); break;
      case 'fx': setFx(a[0] || 'none'); break;
      case 'tint': setTint(a[0] || 'none'); break;
      case 'mode': S.mode = a[0] || 'normal'; tb.classList.remove('tape', 'phone'); if (S.mode !== 'normal') tb.classList.add(S.mode); break;
      case 'line': if (!a[0] || a[0] === 'off') lineClose(); else lineOpen(r); break;
      case 'muffle': S.muffle = a[0] === 'on'; AudioSys.setMuffle(S.muffle, a[1] ? +a[1] / 1000 : 1.5); break;
      case 'textbox': if (a[0] === 'hide') tb.classList.add('hidden'); else tb.classList.remove('hidden'); break;
      case 'chapter': await chapterCard(r.split('|')); break;
      case 'date': showDate(r.split('|')); break;
      case 'center': await centerText(r.replace(/\\n/g, '\n')); break;
      case 'set': applyFx(a, op.key); break;
      case 'face': (S.lastExpr = S.lastExpr || {})[a[0]] = a[1] || 'normal'; break;
      case 'if': { const [cond, target] = r.split('=>').map(s => s.trim()); if (evalCond(cond)) jump(target); break; }
      case 'jump': jump(a[0]); break;
      case 'ending': await endingCard(a[0]); break;
      case 'credits': await credits(a[0]); break;
      case 'totitle': await toTitle(); break;
      case 'autosave': autoSave(); break;
      case 'node': recordNode(r.split('|')[0]); break;
      case 'route': S.route = a[0]; glob.route = a[0]; saveGlobal(); break;
      case 'scan': if (!a[0] || a[0] === 'off') hideScan(); else { if (pendingReveal) { pendingReveal = false; await revealFromCard(); } await showScan(r.replace(/\$(\w+)/g, (_, k) => String(S.vars[k] || 0)).split('|')); } break; // $变量 = 当前值
      case 'hue': showHue(a[0]); break;
      case 'tip': unlockTip(a[0]); break;
      case 'countdown': await countdownCard(r.split('|')); break;
      case 'glitch': glitch(a[0] ? +a[0] : 600); break;
      case 'pov': S.pov = (a[0] && a[0] !== A.protagonistId) ? a[0] : null; break;
      case 'shot': await shots(+a[0] || 1, a[1] || 'pistol'); break;
      case 'heart': heartPulse(); break;
      case 'scare': await scare(a[0]); break;
      default: console.warn('未知命令', op.cmd);
    }
  }

  async function waitAdvance(text, id) {
    while (id === runId) {
      if (isSkipping()) { await sleep(cfg.textSpeed > 95 ? 25 : 45); if (isSkipping()) return; }
      if (autoMode) {
        const ms = 900 + (110 - cfg.autoSpeed) * 14 + text.length * (95 - cfg.autoSpeed * 0.6);
        const v = await wait(ms, true);
        if (v === 'abort') return;
        if (v === 'time' && !autoMode && !isSkipping()) { continue; }
        return;
      }
      const v = await waitClickOrMode();
      if (v === 'abort') return;
      if (v === 'mode') continue;
      return;
    }
  }
  function waitClickOrMode() { return new Promise(r => { clickResolver = r; modeResolver = () => r('mode'); }); }
  let modeResolver = null;
  function modeChanged() { if (modeResolver) { const m = modeResolver; modeResolver = null; if (clickResolver) clickResolver = null; m(); } }

  async function revealFromCard() {
    const card = $('#chapter-card');
    if (card.classList.contains('on')) { card.classList.remove('on'); }
    await curtain(false, 900);
  }
  async function chapterCard([num, title, sub]) {
    tb.classList.add('hidden');
    hideSprite('all'); lineClose(); hideScan();
    const card = $('#chapter-card');
    card.classList.remove('ending');
    card.querySelector('.cc-num').textContent = num || '';
    card.querySelector('.cc-title').textContent = title || '';
    card.querySelector('.cc-sub').textContent = sub || '';
    S.chapter = (num ? num + ' ' : '') + (title || '');
    await curtain(true, 700);
    card.classList.add('on');
    autoSave();
    if (!isSkipping()) AudioSys.se('chapter');
    await wait(isSkipping() ? 300 : 3800, true);
    clearSpritesNow();
    card.classList.remove('on');
    await sleep(isSkipping() ? 0 : 900);
    pendingReveal = true;
  }
  function showDate([main, sub]) {
    const d = $('#date-card');
    d.querySelector('.date-main').textContent = main || '';
    d.querySelector('.date-sub').textContent = sub || '';
    d.classList.add('show');
    clearTimeout(showDate.t);
    showDate.t = setTimeout(() => d.classList.remove('show'), 4200);
  }
  async function centerText(t) {
    if (pendingReveal) { pendingReveal = false; }
    const el = $('#center-text');
    tb.classList.add('hidden');
    el.textContent = t; el.classList.add('on');
    backlog.push({ name: '', text: t });
    S.lastText = t;
    await sleep(isSkipping() ? 0 : 700);
    if (isSkipping()) await sleep(200);
    else if (autoMode) await wait(2500 + t.length * 60);
    else await waitClick();
    el.classList.remove('on');
    await sleep(isSkipping() ? 0 : 700);
  }
  async function endingCard(eid) {
    skipMode = false; updateIndicators();
    const e = A.endings.find(x => x.id === eid) || { tag: 'END', title: eid };
    if (!glob.endings.includes(eid)) glob.endings.push(eid);
    glob.cleared = true;
    saveGlobal();
    tb.classList.add('hidden'); lineClose();
    await curtain(true, 1500);
    const card = $('#chapter-card');
    card.classList.add('ending');
    card.style.setProperty('--end-color', e.color || '#f29bb8');
    card.querySelector('.cc-num').textContent = e.tag;
    card.querySelector('.cc-title').textContent = e.title;
    card.querySelector('.cc-sub').textContent = e.sub || '';
    card.classList.add('on');
    await sleep(2500);
    await waitClick();
    card.classList.remove('on');
    await sleep(1000);
  }
  async function credits(cgName) {
    const c = $('#credits'), roll = $('#credits-roll');
    tb.classList.add('hidden');
    roll.innerHTML = A.credits(cgName);
    c.classList.add('on');
    await sleep(100);
    const h = roll.scrollHeight;
    const dur = 56000;
    roll.style.transition = 'none'; roll.style.transform = 'translateY(0)';
    void roll.offsetWidth;
    roll.style.transition = `transform ${dur}ms linear`; roll.style.transform = `translateY(${-(h + stageH - 300)}px)`;
    let fast = false;
    const t0 = Date.now();
    while (Date.now() - t0 < dur && !fast) {
      const v = await wait(500, true);
      if (v === 'click' && Date.now() - t0 > 3000) fast = true;
      if (v === 'abort') break;
    }
    c.classList.remove('on');
  }

  function updateIndicators() {
    const q = $('#quickmenu');
    q.querySelector('[data-act=auto]').classList.toggle('on', autoMode);
    q.querySelector('[data-act=skip]').classList.toggle('on', skipMode);
    const mi = $('#mode-indicator');
    mi.textContent = isSkipping() ? '▶▶ 快进' : autoMode ? '▶ 自动' : '';
    mi.classList.toggle('on', isSkipping() || autoMode);
  }

  // ================= 存档 =================
  function snapshot() {
    const op = ops[Math.max(0, pc - 1)];
    return { key: op ? op.key : ops[0].key, S: JSON.parse(JSON.stringify(S)), time: Date.now(),
      chapter: S.chapter, text: (S.lastName ? S.lastName + '：' : '') + S.lastText, thumb: S.cg ? 'assets/cg/' + S.cg + '.webp' : (bgSrc(S.bg) || '') };
  }
  function writeSlot(slot) { LS.set('save_' + slot, snapshot()); }
  function autoSave() { if (inGame) writeSlot('auto'); }
  async function restore(data) {
    runId++; abortWaits();
    await sleep(30);
    S = Object.assign(freshState(), data.S);
    $('#choices').classList.remove('on'); $('#center-text').classList.remove('on'); $('#chapter-card').classList.remove('on'); $('#credits').classList.remove('on');
    pendingReveal = false;
    const spr = Object.assign({}, S.sprites);
    clearSpritesNow();
    await setBg(S.bg || 'black', 'cut');
    ['a', 'b'].forEach(k => { $('#cg-' + k).style.opacity = 0; });
    if (data.S.cg) await setCg(data.S.cg, 0); else S.cg = null;
    Object.entries(spr).forEach(([id, v]) => showSprite(id, v.expr, v.pos, null, v.size, v.flip));
    if (S.scan) showScan(S.scan, true); else hideScan();
    setFx(S.fx || 'none'); setTint(S.tint || 'none');
    lineRestore();
    tb.classList.remove('tape', 'phone'); if (S.mode && S.mode !== 'normal') tb.classList.add(S.mode);
    AudioSys.stopAmb(null, 0.5);
    if (S.bgm) { AudioSys.stopTheme(0.3); AudioSys.playTheme(S.bgm, 1.5); } else AudioSys.stopTheme(0.5);
    (S.amb || []).forEach(n => AudioSys.startAmb(n, 1.5));
    AudioSys.setMuffle(!!S.muffle, 0.3);
    await curtain(false, 400);
    const idx = keyIndex[data.key];
    pc = idx != null ? idx : 0;
    backlog = [];
    showScreen(null);
    inGame = true;
    const id = runId;
    run(id);
  }
  function slotData(slot) { return LS.get('save_' + slot, null); }
  function fmtTime(t) { const d = new Date(t); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; }

  let saveMode = 'save', savePage = 1;
  function openSave(mode) {
    saveMode = mode;
    const sc = $('#save-screen');
    sc.querySelector('.panel-title').textContent = mode === 'save' ? '存档' : '读档';
    if (mode === 'save' && savePage === 0) savePage = 1;
    renderSave();
    showScreen('save-screen');
  }
  function renderSave() {
    const pages = $('#save-screen .save-pages'); pages.innerHTML = '';
    const pnames = saveMode === 'load' ? ['自动·快速', '1', '2', '3', '4', '5'] : ['1', '2', '3', '4', '5'];
    pnames.forEach((n, i) => {
      const p = saveMode === 'load' ? i : i + 1;
      const b = document.createElement('button'); b.textContent = n; if (p === savePage) b.classList.add('on');
      b.onclick = () => { savePage = p; renderSave(); };
      pages.appendChild(b);
    });
    const grid = $('#save-screen .save-grid'); grid.innerHTML = '';
    const slots = savePage === 0 ? ['auto', 'quick'] : Array.from({ length: 6 }, (_, i) => String((savePage - 1) * 6 + i + 1));
    slots.forEach(slot => {
      const d = slotData(slot);
      const el = document.createElement('div'); el.className = 'save-slot' + (d ? '' : ' empty');
      const label = slot === 'auto' ? '自动存档' : slot === 'quick' ? '快速存档' : 'No.' + slot.padStart(2, '0');
      if (d) el.innerHTML = `<div class="save-thumb" style="background-image:url('${d.thumb}')"></div><div class="save-info"><div class="save-no">${label}</div><div class="save-chap">${d.chapter || ''}</div><div class="save-date">${fmtTime(d.time)}</div><div class="save-snip"></div></div>`;
      else el.innerHTML = `<div class="save-thumb"></div><div class="save-info">${label}<br>— 空 —</div>`;
      if (d) el.querySelector('.save-snip').textContent = d.text;
      el.onclick = async () => {
        if (saveMode === 'save') {
          if (d && !(await confirmBox('覆盖这个存档吗？'))) return;
          writeSlot(slot); AudioSys.se('save'); renderSave(); toast('已存档');
        } else if (d) {
          if (inGame && !(await confirmBox('读取这个存档吗？\n未保存的进度将会丢失。'))) return;
          AudioSys.se('load'); hideTitle(); restore(d);
        } else AudioSys.se('click');
      };
      grid.appendChild(el);
    });
  }

  // ================= 分支图 =================
  // 节点 = 剧本里的 @node。经过节点时记录当时的完整状态，之后可以从分支图点回来。
  const nodeSnaps = LS.get('nodes', {});
  // 跳到某个节点时：这个节点经过的选项里，答案和「最后一次选的」不一样的，撤掉旧答案的效果、换成新答案的效果。
  // 这样在前面改了选择（例如删除奶奶的账号），再跳到后面的节点也照样生效。
  function applyLatestPicks(snap) {
    const d = JSON.parse(JSON.stringify(snap)), V = d.S.vars = d.S.vars || {}, P = d.S.picks || {};
    const latest = glob.picks || {};
    Object.entries(latest).forEach(([key, now]) => {
      const op = ops[keyIndex[key]]; if (!op || op.t !== 'choice' || !op.opts[now]) return;
      let old = P[key];
      if (old == null) {
        // 旧版本的存档没有记录选项：只能靠「=」赋值的变量（例如 keep）反推当时选了哪个
        old = op.opts.findIndex(o => o.fx.some(f => { const m = f.match(/^(\w+)=(-?\d+)$/); return m && m[1] in V && V[m[1]] === +m[2]; }));
        if (old < 0) return;
      }
      if (old === now) return;
      op.opts[old].fx.forEach(f => { const m = f.match(/^(\w+)(\+|-)(\d+)$/); if (m) V[m[1]] = (V[m[1]] || 0) + (m[2] === '+' ? -m[3] : +m[3]); });
      op.opts[now].fx.forEach(f => { const m = f.match(/^(\w+)(\+|-|=)(-?\d+)$/); if (m) V[m[1]] = m[2] === '=' ? +m[3] : (V[m[1]] || 0) + (m[2] === '+' ? +m[3] : -m[3]); });
      P[key] = now;
    });
    d.S.picks = P;
    return d;
  }
  function recordNode(id) {
    if (!inGame) return;
    nodeSnaps[id] = snapshot(); glob.lastNode = id;
    if (!glob.seen) glob.seen = []; if (!glob.seen.includes(id)) glob.seen.push(id);
    LS.set('nodes', nodeSnaps); globDirty = true;
  }
  let flowGraph = null;
  function buildFlow() {
    if (flowGraph) return flowGraph;
    const nodes = [], byIdx = {}, edges = new Set();
    // 章节：@chapter 号|标题|副标题。序章的标题卡号是空的，和它前面那一场一起算「序章」
    let chap = { key: '序章', num: '序章', title: '', sub: '' };
    ops.forEach((op, i) => {
      if (op.t === 'cmd' && op.cmd === 'chapter') {
        const [num = '', title = '', sub = ''] = op.rest.split('|').map(s => s.trim());
        if (num) chap = { key: num + title, num, title, sub };
      }
      if (op.t === 'cmd' && op.cmd === 'node') { const [id, title] = op.rest.split('|'); const n = { id, title: title || id, idx: i, chap }; nodes.push(n); byIdx[i] = n; }
      if (op.t === 'cmd' && op.cmd === 'ending') { const id = 'END_' + op.args[0]; if (!nodes.find(n => n.id === id)) { const e = A.endings.find(x => x.id === op.args[0]) || {}; const n = { id, title: e.title || op.args[0], idx: i, chap, end: op.args[0], tag: e.tag || 'END', ecolor: e.color }; nodes.push(n); byIdx[i] = n; } }
    });
    // 从每个节点往后走，直到遇到下一个节点（连一条边）
    nodes.filter(n => !n.end).forEach(src => {
      const seen = new Set(), stack = [src.idx + 1];
      while (stack.length) {
        let i = stack.pop();
        while (i < ops.length && !seen.has(i)) {
          seen.add(i);
          const op = ops[i];
          if (byIdx[i] && byIdx[i] !== src) { edges.add(src.id + '>' + byIdx[i].id); break; }
          if (op.t === 'choice') { op.opts.forEach(o => { if (o.target && o.target in labels) stack.push(labels[o.target]); else stack.push(i + 1); }); break; }
          if (op.t === 'cmd' && op.cmd === 'jump') { if (op.args[0] in labels) stack.push(labels[op.args[0]]); break; }
          if (op.t === 'cmd' && op.cmd === 'if') { const t = op.rest.split('=>')[1].trim(); if (t in labels) stack.push(labels[t]); i++; continue; }
          if (op.t === 'cmd' && op.cmd === 'totitle') break;
          i++;
        }
      }
    });
    const ins = {}; nodes.forEach(n => { ins[n.id] = []; });
    const E = [...edges].map(e => e.split('>'));
    E.forEach(([a, b]) => ins[b].push(a));
    // 深度 = 最长路径（同一深度的节点画在同一行）
    const col = {}; nodes.forEach(n => { col[n.id] = 0; });
    for (let pass = 0; pass < nodes.length; pass++) { let changed = false; E.forEach(([a, b]) => { if (col[b] < col[a] + 1) { col[b] = col[a] + 1; changed = true; } }); if (!changed) break; }
    // 线路：正线 / NORMAL / BAD。前驱全在同一条支线上的节点跟着它走（例如 NORMAL 结局里的渡轮）
    const BAD = A.endings.filter(e => e.tag === 'BAD END').map(e => e.id);
    const lane = {};
    nodes.forEach(n => { lane[n.id] = /^bad_/.test(n.id) || (n.end && BAD.includes(n.end)) ? 'bad' : (/normal/.test(n.id) ? 'normal' : 'main'); });
    for (let pass = 0; pass < 6; pass++) nodes.forEach(n => {
      if (lane[n.id] !== 'main') return;
      const p = ins[n.id].map(a => lane[a]);
      if (p.length && p[0] !== 'main' && p.every(l => l === p[0])) lane[n.id] = p[0];
    });
    // 每个节点的缩略图（这一场第一张 CG / 背景，没有就用进场时的画面）和日期
    let curBg = null, curCg = null, open = null;
    const close = () => { if (open && !open.thumb) open.thumb = open.entry; };
    ops.forEach((op, i) => {
      if (byIdx[i]) { close(); open = byIdx[i]; open.entry = curCg || curBg; }
      if (op.t !== 'cmd') return;
      if (op.cmd === 'bg') { curBg = bgSrc(op.args[0]); curCg = null; if (open && !open.thumb && curBg) open.thumb = curBg; }
      else if (op.cmd === 'cg') { curCg = op.args[0] === 'off' ? null : `assets/cg/${op.args[0]}.webp`; if (open && !open.thumb && curCg) open.thumb = curCg; }
      else if (op.cmd === 'date' && open && !open.date) open.date = op.rest.split('|').map(s => s.trim());
    });
    close();
    nodes.forEach(n => { n.col = col[n.id]; n.lane = lane[n.id]; });
    // 分组：一章一张卡片
    const groups = [];
    nodes.forEach(n => { let g = groups.find(x => x.key === n.chap.key); if (!g) groups.push(g = { key: n.chap.key, num: n.chap.num, title: n.chap.title, sub: n.chap.sub, nodes: [] }); g.nodes.push(n); });
    groups.forEach(g => {
      if (!g.title) g.title = g.nodes[0].title;
      if (!g.sub) { const d = g.nodes.find(n => n.date); if (d) g.sub = d.date[0].split(/[（\s]/)[0]; }
      g.min = Math.min(...g.nodes.map(n => n.col));
      g.rows = Math.max(...g.nodes.map(n => n.col)) - g.min + 1;
      g.lanes = ['main', 'normal', 'bad'].filter(l => g.nodes.some(n => n.lane === l));
      g.nodes.forEach(n => { n.row = n.col - g.min; n.group = g; });
    });
    flowGraph = { nodes, edges: E, groups };
    return flowGraph;
  }
  const LANE_COLOR = { main: '#ef5a5f', normal: '#8fa8d8', bad: '#a596b0' };
  const LANE_NAME = { main: '正线', normal: 'NORMAL', bad: 'BAD END' };
  function openFlow() {
    const g = buildFlow();
    const K = MOBILE ? 1.45 : 1;
    const ROW = Math.round(35 * K), LANE_W = Math.round(196 * K), PAD = Math.round(24 * K), HEAD = Math.round(126 * K), GAP = Math.round(52 * K), TOP = 16;
    const box = $('#flow-screen .flow-canvas');
    const seen = id => !!nodeSnaps[id] || (glob.seen || []).includes(id) || (id.startsWith('END_') && glob.endings.includes(id.slice(4)));
    // 卡片位置
    let x = 20;
    g.groups.forEach(gr => { gr.x = x; gr.w = PAD * 2 + gr.lanes.length * LANE_W - Math.round(18 * K); gr.h = HEAD + gr.rows * ROW + PAD; x += gr.w + GAP; });
    const W = x - GAP + 20, H = TOP + Math.max(...g.groups.map(gr => gr.h)) + 10;
    box.style.width = W + 'px'; box.style.height = H + 'px';
    const pos = {};
    g.nodes.forEach(n => { const gr = n.group; pos[n.id] = { x: gr.x + PAD + gr.lanes.indexOf(n.lane) * LANE_W + Math.round(9 * K), y: TOP + HEAD + n.row * ROW + ROW / 2 }; });
    let html = '', svg = `<svg width="${W}" height="${H}">`;
    const curId = glob.lastNode;
    g.groups.forEach((gr, gi) => {
      const done = gr.nodes.filter(n => seen(n.id)).length, cur = gr.nodes.some(n => n.id === curId);
      const unlocked = done > 0;
      html += `<div class="fl-card${cur ? ' cur' : ''}${unlocked ? '' : ' locked'}" style="left:${gr.x}px;top:${TOP}px;width:${gr.w}px;height:${gr.h}px;--head:${HEAD}px">` +
        `<div class="fl-chead"><div class="fl-cnum">${gr.num}</div><div class="fl-ctitle">${unlocked ? gr.title : '？？？'}</div><div class="fl-csub">${unlocked ? gr.sub : ''}</div>` +
        `<div class="fl-ccount">${done}<i>/</i>${gr.nodes.length}</div></div></div>`;
      if (gi < g.groups.length - 1) html += `<div class="fl-arrow" style="left:${gr.x + gr.w + GAP / 2}px;top:${TOP + HEAD / 2}px"></div>`;
    });
    // 线。折线的拐角做成圆角
    const roundPath = (pts, r) => {
      pts = pts.filter((pt, i) => !i || pt[0] !== pts[i - 1][0] || pt[1] !== pts[i - 1][1]);
      let d = `M${pts[0][0]},${pts[0][1]}`;
      for (let i = 1; i < pts.length - 1; i++) {
        const [px, py] = pts[i - 1], [cx, cy] = pts[i], [nx, ny] = pts[i + 1];
        const l1 = Math.hypot(cx - px, cy - py), l2 = Math.hypot(nx - cx, ny - cy), rr = Math.min(r, l1 / 2, l2 / 2);
        d += ` L${cx + (px - cx) / l1 * rr},${cy + (py - cy) / l1 * rr} Q${cx},${cy} ${cx + (nx - cx) / l2 * rr},${cy + (ny - cy) / l2 * rr}`;
      }
      const last = pts[pts.length - 1];
      return d + ` L${last[0]},${last[1]}`;
    };
    const laneIdx = n => n.group.lanes.indexOf(n.lane);
    g.edges.forEach(([a, b]) => {
      const na = g.nodes.find(n => n.id === a), nb = g.nodes.find(n => n.id === b);
      if (!na || !nb) return;
      const p = pos[a], q = pos[b], lit = seen(a) && seen(b), c = LANE_COLOR[nb.lane === 'main' ? na.lane : nb.lane];
      let pts;
      if (na.group === nb.group) {
        // 同一章：同一条线直着走；换线路时先往下走到两行之间的空隙，横着拐过去，再往下进站（不从文字底下穿过）
        const m = p.y + ROW / 2;
        pts = p.x === q.x ? [[p.x, p.y], [q.x, q.y]] : [[p.x, p.y], [p.x, m], [q.x, m], [q.x, q.y]];
      } else {
        // 跨章：从站点往下走到下一行的空隙，横着出卡片，在卡片之间的空隙里上下走，再横着进下一章。
        // 几条线一起跨章时（第六章 → 终章）错开一点，彼此不交叉：靠右的线路出得高、拐得早、进站从上方绕。出站的横线走在最后一行文字下面
        const li = laneIdx(na), lj = laneIdx(nb), gx = na.group.x + na.group.w + GAP / 2 + Math.round((5 - li * 10) * K);
        const yo = p.y + ROW / 2 + Math.round((4 + (1 - li) * 9) * K), yi = lj === 0 ? q.y : q.y - ROW / 2;
        pts = [[p.x, p.y], [p.x, yo], [gx, yo], [gx, yi], [q.x, yi], [q.x, q.y]];
      }
      svg += `<path d="${roundPath(pts, Math.round(10 * K))}" class="fl-edge${lit ? ' lit' : ''}${na.group === nb.group ? '' : ' cross'}" style="--lc:${c}"/>`;
    });
    svg += '</svg>';
    html += g.nodes.map(n => {
      const ok = seen(n.id), cur = curId === n.id && !n.end, p = pos[n.id];
      const stale = ok && !n.end && !nodeSnaps[n.id]; // 看过、但没有存下状态的节点：显示，不能点
      const c = n.end ? (n.ecolor || LANE_COLOR[n.lane]) : LANE_COLOR[n.lane];
      const cls = `fl-node${ok ? ' on' : ''}${stale ? ' stale' : ''}${n.end ? ' end' : ''}${cur ? ' cur' : ''}`;
      const inner = n.end ? `<i class="dot"></i><span class="tag">${ok ? n.tag : 'END'}</span><span class="lbl">${ok ? n.title : '？？？'}</span>`
        : `<i class="dot"></i><span class="lbl">${ok ? n.title : '？？？'}</span>${cur ? '<b class="now">现在</b>' : ''}`;
      return `<div class="${cls}" data-id="${n.id}" style="left:${p.x}px;top:${p.y}px;--lc:${c}">${inner}</div>`;
    }).join('');
    box.innerHTML = svg + html + '<div class="fl-tip"><div class="fl-tthumb"></div><div class="fl-tinfo"><div class="fl-tdate"></div><div class="fl-ttitle"></div><div class="fl-thint">点击回到这一刻</div></div></div>';
    const tip = box.querySelector('.fl-tip');
    box.querySelectorAll('.fl-node.on:not(.end)').forEach(el => {
      const n = g.nodes.find(x => x.id === el.dataset.id);
      if (!MOBILE) {
        el.onmouseenter = () => {
          tip.querySelector('.fl-tthumb').style.backgroundImage = n.thumb ? `url("${n.thumb}")` : 'none';
          tip.querySelector('.fl-tdate').textContent = n.date ? n.date.join('　') : (n.group.num + '　' + n.group.title);
          tip.querySelector('.fl-ttitle').textContent = n.title;
          tip.querySelector('.fl-thint').style.display = el.classList.contains('stale') ? 'none' : '';
          const p = pos[n.id], tw = 360, th = 290;
          let tx = p.x + LANE_W - 6, ty = p.y - 70;
          if (tx + tw > W - 10) tx = p.x - tw - 26;
          ty = Math.max(8, Math.min(ty, H - th - 8));
          tip.style.left = tx + 'px'; tip.style.top = ty + 'px';
          tip.style.setProperty('--lc', LANE_COLOR[n.lane]);
          tip.classList.add('on');
        };
        el.onmouseleave = () => tip.classList.remove('on');
      }
      if (el.classList.contains('stale')) return;
      el.onclick = async e => {
        e.stopPropagation();
        const snap = nodeSnaps[n.id]; if (!snap) return;
        tip.classList.remove('on');
        if (!(await confirmBox(`回到「${n.title}」这一刻吗？\n当前未保存的进度将会丢失。`))) return;
        hideTitle(); restore(applyLatestPicks(snap));
      };
    });
    const total = g.nodes.length, got = g.nodes.filter(n => seen(n.id)).length;
    $('#flow-screen .flow-legend').innerHTML = ['main', 'normal', 'bad'].map(l => `<span class="lg-lane" style="--lc:${LANE_COLOR[l]}">${LANE_NAME[l]}</span>`).join('') +
      '<span class="lg-cur">当前位置</span><span class="lg-off">还没到达</span>' + `<span class="lg-count">已到达 ${got} / ${total}</span>`;
    showScreen('flow-screen');
    const wrap = $('#flow-screen .flow-wrap'), curEl = box.querySelector('.fl-node.cur');
    if (curEl) { wrap.scrollLeft = Math.max(0, parseFloat(curEl.style.left) - wrap.clientWidth * 0.35); wrap.scrollTop = Math.max(0, parseFloat(curEl.style.top) - wrap.clientHeight * 0.5); }
    else { wrap.scrollLeft = 0; wrap.scrollTop = 0; }
  }
  // 测试用：把节点标成已看过（tools/flowshot.js）。fake = 给没有存档的节点放一个占位，让它们显示成可以点的样子（只在内存里）
  function debugSeen(ids, endings, last, fake) {
    glob.seen = ids.slice(); glob.endings = (endings || []).slice(); glob.lastNode = last || null;
    if (fake) ids.forEach(id => { if (!nodeSnaps[id]) nodeSnaps[id] = { debug: true }; });
    saveGlobal();
  }

  // ================= 界面 =================
  let curScreen = null;
  function showScreen(id) {
    $$('.panel').forEach(p => p.classList.remove('on'));
    curScreen = id;
    if (id) $('#' + id).classList.add('on');
  }
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 1600); }
  function confirmBox(msg) {
    return new Promise(res => {
      const c = $('#confirm'); c.querySelector('.confirm-msg').textContent = msg; c.classList.add('on');
      c.querySelectorAll('button').forEach(b => b.onclick = e => { e.stopPropagation(); c.classList.remove('on'); res(b.dataset.v === '1'); });
    });
  }
  function openLog() {
    const list = $('#log-screen .log-list'); list.innerHTML = '';
    backlog.forEach(e => {
      const d = document.createElement('div'); d.className = 'log-item';
      d.innerHTML = '<div class="log-name"></div><div class="log-text"></div>';
      d.children[0].textContent = e.name; d.children[1].textContent = e.text;
      d.children[0].style.color = nameColor(e.name.replace('（LINE）', ''));
      list.appendChild(d);
    });
    showScreen('log-screen');
    list.scrollTop = list.scrollHeight;
  }
  function openConfig() {
    $$('#config-screen [data-cfg]').forEach(inp => {
      const k = inp.dataset.cfg;
      if (inp.type === 'checkbox') inp.checked = !!cfg[k]; else { inp.value = cfg[k]; inp.nextElementSibling.textContent = cfg[k]; }
    });
    showScreen('config-screen');
  }
  $$('#config-screen [data-cfg]').forEach(inp => {
    inp.addEventListener('input', () => {
      const k = inp.dataset.cfg;
      cfg[k] = inp.type === 'checkbox' ? inp.checked : +inp.value;
      if (inp.type !== 'checkbox') inp.nextElementSibling.textContent = cfg[k];
      if (k === 'fullscreen') { try { cfg.fullscreen ? document.documentElement.requestFullscreen() : document.exitFullscreen(); } catch (e) { } }
      applyCfg(); LS.set('cfg', cfg);
    });
  });
  function openGallery(tab = 'cg') {
    $$('.gallery-tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    const grid = $('.gallery-grid'), endl = $('.gallery-end');
    grid.style.display = tab === 'cg' ? 'grid' : 'none'; endl.style.display = tab === 'end' ? 'flex' : 'none';
    const mus = $('.gallery-music'); mus.style.display = tab === 'music' ? 'grid' : 'none'; mus.innerHTML = '';
    Object.entries(AudioSys.TITLES).forEach(([k, title], i) => {
      const d = document.createElement('div'); d.className = 'music-item' + (AudioSys.theme === k ? ' on' : '');
      d.innerHTML = `<span class="music-no">${String(i + 1).padStart(2, '0')}</span><span>${title}</span>`;
      d.onclick = () => { AudioSys.playTheme(k, 1); openGallery('music'); };
      mus.appendChild(d);
    });
    grid.innerHTML = '';
    A.cg.forEach(c => {
      const ok = glob.cg.includes(c.id);
      const d = document.createElement('div'); d.className = 'gal-item' + (ok ? '' : ' locked');
      if (ok) { d.style.backgroundImage = `url("assets/cg/${c.id}.webp")`; d.title = c.title; d.onclick = () => { const v = $('#gallery-view'); v.style.backgroundImage = `url("assets/cg/${c.id}.webp")`; v.classList.add('on'); }; }
      else d.textContent = '？';
      grid.appendChild(d);
    });
    endl.innerHTML = '';
    A.endings.forEach(e => {
      const ok = glob.endings.includes(e.id);
      const d = document.createElement('div'); d.className = 'end-item' + (ok ? '' : ' locked');
      d.style.setProperty('--end-color', e.color || '#f29bb8');
      d.innerHTML = `<span class="end-tag">${e.tag}</span><span>${ok ? e.title : '？？？'}</span><span class="end-hint">${ok ? '' : e.hint}</span>`;
      endl.appendChild(d);
    });
    showScreen('gallery-screen');
  }
  $$('.gallery-tabs button').forEach(b => b.onclick = () => openGallery(b.dataset.tab));
  $('#gallery-view').onclick = e => { e.stopPropagation(); $('#gallery-view').classList.remove('on'); };
  $$('.panel-close').forEach(b => b.onclick = e => { e.stopPropagation(); if (curScreen === 'gallery-screen' && !inGame) { const k = $('#title-screen').dataset.route || 'common'; AudioSys.playTheme(A.titleBgms[k] || A.titleBgm, 1.5); } showScreen(null); });

  // ================= 标题 =================
  function showTitle() {
    inGame = false; runId++; abortWaits();
    const ts = $('#title-screen');
    // 标题画面：达成 TRUE END 之后换图
    const key = glob.endings.includes('true') ? 'true' : 'common';
    ['title', key === 'true' ? 'title_true' : null].forEach(t => { if (t && !glob.cg.includes(t)) glob.cg.push(t); });
    const tb = ts.querySelector('.title-bg');
    tb.style.backgroundImage = `url("${A.titles[key] || A.titles.common}"), url("${A.titles.common}")`;
    ts.dataset.route = key;
    const hasSave = ['auto', 'quick', ...Array.from({ length: 30 }, (_, i) => String(i + 1))].some(s => slotData(s));
    ts.querySelector('[data-act=continue]').classList.toggle('disabled', !hasSave);
    ts.classList.add('on');
    AudioSys.stopAmb(null, 1); AudioSys.setMuffle(false, 0.3);
    AudioSys.playTheme(A.titleBgms[key] || A.titleBgm, 2);
  }
  function hideTitle() { $('#title-screen').classList.remove('on'); }
  async function toTitle() {
    runId++; abortWaits(); inGame = false; autoMode = false; skipMode = false; updateIndicators();
    saveGlobal();
    await curtain(true, 900);
    resetStage();
    showScreen(null);
    showTitle();
    await curtain(false, 900);
  }
  function resetStage() {
    S = freshState(); clearSpritesNow(); setFx('none'); setTint('none'); lineClose(); hideScan(); $('#hue-pop').classList.remove('on');
    ['bg-a', 'bg-b', 'cg-a', 'cg-b'].forEach(k => { $('#' + k).style.opacity = 0; $('#' + k).style.backgroundImage = 'none'; });
    tb.classList.add('hidden'); tb.classList.remove('tape', 'phone'); faceBox.classList.remove('on');
    $('#choices').classList.remove('on'); $('#center-text').classList.remove('on'); $('#chapter-card').classList.remove('on');
    $('#credits').classList.remove('on');
    backlog = [];
  }
  async function newGame() {
    AudioSys.stopTheme(1.5); AudioSys.stopAmb(null, 1.5);
    await curtain(true, 1000);
    hideTitle(); resetStage();
    // 序章开头没有章节卡来揭开黑幕：第一句文字（或 @wait / @center 等）出现时揭开
    pendingReveal = true;
    pc = 0; runId++; inGame = true;
    const id = runId;
    run(id);
  }
  function latestSave() {
    let best = null;
    ['auto', 'quick', ...Array.from({ length: 30 }, (_, i) => String(i + 1))].forEach(s => { const d = slotData(s); if (d && (!best || d.time > best.time)) best = d; });
    return best;
  }
  $$('.title-menu button').forEach(b => b.onclick = async e => {
    e.stopPropagation(); AudioSys.init();
    const act = b.dataset.act;
    if (act === 'new') newGame();
    else if (act === 'continue') { const d = latestSave(); if (d) { await curtain(true, 600); hideTitle(); restore(d); } }
    else if (act === 'load') { savePage = 0; openSave('load'); }
    else if (act === 'gallery') openGallery('cg');
    else if (act === 'flow') openFlow();
    else if (act === 'tips') openTips();
    else if (act === 'config') openConfig();
  });

  // ================= 输入 =================
  function advance() {
    if (!inGame || curScreen || $('#confirm').classList.contains('on')) return;
    if (uiHidden) { uiHidden = false; stage.classList.remove('ui-hidden'); return; }
    if ($('#choices').classList.contains('on')) return;
    if (typing) { typeSkip = true; return; }
    if (autoMode) { autoMode = false; updateIndicators(); }
    if (skipMode) { skipMode = false; updateIndicators(); }
    fireClick('click');
  }
  stage.addEventListener('click', e => {
    if (e.target.closest('button') || e.target.closest('.panel') || e.target.closest('#title-screen')) return;
    advance();
  });
  stage.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (MOBILE) return; // 手机上长按由下面的触摸手势处理
    if (curScreen) { showScreen(null); return; }
    if (!inGame) return;
    uiHidden = !uiHidden; stage.classList.toggle('ui-hidden', uiHidden);
  });
  stage.addEventListener('wheel', e => {
    if (!inGame) return;
    if (curScreen === 'log-screen') { if (e.deltaY > 0) { const l = $('#log-screen .log-list'); if (l.scrollTop + l.clientHeight >= l.scrollHeight - 4) showScreen(null); } return; }
    if (curScreen) return;
    if (e.deltaY < 0) openLog(); else advance();
  }, { passive: true });
  addEventListener('keydown', e => {
    if (e.key === 'Control') { if (inGame && !curScreen) { ctrlHeld = true; updateIndicators(); fireClick('click'); typeSkip = true; } return; }
    if (e.repeat) return;
    if (e.key === 'Escape') { if ($('#gallery-view').classList.contains('on')) $('#gallery-view').classList.remove('on'); else if (curScreen) showScreen(null); else if (inGame) openConfig(); return; }
    if (!inGame || curScreen) return;
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); advance(); }
    else if (e.key === 'a' || e.key === 'A') toggleAuto();
    else if (e.key === 'f' || e.key === 'F') openFlow();
    else if (e.key === 't' || e.key === 'T') openTips();
    else if (e.key === 's' || e.key === 'S') { writeSlot('quick'); toast('快速存档完成'); }
    else if (e.key === 'l' || e.key === 'L') { const d = slotData('quick'); if (d) restore(d); }
    else if (e.key === 'h' || e.key === 'H' || e.key === 'Backspace') { uiHidden = !uiHidden; stage.classList.toggle('ui-hidden', uiHidden); }
  });
  // ---------- 触摸手势：点击前进 / 长按隐藏界面 / 下滑看记录 ----------
  if (MOBILE) {
    let t0 = null, lpTimer = null, lpFired = false;
    stage.addEventListener('touchstart', e => {
      clearTimeout(lpTimer); lpFired = false;
      if (e.touches.length !== 1) { t0 = null; return; }
      const t = e.touches[0]; t0 = { x: t.clientX, y: t.clientY, time: Date.now() };
      if (!inGame || curScreen || e.target.closest('button') || $('#choices').classList.contains('on')) return;
      lpTimer = setTimeout(() => {
        lpFired = true; uiHidden = !uiHidden; stage.classList.toggle('ui-hidden', uiHidden);
        try { navigator.vibrate && navigator.vibrate(12); } catch (err) { }
      }, 550);
    }, { passive: true });
    stage.addEventListener('touchmove', e => {
      if (!t0) return; const t = e.touches[0];
      if (Math.hypot(t.clientX - t0.x, t.clientY - t0.y) > 14) clearTimeout(lpTimer);
    }, { passive: true });
    stage.addEventListener('touchend', e => {
      clearTimeout(lpTimer);
      if (!t0) return; const s = t0; t0 = null;
      if (lpFired) { e.preventDefault(); return; } // 长按之后不再触发一次点击
      if (!inGame || curScreen || $('#choices').classList.contains('on')) return;
      const t = e.changedTouches[0], dx = t.clientX - s.x, dy = t.clientY - s.y;
      if (dy > 60 && Math.abs(dy) > Math.abs(dx) * 1.5 && Date.now() - s.time < 700) { e.preventDefault(); openLog(); }
    });
  }
  // ---------- 界面音效：所有按钮统一在这里出声（选项按钮自己处理） ----------
  const SFX_OF = el => {
    if (el.matches('.save-slot')) return null; // 存档格子：存 / 读成功时自己出声
    if (el.matches('.panel-close, #confirm button[data-v="0"]')) return 'cancel';
    if (el.matches('#confirm button[data-v="1"], .title-menu [data-act=new], .title-menu [data-act=continue]')) return 'select';
    if (el.matches('#quickmenu [data-act=qsave]')) return 'save';
    if (el.matches('#quickmenu [data-act=qload]')) return 'load';
    if (el.matches('#quickmenu [data-act=auto], #quickmenu [data-act=skip], #quickmenu [data-act=hide], label.check')) return 'toggle';
    return 'click';
  };
  document.addEventListener('click', e => {
    if (e.target.closest('#choices')) return;
    if (e.target.matches('label.check input')) return; // 点 label 会再触发一次 input 的 click
    const el = e.target.closest('button, .save-slot, .gal-item:not(.locked), .fl-node.on:not(.end), .music-item, label.check, #gallery-view');
    if (!el || el.disabled || el.classList.contains('disabled')) return;
    const snd = el.id === 'gallery-view' ? 'cancel' : SFX_OF(el); if (snd) { AudioSys.init(); AudioSys.se(snd); }
  }, true);
  let tickAt = 0;
  document.addEventListener('input', e => { if (e.target.type === 'range' && Date.now() - tickAt > 70) { tickAt = Date.now(); AudioSys.se('tick'); } }, true);

  // ---------- 安卓返回键 / 切到后台 ----------
  function goBack() {
    AudioSys.se('cancel');
    const conf = $('#confirm');
    if (conf.classList.contains('on')) { conf.querySelector('button[data-v="0"]').click(); return; }
    if ($('#gallery-view').classList.contains('on')) { $('#gallery-view').classList.remove('on'); return; }
    if (curScreen) { const pc = $('#' + curScreen + ' .panel-close'); if (pc) pc.click(); else showScreen(null); return; }
    if (uiHidden) { uiHidden = false; stage.classList.remove('ui-hidden'); return; }
    if (inGame) { confirmBox('返回标题画面吗？\n未保存的进度将会丢失。').then(ok => { if (ok) toTitle(); }); return; }
    confirmBox('退出游戏吗？').then(ok => { if (ok && CAP.Plugins.App) CAP.Plugins.App.exitApp(); });
  }
  if (NATIVE && CAP.Plugins && CAP.Plugins.App) CAP.Plugins.App.addListener('backButton', goBack);
  if (MOBILE) document.addEventListener('visibilitychange', () => AudioSys.suspend(document.hidden));
  addEventListener('keyup', e => { if (e.key === 'Control') { ctrlHeld = false; updateIndicators(); } });
  addEventListener('blur', () => { ctrlHeld = false; updateIndicators(); });
  function toggleAuto() { autoMode = !autoMode; skipMode = false; updateIndicators(); if (autoMode && !typing) modeChanged(); }
  $$('#quickmenu button').forEach(b => b.onclick = async e => {
    e.stopPropagation();
    switch (b.dataset.act) {
      case 'auto': toggleAuto(); break;
      case 'skip': skipMode = !skipMode; autoMode = false; updateIndicators(); if (skipMode) { typeSkip = true; fireClick('click'); } break;
      case 'log': openLog(); break;
      case 'flow': openFlow(); break;
      case 'hue': openHue(); break;
      case 'tips': openTips(); break;
      case 'save': openSave('save'); break;
      case 'load': savePage = 0; openSave('load'); break;
      case 'qsave': writeSlot('quick'); toast('快速存档完成'); break;
      case 'qload': { const d = slotData('quick'); if (d) restore(d); else toast('没有快速存档'); break; }
      case 'config': openConfig(); break;
      case 'hide': uiHidden = true; stage.classList.add('ui-hidden'); break;
      case 'title': if (await confirmBox('返回标题画面吗？\n未保存的进度将会丢失。')) toTitle(); break;
    }
  });

  // ================= 预加载 =================
  async function preload() {
    const urls = [];
    if (MOBILE) {
      // 手机内存小：只预读标题图和四位女主的常用立绘，其余用到时再读（本地文件很快）
      Object.values(A.titles).forEach(u => urls.push(u));
      ['chisato', 'takina'].forEach(id => urls.push(spritePath(id, 'normal')));
    } else {
      Object.keys(A.bg).forEach(k => { const u = bgSrc(k); if (u) urls.push(u); });
      Object.entries(A.ch).forEach(([id, c]) => c.exprs.forEach(x => urls.push(spritePath(id, x))));
      A.cg.forEach(c => urls.push(`assets/cg/${c.id}.webp`));
      urls.push(A.titleImage);
    }
    let n = 0;
    const bar = $('#loading .loading-bar span');
    await Promise.all(urls.map(u => new Promise(r => { const i = new Image(); i.onload = i.onerror = () => { n++; bar.style.width = (n / urls.length * 100) + '%'; r(); }; i.src = u; })));
    const lt = $('#loading .loading-text');
    lt.className = 'click-start'; lt.textContent = '点击屏幕开始';
    $('#loading .loading-bar').style.opacity = 0;
    if (!QS.get('jump')) await new Promise(r => $('#loading').addEventListener('click', r, { once: true }));
    AudioSys.init(); applyCfg();
    $('#loading').classList.add('done');
    showTitle();
  }
  applyCfg();
  // 调试：?jump=标签 直接从某个标签开始；?vars=bocchi:5,kita:2 预设变量
  window.__VN = { ops, labels, cfg, S: () => S, flow: () => buildFlow(), debugSeen, toTitle: () => toTitle(), jumpTo: (l, vars) => { hideTitle(); resetStage(); if (vars) Object.assign(S.vars, vars); jump(l); runId++; inGame = true; run(runId); } };
  preload().then(() => {
    if (QS.get('jump')) {
      const vars = {}; (QS.get('vars') || '').split(',').filter(Boolean).forEach(kv => { const [k, v] = kv.split(':'); vars[k] = +v; });
      window.__VN.jumpTo(QS.get('jump'), vars);
    }
  });
})();
