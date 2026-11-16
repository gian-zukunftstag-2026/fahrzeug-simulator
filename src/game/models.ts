import * as THREE from "three";
import { Builder, GEO } from "./builder";
import type { VehicleDef } from "./vehicles";

// =====================================================================
//  Menschen
// =====================================================================
export interface PersonOpts {
  shirt: string;
  pants: string;
  skin: string;
  hair: string;
  shoes?: string;
  helmet?: string;
  helmetStripe?: string;
  cap?: string;
  backpack?: boolean;
  logo?: boolean;
  gloves?: string;
}

export interface Person {
  root: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  arms: [THREE.Group, THREE.Group]; // [links(+x), rechts(-x)]
  elbows: [THREE.Group, THREE.Group];
  legs: [THREE.Group, THREE.Group];
  knees: [THREE.Group, THREE.Group];
}

function part(fn: (B: Builder) => void) {
  const B = new Builder();
  fn(B);
  return B.buildGroup();
}

export const UPPER_ARM = 0.29;
export const FOREARM = 0.34;
export const THIGH = 0.46;
export const SHIN = 0.455;

export function buildPerson(o: PersonOpts): Person {
  const root = new THREE.Group();
  const shoes = o.shoes ?? "#2b2b2b";
  const legs: THREE.Group[] = [];
  const knees: THREE.Group[] = [];
  for (const s of [1, -1]) {
    const leg = new THREE.Group();
    leg.position.set(s * 0.11, 0.92, 0);
    leg.add(part((B) => B.box("plain", 0.2, 0.47, 0.22, 0, -0.22, 0, o.pants)));
    const knee = new THREE.Group();
    knee.position.y = -THIGH;
    knee.add(
      part((B) => {
        B.box("plain", 0.19, 0.4, 0.2, 0, -0.2, 0, o.pants);
        B.box("plain", 0.21, 0.1, 0.32, 0, -0.41, 0.05, shoes);
        B.box("plain", 0.215, 0.03, 0.325, 0, -0.445, 0.05, "#e8e8e8");
      }),
    );
    leg.add(knee);
    root.add(leg);
    legs.push(leg);
    knees.push(knee);
  }
  root.add(
    part((B) => {
      B.box("plain", 0.42, 0.2, 0.25, 0, 0.95, 0, o.pants);
      B.box("plain", 0.43, 0.05, 0.26, 0, 1.04, 0, "#2a2a2a");
    }),
  );

  const torso = new THREE.Group();
  torso.position.y = 1.02;
  root.add(torso);
  torso.add(
    part((B) => {
      B.box("plain", 0.46, 0.56, 0.27, 0, 0.28, 0, o.shirt);
      B.box("plain", 0.3, 0.06, 0.28, 0, 0.57, 0, o.shirt);
      B.box("plain", 0.14, 0.08, 0.14, 0, 0.6, 0, o.skin);
      if (o.logo) {
        B.box("plain", 0.47, 0.06, 0.275, 0, 0.18, 0, "#ffffff");
        B.box("glow", 0.12, 0.12, 0.01, 0.1, 0.4, 0.14, "#ffe14d");
      }
      if (o.backpack) {
        B.box("plain", 0.42, 0.48, 0.26, 0, 0.3, -0.27, "#ff7a00");
        B.box("plain", 0.43, 0.07, 0.27, 0, 0.42, -0.27, "#ffffff");
        B.box("plain", 0.05, 0.5, 0.03, 0.13, 0.3, 0.145, "#333333");
        B.box("plain", 0.05, 0.5, 0.03, -0.13, 0.3, 0.145, "#333333");
      }
    }),
  );

  const arms: THREE.Group[] = [];
  const elbows: THREE.Group[] = [];
  for (const s of [1, -1]) {
    const arm = new THREE.Group();
    arm.position.set(s * 0.31, 0.5, 0);
    arm.add(part((B) => B.box("plain", 0.15, 0.31, 0.16, 0, -0.13, 0, o.shirt)));
    const elbow = new THREE.Group();
    elbow.position.y = -UPPER_ARM;
    elbow.add(
      part((B) => {
        B.box("plain", 0.14, 0.27, 0.15, 0, -0.13, 0, o.shirt);
        B.box("plain", 0.12, 0.12, 0.13, 0, -0.32, 0, o.gloves ?? o.skin);
      }),
    );
    arm.add(elbow);
    torso.add(arm);
    arms.push(arm);
    elbows.push(elbow);
  }

  const head = new THREE.Group();
  head.position.y = 0.64;
  torso.add(head);
  head.add(
    part((B) => {
      B.box("plain", 0.34, 0.34, 0.32, 0, 0.17, 0, o.skin);
      if (o.helmet) {
        B.box("paintGloss", 0.4, 0.38, 0.4, 0, 0.2, -0.005, o.helmet);
        B.box("paintGloss", 0.405, 0.06, 0.405, 0, 0.3, -0.005, o.helmetStripe ?? "#ffffff");
        B.box("glass", 0.32, 0.13, 0.02, 0, 0.2, 0.2, "#1d2733");
        B.box("paintGloss", 0.3, 0.08, 0.03, 0, 0.06, 0.2, o.helmet);
      } else {
        for (const s of [1, -1]) {
          B.box("plain", 0.08, 0.07, 0.01, s * 0.08, 0.2, 0.162, "#ffffff");
          B.box("plain", 0.04, 0.05, 0.01, s * 0.08, 0.195, 0.168, "#222222");
          B.box("plain", 0.09, 0.02, 0.01, s * 0.08, 0.26, 0.162, o.hair);
          B.box("plain", 0.03, 0.08, 0.06, s * 0.18, 0.18, 0, o.skin);
        }
        B.box("plain", 0.05, 0.06, 0.04, 0, 0.15, 0.17, o.skin);
        B.box("plain", 0.1, 0.025, 0.01, 0, 0.08, 0.162, "#8a3b2e");
        B.box("plain", 0.36, 0.1, 0.34, 0, 0.36, 0, o.hair);
        B.box("plain", 0.36, 0.22, 0.07, 0, 0.25, -0.15, o.hair);
        if (o.cap) {
          B.box("plain", 0.37, 0.1, 0.35, 0, 0.38, 0, o.cap);
          B.box("plain", 0.3, 0.03, 0.16, 0, 0.34, 0.23, o.cap);
        }
      }
    }),
  );

  return {
    root,
    torso,
    head,
    arms: [arms[0], arms[1]],
    elbows: [elbows[0], elbows[1]],
    legs: [legs[0], legs[1]],
    knees: [knees[0], knees[1]],
  };
}

