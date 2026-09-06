// ═══════════════════════════════════════════════════════════════════════════
// DER MONATSBERICHT — ein Beleg, keine Anzeige (Scheibe 6, Modul A, 06.09.2026)
//
// Bauvorlage /app 3.11: Einmal im Monat bekommt der Kunde EINE Zahl, die er
// Posten für Posten nachrechnen kann — was in seinem Namen bewilligt wurde,
// was noch unterwegs ist, welche Raten eingegangen sind, wie weit sein Weg ist.
//
// GRUNDSÄTZE
//   · Jede Zahl kommt aus einem Datenfeld (fiaon_vorgang_ereignisse 'bewilligt',
//     fiaon_ansprueche.betrag_cents, fiaon_abo_raten). Nichts wird geschätzt.
//   · Die eigene Rate ist NIE die große Zahl. Die große Zahl ist, was FIAON in
//     diesem Monat für den Kunden geholt hat — bewilligte monatliche Beträge.
//   · Ein gespeicherter Bericht wird NICHT neu gerechnet. Er ist der Beleg für
//     den Monat, so wie er am Erstellungstag stand. Wer einen Monat später
//     einen Vorgang nachträgt, ändert den nächsten Bericht — nicht diesen.
//   · Keine Zusage, kein Vergleich, kein „%“, keine Zeitprognose. Der Satz zum
//     nächsten Schritt kommt aus rahmenwegAus (shared/fiaon-rahmenweg.ts) —
//     dieselbe Rechnung wie der Balken in der App, keine zweite Wahrheit.
//   · Der „Weg“ nimmt DIESELBEN Quellen wie GET /kunde/:ref/bereich
//     (fiaon-kunde-bereich.ts): Unterlagen aus fiaon_applications, Bonität aus
//     bonitaetFuer(), Kartenstand aus kartenStand(), Startgespräch aus Termin
//     oder Verlauf.
//   · Berliner Datum nur über formatToParts (berlinHeute) bzw. AT TIME ZONE in
//     SQL — Zeit-Falle vom 01.09.2026.
//
// TABELLE: db/migrations/082_app_bericht_push_login.sql, Abschnitt A — dieselbe
// DDL unten in ensureBerichtTabelle (idempotent).
//
// LAUF: monatsberichtLauf() — täglich, wirkt nur am 1. bis 3. eines Monats.
// Erzeugt den Vormonat für alle Personen mit bezahlter Bestellung (LIMIT 500 je
// Lauf, idempotent über UNIQUE (person_id, monat)). Die Mail app_monatsbericht
// geht nur, wenn fiaon_settings.app_bericht_mail = 'an' (Standard: aus).
// Registrierung in routes.ts über tageslauf('monatsbericht', …) macht die
// Hauptsitzung.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { pushBeiEreignis } from "./fiaon-push";
import { berlinHeute, tag } from "../routes/fiaon-app";
import { rahmenwegAus, type BereichEingang } from "@shared/fiaon-rahmenweg";
import { FRAGEN, beantwortet, type Antworten } from "@shared/fiaon-ansprueche";
import { wandPruefen, wandUrteil } from "@shared/fiaon-wortverbote";

type Lauf = typeof sqlPool;

