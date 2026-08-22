import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { umgebungslicht, leuchtTextur, BLAU, BLAU_HELL } from "./umgebung";

/*
  SchichtenSzene — drei Glasplatten übereinander: Einsicht · Aktion · Zugang.
  Die Platten drehen sich langsam als Stapel, jede trägt ihren Namen.
  Für den Datenraum (Kapitel) und überall, wo „Struktur" gezeigt werden soll.
*/
function beschriftung(text: string, nummer: string): THREE.Texture {
  const w = 1024, h = 640;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = "500 56px Inter, -apple-system, sans-serif";
  ctx.fillText(text, 72, 140);
  ctx.fillStyle = "rgba(147,197,253,0.9)";
  ctx.font = "500 30px Inter, -apple-system, sans-serif";
  ctx.fillText(nummer, 72, 190);
  // Linien als Inhalt
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i === 0 ? "rgba(255,255,255,0.55)" : "rgba(147,197,253,0.35)";
    ctx.fillRect(72, 300 + i * 64, 520 - i * 110, 16);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default function SchichtenSzene({ namen = ["Einsicht", "Aktion", "Zugang"], className = "" }: { namen?: string[]; className?: string }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isMobile = window.innerWidth < 768;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 40);
    camera.position.set(0, 1.4, 6.2);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    mount.appendChild(renderer.domElement);
    Object.assign(renderer.domElement.style, { width: "100%", height: "100%", display: "block" });

    const umgebung = umgebungslicht(renderer);
    scene.environment = umgebung;
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(2, 5, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x2563eb, 2.2);
    rim.position.set(-4, 1, -3);
    scene.add(rim);

    const group = new THREE.Group();
    group.rotation.x = 0.25;
    scene.add(group);

    const platten: THREE.Group[] = [];
    namen.forEach((name, i) => {
      const p = new THREE.Group();
      const geo = new RoundedBoxGeometry(3.2, 0.08, 2.0, 3, 0.1);
      const glas = new THREE.MeshPhysicalMaterial({
        color: i === 1 ? BLAU : "#1e3a8a",
        metalness: 0.2,
        roughness: 0.12,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
        transparent: true,
        opacity: 0.42,
        envMapIntensity: 1.2,
      });
      const platte = new THREE.Mesh(geo, glas);
      p.add(platte);
      const kante = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(3.2, 0.08, 2.0)), new THREE.LineBasicMaterial({ color: new THREE.Color(BLAU_HELL), transparent: true, opacity: 0.55 }));
      p.add(kante);
      const text = new THREE.Mesh(
        new THREE.PlaneGeometry(3.0, 1.875),
        new THREE.MeshBasicMaterial({ map: beschriftung(name, `0${i + 1}`), transparent: true, depthWrite: false })
      );
      text.rotation.x = -Math.PI / 2;
      text.position.y = 0.05;
      p.add(text);
      p.position.y = (1 - i) * 0.95;
      group.add(p);
      platten.push(p);
    });

    // Lichtsäule durch die Schichten
    const saeule = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 3.4, 16),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(BLAU_HELL), transparent: true, opacity: 0.7 })
    );
    saeule.position.set(-1.2, 0, 0.5);
    group.add(saeule);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: leuchtTextur("#3b82f6"), transparent: true, opacity: 0.5, depthWrite: false }));
    glow.scale.setScalar(5);
    glow.position.z = -1.5;
    scene.add(glow);

    const resize = () => {
      const w = mount.clientWidth || 1, h = mount.clientHeight || 1;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    let tx = 0;
    const onPointer = (e: PointerEvent) => { tx = ((e.clientX / window.innerWidth) * 2 - 1) * 0.4; };
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
      group.rotation.y += (tx + t * 0.12 - group.rotation.y) * 0.06;
      platten.forEach((p, i) => {
        p.position.y = (1 - i) * 0.95 + Math.sin(t * 0.9 + i * 1.3) * 0.06;
      });
      renderer.render(scene, camera);
    };
    // Erstes Bild sofort — auch wenn der Tab im Hintergrund liegt (document.hidden),
    // sonst bleibt die Fläche leer, bis der Tab einmal sichtbar war.
    renderer.render(scene, camera);
    if (!reduced) tick();

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
  }, [namen.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={mountRef} className={className} aria-hidden="true" />;
}
