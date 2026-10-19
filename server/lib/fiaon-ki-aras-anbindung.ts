// ═══════════════════════════════════════════════════════════════════════════
// DIE ANBINDUNG VON ARAS AN DEN KI-RAUM (E-409, 19.10.2026)
//
// Team 1 baut den ARAS-Kern (E-408: Warteschlange, Wähler, Brücke, Nachbereitung,
// Hörproben — SCHNITTSTELLE § 4). Team 2 baut den Raum /chef/ki. Damit der Raum
// gebaut und ausgeliefert werden kann, BEVOR der Kern da ist, ruft der Raum
// keine Datei von Team 1 direkt (der Produktions-Build bündelt mit esbuild —
// ein fehlender Import bräche den Build, ein dynamischer Pfad liefe im Bündel
// ins Leere). Stattdessen meldet sich der Kern hier an:
//
//   import { arasAnbinden } from "./fiaon-ki-aras-anbindung";
//   arasAnbinden({ plan: { arasEinstellungenLesen, einstellungSetzen, planLage, … }, waehler: { … }, … });
//
// Solange nichts angemeldet ist, antworten alle /chef/aras-Routen mit dem
// Leerzustand „Aras ist noch nicht verbunden“ (404, verbunden: false) — und der
// Raum zeigt genau das. Die Funktionen tragen die Signaturen des Vertrags § 4.
// ═══════════════════════════════════════════════════════════════════════════
import type { EventEmitter } from "events";
import type { AmpelWerkzeug } from "@shared/fiaon-ki-team";

export interface ArasAnbindung {
  /** Konstanten, die der Raum zeigt (Vertrag § 1): Ampel-Liste, Stimmen, Adapter. */
  konstanten?: {
    ARAS_AMPEL?: readonly AmpelWerkzeug[];
    STIMMEN?: readonly string[];
    ADAPTER?: readonly string[];
    /** Die aras_*-Schlüssel mit Vorgabe und Grenze (Vertrag § 3) — für die Einstellungen-Seite. */
    ARAS_SCHLUESSEL?: readonly string[];
  };
  plan?: {
    arasEinstellungenLesen: (frisch?: boolean) => Promise<Record<string, unknown>>;
    einstellungSetzen: (schluessel: string, wert: string, von: string) => Promise<void>;
    planLage: () => Promise<unknown>;
    planListe: (f: { status?: string; spielart?: string; seite?: number }) => Promise<unknown[]>;
    planEinreihen: (e: { personId: number; spielart: string; grund: string; von: string }) => Promise<{ ok: boolean; id?: number; grund?: string }>;
    planVerschieben: (id: number, bis: Date, grund: string, von: string) => Promise<void>;
    planEntfernen: (id: number, grund: string, von: string) => Promise<void>;
    tagesplan: (tag: string) => Promise<unknown>;
    lernvorschlag: () => Promise<unknown | null>;
  };
  waehler?: {
    notaus: (von: string, grund: string) => Promise<{ beendet: number }>;
    start: (von: string) => Promise<void>;
    leerlauf: (an: boolean, von: string) => Promise<{ laufend: number }>;
    laufendeSitzungen: () => unknown[];
  };
  bruecke?: {
    ereignisBus: () => EventEmitter;
    sitzungBeenden: (callId: number, grund: string) => Promise<void>;
    uebernehmen: (callId: number, agentId: number) => Promise<{ ok: boolean; grund?: string }>;
  };
  nachbereitung?: {
    anrufListe: (f: { tag?: string; spielart?: string; ergebnis?: string; seite?: number }) => Promise<unknown[]>;
    anrufDetail: (arasAnrufId: number) => Promise<unknown>;
    probeanruf: (e: { spielart: string; personId?: number; von: string; stimme?: string }) => Promise<{ ok: boolean; callId?: number; grund?: string }>;
    /** Zähler des Tages für „Heute“ und die Lage (gewählt, erreicht, Gespräche, Zusagen, €). */
    tagesZahlen?: (tag: string) => Promise<{ gewaehlt: number; erreicht: number; gespraeche: number; zusagen: number; euroKi: number; euroTelefon: number }>;
  };
  hoerprobe?: {
    hoerprobeErzeugen: (e: { adapter: string; stimme: string; beschreibung?: string; text: string }) => Promise<{ id: number }>;
    hoerprobenListe: () => Promise<unknown[]>;
    hoerprobeAudio: (id: number) => Promise<{ mime: string; bytes: Buffer } | null>;
    hoerprobeWaehlen: (id: number, von: string) => Promise<void>;
    hoerprobeBewerten: (id: number, bewertung: number, kommentar?: string) => Promise<void>;
  };
  sperre?: {
    telefonSperren: (e: { nummerKern: string; personId?: number | null; quelle: string; grund?: string; callId?: number }) => Promise<void>;
  };
  praesenz?: {
    praesenzMelden: (agentId: number) => Promise<void>;
    praesent: (agentId: number, maxSek?: number) => Promise<boolean>;
  };
}

let anbindung: ArasAnbindung | null = null;

/** Team 1 ruft das einmal beim Start (server/routes.ts, Block E-408). Mehrfach = zusammengeführt. */
export function arasAnbinden(a: ArasAnbindung): void {
  anbindung = { ...(anbindung ?? {}), ...a };
  console.log(`[KI-TEAM] ARAS angebunden: ${Object.keys(a).join(", ")}`);
}

/** Die Anbindung — oder null, solange Team 1 sich nicht gemeldet hat. */
export function aras(): ArasAnbindung | null { return anbindung; }
export function arasVerbunden(): boolean { return !!anbindung?.plan; }

/** Nur für Prüfstände: alles vergessen. */
export function arasAnbindungLoesen(): void { anbindung = null; }

export const NICHT_VERBUNDEN = "Aras ist noch nicht verbunden — der Telefon-Kern (E-408) meldet sich hier an, sobald er läuft.";
