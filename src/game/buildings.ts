import * as THREE from "three";
import { Builder, GEO } from "./builder";
import { buildCar } from "./models";
import type { Rect } from "./jumppark";
import type { House } from "./world";

const SIDE = 2.5;

export interface Ctx {
  B: Builder;
  r: () => number;
  pick: <T>(a: T[]) => T;
  colliders: Rect[];
  houseBoxes: Rect[];
  houses: House[];
  group: THREE.Group;
  animators: ((dt: number, t: number) => void)[];
  addSign: (text: string, emoji: string, color: string, x: number, y: number, z: number, angle: number, w: number) => void;
  win: (
    axis: "x" | "z",
    face: number,
    sign: number,
    along: number,
    y: number,
    ww: number,
    wh: number,
    frame: string,
    opts?: { shutters?: string; cross?: boolean; sill?: boolean },
  ) => void;
  tree: (x: number, z: number, y0: number, s?: number, detail?: boolean) => void;
  bush: (x: number, z: number, y0: number, s?: number) => void;
  bench: (x: number, z: number, alongX: boolean) => void;
}

export interface Area {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  cx: number;
  cz: number;
}

export interface Lot {
  lx: number;
  lz: number;
  dir: number;
  edgeX: number;
}

export interface StadiumInfo {
  cx: number;
  cz: number;
  /** Ball-Spielfeld (halbe Breite x / z bis zu den Tribünen) */
  halfX: number;
  halfZ: number;
  goalX: number;
  goalHalf: number;
  /** halbe Spielfeldbreite (Seitenlinie) */
  pitchHalfZ: number;
}

const CAR_COLORS = ["#e53935", "#1e88e5", "#fdd835", "#43a047", "#f5f5f5", "#212121", "#8e24aa", "#fb8c00", "#90a4ae"];

function rectAt(x: number, z: number, w: number, d: number): Rect {
  return { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 };
}

/** Quader + Kollision + Minimap */
function solid(c: Ctx, key: string, w: number, h: number, d: number, x: number, y: number, z: number, color: string, minimap = true) {
  c.B.box(key, w, h, d, x, y, z, color);
  const b = rectAt(x, z, w, d);
  c.colliders.push(b);
  if (minimap) c.houseBoxes.push(b);
}

function placeCar(c: Ctx, x: number, z: number, heading: number, color?: string, type: "sedan" | "van" | "taxi" = "sedan") {
  const car = buildCar(color ?? c.pick(CAR_COLORS), type);
  car.position.set(x, 0.4, z);
  car.rotation.y = heading;
  c.group.add(car);
  const along = Math.abs(Math.sin(heading)) > 0.5;
  c.colliders.push(rectAt(x, z, along ? 4.4 : 1.9, along ? 1.9 : 4.4));
}

/** Lieferpunkt an der Ostseite eines Blocks */
function deliveryEast(c: Ctx, A: Area, z = A.cz) {
  c.houses.push({ door: { x: A.x1 + 3.5, z }, stand: { x: A.x1 - 1.3, z: z + 1.6 }, heading: Math.PI / 2 });
}

export function gableRoof(c: Ctx, wallKey: string, hx: number, top: number, cz: number, w: number, d: number, rh: number, wallColor: string, roofColor: string, ov = 0.5) {
  const B = c.B;
  const halfW = w / 2 + ov;
  const slope = Math.atan2(rh, w / 2);
  const len = halfW / Math.cos(slope);
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0);
  shape.lineTo(w / 2, 0);
  shape.lineTo(0, rh);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
  B.geo(wallKey, g, hx, top, cz - d / 2, wallColor);
  g.dispose();
  for (const s of [-1, 1]) B.box("roof", len, 0.18, d + 2 * ov, hx + (s * halfW) / 2, top + rh / 2 - (ov * rh) / w + 0.08, cz, roofColor, 0, 0, -s * slope);
  B.box("roof", 0.35, 0.16, d + 2 * ov, hx, top + rh + 0.06, cz, roofColor);
}

function clock(c: Ctx, x: number, y: number, z: number, axis: "x" | "z", size = 0.9) {
  const B = c.B;
  if (axis === "x") {
    B.geo("plain", GEO.cyl24, x, y, z, "#333333", 0, 0, Math.PI / 2, size + 0.12, 0.08, size + 0.12);
    B.geo("glow", GEO.cyl24, x + 0.03, y, z, "#fffdf0", 0, 0, Math.PI / 2, size, 0.08, size);
    B.box("plain", 0.1, size * 0.7, 0.08, x + 0.08, y + size * 0.3, z, "#222222");
    B.box("plain", 0.1, 0.08, size * 0.55, x + 0.08, y, z + size * 0.25, "#222222");
  } else {
    B.geo("plain", GEO.cyl24, x, y, z, "#333333", Math.PI / 2, 0, 0, size + 0.12, 0.08, size + 0.12);
    B.geo("glow", GEO.cyl24, x, y, z + 0.03, "#fffdf0", Math.PI / 2, 0, 0, size, 0.08, size);
    B.box("plain", 0.08, size * 0.7, 0.1, x, y + size * 0.3, z + 0.08, "#222222");
    B.box("plain", size * 0.55, 0.08, 0.1, x + size * 0.25, y, z + 0.08, "#222222");
  }
}

function fence(c: Ctx, A: Area, gapZ: number) {
  const ix0 = A.x0 + SIDE - 0.3;
  const ix1 = A.x1 - SIDE + 0.3;
  const iz0 = A.z0 + SIDE - 0.3;
  const iz1 = A.z1 - SIDE + 0.3;
  const post = (x: number, z: number) => c.B.ibox("i_frame", 0.1, 2, 0.1, x, 1.4, z, "#7a858f");
  for (let x = ix0; x <= ix1; x += 3) {
    post(x, iz0);
    post(x, iz1);
  }
  for (let z = iz0; z <= iz1; z += 3) {
    post(ix0, z);
    if (Math.abs(z - gapZ) > 4) post(ix1, z);
  }
  for (const y of [0.6, 2.3]) {
    c.B.box("metal", ix1 - ix0, 0.05, 0.05, A.cx, y, iz0, "#7a858f");
    c.B.box("metal", ix1 - ix0, 0.05, 0.05, A.cx, y, iz1, "#7a858f");
    c.B.box("metal", 0.05, 0.05, iz1 - iz0, ix0, y, A.cz, "#7a858f");
    const za = gapZ - 4;
    const zb = gapZ + 4;
    c.B.box("metal", 0.05, 0.05, za - iz0, ix1, y, (iz0 + za) / 2, "#7a858f");
    c.B.box("metal", 0.05, 0.05, iz1 - zb, ix1, y, (iz1 + zb) / 2, "#7a858f");
  }
}

