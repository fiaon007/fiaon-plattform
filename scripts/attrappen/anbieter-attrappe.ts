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

export type Schritt =
  | { kunde: string; nachMs?: number }
  | { aras: string; ms?: number }
  | { werkzeug: Werkzeug; eingabe?: unknown }
  | { erwarteWerkzeug: Werkzeug; eingabe?: unknown }   // Alias (Vertrag § 13)
  | { unterbrechen: true }
  | { auflegen: true }
  | { fehler: { code: string; text?: string; fatal: boolean } }
  | { warteMs: number };

export interface Skript { schritte: Schritt[]; name?: string }

export interface AttrappeSpur { werkzeuge: { name: Werkzeug; ergebnis: WerkzeugErgebnis }[]; eingeschoben: { text: string; art: string }[]; unterbrochen: number; beendet: string | null; audioReinBytes: number }

export function attrappeMitSkript(s: Skript): StimmAdapter & { spur: AttrappeSpur; fertig: Promise<void> } {
  const spur: AttrappeSpur = { werkzeuge: [], eingeschoben: [], unterbrochen: 0, beendet: null, audioReinBytes: 0 };
  let fertigMelden: () => void = () => {};
  const fertig = new Promise<void>((l) => { fertigMelden = l; });
  return {
    name: "attrappe",
    spur, fertig,
    async bereit() { return { ok: true }; },
    async hoerprobe(e) { const roh = stille(1200); return { mime: "audio/wav", bytes: Buffer.concat([Buffer.from("RIFF"), roh]), dauerMs: 1200, kostenCents: 0 }; },
    async sitzungStarten(e: SitzungStart): Promise<Sitzung> {
      const start = Date.now();
      let beendet = false;
      let aktiv = false;
      const t = () => Date.now() - start;
      const emit = (ev: SitzungEreignis) => { if (!beendet) e.ereignis(ev); };
      const schlafen = (ms: number) => new Promise<void>((l) => setTimeout(l, ms));
      const arasSagt = async (text: string, ms = 300) => {
        emit({ art: "spricht_an" });
        emit({ art: "transkript", wer: "aras", text, final: false, t: t() });
        // 100-ms-Stücke Rede, damit die Brücke media + mark wirklich schickt (und am Pegel „spricht“ erkennt)
        for (let i = 0; i < Math.max(1, Math.round(ms / 100)); i++) { if (beendet) break; emit({ art: "audio", chunk: rede(100), sprache: true }); await schlafen(20); }
        emit({ art: "transkript", wer: "aras", text: "", final: true, t: t() });
        emit({ art: "spricht_aus" });
      };
      const stilleTakt = setInterval(() => { if (!beendet && aktiv) emit({ art: "audio", chunk: stille(100), sprache: false }); }, 100);
      const lauf = (async () => {
        await schlafen(30);
        emit({ art: "bereit", sitzungId: `attrappe-${e.callId}` });
        aktiv = true;
        for (const schritt of s.schritte) {
          if (beendet) break;
          if ("warteMs" in schritt) { await schlafen(schritt.warteMs); continue; }
          if ("aras" in schritt) { await arasSagt(schritt.aras, schritt.ms); continue; }
          if ("kunde" in schritt) {
            await schlafen(schritt.nachMs ?? 60);
            emit({ art: "kunde_spricht" });
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
        audioRein(chunk) { spur.audioReinBytes += chunk.length; },
        unterbrechen() { /* der Ton stoppt — die Brücke zählt das clear */ },
        textEinschieben(text, art) {
          spur.eingeschoben.push({ text, art });
          // Eine Anweisung mit genauem Wortlaut (Notaus, Übergabe) spricht die Attrappe kurz — wie GPT-Live.
          if (art === "anweisung" && /genau diesen Satz|Sag sofort/.test(text) && !beendet) void (async () => { await schlafen(30); await arasSagt(text.slice(0, 120), 300); })();
        },
        async beenden(grund) { beendet = true; aktiv = false; clearInterval(stilleTakt); spur.beendet = grund; fertigMelden(); return { sekunden: Math.round(t() / 1000), kostenCents: 0 }; },
      } satisfies Sitzung & { [k: string]: unknown } as Sitzung;
    },
  };
}
