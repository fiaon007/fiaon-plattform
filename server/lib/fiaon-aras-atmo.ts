// ═══════════════════════════════════════════════════════════
// ARAS — Büro-Atmosphäre im Hintergrund (E-408, Justin 20.10.2026)
//
// Justin: „ist mir noch ein wenig zu viel nach KI, gibt es eine Möglichkeit für
// ein paar Hintergrundgeräusche …“ — Aras klingt wie ein Verkäufer am Schreibtisch:
// Raumklang, Lüftung, entferntes Gemurmel (keine Wörter), leises Tippen, ab und zu
// Maus und Papier.
//
// Selbst erzeugt (keine Aufnahme, keine fremden Rechte), deterministisch (fester
// Startwert → derselbe Klang bei jedem Start), als nahtlose Schleife. Telefon-Format:
// 8 kHz, PCM16 mono; die Brücke wandelt in μ-law und mischt unter Aras' Stimme.
// Rein: keine Datenbank, kein Netz. Ein Aufruf rechnet ca. 0,1–0,3 s — darum einmal
// je Art und Prozess (atmoSchleife merkt sich das Ergebnis).
// ═══════════════════════════════════════════════════════════

export type AtmoArt = "buero_leise" | "buero";
export const ATMO_ARTEN: readonly AtmoArt[] = ["buero_leise", "buero"];
export const ATMO_RATE = 8000;
/** Ungefähre Lautheit (RMS in dBFS) je Art — Sprache am Telefon liegt bei etwa −16 dBFS (Prüfstand: ±2,5 dB). */
export const ATMO_PEGEL_DBFS: Record<AtmoArt, number> = { buero_leise: -43, buero: -37 };
/** Höchste Spitze je Art (dBFS) — ein Tastenklick bleibt deutlich unter Aras' Stimme. */
export const ATMO_SPITZE_DBFS: Record<AtmoArt, number> = { buero_leise: -26, buero: -21 };
/** Länge der Schleife in Sekunden (lang genug, dass sich nichts hörbar wiederholt). */
export const ATMO_SEKUNDEN = 75;

