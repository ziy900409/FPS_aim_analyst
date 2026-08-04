// gen-br-field-gltf.mjs - WP-26 / T1
//
// Generates the original CC0 br-field scene asset and its authoritative
// propBounds data from one deterministic source.
//
// Outputs:
// - src/scene/scenes/br-field.props.json
// - public/assets/scenes/br-field/br-field.gltf
//
// The playable forward corridor is intentionally empty:
// z in [-145, 0], x in [-21, 21]. All propBounds sit outside that band.

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const propsPath = resolve(here, '../src/scene/scenes/br-field.props.json');
const outDir = resolve(here, '../public/assets/scenes/br-field');
const outPath = resolve(outDir, 'br-field.gltf');
mkdirSync(outDir, { recursive: true });

const CORRIDOR = {
  halfWidthU: 21,
  frontMinZ: -145,
  frontMaxZ: 0,
};

const round = (n) => Math.round(n * 100) / 100;

const box = (id, kind, min, max) => ({
  id,
  kind,
  min: {
    x: round(Math.min(min.x, max.x)),
    y: round(Math.min(min.y, max.y)),
    z: round(Math.min(min.z, max.z)),
  },
  max: {
    x: round(Math.max(min.x, max.x)),
    y: round(Math.max(min.y, max.y)),
    z: round(Math.max(min.z, max.z)),
  },
});

const props = [];

function addTree(id, side, x, z, height) {
  const sign = side === 'r' ? 1 : -1;
  const centerX = sign * x;
  props.push(box(`tree-${side}${id}`, 'tree',
    { x: centerX - 1.15, y: 0, z: z - 1.15 },
    { x: centerX + 1.15, y: height, z: z + 1.15 },
  ));
}

function addShrub(id, side, x, z, width, height) {
  const sign = side === 'r' ? 1 : -1;
  const centerX = sign * x;
  props.push(box(`shrub-${side}${id}`, 'shrub',
    { x: centerX - width / 2, y: 0, z: z - width / 2 },
    { x: centerX + width / 2, y: height, z: z + width / 2 },
  ));
}

function addHay(id, side, x, z) {
  const sign = side === 'r' ? 1 : -1;
  const centerX = sign * x;
  props.push(box(`hay-${side}${id}`, 'hay',
    { x: centerX - 1.2, y: 0, z: z - 0.75 },
    { x: centerX + 1.2, y: 1.05, z: z + 0.75 },
  ));
}

for (let i = 0; i < 12; i++) {
  const z = -12 - i * 10.8;
  addTree(i + 1, 'r', 30 + (i % 4) * 7 + (i % 2) * 1.8, z, 4.4 + (i % 3) * 0.7);
  addTree(i + 1, 'l', 31 + ((i + 1) % 4) * 7 + (i % 2) * 1.5, z - 3.2, 4.2 + ((i + 2) % 3) * 0.75);
}

for (let i = 0; i < 14; i++) {
  const z = -7 - i * 9.6;
  addShrub(i + 1, 'r', 24.5 + (i % 5) * 4.2, z, 1.6 + (i % 3) * 0.35, 0.75 + (i % 2) * 0.25);
  addShrub(i + 1, 'l', 25.5 + ((i + 2) % 5) * 4.0, z - 4.4, 1.5 + ((i + 1) % 3) * 0.3, 0.7 + ((i + 1) % 2) * 0.25);
}

for (let i = 0; i < 5; i++) {
  addHay(i + 1, 'r', 34 + (i % 3) * 8, -25 - i * 22);
  addHay(i + 1, 'l', 37 + ((i + 1) % 3) * 8, -35 - i * 21);
}

props.sort((a, b) => a.id.localeCompare(b.id));

const intersects = (aMin, aMax, bMin, bMax) => aMin <= bMax && aMax >= bMin;
const corridorViolations = props.filter((p) => (
  intersects(p.min.z, p.max.z, CORRIDOR.frontMinZ, CORRIDOR.frontMaxZ)
  && intersects(p.min.x, p.max.x, -CORRIDOR.halfWidthU, CORRIDOR.halfWidthU)
));

if (corridorViolations.length > 0) {
  throw new Error(`br-field corridor violations: ${corridorViolations.map((p) => p.id).join(', ')}`);
}

const propJson = {
  _comment:
    'br-field authoritative prop list (WP-26 T1). Single source: scripts/gen-br-field-gltf.mjs generates this file and public/assets/scenes/br-field/br-field.gltf. Coordinates are canonical CS units, displayScale=1. The forward BR tracking corridor is intentionally clear: z in [-145,0], hard clear width 42u (x in [-21,21]). Props are placed on flanks only; visual-only ground, wheat strips, low flank hills, and far mountains are generated into the GLTF but omitted from propBounds because they are render-only and must not enter sim or bullet blocking.',
  corridorClearance: {
    frontFacingSightlineLengthU: 145,
    hardClearWidthU: 42,
    clearBand: { min: { x: -21, z: -145 }, max: { x: 21, z: 0 } },
  },
  props,
};
writeFileSync(propsPath, JSON.stringify(propJson, null, 2) + '\n');

