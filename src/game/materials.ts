import * as THREE from "three";

// ---------- Prozedurale Texturen (werden im Browser gezeichnet) ----------
function cnv(w: number, h = w) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!] as const;
}

function noise(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

function tex(c: HTMLCanvasElement, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function plasterTex() {
  const [c, ctx] = cnv(256);
  ctx.fillStyle = "#efefef";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.03})`;
    ctx.beginPath();
    ctx.arc(Math.random() * 256, Math.random() * 256, 10 + Math.random() * 30, 0, Math.PI * 2);
    ctx.fill();
  }
  noise(ctx, 256, 256, 16);
  return tex(c);
}

function brickTex() {
  const [c, ctx] = cnv(256);
  ctx.fillStyle = "#e0e0e0";
  ctx.fillRect(0, 0, 256, 256);
  const bh = 16;
  const bw = 32;
  for (let row = 0; row < 256 / bh; row++) {
    const off = row % 2 ? bw / 2 : 0;
    for (let x = -bw; x < 256 + bw; x += bw) {
      const g = 150 + Math.random() * 60;
      ctx.fillStyle = `rgb(${g},${g * 0.97},${g * 0.95})`;
      ctx.fillRect(x + off + 1.5, row * bh + 1.5, bw - 3, bh - 3);
    }
  }
  noise(ctx, 256, 256, 22);
  return tex(c);
}

function sidingTex() {
  const [c, ctx] = cnv(256);
  ctx.fillStyle = "#ececec";
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 32) {
    const grd = ctx.createLinearGradient(0, y, 0, y + 32);
    grd.addColorStop(0, "#fafafa");
    grd.addColorStop(1, "#d4d4d4");
    ctx.fillStyle = grd;
    ctx.fillRect(0, y, 256, 32);
    ctx.fillStyle = "#a8a8a8";
    ctx.fillRect(0, y + 30, 256, 2);
  }
  noise(ctx, 256, 256, 10);
  return tex(c);
}

function roofTex() {
  // Ziegelreihen laufen entlang der u-Richtung (parallel zum Dachfirst)
  const [c, ctx] = cnv(256);
  for (let x = 0; x < 256; x += 32) {
    const grd = ctx.createLinearGradient(x, 0, x + 32, 0);
    grd.addColorStop(0, "#f2f2f2");
    grd.addColorStop(0.85, "#b8b8b8");
    grd.addColorStop(1, "#7a7a7a");
    ctx.fillStyle = grd;
    ctx.fillRect(x, 0, 32, 256);
    const off = (x / 32) % 2 ? 21 : 0;
    ctx.fillStyle = "#8a8a8a";
    for (let y = -42; y < 256 + 42; y += 42) ctx.fillRect(x, y + off, 32, 2);
  }
  noise(ctx, 256, 256, 14);
  return tex(c);
}

function concreteTex() {
  const [c, ctx] = cnv(256);
  ctx.fillStyle = "#c9c9c9";
  ctx.fillRect(0, 0, 256, 256);
  noise(ctx, 256, 256, 18);
  ctx.fillStyle = "#a9a9a9";
  ctx.fillRect(0, 0, 256, 2);
  ctx.fillRect(0, 128, 256, 2);
  ctx.fillRect(0, 0, 2, 256);
  ctx.fillRect(128, 0, 2, 256);
  return tex(c);
}

function grassTex() {
  const [c, ctx] = cnv(256);
  ctx.fillStyle = "#66b84a";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4000; i++) {
    const g = 140 + Math.random() * 80;
    ctx.strokeStyle = `rgba(${g * 0.45},${g},${g * 0.3},0.6)`;
    ctx.lineWidth = 1;
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 3, y - 3 - Math.random() * 4);
    ctx.stroke();
  }
  noise(ctx, 256, 256, 12);
  return tex(c);
}

function asphaltTex() {
  const [c, ctx] = cnv(512);
  ctx.fillStyle = "#35383d";
  ctx.fillRect(0, 0, 512, 512);
  noise(ctx, 512, 512, 30);
  for (let i = 0; i < 2500; i++) {
    const g = 90 + Math.random() * 60;
    ctx.fillStyle = `rgba(${g},${g},${g},0.5)`;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 1.5, 1.5);
  }
  ctx.strokeStyle = "rgba(20,20,22,0.5)";
  for (let i = 0; i < 6; i++) {
    ctx.lineWidth = 1 + Math.random();
    ctx.beginPath();
    let x = Math.random() * 512;
    let y = Math.random() * 512;
    ctx.moveTo(x, y);
    for (let k = 0; k < 8; k++) {
      x += (Math.random() - 0.5) * 40;
      y += (Math.random() - 0.5) * 40;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  return tex(c);
}

function woodTex() {
  const [c, ctx] = cnv(128);
  ctx.fillStyle = "#d9d9d9";
  ctx.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 16) {
    ctx.fillStyle = "#9a9a9a";
    ctx.fillRect(0, y, 128, 1.5);
    for (let k = 0; k < 6; k++) {
      ctx.strokeStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.08})`;
      ctx.beginPath();
      const yy = y + 2 + Math.random() * 12;
      ctx.moveTo(0, yy);
      ctx.bezierCurveTo(40, yy + 2, 80, yy - 2, 128, yy);
      ctx.stroke();
    }
  }
  noise(ctx, 128, 128, 10);
  return tex(c);
}

