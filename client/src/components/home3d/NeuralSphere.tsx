import { useEffect, useRef } from "react";
import * as THREE from "three";
import { umgebungslicht, leuchtTextur, karteBauen, BLAU, BLAU_HELL, TINTE } from "./umgebung";

/*
  NeuralSphere — FIAON Signature 3D
  Eine halbtransparente Glaskugel aus verwobenen neuronalen Bahnen.
  Im Zentrum schwebt die FIAON-Karte (echter Körper, Lack und Metall),
  umkreist von Score-Ringen und zwei Auswertungskarten.
  Partikel fließen von außen hinein und ordnen sich: "Chaos rein, Klarheit raus."
  variant="hero"  → lebendig, Partikel strömen ein
  variant="calm"  → geordnet, ruhig (Final CTA)
*/

interface NeuralSphereProps {
  variant?: "hero" | "calm";
  className?: string;
}

function auswertungTextur(kind: "score" | "curve"): THREE.Texture {
  const w = 256, h = 160;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d")!;
  const r = 22;
  ctx.beginPath();
  ctx.moveTo(r, 0); ctx.lineTo(w - r, 0); ctx.quadraticCurveTo(w, 0, w, r);
  ctx.lineTo(w, h - r); ctx.quadraticCurveTo(w, h, w - r, h);
  ctx.lineTo(r, h); ctx.quadraticCurveTo(0, h, 0, h - r);
  ctx.lineTo(0, r); ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, "rgba(255,255,255,0.94)");
  bg.addColorStop(1, "rgba(224,236,255,0.88)");
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.strokeStyle = "rgba(37,99,235,0.35)";
  ctx.lineWidth = 2;
  ctx.stroke();

  if (kind === "score") {
    ctx.lineWidth = 10;
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(37,99,235,0.15)";
    ctx.beginPath(); ctx.arc(70, 82, 42, Math.PI * 0.8, Math.PI * 2.2); ctx.stroke();
    ctx.strokeStyle = BLAU;
    ctx.beginPath(); ctx.arc(70, 82, 42, Math.PI * 0.8, Math.PI * 1.95); ctx.stroke();
    ctx.fillStyle = TINTE;
    ctx.font = "500 26px Inter, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("97", 70, 92);
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(15,23,42,0.7)";
    ctx.fillRect(135, 52, 90, 9);
    ctx.fillStyle = "rgba(37,99,235,0.45)";
    ctx.fillRect(135, 78, 68, 9);
    ctx.fillRect(135, 104, 46, 9);
  } else {
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.strokeStyle = BLAU;
    ctx.beginPath();
    ctx.moveTo(24, 122);
    ctx.bezierCurveTo(80, 120, 110, 72, 160, 64);
    ctx.quadraticCurveTo(200, 58, 232, 36);
    ctx.stroke();
    ctx.fillStyle = BLAU;
    ctx.beginPath(); ctx.arc(232, 36, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(15,23,42,0.7)";
    ctx.fillRect(24, 24, 70, 9);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
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
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";

    /* ── Licht: Raumlicht für Spiegelungen + Schlüssel-/Kantenlicht ── */
    const umgebung = umgebungslicht(renderer);
    scene.environment = umgebung;
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(3, 4, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x60a5fa, 1.6);
    rim.position.set(-4, -2, -3);
    scene.add(rim);

    const group = new THREE.Group();
    scene.add(group);

    const R = 2.1;
    const BLUE = new THREE.Color(BLAU);
    const LIGHT = new THREE.Color(BLAU_HELL);
    const INK = new THREE.Color(TINTE);

    /* ── Glass shell (fresnel rim) ── */
    const shellMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
      uniforms: {
        uColor: { value: new THREE.Color(BLAU) },
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
    const edgeMat = new THREE.LineBasicMaterial({ color: BLUE, transparent: true, opacity: 0.2 });
    group.add(new THREE.LineSegments(edgeGeo, edgeMat));

    const nodeGeo = new THREE.BufferGeometry().setFromPoints(nodes);
    const nodeMat = new THREE.PointsMaterial({
      size: isMobile ? 0.11 : 0.13,
      map: leuchtTextur(BLAU),
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.NormalBlending,
      color: LIGHT,
    });
    group.add(new THREE.Points(nodeGeo, nodeMat));

    /* ── Kern: die FIAON-Karte ── */
    const core = new THREE.Group();
    group.add(core);
    const karte = karteBauen(1.55, "blau");
    core.add(karte);

    /* ── Score-Ringe um die Karte (Metall) ── */
    const ringDefs = [
      { r: 1.28, tube: 0.022, axis: new THREE.Euler(Math.PI / 2.3, 0, 0), color: BLUE, op: 0.95 },
      { r: 1.1, tube: 0.014, axis: new THREE.Euler(0.4, Math.PI / 3, 0.2), color: LIGHT, op: 0.85 },
      { r: 1.48, tube: 0.01, axis: new THREE.Euler(1.2, 0.8, 0.5), color: INK, op: 0.45 },
    ];
    const rings: THREE.Mesh[] = [];
    ringDefs.forEach((d) => {
      const m = new THREE.Mesh(
        new THREE.TorusGeometry(d.r, d.tube, 14, 110),
        new THREE.MeshPhysicalMaterial({ color: d.color, metalness: 0.9, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1, transparent: true, opacity: d.op })
      );
      m.rotation.copy(d.axis);
      core.add(m);
      rings.push(m);
    });
    // Lichtpunkt auf dem Hauptring
    const sat = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    const satGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: leuchtTextur(BLAU_HELL), transparent: true, opacity: 0.9, depthWrite: false }));
    satGlow.scale.setScalar(0.45);
    sat.add(satGlow);
    rings[0].add(sat);
    sat.position.set(ringDefs[0].r, 0, 0);

    /* ── Zwei Auswertungskarten, die die Karte umkreisen ── */
    const cardKinds: ("score" | "curve")[] = ["score", "curve"];
    const cards: { mesh: THREE.Mesh; phase: number; radius: number; speed: number; yOff: number }[] = [];
    cardKinds.forEach((kind, i) => {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.7, 0.44),
        new THREE.MeshBasicMaterial({ map: auswertungTextur(kind), transparent: true, opacity: 0.96, side: THREE.DoubleSide, depthWrite: false })
      );
      core.add(mesh);
      cards.push({
        mesh,
        phase: i * Math.PI,
        radius: 1.22,
        speed: variant === "calm" ? 0.14 : 0.22,
        yOff: i === 0 ? 0.55 : -0.55,
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
      map: leuchtTextur("#3b82f6"),
      transparent: true,
      opacity: variant === "calm" ? 0.35 : 0.55,
      depthWrite: false,
      color: BLUE,
    });
    const particles = new THREE.Points(pGeo, pMat);
    if (P_COUNT > 0) scene.add(particles);

    /* ── Ambient inner glow ── */
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: leuchtTextur("#93c5fd"), transparent: true, opacity: 0.45, depthWrite: false })
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
    const baseSpeed = variant === "calm" ? 0.1 : 0.18;
    const kartenSpeed = variant === "calm" ? 0.18 : 0.3;
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

      // Karte dreht sich gegen die Kugel, damit sie dem Betrachter zugewandt bleibt
      karte.rotation.y = -group.rotation.y + Math.sin(t * kartenSpeed) * 0.75;
      karte.rotation.x = Math.sin(t * 0.6) * 0.14 - group.rotation.x * 0.6;
      karte.rotation.z = Math.sin(t * 0.45) * 0.05;
      karte.position.y = Math.sin(t * 0.9) * 0.04;

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
      umgebung.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, [variant]);

  return <div ref={mountRef} className={className} aria-hidden="true" />;
}
