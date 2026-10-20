// ═══════════════════════════════════════════════════════════════════════════
// ARAS — die Brücke: Twilio Media Streams ⇄ Stimm-Adapter (E-408, Vertrag § 6/§ 7)
//
// Twilio liefert den Ton des Kunden als WebSocket (µ-law 8 kHz, base64), wir
// reichen ihn OHNE Umwandlung an den Adapter; was der Adapter spricht, geht
// denselben Weg zurück. Dazwischen sitzt nur, was ein Mensch am Telefon auch tut:
//
//   · SCHNELL (Prio 3): Die Sitzung beim Anbieter beginnt schon, wenn Twilio
//     beim Abheben die TwiML holt (vorbereiten) — nicht erst, wenn der Ton-Strom
//     steht. Die Begrüßung liegt dann schon bereit, wenn der Strom ankommt.
//   · Voraus-Takt: nie mehr als 500 ms Ton bei Twilio (mark je 100 ms).
//   · UNTERBRECHEN (Prio 1): GPT-Live hört selbst auf, wenn der Kunde dazwischen-
//     redet — aber was schon bei Twilio liegt, spielt weiter. Darum: Hört die
//     Brücke Kundenstimme (eigene Lautstärke-Erkennung oder Kunden-Transkript),
//     schaut sie 180 ms lang, ob die Stimme weiterredet. Kommt kein neuer Ton
//     mehr, hat Aras aufgehört → sofort `clear` an Twilio. Redet Aras weiter
//     (der Kunde sagte nur „mhm“), bleibt alles, wie es ist.
//   · Start binnen 5 s mit gültigem Token (HMAC über anruf|exp), sonst zu (4401).
//   · Begrüßung und KI-Hinweis (KI-VO Art. 50) werden überwacht: kein Ton 3,5 s
//     nach dem Start → die Begrüßung wird nachgeschoben; fehlt „KI“/„digitale“
//     in den ersten Sätzen → der Hinweis wird nachgeschoben.
//   · Aufnahme nur nach Ja: Fragt Aras nach der Aufzeichnung, wertet die Brücke
//     die nächste Antwort des Kunden selbst (eindeutiges Ja → Aufnahme, Nein →
//     ohne Band). Unklares bleibt ohne Aufnahme. Das Werkzeug kann es zusätzlich.
//   · Transkript nur nach Ja in die Datenbank; live nur über den Bus (SSE).
//   · MENSCHLICH (Justins Tests 20.10., Anrufe 5 und 6):
//     – Geduld-Tor (aras_zuhoeren): Fängt Aras an, während der Kunde gerade noch
//       sprach (oder kurz nach Aras' eigener Frage, die noch unbeantwortet ist),
//       hält die Brücke den Ton zurück, bis der Kunde lange genug still ist. Redet
//       der Kunde weiter und GPT-Live hört auf, hört der Kunde den Ansatz nie
//       („Also...“ fällt weg, die Zeile heißt „verworfen“). Danach holt die Brücke
//       den Rückstand in der nächsten Pause auf (Stille-Rahmen fallen weg).
//     – Wiederholungs-Wache: Ist ein Satz ≥ 80 % gleich einem der letzten drei,
//       bekommt die Stimme sofort den versteckten Hinweis, es anders zu sagen.
//     – Abschied-Wache: anruf_beenden ohne hörbaren Abschied → kein Auflegen; die
//       Stimme verabschiedet sich erst, dann seine Antwort oder kurze Ruhe.
//   · Ende: Kunde legt auf / Aras beendet / Mailbox / Notaus / Stille / Fehler /
//     Übergabe (dann ist Twilios `stop` KEIN Auflegen) / Zeitlimit — danach
//     die Nachbereitung (fiaon-aras-nachbereitung.ts).
//
// Alles Laufende lebt im Speicher dieses Prozesses (LAUFENDE). Ein eigener
// Render-Dienst (DIENST=aras) hält diese Sitzungen — Deploys der Hauptinstanz
// stören sie dann nicht (ENTWURF § 7.8, Scheibe 1b).
// ═══════════════════════════════════════════════════════════════════════════
import type { Server as HttpServer, IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, WebSocket } from "ws";
import { sqlPool } from "./db-pool";
import { arasSchema } from "./fiaon-aras-schema";
import { adapterFuer, pegel, mulawZuPcm16, pcm16ZuMulaw, type Sitzung, type SitzungEreignis } from "./fiaon-aras-adapter";
import { atmoMischen, type AtmoArt } from "./fiaon-aras-atmo";
import { arasEinstellungenLesen } from "./fiaon-aras-plan";
import { werkzeugAusfuehren, type WerkzeugKontext } from "./fiaon-aras-werkzeuge";
import { arasEreignis, transkriptMelden } from "./fiaon-aras-ereignis";
import { streamTokenPruefen, twilioClient, arasCallerId, rueckrufUrl, twimlUebergabe } from "./fiaon-aras-twilio-client";
import { anweisungBauen, begruessungText, NOTAUS_SATZ, ABSCHIED_EINFORDERN, type Briefing } from "../../shared/fiaon-aras-prompt";
import {
  ANRUF_ZEITLIMIT_SEK, telefonKostenCents, istAufnahmeJa, istAufnahmeNein, GEDULD_MS,
  type AdapterName, type Spielart, type Land, type LiveSitzung, type ArasEinstellungen, type ArasErgebnis,
} from "../../shared/fiaon-aras";
import { wiederholtSich, ABSCHIED_RE, ABSCHIED_AT_RE, WIEDERHOLUNG_HINWEIS } from "../../shared/fiaon-aras-regeln";
import { anweisungLesen } from "./fiaon-mara-anweisung";

export const STREAM_PFAD = "/api/fiaon/aras/stream";
const START_FRIST_MS = 5000;
const MARK_MS = 100, MARK_BYTES = MARK_MS * 8, VORAUS_MARKS = 5;   // 100 ms je mark, höchstens 500 ms voraus
/** Schwelle der eigenen Lautstärke-Erkennung (mittlere Amplitude 0–1); passt sich dem Grundrauschen an. */
const VAD_MIN = Number(process.env.ARAS_VAD_SCHWELLE || 0.02);
/** So lange schaut die Brücke nach Kundenstimme, ob Aras weiterredet, bevor sie Twilio leert. */
const UNTERBRECHEN_PRUEF_MS = 180;
/** Begrüßung nachschieben, wenn so lange nach dem Start kein Ton kam und der Kunde nichts sagte. */
const GRUSS_NACH_MS = 3500;
/** Ohne ein Wort des Kunden nach dem Start: so lange, dann gilt „nicht erreicht“ (stille Leitung, Mailbox ohne Erkennung). */
const STILLE_OHNE_KUNDE_MS = 20_000;
/** Niemand sagt etwas: so lange, dann legt Aras freundlich auf. */
const STILLE_ENDE_MS = 45_000;
/** Vorbereitete Sitzung ohne Ton-Strom: so lange warten, dann aufgeben. */
const VORBEREITET_FRIST_MS = 12_000;
/** Geduld-Tor: Aras' Rede nach so langer eigener Stille gilt als NEUER Redebeitrag (nur dessen Anfang wird geprüft). */
const NEUER_BEITRAG_MS = 350;
/** Geduld-Tor: länger hält die Brücke nie zurück (dann spielt sie ab — lieber spät als verloren). */
const HALTEN_HOECHSTENS_MS = 3000;
/** Die Lautstärke des Kunden zählt fürs Tor nur, wenn er so kurz vorher auch WORTE gesagt hat (Straßenlärm, Fernseher ≠ Rede). */
const PEGEL_NUR_MIT_TEXT_MS = 2500;
/** Rückstand nach dem Halten: Stille-Rahmen fallen erst weg, wenn Aras so lange still ist (keine Pausen IM Satz kürzen). */
const AUFHOLEN_NACH_MS = 250;
/** Abschied-Wache: so lange wartet die Brücke nach anruf_beenden auf den Abschied, dann legt sie trotzdem auf. */
const abschiedFristMs = () => Number(process.env.ARAS_ABSCHIED_FRIST_MS || 15_000);

export interface TranskriptZeile {
  t: number; wer: "kunde" | "aras"; text: string; final: boolean; abgebrochen?: boolean; am: number;
  /** Wann das erste Bruchstück kam (Uhrzeit) — ein Ja zur Aufnahme zählt nur aus einer Zeile, die NACH der Frage begann. */
  beginn?: number;
  /** Aras-Zeile, die der Kunde nie gehört hat (Geduld-Tor: verworfen, weil er weiterredete). */
  verworfen?: boolean;
  /** Wiederholungs-Wache hat für diese Zeile schon angeschlagen. */
  wiederholt?: boolean;
}

