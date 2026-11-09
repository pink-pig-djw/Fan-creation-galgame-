// 立绘：换装底图（outfit）和表情差分（expr）
const E = {
  smile: 'a big bright happy smile, eyes curved into happy arcs, mouth open',
  grin: 'a teasing, mischievous grin, one eye slightly narrowed, playful',
  surprised: 'surprised: eyes wide open, eyebrows raised, mouth a small open "o"',
  serious: 'serious and focused: eyebrows drawn level, mouth set firmly, sharp steady gaze',
  angry: 'angry: eyebrows pulled down hard, glaring, teeth slightly clenched',
  sad: 'sad: eyebrows tilted up in the middle, eyes lowered, mouth a small downturned line',
  cry: 'crying: tears running down both cheeks, eyebrows tilted up, lips trembling',
  pout: 'pouting and sulky: cheeks a little puffed, lips pushed out, looking aside',
  worried: 'worried: eyebrows knitted and tilted up, eyes uneasy, lips pressed together',
  blush: 'flustered and embarrassed: cheeks clearly blushing pink, eyes looking away to the side, mouth a small wavy line',
  softsmile: 'a small, soft, gentle smile, eyes calm and warm',
};
const X = (id, desc) => [id, `Expression: ${desc}. Everything else unchanged.`];
const OUT = (id, desc) => [id, desc];
module.exports = {
  // ---------- 千束 ----------
  O_chisato_cafe: { style: 'outfit', refs: ['assets/ch/chisato_normal.png'], items: [
    OUT('ch_chisato_cafe', `NISHIKIGI CHISATO in her Café LycoReco work clothes exactly as in the anime: a red samue-style Japanese work top with dark-blue and lime-green accents (collar and trims), a dark-blue kimono-style long skirt, a beige apron wrapped around her waist, the silver owl pendant at her neck, the red ribbon in her hair. Pose: holding a round wooden serving tray against her side with one hand, the other hand giving a small wave. Expression: a cheerful welcoming smile.`)] },
  O_chisato_casual: { style: 'outfit', refs: ['assets/ch/chisato_normal.png'], items: [
    OUT('ch_chisato_casual', `NISHIKIGI CHISATO in early-autumn casual clothes: a white blouse with a small red ribbon bow at the collar, an oversized soft beige knit cardigan, a dark-brown A-line skirt just above the knee, the red ribbon still in her hair, the silver owl pendant at her neck. Pose: hands in the cardigan pockets, relaxed. Expression: an easy, warm smile with mouth closed.`)] },
  O_chisato_pj: { style: 'outfit', refs: ['assets/ch/chisato_normal.png'], items: [
    OUT('ch_chisato_pj', `NISHIKIGI CHISATO at home at night in comfortable pajamas: a loose soft-orange long-sleeved pajama shirt with small white dots and matching long pajama pants, the hair ribbon taken out (her blonde bob hair a little messy, no ribbon), the silver owl pendant at her neck. Pose: hugging a big pillow loosely in front of her. Expression: relaxed, a sleepy little smile.`)] },
  E_chisato_a: { style: 'expr', refs: ['assets/ch/chisato_normal.png'], items: [
    X('ch_chisato_smile', E.smile), X('ch_chisato_grin', E.grin), X('ch_chisato_surprised', E.surprised), X('ch_chisato_serious', E.serious + '; arms now hanging naturally at her sides instead of behind her back'), X('ch_chisato_angry', E.angry + '; arms hanging at her sides, hands in fists')] },
  E_chisato_b: { style: 'expr', refs: ['assets/ch/chisato_normal.png'], items: [
    X('ch_chisato_sad', E.sad), X('ch_chisato_cry', E.cry), X('ch_chisato_pout', E.pout), X('ch_chisato_worried', E.worried),
    ['ch_chisato_hurt', `The same girl after a hard fight: dust smudges on the red uniform, a small adhesive bandage on her right cheek, a few strands of blonde hair out of place. Arms hanging at her sides. Expression: grim and serious, jaw set, eyes hard. Everything else unchanged.`]] },
  // ---------- 泷奈 ----------
  O_takina_cafe: { style: 'outfit', refs: ['assets/ch/takina_normal.png'], items: [
    OUT('ch_takina_cafe', `INOUE TAKINA in her Café LycoReco work clothes exactly as in the anime: a blue samue-style Japanese work top with darker navy and pale accents on the collar and trims, a dark kimono-style long skirt, a beige apron wrapped around her waist, her long black hair down. Pose: holding a small notepad and pen in front of her chest, standing very straight. Expression: calm and neutral, polite.`)] },
  O_takina_casual: { style: 'outfit', refs: ['assets/ch/takina_normal.png'], items: [
    OUT('ch_takina_casual', `INOUE TAKINA in simple early-autumn casual clothes: a light-blue button-up shirt with the sleeves rolled once, a long black pleated skirt, a small black shoulder bag strap across her body, her long black hair down. Pose: hands holding the bag strap, standing straight. Expression: calm and neutral.`)] },
  O_takina_pj: { style: 'outfit', refs: ['assets/ch/takina_normal.png'], items: [
    OUT('ch_takina_pj', `INOUE TAKINA at home at night in a plain navy-blue long-sleeved pajama set (shirt and long pants), her long black hair down and slightly loose. Pose: holding a mug of warm milk in both hands. Expression: calm, a little sleepy.`)] },
  O_takina_captive: { style: 'outfit', refs: ['assets/ch/takina_normal.png'], items: [
    OUT('ch_takina_captive', `INOUE TAKINA after being held captive and beaten for a day: still in her navy-blue Lycoris uniform, but it is creased, damp and smudged with dirt, the brown belt gone. A dark bruise on her left cheekbone, a split lower lip with a little dried blood, a scrape on her forehead, her long black hair tangled and messy. Her wrists are bound in front of her with steel handcuffs, the hands hanging low. Standing slightly hunched but unbroken. Expression: exhausted yet defiant, a cold hard glare at the viewer.`)] },
  E_takina_a: { style: 'expr', refs: ['assets/ch/takina_normal.png'], items: [
    X('ch_takina_smile', E.softsmile), X('ch_takina_surprised', E.surprised), X('ch_takina_serious', E.serious), X('ch_takina_angry', E.angry), X('ch_takina_sad', E.sad)] },
  E_takina_b: { style: 'expr', refs: ['assets/ch/takina_normal.png'], items: [
    X('ch_takina_blush', E.blush), X('ch_takina_pout', E.pout), X('ch_takina_cry', E.cry), X('ch_takina_worried', E.worried),
    X('ch_takina_grin', 'a rare, small confident smirk, one corner of the mouth up, eyes sharp')] },
  // ---------- 其他人 ----------
  E_mika: { style: 'expr', refs: ['assets/ch/mika_normal.png'], items: [
    X('ch_mika_smile', 'a warm, broad fatherly smile'), X('ch_mika_serious', 'stern and serious, no smile, eyes steady behind the glasses'), X('ch_mika_sad', 'quietly sad, eyes lowered behind the glasses, mouth closed'), X('ch_mika_surprised', 'surprised, eyebrows raised above the glasses')] },
  E_mizuki: { style: 'expr', refs: ['assets/ch/mizuki_normal.png'], items: [
    X('ch_mizuki_smile', 'a cheerful, smug grin'), X('ch_mizuki_angry', 'yelling angrily, mouth wide open, eyebrows sharply down, a comic anger vein'), X('ch_mizuki_cry', 'sobbing comically, tears streaming, mouth wide open'), X('ch_mizuki_serious', 'serious and sharp, the tired look gone, eyes focused behind the glasses'), X('ch_mizuki_surprised', E.surprised)] },
  E_kurumi: { style: 'expr', refs: ['assets/ch/kurumi_normal.png'], items: [
    X('ch_kurumi_smile', 'a smug, satisfied little grin, eyes half-closed'), X('ch_kurumi_serious', 'serious and focused, eyes fully open and sharp'), X('ch_kurumi_scared', 'scared: eyes wide, small mouth trembling, clutching the tablet tighter'), X('ch_kurumi_sad', E.sad), X('ch_kurumi_surprised', E.surprised)] },
  E_kusunoki: { style: 'expr', refs: ['assets/ch/kusunoki_normal.png'], items: [
    X('ch_kusunoki_serious', 'sharp and severe, eyes narrowed, mouth a hard line'), X('ch_kusunoki_angry', 'coldly angry: brows lowered, a piercing glare'), X('ch_kusunoki_surprised', 'a rare look of surprise: eyes slightly widened, lips parted')] },
  E_fuki: { style: 'expr', refs: ['assets/ch/fuki_normal.png'], items: [
    X('ch_fuki_angry', 'shouting angrily, mouth open, eyebrows sharply down'), X('ch_fuki_serious', 'serious and focused, arms still crossed'), X('ch_fuki_surprised', E.surprised), X('ch_fuki_smile', 'a rare, small, reluctant smile, looking slightly aside'), X('ch_fuki_sad', 'conflicted and pained: eyebrows knitted, eyes lowered, lips pressed tight')] },
  E_sakura: { style: 'expr', refs: ['assets/ch/sakura_normal.png'], items: [
    X('ch_sakura_angry', 'annoyed and angry, scowling, baring her teeth'), X('ch_sakura_surprised', E.surprised), X('ch_sakura_scared', 'scared and nervous, sweat drop, forced smile'), X('ch_sakura_sulk', 'sulking, looking away, pouting, lollipop in her mouth')] },
  E_shiomi: { style: 'expr', refs: ['assets/ch/shiomi_normal.png'], items: [
    X('ch_shiomi_serious', 'serious and businesslike, no smile, calm eyes'), X('ch_shiomi_cold', 'cold and empty: no smile at all, eyes flat and unreadable, looking down slightly'), X('ch_shiomi_sad', 'a tired, sad little smile, eyes lowered'),
    ['ch_shiomi_smoke', `Same woman, now without the cake box: her left hand holds a lit cigarette near her face, a thin wisp of smoke. Expression: a faint tired smile, eyes half-lidded. Everything else unchanged.`],
    ['ch_shiomi_hurt', `Same woman after losing a fight: coat dusty and askew, hair messy, a bruise near her mouth with a trickle of blood from the lip, no cake box. Expression: a bitter, breathless smile. Everything else unchanged.`]] },
  E_koharu: { style: 'expr', refs: ['assets/ch/koharu_normal.png'], items: [
    X('ch_koharu_smile', 'laughing happily, eyes closed in joy'), X('ch_koharu_sad', E.sad), X('ch_koharu_surprised', E.surprised), X('ch_koharu_worried', E.worried)] },
  E_akari: { style: 'expr', refs: ['assets/ch/akari_normal.png'], items: [
    X('ch_akari_scared', 'frightened: eyes wide, face pale, arms now held tight around herself'), X('ch_akari_angry', 'angry and hostile, glaring'), X('ch_akari_sad', 'sad and resigned, a weak small smile')] },
  E_karasuma: { style: 'expr', refs: ['assets/ch/karasuma_normal.png'], items: [
    X('ch_karasuma_angry', 'angry, snarling, eyes wide'), X('ch_karasuma_scared', 'terrified: eyes wide and wet with tears, mouth open, sweating, hands now raised in front of him'), X('ch_karasuma_laugh', 'laughing manically, head tilted back slightly, eyes wide')] },
  E_yamagishi: { style: 'expr', refs: ['assets/ch/yamagishi_normal.png'], items: [
    X('ch_yamagishi_serious', 'serious, a doctor delivering news, eyes steady over the glasses')] },
};
