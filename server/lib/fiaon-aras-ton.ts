// ═══════════════════════════════════════════════════════════════════════════
// ARAS — das Ton-Werk: Aras' Stimme klar, laut genug und ohne Abbrüche am Telefon (E-408, 20.10.2026)
//
// Justin (Anruf 16): „Deine Stimmqualität ist nicht sonderlich gut. Du brichst immer wieder mitten im Wort, so wie
// Funkprobleme … man versteht dich sehr schlecht“ — und genauer: „sie hat einfach schlechte Qualität und ist zu leise“.
//
// Gemessen (Rauchtest 20.10., echte GPT-Live-Sitzungen): GPT-Live liefert den Ton in ECHTZEIT als 100-ms-Stücke — mit
// Schwankung (95 % der Abstände ≤ 126 ms, einzelne bis 345 ms) und Gangabweichung (bis 3 % langsamer als Echtzeit). Die
// Brücke gab bisher jedes Stück sofort weiter; Twilio hatte damit kaum mehr als das eine Stück auf Vorrat. Jede
// Verspätung riss eine Lücke in die Rede — das sind die „Funkprobleme“. Die Rede kommt bei −23 bis −26 dBFS an (zu leise).
//
// Darum steht zwischen GPT-Live und Twilio dieses Werk (alles in PCM16, 8 kHz):
//   1. QUELLE: µ-law 8 kHz wie bisher — oder PCM16 24 kHz von GPT-Live mit eigener, sauberer Abtastratenwandlung
//      (Kaiser-Tiefpass, −6 dB bei 3,7 kHz, ~80 dB Sperrdämpfung) und nur EINER µ-law-Wandlung ganz am Ende.
//   2. PEGEL: sanfte Regelung der Rede auf ≈ −16 dBFS RMS (Leistungsmittel über Rede-Rahmen, Zeitkonstante 1,2 s,
//      höchstens 6 dB/s, in Pausen eingefroren — kein Pumpen, kein Hochziehen von Rauschen), danach ein Begrenzer mit 3 ms
//      Vorausschau bei −1 dBFS (nie Übersteuern). Die Büro-Atmo wird NACH der Regelung dazugemischt (fester Abstand zur Rede).
//   3. TAKT: Versand in 20-ms-Rahmen nach eigener Uhr. In Pausen hält die Brücke bei Twilio einen Vorrat (Vorlauf 300 ms,
//      nach einer Lücke bis 800 ms) mit Stille/Atmo — GPT-Lives eigene Pausen-Rahmen fallen dafür weg (sonst wüchse die
//      Verzögerung). Rede wird nie gekürzt; zieht GPT-Live hinterher, werden kurze Sprechpausen um je 20 ms gedehnt, bis
//      der Vorrat wieder steht. Läuft er trotzdem leer, wird die Lücke weich überbrückt (Ausblenden, Stille, Einblenden)
//      statt hart abgerissen. Höchstens 1,5 s bei Twilio; beim Reinreden leert `clear` alles sofort.
//   4. MESSEN: Pegel (RMS/Spitze), Lücken > 40 ms, Vorrat (min/Median/max aus Twilios Marken), Dehnungen — je Anruf.
// Rein bis auf die Uhr (`jetzt` ist austauschbar): scripts/pruef-aras-ton.ts prüft alles ohne Netz.
// ═══════════════════════════════════════════════════════════════════════════
import { atmoMischen, type AtmoArt } from "./fiaon-aras-atmo";

// ── µ-law (G.711) — hier eigenständig, damit das Werk ohne Datenbank und Netz prüfbar bleibt ──────────────────────
function mulawZuProbe(b: number): number {
  const u = ~b & 0xff, sign = u & 0x80, exp = (u >> 4) & 0x07, mant = u & 0x0f;
  const s = (((mant << 3) + 0x84) << exp) - 0x84;
  return sign ? -s : s;
}
function probeZuMulaw(x: number): number {
  let v = Math.max(-32768, Math.min(32767, Math.round(x)));
  const sign = v < 0 ? 0x80 : 0;
  if (v < 0) v = -v;
  if (v > 32635) v = 32635;
  v += 0x84;
  let exp = 7;
  for (let maske = 0x4000; (v & maske) === 0 && exp > 0; maske >>= 1) exp -= 1;
  return ~(sign | (exp << 4) | ((v >> (exp + 3)) & 0x0f)) & 0xff;
}
/** µ-law → PCM16. Rein. */
export function mulawZuPcm16(chunk: Buffer): Int16Array { const a = new Int16Array(chunk.length); for (let i = 0; i < chunk.length; i++) a[i] = mulawZuProbe(chunk[i]); return a; }
/** PCM16 → µ-law. Rein. */
export function pcm16ZuMulaw(pcm: Int16Array): Buffer { const b = Buffer.alloc(pcm.length); for (let i = 0; i < pcm.length; i++) b[i] = probeZuMulaw(pcm[i]); return b; }