// ── Tabelle ─────────────────────────────────────────────────────────────────
let tabelleBereit: Promise<void> | null = null;
export function ensureBerichtTabelle(): Promise<void> {
  if (!tabelleBereit) {
    tabelleBereit = (async () => {
      await sqlPool`CREATE TABLE IF NOT EXISTS fiaon_monatsberichte (
        id BIGSERIAL PRIMARY KEY, person_id BIGINT NOT NULL, monat DATE NOT NULL,
        grosse_zahl_cents INTEGER NOT NULL DEFAULT 0, grosse_zahl_text TEXT NOT NULL,
        beantragt_cents INTEGER NOT NULL DEFAULT 0, gezahlt_cents INTEGER NOT NULL DEFAULT 0,
        kennzahlen JSONB NOT NULL DEFAULT '{}'::jsonb, erzeugt_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        versandt_am TIMESTAMPTZ, gelesen_am TIMESTAMPTZ, UNIQUE (person_id, monat))`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_monatsberichte_person_idx ON fiaon_monatsberichte (person_id, monat DESC)`;
    })().catch((e) => { tabelleBereit = null; throw e; });
  }
  return tabelleBereit;
}

// ── Datum (Berlin) ──────────────────────────────────────────────────────────
const pad2 = (n: number) => String(n).padStart(2, "0");

/** Heutiges Berliner Datum als YYYY-MM-DD. */
export function heuteIsoBerlin(): string {
  const h = berlinHeute();
  return `${h.j}-${pad2(h.m)}-${pad2(h.t)}`;
}

/** Erster Tag des Monats von YYYY-MM oder YYYY-MM-DD → YYYY-MM-01; sonst null. */
export function monatIsoVon(roh: unknown): string | null {
  const m = /^(\d{4})-(0[1-9]|1[0-2])(?:-\d{2})?$/.exec(String(roh ?? "").trim());
  return m ? `${m[1]}-${m[2]}-01` : null;
}

/** YYYY-MM-01 → der Monat davor bzw. danach, ebenfalls als YYYY-MM-01. */
export function monatVerschieben(monatIso: string, um: number): string {
  const j = Number(monatIso.slice(0, 4)); const m = Number(monatIso.slice(5, 7));
  const d = new Date(Date.UTC(j, m - 1 + um, 1, 12));
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-01`;
}

/** „August 2026“ */
export function monatText(monatIso: string): string {
  const j = Number(monatIso.slice(0, 4)); const m = Number(monatIso.slice(5, 7));
  return new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(j, m - 1, 1, 12)));
}

/** „August“ — nur der Monatsname, für den Satz der großen Zahl. */
export function monatName(monatIso: string): string {
  const j = Number(monatIso.slice(0, 4)); const m = Number(monatIso.slice(5, 7));
  return new Intl.DateTimeFormat("de-DE", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(j, m - 1, 1, 12)));
}

/** Aktueller Berliner Monat als YYYY-MM-01. */
export function aktuellerMonatIso(): string {
  const h = berlinHeute();
  return `${h.j}-${pad2(h.m)}-01`;
}

/** DATE-Spalte (String oder Date) → YYYY-MM-DD, sonst null. */
function isoVon(d: unknown): string | null {
  if (!d) return null;
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
  const x = new Date(d as any);
  return Number.isNaN(x.getTime()) ? null : x.toISOString().slice(0, 10);
}

export const eurText = (cents: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);

// ── Datenmodell ─────────────────────────────────────────────────────────────
export interface BerichtPosten {
  vorgangId: number;
  /** Titel der Vorgangsart, wie der Kunde sie liest (ART_TITEL). */
  titel: string;
  betragCents: number | null;
  monatlich: boolean;
  /** dd.mm.yyyy */
  bewilligtAm: string | null;
  aktenzeichen: string | null;
}

export interface BerichtUnterwegs {
  vorgangId: number;
  titel: string;
  empfaenger: string | null;
  versandtAm: string | null;
  fristAm: string | null;
  aktenzeichen: string | null;
  betragCents: number | null;
  monatlich: boolean;
  stand: string;
}

export interface BerichtKennzahlen {
  monatText: string;
  /** Berliner Datum, an dem gerechnet wurde (YYYY-MM-DD). */
  heuteIso: string;
  posten: BerichtPosten[];
  /** Einmalige bewilligte Beträge — gesondert, nie Teil der großen Zahl. */
  einmaligCents: number;
  unterwegs: BerichtUnterwegs[];
  beantragtMonatlichCents: number;
  beantragtEinmaligCents: number;
  raten: { anzahl: number; puenktlich: number; gezahltCents: number };
  weg: { erledigt: number; gesamt: number; vormonatErledigt: number | null };
  naechstes: string;
  /** Letzter abgelehnter Mailversuch (Berliner Tag, Grund) — nur Betrieb, nie Kundentext. */
  mail?: { versuchAm: string; grund: string };
}

export interface Monatsbericht {
  id: number;
  personId: number;
  /** YYYY-MM */
  monat: string;
  monatText: string;
  grosseZahlCents: number;
  grosseZahlText: string;
  beantragtCents: number;
  gezahltCents: number;
  kennzahlen: BerichtKennzahlen;
  erzeugtAm: string | null;
  versandtAm: string | null;
  gelesenAm: string | null;
}

/** Titel je Vorgangsart — dieselben Worte wie fiaon-app.ts/fiaon-app-antraege.ts (ART_TITEL). */
const ART_TITEL: Record<string, string> = {
  brief: "Ihr Brief", p_konto: "Antrag: höherer Schutzbetrag (P-Konto)", p_konto_umwandlung: "Umwandlung in ein P-Konto",
  rundfunk: "Antrag: Befreiung vom Rundfunkbeitrag", selbstauskunft: "Selbstauskunft (Art. 15 DSGVO)", wohngeld: "Anschreiben Wohngeldstelle",
  kfz: "Kündigung Kfz-Versicherung", handy: "Kündigung Handyvertrag",
};

