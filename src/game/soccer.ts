import * as THREE from "three";
import { buildPerson, type Person } from "./models";
import type { StadiumInfo } from "./buildings";

export type MatchState = "countdown" | "play" | "goal" | "end";
export interface RadarDot {
  x: number; // -1..1 (Länge)
  z: number; // -1..1 (Breite)
  team: 0 | 1;
  human: boolean;
}
export interface MatchHud {
  home: number;
  away: number;
  time: number;
  state: MatchState;
  countdown: number;
  lastGoal: 0 | 1 | null;
  result: "win" | "draw" | "lose" | null;
  hasBall: boolean;
  ego: boolean;
  radar: { dots: RadarDot[]; ball: { x: number; z: number } };
}
export interface MatchKeys {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

type Role = "gk" | "def" | "fwd";
interface SP {
  person: Person;
  team: 0 | 1;
  role: Role;
  human: boolean;
  x: number;
  z: number;
  vx: number;
  vz: number;
  heading: number;
  home: [number, number]; // Anteile von GX/GZ aus Sicht von Team 0 (Team 1 gespiegelt)
  maxSpeed: number;
  phase: number;
  kickCd: number;
  tackleCd: number;
  holdT: number;
  thinkT: number;
}

const R = 0.34;
const MATCH_TIME = 60;

export class SoccerMatch {
  players: SP[] = [];
  human: SP;
  ball = { x: 0, y: R, z: 0, vx: 0, vy: 0, vz: 0 };
  owner: SP | null = null;
  passTarget: SP | null = null;
  passT = 0;
  score: [number, number] = [0, 0];
  time = MATCH_TIME;
  state: MatchState = "countdown";
  stateT = 3;
  lastGoal: 0 | 1 | null = null;
  ego = true;
  private keeperChecked = false;
  private group = new THREE.Group();
  private marker: THREE.Mesh;
  private scene: THREE.Scene;
  private st: StadiumInfo;
  private ballMesh: THREE.Mesh;
  private cx: number;
  private cz: number;
  private GX: number;
  private GZ: number;
  private GH: number;

  constructor(scene: THREE.Scene, st: StadiumInfo, ballMesh: THREE.Mesh) {
    this.scene = scene;
    this.st = st;
    this.ballMesh = ballMesh;
    this.cx = st.cx;
    this.cz = st.cz;
    this.GX = st.goalX;
    this.GZ = st.pitchHalfZ;
    this.GH = st.goalHalf;

    const add = (team: 0 | 1, role: Role, human: boolean, hx: number, hz: number) => {
      const keeper = role === "gk";
      const person = buildPerson({
        shirt: keeper ? (team === 0 ? "#2e7d32" : "#6a1b9a") : team === 0 ? "#ff7a00" : "#1e88e5",
        pants: team === 0 ? "#26324a" : "#ffffff",
        skin: ["#f1c27d", "#e0ac69", "#c68642", "#8d5524", "#ffdbac"][Math.floor(Math.random() * 5)],
        hair: ["#2b1b0e", "#4a3020", "#d9b26a", "#111111"][Math.floor(Math.random() * 4)],
        shoes: team === 0 ? "#111111" : "#ffffff",
        logo: team === 0 && !keeper,
        gloves: keeper ? "#ffeb3b" : undefined,
      });
      this.group.add(person.root);
      const p: SP = {
        person,
        team,
        role,
        human,
        x: 0,
        z: 0,
        vx: 0,
        vz: 0,
        heading: 0,
        home: [hx, hz],
        maxSpeed: human ? 8.4 : keeper ? 6.5 : team === 0 ? 7.7 : 7.5,
        phase: Math.random() * 6,
        kickCd: 0,
        tackleCd: 0,
        holdT: 0,
        thinkT: 0,
      };
      this.players.push(p);
      return p;
    };
    // Aufstellung (x: Anteil von GX, negativ = eigene Hälfte; z: Anteil von GZ)
    this.human = add(0, "fwd", true, -0.12, -0.3);
    add(0, "fwd", false, -0.12, 0.35);
    add(0, "def", false, -0.55, -0.35);
    add(0, "def", false, -0.55, 0.35);
    add(0, "gk", false, -0.97, 0);
    add(1, "fwd", false, -0.12, 0.3);
    add(1, "fwd", false, -0.12, -0.35);
    add(1, "def", false, -0.55, 0.35);
    add(1, "def", false, -0.55, -0.35);
    add(1, "gk", false, -0.97, 0);

    this.marker = new THREE.Mesh(
      new THREE.TorusGeometry(0.75, 0.08, 8, 32),
      new THREE.MeshBasicMaterial({ color: "#ffeb3b", toneMapped: false }),
    );
    this.marker.rotation.x = Math.PI / 2;
    this.group.add(this.marker);
    scene.add(this.group);
    // Spielball etwas kleiner als der große Spaßball draußen
    this.ballMesh.scale.setScalar(R / 0.55);
    this.kickoff(0);
    this.setEgo(true);
  }

