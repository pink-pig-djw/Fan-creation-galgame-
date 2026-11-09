# BGM 的 Suno 提示词

游戏里的 18 首 BGM 现在都是 `js/audio.js` 用 WebAudio 实时合成的。想换成真正录出来的音乐时，按下面的提示词在 Suno 里生成，存成对应的 mp3，再在 `js/audio.js` 里打开它。

## 怎么替换

1. Suno 里打开 **Instrumental**（纯音乐），把下面的英文提示词贴进 Style 一栏。歌名随意。
2. 每首多生成几版，挑开头和结尾都比较干净、能首尾相接循环的那版。游戏里是 `loop` 循环播放的，结尾最好不要渐弱到无声，开头不要有长时间的空白（可以用 Audacity 剪掉）。
3. 存成 `assets/bgm/<名字>.mp3`，名字就是下面每节标题里的英文 key，例如 `assets/bgm/daily.mp3`。
4. 打开 `js/audio.js`，找到 `const BGM_MP3 = [];`，把名字加进去：
   ```js
   const BGM_MP3 = ['title', 'daily'];
   ```
   列表里的曲目会先读 mp3，读不到（文件不存在、格式不对）时自动退回合成版；没列进去的曲目继续用合成版。
5. 音量：合成版大约在 -18 ~ -24 dBFS RMS。Suno 导出的 mp3 一般压得更响，换上后如果比其它曲子突兀，可以先用 Audacity 的「响度标准化」把它调到 -18 LUFS 左右。

**主题动机**：`title`、`climax`、`ending` 三首在合成版里共用同一段旋律（花期主题）。用 Suno 时可以先定下 `title`，再用 Suno 的翻唱 / 改编类功能，以 `title` 为底分别做成 `climax` 和 `ending`，这样三首听起来是同一首歌的不同版本。

提示词里没有写任何现有作品或艺人的名字，旋律都要是新的；如果生成结果听起来像某首已有的歌（特别是原作的 OP、ED），就丢掉重来。

---

## `title` 花期 —— 主题曲

- 用途：标题画面；终章「星期四」结尾的片尾字幕。
- 文件：`assets/bgm/title.mp3`
- 提示词：
  > instrumental, wistful but hopeful piano ballad, 72 bpm, D major, gentle flowing piano arpeggios, warm string ensemble pad, soft sustained low bass, memorable lyrical 16-bar main melody on solo piano, anime visual novel main theme, autumn, nostalgic, no drums, cinematic but intimate

## `daily` LycoReco 的日常

- 用途：咖啡店开门营业、早上、平常的下午（全游戏用得最多）。
- 文件：`assets/bgm/daily.mp3`
- 提示词：
  > instrumental, light cafe bossa nova jazz, 126 bpm, F major, Rhodes electric piano comping, upright bass playing bossa root-fifth pattern, brushes and rim click, shaker, vibraphone melody, cheerful, sunny afternoon in a small Tokyo coffee shop, relaxed and cozy

## `chisato` 千束

- 用途：千束的主题；营业中、休息日约会、出发值班、真结局最后一场。
- 文件：`assets/bgm/chisato.mp3`
- 提示词：
  > instrumental, bright bouncy jazz-pop, 144 bpm, G major, swing shuffle feel, syncopated piano comping, walking upright bass, handclaps and ride cymbal, playful square-lead synth melody doubled by vibraphone, mischievous, energetic, cheeky, stylish anime heroine theme

## `takina` 泷奈

- 用途：泷奈的主题；水族馆、深夜床边、看笔记本、营救之后。
- 文件：`assets/bgm/takina.mp3`
- 提示词：
  > instrumental, cool and composed chill jazz, 86 bpm, D dorian, clean electric guitar arpeggios with dotted-eighth delay, soft rim-click drums, round fingered bass, sparse Rhodes melody, minor but warm, calm, introspective, gentle late-afternoon mood

## `comedy` 吵吵闹闹

- 用途：桌游之夜、店里的吵闹、两个人斗嘴。
- 文件：`assets/bgm/comedy.mp3`
- 提示词：
  > instrumental, comical light orchestral, 152 bpm, C major, staccato pizzicato strings on offbeats, bouncy tuba-like bass, marimba melody with chromatic sneaky steps, woodblock and light percussion, playful, silly, cartoon slapstick

## `cafe_night` 打烊之后

- 用途：晚上十点关店之后、出发前夜、搬家那天。
- 文件：`assets/bgm/cafe_night.mp3`
- 提示词：
  > instrumental, late-night Rhodes jazz ballad, 64 bpm, E-flat major, soft Rhodes electric piano chords and melody, upright bass, very light brushes, quiet empty coffee shop after closing, warm, tender, a little lonely

