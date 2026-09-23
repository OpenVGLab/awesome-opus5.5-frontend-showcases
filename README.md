# Awesome Opus 5.5 Frontend Showcases

> 收集 Claude Opus 5.5（2026-09-22 发布）做出来的前端作品：SVG、Canvas 动画、网页与 UI、Three.js / WebGL 3D、浏览器游戏——凡是模型写代码、在浏览器里跑出来的，都在这里。
>
> A curated list of frontend showcases built by Claude Opus 5.5 — SVG, canvas animation, websites and UI, Three.js / WebGL, and browser games.

**在线游玩本仓库的游戏 / Play the games:** https://yiyingyang12.github.io/awesome-opus5.5-frontend-showcases/

- [本仓库原创：5 款纯 SVG 小游戏](#-本仓库原创5-款纯-svg-小游戏)
- [浏览器游戏](#-浏览器游戏)
- [3D · Three.js · WebGL](#-3d--threejs--webgl)
- [SVG：鹈鹕骑自行车](#-svg鹈鹕骑自行车)
- [SVG 动画与插画](#-svg-动画与插画)
- [代码逐帧绘制的动画与视频](#-代码逐帧绘制的动画与视频)
- [网页、UI 与工具类应用](#-网页ui-与工具类应用)
- [评测与工具](#-评测与工具)
- [收录标准与贡献](#收录标准与贡献)

## 🎮 本仓库原创：5 款纯 SVG 小游戏

每个游戏都只是一个 `.svg` 文件（96–163 KB）：画面、界面、游戏逻辑和 Web Audio 实时合成的音效全部写在同一个文件里，不依赖任何外部图片、字体或脚本。五款游戏由 Claude Opus 5.5 在 Cursor 里编写，玩法借鉴经典游戏，角色、名字和美术都是原创；每款都用无头 Chrome 自动试玩验收过（0 报错、60 fps）。

| | 游戏 | 灵感 | 画风 | 操作 |
|---|---|---|---|---|
| <a href="https://yiyingyang12.github.io/awesome-opus5.5-frontend-showcases/games/kitchen-rush.svg"><img src="thumbs/kitchen-rush-title.jpg" width="260" alt="厨房大作战"></a> | **[厨房大作战 KITCHEN RUSH](https://yiyingyang12.github.io/awesome-opus5.5-frontend-showcases/games/kitchen-rush.svg)**<br>切菜、下锅、装盘、出餐，在订单超时前把菜端上桌；支持同一键盘双人合作。 | 胡闹厨房 | 俯视卡通、粗描边暖色调 | WASD 移动 · 空格 拿/放 · K 切菜 · Tab 换厨师 |
| <a href="https://yiyingyang12.github.io/awesome-opus5.5-frontend-showcases/games/sunny-kart.svg"><img src="thumbs/sunny-kart-title.jpg" width="260" alt="阳光卡丁车"></a> | **[阳光卡丁车 SUNNY KART](https://yiyingyang12.github.io/awesome-opus5.5-frontend-showcases/games/sunny-kart.svg)**<br>海边赛道三圈定胜负，和 7 位 AI 对手抢名次，漂移攒火花、抢道具。 | 马力欧卡丁车 | 白天海岸、明亮低多边形伪 3D | ↑ 油门 · ←→ 转向 · Shift 漂移 · X 道具 |
| <a href="https://yiyingyang12.github.io/awesome-opus5.5-frontend-showcases/games/pixel-quest.svg"><img src="thumbs/pixel-quest-title.jpg" width="260" alt="像素大冒险"></a> | **[像素大冒险 PIXEL QUEST](https://yiyingyang12.github.io/awesome-opus5.5-frontend-showcases/games/pixel-quest.svg)**<br>踩怪、顶砖、吃果实变大，穿过草原、洞穴和云端三个关卡冲向终点旗。 | 超级马里奥 | 8/16-bit 像素风，自绘像素字体 | ←→ 移动 · 空格 跳 · Shift 奔跑/投掷 · ↓ 蹲 |
| <a href="https://yiyingyang12.github.io/awesome-opus5.5-frontend-showcases/games/fruit-slash.svg"><img src="thumbs/fruit-slash-title.jpg" width="260" alt="水果刀客"></a> | **[水果刀客 FRUIT SLASH](https://yiyingyang12.github.io/awesome-opus5.5-frontend-showcases/games/fruit-slash.svg)**<br>挥动鼠标化作刀光切开满天水果，千万别碰炸弹；经典 / 街机 60 秒 / 禅意 90 秒三种模式。 | 水果忍者 | 木纹道场、光泽水果、果汁飞溅 | 鼠标或触屏划动 |
| <a href="https://yiyingyang12.github.io/awesome-opus5.5-frontend-showcases/games/garden-defense.svg"><img src="thumbs/garden-defense-title.jpg" width="260" alt="花园保卫战"></a> | **[花园保卫战 GARDEN DEFENSE](https://yiyingyang12.github.io/awesome-opus5.5-frontend-showcases/games/garden-defense.svg)**<br>收集阳光、种下植物守住 5 条路，别让僵尸闯进家门。 | 植物大战僵尸 | 柔和卡通、阳光后院 | 鼠标选卡种植 · 1–6 选植物 · S 铲子 |

本地玩法：下载 `.svg` 后直接用浏览器打开即可。SVG 里的脚本只有在“直接打开”或用 `<iframe>` / `<object>` 嵌入时才会运行，用 `<img>` 嵌入只会显示一张静态图。

## 🕹️ 浏览器游戏

- [Introducing Claude Opus 5.5](https://www.anthropic.com/claude-opus-5-5)（Anthropic 官方公告，2026-09-22）— 有测试者让多个 Claude 模型各用一句提示词做一个游戏，Opus 5.5 凭画面和完成度得分最高。
- [Vibe Check: Opus 5.5 Is Pulling Our Codex Converts Back to Claude](https://every.to/vibe-check/vibe-check-opus-5-5-is-pulling-our-codex-converts-back-to-claude)（Every）— 只给一句“做个高尔夫游戏”，Opus 5.5 自己组了代理团队：三个设计师出球洞、三个评委打分、一个架构师拆分实现，连续跑了 1 小时 52 分钟。

## 🧊 3D · Three.js · WebGL

- [threejseval：Opus 5.5 High](https://threejseval.com/models/claude-opus-5-5-high) / [Opus 5.5 Medium](https://threejseval.com/models/claude-opus-5-5-medium) — Three.js 场景竞技场：埃菲尔铁塔、帆船、国际象棋、747、机械臂、猎鹰 9 号等 14 道题的实时场景、Elo 与单题成本（写作本文时 Medium 档的平均 Elo 略高于 High 档）。
- [人人都是产品经理：Opus 5.5 与 GPT-6 Sol 首发实测](https://www.woshipm.com/evaluating/6469164.html) — 3D 重庆城市生成器（层叠立交、轻轨穿楼、依山而建的高差），以及 Opus 5.5 自主生成的 3D 网页动画《牛来骑车》。

## 🦩 SVG：鹈鹕骑自行车

Simon Willison 发明的经典测试：只给一句 `Generate an SVG of a pelican riding a bicycle`，不许看渲染结果，车架怎么连、脚怎么踩踏板全靠模型“脑补”坐标。

- [Claude Opus 5.5, GPT-6 Sol, GPT-6 Luna, and a new price war](https://simonwillison.net/2026/Sep/22/opus-and-sol-and-luna/)（Simon Willison，2026-09-22）— Opus 5.5 在 low / medium / high / xhigh 四档都画出了结构正确的车架；max 档两次都把 128K 输出 token 全部用在思考上、没有交出 SVG，这是该测试第一次出现这种情况。它的思考开头第一句是 “This is a classic test request”。
- [Claude 鹈鹕对比网格](https://static.simonwillison.net/static/2026/claude-pelicans-grid.html) — Fable 5.1 / Opus 5.5 / Opus 5 / Sonnet 5 × 五档思考强度，附每张图的 token 数与成本。
- [Hacker News：Claude Opus 5.5 发布讨论](https://news.ycombinator.com/item?id=49803892) — Simon 在帖中贴出四档鹈鹕；有评论指出只有 xhigh 那只的两条腿真正分在车架两侧。
- [Hacker News：Opus 5.5 Intelligence, Performance and Price Analysis (Max)](https://news.ycombinator.com/item?id=49804316) — 关于 max 档“想太多”的讨论。
- [simonw/pelican-bicycle](https://github.com/simonw/pelican-bicycle) — 测试出处与早期各模型结果。
- [OpenRouter Sketch Benchmarks: Pelican on a bike](https://openrouter.ai/benchmarks/media/sketch/pelican-on-a-bike) — 多模型鹈鹕榜单。
- [JoJohanse/pelican-bicycle-benchmark](https://github.com/JoJohanse/pelican-bicycle-benchmark) — 中文维护、按厂商和模型整理的持续更新评测。
- [Pelicans on Bicycles: One Silly Benchmark, Sixty-Three Answers](https://nathanfennel.com/blog/pelicans-on-bicycles)（Nathan Fennel）— 在 Claude Code、Codex、Cursor 等真实编码工具里跑出的 63 张鹈鹕。
- [PromptFrenzy: Pelican on a Bicycle](https://www.promptfrenzy.com/showdown/svg-pelican) — 静态图和纯 SVG 动画两轮对比。

## ✨ SVG 动画与插画

- [人人都是产品经理：Opus 5.5 与 GPT-6 Sol 首发实测](https://www.woshipm.com/evaluating/6469164.html) — 把鹈鹕换成“熊猫骑车送外卖”：Opus 5.5 画出了牙盘、链条和踏板，还加了奶茶、车灯和“叮咚～外卖到啦！”气泡，而且轮子和链条是会转的动画 SVG。
- [@AndrewOnXYZ: “Opus 5.5 just made this animation in one shot”](https://x.com/AndrewOnXYZ/status/2102089270747886043)（2026-09-21，发布于正式上线前一天）— 一次成型的 3 分钟 SVG 动画，Reddit r/singularity 以 “Impressive SVG animation made by Opus 5.5 (zero shot)” 转发。

## 🎬 代码逐帧绘制的动画与视频

- [@kevin_t_ngo: “What do you love?”](https://x.com/kevin_t_ngo/status/2102437977435893771)（2026-09-22）— Claude Opus 5.5 用 JavaScript 画出每一帧的 28 秒动画故事：镇上所有人都给 Claude 发请求，只有一个女孩发来一个问题。
- [@nicekate8888: Opus 5.5 生成介绍 Opus 5.5 的短片](https://x.com/nicekate8888/status/2102575622912631261)（2026-09-23）— 90 秒。
- [@akokoi1: 2 分 38 秒快速回顾中华上下五千年](https://x.com/akokoi1/status/2102583898865873225)（2026-09-23）— 知识科普视频；作者称只用了 Max (5x) 周额度的约 1%。

## 🖥️ 网页、UI 与工具类应用

- [@trq212: 个人网站多版重设计，再剪成预告片](https://x.com/trq212/status/2102477340920152162)（2026-09-23）— 用 workflow 让 Opus 5.5 反复迭代、自我点评个人网站的多个设计方向，最后把所有迭代剪成一段预告片。
- [人人都是产品经理：Opus 5.5 与 GPT-6 Sol 首发实测](https://www.woshipm.com/evaluating/6469164.html) — 在 VS Code 开源代码上复刻网页版 Cursor（Editor / Agents 双窗口）；先写一个简易画板网页，再操作浏览器花 1 小时 17 分钟画出 Q 版鲸鱼娘。
- [Vibe Check（Every）](https://every.to/vibe-check/vibe-check-opus-5-5-is-pulling-our-codex-converts-back-to-claude) — 两句提示词做出一个仿 Meta Origami Studio 的交互原型工具，能从代码导入设计并连线交互。

## 🧰 评测与工具

- [`tools/check_game.js`](tools/check_game.js) — 本仓库验收游戏用的无头 Chrome 脚本：按脚本模拟按键、截图、测帧率，并检查 JS 报错、XML 解析错误和文件里的坏字节。
- [hand-drawn-canvas-animation](https://github.com/alesha-pro/tools/tree/main/skills/hand-drawn-canvas-animation) — 有人逐帧拆解 Kevin Ngo 的 Claude 手绘短片后整理出的开源（MIT）Canvas 动画引擎与工作流。
- [markdown-svg-renderer](https://tools.simonwillison.net/markdown-svg-renderer) — 把模型回复里的 SVG 直接渲染出来。
- [llm](https://llm.datasette.io/) + [llm-anthropic](https://github.com/simonw/llm-anthropic) — 命令行复现鹈鹕测试：`llm -m claude-opus-5.5 -o thinking_effort low "Generate an SVG of a pelican riding a bicycle"`

## 收录标准与贡献

- 作品需由 Claude Opus 5.5 生成，成品是在浏览器里运行的前端产物（HTML / CSS / JS、SVG、Canvas、WebGL 等，也包括用它们渲染出的视频）。
- 优先收录 2026-09-22 正式发布之后、有原帖、源码或可复现提示词的作品；发布前流传的“Opus 5.5 演示”里有被证实是伪造的，收录时会标注。
- 欢迎通过 Issue 或 PR 推荐。

## License

本仓库原创的游戏与工具代码以 [MIT](LICENSE) 发布；列表中外部作品的版权归各自作者所有，本仓库只提供链接。
