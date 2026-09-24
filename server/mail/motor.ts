// ═══════════════════════════════════════════════════════════════════════════
// DER MAIL-MOTOR (28.08.2026)
//
// Rendert die Quelltext-Vorlagen (vorlagen/*.ts) mit einer Ereignis-Nutzlast
// und versendet direkt über Brevo — OHNE Make-Umweg und ohne Brevo-Vorlagen.
//
// ── DIE EINE TÜR BLEIBT DIE EINE TÜR ──────────────────────────────────────
// Kein Aufrufer ruft den Motor direkt. Alles läuft weiter durch
// sendMakeWebhookMitGrund (make-webhook.ts); NUR DORT entscheidet der
// Schalter `mail_versandweg` (fiaon_settings), was hinter der Tür passiert:
//   make    → wie bisher: Webhook an Make, Make rendert die Brevo-Vorlage
//   direkt  → dieser Motor: rendern + Brevo /smtp/email mit fertigem HTML
// So bleiben alle 72 Aufrufstellen unangetastet, jede Mail steht im
// Protokoll, und der Schalter geht jederzeit in beide Richtungen.
//
// ── WARUM KEINE BREVO-VORLAGEN MEHR ───────────────────────────────────────
// Der Motor schickt das fertige HTML mit. Damit gibt es genau EINEN Ort, an
// dem eine Mail entsteht (dieses Verzeichnis), und die Vorschau im Portal
// zeigt garantiert dasselbe, was der Kunde bekommt — es IST dieselbe Funktion.
//
// ── FEHLENDE PLATZHALTER SIND LAUT ────────────────────────────────────────
// Ein {{params.x}}, das die Nutzlast nicht mitbringt, wird leer ersetzt UND
// im Ergebnis gemeldet. Beim Prüfversand sieht man es sofort; im Betrieb
// steht es im Protokoll-Grund. Vorher hätte Make kommentarlos „{{vorname}}"
// in die Mail gedruckt.
// 18.09.2026: Das galt NICHT für Knöpfe — ein Knopf ohne Ziel verschwand
// still, bevor gefüllt wurde. Jetzt steht auch er in der Fehlliste
// (knopfEntfallen), und der Handversand lehnt ab (versandLuecke in
// server/lib/fiaon-mail-senden.ts). Prüfstand: scripts/pruef-mail-knoepfe.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { BANK } from "@shared/fiaon-bank";
import {
  ABSENDER, mailHtml, mailText, ratenLeisteEinsetzen,
  type AbsenderRolle, type MailBaustein,
} from "./geruest";
import { KONTO_VORLAGEN } from "./vorlagen/konto";
import { ZAHLUNG_VORLAGEN } from "./vorlagen/zahlung";
import { TERMIN_VORLAGEN, GLOBAL_TERMIN_EN } from "./vorlagen/termin";
import { AUSKUNFT_LEAD_VORLAGEN, AUSKUNFT_ZAHLUNG_VORLAGEN, auskunftZahlungsdatenBaustein, auskunftZahlungEingangBaustein, istAuskunftNutzlast } from "./vorlagen/auskunft-lead";
import { AUSKUNFT_VERKAUF_VORLAGEN, auskunftAngebotBaustein } from "./vorlagen/auskunft-verkauf";
import { TEAM_VORLAGEN } from "./vorlagen/team";
import { RUECKHOLUNG_VORLAGEN } from "./vorlagen/rueckholung";
import { APP_VORLAGEN } from "./vorlagen/app";
import { BEWERBUNG_VORLAGEN } from "./vorlagen/bewerbung";
import { GLOBAL_VORLAGEN, GLOBAL_VORLAGEN_EN } from "./vorlagen/global";
import { GLOBAL_BEREICH_VORLAGEN, GLOBAL_BEREICH_VORLAGEN_EN } from "./vorlagen/global-bereich";