// =====================================================================
//  Fabrik
// =====================================================================
export function factory(c: Ctx, A: Area) {
  const { B } = c;
  const ix0 = A.x0 + SIDE;
  const ix1 = A.x1 - SIDE;
  const iz1 = A.z1 - SIDE;
  B.box("concrete", ix1 - ix0, 0.1, A.z1 - A.z0 - 2 * SIDE, A.cx, 0.35, A.cz, "#a3a3a3");
  const w = 18;
  const d = 24;
  const h = 9;
  const hx = ix0 + 2 + w / 2;
  const hz = A.cz - 1.5;
  solid(c, "siding", w, h, d, hx, 0.4 + h / 2, hz, "#c5d0da");
  B.box("plain", w, 0.2, d, hx, 0.4 + h, hz, "#6f7a85");
  for (let k = 0; k < 4; k++) {
    const zk = hz - d / 2 + (k + 0.5) * (d / 4);
    B.box("metal", w + 0.3, 0.2, (d / 4) * 1.05, hx, 0.4 + h + 1.0, zk, "#7d8994", -0.38);
    B.box("glass", w, 1.9, 0.12, hx, 0.4 + h + 0.95, zk + d / 8 - 0.05, "#9cc3dd");
  }
  const fx = hx + w / 2;
  for (const s of [-1, 1]) {
    B.box("plain", 0.15, 4.6, 4.2, fx + 0.05, 0.4 + 2.3, hz + s * 5, "#5f6b77");
    for (let k = 0; k < 9; k++) B.ibox("i_frame", 0.05, 0.06, 4.1, fx + 0.14, 0.6 + k * 0.5, hz + s * 5, "#46505a");
    for (let k = 0; k < 6; k++) B.box("plain", 0.6, 0.12, 0.7, fx + 0.3, 0.46, hz + s * 5 - 1.75 + k * 0.7, k % 2 ? "#111111" : "#ffd600");
  }
  for (let x = hx - w / 2 + 1.5; x < hx + w / 2 - 1; x += 2.5) {
    for (const s of [-1, 1]) B.ibox("i_glass", 1.8, 1.2, 0.08, x, 0.4 + 6.5, hz + s * (d / 2 + 0.04), "#9cc3dd");
  }
  c.addSign("FABRIK", "🏭", "#546e7a", fx + 0.25, 0.4 + h + 3.5, hz, Math.PI / 2, 10);
  B.box("plain", 0.3, 2.6, 10.4, fx + 0.05, 0.4 + h + 3.5, hz, "#ffffff");

  // Schornsteine mit Rauch
  const puffGeo = new THREE.IcosahedronGeometry(1, 1);
  const puffMat = new THREE.MeshStandardMaterial({ color: "#dcdcdc", transparent: true, opacity: 0.75, roughness: 1, depthWrite: false });
  for (const [x, z] of [
    [ix0 + 3.5, iz1 - 2],
    [ix0 + 8.5, iz1 - 2],
  ]) {
    B.geo("brick", GEO.cyl16, x, 0.4 + 12, z, "#9c4a3a", 0, 0, 0, 1.1, 24, 1.1);
    B.geo("plain", GEO.cyl16, x, 0.4 + 21, z, "#ffffff", 0, 0, 0, 1.16, 1.2, 1.16);
    B.geo("plain", GEO.cyl16, x, 0.4 + 22.6, z, "#e53935", 0, 0, 0, 1.16, 1.2, 1.16);
    c.colliders.push(rectAt(x, z, 2.4, 2.4));
    c.houseBoxes.push(rectAt(x, z, 2.4, 2.4));
    const puffs: THREE.Mesh[] = [];
    for (let k = 0; k < 7; k++) {
      const m = new THREE.Mesh(puffGeo, puffMat);
      c.group.add(m);
      puffs.push(m);
    }
    const top = 0.4 + 24;
    c.animators.push((_dt, t) => {
      puffs.forEach((m, k) => {
        const p = (t * 0.12 + k / puffs.length + x * 0.01) % 1;
        m.position.set(x + p * 6, top + p * 16, z + p * 2.5);
        m.scale.setScalar(0.8 + p * 3.2);
      });
    });
  }
  // Silos + Rohre
  for (const z of [A.cz + 2, A.cz + 7.5, A.cz + 13]) {
    const x = ix1 - 3;
    B.geo("metal", GEO.cyl24, x, 0.4 + 6, z, "#d0d6dc", 0, 0, 0, 2, 12, 2);
    B.geo("metal", GEO.cone8, x, 0.4 + 12.8, z, "#b0b8c0", 0, 0, 0, 2.05, 1.6, 2.05);
    for (const y of [3, 7, 11]) B.geo("metal", GEO.cyl24, x, 0.4 + y, z, "#9aa4ad", 0, 0, 0, 2.04, 0.15, 2.04);
    c.colliders.push(rectAt(x, z, 4.2, 4.2));
    c.houseBoxes.push(rectAt(x, z, 4.2, 4.2));
  }
  B.geo("metal", GEO.cyl8, (fx + ix1 - 5) / 2, 0.4 + 8, A.cz + 7.5, "#8a8a8a", 0, 0, Math.PI / 2, 0.3, ix1 - 5 - fx, 0.3);
  // Container
  B.box("plain", 6, 2.6, 2.4, ix1 - 5, 0.4 + 1.3, A.z0 + SIDE + 2.5, "#c62828");
  B.box("plain", 6, 2.6, 2.4, ix1 - 5, 0.4 + 3.9, A.z0 + SIDE + 2.5, "#1565c0");
  B.box("plain", 6, 2.6, 2.4, ix1 - 5, 0.4 + 1.3, A.z0 + SIDE + 5.2, "#2e7d32");
  c.colliders.push(rectAt(ix1 - 5, A.z0 + SIDE + 3.85, 6, 5.1));
  placeCar(c, fx + 5, hz - 5, -Math.PI / 2, "#1565c0", "van");
  fence(c, A, hz);
  deliveryEast(c, A, hz);
}