// ---------- Materialien ----------
export interface MaterialSet {
  mats: Record<string, THREE.Material>;
  texScale: Record<string, number>;
  asphalt: THREE.Texture;
  grass: THREE.Texture;
}

let cached: MaterialSet | null = null;

export function getMaterials(): MaterialSet {
  if (cached) return cached;
  const S = (p: THREE.MeshStandardMaterialParameters) =>
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, ...p });
  const I = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 0.8, ...p });

  const asphalt = asphaltTex();
  const grass = grassTex();

  const mats: Record<string, THREE.Material> = {
    plain: S({}),
    plaster: S({ map: plasterTex(), roughness: 0.95 }),
    brick: S({ map: brickTex(), roughness: 0.9 }),
    siding: S({ map: sidingTex(), roughness: 0.8 }),
    roof: S({ map: roofTex(), roughness: 0.75 }),
    concrete: S({ map: concreteTex(), roughness: 0.95 }),
    grass: S({ map: grass, roughness: 1 }),
    wood: S({ map: woodTex(), roughness: 0.8 }),
    glass: S({ roughness: 0.05, metalness: 0.3, envMapIntensity: 1.6 }),
    metal: S({ roughness: 0.4, metalness: 0.7 }),
    chrome: S({ roughness: 0.12, metalness: 1 }),
    rubber: S({ roughness: 0.95 }),
    paintGloss: S({ roughness: 0.25, metalness: 0.35 }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    leaf: S({ flatShading: true, roughness: 0.9 }),
    water: S({ roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.85 }),
    cloud: S({ flatShading: true, roughness: 1, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.45 }),
    // Instanced (Farbe pro Kopie, keine Vertex-Farben)
    i_paint: I({ roughness: 0.7 }),
    i_frame: I({ roughness: 0.6 }),
    i_glass: I({ roughness: 0.05, metalness: 0.35, envMapIntensity: 1.8 }),
    i_plain: I({}),
    i_lit: I({ color: "#ffe2a8", emissive: new THREE.Color("#ffb347"), emissiveIntensity: 0.55, roughness: 0.3 }),
  };
  const texScale: Record<string, number> = {
    plaster: 3,
    brick: 2.5,
    siding: 2,
    roof: 2,
    concrete: 2,
    grass: 4,
    wood: 1.5,
  };
  cached = { mats, texScale, asphalt, grass };
  return cached;
}