const KINDS = ['ground', 'wheat', 'shrub', 'tree-trunk', 'tree-canopy', 'hay', 'mountain', 'dirt'];
const BASE_COLOR = {
  ground: [0.36, 0.42, 0.22, 1],
  wheat: [0.77, 0.62, 0.3, 1],
  shrub: [0.2, 0.34, 0.16, 1],
  'tree-trunk': [0.32, 0.22, 0.13, 1],
  'tree-canopy': [0.18, 0.32, 0.17, 1],
  hay: [0.72, 0.55, 0.24, 1],
  mountain: [0.55, 0.62, 0.68, 1], // 大氣霧化的藍灰遠山色,讓天際線在前向視野中明顯讀成「遠山」(非暗色土丘)。
  dirt: [0.42, 0.34, 0.22, 1],
};

const visualNodes = [];
const addVisual = (id, kind, min, max) => visualNodes.push(box(id, kind, min, max));

addVisual('ground-base', 'ground', { x: -86, y: -0.35, z: -170 }, { x: 86, y: 0, z: 14 });
addVisual('corridor-flat-earth', 'dirt', { x: -21, y: 0, z: -145 }, { x: 21, y: 0.04, z: 8 });
addVisual('left-low-hill', 'ground', { x: -86, y: -0.2, z: -155 }, { x: -24, y: 0.35, z: 5 });
addVisual('right-low-hill', 'ground', { x: 24, y: -0.2, z: -155 }, { x: 86, y: 0.35, z: 5 });

// 麥田加高:0.85~1.09u 讓側翼看得出成排麥浪(仍在 x>=23 側翼,不入 x∈[-21,21] 走廊)。
for (let i = 0; i < 18; i++) {
  const z0 = -145 + i * 8.2;
  const top = 0.85 + (i % 3) * 0.12;
  addVisual(`wheat-row-r${i + 1}`, 'wheat', { x: 23 + (i % 4) * 4.5, y: 0.03, z: z0 }, { x: 25.2 + (i % 4) * 4.5, y: top, z: z0 + 5.8 });
  addVisual(`wheat-row-l${i + 1}`, 'wheat', { x: -25.2 - ((i + 2) % 4) * 4.5, y: 0.03, z: z0 - 2.7 }, { x: -23 - ((i + 2) % 4) * 4.5, y: top, z: z0 + 3.1 });
}

// 遠山加大:高度約 x2、略加寬加深,形成一整排可辨識的天際線(render-only,不入 propBounds/走廊)。
addVisual('mountain-left', 'mountain', { x: -104, y: 0, z: -175 }, { x: -24, y: 19, z: -166 });
addVisual('mountain-center', 'mountain', { x: -40, y: 0, z: -177 }, { x: 40, y: 15.5, z: -168 });
addVisual('mountain-right', 'mountain', { x: 24, y: 0, z: -175 }, { x: 104, y: 21.5, z: -166 });

function propVisuals(prop) {
  if (prop.kind === 'tree') {
    const cx = (prop.min.x + prop.max.x) / 2;
    const cz = (prop.min.z + prop.max.z) / 2;
    return [
      box(`${prop.id}-trunk`, 'tree-trunk', { x: cx - 0.22, y: 0, z: cz - 0.22 }, { x: cx + 0.22, y: prop.max.y * 0.62, z: cz + 0.22 }),
      box(`${prop.id}-canopy`, 'tree-canopy', { x: prop.min.x, y: prop.max.y * 0.45, z: prop.min.z }, prop.max),
    ];
  }
  if (prop.kind === 'shrub') return [box(prop.id, 'shrub', prop.min, prop.max)];
  if (prop.kind === 'hay') return [box(prop.id, 'hay', prop.min, prop.max)];
  return [box(prop.id, 'ground', prop.min, prop.max)];
}

const nodes = [...props.flatMap(propVisuals), ...visualNodes].map((entry) => {
  const center = [(entry.min.x + entry.max.x) / 2, (entry.min.y + entry.max.y) / 2, (entry.min.z + entry.max.z) / 2];
  const scale = [entry.max.x - entry.min.x, entry.max.y - entry.min.y, entry.max.z - entry.min.z];
  return { name: entry.id, mesh: Math.max(0, KINDS.indexOf(entry.kind)), translation: center, scale };
});

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
  pbrMetallicRoughness: { baseColorFactor: BASE_COLOR[kind], metallicFactor: 0, roughnessFactor: 0.88 },
}));

const gltf = {
  asset: {
    version: '2.0',
    generator: 'FPS_aim_analyst WP-26 T1 br-field generator (original geometry, CC0)',
    copyright: 'CC0 1.0 - original work, FPS_aim_analyst',
  },
  scene: 0,
  scenes: [{ name: 'br-field', nodes: nodes.map((_, i) => i) }],
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

const triangles = nodes.length * (idxArray.length / 3);
console.log(`wrote ${propsPath}: ${props.length} propBounds`);
console.log(`wrote ${outPath}: ${nodes.length} mesh nodes, ${triangles} triangles, ${materials.length} materials, 0 textures`);
console.log(`corridor clear: length ${-CORRIDOR.frontMinZ}u, width ${CORRIDOR.halfWidthU * 2}u`);