// =====================================================================
//  Fußballstadion (2x2 Blocks)
// =====================================================================
export function stadium(c: Ctx, R: Rect): StadiumInfo {
  const { B } = c;
  const cx = (R.minX + R.maxX) / 2;
  const cz = (R.minZ + R.maxZ) / 2;
  const W = R.maxX - R.minX;
  const D = R.maxZ - R.minZ;
  B.box("concrete", W, 0.05, D, cx, 0.025, cz, "#b7b2a8");
  // Rasen mit Streifen
  const PX = 47;
  const PZ = 30;
  B.box("grass", PX * 2 + 6, 0.06, PZ * 2 + 4, cx, 0.06, cz, "#ffffff");
  for (let k = 0; k < 16; k++) {
    const x = cx - PX + (k + 0.5) * ((PX * 2) / 16);
    B.box("plain", (PX * 2) / 16, 0.02, PZ * 2, x, 0.1, cz, k % 2 ? "#4f9e3a" : "#5bb045");
  }
  // Linien
  const line = (w: number, d: number, x: number, z: number) => B.ibox("i_paint", w, 0.02, d, x, 0.12, z, "#ffffff");
  const gx = PX - 2;
  const gz = PZ - 2;
  line(gx * 2, 0.15, cx, cz - gz);
  line(gx * 2, 0.15, cx, cz + gz);
  line(0.15, gz * 2, cx - gx, cz);
  line(0.15, gz * 2, cx + gx, cz);
  line(0.15, gz * 2, cx, cz);
  for (let k = 0; k < 64; k++) {
    const a = (k / 64) * Math.PI * 2;
    B.ibox("i_paint", 0.15, 0.02, 0.95, cx + Math.cos(a) * 9, 0.12, cz + Math.sin(a) * 9, "#ffffff", -a);
  }
  line(0.5, 0.5, cx, cz);
  for (const s of [-1, 1]) {
    const gl = cx + s * gx;
    line(0.15, 36, gl - s * 15, cz);
    line(15, 0.15, gl - s * 7.5, cz - 18);
    line(15, 0.15, gl - s * 7.5, cz + 18);
    line(0.15, 16, gl - s * 5.5, cz);
    line(5.5, 0.15, gl - s * 2.75, cz - 8);
    line(5.5, 0.15, gl - s * 2.75, cz + 8);
    line(0.4, 0.4, gl - s * 10, cz);
    // Tor
    for (const z of [-4, 4]) B.geo("paintGloss", GEO.cyl8, gl, 1.3, cz + z, "#ffffff", 0, 0, 0, 0.1, 2.6, 0.1);
    B.geo("paintGloss", GEO.cyl8, gl, 2.6, cz, "#ffffff", Math.PI / 2, 0, 0, 0.1, 8.1, 0.1);
    B.box("plain", 0.04, 2.5, 8, gl + s * 2, 1.3, cz, "#e8e8e8");
    for (const z of [-4, 4]) B.box("plain", 2, 2.5, 0.04, gl + s * 1, 1.3, cz + z, "#e8e8e8");
    B.box("plain", 2, 0.04, 8, gl + s * 1, 2.55, cz, "#e8e8e8");
  }

  // Tribünen
  const rows = 9;
  const step = 0.7;
  const depth = 1.1;
  const shirts = ["#e53935", "#1e88e5", "#fdd835", "#ffffff", "#43a047", "#ff9800", "#8e24aa", "#212121"];
  const stand = (alongX: boolean, sign: number, len: number, dist: number, seatColor: string, gap: boolean) => {
    const segs: [number, number][] = gap
      ? [
          [-len / 2, -4],
          [4, len / 2],
        ]
      : [[-len / 2, len / 2]];
    for (const [a, b] of segs) {
      const L = b - a;
      const mid = (a + b) / 2;
      for (let k = 0; k < rows; k++) {
        const off = dist + k * depth + depth / 2;
        const hgt = (k + 1) * step;
        const x = alongX ? cx + mid : cx + sign * off;
        const z = alongX ? cz + sign * off : cz + mid;
        B.box("concrete", alongX ? L : depth, hgt, alongX ? depth : L, x, hgt / 2, z, "#b9b9b9");
        const sx = alongX ? x : x - sign * 0.25;
        const sz = alongX ? z - sign * 0.25 : z;
        B.box("plain", alongX ? L : 0.45, 0.3, alongX ? 0.45 : L, sx, hgt + 0.15, sz, seatColor);
        // Zuschauer
        for (let p = a + 0.4; p < b - 0.3; p += 0.65) {
          if (c.r() > 0.45) continue;
          const px = alongX ? cx + p : sx;
          const pz = alongX ? sz : cz + p;
          B.ibox("i_plain", 0.4, 0.5, 0.3, px, hgt + 0.55, pz, c.pick(shirts));
          B.ibox("i_plain", 0.25, 0.25, 0.25, px, hgt + 0.95, pz, c.pick(["#f1c27d", "#e0ac69", "#c68642", "#8d5524"]));
        }
      }
      const back = dist + rows * depth;
      const totalH = rows * step;
      const bx = alongX ? cx + mid : cx + sign * (back + 0.3);
      const bz = alongX ? cz + sign * (back + 0.3) : cz + mid;
      B.box("concrete", alongX ? L : 0.6, totalH + 3.5, alongX ? 0.6 : L, bx, (totalH + 3.5) / 2, bz, "#9e9e9e");
      // Dach
      const roofOff = dist + rows * depth * 0.45;
      B.box("metal", alongX ? L : rows * depth * 0.95, 0.3, alongX ? rows * depth * 0.95 : L, alongX ? cx + mid : cx + sign * (roofOff + 1.3), totalH + 4.2, alongX ? cz + sign * (roofOff + 1.3) : cz + mid, "#eceff1", alongX ? sign * 0.08 : 0, 0, alongX ? 0 : -sign * 0.08);
      for (let p = a + 3; p < b; p += 9) {
        const px = alongX ? cx + p : cx + sign * (back + 0.3);
        const pz = alongX ? cz + sign * (back + 0.3) : cz + p;
        B.box("metal", 0.4, 4.4, 0.4, px, totalH + 2, pz, "#90a4ae");
      }
      // Kollision
      const n = dist;
      const f = back + 0.6;
      const col = alongX
        ? { minX: cx + a, maxX: cx + b, minZ: cz + Math.min(sign * n, sign * f), maxZ: cz + Math.max(sign * n, sign * f) }
        : { minX: cx + Math.min(sign * n, sign * f), maxX: cx + Math.max(sign * n, sign * f), minZ: cz + a, maxZ: cz + b };
      c.colliders.push(col);
      c.houseBoxes.push(col);
    }
  };
  const HZ = PZ + 2;
  const HX = PX + 3;
  stand(true, -1, HX * 2, HZ, "#e53935", true); // Süd mit Eingang
  stand(true, 1, HX * 2, HZ, "#1e88e5", false);
  stand(false, -1, HZ * 2, HX, "#fdd835", false);
  stand(false, 1, HZ * 2, HX, "#fdd835", false);

  // Flutlicht
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = cx + sx * (HX + 6);
      const z = cz + sz * (HZ + 8);
      B.geo("metal", GEO.cyl8, x, 14, z, "#78909c", 0, 0, 0, 0.35, 28, 0.35);
      B.box("metal", 4, 2.4, 0.4, x, 28.5, z, "#455a64", -sz * 0.35, sx * sz * 0.6, 0);
      B.box("glow", 3.6, 2.0, 0.1, x - sx * 0.15, 28.5, z - sz * 0.22, "#ffffff", -sz * 0.35, sx * sz * 0.6, 0);
      c.colliders.push(rectAt(x, z, 1, 1));
    }
  }
  // Anzeigetafel + Schild
  B.box("plain", 0.6, 4.5, 14, cx + HX + rows * depth + 1, rows * step + 6, cz, "#212121");
  c.addSign("LIEFERBLITZ FC", "⚽", "#0d47a1", cx + HX + rows * depth + 0.65, rows * step + 6, cz, -Math.PI / 2, 13);
  c.addSign("STADION", "⚽", "#2e7d32", cx, rows * step + 6.5, cz - HZ - rows * depth - 0.95, Math.PI, 14);
  B.box("plain", 14.4, 3.8, 0.3, cx, rows * step + 6.5, cz - HZ - rows * depth - 0.75, "#ffffff");
  // Eingangstunnel-Markierung
  B.box("plain", 8.4, 0.6, 0.6, cx, HZ * 0 + rows * step + 0.3, cz - HZ - 0.3, "#e53935");
  c.houses.push({ door: { x: cx, z: R.minZ - 3.5 }, stand: { x: cx + 1.6, z: R.minZ + 1.3 }, heading: Math.PI });
  return { cx, cz, halfX: HX - 0.6, halfZ: HZ - 0.6, goalX: gx, goalHalf: 3.9, pitchHalfZ: gz };
}

