// ═══════════════════════════════════════════════════════════════════════════
// KÜNDIGUNG — ein Zustand mit Wirkung (02.09.2026, E-092)
//
// JUSTINS REGEL, wörtlich: „Wenn jemand kündigt, muss das im System ja
// ebenfalls passieren ABER der Kunde muss wenn er heute kündigt dennoch seine
// offene Rate bezahlen, mit bezahlen dieser ist der Vertrag dann offiziell
// aus."
//
// DER BEFUND, aus dem das hier entstanden ist (Analyse 02.09.):
//   · 127 Kündigungsanträge liegen seit dem 25.05. unbearbeitet; die
//     Bearbeitungsseite ist seit einer Umleitung nicht mehr erreichbar.
//   · „Bestätigen" änderte nur den Antrag, nie das Abo. 79 bezahlte Kündiger
//     laufen weiter in Raten und Mahnungen: 89 offene Raten über 5.819 €,
//     55 davon NACH dem Antrag gemahnt, bei 21 legte der Tageslauf sogar noch
//     Rate 3 oder 4 an. Kein einziger hat danach noch gezahlt.
//   · Der einzige Stopp-Endpunkt storniert ALLE offenen Raten — er würde die
//     letzte Rate erlassen, also das Gegenteil von Justins Regel.
//
// WAS HIER PASSIERT: Eine Kündigung setzt `gekuendigt_am`, bestimmt die
// LETZTE RATE (die laufende, offene), storniert alles danach und lässt genau
// diese eine Rate fällig. Der Tageslauf legt keine neue mehr an. Zahlt der
// Kunde sie, endet der Vertrag (`vertrag_ende_am`, Abschlussmail, keine
// Verlängerungsfrage, KEIN Provisions-Clawback — verdientes Geld bleibt).
// Nimmt er die Kündigung zurück, leben die stornierten Raten wieder auf.
//
// WAS HIER BEWUSST NICHT PASSIERT: keine Rückerstattung, kein Erlass, keine
// Kontosperre. Und keine automatische Kündigung auf ein bloßes Wort: Es
// braucht eine Willenserklärung („ich kündige"), kein „ich überlege zu
// kündigen".
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";
import { offeneRatenZaehlen, ratenStornieren } from "./fiaon-raten-storno";
// E-265 Nachbesserung 2 (01.10.2026): EINE Rechnung für Urkunde, Bestätigungsmail, WhatsApp und Postfach.
// E-265 (01.10.2026, Paket Recht): Das Vertragsende beim Altvertrag ist das Ende des ABRECHNUNGSMONATS (Fälligkeit zu
// Fälligkeit, AGB 04.07.2026 § 6, Frist 24 Stunden) — nicht mehr der Kalendermonat. Die eine Rechnung: abrechnungsmonat.
import { istJahresvertrag, abrechnungsmonat, tagDeutsch } from "@shared/fiaon-antrag-stand";
import { kuendigungRatenAufteilen } from "@shared/fiaon-mara-ton";
// E-IT-B (08.10.2026): die eine Regel „wirksam gekündigt“ und die Produktkategorie.
import { KUENDIGUNG_WIRKSAM_SQL, KUENDIGUNG_ANTRAEGE_SQL, antragZiel, type AntragZiel } from "@shared/fiaon-kuendigung-regel";
import { produktkategorieSql } from "@shared/fiaon-produktkategorie";

/** YYYY-MM-DD (Berlin) eines Zeitpunkts. */
function berlinTag(d: Date | string | number): string {
  return new Date(d).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
}
/** Das Ende eines Berliner Tages (23:59:59) als Zeitpunkt — für „gilt zum Ende des Abrechnungsmonats". */
export function berlinTagesende(tag: string): Date {
  // Mittag UTC des Tages, dann der Berliner Versatz an diesem Tag (Sommer-/Winterzeit) — ohne Bibliothek.
  const mittag = new Date(`${tag}T12:00:00Z`);
  const teile = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", hour: "2-digit", hourCycle: "h23" }).formatToParts(mittag);
  const versatzStd = Number(teile.find((x) => x.type === "hour")?.value ?? "12") - 12;
  return new Date(Date.UTC(Number(tag.slice(0, 4)), Number(tag.slice(5, 7)) - 1, Number(tag.slice(8, 10)), 23 - versatzStd, 59, 59));
}

/**
 * WELCHE RATEN NACH DER KÜNDIGUNG NOCH ZU ZAHLEN SIND — die eine Rechnung (E-265 Nachbesserung 2, 01.10.2026).
 * Gegenprobe 29.09. (g3-raten): WhatsApp sagte beim Altvertrag „gilt zum Monatsende … danach kommt nichts mehr",
 * Urkunde und Bestätigungsmail nannten die Rate vom 12.10. (Regel „hoechste") und die Dauermahnung mahnte sie.
 *   · Vertrag vor dem 03.09.2026 (AGB 04.07.2026 § 6, Frist 24 Stunden zum Ende des Abrechnungsmonats): zu zahlen
 *     ist, was bis zum Ende des Abrechnungsmonats fällig ist, in dem die Frist abläuft (abrechnungsmonat — Fälligkeit
 *     zu Fälligkeit, E-265 (01.10.2026)); Raten danach werden NIE verlangt — sie entfallen mit der Kündigung.
 *   · Jahresvertrag (Justins Kulanz): zu zahlen sind die FÄLLIGEN Raten (bis heute); vorab angelegte, noch nicht
 *     fällige entfallen mit der Kulanz.
 * Eine Rate ohne Fälligkeit zählt als fällig (nie still erlassen). `faelligkeiten` sind die Fälligkeitstage der ganzen
 * Ratenkette (auch bezahlte) — sie bezeugen den Rhythmus; `anker` ist der Rückfall ohne Kette. Rein.
 */
export function kuendigungRatenPlan<T extends { faellig_am?: unknown }>(offen: readonly T[], opt: {
  agbStand: unknown; am: Date; faelligkeiten?: readonly unknown[]; anker?: Date | string | null;
}): { jahresvertrag: boolean; vertragsEnde: string | null; zuZahlen: T[]; entfallen: T[] } {
  const jahresvertrag = istJahresvertrag(opt.agbStand);
  const kette = [...(opt.faelligkeiten ?? []), ...offen.map((r) => r.faellig_am)] as (Date | string | number | null | undefined)[];
  const vertragsEnde = jahresvertrag ? null : abrechnungsmonat(opt.am, kette, { anker: opt.anker ?? null }).bis;
  const mitTag = offen.map((r) => ({ r, faellig: r.faellig_am ? berlinTag(r.faellig_am as any) : null }));
  const { zuZahlen, nachEnde } = kuendigungRatenAufteilen(mitTag, { jahresvertrag, vertragsEnde, heute: berlinTag(opt.am) });
  return { jahresvertrag, vertragsEnde, zuZahlen: zuZahlen.map((x) => x.r), entfallen: nachEnde.map((x) => x.r) };
}

