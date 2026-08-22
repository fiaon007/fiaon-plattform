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
  // Windungen: drei Wellen, gegeneinander verschoben
  let r = 1
    + 0.055 * Math.sin(6 * th + 2 * Math.sin(3 * ph)) * Math.cos(4 * ph)
    + 0.035 * Math.sin(9 * th + 5 * ph + 1.3)
    + 0.022 * Math.sin(15 * th - 3 * ph + 0.4) * Math.cos(2 * th);
  // Längsfurche oben in der Mitte
  const furche = Math.exp(-(dir.x * dir.x) / 0.018) * Math.max(0, dir.y + 0.15);
  r -= 0.13 * furche;
  out.set(dir.x * r * 1.22, dir.y * r * 0.95, dir.z * r * 1.08);
  // Stirn leicht vor, Hinterkopf rund
  out.z *= 1 + 0.08 * dir.z;
  // flacher Boden
  if (out.y < -0.32) out.y = -0.32 + (out.y + 0.32) * 0.4;
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

  const kern = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({
    color: "#0b1220", metalness: 0.2, roughness: 0.55, clearcoat: 0.6, clearcoatRoughness: 0.35,
    transparent: true, opacity: 0.92, envMapIntensity: 0.35,
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
        gl_FragColor = vec4(c, fres * 0.55 + welle * 0.06);
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
    d.set(Math.cos(th) * rad, y, Math.sin(th) * rad);
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
  group.add(new THREE.LineSegments(kantenGeo, new THREE.LineBasicMaterial({ color: new THREE.Color(BLAU_HELL), transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false })));

  const knotenGeo = new THREE.BufferGeometry().setFromPoints(knoten);
  group.add(new THREE.Points(knotenGeo, new THREE.PointsMaterial({
    size: 0.045, map: leuchtTextur(BLAU_HELL), transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color("#bfdbfe"),
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
