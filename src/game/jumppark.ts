import * as THREE from "three";
import { Builder, GEO } from "./builder";

export interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}
/** Rampe: steigt von h0 auf h1 entlang Richtung (dx,dz) */
export interface Ramp {
  ox: number;
  oz: number;
  dx: number;
  dz: number;
  len: number;
  w: number;
  h0: number;
  h1: number;
}
export interface Platform extends Rect {
  h: number;
}
/** Looping: Einfahrt (ex,ez), Fahrtrichtung (ax,az), seitlicher Versatz (lx,lz) * off */
export interface Loop {
  ex: number;
  ez: number;
  ax: number;
  az: number;
  lx: number;
  lz: number;
  R: number;
  off: number;
  minSpeed: number;
}
export interface JumpPark {
  rect: Rect;
  ramps: Ramp[];
  platforms: Platform[];
  loops: Loop[];
}

export const LOOP_G = 9.81;
/** Mindestgeschwindigkeit (m/s), um oben nicht runterzufallen */
export const loopMinSpeed = (R: number) => Math.sqrt(4.6 * LOOP_G * R);

export function inRect(r: Rect, x: number, z: number) {
  return x > r.minX && x < r.maxX && z > r.minZ && z < r.maxZ;
}

export function jumpHeight(p: JumpPark, x: number, z: number) {
  let h = 0;
  for (const r of p.ramps) {
    const rx = x - r.ox;
    const rz = z - r.oz;
    const along = rx * r.dx + rz * r.dz;
    if (along < 0 || along > r.len) continue;
    const lat = Math.abs(-rx * r.dz + rz * r.dx);
    if (lat > r.w / 2) continue;
    h = Math.max(h, r.h0 + ((r.h1 - r.h0) * along) / r.len);
  }
  for (const b of p.platforms) if (inRect(b, x, z)) h = Math.max(h, b.h);
  return h;
}

type SignFn = (text: string, emoji: string, color: string, x: number, y: number, z: number, angle: number, w: number) => void;

