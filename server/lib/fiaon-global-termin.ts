// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DAS ERSTGESPRÄCH: ANGEBOT, BUCHUNG, ANFRAGE (17.09.2026, E-188)
//
// ── DER AUFTRAG ────────────────────────────────────────────────────────────
// Justin: „Direktkauf: Vertrag, Rechnung, Zahlung aufs Bankkonto = Start —
// oder eben eine Beratung zuvor buchen." Auf der Website heißt das „Gespräch
// vereinbaren": ein echter Kalender nach dem Muster der Gründer-Seite /justin
// (E-124), und ein Anfrageformular, wenn keine Zeit frei ist.
//
// ── DER BEFUND DAVOR (technik.txt, 17.09.) ─────────────────────────────────
// Ein Lead über 6.999 € von der Website wäre ein Betreiber-Vermerk mit zwei
// Tagen Frist geworden (fiaon-anfragen.ts), den kein Mitarbeiter sieht — kein
// Termin, keine zuständige Person, kein Eintrag im Firmen-Cockpit.
//
// ── DER EINE WEG (jetzt) ───────────────────────────────────────────────────
//   /business#gespraech
//     → GET  /api/fiaon/global/termine/frei   freie Zeiten der zuständigen Person
//     → POST /api/fiaon/global/termine        Termin (quelle global, herkunft
//                                             global_seite) + Firmenkontakt +
//                                             Firmen-Lead + Bestätigung + Auftrag
//     → POST /api/fiaon/global/anfrage        ohne freie Zeit oder „lieber Anruf":
//                                             Firmen-Lead + Auftrag, fällig heute
//   Dieselbe Anfrage nimmt auch POST /api/fiaon/anfrage mit art „global" an.
//
// ZUSTÄNDIG ist die Person aus fiaon_settings.global_zustaendig_agent_id (die
// Einstellung bedient das Chefbüro; diese Datei liest sie nur). Ist sie leer:
// der aktive Mitarbeiter mit dem Vornamen Daniel — Justin, 17.09.2026: „Daniel
// soll zuständig sein" (Leitung Vertrieb) —, sonst die aktive Vertriebsleitung. Gibt es niemanden, bleibt die Anfrage —
// der Auftrag geht dann an den Betreiber.
//
// ── WAS HIER BEWUSST NICHT PASSIERT ────────────────────────────────────────
//   · Die zuständige Person wird NICHT Betreuer des Firmenkontakts (kein
//     buchungAnwenden) — wie bei /justin. Ein Unternehmen gehört in keinen
//     Privatkunden-Vorrat, keine Hitze-Liste und keine Rückfall-Regel. Seine
//     Akte ist der Firmen-Lead; Kalender und Auftrag führen dorthin.
//   · Keine Mail mit Privatkunden-Wortlaut: keine „Wir haben Sie verpasst"-
//     Mail, keine Einladung zum Startgespräch, keine Nummern-Korrektur (siehe
//     globalTerminErgebnis).
//   · Keine zweite Meldung an die zuständige Person: Der Auftrag (Portal +
//     Mail „Neuer Auftrag für dich") ersetzt die übliche Termin-Meldung.
//
// ── E-476 SCHEIBE 3 (05.11.2026, Entscheidung 1A): DAS ERSTGESPRÄCH FÜHRT JUSTIN ─────
//   · Der KALENDER kommt aus „Gespräche führt“ (global_kalender_agent_id, Vorgabe
//     Justins Konto — server/lib/fiaon-lead-weg.ts); „zustaendig“ = wie oben. Die
//     FIRMA im Cockpit und Daniels Anruf-Auftrag bleiben bei der zuständigen Person.
//   · Deckel: höchstens 3 Lead-Gespräche und 5 Gespräche gesamt (/justin + Leads)
//     je Tag; Startgespräche zahlender Kunden zählen nie mit.
//   · Jede Buchung hängt an ihrer Anfrage (persönlicher Link, sonst Mail/Telefon,
//     60 Tage): Anfrage „termin“, Daniels Auftrag zu. Führt Justin das Gespräch,
//     bekommt er keinen Auftrag, sondern „Termin steht“ (D2) und die Anruf-Karte (D3).
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";
import {
  terminBuchen, stornoLink, verfuegbarkeitVon, ensureHerkunftSpalte, versuchProtokollieren,
  TerminFehler, QUELLEN, berlinDatumText, berlinUhrzeit,
} from "./fiaon-termine";
import {
  globalZeitenRechnen, globalAngebot, globalKalenderDatei, zweitenDeckelAnwenden, GLOBAL_KALENDER_TEXT,
  GLOBAL_DAUER_MIN, GLOBAL_HORIZONT_TAGE, GLOBAL_PRO_TAG,
  type GlobalTag, type GlobalZeitenErgebnis,
} from "./fiaon-global-zeiten";
import { berlinToday } from "./fiaon-time";
import { googleKalenderLink } from "./fiaon-ics";
import { absoluteUrl } from "../fiaon-base-url";
import { globalPaket, globalPreisText } from "@shared/fiaon-global";
import { GLOBAL_TEXTE, globalText } from "@shared/fiaon-global-termin-texte";
// E-476 (05.11.2026): der Platzhalter „Privatperson · <Name>“ aus EINER Konstante — das Lead-Dossier erkennt ihn daran.
import { privatpersonPlatzhalter, firmaBrauchbar } from "@shared/fiaon-global-lead";
// E-476 Scheibe 4 (05.11.2026): die Lead-Mails aus einem Guss — SEINE Sätze in der Bestätigung, die Privatkunden-Weiche.
import { angabenSatz, privatWeiche } from "@shared/fiaon-global-lead-texte";
import { produktkategorie } from "@shared/fiaon-produktkategorie";
import type { EingangsHinweis } from "./fiaon-lead-dossier";
// E-476 Scheibe 3 (05.11.2026): „Gespräche führt“, der Lead-Deckel und der Gesamtdeckel, der persönliche Link.
import {
  LEAD_DECKEL_HERKUENFTE, LEAD_GESPRAECH_HERKUENFTE, zaehltAufLeadDeckel, zaehltAufGesamtDeckel, tagesRest,
  type Einschaetzung,
} from "@shared/fiaon-lead-weg";
import {
  globalKalenderPerson, leadCodeLesen, offeneAnfrageFuer, leadGespraechVerknuepfen, terminStehtAnstossen,
  erzaehltVermerken, kommenderTerminFuerKontakt, type KalenderPerson,
} from "./fiaon-lead-weg";
// E-476 Nachbesserung (Gutachten Sicherheit, Mangel 1): was ein Besucher eintippt, steht nur unschädlich gemacht in einer Mail.
import { escapeHtml } from "./fiaon-html-pdf";

const SETTING_ZUSTAENDIG = "global_zustaendig_agent_id";
/** Nachbesserung (Gutachten Sicherheit, Mangel 7): Buchungen ohne persönlichen Link und ohne passende Anfrage je Berliner Tag. */
export const GLOBAL_OHNE_ANFRAGE_PRO_TAG = 3;
const SETTING_PRO_TAG = "global_termin_pro_tag";
const VORGABE_VORNAME = "daniel";

export const GLOBAL_ZEITZONE = "Europe/Berlin";

// ───────────────────────────────────────────────────────────────────────────
// Wer führt die Gespräche?
// ───────────────────────────────────────────────────────────────────────────

export interface GlobalZustaendig {
  id: number;
  vorname: string;
  name: string;
  email: string | null;
  bild: string | null;
  /** Woher die Wahl kommt — für Protokoll und Chefbüro. */
  wahl: "einstellung" | "vorgabe_daniel" | "vertriebsleitung";
}

function zustaendigAus(a: any, wahl: GlobalZustaendig["wahl"]): GlobalZustaendig {
  const bild = typeof a.avatar === "string" && a.avatar.startsWith("data:image/") ? a.avatar : null;
  return {
    id: Number(a.id), vorname: String(a.vorname || a.name || ""), name: String(a.name || a.vorname || ""),
    email: a.email ?? null, bild, wahl,
  };
}

/**
 * Die zuständige Person für FIAON Global — Gesprächskalender, Anfragen und
 * (für andere Teile von E-188) der Auftrag nach dem Zahlungseingang.
 * `null` heißt: niemand da, der arbeiten kann. Dann gibt es keine Zeiten.
 */
export async function globalZustaendig(): Promise<GlobalZustaendig | null> {
  const [s] = (await sqlPool`
    SELECT value FROM fiaon_settings WHERE key = ${SETTING_ZUSTAENDIG} LIMIT 1
  `.catch(() => [])) as any[];
  const wunsch = Number(s?.value);
  if (Number.isInteger(wunsch) && wunsch > 0) {
    // Eine ausdrückliche Wahl gilt auch für ein Testkonto (Justins Konto ist
    // eines) — gesperrt oder inaktiv darf sie nicht sein.
    const [a] = (await sqlPool`
      SELECT id, COALESCE(NULLIF(first_name, ''), name) AS vorname, name, email, avatar
      FROM fiaon_agents
      WHERE id = ${wunsch} AND active AND zugang_gesperrt_am IS NULL
    `) as any[];
    if (a) return zustaendigAus(a, "einstellung");
    console.warn(`[GLOBAL-TERMIN] ${SETTING_ZUSTAENDIG} = ${wunsch}, aber dieses Konto ist inaktiv oder gesperrt — es gilt die Vorgabe.`);
  }
  const [n] = (await sqlPool`
    SELECT id, COALESCE(NULLIF(first_name, ''), name) AS vorname, name, email, avatar
    FROM fiaon_agents
    WHERE active AND NOT COALESCE(is_test_account, FALSE) AND zugang_gesperrt_am IS NULL
      AND LOWER(COALESCE(NULLIF(first_name, ''), split_part(name, ' ', 1))) = ${VORGABE_VORNAME}
    ORDER BY id LIMIT 1
  `) as any[];
  if (n) return zustaendigAus(n, "vorgabe_daniel");
  const [l] = (await sqlPool`
    SELECT id, COALESCE(NULLIF(first_name, ''), name) AS vorname, name, email, avatar
    FROM fiaon_agents
    WHERE active AND NOT COALESCE(is_test_account, FALSE) AND zugang_gesperrt_am IS NULL
      AND rolle = 'vertriebsleiter'
    ORDER BY id LIMIT 1
  `) as any[];
  return l ? zustaendigAus(l, "vertriebsleitung") : null;
}

