// ═══════════════════════════════════════════════════════════════════════════
// DIE SZENE HINTER DEM COMMAND-DECK — der Partikel-Humanoid (02.09.2026)
//
// VORHER (30.08.): ein Partikelring mit Drahtkern. NACHHER: ein Wesen aus
// Licht. Justin: „cinematisch, Matrix, richte dich an mein Video (Partikel-
// Humanoid), kein weißer Rand, nicht zu kompliziert." Prototyp vor dem Code:
// 01_Plattform/Prototypen/copilot-humanoid-prototyp_2026-09-02.html — von
// Justin freigegeben („Prototyp passt").
//
// ── WIE DER KÖRPER ENTSTEHT ────────────────────────────────────────────────
// Kein Modell, kein Video: ein Skelett aus 13 Kapseln (Kopf, Hals, Torso,
// Schultern, Arme, Becken, Beine). Jeder Partikel bekommt einen Zielpunkt auf
// der OBERFLÄCHE einer Kapsel (Mantel senkrecht zur Achse oder Kappe) — nur
// Oberfläche, sonst wird die Figur matschig. Beim Laden liegen die Partikel
// als Nebel verstreut und ziehen in gut drei Sekunden an ihren Platz.
//
// ── WIE DAS WESEN REAGIERT ─────────────────────────────────────────────────
//   idle        atmet leise, dreht sich minimal
//   denkt       Partikel am Kopf beginnen zu schwingen, die Brust pulsiert
//   fuehrt_aus  spürbares Flimmern über den ganzen Körper, Glut heller
//   fertig      ein Lichtimpuls aus der Brust, dann Ruhe
//   fehler      kurzes Rotglimmen, dann Ruhe
//
// ── DER MATRIX-GRUND ───────────────────────────────────────────────────────
// Eine zweite, flache Leinwand hinter dem Wesen: ein sehr leiser Zeichenregen
// aus FIAON-Vokabeln (Ziffern, §, Auskunftei-Kürzel, €), 7 % Deckkraft —
// Stimmung, nie im Weg.
//
// ── RÜCKSICHTEN (unverändert aus der ersten Szene) ─────────────────────────
// · prefers-reduced-motion: EIN fertiges Bild (Figur steht sofort), keine
//   Schleife, kein Regen. Bewegung abschalten heißt abschalten (AGENTS.md).
// · Verdeckter Reiter: beide Schleifen pausieren (visibilitychange).
// · Handy: ein Drittel der Partikel, Pixeldichte gedeckelt.
// · Beim Abbau wird alles entsorgt (Geometrie, Materialien, Texturen, Renderer).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef } from "react";
import * as THREE from "three";

export type SzenenZustand = "idle" | "denkt" | "fuehrt_aus" | "fertig" | "fehler";

/** Zielwerte je Zustand — die Schleife gleitet dorthin, nichts springt. */
const ZIELE: Record<SzenenZustand, { tempo: number; zug: number; puls: number; glut: number; rot: number }> = {
  idle:       { tempo: 0.5, zug: 0.0, puls: 0.0, glut: 0.6, rot: 0 },
  denkt:      { tempo: 0.9, zug: 1.0, puls: 1.0, glut: 0.9, rot: 0 },
  fuehrt_aus: { tempo: 2.2, zug: 0.3, puls: 0.4, glut: 1.2, rot: 0 },
  fertig:     { tempo: 0.6, zug: 0.0, puls: 0.0, glut: 2.2, rot: 0 },
  fehler:     { tempo: 0.4, zug: 0.0, puls: 0.3, glut: 0.9, rot: 1 },
};

/** Eine Kapsel des Skeletts: Strecke a→b mit Radius r. Maße in Szenen-Einheiten, Figur ≈ 3,7 hoch. */
interface Kapsel { a: THREE.Vector3; b: THREE.Vector3; r: number }
const kapsel = (a: [number, number, number], b: [number, number, number], r: number): Kapsel =>
  ({ a: new THREE.Vector3(...a), b: new THREE.Vector3(...b), r });

