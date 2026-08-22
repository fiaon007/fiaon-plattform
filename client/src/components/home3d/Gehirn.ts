import * as THREE from "three";
import { leuchtTextur, BLAU, BLAU_HELL } from "./umgebung";

/*
  Gehirn — das KI-Hirn in FIAON-Blau (22.08.2026, Justin: „ein 3D-AI-Hirn mit
  Hirnströmungen, perfekt animiert — überall, wo bisher Kugel oder Kern war").

  Aufbau, rein prozedural (keine Modelldatei):
    Form      Ellipsoid mit Windungen (überlagerte Sinuswellen), Längsfurche
              in der Mitte, flacher Boden, leicht vorgezogene Stirn.
    Körper    dunkler, fast schwarzer Kern (verdeckt die Rückseite) + Fresnel-
              Hülle, die an den Rändern blau glüht → wirkt wie Glas mit Tiefe.
    Netz      Knoten auf der Oberfläche (Fibonacci-Verteilung), mit ihren drei
              nächsten Nachbarn verbunden — das neuronale Geflecht.
    Ströme    Lichtpunkte, die entlang der Verbindungen laufen und am Knoten
              den nächsten Weg wählen — die „Hirnströmungen".
*/

export interface Gehirn {
  group: THREE.Group;
  tick: (t: number, dt: number) => void;
}

function form(dir: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
  const th = Math.atan2(dir.z, dir.x);
  const ph = Math.asin(Math.max(-1, Math.min(1, dir.y)));
  // Windungen (Gyri): gefaltete Grate — Betrag einer Welle ergibt Kämme und Täler,
  // zwei Richtungen übereinander, nach unten hin ruhiger
  const oben = Math.max(0, Math.cos(ph)) * (0.55 + 0.45 * Math.max(0, dir.y + 0.3));
  const grat1 = 1 - Math.abs(Math.sin(7.5 * th + 2.2 * Math.sin(2.5 * ph) + 0.6));
  const grat2 = 1 - Math.abs(Math.sin(4.5 * ph + 3.0 * Math.sin(1.7 * th) + 1.1));
  let r = 1
    + 0.075 * grat1 * oben
    + 0.045 * grat2 * oben
    + 0.02 * Math.sin(13 * th - 4 * ph + 0.4) * Math.cos(2 * th);
  // tiefe Längsfurche oben in der Mitte
  const furche = Math.exp(-(dir.x * dir.x) / 0.02) * Math.max(0, dir.y + 0.2);
  r -= 0.2 * furche;
  // Proportionen eines Gehirns: breiter als hoch, am längsten von vorn nach hinten
  out.set(dir.x * r * 1.12, dir.y * r * 0.88, dir.z * r * 1.3);
  // Stirn leicht vor, Hinterkopf rund; Kleinhirn-Wulst hinten unten
  out.z *= 1 + 0.06 * dir.z;
  const klein = Math.exp(-((dir.z + 0.75) * (dir.z + 0.75)) / 0.12) * Math.max(0, -dir.y - 0.1);
  out.y -= 0.14 * klein;
  // flacher Boden
  if (out.y < -0.34) out.y = -0.34 + (out.y + 0.34) * 0.45;
  return out;
}