interface Lauf {
  callId: number; arasAnrufId: number; personId: number | null; ref: string | null; nummer: string; land: Land; spielart: Spielart;
  briefing: Briefing; einstellungen: ArasEinstellungen; adapter: AdapterName; probe: boolean; trocken: boolean;
  twilioSid: string | null; streamSid: string | null; ws: WebSocket | null; sitzung: Sitzung | null;
  seit: number; bereitAm: number | null; zustand: LiveSitzung["zustand"]; spricht: boolean; zuletztAusgabe: number; zuletztSprache: number; zuletztRede: number;
  zeilen: TranskriptZeile[]; aufnahmeJa: boolean; aufnahmeNein: boolean; aufnahmeFrageAm: number | null;
  /** Single-Flight: der eine laufende Aufnahme-Start (Ja-Erkennung der Brücke und Werkzeug des Modells kommen oft gleichzeitig). */
  aufnahmeStart: Promise<{ ok: boolean; grund?: string }> | null;
  kundeHatGesprochen: boolean; kundeLaut: boolean; kiHinweisAm: number | null; abschiedAm: number | null; arasErsteRedeAm: number | null; grussNachgeschoben: boolean; hinweisNachgeschoben: boolean;
  puffer: Buffer[]; pufferBytes: number; offeneMarks: number; markNr: number; markGen: number; clears: number;
  pruefUnterbrechen: NodeJS.Timeout | null; pruefNochmal: boolean; clearSprache: number; lautFrames: number; rauschen: number;
  uebergabeLaeuft: boolean; notaus: boolean; beendet: boolean; endeGrund: string | null;
  ergebnis: ArasErgebnis | null; ergebnisNotiz: string | null;
  sekunden: number; kostenCents: number;
  ctx: WerkzeugKontext | null; timer: NodeJS.Timeout[]; takt: NodeJS.Timeout | null;
  /** Büro-Atmosphäre (aras_hintergrund): Art, Position in der Schleife, Füll-Takt, gesendete reine Atmo-Stücke. */
  atmo: AtmoArt | null; atmoPos: number; atmoTakt: NodeJS.Timeout | null; atmoStuecke: number;
  /** Geduld-Tor: zuletzt Kundenstimme (Pegel, Transkript), Aras' letzte Frage, der zurückgehaltene Ton, der Rückstand. */
  kundePegelAm: number; kundeTextAm: number; frageAm: number; halten: { seit: number; takt: NodeJS.Timeout } | null; halte: Buffer[]; halteBytes: number;
  /** Fragen in zurückgehaltenen Zeilen: gelten erst, wenn der Kunde sie hört (Freigabe) — verworfen nie. */
  halteFragen: { aufnahme: boolean; frage: boolean; abschied: boolean } | null;
  /**
   * Erkannt, aber noch nicht gehört: Der Text kommt oft VOR dem Ton. Eine Frage (Aufnahme-Frage, Abschied) gilt erst, wenn
   * Aras' Redebeitrag zu Ende gespielt ist — sonst zählte ein „Ja“, bevor der Kunde die Frage überhaupt hören konnte.
   */
  offen: { aufnahme: boolean; frage: boolean; abschied: boolean };
  aufholenBytes: number; gehalten: number; verworfen: number;
  /** Wiederholungs-Wache und Abschied-Wache. */
  wiederholHinweise: number; abschiedEingefordert: number | null;
  fertig: Promise<void>; fertigMelden: () => void;
}

const LAUFENDE = new Map<number, Lauf>();
const VORBEREITUNG = new Map<number, Promise<Lauf | null>>();

export function laufendeSitzungen(): LiveSitzung[] {
  // Ohne Namen: Die Lage-Route des KI-Raums zeigt diese Liste auch der Leitung (Vertrag § 9).
  return Array.from(LAUFENDE.values()).map((l) => ({
    callId: l.callId, arasAnrufId: l.arasAnrufId, personId: l.personId, name: "", spielart: l.spielart,
    seitSek: Math.round((Date.now() - l.seit) / 1000), zustand: l.zustand, adapter: l.adapter, aufnahme: l.aufnahmeJa,
    letzteZeilen: l.zeilen.slice(-6).map((z) => ({ wer: z.wer, text: z.text.slice(0, 160) })),
  }));
}
export function laeuft(callId: number): boolean { return LAUFENDE.has(callId); }
export function kundeSprachSchon(callId: number): boolean { return LAUFENDE.get(callId)?.kundeHatGesprochen === true; }
export function uebergabeLaeuft(callId: number): boolean { return LAUFENDE.get(callId)?.uebergabeLaeuft === true; }
/** Für Prüfstände: Kennzahlen eines laufenden Gesprächs. */
export function laufZahlen(callId: number): {
  clears: number; offeneMarks: number; pufferBytes: number; aufnahmeJa: boolean; aufnahmeNein: boolean; kiHinweis: boolean; atmo: string | null; atmoStuecke: number;
  halten: boolean; gehalten: number; verworfen: number; wiederholungen: number; abschiedEingefordert: boolean; abschied: boolean;
} | null {
  const l = LAUFENDE.get(callId);
  return l ? {
    clears: l.clears, offeneMarks: l.offeneMarks, pufferBytes: l.pufferBytes, aufnahmeJa: l.aufnahmeJa, aufnahmeNein: l.aufnahmeNein, kiHinweis: !!l.kiHinweisAm, atmo: l.atmo, atmoStuecke: l.atmoStuecke,
    halten: !!l.halten, gehalten: l.gehalten, verworfen: l.verworfen, wiederholungen: l.wiederholHinweise, abschiedEingefordert: !!l.abschiedEingefordert, abschied: !!l.abschiedAm,
  } : null;
}

// ── WebSocket-Anbindung ────────────────────────────────────────────────────
let wss: WebSocketServer | null = null;

/** Hängt den Stream-Pfad an den HTTP-Server — nur unser Pfad, alle anderen Upgrades (Vite-HMR …) bleiben unberührt. */
export function arasStreamAnbinden(server: HttpServer): void {
  if (wss) return;
  wss = new WebSocketServer({ noServer: true, perMessageDeflate: false });
  server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const pfad = String(req.url ?? "").split("?")[0];
    if (pfad !== STREAM_PFAD) return;
    wss!.handleUpgrade(req, socket, head, (ws) => verbindung(ws));
  });
  console.log(`[ARAS] Stream-Pfad angebunden: ${STREAM_PFAD}`);
}

/** Eine Twilio-Verbindung — auch der Prüfstand (TwilioAttrappe) kommt hier an. */
export function verbindung(ws: WebSocket): void {
  let lauf: Lauf | null = null;
  const vorStart: any[] = [];
  const frist = setTimeout(() => { if (!lauf) { try { ws.close(4401, "kein start"); } catch { /* egal */ } } }, START_FRIST_MS);
  ws.on("message", (roh) => {
    let m: any;
    try { m = JSON.parse(roh.toString()); } catch { return; }
    const ev = String(m?.event ?? "");
    if (ev === "start" && !lauf) {
      clearTimeout(frist);
      const p = m?.start?.customParameters ?? {};
      const callId = Number(String(p?.anruf ?? "").replace(/\D/g, ""));
      if (!callId || !streamTokenPruefen(callId, p?.t)) { try { ws.close(4401, "token"); } catch { /* egal */ } return; }
      void anbinden({ callId, ws, streamSid: String(m?.start?.streamSid ?? ""), callSid: String(m?.start?.callSid ?? ""), fortsetzung: p?.fortsetzung ? String(p.fortsetzung) : undefined })
        .then((l) => { lauf = l; for (const x of vorStart.splice(0)) behandeln(l, x); })
        .catch((err) => { console.error("[ARAS] Sitzung:", String(err?.message ?? err).slice(0, 300)); try { ws.close(4500, "sitzung"); } catch { /* egal */ } });
      return;
    }
    if (!lauf) { if (vorStart.length < 400) vorStart.push(m); return; }
    behandeln(lauf, m);
  });
  ws.on("close", () => {
    clearTimeout(frist);
    if (lauf && !lauf.beendet && lauf.ws === ws) void sitzungEnde(lauf, lauf.uebergabeLaeuft ? "uebergabe" : lauf.notaus ? "notaus" : lauf.endeGrund ?? "kunde_aufgelegt");
  });
  ws.on("error", () => { /* close folgt */ });
}

function behandeln(lauf: Lauf, m: any): void {
  switch (String(m?.event ?? "")) {
    case "media": {
      const payload = m?.media?.payload;
      if (typeof payload !== "string") return;
      const chunk = Buffer.from(payload, "base64");
      lauf.sitzung?.audioRein(chunk);
      kundenPegel(lauf, chunk);
      return;
    }
    case "mark": {
      const name = String(m?.mark?.name ?? "");
      if (name.startsWith(`m${lauf.markGen}-`)) { lauf.offeneMarks = Math.max(0, lauf.offeneMarks - 1); pumpen(lauf); }
      return;
    }
    case "stop":
      void sitzungEnde(lauf, lauf.uebergabeLaeuft ? "uebergabe" : lauf.notaus ? "notaus" : lauf.endeGrund ?? "kunde_aufgelegt");
      return;
    default:
      return; // connected, dtmf
  }
}

// ── Sitzung aufbauen: vorbereiten (beim Abheben) oder direkt beim Strom ────
/**
 * Beim Abheben (TwiML-Abruf): die Sitzung beim Anbieter schon aufbauen, damit die Begrüßung bereitliegt,
 * wenn Twilios Ton-Strom ankommt (spart 300–700 ms). Fehler hier sind still — dann baut `anbinden` neu auf.
 */
export function vorbereiten(callId: number, fortsetzung?: string): void {
  if (LAUFENDE.has(callId) || VORBEREITUNG.has(callId)) return;
  const p = sitzungAufbauen({ callId, ws: null, fortsetzung }).catch((err) => {
    console.error("[ARAS] Vorbereitung:", String((err as Error)?.message ?? err).slice(0, 200));
    return null;
  });
  VORBEREITUNG.set(callId, p);
  // Kommt kein Strom, Sitzung wieder zu (kein Ton, keine Kosten im Leerlauf).
  setTimeout(async () => {
    const l = await p;
    VORBEREITUNG.delete(callId);
    if (l && !l.ws && !l.beendet) await sitzungEnde(l, "kein_stream");
  }, VORBEREITET_FRIST_MS);
}

