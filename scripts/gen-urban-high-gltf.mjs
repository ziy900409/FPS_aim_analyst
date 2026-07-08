// gen-urban-high-gltf.mjs — WP-19 / T5
//
// 生成 src/scene/scenes/urban-high.props.json 與 public/assets/scenes/urban-high/urban-high.gltf。
// 原創程式碼 + 原創幾何 → 產出 GLTF 為 CC0(見 ATTRIBUTIONS.md),零第三方授權風險(GD-9)。
//
// 幾何:每個 prop 一個 box,共用一顆單位立方體 mesh(每 kind 一種材質色),以 glTF node
// 的 translation + scale 放置為 prop 的 AABB。座標 = canonical CS unit(u),與 SceneConfig
// propBounds 同來源(本生成器輸出的 props JSON),故視覺與淨空驗證資料不漂移。
//
// 執行:node scripts/gen-urban-high-gltf.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const propsPath = resolve(here, '../src/scene/scenes/urban-high.props.json');
const outDir = resolve(here, '../public/assets/scenes/urban-high');
const outPath = resolve(outDir, 'urban-high.gltf');
mkdirSync(outDir, { recursive: true });

const box = (id, kind, min, max) => ({
  id,
  kind,
  min: {
    x: Math.min(min.x, max.x),
    y: Math.min(min.y, max.y),
    z: Math.min(min.z, max.z),
  },
  max: {
    x: Math.max(min.x, max.x),
    y: Math.max(min.y, max.y),
    z: Math.max(min.z, max.z),
  },
});

const props = [];
for (let i = 0; i < 7; i++) {
  const z0 = -0.9 - i * 1.9;
  const z1 = z0 + 1.2;
  const h = 3.2 + (i % 3) * 0.9;
  props.push(box(`building-r${i + 1}`, 'building', { x: 6.2 + (i % 2) * 0.4, y: 0, z: z0 }, { x: 9.2, y: h, z: z1 }));
  props.push(box(`building-l${i + 1}`, 'building', { x: -9.2, y: 0, z: z0 }, { x: -6.2 - (i % 2) * 0.4, y: h, z: z1 }));
}

for (let i = 0; i < 9; i++) {
  const z = -1.2 - i * 1.25;
  const side = i % 2 === 0 ? 'r' : 'l';
  const sign = side === 'r' ? 1 : -1;
  props.push(box(`crate-${side}${i + 1}`, 'crate',
    { x: sign * 5.4, y: 0, z },
    { x: sign * 6.0, y: 0.65, z: z + 0.55 },
  ));
}

for (let i = 0; i < 10; i++) {
  const z = -1.8 - i * 1.05;
  const side = i % 2 === 0 ? 'l' : 'r';
  const sign = side === 'r' ? 1 : -1;
  props.push(box(`barrel-${side}${i + 1}`, 'barrel',
    { x: sign * 6.35, y: 0, z },
    { x: sign * 6.75, y: 0.9, z: z + 0.4 },
  ));
}

for (let i = 0; i < 8; i++) {
  const z = -0.6 - i * 1.55;
  const side = i % 2 === 0 ? 'r' : 'l';
  const sign = side === 'r' ? 1 : -1;
  props.push(box(`lamp-${side}${i + 1}`, 'lamp',
    { x: sign * 5.9, y: 0, z },
    { x: sign * 6.1, y: 3.6, z: z + 0.2 },
  ));
}

for (let i = 0; i < 8; i++) {
  const z = -2.0 - i * 1.3;
  const side = i % 2 === 0 ? 'l' : 'r';
  const sign = side === 'r' ? 1 : -1;
  props.push(box(`barrier-${side}${i + 1}`, 'barrier',
    { x: sign * 5.15, y: 0, z },
    { x: sign * 5.85, y: 0.7, z: z + 0.28 },
  ));
}

for (let i = 0; i < 8; i++) {
  const x0 = -7.5 + i * 2.2;
  const width = i % 2 === 0 ? 1.45 : 1.1;
  props.push(box(`backdrop-building-${i + 1}`, 'building',
    { x: x0, y: 0, z: -13.8 + (i % 2) * 0.8 },
    { x: x0 + width, y: 3.8 + (i % 4) * 0.7, z: -11.1 + (i % 3) * 0.35 },
  ));
}

for (let i = 0; i < 6; i++) {
  const x = -5.6 + i * 2.25;
  props.push(box(`backdrop-sign-${i + 1}`, 'sign',
    { x, y: 0.3, z: -10.0 },
    { x: x + 0.8, y: 1.8, z: -9.8 },
  ));
}

props.sort((a, b) => a.id.localeCompare(b.id));