  dispose() {
    this.ballMesh.scale.setScalar(1);
    this.scene.remove(this.group);
    this.group.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
  }

  setEgo(on: boolean) {
    this.ego = on;
    // In der Ego-Sicht den eigenen Oberkörper ausblenden (man sieht nur die Beine)
    this.human.person.torso.visible = !on;
    this.marker.visible = !on;
  }

  private att(p: SP) {
    return p.team === 0 ? 1 : -1;
  }
  private homePos(p: SP): [number, number] {
    const a = this.att(p);
    return [this.cx + a * p.home[0] * this.GX, this.cz + a * p.home[1] * this.GZ];
  }

  hud(): MatchHud {
    let result: MatchHud["result"] = null;
    if (this.state === "end") result = this.score[0] > this.score[1] ? "win" : this.score[0] === this.score[1] ? "draw" : "lose";
    const nx = (x: number) => (x - this.cx) / this.st.halfX;
    const nz = (z: number) => (z - this.cz) / this.st.halfZ;
    return {
      home: this.score[0],
      away: this.score[1],
      time: Math.max(0, this.time),
      state: this.state,
      countdown: this.stateT,
      lastGoal: this.lastGoal,
      result,
      hasBall: this.owner === this.human,
      ego: this.ego,
      radar: {
        dots: this.players.map((p) => ({ x: nx(p.x), z: nz(p.z), team: p.team, human: p.human })),
        ball: { x: nx(this.ball.x), z: nz(this.ball.z) },
      },
    };
  }

  /** Kamera: Ego-Sicht oder Fernsehkamera. Rückgabe true = sofort setzen (nicht weich) */
  camera(pos: THREE.Vector3, look: THREE.Vector3): boolean {
    if (this.ego) {
      const h = this.human;
      const fx = Math.sin(h.heading);
      const fz = Math.cos(h.heading);
      pos.set(h.x + fx * 0.05, 1.75, h.z + fz * 0.05);
      look.set(h.x + fx * 10, 1.75 - 4.4, h.z + fz * 10);
      return true;
    }
    const lim = this.GX - 18;
    const tx = this.cx + Math.max(-lim, Math.min(lim, (this.ball.x - this.cx) * 0.85));
    pos.set(tx, 36, this.cz + 44);
    look.set(tx, 0, this.cz + 2);
    return false;
  }

  private kickoff(team: 0 | 1) {
    for (const p of this.players) {
      const [hx, hz] = this.homePos(p);
      p.x = hx;
      p.z = hz;
      p.vx = p.vz = 0;
      p.heading = p.team === 0 ? Math.PI / 2 : -Math.PI / 2;
      p.kickCd = 0;
      p.tackleCd = 0.6;
      p.thinkT = 0;
    }
    const striker = team === 0 ? this.human : this.players.find((p) => p.team === 1 && p.role === "fwd")!;
    striker.x = this.cx + (team === 0 ? -0.9 : 0.9);
    striker.z = this.cz;
    this.owner = striker;
    striker.holdT = 0;
    this.passTarget = null;
    Object.assign(this.ball, { x: this.cx, y: R, z: this.cz, vx: 0, vy: 0, vz: 0 });
  }

