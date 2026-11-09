// 程序化音频：BGM 优先用 assets/bgm 的 mp3（只限 BGM_MP3 里列出的曲目），否则用 WebAudio 实时合成；环境音和音效全部实时合成。全部旋律为原创。
window.AudioSys = (() => {
  let ctx = null, master, bus = {}, reverbIn, seRevIn, comp;
  const vol = { bgm: 0.6, amb: 0.55, se: 0.7 };
  let curTheme = null, themeNode = null;
  const ambNodes = {};
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const rnd = (a, b) => a + Math.random() * (b - a);
  // 测试用：网址带 mute=1 时完全静音
  const MUTED = /[?&]mute=1/.test(location.search);

  function init() {
    if (ctx) { if (ctx.state === 'suspended' && !MUTED) ctx.resume(); return; }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.85;
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 3.5; comp.attack.value = 0.005; comp.release.value = 0.2;
    master.connect(comp); comp.connect(ctx.destination);
    if (MUTED) { master.gain.value = 0; ctx.suspend(); }
    for (const k of ['bgm', 'amb', 'se']) { bus[k] = ctx.createGain(); bus[k].gain.value = vol[k]; bus[k].connect(master); }
    // 音乐用的混响（走 BGM 音量）
    const reverb = ctx.createConvolver(); reverb.buffer = impulse(2.4, 2.8);
    reverbIn = ctx.createGain(); reverbIn.gain.value = 1;
    const rvOut = ctx.createGain(); rvOut.gain.value = 0.45;
    reverbIn.connect(reverb); reverb.connect(rvOut); rvOut.connect(bus.bgm);
    // 音效用的短混响（走音效音量：枪声的尾巴、门铃的余音）
    const seRev = ctx.createConvolver(); seRev.buffer = impulse(1.5, 3.2);
    seRevIn = ctx.createGain(); seRevIn.gain.value = 1;
    const seOut = ctx.createGain(); seOut.gain.value = 0.5;
    seRevIn.connect(seRev); seRev.connect(seOut); seOut.connect(bus.se);
    distCurve = makeDist(55); crunchCurve = makeDist(14);
  }
  function impulse(sec, decay) {
    const len = Math.floor(ctx.sampleRate * sec), buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return buf;
  }
  let noiseBuf = null, brownBuf = null, distCurve, crunchCurve;
  // 循环用的噪声：做得长一点，并且把结尾和开头交叉淡化，循环处不会「噗」一下，也听不出重复的纹路
  function seamless(gen, sec, fadeSec) {
    const sr = ctx.sampleRate, len = Math.floor(sr * sec), F = Math.floor(sr * fadeSec);
    const raw = new Float32Array(len + F); gen(raw);
    const buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = raw[i];
    for (let i = 0; i < F; i++) { const k = i / F; d[i] = raw[i] * Math.sqrt(k) + raw[len + i] * Math.sqrt(1 - k); }
    return buf;
  }
  function noise() {
    if (noiseBuf) return noiseBuf;
    noiseBuf = seamless(d => { for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }, 9, 0.3);
    return noiseBuf;
  }
  function brown() {
    if (brownBuf) return brownBuf;
    brownBuf = seamless(d => { let last = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } }, 14, 1.5);
    return brownBuf;
  }
  function noiseSrc(buf) { const s = ctx.createBufferSource(); s.buffer = buf || noise(); s.loop = true; return s; }
  function makeDist(k) {
    const n = 2048, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; c[i] = (3 + k) * x * 20 * (Math.PI / 180) / (Math.PI + k * Math.abs(x)); }
    return c;
  }
  const filt = (type, f, q = 0.7) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
  // 混响送出：默认进音乐混响；排 BGM 时临时改成该曲自己的送出口（停曲时能一起淡出），音效时改成音效混响
  let sendTo = null;
  const send = (node, amt) => { if (amt > 0) { const s = ctx.createGain(); s.gain.value = amt; node.connect(s); s.connect(sendTo || reverbIn); } };
  // 一小段滤过波的噪声（鼓、环境音、音效共用）
  function burst(t, dur, out, type, f, q, peak, a = 0.002, buf) {
    const s = ctx.createBufferSource(); s.buffer = buf || noise(); const b = filt(type, f, q), g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dur);
    s.connect(b); b.connect(g); g.connect(out); s.start(t, Math.random() * 3, a + dur + 0.05);
    return { b, g };
  }

  // ================= 鼓 =================
  function kick(t, out, v = 1) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(44, t + 0.12);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.95 * v, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.36);
    burst(t, 0.012, out, 'highpass', 2500, 0.7, 0.18 * v, 0.001);
  }
  function snare(t, out, v = 1) {
    const s = ctx.createBufferSource(); s.buffer = noise(); const bp = filt('bandpass', 1900, 0.7), hp = filt('highpass', 700), g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.55 * v, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    s.connect(bp); bp.connect(hp); hp.connect(g); g.connect(out); s.start(t, Math.random() * 3, 0.25);
    const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'triangle';
    o.frequency.setValueAtTime(200, t); o.frequency.exponentialRampToValueAtTime(160, t + 0.08);
    og.gain.setValueAtTime(0.35 * v, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.connect(og); og.connect(out); o.start(t); o.stop(t + 0.12);
    send(g, 0.25 * v);
  }
  function hat(t, out, v = 1, open = false) {
    const d = open ? 0.28 : 0.045;
    burst(t, d, out, 'highpass', 7600, 0.7, 0.2 * v, 0.001);
  }
  function crash(t, out, v = 1) {
    const s = ctx.createBufferSource(); s.buffer = noise(); const hp = filt('highpass', 4200), bp = filt('peaking', 6500, 1), g = ctx.createGain();
    bp.gain.value = 6;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.28 * v, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
    s.connect(hp); hp.connect(bp); bp.connect(g); g.connect(out); s.start(t, Math.random() * 2, 1.9);
    send(g, 0.3);
  }
  function tom(t, out, f = 140, v = 1) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.62, t + 0.25);
    g.gain.setValueAtTime(0.6 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.32); send(g, 0.2);
  }
  // 边击（bossa 的 cross-stick）
  function rim(t, out, v = 1) {
    burst(t, 0.045, out, 'bandpass', 1750, 5, 0.55 * v, 0.001);
    const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'triangle'; o.frequency.value = 830;
    og.gain.setValueAtTime(0.16 * v, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    o.connect(og); og.connect(out); o.start(t); o.stop(t + 0.05);
  }
  // 鼓刷：拍一下（sweep = 画圈的沙沙声）
  function brush(t, out, v = 1) { const n = burst(t, 0.16, out, 'bandpass', 3200, 0.6, 0.14 * v, 0.012); send(n.g, 0.15); }
  function sweep(t, dur, out, v = 1) {
    const s = ctx.createBufferSource(); s.buffer = noise(); const bp = filt('bandpass', 2400, 0.5), g = ctx.createGain();
    bp.frequency.setValueAtTime(1800, t); bp.frequency.linearRampToValueAtTime(3200, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.035 * v, t + dur * 0.6); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    s.connect(bp); bp.connect(g); g.connect(out); s.start(t, Math.random() * 3, dur + 0.05);
  }
  function ride(t, out, v = 1) {
    const s = ctx.createBufferSource(); s.buffer = noise(); const hp = filt('highpass', 5200), pk = filt('peaking', 8500, 1.5), g = ctx.createGain();
    pk.gain.value = 5;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.1 * v, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    s.connect(hp); hp.connect(pk); pk.connect(g); g.connect(out); s.start(t, Math.random() * 3, 0.55);
    const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'triangle'; o.frequency.value = 3350;
    og.gain.setValueAtTime(0.012 * v, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(og); og.connect(out); o.start(t); o.stop(t + 0.4);
  }
  function shaker(t, out, v = 1) { burst(t, 0.05, out, 'bandpass', 7000, 1, 0.09 * v, 0.01); }
  function clap(t, out, v = 1) {
    [0, 0.011, 0.023].forEach(d => burst(t + d, 0.012, out, 'bandpass', 1300, 1.2, 0.3 * v, 0.001));
    const n = burst(t + 0.03, 0.14, out, 'bandpass', 1200, 1, 0.22 * v, 0.002); send(n.g, 0.3);
  }
  function woodblock(t, out, v = 1, f = 1150) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.22 * v, t + 0.001); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.08);
    burst(t, 0.02, out, 'bandpass', f * 2, 3, 0.12 * v, 0.001);
  }
  // 16 步鼓型：K 底鼓（k = 轻）/ S 军鼓（g 鬼音，r 边击，b 鼓刷，c 拍手）/ H 踩镲（o 开镲，s 沙锤，p 脚踩）
  // R 叮叮镲 / T 通鼓（t 低，h 高，w 木鱼）。crash：每 8 小节一记镲片；fill：第 8 小节末尾加花；sweep：鼓刷画圈；kv：底鼓力度
  const DRUMS = {
    rock8: { K: 'x.......x.x.....', S: '....x.......x...', H: 'x.x.x.x.x.x.x.x.', crash: 1, fill: 1 },
    drive: { K: 'x.x.....x.x.x...', S: '....x.......x...', H: 'xxxxxxxxxxxxxxxx', crash: 1, fill: 1 },
    anthem: { K: 'x.....x.x.......', S: '........x.......', H: 'x.x.x.x.x.x.x.x.', T: '..............hh', crash: 1, fill: 1 },
    funk: { K: 'x..x..x...xx..x.', S: '....x..g.g..x..g', H: 'xxxxxxoxxxxxxxox', crash: 1, fill: 1 },
    lofi: { K: 'x......x..x.....', S: '....x.......x..g', H: 'x.x.x.x.x.x.x.x.', kv: 0.8 },
    comic: { K: 'x.......x..x....', S: '....r.......r...', H: 's.s.s.s.s.s.s.s.', T: '..w...w...w..ww.', fill: 0 },
    bossa: { K: 'x..xx..xx..xx..x', S: 'r..r..r...r..r..', H: 'ssssssssssssssss', kv: 0.45 },
    jazzpop: { K: 'x.....x...x.....', S: '....c.......c...', H: '..p...p...p...p.', R: 'x...x.x.x...x.x.', kv: 0.8, fill: 1 },
    brush: { K: 'k.......k.......', S: '....b.......b...', H: '....p.......p...', sweep: 1, kv: 0.7 },
    rimsoft: { K: 'x.......x..x....', S: '....r.......r...', H: 'x.x.x.x.x.x.x.x.', kv: 0.6 },
    pulse: { K: 'x.......k.......', S: '............r...', H: '..s...s...s...s.', kv: 0.6 },
    heart: { K: 'x..k............', kv: 0.55 },
    timp: { T: 't.......t.....t.' }
  };
  // 一拍里的四个十六分音符；sw = 反拍八分音符往后推的秒数（摇摆）
  function drumBeat(p, t, spb, beat, out, vel, fill, sw) {
    const st = spb / 4, kv = p.kv || 1;
    for (let j = 0; j < 4; j++) {
      const i = beat * 4 + j, tt = t + j * st + (j === 2 ? sw : 0);
      if (fill && i >= 12) { snare(tt, out, vel * (0.45 + (i - 12) * 0.12)); if (i === 12) tom(tt, out, 190, vel * 0.55); if (i === 14) tom(tt, out, 125, vel * 0.6); continue; }
      const k = p.K ? p.K[i] : '.', s = p.S ? p.S[i] : '.', h = p.H ? p.H[i] : '.', r = p.R ? p.R[i] : '.', tm = p.T ? p.T[i] : '.';
      if (k === 'x') kick(tt, out, vel * kv); else if (k === 'k') kick(tt, out, vel * kv * 0.45);
      if (s === 'x') snare(tt, out, vel); else if (s === 'g') snare(tt, out, vel * 0.22); else if (s === 'r') rim(tt, out, vel);
      else if (s === 'b') brush(tt, out, vel); else if (s === 'c') clap(tt, out, vel);
      if (h === 'x') hat(tt, out, vel * (i % 4 === 0 ? 1 : 0.7)); else if (h === 'o') hat(tt, out, vel * 0.8, true);
      else if (h === 's') shaker(tt, out, vel * (i % 2 ? 0.6 : 1)); else if (h === 'p') hat(tt, out, vel * 0.35);
      if (r === 'x') ride(tt, out, vel * (i % 8 === 4 ? 1 : 0.8));
      if (tm === 't') tom(tt, out, 72, vel * 0.9); else if (tm === 'h') tom(tt, out, 150, vel * 0.7); else if (tm === 'w') woodblock(tt, out, vel, i % 4 ? 1400 : 1150);
    }
    if (p.sweep) sweep(t, spb, out, vel);
  }

  // ================= 贝斯 =================
  // tone：finger 指弹 / pick 拨片 / upright 低音提琴 / synth 合成器（放克）
  const BASS_F = { finger: [700, 260], pick: [1400, 420], upright: [950, 300], synth: [2600, 480] };
  function bass(t, midi, dur, out, v = 1, tone = 'pick') {
    const f = mtof(midi), o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), og = ctx.createGain();
    const up = tone === 'upright', [f0, f1] = BASS_F[tone] || BASS_F.pick, lp = filt('lowpass', f0, tone === 'synth' ? 4 : 1.2);
    o.type = up ? 'triangle' : tone === 'synth' ? 'square' : 'sawtooth'; o2.type = 'sine';
    o.frequency.value = f; o2.frequency.value = f; og.gain.value = up ? 1.4 : 0.9;
    lp.frequency.setValueAtTime(f0, t); lp.frequency.exponentialRampToValueAtTime(f1, t + (up ? 0.12 : 0.18));
    const pk = 0.42 * v * (tone === 'synth' ? 0.8 : 1);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(pk, t + 0.006);
    if (up) g.gain.exponentialRampToValueAtTime(pk * 0.45, t + Math.max(0.03, Math.min(dur, 0.25)));
    else g.gain.setValueAtTime(pk * 0.76, t + Math.max(0.02, dur * 0.7));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.06);
    o.connect(lp); o2.connect(og); og.connect(lp); lp.connect(g); g.connect(out);
    o.start(t); o2.start(t); o.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
  }

  // ================= 吉他 =================
  // 失真节奏吉他（强力和弦）
  function power(t, root, dur, out, v = 1, mute = false, pan = 0) {
    const pre = ctx.createGain(); pre.gain.value = mute ? 3 : 5;
    const ws = ctx.createWaveShaper(); ws.curve = distCurve; ws.oversample = '2x';
    const hp = filt('highpass', 110), lp = filt('lowpass', mute ? 1300 : 3400, 0.8), pk = filt('peaking', 750, 1.2); pk.gain.value = -5;
    const g = ctx.createGain(), p = ctx.createStereoPanner(); p.pan.value = pan;
    [root, root + 7, root + 12].forEach((m, i) => [-7, 7].forEach(dt => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = dt;
      const og = ctx.createGain(); og.gain.value = i === 2 ? 0.1 : 0.16; o.connect(og); og.connect(pre); o.start(t); o.stop(t + dur + 0.12);
    }));
    pre.connect(ws); ws.connect(hp); hp.connect(pk); pk.connect(lp); lp.connect(g); g.connect(p); p.connect(out);
    const d = mute ? Math.min(dur, 0.12) : dur;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.16 * v, t + 0.004);
    g.gain.setValueAtTime(0.13 * v, t + d * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.08);
  }
  // Karplus-Strong 拨弦（清音吉他 / 拨奏）
  const ksCache = {};
  function ksBuf(midi) {
    if (ksCache[midi]) return ksCache[midi];
    const sr = ctx.sampleRate, f = mtof(midi), N = Math.max(2, Math.round(sr / f)), len = Math.floor(sr * 2.2);
    const buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
    let prev = 0;
    for (let i = 0; i < N; i++) { const w = Math.random() * 2 - 1; prev = prev * 0.5 + w * 0.5; d[i] = prev; }
    const damp = 0.4985 + Math.min(0.0012, f / 400000);
    for (let i = N; i < len; i++) d[i] = damp * (d[i - N] + d[i - N + 1]);
    return (ksCache[midi] = buf);
  }
  function pluck(t, midi, dur, out, v = 1, pan = 0, wet = 0.25) {
    const s = ctx.createBufferSource(); s.buffer = ksBuf(midi);
    const lp = filt('lowpass', 4200), g = ctx.createGain(), p = ctx.createStereoPanner(); p.pan.value = pan;
    g.gain.setValueAtTime(0.5 * v, t); g.gain.setValueAtTime(0.5 * v, t + Math.max(0.05, dur)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.6);
    s.connect(lp); lp.connect(g); g.connect(p); p.connect(out); s.start(t); s.stop(t + dur + 0.7);
    send(g, wet);
  }
  // 弦乐拨奏（pizzicato）：很短的拨弦
  function pizz(t, midi, dur, v, out, wet = 0.3) {
    const s = ctx.createBufferSource(); s.buffer = ksBuf(midi);
    const lp = filt('lowpass', 2300, 0.8), g = ctx.createGain(), end = t + 0.18 + Math.min(dur, 0.6) * 0.3;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.6 * v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, end);
    s.connect(lp); lp.connect(g); g.connect(out); s.start(t); s.stop(end + 0.05);
    send(g, wet);
  }
  // 失真主音吉他（带揉弦）
  function lead(t, midi, dur, out, v = 1, wet = 0.35) {
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(); o.type = 'sawtooth'; o2.type = 'square';
    o.frequency.value = mtof(midi); o2.frequency.value = mtof(midi); o2.detune.value = 5;
    const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 5.6;
    vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(dur > 0.4 ? 22 : 0, t + Math.min(dur, 0.35) + 0.15);
    vib.connect(vg); vg.connect(o.detune); vg.connect(o2.detune);
    const pre = ctx.createGain(); pre.gain.value = 3.5; const ws = ctx.createWaveShaper(); ws.curve = crunchCurve;
    const lp = filt('lowpass', 3800, 1), hp = filt('highpass', 220), g = ctx.createGain();
    const og2 = ctx.createGain(); og2.gain.value = 0.5;
    o.connect(pre); o2.connect(og2); og2.connect(pre); pre.connect(ws); ws.connect(hp); hp.connect(lp); lp.connect(g); g.connect(out);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.1 * v, t + 0.012);
    g.gain.setValueAtTime(0.085 * v, t + dur * 0.9); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.12);
    [o, o2, vib].forEach(x => { x.start(t); x.stop(t + dur + 0.2); });
    send(g, wet);
  }
  // 明亮的合成拨奏
  function synthPluck(t, midi, dur, out, v = 1, wet = 0.35) {
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = mtof(midi);
    const lp = filt('lowpass', 5000, 3), g = ctx.createGain();
    lp.frequency.setValueAtTime(6000, t); lp.frequency.exponentialRampToValueAtTime(900, t + 0.25);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.09 * v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.25, dur));
    o.connect(lp); lp.connect(g); g.connect(out); o.start(t); o.stop(t + Math.max(0.25, dur) + 0.05); send(g, wet);
  }

  // ================= 键盘 / 旋律乐器 =================
  function piano(t, midi, dur, vel, out, wet = 0.4) {
    const f = mtof(midi), g = ctx.createGain(), lp = filt('lowpass', Math.min(9000, f * 6 + 800), 0.3);
    [[1, 1], [2, 0.42], [3, 0.16], [4, 0.08], [5.02, 0.035]].forEach(([m, a]) => {
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.frequency.value = f * m; o.detune.value = (Math.random() - 0.5) * 6;
      og.gain.value = a; o.connect(og); og.connect(lp); o.start(t); o.stop(t + dur + 2.2);
    });
    const peak = vel * 0.36;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + 0.006);
    g.gain.exponentialRampToValueAtTime(peak * 0.35, t + 0.35);
    g.gain.exponentialRampToValueAtTime(peak * 0.12, t + Math.max(0.5, dur));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 2.0);
    lp.connect(g); g.connect(out); send(g, wet);
  }
  // 电钢琴（Rhodes）：1:1 的 FM，起音时有一点「咬」，再加一声很短的高音金属音
  function rhodes(t, midi, dur, vel, out, wet = 0.3, pan = 0) {
    const f = mtof(midi), c = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain();
    const ti = ctx.createOscillator(), tg = ctx.createGain(), g = ctx.createGain(), p = ctx.createStereoPanner();
    c.frequency.value = f; m.frequency.value = f; ti.frequency.value = f * 4; p.pan.value = pan;
    const idx = f * (midi < 55 ? 0.6 : 1) * (0.4 + Math.min(vel, 0.6) * 1.5);
    mg.gain.setValueAtTime(idx, t); mg.gain.exponentialRampToValueAtTime(idx * 0.12, t + 0.6);
    m.connect(mg); mg.connect(c.frequency);
    const pk = vel * 0.34, hold = t + Math.max(0.5, dur), end = hold + 0.35;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(pk, t + 0.004);
    g.gain.exponentialRampToValueAtTime(pk * 0.45, t + 0.35); g.gain.exponentialRampToValueAtTime(pk * 0.2, hold); g.gain.exponentialRampToValueAtTime(0.0001, end);
    tg.gain.setValueAtTime(vel * 0.045, t); tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    c.connect(g); ti.connect(tg); tg.connect(p); g.connect(p); p.connect(out);
    [c, m].forEach(x => { x.start(t); x.stop(end + 0.05); }); ti.start(t); ti.stop(t + 0.1);
    send(g, wet);
  }
  // 颤音琴：基音 + 4 倍泛音，马达带来的颤音
  function vibes(t, midi, dur, vel, out, wet = 0.4) {
    const f = mtof(midi), o = ctx.createOscillator(), o2 = ctx.createOscillator(), g2 = ctx.createGain(), g = ctx.createGain(), tr = ctx.createGain();
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5.2; lg.gain.value = 0.28; tr.gain.value = 0.72;
    lfo.connect(lg); lg.connect(tr.gain);
    o.frequency.value = f; o2.frequency.value = f * 4;
    const pk = vel * 0.22, end = t + Math.max(0.6, dur) + 1.1;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(pk, t + 0.002);
    g.gain.exponentialRampToValueAtTime(pk * 0.5, t + Math.max(0.3, dur)); g.gain.exponentialRampToValueAtTime(0.0001, end);
    g2.gain.setValueAtTime(0.35, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(tr); tr.connect(out);
    [o, o2, lfo].forEach(x => { x.start(t); x.stop(end + 0.05); });
    send(tr, wet);
  }
  // 八音盒：短促的高音，带一点不和谐的高泛音；det = 走调（音分）
  function mbox(t, midi, dur, vel, out, wet = 0.55, det = 0) {
    const f = mtof(midi) * Math.pow(2, det / 1200), g = ctx.createGain(), end = t + 1.4 + Math.min(dur, 1);
    [[1, 1, end], [2, 0.3, t + 0.5], [6.03, 0.22, t + 0.12]].forEach(([r, a, e]) => {
      const o = ctx.createOscillator(), og = ctx.createGain(); o.frequency.value = f * r;
      og.gain.setValueAtTime(a, t); og.gain.exponentialRampToValueAtTime(0.0001, e);
      o.connect(og); og.connect(g); o.start(t); o.stop(e + 0.02);
    });
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * 0.24, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, end);
    g.connect(out); send(g, wet);
  }
  // 马林巴：木头的短音
  function marimba(t, midi, dur, vel, out, wet = 0.25) {
    const f = mtof(midi), g = ctx.createGain(), end = t + 0.35 + Math.min(dur, 0.6) * 0.4;
    [[1, 1, end], [3.93, 0.25, t + 0.07]].forEach(([r, a, e]) => {
      const o = ctx.createOscillator(), og = ctx.createGain(); o.frequency.value = f * r;
      og.gain.setValueAtTime(a, t); og.gain.exponentialRampToValueAtTime(0.0001, e);
      o.connect(og); og.connect(g); o.start(t); o.stop(e + 0.02);
    });
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * 0.3, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, end);
    g.connect(out); send(g, wet);
  }
  // 长笛（柔和的吹奏旋律，带气声和迟到的揉音）
  function flute(t, midi, dur, vel, out, wet = 0.45) {
    const f = mtof(midi), o = ctx.createOscillator(), o2 = ctx.createOscillator(), o2g = ctx.createGain(), g = ctx.createGain();
    const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 5;
    o.frequency.value = f; o2.type = 'triangle'; o2.frequency.value = f * 2; o2g.gain.value = 0.12;
    vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(dur > 0.5 ? 14 : 3, t + Math.min(dur, 0.5));
    vib.connect(vg); vg.connect(o.detune); vg.connect(o2.detune);
    const pk = vel * 0.15, end = t + dur + 0.18;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(pk, t + 0.05); g.gain.setValueAtTime(pk * 0.85, t + Math.max(0.06, dur * 0.85)); g.gain.linearRampToValueAtTime(0, end);
    o.connect(g); o2.connect(o2g); o2g.connect(g); g.connect(out);
    [o, o2, vib].forEach(x => { x.start(t); x.stop(end + 0.02); });
    const n = burst(t, 0.12, out, 'bandpass', Math.min(f * 2.5, 6000), 1.5, vel * 0.03, 0.03); send(n.g, 0.2);
    send(g, wet);
  }
  function bell(t, midi, dur, vel, out, wet = 0.6) {
    const f = mtof(midi), car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
    car.frequency.value = f; mod.frequency.value = f * 3.5;
    mg.gain.setValueAtTime(f * 2.2, t); mg.gain.exponentialRampToValueAtTime(f * 0.05, t + 1.5);
    mod.connect(mg); mg.connect(car.frequency); car.connect(g);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * 0.2, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 2.4);
    g.connect(out); car.start(t); mod.start(t); car.stop(t + dur + 2.6); mod.stop(t + dur + 2.6);
    send(g, wet);
  }
  function pad(t, midis, dur, vel, out) {
    const g = ctx.createGain(), lp = filt('lowpass', 1500, 0.5);
    midis.forEach(m => [-8, 8].forEach(dt => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = dt;
      o.connect(lp); o.start(t); o.stop(t + dur + 2.5);
    }));
    const peak = vel * 0.026;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + Math.min(1.4, dur * 0.4));
    g.gain.setValueAtTime(peak, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 2);
    lp.connect(g); g.connect(out); send(g, 0.8);
  }
  // 弦乐合奏：每个音三根略微走调的锯齿波，慢起慢收，共用一个揉弦 LFO；dark = 更闷的低音弦
  function strings(t, midis, dur, vel, out, o = {}) {
    const lp = filt('lowpass', o.dark ? 900 : o.bright ? 3400 : 2300, 0.6), g = ctx.createGain();
    const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 5.1; vg.gain.value = o.dark ? 4 : 8;
    vib.connect(vg);
    const att = o.att != null ? o.att : Math.min(0.9, dur * 0.35), rel = o.rel != null ? o.rel : 1.4, end = t + dur + rel;
    midis.forEach(m => [-11, 0, 11].forEach(dt => {
      const x = ctx.createOscillator(); x.type = 'sawtooth'; x.frequency.value = mtof(m); x.detune.value = dt;
      vg.connect(x.detune); x.connect(lp); x.start(t); x.stop(end + 0.05);
    }));
    vib.start(t); vib.stop(end + 0.05);
    const pk = vel * 0.1 / Math.sqrt(midis.length);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(pk, t + att);
    g.gain.setValueAtTime(pk, t + Math.max(att, dur)); g.gain.linearRampToValueAtTime(0, end);
    lp.connect(g); g.connect(out); send(g, o.wet != null ? o.wet : 0.6);
  }
  // 铜管齐奏（短促的 stab）：滤波器先张开再合上，起音略微往上滑
  function brass(t, midis, dur, vel, out, wet = 0.2) {
    const lp = filt('lowpass', 700, 1.6), g = ctx.createGain(), end = t + dur + 0.12;
    lp.frequency.setValueAtTime(600, t); lp.frequency.linearRampToValueAtTime(3600, t + 0.035); lp.frequency.exponentialRampToValueAtTime(1300, t + 0.035 + Math.min(0.4, dur));
    midis.forEach(m => [-6, 6].forEach(dt => {
      const x = ctx.createOscillator(); x.type = 'sawtooth'; x.frequency.value = mtof(m);
      x.detune.setValueAtTime(dt - 35, t); x.detune.linearRampToValueAtTime(dt, t + 0.04);
      x.connect(lp); x.start(t); x.stop(end + 0.02);
    }));
    const pk = vel * 0.11 / Math.sqrt(midis.length);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(pk, t + 0.015); g.gain.exponentialRampToValueAtTime(pk * 0.6, t + 0.12);
    g.gain.setValueAtTime(pk * 0.55, t + Math.max(0.12, dur)); g.gain.exponentialRampToValueAtTime(0.0001, end);
    lp.connect(g); g.connect(out); send(g, wet);
  }
  // 统一的入口：乐器名 → 发声（v 约 0..1）
  const INST = {
    piano: (t, m, d, v, out, o) => piano(t, m, d, 0.6 * v, out, o.wet != null ? o.wet : 0.5),
    rhodes: (t, m, d, v, out, o) => rhodes(t, m, d, 0.55 * v, out, 0.3, o.pan || 0),
    vibes: (t, m, d, v, out) => vibes(t, m, d, 0.8 * v, out),
    mbox: (t, m, d, v, out, o) => mbox(t, m, d, v, out, 0.55, o.det ? rnd(-o.det, o.det) : 0),
    marimba: (t, m, d, v, out) => marimba(t, m, d, v, out),
    flute: (t, m, d, v, out) => flute(t, m, d, v, out),
    bell: (t, m, d, v, out) => bell(t, m, d, 0.75 * v, out, 0.55),
    synth: (t, m, d, v, out) => synthPluck(t, m, d, out, 1.2 * v, 0.3),
    lead: (t, m, d, v, out) => lead(t, m, d, out, v),
    pluck: (t, m, d, v, out, o) => pluck(t, m, d, out, v, o.pan || 0, 0.3),
    pizz: (t, m, d, v, out) => pizz(t, m, d, v, out),
    brass: (t, m, d, v, out) => brass(t, [m], d, v, out),
    strlead: (t, m, d, v, out) => strings(t, [m], d, v, out, { att: 0.08, rel: 0.6, bright: true, wet: 0.45 })
  };
  function inst(name, t, m, dur, v, out, o = {}) { const f = INST[name]; if (f) f(t, m, dur, v, out, o); }
  // 和弦：铜管 / 弦乐整体发声，其它乐器按顺序轻轻「刷」出来
  function chord(name, t, midis, dur, v, out, o = {}) {
    if (name === 'brass') return brass(t, midis, dur, v, out);
    if (name === 'strings') return strings(t, midis, dur, v, out, o);
    const strum = name === 'pluck' ? 0.018 : name === 'pizz' ? 0.006 : 0.012;
    midis.forEach((m, i) => inst(name, t + i * strum, m, dur, v * (i ? 0.85 : 1), out, { pan: (i - 1.5) * 0.15 }));
  }

  // ================= 乐曲（全部原创；mp3 读不到时的合成版） =================
  // chords：每小节 C(根音, 和弦音...)；一小节换两个和弦时写成 [C(...), C(...)]（前两拍 / 后两拍）
  // mel：[拍, midi, 时值(拍)]，拍数从第一小节算起
  // keys：伴奏层 { inst, comp: 节奏型 } 或 { inst, arp: 琶音顺序, div: 每拍几个音 }；arp 里的 'r' = 低音区的根音
  // melInst：旋律乐器，或 [[乐器, 移调, 音量], ...] 叠几层；melInstB / drumsB / gtrB：后半段（B 段）换成的配置
  // swing：反拍八分音符推后多少拍（0.16 ≈ 三连音摇摆）；build：开头几小节只有轻的伴奏；delay：{ beats, fb, mix, keys, mel }；gain：整首的音量修正
  const C = (...n) => n;
  // 节奏型：[小节内的拍, 时值, 力度]，按小节轮流使用
  const COMP = {
    swing: [[[0, 1.4, 1], [1.5, 0.45, 0.75]], [[1, 0.45, 0.7], [2.5, 1.3, 0.9]], [[0, 0.45, 0.9], [2, 0.45, 0.7], [3.5, 0.5, 0.85]], [[1.5, 0.45, 0.8], [3, 0.9, 0.85]]],
    bossa: [[[0, 0.9, 1], [1.5, 0.4, 0.75], [2.5, 0.9, 0.85]], [[0.5, 0.9, 0.8], [2, 0.4, 0.75], [3, 0.9, 0.9]]],
    ballad: [[[0, 3.6, 1]], [[0, 1.8, 1], [2.5, 1.4, 0.7]]],
    halves: [[[0, 1.9, 1], [2, 1.9, 0.75]]],
    sparse: [[[0, 1.5, 1]], [[0, 0.8, 0.9], [2.5, 1.2, 0.7]]],
    stab: [[[0, 0.25, 1], [0.75, 0.25, 0.8], [2.5, 0.4, 0.9]], [[1.5, 0.25, 0.8], [2, 0.25, 0.9], [3.5, 0.4, 1]]],
    offbeat: [[[0.5, 0.2, 0.8], [1.5, 0.2, 0.65], [2.5, 0.2, 0.8], [3.5, 0.2, 0.65]], [[0.5, 0.2, 0.8], [1.5, 0.2, 0.65], [2.5, 0.2, 0.8], [3.25, 0.2, 0.6], [3.5, 0.2, 0.7]]]
  };

  // ---- 主题「花期」（D 大调，16 小节）：标题、高潮、结局共用 ----
  const MAIN_PROG = [
    C(38, 62, 66, 69), C(37, 61, 64, 69), C(35, 62, 66, 71), C(33, 61, 66, 69),
    C(31, 62, 67, 71), C(30, 62, 66, 69), C(28, 62, 67, 71), [C(33, 62, 64, 69), C(33, 61, 64, 69)],
    C(43, 62, 67, 71), C(45, 61, 64, 69), C(42, 61, 64, 69), C(35, 62, 66, 69),
    C(40, 62, 67, 71), C(42, 61, 64, 69), C(43, 62, 67, 71), [C(45, 62, 64, 69), C(45, 61, 64, 69)]];
  const MAIN_MEL = [
    [0, 69, 1], [1, 74, 1], [2, 76, 1.5], [3.5, 78, 0.5], [4, 76, 2], [6, 73, 1], [7, 69, 1],
    [8, 71, 1.5], [9.5, 73, 0.5], [10, 74, 1], [11, 78, 1], [12, 76, 3], [15, 73, 1],
    [16, 74, 1], [17, 71, 1], [18, 74, 1], [19, 79, 1], [20, 78, 1.5], [21.5, 76, 0.5], [22, 74, 2],
    [24, 71, 1], [25, 74, 1], [26, 74, 1], [27, 76, 1], [28, 74, 2], [30, 73, 1], [31, 69, 1],
    [32, 79, 1.5], [33.5, 78, 0.5], [34, 79, 1], [35, 81, 1], [36, 81, 1.5], [37.5, 79, 0.5], [38, 78, 1], [39, 76, 1],
    [40, 76, 2], [42, 73, 1], [43, 76, 1], [44, 78, 3], [47, 74, 1],
    [48, 74, 1], [49, 76, 1], [50, 79, 1.5], [51.5, 78, 0.5], [52, 76, 1], [53, 78, 1], [54, 81, 2],
    [56, 83, 2], [58, 81, 1], [59, 79, 1], [60, 76, 1], [61, 74, 1], [62, 73, 2]];
  const ARP8 = ['r', 0, 1, 2, 3, 2, 1, 0];

  const THEMES = {
    // 标题：钢琴分解和弦 + 弦乐，慢，带一点怀念但往前看
    title: { bpm: 72, chords: MAIN_PROG, mel: MAIN_MEL, melInst: 'piano', vel: 0.8, bassPat: 'whole', drums: 'none',
      keys: { inst: 'piano', arp: ARP8, div: 2, v: 0.26 }, strings: { v: 0.55 } },

    // LycoReco 的日常：bossa nova（F 大调），电钢琴 bossa 伴奏、低音提琴、边击 + 沙锤，颤音琴旋律
    daily: { bpm: 126, vel: 0.72, drums: 'bossa', bassPat: 'bossa', bassTone: 'upright', melInst: 'vibes',
      keys: { inst: 'rhodes', comp: 'bossa', v: 0.42 },
      chords: [C(41, 57, 60, 64, 67), C(41, 57, 60, 64, 67), C(43, 58, 62, 65, 69), C(36, 58, 62, 64, 69),
        C(45, 60, 64, 67, 71), C(38, 60, 64, 66, 71), C(43, 58, 62, 65, 69), C(36, 58, 62, 64, 69),
        C(46, 57, 60, 62, 65), C(39, 61, 65, 67, 70), C(45, 60, 64, 67, 71), C(38, 60, 64, 66, 71),
        C(43, 58, 62, 65, 69), C(36, 58, 62, 64, 69), C(41, 57, 60, 64, 67), [C(43, 58, 62, 65, 69), C(36, 58, 62, 64, 69)]],
      mel: [[0, 72, 1], [1, 69, 0.5], [1.5, 72, 1], [2.5, 76, 1.5], [5, 76, 0.5], [5.5, 74, 0.5], [6, 72, 1], [7, 69, 1],
        [8, 70, 1.5], [9.5, 74, 1], [10.5, 77, 1.5], [12, 76, 2], [14, 74, 0.5], [14.5, 70, 1.5],
        [16, 72, 1], [17, 71, 0.5], [17.5, 72, 1], [18.5, 76, 1.5], [20, 78, 1], [21, 76, 0.5], [21.5, 74, 1], [22.5, 72, 1.5],
        [24, 70, 1], [25, 69, 0.5], [25.5, 70, 1], [26.5, 74, 1.5], [28, 76, 1.5], [29.5, 74, 0.5], [30, 72, 2],
        [32, 77, 1], [33, 76, 0.5], [33.5, 77, 1], [34.5, 81, 1.5], [36, 79, 1.5], [37.5, 77, 0.5], [38, 73, 2],
        [40, 76, 1], [41, 72, 0.5], [41.5, 76, 1], [42.5, 79, 1.5], [44, 78, 2], [46, 72, 1], [47, 74, 1],
        [48, 74, 1], [49, 70, 0.5], [49.5, 74, 1], [50.5, 77, 1.5], [52, 76, 1], [53, 74, 1], [54, 72, 1], [55, 70, 1],
        [56, 69, 3], [59.5, 72, 0.5], [60, 74, 1], [61, 70, 1], [62, 76, 2]] },

    // 千束：明亮、有点坏心眼的爵士流行（G 大调，摇摆），钢琴切分伴奏、行走低音、拍手，方波合成器旋律
    chisato: { bpm: 144, vel: 0.75, swing: 0.15, drums: 'jazzpop', bassPat: 'walk', bassTone: 'upright', melInst: [['synth', 0, 1], ['vibes', 0, 0.35]],
      keys: { inst: 'piano', comp: 'swing', v: 0.36 },
      chords: [C(43, 59, 62, 66, 69), C(40, 62, 66, 67, 71), C(45, 60, 64, 67, 71), C(38, 60, 64, 66, 71),
        C(35, 57, 62, 64, 69), C(40, 62, 66, 68, 71), C(45, 60, 64, 67, 71), C(38, 60, 64, 66, 71),
        C(36, 59, 62, 64, 67), C(36, 57, 60, 63, 67), C(35, 57, 62, 64, 69), C(40, 62, 66, 68, 71),
        C(45, 60, 64, 67, 71), C(38, 60, 64, 66, 71), C(43, 59, 62, 64, 67), C(38, 60, 64, 66, 71)],
      mel: [[0, 71, 0.5], [0.5, 74, 0.5], [1, 78, 0.5], [1.5, 79, 1], [3, 76, 0.5], [3.5, 78, 0.5],
        [4, 79, 0.5], [5, 76, 0.5], [5.5, 74, 1], [7, 71, 0.5], [7.5, 73, 0.5],
        [8, 72, 0.5], [8.5, 76, 0.5], [9, 79, 0.5], [9.5, 81, 1], [11, 79, 0.5], [11.5, 76, 0.5],
        [12, 78, 1.5], [13.5, 77, 0.5], [14, 76, 0.5], [14.5, 72, 0.5], [15, 74, 1],
        [16, 74, 0.5], [16.5, 78, 0.5], [17, 81, 0.5], [17.5, 83, 1], [19, 81, 0.5], [19.5, 78, 0.5],
        [20, 80, 1.5], [21.5, 79, 0.5], [22, 76, 0.5], [22.5, 74, 1],
        [24, 72, 0.5], [24.5, 74, 0.5], [25, 76, 0.5], [25.5, 79, 0.5], [26, 81, 0.5], [26.5, 79, 0.5], [27, 76, 1],
        [28, 78, 0.5], [29, 81, 0.5], [29.5, 84, 1], [31, 79, 0.5], [31.5, 78, 0.5],
        [32, 76, 1.5], [33.5, 79, 0.5], [34, 83, 1], [35, 81, 0.5], [35.5, 79, 0.5],
        [36, 75, 1.5], [37.5, 74, 0.5], [38, 72, 1], [39, 69, 1],
        [40, 74, 0.5], [40.5, 78, 0.5], [41, 81, 1], [42.5, 78, 0.5], [43, 76, 1],
        [44, 80, 0.5], [44.5, 83, 0.5], [45, 86, 1], [46.5, 83, 0.5], [47, 80, 1],
        [48, 81, 1], [49.5, 79, 0.5], [50, 76, 0.5], [50.5, 72, 1],
        [52, 74, 0.5], [52.5, 78, 0.5], [53, 81, 0.5], [53.5, 84, 0.5], [54, 83, 0.5], [54.5, 81, 1],
        [56, 79, 2], [58.5, 76, 0.5], [59, 79, 0.5],
        [60.5, 81, 0.5], [61, 78, 0.5], [61.5, 74, 0.5], [62, 72, 0.5], [62.5, 69, 0.5], [63, 66, 0.5], [63.5, 69, 0.5]] },

    // 泷奈：冷静、克制但温柔（D 多利亚），清音吉他琶音 + 附点延迟，边击轻鼓，电钢琴旋律
    takina: { bpm: 86, vel: 0.72, drums: 'rimsoft', bassPat: 'two', bassTone: 'finger', melInst: 'rhodes', pad: true,
      keys: { inst: 'pluck', arp: [0, 2, 1, 3, 2, 4, 3, 1], div: 2, v: 0.5 }, delay: { beats: 0.75, fb: 0.32, mix: 0.28, keys: true, mel: true },
      chords: [C(38, 60, 64, 65, 69), C(34, 57, 62, 65, 69), C(43, 57, 58, 62, 65), [C(45, 55, 62, 64, 69), C(45, 55, 61, 64, 69)],
        C(38, 60, 64, 65, 69), C(41, 57, 60, 64, 67), C(34, 57, 62, 65, 69), C(36, 55, 60, 62, 67),
        C(43, 57, 58, 62, 65), C(45, 55, 60, 64, 67), C(34, 57, 62, 65, 69), C(33, 57, 60, 65, 69),
        C(43, 58, 62, 65, 69), C(45, 55, 60, 64, 67), C(34, 57, 62, 65, 69), [C(45, 55, 62, 64, 69), C(45, 55, 61, 64, 69)]],
      mel: [[0, 69, 1.5], [1.5, 72, 0.5], [2, 76, 2], [4, 77, 1.5], [5.5, 76, 0.5], [6, 74, 2],
        [8, 70, 1], [9, 72, 1], [10, 74, 1.5], [11.5, 77, 0.5], [12, 76, 3], [15, 73, 1],
        [16, 74, 1.5], [17.5, 76, 0.5], [18, 77, 1], [19, 81, 1], [20, 79, 3], [23, 76, 1],
        [24, 77, 1.5], [25.5, 74, 0.5], [26, 72, 1], [27, 69, 1], [28, 74, 2], [30, 72, 2],
        [32, 70, 1], [33, 74, 1], [34, 81, 2], [36, 79, 1.5], [37.5, 76, 0.5], [38, 72, 2],
        [40, 74, 1], [41, 77, 1], [42, 81, 1.5], [43.5, 79, 0.5], [44, 77, 3], [47, 76, 1],
        [48, 74, 1.5], [49.5, 72, 0.5], [50, 70, 1], [51, 74, 1], [52, 72, 2], [54, 76, 2],
        [56, 77, 1], [57, 76, 1], [58, 74, 1], [59, 72, 1], [60, 74, 2], [62, 73, 2]] },

    // 吵吵闹闹：滑稽的断奏（C 大调），拨奏弦乐反拍、蹦跳的低音、木鱼，马林巴旋律
    comedy: { bpm: 152, vel: 0.72, gain: 1.2, drums: 'comic', bassPat: 'bounce', bassTone: 'pick', melInst: [['marimba', 0, 1], ['pizz', 12, 0.35]],
      keys: { inst: 'pizz', comp: 'offbeat', v: 0.55 },
      chords: [C(36, 60, 64, 67), [C(38, 60, 65, 69), C(43, 59, 65, 67)], C(36, 60, 64, 67), C(45, 61, 64, 67),
        C(38, 62, 65, 69), C(43, 59, 65, 67), [C(40, 59, 62, 67), C(45, 61, 64, 67)], [C(38, 60, 65, 69), C(43, 59, 65, 67)],
        C(41, 60, 65, 69), C(42, 60, 63, 69), C(43, 60, 64, 67), C(45, 61, 64, 67),
        C(38, 60, 65, 69), C(43, 59, 65, 67), C(36, 60, 64, 67), [C(38, 60, 65, 69), C(43, 59, 65, 67)]],
      mel: [[0, 72, 0.4], [1, 76, 0.4], [1.5, 75, 0.25], [2, 76, 0.4], [3, 79, 0.4],
        [4, 77, 0.4], [4.5, 76, 0.25], [5, 74, 0.4], [6, 71, 0.4], [6.5, 72, 0.25], [7, 74, 0.4],
        [8, 76, 0.4], [8.5, 79, 0.25], [9, 84, 0.5], [10, 83, 0.25], [10.5, 82, 0.25], [11, 81, 0.5],
        [12, 81, 0.4], [12.5, 79, 0.25], [13, 76, 0.4], [14, 73, 0.4], [15, 69, 0.5],
        [16, 74, 0.4], [16.5, 77, 0.25], [17, 81, 0.4], [18, 80, 0.25], [18.5, 81, 0.25], [19, 77, 0.5],
        [20, 79, 0.4], [20.5, 77, 0.25], [21, 74, 0.4], [22, 71, 0.4], [23, 67, 0.5],
        [24, 67, 0.25], [24.5, 71, 0.25], [25, 74, 0.4], [26, 73, 0.25], [26.5, 76, 0.25], [27, 79, 0.4],
        [28, 77, 0.5], [29, 74, 0.25], [30, 79, 0.3], [30.5, 77, 0.3], [31, 74, 0.3], [31.5, 71, 0.3],
        [32, 72, 0.4], [32.5, 77, 0.4], [33.5, 77, 0.25], [34, 81, 0.5], [35, 77, 0.4],
        [36, 78, 0.4], [36.5, 81, 0.25], [37, 84, 0.4], [38, 87, 0.25], [38.5, 84, 0.25], [39, 81, 0.4],
        [40, 79, 0.5], [41, 76, 0.4], [41.5, 72, 0.25], [42, 79, 0.4], [43, 84, 0.5],
        [44, 82, 0.25], [44.5, 81, 0.4], [45, 79, 0.4], [46, 76, 0.25], [46.5, 73, 0.25], [47, 69, 0.4],
        [48, 74, 0.25], [48.5, 77, 0.25], [49, 81, 0.25], [49.5, 84, 0.5], [51, 81, 0.4],
        [52, 83, 0.25], [52.5, 79, 0.25], [53, 77, 0.25], [53.5, 74, 0.25], [54, 71, 0.4], [55, 67, 0.4],
        [56, 76, 0.3], [56.5, 72, 0.3], [57, 67, 0.3], [58, 72, 0.6],
        [60, 74, 0.3], [60.5, 77, 0.3], [62, 83, 0.3], [62.5, 79, 0.3], [63, 74, 0.3], [63.5, 71, 0.3]] },

    // 打烊之后：深夜的电钢琴抒情曲（降 E 大调），鼓刷很轻
    cafe_night: { bpm: 64, vel: 0.68, gain: 1.35, swing: 0.1, drums: 'brush', bassPat: 'two', bassTone: 'upright', melInst: 'rhodes',
      keys: { inst: 'rhodes', comp: 'ballad', v: 0.36, oct: -12 },
      chords: [C(39, 62, 65, 67, 70), C(36, 58, 62, 63, 67), C(41, 60, 63, 67, 68), [C(46, 60, 63, 65, 68), C(46, 60, 62, 65, 68)],
        C(43, 58, 62, 65), C(36, 58, 61, 64, 67), C(41, 60, 63, 67, 68), C(44, 59, 63, 65, 68),
        C(44, 60, 63, 67, 70), C(43, 58, 62, 65), C(41, 60, 63, 67, 68), C(46, 60, 62, 65, 68),
        C(43, 62, 65, 67, 70), C(44, 60, 63, 67, 70), C(41, 60, 63, 67, 68), [C(46, 60, 63, 65, 68), C(46, 60, 62, 65, 68)]],
      mel: [[0, 70, 1.5], [1.5, 72, 0.5], [2, 74, 2], [4, 75, 1], [5, 74, 1], [6, 70, 2],
        [8, 72, 1.5], [9.5, 75, 0.5], [10, 79, 2], [12, 77, 2.5], [14.5, 75, 0.5], [15, 74, 1],
        [16, 74, 1], [17, 77, 1], [18, 82, 1.5], [19.5, 79, 0.5], [20, 79, 2], [22, 76, 1], [23, 73, 1],
        [24, 72, 3], [27, 75, 1], [28, 75, 1.5], [29.5, 71, 0.5], [30, 70, 2],
        [32, 72, 1], [33, 75, 1], [34, 79, 1], [35, 82, 1], [36, 79, 2], [38, 77, 1], [39, 74, 1],
        [40, 75, 2], [42, 72, 1], [43, 75, 1], [44, 74, 3], [47, 72, 1],
        [48, 70, 1.5], [49.5, 74, 0.5], [50, 77, 1], [51, 79, 1], [52, 82, 2], [54, 79, 1], [55, 75, 1],
        [56, 77, 1.5], [57.5, 75, 0.5], [58, 72, 2], [60, 72, 2], [62, 74, 2]] },

    // 两个人：温暖、慢（A 大调），钢琴 + 弦乐
    warm: { bpm: 68, vel: 0.75, gain: 2.2, drums: 'none', bassPat: 'pianoLH', melInst: 'piano', strings: { v: 0.5 },
      keys: { inst: 'piano', comp: 'halves', v: 0.2 },
      chords: [C(45, 61, 64, 69, 71), C(44, 59, 64, 68), C(42, 61, 64, 69), C(38, 57, 61, 66, 69),
        C(35, 57, 62, 66, 69), C(37, 56, 59, 64, 68), C(38, 57, 61, 66, 69), [C(40, 59, 64, 69), C(40, 59, 64, 68)],
        C(38, 57, 61, 66, 69), C(40, 59, 64, 68), C(37, 56, 59, 64, 68), C(42, 61, 64, 69),
        C(35, 57, 62, 66, 69), C(44, 59, 64, 68), C(42, 61, 64, 69), [C(38, 57, 61, 66, 69), C(40, 59, 64, 68)]],
      mel: [[0, 76, 2], [2, 73, 1], [3, 71, 1], [4, 68, 1], [5, 71, 1], [6, 76, 2],
        [8, 78, 1.5], [9.5, 76, 0.5], [10, 73, 1], [11, 76, 1], [12, 73, 3], [15, 69, 1],
        [16, 74, 1], [17, 73, 1], [18, 74, 1], [19, 78, 1], [20, 76, 2], [22, 71, 1], [23, 73, 1],
        [24, 78, 1.5], [25.5, 76, 0.5], [26, 73, 1], [27, 69, 1], [28, 69, 2], [30, 68, 2],
        [32, 69, 1], [33, 73, 1], [34, 78, 2], [36, 80, 1.5], [37.5, 78, 0.5], [38, 76, 2],
        [40, 76, 1], [41, 80, 1], [42, 83, 1.5], [43.5, 81, 0.5], [44, 81, 3], [47, 76, 1],
        [48, 78, 1.5], [49.5, 76, 0.5], [50, 74, 1], [51, 73, 1], [52, 71, 2], [54, 76, 2],
        [56, 73, 1.5], [57.5, 76, 0.5], [58, 81, 2], [60, 78, 1.5], [61.5, 76, 0.5], [62, 74, 1], [63, 71, 1]] },

    // 花店：温柔怀旧（降 B 大调），八音盒旋律 + 轻柔的钢琴分解和弦
    koharu: { bpm: 82, vel: 0.72, drums: 'none', bassPat: 'whole', pad: true, melInst: [['mbox', 12, 1], ['piano', 0, 0.22]],
      keys: { inst: 'piano', arp: ['r', 0, 1, 2], div: 1, v: 0.24 },
      chords: [C(46, 62, 65, 70), C(45, 60, 65, 69), C(43, 62, 67, 70), C(41, 62, 65, 69),
        C(39, 63, 67, 70), C(38, 62, 65, 70), C(36, 63, 67, 70), [C(41, 63, 65, 70), C(41, 63, 65, 69)],
        C(39, 63, 67, 70), C(41, 60, 65, 69), C(38, 60, 65, 69), C(43, 62, 65, 70),
        C(36, 63, 67, 70), C(41, 60, 65, 69), [C(38, 62, 65, 70), C(39, 63, 67, 70)], C(41, 63, 65, 69)],
      mel: [[0, 74, 1], [1, 77, 1], [2, 82, 1.5], [3.5, 81, 0.5], [4, 77, 2], [6, 81, 1], [7, 79, 1],
        [8, 79, 1.5], [9.5, 77, 0.5], [10, 74, 2], [12, 77, 1], [13, 74, 1], [14, 69, 2],
        [16, 70, 1], [17, 75, 1], [18, 79, 1.5], [19.5, 77, 0.5], [20, 77, 2], [22, 74, 1], [23, 77, 1],
        [24, 75, 1], [25, 74, 1], [26, 72, 1], [27, 70, 1], [28, 72, 3], [31, 69, 1],
        [32, 70, 1], [33, 75, 1], [34, 79, 2], [36, 81, 1.5], [37.5, 79, 0.5], [38, 77, 2],
        [40, 77, 1], [41, 81, 1], [42, 84, 2], [44, 82, 2], [46, 79, 1], [47, 77, 1],
        [48, 75, 1.5], [49.5, 77, 0.5], [50, 79, 2], [52, 81, 3], [55, 77, 1],
        [56, 74, 2], [58, 79, 2], [60, 77, 2], [62, 75, 1], [63, 72, 1]] },

    // 凋谢：钢琴独奏（E 小调），慢
    sad: { bpm: 58, vel: 0.8, gain: 2.4, drums: 'none', bassPat: 'none', melInst: 'piano',
      keys: { inst: 'piano', arp: ['r', 0, 1, 2], div: 1, v: 0.3 },
      chords: [C(40, 59, 64, 67), C(36, 59, 64, 67), C(45, 60, 64, 67), [C(35, 59, 64, 69), C(35, 59, 63, 69)],
        C(43, 59, 64, 67), C(36, 59, 64, 67), C(45, 60, 64, 66), C(35, 59, 63, 69),
        C(36, 59, 64, 67), C(38, 62, 66, 69), C(35, 62, 66, 69), C(40, 62, 67, 71),
        C(45, 60, 64, 67), C(38, 62, 66, 69), C(36, 59, 64, 67), [C(35, 59, 64, 69), C(35, 59, 63, 69)]],
      mel: [[0, 71, 2], [2, 67, 1], [3, 66, 1], [4, 64, 3], [7, 71, 1],
        [8, 72, 1.5], [9.5, 71, 0.5], [10, 69, 1], [11, 67, 1], [12, 69, 2], [14, 66, 2],
        [16, 71, 1.5], [17.5, 74, 0.5], [18, 76, 2], [20, 79, 2], [22, 76, 1], [23, 71, 1],
        [24, 72, 2], [26, 69, 1], [27, 66, 1], [28, 63, 2], [30, 66, 2],
        [32, 67, 1], [33, 71, 1], [34, 76, 2], [36, 78, 1.5], [37.5, 76, 0.5], [38, 74, 2],
        [40, 74, 1], [41, 71, 1], [42, 69, 2], [44, 67, 3], [47, 71, 1],
        [48, 72, 1.5], [49.5, 76, 0.5], [50, 79, 2], [52, 78, 2], [54, 74, 1], [55, 81, 1],
        [56, 79, 2], [58, 76, 1], [59, 71, 1], [60, 76, 2], [62, 75, 2]] },

    // 名单：神秘的中速（升 F 小调），闷音低音八分、稀疏的电钢琴，颤音琴动机 + 延迟
    investigation: { bpm: 96, vel: 0.7, gain: 1.3, drums: 'pulse', bassPat: 'pulse8', bassTone: 'finger', melInst: 'vibes',
      keys: { inst: 'rhodes', comp: 'sparse', v: 0.3 }, strings: { v: 0.45, dark: true }, delay: { beats: 0.75, fb: 0.38, mix: 0.3, mel: true },
      chords: [C(42, 57, 61, 66), C(41, 57, 61, 65), C(40, 57, 61, 64), C(39, 57, 61, 66),
        C(38, 57, 61, 66), C(37, 59, 61, 66), C(35, 57, 62, 66), C(37, 59, 65, 68),
        C(42, 57, 61, 66), C(43, 59, 62, 66), C(42, 57, 61, 66), C(43, 59, 62, 66),
        C(40, 59, 62, 67), C(38, 57, 61, 66), C(35, 57, 62, 66), C(37, 59, 62, 65)],
      mel: [[1, 78, 0.5], [1.5, 73, 0.5], [2, 76, 2], [6, 77, 0.5], [6.5, 73, 0.5], [7, 69, 1],
        [9, 76, 0.5], [9.5, 73, 0.5], [10, 81, 2], [14, 78, 1], [15, 75, 1],
        [17, 78, 0.5], [17.5, 73, 0.5], [18, 81, 2], [22, 78, 1], [23, 71, 1],
        [25, 74, 0.5], [25.5, 78, 0.5], [26, 81, 1.5], [27.5, 78, 0.5], [28, 77, 2], [31, 80, 1],
        [33, 81, 0.5], [33.5, 78, 0.5], [34, 73, 2], [37, 74, 0.5], [37.5, 78, 0.5], [38, 83, 2],
        [41, 81, 0.5], [41.5, 78, 0.5], [42, 76, 2], [45, 79, 0.5], [45.5, 78, 0.5], [46, 74, 2],
        [49, 71, 0.5], [49.5, 74, 0.5], [50, 79, 2], [53, 76, 0.5], [53.5, 78, 0.5], [54, 81, 2],
        [57, 78, 0.5], [57.5, 74, 0.5], [58, 71, 2], [60, 74, 1], [61, 77, 1], [62, 80, 2]] },

    // 不安：低沉的心跳、不协和的长音，几乎没有旋律
    tension: { bpm: 70, vel: 0.72, gain: 1.1, drums: 'heart', bassPat: 'pulse', bassTone: 'finger', melInst: 'piano', pad: true, strings: { v: 0.6, dark: true },
      chords: [C(38, 50, 53, 57), C(38, 51, 53, 57), C(34, 50, 53, 58), C(37, 49, 52, 55),
        C(38, 50, 53, 57), C(39, 51, 54, 57), C(34, 50, 53, 57), C(33, 49, 52, 55)],
      mel: [[6, 74, 2], [14, 75, 2], [22, 77, 1], [23, 76, 1], [30, 73, 2]] },

    // 夜路：孤独的夜晚街道（A 小调），lo-fi 慢拍子、小七和弦、唱片底噪，长笛旋律 + 延迟
    night: { bpm: 76, vel: 0.7, swing: 0.12, drums: 'lofi', bassPat: 'two', bassTone: 'finger', melInst: 'flute', crackle: true,
      keys: { inst: 'rhodes', comp: 'ballad', v: 0.34, oct: -12 }, delay: { beats: 0.75, fb: 0.3, mix: 0.25, mel: true },
      chords: [C(45, 60, 64, 67, 71), C(41, 57, 60, 64, 67), C(38, 60, 64, 65, 69), C(40, 56, 62, 67),
        C(45, 60, 64, 67, 71), C(41, 57, 60, 64, 67), C(35, 57, 62, 65), [C(40, 57, 62, 64, 71), C(40, 56, 62, 64, 71)],
        C(38, 60, 64, 65, 69), C(43, 59, 64, 65, 69), C(36, 59, 62, 64, 67), C(41, 57, 60, 64, 67),
        C(35, 57, 62, 65), C(40, 56, 62, 64, 71), C(45, 60, 64, 67, 71), [C(41, 57, 60, 64, 67), C(40, 56, 62, 64, 71)]],
      mel: [[0.5, 76, 0.5], [1, 79, 1], [2, 76, 0.5], [2.5, 72, 1.5], [5, 72, 0.5], [5.5, 74, 0.5], [6, 76, 2],
        [8.5, 77, 0.5], [9, 76, 0.5], [9.5, 74, 0.5], [10, 72, 2], [12, 71, 1.5], [13.5, 68, 2.5],
        [16.5, 76, 0.5], [17, 79, 1], [18, 83, 0.5], [18.5, 81, 1.5], [21, 79, 0.5], [21.5, 76, 0.5], [22, 72, 2],
        [24.5, 74, 0.5], [25, 77, 1], [26, 76, 0.5], [26.5, 74, 1.5], [28, 71, 2], [30.5, 68, 0.5], [31, 71, 1],
        [32.5, 69, 0.5], [33, 72, 1], [34, 76, 2], [36.5, 77, 0.5], [37, 76, 1], [38, 74, 2],
        [40.5, 71, 0.5], [41, 74, 1], [42, 79, 2], [44.5, 81, 0.5], [45, 79, 0.5], [45.5, 76, 2.5],
        [48.5, 77, 0.5], [49, 74, 1], [50, 69, 2], [52.5, 68, 0.5], [53, 71, 1], [54, 74, 2],
        [56.5, 72, 0.5], [57, 76, 1], [58, 72, 2], [61, 69, 1], [62, 68, 2]] },

    // 枪声：快速的放克 / 摇滚动作曲（E 小调），放克鼓 + 合成器低音 riff + 铜管 stab；B 段换成失真主音吉他
    action: { bpm: 138, vel: 0.82, drums: 'funk', drumsB: 'drive', bassPat: 'funk', bassTone: 'synth', melInst: 'brass', melInstB: 'lead', gtr: 'mute', gtrB: 'power8',
      keys: { inst: 'brass', comp: 'stab', v: 0.7 },
      chords: [C(40, 62, 64, 67, 71), C(40, 62, 64, 67, 71), C(36, 59, 64, 67, 71), C(38, 62, 66, 69, 74),
        C(40, 62, 64, 67, 71), C(40, 62, 64, 67, 71), C(36, 59, 64, 67, 71), C(35, 63, 69, 74),
        C(45, 60, 64, 67, 72), C(47, 62, 66, 69, 74), C(36, 60, 64, 67, 71), C(38, 62, 66, 69, 74),
        C(45, 60, 64, 67, 72), C(47, 62, 66, 69, 74), C(36, 60, 64, 67, 72), C(35, 63, 66, 69, 71)],
      mel: [[0, 71, 0.25], [0.5, 74, 0.25], [0.75, 76, 0.5], [1.5, 74, 0.25], [2, 71, 0.5], [3, 79, 0.25], [3.25, 78, 0.25], [3.5, 76, 0.5],
        [4.75, 71, 0.25], [5, 74, 0.5], [6, 76, 1.5], [7.5, 79, 0.5],
        [8, 79, 0.25], [8.5, 78, 0.25], [8.75, 76, 0.5], [9.5, 71, 0.5], [10, 74, 1], [11, 71, 0.5], [11.5, 72, 0.5],
        [12, 74, 0.25], [12.5, 78, 0.25], [12.75, 81, 0.75], [13.5, 78, 0.5], [14, 76, 0.5], [14.5, 74, 1.5],
        [16, 71, 0.25], [16.5, 74, 0.25], [16.75, 76, 0.5], [17.5, 74, 0.25], [18, 71, 0.5], [19, 79, 0.25], [19.25, 78, 0.25], [19.5, 76, 0.5],
        [20.75, 71, 0.25], [21, 74, 0.5], [22, 79, 0.5], [22.5, 81, 0.5], [23, 83, 1],
        [24, 83, 0.25], [24.5, 81, 0.25], [24.75, 79, 0.5], [25.5, 76, 0.5], [26, 78, 0.5], [26.5, 79, 1.5],
        [28, 78, 0.5], [28.5, 75, 0.5], [29, 74, 0.25], [29.25, 75, 0.25], [29.5, 71, 1],
        [32, 76, 1], [33, 79, 0.5], [33.5, 81, 1], [34.5, 84, 1.5], [36, 83, 1.5], [37.5, 81, 0.5], [38, 78, 1], [39, 74, 1],
        [40, 76, 0.5], [40.5, 79, 0.5], [41, 83, 1], [42, 81, 0.5], [42.5, 79, 1.5], [44, 78, 1.5], [45.5, 76, 0.5], [46, 74, 1], [47, 81, 1],
        [48, 84, 1], [49, 83, 0.5], [49.5, 81, 1], [50.5, 79, 1.5], [52, 78, 0.5], [52.5, 81, 0.5], [53, 86, 1.5], [54.5, 83, 1.5],
        [56, 84, 1], [57, 83, 0.5], [57.5, 79, 0.5], [58, 76, 2], [60, 83, 0.25], [60.75, 83, 0.25], [61.5, 83, 0.5]] },

    // DA：冷、制度化、不祥（C 小调），低音弦乐 + 低沉的定音鼓 + 稀疏的钟
    da: { bpm: 56, vel: 0.78, drums: 'timp', bassPat: 'pulse', bassTone: 'finger', melInst: 'bell', strings: { v: 1, dark: true },
      chords: [C(36, 48, 55, 63), C(36, 48, 56, 63), C(36, 48, 55, 63), C(36, 49, 54, 58),
        C(36, 48, 55, 63), C(32, 48, 56, 63), C(32, 48, 53, 56), [C(31, 47, 55, 62), C(31, 47, 53, 56)]],
      mel: [[2, 79, 2], [10, 80, 2], [14, 78, 2], [18, 79, 1], [19, 75, 1], [26, 72, 2], [30, 71, 2]] },

    // 白色房间：没有旋律的低频，偶尔有走调的高音、金属的刮擦和耳鸣似的拍频
    dark: { bpm: 40, vel: 0.85, gain: 0.6, drums: 'none', bassPat: 'whole', bassTone: 'finger', melInst: 'none', drone: true, fx: 'dark', strings: { v: 0.8, dark: true },
      chords: [C(26, 50, 51, 57), C(26, 50, 53, 56), C(25, 49, 52, 56), C(27, 51, 54, 57)], mel: [] },

    // 花期 —— 零点：高潮。主题旋律交给弦乐 + 高八度钢琴，前 8 小节只有钢琴和弦乐在积蓄，然后鼓进来
    climax: { bpm: 92, vel: 0.85, build: 8, drums: 'anthem', drumsB: 'drive', bassPat: 'eighth', bassTone: 'pick', chords: MAIN_PROG, mel: MAIN_MEL,
      melInst: [['strlead', 0, 1], ['piano', 12, 0.55]], keys: [{ inst: 'piano', arp: ARP8, div: 2, v: 0.26 }, { inst: 'brass', comp: 'sparse', v: 0.35, from: 'B' }],
      strings: { v: 0.6 } },

    // 十岁：童年的回忆，走了调的八音盒，慢
    memory: { bpm: 62, vel: 0.7, gain: 3.2, drums: 'none', bassPat: 'none', pad: true, crackle: true, melInst: 'mbox', melOct: 12, det: 22,
      keys: { inst: 'mbox', arp: [0, 1, 2, 1], div: 1, v: 0.5 },
      chords: [C(36, 60, 64, 67), C(45, 60, 64, 69), C(41, 60, 65, 69), C(43, 59, 62, 67),
        C(40, 60, 64, 67), C(41, 60, 65, 69), C(38, 60, 65, 69), [C(43, 60, 62, 67), C(43, 59, 62, 67)]],
      mel: [[0, 67, 1], [1, 72, 1], [2, 76, 1], [3, 74, 1], [4, 72, 2], [6, 76, 1], [7, 72, 1],
        [8, 77, 1.5], [9.5, 76, 0.5], [10, 72, 1], [11, 69, 1], [12, 71, 3], [15, 67, 1],
        [16, 67, 1], [17, 72, 1], [18, 76, 1], [19, 79, 1], [20, 81, 2], [22, 77, 1], [23, 76, 1],
        [24, 74, 1], [25, 77, 1], [26, 76, 1], [27, 72, 1], [28, 74, 3], [31, 71, 1]] },

    // 彼岸：结局。主题旋律慢一点，钢琴 + 高八度的钟 + 弦乐，温暖、有一点舍不得
    ending: { bpm: 64, vel: 0.72, drums: 'none', bassPat: 'whole', chords: MAIN_PROG, mel: MAIN_MEL, pad: true,
      melInst: [['piano', 0, 0.9], ['bell', 12, 0.3]], keys: { inst: 'piano', arp: ARP8, div: 2, v: 0.2 }, strings: { v: 0.4 } }
  };
  const TITLES = { title: '花期 —— 主题曲', daily: 'LycoReco 的日常', chisato: '千束', takina: '泷奈', comedy: '吵吵闹闹', cafe_night: '打烊之后', warm: '两个人',
    koharu: '花店', sad: '凋谢', investigation: '名单', tension: '不安', night: '夜路', action: '枪声', da: 'DA', dark: '白色房间', climax: '花期 —— 零点', memory: '十岁', ending: '彼岸' };

  // ================= mp3 BGM（Suno 生成，assets/bgm/名字.mp3）；读不到时退回合成版 =================
  // 在这里写上曲名（例如 'title'）后，这首会先读 assets/bgm/title.mp3，读不到再用合成版；没列出的曲目直接用合成版
  const BGM_MP3 = [];
  let curAudio = null, muffled = false;
  const BGM_GAIN = 0.85;
  function audioTarget() { return MUTED ? 0 : vol.bgm * BGM_GAIN * (muffled ? 0.35 : 1); }
  // 按真实时间推进（窗口在后台、计时器被降频时也会按时结束，不会拖成几十秒的交叠）
  function fadeAudio(a, to, sec, done) {
    clearInterval(a._fade);
    const from = a.volume, t0 = performance.now(), dur = Math.max(0.01, sec) * 1000;
    a._fadeEnd = t0 + dur;
    const step = () => { const k = Math.min(1, (performance.now() - t0) / dur); a.volume = Math.max(0, Math.min(1, from + (to - from) * k)); if (k >= 1) { clearInterval(a._fade); a._fade = null; done && done(); } };
    a._fade = setInterval(step, 1000 / 30);
  }
  const dying = new Set(); // 正在淡出的旧曲
  function killAudio(a, sec) {
    dying.add(a);
    fadeAudio(a, 0, Math.max(0.05, sec), () => { dying.delete(a); a.pause(); a.removeAttribute('src'); a.load(); });
  }
  // 换曲：旧曲先快速淡出（最多 0.8 秒），新曲等旧曲基本听不见了再淡入，两首不会同时以可闻的音量叠在一起
  function playTheme(name, fade = 1.5) {
    init();
    if (curTheme === name) return;
    const out = Math.min(fade, 0.8);
    stopTheme(out);
    dying.forEach(d => { if (d._fadeEnd - performance.now() > out * 1000) killAudio(d, out); });
    if (!name || !THEMES[name]) { curTheme = null; return; }
    if (!BGM_MP3.includes(name) || MUTED) { playSynth(name, fade); return; }
    curTheme = name;
    const a = new Audio('assets/bgm/' + name + '.mp3');
    a.loop = true; a.volume = 0; a.preload = 'auto';
    curAudio = a;
    const fallback = () => { if (curAudio === a && curTheme === name) { curAudio = null; curTheme = null; playSynth(name, fade); } };
    a.onerror = fallback;
    const wait = dying.size ? out * 0.7 * 1000 : 0, t0 = performance.now();
    a.play().then(() => {
      setTimeout(() => { if (curAudio === a) fadeAudio(a, audioTarget(), Math.max(0.05, fade)); }, Math.max(0, wait - (performance.now() - t0)));
    }).catch(fallback);
  }

  // ---- 合成版的编曲器：每次排一整小节 ----
  const fifthOf = r => (r + 7 > 47 ? r - 5 : r + 7);
  const ivls = c => [...new Set(c.slice(1).map(m => ((m - c[0]) % 12 + 12) % 12))];
  const thirdOf = c => { const iv = ivls(c); return iv.includes(4) ? 4 : iv.includes(3) ? 3 : 5; };
  const fifthIv = c => { const iv = ivls(c); return iv.includes(7) ? 7 : iv.includes(6) ? 6 : iv.includes(8) ? 8 : 7; };
  const inBass = m => { while (m > 50) m -= 12; while (m < 28) m += 12; return m; };
  const FUNK = [[[0, 0, 0.4], [0.75, 0, 0.2], [1.5, 12, 0.25], [2, 0, 0.3], [2.75, 10, 0.2], [3, 12, 0.25], [3.5, 7, 0.25]],
    [[0, 0, 0.3], [0.5, 0, 0.2], [1, 12, 0.2], [1.75, 0, 0.2], [2.5, 7, 0.25], [3, 10, 0.25], [3.5, 12, 0.2], [3.75, 0, 0.2]]];
  function bassBar(th, P, spb, chordAt, nextRoot, out, bv, bar, vel) {
    const tone = th.bassTone || 'finger';
    const B = (pos, m, d, v = 1) => bass(P(pos), m, d * spb, out, bv * v, tone);
    const cA = chordAt(0), cB = chordAt(2), split = cA !== cB, rA = cA[0], rB = cB[0];
    const bp = th.bassPat;
    if (bp === 'whole') { if (split) { B(0, rA, 1.9, 0.8); B(2, rB, 1.9, 0.8); } else B(0, rA, 3.8, 0.8); }
    else if (bp === 'two') { B(0, rA, 1.8); B(2, split ? rB : inBass(rA + fifthIv(cA)), 1.8, 0.85); }
    else if (bp === 'pulse') { for (let i = 0; i < 4; i++) B(i, chordAt(i)[0], 0.5, i ? 0.6 : 0.75); }
    else if (bp === 'pulse8') { for (let i = 0; i < 8; i++) B(i / 2, chordAt(i / 2)[0] + (i === 7 ? 12 : 0), 0.3, i % 2 ? 0.45 : 0.65); }
    else if (bp === 'eighth') { for (let i = 0; i < 8; i++) B(i / 2, chordAt(i / 2)[0], 0.45, i % 2 ? 0.85 : 1); }
    else if (bp === 'octave') { for (let i = 0; i < 8; i++) B(i / 2, chordAt(i / 2)[0] + (i % 2 ? 12 : 0), 0.45, i % 2 ? 0.85 : 1); }
    else if (bp === 'walk') { // 行走低音：根音 → 和弦音 → 和弦音 → 半音接近下一个根音
      const appr = inBass(nextRoot + (Math.random() < 0.5 ? -1 : 1));
      const line = split ? [rA, inBass(rA + thirdOf(cA)), rB, appr]
        : bar % 2 ? [rA, inBass(rA + 2), inBass(rA + thirdOf(cA)), appr] : [rA, inBass(rA + thirdOf(cA)), inBass(rA + fifthIv(cA)), appr];
      line.forEach((m, i) => B(i, m, 0.92, i ? 0.85 : 1));
      if (Math.random() < 0.25) B(2.5, line[2], 0.3, 0.45); // 偶尔一个摇摆的经过音
    }
    else if (bp === 'bossa') { B(0, rA, 1.4); B(1.5, fifthOf(rA), 0.45, 0.7); B(2, split ? rB : fifthOf(rA), 1.4, 0.85); B(3.5, split ? fifthOf(rB) : rA, 0.45, 0.7); }
    else if (bp === 'bounce') { B(0, rA, 0.4); B(1, fifthOf(rA), 0.3, 0.7); B(2, rB, 0.4, 0.9); B(3, fifthOf(rB), 0.3, 0.7); if (bar % 2) B(3.5, inBass(nextRoot - 1), 0.25, 0.6); }
    else if (bp === 'funk') FUNK[bar % 2].forEach(([p, iv, d]) => B(p, chordAt(p)[0] + iv, d, iv ? 0.8 : 1));
    else if (bp === 'pianoLH') { // 钢琴左手：低音 + 高八度
      const low = r => (r < 36 ? r + 12 : r);
      (split ? [[0, rA, 2], [2, rB, 2]] : [[0, rA, 4]]).forEach(([p, r, len]) => {
        piano(P(p), low(r), len * spb * 0.95, 0.32 * vel, out, 0.45); piano(P(p) + 0.02, low(r) + 12, len * spb * 0.9, 0.16 * vel, out, 0.45); });
    }
  }
  function playSynth(name, fade = 1.5) {
    curTheme = name;
    const th = THEMES[name], out = ctx.createGain(), mix = ctx.createGain();
    mix.gain.value = 0.9 * (th.gain || 1);
    out.gain.setValueAtTime(0.0001, ctx.currentTime); out.gain.exponentialRampToValueAtTime(1, ctx.currentTime + fade);
    out.connect(mix); mix.connect(bus.bgm);
    const spb = 60 / th.bpm, bars = th.chords.length, vel = th.vel || 0.85, sw = (th.swing || 0) * spb;
    const node = { out, mix, th, gbar: 0, next: ctx.currentTime + 0.12, alive: true, srcs: [], extra: [] };
    node.rv = ctx.createGain(); node.rv.connect(reverbIn);
    themeNode = node;
    // 附点延迟（泷奈的吉他、夜路的长笛）
    let kBus = out, mBus = out;
    if (th.delay) {
      const d = ctx.createDelay(2), fb = ctx.createGain(), lp = filt('lowpass', 2600), wet = ctx.createGain(), dIn = ctx.createGain();
      d.delayTime.value = th.delay.beats * spb; fb.gain.value = th.delay.fb || 0.3; wet.gain.value = th.delay.mix || 0.25;
      dIn.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(wet); wet.connect(out);
      if (th.delay.keys) { kBus = ctx.createGain(); kBus.connect(out); kBus.connect(dIn); }
      if (th.delay.mel) { mBus = ctx.createGain(); mBus.connect(out); mBus.connect(dIn); }
      node.extra.push(d, fb, lp, wet, dIn, kBus, mBus);
    }
    // 唱片底噪
    if (th.crackle) {
      const h = noiseSrc(), hp = filt('highpass', 3500), hg = ctx.createGain(); hg.gain.value = 0.006;
      h.connect(hp); hp.connect(hg); hg.connect(out); h.start(ctx.currentTime, Math.random() * 5); node.srcs.push(h);
    }
    // 旋律按小节建索引
    if (!th._mb) { th._mb = {}; (th.mel || []).forEach(n => { const k = Math.floor(n[0] / 4) % bars; (th._mb[k] = th._mb[k] || []).push(n); }); }
    const keyLayers = th.keys ? [].concat(th.keys) : [];
    const melLayers = Array.isArray(th.melInst) ? th.melInst : [[th.melInst, th.melOct || 0, 1]];
    const scheduleBar = (t, gbar) => {
      const bar = gbar % bars, loop = Math.floor(gbar / bars);
      const raw = th.chords[bar], split = Array.isArray(raw[0]);
      const chA = split ? raw[0] : raw, chB = split ? raw[1] : raw, chordAt = pos => (pos >= 2 ? chB : chA);
      const nx = th.chords[(bar + 1) % bars], nextRoot = (Array.isArray(nx[0]) ? nx[0] : nx)[0];
      const P = pos => t + pos * spb + (Math.abs((pos % 1) - 0.5) < 1e-6 ? sw : 0);
      const intro = gbar < (th.intro || 0), soft = gbar < (th.build || 0), secB = bar >= bars / 2;
      const melOn = !intro && !(loop % 4 === 3 && !th.build);
      // 鼓
      if (!intro && th.drums && th.drums !== 'none') {
        const p = soft ? null : DRUMS[(secB && th.drumsB) || th.drums];
        if (p) {
          if (p.crash && bar % 8 === 0) crash(t, out, vel * 0.85);
          const fill = !!p.fill && bar % 8 === 7;
          for (let i = 0; i < 4; i++) drumBeat(p, t + i * spb, spb, i, out, vel * 0.9, fill, sw);
        } else if (soft) { // build：只有踩镲，最后一小节军鼓滚奏
          for (let i = 0; i < 4; i++) hat(t + i * spb, out, 0.45 * vel);
          if (gbar === th.build - 1) for (let i = 8; i < 16; i++) snare(t + i * spb / 4, out, (0.25 + (i - 8) * 0.07) * vel);
        }
      }
      // 长音：pad / 弦乐
      (split ? [[0, 2], [2, 2]] : [[0, 4]]).forEach(([pos, len]) => {
        const tones = chordAt(pos).slice(1);
        if (th.pad) pad(P(pos), tones, len * spb, vel * (soft ? 0.7 : 1), out);
        if (th.strings) strings(P(pos), tones.map(m => m + (th.strings.oct || 0)), len * spb, vel * (th.strings.v || 1), out, { dark: th.strings.dark, att: Math.min(1.2, len * spb * 0.35), rel: 1.2 });
      });
      // 低音
      if (!intro && th.bassPat && th.bassPat !== 'none') bassBar(th, P, spb, chordAt, nextRoot, out, vel * (soft ? 0.6 : 1), bar, vel);
      // 吉他
      const g = (secB && th.gtrB) || th.gtr;
      if (g && !soft && !intro) {
        const pr = r => (r + 12 < 40 ? r + 24 : r + 12);
        if (g === 'power8') for (let i = 0; i < 8; i++) { const r = pr(chordAt(i / 2)[0]); power(P(i / 2), r, spb / 2 * 0.95, out, vel * 0.8, false, -0.45); power(P(i / 2), r, spb / 2 * 0.95, out, vel * 0.72, false, 0.45); }
        else if (g === 'mute') [0.5, 1.5, 2.75, 3.5].forEach((p, i) => power(P(p), pr(chordAt(p)[0]), spb * 0.4, out, vel * 0.55, true, i % 2 ? 0.35 : -0.35));
      }
      // 伴奏层
      keyLayers.forEach(k => {
        if (intro || (k.from === 'B' && !secB) || (soft && k.inst === 'brass')) return;
        const v = vel * (k.v || 0.3) * (soft ? 0.8 : 1), oct = k.oct || 0;
        if (k.comp) {
          const pats = COMP[k.comp], pat = pats[bar % pats.length];
          pat.forEach(([pos, d, pv]) => chord(k.inst, P(pos), chordAt(pos).slice(1).map(m => m + oct), d * spb, v * pv, kBus));
        } else if (k.arp) {
          const div = k.div || 2;
          for (let i = 0; i < 4 * div; i++) {
            const pos = i / div, ch = chordAt(pos), tones = ch.slice(1), ext = tones.concat(tones.map(m => m + 12)), a = k.arp[i % k.arp.length];
            let m = ch[0]; if (a === 'r') { while (m < 45) m += 12; } else m = ext[a % ext.length] + oct;
            inst(k.inst, P(pos), m, spb / div * 1.6, v * (i % div ? 0.8 : 1), kBus, { pan: k.inst === 'pluck' ? (i % 2 ? 0.3 : -0.3) : 0, det: th.det, wet: 0.45 });
          }
        }
      });
      // 旋律
      if (melOn) {
        const L = soft ? [['piano', 0, 0.85]] : (secB && th.melInstB) ? [[th.melInstB, th.melOct || 0, 1]] : melLayers;
        (th._mb[bar] || []).forEach(([pos, m, d]) => {
          const rp = pos - bar * 4;
          L.forEach(([nm, oc, lv]) => { if (nm && nm !== 'none') inst(nm, P(rp), m + (oc || 0), d * spb, vel * (lv == null ? 1 : lv), mBus, { det: th.det }); });
        });
      }
      // drone：没有旋律，偶尔一声走调的高音铃
      if (th.drone && Math.random() < 0.4) { const tn = chA.slice(1); bell(t + spb * (1 + Math.floor(Math.random() * 3)), tn[Math.floor(Math.random() * tn.length)] + 24 + (Math.random() < 0.5 ? 1 : 0), spb * 2, 0.22 * vel, out, 0.9); }
      // 唱片的噼啪声
      if (th.crackle) for (let i = 0, n = 3 + Math.floor(Math.random() * 6); i < n; i++) burst(t + Math.random() * 4 * spb, 0.004, out, 'highpass', 1800, 0.7, rnd(0.015, 0.06), 0.0005);
      // 白色房间：低频涌动、金属刮擦、耳鸣似的拍频
      if (th.fx === 'dark') {
        const bl = 4 * spb;
        if (Math.random() < 0.5) { const o = ctx.createOscillator(), og = ctx.createGain(); o.frequency.value = rnd(38, 46);
          og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(0.18 * vel, t + bl * 0.5); og.gain.linearRampToValueAtTime(0, t + bl); o.connect(og); og.connect(out); o.start(t); o.stop(t + bl + 0.1); }
        if (Math.random() < 0.3) { const tt = t + Math.random() * bl * 0.6, s = ctx.createBufferSource(); s.buffer = noise(); const bp = filt('bandpass', 1800, 14), sg = ctx.createGain();
          bp.frequency.setValueAtTime(rnd(1400, 2000), tt); bp.frequency.linearRampToValueAtTime(rnd(2300, 3200), tt + 2.4);
          sg.gain.setValueAtTime(0, tt); sg.gain.linearRampToValueAtTime(0.09 * vel, tt + 1.2); sg.gain.linearRampToValueAtTime(0, tt + 2.5);
          s.connect(bp); bp.connect(sg); sg.connect(out); s.start(tt, Math.random() * 5, 2.6); send(sg, 0.9); }
        if (Math.random() < 0.25) { const f = rnd(2400, 2900); [0, rnd(4, 7)].forEach(df => { const o = ctx.createOscillator(), og = ctx.createGain(); o.frequency.value = f + df;
          og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(0.005 * vel, t + bl * 0.4); og.gain.linearRampToValueAtTime(0, t + bl); o.connect(og); og.connect(out); o.start(t); o.stop(t + bl + 0.1); }); }
      }
    };
    const tick = () => {
      if (!node.alive) return;
      sendTo = node.rv;
      try { while (node.next < ctx.currentTime + 1.1) { scheduleBar(node.next, node.gbar); node.gbar++; node.next += 4 * spb; } } finally { sendTo = null; }
    };
    tick();
    node.timer = setInterval(tick, 100);
  }
  function stopTheme(fade = 1.5) {
    if (curAudio) { const a = curAudio; curAudio = null; killAudio(a, fade); }
    if (themeNode) {
      const n = themeNode; n.alive = false; clearInterval(n.timer);
      const now = ctx.currentTime;
      [n.out.gain, n.rv.gain].forEach(gp => { gp.cancelScheduledValues(now); gp.setValueAtTime(Math.max(0.0001, gp.value), now); gp.linearRampToValueAtTime(0, now + Math.max(0.05, fade)); });
      // 已经排进去的音符最多还有一小节（加上余音），等它们都结束再断开
      const linger = Math.max(fade + 3, 4 * 60 / n.th.bpm + 3);
      setTimeout(() => { n.srcs.forEach(s => { try { s.stop(); } catch (e) { } }); n.extra.forEach(x => x.disconnect()); n.out.disconnect(); n.mix.disconnect(); n.rv.disconnect(); }, linger * 1000);
    }
    themeNode = null; curTheme = null;
  }

  // ================= 环境音 =================
  function startAmb(name, fade = 2) {
    init();
    if (ambNodes[name]) return;
    const out = ctx.createGain(); out.gain.setValueAtTime(0.0001, ctx.currentTime);
    out.connect(bus.amb);
    const nodes = [], timers = [];
    const target = { cafe: 0.4, city: 0.45, night: 0.4, rain: 0.5, heavyrain: 0.8, rain_in: 0.4, aquarium: 0.45, drip: 0.4, wind: 0.45, car: 0.45, crowd: 0.35, hum: 0.4, sea: 0.5, station: 0.45 }[name] || 0.5;
    out.gain.exponentialRampToValueAtTime(target, ctx.currentTime + fade);
    const lfo = (rate, depth, param, base) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = rate; g.gain.value = depth; o.connect(g); g.connect(param); param.value = base; o.start(); nodes.push(o); };
    const loopNoise = (buf, type, f, q, gain, dest = out) => { const s = noiseSrc(buf), fl = filt(type, f, q), g = ctx.createGain(); g.gain.value = gain; s.connect(fl); fl.connect(g); g.connect(dest); s.start(ctx.currentTime, Math.random() * s.buffer.duration); nodes.push(s); return { g, fl }; };
    const hum = (fs, gs, type = 'sine') => fs.forEach((f, i) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = f; g.gain.value = gs[i]; o.connect(g); g.connect(out); o.start(); nodes.push(o); });
    // 每 ms 毫秒掷一次骰子，概率 p 时触发（停掉环境音时一起清掉）
    const chance = (ms, p, fn) => timers.push(setInterval(() => { if (Math.random() < p) fn(ctx.currentTime + Math.random() * ms / 1000); }, ms));
    // 局部混响（瓷砖房间、车站大厅）
    const room = (sec, decay, amt) => { const c = ctx.createConvolver(); c.buffer = impulse(sec, decay); const g = ctx.createGain(); g.gain.value = amt; c.connect(g); g.connect(out); nodes.push(c, g); return c; };
    // 一个正弦的短音（d 秒衰减），可选频率滑动
    const blip = (t, f, peak, d, f2, dest = out, type = 'sine') => {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + Math.min(d, 0.06));
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(dest); o.start(t); o.stop(t + d + 0.02); return g;
    };
    // 金属的小碰撞：几条不成谐波的泛音（杯子、勺子、车铃）
    const ting = (t, f, peak, d, ratios = [1, 2.76, 5.4], dest = out) => ratios.forEach((r, i) => blip(t, f * r, peak / (i + 1), d / (1 + i * 0.8), 0, dest));
    // 低声交谈：噪声过两个共振峰，音量随机起伏（像一个个音节），偶尔停顿
    const voices = (n, lvl, dest = out) => { for (let v = 0; v < n; v++) {
      const s = noiseSrc(), f1 = filt('bandpass', rnd(380, 600), 3), f2 = filt('bandpass', rnd(1000, 1700), 4), lp = filt('lowpass', 1600), g = ctx.createGain(), p = ctx.createStereoPanner();
      g.gain.value = 0; p.pan.value = rnd(-0.6, 0.6);
      s.connect(f1); s.connect(f2); f1.connect(lp); f2.connect(lp); lp.connect(g); g.connect(p); p.connect(dest); s.start(ctx.currentTime, Math.random() * 8); nodes.push(s);
      let talk = Math.random() < 0.6;
      timers.push(setInterval(() => {
        const now = ctx.currentTime; if (Math.random() < 0.035) talk = !talk;
        g.gain.setTargetAtTime(talk && Math.random() < 0.8 ? rnd(0.3, 1) * lvl : 0, now, 0.035);
        if (talk) { f1.frequency.setTargetAtTime(rnd(330, 680), now, 0.05); f2.frequency.setTargetAtTime(rnd(900, 1900), now, 0.05); }
      }, 105 + v * 17));
    } };
    // 远处开过的车：低频噪声慢慢涌起又退去，声像从一边移到另一边
    const passCar = (t, peak, dur, lpF = 600) => {
      const s = ctx.createBufferSource(); s.buffer = brown(); const bp = filt('lowpass', lpF * 0.5, 0.8), g = ctx.createGain(), p = ctx.createStereoPanner(), dir = Math.random() < 0.5 ? -1 : 1;
      bp.frequency.setValueAtTime(lpF * 0.5, t); bp.frequency.linearRampToValueAtTime(lpF, t + dur * 0.5); bp.frequency.linearRampToValueAtTime(lpF * 0.45, t + dur);
      p.pan.setValueAtTime(-0.8 * dir, t); p.pan.linearRampToValueAtTime(0.8 * dir, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + dur * 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(bp); bp.connect(g); g.connect(p); p.connect(out); s.start(t, Math.random() * 8, dur + 0.1);
    };
    if (name === 'rain' || name === 'heavyrain') {
      loopNoise(null, 'bandpass', name === 'rain' ? 3500 : 2500, 0.4, name === 'rain' ? 0.35 : 0.6);
      loopNoise(brown(), 'lowpass', 600, 0.7, name === 'rain' ? 0.3 : 0.6);
      const drop = () => {
        const t = ctx.currentTime, o = ctx.createBufferSource(); o.buffer = noise();
        const bp = filt('bandpass', 2000 + Math.random() * 5000, 8), g3 = ctx.createGain();
        g3.gain.setValueAtTime(0.25 + Math.random() * 0.3, t); g3.gain.exponentialRampToValueAtTime(0.0001, t + 0.03 + Math.random() * 0.04);
        o.connect(bp); bp.connect(g3); g3.connect(out); o.start(t, Math.random() * 3, 0.1);
      };
      timers.push(setInterval(() => { for (let i = 0; i < (name === 'rain' ? 3 : 7); i++) setTimeout(drop, Math.random() * 100); }, 100));
    } else if (name === 'rain_in') {
      // 屋里听到的雨：隔着墙和玻璃，只剩低沉的沙沙声；偶尔有檐沟的水滴
      loopNoise(brown(), 'lowpass', 520, 0.7, 0.55);
      const h = loopNoise(null, 'lowpass', 1000, 0.5, 0.1); lfo(0.07, 0.03, h.g.gain, 0.1);
      chance(100, 0.7, t => burst(t, 0.02, out, 'bandpass', rnd(700, 1700), 2, rnd(0.03, 0.08), 0.002));
      chance(300, 0.12, t => { const f = rnd(800, 1300); blip(t, f, 0.07, 0.09, f * 1.7); if (Math.random() < 0.4) blip(t + rnd(0.12, 0.3), f * 0.9, 0.05, 0.08, f * 1.5); });
    } else if (name === 'wind') {
      const w = loopNoise(null, 'bandpass', 500, 1.2, 0.5); lfo(0.07, 300, w.fl.frequency, 600); lfo(0.17, 0.3, w.g.gain, 0.5);
      loopNoise(brown(), 'lowpass', 400, 0.7, 0.5);
    } else if (name === 'cafe') {
      // 咖啡店：很低的房间底噪、几个人小声说话、偶尔杯子和勺子的轻响
      loopNoise(brown(), 'lowpass', 220, 0.7, 0.35);
      voices(3, 1.2);
      chance(250, 0.06, t => { // 杯子碰到碟子 / 勺子搅拌
        if (Math.random() < 0.5) { const f = rnd(2500, 3600); for (let i = 0, n = 2 + Math.floor(Math.random() * 4); i < n; i++) ting(t + i * rnd(0.16, 0.22), f * rnd(0.97, 1.03), 0.04, 0.25); }
        else { burst(t, 0.05, out, 'lowpass', 600, 1, 0.16, 0.002); ting(t + 0.005, rnd(2800, 4200), 0.05, 0.5); }
      });
    } else if (name === 'crowd') {
      // 人群：更多、更远的说话声，偶尔的脚步
      loopNoise(brown(), 'lowpass', 260, 0.7, 0.35);
      loopNoise(null, 'bandpass', 700, 0.6, 0.06);
      voices(5, 0.95);
      chance(300, 0.25, t => burst(t, 0.05, out, 'lowpass', 600, 1, rnd(0.04, 0.09), 0.003));
    } else if (name === 'city') {
      // 白天的东京街道：远处的车流、驶过的车、偶尔的自行车铃、很远的道口警铃
      loopNoise(brown(), 'lowpass', 320, 0.7, 0.5);
      const hs = loopNoise(null, 'bandpass', 900, 0.4, 0.05); lfo(0.06, 0.02, hs.g.gain, 0.05);
      chance(1000, 0.3, t => passCar(t, rnd(0.25, 0.45), rnd(2.5, 4.5)));
      chance(1000, 0.035, t => { const f = rnd(2200, 2600); [0, 0.13].forEach(d => ting(t + d, f, 0.05, 0.7, [1, 2.71, 4.6])); });
      chance(1000, 0.012, t => { // 道口：两个音交替的「当当当」，很远
        const lp = filt('lowpass', 1600), g = ctx.createGain(); g.gain.value = 1; lp.connect(g); g.connect(out);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1, t + 1); g.gain.setValueAtTime(1, t + 4); g.gain.exponentialRampToValueAtTime(0.0001, t + 6);
        for (let i = 0; i < 14; i++) blip(t + i * 0.42, i % 2 ? 640 : 700, 0.035, 0.38, 0, lp, 'triangle');
      });
    } else if (name === 'night') {
      // 九月的夜：铃虫「铃——」的叫声、远处的虫鸣合唱、很远的车声
      const n = loopNoise(brown(), 'lowpass', 200, 0.7, 0.3); lfo(0.045, 0.1, n.g.gain, 0.3);
      const ch = loopNoise(null, 'bandpass', 4400, 7, 0.18); lfo(0.23, 0.07, ch.g.gain, 0.18);
      [[4350, 46, -0.5], [4700, 52, 0.4], [3900, 38, 0.1]].forEach(([f, am, pan], k) => {
        const o = ctx.createOscillator(), a = ctx.createGain(), lf = ctx.createOscillator(), lg = ctx.createGain(), env = ctx.createGain(), p = ctx.createStereoPanner();
        o.frequency.value = f; lf.frequency.value = am; lg.gain.value = 0.5; a.gain.value = 0.5; env.gain.value = 0; p.pan.value = pan;
        lf.connect(lg); lg.connect(a.gain); o.connect(a); a.connect(env); env.connect(p); p.connect(out); o.start(); lf.start(); nodes.push(o, lf);
        let next = ctx.currentTime + rnd(0.2, 2), rest = 0;
        timers.push(setInterval(() => {
          const now = ctx.currentTime; if (next > now + 0.3) return;
          const t = Math.max(now, next), d = k === 2 ? rnd(0.06, 0.12) : rnd(0.35, 0.8), pk = (k === 2 ? 0.022 : 0.032) * rnd(0.6, 1);
          env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(pk, t + 0.03); env.gain.setValueAtTime(pk, t + d); env.gain.linearRampToValueAtTime(0, t + d + 0.06);
          if (++rest > 6 + Math.random() * 10) { rest = 0; next = t + d + rnd(3, 8); } else next = t + d + (k === 2 ? rnd(0.12, 0.3) : rnd(0.4, 1.1));
        }, 120));
      });
      chance(3000, 0.22, t => passCar(t, 0.14, rnd(4, 5.5), 380));
    } else if (name === 'aquarium') {
      // 水族馆：很低的嗡声、水泵、慢慢浮上来的气泡
      hum([55, 110, 165], [0.05, 0.03, 0.01]);
      const w = loopNoise(brown(), 'lowpass', 180, 0.7, 0.55); lfo(0.05, 0.15, w.g.gain, 0.55);
      loopNoise(null, 'lowpass', 420, 0.7, 0.03);
      const lp = filt('lowpass', 2400); lp.connect(out); nodes.push(lp);
      chance(400, 0.22, t => { for (let i = 0, n = 3 + Math.floor(Math.random() * 7); i < n; i++) { const f = rnd(280, 800); blip(t + i * rnd(0.05, 0.14), f, rnd(0.03, 0.07), rnd(0.05, 0.09), f * rnd(1.6, 2.4), lp); } });
    } else if (name === 'drip') {
      // 空荡荡的瓷砖房间：极低的底噪，不规则的水滴带着回声
      loopNoise(brown(), 'lowpass', 140, 0.7, 0.35); hum([50, 100], [0.016, 0.008]);
      const rv = room(1.8, 2.2, 0.8);
      chance(300, 0.1, t => { const f = rnd(1300, 2200), g = blip(t, f, rnd(0.12, 0.2), 0.07, f * rnd(1.5, 1.9)); g.connect(rv); });
    } else if (name === 'car') {
      // 车里：发动机的低吼（转速慢慢起伏）+ 路噪 + 偶尔的颠簸
      const e = ctx.createOscillator(), elp = filt('lowpass', 140, 1), eg = ctx.createGain(); e.type = 'sawtooth'; eg.gain.value = 0.12;
      e.connect(elp); elp.connect(eg); eg.connect(out); e.start(); nodes.push(e); lfo(0.07, 3, e.frequency, 34);
      hum([68], [0.03]);
      loopNoise(brown(), 'lowpass', 350, 0.7, 0.6);
      const r = loopNoise(null, 'bandpass', 600, 0.5, 0.05); lfo(0.04, 0.015, r.g.gain, 0.05);
      loopNoise(brown(), 'bandpass', 90, 1, 0.3);
      chance(500, 0.06, t => { blip(t, 62, 0.15, 0.15, 40); burst(t, 0.08, out, 'lowpass', 300, 1, 0.12, 0.003); });
      chance(1000, 0.12, t => passCar(t, 0.12, rnd(1.2, 2), 900));
    } else if (name === 'hum') {
      // 日光灯和通风口的低鸣
      hum([50, 100, 150], [0.08, 0.05, 0.025]); loopNoise(brown(), 'lowpass', 260, 0.7, 0.35); loopNoise(null, 'highpass', 6000, 0.5, 0.025);
      const bz = ctx.createOscillator(), bp = filt('bandpass', 1200, 2), bg = ctx.createGain(); bz.type = 'square'; bz.frequency.value = 100; bg.gain.value = 0.006;
      bz.connect(bp); bp.connect(bg); bg.connect(out); bz.start(); nodes.push(bz); lfo(0.13, 0.003, bg.gain, 0.006);
    } else if (name === 'sea') {
      // 渡轮甲板：海浪、海风、船的发动机
      const wv = loopNoise(brown(), 'lowpass', 600, 0.7, 0.5); lfo(0.09, 0.3, wv.g.gain, 0.5);
      const wv2 = loopNoise(null, 'lowpass', 1500, 0.7, 0.08); lfo(0.13, 0.06, wv2.g.gain, 0.08);
      const w = loopNoise(null, 'bandpass', 700, 1, 0.1); lfo(0.05, 300, w.fl.frequency, 800); lfo(0.11, 0.05, w.g.gain, 0.1);
      const e = ctx.createOscillator(), elp = filt('lowpass', 160, 1), eg = ctx.createGain(); e.type = 'sawtooth'; e.frequency.value = 42;
      e.connect(elp); elp.connect(eg); eg.connect(out); e.start(); nodes.push(e); lfo(6.5, 0.03, eg.gain, 0.1);
      loopNoise(brown(), 'lowpass', 120, 0.7, 0.3);
      chance(1000, 0.15, t => { const s = ctx.createBufferSource(); s.buffer = noise(); const lp = filt('lowpass', 2500), g = ctx.createGain();
        lp.frequency.setValueAtTime(2500, t); lp.frequency.exponentialRampToValueAtTime(500, t + 1.4);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.15, t + 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
        s.connect(lp); lp.connect(g); g.connect(out); s.start(t, Math.random() * 5, 1.6); });
    } else if (name === 'station') {
      // 车站月台：人声、广播（「叮咚」之后一段听不清内容的说话声）、偶尔驶过的电车
      loopNoise(brown(), 'lowpass', 300, 0.7, 0.42);
      voices(3, 0.7);
      const hall = room(2.6, 2, 0.8);
      chance(1000, 0.04, t => {
        const cg = ctx.createGain(); cg.gain.value = 1; cg.connect(out); cg.connect(hall);
        [[1175, 0], [932, 0.38]].forEach(([f, d]) => ting(t + d, f, 0.05, 0.9, [1, 2, 3.01], cg));
        const v = ctx.createOscillator(), bp = filt('bandpass', 900, 2), lp = filt('lowpass', 1800), g = ctx.createGain(), t0 = t + 1.2, len = rnd(3, 4.5);
        v.type = 'sawtooth'; g.gain.value = 0; v.connect(bp); bp.connect(lp); lp.connect(g); g.connect(cg);
        for (let x = t0; x < t0 + len; x += rnd(0.1, 0.22)) {
          v.frequency.setTargetAtTime(rnd(170, 250), x, 0.04); bp.frequency.setTargetAtTime(rnd(600, 1500), x, 0.03);
          g.gain.setTargetAtTime(Math.random() < 0.82 ? rnd(0.05, 0.1) : 0, x, 0.03);
        }
        g.gain.setTargetAtTime(0, t0 + len, 0.05); v.start(t0); v.stop(t0 + len + 0.5);
      });
      chance(1000, 0.025, t => { // 电车进站 / 驶过
        const s = ctx.createBufferSource(); s.buffer = brown(); const lp = filt('lowpass', 200, 0.8), g = ctx.createGain(), dur = 9;
        lp.frequency.setValueAtTime(200, t); lp.frequency.linearRampToValueAtTime(900, t + 4); lp.frequency.linearRampToValueAtTime(220, t + dur);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.7, t + 4); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(lp); lp.connect(g); g.connect(out); s.start(t, Math.random() * 4, dur + 0.1);
        const wh = ctx.createOscillator(), wg = ctx.createGain(), wb = filt('bandpass', 900, 3); wh.type = 'sawtooth';
        wh.frequency.setValueAtTime(420, t + 1); wh.frequency.linearRampToValueAtTime(980, t + 5.5);
        wg.gain.setValueAtTime(0, t + 1); wg.gain.linearRampToValueAtTime(0.012, t + 3.5); wg.gain.linearRampToValueAtTime(0, t + 7);
        wh.connect(wb); wb.connect(wg); wg.connect(out); wh.start(t + 1); wh.stop(t + 7.1);
        for (let i = 0; i < 8; i++) { const c = t + 2.4 + i * 0.5; [0, 0.11].forEach(d => { burst(c + d, 0.05, out, 'lowpass', 700, 1, 0.16, 0.002); blip(c + d, 110, 0.08, 0.08, 80); }); }
      });
    }
    ambNodes[name] = { out, nodes, timers };
  }
  function stopAmb(name, fade = 2) {
    if (!ctx) return;
    const names = name ? [name] : Object.keys(ambNodes);
    names.forEach(n => {
      const a = ambNodes[n]; if (!a) return; delete ambNodes[n];
      const now = ctx.currentTime; a.out.gain.cancelScheduledValues(now); a.out.gain.setValueAtTime(Math.max(0.0001, a.out.gain.value), now);
      a.out.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.05, fade));
      setTimeout(() => { a.timers.forEach(clearInterval); a.nodes.forEach(x => { try { x.stop(); } catch (e) { } try { x.disconnect(); } catch (e) { } }); a.out.disconnect(); }, fade * 1000 + 200);
    });
  }

  // ================= 音效 =================
  function se(name) {
    init();
    sendTo = seRevIn; // 音效里的混响走音效自己的短混响
    try { seBody(name, ctx.currentTime, bus.se); } finally { sendTo = null; }
  }
  function seBody(name, t, out) {
    const nb = (dur, type, f, q, peak, a = 0.005, offset = 0) => {
      const s = ctx.createBufferSource(); s.buffer = noise(); const b = filt(type, f, q || 0.7);
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t + offset); g.gain.linearRampToValueAtTime(peak, t + offset + a); g.gain.exponentialRampToValueAtTime(0.0001, t + offset + dur);
      s.connect(b); b.connect(g); g.connect(out); s.start(t + offset, Math.random() * 2, dur + 0.1); return b;
    };
    const tone = (f, dur, type = 'sine', peak = 0.2, offset = 0) => {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(0, t + offset); g.gain.linearRampToValueAtTime(peak, t + offset + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + offset + dur);
      o.connect(g); g.connect(out); o.start(t + offset); o.stop(t + offset + dur + 0.1); return o;
    };
    // 噪声冲击（off 秒后）、低频的「咚」、滑音、金属的小碰撞、机械的咔哒
    const nbs = (off, dur, type, f, q, peak, a = 0.002, buf) => burst(t + off, dur, out, type, f, q, peak, a, buf);
    const thump = (off, f1, f2, dur, peak) => { const o = ctx.createOscillator(), g = ctx.createGain(), tt = t + off;
      o.frequency.setValueAtTime(f1, tt); o.frequency.exponentialRampToValueAtTime(f2, tt + dur * 0.8);
      g.gain.setValueAtTime(0.0001, tt); g.gain.linearRampToValueAtTime(peak, tt + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, tt + dur);
      o.connect(g); g.connect(out); o.start(tt); o.stop(tt + dur + 0.02); };
    const slide = (off, f1, f2, dur, type, peak) => { const o = ctx.createOscillator(), g = ctx.createGain(), tt = t + off; o.type = type;
      o.frequency.setValueAtTime(f1, tt); o.frequency.exponentialRampToValueAtTime(f2, tt + dur);
      g.gain.setValueAtTime(0.0001, tt); g.gain.linearRampToValueAtTime(peak, tt + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, tt + dur);
      o.connect(g); g.connect(out); o.start(tt); o.stop(tt + dur + 0.02); return { o, g }; };
    const metal = (off, f, peak, d, ratios = [1, 2.76, 5.4], wet = 0.25) => ratios.forEach((r, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain(), tt = t + off; o.frequency.value = f * r;
      g.gain.setValueAtTime(0.0001, tt); g.gain.linearRampToValueAtTime(peak / (i + 1), tt + 0.001); g.gain.exponentialRampToValueAtTime(0.0001, tt + d / (1 + i * 0.8));
      o.connect(g); g.connect(out); o.start(tt); o.stop(tt + d + 0.05); if (i === 0) send(g, wet); });
    const clk = (off, f, peak) => { nbs(off, 0.018, 'bandpass', f, 5, peak, 0.0008); metal(off, f * 1.6, peak * 0.12, 0.06, [1, 1.7], 0); };
    switch (name) {
      // ---- 界面音效：木琴、颤音琴、电钢琴（咖啡店的温度，带一点间谍片的俏皮） ----
      case 'click': marimba(t, 84, 0.1, 0.22, out, 0.05); break;
      case 'select': vibes(t, 79, 0.15, 0.17, out, 0.15); vibes(t + 0.07, 86, 0.3, 0.15, out, 0.15); break;
      case 'cancel': marimba(t, 79, 0.1, 0.22, out, 0.05); marimba(t + 0.06, 72, 0.12, 0.2, out, 0.05); break;
      case 'toggle': woodblock(t, out, 0.45, 1500); break;
      case 'save': [72, 76, 79, 83].forEach((m, i) => vibes(t + i * 0.06, m + 12, 0.2, 0.13, out, 0.2)); break;
      case 'load': [69, 72, 76, 79].forEach((m, i) => rhodes(t + i * 0.035, m, 0.5, 0.12, out, 0.15)); break;
      case 'tick': tone(2000, 0.02, 'sine', 0.04); break;
      case 'tip': vibes(t, 81, 0.2, 0.15, out, 0.2); vibes(t + 0.09, 88, 0.4, 0.14, out, 0.2); break;
      case 'chapter': { // 鼓刷的镲片由弱到强，然后一个温暖的九和弦 + 一声钟
        const s = ctx.createBufferSource(); s.buffer = noise(); const hp = filt('highpass', 5000), g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.08, t + 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
        s.connect(hp); hp.connect(g); g.connect(out); s.start(t, Math.random() * 3, 1.7); send(g, 0.4);
        [50, 57, 64, 66, 69].forEach((m, i) => rhodes(t + 0.6 + i * 0.018, m, 1.6, 0.17, out, 0.4));
        bass(t + 0.6, 38, 1.6, out, 0.45, 'upright'); bell(t + 0.62, 81, 1.2, 0.3, out, 0.6); break; }
      case 'line_recv': case 'msg': tone(1568, 0.09, 'sine', 0.12); tone(2093, 0.14, 'sine', 0.1, 0.07); break;
      case 'line_send': { const o = tone(900, 0.12, 'sine', 0.06); o.frequency.exponentialRampToValueAtTime(1800, t + 0.1); break; }
      case 'call': for (let i = 0; i < 2; i++) { tone(1046, 0.35, 'sine', 0.08, i * 1.2); tone(1318, 0.35, 'sine', 0.07, i * 1.2 + 0.4); } break;
      case 'hangup': [0, 0.25, 0.5].forEach(d => tone(480, 0.15, 'sine', 0.07, d)); break;
      case 'vibe': for (let i = 0; i < 3; i++) tone(150, 0.22, 'sawtooth', 0.04, i * 0.36); break;
      // ---- 枪械 ----
      case 'shot': { // 手枪：尖锐的爆裂 + 中频的「砰」+ 低频冲击 + 混响里的尾巴
        const c = nbs(0, 0.05, 'highpass', 1200, 0.7, 1, 0.001); send(c.g, 0.5);
        nbs(0, 0.16, 'bandpass', 700, 0.9, 0.7, 0.001);
        thump(0, 160, 48, 0.18, 0.9);
        const tl = nbs(0.01, 0.55, 'lowpass', 800, 0.7, 0.28, 0.01, brown()); send(tl.g, 0.9); break; }
      case 'shot_silenced': // 消音器：闷闷的「噗」+ 套筒的咔哒
        nbs(0, 0.07, 'bandpass', 450, 1, 0.55, 0.002); thump(0, 120, 60, 0.09, 0.45);
        nbs(0.002, 0.03, 'highpass', 3000, 1, 0.12, 0.001); clk(0.045, 2600, 0.16); break;
      case 'shot_rifle': { // 步枪：更大更长的爆裂，楼宇之间的回声
        const c = nbs(0, 0.09, 'highpass', 900, 0.7, 1, 0.001); send(c.g, 0.6);
        nbs(0, 0.35, 'bandpass', 500, 0.8, 0.8, 0.001); thump(0, 120, 35, 0.35, 1);
        const tl = nbs(0.02, 1.4, 'lowpass', 900, 0.7, 0.3, 0.02, brown()); send(tl.g, 1);
        [0.32, 0.7].forEach((d, i) => { const e = nbs(d, 0.3, 'lowpass', 1400 - i * 500, 0.7, 0.22 / (i + 1), 0.01); send(e.g, 0.8); }); break; }
      case 'ricochet': { // 跳弹：一声往下滑的尖啸
        nbs(0, 0.02, 'highpass', 3000, 1, 0.35, 0.001);
        const o = ctx.createOscillator(), bp = filt('bandpass', 2500, 1), g = ctx.createGain(), vb = ctx.createOscillator(), vg = ctx.createGain();
        o.frequency.setValueAtTime(3400, t); o.frequency.exponentialRampToValueAtTime(1100, t + 0.38); vb.frequency.value = 31; vg.gain.value = 60; vb.connect(vg); vg.connect(o.detune);
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.1, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
        o.connect(bp); bp.connect(g); g.connect(out); o.start(t); vb.start(t); o.stop(t + 0.45); vb.stop(t + 0.45); send(g, 0.3); break; }
      case 'reload': // 弹匣退出 → 插入 → 卡到位
        clk(0, 2400, 0.3); nbs(0.05, 0.06, 'bandpass', 1500, 1.5, 0.12, 0.01);
        nbs(0.32, 0.07, 'bandpass', 1800, 1.5, 0.16, 0.02); clk(0.4, 2000, 0.5); thump(0.4, 300, 200, 0.05, 0.2); break;
      case 'cock': { // 拉套筒：往后拉，放手，「咔嚓」一声复位
        const b = nbs(0, 0.07, 'bandpass', 1300, 2, 0.2, 0.01); b.b.frequency.linearRampToValueAtTime(2600, t + 0.075); clk(0.075, 2600, 0.45);
        nbs(0.15, 0.04, 'bandpass', 1800, 2, 0.2, 0.005); clk(0.19, 2100, 0.65); thump(0.19, 260, 140, 0.06, 0.3); break; }
      case 'casing': // 黄铜弹壳落在地上，叮叮当当地弹几下
        for (let c = 0, n = 2 + Math.floor(Math.random() * 2); c < n; c++) {
          let off = 0.05 + c * rnd(0.05, 0.15), gap = rnd(0.12, 0.2), v = rnd(0.05, 0.08); const f = rnd(3600, 5200);
          for (let b = 0; b < 4; b++) { metal(off, f * rnd(0.98, 1.02), v, 0.18, [1, 1.47, 2.09, 2.83]); off += gap; gap *= 0.6; v *= 0.6; }
        } break;
      // ---- 打斗 ----
      case 'punch': thump(0, 95, 45, 0.16, 0.75); nbs(0, 0.07, 'lowpass', 700, 1, 0.6, 0.002); nbs(0, 0.03, 'bandpass', 1500, 1, 0.25, 0.001); break;
      case 'kick': { const w = nbs(0, 0.12, 'bandpass', 500, 1.2, 0.08, 0.08); w.b.frequency.linearRampToValueAtTime(1300, t + 0.15);
        thump(0.14, 80, 40, 0.2, 0.85); nbs(0.14, 0.09, 'lowpass', 500, 1, 0.65, 0.002); nbs(0.14, 0.04, 'bandpass', 1100, 1, 0.2, 0.001); break; }
      case 'bone': // 手骨被压碎的闷响：克制，只有一声短促的断裂
        nbs(0, 0.025, 'bandpass', 1700, 2, 0.45, 0.0006); nbs(0.022, 0.018, 'bandpass', 2300, 3, 0.25, 0.0006);
        thump(0, 150, 70, 0.1, 0.4); nbs(0, 0.07, 'lowpass', 500, 1, 0.3, 0.002); break;
      case 'glass': { // 玻璃碎裂：一声脆响 + 大量碎片
        const c = nbs(0, 0.06, 'highpass', 2000, 0.7, 0.8, 0.001); send(c.g, 0.4);
        const sh = nbs(0.01, 0.5, 'highpass', 4000, 0.7, 0.3, 0.005); send(sh.g, 0.4); thump(0, 300, 180, 0.05, 0.2);
        for (let i = 0; i < 22; i++) metal(Math.pow(Math.random(), 1.8) * 0.8, rnd(2500, 7000), rnd(0.02, 0.07), rnd(0.05, 0.2), [1, 1.53]);
        break; }
      // ---- 生活 ----
      case 'coffee': { // 倒咖啡：水声的共鸣随着杯子变满慢慢升高
        const s = ctx.createBufferSource(); s.buffer = noise(); const bp = filt('bandpass', 600, 5), bp2 = filt('bandpass', 1400, 8), g = ctx.createGain(), g2 = ctx.createGain(), dur = 2.4;
        bp.frequency.setValueAtTime(550, t); bp.frequency.linearRampToValueAtTime(1250, t + dur);
        for (let x = 0; x < dur; x += 0.035) bp2.frequency.setValueAtTime(rnd(900, 2600), t + x);
        g2.gain.value = 0.35; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.55, t + 0.15); g.gain.setValueAtTime(0.55, t + dur - 0.3); g.gain.linearRampToValueAtTime(0, t + dur);
        s.connect(bp); bp.connect(g); s.connect(bp2); bp2.connect(g2); g2.connect(g); g.connect(out); s.start(t, 0, dur + 0.1);
        nbs(0.02, 0.05, 'bandpass', 1800, 2, 0.15, 0.003); break; }
      case 'water': // 水桶里的水被搅动
        for (let i = 0; i < 3; i++) { const off = i * rnd(0.22, 0.32), n = nbs(off, 0.25, 'bandpass', rnd(700, 1100), 0.8, 0.35, 0.01);
          n.b.frequency.exponentialRampToValueAtTime(400, t + off + 0.25); nbs(off, 0.15, 'lowpass', 500, 1, 0.3, 0.005, brown());
          for (let k = 0; k < 4; k++) { const f = rnd(500, 1200); slide(off + rnd(0.02, 0.2), f, f * 1.8, 0.06, 'sine', 0.05); } }
        break;
      case 'splash': { // 落水
        const n = nbs(0, 0.5, 'lowpass', 3000, 0.7, 0.6, 0.005); n.b.frequency.exponentialRampToValueAtTime(400, t + 0.5);
        thump(0, 120, 60, 0.15, 0.4); nbs(0, 0.3, 'bandpass', 900, 0.8, 0.3, 0.003);
        for (let i = 0; i < 10; i++) { const f = rnd(500, 1300); slide(rnd(0.15, 0.9), f, f * rnd(1.5, 2), 0.05, 'sine', rnd(0.02, 0.05)); }
        break; }
      case 'chain': // 手铐的链子哗啦作响
        for (let i = 0; i < 16; i++) { const off = rnd(0, 0.6) * (i < 8 ? 0.5 : 1); nbs(off, 0.02, 'bandpass', rnd(3000, 6000), 6, rnd(0.08, 0.2), 0.0008); if (i % 3 === 0) metal(off, rnd(3500, 5500), 0.03, 0.08, [1, 1.6], 0.1); }
        break;
      case 'keyboard': { // 飞快地打字
        let off = 0;
        for (let i = 0; i < 20; i++) { const sp = Math.random() < 0.1;
          nbs(off, sp ? 0.04 : 0.022, 'bandpass', sp ? 1500 : rnd(2200, 3800), 2, sp ? 0.25 : rnd(0.12, 0.22), 0.0008); nbs(off + 0.008, 0.03, 'lowpass', 400, 1, sp ? 0.25 : 0.12, 0.001);
          off += rnd(0.06, 0.15); if (Math.random() < 0.1) off += 0.25; }
        break; }
      case 'dice': // 两颗骰子在木桌上滚
        for (let d = 0; d < 2; d++) { let off = d * 0.04, gap = 0.16, v = 0.35; const f = rnd(1600, 2400);
          for (let b = 0; b < 7; b++) { nbs(off, 0.02, 'bandpass', f * rnd(0.85, 1.15), 4, v, 0.0008); thump(off, f * 0.45, f * 0.4, 0.04, v * 0.3); off += gap; gap *= 0.72; v *= 0.75; } }
        break;
      case 'cards': { // 洗牌：哗啦啦的一串，最后在桌上磕齐
        let off = 0;
        for (let i = 0; i < 46; i++) { nbs(off, 0.012, 'highpass', rnd(2500, 4500), 1, rnd(0.05, 0.11), 0.0006); off += 0.022 - i * 0.00015 + rnd(-0.003, 0.003); }
        nbs(off + 0.08, 0.3, 'bandpass', 2600, 0.8, 0.12, 0.08); nbs(off + 0.45, 0.04, 'lowpass', 900, 1, 0.25, 0.002); break; }
      case 'tape': { // 撕胶带：一串黏黏的噼啪声
        const s = ctx.createBufferSource(); s.buffer = noise(); const bp = filt('bandpass', 1300, 1.2), g = ctx.createGain(), dur = 0.7;
        bp.frequency.setValueAtTime(1300, t); bp.frequency.linearRampToValueAtTime(2600, t + dur);
        g.gain.setValueAtTime(0, t); for (let x = 0; x < dur; x += 0.006) g.gain.setValueAtTime(Math.random() < 0.55 ? rnd(0.15, 0.45) * (1 - x / dur * 0.4) : 0.02, t + x);
        g.gain.setValueAtTime(0, t + dur); s.connect(bp); bp.connect(g); g.connect(out); s.start(t, Math.random() * 3, dur + 0.05);
        clk(0, 1800, 0.15); break; }
      // ---- 车 ----
      case 'car_door': clk(0, 1500, 0.25); thump(0.02, 75, 42, 0.28, 0.9); nbs(0.02, 0.2, 'lowpass', 320, 1, 0.6, 0.002, brown()); nbs(0.025, 0.05, 'bandpass', 1500, 2, 0.15, 0.001); metal(0.03, 900, 0.03, 0.12, [1, 2.3]); break;
      case 'engine': { // 打火（启动马达）→ 轰一下油门 → 怠速
        const s = ctx.createOscillator(), sb = filt('bandpass', 380, 1.5), sg = ctx.createGain(), se2 = ctx.createGain(), am = ctx.createOscillator(), amg = ctx.createGain();
        s.type = 'sawtooth'; s.frequency.value = 85; am.type = 'square'; am.frequency.value = 10; amg.gain.value = 0.05; sg.gain.value = 0.06;
        am.connect(amg); amg.connect(sg.gain); s.connect(sb); sb.connect(sg); sg.connect(se2); se2.connect(out);
        se2.gain.setValueAtTime(0, t); se2.gain.linearRampToValueAtTime(1, t + 0.02); se2.gain.setValueAtTime(1, t + 0.85); se2.gain.linearRampToValueAtTime(0, t + 0.95);
        s.start(t); am.start(t); s.stop(t + 1); am.stop(t + 1);
        const e = ctx.createOscillator(), lp = filt('lowpass', 260, 1), eg = ctx.createGain(), id = ctx.createOscillator(), idg = ctx.createGain();
        e.type = 'sawtooth'; e.frequency.setValueAtTime(30, t + 0.85); e.frequency.linearRampToValueAtTime(75, t + 1.25); e.frequency.exponentialRampToValueAtTime(36, t + 2.1);
        eg.gain.setValueAtTime(0, t + 0.85); eg.gain.linearRampToValueAtTime(0.35, t + 0.95); eg.gain.linearRampToValueAtTime(0.45, t + 1.25); eg.gain.linearRampToValueAtTime(0.25, t + 2.1);
        eg.gain.setValueAtTime(0.25, t + 3); eg.gain.linearRampToValueAtTime(0, t + 3.6);
        id.frequency.value = 9; idg.gain.value = 0.04; id.connect(idg); idg.connect(eg.gain);
        e.connect(lp); lp.connect(eg); eg.connect(out); e.start(t + 0.85); id.start(t + 1); e.stop(t + 3.7); id.stop(t + 3.7);
        const r = nbs(0.85, 2.6, 'lowpass', 200, 0.7, 0.3, 0.1, brown()); send(r.g, 0.1); break; }
      case 'brake': { // 轮胎急刹的尖叫
        const o = ctx.createOscillator(), bp = filt('bandpass', 1800, 12), g = ctx.createGain(), vb = ctx.createOscillator(), vg = ctx.createGain();
        o.type = 'sawtooth'; o.frequency.setValueAtTime(1900, t); o.frequency.linearRampToValueAtTime(1500, t + 0.9);
        vb.frequency.value = 9; vg.gain.value = 40; vb.connect(vg); vg.connect(o.frequency);
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.14, t + 0.05); g.gain.setValueAtTime(0.14, t + 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + 1);
        o.connect(bp); bp.connect(g); g.connect(out); o.start(t); vb.start(t); o.stop(t + 1.05); vb.stop(t + 1.05); send(g, 0.3);
        const n = nbs(0, 0.95, 'bandpass', 2500, 3, 0.12, 0.05); send(n.g, 0.2); break; }
      case 'siren': { // 远处的警笛，几秒钟
        const o = ctx.createOscillator(), lp = filt('lowpass', 1800), g = ctx.createGain(); o.type = 'sawtooth';
        o.frequency.setValueAtTime(650, t); o.frequency.linearRampToValueAtTime(1150, t + 1.4); o.frequency.linearRampToValueAtTime(650, t + 2.9); o.frequency.linearRampToValueAtTime(1150, t + 4.3);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 1); g.gain.setValueAtTime(0.05, t + 3.8); g.gain.linearRampToValueAtTime(0, t + 4.8);
        o.connect(lp); lp.connect(g); g.connect(out); o.start(t); o.stop(t + 4.9); send(g, 0.7); break; }
      // ---- 恐怖 / 紧张 ----
      case 'glitch': for (let i = 0; i < 8; i++) { nb(0.03 + Math.random() * 0.05, 'bandpass', 500 + Math.random() * 5000, 2, 0.2 + Math.random() * 0.2, 0.001, i * 0.05 + Math.random() * 0.03); if (i % 3 === 0) tone(80 + Math.random() * 2000, 0.04, 'square', 0.05, i * 0.05); } break;
      case 'static': nb(0.8, 'bandpass', 2500, 0.3, 0.3, 0.01); break;
      case 'scare': { [0, 1, 6, 11].forEach(dv => { const o = tone(mtof(41 + dv), 1.6, 'sawtooth', 0.09); o.detune.value = (Math.random() - 0.5) * 40; }); nb(1.2, 'lowpass', 2000, 0.7, 0.5, 0.004); tone(45, 1.2, 'sine', 0.6); break; }
      case 'stinger': { [0, 1].forEach(dv => tone(mtof(77 + dv), 1.4, 'sine', 0.07)); nb(1.0, 'highpass', 3000, 0.7, 0.08, 0.3); break; }
      case 'heartbeat': [0, 0.28, 1.1, 1.38].forEach((o, i) => { const x = ctx.createOscillator(), g = ctx.createGain(); x.frequency.setValueAtTime(70, t + o); x.frequency.exponentialRampToValueAtTime(35, t + o + 0.15);
        g.gain.setValueAtTime(0, t + o); g.gain.linearRampToValueAtTime(i % 2 ? 0.35 : 0.5, t + o + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + o + 0.22); x.connect(g); g.connect(out); x.start(t + o); x.stop(t + o + 0.3); }); break;
      case 'breath': nb(1.1, 'bandpass', 900, 0.8, 0.08, 0.5); nb(1.0, 'bandpass', 1200, 0.8, 0.05, 0.4, 1.4); break;
      // ---- 门、脚步、杂物 ----
      case 'doorbell': // 咖啡店门上挂的小铃铛：门推开时叮铃叮铃晃几下
        [0, 0.08, 0.19, 0.33, 0.52, 0.75].forEach((d, i) => metal(d, 2150 * rnd(0.985, 1.015), 0.06 * Math.pow(0.72, i), 1.1 - i * 0.1, [1, 2.32, 4.25, 6.63], 0.35));
        nb(0.4, 'bandpass', 500, 2, 0.05, 0.1); break;
      case 'door': { const b = nb(0.7, 'bandpass', 300, 2, 0.35, 0.05); b.frequency.linearRampToValueAtTime(900, t + 0.6); nb(0.06, 'lowpass', 500, 1, 0.5, 0.003, 0.66); break; }
      case 'autodoor': { nb(0.6, 'bandpass', 600, 1, 0.12, 0.1); tone(220, 0.5, 'sine', 0.03); break; }
      case 'shoji': nb(0.7, 'bandpass', 1400, 1.5, 0.15, 0.1); nb(0.05, 'lowpass', 600, 1, 0.3, 0.003, 0.7); break;
      case 'footsteps': for (let i = 0; i < 6; i++) nb(0.09, 'lowpass', 700, 1, 0.35, 0.004, i * 0.36); break;
      case 'run': for (let i = 0; i < 10; i++) nb(0.07, 'lowpass', 900, 1, 0.35, 0.003, i * 0.19); break;
      case 'thud': tone(80, 0.3, 'sine', 0.5); nb(0.2, 'lowpass', 400, 1, 0.5); break;
      case 'slap': nb(0.09, 'bandpass', 2400, 0.9, 0.9, 0.001); nb(0.25, 'lowpass', 800, 1, 0.25, 0.002); tone(180, 0.08, 'sine', 0.3); break;
      case 'cup': tone(2900, 0.25, 'sine', 0.05); tone(4300, 0.15, 'sine', 0.03); nb(0.04, 'lowpass', 900, 1, 0.3, 0.002); break;
      case 'lighter': nb(0.05, 'highpass', 3000, 1, 0.5, 0.002); nb(0.6, 'bandpass', 900, 0.7, 0.08, 0.05, 0.08); break;
      case 'bell': bell(t, 84, 0.6, 0.8, out, 0.6); break;
      case 'can': tone(2600, 0.3, 'sine', 0.05); nb(0.12, 'highpass', 3000, 1, 0.25); nb(0.2, 'lowpass', 400, 1, 0.4, 0.003, 0.05); break;
      case 'page': nb(0.25, 'bandpass', 3000, 0.8, 0.15, 0.05); break;
      case 'switch': nb(0.03, 'highpass', 2000, 1, 0.4); tone(300, 0.03, 'square', 0.05); break;
      case 'shutter': nb(0.04, 'highpass', 2500, 1, 0.4); nb(0.05, 'highpass', 2000, 1, 0.3, 0.002, 0.09); break;
      case 'cuff': nb(0.06, 'highpass', 3500, 2, 0.4, 0.001); nb(0.06, 'highpass', 3000, 2, 0.35, 0.001, 0.12); tone(3500, 0.1, 'sine', 0.04, 0.12); break;
    }
  }

  function setVolume(k, v) { vol[k] = v; if (ctx && bus[k]) bus[k].gain.setTargetAtTime(v, ctx.currentTime, 0.05); if (k === 'bgm' && curAudio && !curAudio._fade) curAudio.volume = audioTarget(); }
  // 声音隔着墙 / 门
  let muffle = null;
  function setMuffle(on, sec = 1.5) {
    init();
    if (!muffle) {
      muffle = filt('lowpass', 20000);
      master.disconnect(); master.connect(muffle); muffle.connect(comp);
    }
    muffle.frequency.cancelScheduledValues(ctx.currentTime);
    muffle.frequency.setTargetAtTime(on ? 480 : 20000, ctx.currentTime, sec / 3);
    muffled = on; if (curAudio) fadeAudio(curAudio, audioTarget(), sec);
  }
  // 手机切到后台时暂停全部声音，回来再继续
  function suspend(on) {
    if (!ctx) return;
    try { on ? ctx.suspend() : ctx.resume(); } catch (e) { }
    if (on) [curAudio, ...dying].forEach(a => a && a.pause());
    else if (curAudio && !MUTED) curAudio.play().catch(() => { });
  }
  // 测试用：静音状态下让时钟走起来（master 增益保持 0，不会出声）
  function silentRun() { init(); if (MUTED) { master.gain.value = 0; ctx.resume(); } }
  return { TITLES, silentRun, suspend, init, playTheme, stopTheme, startAmb, stopAmb, se, setVolume, setMuffle, get theme() { return curTheme; }, get ambs() { return Object.keys(ambNodes); }, THEMES };
})();
