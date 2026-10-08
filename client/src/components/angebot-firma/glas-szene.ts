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
// Der Zustand ergibt sich NUR aus dem Scroll-Fortschritt p (0…1): Deckel dreht
// in ~1¼ Umdrehungen auf und hebt ab, goldenes Licht und Partikel steigen aus
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
    zeile = zeile * 0.45 + (145 + Math.random() * 95) * 0.55 + (Math.random() < 0.04 ? 28 : 0);
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
  renderer.toneMappingExposure = 1.05;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, handy ? 1.5 : 2));

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const raum = new RoomEnvironment();
  const umgebung = pmrem.fromScene(raum, 0.035).texture;
  scene.environment = umgebung;
  scene.environmentIntensity = 0.85;

  const kamera = new THREE.PerspectiveCamera(26, 1, 0.1, 60);

  // Licht: warm von links vorn, kühl von rechts hinten, Gold aus dem Glas (wächst mit dem Öffnen).
  const fuehrung = new THREE.DirectionalLight(0xffe4bd, 2.4); fuehrung.position.set(-4, 6, 5); scene.add(fuehrung);
  const kante = new THREE.DirectionalLight(0xc9d8ff, 1.6); kante.position.set(5, 3, -4); scene.add(kante);
  const gold = new THREE.PointLight(0xffc766, 0, 6, 1.6); gold.position.set(0, 2.1, 0.2); scene.add(gold);

  const glasGruppe = new THREE.Group(); scene.add(glasGruppe);
  const wegwerfen: { dispose(): void }[] = [umgebung, pmrem];

  // ── Glas: geschlossenes Profil (außen hoch, innen runter), Maße in Radien ──
  const aussen: THREE.Vector2[] = [new THREE.Vector2(0, 0)];
  bogen(aussen, 0.86, 0.14, 0.14, -Math.PI / 2, 0);              // Boden → Wand
  aussen.push(new THREE.Vector2(1.0, 1.36));
  bogen(aussen, 0.9, 1.36, 0.1, 0, Math.PI / 2 * 0.7, 6);       // Schulter
  aussen.push(new THREE.Vector2(0.952, 1.5), new THREE.Vector2(0.952, 1.71));
  bogen(aussen, 0.932, 1.71, 0.02, 0, Math.PI, 6);               // Rand
  aussen.push(new THREE.Vector2(0.912, 1.5), new THREE.Vector2(0.958, 1.4), new THREE.Vector2(0.962, 0.18));
  bogen(aussen, 0.84, 0.18, 0.122, 0, -Math.PI / 2, 8);
  aussen.push(new THREE.Vector2(0, 0.058));
  const glasGeo = new THREE.LatheGeometry(aussen, 128);
  const glasMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: 0.03, transmission: 1, thickness: 0.06, ior: 1.5,
    clearcoat: 1, clearcoatRoughness: 0.03, specularIntensity: 1, envMapIntensity: 1.35, transparent: true,
  });
  const glasMesh = new THREE.Mesh(glasGeo, glasMat); glasMesh.renderOrder = 2; glasGruppe.add(glasMesh);
  wegwerfen.push(glasGeo, glasMat);

  // Gewindeansatz: zwei Gänge als Röhre auf dem Hals
  const wendel: THREE.Vector3[] = [];
  for (let i = 0; i <= 160; i++) { const t = i / 160; const w = t * Math.PI * 2 * 1.6; wendel.push(new THREE.Vector3(Math.sin(w) * 0.962, 1.53 + t * 0.13, Math.cos(w) * 0.962)); }
  const gewindeGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(wendel), 240, 0.011, 6, false);
  const gewinde = new THREE.Mesh(gewindeGeo, glasMat); gewinde.renderOrder = 2; glasGruppe.add(gewinde);
  wegwerfen.push(gewindeGeo);

  // ── Inhalt ──
  const inhaltProfil = [new THREE.Vector2(0, 0.065), new THREE.Vector2(0.84, 0.065)];
  bogen(inhaltProfil, 0.84, 0.18, 0.115, -Math.PI / 2, 0, 6);
  // Die Wand in gleichmäßigen Schritten — sonst verzerrt die Lathe-UV (v je Punkt) die Körnung zu Streifen.
  for (let y = 0.22; y < 1.39; y += 0.04) inhaltProfil.push(new THREE.Vector2(0.955, y));
  inhaltProfil.push(new THREE.Vector2(0.955, 1.39), new THREE.Vector2(0.906, 1.48), new THREE.Vector2(0.906, 1.57), new THREE.Vector2(0.6, 1.585), new THREE.Vector2(0, 1.595));
  const inhaltGeo = new THREE.LatheGeometry(inhaltProfil, 96);
  const korn = koernung(glas.inhalt || "#2a140f");
  const inhaltMat = new THREE.MeshPhysicalMaterial({ color: 0xc4b8b0, map: korn.map, bumpMap: korn.bump, bumpScale: 0.5, roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.22 });
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
    const r = 1.006, bogenW = 1.5;
    const hoehe = Math.min(1.15, (r * bogenW) / verh);
    const etGeo = new THREE.CylinderGeometry(r, r, hoehe, 64, 1, true, -bogenW / 2, bogenW);
    const etMat = new THREE.MeshPhysicalMaterial({ map: etikettTex, roughness: 0.55, clearcoat: 0.15, side: THREE.FrontSide });
    const et = new THREE.Mesh(etGeo, etMat); et.position.y = 0.78; et.renderOrder = 3; glasGruppe.add(et);
    wegwerfen.push(etikettTex, etGeo, etMat);
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
    color: DECKEL_FARBE[glas.deckel] ?? DECKEL_FARBE.silber, metalness: 1, roughness: 0.28, roughnessMap: buerste,
    // Die Bürstung trägt allein die Rauheitskarte (keine Bump-Map mehr).
    clearcoat: 0.2, clearcoatRoughness: 0.3, envMapIntensity: 0.95,
    // Transparent, damit der Deckel am Ende im Licht ausblenden kann. Keine Anisotropie: Mit anisotropy 0,7 zeigte der
    // Deckelrand im Test (Chrome, Metal) blockige Spiegelungen der Umgebung — die Riefen der Rauheitskarte reichen.
    transparent: true,
  });
  const deckel = new THREE.Mesh(deckelGeo, deckelMat);
  const deckelDreh = new THREE.Group(); deckelDreh.add(deckel); glasGruppe.add(deckelDreh);
  wegwerfen.push(deckelGeo, deckelMat, buerste);
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
  wegwerfen.push(saeuleMat, saeuleGeo);

  // Partikel: eigene Punkte mit Deckkraft je Teilchen (steigen, funkeln, verblassen oben) — goldene Perlen mit hellem Kern,
  // normal gemischt, damit sie auch auf hellem Papier sichtbar sind.
  const N = handy ? 140 : 240;
  const pos = new Float32Array(N * 3), alpha = new Float32Array(N), groessen = new Float32Array(N);
  const keim = Array.from({ length: N }, () => ({ w: Math.random() * Math.PI * 2, r: Math.sqrt(Math.random()) * 0.82, s: 0.5 + Math.random(), ph: Math.random(), sw: Math.random() * 6 }));
  keim.forEach((_, i) => { groessen[i] = 0.5 + Math.random() * 1.1; });
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

  // Weicher Schatten unter dem Glas
  const schattenTex = verlauf([[0, "rgba(20,14,8,.42)"], [0.55, "rgba(20,14,8,.14)"], [1, "rgba(20,14,8,0)"]], 128);
  const schattenMat = new THREE.MeshBasicMaterial({ map: schattenTex, transparent: true, depthWrite: false, toneMapped: false });
  const schatten = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), schattenMat); schatten.rotation.x = -Math.PI / 2; schatten.position.y = 0.002; glasGruppe.add(schatten);
  wegwerfen.push(schattenTex, schattenMat, schatten.geometry);

  // ── Zustand ──
  let ziel = 0, gezeigt = 0, nx = 0, ny = 0, zx = 0, zy = 0;
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
    const deckelSicht = 1 - glatt(0.8, 0.95, p);
    deckelMat.opacity = deckelSicht; deckelDreh.visible = deckelSicht > 0.01;

    // Am Handy steht das Etikett im geschlossenen Zustand mittig (Drehung fast null); am Rechner die Dreiviertelansicht.
    glasGruppe.rotation.y = (handy ? -0.04 : -0.34) + p * 0.3 + zx * 0.16 + Math.sin(t * 0.5) * 0.02;
    glasGruppe.rotation.x = zy * 0.05;
    glasGruppe.position.y = Math.sin(t * 0.8) * 0.012;

    glutMat.opacity = licht;
    scheinMat.opacity = licht * 0.9;
    const s = 1.4 + licht * 3.4 + Math.sin(t * 1.7) * 0.06 * licht; schein.scale.set(s, s * 1.1, 1);
    schein.position.y = 1.75 + licht * 0.55;
    saeuleMat.uniforms.uDeck.value = licht;
    saeule.scale.set(1, 0.3 + licht * 0.7, 1); saeule.position.y = 1.6 + 1.8 * (0.3 + licht * 0.7);
    gold.intensity = licht * 9;
    partMat.uniforms.uDeck.value = glatt(0.46, 0.78, p);
    partMat.uniforms.uPunkt.value = renderer.getPixelRatio() * hoehe * 0.055;
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
    const d0 = Math.max(dHoch, dBreit) * (handy ? 1.14 : 1.2);
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

  const schleife = () => {
    raf = 0;
    if (!laeuft) return;
    gezeigt += (ziel - gezeigt) * 0.12;
    if (Math.abs(ziel - gezeigt) < 0.0005) gezeigt = ziel;
    zx += (nx - zx) * 0.06; zy += (ny - zy) * 0.06;
    zeichnen();
    raf = requestAnimationFrame(schleife);
  };

  groesse();
  zeichnen();

  return {
    setzen(p) {
      ziel = Math.min(1, Math.max(0, p));
      if (!laeuft || document.visibilityState !== "visible") { gezeigt = ziel; zeichnen(); }
    },
    lage(a, b, c, e) { lageWerte = [a, b, c, e]; if (!laeuft) zeichnen(); },
    zeiger(x, y) { nx = x; ny = y; },
    groesse() { groesse(); zeichnen(); },
    takt(an) {
      if (an === laeuft) return;
      laeuft = an;
      if (an && !raf) raf = requestAnimationFrame(schleife);
      if (!an && raf) { cancelAnimationFrame(raf); raf = 0; gezeigt = ziel; zeichnen(); }
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