async function proTagLesen(): Promise<number> {
  const [z] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = ${SETTING_PRO_TAG} LIMIT 1`.catch(() => [])) as any[];
  const n = Math.round(Number(z?.value));
  return Number.isFinite(n) && n >= 1 && n <= 12 ? n : GLOBAL_PRO_TAG;
}
/** E-273 (02.10.2026): derselbe Tagesdeckel für das Startgespräch eines Individualangebots — eine Einstellung, ein Leser. */
export const globalTerminProTag = proTagLesen;

// ───────────────────────────────────────────────────────────────────────────
// Das Angebot
// ───────────────────────────────────────────────────────────────────────────

export interface GlobalAngebotStand {
  person: GlobalZustaendig | null;
  ergebnis: GlobalZeitenErgebnis;
  tage: GlobalTag[];
  proTag: number;
  /** true = die Oberfläche zeigt das Anfrageformular statt des Kalenders. */
  rueckfall: boolean;
  /** Warum — für das Protokoll und für die, die im Chefbüro nachsehen. */
  grund: "keine_person" | "keine_zeiten" | "ausgebucht" | null;
  /** E-476 Scheibe 3: wer die Gespräche führt und welche Deckel gelten (fehlt nur in alten Prüfständen). */
  kalender?: KalenderPerson;
}

/**
 * Die freien Zeiten für das Erstgespräch. E-476 Scheibe 3 (05.11.2026, Entscheidung 1A): Die Zeiten kommen von der
 * Person aus „Gespräche führt“ (Vorgabe: Justins Konto) — der Global-Kalender ist nie mehr leer, solange Justin Zeiten
 * hat. Es gelten der LEAD-Deckel (Vorgabe 3 je Tag, zählt nur Lead-Gespräche) und der GESAMT-Deckel (Vorgabe 5 je Tag,
 * /justin-Gespräche und Lead-Gespräche zusammen); Startgespräche zahlender Kunden zählen auf keinen der beiden — sie
 * sperren nur ihre eigene Zeit (Gutachten 0, Mangel 2). „Gespräche führt“ = „zustaendig“ → wie vor E-476 (die
 * zuständige Person, global_termin_pro_tag über alle Global-Gespräche).
 */
export async function globalAngebotLaden(tageVoraus = GLOBAL_HORIZONT_TAGE): Promise<GlobalAngebotStand> {
  const leer: GlobalZeitenErgebnis = { frei: [], restJeTag: {}, zeitenGepflegt: false };
  const kalender = await globalKalenderPerson();
  const alt = kalender.modus === "alt";
  const proTag = alt ? await proTagLesen() : kalender.leadProTag;
  const person = kalender.person;
  if (!person) return { person: null, ergebnis: leer, tage: [], proTag, rueckfall: true, grund: "keine_person", kalender };

  const fenster = await verfuegbarkeitVon(person.id);
  // Dieselbe Belegungsregel wie rohSlots (25.08.2026): Eine Absage des
  // MITARBEITERS sperrt die Zeit — er hat abgesagt, weil er dann nicht kann.
  const termine = (await sqlPool`
    SELECT beginn, COALESCE(dauer_min, 20) AS dauer_min, quelle, status, herkunft,
           (beginn AT TIME ZONE 'Europe/Berlin')::date::text AS tag
    FROM fiaon_termine
    WHERE agent_id = ${person.id}
      AND (status IN ('gebucht', 'erledigt', 'verpasst') OR (status = 'abgesagt' AND abgesagt_von = 'agent'))
      AND beginn > NOW() - INTERVAL '1 day' AND beginn < NOW() + INTERVAL '16 days'
  `) as { beginn: Date; dauer_min: number; quelle: string; status: string; herkunft: string | null; tag: string }[];

  let ergebnis = globalZeitenRechnen({
    jetzt: new Date(),
    fenster,
    belegt: termine.map((t) => ({
      beginn: t.beginn, dauerMin: Number(t.dauer_min),
      zaehltAlsGlobal: alt ? t.quelle === "global" && t.status !== "abgesagt" : zaehltAufLeadDeckel(t),
    })),
    tage: tageVoraus,
    proTag,
  });
  if (!alt) {
    const gesamtJeTag: Record<string, number> = {};
    for (const t of termine) if (zaehltAufGesamtDeckel(t)) gesamtJeTag[t.tag] = (gesamtJeTag[t.tag] ?? 0) + 1;
    const restZwei: Record<string, number> = {};
    for (const tag of Object.keys(ergebnis.restJeTag)) restZwei[tag] = kalender.gesamtProTag - (gesamtJeTag[tag] ?? 0);
    ergebnis = zweitenDeckelAnwenden(ergebnis, restZwei);
  }
  const tage = globalAngebot(ergebnis);
  return {
    person, ergebnis, tage, proTag,
    rueckfall: tage.length === 0,
    grund: !ergebnis.zeitenGepflegt ? "keine_zeiten" : tage.length === 0 ? "ausgebucht" : null,
    kalender,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Eingaben — ein Leser für Buchung und Anfrage
// ───────────────────────────────────────────────────────────────────────────

export interface GlobalKontakt {
  name: string; vorname: string | null; nachname: string | null;
  firma: string; email: string; telefon: string;
  paket: string | null; paketText: string | null;
  land: string | null; sprache: "de" | "en";
}

export type GlobalFeldFehler = { error: string; feld: string };

const LAND_TEXT: Record<string, string> = { DE: "Deutschland", AT: "Österreich", CH: "Schweiz" };

/** Titel und Anreden gehören nicht in den Vornamen. */
function nameTeilen(name: string): { vorname: string | null; nachname: string | null } {
  const teile = name.replace(/\b(herrn?|frau|dr\.?|prof\.?|mr\.?|mrs\.?|ms\.?)(?=\s)/gi, " ").trim().split(/\s+/).filter(Boolean);
  if (teile.length === 0) return { vorname: null, nachname: null };
  if (teile.length === 1) return { vorname: null, nachname: teile[0] };
  return { vorname: teile[0], nachname: teile.slice(1).join(" ") };
}

export function globalKontaktLesen(b: any): GlobalKontakt | GlobalFeldFehler {
  const en = String(b?.sprache ?? "").toLowerCase().startsWith("en");
  const T = en ? GLOBAL_TEXTE.en : GLOBAL_TEXTE.de;
  // E-476 Nachbesserung (Gutachten Sicherheit, Mangel 1): Name und Firma ohne < > " (sie landen in Mails und im Cockpit), die
  // Nummer nur aus Ziffern, Leerzeichen und + ( ) - / — ein öffentliches Formular darf keinen Code in unsere Mails tragen.
  const name = String(b?.name ?? "").replace(/[<>"]/g, "").replace(/\s+/g, " ").trim().slice(0, 160);
  // 19.09.2026 (Justin): Auch Privatpersonen — und Unternehmer, die privat buchen —
  // können FIAON Global beauftragen. Ohne Firma heißt der Lead „Privatperson · Name",
  // damit das Team im Firmen-Cockpit sofort sieht, wer anfragt.
  const firmaRoh = String(b?.firma ?? "").replace(/[<>"]/g, "").replace(/\s+/g, " ").trim().slice(0, 200);
  const email = String(b?.email ?? "").trim().toLowerCase().slice(0, 160);
  const telefon = String(b?.telefon ?? "").replace(/[^\d\s+()\/-]/g, "").replace(/\s+/g, " ").trim().slice(0, 40);
  if (name.length < 2) return { feld: "name", error: T.fehlerName };
  const firma = firmaRoh.length >= 2 ? firmaRoh : privatpersonPlatzhalter(name, en ? "en" : "de");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { feld: "email", error: T.fehlerEmail };
  if (telefon.replace(/\D/g, "").length < 6) return { feld: "telefon", error: T.fehlerTelefon };
  // Ein unbekanntes Paket ist kein Fehler des Menschen: Der Wunsch bleibt
  // dann leer, das Gespräch findet trotzdem statt.
  const g = globalPaket(b?.paket);
  const landRoh = String(b?.land ?? "").trim().slice(0, 40);
  const land = landRoh ? (LAND_TEXT[landRoh.toUpperCase()] ?? landRoh) : null;
  return {
    name, ...nameTeilen(name), firma, email, telefon,
    paket: g?.key ?? null,
    paketText: g ? `${g.de.name} (${globalPreisText(g.key)})` : null,
    land, sprache: en ? "en" : "de",
  };
}

// ── Bremse: drei Versuche je Adresse in 15 Minuten, einer je E-Mail je Minute ──
// (Muster der Gründer-Seite.) Im Arbeitsspeicher, mit Absicht: Sie soll den
// Doppelklick und das Skript bremsen, nicht Buch führen.
const jeIp = new Map<string, number[]>();
const jeMail = new Map<string, number>();

export function globalZuViel(ip: string, email: string): boolean {
  const jetzt = Date.now();
  const liste = (jeIp.get(ip) ?? []).filter((z) => jetzt - z < 15 * 60_000);
  if (liste.length >= 3) return true;
  if (jetzt - (jeMail.get(email) ?? 0) < 60_000) return true;
  liste.push(jetzt); jeIp.set(ip, liste); jeMail.set(email, jetzt);
  return false;
}

// ───────────────────────────────────────────────────────────────────────────
// Buchen
// ───────────────────────────────────────────────────────────────────────────

export type GlobalBuchungErgebnis =
  | { ok: true; terminId: number; wann: string; datumText: string; uhrzeit: string; ansprechpartner: { vorname: string }; kalenderUrl: string; anfrageId?: number | null }
  | { ok: false; status: number; grund: string; error: string; feld?: string; angebot?: GlobalAngebotStand };

/** Die Kalenderdatei des Gesprächs. `en` hängt ?sprache=en an — die Datei ist dann englisch (Gegenprüfung E-263). */
export function globalKalenderUrl(stornoToken: string, sprache?: "de" | "en"): string {
  return absoluteUrl(`/api/fiaon/global/termine/kalender/${stornoToken}.ics${sprache === "en" ? "?sprache=en" : ""}`);
}

export async function globalTerminBuchen(ein: {
  kontakt: GlobalKontakt; tag: string; zeit: string; thema: string | null;
  /**
   * E-476 Scheibe 3: der persönliche Link (Code aus dem Cookie der Seite) — die Buchung hängt an DIESER Anfrage, auch
   * wenn der Lead eine andere Mail eintippt. Ein abgelaufener oder fremder Code zählt nicht (normale Buchung).
   */
  code?: string | null;
  /**
   * E-476 Scheibe 3: der Cockpit-Knopf „Termin bei Justin eintragen“ — wer im Gespräch einträgt, was der Lead selbst
   * erzählt hat (Pflicht) und die Firma im Cockpit.
   */
  durch?: { agentId: number; name: string; erzaehlt: string; einschaetzung: Einschaetzung; firmaId: number | null } | null;
}): Promise<GlobalBuchungErgebnis> {
  const k = ein.kontakt;
  const en = k.sprache === "en";
  const T = en ? GLOBAL_TEXTE.en : GLOBAL_TEXTE.de;

  const angebot = await globalAngebotLaden();
  if (!angebot.person) {
    return { ok: false, status: 409, grund: "kein_angebot", angebot, error: T.keinAngebot };
  }
  const person = angebot.person;
  const kalender = angebot.kalender ?? null;
  const alt = !kalender || kalender.modus === "alt";
  const slot = angebot.ergebnis.frei.find((f) => f.tag === ein.tag && f.zeit === ein.zeit);
  if (!slot) {
    await versuchProtokollieren({ ergebnis: "abgelehnt", grund: "nicht_angeboten", agentId: person.id, quelle: "global", akteur: ein.durch ? "agent" : "kunde" });
    return { ok: false, status: 409, grund: "nicht_angeboten", angebot, feld: "zeit",
      error: angebot.tage.length ? T.zeitVergeben : T.zeitVergebenKeineWeitere };
  }

  // E-476 Scheibe 3: zu welcher Anfrage gehört diese Buchung? Mit Link die Anfrage des Links; sonst eine Anfrage der
  // letzten 60 Tage mit derselben Mail ODER Nummer (Gutachten 0, Mangel 17). Nur Lesen, jede Störung = keine Zuordnung —
  // die Buchung hängt nie daran.
  const ausLink = ein.code ? await leadCodeLesen(ein.code, { schema: false }).catch(() => null) : null;
  const lead = ausLink
    ? { anfrageId: ausLink.anfrageId, firmaId: ausLink.firmaId }
    : await offeneAnfrageFuer(k.email, k.telefon).catch(() => null);
  const firmaIdBekannt = ein.durch?.firmaId ?? lead?.firmaId ?? null;
  const herkunft = ein.durch ? "agent_global" : ausLink ? "global_link" : "global_seite";

  // Der Firmenkontakt: bekannt über E-Mail oder Telefon, sonst neu — ohne Betreuer.
  const { personFuerZeile } = await import("../fiaon-person-model");
  const zu = await personFuerZeile({
    emails: [k.email],
    phones: [k.telefon],
    stammdaten: {
      kind: "business", first_name: k.vorname, last_name: k.nachname, company_name: k.firma,
      contact_name: k.name, primary_email: k.email, primary_phone: k.telefon, country: k.land,
    },
    quelle: ein.durch ? "global-cockpit" : "global-seite",
    firstSeenAt: new Date(),
  });
  if (!zu) return { ok: false, status: 400, grund: "eingabe", feld: "email", error: T.fehlerEmail };

  // Hat er schon ein kommendes Gespräch? Nachbesserung (Gutachten Betreiber, Mangel 1): auch über /justin (Quelle „gruender“)
  // und über Mail oder Nummer — eine alte /justin-Buchung hängt an einer eigenen Privat-Person.
  const schonGebucht = async (lauf: any = sqlPool): Promise<{ beginn: Date } | null> => {
    const [schon] = (await lauf`
      SELECT id, beginn FROM fiaon_termine
      WHERE person_id = ${zu.personId} AND quelle IN ('global', 'gruender') AND status = 'gebucht' AND beginn > NOW()
      ORDER BY beginn LIMIT 1
    `) as any[];
    if (schon) return { beginn: schon.beginn };
    // E-476: Hat DIESE Anfrage schon ein kommendes Gespräch (z. B. mit anderer Mail gebucht)? Dann kein zweites.
    // In der Transaktion in einem Sicherungspunkt: fehlt die Tabelle (alter Prüfstand), bricht das nie die Buchung ab.
    const leadAbfrage = (q: any) => q`
      SELECT t.id, t.beginn FROM fiaon_lead_gespraech g JOIN fiaon_termine t ON t.id = g.termin_id
       WHERE g.anfrage_id = ${lead!.anfrageId} AND t.status = 'gebucht' AND t.beginn > NOW()
       ORDER BY t.beginn LIMIT 1`;
    const [schonLead] = lead?.anfrageId
      ? ((await (typeof lauf.savepoint === "function" ? lauf.savepoint((sp: any) => leadAbfrage(sp)) : leadAbfrage(lauf)).catch(() => [])) as any[])
      : [];
    if (schonLead) return { beginn: schonLead.beginn };
    const kontakt = await kommenderTerminFuerKontakt(k.email, k.telefon, lauf).catch(() => null);
    return kontakt ? { beginn: kontakt.beginn } : null;
  };
  // Nachbesserung (Gutachten Sicherheit, Mangel 11): Datum und Uhrzeit nur, wenn der persönliche Link (oder das Cockpit) die
  // Zuordnung trägt — sonst wäre die Seite ein Orakel „hat diese Nummer ein Gespräch mit Justin, und wann?“.
  const schonFehler = (v: { beginn: Date }): GlobalBuchungErgebnis => ({
    ok: false, status: 409, grund: "schon_gebucht", angebot,
    error: ausLink || ein.durch ? globalText(T.schonGebucht, { datum: berlinDatumText(v.beginn), uhrzeit: berlinUhrzeit(v.beginn) }) : T.schonGebuchtNeutral,
  });
  const vorhanden = await schonGebucht();
  if (vorhanden) return schonFehler(vorhanden);

  // Nachbesserung (Gutachten Sicherheit, Mangel 7): Buchungen OHNE persönlichen Link und OHNE passende Anfrage höchstens drei
  // am Tag — sonst ließe sich Justins Kalender mit erfundenen Kontakten verstopfen. Darüber: „Anfrage senden“ (Rückfall).
  if (!ausLink && !lead && !ein.durch) {
    const [ohne] = (await sqlPool`
      SELECT COUNT(*)::int AS n FROM fiaon_termine t
       WHERE t.quelle = 'global' AND COALESCE(t.herkunft, '') = 'global_seite'
         AND (t.created_at AT TIME ZONE 'Europe/Berlin')::date = (NOW() AT TIME ZONE 'Europe/Berlin')::date
         AND NOT EXISTS (SELECT 1 FROM fiaon_lead_gespraech g WHERE g.termin_id = t.id AND g.anfrage_id IS NOT NULL)`.catch(() => [{ n: 0 }])) as any[];
    if (Number(ohne?.n) >= GLOBAL_OHNE_ANFRAGE_PRO_TAG) {
      await versuchProtokollieren({ ergebnis: "abgelehnt", grund: "tagesdeckel_ohne_anfrage", agentId: person.id, quelle: "global", akteur: "kunde" });
      return { ok: false, status: 409, grund: "online_voll", feld: "zeit", angebot: { ...angebot, tage: [], rueckfall: true }, error: T.onlineVoll };
    }
  }

  // ── ATOMAR: EINE ZEIT, EIN GESPRÄCH — UND HÖCHSTENS DER TAGESDECKEL ───────
  // Die doppelte Zeit verhindert die Datenbank (eindeutiger Index auf
  // agent + beginn, dazu die Überschneidungs-Sperre) — zwei Anfragen in
  // derselben Millisekunde kommen durch jede Prüfung im Code, aber nur eine
  // durch den Index. Den TAGESDECKEL kennt kein Index: Zwei Buchungen auf
  // VERSCHIEDENE Zeiten desselben Tages würden beide „noch ein Platz" lesen.
  // Deshalb eine Transaktion mit einer Sperre je Person und Tag; die zweite
  // wartet, zählt neu und wird sauber abgewiesen. E-476 Scheibe 3: dieselbe
  // Sperre nehmen das Startgespräch und die /justin-Weiche — im neuen Modus
  // zählen hier Lead-Deckel UND Gesamtdeckel (tagesRest).
  //
  // `ensureHerkunftSpalte` VOR der Transaktion: Beim ersten Aufruf nach einem
  // Serverstart will sie ein ALTER TABLE — das stellte sich sonst hinter die
  // Lesesperre dieser Transaktion und gäbe nach drei Sekunden auf.
  await ensureHerkunftSpalte();
  let buchung;
  let schonInTx: { beginn: Date } | null = null;
  try {
    buchung = await sqlPool.begin(async (tx: any) => {
      // Nachbesserung (Gutachten Technik, Mangel 6): zuerst die Sperre je LEAD (Anfrage, sonst Person) — zwei gleichzeitige
      // Buchungen desselben Leads (Cockpit + eigener Link, zwei Tabs) laufen nacheinander, die zweite sieht die erste.
      await tx`SELECT pg_advisory_xact_lock(hashtext(${`global-lead:${lead?.anfrageId ?? `p${zu.personId}`}`}))`;
      const nochmal = await schonGebucht(tx);
      if (nochmal) { schonInTx = nochmal; throw new TerminFehler("schon_gebucht", "Er hat schon ein Gespräch."); }
      await tx`SELECT pg_advisory_xact_lock(hashtext(${`global-termin:${person.id}:${slot.tag}`}))`;
      if (alt) {
        const [z] = (await tx`
          SELECT COUNT(*)::int AS n FROM fiaon_termine
          WHERE agent_id = ${person.id} AND quelle = 'global' AND status IN ('gebucht', 'erledigt', 'verpasst')
            AND (beginn AT TIME ZONE 'Europe/Berlin')::date = ${slot.tag}::date
        `) as any[];
        if (Number(z?.n ?? 0) >= angebot.proTag) {
          throw new TerminFehler("tag_voll", "An diesem Tag sind alle Gespräche vergeben.");
        }
      } else {
        const [z] = (await tx`
          SELECT COUNT(*) FILTER (WHERE quelle = 'global' AND COALESCE(herkunft, '') = ANY(${LEAD_DECKEL_HERKUENFTE as unknown as string[]}))::int AS lead,
                 COUNT(*) FILTER (WHERE quelle = 'gruender' OR (quelle = 'global' AND COALESCE(herkunft, '') = ANY(${LEAD_GESPRAECH_HERKUENFTE as unknown as string[]})))::int AS gesamt
            FROM fiaon_termine
           WHERE agent_id = ${person.id} AND status IN ('gebucht', 'erledigt', 'verpasst')
             AND (beginn AT TIME ZONE 'Europe/Berlin')::date = ${slot.tag}::date
        `) as any[];
        if (tagesRest({ leadProTag: kalender!.leadProTag, gesamtProTag: kalender!.gesamtProTag, leadGebucht: Number(z?.lead ?? 0), gesamtGebucht: Number(z?.gesamt ?? 0) }) <= 0) {
          throw new TerminFehler("tag_voll", "An diesem Tag sind alle Gespräche vergeben.");
        }
      }
      const neu = await terminBuchen({
        personId: zu.personId, agentId: person.id, beginn: slot.beginn,
        quelle: "global", herkunft,
      }, tx);
      // Die Zeile des Lead-Gesprächs gleich mit (in einem Sicherungspunkt — fehlt die Tabelle, bleibt der Termin trotzdem): so
      // sieht eine zweite Buchung derselben Anfrage sie sofort, und „Termin steht“ hängt nie an einem späteren Schritt.
      if (lead?.anfrageId || ein.durch) {
        await tx.savepoint(async (sp: any) => sp`
          INSERT INTO fiaon_lead_gespraech (termin_id, anfrage_id, firma_id, person_id, weg, eingetragen_von, erzaehlt, einschaetzung)
          VALUES (${neu.id}, ${lead?.anfrageId ?? null}, ${firmaIdBekannt}, ${zu.personId}, ${ein.durch ? "agent" : ausLink ? "link" : "seite"},
                  ${ein.durch?.name ?? null}, ${ein.durch?.erzaehlt ?? null}, ${ein.durch?.einschaetzung ?? null})
          ON CONFLICT (termin_id) DO NOTHING`).catch(() => {});
      }
      return neu;
    });
  } catch (err) {
    if (err instanceof TerminFehler && err.code === "schon_gebucht" && schonInTx) return schonFehler(schonInTx);
    if (err instanceof TerminFehler) {
      // „belegt", „tag_voll" und die Zeitgrenzen sind der Alltag zweier
      // gleichzeitiger Klicks. Alles andere (falsche_rolle, agent_unbekannt)
      // heißt: Die zuständige Person KANN keine Gespräche annehmen — das muss
      // jemand sehen, sonst weist der Kalender still jede Buchung ab.
      if (!["belegt", "tag_voll", "zu_frueh", "zu_spaet", "kein_slot", "vergangenheit"].includes(err.code)) {
        console.error(`[GLOBAL-TERMIN] ${person.name} (#${person.id}) kann kein Erstgespräch annehmen — ${err.code}: ${err.message}. Bitte ${SETTING_ZUSTAENDIG} prüfen.`);
      }
      await versuchProtokollieren({ ergebnis: "abgelehnt", grund: err.code, personId: zu.personId, slotBeginn: slot.beginn, agentId: person.id, quelle: "global", akteur: ein.durch ? "agent" : "kunde" });
      const frisch = await globalAngebotLaden();
      return { ok: false, status: 409, grund: err.code, feld: "zeit", angebot: frisch,
        error: frisch.tage.length ? T.zeitVergeben : T.zeitVergebenKeineWeitere };
    }
    throw err;
  }
  await versuchProtokollieren({ ergebnis: "gebucht", personId: zu.personId, slotBeginn: slot.beginn, agentId: person.id, quelle: "global", akteur: ein.durch ? "agent" : "kunde" });

  // Ab hier steht der Termin. Nichts Folgendes darf ihn wieder kippen — jede
  // Stufe fängt ihren eigenen Fehler und schreibt ihn hin.
  const wegZeile = ein.durch
    ? `Eingetragen im Gespräch von ${ein.durch.name} (Firmen-Cockpit).`
    : ausLink
      ? `Gebucht über den persönlichen Link (Anfrage #${ausLink.anfrageId})${k.email !== ausLink.email.toLowerCase() ? ` — angegeben: ${k.email}` : ""}.`
      : `Gebucht über fiaon.com (${zu.angelegt ? "neuer Kontakt" : "bekannte Person"})${lead?.anfrageId ? ` — gehört zu Anfrage #${lead.anfrageId}` : ""}.`;
  const notiz = [
    `Firma: ${k.firma}`,
    `Ansprechpartner: ${k.name} · ${k.telefon} · ${k.email}`,
    k.paketText ? `Paketwunsch: ${k.paketText}` : "Paketwunsch: noch offen",
    k.land ? `Land: ${k.land}` : "",
    en ? "Sprache: Englisch" : "",
    ein.thema ? `Thema: ${ein.thema}` : "",
    ein.durch ? `Was er selbst erzählt hat (${ein.durch.name}): ${ein.durch.erzaehlt}` : "",
    wegZeile,
  ].filter(Boolean).join("\n");
  await sqlPool`UPDATE fiaon_termine SET notiz = ${notiz}, updated_at = NOW() WHERE id = ${buchung.id}`
    .catch((e) => console.error(`[GLOBAL-TERMIN] Notiz an Termin ${buchung.id} nicht geschrieben:`, e));

  // Der Firmen-Lead — ganz oben im Cockpit. E-476 Scheibe 3 (Gutachten 0, Mangel 15): Kalender-Person und
  // Lead-Zuständige sind getrennt — die Firma bleibt bei der zuständigen Person (heute Daniel), nur der Termin liegt bei
  // der Person aus „Gespräche führt“. Mit Link oder Zuordnung hängt die Buchung an DER Firma der Anfrage.
  let firmaId: number | null = firmaIdBekannt;
  const zustaendig = alt ? person : (await globalZustaendig().catch(() => null)) ?? person;
  try {
    const { globalLeadAufnehmen } = await import("../routes/fiaon-firmen");
    const firmaLead = await globalLeadAufnehmen({
      firma: k.firma, ansprechpartner: k.name, telefon: k.telefon, email: k.email, land: k.land,
      paketwunsch: k.paketText, personId: zu.personId, zustaendigAgentId: zustaendig.id,
      status: "termin", ereignis: "termin_gebucht", firmaId: firmaIdBekannt,
      verlauf: `Erstgespräch gebucht: ${buchung.datumText} um ${buchung.uhrzeit} Uhr mit ${person.name}`
        + `${ein.durch ? ` — eingetragen von ${ein.durch.name}` : ausLink ? " — über seinen persönlichen Link" : ""}. `
        + `Paketwunsch: ${k.paketText ?? "noch offen"}.${ein.thema ? ` Thema: ${ein.thema}.` : ""}${en ? " Sprache: Englisch." : ""}`,
    });
    firmaId = firmaLead.firmaId;
  } catch (e) {
    console.error(`[GLOBAL-TERMIN] Termin ${buchung.id} steht, aber der Firmen-Lead fehlt — ${k.firma} erscheint NICHT im Firmen-Cockpit:`, e);
  }
  if (ein.durch) await erzaehltVermerken(firmaId, ein.durch.erzaehlt, { id: ein.durch.agentId, name: ein.durch.name });

  // Ist der Kontakt zugleich Kunde, erfährt es auch dessen Akte.
  const [akte] = (await sqlPool`
    SELECT ref FROM fiaon_applications WHERE person_id = ${zu.personId} AND merged_into IS NULL
    ORDER BY created_at DESC LIMIT 1
  `.catch(() => [])) as any[];
  if (akte?.ref) {
    await sqlPool`
      INSERT INTO fiaon_contact_log (person_id, ref, agent_id, agent_name, type, note)
      VALUES (${zu.personId}, ${akte.ref}, NULL, 'System', 'system',
              ${`Erstgespräch zu FIAON Global gebucht über fiaon.com/business: ${buchung.datumText} um ${buchung.uhrzeit} Uhr mit ${person.name} (${k.firma}).`})
    `.catch(() => {});
  }

  // Die Bestätigung an das Unternehmen — über die eine Tür, mit Protokoll. E-476 Scheibe 4: mit SEINEN Sätzen aus dem
  // Formular (Sie-Form, ohne Betrag) statt einer Klammer; nur Lesen, eine Störung = ohne den Absatz.
  const angaben = lead?.anfrageId
    ? await import("./fiaon-global-lead-post").then((m) => m.antwortenDerAnfrage(lead.anfrageId)).then((a) => angabenSatz(a, k.sprache === "en" ? "en" : "de")).catch(() => "")
    : "";
  const { versendenUndProtokollieren } = await import("./fiaon-mail-log");
  await versendenUndProtokollieren(
    "global_termin",
    globalTerminPayload({
      email: k.email, name: k.name, firma: k.firma, telefon: k.telefon, paketText: k.paketText,
      ansprechpartner: person.name, datumText: buchung.datumText, uhrzeit: buchung.uhrzeit,
      stornoToken: buchung.stornoToken,
      sprache: k.sprache, beginn: buchung.beginn, paket: k.paket, angabenSatz: angaben, lead: true,
    }) as any,
    {
      personId: zu.personId, verlaufRef: akte?.ref ?? null,
      verlaufText: `Terminbestätigung (FIAON Global, Erstgespräch) versandt: ${buchung.datumText} um ${buchung.uhrzeit} Uhr.`,
      ...(ein.durch ? { ausgeloestVon: ein.durch.name, ausgeloestAgentId: ein.durch.agentId } : {}),
    },
  ).catch((e) => console.error("[GLOBAL-TERMIN] Bestätigung:", e));

  // E-476 Scheibe 3: das Lead-Gespräch an seiner Anfrage — Anfrage auf „termin“, Daniels Auftrag schließt sich selbst.
  // Nachbesserung (Gutachten Technik, Mangel 7): angestoßen, NIE abgewartet und ohne Tabellen-Anweisung — die Buchung ist ein
  // Eingang und wartet nur noch auf die Bestätigung. Die Zeile in fiaon_lead_gespraech steht schon (Transaktion oben);
  // danach zieht der EINE Stand Anfrage und Anruf-Aufträge nach (auch den Rückruf der Vertretung).
  const wegArt = ein.durch ? "agent" : ausLink ? "link" : "seite";
  void leadGespraechVerknuepfen({
    terminId: buchung.id, anfrageId: lead?.anfrageId ?? null, firmaId, personId: zu.personId, weg: wegArt,
    eingetragenVon: ein.durch?.name ?? null, erzaehlt: ein.durch?.erzaehlt ?? null, einschaetzung: ein.durch?.einschaetzung ?? null,
    beginn: buchung.beginn, schema: false,
  }).then(async () => {
    if (lead?.anfrageId || firmaId) {
      const m = await import("../routes/fiaon-firmen");
      await m.globalLeadStandSetzen({ firmaId, anfrageId: lead?.anfrageId ?? null, ereignis: "termin_gebucht", wer: ein.durch ? { id: ein.durch.agentId, name: ein.durch.name } : null });
    }
  }).catch((e) => console.error(`[GLOBAL-TERMIN] Lead-Gespräch/Stand zu Termin ${buchung.id} nicht nachgezogen:`, e));

  // Der Auftrag an die Person, die das Gespräch führt (E-177-Muster): Portal + Mail. E-476 Scheibe 3: NICHT, wenn Justin
  // das Gespräch führt — er bekommt keine Aufgabe, sondern „Termin steht“ (D2) im Faden des Leads und 60 Minuten
  // vorher die Anruf-Karte (D3). Ohne Anfrage und ohne Cockpit-Eintrag trägt das Lead-Dossier der Buchung die Meldung.
  const justin = kalender?.modus === "justin";
  if (!justin) {
    try {
      const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
      await auftragFuerKunden({
        personId: null, ref: null,
        titel: `FIAON Global: Erstgespräch ${k.firma} am ${buchung.datumText}, ${buchung.uhrzeit} Uhr`,
        text: [
          `Erstgespräch zu FIAON Global, ${ein.durch ? `eingetragen von ${ein.durch.name}` : "gebucht über den Kalender auf fiaon.com"}.`,
          `Wann: ${buchung.datumText} um ${buchung.uhrzeit} Uhr, ${GLOBAL_DAUER_MIN} Minuten — du rufst an.`,
          `Firma: ${k.firma} · Ansprechpartner: ${k.name}`,
          `Telefon: ${k.telefon} · E-Mail: ${k.email}`,
          `Paketwunsch: ${k.paketText ?? "noch offen"}${k.land ? ` · Land: ${k.land}` : ""}${en ? " · Gespräch auf ENGLISCH" : ""}`,
          ein.thema ? `Thema: ${ein.thema}` : null,
          ein.durch ? `Was er selbst erzählt hat: ${ein.durch.erzaehlt}` : null,
          "\nDer Termin steht in deinem Kalender, die Firma ganz oben im Firmen-Cockpit. Nach dem Gespräch: Termin im Kalender abschließen und im Cockpit festhalten, wie es weitergeht.",
        ].filter(Boolean).join("\n"),
        faelligAm: slot.tag,
        schluessel: `global-termin:${buchung.id}`,
        bereich: "sonstiges",
        link: firmaId ? `/agent/firmen?firma=${firmaId}` : "/agent/kalender",
        quelle: "website",
        autorName: ein.durch?.name ?? "Website",
        agentId: person.id,
        anlageText: "Erstgespräch über den Gesprächskalender auf fiaon.com/business gebucht.",
        // E-476 Scheibe 5 (Entscheidung 3A): führt die zuständige Person das Gespräch, geht die Meldung an „Lead-Meldungen an“.
        meldung: await import("./fiaon-lead-takt").then((m) => m.leadAuftragMeldung()).catch(() => null),
      });
      await sqlPool`UPDATE fiaon_termine SET gemeldet_buchung_am = NOW() WHERE id = ${buchung.id}`.catch(() => {});
    } catch (e) {
      console.error(`[GLOBAL-TERMIN] Auftrag zu Termin ${buchung.id} nicht angelegt — ${person.name} sieht das Gespräch nur im Kalender:`, e);
    }
  }

  console.log(`[GLOBAL-TERMIN] #${buchung.id}: ${k.firma} (${k.email}) am ${buchung.datumText} ${buchung.uhrzeit} bei ${person.name}${k.paket ? ` — ${k.paket}` : ""}`
    + ` · ${herkunft}${lead?.anfrageId ? ` · Anfrage #${lead.anfrageId}` : ""}`);
  // Ohne Dossier (Schalter aus) trägt D2 die Meldung auch bei einer Buchung ohne Anfrage.
  const dossierAn = justin && !lead?.anfrageId && !ein.durch
    ? await import("./fiaon-lead-dossier").then((m) => m.dossierEinstellungen()).then((e) => e.an).catch(() => true)
    : true;
  if (justin && (lead?.anfrageId || ein.durch || !dossierAn)) {
    // D2 „Termin steht“ an Justin — angestoßen, nie abgewartet; nur im Betrieb. Der Lauf global_gespraeche holt nach.
    terminStehtAnstossen(buchung.id);
  } else {
    // E-476 (Gutachten 0, Mangel 3): Wer selbst bucht, ohne vorher angefragt zu haben, ist der heißeste Lead — er
    // bekommt sein Dossier an Justin (es trägt „Termin steht“). Angestoßen, nie abgewartet; nur im Betrieb (CRONS_AN).
    if (justin) {
      await sqlPool`UPDATE fiaon_lead_gespraech SET d2_am = NOW(), d2_id = 'dossier' WHERE termin_id = ${buchung.id} AND d2_am IS NULL`.catch(() => {});
    }
    void import("./fiaon-lead-dossier")
      .then((m) => m.leadDossierAnstossen({ anlass: "termin", anlassId: buchung.id, firmaId, personId: zu.personId, hinweis: { kanal: "buchung" } }))
      .catch((e) => console.error(`[GLOBAL-TERMIN] Lead-Dossier zu Termin ${buchung.id} nicht angestoßen:`, e));
  }
  return {
    ok: true, terminId: buchung.id, wann: buchung.beginn, datumText: buchung.datumText, uhrzeit: buchung.uhrzeit,
    ansprechpartner: { vorname: person.vorname }, kalenderUrl: globalKalenderUrl(buchung.stornoToken, k.sprache),
    // E-487 (09.11.2026): die Anfrage dieser Buchung (Link oder offene Anfrage) — das Ja zu WhatsApp hängt sich daran.
    anfrageId: lead?.anfrageId ?? null,
  };
}