export function buildJumpPark(B: Builder, rect: Rect, colliders: Rect[], addSign: SignFn): JumpPark {
  const cx = (rect.minX + rect.maxX) / 2;
  const cz = (rect.minZ + rect.maxZ) / 2;
  const W = rect.maxX - rect.minX;
  const D = rect.maxZ - rect.minZ;
  const ramps: Ramp[] = [];
  const platforms: Platform[] = [];
  const loops: Loop[] = [];

  // Boden
  B.box("concrete", W, 0.05, D, cx, 0.025, cz, "#9aa5b1");
  for (let k = -3; k <= 3; k++) {
    B.ibox("i_paint", 0.25, 0.02, D - 4, cx + k * 12, 0.06, cz, "#c6cdd4");
    B.ibox("i_paint", W - 4, 0.02, 0.25, cx, 0.06, cz + k * 12, "#c6cdd4");
  }

  // Absperrung (rot/weiß) mit Eingängen in der Mitte jeder Seite
  const barrier = (x: number, z: number, alongX: boolean, i: number) => {
    B.box("plain", alongX ? 1.9 : 0.4, 0.6, alongX ? 0.4 : 1.9, x, 0.35, z, i % 2 ? "#ffffff" : "#e53935");
    colliders.push({ minX: x - (alongX ? 1 : 0.25), maxX: x + (alongX ? 1 : 0.25), minZ: z - (alongX ? 0.25 : 1), maxZ: z + (alongX ? 0.25 : 1) });
  };
  // Lücken: Mitte jeder Seite + Anlauf für Rampen/Loopings (u/v relativ zur Mitte)
  const gapsSouth = [0, -32];
  const gapsNorth = [0, 32];
  const gapsWest = [0, 20, -38];
  const gapsEast = [0];
  const isGap = (p: number, gaps: number[]) => gaps.some((g) => Math.abs(p - g) < 5);
  let i = 0;
  for (let x = rect.minX + 1; x < rect.maxX; x += 2) {
    if (!isGap(x - cx, gapsSouth)) barrier(x, rect.minZ + 0.3, true, i++);
    if (!isGap(x - cx, gapsNorth)) barrier(x, rect.maxZ - 0.3, true, i++);
  }
  for (let z = rect.minZ + 1; z < rect.maxZ; z += 2) {
    if (!isGap(z - cz, gapsWest)) barrier(rect.minX + 0.3, z, false, i++);
    if (!isGap(z - cz, gapsEast)) barrier(rect.maxX - 0.3, z, false, i++);
  }

  // ---------- Rampen ----------
  const ramp = (u: number, v: number, dx: number, dz: number, len: number, w: number, h0: number, h1: number, color: string) => {
    const r: Ramp = { ox: cx + u, oz: cz + v, dx, dz, len, w, h0, h1 };
    ramps.push(r);
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(len, 0);
    shape.lineTo(len, h1 + 0.001);
    shape.lineTo(0, h0 + 0.001);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false });
    geo.translate(0, 0, -w / 2);
    B.geo("wood", geo, r.ox, 0.05, r.oz, color, 0, Math.atan2(-dz, dx), 0);
    geo.dispose();
    // gelb-schwarze Kante an der hohen Seite
    const hi = h1 > h0;
    const ex = r.ox + dx * (hi ? len : 0);
    const ez = r.oz + dz * (hi ? len : 0);
    const h = Math.max(h0, h1);
    for (let k = 0; k < 6; k++) {
      const t = (k + 0.5) / 6 - 0.5;
      const sx = ex + -dz * t * w;
      const sz = ez + dx * t * w;
      B.box("plain", dx ? 0.25 : w / 6, 0.1, dz ? 0.25 : w / 6, sx, h + 0.05, sz, k % 2 ? "#111111" : "#ffd600");
    }
    // Stützen unter der Kante
    if (h > 1.5) for (const s of [-0.45, 0.45]) B.box("metal", 0.2, h, 0.2, ex + -dz * s * w - dx * 0.2, h / 2, ez + dx * s * w - dz * 0.2, "#555555");
  };

  // A: Sprungschanze mit Landerampe (Richtung +x)
  ramp(-36, 20, 1, 0, 9, 5, 0, 2.5, "#c8935a");
  ramp(-18, 20, 1, 0, 10, 5, 2.5, 0, "#b5834f");
  // B: Mega-Rampe (Richtung -z)
  ramp(32, 40, 0, -1, 16, 6, 0, 5, "#d9a066");
  ramp(32, 11, 0, -1, 16, 6, 5, 0, "#c48c58");
  // C: Funbox in der Mitte
  platforms.push({ minX: cx - 5, maxX: cx + 5, minZ: cz - 5, maxZ: cz + 5, h: 2.2 });
  B.box("concrete", 10, 2.2, 10, cx, 1.15, cz, "#7f8c99");
  B.box("plain", 10.1, 0.12, 10.1, cx, 2.25, cz, "#ff7a00");
  ramp(11, 0, -1, 0, 6, 10, 0, 2.2, "#c8935a");
  ramp(-11, 0, 1, 0, 6, 10, 0, 2.2, "#c8935a");
  ramp(0, 11, 0, -1, 6, 10, 0, 2.2, "#c8935a");
  ramp(0, -11, 0, 1, 6, 10, 0, 2.2, "#c8935a");
  // D: kleine Hügel (Richtung +z)
  for (const v of [-16, -4, 8]) ramp(-20, v, 0, 1, 5, 4, 0, 1.2, "#e0b07a");

  // ---------- Loopings ----------
  const loop = (u: number, v: number, ax: number, az: number, lx: number, lz: number, R: number, color: string) => {
    const L: Loop = { ex: cx + u, ez: cz + v, ax, az, lx, lz, R, off: 3.6, minSpeed: loopMinSpeed(R) };
    loops.push(L);
    const segs = 56;
    const rr = R + 0.2;
    const yaw = Math.atan2(ax, az);
    const segLen = ((2 * Math.PI * rr) / segs) * 1.12;
    for (let k = 0; k < segs; k++) {
      const th = ((k + 0.5) / segs) * Math.PI * 2;
      const along = rr * Math.sin(th);
      const up = R - rr * Math.cos(th);
      const lat = (L.off * th) / (Math.PI * 2);
      const x = L.ex + ax * along + lx * lat;
      const z = L.ez + az * along + lz * lat;
      B.box("paintGloss", 3.0, 0.3, segLen, x, up, z, k % 4 < 2 ? color : "#ffffff", -th, yaw, 0);
      for (const s of [-1.55, 1.55]) {
        B.box("paintGloss", 0.15, 0.5, segLen, x + lx * s, up + 0.0, z + lz * s, "#ffd600", -th, yaw, 0);
      }
    }
    // Stützen
    for (const s of [-1, 1]) {
      for (const side of [-0.4, L.off + 0.4]) {
        const px = L.ex + ax * s * (R + 0.9) + lx * (side + (s > 0 ? 0 : 0));
        const pz = L.ez + az * s * (R + 0.9) + lz * side;
        B.geo("metal", GEO.cyl8, px, R / 2, pz, "#4a5560", 0, 0, 0, 0.2, R, 0.2);
      }
    }
    // Pfeile auf dem Boden vor der Einfahrt
    for (let k = 1; k <= 4; k++) {
      const x = L.ex - ax * (k * 3 + 2);
      const z = L.ez - az * (k * 3 + 2);
      for (const s of [-1, 1]) {
        B.box("plain", ax ? 1.2 : 0.3, 0.03, az ? 1.2 : 0.3, x + lx * s * 0.5 - ax * 0.4, 0.07, z + lz * s * 0.5 - az * 0.4, "#ffd600", 0, yaw + s * 0.8, 0);
      }
    }
    const kmh = Math.ceil((L.minSpeed * 3.6) / 5) * 5;
    const sx = L.ex - ax * 4 - lx * 3;
    const sz = L.ez - az * 4 - lz * 3;
    B.geo("metal", GEO.cyl8, sx, 1.6, sz, "#333333", 0, 0, 0, 0.08, 3.2, 0.08);
    addSign(`ab ${kmh} km/h`, "🎢", "#6a1b9a", sx, 3.6, sz, Math.atan2(-ax, -az), 4);
  };
  loop(-32, -20, 0, 1, 1, 0, 5, "#e53935");
  loop(14, -38, 1, 0, 0, 1, 6.5, "#1e88e5");

  // ---------- Deko ----------
  const tires = (x: number, z: number) => {
    for (let k = 0; k < 3; k++) B.geo("rubber", GEO.torusWheel, x, 0.2 + k * 0.35, z, "#1b1b1b", Math.PI / 2, 0, 0, 0.55, 0.55, 0.55);
    colliders.push({ minX: x - 0.7, maxX: x + 0.7, minZ: z - 0.7, maxZ: z + 0.7 });
  };
  for (const [u, v] of [
    [-41, -41],
    [41, -41],
    [-41, 41],
    [41, 41],
    [-6, 30],
    [20, 30],
  ])
    tires(cx + u, cz + v);
  for (let k = 0; k < 10; k++) {
    const x = cx - 30 + k * 2.2;
    B.geo("plain", GEO.cone8, x, 0.4, cz + 30, k % 2 ? "#ffffff" : "#ff6d00", 0, 0, 0, 0.3, 0.7, 0.3);
  }
  // Tribüne am Nordrand
  for (let k = 0; k < 4; k++) B.box("concrete", 22, 0.6, 1.4, cx + 10, 0.3 + k * 0.6, rect.maxZ - 2.2 - k * 1.2, k % 2 ? "#8d99a6" : "#b0bac4");
  colliders.push({ minX: cx - 1, maxX: cx + 21, minZ: rect.maxZ - 7, maxZ: rect.maxZ - 1.5 });
  // Eingangsbogen (Westen)
  const gx = rect.minX - 0.5;
  for (const s of [-1, 1]) B.box("paintGloss", 0.6, 7, 0.6, gx, 3.5, cz + s * 6.5, "#ff7a00");
  B.box("paintGloss", 0.6, 0.8, 13.6, gx, 7.2, cz, "#ff7a00");
  addSign("JUMP PARK", "🎢", "#ff6d00", gx - 0.35, 8.9, cz, -Math.PI / 2, 12);
  addSign("JUMP PARK", "🎢", "#ff6d00", gx + 0.35, 8.9, cz, Math.PI / 2, 12);
  B.box("plain", 0.3, 3.2, 12.4, gx, 8.9, cz, "#ffffff");

  return { rect, ramps, platforms, loops };
}
