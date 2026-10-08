// ═══════════════════════════════════════════════════════════════════════════
// DAS 3D-GLAS IM HERO DES FIRMENANGEBOTS (E-301) — three.js, eigener Chunk
//
// Wird von ProduktGlas3D per import() nachgeladen; ohne WebGL oder bei
// „weniger Bewegung“ lädt die Seite diese Datei gar nicht (Rückfall: das echte
// Produktfoto). Proportionen wie auf dem Produktfoto: kurzes, breites
// Schraubglas, Körper etwa so hoch wie breit, Deckel ein Viertel davon.
//
//   Glas      LatheGeometry (gerundeter Boden, Schulter, Hals mit Gewindeansatz,
//             gerundeter Rand), MeshPhysicalMaterial mit transmission, ior 1.5
//   Inhalt    eigene Lathe knapp innen, Farbe aus glas.inhalt, Körnung aus einer
//             erzeugten Textur (feine helle und dunkle Kerne)
//   Etikett   Zylindersegment knapp außen, echte Etikett-Textur (sRGB), Bogen
//             und Höhe aus etikettVerhaeltnis
//   Deckel    gebürstetes Metall (metalness 1, roughness ~0.35, Anisotropie und
//             eine erzeugte Ring-Bürstung als roughness-/bumpMap)
//   Umgebung  RoomEnvironment über PMREM, warmes Führungslicht, kühles Kantenlicht
//
// Runde 2 (Justin 08.10.2026, Punkt 1): realistischer, etwas kleiner, flüssiger —
//   Glas      echte Wandstärke mit Brechung (transmission, thickness, ior 1,5,
//             leichte Eigenfarbe über attenuation), Kantenglanz als Fresnel-Saum,
//             Kontaktschatten (enger dunkler Kern + weicher Hof)
//   Etikett   plan auf dem Glas, Papierstruktur (Fasern als bump/roughness)
//   Inhalt    mit Tiefe: Verlauf von unten dunkel nach oben warm, Kerne und
//             Glanz wie eine feuchte Oberfläche
//   Deckel    gerändelter Rand mit Gewindekante (eigener Wulst), weiche Bürstung
//   Bewegung  gedämpfte Feder (kritisch gedämpft) statt Sprüngen, ~17 % kleiner
//             im Bild, Licht dezenter (keine Lichtsäule), Goldpartikel feiner und
//             weniger
// Der Zustand ergibt sich NUR aus dem Scroll-Fortschritt p (0…1): Deckel dreht
// in ~1¼ Umdrehungen auf und hebt ab, warmes Licht und feine Partikel steigen aus
// dem Glas, die Kamera fährt heran. Gerendert wird bei jedem setzen(p) und bei
// Größenänderung; der rAF-Takt läuft nur, solange das Glas im Bild und der Tab
// sichtbar ist (sanftes Nachziehen, Funkeln). In einem versteckten Tab ruht rAF —
// dann rendert setzen() direkt den Zielzustand.
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { GlasKonfig } from "@shared/fiaon-global-angebot-firma-typen";

export interface GlasSzene {
  /** Scroll-Fortschritt 0…1 setzen; rendert sofort, wenn kein Takt läuft. */
  setzen(p: number): void;
  /** Wo das Glas im Bild steht (NDC −1…1) — vom Layout gesteuert (Rechner: rechts, Handy: unten). */
  lage(sx0: number, sy0: number, sx1: number, sy1: number): void;
  zeiger(nx: number, ny: number): void;
  groesse(): void;
  takt(an: boolean): void;
  dispose(): void;
}

const glatt = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Ein Kreis-Verlauf als Textur (Schein, Partikel, Schatten). */
function verlauf(stops: [number, string][], groesse = 128): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = c.height = groesse;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(groesse / 2, groesse / 2, 0, groesse / 2, groesse / 2, groesse / 2);
  for (const [o, f] of stops) g.addColorStop(o, f);
  x.fillStyle = g; x.fillRect(0, 0, groesse, groesse);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Körnung des Inhalts: Grundfarbe mit feinem Rauschen und Kernen. */