/** Ziel-Lautheit der Rede (RMS über Rede-Rahmen, dBFS). */
export const TON_ZIEL_DBFS = -16;
/** Höchste Spitze nach dem Begrenzer (dBFS). */
export const TON_GRENZE_DBFS = -1;
/** So laut kommt GPT-Live ungefähr (gemessen 20.10.: −23 … −26 dBFS) — Startwert der Regelung, damit sie nicht erst „anläuft“. */
export const TON_START_PEGEL_DBFS = -24;
/** Regelbereich der Verstärkung (dB). */
export const TON_VERSTAERKUNG_MIN_DB = -6, TON_VERSTAERKUNG_MAX_DB = 14;
/** Ein Rahmen = 20 ms bei 8 kHz. */
export const RAHMEN = 160, RAHMEN_MS = 20;
/** Rahmen mit Rede (für den Takt): RMS vor der Verstärkung über dieser Schwelle. */
export const REDE_SCHWELLE_DBFS = -50;
/** Für die Pegel-Schätzung zählen nur deutliche Rede-Rahmen. */
const PEGEL_SCHWELLE_DBFS = -45;
/** Vorrat bei Twilio, wenn Aras zu sprechen beginnt (ms) — Messung 20.10.: ab 300 ms keine Lücken mehr (3 von 4 Sitzungen). */
export const VORLAUF_START_MS = 300, VORLAUF_MAX_MS = 800, VORLAUF_SCHRITT_MS = 100;
/** Höchstens so viel Ton liegt bei Twilio (wenn GPT-Live vorausliefert). */
export const VORSPRUNG_MAX_MS = 1500;
/** Eine Lücke zählt ab dieser Länge (ms). */
export const LUECKE_AB_MS = 40;
/** Nach so langer Ruhe ist ein Redebeitrag vorbei (ab dann fallen GPT-Lives Pausen-Rahmen weg). */
const BEITRAG_ENDE_MS = 300;

export type TonQuelle = "pcmu8k" | "pcm24k";
/** Woher der Ton kommt: ARAS_TON_QUELLE (pcm24k | pcmu8k), sonst die Vorgabe. */
export function tonQuelle(): TonQuelle {
  const w = String(process.env.ARAS_TON_QUELLE || "").trim().toLowerCase();
  return w === "pcmu8k" || w === "pcm24k" ? w : TON_QUELLE_VORGABE;
}
/** Vorgabe der Quelle (Messung 20.10. — siehe Bericht E-408 Tonqualität). */
export const TON_QUELLE_VORGABE: TonQuelle = "pcm24k";

// ── Kleine Helfer ──────────────────────────────────────────────────────────
const dbVon = (x: number) => 20 * Math.log10(Math.max(1e-9, x));
const linVon = (db: number) => 10 ** (db / 20);
const kappen = (v: number) => (v > 32767 ? 32767 : v < -32768 ? -32768 : Math.round(v));
/** RMS eines Rahmens in dBFS. Rein. */
export function rmsDbfs(x: Int16Array, von = 0, bis = x.length): number {
  let s = 0;
  for (let i = von; i < bis; i++) s += (x[i] / 32768) ** 2;
  return dbVon(Math.sqrt(s / Math.max(1, bis - von)));
}