const propJson = {
  _comment:
    'urban-high 權威 prop 清單(WP-19 T5)。單一來源:scripts/gen-urban-high-gltf.mjs 生成此檔與 public/assets/scenes/urban-high/urban-high.gltf(視覺 box)。座標為 canonical CS unit(u),displayScale=1。高雜亂度以雙側街廓、近側街道雜物與遠端城市 backdrop 組成;props 避開玩家走廊與現行 counter-strafe target 視線,由 urban-high.test.ts 的 validateClearance 斷言零違規。road/sidewalk/ground 為生成器另加的視覺-only 扁平幾何,不入 propBounds、不影響淨空。',
  props,
};
writeFileSync(propsPath, JSON.stringify(propJson, null, 2) + '\n');

const KINDS = ['building', 'crate', 'barrel', 'sign', 'lamp', 'barrier', 'ground', 'road', 'sidewalk'];
const BASE_COLOR = {
  building: [0.42, 0.44, 0.46, 1],
  crate: [0.52, 0.36, 0.22, 1],
  barrel: [0.22, 0.34, 0.55, 1],
  sign: [0.75, 0.62, 0.28, 1],
  lamp: [0.1, 0.1, 0.12, 1],
  barrier: [0.72, 0.18, 0.14, 1],
  ground: [0.25, 0.27, 0.28, 1],
  road: [0.12, 0.13, 0.14, 1],
  sidewalk: [0.48, 0.49, 0.47, 1],
};

const visualOnly = [
  box('ground', 'ground', { x: -14, y: -0.25, z: -16 }, { x: 14, y: 0, z: 6 }),
  box('road-center', 'road', { x: -3.2, y: 0, z: -15.5 }, { x: 3.2, y: 0.03, z: 5.5 }),
  box('sidewalk-left', 'sidewalk', { x: -6.0, y: 0.02, z: -15.5 }, { x: -3.35, y: 0.1, z: 5.5 }),
  box('sidewalk-right', 'sidewalk', { x: 3.35, y: 0.02, z: -15.5 }, { x: 6.0, y: 0.1, z: 5.5 }),
];

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
  indices.push(base + 0, base + 1, base + 2, base + 0, base + 2, base + 3);
}

const posArray = new Float32Array(positions);
const normArray = new Float32Array(normals);
const idxArray = new Uint16Array(indices);
const posBytes = posArray.byteLength;
const normBytes = normArray.byteLength;
const idxBytes = idxArray.byteLength;
const total = posBytes + normBytes + idxBytes;
const buf = Buffer.alloc(total);
Buffer.from(posArray.buffer).copy(buf, 0);
Buffer.from(normArray.buffer).copy(buf, posBytes);
Buffer.from(idxArray.buffer).copy(buf, posBytes + normBytes);

const meshes = KINDS.map((kind, i) => ({
  name: `unit-cube-${kind}`,
  primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: i }],
}));
const materials = KINDS.map((kind) => ({
  name: `mat-${kind}`,
  pbrMetallicRoughness: { baseColorFactor: BASE_COLOR[kind], metallicFactor: 0, roughnessFactor: 0.92 },
}));

const boxNode = ({ id, kind, min, max }) => {
  const center = [(min.x + max.x) / 2, (min.y + max.y) / 2, (min.z + max.z) / 2];
  const scale = [max.x - min.x, max.y - min.y, max.z - min.z];
  return { name: id, mesh: Math.max(0, KINDS.indexOf(kind)), translation: center, scale };
};

const nodes = [...props, ...visualOnly].map(boxNode);
const gltf = {
  asset: {
    version: '2.0',
    generator: 'FPS_aim_analyst WP-19 T5 urban-high generator (original geometry, CC0)',
    copyright: 'CC0 1.0 — original work, FPS_aim_analyst',
  },
  scene: 0,
  scenes: [{ name: 'urban-high', nodes: nodes.map((_, i) => i) }],
  nodes,
  meshes,
  materials,
  buffers: [{ byteLength: total, uri: `data:application/octet-stream;base64,${buf.toString('base64')}` }],
  bufferViews: [
    { buffer: 0, byteOffset: 0, byteLength: posBytes, target: 34962 },
    { buffer: 0, byteOffset: posBytes, byteLength: normBytes, target: 34962 },
    { buffer: 0, byteOffset: posBytes + normBytes, byteLength: idxBytes, target: 34963 },
  ],
  accessors: [
    { bufferView: 0, componentType: 5126, count: 24, type: 'VEC3', min: [-H, -H, -H], max: [H, H, H] },
    { bufferView: 1, componentType: 5126, count: 24, type: 'VEC3' },
    { bufferView: 2, componentType: 5123, count: idxArray.length, type: 'SCALAR' },
  ],
};

writeFileSync(outPath, JSON.stringify(gltf, null, 2) + '\n');
console.log(`wrote ${propsPath}: ${props.length} props`);
console.log(`wrote ${outPath}: ${nodes.length} mesh nodes, ${total} buffer bytes`);