const KEIN_BETRAG_TEXT = "In diesem Monat ist noch kein Betrag entstanden.";

function zeileZuBericht(z: any): Monatsbericht {
  const k = (z.kennzahlen && typeof z.kennzahlen === "object" ? z.kennzahlen : {}) as Partial<BerichtKennzahlen>;
  const monatIso = isoVon(z.monat) ?? "1970-01-01";
  return {
    id: Number(z.id), personId: Number(z.person_id), monat: monatIso.slice(0, 7), monatText: k.monatText ?? monatText(monatIso),
    grosseZahlCents: Number(z.grosse_zahl_cents || 0), grosseZahlText: String(z.grosse_zahl_text || KEIN_BETRAG_TEXT),
    beantragtCents: Number(z.beantragt_cents || 0), gezahltCents: Number(z.gezahlt_cents || 0),
    kennzahlen: {
      monatText: k.monatText ?? monatText(monatIso), heuteIso: k.heuteIso ?? "",
      posten: Array.isArray(k.posten) ? k.posten : [], einmaligCents: Number(k.einmaligCents || 0),
      unterwegs: Array.isArray(k.unterwegs) ? k.unterwegs : [],
      beantragtMonatlichCents: Number(k.beantragtMonatlichCents || 0), beantragtEinmaligCents: Number(k.beantragtEinmaligCents || 0),
      raten: k.raten ?? { anzahl: 0, puenktlich: 0, gezahltCents: 0 },
      weg: k.weg ?? { erledigt: 0, gesamt: 0, vormonatErledigt: null },
      naechstes: k.naechstes ?? "",
      mail: k.mail,
    },
    erzeugtAm: tag(z.erzeugt_am), versandtAm: tag(z.versandt_am), gelesenAm: tag(z.gelesen_am),
  };
}

/** Ein gespeicherter Bericht — oder null. */
export async function berichtLaden(personId: number, monatIso: string, lauf: Lauf = sqlPool): Promise<Monatsbericht | null> {
  const [z] = (await lauf`SELECT * FROM fiaon_monatsberichte WHERE person_id = ${personId} AND monat = ${monatIso}::date LIMIT 1`) as any[];
  return z ? zeileZuBericht(z) : null;
}

/** Alle Berichte einer Person, neuester zuerst. */
export async function berichteListe(personId: number, lauf: Lauf = sqlPool): Promise<Monatsbericht[]> {
  const zeilen = (await lauf`SELECT * FROM fiaon_monatsberichte WHERE person_id = ${personId} ORDER BY monat DESC LIMIT 36`) as any[];
  return zeilen.map(zeileZuBericht);
}

/** Der jüngste Bericht — für „Zahl des Monats“ auf Heute. */
export async function letzterBericht(personId: number, lauf: Lauf = sqlPool): Promise<Monatsbericht | null> {
  const [z] = (await lauf`SELECT * FROM fiaon_monatsberichte WHERE person_id = ${personId} ORDER BY monat DESC LIMIT 1`) as any[];
  return z ? zeileZuBericht(z) : null;
}

/** gelesen_am setzen, wenn leer — der Kunde hat den Bericht geöffnet. */
export async function berichtGelesen(id: number, personId: number, lauf: Lauf = sqlPool): Promise<void> {
  await lauf`UPDATE fiaon_monatsberichte SET gelesen_am = NOW() WHERE id = ${id} AND person_id = ${personId} AND gelesen_am IS NULL`;
}

/**
 * Ein Kundensatz gegen die Wortwand — harte Treffer ersetzen den Satz durch
 * den Rückfall und stehen im Log. Der Bericht ist ein Beleg; ein verbotenes
 * Wort darin wäre ein Beleg für das Falsche.
 */
function sicherSatz(satz: string, rueckfall: string): string {
  const funde = wandPruefen(satz);
  if (wandUrteil(funde).sendbar) return satz;
  console.error(`[BERICHT] Wortwand: ${funde.map((f) => f.treffer).join(", ")} — in: ${satz}`);
  return rueckfall;
}

