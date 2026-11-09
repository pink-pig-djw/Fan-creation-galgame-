// 素材清单
window.SCRIPTS = window.SCRIPTS || [];
(() => {
  // 背景：out = 户外（只有户外才允许雨雪粒子）；tint = 立绘色调（night / dim / cold / warm）
  const B = (file, opt = {}) => Object.assign({ src: `assets/bg/${file}.webp` }, opt);
  const bg = {
    cafe_front: B('cafe_front', { out: true }), cafe_front_night: B('cafe_front_night', { out: true, tint: 'night' }),
    cafe: B('cafe', { tint: 'warm' }), cafe_night: B('cafe_night', { tint: 'night' }), cafe_back: B('cafe_back', { tint: 'warm' }), kurumi_room: B('kurumi_room', { tint: 'dim' }),
    chisato_room: B('chisato_room', { tint: 'warm' }), chisato_room_night: B('chisato_room_night', { tint: 'night' }), bedroom_night: B('bedroom_night', { tint: 'night' }),
    dorm: B('dorm', { tint: 'cold' }),
    street: B('street', { out: true }), street_night: B('street_night', { out: true, tint: 'night' }), alley_night: B('alley_night', { out: true, tint: 'night' }),
    river: B('river', { out: true, tint: 'warm' }), station: B('station', { out: true, tint: 'warm' }),
    flowershop: B('flowershop', { tint: 'warm' }), koharu_apt: B('koharu_apt', { tint: 'dim' }), aquarium: B('aquarium', { tint: 'cold' }), clinic: B('clinic', { tint: 'cold' }),
    rooftop_night: B('rooftop_night', { out: true, tint: 'night' }),
    hideout: B('hideout', { tint: 'night' }), warehouse: B('warehouse', { tint: 'dim' }), amusement: B('amusement', { out: true, tint: 'night' }), car_night: B('car_night', { tint: 'night' }), da_hq: B('da_hq', { tint: 'cold' }),
    facility_gate: B('facility_gate', { out: true, tint: 'night' }), facility_corridor: B('facility_corridor', { tint: 'cold' }), tile_room: B('tile_room', { tint: 'cold' }), training_hall: B('training_hall', { tint: 'cold' }),
    lycoris_field: B('lycoris_field', { out: true, tint: 'warm' }),
    black: null, white: null
  };
  // 立绘。face = [头像中心 x, y, 裁切尺寸]（由 tools/setface.js 计算）；scale = 相对身高
  // 表情 id 带前缀的是换装：cafe = 店里的作务衣，casual = 便服，pj = 睡衣，captive = 被关押（泷奈）；没有前缀的是莉可丽丝制服（或该角色的默认服装）
  const ch = {
    chisato: { name: '千束', color: '#ff8f8f', face: [506, 222, 360], scale: 1,
      exprs: ['normal', 'smile', 'grin', 'surprised', 'serious', 'angry', 'sad', 'cry', 'pout', 'worried', 'hurt', 'hurt_angry',
        'cafe', 'cafe_normal', 'cafe_grin', 'cafe_surprised', 'cafe_sad', 'cafe_serious', 'cafe_pout', 'cafe_worried',
        'casual', 'casual_smile', 'casual_surprised', 'casual_sad', 'casual_blush', 'casual_serious', 'casual_cry',
        'pj', 'pj_smile', 'pj_sad', 'pj_cry', 'pj_serious'] },
    takina: { name: '泷奈', color: '#a9b8ff', face: [514, 223, 360], scale: 0.97,
      exprs: ['normal', 'smile', 'surprised', 'serious', 'angry', 'sad', 'blush', 'pout', 'cry', 'worried', 'grin',
        'cafe', 'cafe_smile', 'cafe_blush', 'cafe_surprised', 'cafe_serious', 'cafe_pout', 'cafe_sad',
        'casual', 'casual_smile', 'casual_blush', 'casual_sad', 'casual_surprised', 'casual_serious', 'casual_hurt', 'casual_hurt_smile',
        'pj', 'pj_smile', 'pj_sad', 'pj_blush', 'pj_worried',
        'captive', 'captive_weak', 'captive_smile', 'captive_cry'] },
    mika: { name: '米卡', color: '#c9b48a', face: [501, 224, 360], scale: 1.12, exprs: ['normal', 'smile', 'serious', 'sad', 'surprised'] },
    mizuki: { name: '瑞希', color: '#9fd39a', face: [525, 226, 360], scale: 1.04, exprs: ['normal', 'smile', 'angry', 'cry', 'serious', 'surprised'] },
    kurumi: { name: '胡桃', color: '#ffe08a', face: [485, 155, 300], scale: 0.78, exprs: ['normal', 'smile', 'serious', 'scared', 'sad', 'surprised'] },
    kusunoki: { name: '楠木', color: '#e07a6a', face: [500, 224, 360], scale: 1.04, exprs: ['normal', 'serious', 'angry', 'surprised'] },
    fuki: { name: '风希', color: '#d67a9a', face: [489, 216, 360], scale: 1, exprs: ['normal', 'angry', 'serious', 'surprised', 'smile', 'sad'] },
    sakura: { name: '樱', color: '#f2a46b', face: [473, 229, 360], scale: 0.95, exprs: ['normal', 'angry', 'surprised', 'scared', 'sulk'] },
    shiomi: { name: '汐见', color: '#b8c4d6', face: [469, 228, 360], scale: 1.04, exprs: ['normal', 'serious', 'cold', 'sad', 'smoke', 'hurt', 'box'] },
    koharu: { name: '小春', color: '#f5c08a', face: [501, 221, 360], scale: 0.99, exprs: ['normal', 'smile', 'sad', 'surprised', 'worried', 'casual', 'casual_smile', 'casual_worried', 'casual_surprised'] },
    akari: { name: '灯', color: '#8fc4e8', face: [515, 227, 360], scale: 1, exprs: ['normal', 'scared', 'angry', 'sad'] },
    karasuma: { name: '乌丸', color: '#b0b0b0', face: [594, 234, 360], scale: 1.07, exprs: ['normal', 'angry', 'scared', 'laugh'] },
    yamagishi: { name: '山岸', color: '#c8b8e0', face: [520, 222, 360], scale: 1.02, exprs: ['normal', 'serious'] },
    numata: { name: '沼田', color: '#8a8a8a', face: [496, 233, 360], scale: 1.12, exprs: ['normal'] }
  };
  const speakers = { '千束': 'chisato', '泷奈': 'takina', '米卡': 'mika', '瑞希': 'mizuki', '胡桃': 'kurumi', '楠木': 'kusunoki', '风希': 'fuki', '樱': 'sakura',
    '汐见': 'shiomi', '小春': 'koharu', '灯': 'akari', '乌丸': 'karasuma', '山岸': 'yamagishi', '沼田': 'numata' };
  const cg = [
    { id: 'p_morning', title: '安静的心跳' }, { id: 'p_breakfast', title: '烤鱼和味噌汤' }, { id: 'p_open', title: '营业中' }, { id: 'p_koharu', title: '开业花篮' },
    { id: 'c1_boardgame', title: '桌游之夜' }, { id: 'c1_alley', title: '小巷' }, { id: 'c1_flowershop', title: '花苞' }, { id: 'c1_movie', title: '第二十一遍' },
    { id: 'c1_empty', title: '空着的坐垫' }, { id: 'c1_apartment', title: '窗台' }, { id: 'c1_tag', title: '给千束' },
    { id: 'c2_list', title: '彼岸名簿' }, { id: 'c2_cakes', title: '伴手礼' }, { id: 'c2_sakana', title: '鱼～' }, { id: 'c2_knife', title: '隧道' },
    { id: 'c2_van', title: '后门' }, { id: 'c2_backtoback', title: '背靠背' }, { id: 'c2_phone', title: '陌生号码' },
    { id: 'c3_duo', title: '红与蓝' }, { id: 'c3_raid', title: '突入' }, { id: 'c3_gunfight', title: '月光' }, { id: 'c3_shiomi', title: '背后' },
    { id: 'c3_wall', title: '照片墙' }, { id: 'c3_clinic', title: '检查' }, { id: 'c3_counter', title: '打烊之后' }, { id: 'c3_rooftop', title: '屋顶的烟' }, { id: 'c3_bouquet', title: '台阶上的花' },
    { id: 'c4_walnut', title: 'Walnut' }, { id: 'c4_bait', title: '诱饵' }, { id: 'c4_ferris', title: '摩天轮' }, { id: 'c4_bed', title: '袖子' },
    { id: 'c4_phone', title: '雨里的手机' }, { id: 'c4_rain', title: '雨' },
    { id: 'i1_hood', title: '白' },
    { id: 'c5_video', title: '四十八小时' }, { id: 'c5_kurumi', title: '我去' }, { id: 'c5_tile', title: '角落' }, { id: 'c5_park', title: '游乐园' },
    { id: 'c5_karasuma', title: '乌丸' }, { id: 'c5_sniped', title: '枪声' }, { id: 'c5_memory', title: '十岁' }, { id: 'c5_ready', title: '出发之前' }, { id: 'c5_fuki', title: '值班' },
    { id: 'i2_cell', title: '抗审讯训练室' }, { id: 'i2_ribbon', title: '丝带' },
    { id: 'c6_fence', title: '围栏' }, { id: 'c6_sakura', title: '樱' }, { id: 'c6_rescue', title: '零点十分' }, { id: 'c6_duel', title: '射击道' },
    { id: 'c6_stop', title: '枪管' }, { id: 'c6_standoff', title: '黎明' },
    { id: 'e_field', title: '花期' }, { id: 'e_cafe', title: '星期四' }, { id: 'e_ferry', title: '离岸' },
    { id: 'b_trade', title: '交换' }, { id: 'b_empty', title: '空房间' }, { id: 'b_live', title: '实弹' },
    { id: 'title', title: '标题画面' }, { id: 'title_true', title: '标题画面・花期' }
  ];
  const endings = [
    { id: 'true', tag: 'TRUE END', title: '花期', color: '#ff6b6b', hint: '把看见的东西，都记住……' },
    { id: 'normal', tag: 'NORMAL END', title: '离岸', color: '#9fb6d6', hint: '泷奈回来了，可是……' },
    { id: 'trade', tag: 'BAD END', title: '交换', color: '#7a7a8a', hint: '用一个人去换另一个人……' },
    { id: 'empty', tag: 'BAD END', title: '空房间', color: '#7a7a8a', hint: '那天凌晨，你去了哪里？' },
    { id: 'live', tag: 'BAD END', title: '实弹', color: '#7a7a8a', hint: '那把枪……' }
  ];
  // 档案：@tip id 解锁
  const tips = [
    { id: 'da', title: 'DA', text: 'Direct Attack。在犯罪发生之前就把它「处理掉」的秘密机构。日本被称为「世界上最安全的国家」，靠的是它。' },
    { id: 'lycoris', title: '莉可丽丝', text: 'DA 的实行部队。由 DA 收养的孤儿女孩组成，从小接受训练，伪装成女高中生在城市里行动。名字取自彼岸花的学名。她们没有户籍。' },
    { id: 'rank', title: 'First / Second / Third', text: '莉可丽丝的等级，看制服的颜色就知道。红色是 First，藏青是 Second，米色是 Third。First 只有极少数人。' },
    { id: 'lycoreco', title: '喫茶 LycoReco', text: '墨田区一条小巷里的和风咖啡店。咖啡和甜点很好吃，每周有桌游之夜。也是 DA 的分部：店里的人会接各种「委托」，从照顾小孩到保护证人。' },
    { id: 'radiata', title: 'Radiata', text: 'DA 的监控和分析 AI，接入全国的摄像头和通信。延空木事件那晚曾被黑客入侵。' },
    { id: 'cleaner', title: '清扫部门', text: 'DA 负责善后的人。现场会被清理干净，对外通常说成「煤气泄漏」「煤气爆炸」之类的事故。东京的煤气管道因此背了很多锅。' },
    { id: 'alan', title: '阿兰机关', text: '资助「有才能的孩子」的神秘组织。受资助的孩子会得到一枚猫头鹰挂坠，但永远不知道资助者是谁。' },
    { id: 'heart', title: '千束的心脏', text: '千束天生心脏有缺陷，靠阿兰机关提供的人工心脏活了下来。延空木事件后，那颗心脏换成了一颗新的。新心脏是米卡带回来的。' },
    { id: 'enkuboku', title: '延空木事件', text: '恐怖分子真岛在电波塔「延空木」挑起的事件。莉可丽丝和恐怖分子交火的画面被黑客直播到全国，事后 Radiata 发布说明：那是一场「宣传噱头」。' },
    { id: 'nonlethal', title: '非杀伤弹', text: '千束用的子弹。打在身上很疼，能让人倒下，但不会致命。她从来不杀人。' },
    { id: 'walnut', title: 'Walnut', text: '传说中的天才黑客，曾经黑进 Radiata。在网上被认为已经死了。' },
    { id: 'graduate', title: '毕业', text: '莉可丽丝不能一辈子当莉可丽丝。受伤、年纪到了的人会「毕业」，大多留在 DA 做后勤或情报。极少数人会被安置到普通社会，得到新的名字和户籍。DA 内部把这叫做「移栽」。' },
    { id: 'list', title: '彼岸名簿', text: '九月初出现在暗网上的网站。上面贴着「莉可丽丝」的照片、名字和住址，自称要「让藏在阴影里的东西见光」。' },
    { id: 'balance', title: '均衡', text: '「彼岸名簿」背后的团体，自称继承了恐怖分子真岛的思想。真岛本人下落不明。' },
    { id: 'facility', title: '训练所', text: 'DA 培养莉可丽丝的设施。孩子们在这里长大，学射击、格斗、潜入，也学怎样在被抓住的时候什么都不说。第三训练所在奥多摩的山里。' },
    { id: 'higan', title: '彼岸', text: '春分和秋分前后的七天。彼岸花在秋分前后开花，所以叫这个名字。秋分那天，也是千束的生日。' }
  ];
  // 标题画面：TRUE END 之后换图
  const titles = { common: 'assets/cg/title.webp', true: 'assets/cg/title_true.webp' };
  const titleBgms = { common: 'title', true: 'title' };
  function credits(cgName) {
    const rows = [
      ['', '<div class="cr-t">花期</div><div class="cr-n" style="letter-spacing:12px;opacity:.75">LYCORIS RECOIL fan visual novel</div>'],
      ['原作', '《莉可丽丝》（Lycoris Recoil / Spider Lily / アニプレックス・ABCアニメーション・BS11）'], ['', '<div class="cr-n" style="font-size:24px;opacity:.7">本作为非官方同人作品</div>'],
      ['剧本', 'Claude'],
      ['喫茶 LycoReco', '锦木 千束<br>井之上 泷奈<br>米卡<br>中原 瑞希<br>胡桃'],
      ['DA', '楠木<br>春川 风希<br>乙女 樱'], ['', '<div class="cr-n">山岸</div>'],
      ['原创角色', '汐见 透<br>森 小春<br>真壁 灯<br>乌丸<br>沼田'],
      ['图像', 'Codex 图像生成（gpt-6-sol）'], ['音乐 · 音效 · 环境音', 'WebAudio 程序化生成'], ['程序', '自制 Web 视觉小说引擎'],
      ['', cgName ? `<img src="assets/cg/${cgName}.webp">` : ''],
      ['', '<div class="cr-n" style="margin-top:300px">Thank you for playing.</div>']
    ];
    return rows.map(([h, n]) => (h ? `<div class="cr-h">${h}</div>` : '') + (n.startsWith('<') ? n : `<div class="cr-n">${n}</div>`)).join('');
  }
  window.ASSETS = { protagonist: '千束', protagonistId: 'chisato', bg, ch, speakers, cg, endings, tips, titles, titleBgms, titleBgm: 'title', titleImage: titles.common, credits };
})();