function koernung(farbe: string): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const n = 512;
  const c = document.createElement("canvas"); c.width = c.height = n;
  const x = c.getContext("2d")!;
  x.fillStyle = farbe; x.fillRect(0, 0, n, n);
  const bild = x.getImageData(0, 0, n, n);
  for (let i = 0; i < bild.data.length; i += 4) {
    const r = (Math.random() - 0.5) * 18;
    bild.data[i] += r; bild.data[i + 1] += r * 0.8; bild.data[i + 2] += r * 0.6;
  }
  x.putImageData(bild, 0, 0);
  const b = document.createElement("canvas"); b.width = b.height = n;
  const y = b.getContext("2d")!;
  y.fillStyle = "#808080"; y.fillRect(0, 0, n, n);
  for (let i = 0; i < 2600; i++) {
    const px = Math.random() * n, py = Math.random() * n, rr = 0.6 + Math.random() * 1.8;
    const hell = Math.random() < 0.55;
    x.fillStyle = hell ? `rgba(150,96,52,${0.35 + Math.random() * 0.4})` : `rgba(8,3,2,${0.4 + Math.random() * 0.4})`;
    x.beginPath(); x.ellipse(px, py, rr, rr * (0.6 + Math.random() * 0.5), Math.random() * 3, 0, Math.PI * 2); x.fill();
    y.fillStyle = hell ? "#c8c8c8" : "#505050";
    y.beginPath(); y.arc(px, py, rr, 0, Math.PI * 2); y.fill();
  }
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(4, 2);
  const bump = new THREE.CanvasTexture(b); bump.wrapS = bump.wrapT = THREE.RepeatWrapping; bump.repeat.copy(map.repeat);
  return { map, bump };
}

/** Bürstung des Deckels: jede Zeile (entlang des Profils) eine eigene Helligkeit — auf der Lathe werden das feine Ringe.
 *  1024 × 1024, damit rundherum keine Blöcke sichtbar werden. */
function buerstung(): THREE.CanvasTexture {
  const n = 1024;
  const c = document.createElement("canvas"); c.width = c.height = n;
  const x = c.getContext("2d")!;
  const bild = x.createImageData(n, n);
  let zeile = 180;
  for (let j = 0; j < n; j++) {
    // Riefen: jede Zeile eine eigene Helligkeit, entlang der Zeile gleich (Ringe ohne Körnung quer dazu). Weniger
    // Glättung zwischen den Zeilen als vorher: Riefen statt eines verwischten Graus (Gutachten 07.10.2026).
    // Runde 2: weichere Bürstung — feine Riefen mit kleinerem Ausschlag, gleitend ineinander.
    zeile = zeile * 0.62 + (168 + Math.random() * 62) * 0.38 + (Math.random() < 0.02 ? 14 : 0);
    for (let i = 0; i < n; i++) {
      const v = Math.max(0, Math.min(255, zeile));
      const k = (j * n + i) * 4;
      bild.data[k] = bild.data[k + 1] = bild.data[k + 2] = v; bild.data[k + 3] = 255;
    }
  }
  x.putImageData(bild, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Papierstruktur des Etiketts: feine Fasern und Körnung — als bump- und roughness-Karte (grau, kachelbar). */
function papier(): THREE.CanvasTexture {
  const n = 512;
  const c = document.createElement("canvas"); c.width = c.height = n;
  const x = c.getContext("2d")!;
  const bild = x.createImageData(n, n);
  for (let i = 0; i < n * n; i++) { const v = 128 + (Math.random() - 0.5) * 34; bild.data[i * 4] = bild.data[i * 4 + 1] = bild.data[i * 4 + 2] = v; bild.data[i * 4 + 3] = 255; }
  x.putImageData(bild, 0, 0);
  x.globalAlpha = 0.16; x.lineWidth = 0.6;
  for (let i = 0; i < 1400; i++) {
    const px = Math.random() * n, py = Math.random() * n, l = 4 + Math.random() * 14, w = Math.random() * Math.PI;
    x.strokeStyle = Math.random() < 0.5 ? "#ffffff" : "#000000";
    x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + Math.cos(w) * l * 0.5 + 2, py + Math.sin(w) * l * 0.5, px + Math.cos(w) * l, py + Math.sin(w) * l); x.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3);
  return t;
}
/** Rändelung des Deckelrands: senkrechte feine Rippen (entlang des Umfangs u wiederholt). */
function raendel(): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = 64; c.height = 8;
  const x = c.getContext("2d")!;
  const g = x.createLinearGradient(0, 0, 64, 0);
  g.addColorStop(0, "#9a9a9a"); g.addColorStop(0.4, "#c8c8c8"); g.addColorStop(0.5, "#d6d6d6"); g.addColorStop(0.6, "#c4c4c4"); g.addColorStop(1, "#9a9a9a");
  x.fillStyle = g; x.fillRect(0, 0, 64, 8);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(260, 1);
  return t;
}

