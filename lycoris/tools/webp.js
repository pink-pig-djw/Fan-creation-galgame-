// 把 assets/{bg,ch,cg} 里的 PNG 转成 WebP（游戏读 WebP），PNG 原图移到 assets_src/ 留底。
// 出图脚本（collect.js）照旧把 PNG 放进 assets/，之后再跑一次本脚本即可：node tools/webp.js
const fs = require('fs'), path = require('path');
const sharp = require(path.join(__dirname, 'node', 'node_modules', 'sharp'));
const root = path.join(__dirname, '..');
(async () => {
  let n = 0, before = 0, after = 0;
  for (const dir of ['bg', 'ch', 'cg']) {
    const src = path.join(root, 'assets', dir), keep = path.join(root, 'assets_src', dir);
    fs.mkdirSync(keep, { recursive: true });
    for (const f of fs.readdirSync(src).filter(f => f.endsWith('.png'))) {
      const p = path.join(src, f), out = path.join(src, f.replace(/\.png$/, '.webp'));
      // 立绘有透明通道：alphaQuality 高一点，边缘不发毛
      const opt = dir === 'ch' ? { quality: 90, alphaQuality: 95, effort: 4 } : { quality: 86, effort: 4 };
      await sharp(p).webp(opt).toFile(out);
      before += fs.statSync(p).size; after += fs.statSync(out).size; n++;
      fs.renameSync(p, path.join(keep, f));
    }
  }
  console.log(`${n} files: ${(before / 1048576).toFixed(1)} MB -> ${(after / 1048576).toFixed(1)} MB`);
})();