/** Alle Vorlagen, ein Verzeichnis. Schlüssel = Ereignisname. */
export const VORLAGEN: Record<string, MailBaustein> = {
  ...KONTO_VORLAGEN,
  ...ZAHLUNG_VORLAGEN,
  ...TERMIN_VORLAGEN,
  ...AUSKUNFT_LEAD_VORLAGEN,
  // E-240 (24.09.2026): das Angebot der Bonitätsauskunft (Werbung, drei Fassungen).
  ...AUSKUNFT_VERKAUF_VORLAGEN,
  ...TEAM_VORLAGEN,
  ...RUECKHOLUNG_VORLAGEN,
  ...APP_VORLAGEN,
  ...BEWERBUNG_VORLAGEN,
  ...GLOBAL_VORLAGEN,
  ...GLOBAL_BEREICH_VORLAGEN,
};

/**
 * Englische Fassungen — gleicher Ereignisname, andere Sprache (E-188, 17.09.2026).
 *
 * Es gibt sie nur dort, wo ein Kunde seinen Vorgang auf Englisch geführt hat:
 * beim Auftrag über FIAON Global (/en/business/start). Gewählt wird über die
 * NUTZLAST (`sprache: "en"`), nicht über einen zweiten Ereignisnamen — so bleibt
 * es im Protokoll, im Mailwerk und in der Frequenzbremse EIN Ereignis. Fehlt die
 * englische Fassung oder das Feld, gilt die deutsche: Keine einzige bestehende
 * Mail ändert sich dadurch.
 */
export const VORLAGEN_EN: Record<string, MailBaustein> = {
  ...GLOBAL_VORLAGEN_EN,
  // „Mein Auftrag" (Etappe, Frist, Dokument, Zugang) — Merge 18.09.2026.
  ...GLOBAL_BEREICH_VORLAGEN_EN,
  ...GLOBAL_TERMIN_EN,
};

/** Wer als Absender im Postfach steht — je Ereignis. Alles nicht Genannte: welcome. */
const ROLLE_JE_EVENT: Record<string, AbsenderRolle> = {
  payment_details: "accounting",
  payment_reminder: "accounting",
  abo_payment_reminder: "accounting",
  claim_received: "accounting",
  payment_cancelled: "accounting",
  payment_reactivated: "accounting",
  abo_verlaengerung_frage: "accounting",
  // Rueckholung: S1/S2 sind Zahlungsklaerungen — sie kommen aus der Buchhaltung.
  // S3-S5 sind Wiederaufnahmen des Gespraechs und laufen unter dem Standard.
  rueckhol_s1: "accounting",
  rueckhol_s2: "accounting",
  account_suspended: "legal",
  gdpr_deleted: "legal",
  agent_invite: "team",
  agent_password_reset: "team",
  agent_payment_reminder: "team",
  agent_payout_done: "team",
  agent_payout_rejected: "team",
  agent_bank_reminder: "team",
  agent_callback_reminder: "team",
  agent_feedback_rewarded: "team",
  agent_feedback_reply: "team",
  aufgabe_zugewiesen: "team",
  // Bewerber bekommen Post vom Team — nicht von Welcome (das ist die Kundenstimme).
  bewerbung_zusage: "team",
  bewerbung_absage: "team",
  contract_signed: "team",
  commission_statement_issued: "team",
  // E-188: Vertrag und Rechnung eines Firmenauftrags kommen aus der Buchhaltung.
  global_auftrag: "accounting",
  // … und die ruhige Erinnerung an dieselbe Rechnung ebenfalls.
  global_zahlung_erinnerung: "accounting",
  // 18.09.2026: Diese drei kamen als „FIAON Welcome" — die Stimme der
  // Begrüßung. Der Kontowechsel ist Buchhaltung; Kündigung und Vertragsende
  // sind Vertragspost und kommen wie die Kündigung eines Mitarbeiters (E-185)
  // von „FIAON Legal".
  bankverbindung_neu: "accounting",
  kuendigung_bestaetigt: "legal",
  vertrag_beendet: "legal",
};

