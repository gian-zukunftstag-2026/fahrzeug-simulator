import * as THREE from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import { buildWorld, CELL, HALF, LIMIT, PARK_RECT, ROAD, N, STADIUM_RECT, type House, type Restaurant, type World } from "./world";
import { inRect, jumpHeight, LOOP_G, type Loop } from "./jumppark";
import { getVehicle, VEHICLES, type VehicleDef } from "./vehicles";
import { buildVehicleModel, type Person, type VehicleModel } from "./models";
import { Traffic, randomPerson } from "./traffic";
import { SoccerMatch, type MatchHud } from "./soccer";

export interface OrderInfo {
  stage: "pickup" | "deliver";
  restaurant: string;
  emoji: string;
  color: string;
  timeLeft: number;
  timeLimit: number;
  pay: number;
  distance: number;
  /** Winkel zum Ziel relativ zur Fahrtrichtung (Radiant, + = links) */
  angle: number;
}

export interface JobOffer {
  id: number;
  restaurant: string;
  emoji: string;
  color: string;
  pay: number;
  route: number;
  toRestaurant: number;
  timeLimit: number;
}

export interface HudState {
  money: number;
  speedKmh: number;
  vehicleId: string;
  owned: string[];
  delivered: number;
  order: OrderInfo | null;
  offers: JobOffer[];
  combo: number;
  inGarage: boolean;
  atAtm: boolean;
  match: MatchHud | null;
  wheelie: number;
  wheelieMode: boolean;
  air: boolean;
  pitch: number;
  stunned: boolean;
}

export interface SaveData {
  money: number;
  owned: string[];
  vehicle: string;
  delivered: number;
}

type MessageKind = "info" | "money" | "bad";
interface Callbacks {
  onHud: (s: HudState) => void;
  onMessage: (text: string, kind: MessageKind) => void;
}

interface Job {
  id: number;
  rest: Restaurant;
  cust: House;
  pay: number;
  route: number;
  timeLimit: number;
}
interface Order extends Job {
  stage: "pickup" | "deliver";
  timeLeft: number;
}

interface Beacon {
  group: THREE.Group;
  beamMat: THREE.MeshBasicMaterial;
  ringMat: THREE.MeshBasicMaterial;
  sprite: THREE.Sprite;
  arrow: THREE.Mesh;
}

const SAVE_KEY = "lieferblitz-save-v2";
const CRASH_PITCH = 1.22;
const GRAVITY = 22;
const MAX_OFFERS = 4;

function loadSave(): SaveData {
  const fallback: SaveData = { money: 0, owned: ["ke100"], vehicle: "ke100", delivered: 0 };
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return fallback;
    const s = JSON.parse(raw) as Partial<SaveData>;
    const owned = Array.isArray(s.owned) ? s.owned.filter((id) => VEHICLES.some((v) => v.id === id)) : [];
    if (!owned.includes("ke100")) owned.unshift("ke100");
    return {
      money: typeof s.money === "number" ? s.money : 0,
      owned,
      vehicle: typeof s.vehicle === "string" && owned.includes(s.vehicle) ? s.vehicle : "ke100",
      delivered: typeof s.delivered === "number" ? s.delivered : 0,
    };
  } catch {
    return fallback;
  }
}

const emojiTexCache = new Map<string, THREE.Texture>();
function emojiTexture(emoji: string) {
  let t = emojiTexCache.get(emoji);
  if (!t) {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.beginPath();
    ctx.arc(128, 128, 118, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 10;
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.stroke();
    ctx.font = '150px "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(emoji, 128, 140);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    emojiTexCache.set(emoji, t);
  }
  return t;
}

function makeBeacon(color: string, emoji: string, height = 40): Beacon {
  const group = new THREE.Group();
  const beamMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, height, 24, 1, true), beamMat);
  beam.position.y = height / 2;
  group.add(beam);
  const ringMat = new THREE.MeshBasicMaterial({ color, toneMapped: false });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.2, 8, 40), ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.35;
  group.add(ring);
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.2, 4), ringMat);
  arrow.rotation.x = Math.PI;
  arrow.position.y = 3.2;
  group.add(arrow);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTexture(emoji), depthWrite: false }));
  sprite.scale.set(3, 3, 1);
  sprite.position.y = 5.5;
  group.add(sprite);
  return { group, beamMat, ringMat, sprite, arrow };
}

export class GameEngine {
  private container: HTMLElement;
  private minimap: HTMLCanvasElement;
  private cb: Callbacks;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private sun: THREE.DirectionalLight;
  private sunDir = new THREE.Vector3();
  private world: World;
  private traffic: Traffic;
  private model!: VehicleModel;
  private def!: VehicleDef;
  private displayModels: THREE.Group[] = [];
  private keys = new Set<string>();
  private raf = 0;
  private last = 0;
  private hudTimer = 0;
  private time = 0;
  private paused = true;
  private showroom = false;
  private showroomAngle = 0;

  // Spieler-Zustand
  private x = 0;
  private z = 0;
  private y = 0;
  private heading = 0;
  private speed = 0;
  private steer = 0;
  private pitch = 0;
  private pitchVel = 0;
  private lean = 0;
  private stun = 0;
  private wheelieTime = 0;
  private wheelieMode = false;
  private wheelieLifted = false;
  private air = false;
  private vy = 0;
  private groundVy = 0;
  private airTime = 0;
  private flip = 0;
  private slopePitch = 0;
  private loopRun: { L: Loop; theta: number } | null = null;
  private ball = { x: 0, y: 0.6, z: 0, vx: 0, vy: 0, vz: 0 };
  private ballMesh!: THREE.Mesh;
  private goalTimer = 0;
  private match: SoccerMatch | null = null;
  private matchRewarded = false;
  private mustLeaveStadium = false;
  private bumpCooldown = 0;

  private save: SaveData;
  private order: Order | null = null;
  private offers: Job[] = [];
  private offerTimer = 0;
  private nextJobId = 1;
  private combo = 0;
  private orderBeacon: Beacon;
  private garageBeacon: Beacon;
  private atmBeacon: Beacon;
  private customer: Person | null = null;
  private customerHappy = 0;
  private mmBg: HTMLCanvasElement;
  private mmCtx: CanvasRenderingContext2D;

  private camTarget = new THREE.Vector3();
  private camDesired = new THREE.Vector3();

