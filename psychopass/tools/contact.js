// 拼一张缩略图总览（不依赖第三方库）：node tools/contact.js out.png 宽 高 列数 图1 图2 ...
const fs = require('fs'), zlib = require('zlib');
const decode = require('./pnginfo.js');
const [out, tw, th, cols, ...files] = process.argv.slice(2);
const W = +tw, H = +th, C = +cols, R = Math.ceil(files.length / C), GAP = 4;
const CW = C * W + (C + 1) * GAP, CH = R * H + (R + 1) * GAP;
const px = Buffer.alloc(CW * CH * 3, 60);
files.forEach((f, n) => {
  const d = decode(f), ox = GAP + (n % C) * (W + GAP), oy = GAP + Math.floor(n / C) * (H + GAP);
  const k = Math.min(W / d.w, H / d.h), sw = Math.round(d.w * k), sh = Math.round(d.h * k), x0 = ox + ((W - sw) >> 1), y0 = oy + ((H - sh) >> 1);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = ((x >> 4) + (y >> 4)) & 1 ? 105 : 85, o = ((oy + y) * CW + ox + x) * 3; px[o] = px[o + 1] = px[o + 2] = c; }
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    // 盒式采样，缩小时不发虚
    const sx0 = Math.floor(x / k), sx1 = Math.max(sx0 + 1, Math.floor((x + 1) / k)), sy0 = Math.floor(y / k), sy1 = Math.max(sy0 + 1, Math.floor((y + 1) / k));
    let r = 0, g = 0, b = 0, a = 0, m = 0;
    for (let yy = sy0; yy < sy1; yy += 2) for (let xx = sx0; xx < sx1; xx += 2) {
      const i = (yy * d.w + xx) * d.bpp, al = d.bpp === 4 ? d.px[i + 3] / 255 : 1;
      r += d.px[i] * al; g += d.px[i + 1] * al; b += d.px[i + 2] * al; a += al; m++;
    }
    const o = ((y0 + y) * CW + x0 + x) * 3, al = a / m;
    if (al > 0) { px[o] = Math.round(r / a * al + px[o] * (1 - al)); px[o + 1] = Math.round(g / a * al + px[o + 1] * (1 - al)); px[o + 2] = Math.round(b / a * al + px[o + 2] * (1 - al)); }
  }
});
const raw = Buffer.alloc((CW * 3 + 1) * CH);
for (let y = 0; y < CH; y++) px.copy(raw, y * (CW * 3 + 1) + 1, y * CW * 3, (y + 1) * CW * 3);
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const ih = Buffer.alloc(13); ih.writeUInt32BE(CW, 0); ih.writeUInt32BE(CH, 4); ih[8] = 8; ih[9] = 2;
fs.writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log(out, CW + 'x' + CH, files.map(f => f.split(/[\\/]/).pop().replace('.png', '')).join(' | '));
