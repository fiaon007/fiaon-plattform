// ═══════════════════════════════════════════════════════════════════════════
// HirnVideo — seit 23.08. die Weltkugel als Hologramm (Name bleibt) (22.08.2026)
//
// Das Hirn wird von Higgsfield gerendert (rotierend, pulsierend, auf reinem
// Schwarz). Hier liegt es als Videotextur ADDITIV auf einer Ebene in einer
// durchsichtigen WebGL-Fläche: Schwarz addiert nichts → unsichtbar, das Hirn
// schwebt frei über jeder Bühne. (CSS mix-blend-mode scheiterte an den
// Stapelkontexten der Seite — dort blieb ein schwarzes Quadrat.)
// Dazu eine weiche Aura, leichtes Schweben und Neigung zur Maus.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { leuchtTextur } from "./umgebung";

export default function HirnVideo({ className = "", ruhig = false }: { className?: string; ruhig?: boolean }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current; if (!mount) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isMobile = window.innerWidth < 768;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
    camera.position.set(0, 0, 5);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);
    Object.assign(renderer.domElement.style, { width: "100%", height: "100%", display: "block" });

    const video = document.createElement("video");
    video.src = "/kino/kugel.mp4"; video.poster = "/kino/kugel.jpg";
    video.muted = true; video.loop = true; video.playsInline = true; video.preload = "auto";
    video.setAttribute("muted", ""); video.setAttribute("playsinline", "");
    const tex = new THREE.VideoTexture(video);
    tex.colorSpace = THREE.SRGBColorSpace;

    // Poster sofort, Video sobald es läuft — beide additiv
    // Sobald das Poster da ist, einmal zeichnen — auch wenn der Tab gerade im Hintergrund liegt.
    const poster = new THREE.TextureLoader().load("/kino/kugel.jpg", (t) => { t.colorSpace = THREE.SRGBColorSpace; mat.needsUpdate = true; renderer.render(scene, camera); });
    // Additiv für die Farbe, aber die Deckkraft der Fläche NICHT mitschreiben — sonst
    // wird die durchsichtige Leinwand dort deckend und das Schwarz des Videos bleibt
    // als Quadrat stehen. (Farbe mit Alpha 0 zeigt der Browser als reines Licht.)
    const mat = new THREE.MeshBasicMaterial({ map: poster, transparent: true, depthWrite: false, opacity: ruhig ? 0.8 : 1,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor });
    const groesse = 2.6;
    const ebene = new THREE.Mesh(new THREE.PlaneGeometry(groesse, groesse), mat);
    scene.add(ebene);
    video.addEventListener("playing", () => { mat.map = tex; mat.needsUpdate = true; renderer.render(scene, camera); }, { once: true });

    const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: leuchtTextur("#2563eb"), transparent: true, opacity: ruhig ? 0.3 : 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
    aura.scale.setScalar(3.4); aura.position.z = -0.2;
    scene.add(aura);

    const resize = () => { const w = mount.clientWidth || 1, h = mount.clientHeight || 1; camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h, false); };
    resize(); const ro = new ResizeObserver(resize); ro.observe(mount);

    let tx = 0, ty = 0;
    const onPointer = (e: PointerEvent) => { tx = ((e.clientX / window.innerWidth) * 2 - 1) * 0.18; ty = ((e.clientY / window.innerHeight) * 2 - 1) * 0.1; };
    if (!isMobile && !reduced) window.addEventListener("pointermove", onPointer, { passive: true });
    let visible = true;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (!reduced) { if (visible) video.play().catch(() => {}); else video.pause(); } }, { threshold: 0.05 });
    io.observe(mount);

    const clock = new THREE.Clock();
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!visible || document.hidden) return;
      const t = clock.getElapsedTime();
      ebene.position.y = Math.sin(t * 0.8) * 0.05;
      ebene.rotation.y += (tx - ebene.rotation.y) * 0.05;
      ebene.rotation.x += (-ty - ebene.rotation.x) * 0.05;
      aura.material.opacity = (ruhig ? 0.3 : 0.45) + Math.sin(t * 1.3) * 0.08;
      renderer.render(scene, camera);
    };
    renderer.render(scene, camera);
    if (!reduced) tick();

    return () => {
      cancelAnimationFrame(raf); io.disconnect(); ro.disconnect();
      window.removeEventListener("pointermove", onPointer);
      video.pause(); video.removeAttribute("src"); video.load();
      tex.dispose(); poster.dispose(); mat.dispose(); ebene.geometry.dispose(); aura.material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, [ruhig]);

  return <div ref={mountRef} className={className} aria-hidden="true" />;
}
