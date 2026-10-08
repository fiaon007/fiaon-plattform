// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DAS STARTGESPRÄCH NACH DER ANNAHME EINES INDIVIDUALANGEBOTS
// E-273 (02.10.2026)
//
// ── DER ANLASS ─────────────────────────────────────────────────────────────
// Justin an Herrn Hildbrand (WhatsApp, 02.10.2026): „Dieser kann ganz bequem
// online bestätigt werden, sobald dieser angenommen wurde von Ihnen bucht das
// System automatisch den nächsten freien Termin, dann können wir direkt mit der
// Umsetzung starten." Bis heute stimmte das nicht: Nach der Annahme gingen nur
// Aufgaben raus, und die zuständige Person sollte das Startgespräch von Hand
// vereinbaren. Jetzt bucht das System es — VOR der Bestätigungsmail, damit sie
// Tag und Uhrzeit nennt, und vor der Antwort an die Seite, damit der Kunde es
// sofort sieht.
//
// ── WER ────────────────────────────────────────────────────────────────────
// Die Angebotsseite sagt: „Im Startgespräch mit Justin Schwarzott legen wir den
// Bundesstaat fest" (angebotSeite, FIAON_FIRMA.director). Justin hat ein Konto
// mit gepflegten Zeiten — dasselbe, auf das seine Buchungsseite /justin bucht
// (gruenderAgentId: Einstellung gruender_termin_agent_id, Vorgabe 928). Dort
// bucht das System, damit eintritt, was die Seite verspricht. Nur wenn dieses
// Konto nicht arbeiten kann (inaktiv, gesperrt, ohne Zeiten Montag bis
// Freitag), nimmt es die zuständige Global-Person (globalZustaendig) — dann
// nennen Mail und Seite deren Namen, und Justin liest es in seiner Aufgabe.
// Ist bei der gewählten Person in vierzehn Tagen kein Platz frei, wird NICHT
// auf jemand anderen ausgewichen: dringende Aufgabe an Justin, von Hand buchen.
//
// ── WANN ───────────────────────────────────────────────────────────────────
// Dieselben Regeln wie der Gesprächskalender auf /business — dieselbe reine
// Rechnung (globalZeitenRechnen): 30-Minuten-Raster ab Fensterbeginn, Montag bis
// Freitag, zwei Stunden Vorlauf, Tagesdeckel global_termin_pro_tag, bestehende
// Termine mit ihrer echten Dauer. Der früheste Zeitpunkt:
//   „Sofort starten"         → jetzt + Vorlauf,
//   „Starten ab <Tag>"       → dieser Tag (das Gespräch IST Leistung: Bundesstaat
//                              festlegen) — wie globalStartWartet nie vor dem Start
//                              nach der Widerrufsfrist, wenn kein früherer Beginn
//                              verlangt ist (kommt mit der Startwahl nicht vor:
//                              schalterAus setzt sofortBeginn dann selbst),
//   ohne Wahl                → Start nach der Widerrufsfrist (globalWiderrufsfrist
//                              ().startAb). Das gibt es nur noch über eine Seite,
//                              die vor der Startwahl (01.10.2026 nachmittags)
//                              geladen wurde — annehmen() nimmt sie weiter an.
// Gesucht wird vierzehn Tage ab dem frühesten Zeitpunkt.
//
// ── WIE ────────────────────────────────────────────────────────────────────
// terminBuchen (quelle 'global', herkunft 'individualangebot') — NICHT
// globalTerminBuchen der Website: Der legt Firmenkontakt, Firmen-Lead und die
// Erstgespräch-Mail an; dieser Kunde ist schon Kunde. quelle 'global' hält jeden
// Privat-Ablauf fern: Ergebnis und „verpasst" laufen über globalTerminErgebnis
// (keine „Wir haben Sie verpasst"-Mail, keine Einladung zum Startgespräch der
// Privatlinie, keine Nicht-erreicht-Zähler), es gibt kein buchungAnwenden (kein
// Betreuer-Wechsel, keine Messung). Die Erinnerung 24 Stunden vorher läuft wie
// bei jedem Global-Termin (runTerminErinnerungen).
//
// ── HÖCHSTENS EINES JE ANGEBOT, NACHHOLBAR ─────────────────────────────────
// Eine Sperre je Angebot (pg_advisory_xact_lock) und die Spalte
// startgespraech_termin_id am Angebot: Wer als
// Zweiter kommt (Doppelklick, Kundenlink, Stundenlauf, „Nachholen"), findet den
// Termin und bucht nichts. Scheitert der erste Versuch technisch, holt der
// Stundenlauf (globalAngebotLauf) nach — höchstens drei Tage nach der Annahme;
// bucht er nach der Bestätigungsmail, geht Tag und Uhrzeit in einer eigenen
// Mail (global_angebot_startgespraech) an den Kunden. „Kein Platz" und „keine
// Person" holt er NICHT nach: Dafür hat Justin die Aufgabe (sonst buchte das
// System neben seinem Handtermin einen zweiten).
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { berlinZeitpunkt, berlinDatum, zeitZuMinuten } from "./fiaon-time";
import {
  globalZeitenRechnen, GLOBAL_DAUER_MIN, GLOBAL_HORIZONT_TAGE, GLOBAL_VORLAUF_STUNDEN, GLOBAL_WOCHENTAGE,
  type GlobalFenster, type GlobalBelegung, type GlobalFreieZeit,
} from "./fiaon-global-zeiten";
import { globalWiderrufsfrist } from "./fiaon-global-vertrag";
import {
  terminBuchen, stornoLink, verfuegbarkeitVon, ensureHerkunftSpalte, versuchProtokollieren, terminTokenErzeugen,
  TerminFehler, berlinDatumText, berlinUhrzeit, type Zeitfenster,
} from "./fiaon-termine";
import { globalZustaendig, globalTerminProTag, globalKalenderUrl } from "./fiaon-global-termin";
import { googleKalenderLink } from "./fiaon-ics";
import { absoluteUrl } from "../fiaon-base-url";
import { angebotTag, angebotKundeName, zahlwort, type AngebotSchalter, type AngebotKunde } from "@shared/fiaon-global-angebot";
import { STARTGESPRAECH_TEXTE as ST, startgespraechWochentag } from "@shared/fiaon-global-startgespraech";
import { nennform } from "@shared/fiaon-mitarbeiter-name";
import { globalOfficeAuftragPfad } from "@shared/fiaon-global-wege";
import { FIAON_FIRMA } from "@shared/fiaon-firma";

const CHEF_LINK = "/chef/s/global-auftraege?reiter=angebote";
/** „ein Global-Gespräch" / „vier Global-Gespräche" — der Tagesdeckel in Worten. */
const deckelText = (n: number) => (n === 1 ? "ein Global-Gespräch" : `${n <= 31 ? zahlwort(n) : n} Global-Gespräche`);
/** So lange nach der Annahme holt der Stundenlauf einen technisch gescheiterten Versuch nach. */
export const STARTGESPRAECH_NACHHOLEN_TAGE = 3;

// ═══════════════════════════════════════════════════════════════════════════
// REIN — der Prüfstand rechnet jede Regel ohne Datenbank nach
// ═══════════════════════════════════════════════════════════════════════════

