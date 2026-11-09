// 重画 e_field：原图泷奈的手臂结构出错（看起来像三只手），石膏也在错的一边
const CAS_C = 'her casual clothes (white blouse with a small red ribbon bow at the collar, oversized beige knit cardigan, dark-brown skirt)';
const CAS_T = 'her casual clothes (light-blue button-up shirt, long black pleated skirt)';
const ARMS = `ANATOMY IS CRITICAL: Takina has exactly TWO arms and TWO hands, no more. Her RIGHT arm is bent at the elbow and held still against her chest: the whole right forearm and right hand are inside one white plaster cast, supported by a dark-navy cloth sling looped around her neck; the cast hand does nothing. Her LEFT arm is the only arm that moves: her LEFT hand is raised and ties the ribbon. Draw both of her shoulders clearly so it is obvious which arm is which. Chisato also has exactly two arms, both hands clasped together in front of her chest.`;
const SCENE = `Late afternoon in a vast field of red spider lilies in full bloom under tall trees, golden backlight. CHISATO (golden-blonde chin-length bob, red eyes, ${CAS_C}) sits in the flowers, laughing with tears in her eyes. TAKINA (very long straight black hair, violet eyes, ${CAS_T}, a square gauze patch on her left cheekbone) kneels close behind Chisato's left shoulder and, using only her LEFT hand, ties a new red silk ribbon (a tiny gold spider lily embroidered near one end) into a small bow on the LEFT side of Chisato's head; the bow is a little crooked. Warm, tender, beautiful. ${ARMS}`;
module.exports = {
  G_efield_fix: { style: 'cg', refs: ['assets_src/ch/chisato_casual.png', 'assets_src/ch/takina_casual_hurt.png'], items: [
    ['cg_e_field', SCENE + ' Composition: medium shot, Chisato on the right half of the frame facing the viewer, Takina on the left half turned toward her.'],
    ['cg_e_field_b', SCENE + ' Composition: medium close-up from slightly to the side, Takina behind and to the left of Chisato, her slinged right arm clearly visible in front of her own chest.']] },
};
