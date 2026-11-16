import * as THREE from "three";
import { buildCar, buildFerrari, buildPerson, type Person } from "./models";
import { CELL, HALF, N, ROAD, inClosed, rng, type Box } from "./world";

const LANE = 4.6;
const TURN_IN = ROAD / 2; // Abstand vom Kreuzungsmittelpunkt, wo die Kurve beginnt
const DIRS: [number, number][] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];
const CAR_COLORS = ["#e53935", "#1e88e5", "#fdd835", "#43a047", "#f5f5f5", "#212121", "#8e24aa", "#fb8c00", "#90a4ae", "#6d4c41", "#00acc1"];

export interface Car {
  mesh: THREE.Group;
  fast: boolean; // Ferrari
  lane: number;
  overtake: number;
  i: number; // Zielknoten
  j: number;
  dir: number;
  mode: "straight" | "turn";
  // Gerade
  p0: THREE.Vector2;
  p1: THREE.Vector2;
  // Kurve (Bezier)
  c: THREE.Vector2;
  t: number;
  len: number;
  speed: number;
  maxSpeed: number;
  nextDir: number;
  wait: number;
  ignore: number;
  x: number;
  z: number;
  px: number;
  pz: number;
  heading: number;
}

const nodePos = (k: number) => -HALF + k * CELL;
/** Straßenstück führt durch den Jump-Park? */
const edgeBlocked = (i: number, j: number, ni: number, nj: number) =>
  inClosed((nodePos(i) + nodePos(ni)) / 2, (nodePos(j) + nodePos(nj)) / 2);
const right = (d: number): [number, number] => {
  const [fx, fz] = DIRS[d];
  return [-fz, fx];
};

export class Traffic {
  cars: Car[] = [];
  peds: Ped[] = [];
  group = new THREE.Group();
  private r = rng(77);

  constructor(count: number, blockRects: Box[], pedCount: number, ferraris = 0) {
    for (let k = 0; k < count + ferraris; k++) {
      const fast = k >= count;
      const type = k % 7 === 0 ? "van" : k % 9 === 0 ? "taxi" : "sedan";
      const color = type === "taxi" ? "#ffd400" : type === "van" ? "#f5f5f5" : CAR_COLORS[Math.floor(this.r() * CAR_COLORS.length)];
      const mesh = fast ? buildFerrari(k % 3 === 0 ? "#ffcc00" : "#d40000") : buildCar(color, type);
      this.group.add(mesh);
      // Startposition: zufällige Straße
      let i = 1 + Math.floor(this.r() * (N - 1));
      let j = 1 + Math.floor(this.r() * (N - 1));
      const dir = Math.floor(this.r() * 4);
      const car: Car = {
        mesh,
        fast,
        lane: LANE,
        overtake: 0,
        i,
        j,
        dir,
        mode: "straight",
        p0: new THREE.Vector2(),
        p1: new THREE.Vector2(),
        c: new THREE.Vector2(),
        t: this.r() * 0.8,
        len: 1,
        speed: 0,
        maxSpeed: fast ? 36 + this.r() * 8 : 9 + this.r() * 4,
        nextDir: dir,
        wait: 0,
        ignore: 0,
        x: 0,
        z: 0,
        px: 0,
        pz: 0,
        heading: 0,
      };
      // Vom Knoten (i,j) in Richtung dir losfahren (nicht durch den Jump-Park)
      const [fx, fz] = DIRS[dir];
      if (i + fx < 0 || i + fx > N) i -= 2 * fx;
      if (j + fz < 0 || j + fz > N) j -= 2 * fz;
      for (let tries = 0; tries < 50 && edgeBlocked(i, j, i + fx, j + fz); tries++) {
        i = 1 + Math.floor(this.r() * (N - 2));
        j = 1 + Math.floor(this.r() * (N - 2));
      }
      this.setupStraight(car, i, j, dir);
      const start = this.pos(car, new THREE.Vector2());
      car.x = car.px = start.x;
      car.z = car.pz = start.y;
      car.heading = Math.atan2(DIRS[dir][0], DIRS[dir][1]);
      this.cars.push(car);
    }
    for (let k = 0; k < pedCount; k++) {
      const b = blockRects[Math.floor(this.r() * blockRects.length)];
      const ped = new Ped(b, this.r);
      this.peds.push(ped);
      this.group.add(ped.person.root);
    }
  }

  private setupStraight(car: Car, fromI: number, fromJ: number, dir: number) {
    const [fx, fz] = DIRS[dir];
    const [rx, rz] = right(dir);
    const ax = nodePos(fromI);
    const az = nodePos(fromJ);
    car.i = fromI + fx;
    car.j = fromJ + fz;
    const bx = nodePos(car.i);
    const bz = nodePos(car.j);
    car.dir = dir;
    car.mode = "straight";
    car.p0.set(ax + fx * TURN_IN + rx * LANE, az + fz * TURN_IN + rz * LANE);
    car.p1.set(bx - fx * TURN_IN + rx * LANE, bz - fz * TURN_IN + rz * LANE);
    car.len = car.p0.distanceTo(car.p1);
    car.nextDir = this.chooseNext(car);
  }

