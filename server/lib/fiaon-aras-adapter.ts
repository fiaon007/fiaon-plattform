// ═══════════════════════════════════════════════════════════════════════════
// ARAS — die Adapter-Schnittstelle (E-408, Vertrag § 7)
//
// Die Brücke (fiaon-aras-bruecke.ts) kennt NUR diese Schnittstelle. Welcher
// Anbieter dahinter steht, sagt fiaon_settings.aras_adapter:
//   openai_live     GPT-Live über WebSocket (Standard, fiaon-aras-adapter-openai-live.ts)
//   openai_realtime Rückfall — noch nicht gebaut (Stub mit Klartext)
//   kaskade_sonic   Plan B (Deepgram → Gehirn → Cartesia) — Stub „Schlüssel fehlt“
//   attrappe        Prüfstand: spielt den Kunden aus einem Skript, ohne Netz
//
// Ton in beide Richtungen: µ-law 8 kHz in 20-ms-Rahmen (160 Byte) — genau das
// Twilio-Format, keine Umwandlung dazwischen (Prio 3: Schnelligkeit).
// ═══════════════════════════════════════════════════════════════════════════
import type { AdapterName, Spielart, Werkzeug, Land, Regie } from "../../shared/fiaon-aras";
import type { WerkzeugDef } from "../../shared/fiaon-aras-prompt";
import { openaiLiveAdapter } from "./fiaon-aras-adapter-openai-live";
import { kaskadeSonicStub } from "./fiaon-aras-adapter-kaskade";

export interface SitzungStart {
  callId: number; arasAnrufId: number; spielart: Spielart; land: Land;
  /** § 10, fertig zusammengesetzt. */
  anweisung: string;
  /** Die Anweisung für das Hintergrund-Modell (Responses-Delegation). */
  hintergrundAnweisung: string;
  /** Die Begrüßungs-Anweisung (developer-Nachricht in session.input): erster Satz mit KI-Hinweis, dann zuhören. */
  begruessung?: string | null;
  /**
   * Eingang stumm ab Start (E-408, 20.10. abends — Eröffnung vorab): Die Stimme spricht die Eröffnung sofort beim Abheben,
   * hört sein „Hallo“ aber nicht (sonst bräche sie ab). Die Brücke hält den Ton, bis er still ist, und schaltet den Eingang
   * mit eingang(true) wieder an.
   */
  eingangStumm?: boolean;
  stimme: string; modell: string; modellGehirn: string;
  werkzeuge: WerkzeugDef[];
  audio: { rein: "pcmu_8k"; raus: "pcmu_8k" };
  /** Tonquelle beim Anbieter (Vorgabe: tonQuelle() aus fiaon-aras-ton.ts) — Prüfstände und Vergleich setzen sie fest. */
  quelle?: import("./fiaon-aras-ton").TonQuelle;
  regie: Regie;
  fortsetzung?: "uebergabe_gescheitert" | "wiederaufbau";
  ereignis: (e: SitzungEreignis) => void;
  werkzeugAusfuehren: (name: Werkzeug, eingabe: unknown, aufrufId: string) => Promise<WerkzeugErgebnis>;
}

export interface Sitzung {
  /** µ-law 8 kHz, 20-ms-Rahmen vom Kunden. */
  audioRein(chunk: Buffer): void;
  /** Kunde spricht rein → Adapter stoppt die Ausgabe; die Brücke schickt Twilio `clear`. */
  unterbrechen(): void;
  /**
   * Text an die Stimme: „vorlesen“ = soll gesagt werden (frei formuliert, commentary), „still“ = nur Wissen (thinking),
   * „anweisung“ = Anweisung, die laufende Rede unterbrechen darf (instructions — Notaus, Übergabe, genauer Wortlaut).
   */
  textEinschieben(text: string, art: "vorlesen" | "still" | "anweisung"): void;
  /** Den Eingang (sein Ton an die Stimme) an- oder stummschalten — der Ton fließt weiter, die Stimme hört ihn nur nicht. */
  eingang?(an: boolean): void;
  beenden(grund: string): Promise<{ sekunden: number; kostenCents: number }>;
  /** Wie der Anbieter liefert (Quelle, Stückgrößen, Abstände) — für die Ton-Messung je Anruf (optional). */
  lieferung?(): Record<string, unknown>;
}

export type SitzungEreignis =
  | { art: "bereit"; sitzungId: string }
  | {
      art: "audio"; chunk: Buffer; /** Trägt der Rahmen Rede (Lautstärke) — GPT-Live schickt auch Stille durchgehend. */ sprache?: boolean;
      /** Derselbe Ton als PCM16 8 kHz — bei der Quelle „pcm24k“ sauber heruntergerechnet (besser als `chunk`, das µ-law ist). */
      pcm?: Int16Array;
    }
  | { art: "spricht_an" } | { art: "spricht_aus" }
  | { art: "kunde_spricht" }
  | { art: "transkript"; wer: "kunde" | "aras"; text: string; final: boolean; t: number }
  | { art: "werkzeug"; name: Werkzeug; eingabe: unknown; aufrufId: string }
  | { art: "kosten"; sekunden: number; kostenCents: number }
  | { art: "fehler"; code: string; text: string; fatal: boolean }
  | { art: "ende"; grund: string };

export interface WerkzeugErgebnis { ok: boolean; vorlesen: string; still?: string; daten?: unknown; fehler?: string }

