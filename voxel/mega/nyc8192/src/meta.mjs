// Writes meta.json (showcase card) from data/manifest.json, life/actors.json and file sizes.
//   node src/meta.mjs [--shots a.png,b.png,...] [--perf '{"...":...}']
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/manifest.json'), 'utf8'));
const life = JSON.parse(fs.readFileSync(path.join(ROOT, 'life/actors.json'), 'utf8'));
const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : null; };

function walk(dir) {
  let total = 0, files = 0, max = 0, maxName = '';
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { const r = walk(p); total += r.total; files += r.files; if (r.max > max) { max = r.max; maxName = r.maxName; } }
    else { const s = fs.statSync(p).size; total += s; files++; if (s > max) { max = s; maxName = path.relative(ROOT, p); } }
  }
  return { total, files, max, maxName };
}
const all = walk(ROOT);
const data = walk(path.join(ROOT, 'data'));
const st = man.stats;
const mb = (b) => +(b / 1048576).toFixed(1);
const firstScreen = ['index.html', 'js/app.js', 'js/tiles.js', 'js/voxelmat.js', 'js/actors.js', 'js/download.js', 'js/mesher.worker.js', 'js/meshcore.js', 'js/tilecodec.js',
  'vendor/three/build/three.module.js', 'vendor/three/build/three.core.js', 'vendor/three/examples/jsm/controls/OrbitControls.js', 'data/manifest.json', 'data/places.json', 'life/actors.json',
  ...Object.keys(man.lods.find((l) => l.lod === 4).tiles).map((k) => `data/l4/${k}.bin`)].reduce((a, f) => a + fs.statSync(path.join(ROOT, f)).size, 0);
const tiles = man.lods.reduce((a, l) => a + Object.keys(l.tiles).length, 0);
const perf = opt('perf') ? JSON.parse(opt('perf')) : null;
const shots = (opt('shots') || '').split(',').filter(Boolean);
const meta = {
  slug: 'mega/nyc8192',
  title_zh: '纽约城（8192³）',
  prompt: 'A full rendition of New York City, fully accurate, dense, and to scale',
  spec: '8192³ 网格，1 米一格（水平与竖直一致），静态城市 + 动态角色；地理、地标、街区凭记忆写进程序，不联网、不用外部数据文件。',
  description_zh: '画布 8.19×8.19 公里、逆时针旋转 22.5°，把总督岛到中央公园南段（羊草坪、贝塞斯达台地）放进对角线：下城与中城曼哈顿、哈德逊河与东河、'
    + '布鲁克林大桥（花岗岩哥特双拱塔、斜拉索网、高架步道）、曼哈顿大桥（双层、地铁）、威廉斯堡大桥、布鲁克林高地与 DUMBO、泽西城 / 霍博肯岸线、总督岛（杰伊堡、威廉斯城堡、瞭望山）。'
    + '街道分车道线、公交 / 自行车道、斑马线、停止线、人行道与行道树；约 7.8 万栋程序生成建筑带退台、逐层窗带、店面招牌、檐口女儿墙、木制水塔、电梯机房与空调机组，'
    + '时代广场外立面铺满 LED 屏；手工建模地标 120 余处（世贸一号楼、帝国大厦、克莱斯勒大厦、一号范德比尔特、洛克菲勒中心、熨斗大厦、哈德逊园区与“容器”、'
    + '亿万富翁街、伍尔沃斯、9/11 纪念池、高线公园、无畏号航母等），高度按真实比例。'
    + `动态角色 ${life.actors.length} 个分布在 ${life.zones.length} 个活动区域：出租车 / 小汽车 / 公交（车窗、车灯、后视镜、会转的圆轮）、时代广场与大桥步道的行人、坐姿踏板的骑行者、中央公园马车与遛狗、`
    + '渡轮、帆船、拖船、直升机、地铁列车和鸟群，与建筑共用深度遮挡。',
  stats: {
    grid: '8192³',
    voxel_m: 1,
    coverage: '8.192 × 8.192 km（旋转 22.5°），竖向 0–575 m（海平面 y=24）',
    static_voxels: st.static_voxels,
    static_voxels_breakdown: st.categories,
    voxels_above_sea_level: st.voxels_above_sea,
    box_records: st.box_records,
    column_runs: st.column_runs,
    generation_chunks: 256,
    tiles: { total: tiles, lod0: Object.keys(man.lods[0].tiles).length, lod1: Object.keys(man.lods[1].tiles).length, lod2: Object.keys(man.lods[2].tiles).length, lod3: Object.keys(man.lods[3].tiles).length, lod4: Object.keys(man.lods[4].tiles).length },
    buildings_generic: st.buildings, landmarks_and_structures: 122, trees: st.trees,
    actors: life.actors.length, activity_zones: life.zones.length, actor_types: life.counts.byType,
    files: { total_mb: mb(all.total), count: all.files, data_mb: mb(data.total), largest_file: `${all.maxName} (${mb(all.max)} MB)`, first_screen_mb: mb(firstScreen) },
    build: { seconds: st.build_seconds, main_peak_rss_mb: st.peak_rss_main_mb, threads: '1 + 7 workers' },
    ...(perf ? { perf } : {}),
  },
  controls: ['左键拖动平移', '滚轮朝鼠标位置缩放', '右键或 Alt+左键拖动旋转', '双击聚焦', '播放 / 暂停、0.5× / 1× / 2×', '活动区域列表点击飞到近景', '镜头环绕开关', '地标标注开关', '画质：流畅 / 标准 / 精细', '下载：静态模型（浏览器打包全部 LOD0）、角色路径 JSON、生成器源码 tar'],
  best_shots: shots,
  entry: 'index.html',
};
fs.writeFileSync(path.join(ROOT, 'meta.json'), JSON.stringify(meta, null, 1));
console.log(JSON.stringify(meta.stats, null, 1));
