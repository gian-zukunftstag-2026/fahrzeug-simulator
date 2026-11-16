import * as THREE from "three";
import { Builder, GEO } from "./builder";

/** Großes 3D-Essen für das Restaurant-Dach (ca. 4–5 m groß) */
export function buildFoodProp(name: string): THREE.Group {
  const B = new Builder();
  const halfSphere = new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const bowl = new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  const g = new THREE.Group();

  switch (name) {
    case "PIZZA": {
      B.geo("plain", GEO.cyl24, 0, 0.2, 0, "#e9b04f", 0, 0, 0, 2.6, 0.35, 2.6);
      B.geo("plain", GEO.torusWheel, 0, 0.38, 0, "#c98a32", Math.PI / 2, 0, 0, 2.15, 2.15, 1.2);
      B.geo("plain", GEO.cyl24, 0, 0.4, 0, "#d9412b", 0, 0, 0, 2.3, 0.06, 2.3);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const rr = i % 3 === 0 ? 0.6 : 1.5;
        B.geo("plain", GEO.cyl16, Math.cos(a) * rr, 0.46, Math.sin(a) * rr, "#ffe08a", 0, 0, 0, 0.55, 0.06, 0.55);
        B.geo("plain", GEO.cyl16, Math.cos(a + 0.35) * (rr + 0.3), 0.5, Math.sin(a + 0.35) * (rr + 0.3), "#a3241b", 0, 0, 0, 0.33, 0.06, 0.33);
      }
      for (let i = 0; i < 6; i++) {
        const a = Math.random() * Math.PI * 2;
        B.box("plain", 0.35, 0.05, 0.25, Math.cos(a) * 1.1, 0.52, Math.sin(a) * 1.1, "#2f8f2f", 0, a, 0);
      }
      const p = B.buildGroup();
      p.rotation.x = -0.75;
      p.position.y = 2.2;
      g.add(p);
      return g;
    }
    case "BURGER": {
      B.geo("plain", GEO.cyl24, 0, 0.35, 0, "#d9933d", 0, 0, 0, 2, 0.7, 2);
      B.geo("plain", GEO.cyl24, 0, 0.95, 0, "#5a2e1a", 0, 0, 0, 2.2, 0.55, 2.2);
      B.box("plain", 3.5, 0.12, 3.5, 0, 1.3, 0, "#ffc928", 0, Math.PI / 4, 0);
      B.geo("plain", GEO.cyl24, 0, 1.45, 0, "#e04a3a", 0, 0, 0, 1.95, 0.2, 1.95);
      B.geo("leaf", GEO.cyl24, 0, 1.62, 0, "#6abf3a", 0, 0, 0, 2.3, 0.14, 2.3);
      B.geo("plain", halfSphere, 0, 1.7, 0, "#e09a45", 0, 0, 0, 2.05, 1.5, 2.05);
      for (let i = 0; i < 18; i++) {
        const a = Math.random() * Math.PI * 2;
        const e = 0.2 + Math.random() * 1.0;
        const rr = 2.05 * Math.cos(e);
        B.geo("plain", GEO.sphere, Math.cos(a) * rr, 1.7 + 1.5 * Math.sin(e), Math.sin(a) * rr, "#fff6dc", 0, a, 0, 0.12, 0.06, 0.2);
      }
      break;
    }
    case "SUSHI": {
      const cap = new THREE.CapsuleGeometry(0.8, 1.6, 6, 16);
      B.geo("plain", cap, -1.2, 0.8, 0, "#f7f5ee", 0, 0, Math.PI / 2, 1, 1, 0.9);
      B.box("plain", 2.9, 0.35, 1.6, -1.2, 1.65, 0, "#ff8a5c");
      for (let i = 0; i < 4; i++) B.box("plain", 0.12, 0.37, 1.62, -2.2 + i * 0.65, 1.66, 0, "#ffd2bd", 0, 0, 0.3);
      B.geo("plain", GEO.cyl24, 1.5, 0.75, 0, "#1f2a1f", 0, 0, 0, 1.05, 1.5, 1.05);
      B.geo("plain", GEO.cyl24, 1.5, 0.76, 0, "#f7f5ee", 0, 0, 0, 0.9, 1.52, 0.9);
      B.geo("plain", GEO.cyl16, 1.5, 0.77, 0, "#ff6f61", 0, 0, 0, 0.4, 1.54, 0.4);
      B.geo("leaf", GEO.cyl16, 1.65, 0.77, 0.2, "#7cc576", 0, 0, 0, 0.18, 1.55, 0.18);
      break;
    }
    case "DÖNER": {
      B.geo("chrome", GEO.cyl8, 0, 2.5, 0, "#cccccc", 0, 0, 0, 0.08, 5, 0.08);
      const cone = new THREE.CylinderGeometry(1.5, 1.0, 3.4, 12);
      B.geo("leaf", cone, 0, 2.4, 0, "#8b4a2b");
      for (let i = 0; i < 6; i++) B.geo("leaf", GEO.cyl16, 0, 1.0 + i * 0.55, 0, i % 2 ? "#a65d33" : "#6e3a1f", 0, 0, 0, 1.08 + i * 0.08, 0.12, 1.08 + i * 0.08);
      B.geo("chrome", GEO.cyl16, 0, 4.2, 0, "#cccccc", 0, 0, 0, 0.6, 0.1, 0.6);
      B.geo("chrome", GEO.cyl16, 0, 0.6, 0, "#cccccc", 0, 0, 0, 1.6, 0.1, 1.6);
      break;
    }
    case "TACOS": {
      const shell = new THREE.CylinderGeometry(1.8, 1.8, 3.6, 24, 1, true, Math.PI / 2, Math.PI);
      const p = new Builder();
      p.geo("plain", shell, 0, 0, 0, "#f2c14e", 0, 0, Math.PI / 2);
      for (let i = 0; i < 14; i++) {
        const x = (Math.random() - 0.5) * 3;
        const c = ["#4caf50", "#e53935", "#7b4a2a", "#ffeb3b"][i % 4];
        p.geo("leaf", GEO.ico0, x, 1.1 + Math.random() * 0.4, (Math.random() - 0.5) * 1.5, c, 0, 0, 0, 0.45, 0.45, 0.45);
      }
      const t = p.buildGroup();
      (t.children as THREE.Mesh[]).forEach((m) => {
        const mat = (m.material as THREE.Material).clone();
        mat.side = THREE.DoubleSide;
        m.material = mat;
      });
      t.position.y = 1.9;
      t.rotation.z = Math.PI;
      t.rotation.x = 0;
      g.add(t);
      return g;
    }
    case "NUDELN":
    case "CURRY": {
      const curry = name === "CURRY";
      B.geo("plain", bowl, 0, 2, 0, curry ? "#f5f5f5" : "#e53935", 0, 0, 0, 2.2, 1.8, 2.2);
      B.geo("plain", GEO.cyl24, 0, 0.25, 0, curry ? "#dddddd" : "#b71c1c", 0, 0, 0, 1, 0.4, 1);
      B.geo("plain", GEO.cyl24, 0, 1.95, 0, curry ? "#e0a526" : "#f5deb3", 0, 0, 0, 2.05, 0.1, 2.05);
      if (curry) {
        B.geo("plain", halfSphere, -0.6, 1.95, 0, "#ffffff", 0, 0, 0, 1.1, 0.8, 1.1);
        for (let i = 0; i < 6; i++) B.geo("plain", GEO.ico0, 0.8 + Math.random() * 0.6, 2.05, (Math.random() - 0.5) * 2, "#c0752a", 0, 0, 0, 0.3, 0.3, 0.3);
      } else {
        for (let i = 0; i < 10; i++)
          B.geo("plain", GEO.torusWheel, (Math.random() - 0.5) * 2, 2.05, (Math.random() - 0.5) * 2, "#f0c96a", Math.PI / 2, 0, 0, 0.35, 0.35, 0.35);
        B.geo("plain", GEO.cyl16, 0.6, 2.1, 0.6, "#ffffff", Math.PI / 2, 0, 0, 0.5, 0.1, 0.5);
        B.geo("leaf", GEO.ico0, -0.7, 2.1, 0.4, "#4caf50", 0, 0, 0, 0.35, 0.2, 0.35);
      }
      B.box("wood", 0.12, 0.12, 4.5, 0.4, 3.2, 0, "#c49a6c", 0.6, 0.3, 0);
      B.box("wood", 0.12, 0.12, 4.5, 0.75, 3.2, 0, "#c49a6c", 0.6, 0.3, 0);
      break;
    }
    case "EIS": {
      const cone = new THREE.ConeGeometry(1.1, 3.2, 16);
      B.geo("plain", cone, 0, 1.6, 0, "#d9a066", Math.PI, 0, 0);
      B.geo("plain", GEO.sphere, 0, 3.4, 0, "#ff8fb1", 0, 0, 0, 1.25, 1.15, 1.25);
      B.geo("plain", GEO.sphere, 0, 4.7, 0, "#9be3c4", 0, 0, 0, 1.1, 1.0, 1.1);
      B.geo("plain", GEO.sphere, 0, 5.85, 0, "#6d3b1f", 0, 0, 0, 0.9, 0.8, 0.9);
      B.geo("paintGloss", GEO.sphere, 0.2, 6.75, 0, "#d50000", 0, 0, 0, 0.32, 0.32, 0.32);
      break;
    }
    case "BÄCKER": {
      const cr = new THREE.TorusGeometry(1.5, 0.75, 12, 24, Math.PI * 1.25);
      B.geo("plain", cr, 0, 2.2, 0, "#d99a3d");
      for (let i = 0; i < 5; i++) {
        const a = (i / 4) * Math.PI * 1.25;
        B.geo("plain", GEO.torusWheel, Math.cos(a) * 1.5, 2.2 + Math.sin(a) * 1.5, 0, "#b8741f", 0, Math.PI / 2, 0, 0.62, 0.62, 0.3);
      }
      break;
    }
    case "SALAT": {
      B.geo("wood", bowl, 0, 1.8, 0, "#b07a45", 0, 0, 0, 2.3, 1.6, 2.3);
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2;
        const rr = Math.random() * 1.8;
        const c = i % 5 === 0 ? "#e53935" : i % 7 === 0 ? "#ffd54f" : ["#4caf50", "#7cb342", "#2e7d32"][i % 3];
        B.geo("leaf", GEO.ico0, Math.cos(a) * rr, 1.9 + Math.random() * 0.5, Math.sin(a) * rr, c, Math.random(), Math.random(), 0, 0.5, 0.35, 0.5);
      }
      break;
    }
    case "POMMES": {
      const boxGeo = new THREE.CylinderGeometry(1.5, 1.0, 2.4, 4);
      B.geo("plain", boxGeo, 0, 1.2, 0, "#d62828", 0, Math.PI / 4, 0);
      B.box("plain", 1.5, 0.3, 0.05, 0, 1.5, 1.07, "#ffd23f");
      for (let i = 0; i < 22; i++) {
        const x = (Math.random() - 0.5) * 1.6;
        const z = (Math.random() - 0.5) * 1.6;
        B.box("plain", 0.24, 2.4 + Math.random() * 0.8, 0.24, x, 3.0, z, "#ffcf40", (Math.random() - 0.5) * 0.4, 0, (Math.random() - 0.5) * 0.4);
      }
      break;
    }
    case "WOK": {
      const boxGeo = new THREE.CylinderGeometry(1.6, 1.15, 2.6, 4);
      B.geo("plain", boxGeo, 0, 1.3, 0, "#f5f5f5", 0, Math.PI / 4, 0);
      B.box("plain", 2.0, 0.6, 0.05, 0, 1.4, 0.93, "#d32f2f");
      for (let i = 0; i < 8; i++)
        B.geo("plain", GEO.torusWheel, (Math.random() - 0.5) * 1.4, 2.65, (Math.random() - 0.5) * 1.4, "#f0c96a", Math.PI / 2, 0, 0, 0.3, 0.3, 0.3);
      B.box("wood", 0.1, 3.5, 0.1, 0.3, 3.4, 0.1, "#c49a6c", 0, 0, 0.25);
      B.box("wood", 0.1, 3.5, 0.1, 0.55, 3.4, -0.1, "#c49a6c", 0, 0, 0.32);
      break;
    }
    default: {
      B.geo("plain", GEO.sphere, 0, 2, 0, "#ff9800", 0, 0, 0, 1.5, 1.5, 1.5);
    }
  }
  g.add(B.buildGroup());
  return g;
}
