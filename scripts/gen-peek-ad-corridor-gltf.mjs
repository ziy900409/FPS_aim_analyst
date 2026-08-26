// gen-peek-ad-corridor-gltf.mjs - WP-45 / T2
//
// Generates the original CC0 peek-ad-corridor-v1 scene asset from the authoritative
// propBounds JSON. The visual geometry is simple box primitives: the two mirrored
// cover-wall halves plus a render-only ground cue that does not enter clearance.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const propsPath = resolve(here, '../src/scene/scenes/peek-ad-corridor.props.json');
const outDir = resolve(here, '../public/assets/scenes/peek-ad-corridor');
const outPath = resolve(outDir, 'peek-ad-corridor.gltf');
mkdirSync(outDir, { recursive: true });

const { props } = JSON.parse(readFileSync(propsPath, 'utf8'));

const KINDS = ['wall', 'ground'];
const BASE_COLOR = {
  wall: [0.43, 0.46, 0.5, 1],
  ground: [0.22, 0.24, 0.25, 1],
};

const visuals = [
  ...props,
  { id: 'ground', kind: 'ground', min: { x: -6, y: -0.08, z: -12 }, max: { x: 6, y: 0, z: 2 } },
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
  pbrMetallicRoughness: { baseColorFactor: BASE_COLOR[kind], metallicFactor: 0, roughnessFactor: 0.9 },
}));
const nodes = visuals.map((entry) => {
  const center = [
    (entry.min.x + entry.max.x) / 2,
    (entry.min.y + entry.max.y) / 2,
    (entry.min.z + entry.max.z) / 2,
  ];
  const scale = [entry.max.x - entry.min.x, entry.max.y - entry.min.y, entry.max.z - entry.min.z];
  return { name: entry.id, mesh: Math.max(0, KINDS.indexOf(entry.kind)), translation: center, scale };
});

const gltf = {
  asset: {
    version: '2.0',
    generator: 'FPS_aim_analyst WP-45 T2 peek-ad-corridor generator (original geometry, CC0)',
    copyright: 'CC0 1.0 - original work, FPS_aim_analyst',
  },
  scene: 0,
  scenes: [{ name: 'peek-ad-corridor', nodes: nodes.map((_, i) => i) }],
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
console.log(`wrote ${outPath}: ${props.length} propBounds, ${nodes.length} mesh nodes`);