const SKELETT: Kapsel[] = [
  kapsel([0, 1.75, 0], [0, 1.75, 0], 0.34),           // Kopf
  kapsel([0, 1.42, 0], [0, 1.28, 0], 0.11),           // Hals
  kapsel([0, 1.22, 0], [0, 0.35, 0], 0.38),           // Torso
  kapsel([-0.46, 1.2, 0], [0.46, 1.2, 0], 0.17),      // Schultern
  kapsel([-0.6, 1.14, 0], [-0.78, 0.4, 0.1], 0.1),    // Oberarm links
  kapsel([0.6, 1.14, 0], [0.78, 0.4, 0.1], 0.1),      // Oberarm rechts
  kapsel([-0.78, 0.4, 0.1], [-0.62, -0.1, 0.34], 0.085), // Unterarm links
  kapsel([0.78, 0.4, 0.1], [0.62, -0.1, 0.34], 0.085),   // Unterarm rechts
  kapsel([0, 0.35, 0], [0, 0.05, 0], 0.3),            // Becken
  kapsel([-0.2, 0, 0], [-0.24, -1.05, 0], 0.14),      // Oberschenkel links
  kapsel([0.2, 0, 0], [0.24, -1.05, 0], 0.14),        // Oberschenkel rechts
  kapsel([-0.24, -1.05, 0], [-0.26, -1.9, 0.05], 0.11), // Unterschenkel links
  kapsel([0.24, -1.05, 0], [0.26, -1.9, 0.05], 0.11),   // Unterschenkel rechts
];

/** Der Zeichenregen: FIAON-Vokabeln, nichts Fremdes. */
const REGEN_ZEICHEN = "§0123456789DSGVOBDSGKSVCRIF€%";

