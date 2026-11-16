import * as THREE from "three";
import { Builder, GEO } from "./builder";
import { getMaterials } from "./materials";
import { buildFoodProp } from "./props";
import { buildJumpPark, inRect, type JumpPark } from "./jumppark";
import * as BLD from "./buildings";

// Stadt-Raster: N x N Häuserblocks, dazwischen Straßen
export const N = 10;
export const CELL = 56;
export const ROAD = 20;
export const BLOCK = CELL - ROAD; // 36
export const SIDE = 2.5; // Gehwegbreite
export const INNER = BLOCK - 2 * SIDE;
export const LOT = INNER / 2;
export const HALF = (N * CELL) / 2;
export const LIMIT = HALF + 40;
// Jump-Park: ersetzt die Blocks i=6..7, j=1..2
export const PARK_BLOCKS = { i0: 6, i1: 7, j0: 1, j1: 2 };
export const PARK_RECT = {
  minX: -HALF + PARK_BLOCKS.i0 * CELL + ROAD / 2,
  maxX: -HALF + (PARK_BLOCKS.i1 + 1) * CELL - ROAD / 2,
  minZ: -HALF + PARK_BLOCKS.j0 * CELL + ROAD / 2,
  maxZ: -HALF + (PARK_BLOCKS.j1 + 1) * CELL - ROAD / 2,
};
// Fußballstadion: Blocks i=0..2, j=6..7
export const STADIUM_BLOCKS = { i0: 0, i1: 2, j0: 6, j1: 7 };
export const STADIUM_RECT = {
  minX: -HALF + STADIUM_BLOCKS.i0 * CELL + ROAD / 2,
  maxX: -HALF + (STADIUM_BLOCKS.i1 + 1) * CELL - ROAD / 2,
  minZ: -HALF + STADIUM_BLOCKS.j0 * CELL + ROAD / 2,
  maxZ: -HALF + (STADIUM_BLOCKS.j1 + 1) * CELL - ROAD / 2,
};
/** Bereiche ohne Straßenverkehr */
export const CLOSED_RECTS = [PARK_RECT, STADIUM_RECT];
export const inClosed = (x: number, z: number) => CLOSED_RECTS.some((r) => inRect(r, x, z));
const inBlocks = (b: { i0: number; i1: number; j0: number; j1: number }, i: number, j: number) =>
  i >= b.i0 && i <= b.i1 && j >= b.j0 && j <= b.j1;

// Besondere Gebäude (ganzer Block)
const SPECIALS: Record<string, (c: BLD.Ctx, A: BLD.Area) => void> = {
  "8,8": BLD.factory,
  "5,4": BLD.gasStation,
  "2,2": BLD.school,
  "5,7": BLD.hospital,
  "3,1": BLD.fireStation,
  "6,5": BLD.policeStation,
  "0,4": BLD.supermarket,
  "4,8": BLD.church,
  "5,5": BLD.officeTowers,
  "4,5": BLD.officeTowers,
  "5,3": BLD.officeTowers,
  "8,4": BLD.swimmingPool,
  "9,1": BLD.factory,
};

export interface Box {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}
export interface Spot {
  x: number;
  z: number;
}
export interface Restaurant {
  name: string;
  emoji: string;
  color: string;
  door: Spot;
}
export interface House {
  door: Spot; // Lieferpunkt auf der Straße
  stand: Spot; // Hier wartet der Kunde
  heading: number;
}
export interface World {
  group: THREE.Group;
  colliders: Box[];
  houseBoxes: Box[];
  restaurants: Restaurant[];
  houses: House[];
  garage: Spot;
  spawn: { x: number; z: number; heading: number };
  blockRects: Box[];
  parkRects: Box[];
  spinners: THREE.Object3D[];
  displays: { x: number; z: number; heading: number; id: string }[];
  park: JumpPark;
  stadium: BLD.StadiumInfo;
  animators: ((dt: number, t: number) => void)[];
  atm: Spot;
}

const RESTAURANTS: [string, string, string][] = [
  ["PIZZA", "🍕", "#e53935"],
  ["BURGER", "🍔", "#fb8c00"],
  ["SUSHI", "🍣", "#1e88e5"],
  ["DÖNER", "🥙", "#8e24aa"],
  ["TACOS", "🌮", "#43a047"],
  ["NUDELN", "🍜", "#f4511e"],
  ["CURRY", "🍛", "#c09000"],
  ["EIS", "🍦", "#ec407a"],
  ["BÄCKER", "🥐", "#8d5a3b"],
  ["SALAT", "🥗", "#689f38"],
  ["POMMES", "🍟", "#f9a825"],
  ["WOK", "🥡", "#d81b60"],
];

const WALLS = ["#f4efe6", "#f2d7b6", "#cfe0ee", "#f6e3a1", "#f1c1b5", "#cfe5c4", "#ddd0ec", "#f5c99a", "#bfdcdc", "#fbe0e6", "#e6e6e6"];
const BRICKS = ["#b5523b", "#a0462f", "#c0704f", "#8d4a3a", "#c9a27e"];
const ROOFS = ["#a83a2c", "#7c3b2b", "#3f4a5a", "#5b5b5b", "#2f5f8a", "#6b4a3a"];
const LEAVES = ["#3fae49", "#2e8b3a", "#5cb85c", "#4caf50", "#6abf4b"];
const GLASS = ["#8fb8d6", "#7aa7c7", "#9cc3dd", "#87b0cc"];
const SHUTTERS = ["#2e5d8a", "#3d7a3d", "#7a2e2e", "#4a4a4a", "#8a6a2e"];

export function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const signCache = new Map<string, THREE.Texture>();
function signTexture(text: string, emoji: string, color: string) {
  const key = text + emoji + color;
  const cached = signCache.get(key);
  if (cached) return cached;
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  const grd = ctx.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, color);
  grd.addColorStop(1, new THREE.Color(color).multiplyScalar(0.7).getStyle());
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.roundRect(8, 8, 1008, 240, 48);
  ctx.fill();
  ctx.lineWidth = 14;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
  ctx.font = 'bold 150px "Arial Rounded MT Bold", Arial, sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillText(`${emoji} ${text}`, 518, 138, 960);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(`${emoji} ${text}`, 512, 132, 960);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  signCache.set(key, tex);
  return tex;
}

