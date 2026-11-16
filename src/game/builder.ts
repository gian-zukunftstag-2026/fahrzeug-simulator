import * as THREE from "three";
import { getMaterials } from "./materials";

const colorCache = new Map<string, THREE.Color>();
export function col(c: string) {
  let x = colorCache.get(c);
  if (!x) {
    x = new THREE.Color(c);
    colorCache.set(c, x);
  }
  return x;
}

/** Wachsender Vertex-Puffer */
class Buf {
  pos: Float32Array;
  nor: Float32Array;
  uv: Float32Array;
  col: Float32Array;
  n = 0;
  cap: number;
  constructor(cap = 2048) {
    this.cap = cap;
    this.pos = new Float32Array(cap * 3);
    this.nor = new Float32Array(cap * 3);
    this.uv = new Float32Array(cap * 2);
    this.col = new Float32Array(cap * 3);
  }
  ensure(k: number) {
    if (this.n + k <= this.cap) return;
    let cap = this.cap;
    while (this.n + k > cap) cap *= 2;
    const grow = (a: Float32Array, s: number) => {
      const b = new Float32Array(cap * s);
      b.set(a);
      return b;
    };
    this.pos = grow(this.pos, 3);
    this.nor = grow(this.nor, 3);
    this.uv = grow(this.uv, 2);
    this.col = grow(this.col, 3);
    this.cap = cap;
  }
  push(px: number, py: number, pz: number, nx: number, ny: number, nz: number, u: number, v: number, c: THREE.Color) {
    const i = this.n;
    this.pos[i * 3] = px;
    this.pos[i * 3 + 1] = py;
    this.pos[i * 3 + 2] = pz;
    this.nor[i * 3] = nx;
    this.nor[i * 3 + 1] = ny;
    this.nor[i * 3 + 2] = nz;
    this.uv[i * 2] = u;
    this.uv[i * 2 + 1] = v;
    this.col[i * 3] = c.r;
    this.col[i * 3 + 1] = c.g;
    this.col[i * 3 + 2] = c.b;
    this.n++;
  }
}

// Einheitswürfel ohne Unterseite (die sieht man nie) → 30 Vertices
const BOX: number[] = [];
{
  const g = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
  const p = g.attributes.position.array;
  const n = g.attributes.normal.array;
  for (let i = 0; i < p.length / 3; i++) {
    if (n[i * 3 + 1] < -0.5) continue;
    BOX.push(p[i * 3], p[i * 3 + 1], p[i * 3 + 2], n[i * 3], n[i * 3 + 1], n[i * 3 + 2]);
  }
  g.dispose();
}
const BOX_N = BOX.length / 6;

const _e = new THREE.Euler(0, 0, 0, "YXZ");
const _m = new THREE.Matrix4();
const _nm = new THREE.Matrix3();
const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const nonIndexedCache = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);

export class Builder {
  private bufs = new Map<string, Buf>();
  private inst = new Map<string, { m: THREE.Matrix4[]; c: THREE.Color[] }>();
  private texScale: Record<string, number>;

  constructor() {
    this.texScale = getMaterials().texScale;
  }

  private buf(key: string) {
    let b = this.bufs.get(key);
    if (!b) {
      b = new Buf();
      this.bufs.set(key, b);
    }
    return b;
  }

  /** Quader mit Mittelpunkt (x,y,z). Drehung in Reihenfolge Y, X, Z. Texturen laufen in Weltkoordinaten. */
  box(key: string, w: number, h: number, d: number, x: number, y: number, z: number, color: string, rx = 0, ry = 0, rz = 0) {
    const b = this.buf(key);
    const ts = this.texScale[key] ?? 1;
    const c = col(color);
    const rot = rx !== 0 || ry !== 0 || rz !== 0;
    if (rot) {
      _e.set(rx, ry, rz);
      _m.makeRotationFromEuler(_e);
    }
    b.ensure(BOX_N);
    for (let i = 0; i < BOX_N; i++) {
      const o = i * 6;
      let px = BOX[o] * w;
      let py = BOX[o + 1] * h;
      let pz = BOX[o + 2] * d;
      let nx = BOX[o + 3];
      let ny = BOX[o + 4];
      let nz = BOX[o + 5];
      let u: number;
      let v: number;
      if (nx !== 0) {
        u = pz + z;
        v = py + y;
      } else if (ny !== 0) {
        u = px + x;
        v = pz + z;
      } else {
        u = px + x;
        v = py + y;
      }
      if (rot) {
        _v.set(px, py, pz).applyMatrix4(_m);
        px = _v.x;
        py = _v.y;
        pz = _v.z;
        _n.set(nx, ny, nz).applyMatrix4(_m);
        nx = _n.x;
        ny = _n.y;
        nz = _n.z;
      }
      b.push(px + x, py + y, pz + z, nx, ny, nz, u / ts, v / ts, c);
    }
  }

