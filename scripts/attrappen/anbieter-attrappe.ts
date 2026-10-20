// ═══════════════════════════════════════════════════════════════════════════
// ANBIETER-ATTRAPPE — der Stimm-Adapter „attrappe“ für den Prüfstand (E-408, § 13)
//
// Spielt den Kunden UND die Stimme aus einem Skript, ohne Netz: Kundenzeilen
// (Transkript + „kunde_spricht“), Aras-Zeilen (Transkript + Ton = Stille in
// µ-law), Werkzeug-Aufrufe (so, wie das Hintergrund-Modell sie auslösen würde),
// Unterbrechungen, Fehler des Anbieters, Auflegen. Damit prüft
// scripts/pruef-aras-bruecke.ts die ganze Brücke und die Akte — ohne Twilio,
// ohne OpenAI, ohne einen echten Menschen.
// ═══════════════════════════════════════════════════════════════════════════
import type { StimmAdapter, Sitzung, SitzungStart, SitzungEreignis, WerkzeugErgebnis } from "../../server/lib/fiaon-aras-adapter";
import { stille } from "../../server/lib/fiaon-aras-adapter";

/** „Rede“ in µ-law: ein lauter Ton (GPT-Live schickt Rede UND Stille — die Brücke unterscheidet am Pegel). */
function rede(ms: number): Buffer {
  const n = Math.round(ms * 8), b = Buffer.alloc(n);
  for (let i = 0; i < n; i++) b[i] = i % 16 < 8 ? 0x20 : 0xa0; // hohe Amplitude, wechselndes Vorzeichen
  return b;
}
import type { Werkzeug } from "../../shared/fiaon-aras";