/** Profilpunkte mit gerundeter Ecke (Viertelkreis von a nach b um Mittelpunkt m). */
function bogen(pts: THREE.Vector2[], mx: number, my: number, r: number, von: number, bis: number, schritte = 8) {
  for (let i = 0; i <= schritte; i++) { const w = von + ((bis - von) * i) / schritte; pts.push(new THREE.Vector2(mx + Math.cos(w) * r, my + Math.sin(w) * r)); }
}

const DECKEL_FARBE: Record<GlasKonfig["deckel"], number> = { silber: 0xc3c7cd, gold: 0xd9b45a, schwarz: 0x1c1d20 };

export async function glasSzeneBauen(canvas: HTMLCanvasElement, glas: GlasKonfig, handy: boolean): Promise<GlasSzene> {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, handy ? 1.5 : 2));

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const raum = new RoomEnvironment();
  const umgebung = pmrem.fromScene(raum, 0.035).texture;
  scene.environment = umgebung;
  scene.environmentIntensity = 0.8;

  const kamera = new THREE.PerspectiveCamera(26, 1, 0.1, 60);

  // Licht: warm von links vorn, kühl von rechts hinten (Kantenlicht), Gold aus dem Glas — dezent (Runde 2: kein greller Kegel).
  const fuehrung = new THREE.DirectionalLight(0xffe8c8, 2.0); fuehrung.position.set(-4, 6, 5); scene.add(fuehrung);
  const kante = new THREE.DirectionalLight(0xd2e0ff, 1.9); kante.position.set(5, 3.5, -4); scene.add(kante);
  const fuell = new THREE.DirectionalLight(0xffffff, 0.35); fuell.position.set(2, 1, 6); scene.add(fuell);
  const gold = new THREE.PointLight(0xffc766, 0, 5, 1.8); gold.position.set(0, 2.0, 0.2); scene.add(gold);

  const glasGruppe = new THREE.Group(); scene.add(glasGruppe);
  const wegwerfen: { dispose(): void }[] = [umgebung, pmrem];

  // ── Glas: geschlossenes Profil (außen hoch, innen runter), Maße in Radien ──
  const aussen: THREE.Vector2[] = [new THREE.Vector2(0, 0)];
  bogen(aussen, 0.86, 0.14, 0.14, -Math.PI / 2, 0);              // Boden → Wand
  aussen.push(new THREE.Vector2(1.0, 1.36));
  bogen(aussen, 0.9, 1.36, 0.1, 0, Math.PI / 2 * 0.7, 6);       // Schulter
  aussen.push(new THREE.Vector2(0.952, 1.5), new THREE.Vector2(0.952, 1.71));
  bogen(aussen, 0.932, 1.71, 0.02, 0, Math.PI, 6);               // Rand
  // Runde 2: ein dicker Glasboden (wie bei echten Gläsern) — unten steht ein klarer Streifen Glas unter dem Inhalt.
  aussen.push(new THREE.Vector2(0.912, 1.5), new THREE.Vector2(0.958, 1.4), new THREE.Vector2(0.962, 0.27));
  bogen(aussen, 0.84, 0.27, 0.122, 0, -Math.PI / 2, 8);
  aussen.push(new THREE.Vector2(0, 0.148));
  const glasGeo = new THREE.LatheGeometry(aussen, 128);
  // Echtes Glas: Brechung über die Wandstärke (thickness), Eigenfarbe nur im Dicken (attenuation — ein Hauch Grün wie Flaschenglas),
  // glatte, harte Spiegelung. Die Brechung zeigt den Inhalt und das Papier dahinter leicht versetzt.
  const glasMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: 0.015, transmission: 1, thickness: 0.32, ior: 1.52,
    attenuationColor: new THREE.Color(0xe4efe8), attenuationDistance: 1.6, dispersion: 0.15,
    clearcoat: 1, clearcoatRoughness: 0.02, specularIntensity: 1, specularColor: new THREE.Color(0xffffff), envMapIntensity: 1.2, transparent: true,
  });
  const glasMesh = new THREE.Mesh(glasGeo, glasMat); glasMesh.renderOrder = 2; glasGruppe.add(glasMesh);
  wegwerfen.push(glasGeo, glasMat);

  // Gewindeansatz: zwei Gänge als Röhre auf dem Hals
  const wendel: THREE.Vector3[] = [];
  for (let i = 0; i <= 160; i++) { const t = i / 160; const w = t * Math.PI * 2 * 1.6; wendel.push(new THREE.Vector3(Math.sin(w) * 0.962, 1.53 + t * 0.13, Math.cos(w) * 0.962)); }
  const gewindeGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(wendel), 240, 0.011, 6, false);
  const gewinde = new THREE.Mesh(gewindeGeo, glasMat); gewinde.renderOrder = 2; glasGruppe.add(gewinde);
  wegwerfen.push(gewindeGeo);

  // Kantenglanz: ein hauchdünner Saum über dem Glas, der nur zur Silhouette hin aufleuchtet (Fresnel) — wie Licht auf der Glaskante.
  const saumMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: "varying float vF; varying float vY; void main(){ vec3 n = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vF = 1.0 - abs(dot(n, normalize(-mv.xyz))); vY = position.y; gl_Position = projectionMatrix * mv; }",
    fragmentShader: "varying float vF; varying float vY; void main(){ float f = pow(vF, 3.2); float oben = smoothstep(1.2, 1.72, vY) * 0.6; gl_FragColor = vec4(vec3(1.0, 0.985, 0.95), (f * 0.55 + oben * f) * 0.9); }",
  });
  const saumProfil = aussen.slice(0, aussen.findIndex((v) => v.y >= 1.71) + 1);
  const saumGeo = new THREE.LatheGeometry(saumProfil.map((v) => new THREE.Vector2(v.x * 1.004, v.y)), 128);
  const saum = new THREE.Mesh(saumGeo, saumMat); saum.renderOrder = 7; glasGruppe.add(saum);
  wegwerfen.push(saumMat, saumGeo);

  // ── Inhalt ──
  const inhaltProfil = [new THREE.Vector2(0, 0.155), new THREE.Vector2(0.84, 0.155)];
  bogen(inhaltProfil, 0.84, 0.27, 0.115, -Math.PI / 2, 0, 6);
  // Die Wand in gleichmäßigen Schritten — sonst verzerrt die Lathe-UV (v je Punkt) die Körnung zu Streifen.
  for (let y = 0.31; y < 1.39; y += 0.04) inhaltProfil.push(new THREE.Vector2(0.955, y));
  inhaltProfil.push(new THREE.Vector2(0.955, 1.39), new THREE.Vector2(0.906, 1.48), new THREE.Vector2(0.906, 1.57), new THREE.Vector2(0.6, 1.585), new THREE.Vector2(0, 1.595));
  const inhaltGeo = new THREE.LatheGeometry(inhaltProfil, 96);
  // Tiefe: unten dunkel, zur Oberfläche hin wärmer und heller (Licht dringt oben ein) — als Farbe je Punkt, mit der Körnung multipliziert.
  {
    const posA = inhaltGeo.attributes.position; const farben = new Float32Array(posA.count * 3);
    for (let i = 0; i < posA.count; i++) {
      const y = posA.getY(i); const t = Math.min(1, Math.max(0, (y - 0.15) / 1.44));
      const k = 0.58 + 0.42 * Math.pow(t, 1.4);
      farben[i * 3] = k * 1.04; farben[i * 3 + 1] = k * 0.97; farben[i * 3 + 2] = k * 0.9;
    }
    inhaltGeo.setAttribute("color", new THREE.BufferAttribute(farben, 3));
  }
  const korn = koernung(glas.inhalt || "#2a140f");
  const inhaltMat = new THREE.MeshPhysicalMaterial({ color: 0xd8ccc2, vertexColors: true, map: korn.map, bumpMap: korn.bump, bumpScale: 0.6, roughness: 0.32, clearcoat: 0.85, clearcoatRoughness: 0.16, sheen: 0.25, sheenColor: new THREE.Color(0x6b3a22), sheenRoughness: 0.6 });
  const inhalt = new THREE.Mesh(inhaltGeo, inhaltMat); inhalt.renderOrder = 1; glasGruppe.add(inhalt);
  wegwerfen.push(inhaltGeo, inhaltMat, korn.map, korn.bump);

  // Leuchtende Oberfläche des Inhalts (Gold, wächst mit dem Öffnen)
  const glutTex = verlauf([[0, "rgba(255,226,150,1)"], [0.45, "rgba(232,182,84,.75)"], [1, "rgba(184,137,46,0)"]], 256);
  const glutMat = new THREE.MeshBasicMaterial({ map: glutTex, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  const glut = new THREE.Mesh(new THREE.CircleGeometry(0.9, 64), glutMat); glut.rotation.x = -Math.PI / 2; glut.position.y = 1.6; glasGruppe.add(glut);
  wegwerfen.push(glutTex, glutMat, glut.geometry);

  // ── Etikett ──
  const loader = new THREE.TextureLoader();
  const etikettTex = await loader.loadAsync(glas.etikett).catch(() => null);
  if (etikettTex) {
    etikettTex.colorSpace = THREE.SRGBColorSpace;
    etikettTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const verh = glas.etikettVerhaeltnis > 0.3 && glas.etikettVerhaeltnis < 4 ? glas.etikettVerhaeltnis : 1.34;
    const r = 1.003, bogenW = 1.5;
    const hoehe = Math.min(1.15, (r * bogenW) / verh);
    const etGeo = new THREE.CylinderGeometry(r, r, hoehe, 64, 1, true, -bogenW / 2, bogenW);
    // Papier: feine Fasern als bump und roughness — das Etikett ist matt und liegt plan auf dem Glas (Radius knapp über der Wand).
    const faser = papier();
    const etMat = new THREE.MeshPhysicalMaterial({ map: etikettTex, roughness: 0.72, roughnessMap: faser, bumpMap: faser, bumpScale: 0.35, clearcoat: 0.08, clearcoatRoughness: 0.5, sheen: 0.3, sheenRoughness: 0.8, sheenColor: new THREE.Color(0xffffff), side: THREE.FrontSide,
      // transparent: Das Etikett gehört nicht in den Brechungs-Durchgang des Glases (sonst sähe man es ein zweites Mal versetzt hinter der Wand).
      transparent: true });
    const et = new THREE.Mesh(etGeo, etMat); et.position.y = 0.78; et.renderOrder = 3; glasGruppe.add(et);
    wegwerfen.push(etikettTex, etGeo, etMat, faser);
  }

  // ── Deckel ──
  const dProfil: THREE.Vector2[] = [];
  for (let i = 0; i <= 24; i++) dProfil.push(new THREE.Vector2((0.985 * i) / 24, 0.36));
  bogen(dProfil, 0.985, 0.31, 0.05, Math.PI / 2, 0, 8);
  dProfil.push(new THREE.Vector2(1.035, 0.05));
  bogen(dProfil, 1.005, 0.05, 0.03, 0, -Math.PI / 2, 5);
  dProfil.push(new THREE.Vector2(0.975, 0.02), new THREE.Vector2(0.975, 0.33), new THREE.Vector2(0, 0.33));
  const deckelGeo = new THREE.LatheGeometry(dProfil, 128);
  const buerste = buerstung();
  buerste.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const deckelMat = new THREE.MeshPhysicalMaterial({
    color: DECKEL_FARBE[glas.deckel] ?? DECKEL_FARBE.silber, metalness: 1, roughness: 0.3, roughnessMap: buerste,
    // Die Bürstung trägt allein die Rauheitskarte (keine Bump-Map mehr).
    clearcoat: 0.2, clearcoatRoughness: 0.3, envMapIntensity: 0.95,
    // Transparent, damit der Deckel am Ende im Licht ausblenden kann. Keine Anisotropie: Mit anisotropy 0,7 zeigte der
    // Deckelrand im Test (Chrome, Metal) blockige Spiegelungen der Umgebung — die Riefen der Rauheitskarte reichen.
    transparent: true,
  });
  const deckel = new THREE.Mesh(deckelGeo, deckelMat);
  const deckelDreh = new THREE.Group(); deckelDreh.add(deckel); glasGruppe.add(deckelDreh);
  wegwerfen.push(deckelGeo, deckelMat, buerste);
  // Gerändelter Rand: ein offener Zylinder knapp außen auf der Seitenwand mit feinen senkrechten Rippen (bump + roughness).
  const rippe = raendel();
  const randMat = new THREE.MeshPhysicalMaterial({
    color: DECKEL_FARBE[glas.deckel] ?? DECKEL_FARBE.silber, metalness: 1, roughness: 0.36, roughnessMap: rippe, bumpMap: rippe, bumpScale: 0.35,
    clearcoat: 0.15, clearcoatRoughness: 0.35, envMapIntensity: 0.9, transparent: true,
  });
  const randGeo = new THREE.CylinderGeometry(1.037, 1.037, 0.2, 160, 1, true);
  const rand = new THREE.Mesh(randGeo, randMat); rand.position.y = 0.185; deckelDreh.add(rand);
  // Gewindekante: ein feiner gerollter Wulst am unteren Rand des Deckels.
  const wulstGeo = new THREE.TorusGeometry(1.012, 0.022, 10, 160);
  const wulst = new THREE.Mesh(wulstGeo, randMat); wulst.rotation.x = Math.PI / 2; wulst.position.y = 0.04; deckelDreh.add(wulst);
  wegwerfen.push(rippe, randMat, randGeo, wulstGeo);
  const DECKEL_Y = 1.45;

  // ── Licht aus dem Glas: Schein, Lichtsäule, Partikel ──
  const scheinTex = verlauf([[0, "rgba(255,236,190,.95)"], [0.3, "rgba(240,200,110,.55)"], [0.7, "rgba(217,180,90,.12)"], [1, "rgba(217,180,90,0)"]], 256);
  const scheinMat = new THREE.SpriteMaterial({ map: scheinTex, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  const schein = new THREE.Sprite(scheinMat); schein.position.set(0, 2.2, 0); schein.renderOrder = 5; glasGruppe.add(schein);
  wegwerfen.push(scheinTex, scheinMat);

  // Lichtsäule: offener Kegel, Deckkraft unten hoch, oben null, und zur Silhouette hin weich (Fresnel) — keine harten Kanten.
  const saeuleMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uDeck: { value: 0 } },
    vertexShader: "varying vec2 vUv; varying float vKante; void main(){ vUv = uv; vec3 n = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vKante = abs(dot(n, normalize(-mv.xyz))); gl_Position = projectionMatrix * mv; }",
    fragmentShader: "uniform float uDeck; varying vec2 vUv; varying float vKante; void main(){ float hoch = pow(1.0 - vUv.y, 1.6); float weich = pow(vKante, 1.3); vec3 f = mix(vec3(0.98, 0.84, 0.52), vec3(1.0, 0.95, 0.80), vUv.y); gl_FragColor = vec4(f, 0.85 * hoch * weich * uDeck); }",
  });
  // uv.y = 1 oben in der CylinderGeometry → hoch = (1 - y) ist unten stark.
  const saeuleGeo = new THREE.CylinderGeometry(1.6, 0.88, 3.6, 64, 1, true);
  const saeule = new THREE.Mesh(saeuleGeo, saeuleMat); saeule.position.y = 1.6 + 1.8; saeule.renderOrder = 4; glasGruppe.add(saeule);
  // Runde 2: kein greller Kegel — die Säule bleibt nur als Hauch (siehe zeichnen: höchstens ein Viertel der früheren Deckkraft).
  wegwerfen.push(saeuleMat, saeuleGeo);

  // Partikel: eigene Punkte mit Deckkraft je Teilchen (steigen, funkeln, verblassen oben) — goldene Perlen mit hellem Kern,
  // normal gemischt, damit sie auch auf hellem Papier sichtbar sind.
  // Runde 2: feiner und weniger.
  const N = handy ? 64 : 110;
  const pos = new Float32Array(N * 3), alpha = new Float32Array(N), groessen = new Float32Array(N);
  const keim = Array.from({ length: N }, () => ({ w: Math.random() * Math.PI * 2, r: Math.sqrt(Math.random()) * 0.82, s: 0.5 + Math.random(), ph: Math.random(), sw: Math.random() * 6 }));
  keim.forEach((_, i) => { groessen[i] = 0.32 + Math.random() * 0.6; });
  const partGeo = new THREE.BufferGeometry();
  partGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  partGeo.setAttribute("alpha", new THREE.BufferAttribute(alpha, 1));
  partGeo.setAttribute("groesse", new THREE.BufferAttribute(groessen, 1));
  const partMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uDeck: { value: 0 }, uPunkt: { value: 1 } },
    vertexShader: "attribute float alpha; attribute float groesse; uniform float uPunkt; varying float vA; void main(){ vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = groesse * uPunkt / -mv.z; gl_Position = projectionMatrix * mv; }",
    fragmentShader: "uniform float uDeck; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; if (d > 1.0) discard; float kern = smoothstep(0.5, 0.0, d); float hof = smoothstep(1.0, 0.15, d); vec3 f = mix(vec3(0.78, 0.56, 0.16), vec3(1.0, 0.97, 0.86), kern); gl_FragColor = vec4(f, hof * vA * uDeck); }",
  });
  const partikel = new THREE.Points(partGeo, partMat); partikel.renderOrder = 6; glasGruppe.add(partikel);
  wegwerfen.push(partGeo, partMat);

  // Schatten in zwei Lagen (Runde 2): ein enger, dunkler Kontaktschatten genau unter dem Boden (wo Glas den Tisch berührt) und ein
  // weicher, breiter Hof, leicht vom Führungslicht weg versetzt. Beide liegen auf dem Boden und drehen nicht mit dem Glas.
  const kontaktTex = verlauf([[0, "rgba(18,12,6,.62)"], [0.62, "rgba(18,12,6,.5)"], [0.8, "rgba(18,12,6,.16)"], [1, "rgba(18,12,6,0)"]], 256);
  const kontaktMat = new THREE.MeshBasicMaterial({ map: kontaktTex, transparent: true, depthWrite: false, toneMapped: false });
  const kontakt = new THREE.Mesh(new THREE.PlaneGeometry(2.08, 2.08), kontaktMat); kontakt.rotation.x = -Math.PI / 2; kontakt.position.y = 0.003; scene.add(kontakt);
  const schattenTex = verlauf([[0, "rgba(20,14,8,.26)"], [0.45, "rgba(20,14,8,.12)"], [1, "rgba(20,14,8,0)"]], 256);
  const schattenMat = new THREE.MeshBasicMaterial({ map: schattenTex, transparent: true, depthWrite: false, toneMapped: false });
  const schatten = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 3.4), schattenMat); schatten.rotation.x = -Math.PI / 2; schatten.position.set(0.42, 0.002, -0.32); scene.add(schatten);
  wegwerfen.push(kontaktTex, kontaktMat, kontakt.geometry, schattenTex, schattenMat, schatten.geometry);

  // ── Zustand ──
  let ziel = 0, gezeigt = 0, tempo = 0, nx = 0, ny = 0, zx = 0, zy = 0, letzt = 0;
  let lageWerte = handy ? [0, -0.3, 0, -0.08] : [0.42, -0.02, 0, -0.04];
  let laeuft = false, raf = 0, breite = 1, hoehe = 1;
  const t0 = performance.now();

  const groesse = () => {
    breite = canvas.clientWidth || 1; hoehe = canvas.clientHeight || 1;
    renderer.setSize(breite, hoehe, false);
    kamera.aspect = breite / hoehe; kamera.updateProjectionMatrix();
  };

  const zeichnen = () => {
    const p = gezeigt;
    const t = (performance.now() - t0) / 1000;
    const dreh = glatt(0.04, 0.4, p), heb = glatt(0.38, 0.66, p), weg = glatt(0.64, 0.92, p), licht = glatt(0.42, 0.86, p), fahrt = glatt(0.1, 0.95, p), mitte = glatt(0.3, 0.7, p);

    // Deckel: 1¼ Umdrehungen gegen den Uhrzeigersinn, dabei steigt er am Gewinde; dann hebt er ab, kippt leicht und
    // schwebt — immer im sichtbaren Kegel über dem Glas (vorher flog er nach rechts oben aus dem Bild und wurde am Handy
    // vom Rand angeschnitten). Zum Schluss blendet er im Licht aus, damit die Zeile aus dem Licht frei steht.
    deckelDreh.rotation.set(heb * 0.35, dreh * Math.PI * 2.5, handy ? 0 : -heb * 0.12);
    deckelDreh.position.set(handy ? 0 : heb * 0.15, DECKEL_Y + dreh * 0.13 + heb * 1.05 + weg * 0.45 + Math.sin(t * 1.3) * 0.015 * heb, heb * -0.15);
    // Runde 2: früher ausblenden, damit der Deckel nie über der Zeile aus dem Licht steht.
    const deckelSicht = 1 - glatt(0.6, 0.78, p);
    deckelMat.opacity = deckelSicht; randMat.opacity = deckelSicht; deckelDreh.visible = deckelSicht > 0.01;

    // Am Handy steht das Etikett im geschlossenen Zustand mittig (Drehung fast null); am Rechner die Dreiviertelansicht.
    glasGruppe.rotation.y = (handy ? -0.04 : -0.34) + p * 0.3 + zx * 0.16 + Math.sin(t * 0.5) * 0.02;
    glasGruppe.rotation.x = zy * 0.05;
    glasGruppe.position.y = 0; // Runde 2: steht auf dem Tisch (kein Schweben über dem Kontaktschatten)

    // Runde 2: Licht dezenter — warmer Schein statt Kegel, Punktlicht schwächer.
    glutMat.opacity = licht * 0.8;
    scheinMat.opacity = licht * 0.42;
    const s = 1.3 + licht * 2.4 + Math.sin(t * 1.3) * 0.04 * licht; schein.scale.set(s, s * 1.05, 1);
    schein.position.y = 1.72 + licht * 0.45;
    saeuleMat.uniforms.uDeck.value = licht * 0.22;
    saeule.scale.set(0.85, 0.3 + licht * 0.55, 0.85); saeule.position.y = 1.6 + 1.8 * (0.3 + licht * 0.55);
    gold.intensity = licht * 3.2;
    partMat.uniforms.uDeck.value = glatt(0.46, 0.78, p) * 0.9;
    partMat.uniforms.uPunkt.value = renderer.getPixelRatio() * hoehe * 0.05;
    for (let i = 0; i < N; i++) {
      const k = keim[i];
      const h = (k.ph + t * k.s * 0.09 + p * 1.2) % 1;
      const ausbreitung = 1 + h * 0.9;
      const w = k.w + h * 1.6 + Math.sin(t * 0.7 + k.sw) * 0.15;
      pos[i * 3] = Math.cos(w) * k.r * ausbreitung;
      pos[i * 3 + 1] = 1.6 + h * 3.4 * (0.35 + licht * 0.65);
      pos[i * 3 + 2] = Math.sin(w) * k.r * ausbreitung;
      alpha[i] = Math.sin(Math.PI * Math.min(1, h * 1.15)) * (0.65 + 0.35 * Math.sin(t * 3 + k.sw));
    }
    partGeo.attributes.position.needsUpdate = true;
    partGeo.attributes.alpha.needsUpdate = true;

    // Kamera: Abstand so, dass das Glas mit Deckel passt; fährt heran und hebt sich zum Licht.
    const tanH = Math.tan(THREE.MathUtils.degToRad(kamera.fov / 2));
    const dHoch = 1.55 / tanH, dBreit = 1.45 / (tanH * kamera.aspect);
    // Runde 2: das Glas etwa 17 % kleiner im Bild (Abstand × 1,2); Korrektur 08.10. (Justin: „alles ein wenig kleiner“) nochmals × 1,2.
    const d0 = Math.max(dHoch, dBreit) * (handy ? 1.62 : 1.74);
    // Die Kamera steigt und blickt ins Glas; der Abstand wächst leicht, damit Glas, Licht und Zeile ins Bild passen.
    const d = d0 * (1 + 0.16 * fahrt);
    const zielY = mix(0.95, 1.75, fahrt);
    const halbH = d * tanH, halbB = halbH * kamera.aspect;
    const lx = mix(lageWerte[0], lageWerte[2], mitte), ly = mix(lageWerte[1], lageWerte[3], mitte);
    const versatzX = -lx * halbB, versatzY = -ly * halbH;
    const hebung = mix(0.55, 1.45, fahrt);
    kamera.position.set(versatzX, zielY + hebung + versatzY, d);
    kamera.lookAt(versatzX, zielY + versatzY, 0);
    renderer.render(scene, kamera);
  };

  // Gedämpfte Feder (kritisch gedämpft, Glättezeit ~0,42 s, bildratenunabhängig): kein Sprung, kein Nachschwingen.
  const GLAETTE = 0.42;
  const schleife = (jetzt: number) => {
    raf = 0;
    if (!laeuft) return;
    const dt = Math.min(0.05, Math.max(0.001, (jetzt - (letzt || jetzt - 16)) / 1000)); letzt = jetzt;
    const w = 2 / GLAETTE, x = w * dt, e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    const diff = gezeigt - ziel, temp = (tempo + w * diff) * dt;
    tempo = (tempo - w * temp) * e;
    gezeigt = ziel + (diff + temp) * e;
    if (Math.abs(ziel - gezeigt) < 0.0002 && Math.abs(tempo) < 0.0005) { gezeigt = ziel; tempo = 0; }
    const z = 1 - Math.exp(-dt * 3.2); zx += (nx - zx) * z; zy += (ny - zy) * z;
    zeichnen();
    raf = requestAnimationFrame(schleife);
  };

  groesse();
  zeichnen();

  return {
    setzen(p) {
      ziel = Math.min(1, Math.max(0, p));
      if (!laeuft || document.visibilityState !== "visible") { gezeigt = ziel; tempo = 0; zeichnen(); }
    },
    lage(a, b, c, e) { lageWerte = [a, b, c, e]; if (!laeuft) zeichnen(); },
    zeiger(x, y) { nx = x; ny = y; },
    groesse() { groesse(); zeichnen(); },
    takt(an) {
      if (an === laeuft) return;
      laeuft = an;
      if (an && !raf) { letzt = 0; raf = requestAnimationFrame(schleife); }
      if (!an && raf) { cancelAnimationFrame(raf); raf = 0; gezeigt = ziel; tempo = 0; zeichnen(); }
    },
    dispose() {
      laeuft = false; if (raf) cancelAnimationFrame(raf);
      for (const d of wegwerfen) { try { d.dispose(); } catch { /* schon weg */ } }
      raumAufraeumen(raum);
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}

function raumAufraeumen(raum: RoomEnvironment) {
  raum.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else mat?.dispose();
  });
}
