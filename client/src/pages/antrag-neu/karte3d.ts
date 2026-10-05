import * as THREE from "three";

/*
  Die 3D-Karte des neuen Antrags (/antrag-neu).

  Eine Bühne, vier Karten (ein Paket je Karte). Die aktive Karte steht GERADE
  (Justin, 05.10.2026: „gerade stellen und freistellen, kein weißer Kasten“):
  kein Kippen, kein Nachlaufen der Maus — nur ein kaum sichtbares Schweben nach
  oben und unten. Der Hintergrund der Leinwand ist durchsichtig; es gibt keinen
  Rahmen und keine Fläche hinter der Karte.

  Bewegt wird alles über Federn (Ziel + Geschwindigkeit), damit jeder Wechsel
  weich ausläuft. Gerendert wird nur, solange die Bühne sichtbar ist.

  Diese Datei kennt kein React. Die Seite ruft die Methoden der Klasse auf.
*/

export type KartenLook = {
  g1: string; g2: string; body: number; gravur: string;
  rough: number; metal: number; gebuerstet?: boolean; holo?: boolean; champagner?: boolean;
};
export type KartenPaket = { key: string; label: string; look: KartenLook };
export type Unterschrift = { striche: [number, number, number][][]; text: string; asp: number };

type Zustand = { x: number; y: number; z: number; ry: number; sc: number; sat: number; hell: number };
type Karte = {
  i: number; P: KartenPaket; grp: THREE.Group; mats: THREE.MeshPhysicalMaterial[];
  fc: HTMLCanvasElement; ft: THREE.CanvasTexture; bc: HTMLCanvasElement; bt: THREE.CanvasTexture;
  s: Zustand; v: Zustand; t: Zustand;
};
type Modus = "einzeln" | "deck";
export type ModusOptionen = { aktiv?: number; rueck?: boolean; wartet?: boolean; gross?: boolean };

const W = 3.2, H = W / 1.586, R = 0.17, D = 0.045;
const FEDERN: Record<keyof Zustand, [number, number]> = {
  x: [170, 22], y: [170, 22], z: [170, 22], ry: [150, 22], sc: [180, 24], sat: [90, 18], hell: [160, 20],
};

function nullZustand(sc = 0): Zustand { return { x: 0, y: 0, z: 0, ry: 0, sc, sat: 1, hell: 0 }; }