## `warm` 两个人

- 用途：电影之夜、背靠背睡觉、屋顶、摩天轮。
- 文件：`assets/bgm/warm.mp3`
- 提示词：
  > instrumental, tender warm piano ballad, 68 bpm, A major, solo piano melody with soft left-hand chords, gentle string pad underneath, no drums, intimate, quiet happiness between two people, slow and heartfelt

## `koharu` 花店

- 用途：小春的花店、她留下的牌子、结局去花店。
- 文件：`assets/bgm/koharu.mp3`
- 提示词：
  > instrumental, gentle nostalgic music box melody, 82 bpm, B-flat major, celesta and music box lead, soft broken-chord piano, light warm pad, no drums, small flower shop, sweet, innocent, a bit sentimental

## `sad` 凋谢

- 用途：公寓的封条、站台、突入后看到尸体、坏结局。
- 文件：`assets/bgm/sad.mp3`
- 提示词：
  > instrumental, sad solo piano, 58 bpm, E minor, slow broken chords, simple fragile melody, lots of space, grief, loss, quiet rain-like melancholy, no other instruments

## `investigation` 名单

- 用途：看名单、开会、诊所、查资料。
- 文件：`assets/bgm/investigation.mp3`
- 提示词：
  > instrumental, mysterious investigation jazz noir, 96 bpm, F-sharp minor, muted fingered bass pulse in eighths, sparse Rhodes chords, vibraphone motif with delay, soft rim and shaker, low dark strings, curious, secretive, focused

## `tension` 不安

- 用途：跟踪者、陌生号码、门后有人、对峙前。
- 文件：`assets/bgm/tension.mp3`
- 提示词：
  > instrumental, suspense underscore, 70 bpm, D minor, low heartbeat-like kick pulse, dissonant sustained string clusters, low bass pulse, occasional single high piano notes, almost no melody, uneasy, something is wrong

## `night` 夜路

- 用途：夜里的街道、便利店门口、车里、屋顶抽烟。
- 文件：`assets/bgm/night.mp3`
- 提示词：
  > instrumental, lo-fi hip hop, 76 bpm, A minor, minor seventh Rhodes chords, dusty swung drums, vinyl crackle, warm bass, soft flute melody with delay, lonely Tokyo night city walk, melancholic and calm

## `action` 枪声

- 用途：打斗和枪战（跟踪者、水族馆、突入、天台）。
- 文件：`assets/bgm/action.mp3`
- 提示词：
  > instrumental, fast cool funk rock action, 138 bpm, E minor, tight funk drums with sixteenth hi-hats, punchy synth bass riff in octaves, brass section stabs, palm-muted guitar, second half with distorted lead guitar and driving rock beat, stylish gunfight, confident and fun, anime action scene

## `da` DA

- 用途：DA 的人出现、指挥所、与汐见对峙、黎明。
- 文件：`assets/bgm/da.mp3`
- 提示词：
  > instrumental, cold institutional ominous score, 56 bpm, C minor, low dark string ensemble, slow timpani hits, steady low bass pulse, sparse distant bell, authority, surveillance, quiet threat, no melody hook

## `dark` 白色房间

- 用途：被关在白色房间里、审讯。
- 文件：`assets/bgm/dark.mp3`
- 提示词：
  > instrumental, dark ambient drone, 40 bpm, no melody, deep sub bass drone, dissonant low strings, faint high-pitched ringing, metallic scrapes, occasional detuned bell, unsettling, sterile white room, captivity, oppressive silence

## `climax` 花期 —— 零点

- 用途：第六章射击道的决战。
- 文件：`assets/bgm/climax.mp3`
- 提示词：
  > instrumental, climactic cinematic anime battle theme, 92 bpm, D major, starts with piano arpeggios and strings then builds, big drums enter, driving eighth-note bass, soaring string melody doubled by piano an octave higher, brass swells, heroic, desperate, emotional peak

## `memory` 十岁

- 用途：十岁时的回忆。
- 文件：`assets/bgm/memory.mp3`
- 提示词：
  > instrumental, slightly detuned old music box, 62 bpm, C major, simple childlike lullaby melody, warped vintage tape feel, faint vinyl crackle, soft pad, no drums, distant childhood memory, fragile, bittersweet

## `ending` 彼岸

- 用途：渡轮甲板上的最后一幕和片尾字幕。
- 文件：`assets/bgm/ending.mp3`
- 提示词：
  > instrumental, warm bittersweet ending ballad, 64 bpm, D major, piano melody with soft bells an octave above, gentle piano arpeggios, warm strings and pad, no drums, red spider lilies blooming on the autumn equinox, farewell and hope, credits roll
