// 素材清单
window.SCRIPTS = window.SCRIPTS || [];
(() => {
  // 背景：out = 户外（只有户外才允许雨雪粒子）；tint = 立绘色调（night / dim / cold / warm）
  const B = (file, opt = {}) => Object.assign({ src: `assets/bg/${file}.png` }, opt);
  const bg = {
    office: B('office', { tint: 'night' }), corridor: B('corridor', { tint: 'cold' }), rest: B('rest', { tint: 'night' }), lab: B('lab', { tint: 'cold' }),
    chief: B('chief', { tint: 'cold' }), kennel: B('kennel', { tint: 'dim' }), wagon: B('wagon', { tint: 'dim' }), rooftop: B('rooftop', { out: true, tint: 'night' }),
    akane_room: B('akane_room', { tint: 'warm' }), akane_room_off: B('akane_room_off', { tint: 'night' }),
    scene: B('scene', { tint: 'warm' }), scene_off: B('scene_off', { tint: 'cold' }), nozawa: B('nozawa', { tint: 'dim' }),
    saegusa: B('saegusa', { tint: 'warm' }), lobby: B('lobby'), server: B('server', { tint: 'cold' }),
    grandma_house: B('grandma_house', { tint: 'dim' }), grandma_engawa: B('grandma_engawa', { out: true, tint: 'night' }),
    street_night: B('street_night', { out: true, tint: 'night' }), oso_corridor: B('oso_corridor', { tint: 'night' }), oso_chapel: B('oso_chapel', { tint: 'dim' }),
    cemetery: B('cemetery', { out: true }), cell: B('cell', { tint: 'cold' }),
    black: null, white: null
  };
  // 立绘。face = [头像中心 x, y, 裁切尺寸]（由 tools/setface.js 计算）；scale = 相对身高；holo = 全息影像（加闪烁）
  const ch = {
    akane: { name: '朱', color: '#9fd9e8', face: [507, 233, 360], scale: 0.96,
      exprs: ['normal', 'smile', 'serious', 'surprised', 'sad', 'angry', 'hurt', 'closed', 'home', 'home_sad', 'home_smile'] },
    mika: { name: '美佳', color: '#f0a35e', face: [509, 243, 360], scale: 0.99, exprs: ['normal', 'angry', 'surprised', 'smirk', 'scared', 'cry', 'sad'] },
    ginoza: { name: '宜野座', color: '#7fc8a9', face: [497, 235, 360], scale: 1.08, exprs: ['normal', 'smile', 'serious', 'surprised'] },
    yayoi: { name: '六合塚', color: '#a99be0', face: [493, 243, 360], scale: 1.01, exprs: ['normal', 'smile', 'serious'] },
    hinakawa: { name: '雏河', color: '#e07d7d', face: [525, 239, 360], scale: 1.02, exprs: ['normal', 'surprised', 'serious'] },
    shion: { name: '志恩', color: '#f2d57e', face: [494, 222, 360], scale: 1.02, exprs: ['normal', 'smile', 'serious'] },
    kasei: { name: '禾生', color: '#b8bcc6', face: [508, 228, 360], scale: 1.01, exprs: ['normal', 'smile'] },
    kiri: { name: '七濑', color: '#8f9bb5', face: [513, 225, 360], scale: 1, exprs: ['normal', 'sad', 'surprised', 'smile'] },
    shirasagi: { name: '白鹭', color: '#8fd0e0', face: [527, 249, 360], scale: 1.06, holo: ['holo', 'holo_smile'], exprs: ['holo', 'holo_smile', 'real', 'real_smile'] },
    aoi: { name: '奶奶', color: '#f0c48a', face: [499, 228, 360], scale: 0.86, holo: ['normal', 'glitch'], exprs: ['normal', 'glitch'] },
    mari: { name: '鞠', color: '#c9a0c9', face: [512, 157, 300], scale: 0.66, exprs: ['normal', 'smile'] },
    candy: { name: 'Candy', color: '#f5a3c7', face: [513, 455, 360], scale: 0.6, holo: ['normal'], exprs: ['normal'] },
    kagami: { name: '加贺美', color: '#a8d8f0', face: [522, 236, 360], scale: 0.97, holo: ['normal'], exprs: ['normal'] },
    kenichi: { name: '三枝', color: '#a0a8b0', face: [494, 239, 360], scale: 1.06, exprs: ['normal'] }
  };
  const speakers = { '朱': 'akane', '美佳': 'mika', '宜野座': 'ginoza', '六合塚': 'yayoi', '雏河': 'hinakawa', '志恩': 'shion', '禾生': 'kasei',
    '七濑': 'kiri', '白鹭': 'shirasagi', '奶奶': 'aoi', '鞠': 'mari', 'Candy': 'candy', '加贺美': 'kagami', '三枝': 'kenichi' };
  const cg = [
    { id: 'prologue', title: '最后的晚餐' }, { id: 'mirror', title: '今天的色相' }, { id: 'wagon', title: '押送车' }, { id: 'scene_sheet', title: '欢迎回来' },
    { id: 'dom_holo', title: '对象外' }, { id: 'smoke', title: '那包烟' }, { id: 'message', title: '发信人' },
    { id: 'lobby', title: '白色大厅' }, { id: 'mari', title: '翻花绳' }, { id: 'oldman', title: '摆好的拖鞋' }, { id: 'house', title: '佛坛前' },
    { id: 'house_glitch', title: '转过头来' }, { id: 'teacup', title: '两杯茶' },
    { id: 'scanner', title: '死者的足迹' }, { id: 'hina', title: '帧率' }, { id: 'mika_msg', title: '深夜的休息区' }, { id: 'dinner', title: '炖萝卜' },
    { id: 'slap1', title: '对峙' }, { id: 'slap2', title: '耳光' }, { id: 'rain', title: '楼顶的雨' },
    { id: 'ginoza', title: 'Dime' }, { id: 'server', title: '机房' }, { id: 'doorscan', title: '欢迎回家' }, { id: 'mari_door', title: '门口的鞠' },
    { id: 'corridor', title: '旧校舍' }, { id: 'chapel', title: '礼拜堂' }, { id: 'dom_kagami', title: '少女的名字' }, { id: 'reveal', title: '死者的脸' },
    { id: 'zero', title: '犯罪系数 0' }, { id: 'arrest', title: '手铐' }, { id: 'kasei', title: '接收' },
    { id: 'cry', title: '梅干' }, { id: 'cry_mika', title: '门外' }, { id: 'pass', title: '走廊' }, { id: 'normal', title: '雪' }, { id: 'normal_end', title: '就这样吧' }, { id: 'smoke2', title: '两缕烟' }, { id: 'kasei_end', title: '结案' },
    { id: 'bad_room', title: '里屋' }, { id: 'bad_target', title: '一张照片' }, { id: 'bad_turbid', title: '玻璃的那一边' }, { id: 'bad_home', title: '欢迎回家' },
    { id: 'title', title: '标题画面' }, { id: 'title_true', title: '标题画面・四十九日' }
  ];
  const endings = [
    { id: 'true', tag: 'TRUE END', title: '四十九日', color: '#9fd9e8', hint: '把那些话听到最后……' },
    { id: 'normal', tag: 'NORMAL END', title: '无色', color: '#c9ced8', hint: '案子结束了，可是……' },
    { id: 'room', tag: 'BAD END', title: '里屋', color: '#d65a5a', hint: '奶奶在里屋叫你……' },
    { id: 'target', tag: 'BAD END', title: '对象外', color: '#d65a5a', hint: '站在死者身后的，是谁？' },
    { id: 'turbid', tag: 'BAD END', title: '浊色', color: '#d65a5a', hint: '她的色相……' },
    { id: 'home', tag: 'BAD END', title: '回家', color: '#d65a5a', hint: '奶奶做了你爱吃的菜……' }
  ];
  // 搜查档案：@tip id 解锁
  const tips = [
    { id: 'sibyl', title: '西比拉系统', text: '测量市民心理状态与性格倾向、并据此判断其职业适性与危险程度的社会系统。人们的工作、婚姻、生活，几乎都依照它的判定。' },
    { id: 'hue', title: '色相', text: '心理状态被测量为一种颜色。压力越大、越接近犯罪，颜色越浊。人们会定期做色相检查，并用各种「色相护理」让颜色保持清澈。' },
    { id: 'cc', title: '犯罪系数', text: '将犯罪的可能性数值化的指标。超过 100 即被认定为潜在犯，超过 300 则被视为必须当场排除的对象。' },
    { id: 'dominator', title: '主宰者', text: '公安局刑事课使用的携带型心理测量镇压执行系统。瞄准对象后即时读取犯罪系数，由系统决定是否允许开火与执行模式。只有登记过的监视官、执行官能使用。' },
    { id: 'modes', title: '执行模式', text: '非致命瘫痪（使对象失去意识）／致命处决（排除对象）／毁灭分解（用于排除无机物或威胁极大的对象）。模式由主宰者根据犯罪系数自动切换。' },
    { id: 'inspector', title: '监视官', text: '公安局刑事课的刑事，负责指挥执行官、对现场做出判断。被要求保持清澈的色相。' },
    { id: 'enforcer', title: '执行官', text: '由潜在犯担任的刑事。拥有「以猎犬捕猎猎物」的能力，但行动受到严格限制，离开公安局需要监视官陪同。' },
    { id: 'latent', title: '潜在犯', text: '犯罪系数超过规定值的人。即使还没有做过任何事，也会被隔离或接受治疗。' },
    { id: 'huecare', title: '色相护理', text: '心理咨询、药物、全息疗法、香氛、音乐……一切让色相保持清澈的服务的总称。是这个社会最大的产业之一。' },
    { id: 'holo', title: '全息装潢', text: '用全息投影覆盖墙面、地板和家具的室内装潢。花很少的钱就能住在任何风格的房间里。关掉之后，大多数房间只是素混凝土。' },
    { id: 'scanner', title: '街头扫描器', text: '遍布城市的色相扫描装置。会在市民经过时读取身份与色相，色相恶化时自动通报。' },
    { id: 'doorscan', title: '门禁扫描', text: '住宅入口的身份识别装置。读取来访者的色相与身份，登记过的住户会被直接放行，并听到「欢迎回家」。' },
    { id: 'afterimage', title: '残像', text: '用逝者的生命日志（通讯、影像、语音、色相记录）制作全息影像的哀悼服务公司。获西比拉认证，标准服务期为四十九天。' },
    { id: 'fortynine', title: '四十九日', text: '佛教认为人死后的四十九天里，逝者的魂魄仍在世间，第四十九天才真正离开。遗属会在这一天做法事。「残像」的影像也在这一天道别。' },
    { id: 'prenote', title: '生前预约', text: '「残像」的服务之一。本人在生前录下留言、登记自己的生命日志，指定在自己的四十九日送达给家人。四十九日之前，内容是封存的。' },
    { id: 'neiran', title: '宁蓝', text: '经过认证的色相护理用镇静剂，常用于失眠与丧亲后的情绪安定。正常剂量下非常安全；高剂量会使人在睡眠中停止呼吸。' },
    { id: 'helmet', title: '头盔事件', text: '2112 年，一种能读取并伪装他人色相的头盔流入街头，戴着它的人在扫描器面前会被识别为别人。引发大规模暴动后，头盔被全部回收销毁。' },
    { id: 'oso', title: '樱霜学园', text: '历史悠久的全寄宿制女子学校。2112 年，校内发生了以学生为对象的连续杀人事件。事件之后，旧校舍被关闭。霜月美佳是这所学校的毕业生。' },
    { id: 'asymptomatic', title: '免罪体质', text: '极少数无论做出什么行为，色相都不会变浊、犯罪系数都不会上升的人。主宰者无法对他们开火。已知的免罪体质者，记录上都很少留下下文。' },
    { id: 'isolation', title: '隔离设施', text: '收容潜在犯、对其进行治疗的设施。很多人进去之后就再也没有出来。' }
  ];
  // 标题画面：TRUE END 之后换图
  const titles = { common: 'assets/cg/title.png', true: 'assets/cg/title_true.png' };
  const titleBgms = { common: 'title', true: 'title' };
  function credits(cgName) {
    const rows = [
      ['', '<div class="cr-t">四十九日</div><div class="cr-n" style="letter-spacing:12px;opacity:.75">FORTY-NINE DAYS</div>'],
      ['原作', '《PSYCHO-PASS 心理测量者》（Production I.G / サイコパス製作委員会）'], ['', '<div class="cr-n" style="font-size:24px;opacity:.7">本作为非官方同人作品</div>'],
      ['剧本', 'Claude'],
      ['公安局刑事课一系', '常守 朱<br>霜月 美佳<br>宜野座 伸元<br>六合塚 弥生<br>雏河 翔'],
      ['公安局', '唐之杜 志恩<br>禾生 壤宗'], ['', '<div class="cr-n">常守 葵</div>'],
      ['原创角色', '七濑 雾<br>白鹭 静司<br>三枝 鞠'],
      ['图像', 'Codex 图像生成（gpt-6-sol）'], ['音乐', 'Suno 生成'], ['音效 · 环境音', 'WebAudio 实时合成'], ['程序', '自制 Web 视觉小说引擎'],
      ['', cgName ? `<img src="assets/cg/${cgName}.png">` : ''],
      ['', '<div class="cr-n" style="margin-top:300px">Thank you for playing.</div>']
    ];
    return rows.map(([h, n]) => (h ? `<div class="cr-h">${h}</div>` : '') + (n.startsWith('<') ? n : `<div class="cr-n">${n}</div>`)).join('');
  }
  window.ASSETS = { protagonist: '朱', protagonistId: 'akane', bg, ch, speakers, cg, endings, tips, titles, titleBgms, titleBgm: 'title', titleImage: titles.common, credits };
})();