export interface HoerprobeEin {
  stimme: string; beschreibung?: string; text: string; modell?: string;
  /** Akzent für die Sprechprobe (aras_dialekt) — Justin 20.10.2026. */
  dialekt?: import("../../shared/fiaon-aras").Dialekt | null;
  /** Tonquelle (Vergleich „wie bisher“ / „neu“) — sonst die Vorgabe. */
  quelle?: import("./fiaon-aras-ton").TonQuelle;
  /** Roh (für die Quittungs-Laute): PCM 8 kHz wie von der Stimme, ohne Telefon-Strecke — die regelt später das Ton-Werk. */
  roh?: boolean;
}
export interface HoerprobeAus { mime: string; bytes: Buffer; dauerMs: number; kostenCents: number; /** Was die Stimme laut Abschrift sagte. */ text?: string }

export interface StimmAdapter {
  name: AdapterName;
  /** Schlüssel da, KI-Pause aus? */
  bereit(): Promise<{ ok: boolean; grund?: string }>;
  sitzungStarten(e: SitzungStart): Promise<Sitzung>;
  hoerprobe(e: HoerprobeEin): Promise<HoerprobeAus>;
}

// ── Registratur ────────────────────────────────────────────────────────────
const EIGENE = new Map<AdapterName, StimmAdapter>();

/** Prüfstände hängen hier ihre Attrappe ein (adapterSetzen("attrappe", attrappeMitSkript(…))). */
export function adapterSetzen(name: AdapterName, a: StimmAdapter | null): void {
  if (a) EIGENE.set(name, a); else EIGENE.delete(name);
}

export function adapterFuer(name: AdapterName): StimmAdapter {
  const eigen = EIGENE.get(name);
  if (eigen) return eigen;
  switch (name) {
    case "openai_live": return openaiLiveAdapter();
    case "kaskade_sonic": return kaskadeSonicStub();
    case "openai_realtime": return stub("openai_realtime", "Der Rückfall-Adapter „openai_realtime“ ist noch nicht gebaut (Scheibe 7). Bitte aras_adapter auf openai_live stellen.");
    case "attrappe": return stub("attrappe", "Die Attrappe läuft nur im Prüfstand (adapterSetzen) — in Produktion ist sie nie ein Anbieter.");
  }
}

function stub(name: AdapterName, grund: string): StimmAdapter {
  return {
    name,
    async bereit() { return { ok: false, grund }; },
    async sitzungStarten() { throw new Error(grund); },
    async hoerprobe() { throw new Error(grund); },
  };
}

// ── µ-law-Hilfen (für Lautstärke-Erkennung und WAV-Hörproben) ──────────────
/** µ-law → 16-bit-Probe (G.711). */
export function mulawZuPcm(b: number): number {
  const u = ~b & 0xff;
  const sign = u & 0x80, exp = (u >> 4) & 0x07, mant = u & 0x0f;
  let s = ((mant << 3) + 0x84) << exp;
  s -= 0x84;
  return sign ? -s : s;
}
/** Mittlere Lautstärke (0–1) eines µ-law-Rahmens — die Rückfall-Erkennung „Kunde spricht“ der Brücke. */
export function pegel(chunk: Buffer): number {
  if (!chunk.length) return 0;
  let summe = 0;
  for (let i = 0; i < chunk.length; i++) summe += Math.abs(mulawZuPcm(chunk[i]));
  return summe / chunk.length / 32768;
}
/** µ-law-Rohdaten als WAV (format 7, 8 kHz, mono) — fürs Abspielen im Browser. */
export function mulawAlsWav(roh: Buffer): Buffer {
  const kopf = Buffer.alloc(44);
  kopf.write("RIFF", 0); kopf.writeUInt32LE(36 + roh.length, 4); kopf.write("WAVE", 8);
  kopf.write("fmt ", 12); kopf.writeUInt32LE(16, 16); kopf.writeUInt16LE(7, 20); kopf.writeUInt16LE(1, 22);
  kopf.writeUInt32LE(8000, 24); kopf.writeUInt32LE(8000, 28); kopf.writeUInt16LE(1, 32); kopf.writeUInt16LE(8, 34);
  kopf.write("data", 36); kopf.writeUInt32LE(roh.length, 40);
  return Buffer.concat([kopf, roh]);
}
/** 16-bit-Probe → µ-law (G.711, BIAS 0x84, CLIP 32635) — für das Mischen der Büro-Atmosphäre in der Brücke. */
export function pcmZuMulaw(s: number): number {
  let v = Math.max(-32768, Math.min(32767, Math.round(s)));
  const sign = v < 0 ? 0x80 : 0;
  if (v < 0) v = -v;
  if (v > 32635) v = 32635;
  v += 0x84;
  let exp = 7;
  for (let maske = 0x4000; (v & maske) === 0 && exp > 0; maske >>= 1) exp -= 1;
  const mant = (v >> (exp + 3)) & 0x0f;
  return ~(sign | (exp << 4) | mant) & 0xff;
}
/** µ-law-Rahmen → PCM16. */
export function mulawZuPcm16(chunk: Buffer): Int16Array {
  const aus = new Int16Array(chunk.length);
  for (let i = 0; i < chunk.length; i++) aus[i] = mulawZuPcm(chunk[i]);
  return aus;
}
/** PCM16 → µ-law-Rahmen. */
export function pcm16ZuMulaw(pcm: Int16Array): Buffer {
  const b = Buffer.alloc(pcm.length);
  for (let i = 0; i < pcm.length; i++) b[i] = pcmZuMulaw(pcm[i]);
  return b;
}
/** Stille in µ-law (0xFF) — n Millisekunden. */
export function stille(ms: number): Buffer { return Buffer.alloc(Math.round(ms * 8), 0xff); }