/**
 * Werbung an Menschen ohne Vertrag — hier ist der Abmeldelink Pflicht
 * (18.09.2026). Ohne ihn geht die Mail nicht raus: Die Tür in make-webhook.ts
 * lehnt ab, und mailSenden sagt es vorher im Klartext. Wer eine neue
 * Werbe-Vorlage mit `abmeldeUrl` baut, trägt sie hier ein.
 */
export const ABMELDEPFLICHT = new Set<string>([
  "lead_followup", "lead_willkommen", "rueckhol_s5", "rueckhol_s5b", "rueckhol_s5c", "rueckhol_s5d",
  // E-240 (24.09.2026): Das Angebot der Bonitätsauskunft geht an Bestandskunden —
  // Werbung nach § 7 Abs. 3 UWG, also nur mit Abmeldelink und Widerspruchshinweis.
  "auskunft_angebot",
]);

/**
 * Knöpfe, deren leerer Platzhalter ERWARTET ist und keinen Versand aufhält
 * (18.09.2026). Jeder andere Knopf ohne Ziel ist ein Fehler, den der
 * Handversand ablehnt.
 */
// Merge 18.09.2026 abends: Der Knopf „Mein Auftrag" (FIAON Global) ist ein Zusatz — er fehlt
// nur ohne Antragsnummer (dann gibt es kein Token), und die Mail trägt ihren Hauptweg trotzdem.
// 19.09.2026 (E-194): „sofort_url" ist raus — die Sofortzahlung per Bank-App lief über
// GoCardless und ist beendet; keine Vorlage trägt den Knopf noch.
export const KNOPF_DARF_FEHLEN = new Set<string>(["mein_auftrag_url"]);

export function absenderFuer(event: string): { name: string; email: string } {
  return ABSENDER[ROLLE_JE_EVENT[event] ?? "welcome"];
}

export function hatVorlage(event: string): boolean {
  return !!VORLAGEN[event];
}

/**
 * Die Hausbank — der Fallback für Zahlungsmails (Justins Auftrag 28.08.:
 * „Wenn wir den Kunden an die erste Rechnung, Abo, Schufa-Rechnung erinnern,
 * dann bitte in der E-Mail unsere Bankdaten einfügen.")
 *
 * Quelle der Wahrheit bleibt FIAON_BANK_DETAILS (fiaon-antrag.ts/fiaon-invoice.ts);
 * die Werte hier sind dieselben. Bringt eine Nutzlast eigene Werte mit
 * (z. B. die Abo-Erinnerung), gewinnen die — der Fallback springt nur ein,
 * wenn das Feld fehlt.
 */
const BANK_FALLBACK: Record<string, string> = {
  empfaenger: BANK.empfaenger,
  // 02.09.2026: Wise gesperrt → Airwallex/Banking Circle. Quelle: shared/fiaon-bank.ts
  iban: BANK.ibanDisplay,
  bic: BANK.bic,
};

/** {{params.x}} durch Werte ersetzen; fehlende Schlüssel einsammeln. */
function fuellen(text: string, payload: Record<string, unknown>, fehlend: Set<string>): string {
  return text.replace(/\{\{params\.([a-z_0-9]+)\}\}/gi, (_, k: string) => {
    const wert = (payload as any)[k] ?? BANK_FALLBACK[k];
    if (wert === undefined || wert === null || String(wert).trim() === "") {
      fehlend.add(k);
      return "";
    }
    // Beträge kommen aus der Datenbank als "59.99" — im Brief steht "59,99".
    // Nur reine Zahlwerte in Betragsfeldern; alles andere bleibt unangetastet.
    if (/betrag/.test(k) && /^\d+(\.\d{1,2})?$/.test(String(wert).trim())) {
      return String(wert).trim().replace(".", ",");
    }
    return String(wert);
  });
}

