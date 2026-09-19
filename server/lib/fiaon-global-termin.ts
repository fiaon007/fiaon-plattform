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
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";
import {
  terminBuchen, stornoLink, verfuegbarkeitVon, ensureHerkunftSpalte, versuchProtokollieren,
  TerminFehler, QUELLEN, berlinDatumText, berlinUhrzeit,
} from "./fiaon-termine";
import {
  globalZeitenRechnen, globalAngebot, globalKalenderDatei,
  GLOBAL_DAUER_MIN, GLOBAL_HORIZONT_TAGE, GLOBAL_PRO_TAG,
  type GlobalTag, type GlobalZeitenErgebnis,
} from "./fiaon-global-zeiten";
import { berlinToday } from "./fiaon-time";
import { absoluteUrl } from "../fiaon-base-url";
import { globalPaket, globalPreisText } from "@shared/fiaon-global";
import { GLOBAL_TEXTE, globalText } from "@shared/fiaon-global-termin-texte";

const SETTING_ZUSTAENDIG = "global_zustaendig_agent_id";
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
}

export async function globalAngebotLaden(tageVoraus = GLOBAL_HORIZONT_TAGE): Promise<GlobalAngebotStand> {
  const leer: GlobalZeitenErgebnis = { frei: [], restJeTag: {}, zeitenGepflegt: false };
  const proTag = await proTagLesen();
  const person = await globalZustaendig();
  if (!person) return { person: null, ergebnis: leer, tage: [], proTag, rueckfall: true, grund: "keine_person" };

  const fenster = await verfuegbarkeitVon(person.id);
  // Dieselbe Belegungsregel wie rohSlots (25.08.2026): Eine Absage des
  // MITARBEITERS sperrt die Zeit — er hat abgesagt, weil er dann nicht kann.
  const termine = (await sqlPool`
    SELECT beginn, COALESCE(dauer_min, 20) AS dauer_min, quelle, status
    FROM fiaon_termine
    WHERE agent_id = ${person.id}
      AND (status IN ('gebucht', 'erledigt', 'verpasst') OR (status = 'abgesagt' AND abgesagt_von = 'agent'))
      AND beginn > NOW() - INTERVAL '1 day' AND beginn < NOW() + INTERVAL '16 days'
  `) as { beginn: Date; dauer_min: number; quelle: string; status: string }[];

  const ergebnis = globalZeitenRechnen({
    jetzt: new Date(),
    fenster,
    belegt: termine.map((t) => ({
      beginn: t.beginn, dauerMin: Number(t.dauer_min),
      zaehltAlsGlobal: t.quelle === "global" && t.status !== "abgesagt",
    })),
    tage: tageVoraus,
    proTag,
  });
  const tage = globalAngebot(ergebnis);
  return {
    person, ergebnis, tage, proTag,
    rueckfall: tage.length === 0,
    grund: !ergebnis.zeitenGepflegt ? "keine_zeiten" : tage.length === 0 ? "ausgebucht" : null,
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
  const name = String(b?.name ?? "").replace(/\s+/g, " ").trim().slice(0, 160);
  // 19.09.2026 (Justin): Auch Privatpersonen — und Unternehmer, die privat buchen —
  // können FIAON Global beauftragen. Ohne Firma heißt der Lead „Privatperson · Name",
  // damit das Team im Firmen-Cockpit sofort sieht, wer anfragt.
  const firmaRoh = String(b?.firma ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
  const email = String(b?.email ?? "").trim().toLowerCase().slice(0, 160);
  const telefon = String(b?.telefon ?? "").trim().slice(0, 40);
  if (name.length < 2) return { feld: "name", error: T.fehlerName };
  const firma = firmaRoh.length >= 2 ? firmaRoh : `${en ? "Private individual" : "Privatperson"} · ${name}`;
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
  | { ok: true; terminId: number; wann: string; datumText: string; uhrzeit: string; ansprechpartner: { vorname: string }; kalenderUrl: string }
  | { ok: false; status: number; grund: string; error: string; feld?: string; angebot?: GlobalAngebotStand };

export function globalKalenderUrl(stornoToken: string): string {
  return absoluteUrl(`/api/fiaon/global/termine/kalender/${stornoToken}.ics`);
}

export async function globalTerminBuchen(ein: {
  kontakt: GlobalKontakt; tag: string; zeit: string; thema: string | null;
}): Promise<GlobalBuchungErgebnis> {
  const k = ein.kontakt;
  const en = k.sprache === "en";
  const T = en ? GLOBAL_TEXTE.en : GLOBAL_TEXTE.de;

  const angebot = await globalAngebotLaden();
  if (!angebot.person) {
    return { ok: false, status: 409, grund: "kein_angebot", angebot, error: T.keinAngebot };
  }
  const person = angebot.person;
  const slot = angebot.ergebnis.frei.find((f) => f.tag === ein.tag && f.zeit === ein.zeit);
  if (!slot) {
    await versuchProtokollieren({ ergebnis: "abgelehnt", grund: "nicht_angeboten", agentId: person.id, quelle: "global", akteur: "kunde" });
    return { ok: false, status: 409, grund: "nicht_angeboten", angebot, feld: "zeit",
      error: angebot.tage.length ? T.zeitVergeben : T.zeitVergebenKeineWeitere };
  }

  // Der Firmenkontakt: bekannt über E-Mail oder Telefon, sonst neu — ohne Betreuer.
  const { personFuerZeile } = await import("../fiaon-person-model");
  const zu = await personFuerZeile({
    emails: [k.email],
    phones: [k.telefon],
    stammdaten: {
      kind: "business", first_name: k.vorname, last_name: k.nachname, company_name: k.firma,
      contact_name: k.name, primary_email: k.email, primary_phone: k.telefon, country: k.land,
    },
    quelle: "global-seite",
    firstSeenAt: new Date(),
  });
  if (!zu) return { ok: false, status: 400, grund: "eingabe", feld: "email", error: T.fehlerEmail };

  const [schon] = (await sqlPool`
    SELECT id, beginn FROM fiaon_termine
    WHERE person_id = ${zu.personId} AND quelle = 'global' AND status = 'gebucht' AND beginn > NOW()
    ORDER BY beginn LIMIT 1
  `) as any[];
  if (schon) {
    return { ok: false, status: 409, grund: "schon_gebucht", angebot,
      error: globalText(T.schonGebucht, { datum: berlinDatumText(schon.beginn), uhrzeit: berlinUhrzeit(schon.beginn) }) };
  }

  // ── ATOMAR: EINE ZEIT, EIN GESPRÄCH — UND HÖCHSTENS VIER AM TAG ──────────
  // Die doppelte Zeit verhindert die Datenbank (eindeutiger Index auf
  // agent + beginn, dazu die Überschneidungs-Sperre) — zwei Anfragen in
  // derselben Millisekunde kommen durch jede Prüfung im Code, aber nur eine
  // durch den Index. Den TAGESDECKEL kennt kein Index: Zwei Buchungen auf
  // VERSCHIEDENE Zeiten desselben Tages würden beide „noch ein Platz" lesen.
  // Deshalb eine Transaktion mit einer Sperre je Person und Tag; die zweite
  // wartet, zählt neu und wird sauber abgewiesen.
  //
  // `ensureHerkunftSpalte` VOR der Transaktion: Beim ersten Aufruf nach einem
  // Serverstart will sie ein ALTER TABLE — das stellte sich sonst hinter die
  // Lesesperre dieser Transaktion und gäbe nach drei Sekunden auf.
  await ensureHerkunftSpalte();
  let buchung;
  try {
    buchung = await sqlPool.begin(async (tx: any) => {
      await tx`SELECT pg_advisory_xact_lock(hashtext(${`global-termin:${person.id}:${slot.tag}`}))`;
      const [z] = (await tx`
        SELECT COUNT(*)::int AS n FROM fiaon_termine
        WHERE agent_id = ${person.id} AND quelle = 'global' AND status IN ('gebucht', 'erledigt', 'verpasst')
          AND (beginn AT TIME ZONE 'Europe/Berlin')::date = ${slot.tag}::date
      `) as any[];
      if (Number(z?.n ?? 0) >= angebot.proTag) {
        throw new TerminFehler("tag_voll", "An diesem Tag sind alle Gespräche vergeben.");
      }
      return terminBuchen({
        personId: zu.personId, agentId: person.id, beginn: slot.beginn,
        quelle: "global", herkunft: "global_seite",
      }, tx);
    });
  } catch (err) {
    if (err instanceof TerminFehler) {
      // „belegt", „tag_voll" und die Zeitgrenzen sind der Alltag zweier
      // gleichzeitiger Klicks. Alles andere (falsche_rolle, agent_unbekannt)
      // heißt: Die zuständige Person KANN keine Gespräche annehmen — das muss
      // jemand sehen, sonst weist der Kalender still jede Buchung ab.
      if (!["belegt", "tag_voll", "zu_frueh", "zu_spaet", "kein_slot", "vergangenheit"].includes(err.code)) {
        console.error(`[GLOBAL-TERMIN] ${person.name} (#${person.id}) kann kein Erstgespräch annehmen — ${err.code}: ${err.message}. Bitte ${SETTING_ZUSTAENDIG} prüfen.`);
      }
      await versuchProtokollieren({ ergebnis: "abgelehnt", grund: err.code, personId: zu.personId, slotBeginn: slot.beginn, agentId: person.id, quelle: "global", akteur: "kunde" });
      const frisch = await globalAngebotLaden();
      return { ok: false, status: 409, grund: err.code, feld: "zeit", angebot: frisch,
        error: frisch.tage.length ? T.zeitVergeben : T.zeitVergebenKeineWeitere };
    }
    throw err;
  }
  await versuchProtokollieren({ ergebnis: "gebucht", personId: zu.personId, slotBeginn: slot.beginn, agentId: person.id, quelle: "global", akteur: "kunde" });

  // Ab hier steht der Termin. Nichts Folgendes darf ihn wieder kippen — jede
  // Stufe fängt ihren eigenen Fehler und schreibt ihn hin.
  const notiz = [
    `Firma: ${k.firma}`,
    `Ansprechpartner: ${k.name} · ${k.telefon} · ${k.email}`,
    k.paketText ? `Paketwunsch: ${k.paketText}` : "Paketwunsch: noch offen",
    k.land ? `Land: ${k.land}` : "",
    en ? "Sprache: Englisch" : "",
    ein.thema ? `Thema: ${ein.thema}` : "",
    `Gebucht über fiaon.com/business (${zu.angelegt ? "neuer Kontakt" : "bekannte Person"}).`,
  ].filter(Boolean).join("\n");
  await sqlPool`UPDATE fiaon_termine SET notiz = ${notiz}, updated_at = NOW() WHERE id = ${buchung.id}`
    .catch((e) => console.error(`[GLOBAL-TERMIN] Notiz an Termin ${buchung.id} nicht geschrieben:`, e));

  // Der Firmen-Lead — ganz oben im Cockpit der zuständigen Person.
  let firmaId: number | null = null;
  try {
    const { globalLeadAufnehmen } = await import("../routes/fiaon-firmen");
    const lead = await globalLeadAufnehmen({
      firma: k.firma, ansprechpartner: k.name, telefon: k.telefon, email: k.email, land: k.land,
      paketwunsch: k.paketText, personId: zu.personId, zustaendigAgentId: person.id,
      status: "termin", ereignis: "termin_gebucht",
      verlauf: `Erstgespräch gebucht: ${buchung.datumText} um ${buchung.uhrzeit} Uhr mit ${person.name}. `
        + `Paketwunsch: ${k.paketText ?? "noch offen"}.${ein.thema ? ` Thema: ${ein.thema}.` : ""}${en ? " Sprache: Englisch." : ""}`,
    });
    firmaId = lead.firmaId;
  } catch (e) {
    console.error(`[GLOBAL-TERMIN] Termin ${buchung.id} steht, aber der Firmen-Lead fehlt — ${k.firma} erscheint NICHT im Firmen-Cockpit:`, e);
  }

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

  // Die Bestätigung an das Unternehmen — über die eine Tür, mit Protokoll.
  const { versendenUndProtokollieren } = await import("./fiaon-mail-log");
  await versendenUndProtokollieren(
    "global_termin",
    globalTerminPayload({
      email: k.email, name: k.name, firma: k.firma, telefon: k.telefon, paketText: k.paketText,
      ansprechpartner: person.name, datumText: buchung.datumText, uhrzeit: buchung.uhrzeit,
      stornoToken: buchung.stornoToken,
      sprache: k.sprache, beginn: buchung.beginn, paket: k.paket,
    }) as any,
    {
      personId: zu.personId, verlaufRef: akte?.ref ?? null,
      verlaufText: `Terminbestätigung (FIAON Global, Erstgespräch) versandt: ${buchung.datumText} um ${buchung.uhrzeit} Uhr.`,
    },
  ).catch((e) => console.error("[GLOBAL-TERMIN] Bestätigung:", e));

  // Der Auftrag an die zuständige Person (E-177-Muster): Portal + Mail.
  try {
    const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
    await auftragFuerKunden({
      personId: null, ref: null,
      titel: `FIAON Global: Erstgespräch ${k.firma} am ${buchung.datumText}, ${buchung.uhrzeit} Uhr`,
      text: [
        "Erstgespräch zu FIAON Global, gebucht über den Kalender auf fiaon.com/business.",
        `Wann: ${buchung.datumText} um ${buchung.uhrzeit} Uhr, ${GLOBAL_DAUER_MIN} Minuten — du rufst an.`,
        `Firma: ${k.firma} · Ansprechpartner: ${k.name}`,
        `Telefon: ${k.telefon} · E-Mail: ${k.email}`,
        `Paketwunsch: ${k.paketText ?? "noch offen"}${k.land ? ` · Land: ${k.land}` : ""}${en ? " · Gespräch auf ENGLISCH" : ""}`,
        ein.thema ? `Thema: ${ein.thema}` : null,
        "\nDer Termin steht in deinem Kalender, die Firma ganz oben im Firmen-Cockpit. Nach dem Gespräch: Termin im Kalender abschließen und im Cockpit festhalten, wie es weitergeht.",
      ].filter(Boolean).join("\n"),
      faelligAm: slot.tag,
      schluessel: `global-termin:${buchung.id}`,
      bereich: "sonstiges",
      link: firmaId ? `/agent/firmen?firma=${firmaId}` : "/agent/kalender",
      quelle: "website",
      autorName: "Website",
      agentId: person.id,
      anlageText: "Erstgespräch über den Gesprächskalender auf fiaon.com/business gebucht.",
    });
    await sqlPool`UPDATE fiaon_termine SET gemeldet_buchung_am = NOW() WHERE id = ${buchung.id}`.catch(() => {});
  } catch (e) {
    console.error(`[GLOBAL-TERMIN] Auftrag zu Termin ${buchung.id} nicht angelegt — ${person.name} sieht das Gespräch nur im Kalender:`, e);
  }

  console.log(`[GLOBAL-TERMIN] #${buchung.id}: ${k.firma} (${k.email}) am ${buchung.datumText} ${buchung.uhrzeit} bei ${person.name}${k.paket ? ` — ${k.paket}` : ""}`);
  return {
    ok: true, terminId: buchung.id, wann: buchung.beginn, datumText: buchung.datumText, uhrzeit: buchung.uhrzeit,
    ansprechpartner: { vorname: person.vorname }, kalenderUrl: globalKalenderUrl(buchung.stornoToken),
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
}): Record<string, string> {
  if (ein.sprache === "en") {
    const g = globalPaket(ein.paket);
    const wann = ein.beginn ? new Date(ein.beginn) : null;
    return {
      email: ein.email, sprache: "en",
      name: ein.name, firma: ein.firma, telefon: ein.telefon,
      paket: g ? `FIAON ${g.en.name}` : "still open — we will clarify it in the call",
      agent_vorname: ein.ansprechpartner,
      // Das Datum im englischen Zahlenbild, in deutscher Zeit — der Anruf kommt aus Deutschland.
      termin_datum: wann && !Number.isNaN(wann.getTime())
        ? wann.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Berlin" })
        : ein.datumText,
      termin_uhrzeit: ein.uhrzeit,
      termin_art: "First call, FIAON Global",
      termin_dauer: String(GLOBAL_DAUER_MIN),
      // ?bereich=business: Die Absage-Seite trägt Kopf und Fuß von FIAON Global, nicht die der Privatkunden (19.09.2026).
      storno_link: `${stornoLink(ein.stornoToken)}?anrede=sie&bereich=business`,
      kalender_url: globalKalenderUrl(ein.stornoToken),
    };
  }
  return {
    email: ein.email,
    name: ein.name,
    firma: ein.firma,
    telefon: ein.telefon,
    paket: ein.paketText ?? "noch offen — wir klären es im Gespräch",
    agent_vorname: ein.ansprechpartner,
    termin_datum: ein.datumText,
    termin_uhrzeit: ein.uhrzeit,
    termin_art: QUELLEN.global.text,
    termin_dauer: String(GLOBAL_DAUER_MIN),
    // ?bereich=business: Die Absage-Seite trägt Kopf und Fuß von FIAON Global, nicht die der Privatkunden (19.09.2026).
    storno_link: `${stornoLink(ein.stornoToken)}?anrede=sie&bereich=business`,
    kalender_url: globalKalenderUrl(ein.stornoToken),
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Die Anfrage — Rückfall ohne freie Zeit und „lieber ein Anruf"
// ───────────────────────────────────────────────────────────────────────────

export async function globalAnfrageAnnehmen(ein: {
  kontakt: GlobalKontakt; wunschzeit: string | null; text: string | null; ip: string;
}): Promise<{ anfrageId: number; zustaendigName: string | null; anBetreiber: boolean }> {
  const k = ein.kontakt;
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
  const [kunde] = (await sqlPool`
    SELECT person_id, ref FROM fiaon_applications
    WHERE LOWER(email) = ${k.email} AND merged_into IS NULL
    ORDER BY (payment_status = 'paid') DESC, created_at DESC LIMIT 1
  `.catch(() => [])) as any[];

  const [row] = (await sqlPool`
    INSERT INTO fiaon_anfragen (art, name, email, firma, telefon, land, text, person_id, ip, zustaendig_agent_id)
    VALUES ('global', ${k.name}, ${k.email}, ${k.firma}, ${k.telefon}, ${k.land}, ${text || null},
            ${kunde?.person_id ?? null}, ${ein.ip}, ${person?.id ?? null})
    RETURNING id
  `) as any[];
  const anfrageId = Number(row.id);

  let firmaId: number | null = null;
  try {
    const { globalLeadAufnehmen } = await import("../routes/fiaon-firmen");
    const lead = await globalLeadAufnehmen({
      firma: k.firma, ansprechpartner: k.name, telefon: k.telefon, email: k.email, land: k.land,
      paketwunsch: k.paketText, personId: kunde?.person_id ? Number(kunde.person_id) : null,
      zustaendigAgentId: person?.id ?? null,
      status: "wiedervorlage", ereignis: "anfrage",
      verlauf: `Bittet um einen Anruf (Anfrage #${anfrageId} von fiaon.com/business). `
        + `Paketwunsch: ${k.paketText ?? "noch offen"}.${ein.wunschzeit ? ` Wunschzeit: ${ein.wunschzeit}.` : ""}`
        + `${k.sprache === "en" ? " Sprache: Englisch." : ""}${ein.text ? ` Nachricht: ${ein.text.slice(0, 600)}` : ""}`,
    });
    firmaId = lead.firmaId;
  } catch (e) {
    console.error(`[GLOBAL-TERMIN] Anfrage #${anfrageId} steht, aber der Firmen-Lead fehlt — ${k.firma} erscheint NICHT im Firmen-Cockpit:`, e);
  }

  // Kein Betreiber-Vermerk mit zwei Tagen Frist: ein Auftrag, fällig HEUTE.
  const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
  const erg = await auftragFuerKunden({
    personId: null, ref: kunde?.ref ?? null,
    titel: `FIAON Global: ${k.firma} bittet um einen Anruf`,
    text: [
      `Anfrage #${anfrageId} von fiaon.com/business — das Unternehmen möchte ein Erstgespräch zu FIAON Global.`,
      `Firma: ${k.firma} · Ansprechpartner: ${k.name}`,
      `Telefon: ${k.telefon} · E-Mail: ${k.email}`,
      `Paketwunsch: ${k.paketText ?? "noch offen"}${k.land ? ` · Land: ${k.land}` : ""}${k.sprache === "en" ? " · Gespräch auf ENGLISCH" : ""}`,
      ein.wunschzeit ? `Wunschzeit: ${ein.wunschzeit}` : null,
      kunde?.ref ? `Ist bereits Kunde (${kunde.ref}).` : null,
      ein.text ? `\nNachricht: ${ein.text.slice(0, 1200)}` : null,
      "\nBitte heute anrufen. Die Firma steht ganz oben im Firmen-Cockpit — dort das Ergebnis festhalten.",
    ].filter(Boolean).join("\n"),
    faelligAm: berlinToday(),
    dringend: true,
    schluessel: `global-anfrage:${anfrageId}`,
    bereich: "sonstiges",
    link: firmaId ? `/agent/firmen?firma=${firmaId}` : "/agent/firmen",
    quelle: "website",
    autorName: "Website",
    agentId: person?.id ?? null,
    anlageText: "Anfrage zu FIAON Global über fiaon.com/business eingegangen.",
  });
  if (erg.agentId && erg.agentId !== person?.id) {
    await sqlPool`UPDATE fiaon_anfragen SET zustaendig_agent_id = ${erg.agentId} WHERE id = ${anfrageId}`.catch(() => {});
  }
  if (kunde?.ref) {
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
      VALUES (${kunde.ref}, ${kunde.person_id ?? null}, NULL, 'System', 'system',
              ${`Anfrage zu FIAON Global über die Website eingegangen (${k.firma}).${erg.agentName ? ` Auftrag bei ${erg.agentName}.` : ""}`})
    `.catch(() => {});
  }
  console.log(`[GLOBAL-TERMIN] Anfrage #${anfrageId}: ${k.firma} (${k.email}) → ${erg.agentName ?? "Betreiber"}`);
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
// Person greift zum Telefon. Eine eigene, gesiezte „Wir haben Sie nicht
// erreicht"-Mail für Unternehmen wäre der nächste Schritt; sie fehlt mit
// Absicht, bis jemand den Text freigibt.
// ───────────────────────────────────────────────────────────────────────────

const NICHT_ZUSTANDE_TEXT: Record<string, string> = {
  nicht_erschienen: "nicht erreicht zum vereinbarten Termin",
  nummer_falsch: "die hinterlegte Rufnummer stimmt nicht",
  abgesagt: "vom Unternehmen abgesagt bzw. die Zeit passte nicht",
  kein_interesse: "kein Interesse mehr, vom Unternehmen erklärt",
};

export async function globalTerminErgebnis(ein: {
  terminId: number; personId: number; beginn: Date | string;
  agent: { id: number; name: string };
  ergebnis: "erledigt" | "verpasst";
  /** Nur bei „verpasst": einer der vier Gründe aus dem Kalender. */
  grund?: string | null;
  notiz?: string | null;
}): Promise<{ hinweis: string }> {
  const wann = `${berlinDatumText(ein.beginn)}, ${berlinUhrzeit(ein.beginn)} Uhr`;
  const notiz = ein.notiz ? String(ein.notiz).trim().slice(0, 2000) : "";
  const grundText = ein.grund ? (NICHT_ZUSTANDE_TEXT[ein.grund] ?? ein.grund) : "nicht zustande gekommen";
  const vermerk = ein.ergebnis === "erledigt"
    ? "Erstgespräch geführt."
    : `Erstgespräch kam nicht zustande — ${grundText}.`;

  // Anhängen, nicht ersetzen: In der Notiz steht, was das Unternehmen bei der
  // Buchung angegeben hat — das braucht auch der, der in drei Wochen nachliest.
  const notizZeile = notiz ? `${vermerk} ${notiz}` : vermerk;
  await sqlPool`
    UPDATE fiaon_termine
    SET status = ${ein.ergebnis}, erledigt_am = NOW(),
        notiz = CONCAT_WS(E'\n', NULLIF(notiz, ''), ${notizZeile}::text),
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
    verlauf: `${vermerk.replace(/\.$/, "")} (${wann}).${notiz ? ` ${notiz}` : ""}`,
    agent: ein.agent,
    kontakt: ein.ergebnis === "erledigt",
  }).catch((e) => { console.error(`[GLOBAL-TERMIN] Ergebnis von Termin ${ein.terminId} nicht im Firmen-Topf vermerkt:`, e); return { firmaId: null }; });

  // Der Auftrag zum Gespräch ist damit erledigt — sonst steht er weiter offen.
  await sqlPool`
    UPDATE fiaon_betreiber_todos
    SET status = 'erledigt', erledigt_am = NOW(), erledigt_von = ${ein.agent.name}, ergebnis = ${vermerk},
        updated_at = NOW(), letzte_aktivitaet = NOW()
    WHERE schluessel = ${`global-termin:${ein.terminId}`} AND status <> 'erledigt'
  `.catch(() => {});

  const wo = lead.firmaId ? " Die Firma steht im Firmen-Cockpit" : " Im Firmen-Cockpit gibt es zu diesem Kontakt keine Firma";
  if (ein.ergebnis === "erledigt") {
    return { hinweis: `Erstgespräch als geführt vermerkt.${wo}${lead.firmaId ? " — mit Wiedervorlage morgen. Halte dort fest, wie es weitergeht." : "."}` };
  }
  return {
    hinweis: keinInteresse
      ? `Vermerkt.${wo}${lead.firmaId ? " jetzt auf „kein Interesse“." : "."} Es geht keine Mail raus.`
      : `Vermerkt.${wo}${lead.firmaId ? " wieder ganz oben — bitte heute noch einmal anrufen." : "."} Bei FIAON Global geht keine automatische Mail raus: Die Mails dieses Knopfes sind für Privatkunden geschrieben.`,
  };
}

/** Das Unternehmen (oder der Mitarbeiter) hat abgesagt — der Lead geht zurück auf die Tagesliste. */
export async function globalTerminAbgesagt(ein: {
  terminId: number; personId: number; beginn: Date | string; wer: "kunde" | "agent";
}): Promise<void> {
  const wann = `${berlinDatumText(ein.beginn)}, ${berlinUhrzeit(ein.beginn)} Uhr`;
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
  await sqlPool`
    UPDATE fiaon_betreiber_todos
    SET status = 'erledigt', erledigt_am = NOW(), erledigt_von = 'System',
        ergebnis = ${`Gespräch abgesagt (${ein.wer === "kunde" ? "durch das Unternehmen" : "durch uns"}).`},
        updated_at = NOW(), letzte_aktivitaet = NOW()
    WHERE schluessel = ${`global-termin:${ein.terminId}`} AND status <> 'erledigt'
  `.catch(() => {});
}

// ───────────────────────────────────────────────────────────────────────────
// Die Kalenderdatei zum Termin
// ───────────────────────────────────────────────────────────────────────────

export async function globalKalenderZuToken(stornoToken: string): Promise<{ datei: string; abgesagt: boolean } | null> {
  if (!/^[0-9a-f]{48}$/.test(stornoToken)) return null;
  const [t] = (await sqlPool`
    SELECT t.id, t.beginn, COALESCE(t.dauer_min, ${GLOBAL_DAUER_MIN}) AS dauer_min, t.status, t.created_at,
           ag.name AS agent_name, p.primary_phone AS telefon
    FROM fiaon_termine t
    LEFT JOIN fiaon_agents ag ON ag.id = t.agent_id
    LEFT JOIN fiaon_persons p ON p.id = t.person_id
    WHERE t.storno_token = ${stornoToken} AND t.quelle = 'global'
    LIMIT 1
  `) as any[];
  if (!t) return null;
  return {
    abgesagt: String(t.status) === "abgesagt",
    datei: globalKalenderDatei({
      terminId: Number(t.id), beginn: t.beginn, dauerMin: Number(t.dauer_min),
      ansprechpartner: String(t.agent_name || "Ihr Ansprechpartner"),
      telefon: t.telefon ?? null,
      stornoLink: `${stornoLink(stornoToken)}?anrede=sie&bereich=business`,
      erstelltAm: t.created_at ? new Date(t.created_at) : undefined,
    }),
  };
}
