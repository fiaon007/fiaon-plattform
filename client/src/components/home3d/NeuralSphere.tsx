import { useEffect, useRef } from "react";
import * as THREE from "three";

/*
  NeuralSphere — FIAON Signature 3D
  Eine halbtransparente Glaskugel aus verwobenen neuronalen Bahnen.
  Im Zentrum rotieren abstrakte Datenkarten & Score-Ringe.
  Partikel fließen von außen hinein und ordnen sich: "Chaos rein, Klarheit raus."
  variant="hero"  → lebendig, Partikel strömen ein
  variant="calm"  → geordnet, ruhig (Final CTA)
*/

interface NeuralSphereProps {
  variant?: "hero" | "calm";
  className?: string;
}

function glowTexture(color: string): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, color);
  g.addColorStop(0.35, color + "aa");
  g.addColorStop(1, "rgba(37,99,235,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  return t;
}

function dataCardTexture(kind: "score" | "bars" | "curve"): THREE.Texture {
  const w = 256, h = 160;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d")!;
  // glass card
  const r = 22;
  ctx.beginPath();
  ctx.moveTo(r, 0); ctx.lineTo(w - r, 0); ctx.quadraticCurveTo(w, 0, w, r);
  ctx.lineTo(w, h - r); ctx.quadraticCurveTo(w, h, w - r, h);
  ctx.lineTo(r, h); ctx.quadraticCurveTo(0, h, 0, h - r);
  ctx.lineTo(0, r); ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, "rgba(255,255,255,0.92)");
  bg.addColorStop(1, "rgba(224,236,255,0.85)");
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.strokeStyle = "rgba(37,99,235,0.35)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.strokeStyle = "#2563eb";
  ctx.fillStyle = "#2563eb";
  if (kind === "score") {
    ctx.lineWidth = 10;
    ctx.strokeStyle = "rgba(37,99,235,0.15)";
    ctx.beginPath(); ctx.arc(70, 80, 42, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = "#2563eb";
    ctx.beginPath(); ctx.arc(70, 80, 42, -Math.PI / 2, Math.PI * 0.9); ctx.stroke();
    ctx.fillStyle = "rgba(37,99,235,0.55)";
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(135, 50 + i * 26, 90 - i * 22, 9);
    }
  } else if (kind === "bars") {
    const vals = [0.35, 0.6, 0.45, 0.8, 0.95];
    vals.forEach((v, i) => {
      const bh = v * 90;
      ctx.fillStyle = i === 4 ? "#2563eb" : "rgba(37,99,235,0.35)";
      ctx.fillRect(34 + i * 42, 125 - bh, 24, bh);
    });
  } else {
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(24, 120);
    ctx.bezierCurveTo(80, 118, 110, 70, 160, 62);
    ctx.quadraticCurveTo(200, 56, 232, 34);
    ctx.stroke();
    ctx.fillStyle = "#2563eb";
    ctx.beginPath(); ctx.arc(232, 34, 8, 0, Math.PI * 2); ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  return t;
}