  private kick(p: SP, tx: number, tz: number, speed: number, lift: number, receiver: SP | null = null) {
    const dx = tx - p.x;
    const dz = tz - p.z;
    const d = Math.hypot(dx, dz) || 1;
    const b = this.ball;
    b.x = p.x + (dx / d) * 0.9;
    b.z = p.z + (dz / d) * 0.9;
    b.y = R + 0.05;
    b.vx = (dx / d) * speed;
    b.vz = (dz / d) * speed;
    b.vy = lift;
    this.owner = null;
    p.kickCd = 0.35;
    p.heading = Math.atan2(dx, dz);
    this.keeperChecked = false;
    this.passTarget = receiver;
    this.passT = receiver ? 3 : 0;
  }

  // ---------------- Spieler-Aktionen ----------------
  shoot() {
    if (this.state !== "play") return;
    const h = this.human;
    const loose = !this.owner && Math.hypot(this.ball.x - h.x, this.ball.z - h.z) < 1.7 && this.ball.y < 1.5;
    if (this.owner !== h && !loose) return;
    this.kick(h, h.x + Math.sin(h.heading) * 30, h.z + Math.cos(h.heading) * 30, 26, 3.2);
  }

  pass() {
    if (this.state !== "play" || this.owner !== this.human) return;
    const h = this.human;
    const fx = Math.sin(h.heading);
    const fz = Math.cos(h.heading);
    let best: SP | null = null;
    let bestScore = -Infinity;
    for (const m of this.players) {
      if (m.team !== 0 || m === h || m.role === "gk") continue;
      const dx = m.x - h.x;
      const dz = m.z - h.z;
      const d = Math.hypot(dx, dz) || 1;
      const facing = (dx * fx + dz * fz) / d; // -1..1
      const s = facing * 12 - d * 0.12 + Math.min(this.openness(m.x, m.z, 0), 8) * 0.6;
      if (s > bestScore) {
        bestScore = s;
        best = m;
      }
    }
    if (best) this.passTo(h, best);
  }

  private passTo(p: SP, m: SP) {
    const a = this.att(p);
    const tx = m.x + m.vx * 0.6 + a * 1.5;
    const tz = m.z + m.vz * 0.6;
    const d = Math.hypot(tx - p.x, tz - p.z);
    this.kick(p, tx, tz, Math.max(9, Math.min(20, d * 0.75 + 6)), d > 22 ? 4 : 1.2, m);
  }

  // ---------------- Hilfsfunktionen für die KI ----------------
  /** Abstand zum nächsten Gegner von team (größer = freier) */
  private openness(x: number, z: number, team: 0 | 1) {
    let best = Infinity;
    for (const o of this.players) if (o.team !== team) best = Math.min(best, Math.hypot(o.x - x, o.z - z));
    return best;
  }

  /** Ist der Weg von a nach b frei von Gegnern? */
  private laneClear(team: 0 | 1, ax: number, az: number, bx: number, bz: number, width: number) {
    const dx = bx - ax;
    const dz = bz - az;
    const L2 = dx * dx + dz * dz || 1;
    for (const o of this.players) {
      if (o.team === team) continue;
      const t = Math.max(0, Math.min(1, ((o.x - ax) * dx + (o.z - az) * dz) / L2));
      const px = ax + dx * t;
      const pz = az + dz * t;
      if (Math.hypot(o.x - px, o.z - pz) < width && t > 0.05) return false;
    }
    return true;
  }

