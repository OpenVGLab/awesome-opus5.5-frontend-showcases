# Awesome Opus 5.5 Frontend Showcases

**中文** · [English](README.en.md)

> 收集 Claude Opus 5.5（2026-09-22 发布）做出来的前端作品：SVG 游戏与动画、「鹈鹕骑自行车」系列、Lottie、Three.js / WebGL、代码逐帧动画、网页与 UI——凡是模型写代码、在浏览器里跑出来的，都在这里。

**在线试玩：** [总览](https://openvglab.github.io/awesome-opus5.5-frontend-showcases/) · [SVG](https://openvglab.github.io/awesome-opus5.5-frontend-showcases/svg/) · [Lottie](https://openvglab.github.io/awesome-opus5.5-frontend-showcases/lottie/) · [Voxel](https://openvglab.github.io/awesome-opus5.5-frontend-showcases/voxel/) · [社区 prompt 复刻](https://openvglab.github.io/awesome-opus5.5-frontend-showcases/repro/) · [中秋专题](https://openvglab.github.io/awesome-opus5.5-frontend-showcases/midautumn/)

## 目录

每个类别里，本仓库原创的作品排在前面并附完整 prompt；社区作品收成表格，按发布时间倒序。

- 🎮 [浏览器游戏](#-浏览器游戏) — 15 条
- 🦩 [鹈鹕骑自行车](#-鹈鹕骑自行车) — 7 条
- 🚲 [更多骑行系列](#-更多骑行系列) — 9 条
- ✨ [SVG 动画与插画](#-svg-动画与插画) — 7 条
- 🎞️ [Lottie 动画](#-lottie-动画) — 5 条
- 🧊 [3D · Three.js · WebGL](#-3d--threejs--webgl) — 10 条
- 🎬 [代码逐帧动画与视频](#-代码逐帧动画与视频) — 10 条
- 🖥️ [网页、UI 与应用](#-网页ui-与应用) — 9 条
- 📊 [评测与工具](#-评测与工具)
- [收录标准与贡献](#收录标准与贡献)

## 🎮 浏览器游戏

纯 SVG 或网页里跑的游戏。本仓库的每款都是一个自包含的 `.svg` 文件：画面、界面、逻辑和实时合成的音效都在同一个文件里。

#### Case 1: [厨房大作战 KITCHEN RUSH](https://openvglab.github.io/awesome-opus5.5-frontend-showcases/svg/kitchen-rush.svg)

**来源：** 本仓库原创 · Claude Opus 5.5 · [`svg/kitchen-rush.svg`](svg/kitchen-rush.svg)

**发布：** 2026-09-24

<p align="center"><img src="svg/thumbs/kitchen-rush-title.jpg" alt="厨房大作战 KITCHEN RUSH" width="720" /></p>

俯视角合作烹饪，灵感来自《胡闹厨房》：切菜、下锅、装盘、出餐，在订单超时前把菜端上桌，支持同一键盘双人合作。俯视卡通、粗描边暖色调。单个 SVG 94 KB，无头 Chrome 自动试玩 0 报错、60 fps。

<details><summary>Prompt（Agentic 生成）</summary>

```text
你负责独立完成一款浏览器小游戏《厨房大作战 KITCHEN RUSH》：俯视角合作烹饪，玩法借鉴《胡闹厨房》，角色、名字和美术全部原创。

【交付】
- 只交付一个自包含文件 kitchen-rush.svg，根元素为 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">，窗口缩放时 16:9 画面完整居中。
- 画面、界面、游戏逻辑（内联脚本）和音效全部写在这一个文件里，不引用任何外部图片、字体、脚本或网络资源，浏览器直接打开就能玩。文件必须是合法的 UTF-8 XML。
- 界面文字用中文，标题配英文副标题。音效和背景音乐用 Web Audio 实时合成，第一次按键或点击后开始发声，M 键静音。
- 只借鉴玩法，不使用原作的角色、名字或标志性素材。

【玩法】
- 每局营业 2 分 30 秒。订单小票依次出现在左上角，每张都有倒计时，要在超时前把菜做好送到出餐口。
- 做菜流程：从食材箱拿食材 → 在砧板上按住切菜键切好 → 下锅煮或下锅煎 → 装进盘子 → 送到出餐口。
- 三道菜：番茄汤（3 个切好的番茄放进锅里煮）；蔬菜沙拉（切好的生菜 + 切好的番茄）；汉堡（面包 + 煎好的肉饼 + 切好的生菜）。
- 出餐越快小费越多；订单超时扣分；汤和肉饼放太久会烧焦，只能倒进垃圾桶；端错菜会被退回。每个无效操作都要有简短提示，比如“番茄要先切”“锅满了”“要先装盘”。
- 单人模式同时拥有两位厨师，用 Tab 切换控制；双人模式两人在同一键盘上合作。
- 营业结束按得分给 1～3 星，并用 localStorage 记录最佳成绩。

【厨房（选厨房 = 选难度）】
- 简单「街角小馆」：番茄汤、蔬菜沙拉，订单少、节奏慢。
- 普通「汉堡快餐」：蔬菜沙拉、汉堡。
- 困难「忙碌后厨」：三道菜全上，同时最多 5 张订单，食物更快烧焦，还有推车在过道里来回穿行挡路。

【操作】
- 单人：WASD / 方向键 移动，空格 / J 拿起或放下，按住 K 切菜，Shift 冲刺，Tab 换厨师。
- 双人：1P 用 WASD 移动、F 拿放、G 切菜、左 Shift 冲刺；2P 用方向键移动、句号键拿放、斜杠键切菜、右 Shift 冲刺（也可以用小键盘 1 / 2 / 0）。
- P / Esc 暂停，H 帮助，M 静音。

【画面】
- 俯视卡通厨房，粗描边、暖色调：红白格子桌布作背景，木质台面，米色棋盘格地砖，灶台上放着锅。
- 两位原创厨师戴白色高帽，1P 系红围巾，2P 系蓝围巾，走路有弹跳感；当前控制的厨师脚下显示高亮圈和 1P / 2P 标签。
- HUD：左上角是订单小票（菜品图示 + 剩余时间条），顶部中间是闹钟造型的营业倒计时，右上角是金币得分和星级进度，左侧一栏列出当前模式的按键。
- 反馈：切菜进度条、锅里冒泡、快烧焦时闪烁警告、烧焦时震屏，出餐时飘出得分和小费。

【流程与界面】
- 标题页：左边选模式（单人 1P / 双人 2P），中间三张厨房卡片，右边“开始”和“帮助”按钮；方向键选择，Enter 开始，并显示最佳成绩。
- 帮助页“怎么玩”：做菜流程、三道菜配方、单人和双人两套按键，以及计分规则。
- 开局显示“准备…开工！”；暂停菜单有继续、重新开始、返回标题，暂停时锅里的菜也停住。
- 结算页“打烊啦！”：出餐数、小费、超时、烧焦、端错次数，以及得分和星级，可以再来一局。

【验收】
在无头 Chrome 里自动试玩：从标题页开局，实际做出至少一道菜并出餐。要求 0 个 JS 报错、0 个 XML 解析错误、帧率不低于 55 fps；在 1280×720 和 1920×1080 两种分辨率下截图，确认画面完整、文字不溢出。
```

</details>

#### Case 2: [阳光卡丁车 SUNNY KART](https://openvglab.github.io/awesome-opus5.5-frontend-showcases/svg/sunny-kart.svg)

**来源：** 本仓库原创 · Claude Opus 5.5 · [`svg/sunny-kart.svg`](svg/sunny-kart.svg)

**发布：** 2026-09-24

<p align="center"><img src="svg/thumbs/sunny-kart-title.jpg" alt="阳光卡丁车 SUNNY KART" width="720" /></p>

伪 3D 卡丁车竞速，灵感来自《马力欧卡丁车》：海边赛道三圈定胜负，漂移攒火花、抢道具，和 7 位 AI 对手争夺领奖台。白天海岸、明亮低多边形。单个 SVG 130 KB，无头 Chrome 自动试玩 0 报错、60 fps。

<details><summary>Prompt（Agentic 生成）</summary>

```text
你负责独立完成一款浏览器小游戏《阳光卡丁车 SUNNY KART》：海边赛道上的伪 3D 卡丁车竞速，玩法借鉴《马力欧卡丁车》，角色、名字和美术全部原创。

【交付】
- 只交付一个自包含文件 sunny-kart.svg，根元素为 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">，窗口缩放时 16:9 画面完整居中。
- 画面、界面、游戏逻辑（内联脚本）和音效全部写在这一个文件里，不引用任何外部图片、字体、脚本或网络资源，浏览器直接打开就能玩。文件必须是合法的 UTF-8 XML。
- 界面文字用中文，标题配英文副标题。音效和背景音乐用 Web Audio 实时合成，第一次按键或点击后开始发声，M 键静音。
- 只借鉴玩法，不使用原作的角色、名字或标志性素材。

【玩法】
- 赛事叫「阳光杯」：玩家驾驶柴犬豆豆，在海边赛道上和 7 位 AI 对手跑 3 圈，按圈数和赛道进度实时排名，前三名登上领奖台。
- 起跑：三盏红灯依次亮起，第三盏亮起时按住油门能获得起步加速，踩得太早会提示“油门踩太早啦”。
- 漂移：转向时按住漂移键，车轮后的火花按蓝、橙、紫三级变亮，按得越久火花越亮，松开时获得对应强度的加速。
- 道具：撞碎赛道上的彩虹道具箱，随机获得一种——火箭冲刺（瞬间冲刺，沙地也不减速）、香蕉皮（丢在身后，踩到的车打滑转圈）、泡泡护盾（挡下一次香蕉皮或弹弹球）、弹弹球（向前弹出，追着前车跑）。AI 对手也会用道具。
- 赛道：压过橙色加速带会冲刺；开到沙地和草地会减速；开反方向时提示“逆行！”；进入最后一圈有提示。
- 8 位原创动物车手：柴犬豆豆、橘猫阿橙、小鸭嘎嘎、青蛙呱呱、企鹅波波、兔子跳跳、小猪噜噜、熊猫团团。

【难度】
- 简单 50cc / 普通 100cc / 困难 150cc，cc 越高车速越快、对手越强。
- 每档用 localStorage 记录最好名次和最佳用时。

【操作】
↑ / W 油门，↓ / S 刹车和倒车，← → / A D 转向，转向时按住 Shift 或空格漂移，X / J 使用道具，P 暂停，H 玩法，M 静音。

【画面】
- 白天海岸，明亮的低多边形伪 3D：公路按分段投影绘制，随弯道和坡度延伸到远处，两侧是红白路肩；路边有椰子树、观众看台、遮阳伞、灯塔和帆船，远景是海面、低多边形远山、太阳、白云和海鸥；起点是棋盘格拱门。
- 从车后视角呈现玩家的卡丁车，转向时车身倾斜，漂移时车轮后冒出彩色火花。
- HUD：左上角是道具槽、“LAP 1/3”圈数和用时；右侧是 8 位车手的实时名次表；左下角是赛道小地图；右下角用大字显示当前名次（如“8th 第8名”）；右上角有暂停和静音按钮。

【流程与界面】
- 标题页：棋盘格拱门下的赛道场景配大标题，左边选 cc，右边是“开始比赛”和“玩法”按钮，并显示该难度的最佳成绩。
- 玩法说明：操作、漂移火花、道具图鉴和比赛规则。
- 暂停菜单：继续比赛、重新开始、返回标题。
- 比赛结果：名次表、总时间、★最快圈和最佳纪录；拿到冠军时显示“冠军！阳光杯归你啦！”，可以再来一局。

【验收】
在无头 Chrome 里自动试玩：从标题页开赛，按住油门并转向跑完一段。要求 0 个 JS 报错、0 个 XML 解析错误、帧率不低于 55 fps；在 1280×720 和 1920×1080 两种分辨率下截图，确认画面完整、文字不溢出。
```

</details>

#### Case 3: [像素大冒险 PIXEL QUEST](https://openvglab.github.io/awesome-opus5.5-frontend-showcases/svg/pixel-quest.svg)

**来源：** 本仓库原创 · Claude Opus 5.5 · [`svg/pixel-quest.svg`](svg/pixel-quest.svg)

**发布：** 2026-09-24

<p align="center"><img src="svg/thumbs/pixel-quest-title.jpg" alt="像素大冒险 PIXEL QUEST" width="720" /></p>

横版平台跳跃，灵感来自《超级马里奥》：踩怪、顶砖、吃果实变大，穿过草原、洞穴和云端三个关卡冲向终点旗。8/16-bit 像素风，自绘像素字体。单个 SVG 145 KB，无头 Chrome 自动试玩 0 报错、60 fps。

<details><summary>Prompt（Agentic 生成）</summary>

```text
你负责独立完成一款浏览器小游戏《像素大冒险 PIXEL QUEST》：8/16-bit 像素风横版平台跳跃，玩法借鉴《超级马里奥》，角色、名字和美术全部原创。

【交付】
- 只交付一个自包含文件 pixel-quest.svg，根元素为 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">，窗口缩放时 16:9 画面完整居中。
- 画面、界面、游戏逻辑（内联脚本）和音效全部写在这一个文件里，不引用任何外部图片、字体、脚本或网络资源，浏览器直接打开就能玩。文件必须是合法的 UTF-8 XML。
- 界面文字用中文，标题配英文副标题。音效和背景音乐用 Web Audio 实时合成，第一次按键或点击后开始发声，M 键静音。
- 只借鉴玩法，不使用原作的角色、名字或标志性素材。

【玩法】
- 主角是一只小狐狸，依次穿过 3 个关卡：晴空草原、幽光洞穴、秋枫天桥，最后找到天桥尽头的小屋。
- 按住跳键跳得更高，按住奔跑键跑得更快、跳得更远。
- 踩怪、顶砖：从下方顶星星砖会顶出宝物；吃到浆果会变大，变大后能顶碎砖块；拿到金叶后可以用 J / Shift 投掷叶镖。
- 敌人：橡果兵（踩扁它）、刺猬（不能踩）、甲虫（踩成壳后可以踢出去）、蜜蜂（波浪飞行）、松果弹（可以踩）。
- 收集金币，每 100 枚奖励 1 条命；下蹲能钻进树洞，通往秘密房间；关卡里设有存档点；时间快用完时给出提醒。
- 终点旗抓得越高分越多，剩余时间换算成时间奖励；记录最高分，打破时提示“新纪录！”。

【难度】
- 简单：5 条命，限时 500，3 个存档点。
- 普通：3 条命，限时 400，1 个存档点。
- 困难：3 条命，限时 300，没有存档点，怪物更快。

【操作】
← → / A D 移动，空格 / W / K 跳跃（按住跳得更高），Shift / J 奔跑或投掷叶镖，↓ 下蹲或钻进树洞，P 暂停，H 帮助，M 静音。

【画面】
- 所有角色、图块和特效都按像素网格绘制，边缘保持锐利；界面文字也用自绘的像素字体。
- 晴空草原：蓝天白云、圆润的绿色山丘、木栅栏和指路牌；幽光洞穴：幽暗的岩洞里有发光的元素；秋枫天桥：云端之上的红枫色调。
- HUD：顶部一条像素信息栏，依次是 SCORE、金币数、WORLD 编号、TIME 倒计时和狐狸头像的剩余命数，右上角有暂停和静音按钮。

【流程与界面】
- 标题页：像素大标题配“PIXEL QUEST”红色横幅，三档难度按钮下方写明命数、限时和存档点，“开始冒险”（Enter）和“帮助”（H）按钮，左上角显示最高分；背景是草原，小狐狸和橡果兵站在地面上。
- 帮助页“冒险指南”：操作、规则，以及每种敌人和道具的图示说明。
- 暂停菜单：继续、帮助、返回标题。
- 每关结束显示过关和时间奖励；三关全部打完显示“全部通关！”结局，失败显示“游戏结束”，两者都列出分数、金币、击败数、用时和最高分。

【验收】
在无头 Chrome 里自动试玩：从标题页开始，向右跑、跳跃并踩扁至少一个敌人。要求 0 个 JS 报错、0 个 XML 解析错误、帧率不低于 55 fps；在 1280×720 和 1920×1080 两种分辨率下截图，确认画面完整、像素边缘清晰。
```

</details>

#### Case 4: [水果刀客 FRUIT SLASH](https://openvglab.github.io/awesome-opus5.5-frontend-showcases/svg/fruit-slash.svg)

**来源：** 本仓库原创 · Claude Opus 5.5 · [`svg/fruit-slash.svg`](svg/fruit-slash.svg)

**发布：** 2026-09-24

<p align="center"><img src="svg/thumbs/fruit-slash-title.jpg" alt="水果刀客 FRUIT SLASH" width="720" /></p>

划动切水果，灵感来自《水果忍者》：挥动鼠标化作刀光切开满天水果，别碰炸弹；经典 / 街机 60 秒 / 禅意 90 秒三种模式。木纹道场、光泽水果与果汁飞溅。单个 SVG 159 KB，无头 Chrome 自动试玩 0 报错、60 fps。

<details><summary>Prompt（Agentic 生成）</summary>

```text
你负责独立完成一款浏览器小游戏《水果刀客 FRUIT SLASH》：用鼠标或手指划动切水果，玩法借鉴《水果忍者》，角色、名字和美术全部原创。

【交付】
- 只交付一个自包含文件 fruit-slash.svg，根元素为 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">，窗口缩放时 16:9 画面完整居中。
- 画面、界面、游戏逻辑（内联脚本）和音效全部写在这一个文件里，不引用任何外部图片、字体、脚本或网络资源，浏览器直接打开就能玩。文件必须是合法的 UTF-8 XML。
- 界面文字用中文，标题配英文副标题。音效和背景音乐用 Web Audio 实时合成，第一次按键或点击后开始发声，M 键静音。
- 只借鉴玩法，不使用原作的角色、名字或标志性素材。

【玩法】
- 水果从画面下方抛起，按住鼠标（或手指）快速划过就能切开；划得太慢切不开。
- 一刀切开 3 个以上水果得连击奖励；从正中快速切开有机会暴击 +10；连续切中会累积“连斩”。
- 千万别碰黑色炸弹。
- 三种模式：
  经典：3 条命，漏掉 3 个水果或碰到炸弹就结束。
  街机 60 秒：会出现特殊香蕉，切开后分别触发冰冻减速、双倍得分、狂热果潮；碰到炸弹扣 10 分。
  禅意 90 秒：没有炸弹，静心切果。
- 三档难度（简单、普通、困难），每个模式用 localStorage 各自记录最高分。

【操作】
- 鼠标或触屏划动切水果；在标题页切开某个模式圆环里的水果，就直接开始该模式。
- 键盘：← → 选模式，↑ ↓ 选难度，Enter 开始；P 暂停，R 重新开始，H 帮助，Esc 返回标题，M 静音。

【画面】
- 深色木纹道场：横向木板墙上有钉子和木节，上方挂着写有“切”“果”的红灯笼；标题是钉在木板上的宣纸牌匾，毛笔字“水果刀客”压着一道红色刀痕，旁边盖着“刀客”印章。
- 西瓜、苹果、菠萝、桃子等水果有光泽和立体感，切开后分成两半，露出果肉截面；果汁四溅，在木板上留下果渍。
- 刀光拖尾随划动速度变粗变亮，快速划动时有破空声；碰到炸弹有明显的爆炸效果。
- HUD：左上角是西瓜图标、得分和最高分；顶部中间显示“模式 · 难度”；经典模式在右上角用 3 个 ✕ 记录失误；右下角有暂停和静音按钮。

【流程与界面】
- 标题页：三个模式各是一个圆环，环里放一个水果（经典是西瓜，街机是菠萝，禅意是桃子），下面写模式规则和最高分；底部是帮助按钮、难度选择和“开始”按钮。
- 帮助页“刀客心法”：划切、连击、炸弹、失误、特殊香蕉和各模式说明。
- 开局有“预备”倒计时；暂停菜单有继续游戏、重新开始、操作说明、返回标题。
- 结算页：得分、切开水果数、最佳连击、最长连斩、命中率和本模式最高分，破纪录时提示“新纪录”。

【验收】
在无头 Chrome 里自动试玩：从标题页开局，用模拟的鼠标划动切开水果。要求 0 个 JS 报错、0 个 XML 解析错误、帧率不低于 55 fps；在 1280×720 和 1920×1080 两种分辨率下截图，确认画面完整、文字不溢出。
```

</details>

#### Case 5: [花园保卫战 GARDEN DEFENSE](https://openvglab.github.io/awesome-opus5.5-frontend-showcases/svg/garden-defense.svg)

**来源：** 本仓库原创 · Claude Opus 5.5 · [`svg/garden-defense.svg`](svg/garden-defense.svg)

**发布：** 2026-09-24

<p align="center"><img src="svg/thumbs/garden-defense-title.jpg" alt="花园保卫战 GARDEN DEFENSE" width="720" /></p>

塔防，灵感来自《植物大战僵尸》：收集阳光、种下植物，守住 5 条路，别让僵尸闯进家门。柔和卡通、阳光后院。单个 SVG 132 KB，无头 Chrome 自动试玩 0 报错、60 fps。

<details><summary>Prompt（Agentic 生成）</summary>

```text
你负责独立完成一款浏览器小游戏《花园保卫战 GARDEN DEFENSE》：收集阳光、种植物守住后院的塔防游戏，玩法借鉴《植物大战僵尸》，角色、名字和美术全部原创。

【交付】
- 只交付一个自包含文件 garden-defense.svg，根元素为 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">，窗口缩放时 16:9 画面完整居中。
- 画面、界面、游戏逻辑（内联脚本）和音效全部写在这一个文件里，不引用任何外部图片、字体、脚本或网络资源，浏览器直接打开就能玩。文件必须是合法的 UTF-8 XML。
- 界面文字用中文，标题配英文副标题。音效和背景音乐用 Web Audio 实时合成，第一次按键或点击后开始发声，M 键静音。
- 只借鉴玩法，不使用原作的角色、名字或标志性素材。

【玩法】
- 草坪是 5 行 × 9 列的格子。僵尸从右侧街道沿 5 条路走来，玩家要守住左边的家门。
- 阳光：点击天上掉下来的阳光收集，暖阳葵也会定时产出。种植物要花阳光，种完后卡片进入冷却。
- 6 种植物（数字键 1～6）：暖阳葵 50（定时产出阳光）、豌豆炮 100（朝前方逐颗发射豌豆）、连发豆 200（一次连射两颗）、霜冻豆 175（冰豆让僵尸变蓝、减速）、土豆盾 50（超级耐啃，越啃越破）、辣椒爆弹 150（种下即爆，炸飞周围 3×3）。铲子可以移除植物。
- 5 种僵尸：普通僵尸（慢吞吞，见啥啃啥）、路锥僵尸（头顶路锥，更耐打）、水桶僵尸（铁皮水桶，超级硬）、跑跑僵尸（受伤后撒腿狂奔）、晾衣杆僵尸（撑杆跳过第一株植物）。僵尸会停下来啃挡路的植物。
- 每行有一台小推车作为最后防线，僵尸碰到时推平整行，只能用一次；僵尸闯进家门就失败。
- 僵尸分波次进攻，大波来袭前有提示，最后一波有警告；撑过所有波次就胜利。

【难度】
- 简单“阳光充足”：初始阳光 200，共 8 波。
- 普通“标准挑战”：初始阳光 125，共 10 波。
- 困难“僵尸凶猛”：初始阳光 75，共 12 波，僵尸更耐打、更快、来得更密。
- 难度越高得分倍率越高，用 localStorage 记录最高分。

【操作】
- 鼠标或触屏：点卡片，再点草地格子种植；点击阳光收集；点铲子再点植物即可移除；右键或 Esc 取消。
- 键盘：1～6 选卡，方向键移动光标，空格 / 回车 种植、铲除或收阳光；S 铲子，P 暂停，H 帮助，M 静音。

【画面】
- 柔和卡通的阳光后院：左边是带门牌号的浅色木屋，每行门前停着一台红色小推车；中间是深浅相间的草坪格子，镶着花丛边；上方是白色木栅栏和大树；右边是人行道、邮筒、消防栓和街道。
- 植物圆润、有表情；僵尸滑稽不吓人，穿衬衫系领带，分别戴路锥、顶水桶，跑跑僵尸穿橙色运动服、系头带，晾衣杆僵尸扛着一根晾衣杆。
- HUD：左上角是阳光数和 6 张植物卡（标价格和快捷键，冷却时盖上遮罩），旁边是铲子；右上角是难度、分数、暂停和静音；右下角是波次进度条，用僵尸头像和旗帜标出大波；选中的格子用虚线框高亮。

【流程与界面】
- 标题页：木牌大标题，中间是难度选择、“开始游戏”和“游戏帮助”按钮以及最高分，底部写着鼠标和键盘两种操作；背景里植物和僵尸已经就位。
- 帮助页“怎么玩”：收集阳光、选卡种植、挡住僵尸、小推车、撑过所有波次，并附植物图鉴和僵尸档案（价格、冷却、特点）。
- 开局显示“准备好了吗？开始守护！”；暂停菜单有继续游戏、重新开始、返回标题。
- 结算页：胜利显示“花园守住啦！”，失败显示“僵尸闯进家门啦！”，列出本局得分、坚持到第几波、击败僵尸数、种下植物数、用时和剩余小推车。

【验收】
在无头 Chrome 里自动试玩：从标题页开局，收集阳光并种下至少一株植物。要求 0 个 JS 报错、0 个 XML 解析错误、帧率不低于 55 fps；在 1280×720 和 1920×1080 两种分辨率下截图，确认画面完整、文字不溢出。
```

</details>

#### Case 6: [泡泡海 BUBBLE REEF](https://openvglab.github.io/awesome-opus5.5-frontend-showcases/svg/bubble-reef.svg)

**来源：** 本仓库原创 · Claude Opus 5.5 · [`svg/bubble-reef.svg`](svg/bubble-reef.svg)

**发布：** 2026-09-24

<p align="center"><img src="svg/thumbs/bubble-reef-title.jpg" alt="泡泡海 BUBBLE REEF" width="720" /></p>

泡泡射击 / 消除益智，灵感来自《泡泡龙》：寄居蟹举着泡泡开火，打散的泡泡炸成水珠、掉落的泡泡变成小鱼游走，12 关冒险加无尽模式纸张纹理上的水彩海底：晕染水色、晃动光斑、摇摆海草珊瑚，泡泡里藏着海洋生物剪影。单个 SVG 122 KB。

<details><summary>Prompt（Agentic 生成）</summary>

```text
你负责独立完成一款浏览器小游戏《泡泡海 BUBBLE REEF》：水彩海底风的泡泡射击，玩法借鉴《泡泡龙》，角色、名字和美术全部原创。

【交付】
- 只交付一个自包含文件 bubble-reef.svg，根元素为 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">，窗口缩放时 16:9 画面完整居中。
- 画面、界面、游戏逻辑（内联脚本）和音效全部写在这一个文件里，不引用任何外部图片、字体、脚本或网络资源，浏览器直接打开就能玩。文件必须是合法的 UTF-8 XML。
- 界面文字用中文，标题配英文副标题。音效和背景音乐用 Web Audio 实时合成，第一次按键或点击后开始发声，M 键静音。
- 只借鉴玩法，不使用原作的角色、名字或标志性素材。

【玩法】
- 底部发射器瞄准并发射彩色泡泡，泡泡粘在顶部的蜂窝格阵列上；同色泡泡连成 3 个及以上就消除，失去连接的泡泡整串掉落并得额外分数。
- 泡泡可以碰左右墙壁反弹；显示瞄准虚线（包括第一次反弹后的路径）。
- 显示当前泡泡和下一个泡泡，可以互换。
- 每发射若干次，泡泡阵整体下降一行；泡泡压过底线就失败。
- 特殊泡泡：彩虹泡（匹配任意颜色）、炸弹泡（炸掉周围一圈）、冰冻泡（先打一次解冻才能消除）、闪电泡（消除整行）。
- 冒险模式 12 关，每关有不同的初始阵型；无尽模式不断从上方推进新行，按分数计。
- 难度：简单（4 种颜色、下降慢）、普通（5 种）、困难（6 种、下降快）；用 localStorage 记录冒险进度和各模式最高分。

【操作】鼠标移动瞄准、点击发射；键盘 ← → 调整角度、空格发射、↑ 交换当前和下一个泡泡；P 暂停，H 帮助，M 静音。

【画面】
- 水彩海底风：水面透下来的光斑轻轻晃动，珊瑚和海草随水流摆动，背景有纸张纹理和晕染。
- 泡泡是带高光和折射感的水彩泡泡，每种颜色里有一只不同的小海洋生物剪影（小丑鱼、海星、水母、海龟、章鱼、海马），方便色弱玩家区分。
- 消除时泡泡破裂成小水珠，掉落的泡泡变成小鱼游走；发射器是一只会跟着瞄准方向转身的寄居蟹。
- HUD 显示分数、关卡、距离下降还有几步、下一个泡泡。

【流程与界面】
- 标题页：模式选择（冒险 / 无尽）、难度、开始、帮助、最高分。
- 冒险模式有关卡选择页，显示已解锁关卡和每关星级。
- 帮助页：操作和特殊泡泡说明。
- 暂停菜单有继续、重新开始、返回标题；过关结算给 1～3 星；失败页和无尽模式结算页都可以再来一局。

【验收】
在无头 Chrome 里自动试玩：从标题页开局并实际操作一局。要求 0 个 JS 报错、0 个 XML 解析错误、帧率不低于 55 fps；在 1280×720 和 1920×1080 两种分辨率下截图，确认画面完整、文字不溢出。
```

</details>

#### Case 7: [糖果砖块 CANDY BREAKER](https://openvglab.github.io/awesome-opus5.5-frontend-showcases/svg/candy-breaker.svg)

**来源：** 本仓库原创 · Claude Opus 5.5 · [`svg/candy-breaker.svg`](svg/candy-breaker.svg)

**发布：** 2026-09-24

<p align="center"><img src="svg/thumbs/candy-breaker-title.jpg" alt="糖果砖块 CANDY BREAKER" width="720" /></p>

打砖块 / 街机休闲，灵感来自《打砖块》：用会弹的彩虹棒棒糖挡板把拖着彩虹尾巴的糖豆打回去，跳跳糖连环爆炸、多球火球齐飞，8 个糖果图案关卡一路吃到生日蛋糕粉色、薄荷绿、奶油黄的糖果果冻风，Q 弹半透明软糖砖块配棉花糖云和糖果山。单个 SVG 130 KB。

<details><summary>Prompt（Agentic 生成）</summary>

```text
你负责独立完成一款浏览器小游戏《糖果砖块 CANDY BREAKER》：糖果果冻风的打砖块，玩法借鉴《打砖块》，角色、名字和美术全部原创。

【交付】
- 只交付一个自包含文件 candy-breaker.svg，根元素为 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">，窗口缩放时 16:9 画面完整居中。
- 画面、界面、游戏逻辑（内联脚本）和音效全部写在这一个文件里，不引用任何外部图片、字体、脚本或网络资源，浏览器直接打开就能玩。文件必须是合法的 UTF-8 XML。
- 界面文字用中文，标题配英文副标题。音效和背景音乐用 Web Audio 实时合成，第一次按键或点击后开始发声，M 键静音。
- 只借鉴玩法，不使用原作的角色、名字或标志性素材。

【玩法】
- 用挡板把小球弹回去，打碎所有可破坏的砖块就过关；小球碰到挡板的位置决定反弹角度，越靠边角度越斜。
- 砖块种类：普通糖块（1 击）；硬糖（2～3 击，每挨一下出现更深的裂纹）；巧克力块（打不碎）；跳跳糖（打碎时炸掉周围一圈）；礼物糖（打碎后掉落道具）。
- 好道具：加长挡板、多球（分裂成 3 个）、慢速、激光（挡板 8 秒内可发射激光）、黏球（接住球再发射）、火球（穿透砖块）；坏道具：缩短挡板、加速。道具从砖块位置落下，用挡板接住才生效。
- 共 8 关，每关砖块排成不同图案（爱心、城堡、棒棒糖、汉堡、小熊……），第 4 关和第 8 关有左右移动的砖块。
- 3 条命，漏球扣命；不碰挡板连续打碎砖块形成连击，连击越高分数倍率越高。
- 难度：简单（球慢、挡板长）、普通、困难（球快、坏道具更多）；用 localStorage 记录最高分。

【操作】← → / A D 或鼠标移动挡板；空格 / 鼠标点击 发射小球或激光；P 暂停，H 帮助，M 静音。

【画面】
- 糖果果冻风：粉色、薄荷绿、奶油黄为主的柔和配色；砖块是带高光、半透明的糖块和果冻，被击中时 Q 弹形变，碎掉时迸出糖粒碎屑。
- 背景是缓慢漂浮的棉花糖云和糖果山；挡板是一根有弹性的彩色棒棒糖；小球是一颗会拖出彩虹尾迹的糖豆。
- HUD 显示分数、关卡、剩余命数、连击数和当前道具倒计时。

【流程与界面】
- 标题页：难度选择、开始、帮助、最高分，背景里有自动演示的打砖块画面。
- 帮助页：操作说明，以及砖块和道具的图示。
- 每关开始显示关卡名；暂停菜单有继续、重新开始、返回标题；过关结算显示连击奖励和剩余时间奖励；8 关全通显示结局，命用完显示游戏结束，都可以再来一局。

【验收】
在无头 Chrome 里自动试玩：从标题页开局并实际操作一局。要求 0 个 JS 报错、0 个 XML 解析错误、帧率不低于 55 fps；在 1280×720 和 1920×1080 两种分辨率下截图，确认画面完整、文字不溢出。
```

</details>

#### Case 8: [漫画星舰 COMIC STARFIGHTER](https://openvglab.github.io/awesome-opus5.5-frontend-showcases/svg/comic-starfighter.svg)

**来源：** 本仓库原创 · Claude Opus 5.5 · [`svg/comic-starfighter.svg`](svg/comic-starfighter.svg)

**发布：** 2026-09-24

<p align="center"><img src="svg/thumbs/comic-starfighter-title.jpg" alt="漫画星舰 COMIC STARFIGHTER" width="720" /></p>

竖版弹幕射击，灵感来自《雷电》：漫画分格侧栏里的驾驶员会随战况变脸，擦弹蓄满能量后一发「星爆光束」贯穿三段式 Boss 弹幕美式漫画：粗黑描边、网点纹理、高饱和平涂，爆炸配 BOOM!/ZAP!/POW! 拟声字。单个 SVG 139 KB。

<details><summary>Prompt（Agentic 生成）</summary>

```text
你负责独立完成一款浏览器小游戏《漫画星舰 COMIC STARFIGHTER》：美式漫画风的竖版弹幕射击，玩法借鉴《雷电》，角色、名字和美术全部原创。

【交付】
- 只交付一个自包含文件 comic-starfighter.svg，根元素为 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">，窗口缩放时 16:9 画面完整居中。
- 画面、界面、游戏逻辑（内联脚本）和音效全部写在这一个文件里，不引用任何外部图片、字体、脚本或网络资源，浏览器直接打开就能玩。文件必须是合法的 UTF-8 XML。
- 界面文字用中文，标题配英文副标题。音效和背景音乐用 Web Audio 实时合成，第一次按键或点击后开始发声，M 键静音。
- 只借鉴玩法，不使用原作的角色、名字或标志性素材。

【玩法】
- 画面中间是一条纵向战场（约 560×720），左右两侧是漫画分格的侧栏；玩家战机在战场里移动射击，敌机成队列从上方飞入，沿轨迹俯冲并发射子弹。
- 武器升级：拾取 P 提升主炮等级（单发 → 双发 → 散射 → 激光），拾取 B 获得一颗炸弹（清屏并短暂无敌），拾取盾牌获得一次护盾。
- 3 个关卡：城市上空、陨石带、敌方母舰；每关结尾有 Boss 战，Boss 有多阶段弹幕和血条。
- 擦弹（子弹贴身擦过）会积累能量，能量满可以放一次必杀。
- 3 条命；难度：简单（弹幕稀疏、判定点小）、普通、困难（弹幕更密、敌人更耐打）；用 localStorage 记录最高分。

【操作】方向键 / WASD 移动；Z / 空格 射击（按住连发）；X 放炸弹；C 放必杀；Shift 低速精确移动并显示判定点；P 暂停，H 帮助，M 静音。

【画面】
- 美式漫画风：粗黑描边、网点纹理、平涂高饱和配色；爆炸是星形爆炸图案配“BOOM!”“ZAP!”“POW!”拟声字。
- 侧栏像漫画分格：显示分数、剩余命数、炸弹数、武器等级、必杀能量和驾驶员头像，头像在受伤时表情会变。
- Boss 登场前有漫画分镜式的警告画面；每关背景有不同的卷轴场景（城市楼顶、陨石、母舰甲板）。

【流程与界面】
- 标题页：难度、开始、帮助、最高分，标题做成漫画封面的样子。
- 帮助页：操作和道具说明。
- 每关开场有标题分格；暂停菜单有继续、重新开始、返回标题；过关结算显示击坠率、擦弹次数和无伤奖励；通关结局和游戏结束页都可以再来一局。

【验收】
在无头 Chrome 里自动试玩：从标题页开局并实际操作一局。要求 0 个 JS 报错、0 个 XML 解析错误、帧率不低于 55 fps；在 1280×720 和 1920×1080 两种分辨率下截图，确认画面完整、文字不溢出。
```

</details>

### 社区作品

| 作品 | 来源 | 日期 | 简介 |
| --- | --- | --- | --- |
| [穿越火线「运输船」地图复刻](https://x.com/alin_zone/status/2102713879986131252) | [阿蔺A-Lin (@alin_zone)](https://x.com/alin_zone) | 2026-09-23 | Opus 5.5 复刻的经典 FPS 地图「运输船」，浏览器里直接打开就能看：[在线体验](https://claude-opus-5-5-cf-transport-ship.pages.dev/)。 |
| [霓虹街机厅：3 台弹珠台](https://x.com/haruka_apps/status/2102703140080673090) | [haruka_apps (@haruka_apps)](https://x.com/haruka_apps) | 2026-09-23 | 用 Opus 5.5 做的游戏厅，可以玩 3 台弹珠台（仅 PC 版）：[itch.io 试玩](https://haruka-apps-games.itch.io/neon-arcade-pinball-game-center-nova)。 |
| [一条标准 prompt 做出的 FPS](https://x.com/superalesha/status/2102689172955783211) | [Alexey Fateev (@superalesha)](https://x.com/superalesha) | 2026-09-23 | 用给其他模型测试时的同一条射击游戏 prompt，一次生成、不追问；作者认为这是所有模型里做得最好的 FPS，试玩链接在帖子回复里。 |
| [手绘风国际象棋](https://x.com/higgsfield_ai/status/2102534514228822197) | [Higgsfield AI (@higgsfield_ai)](https://x.com/higgsfield_ai) | 2026-09-23 | 手绘质感的国际象棋，带走法分析。 |
| [Halo 风格的纯代码 FPS](https://x.com/strawhatsu4/status/2102531820260819133) | [Hunter Su (@strawhatsu4)](https://x.com/strawhatsu4) | 2026-09-23 | 画面、物理、玩法和声音全部由代码实时生成，约 76 KB JavaScript；作者说用 GPT-6 Astra 没能做出接近的效果。 |
| [Introducing Claude Opus 5.5](https://www.anthropic.com/claude-opus-5-5) | Anthropic 官方公告 | 2026-09-22 | 有测试者让多个 Claude 模型各用一句提示词做一个游戏，Opus 5.5 凭画面和完成度得分最高。 |
| [一句话做高尔夫游戏](https://every.to/vibe-check/vibe-check-opus-5-5-is-pulling-our-codex-converts-back-to-claude) | Every · Vibe Check | — | 只给一句“做个高尔夫游戏”，Opus 5.5 自己组了代理团队：三个设计师出球洞、三个评委打分、一个架构师拆分实现，连续跑了 1 小时 52 分钟。 |

## 🦩 鹈鹕骑自行车

Simon Willison 发起的经典测试：只给一句 `Generate an SVG of a pelican riding a bicycle`，不许看渲染结果，车架怎么连、脚怎么踩踏板全靠模型“脑补”坐标。

#### Case 1: [鹈鹕骑自行车（静态版） · Opus 5.5 默认档](https://openvglab.github.io/awesome-opus5.5-frontend-showcases/svg/rolls/pelican/opus55-default/pelican-static.svg)

**来源：** 本仓库原创 · Claude Opus 5.5 · [`svg/rolls/pelican/opus55-default/pelican-static.svg`](svg/rolls/pelican/opus55-default/pelican-static.svg)

**发布：** 2026-09-24

<p align="center"><img src="svg/rolls/pelican/opus55-default/pelican-static.svg" alt="鹈鹕骑自行车（静态版） · Opus 5.5 默认档" width="480" /></p>

晴空艳阳下的公路上，一只白鹈鹕叼着橙色大喙囊坐在红色自行车上，翅膀握住车把、橙色蹼脚踩着踏板，身后拖着几道速度线。（盲画一次成稿）

<details><summary>Prompt</summary>

```text
Generate an SVG of a pelican riding a bicycle
```

</details>

#### Case 2: [鹈鹕骑自行车（动画版） · Opus 5.5 默认档](https://openvglab.github.io/awesome-opus5.5-frontend-showcases/svg/rolls/pelican/opus55-default/pelican-animated.svg)

**来源：** 本仓库原创 · Claude Opus 5.5 · [`svg/rolls/pelican/opus55-default/pelican-animated.svg`](svg/rolls/pelican/opus55-default/pelican-animated.svg)

**发布：** 2026-09-24

<p align="center"><img src="svg/rolls/pelican/opus55-default/pelican-animated.svg" alt="鹈鹕骑自行车（动画版） · Opus 5.5 默认档" width="480" /></p>

黄昏里系着红围巾的褐鹈鹕蹬着青绿色自行车：车轮与曲柄转动、双腿随踏板往复、身体随蹬踏起伏，围巾飘动、喉囊晃荡、偶尔眨眼，车筐里的鱼摆尾，远山、丘陵和路面分层视差滚动（纯 SMIL，无 JS）。（盲画一次成稿）

<details><summary>Prompt</summary>

```text
Generate an animated SVG of a pelican riding a bicycle
```

</details>

#### Case 3: [鹈鹕骑自行车（静态版） · Opus 5.5 max 档](https://openvglab.github.io/awesome-opus5.5-frontend-showcases/svg/rolls/pelican/opus55-max/pelican-static.svg)

**来源：** 本仓库原创 · Claude Opus 5.5 · [`svg/rolls/pelican/opus55-max/pelican-static.svg`](svg/rolls/pelican/opus55-max/pelican-static.svg)

**发布：** 2026-09-24

<p align="center"><img src="svg/rolls/pelican/opus55-max/pelican-static.svg" alt="鹈鹕骑自行车（静态版） · Opus 5.5 max 档" width="480" /></p>

晴空艳阳下的公路上，一只白鹈鹕叼着橙色大喙囊坐在红色自行车上，翅膀握住车把、橙色蹼脚踩着踏板，身后拖着几道速度线。（盲画一次成稿）

<details><summary>Prompt</summary>

```text
Generate an SVG of a pelican riding a bicycle
```

</details>

#### Case 4: [鹈鹕骑自行车（动画版） · Opus 5.5 max 档](https://openvglab.github.io/awesome-opus5.5-frontend-showcases/svg/rolls/pelican/opus55-max/pelican-animated.svg)

**来源：** 本仓库原创 · Claude Opus 5.5 · [`svg/rolls/pelican/opus55-max/pelican-animated.svg`](svg/rolls/pelican/opus55-max/pelican-animated.svg)

**发布：** 2026-09-24

<p align="center"><img src="svg/rolls/pelican/opus55-max/pelican-animated.svg" alt="鹈鹕骑自行车（动画版） · Opus 5.5 max 档" width="480" /></p>

黄昏里系着红围巾的褐鹈鹕蹬着青绿色自行车：车轮与曲柄转动、双腿随踏板往复、身体随蹬踏起伏，围巾飘动、喉囊晃荡、偶尔眨眼，车筐里的鱼摆尾，远山、丘陵和路面分层视差滚动（纯 SMIL，无 JS）。（盲画一次成稿）

<details><summary>Prompt</summary>

```text
Generate an animated SVG of a pelican riding a bicycle
```

</details>

### 社区作品

| 作品 | 来源 | 日期 | 简介 |
| --- | --- | --- | --- |
| [电影运镜的鹈鹕骑自行车](https://x.com/alin_zone/status/2102608618751508947) | [阿蔺A-Lin (@alin_zone)](https://x.com/alin_zone) | 2026-09-23 | 作者称 Opus 5.5 做的鹈鹕骑自行车用上了电影运镜，“说这是游戏都信”；帖子里附了在线链接。 |
| [Claude Opus 5.5, GPT-6 Sol, GPT-6 Luna, and a new price war](https://simonwillison.net/2026/Sep/22/opus-and-sol-and-luna/) | [Simon Willison (@simonw)](https://x.com/simonw) | 2026-09-22 | Opus 5.5 在 low / medium / high / xhigh 四档都画出了结构正确的车架；max 档两次都把 128K 输出 token 全部用在思考上、没有交出 SVG，这是这个测试第一次出现这种情况。它的思考第一句是 “This is a classic test request”。 |
| [Claude 鹈鹕对比网格](https://static.simonwillison.net/static/2026/claude-pelicans-grid.html) | [Simon Willison (@simonw)](https://x.com/simonw) | 2026-09-22 | Fable 5.1 / Opus 5.5 / Opus 5 / Sonnet 5 × 五档思考强度，附每张图的 token 数与成本。 |

**延伸阅读**

- [Hacker News：Claude Opus 5.5 发布讨论](https://news.ycombinator.com/item?id=49803892) — Simon 在帖中贴出四档鹈鹕；有评论指出只有 xhigh 那只的两条腿真正分在车架两侧。
- [Hacker News：Opus 5.5 Intelligence, Performance and Price Analysis (Max)](https://news.ycombinator.com/item?id=49804316) — 关于 max 档“想太多”的讨论。
- [simonw/pelican-bicycle](https://github.com/simonw/pelican-bicycle) — 测试出处与早期各模型结果。
- [OpenRouter Sketch Benchmarks: Pelican on a bike](https://openrouter.ai/benchmarks/media/sketch/pelican-on-a-bike) — 多模型鹈鹕榜单。
- [JoJohanse/pelican-bicycle-benchmark](https://github.com/JoJohanse/pelican-bicycle-benchmark) — 中文维护、按厂商和模型整理的持续更新评测。
- [Pelicans on Bicycles: One Silly Benchmark, Sixty-Three Answers](https://nathanfennel.com/blog/pelicans-on-bicycles)（Nathan Fennel）— 在 Claude Code、Codex、Cursor 等真实编码工具里跑出的 63 张鹈鹕。
- [PromptFrenzy: Pelican on a Bicycle](https://www.promptfrenzy.com/showdown/svg-pelican) — 静态图和纯 SVG 动画两轮对比。

## 🚲 更多骑行系列

把鹈鹕和自行车换成别的动物和交通工具，规则相同：一句 prompt，盲画一次成稿。

#### Case 1: [熊猫骑电动车送外卖](https://openvglab.github.io/awesome-opus5.5-frontend-showcases/svg/rolls/riding/panda-scooter.svg)

**来源：** 本仓库原创 · Claude Opus 5.5 · [`svg/rolls/riding/panda-scooter.svg`](svg/rolls/riding/panda-scooter.svg)

**发布：** 2026-09-24

<p align="center"><img src="svg/rolls/riding/panda-scooter.svg" alt="熊猫骑电动车送外卖" width="480" /></p>

戴黄色头盔的熊猫骑着红色踏板车穿过城市街道，后座黄色外卖箱冒着热气；车轮转动、车身随减震轻颠、蓝围巾飘动，楼群、行道树和车道线分层向后滚动。（盲画一次成稿）

<details><summary>Prompt</summary>

```text
Generate an animated SVG of a panda riding a scooter to deliver food
```

</details>

#### Case 2: [企鹅踩滑板](https://openvglab.github.io/awesome-opus5.5-frontend-showcases/svg/rolls/riding/penguin-skateboard.svg)

**来源：** 本仓库原创 · Claude Opus 5.5 · [`svg/rolls/riding/penguin-skateboard.svg`](svg/rolls/riding/penguin-skateboard.svg)

**发布：** 2026-09-24

<p align="center"><img src="svg/rolls/riding/penguin-skateboard.svg" alt="企鹅踩滑板" width="480" /></p>

戴红色毛线帽、围青绿围巾的企鹅在极光下的冰道上滑行，张开鳍翅保持平衡；滑轮飞转，每隔几秒跳一次带倾斜的 ollie，冰山、雪堆与飘雪分层掠过。（盲画一次成稿）

<details><summary>Prompt</summary>

```text
Generate an animated SVG of a penguin riding a skateboard
```

</details>

#### Case 3: [章鱼骑独轮车杂耍](https://openvglab.github.io/awesome-opus5.5-frontend-showcases/svg/rolls/riding/octopus-unicycle.svg)

**来源：** 本仓库原创 · Claude Opus 5.5 · [`svg/rolls/riding/octopus-unicycle.svg`](svg/rolls/riding/octopus-unicycle.svg)

**发布：** 2026-09-24

<p align="center"><img src="svg/rolls/riding/octopus-unicycle.svg" alt="章鱼骑独轮车杂耍" width="480" /></p>

马戏团聚光灯下，系领结的粉色章鱼骑独轮车前后摇摆保持平衡，两条触手踩着随车轮转动的踏板，另两条触手抛接三只彩球，眼珠跟着球转，彩纸纷飞。（盲画一次成稿）

<details><summary>Prompt</summary>

```text
Generate an animated SVG of an octopus riding a unicycle while juggling
```

</details>

#### Case 4: [橘猫骑摩托](https://openvglab.github.io/awesome-opus5.5-frontend-showcases/svg/rolls/riding/cat-motorcycle.svg)

**来源：** 本仓库原创 · Claude Opus 5.5 · [`svg/rolls/riding/cat-motorcycle.svg`](svg/rolls/riding/cat-motorcycle.svg)

**发布：** 2026-09-24

<p align="center"><img src="svg/rolls/riding/cat-motorcycle.svg" alt="橘猫骑摩托" width="480" /></p>

戴护目镜、系红头巾的橘猫骑着青蓝色巡航摩托驶过黄昏沙漠公路，条纹尾巴和头巾迎风飘动；辐条轮飞转、车身随引擎震动、排气冒烟，条纹夕阳前的台地、仙人掌和风滚草依次掠过。（盲画一次成稿）

<details><summary>Prompt</summary>

```text
Generate an animated SVG of a cat riding a motorcycle
```

</details>

#### Case 5: [柯基与鸭子骑双人自行车](https://openvglab.github.io/awesome-opus5.5-frontend-showcases/svg/rolls/riding/corgi-duck-tandem.svg)

**来源：** 本仓库原创 · Claude Opus 5.5 · [`svg/rolls/riding/corgi-duck-tandem.svg`](svg/rolls/riding/corgi-duck-tandem.svg)

**发布：** 2026-09-24

<p align="center"><img src="svg/rolls/riding/corgi-duck-tandem.svg" alt="柯基与鸭子骑双人自行车" width="480" /></p>

柯基在前面掌把、吐着舌头，戴水手帽的鸭子在后座一翅扶把一翅挥手；两组曲柄同步转动、腿脚跟着踏板画圈、链条滚动，风车、栅栏与野花沿乡间小路向后流过，小爱心缓缓升起。（盲画一次成稿）

<details><summary>Prompt</summary>

```text
Generate an animated SVG of a corgi and a duck riding a tandem bicycle
```

</details>

#### Case 6: [乌龟骑火箭](https://openvglab.github.io/awesome-opus5.5-frontend-showcases/svg/rolls/riding/turtle-rocket.svg)

**来源：** 本仓库原创 · Claude Opus 5.5 · [`svg/rolls/riding/turtle-rocket.svg`](svg/rolls/riding/turtle-rocket.svg)

**发布：** 2026-09-24

<p align="center"><img src="svg/rolls/riding/turtle-rocket.svg" alt="乌龟骑火箭" width="480" /></p>

戴泡泡头盔、系黄围巾的乌龟骑在红白复古火箭上，一只前肢拉缰绳、一只挥舞；尾焰闪烁、烟团拖尾、火箭轻轻起伏，星空三层视差掠过，还有环状行星、流星和出发的蓝色星球。（盲画一次成稿）

<details><summary>Prompt</summary>

```text
Generate an animated SVG of a turtle riding a rocket
```

</details>

#### Case 7: [刺猬骑三轮车](https://openvglab.github.io/awesome-opus5.5-frontend-showcases/svg/rolls/riding/hedgehog-tricycle.svg)

**来源：** 本仓库原创 · Claude Opus 5.5 · [`svg/rolls/riding/hedgehog-tricycle.svg`](svg/rolls/riding/hedgehog-tricycle.svg)

**发布：** 2026-09-24

<p align="center"><img src="svg/rolls/riding/hedgehog-tricycle.svg" alt="刺猬骑三轮车" width="480" /></p>

背刺上插着苹果和枫叶的刺猬穿红色小球鞋，蹬着青绿色儿童三轮车的前轮脚踏在秋日公园小路上前进；前后轮各自转动、车把彩带飘舞，长椅、路灯和秋色树林后退，落叶打着旋飘下。（盲画一次成稿）

<details><summary>Prompt</summary>

```text
Generate an animated SVG of a hedgehog riding a tricycle
```

</details>

#### Case 8: [青蛙骑蜗牛](https://openvglab.github.io/awesome-opus5.5-frontend-showcases/svg/rolls/riding/frog-snail.svg)

**来源：** 本仓库原创 · Claude Opus 5.5 · [`svg/rolls/riding/frog-snail.svg`](svg/rolls/riding/frog-snail.svg)

**发布：** 2026-09-24

<p align="center"><img src="svg/rolls/riding/frog-snail.svg" alt="青蛙骑蜗牛" width="480" /></p>

青蛙坐在蜗牛壳顶的小鞍毯上挥手，用树枝吊着一片生菜悬在蜗牛眼前；蜗牛一伸一缩、腹足波动地慢慢追赶，生菜来回晃荡，黏液痕闪着光，蘑菇林背景缓缓后移，萤火虫飘浮。（盲画一次成稿）

<details><summary>Prompt</summary>

```text
Generate an animated SVG of a frog riding a snail
```

</details>

### 社区作品

| 作品 | 来源 | 日期 | 简介 |
| --- | --- | --- | --- |
| [熊猫骑车送外卖](https://www.woshipm.com/evaluating/6469164.html) | 人人都是产品经理 · Opus 5.5 与 GPT-6 Sol 首发实测 | — | 把鹈鹕换成“熊猫骑车送外卖”：Opus 5.5 画出了牙盘、链条和踏板，还加了奶茶、车灯和“叮咚～外卖到啦！”气泡，轮子和链条是会转的动画 SVG。 |

## ✨ SVG 动画与插画

只用 SVG 自带的 SMIL / CSS 动画，不写 JavaScript，放进 `<img>` 也能动。

#### Case 1: [海边灯塔的日落](https://openvglab.github.io/awesome-opus5.5-frontend-showcases/svg/rolls/svg-anim/lighthouse-sunset.svg)

**来源：** 本仓库原创 · Claude Opus 5.5 · [`svg/rolls/svg-anim/lighthouse-sunset.svg`](svg/rolls/svg-anim/lighthouse-sunset.svg)

**发布：** 2026-09-24

<p align="center"><img src="svg/rolls/svg-anim/lighthouse-sunset.svg" alt="海边灯塔的日落" width="480" /></p>

暖橙到紫蓝的天空下，夕阳从云底探出、压扁着沉入海平线，天色转入暮色、星星浮现；十一层海浪分层起伏，灯塔光束左右摆扫并在海面投下碎光，海鸥在远处绕圈，20 秒后太阳从云后再次探出，无缝衔接。（可渲染自检）

<details><summary>Prompt</summary>

```text
夕阳缓缓落下，海浪一层层起伏，灯塔的光束来回扫过海面，海鸥在远处盘旋；天空是暖橙到紫蓝的渐变；20 秒无缝循环。交付一个自包含的 .svg 文件：根元素 viewBox="0 0 1280 720"，width="100%" height="100%"，preserveAspectRatio="xMidYMid meet"；只用 SMIL 或 CSS 动画，不用 JavaScript，放进 <img> 标签也能动；动画无缝循环；不引用任何外部图片、字体或网络资源；文件不超过 200 KB；必须是合法的 UTF-8 XML。
```

</details>

#### Case 2: [机械钟的齿轮](https://openvglab.github.io/awesome-opus5.5-frontend-showcases/svg/rolls/svg-anim/clockwork.svg)

**来源：** 本仓库原创 · Claude Opus 5.5 · [`svg/rolls/svg-anim/clockwork.svg`](svg/rolls/svg-anim/clockwork.svg)

**发布：** 2026-09-24

<p align="center"><img src="svg/rolls/svg-anim/clockwork.svg" alt="机械钟的齿轮" width="480" /></p>

后盖向左翻开的黄铜镂空怀表：发条盒→中心轮→三轮→四轮→擒纵轮按 2:1/2.5:1 啮合、相邻反转且齿多者慢，全轮系随擒纵每 0.5 秒同步跳一格，摆轮带游丝呼吸式往复摆动，擒纵叉左右拨动，宝玑蓝钢指针走时，表壳与后盖上周期性掠过金属高光。（可渲染自检）

<details><summary>Prompt</summary>

```text
一只打开后盖的机械怀表：大小齿轮按正确的传动比联动旋转（相互啮合的齿轮转向相反、齿数多的转得慢），擒纵轮一跳一跳，摆轮来回摆动，表盘指针走动；黄铜与深蓝配色，带金属高光。交付一个自包含的 .svg 文件：根元素 viewBox="0 0 1280 720"，width="100%" height="100%"，preserveAspectRatio="xMidYMid meet"；只用 SMIL 或 CSS 动画，不用 JavaScript，放进 <img> 标签也能动；动画无缝循环；不引用任何外部图片、字体或网络资源；文件不超过 200 KB；必须是合法的 UTF-8 XML。
```

</details>

#### Case 3: [太阳系](https://openvglab.github.io/awesome-opus5.5-frontend-showcases/svg/rolls/svg-anim/solar-system.svg)

**来源：** 本仓库原创 · Claude Opus 5.5 · [`svg/rolls/svg-anim/solar-system.svg`](svg/rolls/svg-anim/solar-system.svg)

**发布：** 2026-09-24

<p align="center"><img src="svg/rolls/svg-anim/solar-system.svg" alt="太阳系" width="480" /></p>

倾斜视角的太阳系：光芒四射的太阳呼吸般脉动，八大行星以 4～480 秒的周期（由内到外递增）沿椭圆轨道匀角速公转并拖着淡尾迹，明暗交界线始终背向太阳，水星会绕到太阳背后，月球绕地球进出前后，土星带前后分层的环，银河与星空闪烁，每颗行星旁有中文小字。（可渲染自检）

<details><summary>Prompt</summary>

```text
太阳居中发光并缓慢脉动，八大行星沿椭圆轨道以不同周期公转（内圈快、外圈慢，比例大致合理），土星带环，月球绕地球转，背景星空闪烁；每颗行星旁边有小小的中文名字。交付一个自包含的 .svg 文件：根元素 viewBox="0 0 1280 720"，width="100%" height="100%"，preserveAspectRatio="xMidYMid meet"；只用 SMIL 或 CSS 动画，不用 JavaScript，放进 <img> 标签也能动；动画无缝循环；不引用任何外部图片、字体或网络资源；文件不超过 200 KB；必须是合法的 UTF-8 XML。
```

</details>

#### Case 4: [雨夜的城市窗景](https://openvglab.github.io/awesome-opus5.5-frontend-showcases/svg/rolls/svg-anim/rainy-city.svg)

**来源：** 本仓库原创 · Claude Opus 5.5 · [`svg/rolls/svg-anim/rainy-city.svg`](svg/rolls/svg-anim/rainy-city.svg)

**发布：** 2026-09-24

<p align="center"><img src="svg/rolls/svg-anim/rainy-city.svg" alt="雨夜的城市窗景" width="480" /></p>

冷蓝与霓虹粉的雨夜窗景：窗外楼群灯火与“拉面/BAR/HOTEL”、爱心、跑马灯等霓虹各自闪烁，两条车道的车流带着车灯和湿地倒影往返流动，路灯光锥里雨丝更亮；玻璃上水珠停停走走地滑落并留下渐隐的水痕，窗台上的白瓷热茶升起缭绕热气，24 秒无缝循环。（可渲染自检）

<details><summary>Prompt</summary>

```text
从室内窗户看出去的雨夜城市：雨滴沿玻璃滑落并留下水痕，远处霓虹招牌闪烁，车灯在街上流动，窗台上一杯热茶冒着热气；冷蓝与霓虹粉配色。交付一个自包含的 .svg 文件：根元素 viewBox="0 0 1280 720"，width="100%" height="100%"，preserveAspectRatio="xMidYMid meet"；只用 SMIL 或 CSS 动画，不用 JavaScript，放进 <img> 标签也能动；动画无缝循环；不引用任何外部图片、字体或网络资源；文件不超过 200 KB；必须是合法的 UTF-8 XML。
```

</details>

#### Case 5: [一颗种子开花](https://openvglab.github.io/awesome-opus5.5-frontend-showcases/svg/rolls/svg-anim/seed-to-bloom.svg)

**来源：** 本仓库原创 · Claude Opus 5.5 · [`svg/rolls/svg-anim/seed-to-bloom.svg`](svg/rolls/svg-anim/seed-to-bloom.svg)

**发布：** 2026-09-24

<p align="center"><img src="svg/rolls/svg-anim/seed-to-bloom.svg" alt="一颗种子开花" width="480" /></p>

水彩纸上的 16 秒生命循环：土中剖面的种子膨胀裂开、生根，嫩芽顶破土壤，茎叶逐节长出、结苞后粉色花瓣层层绽放，蓝蝴蝶飞来停在花上轻扇翅膀又飞走，随后花瓣一片片旋转飘落、植株枯黄淡去，花心落下一粒种子沉回土里，回到开头。（可渲染自检）

<details><summary>Prompt</summary>

```text
土里的种子发芽、抽茎、长叶、结花苞、绽放，一只蝴蝶飞来停留，然后花瓣飘落、画面回到种子，16 秒一个循环；水彩纸质感。交付一个自包含的 .svg 文件：根元素 viewBox="0 0 1280 720"，width="100%" height="100%"，preserveAspectRatio="xMidYMid meet"；只用 SMIL 或 CSS 动画，不用 JavaScript，放进 <img> 标签也能动；动画无缝循环；不引用任何外部图片、字体或网络资源；文件不超过 200 KB；必须是合法的 UTF-8 XML。
```

</details>

### 社区作品

| 作品 | 来源 | 日期 | 简介 |
| --- | --- | --- | --- |
| [纽约天际线：同一条 prompt 的一年对比](https://x.com/chetaslua/status/2102678371281018916) | [Chetaslua (@chetaslua)](https://x.com/chetaslua) | 2026-09-23 | 同一条 prompt（“SVG of NEW YORK SKYLINE … make sure I can paste it all into a single HTML file …”），把一年前 Gemini 3.0 Pro 的结果和今天 Opus 5.5 的结果放在一起对比。 |
| [一次成型的 3 分钟 SVG 动画](https://x.com/AndrewOnXYZ/status/2102089270747886043) | [AndrewOnXYZ (@AndrewOnXYZ)](https://x.com/AndrewOnXYZ) | 2026-09-21 | 发布于正式上线前一天；Reddit r/singularity 以 “Impressive SVG animation made by Opus 5.5 (zero shot)” 转发。 |

## 🎞️ Lottie 动画

Bodymovin JSON，用 lottie-web 播放；只用形状图层，不用图片和字体。

#### Case 1: [加载动画](https://openvglab.github.io/awesome-opus5.5-frontend-showcases/lottie/)

**来源：** 本仓库原创 · Claude Opus 5.5 · [`lottie/rolls/lottie/loading-morph.json`](lottie/rolls/lottie/loading-morph.json)

**发布：** 2026-09-24

<p align="center"><img src="lottie/rolls/lottie/loading-morph.gif" alt="加载动画" width="360" /></p>

珊瑚粉、琥珀黄、天蓝三个圆点带挤压拉伸依次弹跳，随后跃入环位、拖出尾迹拉长成三段彩色圆弧组成的旋转圆环，减速收拢回圆点后弹起落回一排。（可渲染自检）

<details><summary>Prompt</summary>

```text
三个彩色圆点依次弹跳，然后变形为一个旋转的圆环，再散开回到三个圆点。交付一个 Lottie JSON（Bodymovin 5.7 格式，能被 lottie-web 5.13 的 SVG 渲染器正常播放）：画布 512×512，60 fps，2–4 秒无缝循环；只用形状图层（不用图片、字体、文字图层，不用表达式）；文件不超过 120 KB；配色明快、动作有缓动和弹性，不要生硬的线性运动。
```

</details>

#### Case 2: [天气图标](https://openvglab.github.io/awesome-opus5.5-frontend-showcases/lottie/)

**来源：** 本仓库原创 · Claude Opus 5.5 · [`lottie/rolls/lottie/weather-cycle.json`](lottie/rolls/lottie/weather-cycle.json)

**发布：** 2026-09-24

<p align="center"><img src="lottie/rolls/lottie/weather-cycle.gif" alt="天气图标" width="360" /></p>

晴空下光芒旋转的太阳被飘来的双色白云遮住，天色和云一起变灰并落下蓝色雨滴，雨停后云变白、中间一团先“啵”地消失、两侧分散淡出，太阳弹性跃回并依次伸出光芒、闪出小星光。（可渲染自检）

<details><summary>Prompt</summary>

```text
太阳被飘来的云遮住，开始下雨，雨停后云散去、太阳重新出现。交付一个 Lottie JSON（Bodymovin 5.7 格式，能被 lottie-web 5.13 的 SVG 渲染器正常播放）：画布 512×512，60 fps，2–4 秒无缝循环；只用形状图层（不用图片、字体、文字图层，不用表达式）；文件不超过 120 KB；配色明快、动作有缓动和弹性，不要生硬的线性运动。
```

</details>

#### Case 3: [点赞](https://openvglab.github.io/awesome-opus5.5-frontend-showcases/lottie/)

**来源：** 本仓库原创 · Claude Opus 5.5 · [`lottie/rolls/lottie/like-burst.json`](lottie/rolls/lottie/like-burst.json)

**发布：** 2026-09-24

<p align="center"><img src="lottie/rolls/lottie/like-burst.gif" alt="点赞" width="360" /></p>

灰紫描边爱心先蓄力压扁，再弹性放大、红色从中心填满，伴随一圈冲击波、八组彩色粒子和旋转小星星迸出，心跳两下后红色缩回、描边变回灰色。（可渲染自检）

<details><summary>Prompt</summary>

```text
爱心从描边状态弹性放大并填充成红色，周围迸出一圈彩色粒子和小星星，然后回到初始状态。交付一个 Lottie JSON（Bodymovin 5.7 格式，能被 lottie-web 5.13 的 SVG 渲染器正常播放）：画布 512×512，60 fps，2–4 秒无缝循环；只用形状图层（不用图片、字体、文字图层，不用表达式）；文件不超过 120 KB；配色明快、动作有缓动和弹性，不要生硬的线性运动。
```

</details>

#### Case 4: [火箭发射](https://openvglab.github.io/awesome-opus5.5-frontend-showcases/lottie/)

**来源：** 本仓库原创 · Claude Opus 5.5 · [`lottie/rolls/lottie/rocket-launch.json`](lottie/rolls/lottie/rocket-launch.json)

**发布：** 2026-09-24

<p align="center"><img src="lottie/rolls/lottie/rocket-launch.gif" alt="火箭发射" width="360" /></p>

红白卡通火箭在发射台上越抖越烈，导流槽亮起橙光并点火，三层尾焰闪烁着加速冲出画面，地面烟团向两侧翻滚、身后留下随速度拉长的烟柱并渐渐消散，新火箭从发射井升起、轻弹落定。（可渲染自检）

<details><summary>Prompt</summary>

```text
火箭轻微震动后点火，尾焰喷射，火箭向上飞出画面，底部烟雾散开，然后新的火箭从下方回到发射台，形成循环。交付一个 Lottie JSON（Bodymovin 5.7 格式，能被 lottie-web 5.13 的 SVG 渲染器正常播放）：画布 512×512，60 fps，2–4 秒无缝循环；只用形状图层（不用图片、字体、文字图层，不用表达式）；文件不超过 120 KB；配色明快、动作有缓动和弹性，不要生硬的线性运动。
```

</details>

#### Case 5: [一杯咖啡](https://openvglab.github.io/awesome-opus5.5-frontend-showcases/lottie/)

**来源：** 本仓库原创 · Claude Opus 5.5 · [`lottie/rolls/lottie/coffee-steam.json`](lottie/rolls/lottie/coffee-steam.json)

**发布：** 2026-09-24

<p align="center"><img src="lottie/rolls/lottie/coffee-steam.gif" alt="一杯咖啡" width="360" /></p>

暖橙背景里的薄荷绿咖啡杯冒出三缕向外散开、波纹不断上行并渐隐的热气，咖啡液面轻轻起伏泛出涟漪，桌上的银勺掠过一道高光并闪出星芒。（可渲染自检）

<details><summary>Prompt</summary>

```text
咖啡杯冒出三缕热气，热气蜿蜒上升并淡出，杯中液面轻微波动，杯旁的勺子反光一闪。交付一个 Lottie JSON（Bodymovin 5.7 格式，能被 lottie-web 5.13 的 SVG 渲染器正常播放）：画布 512×512，60 fps，2–4 秒无缝循环；只用形状图层（不用图片、字体、文字图层，不用表达式）；文件不超过 120 KB；配色明快、动作有缓动和弹性，不要生硬的线性运动。
```

</details>

## 🧊 3D · Three.js · WebGL

| 作品 | 来源 | 日期 | 简介 |
| --- | --- | --- | --- |
| [忘了哪边是下的路：水彩墨线 3D 音乐驾驶](https://x.com/chetanankola/status/2103001194696458512) | [Chetan Ankola (@chetanankola)](https://x.com/chetanankola) | 2026-09-24 | 作者第一个用 Opus 5.5 vibe coding 的 Three.js 3D 体验：路面 90° 折上黄墙、倒挂着跑过天花板，最后变成五线谱，在音符间转向就能弹出每条街的旋律；水彩加墨线的画风，屋顶上有台收音机。 |
| [海岛铁路《Pelagia》：Opus 5.5 对 GPT-6 Astra](https://x.com/vib3coded/status/2102672447405228135) | [Vib3Coded (@vib3coded)](https://x.com/vib3coded) | 2026-09-23 | 同一条提示词、带水下剖面的海岛铁路：Opus 5.5 花 2.65 美元做出海边小镇和醒目的红色大桥，Astra 花 8.49 美元做出热带氛围和海底隧道（均按 API 价格计）。作者此前还对比过 Opus 5 与 5.5 的火山岛，5.5 多了水下生物、猛犸象和极光。 |
| [数据中心内部的可交互 3D](https://x.com/RyanSael/status/2102740041621762166) | [Ryan Sael (@RyanSael)](https://x.com/RyanSael) | 2026-09-23 | 让 Opus 5.5 展示“它运行的楼里有什么”：让机架过载能看到 GPU 降频，再跟着热量从屋顶散出；一次生成用时 1 小时 53 分钟，API 成本 38.99 美元。[在线体验](https://datacenter.lab.sael.net) |
| [同一条提示词的 3D 景观网页：Opus 5.5 / Astra / Sol](https://x.com/alin_zone/status/2102701111090008066) | [阿蔺A-Lin (@alin_zone)](https://x.com/alin_zone) | 2026-09-23 | 用同一条提示词做实时交互的 3D 景观网页，视频依次是 Opus 5.5、GPT-6 Astra、GPT-6 Sol 的结果。 |
| [卡通生命：Opus 5.5 × Three.js](https://x.com/higgsfield_ai/status/2102618931622207535) | [Higgsfield AI (@higgsfield_ai)](https://x.com/higgsfield_ai) | 2026-09-23 | 用 Three.js 让日常物品拥有卡通生命。 |
| [交互式镜头实验室](https://x.com/RyanSael/status/2102591147927654847) | [Ryan Sael (@RyanSael)](https://x.com/RyanSael) | 2026-09-23 | 转动对焦环，能看到镜片移动、清晰的焦平面在场景里前后移动；一次生成用时 1 小时 26 分钟，API 成本 25.66 美元。[在线体验](https://lens.lab.sael.net) |
| [清明上河图、魔尺与宜家说明书](https://x.com/nicekate8888/status/2102570558760337685) | [nicekate (@nicekate8888)](https://x.com/nicekate8888) | 2026-09-23 | 只开 Medium 档：清明上河图里的码头、商铺和船工，能折出不同造型的魔尺，把宜家说明书变成分步安装演示；另测了机械蝴蝶、3D 建模和动画。 |
| [可以自由漫游的程序化无尽世界](https://x.com/argofowl/status/2102529695908806728) | [argofowl (@argofowl)](https://x.com/argofowl) | 2026-09-23 | Opus 5.5（extra high）用 Three.js 做的无尽世界，每个区域随机生成、处处有惊喜；帖子里附了完整 prompt。 |
| [体素版的自画像](https://x.com/blueemi99/status/2102511304456212763) | [bluedev (@blueemi99)](https://x.com/blueemi99) | 2026-09-23 | Claude Opus 5.5 用体素画了自己，带动画和细节。 |
| [3D 重庆城市生成器](https://www.woshipm.com/evaluating/6469164.html) | 人人都是产品经理 · Opus 5.5 与 GPT-6 Sol 首发实测 | — | 层叠立交、轻轨穿楼、依山而建的高差；另有 Opus 5.5 自主生成的 3D 网页动画《牛来骑车》。 |

## 🎬 代码逐帧动画与视频

每一帧都由代码画出来的动画，以及用它们渲染出的视频。

| 作品 | 来源 | 日期 | 简介 |
| --- | --- | --- | --- |
| [拼贴风中秋短片](https://x.com/ring_hyacinth/status/2102986085328716066) | [Ring Hyacinth (@ring_hyacinth)](https://x.com/ring_hyacinth) | 2026-09-24 | 40 秒拼贴风中秋片：动画由 Opus 5.5 用 JavaScript 逐帧画出（手绘纹理用 p5.js + p5.brush），音效由它写 Node.js 程序合成；脚本和音乐由作者提供，背景底稿和纸张材质由 Nano Banana Pro 生成。 |
| [让 Opus 5.5 自由发挥写的动画短片](https://www.xiaohongshu.com/explore/6ab45d76000000000202be26?xsec_token=CBjc6DgxV29PzCmyBsUUBA6MoDnERoYo_3i5AdRNAl2tc=&xsec_source=pc_share) | 春和景明.LinxAI（小红书） | 2026-09-24 | 48 秒竖屏短片，题材和画面全交给 Opus 5.5 自由发挥；原帖没有公开 prompt。 |
| [水循环：一镜到底的无缝循环动画](https://x.com/higgsfield_ai/status/2102781807179735211) | [Higgsfield AI (@higgsfield_ai)](https://x.com/higgsfield_ai) | 2026-09-23 | Opus 5.5 与 GPT-6 Sol 合作完成。按 brief “Create a seamless looping animation of the water cycle, entirely in code.” 用代码搭建环境、光照和角色动画，在浏览器里实时渲染、首尾无缝衔接，最后打包成带时间轴控制的单个 HTML。 |
| [人生的意义是什么？](https://x.com/HarveenChadha/status/2102759892507398309) | [Harveen Singh Chadha (@HarveenChadha)](https://x.com/HarveenChadha) | 2026-09-23 | 一次生成的纯 JavaScript 手绘拼贴风动画，脚本和配乐也由 Opus 完成；用时 16 分钟、1.9 万 tokens、3.6 美元。Prompt：“Create a pure javascript animation. 30s-60s whimsical hand drawn collage style with appropriate audio on the topic what is the purpose of life ?” |
| [水墨动画《小蝌蚪找妈妈》](https://x.com/akokoi1/status/2102699703309898026) | [WY (@akokoi1)](https://x.com/akokoi1) | 2026-09-23 | Claude Opus 5.5 纯代码生成的水墨动画。 |
| [中华上下五千年，2 分 38 秒](https://x.com/akokoi1/status/2102583898865873225) | [WY (@akokoi1)](https://x.com/akokoi1) | 2026-09-23 | 知识科普视频；作者称只用了 Max（5x）周额度的约 1%。 |
| [介绍 Opus 5.5 的 90 秒短片](https://x.com/nicekate8888/status/2102575622912631261) | [nicekate (@nicekate8888)](https://x.com/nicekate8888) | 2026-09-23 | 由 Opus 5.5 生成、介绍 Opus 5.5 自己的短片。 |
| [任意画风的可交互“视频”](https://x.com/chetaslua/status/2102501773705670994) | [Chetaslua (@chetaslua)](https://x.com/chetaslua) | 2026-09-23 | 纯 JS 编写、不用任何素材，可以切换画风：[CodePen](https://codepen.io/editor/ChetasLua/pen/01a0cadf-5b81-756f-8647-8cf5a47e7adf)。 |
| [透过 Claude 的眼睛看世界](https://x.com/devteamdrew/status/2102440077746188664) | [DreW (@devteamdrew)](https://x.com/devteamdrew) | 2026-09-23 | 定格动画风短片，作者说视频里的一切都由 Opus 5.5 创作。 |
| [What do you love?](https://x.com/kevin_t_ngo/status/2102437977435893771) | [Kevin Ngo (@kevin_t_ngo)](https://x.com/kevin_t_ngo) | 2026-09-22 | Claude Opus 5.5 用 JavaScript 画出每一帧的 28 秒动画故事：镇上所有人都给 Claude 发请求，只有一个女孩发来一个问题。 |

## 🖥️ 网页、UI 与应用

| 作品 | 来源 | 日期 | 简介 |
| --- | --- | --- | --- |
| [复刻 3DS 和它的系统界面](https://x.com/blueemi99/status/2102776877458784289) | [bluedev (@blueemi99)](https://x.com/blueemi99) | 2026-09-23 | 连系统动效和“笔”图标都做了出来。 |
| [带 iPhone mockup 动效的网页](https://x.com/anxndsgn/status/2102722134330261794) | [XIN (@anxndsgn)](https://x.com/anxndsgn) | 2026-09-23 | 网页和里面的 iPhone mockup、文件夹都由 Opus 生成；作者只描述了页面动效的大概想法，再加 2–3 轮微调。 |
| [一次生成的模型对比网站](https://x.com/chetaslua/status/2102626285868720550) | [Chetaslua (@chetaslua)](https://x.com/chetaslua) | 2026-09-23 | 只说了“画一个网站”，一次生成、细节丰富。 |
| [浏览器里的室内设计应用](https://x.com/higgsfield_ai/status/2102618445489795448) | [Higgsfield AI (@higgsfield_ai)](https://x.com/higgsfield_ai) | 2026-09-23 | Opus 5.5 做了这个应用，又用它设计了一套公寓：家具照片转成 3D 模型摆进房间，任选视角后交给 Seedream 5.0 出效果图。 |
| [Letters Abroad 语言学习应用](https://x.com/anshuc/status/2102519201554690273) | [Anshu (@anshuc)](https://x.com/anshuc) | 2026-09-23 | 和 AI 笔友互相写信、在语境中学语言，应用和官网都由 Opus 5.5 构建；作者之前用 Astra 和 Fable 做过原型，对设计不满意。[lettersabroad.app](http://lettersabroad.app) |
| [CoAnimator 动画应用](https://x.com/rege_dev/status/2102498682931441977) | [rege (@rege_dev)](https://x.com/rege_dev) | 2026-09-23 | 几轮 prompt 做出动画、时间轴、音效和环境音。 |
| [个人网站多版重设计，再剪成预告片](https://x.com/trq212/status/2102477340920152162) | [trq212 (@trq212)](https://x.com/trq212) | 2026-09-23 | 用 workflow 让 Opus 5.5 反复迭代、自我点评个人网站的多个设计方向，最后把所有迭代剪成一段预告片。 |
| [复刻网页版 Cursor](https://www.woshipm.com/evaluating/6469164.html) | 人人都是产品经理 · Opus 5.5 与 GPT-6 Sol 首发实测 | — | 在 VS Code 开源代码上复刻网页版 Cursor（Editor / Agents 双窗口）；先写一个简易画板网页，再操作浏览器花 1 小时 17 分钟画出 Q 版鲸鱼娘。 |
| [仿 Origami Studio 的交互原型工具](https://every.to/vibe-check/vibe-check-opus-5-5-is-pulling-our-codex-converts-back-to-claude) | Every · Vibe Check | — | 两句提示词做出一个仿 Meta Origami Studio 的交互原型工具，能从代码导入设计并连线交互。 |

## 📊 评测与工具

- [threejseval：Opus 5.5 High](https://threejseval.com/models/claude-opus-5-5-high) / [Opus 5.5 Medium](https://threejseval.com/models/claude-opus-5-5-medium) — Three.js 场景竞技场：埃菲尔铁塔、帆船、国际象棋、747、机械臂、猎鹰 9 号等 14 道题的实时场景、Elo 与单题成本（写作本文时 Medium 档的平均 Elo 略高于 High 档）。
- [Tripo 的 Opus 5.5 3D prompt 库](https://x.com/tripoai/status/2102680029943791765) — 400 多条测试过的 3D prompt，可以并排对比输出：[tripo3d.ai/3d-prompts](http://tripo3d.ai/3d-prompts)。
- [`tools/check_game.js`](tools/check_game.js) — 本仓库验收用的无头 Chrome 脚本：按脚本模拟按键、截图、测帧率，并检查 JS 报错、XML 解析错误和文件里的坏字节。
- [hand-drawn-canvas-animation](https://github.com/alesha-pro/tools/tree/main/skills/hand-drawn-canvas-animation) — 有人逐帧拆解 Kevin Ngo 的 Claude 手绘短片后整理出的开源（MIT）Canvas 动画引擎与工作流。
- [markdown-svg-renderer](https://tools.simonwillison.net/markdown-svg-renderer) — 把模型回复里的 SVG 直接渲染出来。
- [llm](https://llm.datasette.io/) + [llm-anthropic](https://github.com/simonw/llm-anthropic) — 命令行复现鹈鹕测试：`llm -m claude-opus-5.5 -o thinking_effort low "Generate an SVG of a pelican riding a bicycle"`

## 收录标准与贡献

- 作品需由 Claude Opus 5.5 生成，成品是在浏览器里运行的前端产物（HTML / CSS / JS、SVG、Canvas、WebGL、Lottie 等，也包括用它们渲染出的视频）。
- 优先收录 2026-09-22 正式发布之后、有原帖、源码或可复现提示词的作品；发布前流传的“Opus 5.5 演示”里有被证实是伪造的，收录时会标注。
- 社区作品只放链接和简介，不转载原帖的图片或视频。
- 欢迎通过 Issue 或 PR 推荐。

## License

本仓库原创的游戏、动画与工具代码以 [MIT](LICENSE) 发布；列表中外部作品的版权归各自作者所有，本仓库只提供链接。
