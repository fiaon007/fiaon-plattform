// ═══════════════════════════════════════════════════════════════════════════
// DIE SZENE HINTER DEM COMMAND-DECK — ein ruhiges FIAON-Objekt (30.08.2026)
//
// Ein Partikelring in den Hausfarben (#2563eb-Licht auf Nachtblau) mit einem
// langsam rotierenden Drahtkern. Die Szene REAGIERT auf den Zustand des
// Assistenten, statt nur zu dekorieren:
//
//   idle        ruhiges Treiben, kaum Bewegung
//   denkt       der Kern pulsiert, die Partikel ziehen zur Mitte
//   fuehrt_aus  die Umlaufbahn beschleunigt spürbar
//   fertig      ein heller Lichtimpuls, dann zurück zur Ruhe
//   fehler      ein kurzes rotes Glimmen, dann zurück zur Ruhe
//
// ── RÜCKSICHTEN ────────────────────────────────────────────────────────────
// · prefers-reduced-motion: EIN statisches Bild, keine Schleife — Bewegung
//   abschalten heißt abschalten, nicht drosseln (AGENTS.md).
// · Verdeckter Reiter: die Schleife pausiert (visibilitychange).
// · Handy: weniger Partikel, Pixeldichte gedeckelt — die Szene degradiert,
//   statt das Telefon aufzuheizen.
// · Beim Abbau wird alles entsorgt (Geometrie, Material, Renderer).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef } from "react";
import * as THREE from "three";

export type SzenenZustand = "idle" | "denkt" | "fuehrt_aus" | "fertig" | "fehler";

/** Zielwerte je Zustand — die Schleife gleitet dorthin, nichts springt. */
const ZIELE: Record<SzenenZustand, { tempo: number; puls: number; zug: number; glut: number; rot: number }> = {
  idle:       { tempo: 0.055, puls: 0.00, zug: 0.00, glut: 0.55, rot: 0 },
  denkt:      { tempo: 0.085, puls: 1.00, zug: 0.55, glut: 0.75, rot: 0 },
  fuehrt_aus: { tempo: 0.420, puls: 0.35, zug: 0.15, glut: 0.95, rot: 0 },
  fertig:     { tempo: 0.075, puls: 0.00, zug: 0.00, glut: 1.60, rot: 0 },
  fehler:     { tempo: 0.045, puls: 0.20, zug: 0.00, glut: 0.85, rot: 1 },
};

