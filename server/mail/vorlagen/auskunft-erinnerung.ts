// ═══════════════════════════════════════════════════════════════════════════
// VORLAGE: ZAHLUNGSERINNERUNG AN EINE OFFENE BONITÄTSAUSKUNFT (26.09.2026, E-244)
// Absender „FIAON Accounting" (motor.ts, ROLLE_JE_EVENT) · nur über den Motor
//
// Justin (26.09.2026): „Jeder, der die SCHUFA offen hat, braucht eine E-Mail mit
// Zahlungserinnerung." Bis heute bekamen Auskunft-Besteller entweder gar nichts
// (29 von 33 mit laufendem Paket fielen aus der Paket-Mahnmaschine) oder die
// Paket-Mahnung („Ihre Akte wartet auf den Start", Werbeblock zur Karte) — 381
// Stück seit dem 11.08., davon 208 an Menschen, die „überwiesen" gemeldet hatten.
// Der Takt steht in server/lib/fiaon-auskunft-erinnerung.ts; hier nur der Text.
//
// ── WAS DIE MAIL SAGT ─────────────────────────────────────────────────────
//   · Anlass je Stufe (Tag 1, 4, 10, 18, danach die ruhige Dauerstufe) — ehrlich,
//     ohne „letzte Frist", ohne Gebühr, ohne Druck.
//   · Betrag, Bankdaten (shared/fiaon-bank.ts über den Motor), Verwendungszweck,
//     GiroCode und Knopf zur Zahlungsseite /zahlung/<Verwendungszweck>.
//   · Die Leistung mit den Auskunfteien des LANDES ({{params.auskunfteien}} aus
//     der Tür, auskunftMailAnreichern) — AT und CH lesen nie „SCHUFA".
//   · „Schon überwiesen? …" und „Sie möchten die Auskunft nicht mehr? …" —
//     beide Sätze wörtlich aus Justins Auftrag.
//   · Der Leistungssatz folgt derselben Weiche wie die Zahlungsdaten-Mail:
//     Einkauf („beschaffen wir") oder Vollmacht (eigene Mail zum Unterschreiben),
//     und wer den Beginn erst nach der Widerrufsfrist gewählt hat
//     (widerruf_wahl = nicht_verlangt), liest das auch hier — ohne Datum, denn
//     bei einer nachgeholten Belehrung stimmt das alte „ab dem …" nicht mehr.
//   · Solange für die Bestellung KEINE Belehrung in Textform protokolliert ist
//     (`mit_belehrung: "ja"`, entscheidet der Takt), trägt die Mail darunter
//     Vertragsbestätigung, Widerrufsbelehrung und Muster-Formular — die
//     Abschnitte der Zahlungsdaten-Mail (auskunftZahlungsdatenBaustein), aber
//     als NACHGEHOLTE Fassung: Der Muster-Satz „… ab dem Tag des
//     Vertragsabschlusses" wird ersetzt durch „… ab dem Tag, an dem Sie diese
//     E-Mail erhalten haben", davor ein Satz, dass wir die Belehrung hiermit in
//     Textform schicken. Gegenprüfung 26.09.2026: Bei Wochen alten Bestellungen
//     hätte der Kunde sonst gelesen, sein Widerrufsrecht sei abgelaufen. Die
//     Frist so zu rechnen ist die für den Kunden günstigere Lesart; ob sie
//     rechtlich zwingend ist, entscheidet diese Vorlage NICHT — vor jeder
//     Änderung des Satzes rechtlich gegenlesen lassen. Die Musterwirkung trägt
//     die nachgeholte Fassung nicht (sie weicht bewusst ab).
//   · Kein Karten-Ziel-Block und kein Werbeabsatz: Das ist Zahlungspost zu einem
//     geschlossenen Vertrag (ZAHLUNGSPOST in fiaon-mail-frequenz.ts). Die
//     mitgeschickte Vertragsbestätigung nennt die Leistung wörtlich wie die
//     Bestellseite (auskunftLeistung, shared/fiaon-auskunft.ts) — dort steht
//     auch der Satz zum Betreuer und zum Weg zur Karte; das ist Vertragsinhalt,
//     kein Werbesatz.
// ═══════════════════════════════════════════════════════════════════════════
import type { MailBaustein } from "../geruest";
import { auskunftZahlungsdatenBaustein, lieferwegAusNutzlast } from "./auskunft-lead";
import { AUSKUNFT_WIDERRUF, auskunftBeginnWahl } from "@shared/fiaon-auskunft-widerruf";