  private nearestOpponent(p: SP) {
    let best: SP | null = null;
    let bd = Infinity;
    for (const o of this.players) {
      if (o.team === p.team) continue;
      const d = Math.hypot(o.x - p.x, o.z - p.z);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    return { o: best, d: bd };
  }

  /** Wer läuft zum Ball / presst? [Jäger, Absicherer] */
  private pressers(team: 0 | 1): [SP | null, SP | null] {
    const b = this.ball;
    if (!this.owner && this.passTarget && this.passTarget.team === team) {
      return [this.passTarget.human ? null : this.passTarget, null];
    }
    const list = this.players
      .filter((p) => p.team === team && p.role !== "gk" && !p.human)
      .sort((p, q) => Math.hypot(p.x - b.x, p.z - b.z) - Math.hypot(q.x - b.x, q.z - b.z));
    return [list[0] ?? null, list[1] ?? null];
  }

  private aiTarget(p: SP, press: [SP | null, SP | null][]): [number, number] {
    const { cx, cz, GX, GZ, GH } = this;
    const b = this.ball;
    const a = this.att(p);
    const goalX = cx + a * GX;
    const ownGoalX = cx - a * GX;
    const weHaveBall = (this.owner && this.owner.team === p.team) || (!this.owner && this.passTarget?.team === p.team);

    if (p.role === "gk") {
      if (this.owner === p) return [p.x, p.z];
      if (!this.owner && Math.hypot(b.x - ownGoalX, b.z - cz) < 11) return [b.x, b.z];
      const tz = Math.max(cz - GH + 0.4, Math.min(cz + GH - 0.4, cz + (b.z - cz) * 0.3));
      return [ownGoalX + a * 1.2, tz];
    }
    if (this.owner === p) {
      // Dribbeln Richtung Tor, Gegnern ausweichen
      let tz = cz + (p.z - cz) * 0.7;
      const { o, d } = this.nearestOpponent(p);
      if (o && d < 5 && (o.x - p.x) * a > -1) tz = p.z + (p.z > o.z ? 6 : -6);
      return [goalX, Math.max(cz - GZ + 2, Math.min(cz + GZ - 2, tz))];
    }
    // Mitspieler hat den Ball → Chaser-Logik nicht nötig
    if (!weHaveBall) {
      const [chaser, cover] = press[p.team];
      if (chaser === p) {
        if (this.owner) {
          return [this.owner.x + Math.sin(this.owner.heading) * 0.8, this.owner.z + Math.cos(this.owner.heading) * 0.8];
        }
        return [b.x + b.vx * 0.35, b.z + b.vz * 0.35];
      }
      if (cover === p && this.owner) {
        // Absichern: zwischen Ball und eigenem Tor
        const dx = ownGoalX - b.x;
        const dz = cz - b.z;
        const d = Math.hypot(dx, dz) || 1;
        return [b.x + (dx / d) * 7, b.z + (dz / d) * 7];
      }
    } else if (!this.owner && this.passTarget === p) {
      // Pass annehmen: zum Ball laufen
      return [b.x + b.vx * 0.25, b.z + b.vz * 0.25];
    }
    // Formation, die sich mit dem Ball verschiebt
    const [hx, hz] = this.homePos(p);
    const adv = b.x - cx;
    let tx: number;
    let tz: number;
    if (p.role === "fwd") {
      tx = hx + adv * 0.7 + (weHaveBall ? a * 12 : -a * 2);
      const spread = weHaveBall ? 1.35 : 1;
      tz = cz + (hz - cz) * spread + (b.z - cz) * 0.25;
      const maxAdv = GX - 7;
      if ((tx - cx) * a > maxAdv) tx = cx + a * maxAdv;
    } else {
      tx = hx + adv * 0.55 + (weHaveBall ? a * 7 : 0);
      tz = hz + (b.z - cz) * 0.4;
      if (!weHaveBall && (tx - b.x) * a > -5) tx = b.x - a * 5;
    }
    return [tx, Math.max(cz - GZ + 1, Math.min(cz + GZ - 1, tz))];
  }

  /** Entscheidung des Ballführenden: schießen, passen oder dribbeln */
  private aiAction(p: SP, dt: number) {
    const { cx, cz, GX, GH } = this;
    const a = this.att(p);
    const goalX = cx + a * GX;
    p.holdT += dt;
    p.thinkT -= dt;

    if (p.role === "gk") {
      if (p.holdT < 0.9) return;
      // kurzer Abstoß zum freiesten Mitspieler
      let best: SP | null = null;
      let bs = -Infinity;
      for (const m of this.players) {
        if (m.team !== p.team || m === p) continue;
        const s = Math.min(this.openness(m.x, m.z, p.team), 10) - Math.abs(m.x - p.x) * 0.05;
        if (s > bs) {
          bs = s;
          best = m;
        }
      }
      if (best) this.passTo(p, best);
      return;
    }
    if (p.thinkT > 0) return;
    p.thinkT = 0.22;

    const goalDist = Math.hypot(goalX - p.x, cz - p.z);
    const { d: pressure } = this.nearestOpponent(p);

    // 1) Schießen – in die Ecke, wo der Torwart nicht steht
    if (goalDist < 28 && p.holdT > 0.25) {
      const keeper = this.players.find((o) => o.team !== p.team && o.role === "gk")!;
      const side = keeper.z > cz ? -1 : 1;
      const aimZ = cz + side * GH * (0.55 + Math.random() * 0.35) + (Math.random() - 0.5) * 1.6;
      const clear = this.laneClear(p.team, p.x, p.z, goalX, aimZ, 0.8) || goalDist < 16;
      if (clear || Math.random() < 0.4) {
        this.kick(p, goalX, aimZ, 21 + Math.random() * 5, 1 + Math.random() * 2.5);
        return;
      }
    }

    // 2) Passen – zum freien Mitspieler, am liebsten nach vorne
    let best: SP | null = null;
    let bestScore = -Infinity;
    for (const m of this.players) {
      if (m.team !== p.team || m === p || m.role === "gk") continue;
      const tx = m.x + m.vx * 0.6 + a * 1.5;
      const tz = m.z + m.vz * 0.6;
      const d = Math.hypot(tx - p.x, tz - p.z);
      if (d < 5 || d > 38) continue;
      if (!this.laneClear(p.team, p.x, p.z, tx, tz, 1.8)) continue;
      const open = Math.min(this.openness(tx, tz, p.team), 9);
      const progress = (tx - p.x) * a;
      const s = progress * 0.7 + open * 1.4 - d * 0.08 + (m.human ? 3 : 0);
      if (s > bestScore) {
        bestScore = s;
        best = m;
      }
    }
    const dribbleScore = pressure > 6 ? 9 : pressure * 1.2;
    const wantPass = best && (bestScore > dribbleScore + 2 || (pressure < 2.6 && bestScore > 0));
    if (best && wantPass && p.holdT > 0.35) this.passTo(p, best);
  }

  update(dt: number, keys: MatchKeys) {
    const { cx, cz, GX, GH } = this;
    const b = this.ball;

    if (this.state === "countdown") {
      this.stateT -= dt;
      if (this.stateT <= 0) this.state = "play";
    } else if (this.state === "goal") {
      this.stateT -= dt;
      if (this.stateT <= 0) {
        this.kickoff(this.lastGoal === 0 ? 1 : 0);
        this.state = "countdown";
        this.stateT = 1.2;
      }
    } else if (this.state === "play") {
      this.time -= dt;
      if (this.time <= 0) {
        this.time = 0;
        this.state = "end";
      }
    }
    const active = this.state === "play";
    if (this.passT > 0) {
      this.passT -= dt;
      if (this.passT <= 0) this.passTarget = null;
    }

    // --- Bewegung ---
    const press = [this.pressers(0), this.pressers(1)];
    for (const p of this.players) {
      p.kickCd -= dt;
      p.tackleCd -= dt;
      let tvx = 0;
      let tvz = 0;
      if (p.human) {
        const sp = this.owner === p ? p.maxSpeed * 0.86 : p.maxSpeed;
        if (this.ego) {
          // Ego: A/D drehen (auch im Countdown), W vor, S zurück
          const turn = (keys.left ? 1 : 0) - (keys.right ? 1 : 0);
          if (this.state !== "end") p.heading += turn * 3.0 * dt;
          const f = (keys.up ? 1 : 0) - (keys.down ? 0.5 : 0);
          if (active) {
            tvx = Math.sin(p.heading) * sp * f;
            tvz = Math.cos(p.heading) * sp * f;
          }
        } else if (active) {
          // TV-Kamera steht im Norden (+z): D = +x (gegnerisches Tor), W = -z (weg von der Kamera)
          const mx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
          const mz = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
          const m = Math.hypot(mx, mz);
          if (m > 0) {
            tvx = (mx / m) * sp;
            tvz = (mz / m) * sp;
          }
        }
      } else if (active) {
        const [tx, tz] = this.aiTarget(p, press);
        const dx = tx - p.x;
        const dz = tz - p.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.5) {
          const spd = p.maxSpeed * Math.min(1, d / 3) * (this.owner === p ? 0.88 : 1);
          tvx = (dx / d) * spd;
          tvz = (dz / d) * spd;
        }
        if (this.owner === p) this.aiAction(p, dt);
      }
      const k = Math.min(1, 9 * dt);
      p.vx += (tvx - p.vx) * k;
      p.vz += (tvz - p.vz) * k;
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      const spd = Math.hypot(p.vx, p.vz);
      if (spd > 0.4 && !(p.human && this.ego)) {
        let diff = Math.atan2(p.vx, p.vz) - p.heading;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        p.heading += diff * Math.min(1, 14 * dt);
      }
      p.x = Math.max(cx - this.st.halfX + 0.6, Math.min(cx + this.st.halfX - 0.6, p.x));
      p.z = Math.max(cz - this.st.halfZ + 0.6, Math.min(cz + this.st.halfZ - 0.6, p.z));
      if (p.role === "gk") {
        const own = cx - this.att(p) * GX;
        p.x = p.team === 0 ? Math.max(own - 0.5, Math.min(own + 15, p.x)) : Math.min(own + 0.5, Math.max(own - 15, p.x));
        p.z = Math.max(cz - 16, Math.min(cz + 16, p.z));
      }
    }
    // Abstand halten
    for (let i = 0; i < this.players.length; i++) {
      for (let j = i + 1; j < this.players.length; j++) {
        const p = this.players[i];
        const q = this.players[j];
        const dx = q.x - p.x;
        const dz = q.z - p.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.8 && d > 1e-4) {
          const push = (0.8 - d) / 2;
          p.x -= (dx / d) * push;
          p.z -= (dz / d) * push;
          q.x += (dx / d) * push;
          q.z += (dz / d) * push;
        }
      }
    }

