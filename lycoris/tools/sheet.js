// 生成素材预览页 tools/sheet.html：node tools/sheet.js [ch|bg|cg] [文件名前缀...]
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const kind = process.argv[2] || 'ch', pre = process.argv.slice(3);
const files = fs.readdirSync(path.join(root, 'assets', kind)).filter(f => f.endsWith('.png') && (!pre.length || pre.some(p => f.startsWith(p))));
const tall = kind === 'ch';
const html = `<!DOCTYPE html><meta charset="utf-8"><style>body{background:#3a3d48;color:#eee;font:13px sans-serif;margin:8px}.g{display:flex;flex-wrap:wrap;gap:6px}.i{text-align:center}
img{${tall ? 'width:180px;height:270px' : 'width:390px;height:260px'};object-fit:contain;background:repeating-conic-gradient(#555 0 25%,#666 0 50%) 0 0/16px 16px}</style>
<div class="g">${files.map(f => `<div class="i"><img src="../assets/${kind}/${f}?t=${Date.now()}"><div>${f.replace('.png', '')}</div></div>`).join('')}</div>`;
fs.writeFileSync(path.join(__dirname, 'sheet.html'), html);
console.log(files.length, 'images');
