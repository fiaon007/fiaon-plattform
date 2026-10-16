// ═══════════════════════════════════════════════════════════════════════════
// DIE VIER BÜHNEN ÜBER DEN PAKETTAFELN — three.js, eigener Chunk (16.10.2026, E-387)
//
// Justin (16.10.): „Eine Kreditkarte reicht, für die anderen Punkte was anderes
// animiertes, es muss viel besser aussehen“ — dann zu Entwurf A: „keine Icons,
// bisschen mehr Platz auf Handy und PC, smoothere Animation“. Je Etappe ein
// eigenes Objekt, echt in 3D:
//   I   Urkunde auf einer Navy-Mappe, ein Stempel setzt das blaue Siegel
//   II  EINE Firmenkarte in Navy-Metall (ohne Marke — der Herausgeber ist nie
//       FIAON), ein Lichtstreif zieht über die Kartenfläche
//   III gläserne Stufen, eine Lichtkugel steigt hinauf, jede Stufe leuchtet auf
//   IV  eine Tresortür: Rad dreht, Tür schwingt auf, Licht von innen
//
// Ein Renderer, ein Canvas über allen vier Kacheln, je Kachel ein Ausschnitt
// (Scissor) — so bleibt es bei einem WebGL-Kontext, auch wenn die Kacheln am
// Handy seitlich wischen. Alle Bewegungen sind Funktionen der Zeit mit weichen
// Kurven (ease-in-out, kein Sprung am Zyklusende); Zeiger-Neigung und Ab-/
// Anschalten laufen gedämpft (exponentiell, unabhängig von der Bildrate).
// Der Takt läuft nur, solange die Leiste im Bild und der Tab sichtbar ist.
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export interface EtappenSzene {
  /** Dauerlauf an/aus (im Bild und Tab sichtbar). */
  takt(an: boolean): void;
  /** Etappe im gewählten Paket? Aus = blass (gedämpft überblendet). */
  aktiv(i: number, an: boolean): void;
  /** Zeiger über Bühne i, x/y in −1…1; `null` = Zeiger weg. */
  zeiger(i: number, xy: [number, number] | null): void;
  /** Einmal auftreten lassen (beim ersten Sichtbarwerden). */
  auftritt(): void;
  /** Ein einzelnes Bild (Größenänderung, Wischen ohne Takt). */
  zeichnen(): void;
  dispose(): void;
}

interface Objekt {
  huelle: THREE.Group;
  tick(t: number, dt: number): void;
}

const weich = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
const inOut = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const aus = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const daempf = (dt: number, k: number) => 1 - Math.exp(-dt * k);