export interface GerenderteMail {
  betreff: string;
  html: string;
  text: string;
  absender: { name: string; email: string };
  /** Platzhalter, die die Nutzlast nicht mitbrachte — seit 18.09.2026 auch die eines weggelassenen Knopfs, Bilds oder Abmeldelinks. */
  fehlend: string[];
  /**
   * 18.09.2026: Ist ein Knopf mangels Ziel weggefallen? Bis heute verschwand er
   * VOR dem Füllen und tauchte deshalb nie in `fehlend` auf — die Mail ging
   * ohne Knopf raus, und niemand erfuhr davon. Erwartete Lücken
   * (KNOPF_DARF_FEHLEN) zählen nicht.
   */
  knopfEntfallen: boolean;
  /** Welche Knöpfe entfielen — Platzhalter und Beschriftung, für den Klartext einer Ablehnung. */
  entfalleneKnoepfe: { platzhalter: string; text: string }[];
}

/**
 * Die Lead-Strecke fährt 11 Textvarianten mit eigenem Betreff in der Nutzlast
 * mit (shared/fiaon-lead-strecke.ts). Die Varianten sind Absicht — sie halten
 * die Strecke bei 2 Mails am Tag aus dem Spam-Raster. Bringt die Nutzlast
 * `text` und `betreff` mit, baut der Motor den Baustein daraus und behält vom
 * statischen `lead_followup`-Baustein nur Knopf, Ziel-Block und Abmeldung.
 */
function leadStreckenBaustein(payload: Record<string, unknown>): MailBaustein | null {
  const text = String((payload as any).text ?? "").trim();
  const betreff = String((payload as any).betreff ?? "").trim();
  if (!text || !betreff) return null;
  const basis = VORLAGEN.lead_followup;
  const absaetze = text.split(/\n\n+/)
    .map((a) => a.trim())
    // Knopf, Gruß und Abmeldezeile setzt das Gerüst selbst — die Rohtext-
    // Fassungen davon fliegen raus, sonst stünde alles doppelt in der Mail.
    // 18.09.2026: „Zum Termin:" ist die Knopfzeile der Termin-Varianten.
    .filter((a) => a && !/^Zum (Antrag|Termin):/i.test(a) && !/^Viele Grüße/i.test(a)
      && !/^─/.test(a) && !/keine Nachrichten mehr/i.test(a))
    .map((a) => a.replace(/\n/g, "<br />"));
  const titel = absaetze.shift() ?? basis.titel;
  // ── DER KNOPF GEHÖRT ZUR VARIANTE (18.09.2026) ────────────────────────────
  // „termin-anruf" und „termin-letzte" versprechen „wähl ein Zeitfenster, wir
  // rufen an" — der Knopf darunter hieß „Jetzt Antrag starten". Die Strecke
  // bringt Text und Ziel jetzt je Variante mit (knopf_text, knopf_url); ohne
  // beides bleibt der Antrags-Knopf der statischen Vorlage.
  const knopfText = String((payload as any).knopf_text ?? "").trim()
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return {
    ...basis, betreff, titel, absaetze,
    // Die Zeile neben dem Betreff war die Sie-Fassung der statischen Vorlage
    // („… übernimmt Ihr persönliches Team") — in einer Du-Mail. Jetzt der
    // erste Satz der Variante selbst.
    preheader: (absaetze[0] ?? "").replace(/<[^>]+>/g, "").slice(0, 90) || basis.preheader,
    knopf: knopfText ? { text: knopfText, url: "{{params.knopf_url}}" } : basis.knopf,
    // E-210 (22.09.2026): Die Strecke siezt jetzt wie das ganze Haus (E-002). Damit
    // passen Fuß, Fußnote und Karten-Satz der statischen Vorlage wieder — bis heute
    // stand hier `du: true` und der Karten-Ziel-Block war abgeschaltet.
    fussnote: basis.fussnote,
    karteZiel: true,
  };
}