/**
 * DAS VERTRAGSENDE EINER GEKÜNDIGTEN BESTELLUNG aus der Datenbank (E-265 (01.10.2026)) — die eine Lesestelle für
 * Urkunde, Bestätigungsmail, WhatsApp, Postfach und Akte. Jahresvertrag: kein Ende aus der Kündigung (null); Altvertrag:
 * vertrag_ende_am, wenn gesetzt (beendet oder „nichts mehr zu zahlen"), sonst das Ende des Abrechnungsmonats aus der
 * Ratenkette (jede Rate, auch stornierte — sie bezeugen den Rhythmus) bzw. dem Anker (erste Zahlung, sonst Abschluss,
 * sonst Bestellung). Ohne Kündigung (gekuendigt_am leer): das Ende, das eine Kündigung JETZT hätte (Vorschau).
 *
 * Nachbesserung Recht (01.10.2026, Gegenprüfung M2): Ein gesetztes vertrag_ende_am, das beim bezahlten Altvertrag FRÜHER
 * liegt als das Ende des Abrechnungsmonats, ist ein Altwert (Zahltag aus vertragEndePruefen vor dieser Nachbesserung,
 * Kalendermonatsende vor dem 01.10.) — dann gilt das Ende des Abrechnungsmonats, nie der frühere Tag. Beim nie bezahlten
 * Storno (storno_unbezahlt) gab es keinen laufenden Vertrag; dort bleibt der gesetzte Tag.
 */
export async function vertragsendeLesen(ref: string, opt: { am?: Date | string | null } = {}): Promise<{
  jahresvertrag: boolean; ende: string | null; endeDe: string | null; gekuendigtAm: Date | null; quelle: string | null;
}> {
  const [a] = (await sqlPool`
    SELECT a.agb_stand, a.gekuendigt_am, a.vertrag_ende_am, a.kuendigung_zurueckgenommen_am, a.payment_status,
           COALESCE(a.paid_at, a.completed_at, a.created_at) AS anker,
           (SELECT COALESCE(json_agg(r.faellig_am ORDER BY r.rate_nr), '[]'::json) FROM fiaon_abo_raten r WHERE r.ref = a.ref) AS faelligkeiten
      FROM fiaon_applications a WHERE a.ref = ${ref} LIMIT 1`.catch(() => [])) as any[];
  if (!a) return { jahresvertrag: false, ende: null, endeDe: null, gekuendigtAm: null, quelle: null };
  const jahresvertrag = istJahresvertrag(a.agb_stand);
  const gekuendigtAm: Date | null = a.gekuendigt_am && !a.kuendigung_zurueckgenommen_am ? new Date(a.gekuendigt_am) : null;
  if (jahresvertrag) return { jahresvertrag, ende: a.vertrag_ende_am ? berlinTag(a.vertrag_ende_am) : null, endeDe: a.vertrag_ende_am ? tagDeutsch(berlinTag(a.vertrag_ende_am)) : null, gekuendigtAm, quelle: a.vertrag_ende_am ? "vertrag_ende_am" : null };
  const kette: unknown[] = Array.isArray(a.faelligkeiten) ? a.faelligkeiten : (() => { try { return JSON.parse(String(a.faelligkeiten ?? "[]")); } catch { return []; } })();
  const m = abrechnungsmonat(opt.am ?? gekuendigtAm ?? new Date(), kette as any[], { anker: a.anker ?? null });
  if (gekuendigtAm && a.vertrag_ende_am) {
    const gesetzt = berlinTag(a.vertrag_ende_am);
    if (String(a.payment_status) === "paid" && gesetzt < m.bis) {
      return { jahresvertrag, ende: m.bis, endeDe: tagDeutsch(m.bis), gekuendigtAm, quelle: m.quelle };
    }
    return { jahresvertrag, ende: gesetzt, endeDe: tagDeutsch(gesetzt), gekuendigtAm, quelle: "vertrag_ende_am" };
  }
  return { jahresvertrag, ende: m.bis, endeDe: tagDeutsch(m.bis), gekuendigtAm, quelle: m.quelle };
}

/**
 * Liegt diese Rate NACH dem Vertragsende eines gekündigten Altvertrags? (E-265 Schluss-Nachbesserung, 01.10.2026,
 * Probe 3 M3) Dann wird sie nie verlangt — zahlungslink_bauen baut keine Seite dafür. Beim Altvertrag (vor dem
 * 03.09.2026) endet der Vertrag zum Ende des Abrechnungsmonats der Kündigung (vertragsendeLesen); der Altbestand aus
 * der Zeit vor der Nachbesserung 2 hat solche Raten noch offen (storno-nach-ende.sql wartet auf Justins Go).
 * Jahresvertrag: nie. Ergebnis: Nummer, Fälligkeit und Vertragsende (TT.MM.JJJJ) — sonst null.
 */
export async function rateNachVertragsende(referenz: string): Promise<{ nr: number; faellig: string; ende: string } | null> {
  const [r] = (await sqlPool`
    SELECT r.ref, r.rate_nr, r.faellig_am, a.agb_stand, a.gekuendigt_am, a.kuendigung_zurueckgenommen_am
      FROM fiaon_abo_raten r JOIN fiaon_applications a ON a.ref = r.ref
     WHERE UPPER(r.zahlungsreferenz) = ${String(referenz || "").trim().toUpperCase()}
     ORDER BY r.id DESC LIMIT 1`.catch(() => [])) as any[];
  if (!r?.gekuendigt_am || r.kuendigung_zurueckgenommen_am || istJahresvertrag(r.agb_stand) || !r.faellig_am) return null;
  const { ende, endeDe } = await vertragsendeLesen(String(r.ref));
  if (!ende || !endeDe) return null;
  const faellig = berlinTag(r.faellig_am);
  if (faellig <= ende) return null;
  return { nr: Number(r.rate_nr), faellig: tagDeutsch(faellig)!, ende: endeDe };
}

// E-265 (29.09.2026): „whatsapp" — Mara nimmt eine klare Kündigung auf WhatsApp selbst auf (kuendigung_aufnehmen).
export type KuendigungQuelle = "mail" | "formular" | "telefon" | "admin" | "altbestand" | "whatsapp";

export interface KuendigungErgebnis {
  ok: boolean;
  ref: string;
  weg: "storno_unbezahlt" | "letzte_rate" | "sofort_beendet" | "kulanz_sofort" | "bereits" | "prueffall" | "unbekannt";
  letzteRateNr: number | null;
  letzteRateBetragCents: number | null;
  letzteRateFaellig: string | null;
  stornierteRaten: number;
  vertragEndeAm: string | null;
  grund: string;
}

/** Spalten nachrüsten — idempotent, beim ersten Aufruf. */
let spaltenBereit = false;
export async function kuendigungSpalten(): Promise<void> {
  if (spaltenBereit) return;
  await sqlPool`
    ALTER TABLE fiaon_applications
      ADD COLUMN IF NOT EXISTS gekuendigt_am TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS kuendigung_quelle TEXT,
      ADD COLUMN IF NOT EXISTS kuendigung_grund TEXT,
      ADD COLUMN IF NOT EXISTS letzte_rate_nr INTEGER,
      ADD COLUMN IF NOT EXISTS vertrag_ende_am TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS kuendigung_zurueckgenommen_am TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS kuendigung_bestaetigt_mail_am TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS kuendigung_rueckhol_bis TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS kuendigung_postmeister_id INTEGER
  `.catch((e) => console.error("[KÜNDIGUNG] Spalten:", String(e).slice(0, 200)));
  spaltenBereit = true;
}