// =====================================================================
//  Tankstelle
// =====================================================================
export function gasStation(c: Ctx, A: Area) {
  const { B } = c;
  const ix0 = A.x0 + SIDE;
  const ix1 = A.x1 - SIDE;
  B.box("concrete", ix1 - ix0, 0.1, A.z1 - A.z0 - 2 * SIDE, A.cx, 0.35, A.cz, "#7b8087");
  const kx = A.cx + 4;
  B.box("plain", 18, 0.9, 13, kx, 0.4 + 5.4, A.cz, "#f5f5f5");
  B.box("plain", 18.1, 0.4, 13.1, kx, 0.4 + 5.6, A.cz, "#e53935");
  B.box("glow", 17, 0.02, 12, kx, 0.4 + 4.94, A.cz, "#fffbe6");
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) solid(c, "plain", 0.5, 5, 0.5, kx + sx * 7, 0.4 + 2.5, A.cz + sz * 4, "#e0e0e0", false);
  for (const px of [kx - 3.5, kx + 3.5]) {
    B.box("concrete", 1.4, 0.15, 7, px, 0.48, A.cz, "#bdbdbd");
    for (const pz of [A.cz - 2, A.cz + 2]) {
      B.box("plain", 0.8, 1.7, 0.6, px, 0.4 + 1.0, pz, "#ffffff");
      B.box("plain", 0.82, 0.4, 0.62, px, 0.4 + 1.75, pz, "#e53935");
      B.box("glow", 0.5, 0.25, 0.62, px, 0.4 + 1.3, pz, "#7fe0ff");
      c.colliders.push(rectAt(px, pz, 1, 0.8));
    }
  }
  placeCar(c, kx, A.cz - 3.5, 0);
  placeCar(c, kx + 7.5, A.cz + 2.5, Math.PI);
  // Shop
  const sx = ix0 + 4.5;
  solid(c, "plaster", 8, 4.2, 14, sx, 0.4 + 2.1, A.cz, "#f5f5f5");
  B.box("plain", 8.2, 0.6, 14.2, sx, 0.4 + 4.3, A.cz, "#e53935");
  B.ibox("i_lit", 0.08, 2.6, 10, sx + 4.05, 0.4 + 1.6, A.cz, "#ffffff");
  // Preis-Mast
  const mx = ix1 - 1;
  const mz = A.z0 + SIDE + 1.5;
  solid(c, "plain", 0.6, 7, 2.2, mx, 0.4 + 3.5, mz, "#e53935", false);
  c.addSign("TANKE", "⛽", "#c62828", mx + 0.32, 0.4 + 6, mz, Math.PI / 2, 2.2 * 1.6);
  for (let k = 0; k < 3; k++) B.box("glow", 0.05, 0.6, 1.6, mx + 0.32, 0.4 + 2.2 + k * 0.9, mz, "#ffd600");
  deliveryEast(c, A, A.cz + 9);
}

// =====================================================================
//  Schule
// =====================================================================
export function school(c: Ctx, A: Area) {
  const { B } = c;
  const ix0 = A.x0 + SIDE;
  const ix1 = A.x1 - SIDE;
  const iz0 = A.z0 + SIDE;
  const iz1 = A.z1 - SIDE;
  B.box("concrete", ix1 - ix0, 0.1, iz1 - iz0, A.cx, 0.35, A.cz, "#8f959b");
  const wall = "#f2b880";
  const h = 10;
  const parts: [number, number, number, number][] = [
    [ix0 + 4, A.cz, 8, iz1 - iz0 - 2],
    [ix0 + 8 + 7, iz1 - 4.5, 14, 7],
    [ix0 + 8 + 7, iz0 + 4.5, 14, 7],
  ];
  for (const [x, z, w, d] of parts) {
    solid(c, "plaster", w, h, d, x, 0.4 + h / 2, z, wall);
    B.box("plain", w + 0.3, 0.5, d + 0.3, x, 0.4 + h + 0.25, z, "#d35400");
    for (let f = 1; f < 3; f++) B.box("plain", w + 0.1, 0.15, d + 0.1, x, 0.4 + f * 3.3, z, "#ffffff");
    for (let f = 0; f < 3; f++) {
      const y = 0.4 + f * 3.3 + 1.8;
      for (let k = 0; k < Math.floor(d / 2.6); k++) {
        const zz = z - d / 2 + (k + 0.5) * (d / Math.floor(d / 2.6));
        c.win("x", x + w / 2, 1, zz, y, 1.6, 1.6, "#ffffff");
        c.win("x", x - w / 2, -1, zz, y, 1.6, 1.6, "#ffffff");
      }
      for (let k = 0; k < Math.floor(w / 2.6); k++) {
        const xx = x - w / 2 + (k + 0.5) * (w / Math.floor(w / 2.6));
        c.win("z", z + d / 2, 1, xx, y, 1.6, 1.6, "#ffffff");
        c.win("z", z - d / 2, -1, xx, y, 1.6, 1.6, "#ffffff");
      }
    }
  }
  clock(c, ix0 + 8.2, 0.4 + h - 1.2, A.cz, "x", 1.0);
  c.addSign("SCHULE", "🏫", "#d35400", ix0 + 8.3, 0.4 + h + 2, A.cz, Math.PI / 2, 9);
  B.box("plain", 0.3, 2.4, 9.4, ix0 + 8.1, 0.4 + h + 2, A.cz, "#ffffff");
  // Basketballfeld im Hof
  const bx = ix0 + 16;
  B.box("plain", 10, 0.04, 9, bx, 0.42, A.cz, "#c0532f");
  B.ibox("i_paint", 10, 0.02, 0.12, bx, 0.45, A.cz - 4.5, "#ffffff");
  B.ibox("i_paint", 10, 0.02, 0.12, bx, 0.45, A.cz + 4.5, "#ffffff");
  B.ibox("i_paint", 0.12, 0.02, 9, bx, 0.45, A.cz, "#ffffff");
  for (const s of [-1, 1]) {
    const x = bx + s * 5.5;
    B.geo("metal", GEO.cyl8, x, 1.9, A.cz, "#444444", 0, 0, 0, 0.08, 3, 0.08);
    B.box("plain", 0.08, 1.0, 1.6, x - s * 0.2, 3.4, A.cz, "#ffffff");
    B.geo("plain", GEO.torusWheel, x - s * 0.6, 3.05, A.cz, "#ff6d00", Math.PI / 2, 0, 0, 0.25, 0.25, 0.25);
    c.colliders.push(rectAt(x, A.cz, 0.3, 0.3));
  }
  // Fahnenmast & Bäume
  B.geo("metal", GEO.cyl8, ix1 - 1.5, 4.4, A.cz + 6, "#cccccc", 0, 0, 0, 0.06, 8, 0.06);
  B.box("plain", 0.05, 1.2, 2, ix1 - 1.5, 7.6, A.cz + 7.05, "#1e88e5");
  for (const z of [iz0 + 2, iz1 - 2]) c.tree(ix1 - 2, z, 0.4, 0.9);
  for (let k = 0; k < 6; k++) B.ibox("i_frame", 0.05, 0.8, 0.8, ix1 - 3, 0.8, A.cz - 6 + k * 0.6, "#9e9e9e");
  deliveryEast(c, A);
}