export const AUSKUNFT_ERINNERUNG_EVENT = "auskunft_zahlung_erinnerung";

/** Die beiden Sätze aus Justins Auftrag — wörtlich, eine Quelle für Vorlage und Prüfstand. */
export const SCHON_UEBERWIESEN_SATZ = "Schon überwiesen? Dann ist alles in Ordnung — die Zuordnung dauert meist ein bis zwei Werktage.";
export const NICHT_MEHR_SATZ = "Sie möchten die Auskunft nicht mehr? Antworten Sie kurz auf diese Mail — wir stornieren, es entstehen keine Kosten.";

/** Der Muster-Satz, den die nachgeholte Belehrung ersetzt — gelesen aus der EINEN Quelle, damit ein neuer Wortlaut auffällt. */
export const MUSTER_FRIST_SATZ = AUSKUNFT_WIDERRUF.abschnitte[0].absaetze[1];
/** Der Ersatz in der nachgeholten Fassung. */
export const NACHGEHOLT_FRIST_SATZ = "Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag, an dem Sie diese E-Mail erhalten haben.";
/** Der Satz über der nachgeholten Belehrung. */
export const NACHGEHOLT_HINWEIS = "Mit dieser E-Mail schicken wir Ihnen die Widerrufsbelehrung zu Ihrer Bestellung in Textform. "
  + "Ihre Widerrufsfrist von vierzehn Tagen rechnen wir deshalb ab dem Tag, an dem Sie diese E-Mail erhalten haben.";

/**
 * Der Leistungsabsatz — dieselbe Weiche wie auskunftZahlungsdatenBaustein (auskunft-lead.ts): Einkauf oder
 * Vollmacht, und die Wahl zum Beginn (nur Verbraucher). Ohne Liefermodus (Vorschau ohne Datenbank) der Einkauf.
 */
export function erinnerungLeistungSatz(p: Record<string, unknown>): string {
  const firma = String(p.auskunft_art ?? "").trim() === "firma";
  const nachFrist = !firma && auskunftBeginnWahl(p.widerruf_wahl) === "nicht_verlangt";
  if (lieferwegAusNutzlast(p) === "vollmacht") {
    const was = firma
      ? "Sobald Ihre Überweisung da ist, fordern wir die Daten Ihres Unternehmens bei den Wirtschaftsauskunfteien an, dazu die persönliche Datenkopie der Inhaberin bzw. des Inhabers oder der Geschäftsführung bei {{params.auskunfteien}}."
      : "Sobald Ihre Überweisung da ist, bereiten wir Ihre Anfragen an {{params.auskunfteien}} vor.";
    return `${was} Dafür bekommen Sie eine eigene E-Mail mit dem Link, über den Sie Vollmacht und Anfragen am Bildschirm unterschreiben.`
      + (nachFrist ? " Wie bei Ihrer Bestellung gewählt, übermitteln wir die Anfragen erst nach Ablauf der Widerrufsfrist." : "");
  }
  const was = firma
    ? "die Auskünfte Ihres Unternehmens bei den Wirtschaftsauskunfteien und die persönliche Auskunft der Inhaberin bzw. des Inhabers oder der Geschäftsführung bei {{params.auskunfteien}}"
    : "Ihre Auskunft bei {{params.auskunfteien}}";
  return `Sobald Ihre Überweisung da ist, beschaffen wir ${was}${nachFrist ? " — wie bei Ihrer Bestellung gewählt, erst nach Ablauf der Widerrufsfrist" : ""}. `
    + "Wir erklären jeden Eintrag in klaren Worten und legen Ihnen Handlungsplan und fertige Schreiben zur Freigabe vor.";
}

/**
 * Der Anhang als NACHGEHOLTE Fassung: ohne das alte „ab dem …"-Datum (widerruf_ab rechnet ab der Bestellung),
 * der Frist-Satz ersetzt, davor der Hinweis. Für Unternehmen gibt es keinen Frist-Satz — dort bleibt alles.
 */