// ── Der Weg: dieselben Quellen wie GET /kunde/:ref/bereich ──────────────────
async function wegRechnen(personId: number, heuteIso: string, lauf: Lauf): Promise<{ erledigt: number; gesamt: number; naechstes: string }> {
  // Die maßgebliche Bestellung: bezahlte zuletzt, sonst die jüngste — dieselbe
  // Auswahlregel wie der Login (fiaon-login-logic.ts).
  const [a] = (await lauf`
    SELECT a.ref, a.payment_status, a.wanted_limit,
           (a.bank_statement_pdf IS NOT NULL) AS hat_kontoauszug, (a.id_card_pdf IS NOT NULL) AS hat_ausweis,
           a.reupload_bank_statement, a.reupload_id_card
      FROM fiaon_applications a
     WHERE a.person_id = ${personId} AND a.merged_into IS NULL AND a.archived_at IS NULL AND a.gdpr_deleted_at IS NULL
     ORDER BY (a.payment_status = 'paid') DESC, a.created_at DESC LIMIT 1`) as any[];
  const ref: string | null = a?.ref ? String(a.ref) : null;

  // Startgespräch: erledigter Onboarding-Termin oder dokumentiertes Gespräch (fiaon-kunde-bereich.ts).
  const [ob] = (await lauf`
    SELECT EXISTS (SELECT 1 FROM fiaon_termine t WHERE t.person_id = ${personId} AND t.quelle = 'onboarding_call' AND t.status = 'erledigt') AS termin_erledigt,
           EXISTS (SELECT 1 FROM fiaon_contact_log cl WHERE cl.person_id = ${personId} AND cl.type IN ('onboarding', 'startgespraech')) AS gespraech_im_verlauf`) as any[];
  const onboardingGelaufen = !!(ob?.termin_erledigt || ob?.gespraech_im_verlauf);

  // Gebuchtes Startgespräch (Muster fiaon-kunde-bereich.ts): rahmenwegAus sagt
  // dann „Ihr Termin steht“ statt „Zeit wählen“ — ohne den Termin wäre „Als
  // Nächstes“ im Bericht falsch adressiert.
  const [nt] = (await lauf`
    SELECT beginn, status FROM fiaon_termine
     WHERE person_id = ${personId} AND quelle = 'onboarding_call' AND status = 'gebucht' AND beginn >= NOW()
     ORDER BY beginn ASC LIMIT 1`) as any[];
  const termin: BereichEingang["termin"] = nt?.beginn
    ? { beginn: nt.beginn instanceof Date ? nt.beginn.toISOString() : String(nt.beginn), status: String(nt.status), agent: null }
    : null;

  // Bonität: dieselbe Funktion wie Bereich und Akte.
  let bonitaet: BereichEingang["bonitaet"] = null;
  if (ref) {
    try {
      const { bonitaetFuer } = await import("./fiaon-bonitaet-status");
      const b = await bonitaetFuer(ref);
      if (b) bonitaet = { hatDokument: !!b.hatDokument, geprueft: !!b.dokumentGeprueft, darfKaufen: !!b.darfKaufen, bezahlt: !!b.bezahlt };
    } catch (e: any) { console.error("[BERICHT] bonitaetFuer:", e?.message || e); }
  }

  // Karte: kartenStand — Tore und Versand des Konto-und-Karte-Wegs.
  let karte: BereichEingang["karte"] = null;
  try {
    const { kartenStand } = await import("./fiaon-konto-karte");
    const ks = await kartenStand(personId);
    if (ks) karte = { verschickt: !!ks.versand, tore: (ks.tore || []).map((t) => ({ titel: t.titel, erfuellt: t.erfuellt })) };
  } catch (e: any) { console.error("[BERICHT] kartenStand:", e?.message || e); }

  // Raten der maßgeblichen Bestellung.
  const raten = ref ? ((await lauf`SELECT rate_nr, betrag_cents, faellig_am, status, bezahlt_am FROM fiaon_abo_raten WHERE ref = ${ref} ORDER BY faellig_am ASC`) as any[]) : [];

  // Anspruchs-Check: beantwortete Fragen — dieselbe Zählung wie checkAntwort (fiaon-app.ts).
  const antwortZeilen = (await lauf`SELECT frage_schluessel, wert FROM fiaon_anspruch_antworten WHERE person_id = ${personId}`) as any[];
  const antworten: Record<string, unknown> = {};
  for (let i = 0; i < antwortZeilen.length; i++) antworten[antwortZeilen[i].frage_schluessel] = antwortZeilen[i].wert;
  const check = { beantwortet: beantwortet(antworten as Antworten), gesamt: FRAGEN.length };

  // Versandte Anträge — dieselbe Zählung wie Bereich.tsx (versandt, nachfrage, bewilligt).
  const [vz] = (await lauf`SELECT COUNT(*)::int AS n FROM fiaon_vorgaenge WHERE person_id = ${personId} AND stand IN ('versandt', 'nachfrage', 'bewilligt')`) as any[];

  const eingang: BereichEingang = {
    // rahmenwegAus liest nur `bezahlt`; vollAktiv wird dort nicht ausgewertet.
    stufe: { bezahlt: String(a?.payment_status || "") === "paid", vollAktiv: false },
    onboardingGelaufen,
    termin,
    unterlagen: { kontoauszug: !!a?.hat_kontoauszug, ausweis: !!a?.hat_ausweis, erneutKontoauszug: !!a?.reupload_bank_statement, erneutAusweis: !!a?.reupload_id_card },
    kontoVerbunden: false,
    bonitaet,
    abo: { raten: raten.map((r) => ({ nr: Number(r.rate_nr), betragCents: Number(r.betrag_cents), status: String(r.status), faelligAm: tag(r.faellig_am), faelligIso: isoVon(r.faellig_am), bezahltAm: tag(r.bezahlt_am) })) },
    karte,
    paket: { wunschlimit: a?.wanted_limit != null ? Number(a.wanted_limit) : null, rahmen: null },
    fahrplan: [],
  };
  const rw = rahmenwegAus(eingang, { heuteIso, check, vorgaengeVersandt: Number(vz?.n || 0) });

  // „Als Nächstes“: ein Satz aus jetzt.kurz — ohne Zeit, ohne Zusage.
  let naechstes = "Alle Schritte Ihres Weges sind erledigt.";
  if (rw.jetzt) naechstes = rw.jetzt.wer === "kunde" ? `Als Nächstes: ${rw.jetzt.kurz}.` : `Wir arbeiten an: ${rw.jetzt.kurz}.`;
  return { erledigt: rw.erledigt, gesamt: rw.gesamt, naechstes: sicherSatz(naechstes, "Den nächsten Schritt sehen Sie unter „Mein Weg“.") };
}