function textur(w: number, h: number, malen: (c: CanvasRenderingContext2D, w: number, h: number) => void): THREE.CanvasTexture {
  const el = document.createElement("canvas"); el.width = w; el.height = h;
  malen(el.getContext("2d")!, w, h);
  const t = new THREE.CanvasTexture(el); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

function rund(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape(); const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

const SERIF = "'Newsreader', Georgia, serif";
const SANS = "'Inter', 'Helvetica Neue', Arial, sans-serif";

// ── I · Urkunde ───────────────────────────────────────────────────────────
function urkunde(): Objekt {
  const huelle = new THREE.Group(); const g = new THREE.Group(); huelle.add(g);
  const papier = textur(512, 660, (c, w, h) => {
    c.fillStyle = "#FDFEFF"; c.fillRect(0, 0, w, h);
    c.strokeStyle = "#B7C9EA"; c.lineWidth = 1.2;
    for (let i = 0; i < 26; i++) { c.beginPath(); c.arc(w / 2, 0, 120 + i * 9, 0, Math.PI); c.stroke(); }
    c.strokeStyle = "#5F86C9"; c.lineWidth = 4; c.strokeRect(22, 22, w - 44, h - 44);
    c.lineWidth = 1; c.strokeRect(34, 34, w - 68, h - 68);
    c.fillStyle = "#13234A"; c.textAlign = "center";
    c.font = `300 22px ${SERIF}`; c.fillText("CERTIFICATE OF", w / 2, 170);
    c.font = `300 42px ${SERIF}`; c.fillText("Formation", w / 2, 218);
    c.fillStyle = "#4A5772"; c.font = `16px ${SERIF}`; c.fillText("Limited Liability Company", w / 2, 262);
    c.fillStyle = "#8EA6D2"; for (let i = 0; i < 7; i++) c.fillRect(110, 306 + i * 24, 292 - (i % 3) * 40, 5);
    c.strokeStyle = "#1D4ED8"; c.lineWidth = 2; c.beginPath(); c.moveTo(110, 560);
    c.bezierCurveTo(150, 530, 175, 585, 215, 552); c.bezierCurveTo(240, 535, 255, 570, 290, 556); c.stroke();
    c.fillStyle = "#9DB4DE"; c.fillRect(110, 572, 190, 2);
  });
  const rand = new THREE.MeshStandardMaterial({ color: 0xE6ECF6, roughness: .8 });
  const blatt = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.84, .025), [rand, rand, rand, rand, new THREE.MeshStandardMaterial({ map: papier, color: 0xEDF1F8, roughness: .85 }), rand]);
  g.add(blatt);
  const mappe = new THREE.Mesh(
    new THREE.ExtrudeGeometry(rund(2.6, 3.24, .08), { depth: .06, bevelEnabled: true, bevelThickness: .02, bevelSize: .02, bevelSegments: 3 }),
    new THREE.MeshPhysicalMaterial({ color: 0x13234A, roughness: .45, clearcoat: .8, clearcoatRoughness: .2, sheen: .4, sheenColor: new THREE.Color(0x3B5FA8) }),
  );
  mappe.geometry.center(); mappe.position.set(.04, -.02, -.07); g.add(mappe);

  const siegel = new THREE.Group(); siegel.position.set(.58, -.95, .05); g.add(siegel);
  const scheibe = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, .06, 64), new THREE.MeshPhysicalMaterial({ color: 0x1D4ED8, metalness: .55, roughness: .28, clearcoat: 1 }));
  scheibe.rotation.x = Math.PI / 2; siegel.add(scheibe);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.22, .018, 12, 64), new THREE.MeshPhysicalMaterial({ color: 0x8CC2FF, metalness: .8, roughness: .25 }));
  ring.position.z = .035; siegel.add(ring);
  for (const sx of [-1, 1]) {
    const band = new THREE.Mesh(new THREE.PlaneGeometry(.12, .42), new THREE.MeshPhysicalMaterial({ color: 0x13234A, side: THREE.DoubleSide, roughness: .5 }));
    band.position.set(sx * .1, -.3, -.01); band.rotation.z = sx * .25; siegel.add(band);
  }
  const welle = new THREE.Mesh(new THREE.RingGeometry(.3, .335, 64), new THREE.MeshBasicMaterial({ color: 0x288DFA, transparent: true, opacity: 0, depthWrite: false }));
  welle.position.set(.58, -.95, .07); g.add(welle);

  const stempel = new THREE.Group(); stempel.position.set(.58, -.95, .9); g.add(stempel);
  const fuss = new THREE.Mesh(new THREE.CylinderGeometry(.27, .3, .12, 48), new THREE.MeshPhysicalMaterial({ color: 0x13234A, metalness: .3, roughness: .35, clearcoat: 1 }));
  fuss.rotation.x = Math.PI / 2; stempel.add(fuss);
  const griff = new THREE.Mesh(new THREE.CylinderGeometry(.07, .09, .5, 32), new THREE.MeshPhysicalMaterial({ color: 0xDCE6F7, metalness: .9, roughness: .25 }));
  griff.rotation.x = Math.PI / 2; griff.position.z = .3; stempel.add(griff);
  const knauf = new THREE.Mesh(new THREE.SphereGeometry(.13, 32, 16), new THREE.MeshPhysicalMaterial({ color: 0x13234A, metalness: .3, roughness: .3, clearcoat: 1 }));
  knauf.position.z = .6; stempel.add(knauf);

  return {
    huelle,
    tick(t) {
      g.rotation.y = Math.sin(t * .32) * .12 - .2; g.rotation.x = -.62 + Math.sin(t * .41) * .025; g.position.y = Math.sin(t * .55) * .035;
      // Zyklus 5 s: senken (0–24 %), aufsetzen (24–32 %), heben (32–58 %), Ruhe.
      const p = (t % 5) / 5;
      const z = p < .24 ? .9 - inOut(p / .24) * .78 : p < .32 ? .12 : .12 + inOut((p - .32) / .26) * .78;
      stempel.position.z = z;
      stempel.rotation.z = p < .32 ? 0 : weich((p - .32) / .26) * .35 - (p > .58 ? weich((p - .58) / .4) * .35 : 0);
      const druck = Math.max(0, 1 - Math.abs(p - .28) / .06);
      siegel.scale.setScalar(1 - druck * .05 + Math.max(0, Math.sin(Math.min(1, Math.max(0, (p - .3) / .14)) * Math.PI)) * .05);
      const w = Math.min(1, Math.max(0, (p - .27) / .5));
      welle.scale.setScalar(1 + aus(w) * 2.6);
      (welle.material as THREE.MeshBasicMaterial).opacity = p > .27 && p < .77 ? .5 * (1 - w) * (1 - w) : 0;
    },
  };
}