async function anbinden(e: { callId: number; ws: WebSocket; streamSid: string; callSid: string; fortsetzung?: string }): Promise<Lauf> {
  const vor = VORBEREITUNG.get(e.callId);
  if (vor && !e.fortsetzung) {
    VORBEREITUNG.delete(e.callId);
    const l = await vor;
    if (l && !l.beendet) {
      if (e.callSid && l.twilioSid && !l.twilioSid.startsWith("ATTRAPPE") && l.twilioSid !== e.callSid) throw new Error("callSid passt nicht zum Anruf.");
      l.ws = e.ws; l.streamSid = e.streamSid || null;
      if (!l.twilioSid && e.callSid) l.twilioSid = e.callSid;
      void sqlPool`UPDATE fiaon_aras_anruf SET stream_sid = ${e.streamSid || null}, updated_at = NOW() WHERE id = ${l.arasAnrufId}`.catch(() => null);
      pumpen(l);
      return l;
    }
  }
  return sitzungAufbauen({ callId: e.callId, ws: e.ws, streamSid: e.streamSid, callSid: e.callSid, fortsetzung: e.fortsetzung });
}

/** Für Prüfstände und den Strom: eine Sitzung aufbauen (mit oder ohne Twilio-Verbindung). */
export async function sitzungStarten(e: { callId: number; ws: WebSocket | null; streamSid?: string; callSid?: string; fortsetzung?: string }): Promise<Lauf> {
  return sitzungAufbauen(e);
}

async function sitzungAufbauen(e: { callId: number; ws: WebSocket | null; streamSid?: string; callSid?: string; fortsetzung?: string }): Promise<Lauf> {
  await arasSchema();
  if (LAUFENDE.has(e.callId)) {
    const alt = LAUFENDE.get(e.callId)!;
    if (alt.uebergabeLaeuft && e.fortsetzung === "uebergabe_gescheitert") { await sitzungEnde(alt, "uebergabe_gescheitert_neu"); }
    else throw new Error(`Sitzung ${e.callId} läuft schon.`);
  }
  const [z] = (await sqlPool`
    SELECT aa.id AS aras_anruf_id, aa.spielart, aa.briefing, aa.adapter, aa.stimme, c.person_id, c.ref, c.nummer, c.twilio_sid
      FROM fiaon_aras_anruf aa JOIN fiaon_calls c ON c.id = aa.call_id
     WHERE aa.call_id = ${e.callId}`) as any[];
  if (!z) throw new Error(`Kein ARAS-Anruf zu call ${e.callId}.`);
  if (e.callSid && z.twilio_sid && !String(z.twilio_sid).startsWith("ATTRAPPE") && z.twilio_sid !== e.callSid) throw new Error("callSid passt nicht zum Anruf.");

  const einstellungen = await arasEinstellungenLesen(true);
  if (einstellungen.notaus) throw new Error("Notaus ist an — keine neue Sitzung.");
  const briefing = (typeof z.briefing === "string" ? JSON.parse(z.briefing) : z.briefing) as Briefing;
  const spielart = z.spielart as Spielart;
  const probe = spielart === "probe" || briefing.probe === true;
  const hausanweisung = await anweisungLesen("telefon" as any).catch(() => "");
  const anweisung = anweisungBauen({ spielart, briefing, einstellungen, hausanweisung: hausanweisung || null });
  const adapterName = (z.adapter as AdapterName) || einstellungen.adapter;
  const stimme = String(z.stimme || einstellungen.stimme);
  const adapter = adapterFuer(adapterName);
  const b = await adapter.bereit();
  if (!b.ok) throw new Error(b.grund ?? "Adapter nicht bereit.");

  let fertigMelden: () => void = () => {};
  const fertig = new Promise<void>((l) => { fertigMelden = l; });
  const lauf: Lauf = {
    callId: e.callId, arasAnrufId: Number(z.aras_anruf_id), personId: z.person_id != null ? Number(z.person_id) : null, ref: z.ref ?? null,
    nummer: String(z.nummer), land: briefing.land, spielart, briefing, einstellungen, adapter: adapterName, probe,
    // Probe: Werkzeuge ohne Wirkung nach außen — außer bei einer ausdrücklichen Testperson (ist_test_am), dann echt (Abnahme Scheibe 2).
    trocken: probe && !(await testperson(z.person_id)),
    twilioSid: z.twilio_sid ?? null, streamSid: e.streamSid ?? null, ws: e.ws, sitzung: null,
    seit: Date.now(), bereitAm: null, zustand: "waehlt", spricht: false, zuletztAusgabe: 0, zuletztSprache: 0, zuletztRede: Date.now(),
    zeilen: [], aufnahmeJa: false, aufnahmeNein: false, aufnahmeFrageAm: null, aufnahmeStart: null,
    kundeHatGesprochen: false, kundeLaut: false, kiHinweisAm: null, abschiedAm: null, arasErsteRedeAm: null, grussNachgeschoben: false, hinweisNachgeschoben: false,
    puffer: [], pufferBytes: 0, offeneMarks: 0, markNr: 0, markGen: 1, clears: 0,
    pruefUnterbrechen: null, pruefNochmal: false, clearSprache: 0, lautFrames: 0, rauschen: 0.004,
    uebergabeLaeuft: false, notaus: false, beendet: false, endeGrund: null, ergebnis: null, ergebnisNotiz: null,
    sekunden: 0, kostenCents: 0, ctx: null, timer: [], takt: null,
    atmo: einstellungen.hintergrund && einstellungen.hintergrund !== "aus" ? einstellungen.hintergrund : null, atmoPos: 0, atmoTakt: null, atmoStuecke: 0,
    kundePegelAm: 0, kundeTextAm: 0, frageAm: 0, halten: null, halte: [], halteBytes: 0, halteFragen: null, offen: { aufnahme: false, frage: false, abschied: false }, aufholenBytes: 0, gehalten: 0, verworfen: 0,
    wiederholHinweise: 0, abschiedEingefordert: null,
    fertig, fertigMelden,
  };
  lauf.ctx = kontextFuer(lauf);
  LAUFENDE.set(lauf.callId, lauf);
  // Büro-Atmosphäre: in Pausen läuft sie in Echtzeit weiter (ein Füll-Takt hält 200 ms bei Twilio vorrätig).
  if (lauf.atmo) lauf.atmoTakt = setInterval(() => atmoFuellen(lauf), ATMO_TAKT_MS);

  await sqlPool`UPDATE fiaon_aras_anruf SET prompt_version = ${anweisung.version}, stream_sid = COALESCE(${e.streamSid ?? null}, stream_sid), modell = ${einstellungen.modellStimme}, stimme = ${stimme},
                 angenommen_am = COALESCE(angenommen_am, NOW()), updated_at = NOW() WHERE id = ${lauf.arasAnrufId}`;
  await sqlPool`UPDATE fiaon_calls SET status = 'laeuft', updated_at = NOW() WHERE id = ${lauf.callId} AND status IN ('gewaehlt', 'laeuft')`;

  try {
    lauf.sitzung = await adapter.sitzungStarten({
      callId: lauf.callId, arasAnrufId: lauf.arasAnrufId, spielart, land: briefing.land,
      anweisung: anweisung.text, hintergrundAnweisung: anweisung.backend, begruessung: e.fortsetzung ? null : anweisung.begruessung,
      stimme, modell: einstellungen.modellStimme, modellGehirn: einstellungen.modellGehirn,
      werkzeuge: anweisung.werkzeuge, audio: { rein: "pcmu_8k", raus: "pcmu_8k" }, regie: einstellungen.regie,
      fortsetzung: e.fortsetzung === "uebergabe_gescheitert" || e.fortsetzung === "wiederaufbau" ? e.fortsetzung : undefined,
      ereignis: (ev) => adapterEreignis(lauf, ev),
      werkzeugAusfuehren: (name, eingabe, aufrufId) => werkzeugAusfuehren(lauf.ctx!, name, eingabe, aufrufId),
    });
  } catch (err) {
    LAUFENDE.delete(lauf.callId);
    await arasEreignis({ art: "aras_fehler", callId: lauf.callId, arasAnrufId: lauf.arasAnrufId, personId: lauf.personId, spielart, text: `Sitzung nicht aufgebaut: ${String((err as Error)?.message ?? err).slice(0, 200)}`, ok: false, daten: { fatal: true } });
    await sqlPool`UPDATE fiaon_aras_anruf SET fehler = ${String((err as Error)?.message ?? err).slice(0, 300)}, updated_at = NOW() WHERE id = ${lauf.arasAnrufId}`.catch(() => null);
    throw err;
  }
  lauf.bereitAm = Date.now(); lauf.zuletztRede = Date.now(); lauf.zustand = "hoert";
  if (!lauf.ws) {
    // Vorbereitet ohne Ton-Strom: GPT-Live braucht durchgehend Eingangston (Doku) — bis der Strom da ist, Stille.
    const leer = Buffer.alloc(800, 0xff);
    const warm = setInterval(() => { if (lauf.beendet || lauf.ws) { clearInterval(warm); return; } lauf.sitzung?.audioRein(leer); }, 100);
    lauf.timer.push(warm as unknown as NodeJS.Timeout);
  }
  lauf.timer.push(setTimeout(() => { void sitzungEnde(lauf, "zeitlimit"); }, ANRUF_ZEITLIMIT_SEK * 1000));
  lauf.takt = setInterval(() => wachen(lauf), 500);
  await arasEreignis({ art: "aras_angenommen", callId: lauf.callId, arasAnrufId: lauf.arasAnrufId, personId: lauf.personId, spielart, text: `Gespräch läuft (${adapterName}, ${stimme})${probe ? " — Probe" : ""}`, nummer: lauf.nummer });
  if (e.fortsetzung === "uebergabe_gescheitert") {
    lauf.sitzung.textEinschieben("Die Weiterleitung zu einem Kollegen hat nicht geklappt. Sag dem Kunden freundlich, dass jemand aus dem Team zurückruft, und lass den Rückruf eintragen (rueckruf_buchen, bei: betreuer).", "anweisung");
  }
  pumpen(lauf);
  return lauf;
}