  private chooseNext(car: Car) {
    const options: number[] = [];
    for (const nd of [car.dir, (car.dir + 1) % 4, (car.dir + 3) % 4]) {
      const [fx, fz] = DIRS[nd];
      const ni = car.i + fx;
      const nj = car.j + fz;
      if (ni >= 0 && ni <= N && nj >= 0 && nj <= N && !edgeBlocked(car.i, car.j, ni, nj)) options.push(nd);
    }
    if (options.length === 0) return (car.dir + 2) % 4;
    // Geradeaus etwas wahrscheinlicher
    if (options.includes(car.dir) && this.r() < 0.5) return car.dir;
    return options[Math.floor(this.r() * options.length)];
  }

  private setupTurn(car: Car) {
    const nd = car.nextDir;
    const bx = nodePos(car.i);
    const bz = nodePos(car.j);
    const [fx, fz] = DIRS[nd];
    const [rox, roz] = right(car.dir);
    const [rnx, rnz] = right(nd);
    car.p0.copy(car.p1);
    car.p1.set(bx + fx * TURN_IN + rnx * LANE, bz + fz * TURN_IN + rnz * LANE);
    if (nd === car.dir) car.c.copy(car.p0).add(car.p1).multiplyScalar(0.5);
    else if (nd === (car.dir + 2) % 4) car.c.set(bx, bz);
    else car.c.set(bx + (rox + rnx) * LANE, bz + (roz + rnz) * LANE);
    car.len = car.p0.distanceTo(car.c) + car.c.distanceTo(car.p1);
    car.mode = "turn";
  }

  private pos(car: Car, out: THREE.Vector2) {
    const t = car.t;
    if (car.mode === "straight") return out.copy(car.p0).lerp(car.p1, t);
    const a = (1 - t) * (1 - t);
    const b = 2 * (1 - t) * t;
    const c = t * t;
    return out.set(a * car.p0.x + b * car.c.x + c * car.p1.x, a * car.p0.y + b * car.c.y + c * car.p1.y);
  }

  update(dt: number, px: number, pz: number) {
    const tmp = new THREE.Vector2();
    for (const car of this.cars) {
      // Hindernis voraus?
      const hx = Math.sin(car.heading);
      const hz = Math.cos(car.heading);
      let blocked = false;
      const check = (ox: number, oz: number, range: number, lat: number) => {
        const dx = ox - car.x;
        const dz = oz - car.z;
        const ahead = dx * hx + dz * hz;
        const side = Math.abs(dx * hz - dz * hx);
        return ahead > 0 && ahead < range && side < lat ? ahead : -1;
      };
      const range = car.fast ? 8 + car.speed * 0.9 : 8;
      if (check(px, pz, car.fast ? range : 9, 2.2) >= 0) blocked = true;
      if (!blocked && car.ignore <= 0) {
        for (const o of this.cars) {
          if (o === car) continue;
          const ahead = check(o.x, o.z, range, 1.6);
          if (ahead < 0) continue;
          // Ferrari überholt auf der inneren Spur
          if (car.fast && ahead > 7 && car.mode === "straight" && car.t < 0.75 && !o.fast) {
            car.overtake = 2.5;
            continue;
          }
          blocked = true;
          break;
        }
      }
      car.overtake -= dt;
      const laneTarget = car.overtake > 0 ? 1.8 : LANE;
      car.lane += Math.sign(laneTarget - car.lane) * Math.min(Math.abs(laneTarget - car.lane), 4 * dt);
      if (blocked) car.wait += dt;
      else car.wait = 0;
      if (car.wait > 3) {
        car.ignore = 1.5;
        car.wait = 0;
      }
      car.ignore -= dt;

      const turning = car.nextDir !== car.dir;
      const turnSpeed = car.fast ? 11 : car.maxSpeed * 0.55;
      let target = car.maxSpeed;
      if (turning && car.mode === "turn") target = turnSpeed;
      if (turning && car.mode === "straight") {
        // rechtzeitig vor der Kurve bremsen
        const remaining = (1 - car.t) * car.len;
        const brakeDist = (car.speed * car.speed - turnSpeed * turnSpeed) / (2 * (car.fast ? 18 : 6)) + 2;
        if (remaining < brakeDist) target = turnSpeed;
      }
      if (blocked) target = 0;
      const decel = car.fast ? 25 : 14;
      const accel = car.fast ? 12 : 4;
      const rate = target < car.speed ? (blocked ? decel : car.fast ? 18 : 6) : accel;
      car.speed += Math.sign(target - car.speed) * Math.min(Math.abs(target - car.speed), rate * dt);

      car.t += (car.speed * dt) / car.len;
      if (car.t >= 1) {
        car.t -= 1;
        if (car.mode === "straight") this.setupTurn(car);
        else {
          const [fx, fz] = DIRS[car.nextDir];
          this.setupStraight(car, car.i, car.j, car.nextDir);
          void fx;
          void fz;
        }
        car.t = Math.min(car.t, 0.99);
      }
      this.pos(car, tmp);
      const pdx = tmp.x - car.px;
      const pdz = tmp.y - car.pz;
      car.px = tmp.x;
      car.pz = tmp.y;
      const dx = pdx;
      const dz = pdz;
      if (dx * dx + dz * dz > 1e-6) {
        const h = Math.atan2(dx, dz);
        let diff = h - car.heading;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        car.heading += diff * Math.min(1, 12 * dt);
      }
      // Spurversatz (zum Überholen)
      const off = car.lane - LANE;
      car.x = tmp.x - Math.cos(car.heading) * off;
      car.z = tmp.y + Math.sin(car.heading) * off;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
    }
    for (const p of this.peds) p.update(dt);
  }
}