  constructor(container: HTMLElement, minimap: HTMLCanvasElement, cb: Callbacks) {
    this.container = container;
    this.minimap = minimap;
    this.cb = cb;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.72;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(62, container.clientWidth / container.clientHeight, 0.1, 3000);

    // Himmel + Umgebungslicht aus dem Himmel
    this.sunDir.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - 40), THREE.MathUtils.degToRad(140));
    const makeSky = (scale: number) => {
      const sky = new Sky();
      sky.scale.setScalar(scale);
      const u = sky.material.uniforms;
      u.turbidity.value = 3.5;
      u.rayleigh.value = 1.4;
      u.mieCoefficient.value = 0.004;
      u.mieDirectionalG.value = 0.8;
      u.sunPosition.value.copy(this.sunDir);
      return sky;
    };
    this.scene.add(makeSky(2500));
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envScene = new THREE.Scene();
    envScene.add(makeSky(50));
    const ground = new THREE.Mesh(new THREE.CircleGeometry(40, 16), new THREE.MeshBasicMaterial({ color: "#5c7f4a" }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2;
    envScene.add(ground);
    this.scene.environment = pmrem.fromScene(envScene, 0.02).texture;
    this.scene.environmentIntensity = 0.5;
    pmrem.dispose();
    this.scene.fog = new THREE.Fog("#cfe2ef", 200, 820);

    this.scene.add(new THREE.HemisphereLight("#dff1ff", "#6f8f5f", 0.45));
    this.sun = new THREE.DirectionalLight("#fff1d6", 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    const sc = this.sun.shadow.camera;
    sc.left = -75;
    sc.right = 75;
    sc.top = 75;
    sc.bottom = -75;
    sc.near = 1;
    sc.far = 320;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;
    this.sun.shadow.radius = 2;
    this.scene.add(this.sun, this.sun.target);

    this.world = buildWorld();
    this.scene.add(this.world.group);
    this.traffic = new Traffic(26, this.world.blockRects, 45, 8);
    this.scene.add(this.traffic.group);
    for (const d of this.world.displays) {
      const m = buildVehicleModel(getVehicle(d.id));
      m.rider.root.visible = false;
      m.root.position.set(d.x, 0.72, d.z);
      m.root.rotation.y = d.heading;
      this.scene.add(m.root);
      this.displayModels.push(m.root);
    }

    this.ballMesh = this.makeBall();
    this.scene.add(this.ballMesh);
    this.resetBall();

    this.save = loadSave();
    this.setVehicle(this.save.vehicle);
    this.x = this.world.spawn.x;
    this.z = this.world.spawn.z;
    this.heading = this.world.spawn.heading;

    this.orderBeacon = makeBeacon("#ff9800", "🍕");
    this.orderBeacon.group.visible = false;
    this.scene.add(this.orderBeacon.group);
    this.garageBeacon = makeBeacon("#2979ff", "🏍️", 14);
    this.garageBeacon.group.position.set(this.world.garage.x, 0, this.world.garage.z);
    this.scene.add(this.garageBeacon.group);
    this.atmBeacon = makeBeacon("#ffd600", "💶", 12);
    this.atmBeacon.group.position.set(this.world.atm.x, 0, this.world.atm.z);
    this.atmBeacon.group.scale.setScalar(0.7);
    this.scene.add(this.atmBeacon.group);

    for (let i = 0; i < MAX_OFFERS; i++) this.offers.push(this.makeJob());

    this.mmCtx = minimap.getContext("2d")!;
    this.mmBg = this.buildMinimapBg();

    this.camera.position.set(this.x, 8, this.z - 14);

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    window.addEventListener("resize", this.onResize);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  // ---------- Öffentliche Methoden (für das HUD) ----------
  setPaused(p: boolean) {
    this.paused = p;
    if (p) this.keys.clear();
  }

  setShowroom(on: boolean) {
    this.showroom = on;
    this.showroomAngle = this.heading + Math.PI * 0.6;
    if (on) {
      this.camera.position.set(this.x + Math.sin(this.showroomAngle) * 4.2, this.y + 1.6, this.z + Math.cos(this.showroomAngle) * 4.2);
    } else {
      this.preview(this.save.vehicle);
    }
    this.updateViewOffset();
  }

  /** Im Shop das Fahrzeug nach links schieben (rechts ist die Liste) */
  private updateViewOffset() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (this.showroom && w > 700) this.camera.setViewOffset(w, h, Math.min(430, w) / 2, 0, w, h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  preview(id: string) {
    if (this.def.id !== id) this.setVehicle(id);
  }

  buy(id: string) {
    const v = getVehicle(id);
    if (this.save.owned.includes(id)) return this.select(id);
    if (this.save.money < v.price) {
      this.cb.onMessage("Nicht genug Geld! 💸", "bad");
      return;
    }
    this.save.money -= v.price;
    this.save.owned.push(id);
    this.cb.onMessage(`${v.name} gekauft! 🎉`, "money");
    this.select(id);
  }

  select(id: string) {
    if (!this.save.owned.includes(id)) return;
    this.save.vehicle = id;
    this.setVehicle(id);
    this.persist();
    this.pushHud();
  }

  acceptJob(id: number) {
    if (this.order) {
      this.cb.onMessage("Du hast schon einen Auftrag! Erst liefern oder abbrechen.", "bad");
      return;
    }
    const idx = this.offers.findIndex((o) => o.id === id);
    if (idx < 0) return;
    const job = this.offers[idx];
    this.offers.splice(idx, 1);
    this.offers.push(this.makeJob());
    this.order = { ...job, stage: "pickup", timeLeft: job.timeLimit };
    this.orderBeacon.sprite.material.map = emojiTexture(job.rest.emoji);
    this.cb.onMessage(`Auftrag angenommen: ${job.rest.emoji} ${job.rest.name} abholen!`, "info");
    this.pushHud();
  }

  acceptOfferIndex(i: number) {
    const o = this.offers[i];
    if (o) this.acceptJob(o.id);
  }

  cancelJob() {
    if (!this.order) return;
    this.order = null;
    this.combo = 0;
    this.removeCustomer();
    this.cb.onMessage("Auftrag abgebrochen.", "bad");
    this.pushHud();
  }

  // ---------- Fußballspiel ----------
  private checkStadium() {
    const st = this.world.stadium;
    const onPitch = Math.abs(this.x - st.cx) < st.goalX - 1 && Math.abs(this.z - st.cz) < st.pitchHalfZ - 2;
    if (!onPitch) {
      this.mustLeaveStadium = false;
      return;
    }
    if (this.mustLeaveStadium || this.stun > 0) return;
    this.speed = 0;
    this.pitch = 0;
    this.wheelieMode = false;
    this.model.root.visible = false;
    this.goalTimer = 0;
    this.match = new SoccerMatch(this.scene, st, this.ballMesh);
    this.matchRewarded = false;
    this.cb.onMessage("⚽ Anpfiff! Lieferblitz FC gegen FC Blau – 1 Minute!", "info");
    this.pushHud();
  }

  private updateMatch(dt: number) {
    const m = this.match!;
    const k = this.keys;
    m.update(dt, {
      up: k.has("KeyW") || k.has("ArrowUp"),
      down: k.has("KeyS") || k.has("ArrowDown"),
      left: k.has("KeyA") || k.has("ArrowLeft"),
      right: k.has("KeyD") || k.has("ArrowRight"),
    });
    if (m.state === "end" && !this.matchRewarded) {
      this.matchRewarded = true;
      const res = m.hud().result;
      if (res === "win") {
        this.save.money += 300;
        this.persist();
        this.cb.onMessage(`🏆 Gewonnen ${m.score[0]}:${m.score[1]}! +300 €`, "money");
      } else if (res === "draw") {
        this.cb.onMessage(`Unentschieden ${m.score[0]}:${m.score[1]}`, "info");
      } else {
        this.cb.onMessage(`Verloren ${m.score[0]}:${m.score[1]} 😢`, "bad");
      }
      this.pushHud();
    }
  }

  matchShoot() {
    this.match?.shoot();
  }

  matchPass() {
    this.match?.pass();
  }

  matchToggleCamera() {
    if (this.match) this.match.setEgo(!this.match.ego);
  }

  /** Spiel beenden (nach dem Ergebnis oder abbrechen) und wieder aufs Fahrzeug */
  leaveMatch() {
    if (!this.match) return;
    if (this.match.state !== "end") this.cb.onMessage("Spiel abgebrochen.", "bad");
    this.match.dispose();
    this.match = null;
    const st = this.world.stadium;
    this.x = st.cx;
    this.z = st.cz - st.halfZ - 12.5;
    this.y = this.groundHeight(this.x, this.z);
    this.heading = Math.PI;
    this.speed = 0;
    this.model.root.visible = true;
    this.mustLeaveStadium = true;
    this.resetBall();
    this.pushHud();
  }

  /** Geldautomat: richtiger Code 2345 → 10000 € */
  atmWithdraw(code: string) {
    if (code !== "2345") {
      this.cb.onMessage("Falscher Code! ❌", "bad");
      return false;
    }
    this.save.money += 10000;
    this.persist();
    this.cb.onMessage("Geldautomat: +10000 € 💶", "money");
    this.pushHud();
    return true;
  }

  /** Cheat: Geld hinzufügen */
  addMoney(amount: number) {
    this.save.money += amount;
    this.persist();
    this.cb.onMessage(`Cheat: +${amount.toLocaleString("de-DE")} € 🤑`, "money");
    this.pushHud();
  }

  /** Alle Ninja-Motorräder und das Geld entfernen */
  removeNinjasAndMoney() {
    this.save.money = 0;
    this.save.owned = this.save.owned.filter((id) => !getVehicle(id).name.includes("Ninja"));
    if (!this.save.owned.includes(this.save.vehicle)) {
      this.save.vehicle = "ke100";
      this.setVehicle("ke100");
    }
    this.persist();
    this.cb.onMessage("Ninja und Geld entfernt.", "bad");
    this.pushHud();
  }

  resetProgress() {
    this.save = { money: 0, owned: ["ke100"], vehicle: "ke100", delivered: 0 };
    this.setVehicle("ke100");
    this.persist();
    this.cb.onMessage("Alles weg: 0 € und nur noch die KE100.", "bad");
    this.pushHud();
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    window.removeEventListener("resize", this.onResize);
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // ---------- Intern ----------
  private persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.save));
    } catch {
      /* Speichern nicht möglich – egal */
    }
  }

  private setVehicle(id: string) {
    this.def = getVehicle(id);
    if (this.model) this.scene.remove(this.model.root);
    this.model = buildVehicleModel(this.def);
    this.scene.add(this.model.root);
    this.pitch = 0;
    this.pitchVel = 0;
  }

  private makeJob(): Job {
    const w = this.world;
    const rest = w.restaurants[Math.floor(Math.random() * w.restaurants.length)];
    let cust = w.houses[0];
    for (let i = 0; i < 60; i++) {
      cust = w.houses[Math.floor(Math.random() * w.houses.length)];
      const d = Math.abs(cust.door.x - rest.door.x) + Math.abs(cust.door.z - rest.door.z);
      if (d > 80 && d < 450) break;
    }
    const route = Math.abs(cust.door.x - rest.door.x) + Math.abs(cust.door.z - rest.door.z);
    return {
      id: this.nextJobId++,
      rest,
      cust,
      route,
      pay: Math.round(25 + route * 0.18),
      timeLimit: Math.round(20 + route / 8),
    };
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
    if (this.paused) return;
    this.keys.add(e.code);
    if (this.match) {
      if (e.code === "Space" && !e.repeat) this.match.shoot();
      if (e.code === "KeyE" && !e.repeat) this.match.pass();
      if (e.code === "KeyC" && !e.repeat) this.match.setEgo(!this.match.ego);
      return;
    }
    if (e.code === "KeyR" && !e.repeat) this.respawn();
    if (e.code === "Space" && !e.repeat && !this.air && !this.loopRun && this.stun <= 0 && this.def.kind !== "car") {
      this.wheelieMode = !this.wheelieMode;
      this.wheelieLifted = false;
    }
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };
  private onBlur = () => this.keys.clear();
  private onResize = () => {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.updateViewOffset();
  };

  private respawn() {
    this.x = this.world.spawn.x;
    this.z = this.world.spawn.z;
    this.heading = this.world.spawn.heading;
    this.speed = 0;
    this.pitch = 0;
    this.pitchVel = 0;
    this.stun = 0;
    this.air = false;
    this.vy = 0;
    this.flip = 0;
    this.loopRun = null;
    this.wheelieMode = false;
    this.y = 0;
    this.cb.onMessage("Zurück zur Garage 🏠", "info");
  }

  private crash(text: string) {
    this.stun = 1.6;
    this.speed = 0;
    this.pitch = 0;
    this.pitchVel = 0;
    this.wheelieTime = 0;
    this.wheelieMode = false;
    this.air = false;
    this.vy = 0;
    this.flip = 0;
    this.loopRun = null;
    this.y = this.groundHeight(this.x, this.z);
    this.cb.onMessage(text, "bad");
  }

  private loop = (t: number) => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
    this.time += dt;
    if (!this.paused) {
      if (this.match) this.updateMatch(dt);
      else {
        this.updatePhysics(dt);
        this.updateOrders(dt);
        this.updateBall(dt);
        this.checkStadium();
      }
    }
    for (const a of this.world.animators) a(dt, this.time);
    this.traffic.update(dt, this.x, this.z);
    this.updateVisuals(dt);
    this.renderer.render(this.scene, this.camera);
    this.drawMinimap();
    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.08;
      this.pushHud();
    }
  };

  private updatePhysics(dt: number) {
    const k = this.keys;
    const v = this.def;
    const stunned = this.stun > 0;
    if (stunned) this.stun -= dt;
    this.bumpCooldown -= dt;

    const up = !stunned && (k.has("KeyW") || k.has("ArrowUp"));
    const down = !stunned && (k.has("KeyS") || k.has("ArrowDown"));
    const left = !stunned && (k.has("KeyA") || k.has("ArrowLeft"));
    const right = !stunned && (k.has("KeyD") || k.has("ArrowRight"));
    const spaceHeld = !stunned && k.has("Space");
    const isCar = v.kind === "car";
    const handbrake = isCar && spaceHeld && !this.air;

    if (this.loopRun) {
      this.updateLoop(dt, up);
      return;
    }

    // --- Gas & Bremse (in der Luft bleibt das Tempo) ---
    if (!this.air) {
      if (up) {
        let a = v.accel * Math.max(0.12, 1 - (this.speed / v.maxSpeed) ** 2);
        if (v.style === "classic") a *= 0.65 + 0.35 * Math.abs(Math.sin(this.time * 7)); // stottert
        if (this.speed < 0) a = 14;
        this.speed = Math.min(v.maxSpeed, this.speed + a * dt);
      } else if (down) {
        if (this.speed > 0.5) this.speed -= (isCar ? 24 : 20) * dt;
        else this.speed = Math.max(-v.maxSpeed * 0.25, this.speed - v.accel * 0.6 * dt);
      } else {
        const drag = 1.2 + Math.abs(this.speed) * 0.05;
        if (this.speed > 0) this.speed = Math.max(0, this.speed - drag * dt);
        else this.speed = Math.min(0, this.speed + drag * dt);
      }
    }

    if (handbrake && this.speed > 0) this.speed = Math.max(0, this.speed - 9 * dt);

    // --- Lenken ---
    const steerIn = (left ? 1 : 0) - (right ? 1 : 0);
    this.steer += (steerIn - this.steer) * Math.min(1, 7 * dt);
    const absSpd = Math.abs(this.speed);
    const turnFactor =
      Math.min(1, absSpd / 5) * (1 - 0.45 * Math.min(1, absSpd / 50)) * (this.pitch > 0.1 ? 0.5 : 1) * (this.air ? 0.3 : 1) * (handbrake ? 1.7 : 1);
    this.heading += this.steer * v.turn * turnFactor * Math.sign(this.speed) * dt;

    // --- Wheelie-Modus: einmal Leertaste, dann Gas = hoch, Gas loslassen = runter ---
    if (!this.air) {
      const lifting = this.wheelieMode && up && this.speed > 2;
      if (this.pitch <= 0 && !lifting) {
        this.pitch = 0;
        this.pitchVel = 0;
      } else {
        const lift = lifting ? v.wheelie : 0;
        const gravity = up ? 4.0 : 5.0;
        this.pitchVel += (lift - gravity * Math.cos(this.pitch)) * dt;
        this.pitchVel *= 1 - 2.0 * dt;
        this.pitch += this.pitchVel * dt;
        if (this.pitch < 0) {
          this.pitch = 0;
          this.pitchVel = 0;
        }
        if (this.pitch > CRASH_PITCH) this.crash("Überschlag! 😵 Gas loslassen, wenn der Balken rot wird!");
      }
      if (this.pitch > 0.15) this.wheelieLifted = true;
      // Vorderrad wieder unten → Wheelie-Modus aus
      if (this.wheelieMode && this.wheelieLifted && this.pitch <= 0) this.wheelieMode = false;
    }
    if (this.pitch > 0.12) {
      this.wheelieTime += dt;
    } else if (this.wheelieTime > 0) {
      if (this.wheelieTime >= 1) {
        const bonus = Math.floor(this.wheelieTime * 3);
        this.save.money += bonus;
        this.persist();
        this.cb.onMessage(`Wheelie ${this.wheelieTime.toFixed(1)}s! +${bonus} €`, "money");
      }
      this.wheelieTime = 0;
    }

    // --- Bewegen ---
    const oldX = this.x;
    const oldZ = this.z;
    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    // Bei sehr hohem Tempo in kleinen Schritten rechnen, damit man nicht durch Wände fliegt
    const R = isCar ? 1.25 : 0.8;
    let hit = false;
    const steps = Math.max(1, Math.ceil((Math.abs(this.speed) * dt) / 0.4));
    for (let st = 0; st < steps; st++) {
    this.x += (fx * this.speed * dt) / steps;
    this.z += (fz * this.speed * dt) / steps;

    // --- Kollision mit Häusern, Bäumen, Laternen ---
    for (const b of this.world.colliders) {
      if (this.x < b.minX - 2 || this.x > b.maxX + 2 || this.z < b.minZ - 2 || this.z > b.maxZ + 2) continue;
      const cx = Math.max(b.minX, Math.min(this.x, b.maxX));
      const cz = Math.max(b.minZ, Math.min(this.z, b.maxZ));
      const dx = this.x - cx;
      const dz = this.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= R * R) continue;
      hit = true;
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        this.x += (dx / d) * (R - d);
        this.z += (dz / d) * (R - d);
      } else {
        const pens = [this.x - b.minX, b.maxX - this.x, this.z - b.minZ, b.maxZ - this.z];
        const m = pens.indexOf(Math.min(...pens));
        if (m === 0) this.x = b.minX - R;
        if (m === 1) this.x = b.maxX + R;
        if (m === 2) this.z = b.minZ - R;
        if (m === 3) this.z = b.maxZ + R;
      }
    }
    }
    // --- Kollision mit Autos ---
    let carHit = false;
    let ferrariHit = false;
    if (this.y < 1.5) {
      for (const car of this.traffic.cars) {
        const hx = Math.sin(car.heading);
        const hz = Math.cos(car.heading);
        for (const o of [-1.3, 0, 1.3]) {
          const cx = car.x + hx * o;
          const cz = car.z + hz * o;
          const dx = this.x - cx;
          const dz = this.z - cz;
          const d = Math.hypot(dx, dz);
          const rr = 1.0 + R;
          if (d < rr && d > 1e-4) {
            this.x += (dx / d) * (rr - d);
            this.z += (dz / d) * (rr - d);
            carHit = true;
            if (car.fast && car.speed > 12) ferrariHit = true;
          }
        }
      }
    }
    if (ferrariHit && this.bumpCooldown <= 0) {
      this.crash("Ein Ferrari hat dich erwischt! 🏎️💨");
    } else if (hit || carHit) {
      if (Math.abs(this.speed) > (carHit ? (isCar ? 16 : 11) : isCar ? 22 : 16) && this.bumpCooldown <= 0) {
        this.crash(carHit ? "Crash mit einem Auto! 🚗💥" : "Crash! 💥 Pass auf!");
      } else if (this.bumpCooldown <= 0) {
        this.speed *= 0.35;
        this.bumpCooldown = 0.3;
      }
    }

    const lim = LIMIT - 8;
    this.x = Math.max(-lim, Math.min(lim, this.x));
    this.z = Math.max(-lim, Math.min(lim, this.z));

    // --- Höhe: Rampen, Sprünge, Landung ---
    const gh = this.groundHeight(this.x, this.z);
    if (!this.air) {
      if (gh - this.y > 0.6 + Math.abs(this.speed) * dt * 0.45) {
        // seitlich gegen eine Rampe/Plattform
        this.x = oldX;
        this.z = oldZ;
        if (Math.abs(this.speed) > 14) this.crash("Gegen die Rampe gefahren! 💥");
        else this.speed *= 0.3;
      } else if (gh < this.y - 0.35) {
        // Kante → abheben!
        this.air = true;
        this.vy = Math.max(0, this.groundVy);
        this.airTime = 0;
        this.flip = 0;
        this.pitch = 0;
        this.pitchVel = 0;
        this.wheelieMode = false;
      } else {
        this.groundVy = (gh - this.y) / Math.max(dt, 0.001);
        this.y = gh;
      }
    } else {
      this.vy -= GRAVITY * dt;
      this.y += this.vy * dt;
      this.airTime += dt;
      if (spaceHeld) this.flip += 7 * dt; // Backflip
      if (gh > this.y + 0.6) {
        this.x = oldX;
        this.z = oldZ;
        this.speed *= 0.3;
      } else if (this.y <= gh) {
        this.land(gh);
      }
    }

    // --- Looping-Einfahrt ---
    if (!this.air && this.stun <= 0) {
      for (const L of this.world.park.loops) {
        const rx = this.x - L.ex;
        const rz = this.z - L.ez;
        const along = rx * L.ax + rz * L.az;
        const lat = rx * L.lx + rz * L.lz;
        if (along > -1.2 && along < 0.8 && Math.abs(lat) < 1.6 && fx * L.ax + fz * L.az > 0.8 && this.speed > 3) {
          this.loopRun = { L, theta: 0 };
          this.pitch = 0;
          this.pitchVel = 0;
          this.wheelieMode = false;
          this.heading = Math.atan2(L.ax, L.az);
          break;
        }
      }
    }
  }

  private land(gh: number) {
    const TWO_PI = Math.PI * 2;
    const rem = ((this.flip % TWO_PI) + TWO_PI) % TWO_PI;
    const off = Math.min(rem, TWO_PI - rem);
    const flips = Math.round(this.flip / TWO_PI);
    const vy = this.vy;
    const airTime = this.airTime;
    this.air = false;
    this.y = gh;
    this.vy = 0;
    this.groundVy = 0;
    this.flip = 0;
    if (off > 0.75) {
      this.crash("Falsch gelandet! 🤕 Leertaste rechtzeitig loslassen!");
      return;
    }
    if (vy < -26) {
      this.crash("Zu harte Landung! 💥");
      return;
    }
    let bonus = airTime > 0.6 ? Math.round(airTime * 10) : 0;
    bonus += flips * 50;
    if (bonus > 0) {
      this.save.money += bonus;
      this.persist();
      const txt = flips > 0 ? `${flips > 1 ? `${flips}x ` : ""}Backflip! 🤸` : `Sprung ${airTime.toFixed(1)}s! 🚀`;
      this.cb.onMessage(`${txt} +${bonus} €`, "money");
    }
  }

  private updateLoop(dt: number, up: boolean) {
    const run = this.loopRun!;
    const L = run.L;
    this.speed -= LOOP_G * Math.sin(run.theta) * dt;
    if (up) this.speed += this.def.accel * 0.4 * dt;
    run.theta += (Math.max(this.speed, 0.5) / L.R) * dt;
    const c = Math.cos(run.theta);
    if ((c < 0 && this.speed * this.speed < LOOP_G * L.R * -c * 0.6) || this.speed < 0.5) {
      const kmh = Math.ceil((L.minSpeed * 3.6) / 5) * 5;
      this.setLoopPos();
      this.loopRun = null;
      this.y = 0;
      this.crash(`Zu langsam für den Looping! Du brauchst ${kmh} km/h 😵`);
      return;
    }
    if (run.theta >= Math.PI * 2) {
      this.loopRun = null;
      this.x = L.ex + L.lx * L.off + L.ax * 0.5;
      this.z = L.ez + L.lz * L.off + L.az * 0.5;
      this.y = 0;
      this.groundVy = 0;
      this.heading = Math.atan2(L.ax, L.az);
      this.save.money += 40;
      this.persist();
      this.cb.onMessage("LOOPING geschafft! 🎢 +40 €", "money");
      return;
    }
    this.setLoopPos();
  }

  private setLoopPos() {
    const run = this.loopRun!;
    const L = run.L;
    const th = run.theta;
    const along = L.R * Math.sin(th);
    const lat = (L.off * th) / (Math.PI * 2);
    this.x = L.ex + L.ax * along + L.lx * lat;
    this.z = L.ez + L.az * along + L.lz * lat;
    this.y = L.R * (1 - Math.cos(th));
  }

  private groundHeight(x: number, z: number) {
    if (inRect(PARK_RECT, x, z)) return jumpHeight(this.world.park, x, z);
    if (inRect(STADIUM_RECT, x, z)) return 0.08;
    const lx = x + HALF;
    const lz = z + HALF;
    if (lx < 0 || lz < 0 || lx > N * CELL || lz > N * CELL) return 0;
    const mx = lx % CELL;
    const mz = lz % CELL;
    const inBlock = mx > ROAD / 2 && mx < CELL - ROAD / 2 && mz > ROAD / 2 && mz < CELL - ROAD / 2;
    if (!inBlock) return 0;
    const inLot = mx > ROAD / 2 + 2.5 && mx < CELL - ROAD / 2 - 2.5 && mz > ROAD / 2 + 2.5 && mz < CELL - ROAD / 2 - 2.5;
    return inLot ? 0.4 : 0.3;
  }

  private makeBall() {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 128;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = "#111111";
    for (const [x, y] of [
      [32, 64], [96, 30], [96, 98], [160, 64], [224, 30], [224, 98], [0, 64], [256, 64], [128, 0], [128, 128],
    ]) {
      ctx.beginPath();
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        ctx.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14);
      }
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 16), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45 }));
    m.castShadow = true;
    return m;
  }

  private resetBall() {
    const st = this.world.stadium;
    Object.assign(this.ball, { x: st.cx, y: 0.7, z: st.cz, vx: 0, vy: 0, vz: 0 });
  }

  private updateBall(dt: number) {
    const b = this.ball;
    const st = this.world.stadium;
    const R = 0.55;
    // Schuss: Fahrzeug berührt den Ball
    const dx = b.x - this.x;
    const dz = b.z - this.z;
    const d = Math.hypot(dx, dz);
    if (d < 1.5 && Math.abs(b.y - this.y) < 2 && !this.loopRun) {
      const nx = d > 0.01 ? dx / d : Math.sin(this.heading);
      const nz = d > 0.01 ? dz / d : Math.cos(this.heading);
      const sp = Math.max(Math.abs(this.speed) * 1.5, 6);
      b.vx = nx * sp + Math.sin(this.heading) * this.speed * 0.3;
      b.vz = nz * sp + Math.cos(this.heading) * this.speed * 0.3;
      b.vy = 2.5 + Math.abs(this.speed) * 0.18;
      b.x = this.x + nx * 1.5;
      b.z = this.z + nz * 1.5;
    }
    b.vy -= 18 * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.z += b.vz * dt;
    const ground = 0.1 + R;
    if (b.y < ground) {
      b.y = ground;
      b.vy = b.vy < -2 ? -b.vy * 0.55 : 0;
      b.vx *= 1 - 0.7 * dt;
      b.vz *= 1 - 0.7 * dt;
    }
    const rx = b.x - st.cx;
    const rz = b.z - st.cz;
    // Tor?
    if (this.goalTimer > 0) {
      this.goalTimer -= dt;
      if (this.goalTimer <= 0) this.resetBall();
    } else if (Math.abs(rx) > st.goalX + 0.3 && Math.abs(rz) < st.goalHalf && b.y < 2.6) {
      this.goalTimer = 2;
      this.save.money += 20;
      this.persist();
      this.cb.onMessage("TOOOR! ⚽🎉 +20 €", "money");
    }
    // Tornetz
    if (Math.abs(rz) < st.goalHalf + 0.3 && Math.abs(rx) > st.goalX + 1.8) {
      b.x = st.cx + Math.sign(rx) * (st.goalX + 1.8);
      b.vx = -b.vx * 0.2;
    }
    // Tribünen-Wände
    if (Math.abs(b.x - st.cx) > st.halfX) {
      b.x = st.cx + Math.sign(b.x - st.cx) * st.halfX;
      b.vx = -b.vx * 0.6;
    }
    if (Math.abs(b.z - st.cz) > st.halfZ) {
      b.z = st.cz + Math.sign(b.z - st.cz) * st.halfZ;
      b.vz = -b.vz * 0.6;
    }
    this.ballMesh.position.set(b.x, b.y, b.z);
    this.ballMesh.rotation.x += (b.vz * dt) / R;
    this.ballMesh.rotation.z -= (b.vx * dt) / R;
  }

  private spawnCustomer(h: House) {
    this.removeCustomer();
    const p = randomPerson(Math.random);
    p.root.position.set(h.stand.x, 0.3, h.stand.z);
    p.root.rotation.y = h.heading;
    this.scene.add(p.root);
    this.customer = p;
    this.customerHappy = 0;
  }

  private removeCustomer() {
    if (this.customer) {
      this.scene.remove(this.customer.root);
      this.customer.root.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
      this.customer = null;
    }
  }

  private updateOrders(dt: number) {
    this.offerTimer += dt;
    if (this.offerTimer > 25) {
      this.offerTimer = 0;
      this.offers.shift();
      this.offers.push(this.makeJob());
    }
    if (!this.order) return;
    const o = this.order;
    const target = o.stage === "pickup" ? o.rest.door : o.cust.door;
    if (o.stage === "deliver") o.timeLeft -= dt;
    const d = Math.hypot(this.x - target.x, this.z - target.z);
    if (d < 5) {
      if (o.stage === "pickup") {
        o.stage = "deliver";
        o.timeLeft = o.timeLimit;
        this.spawnCustomer(o.cust);
        this.orderBeacon.sprite.material.map = emojiTexture("🏠");
        this.cb.onMessage(`${o.rest.emoji} Abgeholt! Bring es schnell zum Kunden!`, "info");
      } else {
        let total: number;
        if (o.timeLeft > 0) {
          this.combo += 1;
          const tip = Math.round(o.pay * 0.6 * (o.timeLeft / o.timeLimit));
          const mult = 1 + Math.min(this.combo - 1, 10) * 0.1;
          total = Math.round((o.pay + tip) * mult);
          const comboTxt = this.combo > 1 ? ` · Combo x${mult.toFixed(1)} 🔥` : "";
          this.cb.onMessage(`Geliefert! +${total} € (${tip} € Trinkgeld)${comboTxt}`, "money");
        } else {
          this.combo = 0;
          total = Math.round(o.pay * 0.5);
          this.cb.onMessage(`Zu spät... nur +${total} € 😕`, "bad");
        }
        this.save.money += total;
        this.save.delivered += 1;
        this.persist();
        this.order = null;
        this.customerHappy = 2;
      }
    }
  }

  private updateVisuals(dt: number) {
    const m = this.model;
    m.root.position.set(this.x, this.y, this.z);
    m.root.rotation.order = "YXZ";
    m.root.rotation.y = this.heading;
    const hfx = Math.sin(this.heading);
    const hfz = Math.cos(this.heading);
    let bodyPitch: number;
    if (this.loopRun) bodyPitch = this.loopRun.theta;
    else if (this.air) bodyPitch = Math.max(-0.6, Math.min(0.6, Math.atan2(this.vy, Math.max(Math.abs(this.speed), 2)) * 0.7)) + this.flip;
    else {
      const hF = this.groundHeight(this.x + hfx * 0.8, this.z + hfz * 0.8);
      const hB = this.groundHeight(this.x - hfx * 0.8, this.z - hfz * 0.8);
      const target = Math.abs(hF - hB) > 0.5 ? 0 : Math.atan2(hF - hB, 1.6);
      this.slopePitch += (target - this.slopePitch) * Math.min(1, 15 * dt);
      bodyPitch = this.slopePitch;
    }
    m.root.rotation.x = -bodyPitch;
    const isCarV = this.def.kind === "car";
    const leanTarget = this.loopRun
      ? 0
      : isCarV
        ? this.steer * 0.06 * Math.min(1, Math.abs(this.speed) / 15)
        : this.stun > 0
          ? 1.4
          : -this.steer * 0.45 * Math.min(1, Math.abs(this.speed) / 10);
    this.lean += (leanTarget - this.lean) * Math.min(1, 8 * dt);
    m.lean.rotation.z = this.lean;
    m.pitch.rotation.x = -this.pitch;
    for (const w of m.wheels) w.g.rotation.x += (this.speed / w.r) * dt;

    // Kamera
    if (this.showroom) {
      this.showroomAngle += dt * 0.35;
      const sr = isCarV ? 7.5 : 4.2;
      this.camDesired.set(this.x + Math.sin(this.showroomAngle) * sr, this.y + (isCarV ? 2.4 : 1.6), this.z + Math.cos(this.showroomAngle) * sr);
      this.camera.position.lerp(this.camDesired, 1 - Math.exp(-4 * dt));
      this.camTarget.set(this.x, this.y + 0.9, this.z);
      this.camera.lookAt(this.camTarget);
    } else if (this.match) {
      const snap = this.match.camera(this.camDesired, this.camTarget);
      if (snap) this.camera.position.copy(this.camDesired);
      else this.camera.position.lerp(this.camDesired, 1 - Math.exp(-4 * dt));
      this.camera.lookAt(this.camTarget);
    } else if (this.loopRun) {
      // Seitenkamera für den Looping
      const L = this.loopRun.L;
      const cx = L.ex + (L.lx * L.off) / 2;
      const cz = L.ez + (L.lz * L.off) / 2;
      this.camDesired.set(cx + L.lx * 17 - L.ax * 3, L.R + 1.5, cz + L.lz * 17 - L.az * 3);
      this.camera.position.lerp(this.camDesired, 1 - Math.exp(-5 * dt));
      this.camTarget.set(this.x, this.y + 0.8, this.z);
      this.camera.lookAt(this.camTarget);
    } else {
      const fx = Math.sin(this.heading);
      const fz = Math.cos(this.heading);
      const spd = Math.abs(this.speed);
      const dist = (isCarV ? 8.5 : 5.8) + spd * 0.07;
      this.camDesired.set(this.x - fx * dist, this.y + (isCarV ? 3.4 : 2.6) + spd * 0.02, this.z - fz * dist);
      this.camera.position.lerp(this.camDesired, 1 - Math.exp(-6 * dt));
      this.camTarget.set(this.x + fx * 3, this.y + 1.3, this.z + fz * 3);
      this.camera.lookAt(this.camTarget);
    }
    const fov = this.match?.ego ? 78 : Math.min(95, 62 + Math.abs(this.speed) * 0.3);
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov += (fov - this.camera.fov) * Math.min(1, 4 * dt);
      this.camera.updateProjectionMatrix();
    }

    // Sonne folgt dem Spieler (für Schatten)
    this.sun.position.set(this.x + this.sunDir.x * 150, this.sunDir.y * 150, this.z + this.sunDir.z * 150);
    this.sun.target.position.set(this.x, 0, this.z);

    for (const s of this.world.spinners) s.rotation.y += dt * 0.6;
    for (const d of this.displayModels) d.rotation.y += dt * 0.4;

    // Kunde winkt
    if (this.customer) {
      const p = this.customer;
      if (this.customerHappy > 0) {
        this.customerHappy -= dt;
        p.root.position.y = 0.3 + Math.abs(Math.sin(this.time * 9)) * 0.35;
        p.arms[0].rotation.z = 2.7;
        p.arms[1].rotation.z = -2.7;
        if (this.customerHappy <= 0) this.removeCustomer();
      } else {
        p.arms[1].rotation.z = -(2.5 + Math.sin(this.time * 8) * 0.35);
      }
    }

    // Beacons
    const ob = this.orderBeacon;
    if (this.order) {
      const t = this.order.stage === "pickup" ? this.order.rest.door : this.order.cust.door;
      ob.group.visible = true;
      ob.group.position.set(t.x, 0, t.z);
      const col = this.order.stage === "pickup" ? "#ff9800" : "#00e676";
      ob.beamMat.color.set(col);
      ob.ringMat.color.set(col);
    } else ob.group.visible = false;
    for (const b of [ob, this.garageBeacon, this.atmBeacon]) {
      b.arrow.rotation.y += dt * 2;
      b.arrow.position.y = 3.2 + Math.sin(this.time * 3) * 0.3;
      b.sprite.position.y = 5.6 + Math.sin(this.time * 3) * 0.3;
      b.beamMat.opacity = 0.2 + Math.sin(this.time * 4) * 0.07;
    }
  }

  private buildMinimapBg() {
    const S = this.minimap.width;
    const c = document.createElement("canvas");
    c.width = S;
    c.height = S;
    const ctx = c.getContext("2d")!;
    const s = S / (2 * LIMIT);
    const P = (x: number, z: number) => [(x + LIMIT) * s, (z + LIMIT) * s] as const;
    ctx.fillStyle = "#5fae48";
    ctx.fillRect(0, 0, S, S);
    const city = N * CELL + ROAD;
    const [ax, az] = P(-city / 2, -city / 2);
    ctx.fillStyle = "#555a60";
    ctx.fillRect(ax, az, city * s, city * s);
    for (const b of this.world.blockRects) {
      const [x, z] = P(b.minX, b.minZ);
      ctx.fillStyle = "#cfcfcf";
      ctx.fillRect(x, z, (b.maxX - b.minX) * s, (b.maxZ - b.minZ) * s);
    }
    for (const b of this.world.parkRects) {
      const [x, z] = P(b.minX + 2, b.minZ + 2);
      ctx.fillStyle = "#79d15b";
      ctx.fillRect(x, z, (b.maxX - b.minX - 4) * s, (b.maxZ - b.minZ - 4) * s);
    }
    {
      const r = PARK_RECT;
      const [x, z] = P(r.minX, r.minZ);
      ctx.fillStyle = "#f4a261";
      ctx.fillRect(x, z, (r.maxX - r.minX) * s, (r.maxZ - r.minZ) * s);
      ctx.fillStyle = "#9c5b2c";
      for (const rp of this.world.park.ramps) {
        const [a, b] = P(rp.ox, rp.oz);
        const [c, d] = P(rp.ox + rp.dx * rp.len - rp.dz * rp.w * 0.5, rp.oz + rp.dz * rp.len + rp.dx * rp.w * 0.5);
        const [e, f] = P(rp.ox + rp.dz * rp.w * 0.5, rp.oz - rp.dx * rp.w * 0.5);
        ctx.fillRect(Math.min(a, c, e), Math.min(b, d, f), Math.abs(Math.max(a, c, e) - Math.min(a, c, e)) + 1, Math.abs(Math.max(b, d, f) - Math.min(b, d, f)) + 1);
      }
      ctx.strokeStyle = "#6a1b9a";
      ctx.lineWidth = 2;
      for (const L of this.world.park.loops) {
        const [lx, lz] = P(L.ex + L.lx * 1.8, L.ez + L.lz * 1.8);
        ctx.beginPath();
        ctx.arc(lx, lz, L.R * s + 1, 0, Math.PI * 2);
        ctx.stroke();
      }
      const [px, pz] = P((r.minX + r.maxX) / 2, (r.minZ + r.maxZ) / 2);
      ctx.font = "16px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🎢", px, pz);
    }
    {
      const r = STADIUM_RECT;
      const [x, z] = P(r.minX + 10, r.minZ + 10);
      ctx.fillStyle = "#4f9e3a";
      ctx.fillRect(x, z, (r.maxX - r.minX - 20) * s, (r.maxZ - r.minZ - 20) * s);
      const [px, pz] = P((r.minX + r.maxX) / 2, (r.minZ + r.maxZ) / 2);
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("⚽", px, pz);
    }
    for (const b of this.world.houseBoxes) {
      const [x, z] = P(b.minX, b.minZ);
      ctx.fillStyle = "#9a9a9a";
      ctx.fillRect(x, z, (b.maxX - b.minX) * s, (b.maxZ - b.minZ) * s);
    }
    for (const r of this.world.restaurants) {
      const [x, z] = P(r.door.x, r.door.z);
      ctx.fillStyle = r.color;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, z, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    const [mx, mz] = P(this.world.atm.x, this.world.atm.z);
    ctx.fillStyle = "#ffd600";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(mx, mz, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const [gx, gz] = P(this.world.garage.x, this.world.garage.z);
    ctx.fillStyle = "#2979ff";
    ctx.fillRect(gx - 4, gz - 4, 8, 8);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(gx - 4, gz - 4, 8, 8);
    return c;
  }

  private drawMinimap() {
    const ctx = this.mmCtx;
    const S = this.minimap.width;
    const s = S / (2 * LIMIT);
    ctx.drawImage(this.mmBg, 0, 0);
    for (const car of this.traffic.cars) {
      ctx.fillStyle = car.fast ? "#ff1744" : "rgba(30,30,30,0.8)";
      const sz = car.fast ? 4 : 3;
      ctx.fillRect((car.x + LIMIT) * s - sz / 2, (car.z + LIMIT) * s - sz / 2, sz, sz);
    }
    if (this.order) {
      const t = this.order.stage === "pickup" ? this.order.rest.door : this.order.cust.door;
      const tx = (t.x + LIMIT) * s;
      const tz = (t.z + LIMIT) * s;
      ctx.fillStyle = this.order.stage === "pickup" ? "#ff9800" : "#00e676";
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(tx, tz, 5 + Math.sin(this.time * 6) * 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.save();
    ctx.translate((this.x + LIMIT) * s, (this.z + LIMIT) * s);
    ctx.rotate(-this.heading);
    ctx.fillStyle = "#ffeb3b";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 7);
    ctx.lineTo(-5, -5);
    ctx.lineTo(5, -5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private pushHud() {
    let order: OrderInfo | null = null;
    if (this.order) {
      const o = this.order;
      const t = o.stage === "pickup" ? o.rest.door : o.cust.door;
      let angle = Math.atan2(t.x - this.x, t.z - this.z) - this.heading;
      angle = Math.atan2(Math.sin(angle), Math.cos(angle));
      order = {
        stage: o.stage,
        restaurant: o.rest.name,
        emoji: o.rest.emoji,
        color: o.rest.color,
        timeLeft: o.timeLeft,
        timeLimit: o.timeLimit,
        pay: o.pay,
        distance: Math.hypot(t.x - this.x, t.z - this.z),
        angle,
      };
    }
    this.cb.onHud({
      money: this.save.money,
      speedKmh: Math.abs(this.speed) * 3.6,
      vehicleId: this.save.vehicle,
      owned: [...this.save.owned],
      delivered: this.save.delivered,
      order,
      offers: this.offers.map((j) => ({
        id: j.id,
        restaurant: j.rest.name,
        emoji: j.rest.emoji,
        color: j.rest.color,
        pay: j.pay,
        route: j.route,
        toRestaurant: Math.hypot(j.rest.door.x - this.x, j.rest.door.z - this.z),
        timeLimit: j.timeLimit,
      })),
      combo: this.combo,
      match: this.match ? this.match.hud() : null,
      atAtm: Math.hypot(this.x - this.world.atm.x, this.z - this.world.atm.z) < 4,
      inGarage: Math.hypot(this.x - this.world.garage.x, this.z - this.world.garage.z) < 7,
      wheelie: this.wheelieTime,
      wheelieMode: this.wheelieMode,
      air: this.air,
      pitch: this.pitch / CRASH_PITCH,
      stunned: this.stun > 0,
    });
  }
}

export { VEHICLES };