/** Rendert eine Vorlage mit einer Nutzlast — Vorschau und Versand nutzen DIESELBE Funktion. */
export function mailRendern(event: string, payload: Record<string, unknown>): GerenderteMail | null {
  let vorlage = VORLAGEN[event];
  if (!vorlage) return null;
  // E-188: Trägt die Nutzlast `sprache: "en"` und gibt es die Vorlage auf Englisch, gilt diese.
  if (String((payload as any)?.sprache ?? "") === "en" && VORLAGEN_EN[event]) vorlage = VORLAGEN_EN[event];
  if (event === "lead_followup") vorlage = leadStreckenBaustein(payload) ?? vorlage;
  // ── DIE AUSKUNFT (24.09.2026, E-240) ────────────────────────────────────────
  // Das Angebot baut sich aus der Nutzlast (Land, Paket, Fassung) — ein Satz,
  // der in Österreich „SCHUFA" sagt, soll gar nicht erst als Platzhalter
  // existieren. Zahlungsdaten und Zahlungsbestätigung einer AUSKUNFT sprechen
  // nicht vom Freischalten eines Bereichs und nicht vom Startgespräch.
  if (event === "auskunft_angebot") vorlage = auskunftAngebotBaustein(payload);
  if ((event === "payment_details" || event === "payment_confirmed") && istAuskunftNutzlast(payload)) {
    // 25.09.2026 (E-240): Die Zahlungsdaten sind zugleich die Vertragsbestätigung — mit Leistung,
    // Anbieter und Widerrufsbelehrung in Textform (§ 312f Abs. 2, § 356 Abs. 3 BGB). Welche Belehrung
    // (Verbraucher/Unternehmen) und welcher Satz zur Wahl des Beginns, entscheidet die Nutzlast.
    vorlage = event === "payment_details" ? auskunftZahlungsdatenBaustein(payload) : auskunftZahlungEingangBaustein(payload);
    if (String((payload as any).auskunfteien ?? "").trim() === "") payload = { ...payload, auskunfteien: "den Auskunfteien Ihres Landes" };
  }

  const fehlend = new Set<string>();
  const entfalleneKnoepfe: { platzhalter: string; text: string }[] = [];
  const platzhalterIn = (url?: string): string | null =>
    url?.match(/\{\{params\.([a-z_0-9]+)\}\}/i)?.[1] ?? null;
  const ohneWert = (k: string) =>
    String((payload as any)[k] ?? "").trim() === "" && BANK_FALLBACK[k] === undefined;

  // Ein Knopf, dessen Adresse die Nutzlast nicht füllt (z. B. {{params.mein_auftrag_url}}
  // ohne Antragsnummer), wird weggelassen — ein Knopf ohne Ziel ist schlimmer
  // als kein Knopf. Der Ersatz: knopf2 rückt auf.
  const knopfLeer = (k?: { url: string }) => {
    const p = platzhalterIn(k?.url);
    return !!(p && ohneWert(p));
  };
  // Dasselbe für das Bild: Eine QR-Adresse mit ungefülltem Platzhalter wird
  // zu …/zahlung//qr.png — ein kaputter Kasten mit der Unterschrift „scannen
  // Sie hier“. Lieber kein Bild als ein totes (Prüfung 02.09.2026).
  // 18.09.2026: Was wegfällt, steht jetzt in `fehlend` — vorher verschwand es
  // VOR dem Füllen und tauchte in keiner Fehlliste auf.
  {
    const p = platzhalterIn(vorlage.bild?.url);
    if (p && ohneWert(p)) {
      vorlage = { ...vorlage, bild: undefined };
      fehlend.add(p);
    }
  }
  // ── DIE ABMELDEZEILE NUR MIT ZIEL (18.09.2026) ────────────────────────────
  // Ohne abmelde_url druckte das Gerüst „Hier abmelden" mit href="" — ein
  // Link, der nichts tut, in genau der Zeile, die rechtlich zählt. Jetzt
  // entfällt die Zeile, und der Platzhalter steht in `fehlend`. Werbe-Mails
  // (ABMELDEPFLICHT) gehen ohne sie gar nicht erst raus.
  {
    const p = platzhalterIn(vorlage.abmeldeUrl);
    if (p && ohneWert(p)) {
      vorlage = { ...vorlage, abmeldeUrl: undefined };
      fehlend.add(p);
    }
  }
  // ── ABSÄTZE, DIE NUR AUS EINEM PLATZHALTER BESTEHEN (18.09.2026) ──────────
  // Sie sind in den Vorlagen als WAHLWEISE gebaut: Ein Absatz wie
  // „{{params.offene_rate_hinweis}}" steht nur da, wenn es den Hinweis wirklich
  // gibt. Der Motor hat das früher nicht getan; übrig blieb ein leerer Absatz.
  // Jetzt entfällt er, ohne als Lücke zu zählen. Dasselbe für eine Fußnote aus
  // einem einzigen Platzhalter.
  {
    const nurPlatzhalter = (s?: string) => String(s ?? "").trim().match(/^\{\{params\.([a-z_0-9]+)\}\}$/i)?.[1] ?? null;
    const absaetze = vorlage.absaetze.filter((a) => { const p = nurPlatzhalter(a); return !(p && ohneWert(p)); });
    const fussP = nurPlatzhalter(vorlage.fussnote);
    if (absaetze.length !== vorlage.absaetze.length || (fussP && ohneWert(fussP))) {
      vorlage = { ...vorlage, absaetze, fussnote: fussP && ohneWert(fussP) ? undefined : vorlage.fussnote };
    }
  }
  if (knopfLeer(vorlage.knopf) || knopfLeer(vorlage.knopf2)) {
    // 18.09.2026: Jeder weggelassene Knopf wird gemeldet — außer der
    // erwarteten Lücke (KNOPF_DARF_FEHLEN). Der Handversand lehnt damit ab,
    // statt eine Mail ohne ihren eigentlichen Knopf zu verschicken.
    for (const k of [vorlage.knopf, vorlage.knopf2]) {
      const p = knopfLeer(k) ? platzhalterIn(k!.url) : null;
      if (p && !KNOPF_DARF_FEHLEN.has(p)) {
        fehlend.add(p);
        entfalleneKnoepfe.push({ platzhalter: p, text: k!.text });
      }
    }
    vorlage = { ...vorlage };
    if (knopfLeer(vorlage.knopf)) { vorlage.knopf = knopfLeer(vorlage.knopf2) ? undefined : vorlage.knopf2; vorlage.knopf2 = undefined; }
    else if (knopfLeer(vorlage.knopf2)) vorlage.knopf2 = undefined;
  }

  const html = ratenLeisteEinsetzen(fuellen(mailHtml(vorlage), payload, fehlend));
  // Der Titel wird im Text-Teil großgeschrieben — erst NACH dem Füllen. Vorher
  // wurde aus „{{params.monat_text}}" ein „{{PARAMS.MONAT_TEXT}}", das kein
  // Wert mehr traf (18.09.2026; betraf app_monatsbericht).
  const text = fuellen(mailText(vorlage, (s) => fuellen(s, payload, fehlend)), payload, fehlend)
    .replace(/%%RATENLEISTE[^%]*%%/g, "");
  const betreff = fuellen(vorlage.betreff, payload, fehlend);
  return {
    betreff, html, text, absender: absenderFuer(event), fehlend: Array.from(fehlend).sort(),
    knopfEntfallen: entfalleneKnoepfe.length > 0, entfalleneKnoepfe,
  };
}

