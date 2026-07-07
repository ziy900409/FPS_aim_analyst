// gen-field-low-gltf.mjs — WP-19 / T2
//
// 由 src/scene/scenes/field-low.props.json 生成 public/assets/scenes/field-low/field-low.gltf。
// 原創程式碼 + 原創幾何 → 產出 GLTF 為 **CC0**(見 ATTRIBUTIONS.md),零授權風險(GD-9)。
//
// 幾何:每個 prop 一個 box,共用一顆單位立方體 mesh(每 kind 一種材質色),以 glTF node
// 的 translation + scale 放置為 prop 的 AABB。座標 = canonical CS unit(u),與 SceneConfig
// propBounds 同來源(field-low.props.json),故視覺與淨空驗證資料不漂移。
//
// 執行:node scripts/gen-field-low-gltf.mjs

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const propsPath = resolve(here, '../src/scene/scenes/field-low.props.json');
const outDir = resolve(here, '../public/assets/scenes/field-low');
const outPath = resolve(outDir, 'field-low.gltf');
mkdirSync(outDir, { recursive: true });

const { props } = JSON.parse(readFileSync(propsPath, 'utf8'));

// kind → 材質基礎色(linear-ish sRGB factor)。低多邊形戶外配色:foliage 綠 / rock 灰 / crate 棕。
const KINDS = ['tree', 'rock', 'crate'];
const BASE_COLOR = {
  tree: [0.24, 0.42, 0.19, 1],
  rock: [0.45, 0.46, 0.48, 1],
  crate: [0.5, 0.36, 0.22, 1],
};

// ---- 單位立方體(中心原點,邊長 1):24 頂點(每面 4)+ 每面法線 + 36 index。----
// 6 面:+X -X +Y -Y +Z -Z。每面 4 角(CCW,面向外),正常朝外。
const H = 0.5;
const faces = [
  { n: [1, 0, 0], v: [[H, -H, -H], [H, H, -H], [H, H, H], [H, -H, H]] },
  { n: [-1, 0, 0], v: [[-H, -H, H], [-H, H, H], [-H, H, -H], [-H, -H, -H]] },
  { n: [0, 1, 0], v: [[-H, H, -H], [-H, H, H], [H, H, H], [H, H, -H]] },
  { n: [0, -1, 0], v: [[-H, -H, H], [-H, -H, -H], [H, -H, -H], [H, -H, H]] },
  { n: [0, 0, 1], v: [[H, -H, H], [H, H, H], [-H, H, H], [-H, -H, H]] },
  { n: [0, 0, -1], v: [[-H, -H, -H], [-H, H, -H], [H, H, -H], [H, -H, -H]] },
];

const positions = [];
const normals = [];
const indices = [];
for (let f = 0; f < faces.length; f++) {
  const base = f * 4;
  for (const vert of faces[f].v) {
    positions.push(...vert);
    normals.push(...faces[f].n);
  }
  // 兩個三角形:(0,1,2) (0,2,3)
  indices.push(base + 0, base + 1, base + 2, base + 0, base + 2, base + 3);
}

const posArray = new Float32Array(positions);
const normArray = new Float32Array(normals);
const idxArray = new Uint16Array(indices);

// buffer 佈局:[positions][normals][indices](4-byte 對齊;index 起點 = 288+288=576,對齊 2)。
const posBytes = posArray.byteLength; // 24*3*4 = 288
const normBytes = normArray.byteLength; // 288
const idxBytes = idxArray.byteLength; // 36*2 = 72
const total = posBytes + normBytes + idxBytes;
const buf = Buffer.alloc(total);
Buffer.from(posArray.buffer).copy(buf, 0);
Buffer.from(normArray.buffer).copy(buf, posBytes);
Buffer.from(idxArray.buffer).copy(buf, posBytes + normBytes);

const posMin = [-H, -H, -H];
const posMax = [H, H, H];

// 每 kind 一個 mesh(共用同一組 accessor,只換 material)。
const meshes = KINDS.map((kind, i) => ({
  name: `unit-cube-${kind}`,
  primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: i }],
}));

const materials = KINDS.map((kind) => ({
  name: `mat-${kind}`,
  pbrMetallicRoughness: { baseColorFactor: BASE_COLOR[kind], metallicFactor: 0, roughnessFactor: 0.9 },
}));

const nodes = props.map((p) => {
  const center = [(p.min.x + p.max.x) / 2, (p.min.y + p.max.y) / 2, (p.min.z + p.max.z) / 2];
  const scale = [p.max.x - p.min.x, p.max.y - p.min.y, p.max.z - p.min.z];
  const meshIndex = Math.max(0, KINDS.indexOf(p.kind));
  return { name: p.id, mesh: meshIndex, translation: center, scale };
});

const gltf = {
  asset: {
    version: '2.0',
    generator: 'FPS_aim_analyst WP-19 T2 field-low generator (original geometry, CC0)',
    copyright: 'CC0 1.0 — original work, FPS_aim_analyst',
  },
  scene: 0,
  scenes: [{ name: 'field-low', nodes: nodes.map((_, i) => i) }],
  nodes,
  meshes,
  materials,
  buffers: [
    {
      byteLength: total,
      uri: `data:application/octet-stream;base64,${buf.toString('base64')}`,
    },
  ],
  bufferViews: [
    { buffer: 0, byteOffset: 0, byteLength: posBytes, target: 34962 },
    { buffer: 0, byteOffset: posBytes, byteLength: normBytes, target: 34962 },
    { buffer: 0, byteOffset: posBytes + normBytes, byteLength: idxBytes, target: 34963 },
  ],
  accessors: [
    { bufferView: 0, componentType: 5126, count: 24, type: 'VEC3', min: posMin, max: posMax },
    { bufferView: 1, componentType: 5126, count: 24, type: 'VEC3' },
    { bufferView: 2, componentType: 5123, count: idxArray.length, type: 'SCALAR' },
  ],
};

writeFileSync(outPath, JSON.stringify(gltf, null, 2) + '\n');
console.log(`wrote ${outPath}: ${props.length} props, ${total} buffer bytes`);