export function gehirnBauen(o: { knoten?: number; stroeme?: number; massstab?: number; ruhig?: boolean } = {}): Gehirn {
  const N = o.knoten ?? 720;
  const S = o.stroeme ?? 140;
  const massstab = o.massstab ?? 1;
  const group = new THREE.Group();
  group.scale.setScalar(massstab);

  /* ── Körper + Hülle ── */
  const geo = new THREE.SphereGeometry(1, 110, 72);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const d = new THREE.Vector3(), p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    d.set(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize();
    form(d, p);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  geo.computeVertexNormals();

  // Matt, tief nachtblau, von innen blau leuchtend — kein graues Reflexions-Knäuel.
  const kern = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({
    color: "#0a1a3f", emissive: new THREE.Color("#1e40af"), emissiveIntensity: 0.45,
    metalness: 0, roughness: 0.75, clearcoat: 0.25, clearcoatRoughness: 0.5,
    transparent: true, opacity: 0.9, envMapIntensity: 0.08,
  }));
  kern.scale.setScalar(0.985);
  group.add(kern);

  const huelle = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(BLAU) }, uLicht: { value: new THREE.Color(BLAU_HELL) }, uT: { value: 0 } },
    vertexShader: `
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz); vP = position; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `
      uniform vec3 uColor; uniform vec3 uLicht; uniform float uT;
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){
        float fres = pow(1.0 - abs(dot(vN, vV)), 2.2);
        // wandernde Wellen über die Oberfläche — die Aktivität
        float welle = 0.5 + 0.5 * sin(vP.y * 6.0 + vP.x * 4.0 - uT * 1.6) * sin(vP.z * 5.0 + uT * 0.9);
        vec3 c = mix(uColor, uLicht, welle * 0.6);
        gl_FragColor = vec4(c, fres * 0.9 + welle * 0.12);
      }`,
  }));
  group.add(huelle);

  /* ── Neuronales Netz ── */
  const knoten: THREE.Vector3[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;
    const rad = Math.sqrt(1 - y * y);
    const th = golden * i;
    // leichtes Zittern, damit kein regelmäßiges Gitter entsteht
    d.set(Math.cos(th) * rad + (Math.random() - 0.5) * 0.09, y + (Math.random() - 0.5) * 0.09, Math.sin(th) * rad + (Math.random() - 0.5) * 0.09).normalize();
    knoten.push(form(d, new THREE.Vector3()).multiplyScalar(1.012));
  }
  // Nachbarn: 3 nächste — über ein grobes Raster, damit es nicht quadratisch teuer wird
  const nachbarn: number[][] = Array.from({ length: N }, () => []);
  const kanten: [number, number][] = [];
  for (let i = 0; i < N; i++) {
    const best: { j: number; dd: number }[] = [];
    for (let j = 0; j < N; j++) {
      if (j === i) continue;
      const dd = knoten[i].distanceToSquared(knoten[j]);
      if (best.length < 3) { best.push({ j, dd }); best.sort((a, b) => a.dd - b.dd); }
      else if (dd < best[2].dd) { best[2] = { j, dd }; best.sort((a, b) => a.dd - b.dd); }
    }
    for (const b of best) {
      if (!nachbarn[i].includes(b.j)) nachbarn[i].push(b.j);
      if (!nachbarn[b.j].includes(i)) nachbarn[b.j].push(i);
      if (b.j > i) kanten.push([i, b.j]);
    }
  }
  const kantenPos = new Float32Array(kanten.length * 6);
  kanten.forEach(([a, b], k) => {
    kantenPos.set([knoten[a].x, knoten[a].y, knoten[a].z, knoten[b].x, knoten[b].y, knoten[b].z], k * 6);
  });
  const kantenGeo = new THREE.BufferGeometry();
  kantenGeo.setAttribute("position", new THREE.BufferAttribute(kantenPos, 3));
  group.add(new THREE.LineSegments(kantenGeo, new THREE.LineBasicMaterial({ color: new THREE.Color(BLAU_HELL), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })));

  const knotenGeo = new THREE.BufferGeometry().setFromPoints(knoten);
  group.add(new THREE.Points(knotenGeo, new THREE.PointsMaterial({
    size: 0.06, map: leuchtTextur(BLAU_HELL), transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color("#bfdbfe"),
  })));

  /* ── Ströme ── */
  const sPos = new Float32Array(S * 3);
  const sDaten = Array.from({ length: S }, () => ({ von: 0, nach: 0, t: Math.random(), v: 0.6 + Math.random() * 1.2 }));
  const neuerWeg = (s: { von: number; nach: number; t: number; v: number }, start?: number) => {
    const a = start ?? Math.floor(Math.random() * N);
    const nb = nachbarn[a];
    s.von = a; s.nach = nb.length ? nb[Math.floor(Math.random() * nb.length)] : a; s.t = 0;
  };
  sDaten.forEach((s) => neuerWeg(s));
  const sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute("position", new THREE.BufferAttribute(sPos, 3));
  const stroeme = new THREE.Points(sGeo, new THREE.PointsMaterial({
    size: 0.11, map: leuchtTextur("#ffffff"), transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color("#dbeafe"),
  }));
  group.add(stroeme);

  /* ── Innenlicht ── */
  const licht = new THREE.PointLight(0x3b82f6, 2.2, 4);
  group.add(licht);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: leuchtTextur("#2563eb"), transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.setScalar(3.6);
  group.add(glow);

  const tempo = o.ruhig ? 0.55 : 1;
  const tick = (t: number, dt: number) => {
    (huelle.material as THREE.ShaderMaterial).uniforms.uT.value = t * tempo;
    for (let i = 0; i < S; i++) {
      const s = sDaten[i];
      s.t += s.v * dt * tempo;
      if (s.t >= 1) neuerWeg(s, s.nach);
      const a = knoten[s.von], b = knoten[s.nach];
      const k = s.t;
      sPos[i * 3] = a.x + (b.x - a.x) * k;
      sPos[i * 3 + 1] = a.y + (b.y - a.y) * k;
      sPos[i * 3 + 2] = a.z + (b.z - a.z) * k;
    }
    sGeo.attributes.position.needsUpdate = true;
    licht.intensity = 1.8 + Math.sin(t * 1.7) * 0.5 + Math.sin(t * 3.1) * 0.25;
    glow.material.opacity = 0.42 + Math.sin(t * 1.1) * 0.08;
  };

  return { group, tick };
}