// ── 1. Abtastratenwandlung 24 kHz ↔ 8 kHz ───────────────────────────────────
function besselI0(x: number): number {
  let s = 1, t = 1;
  for (let k = 1; k < 50; k++) { t *= (x / (2 * k)) ** 2; s += t; if (t < 1e-12 * s) break; }
  return s;
}
/** Kaiser-gefensterter Sinc-Tiefpass (Verstärkung 1 bei 0 Hz). Rein. */
export function tiefpassFir(taps: number, grenzeHz: number, rate: number, beta = 8): Float64Array {
  const h = new Float64Array(taps), m = (taps - 1) / 2, fc = grenzeHz / rate, i0b = besselI0(beta);
  let summe = 0;
  for (let n = 0; n < taps; n++) {
    const x = n - m;
    const sinc = x === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * x) / (Math.PI * x);
    const r = (2 * n) / (taps - 1) - 1;
    h[n] = sinc * (besselI0(beta * Math.sqrt(Math.max(0, 1 - r * r))) / i0b);
    summe += h[n];
  }
  for (let n = 0; n < taps; n++) h[n] /= summe;
  return h;
}
const FIR_TAPS = 121, FIR_GRENZE_HZ = 3700;
let firMerker: Float64Array | null = null;
const fir = () => (firMerker ??= tiefpassFir(FIR_TAPS, FIR_GRENZE_HZ, 24000, 8));

/** 24 kHz → 8 kHz: Tiefpass (Anti-Aliasing) und jede dritte Probe. Mit Gedächtnis über Stückgrenzen. */
export class Abwaerts24zu8 {
  private h = fir();
  private rest: Float64Array = new Float64Array(FIR_TAPS - 1);
  private naechste = FIR_TAPS - 1;
  push(x: Int16Array): Int16Array {
    const buf = new Float64Array(this.rest.length + x.length);
    buf.set(this.rest);
    for (let i = 0; i < x.length; i++) buf[this.rest.length + i] = x[i];
    const aus: number[] = [];
    let p = this.naechste;
    const h = this.h, n = h.length;
    for (; p < buf.length; p += 3) {
      let s = 0;
      for (let k = 0; k < n; k++) s += h[k] * buf[p - k];
      aus.push(s);
    }
    const ab = Math.max(0, buf.length - (n - 1));
    this.rest = buf.slice(ab);
    this.naechste = p - ab;
    return Int16Array.from(aus, kappen);
  }
}
/** 8 kHz → 24 kHz (für den Eingang, wenn GPT-Live PCM 24 kHz spricht): Nullen einfügen, derselbe Tiefpass ×3. */
export class Aufwaerts8zu24 {
  private h = fir();
  private verlauf: number[] = new Array(Math.ceil(FIR_TAPS / 3)).fill(0);
  push(x: Int16Array): Int16Array {
    const h = this.h, aus = new Int16Array(x.length * 3), j0 = this.verlauf.length;
    let o = 0;
    for (let m = 0; m < x.length; m++) {
      this.verlauf.unshift(x[m]); this.verlauf.length = j0;
      for (let r = 0; r < 3; r++) {
        let s = 0;
        for (let j = 0, k = r; k < h.length && j < j0; j++, k += 3) s += h[k] * this.verlauf[j];
        aus[o++] = kappen(3 * s);
      }
    }
    return aus;
  }
}
/** PCM16 (Little Endian) aus einem Puffer lesen. */
export function pcmAusPuffer(b: Buffer): Int16Array {
  const n = Math.floor(b.length / 2), aus = new Int16Array(n);
  for (let i = 0; i < n; i++) aus[i] = b.readInt16LE(i * 2);
  return aus;
}
/** PCM16 als Puffer (Little Endian). */
export function pcmAlsPuffer(x: Int16Array): Buffer {
  const b = Buffer.alloc(x.length * 2);
  for (let i = 0; i < x.length; i++) b.writeInt16LE(x[i], i * 2);
  return b;
}

