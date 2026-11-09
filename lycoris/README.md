# 花期

《莉可丽丝 Lycoris Recoil》的**非官方同人视觉小说**。日常 / 枪战 / 悬疑。

> 彼岸花开的那天，是她的生日。

- 时间：原作之后。夏威夷的夏天过去，LycoReco 回到东京重新开张。9 月 1 日到 9 月 23 日（秋分，千束的生日）。
- 主视角：锦木千束（两段幕间是井之上泷奈的视角）。
- 本作含有枪战、暴力、死亡和囚禁相关的描写。

## 怎么玩

用浏览器（推荐 Chrome / Edge）打开 `index.html`。如果浏览器拦截了本地文件，在这个文件夹里运行一个本地服务器，再访问 `http://localhost:8768`：

```bash
python tools/serve.py 8768
```

| 操作 | 按键 |
|---|---|
| 前进 | 鼠标左键 / 空格 / 回车 / 滚轮下滑 |
| 快进 | 按住 Ctrl，或点「快进」 |
| 自动播放 | A |
| 对话记录 | 滚轮上滑，或点「记录」 |
| 档案（名词解释） | T，或点「档案」 |
| 分支图 | F，或点「分支图」 |
| 隐藏界面 | 右键 / H |
| 快速存档 / 读档 | S / L |
| 设置 | Esc |

## 结构

```
序章「回来了」→ 第一章「常客」→ 第二章「名单」→ 第三章「猎犬」→ 第四章「诱饵」→ 幕间「白」
→ 第五章「赎金」→ 幕间「零点」→ 第六章「花期」→ 结局
```

- **结局 5 个**：TRUE END「花期」、NORMAL END「离岸」、BAD END「交换」「空房间」「实弹」。
- 有几个选项看起来只是「先看哪里」。看得仔细一点，后面会用得上。
- **分支图**：走过的场景会亮起，点一下就能回到那个时刻重新选择。
- **档案**：第一次出现的名词（DA、莉可丽丝、Radiata……）会自动记进档案。

## 素材

- 图像全部由 Codex 图像生成（gpt-6-sol，medium）：角色立绘约 120 张（多套服装与表情差分）、背景 30 张、事件 CG 60 张、标题图。游戏读取的是 WebP（`assets/`，约 30MB），PNG 原图在 `assets_src/`（不需要随游戏分发）。
- 背景音乐、环境音、音效全部由 WebAudio 程序化实时生成（旋律原创）。想换成录好的音乐：把 mp3 放进 `assets/bgm/<曲名>.mp3`，并在 `js/audio.js` 的 `BGM_MP3` 里加上曲名（曲名和 Suno 提示词见 `docs/suno_prompts.md`）。

## 目录

```
index.html            入口
css/style.css         界面样式
js/engine.js          引擎
js/audio.js           音乐 / 音效
js/assets.js          素材清单、档案、结局
script/*.js           剧本
assets/bg|ch|cg|bgm   背景 / 立绘 / CG / 音乐（WebP）
assets_src/           PNG 原图（出图后 node tools/webp.js 会自动转换并移到这里）
docs/设定集.md         人物与世界观设定（含剧透）
docs/大纲.md           分场大纲（含剧透）
docs/真相（剧透）.md     幕后真相与结局条件（剧透）
tools/                出图、校验、自动通关测试脚本
```

开发用的检查工具：

```bash
node tools/validate.js -ai   # 剧本静态检查 + 「AI 味」句式
node tools/paths.js          # 模拟全部分支，看每条路线落到哪个结局
node tools/headless.js       # 用无界面的 Edge 把全部结局真实跑一遍（需要先开 tools/serve.py 8768）
node tools/shot.js 输出目录 标签:前进次数   # 无界面截图检查画面
```

## 原作

《莉可丽丝》（Lycoris Recoil，Spider Lily / アニプレックス・ABCアニメーション・BS11）。本作与原作者、制作方无关。
