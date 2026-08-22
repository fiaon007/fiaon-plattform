import { useEffect, useRef } from "react";
import * as THREE from "three";
import { umgebungslicht, leuchtTextur, karteBauen } from "./umgebung";

/*
  KartenSzene — ein oder zwei FIAON-Karten im Raum.
  Echter Körper (abgerundet, Lack, Metall, Raumlicht), folgt der Maus,
  schwebt leicht. Für dunkle und helle Hintergründe geeignet (transparent).
  anzahl=2: vordere Karte blau (der Kunde), hintere Karte tinte (der Partner).
*/
export default function KartenSzene({ anzahl = 1, className = "" }: { anzahl?: 1 | 2; className?: string }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isMobile = window.innerWidth < 768;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 40);
    camera.position.set(0, 0.15, 5.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    mount.appendChild(renderer.domElement);
    Object.assign(renderer.domElement.style, { width: "100%", height: "100%", display: "block" });

    const umgebung = umgebungslicht(renderer);
    scene.environment = umgebung;
    scene.add(new THREE.AmbientLight(0xffffff, 0.45));
    const key = new THREE.DirectionalLight(0xffffff, 2.6);
    key.position.set(3, 5, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x60a5fa, 2);
    rim.position.set(-4, -1, -2);
    scene.add(rim);

    const group = new THREE.Group();
    scene.add(group);

    const vorne = karteBauen(2.5, "blau");
    group.add(vorne);
    let hinten: THREE.Mesh | null = null;
    if (anzahl === 2) {
      hinten = karteBauen(2.5, "tinte");
      hinten.position.set(0.55, 0.45, -0.9);
      hinten.rotation.set(0.05, -0.35, 0.12);
      group.add(hinten);
    }

    // weiches Licht unter der Karte
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: leuchtTextur("#2563eb"), transparent: true, opacity: 0.55, depthWrite: false }));
    glow.scale.set(4.6, 2.2, 1);
    glow.position.set(0, -1.25, -0.6);
    scene.add(glow);

    // Partikel ringsum
    const P = reduced ? 0 : isMobile ? 60 : 120;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(P * 3);
    for (let i = 0; i < P; i++) {
      pPos[i * 3] = (Math.random() - 0.5) * 7;
      pPos[i * 3 + 1] = (Math.random() - 0.5) * 4.5;
      pPos[i * 3 + 2] = -1.5 - Math.random() * 3;
    }
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    const punkte = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.06, map: leuchtTextur("#60a5fa"), transparent: true, opacity: 0.5, depthWrite: false, color: new THREE.Color("#3b82f6") }));
    if (P > 0) scene.add(punkte);

    const resize = () => {
      const w = mount.clientWidth || 1, h = mount.clientHeight || 1;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    let tx = 0, ty = 0;
    const onPointer = (e: PointerEvent) => {
      tx = ((e.clientX / window.innerWidth) * 2 - 1) * 0.45;
      ty = ((e.clientY / window.innerHeight) * 2 - 1) * 0.25;
    };
    if (!isMobile && !reduced) window.addEventListener("pointermove", onPointer, { passive: true });

    let visible = true;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.02 });
    io.observe(mount);

    const clock = new THREE.Clock();
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!visible || document.hidden) return;
      const t = clock.getElapsedTime();
      group.rotation.y += (tx + Math.sin(t * 0.35) * 0.28 - group.rotation.y) * 0.05;
      group.rotation.x += (ty * 0.6 + Math.sin(t * 0.5) * 0.08 - 0.08 - group.rotation.x) * 0.05;
      group.position.y = Math.sin(t * 0.8) * 0.06;
      if (hinten) hinten.position.y = 0.45 + Math.sin(t * 0.7 + 1) * 0.05;
      if (P > 0) punkte.rotation.y = t * 0.02;
      renderer.render(scene, camera);
    };
    if (reduced) renderer.render(scene, camera); else tick();

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("pointermove", onPointer);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else if (mat) mat.dispose();
      });
      umgebung.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, [anzahl]);

  return <div ref={mountRef} className={className} aria-hidden="true" />;
}