// ── 2. Pegel: sanfte Regelung und Begrenzer ─────────────────────────────────
/** Regelt Rede sanft auf TON_ZIEL_DBFS — rahmenweise (20 ms), Verstärkung gleitet innerhalb des Rahmens. */
export class Pegelwerk {
  private leistung = linVon(TON_START_PEGEL_DBFS) ** 2;
  private verstaerkungDb = TON_ZIEL_DBFS - TON_START_PEGEL_DBFS;
  private letzteLin = linVon(this.verstaerkungDb);
  private readonly a = 1 - Math.exp(-RAHMEN_MS / 1200);
  private readonly schrittDb = (6 * RAHMEN_MS) / 1000;
  /** Ein Rahmen (beliebige Länge ≤ RAHMEN): geregelt, dazu ob Rede drin ist und der Pegel vorher. */
  rahmen(x: Int16Array): { pcm: Int16Array; rede: boolean; vorDb: number; verstaerkungDb: number } {
    const vorDb = rmsDbfs(x);
    if (vorDb > PEGEL_SCHWELLE_DBFS) {
      this.leistung += this.a * (linVon(vorDb) ** 2 - this.leistung);
      const pegel = 10 * Math.log10(Math.max(1e-12, this.leistung));
      const soll = Math.min(TON_VERSTAERKUNG_MAX_DB, Math.max(TON_VERSTAERKUNG_MIN_DB, TON_ZIEL_DBFS - pegel));
      this.verstaerkungDb += Math.max(-this.schrittDb, Math.min(this.schrittDb, soll - this.verstaerkungDb));
    }
    const neu = linVon(this.verstaerkungDb), alt = this.letzteLin, aus = new Int16Array(x.length);
    for (let i = 0; i < x.length; i++) aus[i] = kappen(x[i] * (alt + ((neu - alt) * (i + 1)) / x.length));
    this.letzteLin = neu;
    return { pcm: aus, rede: vorDb > REDE_SCHWELLE_DBFS, vorDb, verstaerkungDb: this.verstaerkungDb };
  }
  get db(): number { return this.verstaerkungDb; }
}

/** Begrenzer bei TON_GRENZE_DBFS: 3 ms Vorausschau, schneller Einsatz, 80 ms Rückkehr — nie Übersteuern, kein Knacken. */
export class Begrenzer {
  private readonly grenze = linVon(TON_GRENZE_DBFS) * 32767;
  private readonly lang = 24;
  private ring = new Float64Array(24);
  private w = 0;
  private g = 1;
  private readonly an = 1 - Math.exp(-1 / (24 / 5));
  private readonly ab = 1 - Math.exp(-1 / (0.08 * 8000));
  begrenzt = 0; proben = 0;
  /** Nach `clear`: keine 3 ms alter Rede vor dem nächsten Satz. */
  zuruecksetzen(): void { this.ring.fill(0); this.g = 1; }
  anwenden(x: Int16Array): Int16Array {
    const aus = new Int16Array(x.length);
    for (let i = 0; i < x.length; i++) {
      this.ring[this.w] = x[i]; this.w = (this.w + 1) % this.lang;
      let m = 0;
      for (let k = 0; k < this.lang; k++) { const v = Math.abs(this.ring[k]); if (v > m) m = v; }
      const ziel = m > this.grenze ? this.grenze / m : 1;
      this.g += (ziel < this.g ? this.an : this.ab) * (ziel - this.g);
      const v = this.ring[this.w] * this.g;
      aus[i] = kappen(Math.max(-this.grenze, Math.min(this.grenze, v)));
      if (this.g < 0.999) this.begrenzt += 1;
      this.proben += 1;
    }
    return aus;
  }
}

// ── 3. Der Takt zu Twilio ───────────────────────────────────────────────────
interface Rahmen { pcm: Int16Array; rede: boolean; vorDb: number }

export interface TonStatistik {
  quelle: TonQuelle | "unbekannt";
  /** Ausgehende Rede nach Regelung/Begrenzer (dBFS) — nur Rahmen mit Rede. */
  rede: { rmsDbfs: number | null; spitzeDbfs: number | null; vorherDbfs: number | null; verstaerkungDb: number; begrenztProzent: number; rahmen: number };
  /** Lücken mitten in der Rede (Vorrat leer, weich überbrückt). */
  luecken: { anzahl: number; msMax: number; msSumme: number };
  /** Vorrat bei Twilio (aus den zurückgemeldeten Marken), während Aras spricht. */
  vorrat: { minMs: number | null; medianMs: number | null; maxMs: number | null };
  vorlaufMs: number; gedehnt: number; fuellRahmen: number; gesendetRahmen: number;
}