async function testperson(personId: unknown): Promise<boolean> {
  if (personId == null) return false;
  const [p] = (await sqlPool`SELECT ist_test_am FROM fiaon_persons WHERE id = ${Number(personId)}`.catch(() => [])) as any[];
  return !!p?.ist_test_am;
}

function kontextFuer(l: Lauf): WerkzeugKontext {
  return {
    callId: l.callId, arasAnrufId: l.arasAnrufId, personId: l.personId, ref: l.ref, nummer: l.nummer, land: l.land, spielart: l.spielart,
    briefing: l.briefing, einstellungen: l.einstellungen, ergebnisGesetzt: false, ausgefuehrt: [], trocken: l.trocken,
    letzteKundenZeile: () => [...l.zeilen].reverse().find((z) => z.wer === "kunde" && z.text.trim())?.text ?? null,
    kundeSagteJa: () => kundeSagteJaZurAufnahme(l),
    aufnahmeStarten: async () => {
      if (l.aufnahmeJa) return { ok: true, schon: true };
      // Nur EIN Start: sagt der Kunde „Ja“, starten Brücke und Modell fast gleichzeitig — der zweite wartet auf den ersten
      // (sonst zwei Twilio-Aufnahmen). Schlägt der Start fehl, darf ein späterer Versuch es noch einmal probieren.
      if (l.aufnahmeStart) { const r = await l.aufnahmeStart; return r.ok ? { ok: true, schon: true } : r; }
      const start = (async (): Promise<{ ok: boolean; grund?: string }> => {
        if (!l.twilioSid || l.twilioSid.startsWith("ATTRAPPE")) { l.aufnahmeJa = true; return { ok: true }; }
        try {
          const c = await twilioClient();
          await c.calls(l.twilioSid).recordings.create({ recordingChannels: "dual", recordingStatusCallback: rueckrufUrl("/api/fiaon/aras/aufnahme", l.callId), recordingStatusCallbackEvent: ["completed"] });
          l.aufnahmeJa = true;
          return { ok: true };
        } catch (err) { return { ok: false, grund: String((err as Error)?.message ?? err).slice(0, 200) }; }
      })();
      l.aufnahmeStart = start;
      const r = await start;
      if (!r.ok) l.aufnahmeStart = null;
      return r;
    },
    aufnahmeAbgelehnt: () => { l.aufnahmeNein = true; },
    uebergabe: (agentId, grund) => uebergabeStarten(l, agentId, grund),
    beenden: async (ergebnis, notiz) => {
      l.ergebnis = ergebnis; l.ergebnisNotiz = notiz; l.endeGrund = "aras_beendet";
      // Abschied-Wache (Justins Test 20.10., Anruf 6: „Sehr gut, ähm, Moment.“ — und aufgelegt): ohne hörbaren Abschied wird
      // nicht aufgelegt. Die Stimme verabschiedet sich erst; danach seine Antwort oder kurze Ruhe auf beiden Seiten.
      if (!l.abschiedAm && !l.abschiedEingefordert) {
        l.abschiedEingefordert = Date.now();
        l.sitzung?.textEinschieben(ABSCHIED_EINFORDERN, "anweisung");
      }
      const t0 = Date.now();
      const frist = l.abschiedEingefordert ? abschiedFristMs() : 10_000;
      const warten = () => {
        if (l.beendet) return;
        const jetzt = Date.now();
        const ausgespielt = !l.halten && l.pufferBytes === 0;
        const ruhe = !l.spricht && jetzt - l.zuletztSprache > 1100 && jetzt - l.zuletztRede > 1500 && ausgespielt;
        if ((l.abschiedAm && ruhe && jetzt - l.abschiedAm > 1200) || jetzt - t0 > frist) {
          if (!l.abschiedAm) console.log(`[ARAS] call ${l.callId}: aufgelegt ohne Abschied (Frist ${Math.round(frist / 1000)} s) — steht als Befund in der Prüfung.`);
          void sitzungEnde(l, "aras_beendet");
        } else l.timer.push(setTimeout(warten, 250));
      };
      l.timer.push(setTimeout(warten, 800));
    },
  };
}

/** Hat der Kunde auf die Frage nach der Aufzeichnung eindeutig Ja gesagt (in den letzten 40 s)? */
function kundeSagteJaZurAufnahme(l: Lauf): boolean {
  // Ohne GEHÖRTE Frage keine Zustimmung (§ 201 StGB) — auch nicht, solange die Frage noch im Geduld-Tor wartet.
  const ab = l.aufnahmeFrageAm;
  if (!ab) return false;
  // Nur eine Antwort, die NACH der (gehörten) Frage begann — ein Satz, der schon vorher lief, ist keine Zustimmung.
  const kunden = l.zeilen.filter((z) => z.wer === "kunde" && z.am >= ab - 1000 && (z.beginn ?? z.am) >= ab - 1000 && Date.now() - z.am < 40_000);
  return kunden.some((z) => istAufnahmeJa(z.text));
}

// ── Adapter → Twilio ───────────────────────────────────────────────────────
function adapterEreignis(l: Lauf, ev: SitzungEreignis): void {
  if (l.beendet) return;
  switch (ev.art) {
    case "bereit":
      void sqlPool`UPDATE fiaon_aras_anruf SET sitzung_id = ${ev.sitzungId}, updated_at = NOW() WHERE id = ${l.arasAnrufId}`.catch(() => null);
      return;
    case "audio": {
      const jetzt = Date.now();
      // GPT-Live schickt auch Stille durchgehend — „Aras redet“ heißt: dieser Rahmen trägt Rede.
      const sprache = ev.sprache ?? pegel(ev.chunk) > 0.012;
      // Geduld-Tor: ein NEUER Redebeitrag, während der Kunde gerade noch sprach (oder seine Antwort auf Aras' Frage aussteht)?
      if (sprache && !l.halten && jetzt - l.zuletztSprache > NEUER_BEITRAG_MS && geduldNoetig(l, jetzt)) haltenBeginnen(l, jetzt);
      if (sprache) { l.zuletztSprache = jetzt; l.zuletztRede = jetzt; if (!l.arasErsteRedeAm) l.arasErsteRedeAm = jetzt; }
      else if (jetzt - l.zuletztSprache > 150) beitragEnde(l);
      l.zuletztAusgabe = jetzt;
      if (l.halten) { l.halte.push(ev.chunk); l.halteBytes += ev.chunk.length; return; }
      // Rückstand nach dem Halten aufholen: Stille-Rahmen in einer echten Pause fallen weg, bis die Brücke wieder in Echtzeit ist.
      if (l.aufholenBytes > 0 && !sprache && jetzt - l.zuletztSprache > AUFHOLEN_NACH_MS) { l.aufholenBytes -= ev.chunk.length; pumpen(l); return; }
      // Mit Büro-Atmosphäre: unter jeden Rahmen mischen (die Rede-Erkennung oben liest den ungemischten Rahmen).
      const raus = l.atmo ? atmoUnter(l, ev.chunk) : ev.chunk;
      l.puffer.push(raus); l.pufferBytes += raus.length;
      pumpen(l);
      return;
    }
    case "spricht_an": l.spricht = true; l.zustand = "spricht"; return;
    case "spricht_aus": l.spricht = false; if (l.zustand === "spricht") l.zustand = "hoert"; l.lautFrames = 0; return;
    case "kunde_spricht":
      l.kundeHatGesprochen = true; l.zuletztRede = Date.now(); l.kundeTextAm = Date.now();
      if (l.spricht || Date.now() - l.zuletztSprache < 700) unterbrechenPruefen(l, "transkript");
      return;
    case "transkript": {
      if (ev.wer === "kunde" && ev.text.trim()) { l.kundeHatGesprochen = true; l.zuletztRede = Date.now(); l.kundeTextAm = Date.now(); }
      zeileAnhaengen(l, ev);
      return;
    }
    case "werkzeug": l.zustand = "werkzeug"; return;
    case "kosten":
      l.sekunden = Math.max(l.sekunden, ev.sekunden); l.kostenCents = Math.max(l.kostenCents, ev.kostenCents);
      void sqlPool`UPDATE fiaon_aras_anruf SET sekunden_sitzung = ${l.sekunden}, kosten_ki_cents = ${l.kostenCents}, kosten_telefon_cents = ${telefonKostenCents(Math.round((Date.now() - l.seit) / 1000))}, updated_at = NOW() WHERE id = ${l.arasAnrufId}`.catch(() => null);
      return;
    case "fehler":
      void arasEreignis({ art: "aras_fehler", callId: l.callId, arasAnrufId: l.arasAnrufId, personId: l.personId, spielart: l.spielart, text: `${ev.code}: ${ev.text}`.slice(0, 300), ok: false, daten: { fatal: ev.fatal, code: ev.code } });
      if (ev.fatal) { l.endeGrund = "fehler"; void sitzungEnde(l, "fehler"); }
      return;
    case "ende":
      void sitzungEnde(l, l.endeGrund ?? (ev.grund === "close_requested" || (ev.grund === "anbieter_ende" && l.ergebnis) ? "aras_beendet" : ev.grund));
      return;
  }
}