// ── II · Die eine Firmenkarte ─────────────────────────────────────────────
function karte(sprache: "de" | "en"): Objekt {
  const huelle = new THREE.Group(); const g = new THREE.Group(); huelle.add(g);
  const W = 3.37, H = 2.13;
  const form = new THREE.ExtrudeGeometry(rund(W, H, .17), { depth: .045, bevelEnabled: true, bevelThickness: .012, bevelSize: .012, bevelSegments: 5, curveSegments: 16 });
  form.center();
  g.add(new THREE.Mesh(form, new THREE.MeshPhysicalMaterial({ color: 0x14295A, metalness: .72, roughness: .3, clearcoat: 1, clearcoatRoughness: .08 })));
  const druck = textur(1024, 646, (c, w, h) => {
    const v = c.createLinearGradient(0, 0, w, h); v.addColorStop(0, "rgba(140,194,255,.10)"); v.addColorStop(.55, "rgba(140,194,255,0)"); v.addColorStop(1, "rgba(40,141,250,.12)");
    c.fillStyle = v; c.fillRect(0, 0, w, h);
    c.strokeStyle = "rgba(140,194,255,.18)"; c.lineWidth = 1.2;
    for (let i = 0; i < 14; i++) { c.beginPath(); c.moveTo(0, 380 + i * 14); c.bezierCurveTo(300, 300 + i * 18, 600, 470 + i * 8, w, 360 + i * 16); c.stroke(); }
    c.fillStyle = "#DCE8FB"; c.font = `300 30px ${SANS}`; c.fillText("B U S I N E S S", 74, 120);
    c.strokeStyle = "#CFE3FF"; c.lineWidth = 4;
    for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(860, 248, 18 + i * 14, -.8, .8); c.stroke(); }
    c.fillStyle = "#DCE8FB"; c.font = `400 34px ${SANS}`; c.fillText("••••  ••••  ••••  2049", 70, 470);
    c.font = `300 26px ${SANS}`; c.fillStyle = "#A9C6F5"; c.fillText(sprache === "en" ? "YOUR COMPANY LLC" : "IHRE GESELLSCHAFT LLC", 70, 560);
  });
  const vorne = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshPhysicalMaterial({ map: druck, transparent: true, roughness: .35, clearcoat: 1 }));
  vorne.position.z = .036; g.add(vorne);
  const chip = new THREE.Mesh(
    new THREE.ExtrudeGeometry(rund(.46, .36, .06), { depth: .01, bevelEnabled: true, bevelThickness: .004, bevelSize: .004, bevelSegments: 2 }),
    new THREE.MeshPhysicalMaterial({ color: 0xD5E0F2, metalness: 1, roughness: .22 }),
  );
  chip.position.set(-1.05, .1, .03); g.add(chip);
  for (const [x, y, w, h] of [[-1.05, .1, .46, .012], [-1.05, .1, .012, .36], [-1.13, .1, .012, .2]] as const) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(w, h, .004), new THREE.MeshBasicMaterial({ color: 0x8A97B0 })); l.position.set(x, y, .05); g.add(l);
  }
  // Lichtstreif in Kartenform: das Band wandert über die Textur, nie über den Kartenrand.
  const glanzForm = new THREE.ShapeGeometry(rund(W, H, .17), 12);
  const gp = glanzForm.attributes.position, guv = glanzForm.attributes.uv;
  for (let i = 0; i < gp.count; i++) guv.setXY(i, (gp.getX(i) + W / 2) / W + gp.getY(i) / H * .35, (gp.getY(i) + H / 2) / H);
  const band = textur(1024, 64, (c, w, h) => {
    const v = c.createLinearGradient(0, 0, w, 0); v.addColorStop(.38, "rgba(255,255,255,0)"); v.addColorStop(.5, "rgba(255,255,255,1)"); v.addColorStop(.62, "rgba(255,255,255,0)");
    c.fillStyle = v; c.fillRect(0, 0, w, h);
  });
  band.wrapS = THREE.ClampToEdgeWrapping;
  const glanz = new THREE.Mesh(glanzForm, new THREE.MeshBasicMaterial({ map: band, transparent: true, opacity: .24, depthWrite: false, blending: THREE.AdditiveBlending }));
  glanz.position.z = .041; g.add(glanz);
  return {
    huelle,
    tick(t) {
      g.rotation.y = Math.sin(t * .3) * .26 - .18; g.rotation.x = -.16 + Math.sin(t * .43) * .045; g.rotation.z = .05; g.position.y = Math.sin(t * .6) * .045;
      // Alle 6 s ein Streif, weich hinein und hinaus.
      const p = (t % 6) / 6;
      band.offset.x = .9 - inOut(p / .5) * 1.8;
    },
  };
}

