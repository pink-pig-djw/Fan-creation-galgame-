// 程序化音频：BGM 优先用 assets/bgm 的 mp3，读不到时用 WebAudio 合成；环境音和音效全部实时合成。全部旋律为原创。
window.AudioSys = (() => {
  let ctx = null, master, bus = {}, reverbIn, comp;
  const vol = { bgm: 0.6, amb: 0.55, se: 0.7 };
  let curTheme = null, themeNode = null;
  const ambNodes = {};
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
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
    const reverb = ctx.createConvolver(); reverb.buffer = impulse(2.4, 2.8);
    reverbIn = ctx.createGain(); reverbIn.gain.value = 1;
    const rvOut = ctx.createGain(); rvOut.gain.value = 0.45;
    reverbIn.connect(reverb); reverb.connect(rvOut); rvOut.connect(bus.bgm);
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
  const send = (node, amt) => { if (amt > 0) { const s = ctx.createGain(); s.gain.value = amt; node.connect(s); s.connect(reverbIn); } };

  // ================= 鼓 =================
  function kick(t, out, v = 1) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(44, t + 0.12);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.95 * v, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.36);
    const c = ctx.createBufferSource(); c.buffer = noise(); const hp = filt('highpass', 2500), cg = ctx.createGain();
    cg.gain.setValueAtTime(0.18 * v, t); cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.012);
    c.connect(hp); hp.connect(cg); cg.connect(out); c.start(t, Math.random() * 3, 0.03);
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
    const s = ctx.createBufferSource(); s.buffer = noise(); const hp = filt('highpass', 7600), g = ctx.createGain();
    const d = open ? 0.28 : 0.045;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.2 * v, t + 0.001); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(hp); hp.connect(g); g.connect(out); s.start(t, Math.random() * 3, d + 0.05);
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
  // 16 步鼓型：K 底鼓 / S 军鼓 / H 踩镲（o = 开镲，g = 鬼音）
  const DRUMS = {
    rock8: { K: 'x.......x.x.....', S: '....x.......x...', H: 'x.x.x.x.x.x.x.x.' },
    pop: { K: 'x.....x...x.....', S: '....x.......x...', H: 'x.x.x.x.x.x.x.x.' },
    punk: { K: 'x...x...x...x...', S: '..x...x...x...x.', H: 'x.x.x.x.x.x.x.x.' },
    drive: { K: 'x.x.....x.x.x...', S: '....x.......x...', H: 'xxxxxxxxxxxxxxxx' },
    half: { K: 'x.........x.....', S: '........x.......', H: 'x.x.x.x.x.x.x.x.' },
    ballad: { K: 'x.......x.....x.', S: '....x.......x...', H: 'x...x...x...x...' },
    groove: { K: 'x..x..x...x..x..', S: '....x..g....x.g.', H: 'x.xxx.xxx.xxx.xo' },
    four: { K: 'x...x...x...x...', S: '....x.......x...', H: '..o...o...o...o.' },
    lofi: { K: 'x......x..x.....', S: '....x.......x..g', H: 'x.x.x.x.x.x.x.x.' },
    comic: { K: 'x..x....x.....x.', S: '....x..x...x....', H: 'x.x.x.xx.x.x.x.x' },
    soft: { K: 'x.......x.......', S: '....g.......g...', H: 'x...x...x...x...' }
  };
  function playDrums(name, t, spb, bar, out, vel, fill) {
    const p = DRUMS[name]; if (!p) return;
    const st = spb / 4;
    for (let i = 0; i < 16; i++) {
      const tt = t + i * st;
      if (fill && i >= 12) { snare(tt, out, 0.5 + (i - 12) * 0.12); if (i === 12) tom(tt, out, 180, 0.6); if (i === 14) tom(tt, out, 120, 0.6); continue; }
      if (p.K[i] === 'x') kick(tt, out, vel);
      if (p.S[i] === 'x') snare(tt, out, vel);
      else if (p.S[i] === 'g') snare(tt, out, vel * 0.25);
      if (p.H[i] === 'x') hat(tt, out, vel * (i % 4 === 0 ? 1 : 0.7));
      else if (p.H[i] === 'o') hat(tt, out, vel * 0.8, true);
    }
  }

  // ================= 贝斯 =================
  function bass(t, midi, dur, out, v = 1, tone = 'pick') {
    const f = mtof(midi), o = ctx.createOscillator(), o2 = ctx.createOscillator(), lp = filt('lowpass', 900, 1.2), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = f; o2.type = 'sine'; o2.frequency.value = f;
    const og = ctx.createGain(); og.gain.value = 0.9;
    lp.frequency.setValueAtTime(tone === 'finger' ? 700 : 1400, t); lp.frequency.exponentialRampToValueAtTime(tone === 'finger' ? 260 : 420, t + 0.18);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.42 * v, t + 0.006);
    g.gain.setValueAtTime(0.32 * v, t + Math.max(0.02, dur * 0.7)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.06);
    o.connect(lp); o2.connect(og); og.connect(lp); lp.connect(g); g.connect(out);
    o.start(t); o2.start(t); o.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
  }

  // ================= 吉他 =================
  // 失真节奏吉他（强力和弦），左右各一把
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
  // Karplus-Strong 拨弦（清音吉他）
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
  // 明亮的合成拨奏（喜多）
  function synthPluck(t, midi, dur, out, v = 1, wet = 0.35) {
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = mtof(midi);
    const lp = filt('lowpass', 5000, 3), g = ctx.createGain();
    lp.frequency.setValueAtTime(6000, t); lp.frequency.exponentialRampToValueAtTime(900, t + 0.25);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.09 * v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.25, dur));
    o.connect(lp); lp.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.3); send(g, wet);
  }
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

  // ================= 乐曲（全部原创；mp3 读不到时的合成版） =================
  // chords：每小节 [根音, 和弦音...]；mel：[拍, midi, 时值]
  const C = (...n) => n;
  // 主题「四十九日」（D 小调）
  const MAIN_PROG = [C(38, 62, 65, 69), C(34, 62, 65, 70), C(36, 60, 64, 67), C(33, 61, 64, 69), C(38, 62, 65, 69), C(34, 62, 65, 70), C(31, 62, 65, 70), C(33, 61, 64, 69)];
  const MAIN_MEL = [[0, 74, 1.5], [1.5, 72, .5], [2, 70, 1], [3, 69, 1], [4, 70, 2], [6, 74, 1], [7, 77, 1],
    [8, 76, 2], [10, 72, 1], [11, 69, 1], [12, 73, 3], [15, 69, 1],
    [16, 74, 1.5], [17.5, 72, .5], [18, 70, 1], [19, 69, 1], [20, 70, 1.5], [21.5, 72, .5], [22, 74, 1], [23, 77, 1],
    [24, 79, 1.5], [25.5, 77, .5], [26, 76, 1], [27, 74, 1], [28, 73, 2], [30, 69, 2]];
  const THEMES = {
    title: { bpm: 66, chords: MAIN_PROG, drums: 'none', bassPat: 'whole', keys: 'sparse', melInst: 'piano', mel: MAIN_MEL, pad: true, vel: 0.8 },
    ending: { bpm: 72, chords: MAIN_PROG, drums: 'none', bassPat: 'none', keys: 'sparse', melInst: 'bell', mel: MAIN_MEL, vel: 0.7 },
    // 刑事课一系：冷的电子律动
    bureau: { bpm: 96, drums: 'soft', bassPat: 'pulse', keys: 'synth', melInst: 'none', vel: 0.7,
      chords: [C(40, 64, 67, 71), C(36, 64, 67, 72), C(38, 62, 66, 69), C(35, 62, 66, 71)], mel: [] },
    // 一系的日常（稍微轻松）
    daily: { bpm: 92, drums: 'lofi', bassPat: 'whole', keys: 'maj7', melInst: 'piano', vel: 0.6, swing: 0.1,
      chords: [C(41, 64, 69, 72, 76), C(40, 62, 67, 71, 74), C(38, 60, 65, 69, 72), C(43, 62, 65, 69, 71)],
      mel: [[0, 76, 1], [1, 74, 1], [2, 72, 2], [4, 71, 1.5], [5.5, 72, .5], [6, 74, 2], [8, 72, 1], [9, 69, 1], [10, 67, 2], [12, 69, 3]] },
    // 常守朱
    akane: { bpm: 72, drums: 'none', bassPat: 'whole', keys: 'sparse', melInst: 'piano', pad: true, vel: 0.72,
      chords: [C(41, 57, 60, 65), C(36, 55, 60, 64), C(38, 57, 62, 65), C(34, 58, 62, 65), C(41, 57, 60, 65), C(36, 55, 60, 64), C(34, 58, 62, 67), C(36, 55, 60, 64)],
      mel: [[0, 72, 1.5], [1.5, 74, .5], [2, 72, 1], [3, 69, 1], [4, 67, 3], [8, 69, 1], [9, 72, 1], [10, 74, 1], [11, 77, 1], [12, 76, 3],
        [16, 77, 1.5], [17.5, 76, .5], [18, 74, 1], [19, 72, 1], [20, 70, 2], [22, 69, 2], [24, 67, 1], [25, 69, 1], [26, 70, 1], [27, 72, 1], [28, 72, 3.5]] },
    // 残像：走了调的八音盒
    afterimage: { bpm: 60, drums: 'none', bassPat: 'none', keys: 'box', melInst: 'bell', pad: true, vel: 0.65, detune: 18,
      chords: [C(48, 60, 63, 67), C(44, 60, 63, 68), C(46, 58, 62, 65), C(43, 59, 62, 67)],
      mel: [[0, 79, 1], [1, 75, 1], [2, 84, 2], [4, 82, 1], [5, 79, 1], [6, 80, 2], [8, 77, 1], [9, 80, 1], [10, 74, 2], [12, 75, 1.5], [13.5, 74, .5], [14, 71, 2]] },
    // 全息：没有旋律的低频
    holo: { bpm: 50, drums: 'none', bassPat: 'whole', keys: 'none', melInst: 'none', pad: true, vel: 0.9, drone: true,
      chords: [C(26, 50, 51, 57), C(26, 50, 53, 56), C(25, 49, 52, 56), C(27, 51, 54, 57)], mel: [] },
    // 搜查
    search: { bpm: 112, drums: 'half', bassPat: 'eighth', keys: 'none', melInst: 'synth', pad: true, vel: 0.65,
      chords: [C(33, 57, 60, 64), C(33, 57, 60, 64), C(29, 57, 60, 65), C(31, 55, 59, 62)],
      mel: [[2, 76, .5], [2.5, 74, .5], [3, 72, 1], [6, 69, 2], [10, 77, .5], [10.5, 76, .5], [11, 72, 1], [14, 71, 2]] },
    // 霜月美佳
    mika: { bpm: 84, drums: 'none', bassPat: 'pulse', keys: 'sparse', melInst: 'piano', pad: true, vel: 0.75,
      chords: [C(35, 59, 62, 66), C(31, 59, 62, 67), C(38, 57, 62, 66), C(37, 58, 61, 66)],
      mel: [[0, 78, 1], [1, 76, .5], [1.5, 74, .5], [2, 73, 2], [4, 74, 1], [5, 71, 1], [6, 79, 2], [8, 78, 1.5], [9.5, 76, .5], [10, 74, 1], [11, 73, 1], [12, 70, 3]] },
    // 葵（回忆）
    grandma: { bpm: 64, drums: 'none', bassPat: 'none', keys: 'box', melInst: 'bell', vel: 0.75,
      chords: [C(48, 60, 64, 67), C(52, 59, 64, 67), C(53, 60, 65, 69), C(55, 59, 62, 67)],
      mel: [[0, 79, 1], [1, 76, 1], [2, 84, 2], [4, 83, 1], [5, 79, 1], [6, 76, 2], [8, 81, 1], [9, 84, 1], [10, 77, 2], [12, 79, 1.5], [13.5, 77, .5], [14, 76, 2]] },
    // 哀悼
    sad: { bpm: 60, drums: 'none', bassPat: 'none', keys: 'sparse', melInst: 'piano', pad: true, vel: 0.8,
      chords: [C(45, 57, 60, 64), C(41, 57, 60, 65), C(36, 55, 60, 64), C(43, 55, 59, 62), C(45, 57, 60, 64), C(41, 57, 60, 65), C(40, 56, 59, 64), C(40, 56, 59, 64)],
      mel: [[0, 76, 2], [2, 72, 1], [3, 71, 1], [4, 69, 3.5], [8, 67, 1], [9, 69, 1], [10, 72, 2], [12, 71, 3.5],
        [16, 76, 2], [18, 81, 1], [19, 79, 1], [20, 77, 2], [22, 76, 1], [23, 74, 1], [24, 76, 1.5], [25.5, 74, .5], [26, 71, 2], [28, 68, 2], [30, 69, 2]] },
    // 不安
    tension: { bpm: 70, drums: 'none', bassPat: 'pulse', keys: 'none', melInst: 'piano', pad: true, vel: 0.7,
      chords: [C(38, 53, 57, 62), C(34, 53, 58, 62), C(43, 55, 58, 62), C(33, 52, 57, 61)],
      mel: [[2, 74, 2], [6, 77, 2], [10, 79, 1], [11, 77, 1], [14, 73, 2]] },
    // 主宰者（行动）
    dominator: { bpm: 140, drums: 'drive', bassPat: 'eighth', keys: 'synth', melInst: 'synth', vel: 0.8,
      chords: [C(40, 64, 67, 71), C(36, 64, 67, 72), C(38, 62, 66, 69), C(35, 63, 66, 71)],
      mel: [[0, 76, .5], [.5, 79, .5], [1, 83, 1], [2, 81, 1], [3, 79, 1], [4, 78, 2], [6, 75, 2], [8, 76, .5], [8.5, 79, .5], [9, 84, 1], [10, 83, 1], [11, 81, 1], [12, 79, 2], [14, 78, 2]] },
    // 第四十九日（高潮）
    climax: { bpm: 120, drums: 'half', bassPat: 'eighth', keys: 'sparse', melInst: 'piano', pad: true, vel: 0.85, build: true,
      chords: [...MAIN_PROG, ...MAIN_PROG], mel: MAIN_MEL.concat(MAIN_MEL.map(([p, m, d]) => [p + 32, m + 12, d])) },
    // 西比拉
    sibyl: { bpm: 54, drums: 'none', bassPat: 'whole', keys: 'box', melInst: 'none', pad: true, vel: 0.7, drone: true, detune: 8,
      chords: [C(36, 60, 66, 71), C(36, 61, 66, 72), C(35, 59, 65, 70), C(37, 61, 67, 72)], mel: [] }
  };
  const TITLES = { title: '四十九日 —— 主题曲', bureau: '刑事课一系', daily: '一系的日常', akane: '常守朱', afterimage: '残像', holo: '全息', search: '搜查',
    mika: '霜月', grandma: '葵', sad: '哀悼', tension: '不安', dominator: '主宰者', climax: '第四十九日', sibyl: '西比拉', ending: '两缕烟' };

  // ================= mp3 BGM（Suno 生成，assets/bgm/名字.mp3）；读不到时退回合成版 =================
  const BGM_FILES = Object.keys(TITLES);
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
    if (!BGM_FILES.includes(name) || MUTED) { playSynth(name, fade); return; }
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
  function playSynth(name, fade = 1.5) {
    curTheme = name;
    const th = THEMES[name], out = ctx.createGain(), mix = ctx.createGain();
    mix.gain.value = 0.9;
    out.gain.setValueAtTime(0.0001, ctx.currentTime); out.gain.exponentialRampToValueAtTime(1, ctx.currentTime + fade);
    out.connect(mix); mix.connect(bus.bgm);
    const node = { out, th, beat: 0, next: ctx.currentTime + 0.12, alive: true };
    themeNode = node;
    const spb = 60 / th.bpm, bpb = 4, bars = th.chords.length, total = bars * bpb, vel = th.vel || 0.85;
    const tick = () => {
      if (!node.alive) return;
      while (node.next < ctx.currentTime + 0.5) {
        const b = node.beat % total, bar = Math.floor(b / bpb), inBar = b % bpb, t = node.next;
        const loop = Math.floor(node.beat / total);
        const ch = th.chords[bar], root = ch[0], tones = ch.slice(1);
        // 编曲变化：intro 小节只有吉他；build 型第一轮只有清音
        const introBars = th.intro || 0, gbar = Math.floor(node.beat / bpb);
        const inIntro = gbar < introBars;
        const soft = th.build && loop === 0;
        const melOn = !inIntro && !(loop % 4 === 3 && th.melInst !== 'none' && !th.build);
        if (inBar === 0) {
          if (th.drums && th.drums !== 'none' && !inIntro && !soft) {
            const fill = (bar % 8 === 7);
            playDrums(th.drums, t, spb * 4 / 4 * 4 / 4, bar, out, vel * 0.9, fill && !inIntro);
            if (bar % 8 === 0) crash(t, out, vel);
          } else if (soft && th.drums !== 'none') { // build：只有踩镲
            for (let i = 0; i < 4; i++) hat(t + i * spb, out, 0.5);
            if (bar === bars - 1) for (let i = 8; i < 16; i++) snare(t + i * spb / 4, out, 0.3 + i * 0.04);
          }
          if (th.pad) pad(t, tones, spb * bpb, vel, out);
          // drone：没有旋律，偶尔一声走调的高音铃
          if (th.drone && Math.random() < 0.4) bell(t + spb * (1 + Math.floor(Math.random() * 3)), tones[Math.floor(Math.random() * tones.length)] + 24 + (Math.random() < 0.5 ? 1 : 0), spb * 2, 0.22 * vel, out, 0.9);
        }
        // 贝斯
        if (!inIntro) {
          const bp = th.bassPat;
          const bv = vel * (soft ? 0.6 : 1);
          if (bp === 'eighth') { for (let i = 0; i < 2; i++) bass(t + i * spb / 2, root, spb / 2 * 0.9, out, bv); }
          else if (bp === 'quarter') bass(t, root + (inBar === 2 ? 7 : 0), spb * 0.9, out, bv, 'finger');
          else if (bp === 'pop') { bass(t, root, spb * 0.45, out, bv); bass(t + spb / 2, inBar % 2 ? root + 12 : root, spb * 0.4, out, bv * 0.8); }
          else if (bp === 'octave') { bass(t, root, spb * 0.45, out, bv); bass(t + spb / 2, root + 12, spb * 0.4, out, bv * 0.85); }
          else if (bp === 'whole' && inBar === 0) bass(t, root, spb * 3.8, out, bv * 0.8, 'finger');
          else if (bp === 'stab' && (inBar === 0 || inBar === 2)) bass(t, root, spb * 0.3, out, bv);
          else if (bp === 'pulse') bass(t, root, spb * 0.5, out, bv * 0.7, 'finger');
          else if (bp === 'riff') {
            const r = (bar % 8 >= 6 ? th.riff2 : th.riff) || [];
            r.forEach(([p, m, d]) => { if (p >= inBar && p < inBar + 1) bass(t + (p - inBar) * spb, m, d * spb, out, bv * 1.15, 'finger'); });
          }
        }
        // 吉他
        const g = th.gtr;
        if (g === 'power8' && !soft) {
          for (let i = 0; i < 2; i++) {
            const tt = t + i * spb / 2;
            power(tt, root + 12 < 40 ? root + 24 : root + 12, spb / 2 * 0.95, out, vel, false, -0.45);
            power(tt, root + 12 < 40 ? root + 24 : root + 12, spb / 2 * 0.95, out, vel * 0.9, false, 0.45);
          }
        } else if (g === 'mute' && (inBar === 1 || inBar === 3)) {
          power(t + spb / 2, root + 24, spb * 0.4, out, vel * 0.6, true, 0.3);
        }
        if (g === 'arp' || soft) {
          const seq = [tones[0] - 12, tones[1] - 12, tones[2] - 12, tones[1], tones[0], tones[2] - 12, tones[1] - 12, tones[0]];
          for (let i = 0; i < 2; i++) pluck(t + i * spb / 2, seq[(inBar * 2 + i) % seq.length], spb * 1.4, out, vel * 0.8, (i ? 0.3 : -0.3));
        }
        // 键盘
        const k = th.keys;
        if (k === 'bounce') { piano(t + spb / 2, tones[1], spb * 0.35, 0.24 * vel, out, 0.2); piano(t + spb / 2, tones[2], spb * 0.35, 0.2 * vel, out, 0.2); if (inBar === 0) piano(t, root + 12, spb * 2, 0.4 * vel, out, 0.3); }
        else if (k === 'sparse' && (inBar === 0 || inBar === 2)) { piano(t, inBar ? tones[1] : root + 12, spb * 2, 0.3 * vel, out, 0.6); piano(t + spb / 2, tones[inBar ? 2 : 0], spb * 2, 0.22 * vel, out, 0.6); }
        else if (k === 'stab' && (inBar === 1 || inBar === 3)) tones.forEach(m => piano(t + spb / 2, m, spb * 0.2, 0.18 * vel, out, 0.1));
        else if (k === 'maj7' && (inBar === 0 || inBar === 2)) { const sw = th.swing || 0; tones.forEach((m, i) => piano(t + i * 0.02 + (inBar === 2 ? sw : 0), m - 12, spb * 1.8, 0.16 * vel, out, 0.45)); }
        else if (k === 'synth') { for (let i = 0; i < 2; i++) synthPluck(t + i * spb / 2 + spb / 4, tones[(inBar * 2 + i) % 3] + 12, spb * 0.3, out, vel * 0.7, 0.4); }
        else if (k === 'box') bell(t, tones[inBar % 3] + 12 + (th.detune ? (Math.random() - 0.5) * th.detune / 100 : 0), spb, 0.32 * vel, out, 0.6);
        // 旋律
        if (melOn && th.mel) th.mel.forEach(([pos, m, d]) => {
          if (pos >= b && pos < b + 1) {
            const tt = t + (pos - b) * spb, dd = d * spb;
            const mi = soft ? 'pluck' : th.melInst;
            if (mi === 'lead') lead(tt, m, dd, out, vel);
            else if (mi === 'piano') piano(tt, m, dd, 0.6 * vel, out, 0.5);
            else if (mi === 'bell') bell(tt, m + (th.detune ? (Math.random() - 0.5) * th.detune / 100 : 0), dd, 0.75 * vel, out, 0.55);
            else if (mi === 'synth') synthPluck(tt, m, dd, out, vel * 1.2, 0.3);
            else if (mi === 'pluck') pluck(tt, m, dd, out, vel, 0, 0.35);
          }
        });
        node.beat++; node.next += spb;
      }
    };
    tick();
    node.timer = setInterval(tick, 100);
  }
  function stopTheme(fade = 1.5) {
    if (curAudio) { const a = curAudio; curAudio = null; killAudio(a, fade); }
    if (themeNode) {
      const n = themeNode; n.alive = false; clearInterval(n.timer);
      const now = ctx.currentTime;
      n.out.gain.cancelScheduledValues(now); n.out.gain.setValueAtTime(Math.max(0.0001, n.out.gain.value), now);
      n.out.gain.linearRampToValueAtTime(0, now + Math.max(0.05, fade));
      setTimeout(() => n.out.disconnect(), (fade + 3) * 1000);
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
    const target = { rain: 0.5, heavyrain: 0.8, wind: 0.45, night: 0.35, hum: 0.45, street: 0.45, server: 0.4, clock: 0.35, static: 0.25, chapel: 0.45, fridge: 0.3 }[name] || 0.5;
    out.gain.exponentialRampToValueAtTime(target, ctx.currentTime + fade);
    const lfo = (rate, depth, param, base) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = rate; g.gain.value = depth; o.connect(g); g.connect(param); param.value = base; o.start(); nodes.push(o); };
    const loopNoise = (buf, type, f, q, gain) => { const s = noiseSrc(buf), fl = filt(type, f, q), g = ctx.createGain(); g.gain.value = gain; s.connect(fl); fl.connect(g); g.connect(out); s.start(ctx.currentTime, Math.random() * s.buffer.duration); nodes.push(s); return { g, fl }; };
    const hum = (fs, gs) => fs.forEach((f, i) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f; g.gain.value = gs[i]; o.connect(g); g.connect(out); o.start(); nodes.push(o); });
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
    } else if (name === 'wind') {
      const w = loopNoise(null, 'bandpass', 500, 1.2, 0.5); lfo(0.07, 300, w.fl.frequency, 600); lfo(0.17, 0.3, w.g.gain, 0.5);
      loopNoise(brown(), 'lowpass', 400, 0.7, 0.5);
    } else if (name === 'hum') {
      // 空调和照明的低鸣（公安局、深夜的办公室）
      hum([50, 100, 150], [0.08, 0.05, 0.025]); loopNoise(brown(), 'lowpass', 260, 0.7, 0.35); loopNoise(null, 'highpass', 6000, 0.5, 0.025);
    } else if (name === 'fridge') {
      // 冰箱压缩机：一阵一阵的
      const f = loopNoise(brown(), 'lowpass', 180, 0.7, 0.4); hum([60, 120], [0.05, 0.03]);
      lfo(0.03, 0.35, f.g.gain, 0.4);
    } else if (name === 'server') {
      // 机房：风扇的白噪声 + 高频的电子音
      const f = loopNoise(null, 'bandpass', 1200, 0.5, 0.3); lfo(0.2, 0.05, f.g.gain, 0.3);
      loopNoise(brown(), 'lowpass', 300, 0.7, 0.45); hum([110, 220, 7040], [0.03, 0.02, 0.004]);
    } else if (name === 'clock') {
      // 老房子：挂钟 + 很低的风
      loopNoise(brown(), 'lowpass', 220, 0.7, 0.2);
      let k = 0; timers.push(setInterval(() => { const t = ctx.currentTime, s = ctx.createBufferSource(); s.buffer = noise(); const bp = filt('bandpass', k++ % 2 ? 2600 : 3200, 6), g = ctx.createGain(); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04); s.connect(bp); bp.connect(g); g.connect(out); s.start(t, Math.random() * 3, 0.06); }, 1000));
    } else if (name === 'static') {
      const h = loopNoise(null, 'bandpass', 2500, 0.3, 0.25); lfo(7, 0.12, h.g.gain, 0.25);
      timers.push(setInterval(() => { if (Math.random() < 0.3) { const t = ctx.currentTime, s = ctx.createBufferSource(); s.buffer = noise(); const g = ctx.createGain(); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08); s.connect(g); g.connect(out); s.start(t, Math.random() * 3, 0.1); } }, 700));
    } else if (name === 'chapel') {
      // 空旷的礼拜堂：低沉的空气 + 很长的混响
      const a = loopNoise(brown(), 'lowpass', 160, 0.7, 0.5); lfo(0.05, 0.2, a.g.gain, 0.5);
      hum([55, 82.5], [0.03, 0.015]);
    } else if (name === 'street') {
      loopNoise(brown(), 'lowpass', 350, 0.7, 0.6);
      loopNoise(null, 'bandpass', 900, 0.5, 0.06);
      timers.push(setInterval(() => { // 偶尔驶过的车
        if (Math.random() < 0.35) { const t = ctx.currentTime, s = ctx.createBufferSource(); s.buffer = brown(); const lp = filt('lowpass', 500), g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 1.2); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.8); s.connect(lp); lp.connect(g); g.connect(out); s.start(t, Math.random() * 3, 3); }
      }, 2200));
    } else if (name === 'night') {
      const n = loopNoise(brown(), 'lowpass', 200, 0.7, 0.28); lfo(0.045, 0.1, n.g.gain, 0.28);
      timers.push(setInterval(() => { // 很远的地方，偶尔有车开过
        if (Math.random() < 0.22) { const t = ctx.currentTime, src = ctx.createBufferSource(); src.buffer = brown(); const lp = filt('lowpass', 380), g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 1.8); g.gain.exponentialRampToValueAtTime(0.0001, t + 4.5); src.connect(lp); lp.connect(g); g.connect(out); src.start(t, Math.random() * 8, 5); }
      }, 3000));
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
      setTimeout(() => { a.timers.forEach(clearInterval); a.nodes.forEach(x => { try { x.stop(); } catch (e) { } }); a.out.disconnect(); }, fade * 1000 + 200);
    });
  }

  // ================= 音效 =================
  function se(name) {
    init();
    const t = ctx.currentTime, out = bus.se;
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
    switch (name) {
      // ---- 界面音效：冷的电子提示音（公安局的终端） ----
      case 'click': tone(1760, 0.05, 'sine', 0.07); tone(2640, 0.04, 'sine', 0.03, 0.02); break;
      case 'select': tone(1320, 0.08, 'sine', 0.08); tone(1980, 0.16, 'sine', 0.07, 0.06); break;
      case 'cancel': tone(1480, 0.07, 'sine', 0.06); tone(990, 0.12, 'sine', 0.05, 0.05); break;
      case 'toggle': tone(880, 0.04, 'square', 0.03); nb(0.03, 'highpass', 4000, 0.7, 0.08, 0.002); break;
      case 'save': [0, 0.06, 0.12].forEach((d, i) => tone([1320, 1760, 2640][i], 0.12, 'sine', 0.06, d)); break;
      case 'load': { const o = tone(600, 0.25, 'triangle', 0.06); o.frequency.exponentialRampToValueAtTime(1800, t + 0.22); break; }
      case 'tick': tone(2000, 0.02, 'sine', 0.04); break;
      case 'chapter': { const o = tone(55, 2.4, 'sine', 0.4); o.frequency.exponentialRampToValueAtTime(41, t + 2.2); nb(1.6, 'lowpass', 300, 0.7, 0.2, 0.05); bell(t + 0.1, 74, 1.5, 0.5, out, 0.7); break; }
      case 'countdown': { const o = tone(49, 3.2, 'sine', 0.5); o.frequency.exponentialRampToValueAtTime(36, t + 3); nb(2.4, 'lowpass', 180, 0.7, 0.35, 0.02); tone(98, 2.2, 'triangle', 0.08, 0.02); break; }
      case 'tip': tone(1568, 0.08, 'sine', 0.06); tone(2093, 0.18, 'sine', 0.05, 0.08); break;
      case 'line_recv': case 'msg': tone(1568, 0.09, 'sine', 0.12); tone(2093, 0.14, 'sine', 0.1, 0.07); break;
      case 'line_send': { const o = tone(900, 0.12, 'sine', 0.06); o.frequency.exponentialRampToValueAtTime(1800, t + 0.1); break; }
      case 'call': for (let i = 0; i < 2; i++) { tone(1046, 0.35, 'sine', 0.08, i * 1.2); tone(1318, 0.35, 'sine', 0.07, i * 1.2 + 0.4); } break;
      case 'hangup': [0, 0.25, 0.5].forEach(d => tone(480, 0.15, 'sine', 0.07, d)); break;
      case 'vibe': for (let i = 0; i < 3; i++) tone(150, 0.22, 'sawtooth', 0.04, i * 0.36); break;
      // ---- 主宰者 ----
      case 'dom_on': { const o = tone(300, 0.5, 'sine', 0.12); o.frequency.exponentialRampToValueAtTime(1200, t + 0.45); tone(2400, 0.2, 'sine', 0.06, 0.45); nb(0.3, 'highpass', 5000, 0.7, 0.05, 0.02); break; }
      case 'dom_scan': for (let i = 0; i < 6; i++) tone(1800 + i * 160, 0.05, 'square', 0.025, i * 0.07); tone(3200, 0.25, 'sine', 0.05, 0.45); break;
      case 'dom_lock': tone(220, 0.18, 'square', 0.07); tone(165, 0.3, 'square', 0.07, 0.2); break;
      case 'dom_para': { const o = tone(1400, 0.35, 'sawtooth', 0.12); o.frequency.exponentialRampToValueAtTime(200, t + 0.3); nb(0.4, 'bandpass', 3000, 1.2, 0.35, 0.002); tone(60, 0.3, 'sine', 0.4); break; }
      case 'dom_lethal': { for (let i = 0; i < 5; i++) nb(0.05, 'bandpass', 1500 + i * 400, 3, 0.25, 0.002, i * 0.08); const o = tone(200, 1.2, 'sawtooth', 0.06, 0.4); o.frequency.exponentialRampToValueAtTime(2200, t + 1.5); break; }
      case 'hue': { const o = tone(700, 0.6, 'sine', 0.06); o.frequency.exponentialRampToValueAtTime(1400, t + 0.5); tone(2100, 0.3, 'sine', 0.04, 0.55); break; }
      // ---- 全息 / 恐怖 ----
      case 'holo_on': { const o = tone(120, 0.6, 'sawtooth', 0.04); o.frequency.exponentialRampToValueAtTime(880, t + 0.5); nb(0.5, 'highpass', 3000, 0.7, 0.07, 0.2); tone(1760, 0.3, 'sine', 0.04, 0.5); break; }
      case 'holo_off': { const o = tone(880, 0.5, 'sawtooth', 0.04); o.frequency.exponentialRampToValueAtTime(60, t + 0.45); nb(0.15, 'highpass', 2500, 0.7, 0.1, 0.002, 0.4); break; }
      case 'glitch': for (let i = 0; i < 8; i++) { nb(0.03 + Math.random() * 0.05, 'bandpass', 500 + Math.random() * 5000, 2, 0.2 + Math.random() * 0.2, 0.001, i * 0.05 + Math.random() * 0.03); if (i % 3 === 0) tone(80 + Math.random() * 2000, 0.04, 'square', 0.05, i * 0.05); } break;
      case 'static': nb(0.8, 'bandpass', 2500, 0.3, 0.3, 0.01); break;
      case 'scare': { [0, 1, 6, 11].forEach(dv => { const o = tone(mtof(41 + dv), 1.6, 'sawtooth', 0.09); o.detune.value = (Math.random() - 0.5) * 40; }); nb(1.2, 'lowpass', 2000, 0.7, 0.5, 0.004); tone(45, 1.2, 'sine', 0.6); break; }
      case 'stinger': { [0, 1].forEach(dv => tone(mtof(77 + dv), 1.4, 'sine', 0.07)); nb(1.0, 'highpass', 3000, 0.7, 0.08, 0.3); break; }
      case 'heartbeat': [0, 0.28, 1.1, 1.38].forEach((o, i) => { const x = ctx.createOscillator(), g = ctx.createGain(); x.frequency.setValueAtTime(70, t + o); x.frequency.exponentialRampToValueAtTime(35, t + o + 0.15);
        g.gain.setValueAtTime(0, t + o); g.gain.linearRampToValueAtTime(i % 2 ? 0.35 : 0.5, t + o + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + o + 0.22); x.connect(g); g.connect(out); x.start(t + o); x.stop(t + o + 0.3); }); break;
      case 'breath': nb(1.1, 'bandpass', 900, 0.8, 0.08, 0.5); nb(1.0, 'bandpass', 1200, 0.8, 0.05, 0.4, 1.4); break;
      // ---- 生活 ----
      case 'doorscan': tone(1046, 0.25, 'sine', 0.08); tone(1568, 0.5, 'sine', 0.08, 0.2); break; // 门禁的「欢迎回家」
      case 'doorbell': tone(1318, 0.5, 'sine', 0.08); tone(1046, 0.8, 'sine', 0.08, 0.35); break;
      case 'door': { const b = nb(0.7, 'bandpass', 300, 2, 0.35, 0.05); b.frequency.linearRampToValueAtTime(900, t + 0.6); nb(0.06, 'lowpass', 500, 1, 0.5, 0.003, 0.66); break; }
      case 'autodoor': { nb(0.6, 'bandpass', 600, 1, 0.12, 0.1); tone(220, 0.5, 'sine', 0.03); break; }
      case 'shoji': nb(0.7, 'bandpass', 1400, 1.5, 0.15, 0.1); nb(0.05, 'lowpass', 600, 1, 0.3, 0.003, 0.7); break;
      case 'footsteps': for (let i = 0; i < 6; i++) nb(0.09, 'lowpass', 700, 1, 0.35, 0.004, i * 0.36); break;
      case 'run': for (let i = 0; i < 10; i++) nb(0.07, 'lowpass', 900, 1, 0.35, 0.003, i * 0.19); break;
      case 'thud': tone(80, 0.3, 'sine', 0.5); nb(0.2, 'lowpass', 400, 1, 0.5); break;
      case 'slap': nb(0.09, 'bandpass', 2400, 0.9, 0.9, 0.001); nb(0.25, 'lowpass', 800, 1, 0.25, 0.002); tone(180, 0.08, 'sine', 0.3); break;
      case 'cup': tone(2900, 0.25, 'sine', 0.05); tone(4300, 0.15, 'sine', 0.03); nb(0.04, 'lowpass', 900, 1, 0.3, 0.002); break;
      case 'lighter': nb(0.05, 'highpass', 3000, 1, 0.5, 0.002); nb(0.6, 'bandpass', 900, 0.7, 0.08, 0.05, 0.08); break;
      case 'orin': bell(t, 76, 4, 0.9, out, 0.7); bell(t, 88.3, 3, 0.25, out, 0.7); break; // 佛坛的铃
      case 'bell': bell(t, 84, 0.6, 0.8, out, 0.6); break;
      case 'can': tone(2600, 0.3, 'sine', 0.05); nb(0.12, 'highpass', 3000, 1, 0.25); nb(0.2, 'lowpass', 400, 1, 0.4, 0.003, 0.05); break;
      case 'page': nb(0.25, 'bandpass', 3000, 0.8, 0.15, 0.05); break;
      case 'switch': nb(0.03, 'highpass', 2000, 1, 0.4); tone(300, 0.03, 'square', 0.05); break;
      case 'shutter': nb(0.04, 'highpass', 2500, 1, 0.4); nb(0.05, 'highpass', 2000, 1, 0.3, 0.002, 0.09); break;
      case 'dog': [0, 0.3].forEach(o => { const x = tone(520, 0.12, 'sawtooth', 0.08, o); x.frequency.exponentialRampToValueAtTime(380, t + o + 0.1); }); break;
      case 'cuff': nb(0.06, 'highpass', 3500, 2, 0.4, 0.001); nb(0.06, 'highpass', 3000, 2, 0.35, 0.001, 0.12); tone(3500, 0.1, 'sine', 0.04, 0.12); break;
      case 'drone_fly': { const o = tone(180, 1.4, 'sawtooth', 0.03); o.frequency.linearRampToValueAtTime(220, t + 1.3); nb(1.4, 'bandpass', 2400, 2, 0.04, 0.3); break; }
    }
  }

  function setVolume(k, v) { vol[k] = v; if (ctx && bus[k]) bus[k].gain.setTargetAtTime(v, ctx.currentTime, 0.05); if (k === 'bgm' && curAudio && !curAudio._fade) curAudio.volume = audioTarget(); }
  // 声音隔着墙 / 门（例如一里在储物间里弹琴）
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