export type StartgespraechArt = "sofort" | "starttag" | "widerruf";

/** Der früheste Zeitpunkt des Startgesprächs aus der Startwahl der Annahme (siehe Kopf: WANN). */
export function startgespraechFruehestens(ein: { jetzt: Date; angenommenAm: Date; schalter: AngebotSchalter }): { ab: Date; tag: string; art: StartgespraechArt } {
  const vorlauf = new Date(ein.jetzt.getTime() + GLOBAL_VORLAUF_STUNDEN * 3_600_000);
  const s = ein.schalter ?? { sofortBeginn: false, jahresbetreuung: false };
  const startAm = typeof s.startAm === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s.startAm) ? s.startAm : null;
  let tag: string | null = null;
  let art: StartgespraechArt;
  if (startAm) {
    // Wie globalStartWartet: Ohne verlangten früheren Beginn nie vor dem Start nach der Widerrufsfrist.
    const wf = globalWiderrufsfrist(ein.angenommenAm);
    tag = s.sofortBeginn !== true && wf.startAb > startAm ? wf.startAb : startAm;
    art = "starttag";
  } else if (s.sofortBeginn === true) {
    art = "sofort";
  } else {
    tag = globalWiderrufsfrist(ein.angenommenAm).startAb;
    art = "widerruf";
  }
  const tagBeginn = tag ? berlinZeitpunkt(tag, 0) : null;
  const ab = tagBeginn && tagBeginn.getTime() > vorlauf.getTime() ? tagBeginn : vorlauf;
  return { ab, tag: berlinDatum(ab), art };
}

/**
 * Die buchbaren Zeiten ab `ab`, vierzehn Tage lang — DIESELBE Rechnung wie der Gesprächskalender auf /business
 * (Raster, Montag bis Freitag, Tagesdeckel, echte Dauer). `ab` enthält den Vorlauf schon (startgespraechFruehestens).
 */
export function startgespraechZeitenRechnen(ein: { ab: Date; fenster: GlobalFenster[]; belegt: GlobalBelegung[]; proTag: number }): { frei: GlobalFreieZeit[]; zeitenGepflegt: boolean } {
  const erg = globalZeitenRechnen({ jetzt: ein.ab, vorlaufStunden: 0, tage: GLOBAL_HORIZONT_TAGE, fenster: ein.fenster, belegt: ein.belegt, proTag: ein.proTag });
  return { frei: erg.frei, zeitenGepflegt: erg.zeitenGepflegt };
}

/** Hat diese Person Zeiten, in denen ein Global-Gespräch Platz hat (Montag bis Freitag, mindestens dreißig Minuten)? */
export function zeitenFuerGlobal(fenster: GlobalFenster[]): boolean {
  return fenster.some((f) => f.aktiv !== false && GLOBAL_WOCHENTAGE.includes(Number(f.wochentag))
    && (zeitZuMinuten(f.bis) ?? 0) - (zeitZuMinuten(f.von) ?? 0) >= GLOBAL_DAUER_MIN);
}

const esc = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface StartgespraechTermin {
  terminId: number;
  beginn: string;
  dauerMin: number;
  /** Voller Name („Justin Schwarzott") — Sätze mit „mit …" vertragen keine Nennform „Herr …". */
  mit: string;
  telefon: string | null;
  stornoToken: string | null;
  quelle: string;
}

/** Was Seite, „Mein Auftrag" und Mails zu einem gebuchten Termin zeigen — rein. */
export function startgespraechDarstellung(t: StartgespraechTermin) {
  const tag = berlinDatum(new Date(t.beginn));
  const tagText = `${startgespraechWochentag(tag)}, ${berlinDatumText(t.beginn)}`;
  const uhrzeit = berlinUhrzeit(t.beginn);
  const dauerMin = Math.max(5, Math.round(Number(t.dauerMin) || GLOBAL_DAUER_MIN));
  const global = t.quelle === "global";
  // Global-Termine: Absage-Seite in der Sie-Form und im Rahmen von FIAON Global (wie global_termin); /justin-Termine siezt sie mit ?anrede=sie.
  const verschiebenUrl = t.stornoToken ? `${stornoLink(t.stornoToken)}?anrede=sie${global ? "&bereich=business" : ""}` : null;
  const kalenderUrl = t.stornoToken ? (global ? globalKalenderUrl(t.stornoToken) : absoluteUrl(`/kalender/k/${t.stornoToken}.ics`)) : null;
  const b = new Date(t.beginn);
  const googleUrl = googleKalenderLink({
    text: ST.kalenderTitel, beginn: b, ende: new Date(b.getTime() + dauerMin * 60_000),
    details: "FIAON ruft Sie zur vereinbarten Zeit an. Verschieben oder absagen: über den Link in Ihrer Bestätigungsmail.", ort: "Telefon",
  });
  return {
    terminId: t.terminId, beginn: new Date(t.beginn).toISOString(), tag, tagText, uhrzeit, dauerMin,
    dauerWort: dauerMin <= 31 ? zahlwort(dauerMin) : String(dauerMin),
    mit: t.mit, telefon: t.telefon, zeile: ST.zeile(tagText, uhrzeit, t.mit), wie: ST.wie(t.mit, dauerMin <= 31 ? zahlwort(dauerMin) : String(dauerMin)),
    verschiebenUrl, kalenderUrl, googleUrl,
  };
}
export type StartgespraechAnzeige = ReturnType<typeof startgespraechDarstellung>;

/**
 * Die Mailfelder (params.*) zu einem gebuchten Startgespräch — rein, Werte entschärft. Ohne Termin: {} — dann entfällt
 * der Absatz {{params.startgespraech_html}} in global_angebot_angenommen (Motor: Absatz nur aus einem leeren Platzhalter),
 * und die Bestätigung ist Byte für Byte die bisherige.
 */