// ── III · Die Kartenleiter als gläserne Stufen ────────────────────────────
function stufen(): Objekt {
  const huelle = new THREE.Group(); const g = new THREE.Group(); huelle.add(g);
  const AUS = new THREE.Color(0xDCE7F8), AN = new THREE.Color(0x3B8EF5);
  const teile: { s: THREE.Mesh; m: THREE.MeshPhysicalMaterial; kante: THREE.MeshBasicMaterial; hell: number }[] = [];
  for (let i = 0; i < 5; i++) {
    const m = new THREE.MeshPhysicalMaterial({ color: AUS.clone(), roughness: .18, clearcoat: 1, clearcoatRoughness: .1, transparent: true, opacity: .93, emissive: new THREE.Color(0x1D4ED8), emissiveIntensity: 0 });
    const s = new THREE.Mesh(new THREE.ExtrudeGeometry(rund(1.1, .86, .08), { depth: .16, bevelEnabled: true, bevelThickness: .02, bevelSize: .02, bevelSegments: 3 }), m);
    s.geometry.center(); s.rotation.x = -Math.PI / 2; s.position.set(-1.6 + i * .8, -.7 + i * .38, 0); g.add(s);
    const kante = new THREE.MeshBasicMaterial({ color: 0x288DFA, transparent: true, opacity: .2 });
    const k = new THREE.Mesh(new THREE.BoxGeometry(1.12, .03, .03), kante); k.position.set(s.position.x, s.position.y + .1, .45); g.add(k);
    const hoehe = .38 * (i + 1) + .2;
    const saeule = new THREE.Mesh(new THREE.BoxGeometry(.06, hoehe, .06), new THREE.MeshPhysicalMaterial({ color: 0xC3D4EE, roughness: .3, transparent: true, opacity: .5 }));
    saeule.position.set(s.position.x, s.position.y - hoehe / 2 - .08, -.3); g.add(saeule);
    teile.push({ s, m, kante, hell: 0 });
  }
  const kugel = new THREE.Mesh(new THREE.SphereGeometry(.14, 32, 16), new THREE.MeshBasicMaterial({ color: 0xE6F2FF }));
  kugel.add(new THREE.Mesh(new THREE.SphereGeometry(.3, 32, 16), new THREE.MeshBasicMaterial({ color: 0x288DFA, transparent: true, opacity: .25, depthWrite: false, blending: THREE.AdditiveBlending })));
  kugel.add(new THREE.PointLight(0x5AA8FF, 2.6, 3.5));
  g.add(kugel);
  const SCHRITT = .8, OBEN = 1.3, WEG = .7, N = teile.length, ZYKLUS = N * SCHRITT + OBEN + WEG;
  const start = new THREE.Vector3(-2.4, -1.08, 0);
  return {
    huelle,
    tick(t, dt) {
      g.rotation.y = -.5 + Math.sin(t * .27) * .08; g.rotation.x = .12; g.position.y = Math.sin(t * .55) * .03;
      const s = t % ZYKLUS;
      let ziele: number[]; let groesse = 1;
      if (s < N * SCHRITT) {
        const i = Math.floor(s / SCHRITT), q = inOut((s % SCHRITT) / SCHRITT);
        const von = i === 0 ? start : teile[i - 1].s.position, nach = teile[i].s.position;
        kugel.position.set(von.x + (nach.x - von.x) * q, von.y + (nach.y - von.y) * q + .3 + Math.sin(q * Math.PI) * .32, .05);
        ziele = teile.map((_, k) => (k < i ? 1 : k === i ? q : 0));
        if (i === 0) groesse = weich((s % SCHRITT) / (SCHRITT * .45));
      } else {
        const oben = teile[N - 1].s.position, r = s - N * SCHRITT;
        kugel.position.set(oben.x, oben.y + .3 + Math.sin(r * 2.4) * .04, .05);
        ziele = teile.map(() => (r < OBEN ? 1 : 0));
        if (r >= OBEN) groesse = 1 - weich((r - OBEN) / WEG);
      }
      kugel.scale.setScalar(Math.max(.001, groesse));
      const k = daempf(dt, 7);
      teile.forEach((x, j) => {
        x.hell += (ziele[j] - x.hell) * k;
        x.m.color.copy(AUS).lerp(AN, x.hell * .85); x.m.emissiveIntensity = x.hell * .35; x.kante.opacity = .2 + x.hell * .8;
      });
    },
  };
}