  /** Beliebige Geometrie (Zylinder, Kugel, ...) einfügen */
  geo(
    key: string,
    geometry: THREE.BufferGeometry,
    x: number,
    y: number,
    z: number,
    color: string,
    rx = 0,
    ry = 0,
    rz = 0,
    sx = 1,
    sy = 1,
    sz = 1,
  ) {
    let src = nonIndexedCache.get(geometry);
    if (!src) {
      src = geometry.index ? geometry.toNonIndexed() : geometry;
      nonIndexedCache.set(geometry, src);
    }
    const b = this.buf(key);
    const ts = this.texScale[key] ?? 1;
    const c = col(color);
    _e.set(rx, ry, rz);
    _q.setFromEuler(_e);
    _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
    _nm.getNormalMatrix(_m);
    const P = src.attributes.position.array;
    const N = src.attributes.normal.array;
    const U = src.attributes.uv?.array;
    const count = src.attributes.position.count;
    b.ensure(count);
    for (let i = 0; i < count; i++) {
      _v.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]).applyMatrix4(_m);
      _n.set(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]).applyMatrix3(_nm).normalize();
      const u = U ? U[i * 2] / ts : 0;
      const v = U ? U[i * 2 + 1] / ts : 0;
      b.push(_v.x, _v.y, _v.z, _n.x, _n.y, _n.z, u, v, c);
    }
  }

  /** Quader als Instanz (für sehr viele gleiche Teile wie Fenster, Streifen) */
  ibox(key: string, w: number, h: number, d: number, x: number, y: number, z: number, color: string, ry = 0) {
    let it = this.inst.get(key);
    if (!it) {
      it = { m: [], c: [] };
      this.inst.set(key, it);
    }
    _e.set(0, ry, 0);
    _q.setFromEuler(_e);
    it.m.push(new THREE.Matrix4().compose(_p.set(x, y, z), _q, _s.set(w, h, d)));
    it.c.push(col(color));
  }

  build(opts: { shadows?: boolean; noShadow?: string[] } = {}): THREE.Object3D[] {
    const { mats } = getMaterials();
    const out: THREE.Object3D[] = [];
    const shadows = opts.shadows ?? true;
    for (const [key, b] of this.bufs) {
      if (b.n === 0) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(b.pos.slice(0, b.n * 3), 3));
      g.setAttribute("normal", new THREE.BufferAttribute(b.nor.slice(0, b.n * 3), 3));
      g.setAttribute("uv", new THREE.BufferAttribute(b.uv.slice(0, b.n * 2), 2));
      g.setAttribute("color", new THREE.BufferAttribute(b.col.slice(0, b.n * 3), 3));
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, mats[key] ?? mats.plain);
      const sh = shadows && !(opts.noShadow ?? []).includes(key) && key !== "glow";
      mesh.castShadow = sh;
      mesh.receiveShadow = shadows;
      out.push(mesh);
    }
    for (const [key, it] of this.inst) {
      const mesh = new THREE.InstancedMesh(UNIT_BOX, mats[key] ?? mats.i_plain, it.m.length);
      it.m.forEach((m, i) => {
        mesh.setMatrixAt(i, m);
        mesh.setColorAt(i, it.c[i]);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
      mesh.castShadow = shadows && key !== "i_paint";
      mesh.receiveShadow = shadows;
      out.push(mesh);
    }
    this.bufs.clear();
    this.inst.clear();
    return out;
  }

  buildGroup(opts?: { shadows?: boolean; noShadow?: string[] }) {
    const g = new THREE.Group();
    for (const o of this.build(opts)) g.add(o);
    return g;
  }
}

// Gemeinsame Grundformen
export const GEO = {
  cyl8: new THREE.CylinderGeometry(1, 1, 1, 8),
  cyl16: new THREE.CylinderGeometry(1, 1, 1, 16),
  cyl24: new THREE.CylinderGeometry(1, 1, 1, 24),
  ico0: new THREE.IcosahedronGeometry(1, 0),
  ico1: new THREE.IcosahedronGeometry(1, 1),
  sphere: new THREE.SphereGeometry(1, 16, 12),
  cone8: new THREE.ConeGeometry(1, 1, 8),
  torusWheel: new THREE.TorusGeometry(1, 0.28, 10, 24),
};