/** Einstellung lesen (Text), mit Vorgabe. */
async function einstellung(schluessel: string, vorgabe: string): Promise<string> {
  try {
    const [r] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = ${schluessel} LIMIT 1`) as any[];
    const v = String(r?.value ?? "").trim();
    return v || vorgabe;
  } catch { return vorgabe; }
}

/**
 * Die Willenserklärung. Ein Kündigungswort allein genügt nicht — „ich überlege
 * zu kündigen" oder „wie kann ich kündigen?" sind keine Kündigung. Diese
 * Prüfung steht bewusst hier und nicht im Prompt: Ein Modell darf sie nicht
 * umgehen können.
 */
export function istWillenserklaerung(text: string, opts: { unbezahlt?: boolean } = {}): boolean {
  const t = String(text || "").toLowerCase().replace(/\s+/g, " ");
  if (!t) return false;
  // ── STORNO-WORTLAUTE (05.09.2026, E-135) ──────────────────────────────
  // „Bitte stornieren Sie alles" scheiterte dreimal an dieser Prüfung, und
  // Mara gab den Fall an Frau Zeller. Wer seine Bestellung nicht bezahlt hat
  // und aussteigen will, sagt das selten juristisch — und ein Storno kostet
  // nichts. Bei unbezahlter Bestellung gilt deshalb die weite Liste; bei
  // laufendem Vertrag nur die klaren Sätze („ich will nicht mehr" eingeschlossen).
  const storno = /(sto?r?nier(en|e|t)? (sie )?(bitte )?(alles|das|den vertrag|die bestellung|mein(e|en)? (antrag|vertrag|bestellung|buchung))|bitte (alles |den vertrag |die bestellung )?stornieren|ich (will|m(ö|oe)ch(t)?e) (das |es |den vertrag |die bestellung )?nicht( mehr)?( weitermachen| fortführen| fortfuehren)?\b|ich (will|m(ö|oe)ch(t)?e) (den vertrag |die bestellung |das )?(nicht|nicht mehr)\b|kein interesse( mehr)?|anders überlegt|anders ueberlegt|(löschen|loeschen) sie (bitte )?(mein(en|e)? |diesen |dieses |das )?(konto|account|antrag|daten|zugang)|nicht weitermachen|abbrechen)/;
  const zweifel = /(würde|wuerde|überlege|ueberlege|vielleicht|eventuell|wie kann ich|falls|\?\s*$)/;
  // Unbezahlte Bestellung: Jede klare Absage genügt — auch mit Tippfehlern
  // („dsd ich dad Angebot nlcht möchte", „wird nicht mehr benötigt",
  // „hiermit wiederufe ich"). Ein Storno kostet nichts; Nachfragen kostet
  // den Kunden Geduld und uns eine Mail.
  const absage = /(^\s*nein[, ]*danke|(nicht|nlcht|kein(e|en|s)?|nein)[^.!?\n]{0,40}(möcht|moecht|will|brauch|benötig|benoetig|interess|angebot|vertrag|bestellung|antrag|auftrag|weiter|nehmen|abschließen|abschliessen|paket|finanzierung|konto bei ihnen)|(möcht|moecht|will|brauch|benötig|benoetig)[^.!?\n]{0,30}(nicht|nlcht|kein)|storn|abbrech|zurücktret|zuruecktret|beenden|lösch|loesch|wie?derr?uf|verzicht)/;
  if (opts.unbezahlt && !zweifel.test(t) && absage.test(t)) return true;
  if (storno.test(t) && !zweifel.test(t)) {
    if (opts.unbezahlt) return true;
    if (/(ich (will|m(ö|oe)ch(t)?e) (den vertrag |das |es )?nicht( mehr)?\b|nicht weitermachen|sto?r?nier(en|e|t)? (sie )?(bitte )?(den vertrag|mein(en)? vertrag|alles))/.test(t)) return true;
  }
  // Konjunktiv oder Frage in der Nähe des Kündigungsworts → keine Erklärung.
  // „möglich" allein wäre zu breit: „zum nächstmöglichen Zeitpunkt" ist eine
  // Kündigung, „ist das möglich?" nicht.
  const unsicher = /(würde|wuerde|überlege|ueberlege|\bfalls\b|wenn ich|wie kann ich|wie kündige|wie kuendige|(ist|wäre|waere) (das |es )?möglich|(ist|wäre|waere) (das |es )?moeglich|erwäge|erwaege|vielleicht|eventuell|gedanken|informier|auskunft|welche frist|kündigungsfrist ist|kuendigungsfrist ist|frist ist)/;
  const erklaerung = /(ich kündige|ich kuendige|hiermit kündige|hiermit kuendige|kündige ich|kuendige ich|kündigung des vertrags|kuendigung des vertrags|hiermit die kündigung|hiermit die kuendigung|vertrag beenden|vertrag kündigen|vertrag kuendigen|abo kündigen|abo kuendigen|widerrufe hiermit|hiermit wie?derr?ufe|wie?derr?ufe ich|habe (die |eine |meine |ihnen (die |meine )?)?(kündigung|kuendigung) (geschrieben|geschickt|gesendet|eingereicht|zugesandt|zugeschickt|übermittelt)|bitte um bestätigung (der|meiner) (kündigung|kuendigung)|(kündigung|kuendigung) bestätigen|bestätigen sie (mir )?(die|meine) (kündigung|kuendigung)|trete zurück|trete zurueck|außerordentlich(e|en)? kündigung|ausserordentlich(e|en)? kuendigung|habe (bereits |schon |schriftlich |per e-?mail |per mail |vor \w+ )*(gekündigt|gekuendigt)|(gekündigt|gekuendigt) habe|meine (kündigung|kuendigung) vom|bleibe bei meiner (kündigung|kuendigung))/;
  if (!erklaerung.test(t)) return false;
  // 04.09.2026: „ich habe schriftlich gekündigt!!!" ist eine Erklärung — der
  // Kunde beruft sich auf eine frühere. Bis hierher galt sie als unklar, und
  // Mara antwortete, die Kündigung sei „noch nicht eindeutig hinterlegt".
  // Steht ein Unsicherheitswort im selben Satz wie die Erklärung, gilt sie nicht.
  for (const satz of t.split(/[.!?;\n]/)) {
    if (erklaerung.test(satz) && !unsicher.test(satz)) return true;
  }
  return false;
}

/** Lücke in der Ratenkette (1,3 ohne 2) — dann entscheidet ein Mensch. */
function kettenLuecke(raten: { rate_nr: number }[]): boolean {
  if (raten.length < 2) return false;
  const nrs = raten.map((r) => Number(r.rate_nr)).sort((a, b) => a - b);
  for (let i = 1; i < nrs.length; i++) if (nrs[i] - nrs[i - 1] > 1) return true;
  return false;
}

/**
 * Kündigung setzen — idempotent. Läuft in EINER Transaktion; ein Fehler lässt
 * die Bestellung unverändert.
 */
export async function kuendigungSetzen(ref: string, opts: {
  quelle: KuendigungQuelle;
  grund?: string | null;
  postmeisterId?: number | null;
  /** Datum der ursprünglichen Erklärung (Altbestand) — sonst jetzt. */
  am?: string | null;
  /** true = nur rechnen, nichts schreiben. */
  probe?: boolean;
  /**
   * 04.09.2026 (E-115): Kulanz — Vertrag endet SOFORT, auch offene Raten
   * entfallen. Das ist eine Geldentscheidung; nur ein Mensch im Postfach darf
   * sie treffen (Schalter „Storno erst nach Zahlungseingang" ausgeschaltet).
   * Mara bekommt diesen Weg nicht angeboten.
   */
  sofort?: boolean;
}): Promise<KuendigungErgebnis> {
  await kuendigungSpalten();
  const leer = (weg: KuendigungErgebnis["weg"], grund: string): KuendigungErgebnis =>
    ({ ok: false, ref, weg, letzteRateNr: null, letzteRateBetragCents: null, letzteRateFaellig: null, stornierteRaten: 0, vertragEndeAm: null, grund });

  const [a] = (await sqlPool`
    SELECT ref, person_id, payment_status, payment_reference, amount_due, pack_name, email,
           first_name, last_name, gekuendigt_am, letzte_rate_nr, vertrag_ende_am, abo_gestoppt_am, agb_stand,
           -- E-IT-B (08.10.2026): Der Rücknahmetag wurde hier gar nicht gelesen — die Abfrage unten verglich
           -- mit „undefined“. Jetzt gelesen, und jede neue Kündigung setzt ihn zurück (siehe SET unten).
           kuendigung_zurueckgenommen_am,
           -- E-265 (01.10.2026): der Anker für den Abrechnungsmonat, falls keine Ratenkette da ist
           COALESCE(paid_at, completed_at, created_at) AS anker
    FROM fiaon_applications WHERE ref = ${ref} AND merged_into IS NULL LIMIT 1
  `) as any[];
  if (!a) return leer("unbekannt", "Bestellung nicht gefunden");
  // E-IT-B (08.10.2026): Nach einer Rücknahme und einer erneuten Kündigung blieb kuendigung_zurueckgenommen_am
  // stehen — elf Leser („gekündigt und nicht zurückgenommen“) hielten den Menschen dann für ungekündigt. Jede
  // Kündigung unten setzt den Rücknahmetag deshalb auf NULL; die Regel selbst liest nur noch gekuendigt_am
  // (shared/fiaon-kuendigung-regel.ts — die Rücknahme setzt gekuendigt_am auf NULL). Ein gesetztes gekuendigt_am
  // IST die geltende Kündigung — auch wenn ein alter Rücknahmetag daneben steht.
  if (a.gekuendigt_am) {
    return { ok: true, ref, weg: "bereits", letzteRateNr: a.letzte_rate_nr ?? null, letzteRateBetragCents: null,
      letzteRateFaellig: null, stornierteRaten: 0, vertragEndeAm: a.vertrag_ende_am ?? null, grund: "bereits gekündigt" };
  }

  const wann = opts.am ? new Date(opts.am) : new Date();
  const rueckholBis = new Date(wann.getTime() + 14 * 24 * 60 * 60 * 1000);

  // ── Weg 1: nie bezahlt → Storno der Bestellung, keine Forderung ─────────
  // E-245 (27.09.2026): Die offenen Raten fallen mit weg — in derselben Transaktion.
  // Dieser Weg greift auch bei einer schon stornierten Bestellung mit bezahlter
  // Rate 1 (payment_status 'cancelled' ≠ 'paid'); deren Rate 2 blieb bis heute
  // „offen“ und wurde gemahnt. Die bezahlte Rate bleibt, wie sie ist. Der Grund
  // 'storno_unbezahlt' ist keiner, den kuendigungZuruecknehmen zurückholt
  // (server/lib/fiaon-raten-storno.ts).
  if (String(a.payment_status) !== "paid") {
    if (opts.probe) {
      const n = await offeneRatenZaehlen(ref);
      return { ok: true, ref, weg: "storno_unbezahlt", letzteRateNr: null, letzteRateBetragCents: null,
        letzteRateFaellig: null, stornierteRaten: n, vertragEndeAm: wann.toISOString(), grund: `unbezahlt — Bestellung wird storniert${n ? `, ${n} offene Rate(n) entfallen` : ""}` };
    }
    const raten = await sqlPool.begin(async (tx) => {
      await tx`
        UPDATE fiaon_applications
           SET payment_status = 'cancelled', cancelled_at = COALESCE(cancelled_at, ${wann}),
               gekuendigt_am = ${wann}, kuendigung_zurueckgenommen_am = NULL, kuendigung_quelle = ${opts.quelle}, kuendigung_grund = ${opts.grund ?? null},
               kuendigung_postmeister_id = ${opts.postmeisterId ?? null},
               vertrag_ende_am = ${wann}, mahnstopp_am = COALESCE(mahnstopp_am, ${wann}),
               allow_reminders_despite_paid = FALSE, updated_at = NOW()
         WHERE ref = ${ref}
      `;
      const n = await ratenStornieren(ref, "storno_unbezahlt", tx as any);
      await tx`
        INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
        VALUES (${ref}, ${a.person_id ?? null}, NULL, 'System', 'system',
                ${`Kündigung (${opts.quelle}) — Bestellung war unbezahlt und wurde storniert${n ? `, ${n} offene Rate(n) storniert` : ""}. Keine Forderung, Erinnerungen beendet.${opts.grund ? ` Grund: ${String(opts.grund).slice(0, 200)}` : ""}`})
      `.catch(() => {});
      return n;
    });
    return { ok: true, ref, weg: "storno_unbezahlt", letzteRateNr: null, letzteRateBetragCents: null,
      letzteRateFaellig: null, stornierteRaten: raten, vertragEndeAm: wann.toISOString(), grund: "Bestellung storniert" };
  }

  // ── Weg 2: bezahlt → letzte Rate bestimmen ──────────────────────────────
  const raten = (await sqlPool`
    SELECT id, rate_nr, betrag_cents, status, faellig_am
    FROM fiaon_abo_raten WHERE ref = ${ref} AND storniert_am IS NULL ORDER BY rate_nr ASC
  `) as any[];
  const offen = raten.filter((r) => r.status === "offen");
  // E-265 (01.10.2026): Die Fälligkeitstage der GANZEN Kette (auch stornierte Raten) — sie bezeugen den Rhythmus
  // des Abrechnungsmonats (Fälligkeit zu Fälligkeit).
  const kette = (await sqlPool`SELECT faellig_am FROM fiaon_abo_raten WHERE ref = ${ref}`.catch(() => [])) as any[];

  if (kettenLuecke(raten)) {
    return leer("prueffall", `Lücke in der Ratenkette (${raten.map((r) => r.rate_nr).join(",")}) — ein Mensch muss entscheiden`);
  }

  // E-265 Nachbesserung 2 (01.10.2026): EINE Rechnung — was bleibt, was entfällt (kuendigungRatenPlan).
  // E-265 (01.10.2026, Recht): Altvertrag — Vertragsende = Ende des Abrechnungsmonats, in dem die 24-Stunden-Frist abläuft.
  const plan = kuendigungRatenPlan(offen, { agbStand: a.agb_stand, am: wann, faelligkeiten: kette.map((r) => r.faellig_am), anker: a.anker ?? null });
  const endeText = plan.vertragsEnde ? `zum Ende des Abrechnungsmonats (${tagDeutsch(plan.vertragsEnde)})` : null;
  // Altvertrag: Die Kündigung gilt zum Ende des Abrechnungsmonats — das ist auch das Vertragsende, wenn nichts mehr zu zahlen ist.
  const endeOhneRate: Date = plan.vertragsEnde ? berlinTagesende(plan.vertragsEnde) : wann;

  // Keine offene Rate → alles bezahlt, Vertrag endet sofort (Altvertrag: zum Ende des Abrechnungsmonats).
  if (offen.length === 0) {
    const hoechste = raten.length ? Math.max(...raten.map((r) => Number(r.rate_nr))) : 0;
    if (opts.probe) return { ok: true, ref, weg: "sofort_beendet", letzteRateNr: hoechste || null, letzteRateBetragCents: null,
      letzteRateFaellig: null, stornierteRaten: 0, vertragEndeAm: endeOhneRate.toISOString(), grund: "keine offene Rate — Vertrag endet sofort" };
    await sqlPool.begin(async (tx) => {
      await tx`
        UPDATE fiaon_applications
           SET gekuendigt_am = ${wann}, kuendigung_zurueckgenommen_am = NULL, kuendigung_quelle = ${opts.quelle}, kuendigung_grund = ${opts.grund ?? null},
               kuendigung_postmeister_id = ${opts.postmeisterId ?? null}, letzte_rate_nr = ${hoechste || null},
               vertrag_ende_am = ${endeOhneRate}, abo_gestoppt_am = COALESCE(abo_gestoppt_am, ${wann}),
               abo_stopp_grund = COALESCE(abo_stopp_grund, 'Kündigung'), kuendigung_rueckhol_bis = ${rueckholBis},
               mahnstopp_am = COALESCE(mahnstopp_am, ${wann}), updated_at = NOW()
         WHERE ref = ${ref}
      `;
      await tx`
        INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
        VALUES (${ref}, ${a.person_id ?? null}, NULL, 'System', 'system',
                ${`Kündigung (${opts.quelle}) — alle Raten bezahlt, Vertrag endet ${endeText ?? "sofort"}.${opts.grund ? ` Grund: ${String(opts.grund).slice(0, 200)}` : ""}`})
      `.catch(() => {});
    });
    return { ok: true, ref, weg: "sofort_beendet", letzteRateNr: hoechste || null, letzteRateBetragCents: null,
      letzteRateFaellig: null, stornierteRaten: 0, vertragEndeAm: endeOhneRate.toISOString(), grund: "Vertrag beendet" };
  }

  // ── Kulanz (nur Mensch): sofort beenden, offene Raten entfallen ────────
  if (opts.sofort) {
    const hoechsteBezahlt = raten.filter((r) => r.status === "bezahlt").reduce((m, r) => Math.max(m, Number(r.rate_nr)), 0);
    if (opts.probe) return { ok: true, ref, weg: "kulanz_sofort", letzteRateNr: hoechsteBezahlt || null, letzteRateBetragCents: null,
      letzteRateFaellig: null, stornierteRaten: offen.length, vertragEndeAm: wann.toISOString(), grund: `Kulanz — ${offen.length} offene Rate(n) entfallen, Vertrag endet sofort` };
    await sqlPool.begin(async (tx) => {
      await tx`
        UPDATE fiaon_applications
           SET gekuendigt_am = ${wann}, kuendigung_zurueckgenommen_am = NULL, kuendigung_quelle = ${opts.quelle}, kuendigung_grund = ${opts.grund ?? null},
               kuendigung_postmeister_id = ${opts.postmeisterId ?? null}, letzte_rate_nr = ${hoechsteBezahlt || null},
               vertrag_ende_am = ${wann}, abo_gestoppt_am = COALESCE(abo_gestoppt_am, ${wann}),
               abo_stopp_grund = COALESCE(abo_stopp_grund, 'Kündigung (Kulanz, sofort)'), kuendigung_rueckhol_bis = ${rueckholBis},
               mahnstopp_am = COALESCE(mahnstopp_am, ${wann}), updated_at = NOW()
         WHERE ref = ${ref}
      `;
      await tx`
        UPDATE fiaon_abo_raten
           SET status = 'storniert', storniert_am = NOW(), storno_grund = 'kuendigung_kulanz', updated_at = NOW()
         WHERE ref = ${ref} AND status = 'offen'
      `;
      await tx`
        INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
        VALUES (${ref}, ${a.person_id ?? null}, NULL, 'System', 'system',
                ${`Kündigung (${opts.quelle}), KULANZ — Vertrag endet sofort, ${offen.length} offene Rate(n) entfallen. Ein Mensch hat das im Postfach entschieden.${opts.grund ? ` Grund: ${String(opts.grund).slice(0, 200)}` : ""}`})
      `.catch(() => {});
    });
    return { ok: true, ref, weg: "kulanz_sofort", letzteRateNr: hoechsteBezahlt || null, letzteRateBetragCents: null,
      letzteRateFaellig: null, stornierteRaten: offen.length, vertragEndeAm: wann.toISOString(), grund: "Vertrag beendet (Kulanz)" };
  }

  // ── E-265 Nachbesserung 2 (01.10.2026): NICHTS MEHR ZU ZAHLEN ──────────────────────────────────────────────
  // Altvertrag, dessen offene Raten alle erst NACH dem Ende des Abrechnungsmonats fällig sind (z. B. Kündigung am
  // 26.09. bei Raten am 28.: die Rate vom 28.09. entfällt); Jahresvertrag ohne fällige Rate (nur vorab angelegte).
  // Die Raten entfallen (storno_grund 'kuendigung' — kuendigungZuruecknehmen holt sie zurück), der Vertrag endet
  // (Altvertrag zum Ende des Abrechnungsmonats, Jahresvertrag sofort).
  if (plan.zuZahlen.length === 0) {
    const hoechsteBezahlt = raten.filter((r) => r.status === "bezahlt").reduce((m, r) => Math.max(m, Number(r.rate_nr)), 0);
    if (opts.probe) return { ok: true, ref, weg: "sofort_beendet", letzteRateNr: hoechsteBezahlt || null, letzteRateBetragCents: null,
      letzteRateFaellig: null, stornierteRaten: offen.length, vertragEndeAm: endeOhneRate.toISOString(), grund: `nichts mehr fällig — ${offen.length} spätere Rate(n) entfallen` };
    await sqlPool.begin(async (tx) => {
      await tx`
        UPDATE fiaon_applications
           SET gekuendigt_am = ${wann}, kuendigung_zurueckgenommen_am = NULL, kuendigung_quelle = ${opts.quelle}, kuendigung_grund = ${opts.grund ?? null},
               kuendigung_postmeister_id = ${opts.postmeisterId ?? null}, letzte_rate_nr = ${hoechsteBezahlt || null},
               vertrag_ende_am = ${endeOhneRate}, abo_gestoppt_am = COALESCE(abo_gestoppt_am, ${wann}),
               abo_stopp_grund = COALESCE(abo_stopp_grund, 'Kündigung'), kuendigung_rueckhol_bis = ${rueckholBis},
               mahnstopp_am = COALESCE(mahnstopp_am, ${wann}), updated_at = NOW()
         WHERE ref = ${ref}
      `;
      await tx`
        UPDATE fiaon_abo_raten
           SET status = 'storniert', storniert_am = NOW(), storno_grund = 'kuendigung', mahnstufe = 0,
               inkasso_agent_id = NULL, inkasso_wiedervorlage = NULL, inkasso_zusage_am = NULL, updated_at = NOW()
         WHERE ref = ${ref} AND status = 'offen' AND storniert_am IS NULL AND bezahlt_am IS NULL
      `;
      await tx`
        INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
        VALUES (${ref}, ${a.person_id ?? null}, NULL, 'System', 'system',
                ${`Kündigung (${opts.quelle}) — nichts mehr fällig: ${offen.length} spätere Rate(n) entfallen (${plan.jahresvertrag ? "Jahresvertrag, Kulanz: nur fällige Raten" : `Vertrag vor dem 03.09.2026, Vertragsende ${endeText}`}).${opts.grund ? ` Grund: ${String(opts.grund).slice(0, 200)}` : ""}`})
      `.catch(() => {});
    });
    return { ok: true, ref, weg: "sofort_beendet", letzteRateNr: hoechsteBezahlt || null, letzteRateBetragCents: null,
      letzteRateFaellig: null, stornierteRaten: offen.length, vertragEndeAm: endeOhneRate.toISOString(), grund: "Vertrag beendet — nichts mehr fällig" };
  }

  // Welche offene Rate ist „die letzte"? Standard: die höchste der ZU ZAHLENDEN (kuendigungRatenPlan) — Altvertrag
  // bis zum Ende des Abrechnungsmonats, Jahresvertrag bis heute fällig. Umschaltbar, weil es eine Geldfrage ist.
  const regel = await einstellung("kuendigung_letzte_rate", "hoechste");
  const kandidaten = plan.zuZahlen;
  const gewaehlt = regel === "niedrigste"
    ? kandidaten.reduce((m, r) => (Number(r.rate_nr) < Number(m.rate_nr) ? r : m), kandidaten[0])
    : kandidaten.reduce((m, r) => (Number(r.rate_nr) > Number(m.rate_nr) ? r : m), kandidaten[0]);
  const letzteNr = Number(gewaehlt.rate_nr);
  const danach = raten.filter((r) => Number(r.rate_nr) > letzteNr && r.status === "offen");

  if (opts.probe) {
    return { ok: true, ref, weg: "letzte_rate", letzteRateNr: letzteNr, letzteRateBetragCents: Number(gewaehlt.betrag_cents),
      letzteRateFaellig: gewaehlt.faellig_am, stornierteRaten: danach.length, vertragEndeAm: null,
      grund: `letzte Rate ${letzteNr} bleibt fällig (${(Number(gewaehlt.betrag_cents) / 100).toFixed(2)} €), ${danach.length} spätere Rate(n) entfallen` };
  }

  await sqlPool.begin(async (tx) => {
    await tx`
      UPDATE fiaon_applications
         SET gekuendigt_am = ${wann}, kuendigung_zurueckgenommen_am = NULL, kuendigung_quelle = ${opts.quelle}, kuendigung_grund = ${opts.grund ?? null},
             kuendigung_postmeister_id = ${opts.postmeisterId ?? null}, letzte_rate_nr = ${letzteNr},
             kuendigung_rueckhol_bis = ${rueckholBis}, updated_at = NOW()
       WHERE ref = ${ref}
    `;
    if (danach.length) {
      await tx`
        UPDATE fiaon_abo_raten
           SET status = 'storniert', storniert_am = NOW(), storno_grund = 'kuendigung', updated_at = NOW()
         WHERE ref = ${ref} AND rate_nr > ${letzteNr} AND status = 'offen'
      `;
    }
    await tx`
      INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
      VALUES (${ref}, ${a.person_id ?? null}, NULL, 'System', 'system',
              ${`Kündigung (${opts.quelle}) — letzte Rate ${letzteNr} über ${(Number(gewaehlt.betrag_cents) / 100).toFixed(2)} € bleibt fällig${gewaehlt.faellig_am ? ` (fällig ${String(gewaehlt.faellig_am).slice(0, 10)})` : ""}; ${danach.length} spätere Rate(n) storniert. ${endeText ? `Die Kündigung gilt ${endeText}.` : "Mit der Zahlung endet der Vertrag."}${opts.grund ? ` Grund: ${String(opts.grund).slice(0, 200)}` : ""}`})
    `.catch(() => {});
  });

  return { ok: true, ref, weg: "letzte_rate", letzteRateNr: letzteNr, letzteRateBetragCents: Number(gewaehlt.betrag_cents),
    letzteRateFaellig: gewaehlt.faellig_am, stornierteRaten: danach.length, vertragEndeAm: null,
    grund: `letzte Rate ${letzteNr} bleibt fällig` };
}

/** Kündigung zurücknehmen — stornierte Raten leben wieder auf. */
export async function kuendigungZuruecknehmen(ref: string, grund?: string | null): Promise<{ ok: boolean; ratenZurueck: number }> {
  await kuendigungSpalten();
  let zurueck = 0;
  await sqlPool.begin(async (tx) => {
    const w = (await tx`
      UPDATE fiaon_abo_raten SET status = 'offen', storniert_am = NULL, storno_grund = NULL, updated_at = NOW()
       WHERE ref = ${ref} AND storno_grund = 'kuendigung' AND status = 'storniert' RETURNING id
    `) as any[];
    zurueck = w.length;
    await tx`
      UPDATE fiaon_applications
         SET kuendigung_zurueckgenommen_am = NOW(), gekuendigt_am = NULL, letzte_rate_nr = NULL,
             vertrag_ende_am = NULL, abo_gestoppt_am = NULL, abo_stopp_grund = NULL, updated_at = NOW()
       WHERE ref = ${ref}
    `;
    // E-IT-B (08.10.2026, Gegenprüfung): Ein offener Formular-Antrag dieses Menschen ist mit der Rücknahme
    // erledigt — sonst stand er weiter auf „pending“, die Liste „Kündigung nicht gebucht“ und die Akte forderten
    // zum erneuten Kündigen auf (Fall 11498), und die Zahlungszuordnung sah eine „offene Kündigung“. Das Formular
    // legt den Antrag an IRGENDEINE Bestellung des Menschen (cancellation.ts) — deshalb alle seine Bestellungen.
    await tx`
      UPDATE cancellation_requests SET status = 'withdrawn', processed_at = NOW(), updated_at = NOW(),
             admin_note = COALESCE(admin_note, '') || ' [Kündigung zurückgenommen]'
       WHERE status = 'pending' AND created_at <= NOW()
         AND (ref = ${ref} OR ref IN (SELECT x.ref FROM fiaon_applications x WHERE x.person_id IS NOT NULL
                                        AND x.person_id = (SELECT y.person_id FROM fiaon_applications y WHERE y.ref = ${ref} LIMIT 1)))
    `;
    await tx`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
      VALUES (${ref}, NULL, 'System', 'system', ${`Kündigung zurückgenommen — ${zurueck} Rate(n) wieder offen.${grund ? ` ${String(grund).slice(0, 200)}` : ""}`})
    `.catch(() => {});
  });
  return { ok: true, ratenZurueck: zurueck };
}

// ═══════════════════════════════════════════════════════════════════════════
// NIE GEBUCHTE KÜNDIGUNGSANTRÄGE — LESEN UND SCHLIESSEN (E-IT-B (08.10.2026))
//
// Die Regel (welcher Antrag offene Arbeit ist, worauf er gebucht wird) steht in
// shared/fiaon-kuendigung-regel.ts (KUENDIGUNG_ANTRAEGE_SQL, antragZiel). Hier
// nur das Laden für Akte, Chefbüro und Buchung — EINE Funktion für alle Türen.
// ═══════════════════════════════════════════════════════════════════════════
export interface OffenerAntrag {
  id: number;
  am: string;
  ref: string;
  grund: string | null;
  wunsch: string | null;
  personId: number;
  ziel: AntragZiel;
  /** Paketname der Zielbestellung — null ohne Ziel. */
  zielPaket: string | null;
  /**
   * Querprüfung 08.10.2026: Ohne passendes Geburtsdatum angenommen und die Aufgabe „Kündigung – Identität
   * prüfen“ ist nicht erledigt (KUENDIGUNG_IDENTITAET_OFFEN_SQL). Dann bucht antragBuchen nur mit Vermerk.
   */
  identitaetOffen: boolean;
}

/**
 * Die offenen, nie gebuchten Anträge eines Menschen (älteste zuerst) — oder
 * genau einer (`antragId`, dann ohne Personenfilter, wenn `personId` null ist).
 */
export async function offeneKuendigungsantraege(personId: number | null, antragId: number | null = null): Promise<OffenerAntrag[]> {
  if (personId == null && antragId == null) return [];
  const zeilen = (await sqlPool.unsafe(
    // antrag_am_tz: cancellation_requests.created_at ist „timestamp ohne Zone“ (Wanduhr der Datenbank-Sitzung, die ihn
    // mit NOW() schrieb). In der Datenbank zum Zeitpunkt gemacht — so stimmt die Buchung zum Eingangstag unabhängig
    // davon, in welcher Zeitzone der Server-Prozess läuft.
    `SELECT kr_u.*, kr_u.antrag_am::timestamptz AS antrag_am_tz FROM (${KUENDIGUNG_ANTRAEGE_SQL}) kr_u
      WHERE ($1::int IS NULL OR kr_u.person_id = $1::int) AND ($2::int IS NULL OR kr_u.antrag_id = $2::int)
      ORDER BY kr_u.antrag_am ASC, kr_u.antrag_id ASC LIMIT 20`,
    [personId, antragId],
  )) as any[];
  const aus: OffenerAntrag[] = [];
  const jePerson = new Map<number, any[]>();
  for (const z of zeilen) {
    const pid = Number(z.person_id);
    if (!jePerson.has(pid)) {
      // Alle Bestellungen des Menschen, auch zusammengeführte und die einer Personen-Dublette (die Referenz des
      // Antrags kann an jeder hängen).
      jePerson.set(pid, (await sqlPool`
        SELECT ref, type, pack_key, pack_name, merged_into, payment_status, gekuendigt_am, created_at, archived_at, gdpr_deleted_at
          FROM fiaon_applications
         WHERE person_id = ${pid} OR person_id IN (SELECT d.id FROM fiaon_persons d WHERE d.merged_into_person_id = ${pid})`) as any[]);
    }
    const bestellungen = jePerson.get(pid)!;
    const ziel = antragZiel({ ref: z.antrag_ref, am: z.antrag_am }, bestellungen);
    const zb = ziel.ziel ? bestellungen.find((b) => String(b.ref) === ziel.ziel) : null;
    aus.push({
      id: Number(z.antrag_id), am: new Date(z.antrag_am_tz ?? z.antrag_am).toISOString(), ref: String(z.antrag_ref ?? ""),
      grund: z.antrag_grund ? String(z.antrag_grund).slice(0, 300) : null,
      wunsch: z.antrag_wunsch ? String(z.antrag_wunsch instanceof Date ? z.antrag_wunsch.toISOString() : z.antrag_wunsch).slice(0, 10) : null,
      personId: pid, ziel, zielPaket: zb?.pack_name ? String(zb.pack_name).split("\n")[0] : null,
      identitaetOffen: z.antrag_identitaet_offen === true,
    });
  }
  return aus;
}

/**
 * Einen offenen Antrag OHNE Kündigung schließen (Leitung: „der Kunde ist mit dem
 * neuen Paket wieder da“, Doppelantrag …). Status 'rejected' wie im Chefbüro,
 * mit Grund und Namen. true, wenn er offen war.
 */
export async function kuendigungsantragSchliessen(antragId: number, opt: { von: string; grund: string; personId?: number | null }): Promise<boolean> {
  const [z] = (await sqlPool`
    UPDATE cancellation_requests
       SET status = 'rejected', processed_by = ${opt.von}, processed_at = NOW(), updated_at = NOW(),
           admin_note = TRIM(COALESCE(admin_note, '') || ' ' || ${`[Geschlossen ohne Kündigung: ${opt.grund.slice(0, 240)} — ${opt.von}]`})
     WHERE id = ${antragId} AND status = 'pending'
    RETURNING id, ref, created_at`) as any[];
  if (!z) return false;
  if (opt.personId) {
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note, created_at)
      VALUES (${z.ref}, ${opt.personId}, NULL, ${opt.von}, 'system',
              ${`Kündigungsantrag vom ${new Date(z.created_at).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })} ohne Kündigung geschlossen (${opt.von}): ${opt.grund.slice(0, 240)}`}, NOW())`.catch(() => {});
  }
  return true;
}