export function nachgeholterAnhang(p: Record<string, unknown>): MailBaustein["anhang"] {
  const { widerruf_ab: _ab, ...ohneAb } = p;
  const anhang = auskunftZahlungsdatenBaustein(ohneAb).anhang;
  if (!anhang?.length) return anhang;
  return anhang.map((teil) => {
    if (!teil.absaetze.some((a) => a.includes(MUSTER_FRIST_SATZ))) return teil;
    return {
      ...teil,
      absaetze: [NACHGEHOLT_HINWEIS, ...teil.absaetze.map((a) => a.split(MUSTER_FRIST_SATZ).join(NACHGEHOLT_FRIST_SATZ))],
    };
  });
}

/** Die Stufe aus der Nutzlast: 1–4 feste Tage, ab 5 die Dauerstufe. Unlesbar = 1. */
export function erinnerungStufeAusNutzlast(p: Record<string, unknown>): number {
  const n = Math.round(Number(p.stufe));
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

/** Betreff, Titel und erster Satz je Stufe — ehrlich, ohne Frist mit Zahl und ohne Drohung. */
function anlass(stufe: number): { betreff: string; titel: string; preheader: string; einstieg: string } {
  if (stufe <= 1) {
    return {
      betreff: "Ihre Bonitätsauskunft: die Zahlungsdaten zu Ihrer Bestellung",
      titel: "Ihre Auskunft wartet auf Ihre Überweisung",
      preheader: "Hier sind die Zahlungsdaten zu Ihrer Bestellung noch einmal.",
      einstieg: "danke für Ihre Bestellung von <b>{{params.paket}}</b> am {{params.bestellt_am}}. Ihre Überweisung ist bei uns noch nicht angekommen — damit Sie nicht suchen müssen, stehen die Zahlungsdaten hier noch einmal.",
    };
  }
  if (stufe === 2) {
    return {
      betreff: "Erinnerung: Ihre Bestellung der Bonitätsauskunft ist noch offen",
      titel: "Ihre Bestellung ist noch offen",
      preheader: "Eine kurze Erinnerung mit allen Zahlungsdaten.",
      einstieg: "eine kurze Erinnerung: Ihre Bestellung von <b>{{params.paket}}</b> vom {{params.bestellt_am}} ist noch offen. Alles, was Sie für die Überweisung brauchen, steht unten.",
    };
  }
  if (stufe === 3) {
    return {
      betreff: "Ihre Bonitätsauskunft wartet noch auf Ihre Überweisung",
      titel: "Wir warten noch auf Ihre Überweisung",
      preheader: "Alle Zahlungsdaten zu Ihrer Bestellung auf einen Blick.",
      einstieg: "Ihre Bestellung von <b>{{params.paket}}</b> vom {{params.bestellt_am}} wartet noch auf Ihre Überweisung. Sobald sie da ist, geht Ihre Bestellung weiter.",
    };
  }
  if (stufe === 4) {
    return {
      betreff: "Ihre Bestellung ist weiter offen — Bonitätsauskunft {{params.payment_reference}}",
      titel: "Ihre Bestellung ist weiter offen",
      preheader: "Alle Zahlungsdaten auf einen Blick — oder kurz antworten, wenn Sie die Auskunft nicht mehr möchten.",
      einstieg: "Ihre Bestellung von <b>{{params.paket}}</b> vom {{params.bestellt_am}} ist weiter offen. Hier noch einmal alles, was Sie für die Überweisung brauchen.",
    };
  }
  return {
    betreff: "Offene Bestellung: Ihre Bonitätsauskunft ({{params.payment_reference}})",
    titel: "Ihre Bestellung ist noch offen",
    preheader: "Möchten Sie die Auskunft weiterhin, genügt die Überweisung — sonst reicht eine kurze Antwort.",
    einstieg: "Ihre Bestellung von <b>{{params.paket}}</b> vom {{params.bestellt_am}} ist noch offen. Möchten Sie die Auskunft weiterhin, genügt die Überweisung mit den Daten unten. Möchten Sie sie nicht mehr, sagen Sie es uns kurz.",
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE FASSUNG „FRAGE" (Nachbesserung 26.09.2026, Gesamtdurchsicht)
//
// Für eine offene Bestellung OHNE Erklärung des Kunden (KUNDENERKLAERUNG_SQL, fiaon-auskunft.ts —
// Altbestand vom Betreuer „auf Kundenwunsch aus der Akte", von Mara, alter Kaufweg). Sie darf keine
// „Vertragsbestätigung", kein „danke für Ihre Bestellung" und keine Zahlungsaufforderung tragen: Ein
// Vertrag ist ohne den Klick des Kunden womöglich nie zustande gekommen (§ 312j Abs. 3/4 BGB). Stattdessen:
//   · Betreff „Zu Ihrer Bonitätsauskunft ist noch eine Bestellung offen — möchten Sie sie noch?",
//   · Betrag genannt, KEINE Bankdaten, kein Verwendungszweck als Zahlungsanweisung, kein GiroCode,
//   · Knopf auf den KAUFLINK der Person (kauf_url): Er zeigt für genau diese Bestellung das
//     Bestätigungsformular zu ihrem Betrag (offenOhneWahl) und holt Auftrag und Wahl zum Beginn ein —
//     deshalb hier keine Belehrung als Anhang (das Formular trägt sie),
//   · „Möchten Sie sie nicht mehr? Antworten Sie kurz — wir stornieren, es entstehen keine Kosten."
// Der Takt (Tag 1/4/10/18, danach höchstens zwei Dauer-Nachfragen) steht in fiaon-auskunft-erinnerung.ts.
// ═══════════════════════════════════════════════════════════════════════════

/** Der Satz aus dem Auftrag der Gesamtdurchsicht — wörtlich, eine Quelle für Vorlage und Prüfstand. */
export const FRAGE_NICHT_MEHR_SATZ = "Möchten Sie sie nicht mehr? Antworten Sie kurz — wir stornieren, es entstehen keine Kosten.";
/** Der Betreff der ersten Nachfrage — wörtlich aus dem Auftrag. */
export const FRAGE_BETREFF = "Zu Ihrer Bonitätsauskunft ist noch eine Bestellung offen — möchten Sie sie noch?";
/** Der Betreff der Frage direkt beim Anlegen durch den Betreuer (Nachbesserung 26.09.2026, statt der Zahlungsdaten). */
export const FRAGE_BETREFF_FRISCH = "Ihre Bonitätsauskunft: Bitte bestätigen Sie Ihre Bestellung";
/** Keine Zahlung, bevor der Kunde selbst bestätigt hat. */
export const FRAGE_ZAHLUNG_SATZ = "Eine Zahlung erwarten wir erst, wenn Sie die Bestellung selbst bestätigt haben.";

/** Ist die Nutzlast die Fassung „Frage"? */
export function istFrage(p: Record<string, unknown>): boolean {
  return String(p.fassung ?? "").trim() === "frage";
}

/**
 * Betreff, Titel und Einstieg. `erste` = die erste Nachfrage überhaupt (auch wenn eine alte Bestellung gleich in der
 * Dauerstufe einsteigt) — dann nie „noch einmal", sondern die Frage aus dem Auftrag.
 */
function frageAnlass(stufe: number, erste: boolean, frisch = false): { betreff: string; titel: string; preheader: string; einstieg: string } {
  // Nachbesserung 26.09.2026 (Gegenprüfung): die Frage direkt beim Anlegen durch den Betreuer (statt der Zahlungsdaten) —
  // nie „seit dem … offen", nie „noch": Die Bestellung ist eben erst angelegt.
  if (frisch) {
    return {
      betreff: FRAGE_BETREFF_FRISCH,
      titel: "Bitte bestätigen Sie Ihre Bestellung",
      preheader: "Ihre Bestellung ist vorbereitet — bestätigen oder kurz absagen.",
      einstieg: "für Sie ist am {{params.bestellt_am}} eine Bestellung Ihrer Bonitätsauskunft angelegt worden: <b>{{params.paket}}</b> über {{params.betrag}} €. Bevor wir beginnen und bevor Sie etwas bezahlen, brauchen wir Ihre eigene Bestätigung: Möchten Sie die Auskunft?",
    };
  }
  const kern = "bei uns ist seit dem {{params.bestellt_am}} eine Bestellung Ihrer Bonitätsauskunft offen: <b>{{params.paket}}</b> über {{params.betrag}} €.";
  if (stufe <= 1 || erste) {
    return {
      betreff: FRAGE_BETREFF,
      titel: "Möchten Sie Ihre Bonitätsauskunft noch?",
      preheader: "Eine kurze Frage zu Ihrer offenen Bestellung — bestätigen oder kurz absagen.",
      einstieg: `${kern} Eine Bestätigung von Ihnen selbst haben wir dazu noch nicht — deshalb fragen wir kurz nach: Möchten Sie die Auskunft noch?`,
    };
  }
  if (stufe <= 4) {
    return {
      betreff: "Kurze Nachfrage: Möchten Sie Ihre Bonitätsauskunft noch?",
      titel: "Möchten Sie Ihre Bonitätsauskunft noch?",
      preheader: "Ihre Bestellung ist noch offen — bestätigen oder kurz absagen.",
      einstieg: `${kern} Wir haben dazu noch keine Bestätigung von Ihnen und fragen deshalb noch einmal nach: Möchten Sie die Auskunft noch?`,
    };
  }
  return {
    betreff: "Ihre offene Bestellung der Bonitätsauskunft — möchten Sie sie noch?",
    titel: "Ihre Bestellung ist noch offen",
    preheader: "Bestätigen Sie die Bestellung, wenn Sie die Auskunft möchten — sonst genügt eine kurze Antwort.",
    einstieg: `${kern} Eine Bestätigung von Ihnen haben wir weiterhin nicht. Möchten Sie die Auskunft, bestätigen Sie die Bestellung mit dem Knopf unten; sonst genügt eine kurze Antwort.`,
  };
}

/** Rein: die Mail der Fassung „Frage" — ohne Bankdaten, ohne Belehrung, Knopf auf den Kauflink. */
export function auskunftFrageBaustein(p: Record<string, unknown>): MailBaustein {
  const stufe = erinnerungStufeAusNutzlast(p);
  const erste = String(p.erste_nachfrage ?? "").trim() === "ja";
  const frisch = String(p.frisch ?? "").trim() === "ja";
  const a = frageAnlass(stufe, erste, frisch);
  const firma = String(p.auskunft_art ?? "").trim() === "firma";
  const was = firma
    ? "Wir holen die Auskünfte Ihres Unternehmens bei den Wirtschaftsauskunfteien und die persönliche Auskunft der Inhaberin bzw. des Inhabers oder der Geschäftsführung bei {{params.auskunfteien}} ein"
    : "Wir holen Ihre Auskunft bei {{params.auskunfteien}} ein";
  return {
    betreff: a.betreff,
    preheader: a.preheader,
    titel: a.titel,
    marke: stufe >= 2 && !erste && !frisch ? "Nachfrage" : undefined,
    absaetze: [
      `{{params.anrede}} ${a.einstieg}`,
      "Wenn ja: Mit dem Knopf unten sehen Sie Leistung und Betrag, bestätigen den Auftrag selbst und entscheiden, ob wir sofort oder erst nach Ablauf der Widerrufsfrist beginnen. Danach kommen Sie zur Zahlungsseite.",
      `${was}, erklären jeden Eintrag in klaren Worten und legen Ihnen Handlungsplan und fertige Schreiben zur Freigabe vor.`,
      FRAGE_ZAHLUNG_SATZ,
      FRAGE_NICHT_MEHR_SATZ,
    ],
    daten: [
      { label: "Bestellung", wert: "{{params.paket}}" },
      { label: "Betrag", wert: "{{params.betrag}} € einmalig" },
      { label: "Angelegt am", wert: "{{params.bestellt_am}}" },
    ],
    knopf: { text: "Bestellung ansehen und bestätigen — {{params.betrag}} €", url: "{{params.kauf_url}}" },
    // Keine eigene Fußnote: Der Rahmen sagt schon „Fragen? Antworten Sie einfach auf diese E-Mail", der Satz oben „Antworten Sie kurz".
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE FASSUNG „BESTÄTIGUNG" (Nachbesserung 26.09.2026, Gegenprüfung der Gesamtdurchsicht)
//
// Bestätigt ein Kunde eine offene Bestellung OHNE Erklärung (Altbestand, Betreuer) über den Kauflink
// oder die Bestellseite, wird sie wiederverwendet — payment_details geht dabei nicht (das gibt es nur
// für eine NEUE Bestellung). Ohne diese Mail käme die Vertragsbestätigung mit Belehrung erst mit der
// nächsten fälligen Erinnerung, und zahlte er sofort, nie (§ 312f Abs. 2, § 356 Abs. 3 BGB). Deshalb
// sofort nach der Bestätigung: „danke für Ihre Bestätigung", Zahlungsdaten, Vertragsbestätigung,
// Widerrufsbelehrung und Muster-Formular — die Frist ab Zugang dieser Mail (nachgeholte Fassung,
// dieselben Sätze wie die Erinnerung), „Bestätigt am" statt des alten Anlagedatums. Kein „Schon
// überwiesen?" und kein „nicht mehr?" — das ist die Bestätigung eines eben geschlossenen Vertrags.
// ═══════════════════════════════════════════════════════════════════════════

/** Ist die Nutzlast die Fassung „Bestätigung"? */
export function istBestaetigung(p: Record<string, unknown>): boolean {
  return String(p.fassung ?? "").trim() === "bestaetigung";
}

export const BESTAETIGUNG_BETREFF = "Ihre Bonitätsauskunft: Vertragsbestätigung und Zahlungsdaten";

/** Rein: die Vertragsbestätigung nach der Bestätigung einer offenen Bestellung — immer mit (nachgeholter) Belehrung. */
export function auskunftBestaetigungBaustein(p: Record<string, unknown>): MailBaustein {
  const bestaetigtAm = /^\d{2}\.\d{2}\.\d{4}$/.test(String(p.bestaetigt_am ?? "").trim()) ? String(p.bestaetigt_am).trim() : null;
  const basis: MailBaustein = {
    betreff: BESTAETIGUNG_BETREFF,
    preheader: "Danke für Ihre Bestätigung — hier sind Zahlungsdaten, Vertragsbestätigung und Widerrufsbelehrung.",
    titel: "Danke für Ihre Bestätigung",
    absaetze: [
      `{{params.anrede}} danke — Sie haben Ihre Bestellung von <b>{{params.paket}}</b> über {{params.betrag}} €${bestaetigtAm ? ` am ${bestaetigtAm}` : ""} selbst bestätigt. Hier sind die Zahlungsdaten, Ihre Vertragsbestätigung und die Belehrung über Ihr Widerrufsrecht.`,
      erinnerungLeistungSatz(p),
      "Wichtig ist nur der <b>Verwendungszweck</b>: An ihm erkennt unser System Ihre Zahlung.",
    ],
    daten: [
      { label: "Betrag", wert: "{{params.betrag}} €" },
      { label: "Empfänger", wert: "{{params.empfaenger}}" },
      { label: "IBAN", wert: "{{params.iban}}" },
      { label: "BIC", wert: "{{params.bic}}" },
      { label: "Verwendungszweck", wert: "{{params.payment_reference}}" },
      ...(bestaetigtAm ? [{ label: "Bestätigt am", wert: bestaetigtAm }] : []),
    ],
    bild: { url: "https://fiaon.com/api/fiaon/zahlung/{{params.payment_reference}}/qr.png", alt: "GiroCode — mit der Banking-App scannen", unterschrift: "Mit der Banking-App scannen: Empfänger, IBAN, Betrag und Verwendungszweck sind schon ausgefüllt." },
    knopf: { text: "Zahlungsseite öffnen — QR-Code & Bankdaten", url: "https://fiaon.com/zahlung/{{params.payment_reference}}" },
    fussnote: "Unten finden Sie Ihre Vertragsbestätigung und die Belehrung über Ihr Widerrufsrecht zum Nachlesen und Aufbewahren. Fragen zu Ihrer Bestellung? Antworten Sie einfach auf diese E-Mail.",
  };
  // Ohne das alte Anlagedatum („Bestellt am: 16.07.") — der Vertrag kam mit der Bestätigung zustande.
  const { auskunft_bestellt_am: _alt, ...ohneAlt } = p;
  const anhang = nachgeholterAnhang(ohneAlt)?.map((teil) => (bestaetigtAm && teil.titel === "Ihre Vertragsbestätigung"
    ? { ...teil, absaetze: [...teil.absaetze.slice(0, 1), `<b>Von Ihnen bestätigt am:</b> ${bestaetigtAm}`, ...teil.absaetze.slice(1)] }
    : teil));
  return anhang?.length ? { ...basis, anhang } : basis;
}

/**
 * Die Mail für eine Stufe — rein, ohne Datenbank. Die Tür (make-webhook.ts)
 * legt `auskunfteien`, `auskunft_art`, `auskunft_land` und die Widerrufs-Werte
 * in die Nutzlast; der Takt `stufe`, `bestellt_am`, `anrede`, `mit_belehrung`.
 * Gesamtdurchsicht 26.09.2026: `fassung: "frage"` → auskunftFrageBaustein (nie Belehrung, nie Bankdaten).
 */
export function auskunftErinnerungBaustein(p: Record<string, unknown>): MailBaustein {
  if (istFrage(p)) return auskunftFrageBaustein(p);
  if (istBestaetigung(p)) return auskunftBestaetigungBaustein(p);
  const stufe = erinnerungStufeAusNutzlast(p);
  const a = anlass(stufe);
  const mitBelehrung = String(p.mit_belehrung ?? "").trim() === "ja";
  const leistung = erinnerungLeistungSatz(p);
  const absaetze = [
    `{{params.anrede}} ${a.einstieg}`,
    leistung,
    "Wichtig ist nur der <b>Verwendungszweck</b>: An ihm erkennt unser System Ihre Zahlung.",
    SCHON_UEBERWIESEN_SATZ,
    NICHT_MEHR_SATZ,
  ];
  const basis: MailBaustein = {
    betreff: mitBelehrung ? `${a.betreff} — mit Ihrer Vertragsbestätigung` : a.betreff,
    preheader: a.preheader,
    titel: a.titel,
    marke: stufe >= 2 ? "Erinnerung" : undefined,
    absaetze,
    daten: [
      { label: "Betrag", wert: "{{params.betrag}} €" },
      { label: "Empfänger", wert: "{{params.empfaenger}}" },
      { label: "IBAN", wert: "{{params.iban}}" },
      { label: "BIC", wert: "{{params.bic}}" },
      { label: "Verwendungszweck", wert: "{{params.payment_reference}}" },
      { label: "Bestellt am", wert: "{{params.bestellt_am}}" },
    ],
    bild: { url: "https://fiaon.com/api/fiaon/zahlung/{{params.payment_reference}}/qr.png", alt: "GiroCode — mit der Banking-App scannen", unterschrift: "Mit der Banking-App scannen: Empfänger, IBAN, Betrag und Verwendungszweck sind schon ausgefüllt." },
    knopf: { text: "Zahlungsseite öffnen — QR-Code & Bankdaten", url: "https://fiaon.com/zahlung/{{params.payment_reference}}" },
    fussnote: mitBelehrung
      ? "Unten finden Sie Ihre Vertragsbestätigung und die Belehrung über Ihr Widerrufsrecht zum Nachlesen und Aufbewahren. Fragen zu Ihrer Bestellung? Antworten Sie einfach auf diese E-Mail."
      : "Fragen zu Ihrer Bestellung? Antworten Sie einfach auf diese E-Mail.",
  };
  if (!mitBelehrung) return basis;
  // Die Abschnitte der Zahlungsdaten-Mail — Leistung je Land, Preis, Anbieter, Belehrung, Muster-Formular —
  // als nachgeholte Fassung (Frist ab Zugang dieser Mail). Die Erinnerung trägt die Belehrung NUR, wenn noch keine protokolliert ist.
  const anhang = nachgeholterAnhang(p);
  return anhang?.length ? { ...basis, anhang } : basis;
}

/** Für den Motor (hatVorlage, Galerie): die Vorlage der ersten Stufe ohne Belehrung. */
export const AUSKUNFT_ERINNERUNG_VORLAGEN: Record<typeof AUSKUNFT_ERINNERUNG_EVENT, MailBaustein> = {
  auskunft_zahlung_erinnerung: auskunftErinnerungBaustein({ stufe: 1 }),
};