/** 2-Gelenk-IK in der y/z-Ebene. Winkel: Drehung um x, Glied hängt anfangs nach unten. */
function solveIK(
  sy: number,
  sz: number,
  ty: number,
  tz: number,
  l1: number,
  l2: number,
  bendForward: boolean,
): [number, number] {
  const dy = ty - sy;
  const dz = tz - sz;
  const d = Math.min(Math.hypot(dy, dz), l1 + l2 - 0.001);
  const phi = Math.atan2(-dz, -dy);
  const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const A = Math.acos(Math.max(-1, Math.min(1, cosA)));
  const cosC = (l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2);
  const C = Math.acos(Math.max(-1, Math.min(1, cosC)));
  if (bendForward) return [phi - A, Math.PI - C];
  return [phi + A, -(Math.PI - C)];
}

/** Fahrer-Pose: Hüfte, Füße und Hände (in Fahrzeug-Koordinaten, y/z) */
function poseRider(
  p: Person,
  hip: [number, number],
  feet: [[number, number], [number, number]],
  hands: [number, number],
  lean: number,
) {
  p.root.position.set(0, hip[0] - 0.92, hip[1]);
  p.torso.rotation.x = lean;
  for (let i = 0; i < 2; i++) {
    const [a, b] = solveIK(hip[0], hip[1], feet[i][0], feet[i][1], THIGH, SHIN, true);
    p.legs[i].rotation.x = a;
    p.knees[i].rotation.x = b;
  }
  const sy = hip[0] + 0.1 + 0.5 * Math.cos(lean);
  const sz = hip[1] + 0.5 * Math.sin(lean);
  const [a, b] = solveIK(sy, sz, hands[0], hands[1], UPPER_ARM, FOREARM, false);
  for (let i = 0; i < 2; i++) {
    p.arms[i].rotation.x = a - lean;
    p.elbows[i].rotation.x = b;
    p.arms[i].rotation.z = (i === 0 ? -1 : 1) * 0.08;
  }
  p.head.rotation.x = -lean * 0.6;
}

// =====================================================================
//  Räder
// =====================================================================
const RING = new THREE.TorusGeometry(1, 0.06, 6, 32);

function buildWheel(r: number, width: number, style: "cast" | "spoke" | "scooter" | "offroad", rim: string, disc: boolean) {
  const B = new Builder();
  const k = r / 1.28;
  const tw = width / (2 * 0.28 * k);
  B.geo("rubber", GEO.torusWheel, 0, 0, 0, "#1b1b1b", 0, Math.PI / 2, 0, k, k, k * tw);
  if (style === "offroad") {
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      B.box("rubber", width * 0.9, 0.035, 0.05, 0, Math.cos(a) * r * 0.99, Math.sin(a) * r * 0.99, "#141414", a);
    }
  }
  const inner = 0.72 * k;
  if (style === "scooter" || style === "offroad") {
    B.geo("paintGloss", GEO.cyl24, 0, 0, 0, rim, 0, 0, Math.PI / 2, inner, width * 0.8, inner);
    B.geo("metal", GEO.cyl16, 0, 0, 0, "#3a3a3a", 0, 0, Math.PI / 2, inner * 0.45, width * 0.95, inner * 0.45);
  } else {
    B.geo("paintGloss", RING, 0, 0, 0, rim, 0, Math.PI / 2, 0, inner, inner, inner * 2.2);
    B.geo("chrome", GEO.cyl16, 0, 0, 0, "#d0d0d0", 0, 0, Math.PI / 2, 0.06, width * 0.9, 0.06);
    if (style === "cast") {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        B.box("paintGloss", 0.03, inner, 0.045, 0, (Math.cos(a) * inner) / 2, (Math.sin(a) * inner) / 2, rim, a);
      }
    } else {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        B.box("chrome", 0.012, inner, 0.012, (i % 2 ? 1 : -1) * 0.02, (Math.cos(a) * inner) / 2, (Math.sin(a) * inner) / 2, "#d8d8d8", a);
      }
    }
  }
  if (disc) {
    const off = width * 0.42;
    B.geo("chrome", GEO.cyl24, off, 0, 0, "#bfbfbf", 0, 0, Math.PI / 2, inner * 0.62, 0.012, inner * 0.62);
  }
  return B.buildGroup();
}

