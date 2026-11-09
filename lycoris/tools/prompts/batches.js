// 出图批次定义。node tools/build.js 生成 tools/prompts/<批次>.txt / .body.txt
// style: ch（新立绘）| expr（差分）| outfit（同一角色换装）| bg | cg ; refs: 参考图（相对 lycoris/）
const C = {
  chisato: `NISHIKIGI CHISATO from Lycoris Recoil (a 17-year-old girl, 162 cm, slim), in her official anime design: medium-length golden-blonde hair in a bob that reaches just below her chin, soft side-swept bangs, a red ribbon tied in a bow on the left side of her head; large bright crimson-red eyes; a lively, friendly face`,
  takina: `INOUE TAKINA from Lycoris Recoil (a 17-year-old girl, about 157 cm, slim), in her official anime design: very long straight glossy black hair falling to her waist, neat straight bangs, worn down; large violet-purple eyes; a calm, serious, pretty face`,
  lycoRed: `her iconic red First Lycoris uniform exactly as in the anime: a long-sleeved red-and-gray school-uniform dress with a pleated knee-length red skirt and a brown belt at the waist; a small silver owl pendant on a chain at her neck`,
  lycoNavy: `her navy-blue Second Lycoris uniform exactly as in the anime: the same school-uniform dress design as Chisato's red one but in navy blue and gray, long sleeves, a pleated knee-length navy skirt, a brown belt at the waist`,
};
module.exports = {
  C,
  // ================= 第一波：基础立绘 =================
  S1_chisato: { style: 'ch', items: [
    ['ch_chisato_normal', `${C.chisato}. Outfit: ${C.lycoRed}. Pose: standing relaxed, hands clasped loosely behind her back, head tilted a little. Expression: an easy, warm smile with her mouth closed, eyes bright and friendly.`]] },
  S1_takina: { style: 'ch', items: [
    ['ch_takina_normal', `${C.takina}. Outfit: ${C.lycoNavy}. Pose: standing straight and composed, both hands holding the handle of a plain dark-brown school bag in front of her thighs. Expression: calm and neutral, mouth closed, steady gaze at the viewer.`]] },
  S1_mika: { style: 'ch', items: [
    ['ch_mika_normal', `MIKA from Lycoris Recoil, the master of Café LycoReco, in his official anime design: a tall, broad-shouldered Black man around fifty, long black hair pulled back with part of it tied in braids at the back of his head, a short neat beard, green eyes behind black-framed glasses. Outfit: his café attire, a dark charcoal-olive Japanese kimono-style work jacket over a dark hakama, sleeves tied back with a cord, holding a plain black walking cane in his right hand (he has a bad leg). Pose: standing calm and upright. Expression: calm, gentle, dignified, a faint kind smile.`]] },
  S1_mizuki: { style: 'ch', items: [
    ['ch_mizuki_normal', `NAKAHARA MIZUKI from Lycoris Recoil, in her official anime design: a 27-year-old woman with long straight brown hair, brown eyes, glasses whose upper frames are red. Outfit: her Café LycoReco work clothes: a green Japanese samue-style top with darker trim, a dark kimono-style skirt and a beige apron tied at the waist. Pose: one hand on her hip, weight on one leg. Expression: a bit tired and grumpy, half-lidded eyes, mouth flat.`]] },
  S1_kurumi: { style: 'ch', items: [
    ['ch_kurumi_normal', `KURUMI from Lycoris Recoil (the genius hacker "Walnut"), in her official anime design: a small girl who looks about twelve, very long pale golden-blonde hair tied back low with a black ribbon, big blue eyes, a sleepy, smug little face. Outfit: an oversized white-and-yellow hoodie that reaches her thighs (no letters on it), sleeves covering half her hands, bare legs. Pose: holding a slim tablet against her chest with both arms. Expression: sleepy and unimpressed, half-lidded eyes.`]] },
  S1_kusunoki: { style: 'ch', items: [
    ['ch_kusunoki_normal', `KUSUNOKI from Lycoris Recoil, the commander of the DA, in her official anime design: a stern woman around forty with short red hair cut in a neat, sharp bob, dark eyes, an expressionless face. Outfit: a severe black formal uniform-like suit: a fitted black jacket buttoned up, white shirt collar, black skirt, black tights. Pose: standing very straight, hands clasped behind her back. Expression: cold, unreadable, looking down slightly at the viewer.`]] },
  S1_fuki: { style: 'ch', items: [
    ['ch_fuki_normal', `HARUKAWA FUKI from Lycoris Recoil, in her official anime design: a 17-year-old girl with short dark-brown hair, sharp purple eyes, a stern scowling face. Outfit: the red First Lycoris uniform (a long-sleeved red-and-gray school-uniform dress with a pleated red skirt and brown belt), gray tights. Pose: arms crossed, weight on one leg. Expression: irritated frown, glaring at the viewer.`]] },
  S1_sakura: { style: 'ch', items: [
    ['ch_sakura_normal', `OTOME SAKURA from Lycoris Recoil, in her official anime design: a 15-year-old girl with short auburn hair (one side shaved short in an undercut), brown eyes, a cocky, mischievous face. Outfit: the navy-blue Second Lycoris uniform (long-sleeved navy-and-gray school-uniform dress, pleated navy skirt, brown belt), chunky teal sneakers. Pose: one hand on her hip, the other hand holding a lollipop stick near her mouth. Expression: a cheeky, provoking grin.`]] },
  S1_shiomi: { style: 'ch', items: [
    ['ch_shiomi_normal', `An ORIGINAL character for this story, SHIOMI TORU: a composed Japanese woman around 32 who works for the DA intelligence division (she was a Lycoris herself long ago). Shoulder-length soft wavy dark hair tucked behind her right ear, calm gray eyes, a thin face with a faint, polite smile, small pearl earrings. Outfit: a tailored light-gray trench coat worn open over a dark navy suit and a white blouse, slim trousers. A thin pale old scar runs across the back of her left hand. Pose: standing at ease, holding a small white paper cake box in her left hand. Expression: gentle polite smile, eyes calm.`]] },
  S1_koharu: { style: 'ch', items: [
    ['ch_koharu_normal', `An ORIGINAL character for this story, MORI KOHARU: a gentle young woman about 20 who works at a small flower shop in Tokyo (she used to be a Lycoris). Soft light-brown hair in a loose low side braid over her left shoulder, warm brown eyes, a soft round face with a few faint freckles. Outfit: a moss-green canvas work apron over a cream knit sweater with the sleeves pushed up, light-blue jeans; a pair of garden scissors in the apron pocket. Pose: holding a small bunch of white and yellow flowers wrapped in brown paper against her chest. Expression: a shy, warm smile.`]] },
  S1_akari: { style: 'ch', items: [
    ['ch_akari_normal', `An ORIGINAL character for this story, MAKABE AKARI: a young woman about 21 who works at an aquarium in Tokyo (she used to be a Lycoris). Short straight black hair with one side tucked behind her ear by a small light-blue hairpin, dark eyes, a lean, alert face. Outfit: aquarium staff uniform: a navy polo shirt under a light-blue zip vest, beige work trousers, a staff lanyard with a blank card. Pose: arms folded defensively. Expression: wary and guarded, eyebrows slightly lowered.`]] },
  S1_karasuma: { style: 'ch', items: [
    ['ch_karasuma_normal', `An ORIGINAL character for this story, KARASUMA: a thin young man about 24, a self-styled underground hacker and agitator. Messy ash-gray dyed hair with black roots, several silver ear piercings, sharp narrow eyes with dark circles under them, pale skin. Outfit: an oversized black hoodie with the hood down, a thin silver chain necklace, black cargo pants. Pose: slouching, hands in the hoodie pocket. Expression: an arrogant, nervous smirk.`]] },
  S1_yamagishi: { style: 'ch', items: [
    ['ch_yamagishi_normal', `YAMAGISHI, the doctor from Lycoris Recoil who looks after Chisato's artificial heart: a woman in her forties with long dark hair tied back loosely, tired but kind eyes, thin-framed glasses. Outfit: a white doctor's coat over a dark turtleneck sweater, a stethoscope around her neck. Pose: hands in her coat pockets. Expression: a mild, slightly dry smile.`]] },
  S1_numata: { style: 'ch', items: [
    ['ch_numata_normal', `An ORIGINAL character for this story, NUMATA: a large, heavy-set Japanese man in his forties, shaved head, small expressionless eyes, a thick neck, a flat nose. Outfit: plain black tactical clothing: a black long-sleeved fitted shirt, black cargo trousers with a utility belt, black fingerless gloves. Pose: standing still, arms hanging at his sides. Expression: blank and cold.`]] },
};
for (const [k, items] of Object.entries(require('./bg.js'))) module.exports[k] = { style: 'bg', items };
Object.assign(module.exports, require('./sprites.js'));
Object.assign(module.exports, require('./sprites2.js'));
Object.assign(module.exports, require('./cg.js'));
Object.assign(module.exports, require('./sprites3.js'));
Object.assign(module.exports, require('./kusunoki.js'));
Object.assign(module.exports, require('./fix_efield.js'));
