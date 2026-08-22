import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/*
  Gemeinsame Bausteine für die 3D-Objekte der Startseite.

  - umgebungslicht(): ein vorgerechnetes Raumlicht, damit Metall und Lack
    echte Spiegelungen zeigen (ohne Bilder nachzuladen).
  - kartenTextur(): die Vorderseite der FIAON-Karte als Zeichnung — Wortmarke,
    Chip, maskierte Nummer. Wird auf einen abgerundeten Körper gelegt.
  - leuchtTextur(): weicher Lichtpunkt für Partikel und Glühen.

  Farben = bisherige CI: Blau #2563eb / #3b82f6 / #60a5fa, Tinte #0f172a.
*/

export const BLAU = "#2563eb";
export const BLAU_HELL = "#60a5fa";
export const TINTE = "#0f172a";

export function umgebungslicht(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  return tex;
}

export function leuchtTextur(farbe: string): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, farbe);
  g.addColorStop(0.35, farbe + "aa");
  g.addColorStop(1, "rgba(37,99,235,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function abgerundet(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** Vorderseite der Karte, 1024×646 (Kreditkartenformat 85,6 × 54 mm). */
export function kartenTextur(variante: "blau" | "tinte" = "blau"): THREE.Texture {
  const w = 1024, h = 646;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d")!;

  const grund = ctx.createLinearGradient(0, 0, w, h);
  if (variante === "blau") {
    grund.addColorStop(0, "#1d4ed8");
    grund.addColorStop(0.55, "#2563eb");
    grund.addColorStop(1, "#3b82f6");
  } else {
    grund.addColorStop(0, "#0b1628");
    grund.addColorStop(0.6, "#0f172a");
    grund.addColorStop(1, "#1e293b");
  }
  ctx.fillStyle = grund;
  ctx.fillRect(0, 0, w, h);

  // sanfte Lichtbahn
  const bahn = ctx.createLinearGradient(0, 0, w, h);
  bahn.addColorStop(0, "rgba(255,255,255,0)");
  bahn.addColorStop(0.45, "rgba(255,255,255,0.16)");
  bahn.addColorStop(0.55, "rgba(255,255,255,0.16)");
  bahn.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = bahn;
  ctx.fillRect(0, 0, w, h);

  // feine Linien als Struktur
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    ctx.beginPath();
    ctx.arc(w * 0.92, h * 0.15, 120 + i * 70, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Chip
  const cx = 96, cy = 230, cw = 150, ch = 112;
  const chip = ctx.createLinearGradient(cx, cy, cx + cw, cy + ch);
  chip.addColorStop(0, "#f1d27a");
  chip.addColorStop(0.5, "#d4a93c");
  chip.addColorStop(1, "#f5e0a0");
  abgerundet(ctx, cx, cy, cw, ch, 18);
  ctx.fillStyle = chip;
  ctx.fill();
  ctx.strokeStyle = "rgba(90,60,10,0.45)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, cy + ch * 0.38); ctx.lineTo(cx + cw, cy + ch * 0.38);
  ctx.moveTo(cx, cy + ch * 0.66); ctx.lineTo(cx + cw, cy + ch * 0.66);
  ctx.moveTo(cx + cw * 0.36, cy); ctx.lineTo(cx + cw * 0.36, cy + ch);
  ctx.moveTo(cx + cw * 0.64, cy); ctx.lineTo(cx + cw * 0.64, cy + ch);
  ctx.stroke();

  // Kontaktlos-Zeichen
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(300, 286, 22 + i * 18, -Math.PI / 4, Math.PI / 4);
    ctx.stroke();
  }

  // Wortmarke
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 72px Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("FIAON", 96, 132);
  ctx.font = "500 26px Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillText("BONITÄT · DACH", 100, 172);

  // Nummer (maskiert)
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = "500 54px Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillText("••••   ••••   ••••   0925", 96, 470);

  ctx.font = "500 24px Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillText("MITGLIED SEIT", 96, 545);
  ctx.fillText("GÜLTIG BIS", 330, 545);
  ctx.fillStyle = "#ffffff";
  ctx.font = "500 30px Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillText("2026", 96, 585);
  ctx.fillText("08/31", 330, 585);

  // rechts unten: Rahmen-Hinweis
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "500 24px Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillText("RAHMEN BIS", w - 96, 545);
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 36px Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillText("25.000 €", w - 96, 590);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Rückseite: Magnetstreifen + Unterschriftsfeld, schlicht. */
export function kartenRueckseite(variante: "blau" | "tinte" = "blau"): THREE.Texture {
  const w = 1024, h = 646;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = variante === "blau" ? "#1e40af" : "#0f172a";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#0b1628";
  ctx.fillRect(0, 90, w, 110);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  abgerundet(ctx, 96, 260, 620, 80, 10);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "500 24px Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillText("FIAON LTD · LONDON", 96, 560);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Abgerundete Karte mit Vorder- und Rückseite, Maße im Kreditkartenverhältnis. */
export function karteBauen(breite: number, variante: "blau" | "tinte" = "blau"): THREE.Mesh {
  const hoehe = breite * (54 / 85.6);
  const dicke = breite * 0.012;
  const geo = new RoundedBoxGeometry(breite, hoehe, dicke, 4, breite * 0.06);
  const kante = new THREE.MeshPhysicalMaterial({
    color: variante === "blau" ? "#1e40af" : "#0f172a",
    metalness: 0.85,
    roughness: 0.3,
    clearcoat: 1,
    clearcoatRoughness: 0.15,
  });
  const vorne = new THREE.MeshPhysicalMaterial({
    map: kartenTextur(variante),
    metalness: 0.55,
    roughness: 0.28,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
    envMapIntensity: 1.1,
  });
  const hinten = new THREE.MeshPhysicalMaterial({
    map: kartenRueckseite(variante),
    metalness: 0.5,
    roughness: 0.35,
    clearcoat: 0.8,
    clearcoatRoughness: 0.2,
  });
  // Der abgerundete Körper trägt die Kantenfarbe; Vorder- und Rückseite sind
  // zwei dünne Ebenen knapp davor/dahinter – so bleibt das Bild scharf.
  const mesh = new THREE.Mesh(geo, kante);
  const vorneEbene = new THREE.Mesh(new THREE.PlaneGeometry(breite * 0.985, hoehe * 0.98), vorne);
  vorneEbene.position.z = dicke / 2 + 0.0015;
  const hintenEbene = new THREE.Mesh(new THREE.PlaneGeometry(breite * 0.985, hoehe * 0.98), hinten);
  hintenEbene.position.z = -(dicke / 2 + 0.0015);
  hintenEbene.rotation.y = Math.PI;
  mesh.add(vorneEbene, hintenEbene);
  return mesh;
}