export default function AssistentSzene({ zustand }: { zustand: SzenenZustand }) {
  const halter = useRef<HTMLDivElement | null>(null);
  const regenRef = useRef<HTMLCanvasElement | null>(null);
  const zustandRef = useRef<SzenenZustand>(zustand);
  const impulsRef = useRef(0);

  useEffect(() => {
    // „fertig" und „fehler" sind MOMENTE — der Impuls klingt in der Schleife ab.
    if (zustand === "fertig" || zustand === "fehler") impulsRef.current = 1;
    zustandRef.current = zustand;
  }, [zustand]);

  useEffect(() => {
    const wurzel = halter.current;
    const regenLeinwand = regenRef.current;
    if (!wurzel || !regenLeinwand) return;

    const ruhig = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const schmal = wurzel.clientWidth < 640;
    const anzahl = schmal ? 9000 : 26000;

    // ── Die 3D-Bühne ────────────────────────────────────────────────────────
    const szene = new THREE.Scene();
    const kamera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    // Brustbild: Kopf oben, Brust in der Mitte, die Beine laufen unter dem Schleier aus.
    kamera.position.set(0, 1.05, schmal ? 6.4 : 5.2);
    kamera.lookAt(0, 0.95, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, schmal ? 1.25 : 1.6));
    renderer.setClearColor(0x000000, 0);
    wurzel.appendChild(renderer.domElement);

    // Zufällige Richtung auf der Einheitskugel.
    const tmp = new THREE.Vector3();
    const ab = new THREE.Vector3();
    const achse = new THREE.Vector3();
    const zufallRichtung = (v: THREE.Vector3) => {
      const phi = Math.random() * Math.PI * 2;
      const u = Math.random() * 2 - 1;
      const q = Math.sqrt(1 - u * u);
      return v.set(Math.cos(phi) * q, u, Math.sin(phi) * q);
    };
    // Ein Punkt auf der OBERFLÄCHE einer Kapsel — Mantel oder Kappe, nach Fläche gewichtet.
    const punktAuf = (k: Kapsel): THREE.Vector3 => {
      ab.subVectors(k.b, k.a);
      const laenge = ab.length();
      const r = k.r * (0.94 + Math.random() * 0.06);
      const mantel = 2 * Math.PI * k.r * laenge;
      const kappen = 4 * Math.PI * k.r * k.r;
      if (laenge === 0 || Math.random() < kappen / (mantel + kappen)) {
        const m = Math.random() < 0.5 ? k.a : k.b;
        return m.clone().addScaledVector(zufallRichtung(tmp), r);
      }
      achse.copy(ab).normalize();
      zufallRichtung(tmp);
      tmp.addScaledVector(achse, -tmp.dot(achse)).normalize();
      return k.a.clone().addScaledVector(achse, Math.random() * laenge).addScaledVector(tmp, r);
    };

    // Partikel auf die Kapseln verteilen — große Teile bekommen mehr.
    const gewichte = SKELETT.map((k) => k.r * (k.a.distanceTo(k.b) + k.r));
    const summe = gewichte.reduce((a, b) => a + b, 0);
    const ziel = new Float32Array(anzahl * 3);
    const positionen = new Float32Array(anzahl * 3);
    const samen = new Float32Array(anzahl);
    for (let i = 0; i < anzahl; i += 1) {
      let rest = Math.random() * summe;
      let idx = 0;
      while (rest > gewichte[idx] && idx < SKELETT.length - 1) { rest -= gewichte[idx]; idx += 1; }
      const p = punktAuf(SKELETT[idx]);
      ziel[i * 3] = p.x; ziel[i * 3 + 1] = p.y + 0.05; ziel[i * 3 + 2] = p.z;
      // Start als Nebel — daraus entsteht der Körper. Bei reduzierter Bewegung steht er sofort.
      if (ruhig) {
        positionen[i * 3] = ziel[i * 3]; positionen[i * 3 + 1] = ziel[i * 3 + 1]; positionen[i * 3 + 2] = ziel[i * 3 + 2];
      } else {
        positionen[i * 3] = (Math.random() - 0.5) * 8;
        positionen[i * 3 + 1] = (Math.random() - 0.5) * 6 + 0.8;
        positionen[i * 3 + 2] = (Math.random() - 0.5) * 4;
      }
      samen[i] = Math.random();
    }
    const geometrie = new THREE.BufferGeometry();
    geometrie.setAttribute("position", new THREE.BufferAttribute(positionen, 3));
    const punktMaterial = new THREE.PointsMaterial({
      color: new THREE.Color("#5aa0ff"),
      size: schmal ? 0.022 : 0.016,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    const punkte = new THREE.Points(geometrie, punktMaterial);
    szene.add(punkte);

    // Die Glut in der Brust: weiche Leuchtscheibe, keine harte Kugel.
    const glutLeinwand = document.createElement("canvas");
    glutLeinwand.width = 128; glutLeinwand.height = 128;
    const gl2d = glutLeinwand.getContext("2d");
    if (gl2d) {
      const verlauf = gl2d.createRadialGradient(64, 64, 0, 64, 64, 64);
      verlauf.addColorStop(0, "rgba(255,255,255,.95)");
      verlauf.addColorStop(0.18, "rgba(160,205,255,.7)");
      verlauf.addColorStop(0.5, "rgba(60,120,255,.18)");
      verlauf.addColorStop(1, "rgba(0,0,0,0)");
      gl2d.fillStyle = verlauf;
      gl2d.fillRect(0, 0, 128, 128);
    }
    const glutTextur = new THREE.CanvasTexture(glutLeinwand);
    const glutMaterial = new THREE.SpriteMaterial({ map: glutTextur, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9 });
    const glut = new THREE.Sprite(glutMaterial);
    glut.position.set(0, 0.95, 0.3);
    glut.scale.setScalar(0.6);
    szene.add(glut);

    const blau = new THREE.Color("#5aa0ff");
    const rotTon = new THREE.Color("#ff5a6a");
    const farbe = new THREE.Color();

    // ── Der Matrix-Grund (2D) ───────────────────────────────────────────────
    const regen = regenLeinwand.getContext("2d");
    const schrift = 14;
    let spalten: number[] = [];
    const regenMessen = () => {
      regenLeinwand.width = wurzel.clientWidth || 1;
      regenLeinwand.height = wurzel.clientHeight || 1;
      spalten = Array.from({ length: Math.floor(regenLeinwand.width / schrift) }, () => Math.random() * regenLeinwand.height / schrift);
    };
    const regenBild = () => {
      if (!regen) return;
      const b = regenLeinwand.width, h = regenLeinwand.height;
      regen.fillStyle = "rgba(3,8,22,.12)";
      regen.fillRect(0, 0, b, h);
      regen.fillStyle = "#5b9bff";
      regen.font = `${schrift}px ui-monospace, Menlo, monospace`;
      for (let i = 0; i < spalten.length; i += 1) {
        const z = REGEN_ZEICHEN[Math.floor(Math.random() * REGEN_ZEICHEN.length)];
        regen.fillText(z, i * schrift, spalten[i] * schrift);
        if (spalten[i] * schrift > h && Math.random() > 0.985) spalten[i] = 0;
        spalten[i] += 0.35;
      }
    };

    const messen = () => {
      const b = wurzel.clientWidth || 1;
      const h = wurzel.clientHeight || 1;
      renderer.setSize(b, h, false);
      kamera.aspect = b / h;
      kamera.updateProjectionMatrix();
      regenMessen();
    };
    messen();

    // Weiche Ist-Werte, die je Bild Richtung Ziel gleiten.
    const ist = { ...ZIELE.idle };
    const start = performance.now();
    let letztes = start;
    let raf = 0;
    let laeuft = true;

    const bild = (jetzt: number) => {
      const dt = Math.min(0.05, (jetzt - letztes) / 1000);
      letztes = jetzt;
      const t = (jetzt - start) / 1000;
      const zielWerte = ZIELE[zustandRef.current];
      const gleiten = (a: number, b: number, k: number) => a + (b - a) * Math.min(1, k * dt);
      ist.tempo = gleiten(ist.tempo, zielWerte.tempo, 2.4);
      ist.zug = gleiten(ist.zug, zielWerte.zug, 2.4);
      ist.puls = gleiten(ist.puls, zielWerte.puls, 2.4);
      ist.glut = gleiten(ist.glut, zielWerte.glut, 2.4);
      ist.rot = gleiten(ist.rot, zielWerte.rot, 3);
      impulsRef.current = Math.max(0, impulsRef.current - dt * 0.9);
      const impuls = impulsRef.current;

      // Entstehen aus dem Nebel: in 3,2 Sekunden von 0 auf 1. Bei Ruhe sofort 1.
      const einl = ruhig ? 1 : Math.min(1, t / 3.2);
      const atem = Math.sin(t * 1.4) * 0.012;
      const p = geometrie.attributes.position.array as Float32Array;
      for (let i = 0; i < anzahl; i += 1) {
        const j = i * 3;
        const s = samen[i];
        let tx = ziel[j];
        let ty = ziel[j + 1] + atem * (1 + s);
        let tz = ziel[j + 2];
        if (ist.zug > 0.01) {
          const kopf = Math.max(0, 1 - Math.abs(ty - 1.6));
          ty += ist.zug * 0.12 * kopf * Math.sin(t * 6 + s * 20);
        }
        const flimmer = ist.tempo * 0.006 * Math.sin(t * (2 + s * 6) + s * 40);
        tx += flimmer; tz += flimmer * 0.6;
        const k = 0.06 + 0.08 * einl;
        p[j] += (tx - p[j]) * k * einl;
        p[j + 1] += (ty - p[j + 1]) * k * einl;
        p[j + 2] += (tz - p[j + 2]) * k * einl;
      }
      geometrie.attributes.position.needsUpdate = true;
      punkte.rotation.y = Math.sin(t * 0.25) * 0.35;

      farbe.copy(blau).lerp(rotTon, ist.rot);
      punktMaterial.color.copy(farbe);
      punktMaterial.opacity = 0.7 + 0.25 * einl + impuls * 0.3;
      glutMaterial.color.copy(farbe);
      glut.scale.setScalar(0.45 * ist.glut * (1 + ist.puls * 0.25 * Math.sin(t * 5)) + impuls * 1.2);
      glutMaterial.opacity = 0.6 + 0.3 * Math.min(1, ist.glut / 2) + impuls * 0.4;

      renderer.render(szene, kamera);
      if (!ruhig) regenBild();
      if (laeuft && !ruhig) raf = requestAnimationFrame(bild);
    };

    // Reduzierte Bewegung: genau EIN Bild, dann Stille.
    raf = requestAnimationFrame(bild);

    const sichtbarkeit = () => {
      if (ruhig) return;
      if (document.visibilityState === "hidden") {
        laeuft = false;
        cancelAnimationFrame(raf);
      } else if (!laeuft) {
        laeuft = true;
        letztes = performance.now();
        raf = requestAnimationFrame(bild);
      }
    };
    document.addEventListener("visibilitychange", sichtbarkeit);

    const beobachter = new ResizeObserver(messen);
    beobachter.observe(wurzel);

    return () => {
      laeuft = false;
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", sichtbarkeit);
      beobachter.disconnect();
      geometrie.dispose();
      punktMaterial.dispose();
      glutTextur.dispose();
      glutMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
    // Die Szene wird EINMAL gebaut; Zustände fließen über zustandRef hinein.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={halter} className="asx-szene" aria-hidden="true" data-fiaon="assistent-szene">
      <canvas ref={regenRef} className="asx-matrix" />
    </div>
  );
}