export default function NeuralSphere({ variant = "hero", className = "" }: NeuralSphereProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isMobile = window.innerWidth < 768;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);
    camera.position.set(0, 0, 7.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";

    const group = new THREE.Group();
    scene.add(group);

    const R = 2.1;
    const BLUE = new THREE.Color("#2563eb");
    const LIGHT = new THREE.Color("#60a5fa");
    const INK = new THREE.Color("#0f172a");

    /* ── Glass shell (fresnel rim) ── */
    const shellMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
      uniforms: {
        uColor: { value: new THREE.Color("#2563eb") },
        uOpacity: { value: 0.55 },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vView = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uOpacity;
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          float fres = pow(1.0 - abs(dot(vNormal, vView)), 2.6);
          gl_FragColor = vec4(uColor, fres * uOpacity);
        }`,
    });
    const shell = new THREE.Mesh(new THREE.SphereGeometry(R, 64, 64), shellMat);
    group.add(shell);

    /* ── Neural network on sphere surface (fibonacci points + edges) ── */
    const NODE_COUNT = isMobile ? 110 : 170;
    const nodes: THREE.Vector3[] = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < NODE_COUNT; i++) {
      const y = 1 - (i / (NODE_COUNT - 1)) * 2;
      const rad = Math.sqrt(1 - y * y);
      const th = golden * i;
      nodes.push(new THREE.Vector3(Math.cos(th) * rad * R, y * R, Math.sin(th) * rad * R));
    }
    // edges: connect each node to 2 nearest neighbours
    const edgePos: number[] = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      const dists = nodes
        .map((p, j) => ({ j, d: p.distanceTo(nodes[i]) }))
        .filter((e) => e.j !== i)
        .sort((a, b) => a.d - b.d)
        .slice(0, 3);
      dists.forEach((e) => {
        if (e.j > i) {
          edgePos.push(nodes[i].x, nodes[i].y, nodes[i].z, nodes[e.j].x, nodes[e.j].y, nodes[e.j].z);
        }
      });
    }
    const edgeGeo = new THREE.BufferGeometry();
    edgeGeo.setAttribute("position", new THREE.Float32BufferAttribute(edgePos, 3));
    const edgeMat = new THREE.LineBasicMaterial({ color: BLUE, transparent: true, opacity: 0.22 });
    group.add(new THREE.LineSegments(edgeGeo, edgeMat));

    const nodeGeo = new THREE.BufferGeometry().setFromPoints(nodes);
    const nodeMat = new THREE.PointsMaterial({
      size: isMobile ? 0.11 : 0.13,
      map: glowTexture("#2563eb"),
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.NormalBlending,
      color: LIGHT,
    });
    group.add(new THREE.Points(nodeGeo, nodeMat));

    /* ── Inner core: score rings ── */
    const core = new THREE.Group();
    group.add(core);
    const ringDefs = [
      { r: 0.95, tube: 0.012, axis: new THREE.Euler(Math.PI / 2.3, 0, 0), color: BLUE, op: 0.85 },
      { r: 0.75, tube: 0.01, axis: new THREE.Euler(0.4, Math.PI / 3, 0.2), color: LIGHT, op: 0.7 },
      { r: 1.15, tube: 0.008, axis: new THREE.Euler(1.2, 0.8, 0.5), color: INK, op: 0.35 },
    ];
    const rings: THREE.Mesh[] = [];
    ringDefs.forEach((d) => {
      const m = new THREE.Mesh(
        new THREE.TorusGeometry(d.r, d.tube, 12, 90),
        new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: d.op })
      );
      m.rotation.copy(d.axis);
      core.add(m);
      rings.push(m);
    });

    /* ── Inner data cards ── */
    const cardKinds: ("score" | "bars" | "curve")[] = ["score", "bars", "curve"];
    const cards: { mesh: THREE.Mesh; phase: number; radius: number; speed: number; yOff: number }[] = [];
    cardKinds.forEach((kind, i) => {
      const tex = dataCardTexture(kind);
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.78, 0.49),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false })
      );
      core.add(mesh);
      cards.push({
        mesh,
        phase: (i / cardKinds.length) * Math.PI * 2,
        radius: 0.62,
        speed: variant === "calm" ? 0.14 : 0.24,
        yOff: (i - 1) * 0.34,
      });
    });

    /* ── Incoming particles (chaos → order) ── */
    const P_COUNT = reduced ? 0 : isMobile ? 220 : 420;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(P_COUNT * 3);
    const pData: { dir: THREE.Vector3; dist: number; speed: number }[] = [];
    const spawn = (i: number) => {
      const dir = new THREE.Vector3().randomDirection();
      const dist = R + 1.2 + Math.random() * 2.4;
      pData[i] = { dir, dist, speed: 0.35 + Math.random() * 0.55 };
      pPos[i * 3] = dir.x * dist;
      pPos[i * 3 + 1] = dir.y * dist;
      pPos[i * 3 + 2] = dir.z * dist;
    };
    for (let i = 0; i < P_COUNT; i++) spawn(i);
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({
      size: 0.06,
      map: glowTexture("#3b82f6"),
      transparent: true,
      opacity: variant === "calm" ? 0.35 : 0.55,
      depthWrite: false,
      color: BLUE,
    });
    const particles = new THREE.Points(pGeo, pMat);
    if (P_COUNT > 0) scene.add(particles);

    /* ── Ambient inner glow ── */
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTexture("#93c5fd"), transparent: true, opacity: 0.5, depthWrite: false })
    );
    glow.scale.setScalar(3.4);
    group.add(glow);

    /* ── Sizing ── */
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

    /* ── Interaction: pointer parallax + scroll ── */
    let targetRX = 0, targetRY = 0;
    const onPointer = (e: PointerEvent) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = (e.clientY / window.innerHeight) * 2 - 1;
      targetRY = nx * 0.35;
      targetRX = ny * 0.22;
    };
    if (!isMobile && !reduced) window.addEventListener("pointermove", onPointer, { passive: true });

    let scrollOffset = 0;
    const onScroll = () => {
      const rect = mount.getBoundingClientRect();
      scrollOffset = (rect.top + rect.height / 2 - window.innerHeight / 2) / window.innerHeight;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    /* ── Visibility gating ── */
    let visible = true;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.02 });
    io.observe(mount);

    /* ── Loop ── */
    const clock = new THREE.Clock();
    const baseSpeed = variant === "calm" ? 0.12 : 0.22;
    let spin = 0;
    let parallaxY = 0;
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!visible || document.hidden) return;
      const t = clock.getElapsedTime();
      const dt = Math.min(clock.getDelta() + 0.016, 0.05);

      spin += baseSpeed * 0.016;
      parallaxY += (targetRY - parallaxY) * 0.04;
      group.rotation.y = spin + parallaxY;
      group.rotation.x += (targetRX + scrollOffset * 0.35 - group.rotation.x) * 0.04;
      group.position.y = Math.sin(t * 0.7) * 0.07;

      rings[0].rotation.z = t * 0.5;
      rings[1].rotation.z = -t * 0.35;
      rings[2].rotation.y = t * 0.22;

      cards.forEach((c) => {
        const a = c.phase + t * c.speed;
        c.mesh.position.set(Math.cos(a) * c.radius, c.yOff + Math.sin(t * 0.8 + c.phase) * 0.06, Math.sin(a) * c.radius);
        c.mesh.lookAt(camera.position);
      });

      if (P_COUNT > 0) {
        for (let i = 0; i < P_COUNT; i++) {
          const d = pData[i];
          d.dist -= d.speed * dt * (variant === "calm" ? 0.5 : 1);
          if (d.dist < R * 0.55) spawn(i);
          else {
            pPos[i * 3] = d.dir.x * d.dist;
            pPos[i * 3 + 1] = d.dir.y * d.dist;
            pPos[i * 3 + 2] = d.dir.z * d.dist;
          }
        }
        pGeo.attributes.position.needsUpdate = true;
      }

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
      window.removeEventListener("scroll", onScroll);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = (m as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else if (mat) mat.dispose();
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, [variant]);

  return <div ref={mountRef} className={className} aria-hidden="true" />;
}