// ── Erzeugen ────────────────────────────────────────────────────────────────
/**
 * Den Bericht eines Monats zusammenstellen und speichern.
 *
 * Existiert er schon, kommt der gespeicherte zurück (neu: false) — er wird
 * NICHT neu gerechnet. Der Monat muss abgeschlossen sein (monatIso < aktueller
 * Monat); für den laufenden oder einen künftigen Monat wirft die Funktion.
 */
export async function berichtErzeugen(
  personId: number, monatIso: string, heuteIso: string = heuteIsoBerlin(), lauf: Lauf = sqlPool,
): Promise<{ neu: boolean; bericht: Monatsbericht }> {
  await ensureBerichtTabelle();
  const monat = monatIsoVon(monatIso);
  if (!monat) throw new Error(`Ungültiger Monat: ${monatIso}`);
  if (monat >= aktuellerMonatIso()) throw new Error(`Der Bericht für ${monatText(monat)} entsteht erst nach Monatsende.`);

  const vorhanden = await berichtLaden(personId, monat, lauf);
  if (vorhanden) return { neu: false, bericht: vorhanden };

  const bis = monatVerschieben(monat, 1); // erster Tag des Folgemonats, exklusiv

  // 1 · Posten: Vorgänge, deren jüngstes Ergebnis „bewilligt“ ist und in den Monat fällt.
  //     Maßgeblich ist das EREIGNIS; v.stand darf inzwischen 'erledigt' sein (CHECK-Liste 080) —
  //     ein im Monat bewilligter Vorgang fällt dadurch nicht aus dem Beleg.
  const bewilligt = (await lauf`
    SELECT v.id, v.art, v.aktenzeichen, e.am, an.betrag_cents, an.monatlich
      FROM fiaon_vorgaenge v
      JOIN LATERAL (SELECT x.art, x.am FROM fiaon_vorgang_ereignisse x
                     WHERE x.vorgang_id = v.id AND x.art IN ('bewilligt', 'abgelehnt')
                     ORDER BY x.am DESC, x.id DESC LIMIT 1) e ON TRUE
      LEFT JOIN fiaon_ansprueche an ON an.id = v.anspruch_id
     WHERE v.person_id = ${personId} AND v.stand IN ('bewilligt', 'erledigt') AND e.art = 'bewilligt'
       AND (e.am AT TIME ZONE 'Europe/Berlin')::date >= ${monat}::date
       AND (e.am AT TIME ZONE 'Europe/Berlin')::date < ${bis}::date
     ORDER BY e.am ASC`) as any[];
  const posten: BerichtPosten[] = [];
  let grosseZahlCents = 0, einmaligCents = 0;
  for (let i = 0; i < bewilligt.length; i++) {
    const z = bewilligt[i];
    const betrag = z.betrag_cents == null ? null : Number(z.betrag_cents);
    const monatlich = z.monatlich !== false;
    if (betrag != null && betrag > 0) { if (monatlich) grosseZahlCents += betrag; else einmaligCents += betrag; }
    posten.push({ vorgangId: Number(z.id), titel: ART_TITEL[z.art] ?? String(z.art), betragCents: betrag, monatlich, bewilligtAm: tag(z.am), aktenzeichen: z.aktenzeichen ?? null });
  }

  // 2 · Unterwegs: versandt oder in Nachfrage — Stand am Erstellungstag.
  const offen = (await lauf`
    SELECT v.id, v.art, v.stand, v.aktenzeichen, v.empfaenger_name, v.versandt_am, v.frist_am, an.betrag_cents, an.monatlich
      FROM fiaon_vorgaenge v LEFT JOIN fiaon_ansprueche an ON an.id = v.anspruch_id
     WHERE v.person_id = ${personId} AND v.stand IN ('versandt', 'nachfrage')
     ORDER BY v.versandt_am ASC NULLS LAST, v.id ASC`) as any[];
  const unterwegs: BerichtUnterwegs[] = [];
  let beantragtCents = 0, beantragtMonatlichCents = 0, beantragtEinmaligCents = 0;
  for (let i = 0; i < offen.length; i++) {
    const z = offen[i];
    const betrag = z.betrag_cents == null ? null : Number(z.betrag_cents);
    const monatlich = z.monatlich !== false;
    if (betrag != null && betrag > 0) { beantragtCents += betrag; if (monatlich) beantragtMonatlichCents += betrag; else beantragtEinmaligCents += betrag; }
    unterwegs.push({ vorgangId: Number(z.id), titel: ART_TITEL[z.art] ?? String(z.art), empfaenger: z.empfaenger_name ?? null, versandtAm: tag(z.versandt_am), fristAm: tag(z.frist_am), aktenzeichen: z.aktenzeichen ?? null, betragCents: betrag, monatlich, stand: String(z.stand) });
  }

  // 3 · Raten: im Monat gezahlt (Berliner Tag der Buchung), pünktlich = am oder vor dem Fälligkeitstag.
  const [rz] = (await lauf`
    SELECT COUNT(*)::int AS anzahl,
           COUNT(*) FILTER (WHERE (r.bezahlt_am AT TIME ZONE 'Europe/Berlin')::date <= r.faellig_am)::int AS puenktlich,
           COALESCE(SUM(r.betrag_cents), 0)::int AS gezahlt_cents
      FROM fiaon_abo_raten r
      JOIN fiaon_applications a ON a.ref = r.ref
     WHERE a.person_id = ${personId} AND a.merged_into IS NULL
       AND r.status = 'bezahlt' AND r.bezahlt_am IS NOT NULL
       AND (r.bezahlt_am AT TIME ZONE 'Europe/Berlin')::date >= ${monat}::date
       AND (r.bezahlt_am AT TIME ZONE 'Europe/Berlin')::date < ${bis}::date`) as any[];
  const raten = { anzahl: Number(rz?.anzahl || 0), puenktlich: Number(rz?.puenktlich || 0), gezahltCents: Number(rz?.gezahlt_cents || 0) };

  // 4 · Weg — und der Vormonat nur, wenn ein gespeicherter Bericht existiert.
  const weg = await wegRechnen(personId, heuteIso, lauf);
  const vormonat = await berichtLaden(personId, monatVerschieben(monat, -1), lauf);
  const vormonatErledigt = vormonat ? Number(vormonat.kennzahlen.weg?.erledigt ?? 0) : null;

  // 5 · Die große Zahl in Worten — nie die eigene Rate.
  const grosseZahlText = sicherSatz(
    grosseZahlCents > 0 ? `Im ${monatName(monat)} für Sie geholt: ${eurText(grosseZahlCents)} im Monat.` : KEIN_BETRAG_TEXT,
    KEIN_BETRAG_TEXT,
  );

  const kennzahlen: BerichtKennzahlen = {
    monatText: monatText(monat), heuteIso, posten, einmaligCents, unterwegs, beantragtMonatlichCents, beantragtEinmaligCents,
    raten, weg: { erledigt: weg.erledigt, gesamt: weg.gesamt, vormonatErledigt }, naechstes: weg.naechstes,
  };

  // 6 · Speichern — der erste gewinnt; ein paralleler Lauf ändert nichts.
  const [neu] = (await lauf`
    INSERT INTO fiaon_monatsberichte (person_id, monat, grosse_zahl_cents, grosse_zahl_text, beantragt_cents, gezahlt_cents, kennzahlen)
    VALUES (${personId}, ${monat}::date, ${grosseZahlCents}, ${grosseZahlText}, ${beantragtCents}, ${raten.gezahltCents}, ${lauf.json(kennzahlen as any)})
    ON CONFLICT (person_id, monat) DO NOTHING
    RETURNING *`) as any[];
  if (neu) return { neu: true, bericht: zeileZuBericht(neu) };
  const doch = await berichtLaden(personId, monat, lauf);
  if (!doch) throw new Error("Bericht konnte weder gespeichert noch gelesen werden.");
  return { neu: false, bericht: doch };
}