export interface TonwerkOpt {
  /** Einen fertigen µ-law-Rahmen an Twilio (media). */
  senden: (mulaw: Buffer) => void;
  /** Eine Marke an Twilio. */
  marke: (name: string) => void;
  atmo?: AtmoArt | null;
  quelle?: TonQuelle;
  jetzt?: () => number;
  vorlaufMs?: number;
  /** Aras' Rede beginnt hörbar (Uhrzeit, wann der Kunde den ersten Rede-Rahmen hört) — für die Antwortzeit. */
  beiRedeBeginn?: (gehoertAm: number) => void;
  /** Rot-Probe im Prüfstand: der alte Weg (keine Regelung, kein Vorrat, sofort weiter, höchstens 500 ms). */
  alt?: boolean;
}

/**
 * Das Ton-Werk eines Gesprächs: einspeisen (GPT-Live, 8 kHz PCM) → regeln → Takt → Atmo → Begrenzer → µ-law → Twilio.
 * `takt()` ruft die Brücke alle 10 ms; `leeren()` beim Reinreden (dazu schickt die Brücke `clear`).
 */
export class Tonwerk {
  private readonly o: TonwerkOpt;
  private readonly jetzt: () => number;
  private readonly pegel = new Pegelwerk();
  private readonly begrenzer = new Begrenzer();
  private q: Rahmen[] = [];
  private rest: Int16Array = new Int16Array(0);
  private imRedefluss = false;
  private letzteRedeGesendet = 0;
  /** Wie lange im Redefluss schon nur noch Stille von GPT-Live kam (ms) — ab BEITRAG_ENDE_MS ist der Beitrag vorbei. */
  private stilleSeitRede = 0;
  private spielEnde = 0;
  private redeSpielEnde = 0;
  private gesendetMs = 0;
  private seitMarke = 0;
  private generation = 1;
  private atmoPos = 0;
  private letzterRahmen: Int16Array | null = null;
  private letzterWarRede = false;
  private lueckeSeit = 0;
  private lueckeMs = 0;
  private einblenden = false;
  private vorlauf: number;
  private vorratProben: number[] = [];
  private stat = { redeLeistung: 0, redeRahmen: 0, spitze: 0, vorherLeistung: 0, verstaerkungSumme: 0, luecken: 0, lueckenMsMax: 0, lueckenMsSumme: 0, gedehnt: 0, fuell: 0, gesendet: 0 };
  // Alter Weg (Rot-Probe): 100-ms-Stücke, höchstens fünf Marken offen.
  private altOffen = 0;
  private altSeit = 0;

  constructor(o: TonwerkOpt) {
    this.o = o;
    this.jetzt = o.jetzt ?? (() => Date.now());
    this.vorlauf = Math.min(VORLAUF_MAX_MS, Math.max(RAHMEN_MS, o.vorlaufMs ?? VORLAUF_START_MS));
  }

  /** Ton von GPT-Live (PCM16, 8 kHz, beliebige Länge). */
  einspeisen(pcm: Int16Array): void {
    let x = pcm;
    if (this.rest.length) { const v = new Int16Array(this.rest.length + pcm.length); v.set(this.rest); v.set(pcm, this.rest.length); x = v; }
    let i = 0;
    for (; i + RAHMEN <= x.length; i += RAHMEN) {
      const roh = x.subarray(i, i + RAHMEN);
      if (this.o.alt) { this.q.push({ pcm: Int16Array.from(roh), rede: rmsDbfs(roh) > REDE_SCHWELLE_DBFS, vorDb: rmsDbfs(roh) }); continue; }
      const r = this.pegel.rahmen(roh);
      this.q.push({ pcm: r.pcm, rede: r.rede, vorDb: r.vorDb });
    }
    this.rest = Int16Array.from(x.subarray(i));
  }