/**
 * Ist diese bezahlte Rate die letzte des gekündigten Vertrags? Wird aus
 * `rateBezahltBuchen` gerufen — dort steht fest, dass Geld angekommen ist.
 *
 * Nachbesserung Recht (01.10.2026, Gegenprüfung M2): Beim Altvertrag (vor dem 03.09.2026) ist das Vertragsende NICHT der
 * Zahltag, sondern das Ende des Abrechnungsmonats (AGB 04.07.2026 § 6) — dieselbe Rechnung wie vertragsendeLesen, als
 * Berliner Tagesende gespeichert (Kündigung 28.09., Rate vom 28.09. am 02.10. bezahlt → vertrag_ende_am 27.10. 23:59:59,
 * nicht 02.10.). Vorher stand hier NOW(), und Mara, Dossier und Urkunde meldeten danach „gilt zum … dem 02.10.2026".
 * Jahresvertrag unverändert: Mit der Zahlung der letzten Rate endet der Vertrag (Justins Kulanz) — der Zahltag.
 */
export async function vertragEndePruefen(ref: string, rateNr: number): Promise<{ beendet: boolean; person_id?: number | null }> {
  await kuendigungSpalten();
  const [a] = (await sqlPool`
    SELECT ref, person_id, gekuendigt_am, letzte_rate_nr, vertrag_ende_am
    FROM fiaon_applications WHERE ref = ${ref} AND merged_into IS NULL LIMIT 1
  `) as any[];
  if (!a?.gekuendigt_am || a.vertrag_ende_am || a.letzte_rate_nr == null) return { beendet: false };
  if (Number(rateNr) < Number(a.letzte_rate_nr)) return { beendet: false };
  const lage = await vertragsendeLesen(ref, { am: a.gekuendigt_am });
  const ende: Date = !lage.jahresvertrag && lage.ende ? berlinTagesende(lage.ende) : new Date();
  const endeText = !lage.jahresvertrag && lage.endeDe ? ` Er endet zum Ende des Abrechnungsmonats (${lage.endeDe}).` : "";
  await sqlPool`
    UPDATE fiaon_applications
       SET vertrag_ende_am = ${ende}, abo_gestoppt_am = COALESCE(abo_gestoppt_am, NOW()),
           abo_stopp_grund = COALESCE(abo_stopp_grund, 'Kündigung — letzte Rate bezahlt'), updated_at = NOW()
     WHERE ref = ${ref}
  `;
  await sqlPool`
    INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
    VALUES (${ref}, ${a.person_id ?? null}, NULL, 'System', 'system',
            ${`Letzte Rate ${rateNr} bezahlt — der Vertrag ist damit beendet.${endeText} Provisionen bleiben bestehen.`})
  `.catch(() => {});
  return { beendet: true, person_id: a.person_id };
}