export function startgespraechMailFelder(d: StartgespraechAnzeige | null): Record<string, string> {
  if (!d) return {};
  const link = d.verschiebenUrl
    ? `<a href="${esc(d.verschiebenUrl)}" style="color:#1d4ed8;font-weight:600;text-decoration:underline;">${ST.mailVerschieben}</a>`
    : "Antworten Sie einfach auf diese E-Mail";
  return {
    startgespraech_html: ST.mailAbsatz({ tagText: esc(d.tagText), uhrzeit: esc(d.uhrzeit), mit: esc(d.mit), telefon: d.telefon ? esc(d.telefon) : null, dauerWort: d.dauerWort, link }),
    startgespraech_datum_text: esc(d.tagText),
    startgespraech_uhrzeit: esc(d.uhrzeit),
    startgespraech_mit: esc(d.mit),
    startgespraech_kalender_url: d.kalenderUrl ?? "",
    startgespraech_google_url: d.googleUrl,
    startgespraech_storno_url: d.verschiebenUrl ?? "",
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// LESEN — der Stand je Angebot (Seite, „Mein Auftrag", Chefbüro, Mails)
// ═══════════════════════════════════════════════════════════════════════════

/** „vorbei": Die Zeit ist um, im Kalender aber noch nicht abgeschlossen — der Kunde liest dazu nichts (kein „fand statt“ ohne Beleg). */
export type StartgespraechStandArt = "gebucht" | "gefuehrt" | "vorbei" | "abgesagt" | "persoenlich" | "folgt" | "keins";
export interface StartgespraechStand {
  stand: StartgespraechStandArt;
  /** Der Termin, der gilt — bei einer Absage mit Neubuchung über /justin der neue. */
  termin: StartgespraechAnzeige | null;
  terminStatus: string | null;
  /** Der vom System gebuchte Termin (fiaon_termine.id) — auch wenn er inzwischen abgesagt ist. */
  gebuchtTerminId: number | null;
  /** Nach einer Absage über /justin (oder neu im Global-Kalender) gebucht. */
  neuGebucht: boolean;
  agentId: number | null;
  fehler: string | null;
  versuchAm: string | null;
  versuche: number;
  mailAm: string | null;
  abgesagtVon: string | null;
  /** Der Satz für die Seite, wenn es keinen Termin zu zeigen gibt. */
  satz: string | null;
}
const LEER: StartgespraechStand = { stand: "keins", termin: null, terminStatus: null, gebuchtTerminId: null, neuGebucht: false, agentId: null, fehler: null, versuchAm: null, versuche: 0, mailAm: null, abgesagtVon: null, satz: null };

const json = <T,>(v: unknown, leer: T): T => {
  if (v && typeof v === "object" && !Buffer.isBuffer(v)) return v as T;
  try { const x = JSON.parse(String(v ?? "")); return (typeof x === "string" ? JSON.parse(x) : x) as T; } catch { return leer; }
};

/**
 * Der Stand des Startgesprächs je Angebot. Wirft nie: Fehlen die Spalten (Migration 090 noch nicht da) oder hakt die
 * Abfrage, gibt es eine leere Karte — Seite und Liste stehen dann wie vor E-273.
 */
export async function startgespraechStaende(ids: number[], jetzt: Date = new Date()): Promise<Map<number, StartgespraechStand>> {
  const aus = new Map<number, StartgespraechStand>();
  const nummern = ids.map(Number).filter((x) => Number.isInteger(x) && x > 0);
  if (!nummern.length) return aus;
  let zeilen: any[] = [];
  try {
    // Gegenprüfung E-273 (recht-zeitpunkt, 02.10.2026): dazu angenommen_am (Stundenlauf aufgegeben?) und erledigt_am
    // (wer „verpasst“ gesetzt hat: ein Mensch mit Ergebnis — oder der Aufräumlauf nach zwölf Stunden, siehe unten).
    zeilen = (await sqlPool`
      SELECT a.id, a.status AS a_status, a.kunde, a.angenommen_am, a.startgespraech_termin_id, a.startgespraech_agent_id, a.startgespraech_fehler,
             a.startgespraech_versuch_am, COALESCE(a.startgespraech_versuche, 0) AS startgespraech_versuche, a.startgespraech_mail_am,
             t.id AS t_id, t.status AS t_status, t.beginn AS t_beginn, COALESCE(t.dauer_min, ${GLOBAL_DAUER_MIN}) AS t_dauer,
             t.storno_token AS t_token, t.abgesagt_von AS t_abgesagt_von, t.agent_id AS t_agent_id, t.quelle AS t_quelle, t.erledigt_am AS t_erledigt_am,
             n.id AS n_id, n.status AS n_status, n.beginn AS n_beginn, COALESCE(n.dauer_min, ${GLOBAL_DAUER_MIN}) AS n_dauer,
             n.storno_token AS n_token, n.agent_id AS n_agent_id, n.quelle AS n_quelle, n.erledigt_am AS n_erledigt_am
        FROM fiaon_global_angebote a
        LEFT JOIN fiaon_termine t ON t.id = a.startgespraech_termin_id
        LEFT JOIN LATERAL (
          SELECT x.id, x.status, x.beginn, x.dauer_min, x.storno_token, x.agent_id, x.quelle, x.erledigt_am FROM fiaon_termine x
           WHERE t.status = 'abgesagt' AND x.person_id = t.person_id AND x.agent_id = t.agent_id AND x.id <> t.id
             AND x.quelle IN ('global', 'gruender') AND x.status IN ('gebucht', 'erledigt')
             AND x.created_at >= COALESCE(t.abgesagt_am, t.created_at)
           ORDER BY x.beginn LIMIT 1) n ON TRUE
       WHERE a.id = ANY(${nummern})`) as any[];
  } catch (e) {
    console.error("[FIAON-STARTGESPRAECH] Stand nicht lesbar (Migration 090?):", e instanceof Error ? e.message : e);
    return aus;
  }
  const agentIds = Array.from(new Set(zeilen.flatMap((z) => [z.t_agent_id, z.n_agent_id, z.startgespraech_agent_id]).filter((x) => x != null).map(Number)));
  const agenten = new Map<number, any>(agentIds.length
    ? ((await sqlPool`SELECT id, name, first_name, last_name, anrede FROM fiaon_agents WHERE id = ANY(${agentIds})`.catch(() => [])) as any[]).map((a) => [Number(a.id), a])
    : []);
  for (const z of zeilen) {
    const kunde = json<Partial<AngebotKunde>>(z.kunde, {});
    const st: StartgespraechStand = {
      ...LEER,
      gebuchtTerminId: z.startgespraech_termin_id != null ? Number(z.startgespraech_termin_id) : null,
      agentId: z.startgespraech_agent_id != null ? Number(z.startgespraech_agent_id) : null,
      fehler: z.startgespraech_fehler ?? null,
      versuchAm: z.startgespraech_versuch_am ? new Date(z.startgespraech_versuch_am).toISOString() : null,
      versuche: Number(z.startgespraech_versuche || 0),
      mailAm: z.startgespraech_mail_am ? new Date(z.startgespraech_mail_am).toISOString() : null,
      terminStatus: z.t_status ?? null,
      abgesagtVon: z.t_abgesagt_von ?? null,
    };
    const anzeige = (id: unknown, beginn: unknown, dauer: unknown, token: unknown, agentId: unknown, quelle: unknown) => startgespraechDarstellung({
      terminId: Number(id), beginn: new Date(beginn as any).toISOString(), dauerMin: Number(dauer),
      mit: nennform(agenten.get(Number(agentId)) ?? null).voll, telefon: kunde.telefon ? String(kunde.telefon) : null,
      stornoToken: token ? String(token) : null, quelle: String(quelle ?? "global"),
    });
    // Gegenprüfung E-273 (recht-zeitpunkt, 02.10.2026): „verpasst“ OHNE erledigt_am setzt der Aufräumlauf
    // (runVerpassteTermine) bei JEDEM Termin, der zwölf Stunden nach Beginn noch „gebucht“ ist — auch wenn das Gespräch
    // stattfand und nur niemand es im Kalender abgeschlossen hat (das Haus zählt ihn deshalb weiter als offen,
    // fiaon-termin.ts). Vorher las der Kunde dann „vereinbaren wir persönlich … wir melden uns“ und die Startmail
    // „meldet sich …, um das Startgespräch zu vereinbaren“ — nach einem geführten Gespräch. Jetzt gilt das als „vorbei“
    // (der Kunde liest nichts dazu); „kam nicht zustande“ nur, wenn ein Mensch es so eingetragen hat (erledigt_am).
    const vorbeiOderGebucht = (status: string, beginn: unknown, erledigtAm: unknown): StartgespraechStandArt =>
      status === "erledigt" ? "gefuehrt"
        : status === "verpasst" ? (erledigtAm ? "persoenlich" : "vorbei")
          : new Date(beginn as any).getTime() > jetzt.getTime() ? "gebucht" : "vorbei";
    if (String(z.a_status) !== "angenommen") { aus.set(Number(z.id), { ...st, stand: "keins" }); continue; }
    if (z.t_id) {
      if (String(z.t_status) === "abgesagt" && z.n_id) {
        const s2 = vorbeiOderGebucht(String(z.n_status), z.n_beginn, z.n_erledigt_am);
        st.stand = s2; st.neuGebucht = true; st.terminStatus = String(z.n_status);
        st.termin = anzeige(z.n_id, z.n_beginn, z.n_dauer, z.n_token, z.n_agent_id, z.n_quelle);
      } else if (String(z.t_status) === "abgesagt") {
        st.stand = "abgesagt"; st.satz = ST.abgesagt;
        st.termin = anzeige(z.t_id, z.t_beginn, z.t_dauer, null, z.t_agent_id, z.t_quelle);
      } else {
        st.stand = vorbeiOderGebucht(String(z.t_status), z.t_beginn, z.t_erledigt_am);
        st.termin = anzeige(z.t_id, z.t_beginn, z.t_dauer, z.t_token, z.t_agent_id, z.t_quelle);
        if (st.stand === "gefuehrt") st.satz = ST.gefuehrt(st.termin.tagText);
        if (st.stand === "persoenlich") st.satz = ST.persoenlich;
      }
    } else {
      // Gegenprüfung E-273 (recht-zeitpunkt, 02.10.2026): Ein technischer Fehler wird nur drei Tage lang nachgeholt
      // (globalAngebotLauf). Danach bucht niemand mehr automatisch — Justin hat die Aufgabe. Vorher blieb die Seite
      // für immer bei „tragen wir gerade ein — Tag und Uhrzeit erhalten Sie per E-Mail“; das versprach eine Mail,
      // die nicht mehr kommt.
      const fehlerText = String(z.startgespraech_fehler ?? "");
      const angenommen = z.angenommen_am ? new Date(z.angenommen_am).getTime() : NaN;
      const aufgegeben = /^technik/.test(fehlerText) && Number.isFinite(angenommen)
        && angenommen <= jetzt.getTime() - STARTGESPRAECH_NACHHOLEN_TAGE * 86_400_000;
      const endgueltig = /^(kein_platz|keine_person)/.test(fehlerText) || aufgegeben;
      st.stand = endgueltig ? "persoenlich" : "folgt";
      st.satz = endgueltig ? ST.persoenlich : ST.folgt;
    }
    aus.set(Number(z.id), st);
  }
  return aus;
}
export async function startgespraechStand(id: number, jetzt?: Date): Promise<StartgespraechStand> {
  return (await startgespraechStaende([id], jetzt)).get(Number(id)) ?? LEER;
}

/** Für die Antwort an die Kundenseite und „Mein Auftrag": nur was der Kunde sehen soll (kein Fehlertext, keine IDs). */
export function startgespraechFuerKunde(st: StartgespraechStand): Record<string, unknown> | null {
  if (st.stand === "keins" || st.stand === "vorbei") return null;
  const t = st.termin;
  return {
    stand: st.stand, titel: ST.titel,
    zeile: st.stand === "gebucht" && t ? t.zeile : null,
    wie: st.stand === "gebucht" && t ? t.wie : null,
    satz: st.stand === "gebucht" ? null : st.satz,
    kalenderUrl: st.stand === "gebucht" ? t?.kalenderUrl ?? null : null,
    googleUrl: st.stand === "gebucht" ? t?.googleUrl ?? null : null,
    verschiebenUrl: st.stand === "gebucht" ? t?.verschiebenUrl ?? null : null,
    texte: { kalender: ST.kalender, google: ST.google, verschieben: ST.verschieben },
  };
}

/** global_angebot_start: der Rest des Satzes nach dem Namen des Ansprechpartners (siehe STARTGESPRAECH_TEXTE). */
export function startgespraechStartSatz(st: StartgespraechStand): string {
  if (st.stand === "gebucht" && st.termin) return ST.mailStartMit(esc(st.termin.mit), esc(st.termin.tagText), esc(st.termin.uhrzeit));
  if (st.stand === "gefuehrt" || st.stand === "vorbei") return ST.mailStartVorbei;
  return ST.mailStartOhne;
}

// ═══════════════════════════════════════════════════════════════════════════
// BUCHEN
// ═══════════════════════════════════════════════════════════════════════════

async function verlauf(id: number, wer: string, was: string): Promise<void> {
  await sqlPool`
    UPDATE fiaon_global_angebote
       SET verlauf = COALESCE(verlauf, '[]'::jsonb) || ${sqlPool.json([{ am: new Date().toISOString(), wer, was }] as any)}, updated_at = NOW()
     WHERE id = ${id}`.catch((e) => console.error(`[FIAON-STARTGESPRAECH] ${id}: Verlauf nicht geschrieben:`, e));
}

interface Person { id: number; name: string; wahl: "gruender" | "global_zustaendig"; fenster: Zeitfenster[]; hinweis: string | null }

/** In wessen Kalender (siehe Kopf: WER). `fehlt` nennt den Grund, wenn niemand Gespräche annehmen kann. */
async function personFuerStartgespraech(): Promise<Person | { fehlt: string }> {
  const { gruenderAgentId } = await import("../routes/fiaon-gruender-termin");
  const gruender = await gruenderAgentId();
  const zustaendig = await globalZustaendig().catch(() => null);
  const kandidaten: { id: number; wahl: Person["wahl"] }[] = [{ id: gruender, wahl: "gruender" }];
  if (zustaendig && zustaendig.id !== gruender) kandidaten.push({ id: zustaendig.id, wahl: "global_zustaendig" });
  const gruende: string[] = [];
  for (const k of kandidaten) {
    const [a] = (await sqlPool`SELECT id, name, first_name, last_name, anrede, active, zugang_gesperrt_am, rolle FROM fiaon_agents WHERE id = ${k.id}`) as any[];
    const name = a ? nennform(a).voll : `Konto #${k.id}`;
    if (!a || !a.active || a.zugang_gesperrt_am) { gruende.push(`${name}: Konto inaktiv oder gesperrt`); continue; }
    // terminBuchen nimmt beim Forderungsmanagement nur Zahlungsgespräche an.
    if (String(a.rolle) === "inkasso") { gruende.push(`${name}: Forderungsmanagement nimmt keine Gespräche an`); continue; }
    const fenster = await verfuegbarkeitVon(Number(a.id));
    if (!zeitenFuerGlobal(fenster)) { gruende.push(`${name}: keine Zeiten Montag bis Freitag gepflegt`); continue; }
    return {
      id: Number(a.id), name, wahl: k.wahl, fenster,
      hinweis: k.wahl === "gruender" ? null : `Die Angebotsseite nennt ${FIAON_FIRMA.director} als Gesprächspartner; gebucht ist ${name}, weil ${gruende.join("; ")}.`,
    };
  }
  return { fehlt: gruende.join("; ") || "niemand ist für FIAON Global zuständig" };
}

/**
 * Gegenprüfung E-273 (technik, 02.10.2026): Steht für diese Person SEIT DER ANNAHME schon ein Gespräch im Kalender —
 * von Hand eingetragen (Justins Aufgabe „noch nicht gebucht“ sagt „sonst bitte von Hand …“) oder über /justin selbst
 * gebucht —, ist DAS das Startgespräch. Vorher buchte der Stundenlauf nach einem technischen Fehler trotzdem eins dazu
 * (lokal nachgestellt: Handtermin Mo 10:00, danach das System Fr 13:00 und die Mail „Ihr Startgespräch steht“ mit der
 * zweiten Zeit). Läuft in der Buchung UNTER der Sperre je Angebot; hängt den Termin ans Angebot, bucht nichts dazu.
 * Ein Termin, der schon an einem anderen Angebot hängt, zählt nicht; das Forderungsmanagement auch nicht.
 */
async function handTerminUebernehmen(tx: any, id: number, personId: number, angenommenAm: Date): Promise<{ terminId: number; beginn: string } | null> {
  const [t] = (await tx`
    SELECT t.id, t.beginn, t.agent_id FROM fiaon_termine t
     WHERE t.person_id = ${personId} AND t.status IN ('gebucht', 'erledigt', 'verpasst') AND t.created_at >= ${angenommenAm}
       AND COALESCE(t.quelle, '') <> 'inkasso_call'
       AND NOT EXISTS (SELECT 1 FROM fiaon_global_angebote o WHERE o.startgespraech_termin_id = t.id AND o.id <> ${id})
     ORDER BY (t.status = 'gebucht') DESC, t.beginn ASC LIMIT 1`) as any[];
  if (!t) return null;
  await tx`
    UPDATE fiaon_global_angebote
       SET startgespraech_termin_id = ${Number(t.id)}, startgespraech_am = ${new Date(t.beginn)},
           startgespraech_agent_id = ${t.agent_id != null ? Number(t.agent_id) : null}, startgespraech_fehler = NULL, updated_at = NOW()
     WHERE id = ${id} AND startgespraech_termin_id IS NULL`;
  return { terminId: Number(t.id), beginn: new Date(t.beginn).toISOString() };
}

export type StartgespraechErgebnis =
  | { status: "gebucht" | "schon"; terminId: number; beginn: string; mit: string; wahl?: Person["wahl"] }
  | { status: "kein_platz" | "keine_person" | "fehler" | "nicht_bereit"; grund: string };

/**
 * Bucht das Startgespräch eines angenommenen Angebots — höchstens eines, wiederholbar (siehe Kopf).
 * `jetzt` nur für den Prüfstand.
 */
export async function angebotStartgespraechBuchen(id: number, opts: { jetzt?: Date; anlass?: string } = {}): Promise<StartgespraechErgebnis> {
  const jetzt = opts.jetzt ?? new Date();
  const anlass = opts.anlass ?? "nacharbeit";
  const [z] = (await sqlPool`
    SELECT id, angebot_ref, status, person_id, auftrag_ref, schalter, angenommen_am, kunde, startgespraech_termin_id, startgespraech_am, startgespraech_agent_id, fassung
      FROM fiaon_global_angebote WHERE id = ${id} LIMIT 1`) as any[];
  // E-301: Beim Firmenangebot geht KEINE automatische Mail an die Kundin — auch nicht die Terminerinnerung 24 Stunden vorher
  // (runTerminErinnerungen). Die Erinnerung gilt deshalb ab der Buchung als erledigt; den Termin nennt der Ansprechpartner selbst.
  const ohneKundenmail = String(z?.fassung ?? "").startsWith("IA-FIRMA-");
  if (!z || String(z.status) !== "angenommen" || !z.auftrag_ref) return { status: "nicht_bereit", grund: "nicht angenommen oder noch ohne Auftrag" };
  if (z.startgespraech_termin_id) return { status: "schon", terminId: Number(z.startgespraech_termin_id), beginn: new Date(z.startgespraech_am ?? jetzt).toISOString(), mit: "" };
  const ref = String(z.angebot_ref); const ref1 = String(z.auftrag_ref);
  const kunde = json<AngebotKunde>(z.kunde, {} as AngebotKunde);
  const name = angebotKundeName(kunde);
  const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
  const versuch = async (fehler: string | null) => {
    await sqlPool`
      UPDATE fiaon_global_angebote
         SET startgespraech_fehler = ${fehler ? fehler.slice(0, 500) : null}, startgespraech_versuch_am = NOW(),
             startgespraech_versuche = COALESCE(startgespraech_versuche, 0) + 1, updated_at = NOW()
       WHERE id = ${id} AND startgespraech_termin_id IS NULL`;
  };
  const anJustin = async (titel: string, text: string) => {
    await auftragFuerKunden({
      personId: z.person_id != null ? Number(z.person_id) : null, ref: ref1, titel, text,
      dringend: true, anBetreiber: true, schluessel: `global:${ref1}:startgespraech`, bereich: "konten", quelle: "global", autorName: "FIAON Global",
      link: CHEF_LINK, anlageText: `Startgespräch zum Individualangebot ${ref} nicht gebucht.`,
    }).catch((e) => console.error(`[FIAON-STARTGESPRAECH] ${ref}: Aufgabe an Justin:`, e));
  };
  const kontakt = `${kunde.telefon || "keine Telefonnummer am Angebot"} · ${kunde.email || "—"}`;
  const wahl = json<AngebotSchalter>(z.schalter, { sofortBeginn: false, jahresbetreuung: false });
  const fr = startgespraechFruehestens({ jetzt, angenommenAm: new Date(z.angenommen_am ?? jetzt), schalter: wahl });
  const abText = fr.art === "sofort" ? "sofort (Vorlauf zwei Stunden)" : fr.art === "starttag" ? `ab dem gewählten Starttag ${angebotTag(fr.tag)}` : `ab dem Start nach der Widerrufsfrist (${angebotTag(fr.tag)})`;

  try {
    if (!z.person_id) throw new Error("am Angebot steht noch keine Person — die Bestellzeile fehlt");
    const person = await personFuerStartgespraech();
    if ("fehlt" in person) {
      const grund = `keine_person: ${person.fehlt}`;
      await versuch(grund);
      await verlauf(id, "System", `Startgespräch NICHT gebucht — niemand mit Zeiten (${person.fehlt}). Aufgabe an Justin.`);
      await anJustin(`Startgespräch von Hand buchen: ${name} (Individualangebot ${ref})`, [
        `Nach der Annahme konnte das System das Startgespräch nicht buchen: Niemand kann Gespräche annehmen (${person.fehlt}).`,
        `Bitte einen Termin mit ${name} vereinbaren (${kontakt}) und im Kalender eintragen — ${abText}.`,
        `Der Kunde liest auf seiner Seite: „${ST.persoenlich}“`,
        `Office: ${globalOfficeAuftragPfad(ref1)}`,
      ].join("\n"));
      return { status: "keine_person", grund };
    }
    const proTag = await globalTerminProTag();
    const vonAb = new Date(fr.ab.getTime() - 86_400_000); const bisAb = new Date(fr.ab.getTime() + (GLOBAL_HORIZONT_TAGE + 2) * 86_400_000);
    const termine = (await sqlPool`
      SELECT beginn, COALESCE(dauer_min, 20) AS dauer_min, quelle, status FROM fiaon_termine
       WHERE agent_id = ${person.id}
         AND (status IN ('gebucht', 'erledigt', 'verpasst') OR (status = 'abgesagt' AND abgesagt_von = 'agent'))
         AND beginn > ${vonAb} AND beginn < ${bisAb}`) as any[];
    const { frei } = startgespraechZeitenRechnen({
      ab: fr.ab, fenster: person.fenster, proTag,
      belegt: termine.map((t) => ({ beginn: t.beginn, dauerMin: Number(t.dauer_min), zaehltAlsGlobal: t.quelle === "global" && t.status !== "abgesagt" })),
    });
    // Auch ohne freie Zeit geht es durch die Sperre: Hat ein paralleler Lauf (Annahme, Kundenlink, Stundenlauf) gerade
    // gebucht, ist sein Termin der Grund, warum hier nichts mehr frei ist — dann „schon", nicht „kein Platz".
    // ── ATOMAR: EIN STARTGESPRÄCH JE ANGEBOT, TAGESDECKEL JE PERSON UND TAG ──
    // ensureHerkunftSpalte VOR der Transaktion (Muster globalTerminBuchen: ihr ALTER stellte sich sonst hinter die Sperren).
    await ensureHerkunftSpalte();
    const ergebnis = await sqlPool.begin(async (tx: any) => {
      await tx`SELECT pg_advisory_xact_lock(hashtext(${`global-angebot-startgespraech:${id}`}))`;
      const [frisch] = (await tx`SELECT startgespraech_termin_id, startgespraech_am, status FROM fiaon_global_angebote WHERE id = ${id}`) as any[];
      if (!frisch || String(frisch.status) !== "angenommen") return { art: "nicht_bereit" as const };
      if (frisch.startgespraech_termin_id) return { art: "schon" as const, terminId: Number(frisch.startgespraech_termin_id), beginn: new Date(frisch.startgespraech_am ?? jetzt).toISOString() };
      // Gegenprüfung E-273 (technik): schon von Hand (oder über /justin) gebucht? Dann ist das das Startgespräch.
      const hand = await handTerminUebernehmen(tx, id, Number(z.person_id), new Date(z.angenommen_am ?? jetzt));
      if (hand) return { art: "hand" as const, ...hand };
      const voll = new Set<string>();
      for (const slot of frei.slice(0, 60)) {
        if (voll.has(slot.tag)) continue;
        // Dieselbe Sperre je Person und Tag wie globalTerminBuchen der Website — die beiden zählen den Deckel nacheinander.
        await tx`SELECT pg_advisory_xact_lock(hashtext(${`global-termin:${person.id}:${slot.tag}`}))`;
        const [n] = (await tx`
          SELECT COUNT(*)::int AS n FROM fiaon_termine
           WHERE agent_id = ${person.id} AND quelle = 'global' AND status IN ('gebucht', 'erledigt', 'verpasst')
             AND (beginn AT TIME ZONE 'Europe/Berlin')::date = ${slot.tag}::date`) as any[];
        if (Number(n?.n ?? 0) >= proTag) { voll.add(slot.tag); continue; }
        const tage = Math.ceil((new Date(slot.beginn).getTime() - Date.now()) / 86_400_000) + 1;
        try {
          const b = await tx.savepoint((sp: any) => terminBuchen({
            personId: Number(z.person_id), agentId: person.id, beginn: new Date(slot.beginn),
            quelle: "global", herkunft: "individualangebot", horizontTage: tage,
          }, sp));
          const notiz = [
            `Startgespräch Individualangebot ${ref} (Auftrag ${ref1}) — vom System nach der Annahme gebucht (${abText}).`,
            `Kunde: ${name} · ${kontakt}`,
            "Inhalt: Bundesstaat festlegen, Ablauf erklären, Reisepass ansprechen.",
            `Office: ${globalOfficeAuftragPfad(ref1)}`,
          ].join("\n");
          // Gegenprüfung E-273 (recht-zeitpunkt, 02.10.2026): Beginnt das Gespräch binnen vierundzwanzig Stunden („Sofort
          // starten“ — meist noch am selben Tag), gilt die Erinnerung als erledigt. Sonst schickt der 20-Minuten-Lauf
          // (runTerminErinnerungen) sie gleich nach der Bestätigung — mit dem Betreff „Morgen: Ihr Gespräch um …“, obwohl
          // das Gespräch HEUTE ist. Tag und Uhrzeit hat der Kunde da schon: auf der Seite und in der Bestätigung (bzw. der
          // Mail zum Startgespräch). Weiter voraus bleibt die Erinnerung, wie sie ist.
          await tx`
            UPDATE fiaon_termine
               SET notiz = ${notiz}, updated_at = NOW(),
                   erinnert_am = CASE WHEN beginn < NOW() + INTERVAL '24 hours' OR ${ohneKundenmail}::boolean THEN NOW() ELSE erinnert_am END
             WHERE id = ${b.id}`;
          await tx`
            UPDATE fiaon_global_angebote
               SET startgespraech_termin_id = ${b.id}, startgespraech_am = ${new Date(b.beginn)}, startgespraech_agent_id = ${person.id},
                   startgespraech_fehler = NULL, startgespraech_versuch_am = NOW(), startgespraech_versuche = COALESCE(startgespraech_versuche, 0) + 1,
                   updated_at = NOW()
             WHERE id = ${id}`;
          return { art: "gebucht" as const, buchung: b };
        } catch (e) {
          // „belegt" (gleiche Zeit / Überschneidung im selben Augenblick) und Rasterfragen: die nächste Zeit.
          if (e instanceof TerminFehler && ["belegt", "kein_slot", "zu_frueh"].includes(e.code)) continue;
          throw e;
        }
      }
      return { art: "kein_platz" as const };
    });

    if (ergebnis.art === "nicht_bereit") return { status: "nicht_bereit", grund: "nicht angenommen" };
    if (ergebnis.art === "schon") return { status: "schon", terminId: ergebnis.terminId, beginn: ergebnis.beginn, mit: person.name };
    if (ergebnis.art === "hand") {
      // Gegenprüfung E-273 (technik): übernommen, nicht gebucht — keine zweite Termin-Aufgabe, und hier keine Mail.
      // Ging die Bestätigung OHNE Termin raus, holt der Stundenlauf (ohneMitteilung) „Ihr Startgespräch steht“ mit
      // DIESEM Termin nach — dieselbe Zeit, die der Kunde schon kennt. Justins Aufgabe „noch nicht gebucht / von Hand
      // buchen“ ist damit erledigt.
      const wannH = `${startgespraechWochentag(berlinDatum(new Date(ergebnis.beginn)))}, ${berlinDatumText(ergebnis.beginn)} um ${berlinUhrzeit(ergebnis.beginn)} Uhr`;
      await verlauf(id, "System", `Startgespräch übernommen: ${wannH} stand seit der Annahme schon im Kalender (Termin #${ergebnis.terminId}) — das System bucht kein zweites (${anlass}).`);
      await sqlPool`
        UPDATE fiaon_betreiber_todos SET status = 'erledigt', erledigt_am = NOW(), erledigt_von = 'System',
               ergebnis = ${`Termin steht schon im Kalender: ${wannH}.`}, updated_at = NOW(), letzte_aktivitaet = NOW()
         WHERE schluessel = ${`global:${ref1}:startgespraech`} AND status <> 'erledigt'`.catch(() => {});
      return { status: "schon", terminId: ergebnis.terminId, beginn: ergebnis.beginn, mit: "" };
    }
    if (ergebnis.art === "kein_platz") {
      const grund = `kein_platz: bei ${person.name} ${abText} vierzehn Tage lang kein freier Platz (höchstens ${deckelText(proTag)} je Tag)`;
      await versuch(grund);
      await verlauf(id, "System", `Startgespräch NICHT gebucht — ${grund.replace(/^kein_platz: /, "")}. Aufgabe an Justin.`);
      await anJustin(`Startgespräch von Hand buchen: ${name} (Individualangebot ${ref})`, [
        `Nach der Annahme konnte das System das Startgespräch nicht buchen: Im Kalender von ${person.name} ist ${abText} vierzehn Tage lang kein Platz frei (Montag bis Freitag, Raster dreißig Minuten, höchstens ${deckelText(proTag)} je Tag).`,
        `Bitte einen Termin mit ${name} vereinbaren (${kontakt}) und im Kalender eintragen.`,
        `Der Kunde liest auf seiner Seite: „${ST.persoenlich}“`,
        `Office: ${globalOfficeAuftragPfad(ref1)}`,
      ].join("\n"));
      return { status: "kein_platz", grund };
    }

    // ── Der Termin steht. Nichts Folgendes darf ihn kippen — jede Stufe fängt ihren eigenen Fehler. ──
    const b = ergebnis.buchung;
    await versuchProtokollieren({ ergebnis: "gebucht", personId: Number(z.person_id), slotBeginn: b.beginn, agentId: person.id, quelle: "global", akteur: "kunde" });
    const wann = `${startgespraechWochentag(berlinDatum(new Date(b.beginn)))}, ${b.datumText} um ${b.uhrzeit} Uhr`;
    await verlauf(id, "System", `Startgespräch gebucht: ${wann} mit ${person.name} (${abText}; ${anlass})${person.hinweis ? ` — ${person.hinweis}` : ""}`);
    const { globalVerlauf } = await import("./fiaon-global-auftrag");
    await globalVerlauf(ref1, `FIAON Global: Startgespräch zum Individualangebot ${ref} vom System gebucht — ${wann} mit ${person.name}.`).catch(() => {});
    await sqlPool`
      INSERT INTO fiaon_contact_log (person_id, ref, agent_id, agent_name, type, note)
      VALUES (${Number(z.person_id)}, ${ref1}, NULL, 'System', 'system',
              ${`Startgespräch (Individualangebot ${ref}) vom System gebucht: ${wann} mit ${person.name}.`})`.catch(() => {});
    // Die Aufgabe an die Person, die anruft — derselbe Schlüssel wie beim Erstgespräch (global-termin:<id>): Ergebnis und
    // Absage im Kalender schließen sie (globalTerminErgebnis / globalTerminAbgesagt). Justin führt sein Brett (/admin/todo).
    try {
      await auftragFuerKunden({
        personId: Number(z.person_id), ref: ref1,
        titel: `Startgespräch ${name} (Individualangebot ${ref}) am ${b.datumText}, ${b.uhrzeit} Uhr`,
        text: [
          `Das System hat nach der Annahme des Individualangebots ${ref} das Startgespräch gebucht (${abText}).`,
          `Wann: ${wann}, ${GLOBAL_DAUER_MIN} Minuten — du rufst an: ${kontakt}.`,
          "Inhalt: Bundesstaat festlegen (die Seite sagt „Im Startgespräch … legen wir den Bundesstaat fest“), Ablauf erklären, Reisepass für die Identifizierung ansprechen. Teil 1 kann zu diesem Zeitpunkt noch offen sein — dann die Überweisung mit klären.",
          person.hinweis ? `Hinweis: ${person.hinweis}` : null,
          `Office: ${globalOfficeAuftragPfad(ref1)} · Leitung: ${CHEF_LINK}`,
          "Nach dem Gespräch: den Termin im Kalender abschließen.",
        ].filter(Boolean).join("\n"),
        faelligAm: berlinDatum(new Date(b.beginn)), schluessel: `global-termin:${b.id}`, bereich: "konten", quelle: "global", autorName: "FIAON Global",
        link: globalOfficeAuftragPfad(ref1),
        ...(person.wahl === "gruender" ? { anBetreiber: true } : { agentId: person.id }),
        anlageText: `Startgespräch zum Individualangebot ${ref} vom System gebucht.`,
      });
      await sqlPool`UPDATE fiaon_termine SET gemeldet_buchung_am = NOW() WHERE id = ${b.id}`.catch(() => {});
    } catch (e) { console.error(`[FIAON-STARTGESPRAECH] ${ref}: Aufgabe zum Termin ${b.id}:`, e); }
    // War vorher etwas gescheitert, ist Justins Aufgabe „von Hand buchen" damit erledigt.
    await sqlPool`
      UPDATE fiaon_betreiber_todos SET status = 'erledigt', erledigt_am = NOW(), erledigt_von = 'System',
             ergebnis = ${`Vom System nachgebucht: ${wann} mit ${person.name}.`}, updated_at = NOW(), letzte_aktivitaet = NOW()
       WHERE schluessel = ${`global:${ref1}:startgespraech`} AND status <> 'erledigt'`.catch(() => {});
    console.log(`[FIAON-STARTGESPRAECH] ${ref}: Termin #${b.id} ${wann} bei ${person.name} (${anlass})`);
    return { status: "gebucht", terminId: b.id, beginn: b.beginn, mit: person.name, wahl: person.wahl };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[FIAON-STARTGESPRAECH] ${ref}: Buchung gescheitert (${anlass}):`, e);
    await versuch(`technik: ${msg}`).catch(() => {});
    await anJustin(`Startgespräch noch nicht gebucht: ${name} (Individualangebot ${ref})`, [
      `Nach der Annahme ließ sich das Startgespräch technisch nicht buchen: ${msg.slice(0, 300)}.`,
      `Der Stundenlauf versucht es erneut (bis ${zahlwort(STARTGESPRAECH_NACHHOLEN_TAGE)} Tage nach der Annahme); bucht er, bekommt der Kunde Tag und Uhrzeit per Mail und diese Aufgabe schließt sich.`,
      `Sonst bitte von Hand einen Termin mit ${name} vereinbaren (${kontakt}) — ${abText}.`,
    ].join("\n"));
    return { status: "fehler", grund: `technik: ${msg}` };
  }
}

/**
 * Buchen und — wenn die Bestätigungsmail schon OHNE Termin draußen ist — Tag und Uhrzeit in einer eigenen Mail
 * nachreichen (global_angebot_startgespraech). Vor der Bestätigungsmail gerufen, nennt diese den Termin selbst.
 */
export async function angebotStartgespraechSicherstellen(id: number, opts: { jetzt?: Date; anlass?: string } = {}): Promise<StartgespraechErgebnis> {
  const erg = await angebotStartgespraechBuchen(id, opts);
  if (erg.status === "gebucht") {
    const [a] = (await sqlPool`SELECT bestaetigung_mail_am FROM fiaon_global_angebote WHERE id = ${id}`.catch(() => [])) as any[];
    if (a?.bestaetigung_mail_am) await startgespraechMitteilen(id).catch((e) => console.error(`[FIAON-STARTGESPRAECH] ${id}: Mitteilung:`, e));
  }
  return erg;
}

/** Die eigene Mail mit Tag und Uhrzeit — höchstens einmal je Angebot (startgespraech_mail_am), nachholbar. */
export async function startgespraechMitteilen(id: number): Promise<{ ok: boolean; grund: string | null }> {
  const [frei] = (await sqlPool`
    UPDATE fiaon_global_angebote SET startgespraech_mail_am = NOW(), updated_at = NOW()
     WHERE id = ${id} AND status = 'angenommen' AND startgespraech_mail_am IS NULL AND startgespraech_termin_id IS NOT NULL AND auftrag_ref IS NOT NULL
     RETURNING auftrag_ref, angebot_ref`) as any[];
  if (!frei) return { ok: true, grund: null };
  const st = await startgespraechStand(id);
  if (st.stand !== "gebucht" || !st.termin) {
    await sqlPool`UPDATE fiaon_global_angebote SET startgespraech_mail_am = NULL WHERE id = ${id}`.catch(() => {});
    return { ok: false, grund: "kein künftiger Termin" };
  }
  const ref1 = String(frei.auftrag_ref);
  const { globalAkteLesen, globalBestellungLesen, globalMailSenden, globalVerlauf } = await import("./fiaon-global-auftrag");
  const akte = await globalAkteLesen(ref1); const b = await globalBestellungLesen(ref1);
  const mail = await globalMailSenden("global_angebot_startgespraech", akte, b, {
    zusatz: { angebot_ref: esc(frei.angebot_ref), ...startgespraechMailFelder(st.termin) },
  }).catch((e) => ({ ok: false, grund: e instanceof Error ? e.message : String(e) }));
  if (!mail.ok) {
    await sqlPool`UPDATE fiaon_global_angebote SET startgespraech_mail_am = NULL WHERE id = ${id}`.catch(() => {});
    await verlauf(id, "System", `Mail mit dem Startgespräch ging NICHT raus (${mail.grund}).`);
  } else {
    await verlauf(id, "System", `Startgespräch per Mail mitgeteilt: ${st.termin.tagText}, ${st.termin.uhrzeit} Uhr.`);
    await globalVerlauf(ref1, `FIAON Global: Startgespräch per Mail mitgeteilt (${st.termin.tagText}, ${st.termin.uhrzeit} Uhr).`).catch(() => {});
  }
  return mail;
}

// ═══════════════════════════════════════════════════════════════════════════
// NACH EINER ABSAGE — Justin erfährt es, der Kunde wählt bei Justin neu
// ═══════════════════════════════════════════════════════════════════════════

/** Der Link „Neuen Termin wählen" nach der Absage des Startgesprächs — /justin mit den Daten des Kunden; sonst null. */
export async function startgespraechNeuBuchenLink(terminId: number): Promise<string | null> {
  const [a] = (await sqlPool`
    SELECT t.agent_id, t.person_id FROM fiaon_global_angebote a JOIN fiaon_termine t ON t.id = a.startgespraech_termin_id
     WHERE a.startgespraech_termin_id = ${terminId} LIMIT 1`.catch(() => [])) as any[];
  if (!a?.person_id) return null;
  const { gruenderAgentId } = await import("../routes/fiaon-gruender-termin");
  if (Number(a.agent_id) !== (await gruenderAgentId())) return null;
  return absoluteUrl(`/justin?k=${encodeURIComponent(terminTokenErzeugen(Number(a.person_id)))}`);
}

/** Gerufen aus globalTerminAbgesagt: War es ein Startgespräch, eine dringende Aufgabe an Justin und ein Verlaufseintrag. */
export async function startgespraechAbgesagt(ein: { terminId: number; beginn: Date | string; wer: "kunde" | "agent" }): Promise<void> {
  const [a] = (await sqlPool`
    SELECT a.id, a.angebot_ref, a.auftrag_ref, a.person_id, a.kunde, t.agent_id FROM fiaon_global_angebote a
      JOIN fiaon_termine t ON t.id = a.startgespraech_termin_id
     WHERE a.startgespraech_termin_id = ${ein.terminId} LIMIT 1`.catch(() => [])) as any[];
  if (!a) return;
  const kunde = json<AngebotKunde>(a.kunde, {} as AngebotKunde);
  const name = angebotKundeName(kunde);
  const wann = `${startgespraechWochentag(berlinDatum(new Date(ein.beginn)))}, ${berlinDatumText(ein.beginn)} um ${berlinUhrzeit(ein.beginn)} Uhr`;
  const { gruenderAgentId } = await import("../routes/fiaon-gruender-termin");
  const beiJustin = Number(a.agent_id) === (await gruenderAgentId());
  await verlauf(Number(a.id), ein.wer === "kunde" ? name : "Team", `Startgespräch (${wann}) abgesagt ${ein.wer === "kunde" ? "vom Kunden" : "durch das Team"}.`);
  const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
  await auftragFuerKunden({
    personId: a.person_id != null ? Number(a.person_id) : null, ref: a.auftrag_ref ? String(a.auftrag_ref) : null,
    titel: `Startgespräch abgesagt: ${name} (Individualangebot ${a.angebot_ref}) — neuen Termin vereinbaren`,
    text: [
      ein.wer === "kunde" ? `${name} hat das Startgespräch am ${wann} abgesagt.` : `Das Startgespräch mit ${name} am ${wann} wurde von uns abgesagt; der Kunde hat die Absage-Mail bekommen.`,
      beiJustin
        ? "Über den Link nach der Absage wählt er bei dir auf /justin eine neue Zeit (seine Daten sind ausgefüllt) — steht danach kein neues Gespräch in deinem Kalender, bitte anrufen und neu vereinbaren."
        : "Bitte anrufen und einen neuen Termin vereinbaren.",
      `Kontakt: ${kunde.telefon || "keine Telefonnummer am Angebot"} · ${kunde.email || "—"}`,
    ].join("\n"),
    dringend: true, anBetreiber: true, schluessel: `global:${a.auftrag_ref ?? a.angebot_ref}:startgespraech-absage:${ein.terminId}`,
    bereich: "konten", quelle: "global", autorName: "FIAON Global", link: CHEF_LINK,
  }).catch((e) => console.error(`[FIAON-STARTGESPRAECH] ${a.angebot_ref}: Aufgabe nach Absage:`, e));
}