// ── Der Lauf ────────────────────────────────────────────────────────────────
export interface MonatsberichtLaufErgebnis {
  /** Berichtsmonat YYYY-MM-01 — null, wenn der Lauf heute nichts zu tun hat. */
  monat: string | null;
  erzeugt: number;
  vorhanden: number;
  fehler: number;
  /** Mails: nur bei fiaon_settings.app_bericht_mail = 'an'. */
  mailSchalter: boolean;
  versandt: number;
  nichtVersandt: number;
  uebersprungen: string | null;
}

/** Abgelehnten Mailversuch am Bericht vermerken (kennzahlen.mail) — der Beleg selbst bleibt unangetastet. */
async function mailVersuchVermerken(berichtId: number, heuteIso: string, grund: string): Promise<void> {
  try {
    await sqlPool`
      UPDATE fiaon_monatsberichte
         SET kennzahlen = kennzahlen || ${sqlPool.json({ mail: { versuchAm: heuteIso, grund } })}::jsonb
       WHERE id = ${berichtId} AND versandt_am IS NULL`;
  } catch (e: any) { console.error("[BERICHT] Mailvermerk:", e?.message || e); }
}

/** fiaon_settings.app_bericht_mail = 'an' — sonst wird nur erzeugt, nicht gemailt. */
export async function berichtMailFreigeschaltet(lauf: Lauf = sqlPool): Promise<boolean> {
  try {
    const [r] = (await lauf`SELECT value FROM fiaon_settings WHERE key = 'app_bericht_mail' LIMIT 1`) as any[];
    return String(r?.value || "").trim().toLowerCase() === "an";
  } catch { return false; }
}