/**
 * Der Hinweis, den ein ERFOLGREICHER Versand mitbringt (18.09.2026): welche
 * Platzhalter leer blieben und welcher Knopf deshalb fehlt. Er steht im
 * Protokoll (grund) und in der Meldung an den Mitarbeiter — nicht mehr nur in
 * einem Feld, das der Handversand auf null setzte.
 */
export function versandHinweis(mail: GerenderteMail): string | null {
  if (!mail.fehlend.length) return null;
  const knopf = mail.knopfEntfallen
    ? ` — ohne Knopf ${mail.entfalleneKnoepfe.map((k) => `„${k.text}“`).join(", ")}`
    : "";
  return `Platzhalter ohne Wert: ${mail.fehlend.join(", ")}${knopf}`;
}

/**
 * Freitext im FIAON-Gerüst (Justins Auftrag 28.08.: „Baue etwas ein, damit
 * die Mitarbeiter eine Freitext-Mail perfekt in unserem CI senden können.")
 *
 * Der Mitarbeiter liefert Betreff und Text; das Gerüst liefert Kopf, Fuß,
 * Pflichtangaben und Absender. Absätze trennt eine Leerzeile. HTML im Text
 * wird entschärft — eine Freitext-Mail ist eine Nachricht, kein Baukasten.
 */