// ── Bausteine ──────────────────────────────────────────────────────────
/** Kleiner, schneller Zufall mit festem Startwert (mulberry32). */
function zufall(start: number): () => number {
  let a = start >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Biquad-Bandpass (RBJ, konstante Spitzenverstärkung 0 dB). */
function bandpass(fc: number, q: number) {
  const w = (2 * Math.PI * fc) / ATMO_RATE, al = Math.sin(w) / (2 * q), c = Math.cos(w), a0 = 1 + al;
  const b0 = al / a0, b2 = -al / a0, a1 = (-2 * c) / a0, a2 = (1 - al) / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x: number) => { const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
}

/** Einpoliger Tiefpass. */
function tiefpass(fc: number) {
  const a = 1 - Math.exp((-2 * Math.PI * fc) / ATMO_RATE);
  let y = 0;
  return (x: number) => (y += a * (x - y));
}

/** Hochpass als „Signal minus Tiefpass“. */
function hochpass(fc: number) {
  const tp = tiefpass(fc);
  return (x: number) => x - tp(x);
}

/** Einfacher Raum (zwei Kammfilter + Allpass) — setzt Gemurmel und Tippen „in den Raum“. */
function raum(n: number) {
  const kamm = (ms: number, g: number) => { const d = Math.round((ms / 1000) * ATMO_RATE); const b = new Float32Array(d); let i = 0;
    return (x: number) => { const y = b[i]; b[i] = x + y * g; i = (i + 1) % d; return y; }; };
  const allpass = (ms: number, g: number) => { const d = Math.round((ms / 1000) * ATMO_RATE); const b = new Float32Array(d); let i = 0;
    return (x: number) => { const v = b[i]; const y = -g * x + v; b[i] = x + g * y; i = (i + 1) % d; return y; }; };
  const k1 = kamm(37.1, 0.62), k2 = kamm(41.3, 0.58), a1 = allpass(5.3, 0.6);
  return (x: number) => a1((k1(x) + k2(x)) * 0.5) * (n) + x * (1 - n);
}

// ── Schichten ──────────────────────────────────────────────────────────
function raumklang(len: number, r: () => number): Float32Array {
  const out = new Float32Array(len), tp = tiefpass(900), hp = hochpass(120);
  for (let i = 0; i < len; i++) out[i] = hp(tp(r() * 2 - 1));
  return out;
}

function lueftung(len: number, r: () => number): Float32Array {
  const out = new Float32Array(len), tp = tiefpass(260), hp = hochpass(60);
  let braun = 0;
  for (let i = 0; i < len; i++) {
    braun = braun * 0.995 + (r() * 2 - 1) * 0.08;
    const lfo = 1 + 0.18 * Math.sin((2 * Math.PI * i) / (ATMO_RATE * 9.7)) + 0.07 * Math.sin((2 * Math.PI * i) / (ATMO_RATE * 3.1));
    out[i] = hp(tp(braun)) * lfo;
  }
  return out;
}

/** Entferntes Gemurmel: stimmhafte Silben (Impulsfolge + Hauch) durch wechselnde Formanten — Sprachklang ohne Wörter. */
function gemurmel(len: number, r: () => number, stimmen: number): Float32Array {
  const out = new Float32Array(len);
  for (let s = 0; s < stimmen; s++) {
    const f0Basis = 95 + r() * 120;               // tiefe bis mittlere Stimme
    let t = Math.floor(r() * ATMO_RATE * 2);       // jede Stimme beginnt anders
    let phase = 0;
    while (t < len) {
      // Ein Redeabschnitt (1,5–5 s), dann Pause (0,8–3,5 s)
      const redeEnde = Math.min(len, t + Math.floor((1.5 + r() * 3.5) * ATMO_RATE));
      while (t < redeEnde) {
        const silbe = Math.floor((0.12 + r() * 0.14) * ATMO_RATE);
        const f1 = 300 + r() * 500, f2 = 900 + r() * 1300, amp = 0.35 + r() * 0.65;
        const bp1 = bandpass(f1, 2.2), bp2 = bandpass(f2, 3.2);
        const f0 = f0Basis * (0.92 + r() * 0.18);
        for (let i = 0; i < silbe && t + i < len; i++) {
          const env = Math.sin((Math.PI * i) / silbe) ** 1.5;
          phase += f0 / ATMO_RATE;
          const puls = phase % 1 < 0.08 ? 1 : 0;   // Stimmband-Impuls
          const quelle = puls * 0.9 + (r() * 2 - 1) * 0.12;
          out[t + i] += (bp1(quelle) * 1.0 + bp2(quelle) * 0.55) * env * amp;
        }
        t += silbe + Math.floor(r() * 0.05 * ATMO_RATE);
      }
      t += Math.floor((0.8 + r() * 2.7) * ATMO_RATE);
    }
  }
  // Entfernung: dumpf + Raum
  const tp = tiefpass(1300), rm = raum(0.55), hp = hochpass(180);
  for (let i = 0; i < len; i++) out[i] = hp(rm(tp(out[i])));
  return out;
}

/** Leises Tippen in Schüben, dazu ab und zu Leertaste und Maus. */
function tippen(len: number, r: () => number): Float32Array {
  const out = new Float32Array(len);
  const klick = (start: number, hell: number, laut: number) => {
    const n = Math.floor(0.035 * ATMO_RATE), bp = bandpass(1800 + hell * 1200, 1.3);
    const fT = 150 + r() * 90;
    for (let i = 0; i < n && start + i < len; i++) {
      const e = Math.exp(-i / (0.004 * ATMO_RATE)), eT = Math.exp(-i / (0.009 * ATMO_RATE));
      out[start + i] += (bp((r() * 2 - 1) * e) * 1.6 + Math.sin((2 * Math.PI * fT * i) / ATMO_RATE) * eT * 0.35) * laut;
    }
  };
  let t = Math.floor(r() * ATMO_RATE * 3);
  while (t < len) {
    const schubEnde = Math.min(len, t + Math.floor((1.2 + r() * 4.8) * ATMO_RATE));
    while (t < schubEnde) {
      const leertaste = r() < 0.14;
      klick(t, leertaste ? 0.1 : r(), leertaste ? 1.15 : 0.6 + r() * 0.4);
      t += Math.floor((0.07 + r() * 0.12 + (r() < 0.1 ? 0.25 : 0)) * ATMO_RATE);
    }
    if (r() < 0.45) { // Maus: zwei kurze Klicks
      const m = t + Math.floor((0.3 + r()) * ATMO_RATE);
      klick(m, 0.9, 0.5); klick(m + Math.floor(0.11 * ATMO_RATE), 0.9, 0.45);
    }
    t += Math.floor((3 + r() * 9) * ATMO_RATE);
  }
  const rm = raum(0.35), tp = tiefpass(3200);
  for (let i = 0; i < len; i++) out[i] = tp(rm(out[i]));
  return out;
}

/** Papier: kurzes Rascheln (hell, an- und abschwellend), selten. */
function papier(len: number, r: () => number): Float32Array {
  const out = new Float32Array(len);
  let t = Math.floor((6 + r() * 10) * ATMO_RATE);
  while (t < len) {
    const n = Math.floor((0.3 + r() * 0.5) * ATMO_RATE), hp = hochpass(1500), tp = tiefpass(3300);
    for (let i = 0; i < n && t + i < len; i++) {
      const env = Math.sin((Math.PI * i) / n) ** 2 * (0.6 + 0.4 * Math.sin(i / 37));
      out[t + i] += tp(hp((r() * 2 - 1))) * env;
    }
    t += Math.floor((18 + r() * 25) * ATMO_RATE);
  }
  return out;
}

const rms = (a: Float32Array, von = 0, bis = a.length) => { let s = 0; for (let i = von; i < bis; i++) s += a[i] * a[i]; return Math.sqrt(s / Math.max(1, bis - von)); };
const spitzeVon = (a: Float32Array) => { let m = 0; for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i])); return m; };
/** Gleichmäßige Schichten nach Lautheit (RMS), seltene Geräusche (Klicks, Papier) nach ihrer Spitze — sonst knallt ein Klick. */
const aufRms = (a: Float32Array, dbfs: number) => { const z = 10 ** (dbfs / 20), ist = rms(a) || 1; for (let i = 0; i < a.length; i++) a[i] *= z / ist; return a; };
const aufSpitze = (a: Float32Array, dbfs: number) => { const z = 10 ** (dbfs / 20), ist = spitzeVon(a) || 1; for (let i = 0; i < a.length; i++) a[i] *= z / ist; return a; };

