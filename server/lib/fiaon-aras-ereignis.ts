// ═══════════════════════════════════════════════════════════════════════════
// ARAS — Ereignisse: Bus (SSE), Protokoll (fiaon_mara_protokoll, Kanal
// telefon), Alarm nur für Fatales (E-408, Vertrag § 9)
//
// Eine Tür für jedes Ereignis — Brücke, Werkzeuge, Wähler und Nachbereitung
// rufen arasEreignis(). Live-Transkriptzeilen gehen NUR über den Bus, nie in
// die Datenbank (außer nach Aufnahme-Ja in fiaon_aras_anruf.transkript).
// ═══════════════════════════════════════════════════════════════════════════
import { EventEmitter } from "node:events";
import { sqlPool } from "./db-pool";
import { protokollieren } from "./fiaon-mara-termin";
import { type ArasEreignis, type EreignisArt, type Spielart } from "../../shared/fiaon-aras";

const bus = new EventEmitter();
bus.setMaxListeners(100);

export function ereignisBus(): EventEmitter { return bus; }

/**
 * Live-Karte (Justin 20.10.: „wenn ich auflege, läuft der Kasten mit ‚übernehmen‘ dennoch weiter“): Nach dem Ende eines Anrufs
 * kamen noch Ereignisse (Prüf-Befund, Daumen, Übergabe-Ergebnis) — die Karte legte dafür den Kasten neu an. Darum: beim Ende
 * EIN Ereignis „ende“ (mit callId), danach tragen alle Ereignisse desselben Anrufs `nachEnde: true` — der Live-Strom des
 * KI-Raums lässt sie weg. Eine neue Sitzung desselben Anrufs (nach gescheiterter Übergabe) ist wieder live.
 */
const BEENDET = new Map<number, number>();
export function liveStromZeigen(ev: { nachEnde?: boolean } | null | undefined): boolean { return !ev?.nachEnde; }

export interface TranskriptZeile { callId: number; wer: "kunde" | "aras"; text: string; final: boolean; t: number }

export function transkriptMelden(z: TranskriptZeile): void {
  bus.emit("aras", { art: "aras_transkript", ...z });
}

export async function arasEreignis(e: {
  art: EreignisArt; callId: number; arasAnrufId?: number; personId?: number | null; spielart: Spielart;
  text?: string; daten?: Record<string, unknown>; ok?: boolean; nummer?: string | null;
}): Promise<void> {
  const ev: ArasEreignis & { nachEnde?: boolean } = { art: e.art, am: new Date().toISOString(), callId: e.callId, arasAnrufId: e.arasAnrufId, personId: e.personId ?? null, spielart: e.spielart, text: e.text, daten: e.daten };
  const beendetAm = BEENDET.get(e.callId);
  if (e.art === "aras_gewaehlt" || e.art === "aras_angenommen") BEENDET.delete(e.callId);
  else if (beendetAm) ev.nachEnde = true;
  try {
    if (e.art === "aras_ende" && !beendetAm) {
      bus.emit("aras", { art: "ende", am: ev.am, callId: e.callId, arasAnrufId: e.arasAnrufId ?? null, personId: e.personId ?? null, spielart: e.spielart, grund: (e.daten as any)?.grund ?? null });
      BEENDET.set(e.callId, Date.now());
      for (const [id, am] of Array.from(BEENDET.entries())) if (Date.now() - am > 30 * 60_000) BEENDET.delete(id);
    }
    bus.emit("aras", ev);
  } catch { /* Zuhörer-Fehler darf nichts anhalten */ }
  await protokollieren({
    kanal: "telefon", art: e.art as any, ok: e.ok ?? true, text: (e.text ?? e.art).slice(0, 1000), personId: e.personId ?? null, nummer: e.nummer ?? null,
    daten: { ...(e.daten ?? {}), callId: e.callId, arasAnrufId: e.arasAnrufId ?? null },
  }, sqlPool).catch(() => null);
  if (e.art === "aras_fehler" && e.daten?.fatal === true) {
    try {
      const { alarmMelden } = await import("./fiaon-system-alarme");
      await alarmMelden("aras:fehler", { quelle: "aras", titel: "ARAS: Anruf mit schwerem Fehler", text: (e.text ?? "").slice(0, 300), stufe: "gelb", link: "/chef/s/aras?reiter=probe", endetNachStunden: 6, anhaengen: true });
    } catch { /* Alarm ist Komfort */ }
  }
  if (e.art === "aras_notaus") {
    try {
      const { alarmMelden } = await import("./fiaon-system-alarme");
      await alarmMelden("aras:notaus", { quelle: "aras", titel: "ARAS: Notaus gezogen", text: (e.text ?? "").slice(0, 300), stufe: "rot", link: "/chef/s/aras?reiter=probe", endetNachStunden: 24, neueEpisode: true });
    } catch { /* Alarm ist Komfort */ }
  }
}