export function freitextBaustein(ein: { betreff: string; text: string; anrede?: string | null }): MailBaustein {
  const sicher = (s: string) => s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const absaetze = ein.text.split(/\n\n+/)
    .map((a) => sicher(a.trim()).replace(/\n/g, "<br />"))
    .filter(Boolean);
  if (ein.anrede) absaetze.unshift(sicher(ein.anrede));
  return {
    persoenlich: true,
    betreff: sicher(ein.betreff),
    preheader: absaetze[0] ? absaetze[0].replace(/<br \/>/g, " ").slice(0, 90) : "Eine Nachricht von Ihrem Ansprechpartner.",
    titel: sicher(ein.betreff),
    absaetze,
  };
}

/** Freitext rendern — für die Vorschau in der Akte. */
export function freitextRendern(ein: { betreff: string; text: string; anrede?: string | null; absender?: AbsenderRolle }): GerenderteMail {
  const b = freitextBaustein(ein);
  return {
    betreff: b.betreff,
    html: mailHtml(b),
    text: mailText(b),
    // E-185: Vertragspost (z. B. die Kündigung eines Mitarbeiters) kommt von „FIAON Legal", nicht von „Welcome".
    absender: ABSENDER[ein.absender ?? "welcome"],
    fehlend: [],
    knopfEntfallen: false,
    entfalleneKnoepfe: [],
  };
}