export default function AssistentSzene({ zustand }: { zustand: SzenenZustand }) {
  const halter = useRef<HTMLDivElement | null>(null);
  const zustandRef = useRef<SzenenZustand>(zustand);
  const impulsRef = useRef(0);

  useEffect(() => {
    // Ein Zustandswechsel zu „fertig" oder „fehler" ist ein MOMENT, kein
    // Dauerzustand — der Impuls klingt in der Schleife von selbst ab.
    if (zustand === "fertig" || zustand === "fehler") impulsRef.current = 1;
    zustandRef.current = zustand;
  }, [zustand]);

  useEffect(() => {
    const wurzel = halter.current;
    if (!wurzel) return;

    const ruhig = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const schmal = wurzel.clientWidth < 640;
    const anzahl = schmal ? 420 : 950;

    const szene = new THREE.Scene();
    const kamera = new THREE.PerspectiveCamera(52, 1, 0.1, 60);
    kamera.position.set(0, 0.6, 7.2);
    kamera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, schmal ? 1.5 : 2));
    renderer.setClearColor(0x000000, 0);
    wurzel.appendChild(renderer.domElement);

    // ── Der Partikelring ────────────────────────────────────────────────────
    // Je Partikel: Grundradius, Winkel, Höhenversatz, Eigentempo. Die Schleife
    // rechnet Positionen je Bild — so kann der „zug" die Bahn zur Mitte ziehen.
    const grund = new Float32Array(anzahl * 4);
    for (let i = 0; i < anzahl; i += 1) {
      grund[i * 4] = 2.1 + Math.random() * 1.5;                    // Radius
      grund[i * 4 + 1] = Math.random() * Math.PI * 2;              // Winkel
      grund[i * 4 + 2] = (Math.random() - 0.5) * 0.9;              // Höhe
      grund[i * 4 + 3] = 0.55 + Math.random() * 0.9;               // Eigentempo
    }
    const positionen = new Float32Array(anzahl * 3);
    const geometrie = new THREE.BufferGeometry();
    geometrie.setAttribute("position", new THREE.BufferAttribute(positionen, 3));
    const punktMaterial = new THREE.PointsMaterial({
      color: new THREE.Color("#60a5fa"),
      size: schmal ? 0.035 : 0.028,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const punkte = new THREE.Points(geometrie, punktMaterial);
    punkte.rotation.x = 0.42;
    szene.add(punkte);

    // ── Der Kern: ein Drahtkörper mit innerem Licht ─────────────────────────
    const kernGeometrie = new THREE.IcosahedronGeometry(0.92, 1);
    const kernMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#2563eb"), wireframe: true, transparent: true, opacity: 0.5,
    });
    const kern = new THREE.Mesh(kernGeometrie, kernMaterial);
    szene.add(kern);

    const scheinGeometrie = new THREE.SphereGeometry(0.55, 24, 24);
    const scheinMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#7fb2ff"), transparent: true, opacity: 0.28,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const schein = new THREE.Mesh(scheinGeometrie, scheinMaterial);
    szene.add(schein);

    const blau = new THREE.Color("#60a5fa");
    const blauKern = new THREE.Color("#2563eb");
    const rotTon = new THREE.Color("#f87171");
    const rotKern = new THREE.Color("#dc2626");

    const messen = () => {
      const b = wurzel.clientWidth || 1;
      const h = wurzel.clientHeight || 1;
      renderer.setSize(b, h, false);
      kamera.aspect = b / h;
      kamera.updateProjectionMatrix();
    };
    messen();

    // Die weichen Ist-Werte, die je Bild Richtung Ziel gleiten.
    const ist = { tempo: ZIELE.idle.tempo, puls: 0, zug: 0, glut: ZIELE.idle.glut, rot: 0 };
    let winkel = 0;
    let letztes = performance.now();
    let raf = 0;
    let laeuft = true;

    const bild = (jetzt: number) => {
      const dt = Math.min(0.05, (jetzt - letztes) / 1000);
      letztes = jetzt;
      const ziel = ZIELE[zustandRef.current];

      // Impuls (fertig/fehler) klingt ab — 1 → 0 in gut zwei Sekunden.
      impulsRef.current = Math.max(0, impulsRef.current - dt * 0.45);
      const impuls = impulsRef.current;

      const gleiten = (a: number, b: number, k: number) => a + (b - a) * Math.min(1, k * dt);
      ist.tempo = gleiten(ist.tempo, ziel.tempo, 3.2);
      ist.puls = gleiten(ist.puls, ziel.puls, 4);
      ist.zug = gleiten(ist.zug, ziel.zug, 3);
      ist.glut = gleiten(ist.glut, ziel.glut + impuls * 1.1, 4);
      ist.rot = gleiten(ist.rot, ziel.rot * Math.max(impuls, 0.35), 5);

      winkel += dt * ist.tempo * Math.PI * 2 * 0.22;

      const t = jetzt / 1000;
      for (let i = 0; i < anzahl; i += 1) {
        const radius = grund[i * 4] * (1 - ist.zug * 0.45);
        const eigen = grund[i * 4 + 3];
        const a = grund[i * 4 + 1] + winkel * eigen;
        const hoehe = grund[i * 4 + 2] * (1 - ist.zug * 0.5) + Math.sin(t * eigen + i) * 0.05;
        positionen[i * 3] = Math.cos(a) * radius;
        positionen[i * 3 + 1] = hoehe;
        positionen[i * 3 + 2] = Math.sin(a) * radius;
      }
      geometrie.attributes.position.needsUpdate = true;

      const pulsWert = 1 + Math.sin(t * 3.1) * 0.08 * ist.puls + impuls * 0.16;
      kern.scale.setScalar(pulsWert);
      schein.scale.setScalar(pulsWert * (1 + impuls * 0.9));
      kern.rotation.y += dt * (0.25 + ist.tempo);
      kern.rotation.x += dt * 0.11;

      punktMaterial.color.copy(blau).lerp(rotTon, ist.rot);
      kernMaterial.color.copy(blauKern).lerp(rotKern, ist.rot);
      scheinMaterial.color.copy(blau).lerp(rotTon, ist.rot);
      punktMaterial.opacity = 0.55 + 0.35 * ist.glut;
      scheinMaterial.opacity = 0.16 + 0.3 * ist.glut;
      kernMaterial.opacity = 0.32 + 0.3 * ist.glut;

      renderer.render(szene, kamera);
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
      kernGeometrie.dispose();
      kernMaterial.dispose();
      scheinGeometrie.dispose();
      scheinMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
    // Die Szene wird EINMAL gebaut; Zustände fließen über zustandRef hinein.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={halter} className="asx-szene" aria-hidden="true" data-fiaon="assistent-szene" />;
}