    // --- Zweikampf ---
    if (active && this.owner && this.owner.role !== "gk") {
      const own = this.owner;
      for (const p of this.players) {
        if (p.team === own.team || p.role === "gk" || p.tackleCd > 0) continue;
        if (Math.hypot(p.x - own.x, p.z - own.z) > 1.2) continue;
        p.tackleCd = 0.9;
        const chance = own.human ? 0.5 : p.human ? 0.5 : 0.35;
        if (Math.random() < chance) {
          if (Math.random() < 0.6) {
            this.owner = p;
            p.holdT = 0;
            p.thinkT = 0.3;
          } else {
            this.owner = null;
            const ang = Math.random() * Math.PI * 2;
            b.vx = Math.cos(ang) * 4;
            b.vz = Math.sin(ang) * 4;
            b.vy = 1;
          }
          this.passTarget = null;
          own.kickCd = 0.5;
          break;
        }
      }
    }

    // --- Ball ---
    if (this.owner) {
      const p = this.owner;
      const off = p.role === "gk" ? 0.4 : 0.8;
      b.x = p.x + Math.sin(p.heading) * off;
      b.z = p.z + Math.cos(p.heading) * off;
      b.y = p.role === "gk" ? 1.1 : R + 0.05;
      b.vx = p.vx;
      b.vz = p.vz;
      b.vy = 0;
    } else {
      b.vy -= 18 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.z += b.vz * dt;
      const ground = 0.1 + R;
      if (b.y < ground) {
        b.y = ground;
        b.vy = b.vy < -2 ? -b.vy * 0.5 : 0;
        b.vx *= 1 - 0.38 * dt;
        b.vz *= 1 - 0.38 * dt;
      }
      if (active) {
        const sorted = [...this.players].sort((p, q) => Math.hypot(p.x - b.x, p.z - b.z) - Math.hypot(q.x - b.x, q.z - b.z));
        for (const p of sorted) {
          if (p.kickCd > 0) continue;
          const d = Math.hypot(p.x - b.x, p.z - b.z);
          const reach = p.role === "gk" ? 1.5 : p.human ? 1.1 : 0.95;
          if (d > reach || b.y > (p.role === "gk" ? 2.6 : 1.2)) continue;
          const fast = Math.hypot(b.vx, b.vz) > 9;
          if (p.role === "gk" && fast) {
            if (this.keeperChecked) continue;
            this.keeperChecked = true;
            if (Math.random() > (p.team === 1 ? 0.5 : 0.65)) {
              b.vx *= 0.75;
              b.vz += (Math.random() - 0.5) * 6;
              continue;
            }
          }
          this.owner = p;
          p.holdT = 0;
          p.thinkT = 0.15;
          this.passTarget = null;
          break;
        }
      }
      if (this.state === "play" && Math.abs(b.x - cx) > GX + 0.3 && Math.abs(b.z - cz) < GH && b.y < 2.5) {
        const team: 0 | 1 = b.x > cx ? 0 : 1;
        this.score[team]++;
        this.lastGoal = team;
        this.state = "goal";
        this.stateT = 2.5;
      }
      if (Math.abs(b.z - cz) < GH + 0.3 && Math.abs(b.x - cx) > GX + 1.8) {
        b.x = cx + Math.sign(b.x - cx) * (GX + 1.8);
        b.vx = -b.vx * 0.2;
      }
      if (Math.abs(b.x - cx) > this.st.halfX) {
        b.x = cx + Math.sign(b.x - cx) * this.st.halfX;
        b.vx = -b.vx * 0.6;
      }
      if (Math.abs(b.z - cz) > this.st.halfZ) {
        b.z = cz + Math.sign(b.z - cz) * this.st.halfZ;
        b.vz = -b.vz * 0.6;
      }
    }
    this.ballMesh.position.set(b.x, b.y, b.z);
    this.ballMesh.rotation.x += (b.vz * dt) / R;
    this.ballMesh.rotation.z -= (b.vx * dt) / R;