  /** Ms Ton, die bei Twilio noch nicht gespielt sind (Modell aus Versand + Echtzeit, durch Marken nachgeführt). */
  vorratMs(): number { return Math.max(0, this.spielEnde - this.jetzt()); }
  /** Ms Ton, die hier noch warten (nicht an Twilio geschickt). */
  wartendMs(): number { return this.q.length * RAHMEN_MS + Math.round((this.rest.length / RAHMEN) * RAHMEN_MS); }
  /** Liegt noch Rede an, die der Kunde nicht gehört hat (hier oder bei Twilio)? */
  redeAusstehend(): boolean { return this.q.some((r) => r.rede) || this.redeSpielEnde > this.jetzt(); }
  /** Wann der Kunde alles bisher Gesagte gehört hat (Uhrzeit). */
  redeGehoertBis(): number { return Math.max(this.redeSpielEnde, this.jetzt()) + this.q.filter((r) => r.rede).length * RAHMEN_MS; }
  get vorlaufAktuell(): number { return this.vorlauf; }

  /** Beim Reinreden: alles verwerfen (die Brücke schickt dazu `clear` an Twilio). */
  leeren(): void {
    this.q = []; this.rest = new Int16Array(0);
    this.imRedefluss = false; this.lueckeSeit = 0; this.lueckeMs = 0; this.einblenden = false;
    const t = this.jetzt();
    this.spielEnde = t; this.redeSpielEnde = Math.min(this.redeSpielEnde, t);
    this.generation += 1; this.seitMarke = 0; this.altOffen = 0;
    this.letzterRahmen = null; this.letzterWarRede = false; this.stilleSeitRede = 0;
    this.begrenzer.zuruecksetzen();
  }

  /** Twilio hat eine Marke zurückgemeldet: alles bis dahin ist gespielt. */
  markeZurueck(name: string): void {
    const m = /^t(\d+)-(\d+)$/.exec(String(name));
    if (!m || Number(m[1]) !== this.generation) return;
    if (this.o.alt) { this.altOffen = Math.max(0, this.altOffen - 1); return; }
    const offen = Math.max(0, this.gesendetMs - Number(m[2]));
    if (this.imRedefluss) this.vorratProben.push(offen);
    if (this.vorratProben.length > 5000) this.vorratProben.splice(0, 2500);
    // Twilio spielt später als angenommen (Netz): das Modell nachführen — nie weniger annehmen, als wirklich dort liegt.
    const t = this.jetzt();
    if (t + offen > this.spielEnde + 40) this.spielEnde = t + offen;
  }

  /** Alle 10 ms: senden, was fällig ist. */
  takt(): void {
    if (this.o.alt) { this.taktAlt(); return; }
    const t = this.jetzt();
    let vorrat = Math.max(0, this.spielEnde - t);
    if (!this.imRedefluss) {
      const i = this.q.findIndex((r) => r.rede);
      if (i >= 0) {
        // Beginn eines Redebeitrags: GPT-Lives Pause davor fällt weg — bis auf 40 ms (ein leiser Anlaut).
        this.q.splice(0, Math.max(0, i - 2));
        this.imRedefluss = true;
        this.letzteRedeGesendet = t; this.stilleSeitRede = 0;
        this.o.beiRedeBeginn?.(Math.max(this.spielEnde, t) + Math.min(i, 2) * RAHMEN_MS);
      } else {
        // Pause: GPT-Lives Stille-Rahmen fallen weg (sonst wüchse die Verzögerung); den Vorrat hält die Brücke selbst.
        if (this.q.length > 2) this.q.splice(0, this.q.length - 2);
        while (vorrat < this.vorlauf) { this.fuellen(); vorrat += RAHMEN_MS; }
        return;
      }
    }
    // Im Redefluss: alles senden, was da ist (höchstens VORSPRUNG_MAX_MS bei Twilio).
    while (this.q.length && vorrat < VORSPRUNG_MAX_MS) {
      const r = this.q.shift()!;
      if (this.lueckeSeit) {
        // Weiter nach einer Lücke: weich einblenden; zählt nur, wenn mitten in der Rede (davor und danach Rede).
        const ms = this.lueckeMs;
        if (r.rede && this.letzterWarRede && ms >= LUECKE_AB_MS) {
          this.stat.luecken += 1; this.stat.lueckenMsMax = Math.max(this.stat.lueckenMsMax, ms); this.stat.lueckenMsSumme += ms;
          this.vorlauf = Math.min(VORLAUF_MAX_MS, this.vorlauf + VORLAUF_SCHRITT_MS);
        }
        this.lueckeSeit = 0; this.lueckeMs = 0; this.einblenden = true;
      }
      const dehnen = !r.rede && r.vorDb < REDE_SCHWELLE_DBFS && vorrat < this.vorlauf - VORLAUF_SCHRITT_MS;
      this.rahmenSenden(r.pcm, r.rede, r.vorDb);
      vorrat += RAHMEN_MS;
      this.stilleSeitRede = r.rede ? 0 : this.stilleSeitRede + RAHMEN_MS;
      if (dehnen) { this.rahmenSenden(Int16Array.from(r.pcm), false, r.vorDb); vorrat += RAHMEN_MS; this.stat.gedehnt += 1; }
      if (this.stilleSeitRede >= BEITRAG_ENDE_MS) { this.imRedefluss = false; this.stilleSeitRede = 0; return; }
    }
    // Beitrag vorbei: GPT-Live schickt seit BEITRAG_ENDE_MS nur noch Stille (eine Lieferpause ist KEIN Ende — dann kam gar nichts).
    if (this.stilleSeitRede >= BEITRAG_ENDE_MS) { this.imRedefluss = false; this.stilleSeitRede = 0; return; }
    if (this.q.length) return;
    // Nichts mehr da, Twilio fast leer, Rede läuft noch: Lücke weich überbrücken statt hart abreißen.
    while (vorrat < 2 * RAHMEN_MS) {
      if (!this.lueckeSeit) { this.lueckeSeit = t; this.ausblendenSenden(); }
      else this.fuellen();
      this.lueckeMs += RAHMEN_MS;
      vorrat += RAHMEN_MS;
    }
  }