// =====================================================================
//  Krankenhaus
// =====================================================================
export function hospital(c: Ctx, A: Area) {
  const { B } = c;
  const ix0 = A.x0 + SIDE;
  const ix1 = A.x1 - SIDE;
  B.box("concrete", ix1 - ix0, 0.1, A.z1 - A.z0 - 2 * SIDE, A.cx, 0.35, A.cz, "#cfd8dc");
  const w = 14;
  const d = 22;
  const floors = 6;
  const h = floors * 3.3;
  const hx = A.cx - 5;
  const hz = A.cz + 1;
  solid(c, "plaster", w, h, d, hx, 0.4 + h / 2, hz, "#f4f6f8");
  for (let f = 0; f < floors; f++) {
    const y = 0.4 + f * 3.3 + 1.7;
    B.ibox("i_glass", 0.08, 1.4, d - 2, hx + w / 2 + 0.04, y, hz, "#7fb3d5");
    B.ibox("i_glass", 0.08, 1.4, d - 2, hx - w / 2 - 0.04, y, hz, "#7fb3d5");
    B.ibox("i_glass", w - 2, 1.4, 0.08, hx, y, hz + d / 2 + 0.04, "#7fb3d5");
    B.ibox("i_glass", w - 2, 1.4, 0.08, hx, y, hz - d / 2 - 0.04, "#7fb3d5");
  }
  B.box("plain", w + 0.3, 0.6, d + 0.3, hx, 0.4 + h + 0.3, hz, "#90a4ae");
  // Rotes Kreuz
  B.box("glow", 0.1, 4, 1.3, hx + w / 2 + 0.12, 0.4 + h - 3, hz, "#ff1744");
  B.box("glow", 0.1, 1.3, 4, hx + w / 2 + 0.12, 0.4 + h - 3, hz, "#ff1744");
  // Hubschrauberlandeplatz
  B.geo("plain", GEO.cyl24, hx, 0.4 + h + 0.65, hz, "#37474f", 0, 0, 0, 5.5, 0.1, 5.5);
  B.geo("glow", GEO.torusWheel, hx, 0.4 + h + 0.72, hz, "#ffd600", Math.PI / 2, 0, 0, 4.6, 4.6, 0.3);
  B.box("plain", 0.6, 0.03, 4, hx - 1.2, 0.4 + h + 0.72, hz, "#ffffff");
  B.box("plain", 0.6, 0.03, 4, hx + 1.2, 0.4 + h + 0.72, hz, "#ffffff");
  B.box("plain", 1.8, 0.03, 0.6, hx, 0.4 + h + 0.72, hz, "#ffffff");
  // Notaufnahme-Flügel
  const ex = A.cx + 7;
  const ez = A.cz - 4;
  solid(c, "plaster", 8, 4.5, 13, ex, 0.4 + 2.25, ez, "#eceff1");
  B.box("plain", 8.3, 0.5, 13.3, ex, 0.4 + 4.6, ez, "#d32f2f");
  B.ibox("i_lit", 0.08, 2.6, 4, ex + 4.04, 0.4 + 1.4, ez, "#ffffff");
  B.box("plain", 2.5, 0.2, 6, ex + 5.2, 0.4 + 3.2, ez, "#d32f2f");
  c.addSign("KRANKENHAUS", "🏥", "#c62828", hx + w / 2 + 0.25, 0.4 + h + 2.5, hz, Math.PI / 2, 11);
  B.box("plain", 0.3, 2.9, 11.4, hx + w / 2 + 0.05, 0.4 + h + 2.5, hz, "#ffffff");
  placeCar(c, ex + 1, A.cz + 6, Math.PI / 2, "#ffffff", "van");
  B.box("glow", 0.3, 0.15, 0.6, ex + 2.5, 2.4, A.cz + 6, "#2979ff");
  c.tree(ix1 - 2, A.z1 - SIDE - 2, 0.4, 0.8);
  c.bench(ix1 - 3, A.cz + 11, true);
  deliveryEast(c, A, A.cz - 4);
}

// =====================================================================
//  Feuerwehr
// =====================================================================
export function fireStation(c: Ctx, A: Area) {
  const { B } = c;
  const ix0 = A.x0 + SIDE;
  const ix1 = A.x1 - SIDE;
  B.box("concrete", ix1 - ix0, 0.1, A.z1 - A.z0 - 2 * SIDE, A.cx, 0.35, A.cz, "#b0b0b0");
  const w = 14;
  const d = 24;
  const h = 7.5;
  const hx = ix0 + 3 + w / 2;
  solid(c, "brick", w, h, d, hx, 0.4 + h / 2, A.cz, "#b23a2e");
  B.box("plain", w + 0.3, 0.5, d + 0.3, hx, 0.4 + h + 0.25, A.cz, "#ffffff");
  const fx = hx + w / 2;
  for (let k = -1; k <= 1; k++) {
    const z = A.cz + k * 7;
    B.box("plain", 0.2, 5.4, 5.0, fx + 0.04, 0.4 + 2.7, z, "#ffffff");
    B.box("plain", 0.22, 5.0, 4.6, fx + 0.06, 0.4 + 2.5, z, "#d32f2f");
    for (let r = 0; r < 4; r++) B.ibox("i_glass", 0.06, 0.6, 4.2, fx + 0.18, 0.4 + 3.6, z, "#bfe3f5");
    for (let r = 0; r < 6; r++) B.ibox("i_frame", 0.04, 0.05, 4.5, fx + 0.19, 0.4 + 0.6 + r * 0.8, z, "#a61b1b");
  }
  c.addSign("FEUERWEHR", "🚒", "#c62828", fx + 0.3, 0.4 + h - 0.8, A.cz, Math.PI / 2, 8);
  // Schlauchturm
  solid(c, "brick", 4, 17, 4, ix0 + 2.5, 0.4 + 8.5, A.z0 + SIDE + 2.5, "#9c2f25");
  B.box("plain", 4.6, 0.6, 4.6, ix0 + 2.5, 17.7, A.z0 + SIDE + 2.5, "#ffffff");
  for (let k = 0; k < 4; k++) c.win("x", ix0 + 4.5, 1, A.z0 + SIDE + 2.5, 3 + k * 3.5, 0.8, 1.6, "#ffffff");
  // Feuerwehrauto vor dem mittleren Tor
  const tx = fx + 5;
  const tz = A.cz;
  B.box("paintGloss", 2.4, 2.3, 2.2, tx + 3.4, 0.4 + 1.65, tz, "#d32f2f");
  B.box("glass", 2.3, 1.0, 0.05, tx + 4.52, 0.4 + 2.2, tz, "#22303c", 0, Math.PI / 2, 0);
  B.box("paintGloss", 5.6, 2.5, 2.4, tx, 0.4 + 1.75, tz, "#d32f2f");
  B.box("plain", 5.62, 0.25, 2.42, tx, 0.4 + 1.3, tz, "#ffffff");
  B.box("chrome", 6, 0.12, 0.1, tx + 0.5, 0.4 + 3.2, tz - 0.6, "#cccccc");
  B.box("chrome", 6, 0.12, 0.1, tx + 0.5, 0.4 + 3.2, tz + 0.6, "#cccccc");
  for (let k = 0; k < 12; k++) B.box("chrome", 0.08, 0.08, 1.2, tx - 2.4 + k * 0.5, 0.4 + 3.2, tz, "#cccccc");
  for (const s of [-1, 1]) B.box("glow", 0.3, 0.2, 0.4, tx + 3.6, 0.4 + 2.9, tz + s * 0.7, "#2979ff");
  for (const wx of [tx - 1.8, tx + 0.5, tx + 3.4])
    for (const s of [-1, 1]) B.geo("rubber", GEO.cyl16, wx, 0.4 + 0.5, tz + s * 1.15, "#1a1a1a", Math.PI / 2, 0, 0, 0.5, 0.3, 0.5);
  c.colliders.push(rectAt(tx + 1, tz, 8, 2.6));
  deliveryEast(c, A, A.cz + 11);
}

