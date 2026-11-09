// 第三波：换装的表情差分
const E = {
  smile: 'a big bright happy smile, eyes curved into happy arcs, mouth open',
  grin: 'a teasing, mischievous grin, one eye slightly narrowed, playful',
  surprised: 'surprised: eyes wide open, eyebrows raised, mouth a small open "o"',
  serious: 'serious and focused: eyebrows drawn level, mouth set firmly, sharp steady gaze',
  sad: 'sad: eyebrows tilted up in the middle, eyes lowered, mouth a small downturned line',
  cry: 'crying: tears running down both cheeks, eyebrows tilted up, lips trembling',
  pout: 'pouting and sulky: cheeks a little puffed, lips pushed out, looking aside',
  worried: 'worried: eyebrows knitted and tilted up, eyes uneasy, lips pressed together',
  blush: 'flustered and embarrassed: cheeks clearly blushing pink, eyes looking away to the side, mouth a small wavy line',
  softsmile: 'a small, soft, gentle smile, eyes calm and warm',
  normal: 'calm and neutral, relaxed, mouth closed',
};
const X = (id, desc, extra = '') => [id, `Expression: ${desc}.${extra ? ' ' + extra : ''} Everything else unchanged.`];
const LOWER = 'Her waving hand is now lowered and rests at her side (the tray stays in the other hand).';
const R = p => ['assets/ch/' + p + '.png'];
module.exports = {
  F_chisato_cafe_a: { style: 'expr', refs: R('chisato_cafe'), items: [
    X('ch_chisato_cafe_normal', 'a calm, easy small smile with mouth closed', LOWER), X('ch_chisato_cafe_grin', E.grin), X('ch_chisato_cafe_surprised', E.surprised, LOWER), X('ch_chisato_cafe_pout', E.pout, LOWER)] },
  F_chisato_cafe_b: { style: 'expr', refs: R('chisato_cafe'), items: [
    X('ch_chisato_cafe_sad', E.sad, LOWER), X('ch_chisato_cafe_serious', E.serious, LOWER), X('ch_chisato_cafe_worried', E.worried, LOWER)] },
  F_chisato_casual_a: { style: 'expr', refs: R('chisato_casual'), items: [
    X('ch_chisato_casual_smile', E.smile), X('ch_chisato_casual_surprised', E.surprised), X('ch_chisato_casual_blush', E.blush)] },
  F_chisato_casual_b: { style: 'expr', refs: R('chisato_casual'), items: [
    X('ch_chisato_casual_sad', E.sad), X('ch_chisato_casual_serious', E.serious), X('ch_chisato_casual_cry', 'crying but smiling at the same time: tears on both cheeks, a wobbly smile')] },
  F_chisato_pj: { style: 'expr', refs: R('chisato_pj'), items: [
    X('ch_chisato_pj_smile', E.smile), X('ch_chisato_pj_sad', E.sad), X('ch_chisato_pj_cry', E.cry, 'She hugs the pillow tighter.'), X('ch_chisato_pj_serious', E.serious)] },
  F_chisato_hurt: { style: 'expr', refs: R('chisato_hurt'), items: [
    X('ch_chisato_hurt_angry', 'quietly furious: eyebrows down, eyes cold and sharp, jaw clenched, no shouting')] },
  F_takina_cafe_a: { style: 'expr', refs: R('takina_cafe'), items: [
    X('ch_takina_cafe_smile', E.softsmile), X('ch_takina_cafe_blush', E.blush), X('ch_takina_cafe_surprised', E.surprised)] },
  F_takina_cafe_b: { style: 'expr', refs: R('takina_cafe'), items: [
    X('ch_takina_cafe_serious', E.serious), X('ch_takina_cafe_pout', E.pout), X('ch_takina_cafe_sad', E.sad)] },
  F_takina_casual_a: { style: 'expr', refs: R('takina_casual'), items: [
    X('ch_takina_casual_smile', E.softsmile), X('ch_takina_casual_blush', E.blush), X('ch_takina_casual_sad', E.sad)] },
  F_takina_casual_b: { style: 'expr', refs: R('takina_casual'), items: [
    X('ch_takina_casual_surprised', E.surprised), X('ch_takina_casual_serious', E.serious)] },
  F_takina_casual_hurt: { style: 'expr', refs: R('takina_casual'), items: [
    ['ch_takina_casual_hurt', `The same girl in the same casual clothes, one day after being rescued: her RIGHT hand and forearm are in a white plaster cast held by a dark arm sling across her chest (the bag strap is gone), a square gauze patch on her left cheekbone, a small adhesive bandage on her forehead, a faint healing bruise at the corner of her mouth. Her left hand hangs at her side. Expression: calm and neutral, a little tired. Same face, hair, framing and position.`],
    ['ch_takina_casual_hurt_smile', `The same girl in the same casual clothes, one day after being rescued: her RIGHT hand and forearm are in a white plaster cast held by a dark arm sling across her chest (the bag strap is gone), a square gauze patch on her left cheekbone, a small adhesive bandage on her forehead, a faint healing bruise at the corner of her mouth. Her left hand hangs at her side. Expression: a small, soft, warm smile. Same face, hair, framing and position.`]] },
  F_takina_pj: { style: 'expr', refs: R('takina_pj'), items: [
    X('ch_takina_pj_smile', E.softsmile), X('ch_takina_pj_sad', E.sad), X('ch_takina_pj_blush', E.blush), X('ch_takina_pj_worried', E.worried)] },
  F_takina_captive: { style: 'expr', refs: R('takina_captive'), items: [
    X('ch_takina_captive_weak', 'exhausted and barely conscious: head drooping slightly, eyes half-closed and unfocused, lips parted'),
    X('ch_takina_captive_smile', 'a faint, tired, relieved smile despite the injuries, eyes a little wet'),
    X('ch_takina_captive_cry', 'crying quietly: tears running down her bruised cheeks, eyebrows tilted up, lips pressed together')] },
};