  private taktAlt(): void {
    // Der alte Weg: sobald 100 ms da sind, sofort weiter (höchstens 5 offen); ein Rest nach 110 ms ohne Nachschub.
    const t = this.jetzt();
    while (this.altOffen < 5 && this.q.length >= 5) { this.altStueck(this.q.splice(0, 5)); }
    if (this.q.length && this.altOffen < 5) {
      if (!this.altSeit) this.altSeit = t;
      if (t - this.altSeit >= 110) { this.altStueck(this.q.splice(0)); this.altSeit = 0; }
    } else this.altSeit = 0;
  }
  private altStueck(rahmen: Rahmen[]): void {
    for (const r of rahmen) { this.o.senden(pcm16ZuMulaw(r.pcm)); this.gesendetMs += RAHMEN_MS; this.stat.gesendet += 1; if (r.rede) this.statRede(r.pcm, r.vorDb); }
    this.altOffen += 1;
    this.o.marke(`t${this.generation}-${this.gesendetMs}`);
    const t = this.jetzt();
    this.spielEnde = Math.max(this.spielEnde, t) + rahmen.length * RAHMEN_MS;
  }

  private fuellen(): void {
    this.rahmenSenden(new Int16Array(RAHMEN), false, -120, true);
    this.stat.fuell += 1;
  }
  private ausblendenSenden(): void {
    // Den letzten Rahmen noch einmal, über 20 ms auf null ausgeblendet — so endet die Lücke nicht mit einem Knacks.
    const l = this.letzterRahmen;
    if (!l) { this.fuellen(); return; }
    const x = new Int16Array(RAHMEN);
    for (let i = 0; i < RAHMEN; i++) x[i] = Math.round(l[i] * (1 - (i + 1) / RAHMEN) * 0.7);
    this.rahmenSenden(x, false, -120, true);
    this.stat.fuell += 1;
  }

  private rahmenSenden(pcm: Int16Array, rede: boolean, vorDb: number, fueller = false): void {
    let x = pcm;
    if (this.einblenden && !fueller) {
      x = Int16Array.from(x);
      for (let i = 0; i < 80; i++) x[i] = Math.round(x[i] * ((i + 1) / 80));
      this.einblenden = false;
    }
    if (this.o.atmo) { const m = atmoMischen(x, RAHMEN, this.o.atmo, this.atmoPos); x = m.pcm; this.atmoPos = m.pos; }
    x = this.begrenzer.anwenden(x);
    this.o.senden(pcm16ZuMulaw(x));
    const t = this.jetzt();
    const beginn = Math.max(this.spielEnde, t);
    this.spielEnde = beginn + RAHMEN_MS;
    if (rede) { this.redeSpielEnde = this.spielEnde; this.letzteRedeGesendet = t; this.statRede(x, vorDb); }
    if (!fueller) { this.letzterRahmen = x; this.letzterWarRede = rede; }
    this.gesendetMs += RAHMEN_MS; this.stat.gesendet += 1;
    if (++this.seitMarke >= 5) { this.o.marke(`t${this.generation}-${this.gesendetMs}`); this.seitMarke = 0; }
  }

