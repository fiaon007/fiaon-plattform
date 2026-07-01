import { useEffect, useRef } from "react";
import * as THREE from "three";

/*
  ArasCore — Sektion 4 Signature-Piece
  Mehrschichtiger Kern: konzentrische, gegenläufig rotierende Ringe um einen
  dichten Nukleus (Gyroskop-Anmutung). Datenfragmente lösen sich aus dem Kern
  und formieren sich zu geordneten "Erkenntnis-Karten", die nach außen schweben.
  Metapher: Rechenleistung wird zu Klarheit.
*/

function glowTexture(color: string): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, color);
  g.addColorStop(0.4, color + "88");
  g.addColorStop(1, "rgba(37,99,235,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function insightCardTexture(lines: number): THREE.Texture {
  const w = 220, h = 140;
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
  bg.addColorStop(0, "rgba(255,255,255,0.95)");
  bg.addColorStop(1, "rgba(219,234,254,0.9)");
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.strokeStyle = "rgba(37,99,235,0.4)";
  ctx.lineWidth = 2;
  ctx.stroke();
  // check bullet
  ctx.strokeStyle = "#2563eb";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(34, 36, 15, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(27, 36); ctx.lineTo(32, 42); ctx.lineTo(42, 29);
  ctx.stroke();
  // text lines
  for (let i = 0; i < lines; i++) {
    ctx.fillStyle = i === 0 ? "rgba(15,23,42,0.7)" : "rgba(37,99,235,0.3)";
    ctx.fillRect(24, 70 + i * 22, 172 - i * 40, 10);
  }
  return new THREE.CanvasTexture(c);
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
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";

    const BLUE = new THREE.Color("#2563eb");
    const LIGHT = new THREE.Color("#60a5fa");
    const INK = new THREE.Color("#0f172a");

    scene.add(new THREE.AmbientLight(0xffffff, 1.1));
    const key = new THREE.DirectionalLight(0xdbeafe, 2.2);
    key.position.set(3, 4, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x2563eb, 1.4);
    rim.position.set(-4, -2, -3);
    scene.add(rim);

    const group = new THREE.Group();
    scene.add(group);

    /* ── Nucleus: dense icosahedron, solid + wireframe overlay ── */
    const nucleus = new THREE.Group();
    group.add(nucleus);
    const nucSolid = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.78, 1),
      new THREE.MeshStandardMaterial({ color: 0x0d1b3e, metalness: 0.75, roughness: 0.25, flatShading: true })
    );
    nucleus.add(nucSolid);
    const nucWire = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.94, 1),
      new THREE.MeshBasicMaterial({ color: LIGHT, wireframe: true, transparent: true, opacity: 0.35 })
    );
    nucleus.add(nucWire);
    const nucGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTexture("#3b82f6"), transparent: true, opacity: 0.55, depthWrite: false })
    );
    nucGlow.scale.setScalar(2.6);
    nucleus.add(nucGlow);

    /* ── Gyroscope rings — counter-rotating ── */
    const ringSpecs = [
      { r: 1.5, tube: 0.035, tilt: new THREE.Euler(Math.PI / 2, 0, 0), sp: 0.55, color: BLUE, op: 0.95, metal: true },
      { r: 1.85, tube: 0.022, tilt: new THREE.Euler(Math.PI / 2.6, 0.5, 0), sp: -0.4, color: LIGHT, op: 0.8, metal: true },
      { r: 2.2, tube: 0.012, tilt: new THREE.Euler(1.1, -0.6, 0.3), sp: 0.28, color: INK, op: 0.4, metal: false },
      { r: 2.55, tube: 0.007, tilt: new THREE.Euler(0.4, 0.9, 0.6), sp: -0.18, color: BLUE, op: 0.3, metal: false },
    ];
    const ringPivots: { pivot: THREE.Group; sp: number }[] = [];
    ringSpecs.forEach((s) => {
      const pivot = new THREE.Group();
      pivot.rotation.copy(s.tilt);
      const mat = s.metal
        ? new THREE.MeshStandardMaterial({ color: s.color, metalness: 0.85, roughness: 0.3, transparent: true, opacity: s.op })
        : new THREE.MeshBasicMaterial({ color: s.color, transparent: true, opacity: s.op });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(s.r, s.tube, 16, 120), mat);
      pivot.add(ring);
      // small orbit satellite on the two main rings
      if (s.metal) {
        const sat = new THREE.Mesh(
          new THREE.SphereGeometry(0.055, 16, 16),
          new THREE.MeshBasicMaterial({ color: 0xffffff })
        );
        sat.position.set(s.r, 0, 0);
        const satGlow = new THREE.Sprite(
          new THREE.SpriteMaterial({ map: glowTexture("#60a5fa"), transparent: true, opacity: 0.9, depthWrite: false })
        );
        satGlow.scale.setScalar(0.4);
        sat.add(satGlow);
        pivot.add(sat);
      }
      group.add(pivot);
      ringPivots.push({ pivot, sp: s.sp });
    });

    /* ── Fragments: emitted from core, coalesce into insight cards drifting out ── */
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
      map: glowTexture("#2563eb"),
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      color: BLUE,
    });
    const fragments = new THREE.Points(fGeo, fMat);
    if (F_COUNT > 0) group.add(fragments);

    /* ── Insight cards floating outward ── */
    const cards: { mesh: THREE.Mesh; angle: number; speed: number; rad: number; y: number }[] = [];
    const cardCount = isMobile ? 3 : 4;
    for (let i = 0; i < cardCount; i++) {
      const tex = insightCardTexture(2 + (i % 2));
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.72, 0.46),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.92, side: THREE.DoubleSide, depthWrite: false })
      );
      group.add(mesh);
      cards.push({
        mesh,
        angle: (i / cardCount) * Math.PI * 2,
        speed: 0.16 + i * 0.02,
        rad: 2.7 + (i % 2) * 0.5,
        y: (i - (cardCount - 1) / 2) * 0.55,
      });
    }

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

      nucleus.rotation.y = t * 0.35;
      nucleus.rotation.x = Math.sin(t * 0.4) * 0.2;
      nucWire.rotation.y = -t * 0.2;
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

    if (reduced) {
      renderer.render(scene, camera);
    } else {
      tick();
    }

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
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className={className} aria-hidden="true" />;
}