/**
 * Die Nutzlast der Bestätigung. Eine Funktion, damit das Prüfskript dieselbe
 * Mail rendert, die rausgeht. `?anrede=sie` am Storno-Link: Die Absage-Seite
 * duzt Privatkunden — ein Unternehmen liest dort die Sie-Fassung.
 */
export function globalTerminPayload(ein: {
  email: string; name: string; firma: string; telefon: string; paketText: string | null;
  ansprechpartner: string; datumText: string; uhrzeit: string; stornoToken: string;
  /** Querschnitt 17.09.2026: Wer auf /en/business gebucht hat, bekommt die englische Bestätigung. */
  sprache?: "de" | "en"; beginn?: string | Date | null; paket?: string | null;
  /**
   * E-476 Scheibe 4 (Gutachten 1, Mangel 7/8): „Ihre Angaben liegen uns vor.“ mit SEINEN Sätzen (Sie-Form, ohne Betrag) —
   * aus angabenSatz (shared/fiaon-global-lead-texte.ts). Leer = der Absatz entfällt.
   */
  angabenSatz?: string | null;
  /**
   * Nachbesserung (Gutachten Technik, Mangel 9): Antworten an Justin (js@) nur bei einem LEAD-Gespräch — das Startgespräch
   * zahlender Kunden antwortet weiter an welcome@ (Mara kennt ihre Fragen).
   */
  lead?: boolean;
}): Record<string, string> {
  // E-476 Scheibe 4: Ein hauseigener Platzhalter („Privatperson · …“, „… (Firma noch offen)“) ist kein Unternehmen — dann
  // entfällt die Zeile „Unternehmen“ (wahlweise im Datenkasten), statt den Platzhalter vorzulesen.
  // Nachbesserung (Gutachten Sicherheit, Mangel 1, KRITISCH): Der Motor setzt {{params.*}} roh ein — alles, was ein Besucher
  // eintippt (Name, Firma, Telefon, Paket, Ansprechpartner), geht deshalb HIER unschädlich gemacht hinein. Ein fremder Link
  // aus dem Namensfeld wird nie klickbar in einer Mail von „FIAON Global“.
  const firma = firmaBrauchbar(ein.firma, ein.name).brauchbar ? escapeHtml(ein.firma) : "";
  const angaben = String(ein.angabenSatz ?? "").trim();
  const antwortAn: Record<string, string> = ein.lead ? { antwort_an: "js@fiaon.com" } : {};
  if (ein.sprache === "en") {
    const g = globalPaket(ein.paket);
    const wann = ein.beginn ? new Date(ein.beginn) : null;
    return {
      email: ein.email, sprache: "en", ...antwortAn,
      name: escapeHtml(ein.name), firma, telefon: escapeHtml(ein.telefon),
      // E-476 Scheibe 4: ohne Paketwunsch keine Zeile „still open“ (Gutachten 0, Mangel 19) — der Motor lässt sie weg.
      paket: g ? `FIAON ${g.en.name}` : "",
      ...(angaben ? { angaben_satz: angaben } : {}),
      agent_vorname: escapeHtml(ein.ansprechpartner),
      // Das Datum im englischen Zahlenbild, in deutscher Zeit — der Anruf kommt aus Deutschland.
      termin_datum: wann && !Number.isNaN(wann.getTime())
        ? wann.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Berlin" })
        : ein.datumText,
      termin_uhrzeit: ein.uhrzeit,
      termin_art: "First call, FIAON Global",
      termin_dauer: String(GLOBAL_DAUER_MIN),
      // ?bereich=business: Die Absage-Seite trägt Kopf und Fuß von FIAON Global, nicht die der Privatkunden (19.09.2026).
      storno_link: `${stornoLink(ein.stornoToken)}?anrede=sie&bereich=business`,
      // Gegenprüfung E-263: Datei und Google-Eintrag auf Englisch (vorher deutsch).
      kalender_url: globalKalenderUrl(ein.stornoToken, "en"),
      ...globalGoogleFeld(ein.beginn, "en"),
    };
  }
  return {
    email: ein.email, ...antwortAn,
    name: escapeHtml(ein.name),
    firma,
    telefon: escapeHtml(ein.telefon),
    // E-476 Scheibe 4: ohne Paketwunsch entfällt die Zeile (vorher „noch offen — wir klären es im Gespräch“).
    paket: ein.paketText ? escapeHtml(ein.paketText) : "",
    ...(angaben ? { angaben_satz: angaben } : {}),
    agent_vorname: escapeHtml(ein.ansprechpartner),
    termin_datum: ein.datumText,
    termin_uhrzeit: ein.uhrzeit,
    termin_art: QUELLEN.global.text,
    termin_dauer: String(GLOBAL_DAUER_MIN),
    // ?bereich=business: Die Absage-Seite trägt Kopf und Fuß von FIAON Global, nicht die der Privatkunden (19.09.2026).
    storno_link: `${stornoLink(ein.stornoToken)}?anrede=sie&bereich=business`,
    kalender_url: globalKalenderUrl(ein.stornoToken),
    ...globalGoogleFeld(ein.beginn),
  };
}