export function buildWorld(): World {
  const r = rng(2024);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const B = new Builder();
  const group = new THREE.Group();
  const colliders: Box[] = [];
  const houseBoxes: Box[] = [];
  const houses: House[] = [];
  const restaurants: Restaurant[] = [];
  const blockRects: Box[] = [];
  const parkRects: Box[] = [];
  const spinners: THREE.Object3D[] = [];
  const displays: World["displays"] = [];
  const { asphalt, grass } = getMaterials();

  const addCol = (x: number, z: number, hw: number, hd = hw) =>
    colliders.push({ minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd });

  // ---------------- Boden ----------------
  const gTex = grass.clone();
  gTex.repeat.set(800, 800);
  gTex.needsUpdate = true;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(3200, 3200), new THREE.MeshStandardMaterial({ map: gTex, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.03;
  ground.receiveShadow = true;
  group.add(ground);

  const citySize = N * CELL + ROAD;
  const aTex = asphalt.clone();
  aTex.repeat.set(citySize / 7, citySize / 7);
  aTex.needsUpdate = true;
  const road = new THREE.Mesh(new THREE.PlaneGeometry(citySize, citySize), new THREE.MeshStandardMaterial({ map: aTex, roughness: 0.92 }));
  road.rotation.x = -Math.PI / 2;
  road.receiveShadow = true;
  group.add(road);

  // ---------------- Straßenmarkierungen ----------------
  const node = (k: number) => -HALF + k * CELL;
  for (let k = 0; k <= N; k++) {
    const line = node(k);
    for (let s = 0; s < N; s++) {
      const start = node(s) + ROAD / 2 + 5;
      const end = node(s + 1) - ROAD / 2 - 5;
      for (let p = start; p + 2.5 <= end; p += 5) {
        if (!inClosed(line, p + 1.25)) B.ibox("i_paint", 0.18, 0.04, 2.5, line, 0.02, p + 1.25, "#f2f2f2");
        if (!inClosed(p + 1.25, line)) B.ibox("i_paint", 2.5, 0.04, 0.18, p + 1.25, 0.02, line, "#f2f2f2");
      }
    }
  }
  // Zebrastreifen
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= N; j++) {
      const nx = node(i);
      const nz = node(j);
      if (inClosed(nx, nz)) continue;
      const arms: [number, number][] = [];
      if (j < N) arms.push([0, 1]);
      if (j > 0) arms.push([0, -1]);
      if (i < N) arms.push([1, 0]);
      if (i > 0) arms.push([-1, 0]);
      for (const [ax, az] of arms) {
        const cx = nx + ax * (ROAD / 2 + 2);
        const cz = nz + az * (ROAD / 2 + 2);
        if (inClosed(nx + ax * (ROAD / 2 + 4), nz + az * (ROAD / 2 + 4))) continue;
        for (let k = -7; k <= 7; k++) {
          if (ax !== 0) B.ibox("i_paint", 3, 0.04, 0.55, cx, 0.02, nz + k * 1.15, "#f5f5f5");
          else B.ibox("i_paint", 0.55, 0.04, 3, nx + k * 1.15, 0.02, cz, "#f5f5f5");
        }
      }
    }
  }

  // ---------------- Bausteine ----------------
  const tree = (x: number, z: number, y0: number, s = 1, detail = true) => {
    const pine = r() < 0.22;
    B.geo("wood", GEO.cyl8, x, y0 + 1.3 * s, z, "#6b4a2f", 0, 0, 0, 0.2 * s, 2.6 * s, 0.2 * s);
    if (pine) {
      const c = pick(["#2e6b3a", "#2f7a42", "#255c31"]);
      for (let k = 0; k < 3; k++) B.geo("leaf", GEO.cone8, x, y0 + (2.4 + k * 1.3) * s, z, c, 0, r() * 3, 0, (1.9 - k * 0.45) * s, 2.2 * s, (1.9 - k * 0.45) * s);
    } else {
      const ico = detail ? GEO.ico1 : GEO.ico0;
      const c = pick(LEAVES);
      B.geo("leaf", ico, x, y0 + 3.5 * s, z, c, r(), r(), 0, 1.8 * s, 1.6 * s, 1.8 * s);
      B.geo("leaf", ico, x + 0.8 * s, y0 + 3.0 * s, z + 0.4 * s, c, r(), r(), 0, 1.2 * s, 1.1 * s, 1.2 * s);
      B.geo("leaf", ico, x - 0.6 * s, y0 + 4.3 * s, z - 0.4 * s, c, r(), r(), 0, 1.1 * s, 1.0 * s, 1.1 * s);
    }
    addCol(x, z, 0.35 * s);
  };

  const bush = (x: number, z: number, y0: number, s = 1) => {
    const c = pick(LEAVES);
    B.geo("leaf", GEO.ico1, x, y0 + 0.45 * s, z, c, r(), r(), 0, 0.7 * s, 0.55 * s, 0.7 * s);
    if (r() < 0.5) {
      const fc = pick(["#ff5c8a", "#ffd23f", "#ffffff", "#ff7043", "#b388ff"]);
      for (let k = 0; k < 4; k++) B.geo("plain", GEO.sphere, x + (r() - 0.5) * 0.9 * s, y0 + 0.75 * s, z + (r() - 0.5) * 0.9 * s, fc, 0, 0, 0, 0.09, 0.09, 0.09);
    }
  };

  const lamp = (x: number, z: number, ax: number, az: number) => {
    const c = "#3a3f45";
    B.geo("metal", GEO.cyl8, x, 0.3 + 2.6, z, c, 0, 0, 0, 0.08, 5.2, 0.08);
    B.geo("metal", GEO.cyl8, x, 0.45, z, c, 0, 0, 0, 0.16, 0.3, 0.16);
    B.box("metal", ax ? 1.6 : 0.07, 0.07, az ? 1.6 : 0.07, x + ax * 0.8, 5.45, z + az * 0.8, c);
    B.box("metal", ax ? 0.7 : 0.32, 0.14, az ? 0.7 : 0.32, x + ax * 1.55, 5.42, z + az * 1.55, "#2c3035");
    B.box("glow", ax ? 0.55 : 0.22, 0.03, az ? 0.55 : 0.22, x + ax * 1.55, 5.34, z + az * 1.55, "#fff3c4");
    addCol(x, z, 0.2);
  };

  const bench = (x: number, z: number, alongX: boolean) => {
    const w = alongX ? 1.8 : 0.5;
    const d = alongX ? 0.5 : 1.8;
    B.box("wood", w, 0.08, d, x, 0.75, z, "#9a6b3f");
    B.box("wood", alongX ? 1.8 : 0.08, 0.4, alongX ? 0.08 : 1.8, x + (alongX ? 0 : 0.25), 1.0, z + (alongX ? 0.25 : 0), "#9a6b3f");
    for (const s of [-1, 1]) B.box("metal", alongX ? 0.06 : 0.45, 0.45, alongX ? 0.45 : 0.06, x + (alongX ? s * 0.8 : 0), 0.52, z + (alongX ? 0 : s * 0.8), "#333333");
  };

  const win = (
    axis: "x" | "z",
    face: number,
    sign: number,
    along: number,
    y: number,
    ww: number,
    wh: number,
    frame: string,
    opts: { shutters?: string; cross?: boolean; sill?: boolean } = {},
  ) => {
    const lit = r() < 0.18;
    const key = lit ? "i_lit" : "i_glass";
    const gc = lit ? "#ffffff" : pick(GLASS);
    if (axis === "x") {
      B.ibox("i_frame", 0.1, wh + 0.16, ww + 0.16, face + sign * 0.03, y, along, frame);
      B.ibox(key, 0.06, wh, ww, face + sign * 0.07, y, along, gc);
      if (opts.cross) {
        B.ibox("i_frame", 0.05, wh, 0.06, face + sign * 0.1, y, along, frame);
        B.ibox("i_frame", 0.05, 0.06, ww, face + sign * 0.1, y + wh * 0.15, along, frame);
      }
      if (opts.sill !== false) B.ibox("i_frame", 0.22, 0.06, ww + 0.3, face + sign * 0.1, y - wh / 2 - 0.08, along, "#e6e6e6");
      if (opts.shutters)
        for (const s of [-1, 1]) B.ibox("i_plain", 0.05, wh + 0.1, ww * 0.5, face + sign * 0.05, y, along + s * (ww * 0.75 + 0.12), opts.shutters);
    } else {
      B.ibox("i_frame", ww + 0.16, wh + 0.16, 0.1, along, y, face + sign * 0.03, frame);
      B.ibox(key, ww, wh, 0.06, along, y, face + sign * 0.07, gc);
      if (opts.cross) {
        B.ibox("i_frame", 0.06, wh, 0.05, along, y, face + sign * 0.1, frame);
        B.ibox("i_frame", ww, 0.06, 0.05, along, y + wh * 0.15, face + sign * 0.1, frame);
      }
      if (opts.sill !== false) B.ibox("i_frame", ww + 0.3, 0.06, 0.22, along, y - wh / 2 - 0.08, face + sign * 0.1, "#e6e6e6");
      if (opts.shutters)
        for (const s of [-1, 1]) B.ibox("i_plain", ww * 0.5, wh + 0.1, 0.05, along + s * (ww * 0.75 + 0.12), y, face + sign * 0.05, opts.shutters);
    }
  };

  // ---------------- Grundstücke ----------------
  interface Lot {
    lx: number;
    lz: number;
    dir: number;
    edgeX: number;
  }
  const lots: Lot[] = [];
  let garage: Spot = { x: 0, z: 0 };
  let spawn = { x: 0, z: 0, heading: 0 };

  const addSign = (text: string, emoji: string, color: string, x: number, y: number, z: number, angle: number, w: number) => {
    const geo = new THREE.PlaneGeometry(w, w / 4);
    geo.rotateY(angle);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: signTexture(text, emoji, color), toneMapped: false }));
    mesh.position.set(x, y, z);
    group.add(mesh);
  };
  const animators: World["animators"] = [];
  const ctx: BLD.Ctx = { B, r, pick, colliders, houseBoxes, houses, group, animators, addSign, win, tree, bush, bench };

  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const x0 = -HALF + i * CELL + ROAD / 2;
      const z0 = -HALF + j * CELL + ROAD / 2;
      const x1 = x0 + BLOCK;
      const z1 = z0 + BLOCK;
      const cx = x0 + BLOCK / 2;
      const cz = z0 + BLOCK / 2;
      if (inBlocks(PARK_BLOCKS, i, j) || inBlocks(STADIUM_BLOCKS, i, j)) continue;
      blockRects.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1 });

      // Gehweg + Bordstein
      B.box("concrete", BLOCK, 0.3, BLOCK, cx, 0.15, cz, "#dcdcdc");
      B.box("concrete", 0.3, 0.33, BLOCK, x0 + 0.15, 0.165, cz, "#b5b5b5");
      B.box("concrete", 0.3, 0.33, BLOCK, x1 - 0.15, 0.165, cz, "#b5b5b5");
      B.box("concrete", BLOCK, 0.33, 0.3, cx, 0.165, z0 + 0.15, "#b5b5b5");
      B.box("concrete", BLOCK, 0.33, 0.3, cx, 0.165, z1 - 0.15, "#b5b5b5");
      // Randlinien
      B.ibox("i_paint", 0.15, 0.04, BLOCK - 8, x0 - 0.6, 0.02, cz, "#f2f2f2");
      B.ibox("i_paint", 0.15, 0.04, BLOCK - 8, x1 + 0.6, 0.02, cz, "#f2f2f2");
      B.ibox("i_paint", BLOCK - 8, 0.04, 0.15, cx, 0.02, z0 - 0.6, "#f2f2f2");
      B.ibox("i_paint", BLOCK - 8, 0.04, 0.15, cx, 0.02, z1 + 0.6, "#f2f2f2");

      // Laternen an den Ecken
      lamp(x0 + 0.8, z0 + 0.8, -1, 0);
      lamp(x1 - 0.8, z1 - 0.8, 1, 0);
      lamp(x1 - 0.8, z0 + 0.8, 0, -1);
      lamp(x0 + 0.8, z1 - 0.8, 0, 1);
      // Straßenbäume
      for (const [tx, tz] of [
        [x0 + 1.1, cz],
        [x1 - 1.1, cz],
        [cx, z0 + 1.1],
        [cx, z1 - 1.1],
      ]) {
        B.box("metal", 1.4, 0.04, 1.4, tx, 0.31, tz, "#3b3b3b");
        tree(tx, tz, 0.3, 0.75);
      }
      // Hydrant & Bank & Mülleimer
      if (r() < 0.6) {
        const hx = x0 + 1.0;
        const hz = z0 + 6 + r() * 4;
        B.geo("paintGloss", GEO.cyl8, hx, 0.65, hz, "#d32f2f", 0, 0, 0, 0.16, 0.7, 0.16);
        B.geo("paintGloss", GEO.sphere, hx, 1.0, hz, "#d32f2f", 0, 0, 0, 0.17, 0.12, 0.17);
        addCol(hx, hz, 0.2);
      }
      if (r() < 0.5) {
        bench(cx + 4, z1 - 0.9, true);
        B.geo("metal", GEO.cyl8, cx + 6.2, 0.75, z1 - 0.9, "#2e7d32", 0, 0, 0, 0.3, 0.9, 0.3);
      }

      // ---------- Garage (Shop) ----------
      if (i === 4 && j === 4) {
        B.box("concrete", INNER, 0.1, INNER, cx, 0.35, cz, "#c8c8c8");
        const w = 16;
        const d = 28;
        const h = 8;
        const front = x1 - SIDE - 5;
        const hx = front - w / 2;
        B.box("plaster", w, h, d, hx, 0.4 + h / 2, cz, "#3d4a5c");
        B.box("plain", w + 0.4, 0.8, d + 0.4, hx, 0.4 + h + 0.4, cz, "#62bb2a");
        // Glasfront
        B.box("plain", 0.3, h - 1.6, d - 2, front + 0.05, 0.4 + (h - 1.6) / 2 + 0.2, cz, "#1d2228");
        for (let k = 0; k < 5; k++) {
          const z = cz - (d - 2) / 2 + (k + 0.5) * ((d - 2) / 5);
          B.ibox(k === 2 ? "i_lit" : "i_glass", 0.08, h - 2.4, (d - 2) / 5 - 0.3, front + 0.24, 0.4 + (h - 1.6) / 2 + 0.2, z, "#ffffff");
        }
        B.box("plain", 1.6, 0.2, 10, front + 0.8, 0.4 + 4.2, cz, "#62bb2a");
        B.box("plain", 0.4, 3.6, 14.4, front - 0.6, 0.4 + h + 2.4, cz, "#ffffff");
        addSign("GARAGE", "🏍️", "#1565c0", front - 0.38, 0.4 + h + 2.4, cz, Math.PI / 2, 14);
        // Flaggen
        for (const [fz, fc] of [
          [cz - 13, "#62bb2a"],
          [cz + 13, "#ff7a00"],
        ] as [number, string][]) {
          B.geo("metal", GEO.cyl8, front + 3.5, 0.4 + 3.5, fz, "#cccccc", 0, 0, 0, 0.06, 7, 0.06);
          B.box("plain", 0.05, 1.2, 2, front + 3.5, 0.4 + 6.2, fz + 1.05, fc);
          addCol(front + 3.5, fz, 0.15);
        }
        // Podeste mit Ausstellungs-Fahrzeugen
        for (const [pz, id] of [
          [cz - 7, "ninja650"],
          [cz + 7, "golf"],
        ] as [number, string][]) {
          const pr = id === "golf" ? 2.6 : 1.4;
          B.geo("metal", GEO.cyl24, front + 2.5, 0.55, pz, "#e0e0e0", 0, 0, 0, pr, 0.3, pr);
          B.geo("glow", GEO.cyl24, front + 2.5, 0.71, pz, "#7cf2ff", 0, 0, 0, pr + 0.02, 0.03, pr + 0.02);
          displays.push({ x: front + 2.5, z: pz, heading: Math.PI / 2 + 0.5, id });
          addCol(front + 2.5, pz, id === "golf" ? 2.4 : 1.3);
        }
        for (let k = 0; k < 4; k++) tree(x0 + SIDE + 2.5, z0 + 6 + k * 8, 0.4, 0.9);
        colliders.push({ minX: hx - w / 2, maxX: hx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
        houseBoxes.push({ minX: hx - w / 2, maxX: hx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
        garage = { x: x1 + 3.5, z: cz };
        spawn = { x: x1 + 3.5, z: cz + 12, heading: 0 };
        continue;
      }

      // ---------- Besondere Gebäude ----------
      const special = SPECIALS[`${i},${j}`];
      if (special) {
        special(ctx, { x0, z0, x1, z1, cx, cz });
        continue;
      }

      // ---------- Park ----------
      if (r() < 0.12) {
        parkRects.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1 });
        B.box("grass", INNER, 0.12, INNER, cx, 0.36, cz, "#ffffff");
        B.box("concrete", INNER, 0.03, 2.2, cx, 0.43, cz, "#e8dcc4");
        B.box("concrete", 2.2, 0.03, INNER, cx, 0.43, cz, "#e8dcc4");
        if (r() < 0.5) {
          // Brunnen
          B.geo("concrete", GEO.cyl24, cx, 0.65, cz, "#cfcfcf", 0, 0, 0, 3.4, 0.5, 3.4);
          B.geo("water", GEO.cyl24, cx, 0.72, cz, "#4fb3e8", 0, 0, 0, 3.0, 0.5, 3.0);
          B.geo("concrete", GEO.cyl16, cx, 1.5, cz, "#cfcfcf", 0, 0, 0, 0.35, 1.8, 0.35);
          B.geo("concrete", GEO.cyl24, cx, 2.4, cz, "#cfcfcf", 0, 0, 0, 1.1, 0.2, 1.1);
          B.geo("water", GEO.sphere, cx, 2.7, cz, "#bfe9ff", 0, 0, 0, 0.5, 0.45, 0.5);
          addCol(cx, cz, 3.2);
        } else {
          // Teich
          const px = cx + 8;
          const pz = cz + 8;
          B.geo("concrete", GEO.cyl24, px, 0.45, pz, "#bdbdbd", 0, 0, 0, 5.5, 0.12, 4);
          B.geo("water", GEO.cyl24, px, 0.47, pz, "#3fa7d6", 0, 0, 0, 5.1, 0.12, 3.6);
          for (let k = 0; k < 3; k++) B.geo("leaf", GEO.cyl16, px + (r() - 0.5) * 6, 0.54, pz + (r() - 0.5) * 4, "#4caf50", 0, 0, 0, 0.4, 0.02, 0.4);
        }
        for (let t = 0; t < 10; t++) {
          const tx = x0 + SIDE + 2 + r() * (INNER - 4);
          const tz = z0 + SIDE + 2 + r() * (INNER - 4);
          if (Math.abs(tx - cx) < 3 || Math.abs(tz - cz) < 3) continue;
          if (Math.hypot(tx - cx - 8, tz - cz - 8) < 7) continue;
          tree(tx, tz, 0.42, 0.85 + r() * 0.5);
        }
        for (let k = 0; k < 6; k++) bush(x0 + SIDE + 1 + r() * (INNER - 2), z0 + SIDE + 1 + r() * (INNER - 2), 0.42, 0.8);
        bench(cx - 6, cz + 1.8, true);
        bench(cx + 1.8, cz - 6, false);
        continue;
      }

      for (let a = 0; a < 2; a++) {
        for (let b = 0; b < 2; b++) {
          lots.push({
            lx: x0 + SIDE + LOT * (a + 0.5),
            lz: z0 + SIDE + LOT * (b + 0.5),
            dir: a === 0 ? -1 : 1,
            edgeX: a === 0 ? x0 : x1,
          });
        }
      }
    }
  }

  // Restaurants zufällig (aber fest) verteilen
  const order = lots.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const k = Math.floor(r() * (i + 1));
    [order[i], order[k]] = [order[k], order[i]];
  }
  const restaurantLots = new Map<number, number>();
  order.slice(0, RESTAURANTS.length).forEach((lotIdx, n) => restaurantLots.set(lotIdx, n));

  const familyHouse = (lot: Lot) => {
    const { lx, lz, dir } = lot;
    const floors = r() < 0.45 ? 2 : 1;
    const w = 7.5 + r() * 2;
    const d = 8 + r() * 3;
    const hx = lx - dir * 1.2;
    const wallKey = pick(["plaster", "plaster", "siding", "brick"]);
    const wallColor = wallKey === "brick" ? pick(BRICKS) : pick(WALLS);
    const roofColor = pick(ROOFS);
    const frame = r() < 0.7 ? "#ffffff" : "#5a3e2b";
    const shutters = r() < 0.4 ? pick(SHUTTERS) : undefined;
    const h = floors * 3;
    const y0 = 0.4;

    B.box("concrete", w + 0.25, 0.4, d + 0.25, hx, y0 + 0.1, lz, "#a5a5a5");
    B.box(wallKey, w, h, d, hx, y0 + h / 2, lz, wallColor);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.box("plain", 0.18, h, 0.18, hx + sx * (w / 2), y0 + h / 2, lz + sz * (d / 2), "#f5f5f5");
    if (floors === 2) B.box("plain", w + 0.1, 0.14, d + 0.1, hx, y0 + 3, lz, "#f5f5f5");

    // Giebeldach
    const top = y0 + h;
    const ov = 0.5;
    const rh = 2.2 + r() * 1.2;
    const halfW = w / 2 + ov;
    const slope = Math.atan2(rh, w / 2);
    const len = halfW / Math.cos(slope);
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2, 0);
    shape.lineTo(w / 2, 0);
    shape.lineTo(0, rh);
    shape.closePath();
    const gable = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
    B.geo(wallKey, gable, hx, top, lz - d / 2, wallColor);
    gable.dispose();
    for (const s of [-1, 1]) {
      B.box("roof", len, 0.18, d + 2 * ov, hx + (s * halfW) / 2, top + rh / 2 - (ov * rh) / w + 0.08, lz, roofColor, 0, 0, -s * slope);
      B.box("plain", 0.08, 0.28, d + 2 * ov, hx + s * halfW * 0.98, top - (ov * rh) / (w / 2) + 0.02, lz, "#f0f0f0");
    }
    B.box("roof", 0.35, 0.16, d + 2 * ov, hx, top + rh + 0.06, lz, roofColor);
    // Schornstein
    const chx = hx + (r() < 0.5 ? -1 : 1) * w * 0.22;
    const chz = lz + (r() - 0.5) * d * 0.5;
    B.box("brick", 0.75, rh + 0.6, 0.75, chx, top + (rh + 0.6) / 2 + 0.2, chz, "#9c4a3a");
    B.box("plain", 0.9, 0.12, 0.9, chx, top + rh + 0.86, chz, "#5a5a5a");
    // Dachfenster an den Giebeln
    for (const s of [-1, 1]) win("z", lz + s * (d / 2), s, hx, top + rh * 0.35, 0.8, 0.8, frame, { sill: false, cross: true });

    // Haustür
    const fx = hx + dir * (w / 2);
    const doorColor = pick(["#7a4b2a", "#2e5d8a", "#b71c1c", "#2e7d32", "#37474f", "#f5f5f5"]);
    B.box("plain", 0.14, 2.45, 1.4, fx + dir * 0.03, y0 + 1.22, lz, "#f5f5f5");
    B.box("wood", 0.12, 2.2, 1.1, fx + dir * 0.07, y0 + 1.1, lz, doorColor);
    B.box("chrome", 0.06, 0.06, 0.06, fx + dir * 0.15, y0 + 1.05, lz + 0.38, "#e0c060");
    B.box("concrete", 1.0, 0.22, 1.8, fx + dir * 0.5, y0 + 0.1, lz, "#bdbdbd");
    B.box("plain", 1.3, 0.12, 2.2, fx + dir * 0.65, y0 + 2.75, lz, roofColor);
    B.box("glow", 0.12, 0.22, 0.12, fx + dir * 0.12, y0 + 2.0, lz + 1.0, "#ffe9a8");
    // Weg & Briefkasten
    const pathStart = fx + dir * 1.0;
    const pathEnd = lx + dir * (LOT / 2);
    B.box("concrete", Math.abs(pathEnd - pathStart), 0.05, 1.3, (pathStart + pathEnd) / 2, 0.43, lz, "#d0cdc6");
    const mbx = lx + dir * (LOT / 2 - 0.4);
    B.box("wood", 0.08, 1.0, 0.08, mbx, 0.9, lz + 1.5, "#6b4a2f");
    B.box("paintGloss", 0.3, 0.26, 0.45, mbx, 1.5, lz + 1.5, pick(["#1565c0", "#c62828", "#2e7d32", "#333333"]));

    // Fenster
    for (let f = 0; f < floors; f++) {
      const y = y0 + f * 3 + 1.6;
      const front = f === 0 ? [-0.3, 0.3] : [-0.3, 0, 0.3];
      for (const k of front) win("x", fx, dir, lz + k * d, y, 1.2, 1.3, frame, { shutters, cross: true });
      for (const s of [-1, 1]) for (const k of [-0.22, 0.22]) win("z", lz + s * (d / 2), s, hx + k * w, y, 1.1, 1.2, frame, { cross: true });
      for (const k of [-0.25, 0.25]) win("x", hx - dir * (w / 2), -dir, lz + k * d, y, 1.1, 1.2, frame, { cross: true });
    }

    // Garten: Hecke, Zaun, Büsche, Baum
    const backX = lx - dir * (LOT / 2 - 0.4);
    B.box("leaf", 0.7, 1.0, LOT - 0.8, backX, 0.9, lz, "#3f8f3a");
    const frontLimit = lx + dir * (LOT / 2 - 2.4);
    for (const s of [-1, 1]) B.box("leaf", Math.abs(frontLimit - backX), 1.0, 0.7, (frontLimit + backX) / 2, 0.9, lz + s * (LOT / 2 - 0.4), "#3f8f3a");
    const fenceX = lx + dir * (LOT / 2 - 0.25);
    for (let z = lz - LOT / 2 + 0.6; z <= lz + LOT / 2 - 0.6; z += 1.2) {
      if (Math.abs(z - lz) < 1) continue;
      B.ibox("i_frame", 0.1, 0.9, 0.1, fenceX, 0.85, z, "#f5f5f5");
    }
    for (const s of [-1, 1]) {
      const za = lz + s * 1;
      const zb = lz + s * (LOT / 2 - 0.5);
      for (const yy of [0.7, 1.1]) B.box("plain", 0.06, 0.08, Math.abs(zb - za), fenceX, yy, (za + zb) / 2, "#f5f5f5");
    }
    bush(fx + dir * 0.9, lz - 1.8, 0.4, 0.8);
    bush(fx + dir * 0.9, lz + 1.8, 0.4, 0.8);
    if (r() < 0.6) tree(lx - dir * (LOT / 2 - 2), lz + (r() < 0.5 ? -1 : 1) * (LOT / 2 - 2.2), 0.4, 0.8 + r() * 0.3);

    const box = { minX: hx - w / 2, maxX: hx + w / 2, minZ: lz - d / 2, maxZ: lz + d / 2 };
    colliders.push(box);
    houseBoxes.push(box);
  };

  const apartment = (lot: Lot) => {
    const { lx, lz, dir } = lot;
    const floors = 3 + Math.floor(r() * 5);
    const fh = 3;
    const h = floors * fh + 0.6;
    const w = 10 + r() * 2;
    const d = 11 + r() * 2.5;
    const hx = lx - dir * 0.8;
    const y0 = 0.4;
    const wallKey = r() < 0.5 ? "brick" : "plaster";
    const wallColor = wallKey === "brick" ? pick(BRICKS) : pick(WALLS);
    const band = r() < 0.5 ? "#f0f0f0" : "#cfcfcf";
    const frame = pick(["#ffffff", "#3a3a3a", "#e0e0e0"]);
    B.box(wallKey, w, h, d, hx, y0 + h / 2, lz, wallColor);
    B.box("plain", w + 0.25, 1.0, d + 0.25, hx, y0 + 0.5, lz, "#8a8a8a");
    for (let f = 1; f < floors; f++) B.box("plain", w + 0.14, 0.14, d + 0.14, hx, y0 + f * fh, lz, band);
    // Dach
    const top = y0 + h;
    B.box("plain", w + 0.3, 0.3, d + 0.3, hx, top + 0.15, lz, band);
    B.box("plain", w + 0.3, 0.9, 0.25, hx, top + 0.6, lz - d / 2, band);
    B.box("plain", w + 0.3, 0.9, 0.25, hx, top + 0.6, lz + d / 2, band);
    B.box("plain", 0.25, 0.9, d + 0.3, hx - w / 2, top + 0.6, lz, band);
    B.box("plain", 0.25, 0.9, d + 0.3, hx + w / 2, top + 0.6, lz, band);
    B.box("metal", 1.4, 1.0, 1.0, hx - dir * 2, top + 0.8, lz - 2, "#b0b0b0");
    B.geo("metal", GEO.cyl16, hx - dir * 2, top + 1.32, lz - 2, "#333333", 0, 0, 0, 0.35, 0.05, 0.35);
    B.geo("metal", GEO.cyl16, hx + dir * 1.5, top + 1.8, lz + 2.5, "#7d8a96", 0, 0, 0, 1.0, 2.2, 1.0);
    B.geo("metal", GEO.cyl8, hx, top + 2.5, lz, "#555555", 0, 0, 0, 0.04, 4, 0.04);
    // Eingang
    const fx = hx + dir * (w / 2);
    B.ibox("i_frame", 0.1, 2.6, 2.4, fx + dir * 0.03, y0 + 1.3, lz, "#2b2b2b");
    B.ibox("i_glass", 0.06, 2.4, 2.1, fx + dir * 0.08, y0 + 1.25, lz, "#9cc3dd");
    B.box("plain", 1.6, 0.15, 3.2, fx + dir * 0.8, y0 + 2.9, lz, "#333333");
    B.box("glow", 0.15, 0.25, 0.15, fx + dir * 0.1, y0 + 2.2, lz + 1.5, "#ffe9a8");
    B.box("glow", 0.15, 0.25, 0.15, fx + dir * 0.1, y0 + 2.2, lz - 1.5, "#ffe9a8");
    B.box("concrete", Math.abs(lx + dir * (LOT / 2) - fx), 0.05, 2.4, (lx + dir * (LOT / 2) + fx) / 2, 0.43, lz, "#d0cdc6");
    // Fenster & Balkone
    const nf = Math.max(3, Math.floor(d / 2.6));
    const ns = Math.max(2, Math.floor(w / 2.6));
    for (let f = 0; f < floors; f++) {
      const base = y0 + f * fh;
      const y = base + 1.7;
      for (let k = 0; k < nf; k++) {
        const along = lz - d / 2 + (k + 0.5) * (d / nf);
        if (f === 0 && Math.abs(along - lz) < 1.8) continue;
        const balcony = f > 0 && (k === 0 || k === nf - 1);
        if (balcony) {
          const bw = (d / nf) * 0.85;
          win("x", fx, dir, along, base + 1.3, 1.1, 2.2, frame, { sill: false });
          B.box("concrete", 1.3, 0.14, bw, fx + dir * 0.65, base + 0.07, along, "#cfcfcf");
          B.ibox("i_glass", 0.05, 0.85, bw, fx + dir * 1.25, base + 0.6, along, "#a9d4ea");
          B.ibox("i_frame", 0.07, 0.07, bw, fx + dir * 1.25, base + 1.05, along, "#555555");
          for (const s of [-1, 1]) B.ibox("i_frame", 1.2, 0.07, 0.07, fx + dir * 0.65, base + 1.05, along + (s * bw) / 2, "#555555");
          if (r() < 0.5) bush(fx + dir * 1.0, along + bw * 0.3, base + 0.1, 0.4);
        } else {
          win("x", fx, dir, along, y, 1.3, 1.5, frame);
        }
        win("x", hx - dir * (w / 2), -dir, along, y, 1.3, 1.5, frame);
      }
      for (let k = 0; k < ns; k++) {
        const along = hx - w / 2 + (k + 0.5) * (w / ns);
        for (const s of [-1, 1]) win("z", lz + s * (d / 2), s, along, y, 1.3, 1.5, frame);
      }
    }
    bush(fx + dir * 0.9, lz - 2.2, 0.4, 0.9);
    bush(fx + dir * 0.9, lz + 2.2, 0.4, 0.9);
    const box = { minX: hx - w / 2, maxX: hx + w / 2, minZ: lz - d / 2, maxZ: lz + d / 2 };
    colliders.push(box);
    houseBoxes.push(box);
  };

  const restaurant = (lot: Lot, n: number) => {
    const { lx, lz, dir, edgeX } = lot;
    const [name, emoji, color] = RESTAURANTS[n];
    const w = 11.5;
    const d = 13.5;
    const h = 5.6;
    const hx = lx - dir * 0.6;
    const y0 = 0.4;
    const light = new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.55).getStyle();
    const dark = new THREE.Color(color).multiplyScalar(0.6).getStyle();
    B.box("concrete", w + 4, 0.06, d, hx + dir * 2, 0.43, lz, "#e6ddd0");
    B.box("plaster", w, h, d, hx, y0 + h / 2, lz, light);
    B.box("plain", w + 0.1, 0.8, d + 0.1, hx, y0 + 0.4, lz, dark);
    B.box("plain", w + 0.3, 0.7, d + 0.3, hx, y0 + h + 0.35, lz, color);
    const fx = hx + dir * (w / 2);
    // Schaufenster
    B.box("plain", 0.2, 3.3, d - 1.6, fx + dir * 0.02, y0 + 1.95, lz, "#2b2b2b");
    const panes = [-1, 1];
    for (const s of panes) B.ibox("i_lit", 0.08, 2.7, d / 2 - 2.6, fx + dir * 0.13, y0 + 2.0, lz + s * (d / 4 + 0.55), "#ffffff");
    B.ibox("i_glass", 0.08, 2.6, 1.8, fx + dir * 0.13, y0 + 1.5, lz, "#9cc3dd");
    B.box("chrome", 0.06, 0.6, 0.05, fx + dir * 0.2, y0 + 1.3, lz + 0.6, "#dddddd");
    // Markise (gestreift)
    const segs = 8;
    for (let s = 0; s < segs; s++) {
      const z = lz - (d - 1) / 2 + (s + 0.5) * ((d - 1) / segs);
      B.box("plain", 2.0, 0.08, (d - 1) / segs, fx + dir * 1.0, y0 + 3.75, z, s % 2 ? "#ffffff" : color, 0, 0, -dir * 0.3);
      B.box("plain", 0.05, 0.35, (d - 1) / segs, fx + dir * 1.95, y0 + 3.3, z, s % 2 ? color : "#ffffff");
    }
    // Schild + Halterung
    const sx = hx + dir * (w / 2 - 1.2);
    for (const s of [-1, 1]) B.box("metal", 0.15, 1.2, 0.15, sx - dir * 0.1, y0 + h + 0.9, lz + s * 3.5, "#333333");
    B.box("plain", 0.3, 2.6, 10.4, sx, y0 + h + 2.3, lz, "#ffffff");
    addSign(name, emoji, color, sx + dir * 0.17, y0 + h + 2.3, lz, (dir * Math.PI) / 2, 10);
    // Essen auf dem Dach
    const prop = buildFoodProp(name);
    prop.position.set(hx - dir * 2, y0 + h + 0.7, lz);
    group.add(prop);
    spinners.push(prop);
    // Tische mit Sonnenschirm
    for (const s of [-1, 1]) {
      const tx = fx + dir * 2.0;
      const tz = lz + s * 4.6;
      B.geo("metal", GEO.cyl8, tx, 0.85, tz, "#444444", 0, 0, 0, 0.05, 0.9, 0.05);
      B.geo("plain", GEO.cyl16, tx, 1.3, tz, "#ffffff", 0, 0, 0, 0.55, 0.05, 0.55);
      B.geo("metal", GEO.cyl8, tx, 1.9, tz, "#888888", 0, 0, 0, 0.03, 2.4, 0.03);
      B.geo("plain", GEO.cone8, tx, 3.0, tz, s > 0 ? color : "#ffffff", 0, 0, 0, 1.3, 0.55, 1.3);
      for (const c of [-1, 1]) B.box("wood", 0.45, 0.5, 0.45, tx, 0.65, tz + c * 0.8, "#8d6e63");
    }
    // Aufsteller
    B.box("plain", 0.08, 1.0, 0.6, fx + dir * 1.4, 0.9, lz + 1.6, "#222222", 0, 0, dir * 0.15);
    B.box("plain", 0.02, 0.6, 0.45, fx + dir * 1.45, 1.0, lz + 1.6, "#f5f5f5", 0, 0, dir * 0.15);
    bush(fx + dir * 0.5, lz + 2.4, 0.4, 0.6);
    bush(fx + dir * 0.5, lz - 2.4, 0.4, 0.6);
    const box = { minX: hx - w / 2, maxX: hx + w / 2, minZ: lz - d / 2, maxZ: lz + d / 2 };
    colliders.push(box);
    houseBoxes.push(box);
    restaurants.push({ name, emoji, color, door: { x: edgeX + dir * 3.5, z: lz } });
  };

  lots.forEach((lot, idx) => {
    B.box("grass", LOT - 0.4, 0.1, LOT - 0.4, lot.lx, 0.35, lot.lz, "#ffffff");
    const rn = restaurantLots.get(idx);
    if (rn !== undefined) {
      restaurant(lot, rn);
      return;
    }
    const kind = r();
    if (kind < 0.36) familyHouse(lot);
    else if (kind < 0.54) apartment(lot);
    else if (kind < 0.7) BLD.modernVilla(ctx, lot, LOT);
    else if (kind < 0.86) BLD.shopHouse(ctx, lot);
    else BLD.bungalow(ctx, lot, LOT);
    houses.push({
      door: { x: lot.edgeX + lot.dir * 3.5, z: lot.lz },
      stand: { x: lot.edgeX - lot.dir * 1.3, z: lot.lz + 1.6 },
      heading: (lot.dir * Math.PI) / 2,
    });
  });

  // ---------------- Jump-Park ----------------
  const park = buildJumpPark(B, PARK_RECT, colliders, addSign);
  const stadium = BLD.stadium(ctx, STADIUM_RECT);

  // ---------------- Geldautomat in der Mitte (Ecke an der zentralen Kreuzung) ----------------
  const atmX = ROAD / 2 + 1.3;
  const atmZ = ROAD / 2 + 4.5;
  B.box("plain", 1.6, 0.15, 1.6, atmX + 0.2, 0.37, atmZ, "#ffd600");
  B.box("paintGloss", 0.9, 2.2, 1.3, atmX + 0.3, 0.3 + 1.1, atmZ, "#0d47a1");
  B.box("plain", 0.1, 0.5, 0.8, atmX - 0.17, 0.3 + 1.55, atmZ, "#111111");
  B.box("glow", 0.02, 0.4, 0.7, atmX - 0.23, 0.3 + 1.55, atmZ, "#4fc3f7");
  B.box("plain", 0.25, 0.08, 0.6, atmX - 0.25, 0.3 + 1.05, atmZ, "#90a4ae", 0, 0, 0.4);
  B.box("plain", 0.08, 0.03, 0.4, atmX - 0.2, 0.3 + 0.8, atmZ, "#111111");
  B.box("glow", 0.95, 0.35, 1.35, atmX + 0.3, 0.3 + 2.4, atmZ, "#ffd600");
  addSign("GELD", "💶", "#2e7d32", atmX - 0.16, 0.3 + 2.4, atmZ, -Math.PI / 2, 1.3);
  colliders.push({ minX: atmX - 0.2, maxX: atmX + 0.8, minZ: atmZ - 0.7, maxZ: atmZ + 0.7 });
  const atm = { x: atmX - 2.2, z: atmZ };

  // ---------------- Wald & Hügel außen ----------------
  for (let p = -LIMIT - 10; p <= LIMIT + 10; p += 9) {
    for (const off of [LIMIT - 6, LIMIT + 4, LIMIT + 14]) {
      for (const [x, z] of [
        [p, -off],
        [p, off],
        [-off, p],
        [off, p],
      ]) {
        tree(x + (r() - 0.5) * 5, z + (r() - 0.5) * 5, 0, 1.1 + r() * 0.5, false);
      }
    }
  }
  const hills = new Builder();
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * Math.PI * 2 + r() * 0.2;
    const dist = 520 + r() * 220;
    const s = 60 + r() * 80;
    hills.geo("leaf", GEO.ico1, Math.cos(a) * dist, -s * 0.35, Math.sin(a) * dist, pick(["#4f9a3f", "#5aa548", "#468a3a"]), r(), r(), 0, s, s * (0.45 + r() * 0.3), s);
  }
  for (const o of hills.build({ shadows: false })) group.add(o);

  // ---------------- Wolken ----------------
  const C = new Builder();
  for (let i = 0; i < 30; i++) {
    const x = (r() - 0.5) * 1100;
    const z = (r() - 0.5) * 1100;
    const y = 90 + r() * 50;
    const s = 8 + r() * 10;
    for (let k = 0; k < 5; k++) {
      C.geo("cloud", GEO.ico1, x + (k - 2) * s * 0.7, y + (k % 2) * s * 0.3, z + (r() - 0.5) * s, "#ffffff", 0, 0, 0, s * (0.7 + r() * 0.4), s * 0.5, s * 0.7);
    }
  }
  for (const o of C.build({ shadows: false })) group.add(o);

  for (const o of B.build()) group.add(o);

  return { group, colliders, houseBoxes, restaurants, houses, garage, spawn, blockRects, parkRects, spinners, displays, park, stadium, animators, atm };
}
