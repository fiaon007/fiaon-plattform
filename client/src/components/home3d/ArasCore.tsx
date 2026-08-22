import { useEffect, useRef } from "react";
import * as THREE from "three";
import { umgebungslicht, leuchtTextur, BLAU, BLAU_HELL, TINTE } from "./umgebung";

/*
  ArasCore — Sektion 4 Signature-Piece
  Mehrschichtiger Kern: konzentrische, gegenläufig rotierende Metallringe um
  einen lackierten Nukleus (Gyroskop-Anmutung). Datenfragmente lösen sich aus
  dem Kern und formieren sich zu geordneten "Erkenntnis-Karten".
  Metapher: Rechenleistung wird zu Klarheit.
  Drei Karten stehen für die drei Schichten: Einsicht · Aktion · Zugang.
*/

function schichtKarte(titel: string, zeilen: number): THREE.Texture {
  const w = 256, h = 150;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d")!;
  const r = 20;
  ctx.beginPath();
  ctx.moveTo(r, 0); ctx.lineTo(w - r, 0); ctx.quadraticCurveTo(w, 0, w, r);
  ctx.lineTo(w, h - r); ctx.quadraticCurveTo(w, h, w - r, h);
  ctx.lineTo(r, h); ctx.quadraticCurveTo(0, h, 0, h - r);
  ctx.lineTo(0, r); ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, "rgba(255,255,255,0.96)");
  bg.addColorStop(1, "rgba(219,234,254,0.92)");
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.strokeStyle = "rgba(37,99,235,0.4)";
  ctx.lineWidth = 2;
  ctx.stroke();
  // Haken
  ctx.strokeStyle = BLAU;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath(); ctx.arc(34, 38, 15, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(27, 38); ctx.lineTo(32, 44); ctx.lineTo(42, 31); ctx.stroke();
  // Titel
  ctx.fillStyle = TINTE;
  ctx.font = "600 22px Inter, -apple-system, sans-serif";
  ctx.fillText(titel, 62, 46);
  // Zeilen
  for (let i = 0; i < zeilen; i++) {
    ctx.fillStyle = "rgba(37,99,235,0.3)";
    ctx.fillRect(24, 80 + i * 22, 180 - i * 46, 10);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default function ArasCore({ className = "" }: { className?: string }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isMobile = window.innerWidth < 768;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 50);
    camera.position.set(0, 0.4, 6.4);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1;
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";

    const BLUE = new THREE.Color(BLAU);
    const LIGHT = new THREE.Color(BLAU_HELL);
    const INK = new THREE.Color(TINTE);

    const umgebung = umgebungslicht(renderer);
    scene.environment = umgebung;
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(3, 4, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x2563eb, 1.8);
    rim.position.set(-4, -2, -3);
    scene.add(rim);

    const group = new THREE.Group();
    scene.add(group);

    /* ── Kern: das Hologramm-Hirn als Videotextur (22.08.2026) ──
       Das Video liegt auf reinem Schwarz; additiv gemischt wird Schwarz unsichtbar,
       das Hirn schwebt frei zwischen den Ringen. Zwei Ebenen, leicht gedreht,
       damit es aus jedem Winkel Tiefe hat. */
    const nucleus = new THREE.Group();
    group.add(nucleus);
    const videoEl = document.createElement("video");
    videoEl.src = "/kino/hirn.mp4"; videoEl.muted = true; videoEl.loop = true; videoEl.playsInline = true; videoEl.preload = "metadata";
    videoEl.setAttribute("playsinline", ""); videoEl.setAttribute("muted", "");
    const videoTex = new THREE.VideoTexture(videoEl);
    videoTex.colorSpace = THREE.SRGBColorSpace;
    const hirnMat = new THREE.MeshBasicMaterial({ map: videoTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const hirnEbene = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.3), hirnMat);
    nucleus.add(hirnEbene);
    const hirnEbene2 = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.3), hirnMat);
    hirnEbene2.rotation.y = Math.PI / 2;
    hirnEbene2.material = hirnMat.clone(); (hirnEbene2.material as THREE.MeshBasicMaterial).opacity = 0.55;
    nucleus.add(hirnEbene2);
    const nucGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: leuchtTextur("#3b82f6"), transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
    nucGlow.scale.setScalar(3.2);
    nucleus.add(nucGlow);
    if (!reduced) videoEl.play().catch(() => {});
    const hirn = { tick: (_t: number, _dt: number) => { /* Bewegung steckt im Video */ } };

    /* ── Gyroskop-Ringe — gegenläufig, Metall mit Klarlack ── */
    const ringSpecs = [
      { r: 1.5, tube: 0.04, tilt: new THREE.Euler(Math.PI / 2, 0, 0), sp: 0.55, color: BLUE, op: 1, metal: true },
      { r: 1.85, tube: 0.026, tilt: new THREE.Euler(Math.PI / 2.6, 0.5, 0), sp: -0.4, color: LIGHT, op: 0.9, metal: true },
      { r: 2.2, tube: 0.014, tilt: new THREE.Euler(1.1, -0.6, 0.3), sp: 0.28, color: INK, op: 0.5, metal: true },
      { r: 2.55, tube: 0.007, tilt: new THREE.Euler(0.4, 0.9, 0.6), sp: -0.18, color: BLUE, op: 0.3, metal: false },
    ];
    const ringPivots: { pivot: THREE.Group; sp: number }[] = [];
    ringSpecs.forEach((s, idx) => {
      const pivot = new THREE.Group();
      pivot.rotation.copy(s.tilt);
      const mat = s.metal
        ? new THREE.MeshPhysicalMaterial({ color: s.color, metalness: 0.9, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.1, transparent: s.op < 1, opacity: s.op })
        : new THREE.MeshBasicMaterial({ color: s.color, transparent: true, opacity: s.op });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(s.r, s.tube, 18, 140), mat);
      pivot.add(ring);
      if (idx < 2) {
        const sat = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        sat.position.set(s.r, 0, 0);
        const satGlow = new THREE.Sprite(
          new THREE.SpriteMaterial({ map: leuchtTextur(BLAU_HELL), transparent: true, opacity: 0.9, depthWrite: false })
        );
        satGlow.scale.setScalar(0.45);
        sat.add(satGlow);
        pivot.add(sat);
      }
      group.add(pivot);
      ringPivots.push({ pivot, sp: s.sp });
    });

    /* ── Fragmente: aus dem Kern nach außen ── */
    const F_COUNT = reduced ? 0 : isMobile ? 90 : 160;
    const fGeo = new THREE.BufferGeometry();
    const fPos = new Float32Array(F_COUNT * 3);
    const fData: { dir: THREE.Vector3; dist: number; speed: number }[] = [];
    const fspawn = (i: number) => {
      const dir = new THREE.Vector3().randomDirection();
      dir.y = Math.abs(dir.y) * 0.55 * (Math.random() > 0.5 ? 1 : -1);
      dir.normalize();
      fData[i] = { dir, dist: 0.9 + Math.random() * 0.3, speed: 0.25 + Math.random() * 0.4 };
    };
    for (let i = 0; i < F_COUNT; i++) fspawn(i);
    fGeo.setAttribute("position", new THREE.BufferAttribute(fPos, 3));
    const fMat = new THREE.PointsMaterial({
      size: 0.055,
      map: leuchtTextur(BLAU),
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      color: BLUE,
    });
    const fragments = new THREE.Points(fGeo, fMat);
    if (F_COUNT > 0) group.add(fragments);

    /* ── Drei Schichten-Karten, die nach außen schweben ── */
    const titel = ["Einsicht", "Aktion", "Zugang"];
    const cards: { mesh: THREE.Mesh; angle: number; speed: number; rad: number; y: number }[] = [];
    titel.forEach((name, i) => {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.8, 0.47),
        new THREE.MeshBasicMaterial({ map: schichtKarte(name, 2 + (i % 2)), transparent: true, opacity: 0.94, side: THREE.DoubleSide, depthWrite: false })
      );
      group.add(mesh);
      cards.push({
        mesh,
        angle: (i / titel.length) * Math.PI * 2,
        speed: 0.16 + i * 0.02,
        rad: 2.7 + (i % 2) * 0.45,
        y: (i - 1) * 0.6,
      });
    });

    /* ── Sizing / visibility / interaction ── */
    const resize = () => {
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    let visible = true;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.02 });
    io.observe(mount);

    let tRX = 0, tRY = 0;
    const onPointer = (e: PointerEvent) => {
      tRY = ((e.clientX / window.innerWidth) * 2 - 1) * 0.3;
      tRX = ((e.clientY / window.innerHeight) * 2 - 1) * 0.18;
    };
    if (!isMobile && !reduced) window.addEventListener("pointermove", onPointer, { passive: true });

    const clock = new THREE.Clock();
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!visible || document.hidden) return;
      const t = clock.getElapsedTime();
      const dt = Math.min(clock.getDelta() + 0.016, 0.05);

      nucleus.rotation.y = Math.sin(t * 0.3) * 0.25;
      nucleus.rotation.x = Math.sin(t * 0.4) * 0.08;
      hirn.tick(t, dt);
      group.position.y = Math.sin(t * 0.6) * 0.08;
      group.rotation.x += (tRX - group.rotation.x) * 0.05;
      group.rotation.y += (tRY - group.rotation.y) * 0.05;

      ringPivots.forEach((r, i) => {
        r.pivot.rotation.z += r.sp * dt;
        r.pivot.rotation.y = Math.sin(t * 0.3 + i) * 0.12;
      });

      if (F_COUNT > 0) {
        for (let i = 0; i < F_COUNT; i++) {
          const d = fData[i];
          d.dist += d.speed * dt;
          if (d.dist > 3.2) fspawn(i);
          fPos[i * 3] = d.dir.x * d.dist;
          fPos[i * 3 + 1] = d.dir.y * d.dist;
          fPos[i * 3 + 2] = d.dir.z * d.dist;
        }
        fGeo.attributes.position.needsUpdate = true;
      }

      cards.forEach((c) => {
        const a = c.angle + t * c.speed;
        c.mesh.position.set(Math.cos(a) * c.rad, c.y + Math.sin(t * 0.7 + c.angle) * 0.08, Math.sin(a) * c.rad * 0.55);
        c.mesh.lookAt(camera.position);
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
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else if (mat) mat.dispose();
      });
      videoEl.pause(); videoEl.removeAttribute("src"); videoEl.load(); videoTex.dispose();
      umgebung.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className={className} aria-hidden="true" />;
}