// =====================================================================
//  Fußgänger
// =====================================================================
const SHIRTS = ["#e53935", "#1e88e5", "#43a047", "#fdd835", "#8e24aa", "#00acc1", "#f06292", "#ffffff", "#ff7043", "#5c6bc0"];
const PANTS = ["#1e3a5f", "#333333", "#5d4037", "#455a64", "#283593", "#6d6d6d"];
const SKINS = ["#f1c27d", "#e0ac69", "#c68642", "#8d5524", "#ffdbac"];
const HAIRS = ["#2b1b0e", "#4a3020", "#d9b26a", "#111111", "#a0522d", "#888888"];

export function randomPerson(r: () => number, extra: Partial<Parameters<typeof buildPerson>[0]> = {}): Person {
  const p = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  return buildPerson({
    shirt: p(SHIRTS),
    pants: p(PANTS),
    skin: p(SKINS),
    hair: p(HAIRS),
    shoes: p(["#222222", "#ffffff", "#8d6e63", "#c62828"]),
    cap: r() < 0.2 ? p(SHIRTS) : undefined,
    ...extra,
  });
}

class Ped {
  person: Person;
  private rect: Box;
  private s: number;
  private speed: number;
  private dir: number;
  private phase: number;
  private perim: number;

  constructor(block: Box, r: () => number) {
    this.person = randomPerson(r);
    const inset = 1.8;
    this.rect = { minX: block.minX + inset, maxX: block.maxX - inset, minZ: block.minZ + inset, maxZ: block.maxZ - inset };
    const w = this.rect.maxX - this.rect.minX;
    const d = this.rect.maxZ - this.rect.minZ;
    this.perim = 2 * (w + d);
    this.s = r() * this.perim;
    this.speed = 1.1 + r() * 0.5;
    this.dir = r() < 0.5 ? 1 : -1;
    this.phase = r() * 10;
    this.person.root.scale.setScalar(0.92 + r() * 0.12);
  }

  update(dt: number) {
    this.s = (this.s + this.dir * this.speed * dt + this.perim) % this.perim;
    const { minX, maxX, minZ, maxZ } = this.rect;
    const w = maxX - minX;
    const d = maxZ - minZ;
    let s = this.s;
    let x: number;
    let z: number;
    let h: number;
    if (s < w) {
      x = minX + s;
      z = minZ;
      h = Math.PI / 2;
    } else if ((s -= w) < d) {
      x = maxX;
      z = minZ + s;
      h = 0;
    } else if ((s -= d) < w) {
      x = maxX - s;
      z = maxZ;
      h = -Math.PI / 2;
    } else {
      s -= w;
      x = minX;
      z = maxZ - s;
      h = Math.PI;
    }
    if (this.dir < 0) h += Math.PI;
    const p = this.person;
    p.root.position.set(x, 0.3, z);
    p.root.rotation.y = h;
    this.phase += dt * this.speed * 4.2;
    const sw = Math.sin(this.phase) * 0.55;
    p.legs[0].rotation.x = sw;
    p.legs[1].rotation.x = -sw;
    p.knees[0].rotation.x = Math.max(0, -sw) * 0.8;
    p.knees[1].rotation.x = Math.max(0, sw) * 0.8;
    p.arms[0].rotation.x = -sw * 0.8;
    p.arms[1].rotation.x = sw * 0.8;
    p.elbows[0].rotation.x = -0.3;
    p.elbows[1].rotation.x = -0.3;
  }
}
