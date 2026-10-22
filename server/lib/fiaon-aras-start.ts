// ═══════════════════════════════════════════════════════════════════════════
// ARAS — der Start (E-408): Routen, Ton-Strom, Anbindung an den KI-Raum, Takte
//
// server/routes.ts ruft arasStarten(app, httpServer) EINMAL (Block E-408):
//   1. Twilio-Rückrufe (/api/fiaon/aras/*) + der WebSocket-Pfad des Ton-Stroms
//   2. die eigenen Chef-Routen des Kerns (Probe-Stand, Daumen, Takt/Füllen von Hand)
//   3. die Anbindung an den KI-Raum (E-409, SCHNITTSTELLE § 17): arasAnbinden({…})
//      — ab dann zeigt der Raum „Aras“ keinen Leerzustand mehr, sondern den Kern.
//      WEICH: Auf main gibt es den KI-Raum noch nicht. Der Import läuft über ein
//      Glob-Muster (`./fiaon-ki-aras-${…}.ts`) — esbuild bündelt die Datei mit, sobald
//      sie da ist, und ohne sie fängt der Start das „nicht gefunden“ ab. Kein
//      Handgriff beim Zusammenführen; die Probe-Bedienung (/chef/s/aras-probe) läuft
//      ohne den Raum über die eigenen Routen /chef/aras/probe/*.
//   4. die Takte: aras_plan_fuellen (5 Min.), aras_waehler (20 s), aras_nachbereitung (1 Min.), aras_stufe_ampel (30 Min.)
//      Standard AUS: ohne aras_an = an und Stufe ≥ 1 wählt der Takt keinen Kunden.
// Dazu der geordnete Abschied beim Herunterfahren (Deploy): laufende Gespräche
// enden mit einem Satz statt mitten im Wort (alleSauberBeenden).
// ═══════════════════════════════════════════════════════════════════════════
import type { Express } from "express";
import type { Server as HttpServer } from "node:http";
import { tageslauf } from "./fiaon-crons";
import {
  arasEinstellungenLesen, einstellungSetzen, planLage, planListe, planEinreihen, planVerschieben, planEntfernen, planFuellen, tagesplan, lernvorschlag,
} from "./fiaon-aras-plan";
import { waehlerTakt, notaus, start, leerlauf, haengendeSchliessen } from "./fiaon-aras-waehler";
import { laufendeSitzungen, sitzungBeenden, uebernehmen, alleSauberBeenden } from "./fiaon-aras-bruecke";
import { ereignisBus } from "./fiaon-aras-ereignis";
import { anrufListe, anrufDetail, probeanruf, tagesZahlen } from "./fiaon-aras-nachbereitung";
import { hoerprobeErzeugen, hoerprobenListe, hoerprobeAudio, hoerprobeWaehlen, hoerprobeBewerten } from "./fiaon-aras-hoerprobe";
import { telefonSperren } from "./fiaon-aras-sperre";
import { praesenzMelden, praesent } from "./fiaon-softphone-praesenz";
import { ARAS_AMPEL, STIMMEN_OPENAI, ADAPTER, ARAS_SCHLUESSEL_LISTE, istSpielart, istPlanStatusWert, type AdapterName } from "../../shared/fiaon-aras";

let gestartet = false;

export async function arasStarten(app: Express, httpServer: HttpServer): Promise<void> {
  if (gestartet) return;
  gestartet = true;

  // 1. Twilio-Rückrufe + Ton-Strom
  const arasTwilio = await import("../routes/fiaon-aras-twilio");
  app.use("/api/fiaon", arasTwilio.default);
  arasTwilio.arasStreamAnbinden(httpServer);
  // 2. Eigene Chef-Routen (nur was der Vertrag nicht kennt) + Akte und Softphone (Scheibe 2)
  app.use("/api/fiaon", (await import("../routes/fiaon-aras-chef")).default);
  app.use("/api/fiaon", (await import("../routes/fiaon-aras-akte")).default);

  // 3. Anbindung an den KI-Raum (E-409) — Signaturen wie SCHNITTSTELLE § 4 (weich, siehe Kopf)
  const anbindung = arasAnbindungsObjekt();
  try {
    const teil = "anbindung";
    const raum: { arasAnbinden?: (a: unknown) => void } = await import(`./fiaon-ki-aras-${teil}.ts`);
    if (typeof raum.arasAnbinden === "function") raum.arasAnbinden(anbindung);
  } catch {
    console.log("[ARAS] KI-Raum (E-409) noch nicht da — Probe-Bedienung läuft über /chef/aras/probe/*.");
  }

  // 4. Takte (alle in REGISTRIERT über tageslauf; LAUF_FOLGEN in fiaon-crons.ts)
  tageslauf("aras_plan_fuellen", async () => await planFuellen(), 5 * 60_000, { beimStartNach: 60_000 });
  tageslauf("aras_waehler", async () => (await waehlerTakt()).gewaehlt > 0, 20_000, { beimStartNach: 45_000, nurMitErgebnis: true });
  tageslauf("aras_nachbereitung", async () => (await haengendeSchliessen()) > 0, 60_000, { beimStartNach: 90_000, nurMitErgebnis: true });
  // Scheibe 3 Teil 2: die Stufen-Ampel (Rot → eine Stufe zurück + Karte; Grün über Tage → eine hoch), alle 30 Minuten.
  tageslauf("aras_stufe_ampel", async () => (await (await import("./fiaon-aras-stufe")).stufeAutomatik()).geaendert, 30 * 60_000, { beimStartNach: 150_000, nurMitErgebnis: true });
  // Go-live (Koordination 20.10.2026 abends): EINMAL ab 21.10.2026 09:30 Berlin — setzt Stufe 1, Willkommen + Rate offen, Juni,
  // Wienerisch ultra, Fenster Mo–Sa 09:30–21:00 und ARAS an; danach nie wieder (Merker aras_golive_21_10).
  tageslauf("aras_golive", async () => await (await import("./fiaon-aras-golive")).golivePruefen(), 60_000, { beimStartNach: 30_000, nurMitErgebnis: true });
  // Justin 22.10.2026: „alle whatsapp raus schicken die ARAS angekündigt hat“ — EINMAL, tagsüber: was ARAS vor e09a0ffe
  // angekündigt, aber nicht getan hat (Link, Aufgabe für Justin, Rückruf), wird nachgeholt (Merker aras_nachholen_22_10).
  tageslauf("aras_nachholen", async () => await (await import("./fiaon-aras-nachholen")).nachholenPruefen(), 60_000, { beimStartNach: 120_000, nurMitErgebnis: true });

  console.log("[ARAS] Kern gestartet: Twilio-Rückrufe, Ton-Strom, Probe-Routen, Takte registriert.");
}