    // --- Animation ---
    for (const p of this.players) {
      const pr = p.person;
      pr.root.position.set(p.x, 0.1, p.z);
      pr.root.rotation.y = p.heading;
      const spd = Math.hypot(p.vx, p.vz);
      p.phase += dt * (2 + spd * 1.5);
      const amp = Math.min(1, spd / 4) * 0.7;
      const sw = Math.sin(p.phase) * amp;
      pr.legs[0].rotation.x = sw;
      pr.legs[1].rotation.x = -sw;
      pr.knees[0].rotation.x = Math.max(0, -sw) * 0.9;
      pr.knees[1].rotation.x = Math.max(0, sw) * 0.9;
      pr.arms[0].rotation.x = -sw * 0.9;
      pr.arms[1].rotation.x = sw * 0.9;
      pr.elbows[0].rotation.x = -0.5;
      pr.elbows[1].rotation.x = -0.5;
      if (this.state === "goal" && this.lastGoal === p.team) {
        pr.root.position.y = 0.1 + Math.abs(Math.sin(p.phase * 2)) * 0.4;
        pr.arms[0].rotation.z = 2.6;
        pr.arms[1].rotation.z = -2.6;
      } else if (p.role === "gk") {
        pr.arms[0].rotation.z = 0.5;
        pr.arms[1].rotation.z = -0.5;
      } else {
        pr.arms[0].rotation.z = 0;
        pr.arms[1].rotation.z = 0;
      }
    }
    this.marker.position.set(this.human.x, 0.15, this.human.z);
  }
}