/**
 * E-263 (29.09.2026): Googles „Termin speichern" für das Erstgespräch — die .ics-Datei
 * im Knopf nimmt Apple und Outlook, Google braucht seinen eigenen Link. Ohne Namen,
 * Firma oder Telefon (der Link landet in Googles Protokollen). Die Sätze stehen mit denen der
 * Datei an EINER Stelle (GLOBAL_KALENDER_TEXT) — auf Englisch für /en/business (Gegenprüfung E-263).
 */
export function globalGoogleFeld(beginn: string | Date | null | undefined, sprache: "de" | "en" = "de"): Record<string, string> {
  const b = beginn ? new Date(beginn) : null;
  if (!b || Number.isNaN(b.getTime())) return {};
  const T = GLOBAL_KALENDER_TEXT[sprache === "en" ? "en" : "de"];
  return {
    google_kalender_url: googleKalenderLink({
      text: T.titel,
      beginn: b,
      ende: new Date(b.getTime() + GLOBAL_DAUER_MIN * 60_000),
      details: T.google,
      ort: sprache === "en" ? "Phone" : "Telefon",
    }),
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Die Anfrage — Rückfall ohne freie Zeit und „lieber ein Anruf"
// ───────────────────────────────────────────────────────────────────────────

/**
 * Der Text von Daniels Auftrag zu einer Global-Anfrage (rein, für den Prüfstand herausgezogen). E-476 Nachbesserung
 * (Gutachten Technik 05.11.2026): Die Auftrag-Mail schneidet nach 600 Zeichen ab — der Klartext ist länger als die alten
 * Codes, die dritte Antwort fiel weg. Die Antworten stehen deshalb als EINE kurze Zeile ganz oben; der ganze Text bleibt
 * unten in „Nachricht“ und im Portal.
 */
export function globalAnfrageAuftragText(ein: {
  anfrageId: number; wo: string; kontakt: GlobalKontakt; wunschzeit: string | null; kundeRef: string | null; text: string | null;
  antworten?: { antwort: string }[] | null;
}): string {
  const k = ein.kontakt;
  const antworten = (ein.antworten ?? []).map((a) => String(a.antwort ?? "").trim()).filter(Boolean);
  return [
    `Anfrage #${ein.anfrageId} über ${ein.wo} — das Unternehmen möchte ein Erstgespräch zu FIAON Global.`,
    antworten.length ? `Antworten: ${antworten.join(" · ").slice(0, 240)}` : null,
    `Firma: ${k.firma} · Ansprechpartner: ${k.name}`,
    `Telefon: ${k.telefon} · E-Mail: ${k.email}`,
    `Paketwunsch: ${k.paketText ?? "noch offen"}${k.land ? ` · Land: ${k.land}` : ""}${k.sprache === "en" ? " · Gespräch auf ENGLISCH" : ""}`,
    ein.wunschzeit ? `Wunschzeit: ${ein.wunschzeit}` : null,
    ein.kundeRef ? `Ist bereits Kunde (${ein.kundeRef}).` : null,
    ein.text ? `\nNachricht: ${ein.text.slice(0, 1200)}` : null,
    "\nBitte heute anrufen. Die Firma steht ganz oben im Firmen-Cockpit — dort das Ergebnis festhalten.",
  ].filter(Boolean).join("\n");
}

/**
 * E-476 Scheibe 4: der Auftrag des Privat-Wegs (rein, Prüfstand). Beschwerde → die Leitung entscheidet, wer sich meldet (nie
 * allein die Person, über die sie sich beschwert); Privatkunde → der Betreuer. Kein Business-Lead, keine Mails von Justin.
 */
export function privatWegAuftragText(ein: {
  anfrageId: number; wo: string; kontakt: GlobalKontakt; beschwerde: boolean; bestandText: string; signale: string[]; text: string | null;
}): string {
  const k = ein.kontakt;
  return [
    `Anfrage #${ein.anfrageId} über ${ein.wo} — sie kam über das FIAON-Global-Formular, ist aber ${ein.beschwerde ? "eine BESCHWERDE" : "ein Privat-Anliegen"} (Privat-Weg, E-476).`,
    `Kontakt: ${k.name} · ${k.telefon} · ${k.email}`,
    ein.bestandText ? `${ein.bestandText}.` : "Keine Privat-Bestellung zur Mail oder Nummer gefunden.",
    ein.signale.length ? `Signale in der Nachricht: ${ein.signale.join(", ")}` : null,
    ein.text ? `\nNachricht: ${ein.text.slice(0, 1500)}` : null,
    "\nBitte heute persönlich melden — die Website hat geantwortet: „Wir melden uns persönlich bei Ihnen.“",
    "Kein Business-Lead, keine Mail von Justin, Daniel ruft nicht an.",
    ein.beschwerde ? "Beschwerde: Die Leitung entscheidet, wer sich meldet — nicht allein die Person, über die sie sich beschwert." : null,
  ].filter(Boolean).join("\n");
}

/** Die Meldung zum Anruf-Auftrag eines Eingangs: T1 an → „eigene“ (T1 kommt gleich), T1 aus → die Auftrag-Mail an die Firmenadresse. Wirft nie. */
async function leadMeldungFuerEingang(): Promise<"eigene" | { an: string; fuerAgentId: number } | null> {
  try {
    const takt = await import("./fiaon-lead-takt");
    const e = await takt.taktEinstellungen();
    return e.meldungT1An ? "eigene" : await takt.leadAuftragMeldung();
  } catch { return "eigene"; }
}

export async function globalAnfrageAnnehmen(ein: {
  kontakt: GlobalKontakt; wunschzeit: string | null; text: string | null; ip: string;
  /**
   * E-466 (30.10.2026): Woher die Anfrage kommt — Vorgabe ist die Website. Das
   * Meta-Sofortformular („FIAON Global …“) kommt über denselben Weg herein
   * (fiaon-meta-leads.ts), damit der Kontakt im Firmen-Cockpit landet und NIE in
   * der Privat-Strecke (E-272). Nur die Wörter im Verlauf und in der Aufgabe ändern sich.
   */
  herkunft?: { wo: string; quelle: string; autor: string };
  /**
   * E-476 (05.11.2026): was der Eingang über den Lead weiß (Kanal, Antworten im Klartext, Formular, Anzeige) — für das
   * Lead-Dossier an Justin. Ohne Angabe liest das Dossier alles aus der Anfrage selbst.
   */
  lead?: EingangsHinweis | null;
  /**
   * E-487 Nachbesserung (Gutachten Partner-Empfehlung, Mangel 3): Empfehlung eines Partners (koopEmpfehlungEintragen) — `text` ist
   * dann die Notiz des Partners, keine Nachricht der Person: Sie geht nie in die Privat-/Beschwerde-Weiche.
   */
  empfehlung?: boolean;
}): Promise<{ anfrageId: number; zustaendigName: string | null; anBetreiber: boolean }> {
  const k = ein.kontakt;
  const wo = ein.herkunft?.wo ?? "fiaon.com/business";
  const { ensureAnfragenSpalten } = await import("../routes/fiaon-bewerbungen");
  await ensureAnfragenSpalten();
  const person = await globalZustaendig();

  const text = [
    k.paketText ? `Paketwunsch: ${k.paketText}` : "Paketwunsch: noch offen",
    ein.wunschzeit ? `Wunschzeit: ${ein.wunschzeit}` : null,
    k.sprache === "en" ? "Sprache: Englisch" : null,
    ein.text ? `\n${ein.text}` : null,
  ].filter(Boolean).join("\n");

  // Ist der Absender ein Kunde? Dann hängt die Anfrage an seiner Person.
  // E-487 (09.11.2026): Ohne E-Mail (Empfehlung nur mit Telefon, Meta-Lead nur mit Nummer) passte '' auf jede Bestellung ohne
  // Mail (gemessen: über tausend) — die Anfrage hing dann an einem fremden Kunden. Leere Adresse = kein Treffer.
  const [kunde] = (await sqlPool`
    SELECT person_id, ref FROM fiaon_applications
    WHERE ${k.email} <> '' AND LOWER(email) = ${k.email} AND merged_into IS NULL
    ORDER BY (payment_status = 'paid') DESC, created_at DESC LIMIT 1
  `.catch(() => [])) as any[];

  // ── E-476 Scheibe 4: DIE PRIVATKUNDEN-WEICHE (Gutachten 1, Mangel 1 + 6) — vorn, nach dem ANLIEGEN ──────────────────
  // Klingt die Nachricht nach Beschwerde (dieselbe Regel wie der Dossier-Hinweis) oder schreibt eine Privatkundin ohne jedes
  // Global-Interesse (keine Formular-Antworten, kein Paket, keine Firma), geht die Anfrage den PRIVAT-WEG: kein Firmen-Lead,
  // keine Lead-Mails von Justin, kein Anruf-Auftrag an Daniel — die Beschwerde an die Leitung (nie allein an die Person, über
  // die sie sich beschwert), die Privat-Frage an ihren Betreuer. Ein Bestandskunde MIT Global-Interesse bleibt Global-Lead
  // (Vermerk, eigene Willkommens-Fassung). Nur Lesen; jede Störung = Global wie bisher. Die Danke-Seite ist für alle gleich.
  const istMeta = ein.lead?.kanal === "meta" || ein.herkunft?.quelle === "meta";
  const k9 = String(k.telefon ?? "").replace(/\D/g, "").slice(-9);
  const k9Gueltig = k9.length === 9 ? k9 : "";
  const bestand = (await sqlPool`
    SELECT a.ref, a.person_id, a.type, a.pack_key, a.pack_name, a.payment_status, ag.name AS betreuer
      FROM fiaon_applications a
      LEFT JOIN fiaon_persons p ON p.id = a.person_id
      LEFT JOIN fiaon_agents ag ON ag.id = COALESCE(p.assigned_agent_id, a.assigned_agent_id)
     WHERE a.merged_into IS NULL AND NOT COALESCE(a.ist_entwurf, FALSE)
       AND ((${k.email} <> '' AND LOWER(COALESCE(a.email, '')) = ${k.email})
         OR (${k9Gueltig} <> '' AND RIGHT(REGEXP_REPLACE(COALESCE(a.phone, ''), '\\D', '', 'g'), 9) = ${k9Gueltig}))
     ORDER BY (a.payment_status = 'paid') DESC, a.created_at DESC LIMIT 5
  `.catch(() => [])) as any[];
  const privatBestand = bestand.filter((z) => produktkategorie({ type: z.type, ref: z.ref, pack_key: z.pack_key }) !== "global");
  // E-487 Nachbesserung (Mangel 3): Bei einer Empfehlung ist der Text die Notiz des Partners — als Firma steht der Platzhalter
  // „… (Firma noch offen)“, da reichte schon EIN starkes Wort („versprochen“, „abgezockt“) für den Weg „Beschwerde“: kein Lead,
  // kein Anruf, keine Einladung, stattdessen eine Beschwerde-Aufgabe an die Leitung. Jetzt geht die Notiz nie in die Weiche.
  const weiche = privatWeiche({
    nachricht: istMeta || ein.empfehlung === true ? null : ein.text,
    privatBestand: privatBestand.length > 0,
    zahlend: privatBestand.some((z) => z.payment_status === "paid"),
    firmaBrauchbar: firmaBrauchbar(k.firma, k.name).brauchbar,
    globalInteresse: istMeta || !!k.paketText || (ein.lead?.antworten?.length ?? 0) > 0,
  });
  const privatWeg = weiche.weg === "beschwerde" || weiche.weg === "privat";
  const haupt = privatBestand.find((z) => z.payment_status === "paid") ?? privatBestand[0] ?? null;
  const bestandText = haupt
    ? `Bestandskunde Privat (${haupt.ref}${haupt.pack_name ? `, ${haupt.pack_name}` : ""}, ${haupt.payment_status === "paid" ? "bezahlt" : "nicht bezahlt"}${haupt.betreuer ? `, Betreuung ${haupt.betreuer}` : ""})`
    : "";

  const [row] = (await sqlPool`
    INSERT INTO fiaon_anfragen (art, name, email, firma, telefon, land, text, person_id, ip, zustaendig_agent_id)
    VALUES ('global', ${k.name}, ${k.email}, ${k.firma}, ${k.telefon}, ${k.land}, ${text || null},
            ${kunde?.person_id ?? null}, ${ein.ip}, ${privatWeg ? null : person?.id ?? null})
    RETURNING id
  `) as any[];
  const anfrageId = Number(row.id);
  if (privatWeg) {
    // Der Stand „privat“: keine Lead-Mails, keine Mara-Weiche 0c, keine Zuordnung von Global-Buchungen.
    await sqlPool`
      UPDATE fiaon_anfragen SET status = 'privat', bearbeitet_am = NOW(), bearbeitet_von = 'Privat-Weiche',
             notiz = ${`Privat-Weg (${weiche.weg === "beschwerde" ? "Beschwerde" : "Privatkunde"})${bestandText ? ` — ${bestandText}` : ""}${weiche.signale.length ? ` · Signale: ${weiche.signale.join(", ")}` : ""}`}
       WHERE id = ${anfrageId}`.catch((e) => console.error(`[GLOBAL-TERMIN] Anfrage #${anfrageId}: Privat-Weg nicht vermerkt:`, String(e).slice(0, 160)));
  }

  // E-476 Scheibe 3: Hat dieser Kontakt schon ein kommendes Lead-Gespräch (Danke-Knopf gebucht, bevor die Anfrage aus dem
  // Meta-Rückstand kam)? Dann kein „bitte anrufen“ und kein Rückschritt auf „Wiedervorlage“ — die Anfrage hängt sich an
  // das Gespräch. Nur Lesen; jede Störung = wie bisher.
  const schonTermin = await import("./fiaon-lead-weg")
    .then((m) => m.gebuchtesLeadGespraechFuer(k.email, k.telefon)).catch(() => null);
  const schonText = schonTermin
    ? ` Hat schon ein Gespräch gebucht: ${berlinDatumText(schonTermin.beginn)} um ${berlinUhrzeit(schonTermin.beginn)} Uhr${schonTermin.agentName ? ` mit ${schonTermin.agentName}` : ""} — kein Anruf nötig.`
    : "";

  // E-476 Scheibe 4: Auf dem Privat-Weg entsteht KEIN Firmen-Lead (sonst stünde die Beschwerde in Daniels Liste).
  let firmaId: number | null = null;
  if (!privatWeg) try {
    const { globalLeadAufnehmen } = await import("../routes/fiaon-firmen");
    const lead = await globalLeadAufnehmen({
      firma: k.firma, ansprechpartner: k.name, telefon: k.telefon, email: k.email, land: k.land,
      paketwunsch: k.paketText, personId: kunde?.person_id ? Number(kunde.person_id) : schonTermin?.personId ?? null,
      zustaendigAgentId: person?.id ?? null,
      status: schonTermin ? "termin" : "wiedervorlage", ereignis: "anfrage",
      verlauf: `${schonTermin ? "Anfrage" : "Bittet um einen Anruf"} (Anfrage #${anfrageId} über ${wo}). `
        + `Paketwunsch: ${k.paketText ?? "noch offen"}.${ein.wunschzeit ? ` Wunschzeit: ${ein.wunschzeit}.` : ""}`
        + `${k.sprache === "en" ? " Sprache: Englisch." : ""}${ein.text ? ` Nachricht: ${ein.text.slice(0, 600)}` : ""}${schonText}`
        + `${weiche.weg === "bestandskunde" && bestandText ? ` ${bestandText} — mit Interesse an FIAON Global.` : ""}`,
    });
    firmaId = lead.firmaId;
  } catch (e) {
    console.error(`[GLOBAL-TERMIN] Anfrage #${anfrageId} steht, aber der Firmen-Lead fehlt — ${k.firma} erscheint NICHT im Firmen-Cockpit:`, e);
  }

  if (schonTermin) {
    // Die Anfrage an das gebuchte Gespräch hängen — angestoßen, nie abgewartet (der Eingang wartet auf nichts Neues).
    void import("./fiaon-lead-weg")
      .then((m) => m.leadGespraechVerknuepfen({
        terminId: schonTermin.terminId, anfrageId, firmaId, personId: schonTermin.personId, weg: "seite", beginn: schonTermin.beginn,
      }))
      .catch((e) => console.error(`[GLOBAL-TERMIN] Anfrage #${anfrageId} nicht an Termin ${schonTermin.terminId} gehängt:`, e));
  }

  // Kein Betreiber-Vermerk mit zwei Tagen Frist: ein Auftrag, fällig HEUTE. E-476 Scheibe 3: keiner, wenn er schon ein
  // Gespräch gebucht hat — dann ruft niemand „bitte anrufen“ hinterher.
  const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
  const erg = schonTermin ? { agentId: null, agentName: null, anBetreiber: false } : privatWeg ? await auftragFuerKunden({
    // Privat-Weg: die Beschwerde an die Leitung, die Privat-Frage an den Betreuer der Person — nie an Daniel.
    personId: weiche.weg === "privat" && haupt?.person_id ? Number(haupt.person_id) : null,
    ref: haupt?.ref ?? kunde?.ref ?? null,
    titel: weiche.weg === "beschwerde" ? `Beschwerde über das Global-Formular: ${k.name}` : `Privatkunde schreibt über das Global-Formular: ${k.name}`,
    text: privatWegAuftragText({ anfrageId, wo, kontakt: k, beschwerde: weiche.weg === "beschwerde", bestandText, signale: weiche.signale, text: ein.text }),
    faelligAm: berlinToday(),
    dringend: true,
    schluessel: `global-anfrage:${anfrageId}`,
    bereich: "sonstiges",
    quelle: ein.herkunft?.quelle ?? "website",
    autorName: ein.herkunft?.autor ?? "Website",
    ...(weiche.weg === "beschwerde" ? { anBetreiber: true } : {}),
    anlageText: weiche.weg === "beschwerde"
      ? "Beschwerde über das Global-Formular — Privat-Weg an die Leitung (E-476)."
      : "Privatkunde über das Global-Formular — Privat-Weg an den Betreuer (E-476).",
  }) : await auftragFuerKunden({
    personId: null, ref: kunde?.ref ?? null,
    titel: `FIAON Global: ${k.firma} bittet um einen Anruf`,
    text: globalAnfrageAuftragText({ anfrageId, wo, kontakt: k, wunschzeit: ein.wunschzeit, kundeRef: kunde?.ref ?? null, text: ein.text, antworten: ein.lead?.antworten ?? null }),
    faelligAm: berlinToday(),
    dringend: true,
    schluessel: `global-anfrage:${anfrageId}`,
    bereich: "sonstiges",
    link: firmaId ? `/agent/firmen?firma=${firmaId}` : "/agent/firmen",
    quelle: ein.herkunft?.quelle ?? "website",
    autorName: ein.herkunft?.autor ?? "Website",
    agentId: person?.id ?? null,
    anlageText: `Anfrage zu FIAON Global über ${wo} eingegangen.`,
    // E-476 Scheibe 5 (Entscheidung 3A): keine „Neuer Auftrag“-Mail an die Login-Adresse — die Lead-Meldung T1 geht an die
    // Adresse „Lead-Meldungen an“ (unten angestoßen, server/lib/fiaon-lead-takt.ts). Nachbesserung (Gutachten Technik,
    // Mangel 2): ist die Lead-Meldung AUS, geht die Auftrag-Mail wieder — an dieselbe Firmenadresse, nie ins Leere.
    meldung: await leadMeldungFuerEingang(),
  });
  if (erg.agentId && erg.agentId !== person?.id) {
    await sqlPool`UPDATE fiaon_anfragen SET zustaendig_agent_id = ${erg.agentId} WHERE id = ${anfrageId}`.catch(() => {});
  }
  if (kunde?.ref) {
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
      VALUES (${kunde.ref}, ${kunde.person_id ?? null}, NULL, 'System', 'system',
              ${`Anfrage zu FIAON Global über ${ein.herkunft ? wo : "die Website"} eingegangen (${k.firma}).${erg.agentName ? ` Auftrag bei ${erg.agentName}.` : ""}`})
    `.catch(() => {});
  }
  console.log(`[GLOBAL-TERMIN] Anfrage #${anfrageId}: ${k.firma} (${k.email}) → ${schonTermin ? `hat schon Termin ${schonTermin.terminId} — kein Anruf-Auftrag` : erg.agentName ?? "Betreiber"}${privatWeg ? ` · Privat-Weg (${weiche.weg})` : weiche.weg === "bestandskunde" ? " · Bestandskunde Privat" : ""}`);
  // E-476 (05.11.2026): das Lead-Dossier an Justin — angestoßen, NIE abgewartet: Der Eingang ist hier fertig und darf an
  // der Dossier-Mail nie scheitern. Nur im Betrieb (CRONS_AN) — ein lokaler Prüflauf verschickt nichts.
  void import("./fiaon-lead-dossier")
    .then((m) => m.leadDossierAnstossen({
      anlass: "anfrage", anlassId: anfrageId, firmaId, personId: kunde?.person_id ? Number(kunde.person_id) : schonTermin?.personId ?? null,
      hinweis: ein.lead ?? { kanal: ein.herkunft?.quelle === "meta" ? "meta" : "website" },
    }))
    .catch((e) => console.error(`[GLOBAL-TERMIN] Lead-Dossier zu Anfrage #${anfrageId} nicht angestoßen:`, e));
  // E-476 Scheibe 5: Daniels Lead-Meldung T1 (an „Lead-Meldungen an“, nie an ein privates Postfach) — angestoßen, NIE abgewartet;
  // nur im Betrieb. Kein Privat-Weg, kein schon gebuchtes Gespräch (dann gibt es keinen Anruf-Auftrag). Der Lauf lead_takt holt nach.
  if (!privatWeg && !schonTermin) {
    void import("./fiaon-lead-takt")
      .then((m) => m.leadTaktAnstossen(anfrageId))
      .catch((e) => console.error(`[GLOBAL-TERMIN] Lead-Meldung zu Anfrage #${anfrageId} nicht angestoßen:`, e));
  }
  return { anfrageId, zustaendigName: erg.agentName, anBetreiber: erg.anBetreiber };
}

// ───────────────────────────────────────────────────────────────────────────
// Nach dem Gespräch — und warum es KEINE No-Show-Mail gibt
//
// Der Kalender kennt für „nicht zustande gekommen" vier Gründe, und drei davon
// verschicken eine Mail (fiaon-termin.ts, NICHT_ZUSTANDE): „Wir haben Sie
// verpasst" mit einem Terminlink auf /termin/<token>, die Bitte um
// Nummern-Korrektur, die Einladung zum Startgespräch. Alle drei sind für
// Privatkunden geschrieben: Sie sprechen von „Ihrer Akte", der Terminlink
// leitet die Gesprächsart aus dem KUNDENZUSTAND ab (es käme ein
// Vertriebsgespräch für Privatkunden heraus, in Du-Form), und der vierte Grund
// sperrt die Person für den Vertrieb. Nichts davon passt auf ein Unternehmen,
// das über ein Paket ab 2.499 € sprechen wollte.
//
// Deshalb endet ein Global-Gespräch hier: Status am Termin, eine Zeile im
// Verlauf des Firmen-Leads, Wiedervorlage im Cockpit — und die zuständige
// Person greift zum Telefon.
//
// E-458 Nr. 11 (29.10.2026): Die eigene, gesiezte „Wir haben Sie nicht
// erreicht"-Mail gibt es jetzt (Text von Justin freigegeben): Wer „nicht
// erreicht“ oder „Nummer falsch“ einträgt, löst sie GENAU EINMAL aus
// (globalNichtErreichtSenden). Jeder Eintrag schließt auch die Aufgabe
// „Ergebnis fehlt“ und die Erinnerung an die Leitung (fiaon-global-gespraech.ts).
//
// E-490 F6 (09.11.2026): Hat jemand das Unternehmen schon PERSÖNLICH
// angeschrieben (am 09.11. so passiert — der Kunde bekam danach eine zweite
// Mail), setzt er beim Knopf „Nicht erreicht“ den Haken „Kunde schon persönlich
// angeschrieben — keine Mail“ (Standard aus; Chefbüro › Global-Kunden ›
// Gespräche und Kalender). Dann geht global_nicht_erreicht nicht hinaus, und
// Termin-Notiz, Firmen-Verlauf und die geschlossene Aufgabe sagen, wer das
// Unternehmen schon selbst angeschrieben hat.
// ───────────────────────────────────────────────────────────────────────────

const NICHT_ZUSTANDE_TEXT: Record<string, string> = {
  nicht_erschienen: "nicht erreicht zum vereinbarten Termin",
  nummer_falsch: "die hinterlegte Rufnummer stimmt nicht",
  abgesagt: "vom Unternehmen abgesagt bzw. die Zeit passte nicht",
  kein_interesse: "kein Interesse mehr, vom Unternehmen erklärt",
};

/** E-490 F6: Löst dieser Eintrag die Mail „nicht erreicht“ aus? „Nicht erreicht“ und „Nummer falsch“ (auch ohne Grund) — ja. Rein. */
export function nichtErreichtMailGrund(ergebnis: "erledigt" | "verpasst", grund: string | null | undefined): boolean {
  return ergebnis === "verpasst" && (!grund || grund === "nicht_erschienen" || grund === "nummer_falsch");
}

/** E-490 F6: der Satz für Notiz, Verlauf und Aufgabe, wenn der Haken „schon persönlich angeschrieben“ gesetzt war. Rein. */
export function ohneMailVermerk(wer: string): string {
  return `Keine Mail „nicht erreicht“ — ${String(wer || "das Team").trim()} hat das Unternehmen schon persönlich angeschrieben.`;
}

export async function globalTerminErgebnis(ein: {
  terminId: number; personId: number; beginn: Date | string;
  agent: { id: number; name: string };
  ergebnis: "erledigt" | "verpasst";
  /** Nur bei „verpasst": einer der vier Gründe aus dem Kalender. */
  grund?: string | null;
  notiz?: string | null;
  /**
   * E-490 F6: Haken „Kunde schon persönlich angeschrieben — keine Mail“ beim Knopf „Nicht erreicht“ (Standard aus). Gilt nur,
   * wo sonst die Mail „nicht erreicht“ ginge (nicht erreicht, Nummer falsch).
   */
  ohneMail?: boolean;
}): Promise<{ hinweis: string }> {
  const wann = `${berlinDatumText(ein.beginn)}, ${berlinUhrzeit(ein.beginn)} Uhr`;
  const notiz = ein.notiz ? String(ein.notiz).trim().slice(0, 2000) : "";
  const grundText = ein.grund ? (NICHT_ZUSTANDE_TEXT[ein.grund] ?? ein.grund) : "nicht zustande gekommen";
  const vermerk = ein.ergebnis === "erledigt"
    ? "Erstgespräch geführt."
    : `Erstgespräch kam nicht zustande — ${grundText}.`;
  const mailGrund = nichtErreichtMailGrund(ein.ergebnis, ein.grund);
  const ohneMail = mailGrund && ein.ohneMail === true;
  const ohneMailSatz = ohneMail ? ohneMailVermerk(ein.agent.name) : "";

  // Anhängen, nicht ersetzen: In der Notiz steht, was das Unternehmen bei der
  // Buchung angegeben hat — das braucht auch der, der in drei Wochen nachliest.
  const notizZeile = [vermerk, notiz, ohneMailSatz].filter(Boolean).join(" ");
  // E-458 Nr. 11: der Grund steht jetzt auch als Wert am Termin (verpasst_grund war bei jedem Global-Gespräch leer).
  await sqlPool`
    UPDATE fiaon_termine
    SET status = ${ein.ergebnis}, erledigt_am = NOW(),
        notiz = CONCAT_WS(E'\n', NULLIF(notiz, ''), ${notizZeile}::text),
        verpasst_grund = CASE WHEN ${ein.ergebnis} = 'verpasst' THEN ${ein.grund ?? "nicht_erschienen"}::text ELSE verpasst_grund END,
        updated_at = NOW()
    WHERE id = ${ein.terminId}
  `;

  const { globalLeadFortschreiben } = await import("../routes/fiaon-firmen");
  const keinInteresse = ein.grund === "kein_interesse";
  const lead = await globalLeadFortschreiben({
    personId: ein.personId,
    status: ein.ergebnis === "erledigt" ? "in_arbeit" : keinInteresse ? "kein_interesse" : "wiedervorlage",
    // Geführt → morgen nachfassen. Nicht zustande → heute noch einmal anrufen.
    wiedervorlage: ein.ergebnis === "erledigt" ? "morgen" : keinInteresse ? null : "heute",
    ereignis: ein.ergebnis === "erledigt" ? "gespraech_gefuehrt" : "gespraech_nicht_zustande",
    verlauf: `${vermerk.replace(/\.$/, "")} (${wann}).${notiz ? ` ${notiz}` : ""}${ohneMailSatz ? ` ${ohneMailSatz}` : ""}`,
    agent: ein.agent,
    kontakt: ein.ergebnis === "erledigt",
  }).catch((e) => { console.error(`[GLOBAL-TERMIN] Ergebnis von Termin ${ein.terminId} nicht im Firmen-Topf vermerkt:`, e); return { firmaId: null }; });

  // Der Auftrag zum Gespräch ist damit erledigt — sonst steht er weiter offen. E-458 Nr. 11: dazu „Ergebnis fehlt“
  // und die Erinnerung an die Leitung (ein Weg für Kalender, Chefbüro und Absage).
  const { globalErgebnisAufgabenSchliessen, globalNichtErreichtSenden } = await import("./fiaon-global-gespraech");
  await globalErgebnisAufgabenSchliessen(ein.terminId, { ergebnis: ohneMailSatz ? `${vermerk} ${ohneMailSatz}` : vermerk, wer: ein.agent.name, auchGespraech: true });
  // E-476 Scheibe 5: EIN Stand — nach einem LEAD-Gespräch ziehen Anfrage und Anruf-Auftrag mit (nicht erreicht → Daniels
  // Auftrag geht wieder auf). Startgespräche zahlender Kunden bleiben unberührt. Wirft nie.
  await leadStandNachGespraech(ein.terminId, lead.firmaId, ein.ergebnis === "erledigt" ? "gespraech_gefuehrt" : keinInteresse ? "gespraech_kein_interesse" : "gespraech_nicht_zustande", ein.agent);

  const wo = lead.firmaId ? " Die Firma steht im Firmen-Cockpit" : " Im Firmen-Cockpit gibt es zu diesem Kontakt keine Firma";
  if (ein.ergebnis === "erledigt") {
    return { hinweis: `Erstgespräch als geführt vermerkt.${wo}${lead.firmaId ? " — mit Wiedervorlage morgen. Halte dort fest, wie es weitergeht." : "."}` };
  }
  // E-458 Nr. 11: „nicht erreicht“ (auch wegen falscher Nummer) — einmal die gesiezte Mail mit dem Link für eine neue Zeit.
  // „Abgesagt“ und „kein Interesse“ bekommen keine: Das Unternehmen weiß es selbst.
  // E-490 F6: Haken „schon persönlich angeschrieben“ → keine Mail (vermerkt oben in Notiz, Verlauf und Aufgabe).
  const mail = !mailGrund
    ? { versandt: false, satz: " Es geht keine Mail raus." }
    : ohneMail
      ? { versandt: false, satz: " Es geht keine Mail raus — du hast das Unternehmen schon persönlich angeschrieben (steht im Verlauf)." }
      : await globalNichtErreichtSenden(ein.terminId).catch((e) => ({ versandt: false, satz: ` Die Mail ging NICHT raus (${String(e).slice(0, 120)}) — bitte anrufen.` }));
  return {
    hinweis: keinInteresse
      ? `Vermerkt.${wo}${lead.firmaId ? " jetzt auf „kein Interesse“." : "."} Es geht keine Mail raus.`
      : `Vermerkt.${wo}${lead.firmaId ? " wieder ganz oben — bitte heute noch einmal anrufen." : "."}${mail.satz}`,
  };
}

/** Das Unternehmen (oder der Mitarbeiter) hat abgesagt — der Lead geht zurück auf die Tagesliste. */
export async function globalTerminAbgesagt(ein: {
  terminId: number; personId: number; beginn: Date | string; wer: "kunde" | "agent";
}): Promise<void> {
  const wann = `${berlinDatumText(ein.beginn)}, ${berlinUhrzeit(ein.beginn)} Uhr`;
  // E-273 (02.10.2026): War es das Startgespräch eines Individualangebots, erfährt es Justin (dringende Aufgabe) und
  // das Angebot (Verlauf) — der neue Termin wird persönlich vereinbart. Darf nichts hier aufhalten.
  await import("./fiaon-global-angebot-startgespraech")
    .then((m) => m.startgespraechAbgesagt({ terminId: ein.terminId, beginn: ein.beginn, wer: ein.wer }))
    .catch((e) => console.error(`[GLOBAL-TERMIN] Absage des Startgesprächs (Termin ${ein.terminId}) nicht am Angebot vermerkt:`, e));
  const { globalLeadFortschreiben } = await import("../routes/fiaon-firmen");
  await globalLeadFortschreiben({
    personId: ein.personId,
    status: "wiedervorlage",
    wiedervorlage: "heute",
    ereignis: "termin_abgesagt",
    verlauf: ein.wer === "kunde"
      ? `Erstgespräch (${wann}) vom Unternehmen abgesagt. Eine neue Zeit wählt es auf fiaon.com/business — oder du rufst an.`
      : `Erstgespräch (${wann}) von uns abgesagt. Das Unternehmen hat eine Mail mit dem Weg zu einer neuen Zeit bekommen.`,
  });
  // E-458 Nr. 11: mit der Gesprächs-Aufgabe auch „Ergebnis fehlt“ und die Erinnerung an die Leitung.
  const { globalErgebnisAufgabenSchliessen } = await import("./fiaon-global-gespraech");
  await globalErgebnisAufgabenSchliessen(ein.terminId, {
    ergebnis: `Gespräch abgesagt (${ein.wer === "kunde" ? "durch das Unternehmen" : "durch uns"}).`, wer: "System", auchGespraech: true,
  });
  // E-476 Scheibe 5: Ein abgesagtes LEAD-Gespräch lässt die Anfrage nicht mehr auf „termin“ stehen — Daniels Anruf-Auftrag geht
  // wieder auf (neu vereinbaren). Wirft nie.
  await leadStandNachGespraech(ein.terminId, null, "termin_abgesagt", null);
}

/**
 * E-476 Scheibe 5: der EINE Stand nach Ergebnis oder Absage — NUR für Lead-Gespräche (Kalender, Link, Cockpit, /justin-Weiche),
 * an der Anfrage des Gesprächs. Ein Startgespräch zahlender Kunden (herkunft „individualangebot“) bleibt unberührt. Wirft nie.
 */
async function leadStandNachGespraech(terminId: number, firmaId: number | null, ereignis: "gespraech_gefuehrt" | "gespraech_kein_interesse" | "gespraech_nicht_zustande" | "termin_abgesagt", agent: { id: number; name: string } | null): Promise<void> {
  try {
    const [t] = (await sqlPool`SELECT quelle, herkunft FROM fiaon_termine WHERE id = ${terminId}`.catch(() => [])) as any[];
    const { istLeadGespraech } = await import("@shared/fiaon-lead-weg");
    if (!t || !istLeadGespraech(t)) return;
    const [g] = (await sqlPool`SELECT anfrage_id, firma_id FROM fiaon_lead_gespraech WHERE termin_id = ${terminId}`.catch(() => [])) as any[];
    const { globalLeadStandSetzen } = await import("../routes/fiaon-firmen");
    await globalLeadStandSetzen({ firmaId: g?.firma_id ? Number(g.firma_id) : firmaId, anfrageId: g?.anfrage_id ? Number(g.anfrage_id) : null, ereignis, wer: agent });
  } catch (e) {
    console.error(`[GLOBAL-TERMIN] Stand nach Termin ${terminId} nicht nachgezogen:`, String(e).slice(0, 160));
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Die Kalenderdatei zum Termin
// ───────────────────────────────────────────────────────────────────────────

/**
 * Die Datei zum Storno-Token. Abgesagt → METHOD:CANCEL mit derselben UID (Gegenprüfung E-263,
 * vorher 410): Das Unternehmen nimmt das Gespräch damit aus seinem Kalender. `sprache` kommt
 * aus ?sprache=en am Link der englischen Bestätigung.
 */
export async function globalKalenderZuToken(stornoToken: string, sprache: "de" | "en" = "de"): Promise<{ datei: string; abgesagt: boolean } | null> {
  if (!/^[0-9a-f]{48}$/.test(stornoToken)) return null;
  const [t] = (await sqlPool`
    SELECT t.id, t.beginn, COALESCE(t.dauer_min, ${GLOBAL_DAUER_MIN}) AS dauer_min, t.status, t.created_at,
           GREATEST(t.created_at, t.updated_at, COALESCE(t.kal_geaendert_am, t.created_at)) AS stand,
           COALESCE(t.kal_sequenz, 0) AS kal_sequenz, t.herkunft,
           ag.name AS agent_name, p.primary_phone AS telefon
    FROM fiaon_termine t
    LEFT JOIN fiaon_agents ag ON ag.id = t.agent_id
    LEFT JOIN fiaon_persons p ON p.id = t.person_id
    WHERE t.storno_token = ${stornoToken} AND t.quelle = 'global'
    LIMIT 1
  `) as any[];
  if (!t) return null;
  const abgesagt = String(t.status) === "abgesagt";
  return {
    abgesagt,
    datei: globalKalenderDatei({
      terminId: Number(t.id), beginn: t.beginn, dauerMin: Number(t.dauer_min),
      ansprechpartner: String(t.agent_name || (sprache === "en" ? "Your contact" : "Ihr Ansprechpartner")),
      telefon: t.telefon ?? null,
      stornoLink: `${stornoLink(stornoToken)}?anrede=sie&bereich=business`,
      // E-263: Stempel = letzte Änderung, SEQUENCE zählt — ein verschobenes Gespräch ersetzt den alten Eintrag.
      erstelltAm: t.stand ? new Date(t.stand) : t.created_at ? new Date(t.created_at) : undefined,
      sequenz: Number(t.kal_sequenz) || 0,
      sprache, abgesagt,
      // E-273: Das Startgespräch eines Individualangebots heißt im Kalender „Startgespräch" (Titel und Absagesatz).
      start: String(t.herkunft ?? "") === "individualangebot"
        ? await import("@shared/fiaon-global-startgespraech").then((m) => ({ titel: m.STARTGESPRAECH_TEXTE.kalenderTitel, abgesagtText: m.STARTGESPRAECH_TEXTE.kalenderAbgesagt }))
        : null,
    }),
  };
}