// =====================================================================
//  Aufkleber (Schriftzug)
// =====================================================================
const decalCache = new Map<string, THREE.Material>();
function decal(text: string, color: string, w: number, h: number) {
  const key = text + color;
  let mat = decalCache.get(key);
  if (!mat) {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = Math.round((512 * h) / w);
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = color;
    ctx.font = `italic 900 ${Math.round(c.height * 0.78)}px "Arial Black", Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 256, c.height / 2 + 2, 500);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    mat = new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -2 });
    decalCache.set(key, mat);
  }
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
}

function addDecals(parent: THREE.Object3D, text: string, color: string, x: number, y: number, z: number, w: number, h: number, ry = 0) {
  for (const s of [1, -1]) {
    const m = decal(text, color, w, h);
    m.position.set(s * x, y, z);
    m.rotation.y = s * (Math.PI / 2) + s * ry;
    parent.add(m);
  }
}

function decalText(def: VehicleDef) {
  if (def.brand === "Kukirin") return "KUKIRIN";
  if (def.style === "classic") return "KAWASAKI";
  if (def.style === "hyper") return "H2";
  if (def.style === "sport") return "NINJA";
  return def.name.replace("Kawasaki ", "").replace(" Pro", "");
}

// =====================================================================
//  Fahrzeuge
// =====================================================================
export interface VehicleModel {
  root: THREE.Group;
  lean: THREE.Group;
  pitch: THREE.Group;
  wheels: { g: THREE.Group; r: number }[];
  rider: Person;
}

interface Geom {
  r: number;
  rearZ: number;
  frontZ: number;
  hip: [number, number];
  feet: [[number, number], [number, number]];
  hands: [number, number];
  lean: number;
}

function buildMoto(def: VehicleDef, g: THREE.Group, wheels: THREE.Group[]): Geom {
  const s = def.style;
  const c = def.color;
  const a = def.accent;
  const classic = s === "classic";
  const sport = s === "sport" || s === "hyper";
  const naked = s === "naked";
  const paint = s === "hyper" ? "chrome" : "paintGloss";
  const r = classic ? 0.32 : 0.33;
  const rearZ = -0.7;
  const frontZ = 0.72;
  const B = new Builder();

  // Motor
  B.box("metal", 0.34, 0.36, 0.5, 0, 0.45, 0.02, "#2b2b2b");
  B.box("metal", 0.38, 0.22, 0.28, 0, 0.68, 0.16, classic ? "#a0a0a0" : "#3a3a3a", -0.35);
  if (!sport) for (let i = 0; i < 4; i++) B.box("metal", 0.42, 0.022, 0.3, 0, 0.6 + i * 0.05, 0.17, "#8a8a8a", -0.35);
  B.geo("metal", GEO.cyl16, 0.18, 0.42, 0.02, "#555555", 0, 0, Math.PI / 2, 0.13, 0.04, 0.13);
  B.box("metal", 0.03, 0.06, 0.62, 0.15, r + 0.02, -0.38, "#444444", -0.15); // Kette

  // Schwinge
  for (const sx of [-1, 1]) B.box("metal", 0.05, 0.07, 0.66, sx * 0.13, r + 0.06, -0.4, "#222222", -0.2);

  // Rahmen
  if (naked || s === "hyper") {
    for (const sx of [-1, 1]) {
      B.box("paintGloss", 0.04, 0.04, 0.8, sx * 0.17, 0.78, 0.2, a, -0.65);
      B.box("paintGloss", 0.04, 0.04, 0.55, sx * 0.18, 0.62, 0.25, a, 0.55);
      B.box("paintGloss", 0.04, 0.04, 0.5, sx * 0.16, 0.85, -0.25, a, 0.2);
    }
  } else {
    for (const sx of [-1, 1]) B.box("metal", 0.04, 0.05, 0.8, sx * 0.15, 0.78, 0.2, classic ? "#2a2a2a" : "#333333", -0.6);
  }

  // Tank & Sitz & Heck
  if (sport) {
    B.box(paint, 0.42, 0.24, 0.48, 0, 0.98, 0.2, c);
    B.box("paintGloss", 0.43, 0.05, 0.3, 0, 0.95, 0.2, a);
    B.box("rubber", 0.3, 0.08, 0.38, 0, 0.92, -0.2, "#151515");
    B.box(paint, 0.28, 0.18, 0.5, 0, 1.0, -0.58, c, 0.3);
    B.box("paintGloss", 0.29, 0.04, 0.4, 0, 0.98, -0.58, a, 0.3);
    B.box("glow", 0.16, 0.05, 0.03, 0, 1.06, -0.83, "#ff2a2a", 0.3);
  } else if (naked) {
    B.box(paint, 0.48, 0.28, 0.52, 0, 1.0, 0.2, c);
    for (const sx of [-1, 1]) {
      B.box(paint, 0.06, 0.28, 0.4, sx * 0.26, 0.88, 0.4, c, 0, sx * 0.25);
      B.box("paintGloss", 0.065, 0.06, 0.32, sx * 0.265, 0.82, 0.4, a, 0, sx * 0.25);
    }
    B.box("rubber", 0.32, 0.09, 0.5, 0, 0.95, -0.25, "#151515");
    B.box(paint, 0.22, 0.12, 0.3, 0, 1.0, -0.6, c, 0.35);
    B.box("glow", 0.14, 0.04, 0.03, 0, 1.03, -0.76, "#ff2a2a", 0.35);
  } else {
    B.box(paint, 0.32, 0.22, 0.42, 0, 0.98, 0.2, c);
    B.box("chrome", 0.33, 0.06, 0.12, 0, 0.97, 0.25, "#dddddd");
    B.box("plain", 0.1, 0.06, 0.08, 0.13, 1.02, 0.1, "#b5652b");
    B.box("plain", 0.08, 0.05, 0.1, -0.15, 0.94, 0.33, "#7a3e1d");
    B.box("rubber", 0.3, 0.1, 0.75, 0, 0.95, -0.27, "#2a1f1a");
    for (const sx of [-1, 1]) B.box(paint, 0.06, 0.2, 0.3, sx * 0.16, 0.78, -0.15, c);
    B.box("chrome", 0.26, 0.03, 0.35, 0, 1.03, -0.72, "#cfcfcf");
    B.geo("glow", GEO.cyl16, 0, 0.93, -0.92, "#ff3b2a", Math.PI / 2, 0, 0, 0.05, 0.03, 0.05);
    B.box("plain", 0.07, 0.05, 0.05, 0.12, 0.92, 0.45, "#a3521f");
  }

  // Kotflügel
  if (classic) {
    B.box("chrome", 0.16, 0.035, 0.55, 0, r * 2 + 0.05, rearZ - 0.05, "#d0d0d0", 0.25);
    B.box("chrome", 0.14, 0.035, 0.5, 0, r * 2 + 0.05, frontZ + 0.03, "#d0d0d0", -0.1);
  } else {
    B.box("rubber", 0.16, 0.04, 0.35, 0, r * 2 + 0.03, rearZ + 0.05, "#1a1a1a");
    B.box(paint, 0.14, 0.04, 0.42, 0, r * 2 + 0.04, frontZ + 0.02, c);
  }
  // Nummernschild
  B.box("plain", 0.18, 0.12, 0.01, 0, 0.8, -0.92, "#f5f5f5", 0.4);
  B.box("plain", 0.18, 0.02, 0.012, 0, 0.84, -0.915, "#1f4fbf", 0.4);

  // Auspuff
  if (sport) {
    B.geo("metal", GEO.cyl16, 0.17, 0.42, -0.42, "#2b2b2b", Math.PI / 2, 0, 0, 0.08, 0.5, 0.08);
    B.geo("chrome", GEO.cyl16, 0.17, 0.42, -0.68, "#cccccc", Math.PI / 2, 0, 0, 0.06, 0.03, 0.06);
  } else if (naked) {
    B.geo("metal", GEO.cyl16, 0.18, 0.4, -0.25, "#2b2b2b", Math.PI / 2 - 0.2, 0, 0, 0.09, 0.4, 0.09);
  } else {
    B.geo("chrome", GEO.cyl16, 0.17, 0.62, -0.45, "#dcdcdc", Math.PI / 2 + 0.25, 0, 0, 0.05, 0.75, 0.05);
  }
  B.geo("chrome", GEO.cyl8, 0.08, 0.5, 0.32, "#bbbbbb", 0.6, 0, 0, 0.03, 0.3, 0.03);

  // Gabel
  const forkCol = sport ? "#d4a017" : "#cfcfcf";
  for (const sx of [-1, 1]) {
    B.geo(sport ? "paintGloss" : "chrome", GEO.cyl16, sx * 0.1, 0.675, 0.62, forkCol, -0.28, 0, 0, 0.033, 0.72, 0.033);
    B.geo("metal", GEO.cyl16, sx * 0.1, 0.47, 0.68, "#2a2a2a", -0.28, 0, 0, 0.042, 0.3, 0.042);
  }
  B.box("metal", 0.3, 0.05, 0.12, 0, 1.0, 0.53, "#333333", -0.28);

  // Lenker
  let hands: [number, number];
  if (sport) {
    for (const sx of [-1, 1]) {
      B.box("metal", 0.2, 0.035, 0.035, sx * 0.2, 0.98, 0.5, "#222222", 0, sx * 0.2);
      B.box("rubber", 0.1, 0.045, 0.045, sx * 0.3, 0.975, 0.47, "#111111", 0, sx * 0.2);
    }
    hands = [0.98, 0.47];
  } else if (naked) {
    B.box("metal", 0.72, 0.035, 0.035, 0, 1.12, 0.48, "#222222");
    for (const sx of [-1, 1]) {
      B.box("metal", 0.03, 0.1, 0.03, sx * 0.08, 1.07, 0.5, "#333333");
      B.box("rubber", 0.1, 0.045, 0.045, sx * 0.34, 1.12, 0.48, "#111111");
    }
    hands = [1.12, 0.48];
  } else {
    B.box("chrome", 0.72, 0.03, 0.03, 0, 1.18, 0.45, "#dcdcdc");
    for (const sx of [-1, 1]) B.box("rubber", 0.1, 0.045, 0.045, sx * 0.34, 1.18, 0.45, "#222222");
    hands = [1.18, 0.45];
  }
  // Spiegel
  for (const sx of [-1, 1]) {
    B.box("metal", 0.02, 0.16, 0.02, sx * 0.27, hands[0] + 0.08, hands[1] + 0.05, "#222222", 0, 0, sx * 0.3);
    B.box("metal", 0.11, 0.06, 0.03, sx * 0.31, hands[0] + 0.17, hands[1] + 0.05, "#222222");
    B.box("chrome", 0.09, 0.045, 0.005, sx * 0.31, hands[0] + 0.17, hands[1] + 0.03, "#eeeeee");
  }

  // Verkleidung / Lampe
  if (sport) {
    for (const sx of [-1, 1]) {
      B.box(paint, 0.05, 0.42, 0.7, sx * 0.22, 0.66, 0.28, c, 0, sx * 0.06);
      B.box("paintGloss", 0.055, 0.1, 0.5, sx * 0.226, 0.56, 0.22, a, 0, sx * 0.06);
    }
    B.box(paint, 0.4, 0.14, 0.6, 0, 0.32, 0.12, c);
    B.box(paint, 0.38, 0.3, 0.36, 0, 0.9, 0.64, c, -0.5);
    B.box(paint, 0.28, 0.16, 0.22, 0, 0.84, 0.84, c, -0.7);
    for (const sx of [-1, 1]) B.box("glow", 0.11, 0.05, 0.03, sx * 0.09, 0.86, 0.93, "#e8f4ff", -0.7, sx * 0.25);
    B.box("plain", s === "hyper" ? 0.18 : 0.12, 0.08, 0.05, 0, 0.79, 0.95, "#111111", -0.7);
    B.box("glass", 0.32, 0.26, 0.02, 0, 1.1, 0.66, "#33424f", -1.05);
    B.box("plain", 0.16, 0.06, 0.1, 0, 1.0, 0.55, "#111111");
    B.box("glow", 0.12, 0.005, 0.07, 0, 1.032, 0.55, "#7fe0ff");
  } else if (naked) {
    B.box("plain", 0.22, 0.18, 0.14, 0, 1.02, 0.66, "#1a1a1a", -0.2);
    B.box("glow", 0.17, 0.08, 0.02, 0, 1.02, 0.735, "#e8f4ff", -0.2);
    B.box(paint, 0.2, 0.08, 0.02, 0, 1.13, 0.7, c, -0.5);
    B.box("metal", 0.36, 0.28, 0.05, 0, 0.66, 0.42, "#222222");
    for (const sx of [-1, 1]) B.box(paint, 0.04, 0.28, 0.12, sx * 0.19, 0.66, 0.42, c);
  } else {
    B.geo("chrome", GEO.cyl16, 0, 1.02, 0.7, "#dddddd", Math.PI / 2, 0, 0, 0.11, 0.12, 0.11);
    B.geo("glow", GEO.cyl16, 0, 1.02, 0.765, "#fff3c4", Math.PI / 2, 0, 0, 0.09, 0.01, 0.09);
    B.geo("chrome", GEO.cyl16, 0.1, 1.17, 0.5, "#dddddd", 0.4, 0, 0, 0.05, 0.05, 0.05);
    for (const sx of [-1, 1]) B.geo("glow", GEO.sphere, sx * 0.17, 1.0, 0.66, "#ff9a1f", 0, 0, 0, 0.035, 0.035, 0.035);
    for (const sx of [-1, 1]) B.geo("chrome", GEO.cyl8, sx * 0.13, 0.62, -0.62, "#cfcfcf", 0.3, 0, 0, 0.025, 0.4, 0.025);
  }

  // Lieferbox
  const rackY = sport ? 1.12 : 1.08;
  B.box("metal", 0.3, 0.03, 0.36, 0, rackY, -0.76, "#222222");
  B.box("plain", 0.5, 0.42, 0.46, 0, rackY + 0.23, -0.8, "#ff7a00");
  B.box("plain", 0.51, 0.06, 0.47, 0, rackY + 0.42, -0.8, "#ffffff");
  B.box("glow", 0.16, 0.16, 0.01, 0, rackY + 0.2, -1.035, "#ffe14d");
  // Fußrasten
  B.box("metal", 0.52, 0.03, 0.05, 0, 0.44, -0.12, "#999999");

  g.add(B.buildGroup());

  // Aufkleber
  const txt = decalText(def);
  const decColor = c === "#1a1a1a" || c === "#2a2d33" || c === "#2b2f36" || c === "#50555c" ? def.accent : "#ffffff";
  if (sport) addDecals(g, txt, decColor, 0.252, 0.7, 0.3, 0.5, 0.13, 0.06);
  else if (naked) addDecals(g, txt, decColor, 0.29, 0.88, 0.41, 0.34, 0.1, 0.25);
  else addDecals(g, txt, "#f3e3c3", 0.163, 1.0, 0.2, 0.34, 0.07);

  const rim = sport ? (c === def.accent ? "#1d1d1d" : s === "hyper" ? a : c === "#1a1a1a" ? a : "#1d1d1d") : naked ? a : "#cfcfcf";
  const style = classic ? "spoke" : "cast";
  wheels.push(buildWheel(r, sport ? 0.2 : 0.18, style, rim, true), buildWheel(r, 0.16, style, rim, true));
  wheels[0].position.set(0, r, rearZ);
  wheels[1].position.set(0, r, frontZ);
  wheels[1].children.forEach((m) => (m.rotation.y = 0));
  g.add(wheels[0], wheels[1]);

  const seatZ = sport ? -0.2 : -0.25;
  const seatY = sport ? 0.96 : classic ? 1.0 : 1.0;
  return {
    r,
    rearZ,
    frontZ,
    hip: [seatY + 0.05, seatZ],
    feet: [
      [0.42, -0.1],
      [0.42, -0.1],
    ],
    hands,
    lean: s === "hyper" ? 0.5 : sport ? 0.45 : naked ? 0.25 : 0.1,
  };
}

function buildScooter(def: VehicleDef, g: THREE.Group, wheels: THREE.Group[]): Geom {
  const c = def.color;
  const a = def.accent;
  const off = def.style === "offroad";
  const max = def.id === "g4max" || def.id === "g5";
  const r = off ? 0.25 : 0.19;
  const rearZ = -0.52;
  const frontZ = 0.55;
  const deckY = r + 0.07;
  const B = new Builder();

  B.box("paintGloss", 0.24, 0.1, 1.0, 0, deckY, -0.02, c);
  B.box("rubber", 0.2, 0.015, 0.82, 0, deckY + 0.055, -0.02, "#2a2a2a");
  for (const sx of [-1, 1]) B.box(max ? "glow" : "paintGloss", 0.01, 0.025, 0.9, sx * 0.121, deckY, -0.02, a);
  B.box("plain", 0.2, 0.06, 0.7, 0, deckY - 0.07, 0, "#2a2a2a");
  B.box("paintGloss", 0.16, 0.25, 0.16, 0, deckY + 0.08, 0.5, c, -0.45);

  const sY = deckY + 0.15;
  const sZ = 0.55;
  const tY = 1.32;
  const tZ = 0.66;
  const L = Math.hypot(tY - sY, tZ - sZ);
  const rx = Math.atan2(tZ - sZ, tY - sY);
  B.geo("metal", GEO.cyl16, 0, (sY + tY) / 2, (sZ + tZ) / 2, "#222222", rx, 0, 0, 0.035, L, 0.035);
  B.box("paintGloss", 0.08, 0.1, 0.08, 0, sY + 0.3, sZ + 0.03, a);

  // Vordergabel
  for (const sx of [-1, 1]) {
    if (off) {
      B.geo("paintGloss", GEO.cyl8, sx * 0.08, (r + deckY + 0.25) / 2, frontZ - 0.02, a, -0.1, 0, 0, 0.03, deckY + 0.25 - r, 0.03);
      B.geo("metal", GEO.cyl8, sx * 0.08, r + 0.08, frontZ, "#2a2a2a", -0.1, 0, 0, 0.022, 0.2, 0.022);
    } else {
      B.box("metal", 0.025, deckY + 0.2 - r, 0.03, sx * 0.06, (r + deckY + 0.2) / 2, frontZ - 0.02, "#2a2a2a", -0.15);
    }
  }
  // Lenker + Display
  B.box("metal", 0.58, 0.03, 0.03, 0, tY + 0.01, tZ, "#222222");
  for (const sx of [-1, 1]) {
    B.box("rubber", 0.11, 0.04, 0.04, sx * 0.25, tY + 0.01, tZ, "#111111");
    B.box("metal", 0.12, 0.01, 0.02, sx * 0.18, tY + 0.01, tZ + 0.06, "#888888");
  }
  B.box("plain", 0.14, 0.03, 0.09, 0, tY + 0.04, tZ - 0.01, "#111111");
  B.box("glow", 0.1, 0.005, 0.065, 0, tY + 0.057, tZ - 0.01, off ? "#4fc3f7" : "#7cf");
  B.box("plain", 0.12, 0.08, 0.06, 0, 1.15, 0.69, "#222222");
  B.box("glow", 0.1, 0.06, 0.01, 0, 1.15, 0.722, "#eaf6ff");
  if (off) B.box("glow", 0.12, 0.03, 0.01, 0, deckY + 0.12, 0.6, "#eaf6ff");
  if (def.id === "g5") {
    // Raketen-Booster hinten
    for (const sx of [-1, 1]) {
      B.geo("chrome", GEO.cyl16, sx * 0.17, deckY + 0.12, rearZ - 0.15, "#b0bec5", Math.PI / 2, 0, 0, 0.09, 0.55, 0.09);
      B.geo("glow", GEO.cone8, sx * 0.17, deckY + 0.12, rearZ - 0.6, "#ff6d00", -Math.PI / 2, 0, 0, 0.08, 0.35, 0.08);
      B.geo("glow", GEO.cone8, sx * 0.17, deckY + 0.12, rearZ - 0.5, "#ffd54f", -Math.PI / 2, 0, 0, 0.05, 0.2, 0.05);
    }
    B.box("glow", 0.26, 0.02, 0.9, 0, deckY + 0.064, -0.02, "#00e5ff");
  }

  // Schutzbleche + Rücklicht
  B.box("paintGloss", 0.1, 0.025, 0.32, 0, 2 * r + 0.03, frontZ, c);
  B.box("paintGloss", 0.12, 0.025, 0.36, 0, 2 * r + 0.03, rearZ - 0.02, c, 0.15);
  B.box("glow", 0.08, 0.03, 0.02, 0, 2 * r + 0.06, rearZ - 0.2, "#ff2a2a");
  if (off) for (const sx of [-1, 1]) B.geo("paintGloss", GEO.cyl8, sx * 0.08, r + 0.1, rearZ + 0.14, a, 0.6, 0, 0, 0.025, 0.25, 0.025);
  B.box("metal", 0.02, 0.02, 0.25, 0.1, 0.1, -0.1, "#333333", 0, 0, 0.6);

  g.add(B.buildGroup());
  addDecals(g, "KUKIRIN", "#ffffff", 0.123, deckY, -0.02, 0.5, 0.06);

  const style = off ? "offroad" : "scooter";
  wheels.push(buildWheel(r, off ? 0.14 : 0.09, style, off ? a : "#333333", true), buildWheel(r, off ? 0.14 : 0.09, style, off ? a : "#333333", true));
  wheels[0].position.set(0, r, rearZ);
  wheels[1].position.set(0, r, frontZ);
  g.add(wheels[0], wheels[1]);

  const top = deckY + 0.05;
  return {
    r,
    rearZ,
    frontZ,
    hip: [top + 0.86, -0.05],
    feet: [
      [top, 0.14],
      [top, -0.2],
    ],
    hands: [tY + 0.01, tZ],
    lean: 0.12,
  };
}

// =====================================================================
//  Fahrbare Autos
// =====================================================================
interface CarSpec {
  len: number;
  w: number;
  bodyH: number;
  ride: number;
  cabinLen: number;
  cabinH: number;
  cabinZ: number;
  r: number;
  wheelZ: number;
  spoiler: 0 | 1 | 2;
  round: boolean;
  intakes: boolean;
  van?: boolean;
}
const CAR_SPECS: Record<string, CarSpec> = {
  city: { len: 3.6, w: 1.7, bodyH: 0.62, ride: 0.28, cabinLen: 2.0, cabinH: 0.66, cabinZ: -0.2, r: 0.3, wheelZ: 1.2, spoiler: 0, round: true, intakes: false },
  hatch: { len: 4.25, w: 1.8, bodyH: 0.6, ride: 0.3, cabinLen: 2.3, cabinH: 0.58, cabinZ: -0.45, r: 0.33, wheelZ: 1.35, spoiler: 1, round: false, intakes: false },
  sedan: { len: 4.7, w: 1.9, bodyH: 0.58, ride: 0.28, cabinLen: 2.1, cabinH: 0.54, cabinZ: -0.25, r: 0.35, wheelZ: 1.45, spoiler: 1, round: false, intakes: true },
  coupe: { len: 4.5, w: 1.88, bodyH: 0.55, ride: 0.25, cabinLen: 2.0, cabinH: 0.5, cabinZ: -0.35, r: 0.35, wheelZ: 1.4, spoiler: 2, round: true, intakes: true },
  super: { len: 4.6, w: 2.0, bodyH: 0.5, ride: 0.2, cabinLen: 1.8, cabinH: 0.44, cabinZ: -0.1, r: 0.36, wheelZ: 1.45, spoiler: 2, round: false, intakes: true },
  lambo: { len: 4.6, w: 2.05, bodyH: 0.45, ride: 0.18, cabinLen: 1.7, cabinH: 0.42, cabinZ: 0, r: 0.36, wheelZ: 1.45, spoiler: 2, round: false, intakes: true },
  van: { len: 4.9, w: 1.95, bodyH: 0.95, ride: 0.32, cabinLen: 3.9, cabinH: 0.9, cabinZ: -0.45, r: 0.34, wheelZ: 1.6, spoiler: 0, round: false, intakes: false, van: true },
};

function buildPlayerCar(def: VehicleDef): VehicleModel {
  const sp = CAR_SPECS[def.style] ?? CAR_SPECS.hatch;
  const root = new THREE.Group();
  const lean = new THREE.Group();
  root.add(lean);
  const pitch = new THREE.Group();
  lean.add(pitch);
  const frame = new THREE.Group();
  pitch.add(frame);
  pitch.position.set(0, sp.r, -sp.wheelZ);
  frame.position.set(0, -sp.r, sp.wheelZ);

  const B = new Builder();
  const P = "paintGloss";
  const c = def.color;
  const a = def.accent;
  const { len, w, bodyH, ride, cabinLen, cabinH, cabinZ } = sp;
  const top = ride + bodyH;
  const hl = len / 2;
  // Karosserie
  B.box(P, w, bodyH, len - 0.3, 0, ride + bodyH / 2, 0, c);
  B.box(P, w - 0.04, bodyH * 0.75, 0.4, 0, ride + bodyH * 0.38, hl - 0.2, c, sp.van ? 0 : 0.25);
  B.box(P, w - 0.04, bodyH * 0.8, 0.4, 0, ride + bodyH * 0.42, -hl + 0.2, c, -0.15);
  // Kabine
  const cy = top + cabinH / 2;
  B.box("glass", w - 0.18, cabinH, cabinLen, 0, cy, cabinZ, "#1f2b36");
  B.box(P, w - 0.16, 0.08, cabinLen * (sp.van ? 0.98 : 0.7), 0, top + cabinH + 0.02, cabinZ - (sp.van ? 0 : cabinLen * 0.08), c);
  for (const sx of [-1, 1]) {
    B.box(P, 0.06, cabinH, 0.1, sx * (w / 2 - 0.1), cy, cabinZ + cabinLen / 2 - 0.05, c, sp.van ? 0 : -0.45);
    B.box(P, 0.06, cabinH, 0.12, sx * (w / 2 - 0.1), cy, cabinZ - 0.05, c);
    B.box(P, 0.06, cabinH, 0.14, sx * (w / 2 - 0.1), cy, cabinZ - cabinLen / 2 + 0.07, c, sp.van ? 0 : 0.5);
    // Spiegel
    B.box(P, 0.22, 0.12, 0.1, sx * (w / 2 + 0.06), top + 0.15, cabinZ + cabinLen / 2 - 0.25, c);
    // Seitenleiste / Lufteinlass
    if (sp.intakes) B.box("plain", 0.04, bodyH * 0.45, 0.9, sx * (w / 2 + 0.01), ride + bodyH * 0.45, -hl * 0.35, "#111111");
    B.box("plain", 0.03, 0.06, len - 1.2, sx * (w / 2 + 0.01), ride + 0.06, 0, "#151515");
    if (sp.van) B.box("plain", 0.02, 0.3, len - 1.6, sx * (w / 2 + 0.01), ride + bodyH * 0.55, -0.3, a);
    else if (def.style === "hatch" || def.style === "sedan") B.box("plain", 0.02, 0.05, len - 1.3, sx * (w / 2 + 0.012), ride + bodyH * 0.75, 0, a);
  }
  if (def.style === "hatch") B.box("glow", w * 0.7, 0.03, 0.02, 0, ride + bodyH * 0.55, hl + 0.01, "#ff1744");
  if (def.style === "lambo") {
    B.box(P, w - 0.1, 0.12, 1.2, 0, top + 0.05, hl - 0.9, c, 0.12);
    for (const sx of [-1, 1]) B.box("plain", 0.5, 0.25, 0.06, sx * 0.55, ride + 0.25, hl + 0.01, "#111111");
  }
  // Licht
  for (const sx of [-1, 1]) {
    if (sp.round) B.geo("glow", GEO.cyl16, sx * (w / 2 - 0.32), ride + bodyH * 0.65, hl - 0.02, "#f2f8ff", Math.PI / 2, 0, 0, 0.13, 0.05, 0.13);
    else B.box("glow", 0.42, 0.08, 0.04, sx * (w / 2 - 0.34), ride + bodyH * 0.68, hl + 0.01, "#f2f8ff");
    B.box("glow", sp.van ? 0.15 : 0.4, sp.van ? 0.5 : 0.09, 0.04, sx * (w / 2 - 0.3), ride + bodyH * (sp.van ? 0.5 : 0.7), -hl - 0.01, "#ff1a1a");
  }
  // Stoßstangen, Grill, Kennzeichen, Auspuff
  B.box("plain", w * 0.5, bodyH * 0.25, 0.04, 0, ride + bodyH * 0.35, hl + 0.01, "#151515");
  B.box("rubber", w + 0.04, 0.18, 0.12, 0, ride + 0.09, hl - 0.04, "#202020");
  B.box("rubber", w + 0.04, 0.18, 0.12, 0, ride + 0.09, -hl + 0.04, "#202020");
  B.box("plain", 0.5, 0.12, 0.02, 0, ride + 0.25, hl + 0.06, "#f5f5f5");
  B.box("plain", 0.5, 0.12, 0.02, 0, ride + 0.3, -hl - 0.06, "#f5f5f5");
  for (const sx of def.style === "sedan" || def.style === "super" || def.style === "lambo" ? [-0.35, -0.2, 0.2, 0.35] : [-0.3])
    B.geo("chrome", GEO.cyl16, sx, ride + 0.12, -hl - 0.05, "#cccccc", Math.PI / 2, 0, 0, 0.05, 0.12, 0.05);
  // Spoiler
  if (sp.spoiler === 1) B.box(P, w - 0.3, 0.05, 0.25, 0, top + (sp.van ? 0 : 0.03), -hl + 0.2, a === "#ffffff" ? c : a);
  if (sp.spoiler === 2) {
    B.box(P, w - 0.2, 0.05, 0.35, 0, top + 0.35, -hl + 0.25, def.style === "coupe" ? c : "#111111");
    for (const sx of [-1, 1]) B.box("plain", 0.05, 0.32, 0.12, sx * 0.55, top + 0.18, -hl + 0.25, "#111111");
  }
  frame.add(B.buildGroup());
  if (sp.van) addDecals(frame, "LIEFERBLITZ", "#ff7a00", w / 2 + 0.025, ride + bodyH * 0.55 + 0.35, -0.3, 2.6, 0.35);
  if (def.style === "hatch") addDecals(frame, "GTI", "#ffffff", w / 2 + 0.02, ride + 0.3, -hl + 0.8, 0.4, 0.14);
  if (def.style === "sedan") addDecals(frame, "M3", "#ffffff", w / 2 + 0.02, ride + 0.3, hl - 1.0, 0.35, 0.14);

  // Räder
  const wheels: { g: THREE.Group; r: number }[] = [];
  for (const sz of [-1, 1]) {
    for (const sx of [-1, 1]) {
      const WB = new Builder();
      WB.geo("rubber", GEO.cyl24, 0, 0, 0, "#151515", 0, 0, Math.PI / 2, sp.r, 0.26, sp.r);
      WB.geo("chrome", GEO.cyl16, sx * 0.01, 0, 0, def.style === "super" ? "#2b2b2b" : "#c8c8c8", 0, 0, Math.PI / 2, sp.r * 0.65, 0.27, sp.r * 0.65);
      for (let k = 0; k < 5; k++) {
        const ang = (k / 5) * Math.PI * 2;
        WB.box("metal", 0.28, sp.r * 0.55, 0.06, 0, Math.cos(ang) * sp.r * 0.3, Math.sin(ang) * sp.r * 0.3, "#888888", ang);
      }
      if (sp.intakes) WB.box("plain", 0.05, 0.16, 0.2, -sx * 0.1, sp.r * 0.35, 0.1, def.style === "super" ? "#ffd400" : "#d32f2f");
      const g = WB.buildGroup();
      g.position.set(sx * (w / 2 - 0.12), sp.r, sz * sp.wheelZ);
      frame.add(g);
      wheels.push({ g, r: sp.r });
    }
  }

  // Fahrer (links sitzend)
  const rider = buildPerson({
    shirt: "#ff7a00",
    pants: "#26324a",
    skin: "#f1c27d",
    hair: "#3b2a1a",
    cap: "#ff7a00",
    logo: true,
  });
  // Fahrer so groß machen, dass der Kopf unter das Dach passt
  const hipY = ride + (sp.van ? 0.75 : 0.12);
  const roof = top + cabinH;
  const sc = Math.max(0.5, Math.min(0.9, (roof - 0.08 - hipY) / 1.2));
  const hipZ = cabinZ + (sp.van ? cabinLen * 0.25 : 0.05);
  const wheelY = hipY + 0.62 * sc;
  const wheelZ = hipZ + 0.62 * sc;
  const seat = new THREE.Group();
  seat.scale.setScalar(sc);
  seat.position.x = 0.38;
  seat.add(rider.root);
  poseRider(rider, [hipY / sc, hipZ / sc], [[(ride + 0.1) / sc, hipZ / sc + 0.85], [(ride + 0.1) / sc, hipZ / sc + 0.85]], [wheelY / sc, wheelZ / sc], -0.15);
  frame.add(seat);
  const SW = new Builder();
  SW.geo("rubber", GEO.torusWheel, 0.38, wheelY, wheelZ, "#222222", 0.5, 0, 0, 0.17, 0.17, 0.17);
  frame.add(SW.buildGroup());

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  return { root, lean, pitch, wheels, rider };
}

export function buildVehicleModel(def: VehicleDef): VehicleModel {
  if (def.kind === "car") return buildPlayerCar(def);
  const root = new THREE.Group();
  const lean = new THREE.Group();
  root.add(lean);
  const pitch = new THREE.Group();
  lean.add(pitch);
  const frame = new THREE.Group();
  pitch.add(frame);
  const scaled = new THREE.Group();
  scaled.scale.setScalar(def.size);
  frame.add(scaled);

  const wheelGroups: THREE.Group[] = [];
  const geo = def.kind === "moto" ? buildMoto(def, scaled, wheelGroups) : buildScooter(def, scaled, wheelGroups);
  const sz = def.size;

  pitch.position.set(0, geo.r * sz, geo.rearZ * sz);
  frame.position.set(0, -geo.r * sz, -geo.rearZ * sz);

  const rider = buildPerson({
    shirt: "#ff7a00",
    pants: "#26324a",
    skin: "#f1c27d",
    hair: "#3b2a1a",
    helmet: def.kind === "moto" ? (def.color === "#8e3b2c" ? "#e0e0e0" : def.color) : def.accent,
    helmetStripe: def.kind === "moto" ? def.accent : "#ffffff",
    backpack: def.kind === "scooter",
    logo: true,
    gloves: "#222222",
    shoes: "#1d1d1d",
  });
  const S = (p: [number, number]): [number, number] => [p[0] * sz, p[1] * sz];
  poseRider(rider, S(geo.hip), [S(geo.feet[0]), S(geo.feet[1])], S(geo.hands), geo.lean);
  frame.add(rider.root);

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  return { root, lean, pitch, wheels: wheelGroups.map((g) => ({ g, r: geo.r * sz })), rider };
}

// =====================================================================
//  Autos
// =====================================================================
/** Flacher, roter Sportwagen */
export function buildFerrari(color = "#d40000"): THREE.Group {
  const B = new Builder();
  const P = "paintGloss";
  // Karosserie: flach und breit
  B.box(P, 2.0, 0.5, 4.5, 0, 0.5, 0, color);
  B.box(P, 1.9, 0.18, 1.5, 0, 0.78, 1.45, color, 0.12); // Motorhaube (abfallend)
  B.box(P, 1.8, 0.2, 0.5, 0, 0.55, 2.15, color, 0.35); // Nase
  B.box(P, 1.95, 0.22, 1.3, 0, 0.85, -1.55, color, -0.06); // Heck
  B.box("glass", 1.5, 0.4, 1.7, 0, 1.02, -0.1, "#1b2530"); // Kabine
  B.box(P, 1.45, 0.06, 1.0, 0, 1.24, -0.2, color); // Dach
  B.box("glass", 1.45, 0.5, 0.05, 0, 1.0, 0.78, "#1b2530", -0.9); // Frontscheibe
  B.box("glass", 1.2, 0.35, 0.05, 0, 1.0, -1.0, "#1b2530", 0.9); // Heckscheibe
  for (const sx of [-1, 1]) {
    B.box("plain", 0.04, 0.3, 0.9, sx * 1.0, 0.6, -0.6, "#111111"); // Lufteinlass
    B.box(P, 0.12, 0.08, 0.2, sx * 0.85, 1.05, 0.6, color); // Spiegel
    B.box("plain", 0.04, 0.06, 3.6, sx * 1.005, 0.32, 0, "#111111"); // Schweller
    B.box("plain", 0.08, 0.14, 0.12, sx * 1.0, 0.82, 0.4, "#ffd400"); // gelbes Wappen
  }
  // Heckspoiler
  B.box(P, 1.8, 0.05, 0.35, 0, 1.22, -2.05, color);
  for (const sx of [-1, 1]) B.box("plain", 0.05, 0.25, 0.1, sx * 0.6, 1.08, -2.0, "#111111");
  // Lichter
  for (const sx of [-1, 1]) {
    B.box("glow", 0.45, 0.07, 0.05, sx * 0.62, 0.68, 2.27, "#f2f8ff", 0.2);
    for (const k of [0.45, 0.8]) B.geo("glow", GEO.cyl16, sx * k, 0.75, -2.27, "#ff1a1a", Math.PI / 2, 0, 0, 0.12, 0.04, 0.12);
  }
  B.box("plain", 1.4, 0.22, 0.05, 0, 0.42, 2.27, "#111111"); // Kühlergrill
  B.box("plain", 1.7, 0.2, 0.08, 0, 0.32, -2.25, "#151515"); // Diffusor
  for (const sx of [-1, 1]) B.geo("chrome", GEO.cyl16, sx * 0.3, 0.38, -2.3, "#cccccc", Math.PI / 2, 0, 0, 0.07, 0.08, 0.07);
  // Räder mit gelben Bremssätteln
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const z = sz * 1.45;
      B.geo("rubber", GEO.cyl16, sx * 0.9, 0.36, z, "#151515", 0, 0, Math.PI / 2, 0.36, 0.3, 0.36);
      B.geo("chrome", GEO.cyl16, sx * 0.91, 0.36, z, "#2b2b2b", 0, 0, Math.PI / 2, 0.25, 0.31, 0.25);
      B.box("plain", 0.05, 0.14, 0.2, sx * 0.86, 0.48, z + 0.08, "#ffd400");
    }
  }
  return B.buildGroup();
}

export function buildCar(color: string, type: "sedan" | "van" | "taxi"): THREE.Group {
  const B = new Builder();
  const P = "paintGloss";
  if (type === "van") {
    B.box(P, 1.95, 1.75, 3.5, 0, 1.2, -0.45, color);
    B.box(P, 1.95, 0.95, 1.2, 0, 0.82, 1.85, color);
    B.box("glass", 1.75, 0.7, 0.05, 0, 1.6, 1.43, "#22303c", -0.45);
    for (const sx of [-1, 1]) {
      B.box("glass", 0.02, 0.5, 0.8, sx * 0.98, 1.6, 0.9, "#22303c");
      B.box("plain", 0.02, 0.35, 2.8, sx * 0.98, 1.2, -0.6, "#ff7a00");
    }
    B.box("glass", 1.5, 0.5, 0.02, 0, 1.5, -2.21, "#22303c");
  } else {
    B.box(P, 1.8, 0.62, 4.3, 0, 0.64, 0, color);
    B.box(P, 1.72, 0.1, 1.15, 0, 0.98, 1.5, color, 0.06);
    B.box(P, 1.72, 0.1, 0.8, 0, 0.98, -1.7, color, -0.04);
    B.box("glass", 1.56, 0.48, 1.9, 0, 1.2, -0.15, "#22303c");
    B.box(P, 1.6, 0.07, 1.45, 0, 1.46, -0.2, color);
    for (const sx of [-1, 1]) {
      B.box(P, 0.07, 0.6, 0.08, sx * 0.77, 1.18, 0.8, color, -0.55);
      B.box(P, 0.07, 0.5, 0.1, sx * 0.79, 1.2, -0.1, color);
      B.box(P, 0.07, 0.6, 0.08, sx * 0.77, 1.18, -1.1, color, 0.55);
      B.box("plain", 0.02, 0.04, 3.4, sx * 0.905, 0.8, 0, "#1a1a1a");
      B.box("metal", 0.05, 0.03, 0.12, sx * 0.88, 0.94, 0.5, "#cccccc");
    }
    if (type === "taxi") {
      B.box("plain", 0.6, 0.2, 0.28, 0, 1.6, -0.2, "#ffffff");
      B.box("glow", 0.5, 0.12, 0.29, 0, 1.6, -0.2, "#fff59d");
      for (const sx of [-1, 1]) B.box("plain", 0.01, 0.12, 3.6, sx * 0.905, 0.62, 0, "#1a1a1a");
    }
  }
  const len = type === "van" ? 2.3 : 2.17;
  B.box("rubber", 1.86, 0.24, 0.16, 0, 0.42, len - 0.05, "#2a2a2a");
  B.box("rubber", 1.86, 0.24, 0.16, 0, 0.42, -len + 0.05, "#2a2a2a");
  B.box("plain", 0.8, 0.18, 0.02, 0, 0.66, len, "#141414");
  for (const sx of [-1, 1]) {
    B.box("glow", 0.36, 0.13, 0.03, sx * 0.62, 0.78, len, "#fffbe0");
    B.box("glow", 0.36, 0.12, 0.03, sx * 0.62, 0.8, -len, "#ff2222");
    B.box("metal", 0.07, 0.07, 0.16, sx * 0.97, 1.1, type === "van" ? 1.4 : 0.75, "#1a1a1a");
  }
  B.box("plain", 0.5, 0.12, 0.02, 0, 0.5, len + 0.09, "#f2f2f2");
  B.box("plain", 0.5, 0.12, 0.02, 0, 0.55, -len - 0.09, "#f2f2f2");
  const wz = type === "van" ? 1.45 : 1.35;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      B.geo("rubber", GEO.cyl16, sx * 0.83, 0.34, sz * wz, "#1a1a1a", 0, 0, Math.PI / 2, 0.34, 0.24, 0.34);
      B.geo("chrome", GEO.cyl16, sx * 0.84, 0.34, sz * wz, "#c8c8c8", 0, 0, Math.PI / 2, 0.2, 0.25, 0.2);
    }
  }
  return B.buildGroup();
}