/**
 * Täglicher Lauf. Wirkt nur am 1. bis 3. eines Monats (Berlin) und erzeugt
 * den Vormonat für jede Person mit bezahlter Bestellung — höchstens 500 je
 * Lauf, idempotent (UNIQUE person_id, monat). Danach die Mail, wenn der
 * Schalter an ist; versandt_am hält fest, was raus ist.
 *
 * `opts.monatIso` erzwingt einen anderen (abgeschlossenen) Monat, `opts.auchAusserhalb`
 * lässt den Lauf auch nach dem 3. arbeiten — beides nur für den Prüfstand.
 */
export async function monatsberichtLauf(opts: { monatIso?: string; auchAusserhalb?: boolean; grenze?: number } = {}): Promise<MonatsberichtLaufErgebnis> {
  const leer: MonatsberichtLaufErgebnis = { monat: null, erzeugt: 0, vorhanden: 0, fehler: 0, mailSchalter: false, versandt: 0, nichtVersandt: 0, uebersprungen: null };
  const heute = berlinHeute();
  if (heute.t > 3 && !opts.auchAusserhalb && !opts.monatIso) {
    return { ...leer, uebersprungen: `Heute ist der ${heute.t}. — der Lauf arbeitet nur am 1. bis 3. eines Monats.` };
  }
  await ensureBerichtTabelle();
  const monat = opts.monatIso ? monatIsoVon(opts.monatIso) : monatVerschieben(aktuellerMonatIso(), -1);
  if (!monat || monat >= aktuellerMonatIso()) return { ...leer, uebersprungen: `Ungültiger Berichtsmonat: ${opts.monatIso ?? "?"}` };
  const heuteIso = heuteIsoBerlin();
  const grenze = Math.max(1, Math.min(500, Math.floor(opts.grenze ?? 500)));

  // Alle Menschen mit bezahlter Bestellung, für die der Monat noch fehlt.
  const personen = (await sqlPool`
    SELECT DISTINCT a.person_id
      FROM fiaon_applications a
      JOIN fiaon_persons p ON p.id = a.person_id
     WHERE a.payment_status = 'paid' AND a.person_id IS NOT NULL AND a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
       AND p.merged_into_person_id IS NULL
       AND NOT EXISTS (SELECT 1 FROM fiaon_monatsberichte b WHERE b.person_id = a.person_id AND b.monat = ${monat}::date)
     ORDER BY a.person_id ASC
     LIMIT ${grenze}`) as any[];

  const erg: MonatsberichtLaufErgebnis = { ...leer, monat };
  for (let i = 0; i < personen.length; i++) {
    const personId = Number(personen[i].person_id);
    try {
      const r = await berichtErzeugen(personId, monat, heuteIso);
      if (r.neu) {
        erg.erzeugt++;
        void pushBeiEreignis(personId, "bericht_da", { monat, monatText: monatText(monat), grosseZahlText: (r.bericht as any)?.grosseZahlText ?? (r.bericht as any)?.grosse_zahl_text ?? null }).catch(() => {});
      } else erg.vorhanden++;
    } catch (e: any) {
      erg.fehler++;
      console.error(`[BERICHT] Person ${personId}, ${monat}:`, e?.message || e);
    }
  }
  console.log(`[BERICHT] ${monatText(monat)}: ${erg.erzeugt} neu, ${erg.vorhanden} vorhanden, ${erg.fehler} Fehler (${personen.length} geprüft).`);

  // ── Mail: nur mit Schalter ─────────────────────────────────────────────
  erg.mailSchalter = await berichtMailFreigeschaltet();
  if (!erg.mailSchalter) return erg;

  // Abgelehnte Sendungen (keine Adresse, Frequenzbremse) merken sich Tag und
  // Grund in kennzahlen.mail — derselbe Tag fasst sie nicht noch einmal an
  // (der Lauf kommt alle sechs Stunden; sonst zwölf Versuche in drei Tagen).
  const offen = (await sqlPool`
    SELECT b.id, b.person_id, b.grosse_zahl_cents, b.grosse_zahl_text
      FROM fiaon_monatsberichte b
      JOIN fiaon_persons p ON p.id = b.person_id
     WHERE b.monat = ${monat}::date AND b.versandt_am IS NULL AND p.merged_into_person_id IS NULL
       AND COALESCE(b.kennzahlen #>> '{mail,versuchAm}', '') <> ${heuteIso}
     ORDER BY b.id ASC LIMIT ${grenze}`) as any[];
  const { mailSenden } = await import("./fiaon-mail-senden");
  const { absoluteUrl } = await import("../fiaon-base-url");
  for (let i = 0; i < offen.length; i++) {
    const b = offen[i];
    try {
      // Akteur: Systemversand läuft im Haus unter der Rolle „admin“ mit
      // sprechendem Namen (Muster Termin-Zentrale/Kundenansicht) — eine Rolle
      // „system“ kennt fiaon-mail-events.ts nicht; die Rückholung umgeht
      // mailSenden ganz, das tun wir hier bewusst nicht (Hausregel E-070).
      const r = await mailSenden({
        event: "app_monatsbericht",
        personId: Number(b.person_id),
        akteur: { rolle: "admin", name: "Monatsbericht (System)", agentId: null },
        zusatz: {
          monat_text: monatText(monat),
          grosse_zahl_text: String(b.grosse_zahl_text || KEIN_BETRAG_TEXT),
          // 0 € steht nicht als „0,00 €“ neben „noch kein Betrag entstanden“.
          betrag_text: Number(b.grosse_zahl_cents || 0) > 0 ? eurText(Number(b.grosse_zahl_cents || 0)) : "noch kein Betrag",
          bericht_url: absoluteUrl(`/app/geld/bericht/${monat.slice(0, 7)}`),
        },
      });
      if (r.ok) {
        await sqlPool`UPDATE fiaon_monatsberichte SET versandt_am = NOW() WHERE id = ${Number(b.id)} AND versandt_am IS NULL`;
        erg.versandt++;
      } else {
        erg.nichtVersandt++;
        const grund = String(r.grund ?? r.meldung ?? "unbekannt").slice(0, 200);
        console.warn(`[BERICHT] Mail an Person ${b.person_id} nicht raus: ${grund}`);
        await mailVersuchVermerken(Number(b.id), heuteIso, grund);
      }
    } catch (e: any) {
      erg.nichtVersandt++;
      console.error(`[BERICHT] Mail an Person ${b.person_id}:`, e?.message || e);
      await mailVersuchVermerken(Number(b.id), heuteIso, String(e?.message || e).slice(0, 200));
    }
  }
  console.log(`[BERICHT] Mails ${monatText(monat)}: ${erg.versandt} versandt, ${erg.nichtVersandt} nicht.`);
  return erg;
}