// =====================================================================
//  Polizei
// =====================================================================
export function policeStation(c: Ctx, A: Area) {
  const { B } = c;
  const ix0 = A.x0 + SIDE;
  B.box("concrete", A.x1 - A.x0 - 2 * SIDE, 0.1, A.z1 - A.z0 - 2 * SIDE, A.cx, 0.35, A.cz, "#b0b6bc");
  const w = 15;
  const d = 22;
  const h = 10;
  const hx = ix0 + 2 + w / 2;
  solid(c, "plaster", w, h, d, hx, 0.4 + h / 2, A.cz, "#e8edf2");
  B.box("plain", w + 0.12, 0.8, d + 0.12, hx, 0.4 + 3.4, A.cz, "#1e4fa3");
  B.box("plain", w + 0.3, 0.5, d + 0.3, hx, 0.4 + h + 0.25, A.cz, "#1e4fa3");
  const fx = hx + w / 2;
  for (let f = 0; f < 3; f++) {
    for (let k = 0; k < 7; k++) {
      const z = A.cz - d / 2 + (k + 0.5) * (d / 7);
      if (f === 0 && Math.abs(z - A.cz) < 2) continue;
      c.win("x", fx, 1, z, 0.4 + f * 3.3 + 1.7, 1.4, 1.5, "#37474f");
    }
  }
  B.ibox("i_glass", 0.08, 2.6, 2.6, fx + 0.04, 0.4 + 1.3, A.cz, "#9cc3dd");
  B.box("plain", 2, 0.2, 4.5, fx + 1, 0.4 + 3.0, A.cz, "#1e4fa3");
  c.addSign("POLIZEI", "🚓", "#1e4fa3", fx + 0.25, 0.4 + h + 2, A.cz, Math.PI / 2, 9);
  B.box("plain", 0.3, 2.4, 9.4, fx + 0.05, 0.4 + h + 2, A.cz, "#ffffff");
  for (const z of [A.cz - 7, A.cz + 7]) {
    placeCar(c, fx + 5, z, Math.PI / 2, "#f5f5f5");
    B.box("glow", 0.3, 0.15, 0.55, fx + 5, 2.0, z - 0.35, "#2979ff");
    B.box("glow", 0.3, 0.15, 0.55, fx + 5, 2.0, z + 0.35, "#ff1744");
    B.box("plain", 4.3, 0.3, 0.02, fx + 5, 1.0, z - 0.92, "#1e4fa3");
    B.box("plain", 4.3, 0.3, 0.02, fx + 5, 1.0, z + 0.92, "#1e4fa3");
  }
  deliveryEast(c, A, A.cz + 11);
}