/** Pegel je Schicht in dBFS (RMS bzw. Spitze) — Sprache am Telefon: ca. −16 dBFS RMS, Spitzen um −3 dBFS. */
const SCHICHT_PEGEL: Record<AtmoArt, { raum: number; lueftung: number; murmel: number; tippen: number; papier: number; stimmen: number }> = {
  buero_leise: { raum: -48, lueftung: -52, murmel: -46, tippen: -31, papier: -36, stimmen: 2 },
  buero:       { raum: -44, lueftung: -49, murmel: -39, tippen: -26, papier: -31, stimmen: 4 },
};

/**
 * Die Atmosphäre als nahtlose Schleife (8 kHz, PCM16). Startwert fest → immer derselbe Klang.
 * „buero“ hat mehr Stimmen, lauteres Gemurmel und Tippen als „buero_leise“.
 */
export function atmoErzeugen(art: AtmoArt, sekunden = ATMO_SEKUNDEN, startwert = 20261020): Int16Array {
  const ueberblend = Math.floor(2 * ATMO_RATE);
  const n = Math.floor(sekunden * ATMO_RATE), len = n + ueberblend;
  const r = zufall(startwert + (art === "buero" ? 7 : 0));
  const p = SCHICHT_PEGEL[art];
  const schichten: Float32Array[] = [
    aufRms(raumklang(len, r), p.raum),
    aufRms(lueftung(len, r), p.lueftung),
    aufRms(gemurmel(len, r, p.stimmen), p.murmel),
    aufSpitze(tippen(len, r), p.tippen),
    aufSpitze(papier(len, r), p.papier),
  ];
  const summe = new Float32Array(len);
  for (const s of schichten) for (let i = 0; i < len; i++) summe[i] += s[i];
  // Nahtlos: das Ende (n … n+ü) gleitet leistungsgleich in den Anfang.
  const schleife = new Float32Array(n);
  for (let i = 0; i < n; i++) schleife[i] = summe[i];
  for (let i = 0; i < ueberblend; i++) {
    const w = i / ueberblend;
    schleife[i] = summe[i] * Math.sqrt(w) + summe[n + i] * Math.sqrt(1 - w);
  }
  // Weicher Begrenzer knapp unter der erlaubten Spitze: eine laute Silbe im Gemurmel oder ein Klick bleibt im Hintergrund.
  const grenze = 10 ** ((ATMO_SPITZE_DBFS[art] - 0.3) / 20);
  const aus = new Int16Array(n);
  for (let i = 0; i < n; i++) aus[i] = Math.max(-32767, Math.min(32767, Math.round(grenze * Math.tanh(schleife[i] / grenze) * 32767)));
  return aus;
}