/**
 * Die Anbindung für den KI-Raum (E-409, SCHNITTSTELLE § 4/§ 17) — die Funktionen des Kerns mit den Signaturen des
 * Vertrags. Ohne Typ-Import aus dem Raum (auf main gibt es ihn noch nicht); die Parameter sind hier ausgeschrieben.
 */
export function arasAnbindungsObjekt() {
  return {
    konstanten: { ARAS_AMPEL, STIMMEN: STIMMEN_OPENAI, ADAPTER, ARAS_SCHLUESSEL: ARAS_SCHLUESSEL_LISTE },
    plan: {
      arasEinstellungenLesen: async (frisch?: boolean) => ({ ...(await arasEinstellungenLesen(frisch === true)) }) as unknown as Record<string, unknown>,
      einstellungSetzen: async (schluessel: string, wert: string, von: string) => { await einstellungSetzen(schluessel, wert, von); },
      planLage: () => planLage(),
      planListe: (f: { status?: string; spielart?: string; seite?: number }) => planListe({ status: f.status && istPlanStatusWert(f.status) ? f.status : undefined, spielart: f.spielart && istSpielart(f.spielart) ? f.spielart : undefined, seite: f.seite }),
      planEinreihen: async (e: { personId: number; spielart: string; grund: string; von: string }): Promise<{ ok: boolean; id?: number; grund?: string }> => {
        if (!istSpielart(e.spielart)) return { ok: false, grund: "Unbekannte Spielart." };
        const { personNummer } = await import("./fiaon-aras-plan");
        const nummer = await personNummer(e.personId);
        if (!nummer) return { ok: false, grund: "An dieser Person steht keine wählbare Nummer." };
        return planEinreihen({ personId: e.personId, nummer, spielart: e.spielart, grund: e.grund, erzeugtVon: "chef", auftragVon: e.von });
      },
      planVerschieben: (id: number, bis: Date, grund: string, von: string) => planVerschieben(id, bis, grund, von),
      planEntfernen: (id: number, grund: string, von: string) => planEntfernen(id, grund, von),
      tagesplan: (tag: string) => tagesplan(tag),
      lernvorschlag: () => lernvorschlag(),
    },
    waehler: { notaus, start, leerlauf, laufendeSitzungen },
    bruecke: { ereignisBus, sitzungBeenden, uebernehmen },
    nachbereitung: {
      anrufListe: (f: Parameters<typeof anrufListe>[0]) => anrufListe(f),
      anrufDetail: (id: number) => anrufDetail(id),
      probeanruf: (e: Parameters<typeof probeanruf>[0]) => probeanruf(e),
      tagesZahlen: (tag: string) => tagesZahlen(tag),
    },
    hoerprobe: {
      hoerprobeErzeugen: (e: { adapter: string; stimme: string; beschreibung?: string; text: string }) => hoerprobeErzeugen({ ...e, adapter: (ADAPTER as readonly string[]).includes(e.adapter) ? (e.adapter as AdapterName) : "openai_live" }),
      hoerprobenListe: () => hoerprobenListe(),
      hoerprobeAudio: (id: number) => hoerprobeAudio(id),
      hoerprobeWaehlen: (id: number, von: string) => hoerprobeWaehlen(id, von),
      hoerprobeBewerten: (id: number, b: number, k?: string) => hoerprobeBewerten(id, b, k),
    },
    sperre: { telefonSperren: (e: Parameters<typeof telefonSperren>[0]) => telefonSperren(e) },
    praesenz: { praesenzMelden: (id: number) => praesenzMelden(id), praesent: (id: number, maxSek?: number) => praesent(id, maxSek ?? 120) },
  };
}

/** Beim Herunterfahren (SIGTERM): laufende Gespräche mit einem Abschiedssatz beenden — höchstens ~8 s. */
export async function arasHerunterfahren(): Promise<number> {
  if (!gestartet) return 0;
  return Promise.race([alleSauberBeenden("deploy"), new Promise<number>((l) => setTimeout(() => l(-1), 9000))]);
}