// =====================================================================
//  Supermarkt
// =====================================================================
export function supermarket(c: Ctx, A: Area) {
  const { B } = c;
  const ix0 = A.x0 + SIDE;
  const ix1 = A.x1 - SIDE;
  const iz0 = A.z0 + SIDE;
  const iz1 = A.z1 - SIDE;
  B.box("concrete", ix1 - ix0, 0.1, iz1 - iz0, A.cx, 0.35, A.cz, "#5c6066");
  const w = 12;
  const d = 26;
  const h = 6;
  const hx = ix0 + w / 2;
  solid(c, "plaster", w, h, d, hx, 0.4 + h / 2, A.cz, "#f5f5f5");
  B.box("plain", w + 0.2, 1.0, d + 0.2, hx, 0.4 + h - 0.3, A.cz, "#e53935");
  const fx = hx + w / 2;
  for (const s of [-1, 1]) B.ibox("i_lit", 0.08, 3, 9, fx + 0.04, 0.4 + 1.7, A.cz + s * 7, "#ffffff");
  B.ibox("i_glass", 0.08, 3, 3.5, fx + 0.04, 0.4 + 1.5, A.cz, "#9cc3dd");
  c.addSign("SUPERMARKT", "🛒", "#c62828", fx + 0.25, 0.4 + h + 1.8, A.cz, Math.PI / 2, 14);
  B.box("plain", 0.3, 3.7, 14.4, fx + 0.05, 0.4 + h + 1.8, A.cz, "#ffffff");
  // Parkplatz
  const px0 = fx + 3;
  for (let k = 0; k <= 8; k++) {
    const z = iz0 + 1 + k * 3.2;
    B.ibox("i_paint", 5, 0.02, 0.12, px0 + 2.5, 0.42, z, "#ffffff");
    B.ibox("i_paint", 5, 0.02, 0.12, px0 + 9.5, 0.42, z, "#ffffff");
  }
  for (let k = 0; k < 8; k++) {
    if (c.r() < 0.45) continue;
    const z = iz0 + 2.6 + k * 3.2;
    placeCar(c, px0 + (c.r() < 0.5 ? 2.5 : 9.5), z, c.r() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
  }
  for (let k = 0; k < 4; k++) B.ibox("i_frame", 0.6, 0.9, 0.9, fx + 1.2, 0.85, A.cz + 3 + k * 0.5, "#b0bec5");
  c.tree(px0 + 6, iz0 + 1, 0.4, 0.8);
  c.tree(px0 + 6, iz1 - 1, 0.4, 0.8);
  deliveryEast(c, A);
}

// =====================================================================
//  Kirche
// =====================================================================
export function church(c: Ctx, A: Area) {
  const { B } = c;
  const ix0 = A.x0 + SIDE;
  const ix1 = A.x1 - SIDE;
  const iz0 = A.z0 + SIDE;
  const iz1 = A.z1 - SIDE;
  B.box("grass", ix1 - ix0, 0.1, iz1 - iz0, A.cx, 0.35, A.cz, "#ffffff");
  const stone = "#e6dcc8";
  const w = 11;
  const d = 22;
  const h = 9;
  const hx = A.cx - 3;
  const hz = A.cz;
  solid(c, "plaster", w, h, d, hx, 0.4 + h / 2, hz, stone);
  gableRoof(c, "plaster", hx, 0.4 + h, hz, w, d, 5, stone, "#4e5d6c");
  const stained = ["#5c6bc0", "#ef5350", "#ffca28", "#26a69a"];
  for (let k = 0; k < 5; k++) {
    const z = hz - d / 2 + (k + 0.5) * (d / 5);
    for (const s of [-1, 1]) {
      B.ibox("i_frame", 0.12, 4.4, 1.6, hx + s * (w / 2 + 0.03), 0.4 + 4.4, z, "#8d7b68");
      B.ibox("i_lit", 0.08, 4, 1.2, hx + s * (w / 2 + 0.07), 0.4 + 4.4, z, c.pick(stained));
    }
  }
  // Turm (zur Straße im Osten)
  const tx = hx + w / 2 + 2.5;
  solid(c, "plaster", 5, 22, 5, tx, 0.4 + 11, hz, "#ddd2bc");
  B.geo("plain", new THREE.ConeGeometry(Math.SQRT1_2, 1, 4), tx, 0.4 + 22 + 5, hz, "#3e7c6a", 0, Math.PI / 4, 0, 5.4, 10, 5.4);
  B.box("plain", 0.25, 2.2, 0.25, tx, 0.4 + 33, hz, "#d4af37");
  B.box("plain", 0.25, 0.25, 1.2, tx, 0.4 + 33.4, hz, "#d4af37");
  clock(c, tx + 2.55, 0.4 + 17, hz, "x", 1.1);
  clock(c, tx, 0.4 + 17, hz + 2.55, "z", 1.1);
  clock(c, tx, 0.4 + 17, hz - 2.55, "z", 1.1);
  for (const s of [-1, 1]) B.box("plain", 0.1, 2.5, 1.0, tx + 2.55, 0.4 + 20, hz + s * 1.0, "#2b2b2b");
  B.box("wood", 0.15, 3.2, 2.0, tx + 2.55, 0.4 + 1.6, hz, "#6d4c41");
  B.box("concrete", ix1 - tx - 2.5, 0.05, 2.2, (tx + 2.5 + ix1) / 2, 0.43, hz, "#d0cdc6");
  for (const [x, z] of [
    [ix0 + 3, iz0 + 3],
    [ix0 + 3, iz1 - 3],
    [ix1 - 3, iz0 + 3],
    [ix1 - 3, iz1 - 3],
  ])
    c.tree(x, z, 0.4, 1);
  c.bench(ix1 - 4, hz + 5, true);
  deliveryEast(c, A, hz + 4);
}

// =====================================================================
//  Bürohochhäuser
// =====================================================================
export function officeTowers(c: Ctx, A: Area) {
  const { B } = c;
  B.box("concrete", A.x1 - A.x0 - 2 * SIDE, 0.1, A.z1 - A.z0 - 2 * SIDE, A.cx, 0.35, A.cz, "#cfcfcf");
  const tower = (x: number, z: number, w: number, h: number, glass: string, logo: boolean) => {
    solid(c, "glass", w, h, w, x, 0.4 + h / 2, z, glass);
    for (let y = 3.6; y < h; y += 3.6) B.box("plain", w + 0.15, 0.25, w + 0.15, x, 0.4 + y, z, "#dfe6ec");
    for (let p = -w / 2 + 1; p <= w / 2 - 1; p += 2) {
      B.ibox("i_frame", 0.12, h, 0.12, x + w / 2 + 0.06, 0.4 + h / 2, z + p, "#cfd8dc");
      B.ibox("i_frame", 0.12, h, 0.12, x - w / 2 - 0.06, 0.4 + h / 2, z + p, "#cfd8dc");
      B.ibox("i_frame", 0.12, h, 0.12, x + p, 0.4 + h / 2, z + w / 2 + 0.06, "#cfd8dc");
      B.ibox("i_frame", 0.12, h, 0.12, x + p, 0.4 + h / 2, z - w / 2 - 0.06, "#cfd8dc");
    }
    B.box("plain", w - 3, 3, w - 3, x, 0.4 + h + 1.5, z, "#b0bec5");
    B.geo("metal", GEO.cyl8, x, 0.4 + h + 7, z, "#9e9e9e", 0, 0, 0, 0.12, 8, 0.12);
    B.geo("glow", GEO.sphere, x, 0.4 + h + 11, z, "#ff1744", 0, 0, 0, 0.3, 0.3, 0.3);
    if (logo) {
      c.addSign("LIEFERBLITZ", "⚡", "#ff6d00", x + w / 2 + 0.3, 0.4 + h - 3, z, Math.PI / 2, w - 1);
    }
  };
  tower(A.cx - 6, A.cz - 6, 13, 45 + c.r() * 25, c.pick(["#5d8fb5", "#4f7f9f", "#6aa0b8"]), c.r() < 0.5);
  tower(A.cx + 7, A.cz + 7, 11, 30 + c.r() * 20, c.pick(["#7aa6c2", "#5f8f8f", "#8aa9c9"]), false);
  B.geo("concrete", GEO.cyl24, A.cx + 7, 0.6, A.cz - 7, "#cfcfcf", 0, 0, 0, 3, 0.5, 3);
  B.geo("water", GEO.cyl24, A.cx + 7, 0.7, A.cz - 7, "#4fb3e8", 0, 0, 0, 2.6, 0.5, 2.6);
  c.colliders.push(rectAt(A.cx + 7, A.cz - 7, 6, 6));
  c.tree(A.cx - 7, A.cz + 9, 0.4, 0.8);
  c.bench(A.cx - 3, A.cz + 11, true);
  deliveryEast(c, A, A.cz + 7);
}

// =====================================================================
//  Freibad
// =====================================================================
export function swimmingPool(c: Ctx, A: Area) {
  const { B } = c;
  const ix0 = A.x0 + SIDE;
  const ix1 = A.x1 - SIDE;
  const iz0 = A.z0 + SIDE;
  const iz1 = A.z1 - SIDE;
  B.box("grass", ix1 - ix0, 0.1, iz1 - iz0, A.cx, 0.35, A.cz, "#ffffff");
  solid(c, "plaster", 6, 4, 22, ix0 + 3.5, 0.4 + 2, A.cz, "#4fc3f7");
  B.box("plain", 6.3, 0.4, 22.3, ix0 + 3.5, 0.4 + 4.2, A.cz, "#ffffff");
  for (let k = 0; k < 5; k++) B.box("plain", 0.08, 2.2, 1.4, ix0 + 6.54, 0.4 + 1.1, A.cz - 8 + k * 4, c.pick(["#ff7043", "#ffd54f", "#81c784", "#ba68c8"]));
  c.addSign("FREIBAD", "🏊", "#0288d1", ix0 + 6.8, 0.4 + 5.6, A.cz, Math.PI / 2, 8);
  // Becken
  const px = A.cx + 3;
  const pz = A.cz - 2;
  B.box("concrete", 20, 0.35, 14, px, 0.55, pz, "#e0e0e0");
  B.box("water", 18, 0.3, 12, px, 0.62, pz, "#29b6f6");
  for (let k = 1; k < 4; k++) {
    for (let s = 0; s < 18; s++) B.ibox("i_plain", 0.9, 0.12, 0.12, px - 9 + s + 0.5, 0.8, pz - 6 + k * 3, s % 2 ? "#ffffff" : "#e53935");
  }
  c.colliders.push(rectAt(px, pz, 20, 14));
  // Sprungturm
  for (const [hh, len] of [
    [1.5, 3],
    [3.5, 2.5],
    [5.5, 2],
  ]) {
    B.box("concrete", len, 0.25, 1.4, px - 10 + len / 2, 0.4 + hh, pz + 3, "#eeeeee");
  }
  B.box("concrete", 1.2, 6, 1.6, px - 10.4, 0.4 + 3, pz + 3, "#bdbdbd");
  // Rutsche (Spirale)
  const sx = px + 6;
  const sz = A.z1 - SIDE - 4;
  B.geo("metal", GEO.cyl8, sx, 0.4 + 3.5, sz, "#90a4ae", 0, 0, 0, 0.3, 7, 0.3);
  for (let k = 0; k < 44; k++) {
    const a = (k / 44) * Math.PI * 3;
    const y = 0.4 + 6.8 - (k / 44) * 6;
    B.box("paintGloss", 1.1, 0.25, 0.9, sx + Math.cos(a) * 2.2, y, sz + Math.sin(a) * 2.2, k % 2 ? "#ff6f00" : "#ffa000", 0, -a, 0);
  }
  c.colliders.push(rectAt(sx, sz, 5.5, 5.5));
  // Liegen & Schirme
  for (let k = 0; k < 6; k++) {
    const x = px - 8 + k * 3.2;
    const z = A.z0 + SIDE + 2;
    B.ibox("i_plain", 0.8, 0.25, 2, x, 0.6, z, "#ffffff");
    B.geo("metal", GEO.cyl8, x + 1.2, 1.5, z, "#888888", 0, 0, 0, 0.04, 2.2, 0.04);
    B.geo("plain", GEO.cone8, x + 1.2, 2.7, z, c.pick(["#e53935", "#fdd835", "#1e88e5", "#43a047"]), 0, 0, 0, 1.3, 0.5, 1.3);
  }
  deliveryEast(c, A, A.cz + 10);
}

// =====================================================================
//  Wohnhaus-Varianten
// =====================================================================
const WALLS = ["#f4efe6", "#f2d7b6", "#cfe0ee", "#f6e3a1", "#f1c1b5", "#cfe5c4", "#ddd0ec", "#f5c99a", "#bfdcdc", "#fbe0e6"];

export function modernVilla(c: Ctx, lot: Lot, LOT: number) {
  const { B } = c;
  const { lx, lz, dir } = lot;
  const w = 8.5;
  const d = 11;
  const hx = lx - dir * 1.2;
  solid(c, "plaster", w, 3.2, d, hx, 0.4 + 1.6, lz, "#f7f7f7");
  const upColor = c.pick(["#b07a4f", "#3c4148", "#6d4c41", "#f7f7f7"]);
  const upKey = upColor === "#b07a4f" || upColor === "#6d4c41" ? "wood" : "plaster";
  B.box(upKey, w - 1, 3, d - 2.5, hx + dir * 1.0, 0.4 + 3.2 + 1.5, lz - 0.8, upColor);
  B.box("plain", w + 0.2, 0.2, d + 0.2, hx, 0.4 + 3.25, lz, "#e0e0e0");
  B.box("plain", w - 0.8, 0.2, d - 2.3, hx + dir * 1.0, 0.4 + 6.3, lz - 0.8, "#e0e0e0");
  const fx = hx + dir * (w / 2);
  B.ibox("i_glass", 0.08, 2.4, 5, fx + dir * 0.04, 0.4 + 1.4, lz - 2.2, "#8fb8d6");
  B.ibox("i_frame", 0.1, 2.5, 0.1, fx + dir * 0.06, 0.4 + 1.4, lz - 2.2, "#333333");
  B.ibox("i_glass", 0.08, 1.6, w - 3, fx + dir * 1.04, 0.4 + 4.8, lz - 0.8, "#8fb8d6");
  B.box("wood", 0.12, 2.3, 1.1, fx + dir * 0.07, 0.4 + 1.15, lz + 2.8, "#3c4148");
  c.win("z", lz + d / 2, 1, hx, 0.4 + 1.6, 2.5, 1.2, "#333333", { sill: false });
  c.win("z", lz - d / 2, -1, hx, 0.4 + 1.6, 2.5, 1.2, "#333333", { sill: false });
  // kleiner Pool hinten
  const bx = lx - dir * (LOT / 2 - 2.2);
  B.box("concrete", 3.4, 0.12, 7, bx, 0.46, lz, "#e0e0e0");
  B.box("water", 2.8, 0.12, 6.2, bx, 0.5, lz, "#29b6f6");
  B.box("concrete", Math.abs(lx + dir * (LOT / 2) - fx), 0.05, 1.3, (lx + dir * (LOT / 2) + fx) / 2, 0.43, lz + 2.8, "#d0cdc6");
  c.bush(fx + dir * 1.0, lz - 5, 0.4, 0.7);
  if (c.r() < 0.5) placeCar(c, lx + dir * (LOT / 2 - 2.2), lz - 3.8, 0);
}

export function bungalow(c: Ctx, lot: Lot, LOT: number) {
  const { B } = c;
  const { lx, lz, dir } = lot;
  const w = 8;
  const d = 9;
  const hx = lx - dir * 1.5;
  const hz = lz + 1.5;
  const wall = c.pick(WALLS);
  solid(c, "plaster", w, 3, d, hx, 0.4 + 1.5, hz, wall);
  const roof = c.pick(["#a83a2c", "#5b5b5b", "#3f4a5a", "#6b4a3a"]);
  B.geo("roof", new THREE.ConeGeometry(Math.SQRT1_2, 1, 4), hx, 0.4 + 3 + 1.2, hz, roof, 0, Math.PI / 4, 0, w + 1, 2.4, d + 1);
  // Garage
  solid(c, "plaster", 6, 2.8, 4.5, hx + dir * 1, 0.4 + 1.4, hz - d / 2 - 2.25, wall);
  B.box("plain", 6.2, 0.2, 4.7, hx + dir * 1, 0.4 + 2.9, hz - d / 2 - 2.25, "#777777");
  const gfx = hx + dir * 4;
  B.box("plain", 0.1, 2.2, 3.2, gfx + dir * 0.03, 0.4 + 1.1, hz - d / 2 - 2.25, "#eeeeee");
  for (let k = 0; k < 5; k++) B.ibox("i_frame", 0.05, 0.04, 3.1, gfx + dir * 0.09, 0.6 + k * 0.42, hz - d / 2 - 2.25, "#bdbdbd");
  B.box("concrete", Math.abs(lx + dir * (LOT / 2) - gfx), 0.05, 3.2, (lx + dir * (LOT / 2) + gfx) / 2, 0.43, hz - d / 2 - 2.25, "#bdbdbd");
  const fx = hx + dir * (w / 2);
  B.box("wood", 0.12, 2.2, 1.1, fx + dir * 0.07, 0.4 + 1.1, hz + 1, "#7a4b2a");
  c.win("x", fx, dir, hz - 2, 0.4 + 1.6, 1.6, 1.2, "#ffffff", { cross: true });
  c.win("x", fx, dir, hz + 3.2, 0.4 + 1.6, 1.0, 1.2, "#ffffff", { cross: true });
  c.win("z", hz + d / 2, 1, hx, 0.4 + 1.6, 1.6, 1.2, "#ffffff", { cross: true });
  B.box("concrete", Math.abs(lx + dir * (LOT / 2) - fx), 0.05, 1.2, (lx + dir * (LOT / 2) + fx) / 2, 0.43, hz + 1, "#d0cdc6");
  c.bush(fx + dir * 1, hz + 3, 0.4, 0.7);
  c.tree(lx - dir * (LOT / 2 - 2), lz + LOT / 2 - 2, 0.4, 0.8);
}

const SHOPS: [string, string, string][] = [
  ["KIOSK", "📰", "#1565c0"],
  ["FRISEUR", "✂️", "#6a1b9a"],
  ["BLUMEN", "💐", "#2e7d32"],
  ["APOTHEKE", "💊", "#00897b"],
  ["BÜCHER", "📚", "#5d4037"],
  ["SPIELZEUG", "🧸", "#ef6c00"],
  ["HANDYS", "📱", "#37474f"],
  ["SPORT", "⚽", "#c62828"],
  ["MUSIK", "🎸", "#283593"],
  ["ZOOLADEN", "🐠", "#00838f"],
];

export function shopHouse(c: Ctx, lot: Lot) {
  const { B } = c;
  const { lx, lz, dir } = lot;
  const [name, emoji, color] = c.pick(SHOPS);
  const floors = 3 + Math.floor(c.r() * 2);
  const h = floors * 3.2;
  const w = 10;
  const d = 12;
  const hx = lx - dir * 0.6;
  const wall = c.pick(WALLS);
  solid(c, c.r() < 0.4 ? "brick" : "plaster", w, h, d, hx, 0.4 + h / 2, lz, c.r() < 0.4 ? c.pick(["#b5523b", "#a0462f", "#c0704f"]) : wall);
  B.box("plain", w + 0.1, 3.4, d + 0.1, hx, 0.4 + 1.7, lz, "#3a3f45");
  const fx = hx + dir * (w / 2);
  B.ibox("i_lit", 0.08, 2.4, d - 4, fx + dir * 0.08, 0.4 + 1.5, lz - 1, "#ffffff");
  B.ibox("i_glass", 0.08, 2.4, 1.4, fx + dir * 0.08, 0.4 + 1.3, lz + 4, "#9cc3dd");
  for (let s = 0; s < 6; s++) {
    const z = lz - (d - 1) / 2 + (s + 0.5) * ((d - 1) / 6);
    B.box("plain", 1.5, 0.08, (d - 1) / 6, fx + dir * 0.75, 0.4 + 3.3, z, s % 2 ? "#ffffff" : color, 0, 0, -dir * 0.3);
  }
  c.addSign(name, emoji, color, fx + dir * 0.12, 0.4 + 4.0, lz, (dir * Math.PI) / 2, 6);
  for (let f = 1; f < floors; f++) {
    B.box("plain", w + 0.14, 0.14, d + 0.14, hx, 0.4 + f * 3.2 + 0.2, lz, "#f0f0f0");
    for (const k of [-0.32, 0, 0.32]) c.win("x", fx, dir, lz + k * d, 0.4 + f * 3.2 + 1.8, 1.2, 1.5, "#ffffff", { cross: true });
    for (const s of [-1, 1]) c.win("z", lz + s * (d / 2), s, hx, 0.4 + f * 3.2 + 1.8, 1.2, 1.5, "#ffffff");
  }
  B.box("plain", w + 0.3, 0.5, d + 0.3, hx, 0.4 + h + 0.25, lz, "#e0e0e0");
  c.bush(fx + dir * 0.8, lz + 5.5, 0.4, 0.6);
}