const MERKER = new Map<AtmoArt, Int16Array>();
/** Die Schleife einer Art — einmal je Prozess gerechnet. */
export function atmoSchleife(art: AtmoArt): Int16Array {
  let s = MERKER.get(art);
  if (!s) { s = atmoErzeugen(art); MERKER.set(art, s); }
  return s;
}

/**
 * Ein Stück aus der Schleife mischen: `sprache` (PCM16, kann leer sein) + Atmo ab Position `pos`.
 * Gibt das Gemisch und die neue Position zurück. Begrenzt weich statt hart abzuschneiden.
 */
export function atmoMischen(sprache: Int16Array | null, laenge: number, art: AtmoArt, pos: number): { pcm: Int16Array; pos: number } {
  const s = atmoSchleife(art), aus = new Int16Array(laenge);
  let p = ((pos % s.length) + s.length) % s.length;
  for (let i = 0; i < laenge; i++) {
    const v = (sprache && i < sprache.length ? sprache[i] : 0) + s[p];
    // Weiche Grenze erst nahe Vollaussteuerung (Sprache allein bleibt unverändert).
    aus[i] = v > 30000 ? Math.min(32767, 30000 + (v - 30000) * 0.25) : v < -30000 ? Math.max(-32767, -30000 + (v + 30000) * 0.25) : v;
    p = p + 1 === s.length ? 0 : p + 1;
  }
  return { pcm: aus, pos: p };
}

/** WAV-Datei (8 kHz, PCM16 mono) — für Hörproben im Stimmen-Studio und zum Abhören. */
export function alsWav(pcm: Int16Array, rate = ATMO_RATE): Buffer {
  const daten = Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  const kopf = Buffer.alloc(44);
  kopf.write("RIFF", 0); kopf.writeUInt32LE(36 + daten.length, 4); kopf.write("WAVE", 8);
  kopf.write("fmt ", 12); kopf.writeUInt32LE(16, 16); kopf.writeUInt16LE(1, 20); kopf.writeUInt16LE(1, 22);
  kopf.writeUInt32LE(rate, 24); kopf.writeUInt32LE(rate * 2, 28); kopf.writeUInt16LE(2, 32); kopf.writeUInt16LE(16, 34);
  kopf.write("data", 36); kopf.writeUInt32LE(daten.length, 40);
  return Buffer.concat([kopf, daten]);
}