// 19.09.2026 (E-194): Hier stand `lastschriftBeendenMerken` (E-115) — bei Vertragsende eine
// Aufgabe „GoCardless-Abo beenden“. GoCardless ist beendet; die Abos beendet Justin gesammelt.

/** Läuft die Bestellung noch? (für Mahn-, Rückhol- und Werbeläufe) */
export async function istGekuendigt(ref: string): Promise<boolean> {
  const [a] = (await sqlPool`SELECT gekuendigt_am, kuendigung_zurueckgenommen_am FROM fiaon_applications WHERE ref = ${ref} LIMIT 1`) as any[];
  return !!(a?.gekuendigt_am && !a?.kuendigung_zurueckgenommen_am);
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE PORTALSPERRE — EINE TÜR, DIE NICHT ZUFÄLLT (23.09.2026, E-213)
//
// Justin: „… der gesamte Prozess (Portalsperre, Kündigungsunterlagen,
// Unterschrift durch den Mitarbeiter, … der gesamte Prozess eben)."
//
// ── WARUM ES KEINE VOLLE SPERRE WIRD, UND WARUM DAS RICHTIG IST ───────────
// Der naheliegende Weg wäre `account_status = 'suspended'` — der Kunde kommt
// nicht mehr rein. Das widerspricht zwei Festlegungen dieses Hauses:
//   1. „Kunden NIE deaktivieren" (Grundsätze 02.09.2026).
//   2. Justins eigene Kündigungsregel (E-092): „… der Kunde muss, wenn er
//      heute kündigt, dennoch seine offene Rate bezahlen." Wer ausgesperrt
//      ist, sieht seine Rechnung nicht und bezahlt sie nicht. Die volle Sperre
//      würde also genau das Geld kosten, das die Regel sichern soll.
//
// Deshalb: Die Tür bleibt offen, der LADEN ist zu. Was zu ist, steht hier —
// an einer Stelle, damit niemand beim nächsten Umbau eine Hälfte vergisst.
//
//   ZU   Neue Leistungen beauftragen, Vertrag verlängern, neue Vorgänge und
//        Schreiben anstoßen — alles, was den Vertrag fortsetzen würde.
//   AUF  Bezahlen, Unterlagen und Rechnungen ansehen und herunterladen, die
//        Kündigungsbestätigung, Mitteilungen lesen, Passwort ändern, die
//        eigenen Daten berichtigen.
//
// Ein beendeter Vertrag (letzte Rate bezahlt) ändert daran nichts: Die
// Unterlagen bleiben 90 Tage einsehbar, wie es in der Abschlussmail steht.
// ═══════════════════════════════════════════════════════════════════════════
export const PORTAL_GESPERRT_SATZ =
  "Ihr Vertrag ist gekündigt. Neue Leistungen können darüber nicht mehr beauftragt werden — "
  + "Ihre Unterlagen und offenen Rechnungen finden Sie weiterhin in Ihrem Bereich.";

/**
 * Prüft für eine Kunden-Sitzung, ob neue Leistungen noch beauftragt werden
 * dürfen. `ref` ist die Bestellung der Sitzung; geprüft wird der MENSCH, denn
 * eine Kündigung gilt der Person und nicht einer einzelnen Zeile.
 */
export async function neueLeistungGesperrt(ref: string): Promise<boolean> {
  // ── E-IT-B (08.10.2026): DIE EINE REGEL „WIRKSAM GEKÜNDIGT“ ────────────────
  // Vorher sperrte JEDE gekündigte Bestellung den Laden — auch eine gekündigte
  // Bonitätsauskunft neben einem laufenden Stufenpaket (Personen 4919, 11498).
  // Jetzt dieselbe Regel wie überall (shared/fiaon-kuendigung-regel.ts):
  // Stufenpaket gekündigt, kein bezahlter, ungekündigter Vertrag daneben.
  // Eine Bestellung ohne Person (Altbestand) urteilt über sich selbst.
  const [b] = (await sqlPool`
    SELECT person_id, (gekuendigt_am IS NOT NULL AND merged_into IS NULL AND ${sqlPool.unsafe(produktkategorieSql())} = 'konto') AS selbst
      FROM fiaon_applications WHERE ref = ${ref} LIMIT 1`.catch(() => [])) as any[];
  if (!b) return false;
  if (b.person_id == null) return b.selbst === true;
  const [a] = (await sqlPool.unsafe(`SELECT ${KUENDIGUNG_WIRKSAM_SQL("$1::int")} AS gesperrt`, [Number(b.person_id)]).catch(() => [])) as any[];
  return a?.gesperrt === true;
}