function rrPfad(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

function spaced(c: CanvasRenderingContext2D, text: string, x: number, y: number, sp: number, rechts = false) {
  let w = 0;
  for (let i = 0; i < text.length; i++) w += c.measureText(text[i]).width + (i < text.length - 1 ? sp : 0);
  let sx = rechts ? x - w : x;
  for (let i = 0; i < text.length; i++) { c.fillText(text[i], sx, y); sx += c.measureText(text[i]).width + sp; }
}

export class KartenBuehne {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
  private karten: Karte[] = [];
  private glint: THREE.PointLight;
  private warm: THREE.PointLight;
  private modusArt: Modus = "einzeln";
  private aktiv = 1;
  private rueck = false;
  private wartet = false;
  private gross = false;
  private p = 1; private pZiel = 1; private pV = 0;
  private ziehen = false;
  private zieh = { x0: 0, p0: 0, lx: 0, lt: 0, vx: 0 };
  private groesse = { w: 1, h: 1, visW: 1, visH: 1, sc: 1 };
  private letzte = performance.now();
  private zeit = 0;
  private sichtbar = true;
  private imBild = true;
  private laeuft = false;
  private beendet = false;
  private namenSchmutzig = false;
  private rueckSchmutzig = false;
  private namenTakt: number | null = null;
  private sig: Unterschrift | null = null;
  private stempelText = "";
  private letzterDeckIndex = -1;
  private ro: ResizeObserver | null = null;
  private io: IntersectionObserver | null = null;
  private aufraeumen: (() => void)[] = [];

  constructor(
    private buehne: HTMLElement,
    canvas: HTMLCanvasElement,
    private pakete: KartenPaket[],
    private name: () => string,
    private ruhig: () => boolean,
    private beiDeckIndex: (i: number) => void,
  ) {
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: "high-performance" });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 700 ? 1.75 : 2));
    r.setClearColor(0x000000, 0);
    r.outputColorSpace = THREE.SRGBColorSpace;
    // Neutral statt ACES: ACES entsättigt das Navy sichtbar ins Graublaue; Neutral hält die Kartenfarbe.
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = 1.0;
    this.renderer = r;
    this.camera.position.set(0, 0, 10);

    // Umgebung: heller Himmel mit drei Lichtflächen → ruhige, edle Spiegelung.
    const pm = new THREE.PMREMGenerator(r);
    const env = new THREE.Scene();
    const gc = document.createElement("canvas"); gc.width = 8; gc.height = 256;
    const gx = gc.getContext("2d")!; const lg = gx.createLinearGradient(0, 0, 0, 256);
    lg.addColorStop(0, "#ffffff"); lg.addColorStop(0.42, "#eef4ff"); lg.addColorStop(0.55, "#cfe0ff"); lg.addColorStop(1, "#6f97d8");
    gx.fillStyle = lg; gx.fillRect(0, 0, 8, 256);
    const himmel = new THREE.CanvasTexture(gc); himmel.colorSpace = THREE.SRGBColorSpace;
    env.add(new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16), new THREE.MeshBasicMaterial({ map: himmel, side: THREE.BackSide })));
    const flaecheLicht = (w: number, h: number, x: number, y: number, z: number, c = 0xffffff) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
      m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m);
    };
    flaecheLicht(9, 3.5, -6, 6, 7); flaecheLicht(5, 2.5, 7, 2, 5, 0xdfeaff); flaecheLicht(12, 1.6, 0, -4, -9, 0xbcd3ff);
    this.scene.environment = pm.fromScene(env, 0.035).texture;
    pm.dispose();

    // Die Karte ist die EINE dunkle Stelle der Seite (Justin: Navy-Glas an einer Stelle) — Licht so, dass
    // das Navy satt bleibt und nicht ins Graublaue ausbleicht.
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.45));
    const key = new THREE.DirectionalLight(0xffffff, 2.1); key.position.set(-3, 5, 6); this.scene.add(key);
    this.glint = new THREE.PointLight(0xbfdcff, 0, 8, 1.2); this.glint.position.set(0, 0, 2); this.scene.add(this.glint);
    this.warm = new THREE.PointLight(0xffc98a, 0, 9, 1.2); this.warm.position.set(0, 0, 2.2); this.scene.add(this.warm);

    this.bauen();
    this.messen();
    if (typeof ResizeObserver !== "undefined") { this.ro = new ResizeObserver(() => this.messen()); this.ro.observe(buehne); }
    if (typeof IntersectionObserver !== "undefined") {
      this.io = new IntersectionObserver((es) => { this.imBild = es[0]?.isIntersecting ?? true; this.starten(); });
      this.io.observe(buehne);
    }
    const sichtbarkeit = () => { this.sichtbar = document.visibilityState !== "hidden"; this.starten(); };
    document.addEventListener("visibilitychange", sichtbarkeit);
    this.aufraeumen.push(() => document.removeEventListener("visibilitychange", sichtbarkeit));
    this.ziehenBinden();
    if (document.fonts?.ready) document.fonts.ready.then(() => { if (!this.beendet) this.alleZeichnen(); });
    this.starten();
  }

  // ── Aufbau ─────────────────────────────────────────────────────────────
  private bauen() {
    const rr = (w: number, h: number, r: number) => {
      const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
      s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
      s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
      s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
    };
    const koerper = new THREE.ExtrudeGeometry(rr(W - 0.024, H - 0.024, R), { depth: D, bevelEnabled: true, bevelThickness: 0.014, bevelSize: 0.012, bevelSegments: 4, curveSegments: 28 });
    koerper.translate(0, 0, -D / 2);
    const flaeche = () => {
      const g = new THREE.ShapeGeometry(rr(W - 0.004, H - 0.004, R), 28);
      const pos = g.attributes.position, uv = g.attributes.uv;
      for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + W / 2) / W, (pos.getY(i) + H / 2) / H);
      uv.needsUpdate = true; return g;
    };
    const vorneGeo = flaeche(), hintenGeo = flaeche();
    const aniso = this.renderer.capabilities.getMaxAnisotropy();
    const satMat = (p: THREE.MeshPhysicalMaterialParameters) => {
      const m = new THREE.MeshPhysicalMaterial(p);
      const uSat = { value: 1 }, uHell = { value: 0 };
      m.userData.uSat = uSat; m.userData.uHell = uHell;
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uSat = uSat; sh.uniforms.uHell = uHell;
        sh.fragmentShader = "uniform float uSat;\nuniform float uHell;\n" + sh.fragmentShader.replace(
          "#include <map_fragment>",
          "#include <map_fragment>\nfloat lum=dot(diffuseColor.rgb,vec3(.299,.587,.114));diffuseColor.rgb=mix(vec3(lum),diffuseColor.rgb,uSat);diffuseColor.rgb+=vec3(uHell);",
        );
      };
      return m;
    };
    this.karten = this.pakete.map((P, i) => {
      const L = P.look; const grp = new THREE.Group();
      const body = new THREE.Mesh(koerper, satMat({ color: L.body, metalness: L.metal, roughness: L.rough, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 1.15 }));
      const fc = document.createElement("canvas"); fc.width = 1024; fc.height = 646;
      const ft = new THREE.CanvasTexture(fc); ft.colorSpace = THREE.SRGBColorSpace; ft.anisotropy = aniso;
      const front = new THREE.Mesh(vorneGeo, satMat({ map: ft, metalness: 0.06, roughness: 0.42, clearcoat: 0.8, clearcoatRoughness: 0.08, envMapIntensity: 0.32, specularIntensity: 0.45 }));
      front.position.z = D / 2 + 0.016;
      const bc = document.createElement("canvas"); bc.width = 1024; bc.height = 646;
      const bt = new THREE.CanvasTexture(bc); bt.colorSpace = THREE.SRGBColorSpace; bt.anisotropy = aniso;
      const back = new THREE.Mesh(hintenGeo, satMat({ map: bt, metalness: 0.06, roughness: 0.45, clearcoat: 0.8, clearcoatRoughness: 0.1, envMapIntensity: 0.32, specularIntensity: 0.45 }));
      back.rotation.y = Math.PI; back.position.z = -(D / 2 + 0.016);
      grp.add(body, front, back); this.scene.add(grp);
      const sc0 = i === this.aktiv ? 1 : 0;
      return { i, P, grp, mats: [body.material, front.material, back.material] as THREE.MeshPhysicalMaterial[], fc, ft, bc, bt, s: nullZustand(sc0), v: { ...nullZustand(0), sat: 0 }, t: nullZustand(sc0) };
    });
    this.alleZeichnen();
  }

  // ── Zeichnen der Flächen ───────────────────────────────────────────────
  private grund(c: CanvasRenderingContext2D, L: KartenLook, w: number, h: number) {
    const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, L.g1); g.addColorStop(1, L.g2); c.fillStyle = g; c.fillRect(0, 0, w, h);
    const s = c.createRadialGradient(w * 0.12, 0, 0, w * 0.12, 0, w * 0.95); s.addColorStop(0, "rgba(255,255,255,.17)"); s.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = s; c.fillRect(0, 0, w, h);
    if (L.gebuerstet) { c.globalAlpha = 0.05; for (let y = 0; y < h; y += 2) { c.fillStyle = y % 4 ? "#ffffff" : "#000000"; c.fillRect(0, y, w, 1); } c.globalAlpha = 1; }
    c.strokeStyle = L.champagner ? "rgba(224,198,142,.07)" : "rgba(255,255,255,.055)"; c.lineWidth = 1.1;
    for (let i = 0; i < 16; i++) { c.beginPath(); for (let x = 0; x <= w; x += 8) { const yy = h * 0.56 + Math.sin(x / 88 + i * 0.45) * 20 + Math.cos(x / 140 - i * 0.3) * 10 + i * 8; if (x) c.lineTo(x, yy); else c.moveTo(x, yy); } c.stroke(); }
    if (L.holo) { const hg = c.createLinearGradient(0, 0, w, 0); hg.addColorStop(0, "rgba(120,220,255,0)"); hg.addColorStop(0.5, "rgba(180,160,255,.10)"); hg.addColorStop(1, "rgba(120,255,220,0)"); c.fillStyle = hg; c.fillRect(0, 0, w, 14); c.fillRect(0, h - 14, w, 14); }
  }

  private chip(c: CanvasRenderingContext2D, x: number, y: number, cham: boolean) {
    const g = c.createLinearGradient(x, y, x + 120, y + 92);
    g.addColorStop(0, cham ? "#f3e2b3" : "#efe2bd"); g.addColorStop(0.5, cham ? "#caa865" : "#c8ab6c"); g.addColorStop(1, cham ? "#9c7b3e" : "#a3864d");
    c.fillStyle = g; rrPfad(c, x, y, 120, 92, 16); c.fill();
    c.strokeStyle = "rgba(80,60,20,.45)"; c.lineWidth = 2; c.beginPath();
    c.moveTo(x + 40, y); c.lineTo(x + 40, y + 92); c.moveTo(x + 80, y); c.lineTo(x + 80, y + 92);
    c.moveTo(x, y + 31); c.lineTo(x + 40, y + 31); c.moveTo(x + 80, y + 31); c.lineTo(x + 120, y + 31);
    c.moveTo(x, y + 61); c.lineTo(x + 40, y + 61); c.moveTo(x + 80, y + 61); c.lineTo(x + 120, y + 61); c.stroke();
    c.strokeStyle = "rgba(255,255,255,.35)"; c.lineWidth = 1.5; rrPfad(c, x + 1, y + 1, 118, 90, 15); c.stroke();
  }

  private vorne(k: Karte) {
    const c = k.fc.getContext("2d")!, w = 1024, h = 646, L = k.P.look;
    c.clearRect(0, 0, w, h); this.grund(c, L, w, h);
    c.fillStyle = L.gravur; c.textBaseline = "alphabetic"; c.textAlign = "left";
    c.font = "300 44px Inter, system-ui, sans-serif"; spaced(c, "FIAON", 70, 104, 14);
    c.font = "500 22px Inter, system-ui, sans-serif"; c.globalAlpha = 0.72; spaced(c, k.P.label, w - 70, 100, 7, true); c.globalAlpha = 1;
    this.chip(c, 70, 232, !!L.champagner);
    c.strokeStyle = L.gravur; c.lineWidth = 4; c.globalAlpha = 0.75;
    for (let a = 0; a < 4; a++) { c.beginPath(); c.arc(232, 278, 18 + a * 15, -0.75, 0.75); c.stroke(); }
    c.globalAlpha = 1;
    const n = this.name();
    let gr = 50; c.font = `400 ${gr}px Inter, system-ui, sans-serif`; c.globalAlpha = n ? 1 : 0.38; c.fillStyle = L.gravur;
    while (c.measureText(n || "Ihr Name").width > w - 140 && gr > 30) { gr -= 2; c.font = `400 ${gr}px Inter, system-ui, sans-serif`; }
    c.fillText(n || "Ihr Name", 70, h - 82); c.globalAlpha = 1; k.ft.needsUpdate = true;
  }

  private hinten(k: Karte) {
    const c = k.bc.getContext("2d")!, w = 1024, h = 646, L = k.P.look;
    c.clearRect(0, 0, w, h); this.grund(c, L, w, h);
    c.fillStyle = "rgba(255,255,255,.08)"; c.fillRect(0, 70, w, 96);
    c.fillStyle = L.gravur; c.globalAlpha = 0.75; c.font = "500 20px Inter, system-ui, sans-serif"; spaced(c, "UNTERSCHRIFT", 70, 236, 5); c.globalAlpha = 1;
    c.fillStyle = "rgba(255,255,255,.93)"; rrPfad(c, 70, 252, 700, 150, 18); c.fill();
    const q = this.sig;
    if (q && (q.text || q.striche.length)) {
      c.save(); rrPfad(c, 70, 252, 700, 150, 18); c.clip();
      c.strokeStyle = "#1D4ED8"; c.fillStyle = "#1D4ED8"; c.lineCap = "round"; c.lineJoin = "round";
      if (q.text) {
        let fs = 100; c.font = `500 ${fs}px "Dancing Script", cursive`;
        while (c.measureText(q.text).width > 620 && fs > 40) { fs -= 4; c.font = `500 ${fs}px "Dancing Script", cursive`; }
        c.fillText(q.text, 100, 362);
      } else {
        let mnx = 9, mny = 9, mxx = -9, mxy = -9;
        q.striche.forEach((s) => s.forEach((p) => { mnx = Math.min(mnx, p[0]); mny = Math.min(mny, p[1]); mxx = Math.max(mxx, p[0]); mxy = Math.max(mxy, p[1]); }));
        const asp = q.asp || 1.8, bw = Math.max(0.04, mxx - mnx) * asp, bh = Math.max(0.04, mxy - mny);
        const sk = Math.min(620 / bw, 118 / bh), ox = 420 - (bw * sk) / 2, oy = 327 - (bh * sk) / 2;
        q.striche.forEach((s) => {
          for (let j = 1; j < s.length; j++) {
            c.lineWidth = Math.max(4, s[j][2] * 2.4); c.beginPath();
            c.moveTo(ox + (s[j - 1][0] - mnx) * asp * sk, oy + (s[j - 1][1] - mny) * sk);
            c.lineTo(ox + (s[j][0] - mnx) * asp * sk, oy + (s[j][1] - mny) * sk); c.stroke();
          }
        });
      }
      c.restore();
    }
    if (this.stempelText) { c.fillStyle = L.gravur; c.font = "300 26px Inter, system-ui, sans-serif"; c.fillText(this.stempelText, 70, 470); }
    c.fillStyle = L.gravur; c.globalAlpha = 0.6; c.font = "300 34px Inter, system-ui, sans-serif"; spaced(c, "FIAON", w - 70, h - 70, 12, true); c.globalAlpha = 1;
    k.bt.needsUpdate = true;
  }

  private alleZeichnen() { this.karten.forEach((k) => { this.vorne(k); this.hinten(k); }); this.namenSchmutzig = false; this.rueckSchmutzig = false; }

  // ── Größe, Ziele, Schleife ─────────────────────────────────────────────
  private messen() {
    const r = this.buehne.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (w === this.groesse.w && h === this.groesse.h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    const visH = 2 * Math.tan((this.camera.fov * Math.PI) / 360) * this.camera.position.z, visW = visH * this.camera.aspect;
    this.groesse = { w, h, visW, visH, sc: Math.min((visW * 0.74) / W, (visH * 0.84) / H) };
    this.starten();
  }

  private ziele() {
    const sc = this.groesse.sc;
    for (const k of this.karten) {
      const t = k.t; t.y = 0; t.hell = 0;
      if (this.modusArt === "deck") {
        const d = k.i - this.p, ad = Math.abs(d);
        t.x = d * 0.62 * W * sc; t.ry = (-d * 22 * Math.PI) / 180; t.z = -ad * 0.9; t.sc = sc * (1 - Math.min(ad, 1) * 0.14);
        t.sat = 1 - Math.min(1, ad) * 0.45; t.hell = -Math.min(1, ad) * 0.02;
      } else if (k.i === this.aktiv) {
        t.x = 0; t.z = 0; t.ry = this.rueck ? Math.PI : 0; t.sc = sc * (this.gross ? 1.06 : 1); t.sat = this.wartet ? 0.22 : 1;
      } else {
        t.x = (k.i < this.aktiv ? -1 : 1) * this.groesse.visW * 0.9; t.z = -1.2; t.ry = 0; t.sc = 0.0001; t.sat = 0;
      }
    }
  }

  private starten() {
    if (this.beendet || this.laeuft || !this.sichtbar || !this.imBild) return;
    this.laeuft = true; this.letzte = performance.now();
    requestAnimationFrame(this.schritt);
  }

  private schritt = (now: number) => {
    if (this.beendet || !this.sichtbar || !this.imBild) { this.laeuft = false; return; }
    const dt = Math.min(1 / 30, (now - this.letzte) / 1000); this.letzte = now; this.zeit += dt;
    if (this.modusArt === "deck" && !this.ziehen) {
      const a = 260 * (this.pZiel - this.p) - 30 * this.pV; this.pV += a * dt; this.p += this.pV * dt;
    }
    if (this.modusArt === "deck") {
      const i = Math.max(0, Math.min(this.karten.length - 1, Math.round(this.ziehen ? this.p : this.pZiel)));
      if (i !== this.letzterDeckIndex) { this.letzterDeckIndex = i; this.beiDeckIndex(i); }
    }
    this.ziele();
    const ruhig = this.ruhig();
    for (const k of this.karten) {
      (Object.keys(FEDERN) as (keyof Zustand)[]).forEach((key) => {
        const [st, da] = FEDERN[key];
        const acc = st * (k.t[key] - k.s[key]) - da * k.v[key];
        k.v[key] += acc * dt; k.s[key] += k.v[key] * dt;
      });
      // Gerade: keine Neigung, kein Mausnachlauf. Nur ein ganz leichtes Schweben in der Höhe.
      const schweb = !ruhig && this.modusArt !== "deck" && k.i === this.aktiv ? Math.sin(this.zeit * 0.9) * 0.035 : 0;
      k.grp.position.set(k.s.x, k.s.y + schweb, k.s.z);
      k.grp.rotation.set(0, k.s.ry, 0);
      const sc = Math.max(0.0001, k.s.sc); k.grp.scale.set(sc, sc, sc); k.grp.visible = sc > 0.01;
      for (const m of k.mats) { m.userData.uSat.value = Math.max(0, Math.min(1, k.s.sat)); m.userData.uHell.value = k.s.hell; }
    }
    this.glint.intensity *= 0.92; this.warm.intensity *= 0.95;
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.schritt);
  };

  private ziehenBinden() {
    const b = this.buehne;
    const runter = (e: PointerEvent) => {
      if (this.modusArt !== "deck") return;
      this.ziehen = true; this.zieh = { x0: e.clientX, p0: this.p, lx: e.clientX, lt: performance.now(), vx: 0 };
      b.setPointerCapture?.(e.pointerId);
    };
    const bewegen = (e: PointerEvent) => {
      if (!this.ziehen) return;
      const r = b.getBoundingClientRect();
      this.p = Math.max(-0.35, Math.min(this.karten.length - 0.65, this.zieh.p0 - (e.clientX - this.zieh.x0) / (r.width * 0.42)));
      const n = performance.now(); this.zieh.vx = (e.clientX - this.zieh.lx) / Math.max(1, n - this.zieh.lt); this.zieh.lx = e.clientX; this.zieh.lt = n;
    };
    const los = () => {
      if (!this.ziehen) return; this.ziehen = false;
      const r = b.getBoundingClientRect(); const v = (-this.zieh.vx * 1000) / (r.width * 0.42);
      this.pZiel = Math.max(0, Math.min(this.karten.length - 1, Math.round(this.p + v * 0.25))); this.pV = 0;
    };
    b.addEventListener("pointerdown", runter); b.addEventListener("pointermove", bewegen);
    b.addEventListener("pointerup", los); b.addEventListener("pointercancel", los);
    this.aufraeumen.push(() => {
      b.removeEventListener("pointerdown", runter); b.removeEventListener("pointermove", bewegen);
      b.removeEventListener("pointerup", los); b.removeEventListener("pointercancel", los);
    });
  }

  // ── Öffentliche Steuerung ──────────────────────────────────────────────
  modus(m: Modus, o: ModusOptionen = {}) {
    if (this.namenSchmutzig) { this.karten.forEach((k) => this.vorne(k)); this.namenSchmutzig = false; }
    if (this.rueckSchmutzig) { this.karten.forEach((k) => this.hinten(k)); this.rueckSchmutzig = false; }
    const vorher = this.modusArt; this.modusArt = m;
    if (o.aktiv != null) this.aktiv = o.aktiv;
    this.rueck = !!o.rueck; this.wartet = !!o.wartet; this.gross = !!o.gross;
    if (m === "deck" && vorher !== "deck") { this.p = this.pZiel = this.aktiv; this.pV = 0; this.letzterDeckIndex = -1; }
    this.buehne.classList.toggle("an-ziehbar", m === "deck");
    this.starten();
  }
  /** Ohne Übergang in den Zielzustand springen (erstes Bild, Wiederaufnahme). */
  einrasten() {
    this.ziele();
    for (const k of this.karten) { k.s = { ...k.t }; k.v = { ...nullZustand(0), sat: 0 }; }
    this.p = this.pZiel; this.pV = 0;
    this.starten();
  }
  deckGehe(i: number) { this.pZiel = Math.max(0, Math.min(this.karten.length - 1, i)); this.starten(); }
  deckIndex() { return Math.max(0, Math.min(this.karten.length - 1, Math.round(this.modusArt === "deck" ? this.pZiel : this.aktiv))); }
  /** Name neu gravieren (gedrosselt), mit kurzem Lichtfunken. */
  nameNeu() {
    if (this.namenTakt == null) {
      this.namenTakt = window.setTimeout(() => {
        this.namenTakt = null; const k = this.karten[this.aktiv]; if (k) this.vorne(k); this.namenSchmutzig = true;
      }, 40);
    }
    this.glint.position.set((Math.random() - 0.5) * 1.2, -0.6, 2); this.glint.intensity = 6; this.karten[this.aktiv].v.hell += 0.25; this.starten();
  }
  signatur(q: Unterschrift) { this.sig = q; const k = this.karten[this.aktiv]; if (k) this.hinten(k); this.rueckSchmutzig = true; this.starten(); }
  stempel(t: string) { this.stempelText = t; this.karten.forEach((k) => this.hinten(k)); this.starten(); }
  warmLicht() { this.warm.intensity = 9; this.karten[this.aktiv].v.hell += 0.6; this.starten(); }
  funkeln() { this.glint.position.set(-1, 0.4, 2); this.glint.intensity = 8; this.karten[this.aktiv].v.hell += 0.3; this.starten(); }
  /** Ein kurzer Lichtpuls (jede PIN-Ziffer). */
  puls(staerke = 1) { this.glint.position.set((Math.random() - 0.5) * 1.6, 0.2, 2); this.glint.intensity = 3.5 * staerke; this.karten[this.aktiv].v.hell += 0.12 * staerke; this.starten(); }
  /** Eine ganze Drehung um die Hochachse (Ende der Prüfung). */
  drehen() { const k = this.karten[this.aktiv]; k.s.ry -= Math.PI * 2; k.v.ry = 0; this.starten(); }
  einfaerben() { this.wartet = false; this.karten[this.aktiv].v.hell += 0.5; this.warm.intensity = 6; this.starten(); }
  zerstoeren() {
    this.beendet = true;
    this.ro?.disconnect(); this.io?.disconnect();
    this.aufraeumen.forEach((f) => f());
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      mats.forEach((mm) => { const anyM = mm as THREE.MeshPhysicalMaterial; anyM.map?.dispose(); mm.dispose(); });
    });
    this.renderer.dispose();
  }
}