/**
 * Transkript-Bruchstücke zu Zeilen: Jeder Sprecher hat seine offene Zeile — auch wenn beide gleichzeitig reden
 * (GPT-Live ist voll-duplex). Eine Zeile schließt mit einem Satzende oder nach 900 ms ohne neues Bruchstück.
 * Fertige Zeilen gehen über den Bus (SSE) — die Live-Karte zeigt ganze Sätze, keine Fetzen.
 */
function zeileAnhaengen(l: Lauf, ev: { wer: "kunde" | "aras"; text: string; t: number }): void {
  const jetzt = Date.now();
  const offen = [...l.zeilen].reverse().find((z) => z.wer === ev.wer && !z.final);
  if (offen && jetzt - offen.am < 2500) {
    offen.text = `${offen.text}${ev.text}`.slice(0, 2000); offen.am = jetzt;
  } else {
    if (offen) zeileFertig(l, offen);
    l.zeilen.push({ t: ev.t, wer: ev.wer, text: ev.text.trimStart().slice(0, 2000), final: false, am: jetzt, beginn: jetzt });
  }
  const aktuell = [...l.zeilen].reverse().find((z) => z.wer === ev.wer && !z.final);
  // Wiederholungs-Wache schon im laufenden Satz (ab acht Wörtern): je früher der Hinweis, desto weniger hört der Kunde doppelt.
  if (aktuell && aktuell.wer === "aras") wiederholungPruefen(l, aktuell, true);
  if (aktuell && /[.!?…]["“”»]?\s*$/.test(aktuell.text) && aktuell.text.trim().length > 2) zeileFertig(l, aktuell);
  if (l.zeilen.length > 600) l.zeilen.splice(0, l.zeilen.length - 600);
}

function zeileFertig(l: Lauf, z: TranskriptZeile): void {
  if (z.final) return;
  z.final = true;
  // GPT-Live schreibt ein Lachen als Laut-Marke („[chuckle]“, „[laugh]“) in seine Abschrift — für Mensch und Akte: „(lacht)“.
  z.text = z.text.replace(/\[(?:laugh|laughs|laughing|laughter|chuckle|chuckles|chuckling|giggle|giggles)\]/gi, "(lacht)").replace(/\s+/g, " ").trim();
  if (!z.text) return;
  transkriptMelden({ callId: l.callId, wer: z.wer, text: z.text, final: true, t: z.t });
  if (z.wer === "aras") {
    if (!l.kiHinweisAm && /\bKI\b|digitale[nr]?\s+Assistent|künstliche\s+Intelligenz|\bAI\b|digital assistant/i.test(z.text)) {
      l.kiHinweisAm = Date.now();
      void sqlPool`UPDATE fiaon_aras_anruf SET ki_hinweis_am = NOW(), updated_at = NOW() WHERE id = ${l.arasAnrufId} AND ki_hinweis_am IS NULL`.catch(() => null);
      void arasEreignis({ art: "aras_ki_hinweis", callId: l.callId, arasAnrufId: l.arasAnrufId, personId: l.personId, spielart: l.spielart, text: `KI-Hinweis nach ${Math.round((Date.now() - (l.bereitAm ?? l.seit)) / 1000)} s` });
    }
    if (z.verworfen) return;
    // Rauchtest 20.10. (Wienerisch): einmal „Darf ich dafür kurz mitschneiden …?“ statt „aufzeichnen“ — auch das ist die Aufnahme-Frage.
    const aufnahmeFrage = /aufzeichn|aufnehmen|aufnehma\b|mitschneid|mitschnitt|recorded|record\b/i.test(z.text) && !l.aufnahmeJa && !l.aufnahmeNein;
    // Eine Frage von Aras: bis er antwortet, gilt das Geduld-Tor (kein „Also...“ in seine Antwort-Pause).
    const frage = /\?["“”»]?\s*$/.test(z.text);
    // Der Abschied („… einen schönen Tag“, „auf Wiederhören“): danach legt Aras nach kurzer Ruhe selbst auf.
    // „Servus“ & Co. (Wiener Abschied) erst, wenn das Gespräch schon läuft — am Anfang kann „Servus“ auch ein Gruß sein.
    const abschied = ABSCHIED_RE.test(z.text) || (ABSCHIED_AT_RE.test(z.text) && Date.now() - (l.bereitAm ?? l.seit) > 20_000);
    if (l.halten && z.am >= l.halten.seit - 300) {
      // Noch zurückgehalten: Frage und Abschied zählen erst, wenn der Kunde sie hört (Freigabe) — werden sie verworfen, nie.
      const m = l.halteFragen ?? { aufnahme: false, frage: false, abschied: false };
      l.halteFragen = { aufnahme: m.aufnahme || aufnahmeFrage, frage: m.frage || frage, abschied: m.abschied || abschied };
    } else {
      // Der Text ist oft schneller als der Ton: gilt erst, wenn dieser Redebeitrag zu Ende gespielt ist (beitragEnde).
      l.offen = { aufnahme: l.offen.aufnahme || aufnahmeFrage, frage: l.offen.frage || frage, abschied: l.offen.abschied || abschied };
    }
    wiederholungPruefen(l, z, false);
  } else if (l.abschiedAm && !/tsch(ü|ue)ss|wiederh(ö|oe)ren|ciao|bye|danke|ebenso|gleichfalls|ihnen auch|schönen tag|servus|ade/i.test(z.text) && z.text.trim().length > 3) {
    // Der Kunde redet nach dem Abschied weiter (eine Frage) — dann ist es noch kein Abschied.
    l.abschiedAm = null;
  } else if (l.bereitAm && Date.now() - l.bereitAm < 30_000 && istMailboxAnsage(z.text) && !l.zeilen.some((x) => x.wer === "kunde" && x !== z && x.text.trim().length > 25 && !istMailboxAnsage(x.text))) {
    l.ergebnis = "mailbox"; l.endeGrund = "mailbox";
    void arasEreignis({ art: "aras_mailbox", callId: l.callId, arasAnrufId: l.arasAnrufId, personId: l.personId, spielart: l.spielart, text: "Mailbox-Ansage erkannt — aufgelegt, keine Nachricht" });
    void sitzungEnde(l, "mailbox");
  } else if (l.aufnahmeFrageAm && !l.aufnahmeJa && !l.aufnahmeNein && Date.now() - l.aufnahmeFrageAm < 25_000 && (z.beginn ?? z.am) >= l.aufnahmeFrageAm - 1000) {
    // Die Antwort auf die Aufnahme-Frage — eindeutig Ja startet, eindeutig Nein vermerkt; Unklares bleibt ohne Band.
    if (istAufnahmeJa(z.text)) void werkzeugAusfuehren(l.ctx!, "aufnahme_starten", {}, `bruecke_ja_${l.callId}`);
    else if (istAufnahmeNein(z.text)) void werkzeugAusfuehren(l.ctx!, "aufnahme_abgelehnt", {}, `bruecke_nein_${l.callId}`);
  }
}

/** Alle 500 ms: Zeilen schließen, Begrüßung/KI-Hinweis sichern, Stille erkennen. */
function wachen(l: Lauf): void {
  if (l.beendet || !l.bereitAm) return;
  const jetzt = Date.now();
  for (const z of l.zeilen) if (!z.final && jetzt - z.am > 900) zeileFertig(l, z);
  if (jetzt - l.zuletztSprache > 300) beitragEnde(l);
  const seitBereit = jetzt - l.bereitAm;
  // Begrüßung nachschieben: GPT-Live spricht laut Doku nicht garantiert zuerst.
  if (!l.grussNachgeschoben && !l.arasErsteRedeAm && !l.kundeHatGesprochen && seitBereit > GRUSS_NACH_MS && l.ws) {
    l.grussNachgeschoben = true;
    // Derselbe Text wie am Anfang (KI-Hinweis, kurzes Lachen, Frage nach dem Namen mit Anrede) — eine Quelle. Als
    // „vorlesen“ (commentary): Rauchtest 20.10. — eine Anweisung (instructions) brachte eine stumme Sitzung oft NICHT
    // zum Sprechen (1 von 2), „vorlesen“ jedes Mal binnen ~0,7 s (3 von 3), mit vollständigem KI-Hinweis.
    l.sitzung?.textEinschieben(begruessungText(l.einstellungen, l.briefing, l.spielart), "vorlesen");
  }
  // KI-Hinweis nachschieben, wenn Aras schon 12 s redet und ihn noch nicht gesagt hat (Pflicht, Art. 50 KI-VO).
  if (!l.kiHinweisAm && !l.hinweisNachgeschoben && l.arasErsteRedeAm && jetzt - l.arasErsteRedeAm > 12_000) {
    l.hinweisNachgeschoben = true;
    l.sitzung?.textEinschieben(`Sag jetzt kurz und freundlich, dass du der digitale Assistent von FIAON bist, also eine KI — in einem halben Satz${l.einstellungen.regie?.lachen !== false ? ", mit einem kurzen, warmen, hörbaren Lachen (kein Wort dafür)" : ""} —, dann weiter im Gespräch.`, "anweisung");
  }
  // Nach dem Abschied: 2,5 s Ruhe auf beiden Seiten → auflegen (das Werkzeug anruf_beenden kann es auch, ist aber langsamer).
  if (l.abschiedAm && !l.spricht && !l.halten && l.pufferBytes === 0 && jetzt - l.zuletztSprache > 2500 && jetzt - l.zuletztRede > 2500 && jetzt - l.abschiedAm > 1500) {
    l.endeGrund = l.endeGrund ?? "aras_beendet"; void sitzungEnde(l, "aras_beendet"); return;
  }
  // Stille: niemand hat abgenommen (oder eine Mailbox ohne Erkennung) — oder beide schweigen lange.
  if (!l.kundeHatGesprochen && !l.kundeLaut && seitBereit > STILLE_OHNE_KUNDE_MS && !l.spricht) { l.ergebnis = l.ergebnis ?? "nicht_erreicht"; void sitzungEnde(l, "stille"); return; }
  if (jetzt - l.zuletztRede > STILLE_ENDE_MS && !l.spricht) { void sitzungEnde(l, "stille"); return; }
}

// ── Ton an Twilio: höchstens 500 ms voraus, mark je 100 ms ─────────────────
function pumpen(l: Lauf): void {
  if (!l.ws || l.ws.readyState !== WebSocket.OPEN) {
    // Noch kein Strom (vorbereitet): Ton aufheben, höchstens 6 s — danach den ältesten verwerfen.
    while (l.pufferBytes > 6000 * 8 && l.puffer.length) l.pufferBytes -= l.puffer.shift()!.length;
    return;
  }
  while (l.offeneMarks < VORAUS_MARKS && l.pufferBytes >= MARK_BYTES) senden(l, naechstesStueck(l, MARK_BYTES));
  // Büro-Atmosphäre: ist nichts mehr zu sagen, sofort mit Atmo nachfüllen (keine Lücke zwischen den Takten).
  if (l.atmo && l.pufferBytes === 0) atmoFuellen(l, false);
  // Rest unter 100 ms (Satzende): nach 120 ms ohne Nachschub trotzdem schicken.
  if (l.pufferBytes > 0 && l.pufferBytes < MARK_BYTES && l.offeneMarks < VORAUS_MARKS) {
    l.timer.push(setTimeout(() => {
      if (l.beendet || l.pufferBytes === 0 || l.pufferBytes >= MARK_BYTES || l.offeneMarks >= VORAUS_MARKS) return;
      if (Date.now() - l.zuletztAusgabe < 110) return;
      senden(l, naechstesStueck(l, l.pufferBytes));
    }, 120));
  }
}
function senden(l: Lauf, stueck: Buffer): void {
  if (!l.ws || l.ws.readyState !== WebSocket.OPEN || !stueck.length) return;
  l.ws.send(JSON.stringify({ event: "media", streamSid: l.streamSid, media: { payload: stueck.toString("base64") } }));
  l.markNr += 1; l.offeneMarks += 1;
  l.ws.send(JSON.stringify({ event: "mark", streamSid: l.streamSid, mark: { name: `m${l.markGen}-${l.markNr}` } }));
}
function naechstesStueck(l: Lauf, n: number): Buffer {
  const teile: Buffer[] = [];
  let rest = n;
  while (rest > 0 && l.puffer.length) {
    const k = l.puffer[0];
    if (k.length <= rest) { teile.push(k); rest -= k.length; l.puffer.shift(); }
    else { teile.push(k.subarray(0, rest)); l.puffer[0] = k.subarray(rest); rest = 0; }
  }
  const b = Buffer.concat(teile);
  l.pufferBytes -= b.length;
  return b;
}

// ── Büro-Atmosphäre (aras_hintergrund, Justin 20.10.2026) ───────────────────
// Unter jeden Ton-Rahmen von GPT-Live gemischt (µ-law → PCM16 → + Schleife → µ-law; Pegel fest in fiaon-aras-atmo.ts).
// In Pausen und direkt nach einem `clear` füllt der Takt mit reiner Atmo — so viel, dass Twilio 200 ms vorrätig hat,
// nie mehr (der Voraus-Takt von 500 ms bleibt). Ein Rest unter 100 ms (Satzende) wird mit Atmo aufgefüllt, nie überholt.
const ATMO_TAKT_MS = 40, ATMO_VORRAT_MARKS = 2;
function atmoUnter(l: Lauf, chunk: Buffer): Buffer {
  if (!l.atmo || !chunk.length) return chunk;
  const { pcm, pos } = atmoMischen(mulawZuPcm16(chunk), chunk.length, l.atmo, l.atmoPos);
  l.atmoPos = pos;
  return pcm16ZuMulaw(pcm);
}
function atmoStueck(l: Lauf, bytes: number): Buffer {
  const { pcm, pos } = atmoMischen(null, bytes, l.atmo!, l.atmoPos);
  l.atmoPos = pos;
  return pcm16ZuMulaw(pcm);
}
function atmoFuellen(l: Lauf, ausTakt = true): void {
  if (!l.atmo || l.beendet || !l.ws || l.ws.readyState !== WebSocket.OPEN || !l.streamSid || l.uebergabeLaeuft) return;
  while (l.offeneMarks < ATMO_VORRAT_MARKS && l.pufferBytes < MARK_BYTES) {
    if (l.pufferBytes > 0) {
      // Ein Satzende-Rest wird nie überholt: kommt kein Nachschub mehr (110 ms), geht er aufgefüllt mit Atmo raus.
      if (!ausTakt || Date.now() - l.zuletztAusgabe < 110) return;
      const rest = naechstesStueck(l, l.pufferBytes);
      senden(l, Buffer.concat([rest, atmoStueck(l, MARK_BYTES - rest.length)]));
      continue;
    }
    senden(l, atmoStueck(l, MARK_BYTES));
    l.atmoStuecke += 1;
  }
}

// ── Geduld-Tor (aras_zuhoeren, Justins Test 20.10., Anruf 5: „Also...“ mitten in seine Denkpause) ───────────────────
// GPT-Live hat keinen Schalter für das Zuhören (voll-duplex, kein turn_detection in session.start — Doku 20.10.2026). Die Doku
// empfiehlt für so etwas die Wiedergabe in der Brücke zu steuern („Control playback when needed“): Ton zurückhalten, und
// was GPT-Live selbst abbricht, nie abspielen. Entscheiden tut GPT-Live (hört es auf, weil der Kunde weiterredet, war es
// ein Ansatz); die Brücke wartet nur, bis der Kunde lange genug still ist.
function geduldMs(l: Lauf): number { return GEDULD_MS[l.einstellungen.regie?.zuhoeren ?? "geduldig"] ?? 0; }
/** Wann der Kunde zuletzt geredet hat: seine Worte (Transkript) — die Lautstärke nur, wenn kurz vorher auch Worte kamen. */
function kundeStimmeAm(l: Lauf, jetzt: number): number {
  return Math.max(l.kundeTextAm, l.kundeTextAm && jetzt - l.kundeTextAm < PEGEL_NUR_MIT_TEXT_MS ? l.kundePegelAm : 0);
}
function geduldNoetig(l: Lauf, jetzt: number): boolean {
  const g = geduldMs(l);
  // Der erste Satz mit dem KI-Hinweis geht immer sofort raus (KI-VO Art. 50) — das Tor gilt erst danach.
  if (!g || !l.kiHinweisAm || l.notaus || l.uebergabeLaeuft || !l.ws) return false;
  const stimme = kundeStimmeAm(l, jetzt);
  if (stimme && jetzt - stimme < g) return true;
  // Aras hat gefragt, der Kunde hat noch nicht geantwortet: ihm Zeit für die Antwort lassen.
  return !!l.frageAm && stimme < l.frageAm && jetzt - l.frageAm < 2 * g + 600;
}
function haltenBeginnen(l: Lauf, jetzt: number): void {
  const takt = setInterval(() => haltenPruefen(l), 40);
  l.halten = { seit: jetzt, takt }; l.halte = []; l.halteBytes = 0;
  if (process.env.ARAS_DEBUG) console.log(`[ARAS] Geduld-Tor zu (call ${l.callId}): Kunde vor ${jetzt - kundeStimmeAm(l, jetzt)} ms`);
}
function haltenPruefen(l: Lauf): void {
  if (!l.halten || l.beendet) return;
  const jetzt = Date.now();
  if (!geduldNoetig(l, jetzt) || jetzt - l.halten.seit > HALTEN_HOECHSTENS_MS) haltenFreigeben(l);
}
/** Der Kunde ist still genug: das Gehaltene abspielen (mit Atmo), den Rückstand in der nächsten Pause aufholen. */
function haltenFreigeben(l: Lauf): void {
  if (!l.halten) return;
  clearInterval(l.halten.takt); l.halten = null; l.gehalten += 1;
  const stuecke = l.halte; l.halte = [];
  for (const k of stuecke) { const raus = l.atmo ? atmoUnter(l, k) : k; l.puffer.push(raus); l.pufferBytes += raus.length; }
  l.aufholenBytes += l.halteBytes; l.halteBytes = 0;
  // Fragen aus dem Gehaltenen gelten ab jetzt (wenn der Kunde sie hört).
  if (l.halteFragen?.aufnahme && !l.aufnahmeJa && !l.aufnahmeNein) l.aufnahmeFrageAm = gehoertAm(l);
  if (l.halteFragen?.frage) l.frageAm = gehoertAm(l);
  if (l.halteFragen?.abschied) l.abschiedAm = gehoertAm(l);
  l.halteFragen = null;
  pumpen(l);
}
/** Wann der Kunde den Ton hört, der jetzt in der Brücke wartet (grob: alles im Puffer, in Echtzeit). */
function gehoertAm(l: Lauf): number { return Date.now() + Math.round(l.pufferBytes / 8); }
/**
 * Aras' Redebeitrag ist zu Ende (Stille nach Rede): was darin gefragt wurde, gilt ab dem Moment, in dem der Kunde es hört.
 * Wird der Beitrag gerade zurückgehalten, wandert es zum Gehaltenen (gilt bei Freigabe, fällt beim Verwerfen weg).
 */
function beitragEnde(l: Lauf): void {
  const o = l.offen;
  if (!o.aufnahme && !o.frage && !o.abschied) return;
  l.offen = { aufnahme: false, frage: false, abschied: false };
  if (l.halten) {
    const m = l.halteFragen ?? { aufnahme: false, frage: false, abschied: false };
    l.halteFragen = { aufnahme: m.aufnahme || o.aufnahme, frage: m.frage || o.frage, abschied: m.abschied || o.abschied };
    return;
  }
  if (o.aufnahme && !l.aufnahmeJa && !l.aufnahmeNein) l.aufnahmeFrageAm = gehoertAm(l);
  if (o.frage) l.frageAm = gehoertAm(l);
  if (o.abschied) l.abschiedAm = gehoertAm(l);
}
/** Der Kunde redete weiter und GPT-Live hörte auf: der Ansatz wird nie abgespielt; die Zeile heißt „verworfen“. */
function haltenVerwerfen(l: Lauf): void {
  if (!l.halten) return;
  const seit = l.halten.seit;
  clearInterval(l.halten.takt); l.halten = null; l.halte = []; l.halteBytes = 0; l.halteFragen = null; l.verworfen += 1;
  // Was im verworfenen Beitrag gefragt wurde, hat der Kunde nie gehört — es zählt nie (auch kein Aufnahme-Ja darauf).
  l.offen = { aufnahme: false, frage: false, abschied: false };
  for (const z of l.zeilen) if (z.wer === "aras" && z.am >= seit - 300 && z.text.trim()) { z.verworfen = true; if (!z.final) zeileFertig(l, z); }
  if (process.env.ARAS_DEBUG) console.log(`[ARAS] Geduld-Tor: Ansatz verworfen (call ${l.callId})`);
}

// ── Wiederholungs-Wache (Justins Test 20.10., Anruf 5: dreimal wortgleich derselbe Satz auf „Um was geht's?“) ─────────
function wiederholungPruefen(l: Lauf, z: TranskriptZeile, laufend: boolean): void {
  if (z.wer !== "aras" || z.wiederholt || z.verworfen || l.wiederholHinweise >= 3 || l.beendet) return;
  const frueher = l.zeilen.filter((x) => x.wer === "aras" && x !== z && x.final && !x.verworfen && x.text.trim()).slice(-3).map((x) => x.text);
  if (!frueher.length) return;
  const quote = wiederholtSich(z.text, frueher, laufend);
  if (quote === null) return;
  z.wiederholt = true; l.wiederholHinweise += 1;
  // Versteckter Hinweis (instructions dürfen die laufende Rede unterbrechen) — sofort, nicht erst beim nächsten Satz.
  l.sitzung?.textEinschieben(WIEDERHOLUNG_HINWEIS, "anweisung");
  console.log(`[ARAS] call ${l.callId}: Wiederholung erkannt (${Math.round(quote * 100)} % gleich) — Hinweis an die Stimme.`);
}

// ── Unterbrechen ───────────────────────────────────────────────────────────
/** Eigene Lautstärke-Erkennung auf dem Kunden-Ton: 3 laute Rahmen (60 ms) über dem Grundrauschen. */
function kundenPegel(l: Lauf, chunk: Buffer): void {
  const p = pegel(chunk);
  // Grundrauschen langsam mitführen (nur aus leisen Rahmen)
  if (p < l.rauschen * 3) l.rauschen = l.rauschen * 0.98 + p * 0.02;
  const schwelle = Math.max(VAD_MIN, l.rauschen * 4);
  if (p > schwelle) {
    l.lautFrames += 1;
    if (l.lautFrames >= 3) {
      l.zuletztRede = Date.now(); l.kundeLaut = true; l.kundePegelAm = Date.now();
      if (l.spricht || Date.now() - l.zuletztSprache < 700) unterbrechenPruefen(l, "pegel");
    }
  } else l.lautFrames = 0;
}

/**
 * Kundenstimme, während Aras spricht: 180 ms schauen, ob Aras weiterredet (neue Rede-Rahmen vom Anbieter).
 * Keine neue Rede → Aras hat aufgehört → Twilio leeren (`clear`) und den Rest verwerfen.
 * Neue Rede → der Kunde sagte nur „mhm“ (oder GPT-Live braucht noch einen Moment) — redet der Kunde weiter,
 * schaut die Brücke gleich noch einmal (pruefNochmal), bis Aras still ist. Nie zweimal für dieselbe Rede.
 */
function unterbrechenPruefen(l: Lauf, ausloeser: string): void {
  if (l.beendet || l.zuletztSprache <= l.clearSprache) return;
  if (l.pruefUnterbrechen) { l.pruefNochmal = true; return; }
  const vorher = l.zuletztSprache;
  l.pruefNochmal = false;
  if (process.env.ARAS_DEBUG) console.log(`[ARAS] prüfe Unterbrechen (${ausloeser}) call ${l.callId}: Rede vor ${Date.now() - vorher} ms`);
  l.pruefUnterbrechen = setTimeout(() => {
    l.pruefUnterbrechen = null;
    if (l.beendet) return;
    const redetWeiter = l.zuletztSprache > vorher && Date.now() - l.zuletztSprache < UNTERBRECHEN_PRUEF_MS;
    if (!redetWeiter && Date.now() - vorher < 1200) { unterbrechen(l, ausloeser); return; }
    // Redet Aras weiter, aber der Kunde auch (neuer Auslöser im Fenster): gleich noch einmal schauen.
    if (redetWeiter && l.pruefNochmal) unterbrechenPruefen(l, ausloeser);
  }, UNTERBRECHEN_PRUEF_MS);
}

function unterbrechen(l: Lauf, ausloeser: string): void {
  // Was das Geduld-Tor noch zurückhielt, hat der Kunde nie gehört — es fällt weg (der „Also...“-Ansatz).
  if (l.halten) haltenVerwerfen(l);
  l.aufholenBytes = 0;
  // Ein unterbrochener Beitrag: eine darin nur halb gehörte Frage (Aufzeichnung!) zählt nicht.
  l.offen = { aufnahme: false, frage: false, abschied: false };
  l.puffer = []; l.pufferBytes = 0; l.offeneMarks = 0; l.markGen += 1; l.lautFrames = 0; l.clears += 1;
  l.clearSprache = l.zuletztSprache; l.pruefNochmal = false;
  l.sitzung?.unterbrechen();
  if (l.ws && l.ws.readyState === WebSocket.OPEN) l.ws.send(JSON.stringify({ event: "clear", streamSid: l.streamSid }));
  // Nach dem Leeren keine Lücke: die Büro-Atmosphäre läuft sofort weiter.
  atmoFuellen(l);
  // Die unterbrochene Aras-Zeile ist zu Ende (abgebrochen) — was Aras danach sagt, ist eine neue Zeile.
  const letzte = [...l.zeilen].reverse().find((z) => z.wer === "aras");
  if (letzte && !letzte.final) { letzte.abgebrochen = true; zeileFertig(l, letzte); }
  l.spricht = false; l.zustand = "hoert";
  if (process.env.ARAS_DEBUG) console.log(`[ARAS] clear (${ausloeser}) call ${l.callId}`);
}

// ── Übergabe, Mailbox, Notaus, Ende ────────────────────────────────────────
async function uebergabeStarten(l: Lauf, agentId: number, grund: string): Promise<{ ok: boolean; grund?: string }> {
  if (l.uebergabeLaeuft) return { ok: false, grund: "Übergabe läuft schon." };
  if (l.trocken) return { ok: true }; // Probe: nur so tun (kein Softphone klingelt)
  await sqlPool`UPDATE fiaon_aras_anruf SET uebergabe_agent_id = ${agentId}, uebergabe_status = 'laeuft', updated_at = NOW() WHERE id = ${l.arasAnrufId}`;
  l.uebergabeLaeuft = true; l.endeGrund = "uebergabe";
  if (!l.twilioSid || l.twilioSid.startsWith("ATTRAPPE")) { l.timer.push(setTimeout(() => void sitzungEnde(l, "uebergabe"), 800)); return { ok: true }; }
  try {
    const c = await twilioClient();
    const twiml = twimlUebergabe({ agentId, callerId: arasCallerId(l.land, { at: l.einstellungen.callerIdAt, ch: l.einstellungen.callerIdCh }), anrufId: l.callId, personId: l.personId, grund });
    // Erst den Satz „Einen Moment, ich verbinde Sie“ ausspielen lassen (Rede vorbei, höchstens 5 s), dann umleiten.
    const t0 = Date.now();
    const umleiten = async () => {
      if (l.beendet) return;
      if (Date.now() - t0 < 5000 && (Date.now() - t0 < 1200 || l.spricht || Date.now() - l.zuletztSprache < 900 || !!l.halten || l.pufferBytes > 0)) { l.timer.push(setTimeout(umleiten, 200)); return; }
      await c.calls(l.twilioSid!).update({ twiml }).catch((e: unknown) => console.error("[ARAS] Übergabe:", String(e).slice(0, 200)));
    };
    l.timer.push(setTimeout(umleiten, 400));
    return { ok: true };
  } catch (err) {
    l.uebergabeLaeuft = false; l.endeGrund = null;
    await sqlPool`UPDATE fiaon_aras_anruf SET uebergabe_status = 'nicht_angenommen', updated_at = NOW() WHERE id = ${l.arasAnrufId}`;
    return { ok: false, grund: String((err as Error)?.message ?? err).slice(0, 200) };
  }
}

/** Klingt das wie eine Mailbox-Ansage? (deutsch/englisch, die üblichen Sätze der Netze) — rein. */
export function istMailboxAnsage(text: string): boolean {
  return /\b(mailbox|sprachbox|sprachnachricht|anrufbeantworter|nach dem (signal|piep)ton|signalton|hinterlassen sie (bitte )?(eine|ihre) nachricht|der gewünschte gesprächspartner|ist (zur zeit|derzeit|momentan) nicht erreichbar|voicemail|leave (a|your) message|after the (tone|beep)|is not available)\b/i.test(String(text ?? ""));
}

/** AMD meldet „Maschine“: auflegen, außer der Kunde redet nachweislich MIT Aras (Fehlerkennung) — eine Ansage zählt nicht als Gespräch. */
export async function mailboxErkannt(callId: number): Promise<"aufgelegt" | "weiter" | "unbekannt"> {
  const l = LAUFENDE.get(callId);
  if (!l) return "unbekannt";
  const kunde = l.zeilen.filter((z) => z.wer === "kunde").map((z) => z.text).join(" ");
  // Ein Mensch ist es, wenn er NACH Aras' erstem Satz geantwortet hat (Gespräch) — und keine Ansage-Wörter fallen.
  const dialog = !!l.arasErsteRedeAm && l.zeilen.some((z) => z.wer === "kunde" && z.text.trim() && z.am > (l.arasErsteRedeAm ?? 0) + 800);
  if (l.kundeHatGesprochen && !istMailboxAnsage(kunde) && dialog) {
    await arasEreignis({ art: "aras_amd_widerspruch", callId, arasAnrufId: l.arasAnrufId, personId: l.personId, spielart: l.spielart, text: "Mailbox-Erkennung trotz Kundenstimme — Gespräch läuft weiter" });
    return "weiter";
  }
  l.ergebnis = "mailbox"; l.endeGrund = "mailbox";
  await sitzungEnde(l, "mailbox");
  return "aufgelegt";
}

export async function sitzungBeenden(callId: number, grund: string): Promise<void> {
  const vor = VORBEREITUNG.get(callId);
  if (vor) { VORBEREITUNG.delete(callId); const l = await vor; if (l && !l.beendet) await sitzungEnde(l, grund); return; }
  const l = LAUFENDE.get(callId);
  if (!l) return;
  l.endeGrund = grund;
  if (grund === "notaus" || grund === "deploy") {
    l.notaus = grund === "notaus";
    // Der Abschiedssatz kommt sofort — was das Geduld-Tor noch hielt, fällt weg.
    if (l.halten) haltenVerwerfen(l);
    // Ein Abschiedssatz in genauem Wortlaut (instructions dürfen laufende Rede unterbrechen), dann Ende — höchstens 6 s.
    l.sitzung?.textEinschieben(`Unterbrich dich jetzt und sag sofort genau diesen Satz: „${NOTAUS_SATZ}“ Danach sagst du nichts mehr.`, "anweisung");
    const t0 = Date.now();
    await new Promise<void>((fertig) => {
      const schauen = () => {
        const ausgeredet = Date.now() - t0 > 2500 && !l.spricht && Date.now() - l.zuletztSprache > 900;
        if (l.beendet || ausgeredet || Date.now() - t0 > 6000) fertig(); else setTimeout(schauen, 200);
      };
      setTimeout(schauen, 400);
    });
  }
  await sitzungEnde(l, grund);
}

/** Notaus für alle: Abschiedssatz, dann Ende — liefert, wie viele Gespräche beendet wurden. */
export async function notausAlle(): Promise<number> {
  const alle = Array.from(new Set([...Array.from(LAUFENDE.keys()), ...Array.from(VORBEREITUNG.keys())]));
  await Promise.all(alle.map((id) => sitzungBeenden(id, "notaus")));
  return alle.length;
}

export async function uebernehmen(callId: number, agentId: number): Promise<{ ok: boolean; grund?: string }> {
  const l = LAUFENDE.get(callId);
  if (!l) return { ok: false, grund: "Dieses Gespräch läuft nicht (mehr)." };
  l.sitzung?.textEinschieben("Die Leitung übernimmt das Gespräch jetzt persönlich. Sag sofort: „Einen kleinen Moment, ich verbinde Sie mit der Leitung.“ Danach sagst du nichts mehr.", "anweisung");
  await new Promise((f) => setTimeout(f, 1500));
  return uebergabeStarten(l, agentId, "chef");
}

async function sitzungEnde(l: Lauf, grund: string): Promise<void> {
  if (l.beendet) return;
  l.beendet = true; l.zustand = "ende"; l.endeGrund = l.endeGrund ?? grund;
  for (const t of l.timer) clearTimeout(t);
  if (l.takt) clearInterval(l.takt);
  if (l.atmoTakt) clearInterval(l.atmoTakt);
  if (l.halten) { clearInterval(l.halten.takt); l.halten = null; }
  if (l.pruefUnterbrechen) clearTimeout(l.pruefUnterbrechen);
  for (const z of l.zeilen) if (!z.final) zeileFertig(l, z);
  let sekunden = l.sekunden, kostenCents = l.kostenCents;
  try { if (l.sitzung) { const k = await l.sitzung.beenden(grund); sekunden = Math.max(sekunden, k.sekunden); kostenCents = Math.max(kostenCents, k.kostenCents); } } catch { /* Ende ist Ende */ }
  const wanduhr = Math.round((Date.now() - l.seit) / 1000);
  LAUFENDE.delete(l.callId);
  try { if (l.ws && l.ws.readyState === WebSocket.OPEN && grund !== "kunde_aufgelegt") l.ws.close(1000, grund.slice(0, 60)); } catch { /* egal */ }
  // Twilio auflegen, wenn WIR das Ende sind (nicht bei Übergabe — dort übernimmt der Dial)
  if (l.twilioSid && !l.twilioSid.startsWith("ATTRAPPE") && !["kunde_aufgelegt", "uebergabe", "uebergabe_gescheitert_neu"].includes(grund)) {
    try { const c = await twilioClient(); await c.calls(l.twilioSid).update({ status: "completed" }); } catch { /* schon beendet */ }
  }
  const transkript = l.aufnahmeJa ? l.zeilen.filter((z) => z.text.trim()).map((z) => ({ t: z.t, wer: z.wer, text: z.text, abgebrochen: z.abgebrochen === true, ...(z.verworfen ? { verworfen: true } : {}) })) : null;
  await sqlPool`
    UPDATE fiaon_aras_anruf SET ende_grund = ${grund}, sekunden_sitzung = ${sekunden}, kosten_ki_cents = ${kostenCents},
           kosten_telefon_cents = ${telefonKostenCents(wanduhr)}, transkript = ${transkript ? sqlPool.json(transkript as any) : null},
           ergebnis = COALESCE(ergebnis, ${l.ergebnis}), ergebnis_notiz = COALESCE(ergebnis_notiz, ${l.ergebnisNotiz}),
           uebergabe_status = CASE WHEN uebergabe_status = 'laeuft' AND ${grund} <> 'uebergabe' THEN 'nicht_angenommen' ELSE uebergabe_status END,
           updated_at = NOW()
     WHERE id = ${l.arasAnrufId}`.catch((e) => console.error("[ARAS] Ende:", String(e).slice(0, 200)));
  await sqlPool`UPDATE fiaon_calls SET ende = COALESCE(ende, NOW()), dauer_sek = COALESCE(dauer_sek, ${wanduhr}),
                 status = CASE WHEN ${grund} IN ('mailbox', 'stille') AND NOT ${l.kundeHatGesprochen} THEN 'niemand_erreicht' WHEN status IN ('gewaehlt', 'laeuft') THEN 'beendet' ELSE status END, updated_at = NOW()
               WHERE id = ${l.callId}`.catch(() => null);
  await arasEreignis({ art: "aras_ende", callId: l.callId, arasAnrufId: l.arasAnrufId, personId: l.personId, spielart: l.spielart, text: `Ende: ${grund} nach ${wanduhr} s`, daten: { grund, sekunden, kostenCents, aufnahme: l.aufnahmeJa, clears: l.clears, gehalten: l.gehalten, verworfen: l.verworfen, wiederholungen: l.wiederholHinweise, abschiedEingefordert: !!l.abschiedEingefordert, abschied: !!l.abschiedAm } });
  try {
    const { nachbereiten } = await import("./fiaon-aras-nachbereitung");
    await nachbereiten(l.arasAnrufId, {
      zeilen: l.zeilen.filter((z) => !z.verworfen), ausgefuehrt: l.ctx?.ausgefuehrt ?? [], endeGrund: grund, sekunden: wanduhr, aufnahmeJa: l.aufnahmeJa,
      ergebnis: l.ergebnis, ergebnisNotiz: l.ergebnisNotiz, ergebnisGesetzt: l.ctx?.ergebnisGesetzt === true, kundeHatGesprochen: l.kundeHatGesprochen,
      probe: l.probe, kiHinweisSek: l.kiHinweisAm && l.bereitAm ? (l.kiHinweisAm - l.bereitAm) / 1000 : null,
    });
  } catch (e) { console.error("[ARAS] Nachbereitung:", String((e as Error)?.message ?? e).slice(0, 300)); }
  l.fertigMelden();
}

/** Für Prüfstände: warten, bis eine Sitzung ganz durch ist (inkl. Nachbereitung). */
export function sitzungFertig(callId: number): Promise<void> | null {
  return LAUFENDE.get(callId)?.fertig ?? null;
}

/** SIGTERM (eigener Dienst) / Leerlauf vor dem Deploy: Abschied, dann Ende. */
export async function alleSauberBeenden(grund = "deploy"): Promise<number> {
  const ids = Array.from(LAUFENDE.keys());
  await Promise.all(ids.map((id) => sitzungBeenden(id, grund)));
  return ids.length;
}
