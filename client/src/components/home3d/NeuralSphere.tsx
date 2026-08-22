import { useEffect, useRef } from "react";
import * as THREE from "three";
import { umgebungslicht, leuchtTextur, BLAU } from "./umgebung";
import { gehirnBauen } from "./Gehirn";

/*
  NeuralSphere — seit 22.08.2026 das KI-Hirn (Justin: kein Globus, keine Kugel).
  Der Name bleibt, damit alle Seiten weiter funktionieren.
  variant="hero"  → lebendig: Partikel strömen hinein, schnellere Ströme
  variant="calm"  → ruhig, als Hintergrund des Abschlusses
*/
interface NeuralSphereProps {
  variant?: "hero" | "calm";
  className?: string;
}

export default function NeuralSphere({ variant = "hero", className = "" }: NeuralSphereProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isMobile = window.innerWidth < 768;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 60);
    camera.position.set(0, 0.15, 5.4);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1;
    mount.appendChild(renderer.domElement);
    Object.assign(renderer.domElement.style, { width: "100%", height: "100%", display: "block" });

    const umgebung = umgebungslicht(renderer);
    scene.environment = umgebung;
    scene.add(new THREE.AmbientLight(0xffffff, 0.25));
    const key = new THREE.DirectionalLight(0xdbeafe, 1.2);
    key.position.set(3, 4, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x2563eb, 2.4);
    rim.position.set(-4, -1, -3);
    scene.add(rim);

    const group = new THREE.Group();
    scene.add(group);
    const hirn = gehirnBauen({ knoten: isMobile ? 420 : 760, stroeme: isMobile ? 70 : 150, massstab: 1.35, ruhig: variant === "calm" });
    group.add(hirn.group);

    /* ── Partikel, die von außen hineinströmen (Chaos rein, Klarheit raus) ── */
    const P = reduced ? 0 : isMobile ? 160 : 320;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(P * 3);
    const pDat: { dir: THREE.Vector3; dist: number; v: number }[] = [];
    const spawn = (i: number) => {
      const dir = new THREE.Vector3().randomDirection();
      pDat[i] = { dir, dist: 2.6 + Math.random() * 2.6, v: 0.3 + Math.random() * 0.5 };
    };
    for (let i = 0; i < P; i++) spawn(i);
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    const partikel = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.05, map: leuchtTextur("#3b82f6"), transparent: true, opacity: variant === "calm" ? 0.3 : 0.5, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(BLAU) }));
    if (P > 0) scene.add(partikel);

    const resize = () => {
      const w = mount.clientWidth || 1, h = mount.clientHeight || 1;
      camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h, false);
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(mount);

    let tx = 0, ty = 0;
    const onPointer = (e: PointerEvent) => { tx = ((e.clientX / window.innerWidth) * 2 - 1) * 0.4; ty = ((e.clientY / window.innerHeight) * 2 - 1) * 0.22; };
    if (!isMobile && !reduced) window.addEventListener("pointermove", onPointer, { passive: true });
    let scrollOffset = 0;
    const onScroll = () => { const r = mount.getBoundingClientRect(); scrollOffset = (r.top + r.height / 2 - window.innerHeight / 2) / window.innerHeight; };
    window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
    let visible = true;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.02 }); io.observe(mount);

    const clock = new THREE.Clock();
    const tempo = variant === "calm" ? 0.1 : 0.16;
    let spin = 0, px = 0, raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!visible || document.hidden) return;
      const t = clock.getElapsedTime();
      const dt = Math.min(clock.getDelta() + 0.016, 0.05);
      spin += tempo * 0.016;
      px += (tx - px) * 0.04;
      group.rotation.y = spin + px;
      group.rotation.x += (ty * 0.6 + scrollOffset * 0.3 - group.rotation.x) * 0.04;
      group.position.y = Math.sin(t * 0.6) * 0.06;
      hirn.tick(t, dt);
      if (P > 0) {
        for (let i = 0; i < P; i++) {
          const d = pDat[i];
          d.dist -= d.v * dt * (variant === "calm" ? 0.5 : 1);
          if (d.dist < 1.4) spawn(i);
          pPos[i * 3] = d.dir.x * d.dist; pPos[i * 3 + 1] = d.dir.y * d.dist; pPos[i * 3 + 2] = d.dir.z * d.dist;
        }
        pGeo.attributes.position.needsUpdate = true;
      }
      renderer.render(scene, camera);
    };
    renderer.render(scene, camera);
    if (!reduced) tick();

    return () => {
      cancelAnimationFrame(raf); io.disconnect(); ro.disconnect();
      window.removeEventListener("pointermove", onPointer); window.removeEventListener("scroll", onScroll);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else if (mat) mat.dispose();
      });
      umgebung.dispose(); renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, [variant]);

  return <div ref={mountRef} className={className} aria-hidden="true" />;
}