// ── IV · Die Tresortür ────────────────────────────────────────────────────
function tresor(): Objekt {
  const huelle = new THREE.Group(); const g = new THREE.Group(); huelle.add(g);
  const wand = new THREE.Mesh(
    new THREE.ExtrudeGeometry(rund(3, 3, .35), { depth: .2, bevelEnabled: true, bevelThickness: .03, bevelSize: .03, bevelSegments: 4 }),
    new THREE.MeshPhysicalMaterial({ color: 0xF2F6FD, roughness: .5, clearcoat: .4 }),
  );
  wand.geometry.center(); wand.position.z = -.2; g.add(wand);
  const innen = new THREE.Mesh(new THREE.CircleGeometry(1.08, 64), new THREE.MeshBasicMaterial({ color: 0x288DFA })); innen.position.z = -.09; g.add(innen);
  const hofMat = new THREE.MeshBasicMaterial({ color: 0xCFE3FF, transparent: true, opacity: .7 });
  const hof = new THREE.Mesh(new THREE.CircleGeometry(1.0, 64), hofMat); hof.position.z = -.085; g.add(hof);
  const rahmen = new THREE.Mesh(new THREE.TorusGeometry(1.15, .1, 24, 96), new THREE.MeshPhysicalMaterial({ color: 0x13234A, metalness: .6, roughness: .3, clearcoat: 1 }));
  rahmen.position.z = -.02; g.add(rahmen);
  const scharnier = new THREE.Group(); scharnier.position.set(-1.05, 0, 0); g.add(scharnier);
  const tuer = new THREE.Group(); tuer.position.set(1.05, 0, 0); scharnier.add(tuer);
  const stahl = new THREE.MeshPhysicalMaterial({ color: 0xD9E3F3, metalness: 1, roughness: .3, clearcoat: .5 });
  const platte = new THREE.Mesh(new THREE.CylinderGeometry(1.04, 1.04, .22, 96), stahl); platte.rotation.x = Math.PI / 2; tuer.add(platte);
  const bolzenMat = new THREE.MeshPhysicalMaterial({ color: 0x9FB0CD, metalness: 1, roughness: .25 });
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2;
    const b = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, .06, 20), bolzenMat); b.rotation.x = Math.PI / 2; b.position.set(Math.cos(a) * .88, Math.sin(a) * .88, .13); tuer.add(b);
  }
  const rad = new THREE.Group(); rad.position.z = .16; tuer.add(rad);
  const navy = new THREE.MeshPhysicalMaterial({ color: 0x13234A, metalness: .45, roughness: .3, clearcoat: 1 });
  const nabe = new THREE.Mesh(new THREE.CylinderGeometry(.16, .16, .12, 40), navy); nabe.rotation.x = Math.PI / 2; rad.add(nabe);
  for (let i = 0; i < 3; i++) {
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, 1.1, 20), stahl); sp.rotation.z = i * Math.PI / 3; sp.position.z = .04; rad.add(sp);
    for (const sx of [-1, 1]) {
      const k = new THREE.Mesh(new THREE.SphereGeometry(.06, 20, 10), navy);
      k.position.set(-Math.sin(i * Math.PI / 3) * .55 * sx, Math.cos(i * Math.PI / 3) * .55 * sx, .04); rad.add(k);
    }
  }
  return {
    huelle,
    tick(t) {
      g.rotation.y = .32 + Math.sin(t * .28) * .1; g.rotation.x = -.06; g.position.y = Math.sin(t * .55) * .03;
      // Zyklus 9 s: Rad auf (0–20 %), Tür auf (22–42 %), offen, Tür zu (72–88 %), Rad zurück (88–100 %).
      const p = (t % 9) / 9;
      rad.rotation.z = p < .2 ? inOut(p / .2) * Math.PI * 1.5 : p < .88 ? Math.PI * 1.5 : (1 - inOut((p - .88) / .12)) * Math.PI * 1.5;
      const auf = p < .22 ? 0 : p < .42 ? inOut((p - .22) / .2) : p < .72 ? 1 : p < .88 ? 1 - inOut((p - .72) / .16) : 0;
      scharnier.rotation.y = -auf * 1.1;
      hofMat.opacity = .7 - auf * .45 + (auf > .99 ? Math.sin(t * 2.2) * .06 : 0);
    },
  };
}