/** Freitext direkt über Brevo senden. */
export async function freitextSenden(ein: {
  an: string; betreff: string; text: string; anrede?: string | null;
  /** E-181: z. B. die korrigierte Rechnung — Name und Inhalt, der Rest ist Brevo. */
  anhaenge?: { name: string; inhalt: Buffer }[];
  /** E-185: Absenderrolle (welcome | accounting | legal | team); Vorgabe welcome. */
  absender?: AbsenderRolle;
}): Promise<{ ok: boolean; messageId: string | null; grund?: string }> {
  if (!adresseSiehtGueltigAus(String(ein.an || "").trim())) {
    return { ok: false, messageId: null, grund: `Empfängeradresse ungültig: „${ein.an}“ — bitte in der Akte korrigieren.` };
  }
  const mail = freitextRendern(ein);
  const key = process.env.BREVO_API_KEY;
  if (!key) return { ok: false, messageId: null, grund: "BREVO_API_KEY ist nicht gesetzt." };
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": key, "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: mail.absender, replyTo: mail.absender,
        to: [{ email: ein.an }],
        subject: mail.betreff, htmlContent: mail.html, textContent: mail.text,
        tags: ["frei_text"],
        ...(ein.anhaenge?.length ? { attachment: ein.anhaenge.map((a) => ({ name: a.name, content: a.inhalt.toString("base64") })) } : {}),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false, messageId: null, grund: `Brevo hat abgelehnt (HTTP ${res.status}): ${t.slice(0, 200)}` };
    }
    const d = (await res.json().catch(() => ({}))) as { messageId?: string };
    return { ok: true, messageId: d.messageId ?? null };
  } catch (err) {
    return { ok: false, messageId: null, grund: `Brevo nicht erreichbar: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/**
 * Direktversand über Brevo. Gibt die messageId zurück — damit weiß das
 * Protokoll erstmals bei JEDER Mail, dass Brevo sie angenommen hat.
 */
/**
 * Sieht die Adresse nach einer E-Mail-Adresse aus? (29./30.08.2026)
 *
 * Brevo lehnte „bgutaj@t-online.de@" und „…@gmail.com5p" mit HTTP 400 ab —
 * zu Recht, aber als kryptische KRITISCH-Diagnose. GEMESSEN: 11 solcher
 * Adressen im Bestand (Leerzeichen, doppeltes @, Müll-Suffixe), alle aus
 * Handeingaben. Der Motor sagt es jetzt VOR dem Versand in Klartext — und
 * der Protokoll-Grund nennt die Tat: Adresse in der Akte korrigieren.
 */
function adresseSiehtGueltigAus(an: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(an);
}

export async function mailDirektSenden(
  event: string,
  payload: Record<string, unknown>,
  /**
   * E-188 (17.09.2026): Anhänge — der unterschriebene Auftrag und die Rechnung
   * von FIAON Global. Dasselbe Feld wie bei freitextSenden (E-181). Make kann
   * keine Anhänge tragen; wer welche mitgibt, ruft den Motor deshalb direkt
   * und protokolliert selbst (siehe fiaon-global-auftrag.ts).
   */
  opts: { anhaenge?: { name: string; inhalt: Buffer }[] } = {},
): Promise<{ ok: boolean; messageId: string | null; grund?: string }> {
  const an = String((payload as any).email ?? "").trim();
  if (!an) return { ok: false, messageId: null, grund: "Keine Empfängeradresse in der Nutzlast." };
  if (!adresseSiehtGueltigAus(an)) {
    return { ok: false, messageId: null, grund: `Empfängeradresse ungültig: „${an}“ — bitte in der Akte korrigieren, vorher kommt dort keine Mail an.` };
  }
  const mail = mailRendern(event, payload);
  if (!mail) return { ok: false, messageId: null, grund: `Keine Vorlage für '${event}' im Motor.` };

  const key = process.env.BREVO_API_KEY;
  if (!key) return { ok: false, messageId: null, grund: "BREVO_API_KEY ist nicht gesetzt." };
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": key, "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: mail.absender,
        replyTo: mail.absender,
        to: [{ email: an }],
        subject: mail.betreff,
        htmlContent: mail.html,
        textContent: mail.text,
        // Für Auswertungen in Brevo: welche Mail welches Ereignis war.
        tags: [event],
        ...(opts.anhaenge?.length ? { attachment: opts.anhaenge.map((a) => ({ name: a.name, content: a.inhalt.toString("base64") })) } : {}),
        // One-Click-Abmeldung (RFC 8058): Trägt die Nutzlast einen Abmeldelink,
        // bekommt der Postfach-Anbieter die Kopfzeilen, um den Abmeldeknopf
        // oben zu zeigen — sonst klicken Menschen „Spam“, und das trifft die
        // Domain für alle Mails des Hauses (Prüfung 02.09.2026).
        ...(String((payload as any)?.abmelde_url || "") ? { headers: {
          "List-Unsubscribe": `<${String((payload as any).abmelde_url)}>, <mailto:${mail.absender.email}?subject=Stopp>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        } } : {}),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false, messageId: null, grund: `Brevo hat abgelehnt (HTTP ${res.status}): ${t.slice(0, 200)}` };
    }
    const d = (await res.json().catch(() => ({}))) as { messageId?: string };
    return { ok: true, messageId: d.messageId ?? null, grund: versandHinweis(mail) ?? undefined };
  } catch (err) {
    return { ok: false, messageId: null, grund: `Brevo nicht erreichbar: ${err instanceof Error ? err.message : String(err)}` };
  }
}