/** Sprachähnlicher Ton (Grundton 150 Hz mit Obertönen, Silben 4 Hz) auf `dbfs` RMS — wie GPT-Live ihn liefert (8 kHz PCM). */
function silben(ms: number, dbfs: number, start = 0): Int16Array {
  const n = Math.round(ms * 8), roh = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = (start + i) / 8000;
    let v = 0;
    for (let k = 1; k <= 14; k++) v += Math.sin(2 * Math.PI * 150 * k * t + k) / k;
    roh[i] = v * (0.35 + 0.65 * Math.sin(Math.PI * 4 * t) ** 2);
  }
  let s = 0; for (const v of roh) s += v * v;
  const f = (10 ** (dbfs / 20) * 32767) / Math.sqrt(s / Math.max(1, n)), x = new Int16Array(n);
  for (let i = 0; i < n; i++) x[i] = Math.max(-32768, Math.min(32767, Math.round(roh[i] * f)));
  return x;
}
function alsMulaw(x: Int16Array): Buffer {
  const b = Buffer.alloc(x.length);
  for (let i = 0; i < x.length; i++) {
    let v = Math.max(-32768, Math.min(32767, x[i]));
    const sign = v < 0 ? 0x80 : 0; if (v < 0) v = -v; if (v > 32635) v = 32635; v += 0x84;
    let e = 7; for (let m = 0x4000; (v & m) === 0 && e > 0; m >>= 1) e -= 1;
    b[i] = ~(sign | (e << 4) | ((v >> (e + 3)) & 0x0f)) & 0xff;
  }
  return b;
}
/** Lieferung wie gemessen (20.10.): 100-ms-Stücke mit Schwankung OHNE späteres Aufholen — oder stoßweise (300 ms Stoß, 250 ms Pause). */
export type Liefermuster = "echtzeit_schwankend" | "stossweise";
function zufall(start: number): () => number { let a = start >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export type Schritt =
  | { kunde: string; nachMs?: number }
  | { aras: string; ms?: number; /** Echter Sprach-Ton statt Rechteck: Pegel und Lieferart (Ton-Werk, 20.10.). */ ton?: { dbfs?: number; muster?: Liefermuster } }
  | { werkzeug: Werkzeug; eingabe?: unknown }
  | { erwarteWerkzeug: Werkzeug; eingabe?: unknown }   // Alias (Vertrag § 13)
  | { unterbrechen: true }
  | { auflegen: true }
  | { fehler: { code: string; text?: string; fatal: boolean } }
  | { warteMs: number }
  /** Wartet, bis der Kunde laut war (Ton von „Twilio“) und jetzt so lange still ist — wie GPT-Live nach seinem Satz (höchstens 8 s). */
  | { nachKundeStillMs: number }
  /** Wartet auf seine Stimme (Ton von „Twilio“) und liefert dann seine Worte als Transkript — wie GPT-Lives Abschrift (höchstens 8 s). */
  | { beiKundenStimme: string };

export interface Skript {
  schritte: Schritt[]; name?: string;
  /** Folgt die Stimme der Abschied-Einforderung der Brücke („verabschiede dich …“)? Vorgabe ja — wie GPT-Live. */
  abschiedIgnorieren?: boolean;
}

export interface AttrappeSpur { werkzeuge: { name: Werkzeug; ergebnis: WerkzeugErgebnis }[]; eingeschoben: { text: string; art: string; am?: number }[]; /** Wann der Kunde jeweils zu reden begann (Transkript). */ kundeAm?: number[]; unterbrochen: number; beendet: string | null; audioReinBytes: number; /** Was die Brücke als Begrüßung (developer-Nachricht) mitgab — ausgehend: keine. */ begruessung?: string | null }

export function attrappeMitSkript(s: Skript): StimmAdapter & { spur: AttrappeSpur; fertig: Promise<void> } {
  const spur: AttrappeSpur = { werkzeuge: [], eingeschoben: [], kundeAm: [], unterbrochen: 0, beendet: null, audioReinBytes: 0 };
  let fertigMelden: () => void = () => {};
  const fertig = new Promise<void>((l) => { fertigMelden = l; });
  return {
    name: "attrappe",
    spur, fertig,
    async bereit() { return { ok: true }; },
    async hoerprobe(e) { const roh = stille(1200); return { mime: "audio/wav", bytes: Buffer.concat([Buffer.from("RIFF"), roh]), dauerMs: 1200, kostenCents: 0 }; },
    async sitzungStarten(e: SitzungStart): Promise<Sitzung> {
      spur.begruessung = e.begruessung ?? null;
      const start = Date.now();
      let beendet = false;
      let aktiv = false;
      let zuletztLautRein = 0;
      const t = () => Date.now() - start;
      const emit = (ev: SitzungEreignis) => { if (!beendet) e.ereignis(ev); };
      const schlafen = (ms: number) => new Promise<void>((l) => setTimeout(l, ms));
      let redet = false;
      const r = zufall(1020);
      /** Wie GPT-Live: Sprach-Ton in 100-ms-Stücken, Abstände wie gemessen — die Stille pausiert so lange (ein Strom). */
      const arasSagtEcht = async (text: string, ms: number, ton: { dbfs?: number; muster?: Liefermuster }) => {
        redet = true;
        emit({ art: "spricht_an" });
        emit({ art: "transkript", wer: "aras", text, final: false, t: t() });
        const pcm = silben(ms, ton.dbfs ?? -24);
        const t0 = Date.now();
        let soll = 0;
        for (let k = 0; k * 800 < pcm.length; k++) {
          if (beendet) break;
          if (ton.muster === "stossweise") soll = Math.floor(k / 6) * 600 + (k % 6) * 55;
          else { const w = r(); soll += k === 0 ? 0 : w < 0.70 ? 100 + (r() - 0.5) * 16 : w < 0.95 ? 108 + r() * 18 : w < 0.99 ? 70 + r() * 20 : 200 + r() * 145; }
          const warte = t0 + soll - Date.now();
          if (warte > 0) await schlafen(warte);
          const stueck = pcm.subarray(k * 800, (k + 1) * 800);
          emit({ art: "audio", chunk: alsMulaw(stueck), pcm: stueck, sprache: true });
        }
        emit({ art: "transkript", wer: "aras", text: "", final: true, t: t() });
        emit({ art: "spricht_aus" });
        redet = false;
      };
      const arasSagt = async (text: string, ms = 300) => {
        emit({ art: "spricht_an" });
        emit({ art: "transkript", wer: "aras", text, final: false, t: t() });
        // 100-ms-Stücke Rede, damit die Brücke media + mark wirklich schickt (und am Pegel „spricht“ erkennt)
        for (let i = 0; i < Math.max(1, Math.round(ms / 100)); i++) { if (beendet) break; emit({ art: "audio", chunk: rede(100), sprache: true }); await schlafen(20); }
        emit({ art: "transkript", wer: "aras", text: "", final: true, t: t() });
        emit({ art: "spricht_aus" });
      };
      const stilleTakt = setInterval(() => { if (!beendet && aktiv && !redet) emit({ art: "audio", chunk: stille(100), sprache: false }); }, 100);
      const lauf = (async () => {
        await schlafen(30);
        emit({ art: "bereit", sitzungId: `attrappe-${e.callId}` });
        aktiv = true;
        for (const schritt of s.schritte) {
          if (beendet) break;
          if ("warteMs" in schritt) { await schlafen(schritt.warteMs); continue; }
          if ("beiKundenStimme" in schritt) {
            const t0 = Date.now();
            while (!beendet && Date.now() - t0 < 8000 && !(zuletztLautRein > 0 && Date.now() - zuletztLautRein < 100)) await schlafen(10);
            emit({ art: "kunde_spricht" });
            spur.kundeAm!.push(Date.now());
            emit({ art: "transkript", wer: "kunde", text: schritt.beiKundenStimme, final: true, t: t() });
            continue;
          }
          if ("nachKundeStillMs" in schritt) {
            const t0 = Date.now();
            while (!beendet && Date.now() - t0 < 8000 && !(zuletztLautRein > 0 && Date.now() - zuletztLautRein >= schritt.nachKundeStillMs)) await schlafen(10);
            continue;
          }
          if ("aras" in schritt) { if (schritt.ton) await arasSagtEcht(schritt.aras, schritt.ms ?? 2000, schritt.ton); else await arasSagt(schritt.aras, schritt.ms); continue; }
          if ("kunde" in schritt) {
            await schlafen(schritt.nachMs ?? 60);
            emit({ art: "kunde_spricht" });
            spur.kundeAm!.push(Date.now());
            emit({ art: "transkript", wer: "kunde", text: schritt.kunde, final: true, t: t() });
            continue;
          }
          if ("unterbrechen" in schritt) {
            // Aras redet, der Kunde fällt ihm ins Wort — mitten im Ton
            emit({ art: "spricht_an" });
            emit({ art: "transkript", wer: "aras", text: "… und deshalb wollte ich Ihnen noch erklären, wie ", final: false, t: t() });
            emit({ art: "audio", chunk: rede(300), sprache: true });
            await schlafen(40);
            emit({ art: "kunde_spricht" });
            emit({ art: "transkript", wer: "kunde", text: "Moment, Moment.", final: true, t: t() });
            spur.unterbrochen += 1;
            continue;
          }
          if ("werkzeug" in schritt || "erwarteWerkzeug" in schritt) {
            const name = ("werkzeug" in schritt ? schritt.werkzeug : schritt.erwarteWerkzeug) as Werkzeug;
            emit({ art: "werkzeug", name, eingabe: schritt.eingabe ?? {}, aufrufId: `call_${name}_${t()}` });
            const erg = await e.werkzeugAusfuehren(name, schritt.eingabe ?? {}, `call_${name}_${t()}`);
            spur.werkzeuge.push({ name, ergebnis: erg });
            if (erg.vorlesen) await arasSagt(erg.vorlesen, 200);
            continue;
          }
          if ("fehler" in schritt) { emit({ art: "fehler", code: schritt.fehler.code, text: schritt.fehler.text ?? schritt.fehler.code, fatal: schritt.fehler.fatal }); if (schritt.fehler.fatal) break; continue; }
          if ("auflegen" in schritt) { await schlafen(50); emit({ art: "ende", grund: "kunde_aufgelegt" }); break; }
        }
        emit({ art: "kosten", sekunden: Math.round(t() / 1000), kostenCents: 0 });
      })();
      void lauf.catch((err) => console.error("[ATTRAPPE]", err));
      return {
        audioRein(chunk) { spur.audioReinBytes += chunk.length; if (chunk.some((x) => x !== 0xff && x !== 0x7f)) zuletztLautRein = Date.now(); },
        unterbrechen() { /* der Ton stoppt — die Brücke zählt das clear */ },
        textEinschieben(text, art) {
          spur.eingeschoben.push({ text, art, am: Date.now() });
          // Eine Anweisung mit genauem Wortlaut (Notaus, Übergabe) spricht die Attrappe kurz — wie GPT-Live.
          if (art === "anweisung" && /genau diesen Satz|Sag sofort/.test(text) && !beendet) void (async () => { await schlafen(30); await arasSagt(text.slice(0, 120), 300); })();
          // Abschied-Wache der Brücke: die Stimme verabschiedet sich (wie GPT-Live) — außer das Skript spielt eine, die es ignoriert.
          if (art === "anweisung" && /verabschiede dich/i.test(text) && !s.abschiedIgnorieren && !beendet) void (async () => { await schlafen(300); await arasSagt("Super, dann ist alles notiert — danke Ihnen, und einen schönen Tag noch!", 400); })();
        },
        async beenden(grund) { beendet = true; aktiv = false; clearInterval(stilleTakt); spur.beendet = grund; fertigMelden(); return { sekunden: Math.round(t() / 1000), kostenCents: 0 }; },
      } satisfies Sitzung & { [k: string]: unknown } as Sitzung;
    },
  };
}