export async function etappenSzeneBauen(
  canvas: HTMLCanvasElement,
  plaetze: () => (HTMLElement | null)[],
  opt: { sprache: "de" | "en"; ruhig: boolean },
): Promise<EtappenSzene> {
  // Die Schrift der Urkunde und der Karte soll Newsreader/Inter sein — kurz auf die Webschriften warten.
  try { await Promise.race([document.fonts?.ready, new Promise((r) => setTimeout(r, 800))]); } catch { /* ohne Webschrift weiter */ }

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = false;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const raum = new RoomEnvironment();
  const umgebung = pmrem.fromScene(raum, .04).texture;

  const schattenBild = textur(128, 128, (c) => {
    const v = c.createRadialGradient(64, 64, 4, 64, 64, 62); v.addColorStop(0, "rgba(13,35,90,.55)"); v.addColorStop(1, "rgba(13,35,90,0)");
    c.fillStyle = v; c.fillRect(0, 0, 128, 128);
  });

  const MASS = [.56, .66, .55, .6];
  const bauer = [urkunde, () => karte(opt.sprache), stufen, tresor];
  const buehnen = bauer.map((bau, i) => {
    const szene = new THREE.Scene(); szene.environment = umgebung;
    szene.add(new THREE.HemisphereLight(0xffffff, 0xCFE0FF, .6));
    const licht = new THREE.DirectionalLight(0xffffff, 1.4); licht.position.set(3, 5, 4); szene.add(licht);
    const o = bau(); o.huelle.scale.setScalar(MASS[i]); szene.add(o.huelle);
    const schatten = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2), new THREE.MeshBasicMaterial({ map: schattenBild, transparent: true, opacity: .55, depthWrite: false }));
    schatten.rotation.x = -Math.PI / 2; schatten.position.y = -1.32; szene.add(schatten);
    const kamera = new THREE.PerspectiveCamera(31, 1, .1, 50); kamera.position.set(0, .5, 5.8); kamera.lookAt(0, -.05, 0);
    // Blass-Zustand: Grundwerte der Materialien merken, Faktor gedämpft nachziehen.
    const mats: { m: THREE.Material; op: number; tr: boolean }[] = [];
    szene.traverse((x) => {
      const m = (x as THREE.Mesh).material; if (!m) return;
      for (const mm of Array.isArray(m) ? m : [m]) if (!mats.some((e) => e.m === mm)) mats.push({ m: mm, op: mm.opacity, tr: mm.transparent });
    });
    return { szene, o, kamera, mats, hell: 1, hellZiel: 1, neig: [0, 0], neigZiel: [0, 0] as [number, number], auftritt: opt.ruhig ? 1 : 0 };
  });

  let auftrittAb = opt.ruhig ? -1e9 : Infinity;
  let laeuft = false, rahmen = 0, letzt = performance.now();

  const groesse = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w && h && (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio()))) renderer.setSize(w, h, false);
  };
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => { groesse(); if (!laeuft) bild(0); }) : null;
  ro?.observe(canvas);

  let zeit = 0;
  function bild(dt: number) {
    groesse();
    zeit += dt;
    const t = opt.ruhig ? 2.2 : zeit;
    const cr = canvas.getBoundingClientRect();
    renderer.setScissorTest(false); renderer.clear();
    renderer.setScissorTest(true);
    const orte = plaetze();
    buehnen.forEach((b, i) => {
      const el = orte[i]; if (!el) return;
      const r = el.getBoundingClientRect();
      const x = r.left - cr.left, y = cr.bottom - r.bottom, w = r.width, h = r.height;
      if (w < 2 || h < 2 || x + w < 0 || x > cr.width || y + h < 0 || y > cr.height) return;
      // Auftritt: leicht versetzt aufsteigen und eindrehen.
      const a = opt.ruhig ? 1 : aus((zeit - auftrittAb - i * .14) / 1.3);
      b.auftritt = Number.isFinite(a) ? Math.max(0, a) : 0;
      // Zeiger und Blass-Zustand gedämpft.
      const kz = daempf(dt, 5);
      b.neig[0] += (b.neigZiel[0] - b.neig[0]) * kz; b.neig[1] += (b.neigZiel[1] - b.neig[1]) * kz;
      if (Math.abs(b.hellZiel - b.hell) > .001) {
        b.hell += (b.hellZiel - b.hell) * (opt.ruhig ? 1 : daempf(dt, 6));
        for (const e of b.mats) { e.m.transparent = e.tr || b.hell < .999; e.m.opacity = e.op * (.22 + .78 * b.hell); }
      }
      b.o.tick(t + i * .9, dt);
      const h0 = b.o.huelle;
      h0.position.y = -(1 - b.auftritt) * .45;
      h0.rotation.y = -(1 - b.auftritt) * .7 + b.neig[0] * .22;
      h0.rotation.x = b.neig[1] * .12;
      h0.scale.setScalar(MASS[i] * (.84 + .16 * b.auftritt));
      b.kamera.aspect = w / h; b.kamera.updateProjectionMatrix();
      renderer.setViewport(x, y, w, h); renderer.setScissor(x, y, w, h);
      renderer.render(b.szene, b.kamera);
    });
    renderer.setScissorTest(false);
  }

  function schleife(jetzt: number) {
    if (!laeuft) return;
    const dt = Math.min(.05, (jetzt - letzt) / 1000); letzt = jetzt;
    bild(dt);
    rahmen = requestAnimationFrame(schleife);
  }

  bild(0);

  return {
    takt(an) {
      if (opt.ruhig) { if (an) bild(0); return; }
      if (an && !laeuft) { laeuft = true; letzt = performance.now(); rahmen = requestAnimationFrame(schleife); }
      if (!an && laeuft) { laeuft = false; cancelAnimationFrame(rahmen); }
    },
    aktiv(i, an) {
      const b = buehnen[i]; if (!b || b.hellZiel === (an ? 1 : 0)) return;
      b.hellZiel = an ? 1 : 0;
      if (!laeuft) { b.hell = b.hellZiel; for (const e of b.mats) { e.m.transparent = e.tr || !an; e.m.opacity = e.op * (an ? 1 : .22); } bild(0); }
    },
    zeiger(i, xy) {
      const b = buehnen[i]; if (!b) return;
      b.neigZiel = xy ? [xy[0], xy[1]] : [0, 0];
    },
    auftritt() { if (!opt.ruhig && !Number.isFinite(auftrittAb)) auftrittAb = zeit; },
    zeichnen() { if (!laeuft) bild(0); },
    dispose() {
      laeuft = false; cancelAnimationFrame(rahmen); ro?.disconnect();
      for (const b of buehnen) b.szene.traverse((x) => {
        const m = x as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material;
        for (const mm of mat ? (Array.isArray(mat) ? mat : [mat]) : []) { for (const v of Object.values(mm)) if (v instanceof THREE.Texture) v.dispose(); mm.dispose(); }
      });
      schattenBild.dispose(); umgebung.dispose(); pmrem.dispose(); raum.dispose();
      renderer.dispose();
    },
  };
}