  private statRede(x: Int16Array, vorDb: number): void {
    let s = 0, sp = 0;
    for (let i = 0; i < x.length; i++) { const v = x[i] / 32768; s += v * v; if (Math.abs(v) > sp) sp = Math.abs(v); }
    this.stat.redeLeistung += s / x.length; this.stat.redeRahmen += 1; this.stat.spitze = Math.max(this.stat.spitze, sp);
    this.stat.vorherLeistung += linVon(vorDb) ** 2; this.stat.verstaerkungSumme += this.pegel.db;
  }

  statistik(): TonStatistik {
    const s = this.stat, n = s.redeRahmen;
    const v = [...this.vorratProben].sort((a, b) => a - b);
    const runde = (x: number) => Math.round(x * 10) / 10;
    return {
      quelle: this.o.quelle ?? "unbekannt",
      rede: {
        rmsDbfs: n ? runde(10 * Math.log10(s.redeLeistung / n)) : null,
        spitzeDbfs: n ? runde(dbVon(s.spitze)) : null,
        vorherDbfs: n ? runde(10 * Math.log10(Math.max(1e-12, s.vorherLeistung / n))) : null,
        verstaerkungDb: n ? runde(s.verstaerkungSumme / n) : 0,
        begrenztProzent: this.begrenzer.proben ? runde((100 * this.begrenzer.begrenzt) / this.begrenzer.proben) : 0,
        rahmen: n,
      },
      luecken: { anzahl: s.luecken, msMax: s.lueckenMsMax, msSumme: s.lueckenMsSumme },
      vorrat: { minMs: v.length ? v[0] : null, medianMs: v.length ? v[Math.floor(v.length / 2)] : null, maxMs: v.length ? v[v.length - 1] : null },
      vorlaufMs: this.vorlauf, gedehnt: s.gedehnt, fuellRahmen: s.fuell, gesendetRahmen: s.gesendet,
    };
  }
}

/** Wie GPT-Live liefert: Stückgrößen und Abstände (für die Messung je Anruf). */
export class Lieferstatistik {
  private zeiten: number[] = [];
  private groessen: number[] = [];
  private tonMs = 0;
  private erste = 0;
  private letzte = 0;
  stueck(ms: number, am = Date.now()): void {
    if (!this.erste) this.erste = am;
    if (this.letzte) this.zeiten.push(am - this.letzte);
    this.letzte = am; this.tonMs += ms; this.groessen.push(ms);
    if (this.zeiten.length > 20_000) this.zeiten.splice(0, 10_000);
    if (this.groessen.length > 20_000) this.groessen.splice(0, 10_000);
  }
  werte(): { stuecke: number; stueckMsMedian: number | null; stueckMsMax: number | null; abstandMsMedian: number | null; abstandMsP95: number | null; abstandMsMax: number | null; echtzeitProzent: number | null } {
    const z = [...this.zeiten].sort((a, b) => a - b), g = [...this.groessen].sort((a, b) => a - b);
    const wand = this.letzte - this.erste;
    return {
      stuecke: g.length,
      stueckMsMedian: g.length ? g[Math.floor(g.length / 2)] : null, stueckMsMax: g.length ? g[g.length - 1] : null,
      abstandMsMedian: z.length ? z[Math.floor(z.length / 2)] : null, abstandMsP95: z.length ? z[Math.floor(z.length * 0.95)] : null, abstandMsMax: z.length ? z[z.length - 1] : null,
      // 100 % = genau Echtzeit; < 100 % = GPT-Live liefert langsamer, als Twilio spielt.
      echtzeitProzent: wand > 1000 ? Math.round((1000 * this.tonMs) / wand) / 10 : null,
    };
  }
}

