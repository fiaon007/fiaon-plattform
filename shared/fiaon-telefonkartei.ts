// ═══════════════════════════════════════════════════════════════════════════
// DIE TELEFONKARTEI — Justins eigene Anrufseite (21.09.2026, E-201)
//
// Justin: „Ich habe heute selbst telefoniert und es lief hervorragend — ich
// möchte, dass du für mich eine eigene Seite erstellst (ganz simpel gehalten):
// ALLE Kunden im System, A-, B- und C-Kunden, Zahlung gemeldet, Rate offen.
// Für Handy und Laptop optimiert — ich sehe eine Kartei mit allen Informationen,
// ohne sie zu öffnen. […] Für jeden Kunden folgende WhatsApp vorbereiten […]
// Wenn ich auf ‚storniert‘ klicke, soll er storniert werden und auf eine eigene
// Liste kommen und nirgendwo mehr erscheinen."
//
// WARUM DIESE DATEI IN shared/ LIEGT
// Die Gruppen, die Kartendaten und die Texte der vier Fälle (WhatsApp UND Mail)
// brauchen die Seite, der Server und der Prüfstand (scripts/pruef-telefonkartei.ts,
// scripts/pruef-telefonkartei-meta.ts). Betrag und Verwendungszweck kommen aus
// der Serverantwort (server/lib/fiaon-telefonkartei.ts) — im Browser wird
// nichts erfunden, genau wie beim WhatsApp-Knopf der Akte (E-181).
//
// E-259 (29.09.2026): WHATSAPP GEHT ÜBER DAS FIAON-KONTO BEI META. Justin:
// „Wenn ich WhatsApp-Nachricht auswähle, dann muss das über unser WhatsApp-
// Meta-Konto laufen, nicht über das private." Bis heute öffnete jeder Fall einen
// wa.me-Link — Justins privates WhatsApp, nichts in fiaon_whatsapp, nichts im
// WhatsApp-Raum, Mara wusste von nichts. Jetzt schickt der SERVER über den
// Hausweg (waSenden): freigegebene Vorlage außerhalb des 24-Stunden-Fensters,
// freier Text nur im offenen Fenster. Welche Vorlage je Fall: KARTEI_WA_VORLAGE.
//
// DIE STUFEN SIND DIE DES HAUSES
// A/B/C ist `priority_tier` (shared/fiaon-kundenstatus.ts, STUFEN): A = Zahlung
// gemeldet, B = Antrag fertig/Rechnung offen, C = Lead ohne Antrag. „Rate
// offen" ist Stufe 0 mit fälliger, offener Rate — dieselbe Regel, nach der die
// Arbeitsliste der Mitarbeiter sie zieht (RATE_FAELLIG_SQL, E-165).
// ═══════════════════════════════════════════════════════════════════════════

import { STUFEN } from "./fiaon-kundenstatus";
import { vorlagenName } from "./fiaon-lead-texte";
import { KARTE_LINK_SATZ, KARTE_ZEIT_SATZ } from "./fiaon-karten-weg";
import type { BoniAmpel } from "./fiaon-boni-ampel";

export type KarteiGruppe = "alle" | "A" | "B" | "C" | "rate" | "storniert";

export interface KarteiGruppeText {
  key: KarteiGruppe;
  /** Reiter-Beschriftung. */
  label: string;
  /** Ein Satz unter den Reitern — was in dieser Gruppe steht. */
  satz: string;
}

// E-259 (29.09.2026): Die Sätze sagen die Reihenfolge. Justin: „Ich brauche ganz
// oben immer den frischesten Kunden, einen Kunden, der nicht schon 10× angerufen
// wurde — also ganz oben A, dann B und dann C, die keine oder am wenigsten Anrufe
// bekommen haben." Die Regel selbst steht in server/lib/fiaon-telefonkartei.ts
// (KARTEI_ORDNUNG_SQL), für jeden Reiter dieselbe.
// Nachbesserung E-259 (29.09.2026): Die Wunschzeit aus dem Antrag entscheidet erst
// INNERHALB derselben Versuchsstufe — vorher stand sie davor, und „8 Versuche" stand
// über sechs Karten „noch nie angerufen", während dieser Satz das Gegenteil sagte.
const REIHUNG_SATZ = "Oben die Frischen (höchstens 3 Tage), dann wer am wenigsten angerufen wurde — bei gleich vielen Versuchen zuerst, wessen Wunschzeit jetzt passt. Wer eben versucht wurde (20 Std.), eine Zusage, einen Termin oder deinen Rückruf hat, wartet weiter hinten; ab 10 Versuchen ans Ende.";

export const KARTEI_GRUPPEN: KarteiGruppeText[] = [
  {
    key: "alle", label: "Alle",
    satz: "Oben die Frischen (höchstens 3 Tage): A, dann B, dann C, dann Rate offen — danach der Bestand in derselben Folge. "
      + "Darin zuerst, wer am wenigsten angerufen wurde (bei gleich vielen Versuchen zuerst, wessen Wunschzeit jetzt passt); "
      + "wer eben versucht wurde oder eine Zusage, einen Termin oder deinen Rückruf hat, wartet hinten. "
      + "Ab 10 Versuchen ans Ende, ebenso Bezahlte und Abbrecher.",
  },
  { key: "A", label: "A · Zahlung gemeldet", satz: `${STUFEN.A.begruendung} ${REIHUNG_SATZ}` },
  { key: "B", label: "B · Rechnung offen", satz: `${STUFEN.B.begruendung} ${REIHUNG_SATZ}` },
  { key: "C", label: "C · Lead", satz: `Über Facebook eingetragen, noch kein Antrag. ${REIHUNG_SATZ}` },
  { key: "rate", label: "Rate offen", satz: `Bezahlt — eine Monatsrate ist fällig und noch offen. ${REIHUNG_SATZ}` },
  { key: "storniert", label: "Storniert", satz: "Von dir storniert: in keiner Liste, keine Anrufe, keine Werbung. Zurückholen geht jederzeit." },
];

export function istKarteiGruppe(v: unknown): v is KarteiGruppe {
  return KARTEI_GRUPPEN.some((g) => g.key === v);
}

/** Der Satz unter den Reitern, solange gesucht wird: Die Suche findet jeden. */
export const KARTEI_SUCHE_SATZ = "Suche in allen Gruppen — auch Gesperrte, Stornierte und Testkonten.";

/** Wie viele Karten eine Seite trägt — am iPhone sind 25 schon ein langer Daumenweg. */
export const KARTEI_SEITE = 25;

/**
 * Wo ein Mensch gerade steht — die Anzeigegruppe der Karte. Anders als die
 * Reiter kennt sie auch „bezahlt", „abbrecher" und „ausgeschlossen": Im Reiter
 * „Alle" stehen alle, und jeder braucht ein ehrliches Schild.
 */
export type KarteiLage = "A" | "B" | "C" | "rate" | "bezahlt" | "abbrecher" | "ausgeschlossen" | "storniert";

export const KARTEI_LAGE_TEXT: Record<KarteiLage, string> = {
  A: STUFEN.A.text,
  B: STUFEN.B.text,
  C: "Lead ohne Antrag",
  rate: "Rate offen",
  bezahlt: "Bezahlt",
  abbrecher: "Antrag abgebrochen",
  ausgeschlossen: "Ausgeschlossen",
  storniert: "Storniert",
};

/** Die Zahlung, um die es gerade geht — erste Zahlung ODER fällige Rate. */
export interface KarteiZahlung {
  art: "bestellung" | "rate";
  /** Verwendungszweck: FIAON-XXXXXX oder FIAON-XXXXXX-N. */
  referenz: string;
  betragCents: number | null;
  rateNr: number | null;
  faelligAm: string | null;
  /** Die Zahlungsseite mit GiroCode und Kopierknöpfen — absolute Adresse. */
  zahlungsseite: string;
  /** Signierter PDF-Link der Rechnung (nur Bestellungen, 30 Tage gültig). */
  rechnungLink: string | null;
  /** Bestellung ist noch nie in Rechnung gestellt (payment_status pending). */
  nochKeineRechnung: boolean;
}

export interface KarteiKarte {
  personId: number;
  vorname: string;
  nachname: string;
  /** Anzeigename — nie leer (Rückfall „Unbekannt #id"). */
  name: string;
  lage: KarteiLage;
  /** Kurzer Stand in Worten, z. B. „Zahlung gemeldet — noch nicht bankbestätigt". */
  stand: string;
  /** Das jüngste Ereignis (Antrag, Zahlungsmeldung, Fälligkeit, Anlage) — ISO. */
  ereignisAm: string | null;
  telefonAnzeige: string | null;
  /** E.164 mit „+" — für tel: (und als Nummer für WhatsApp über Meta). */
  telefonWaehlbar: string | null;
  telefonHinweis: string | null;
  email: string | null;
  ort: string | null;
  paket: { key: string; label: string; preisCents: number | null } | null;
  wunschlimitEuro: number | null;
  rahmenEuro: number | null;
  zahlung: KarteiZahlung | null;
  /** Referenz der Bestellung, an der Verlauf und Ergebnis hängen. */
  ref: string | null;
  leadId: number | null;
  lead: { quelle: string | null; kampagne: string | null; am: string | null } | null;
  betreuer: string | null;
  kontakt: {
    am: string | null; von: string | null; ergebnis: string | null;
    /** unreachable_count — bleibt für die Rückwärtsverträglichkeit, die Karte zeigt `fehlInFolge`. */
    nichtErreicht: number;
    /** E-259: Anrufversuche gesamt (Softphone + Ergebnisse, entdoppelt — server/lib/fiaon-anrufversuche.ts). */
    versuche: number;
    /** E-259: Fehlversuche seit dem letzten Erreichen (auch für Leads). */
    fehlInFolge: number;
    /** E-259: der jüngste Versuch — ISO. */
    letzterVersuch: string | null;
  };
  termin: { beginn: string; art: string; bei: string | null } | null;
  /** Wunschfenster aus dem Antrag („18–20 Uhr") — leer ohne Angabe. */
  erreichbarkeit: string;
  zusage: string | null;
  gesperrt: boolean;
  werbungGesperrt: boolean;
  /**
   * E-259 (Nachbesserung): Der Mensch hat „STOPP" bzw. „Keine Nachrichten mehr"
   * geschrieben (WhatsApp oder Postfach, an irgendeiner Person seiner Familie —
   * dieselbe Lesart wie menschSperre). Dann geht keine WhatsApp mehr, auch kein
   * freier Text.
   */
  stopp: boolean;
  /** Als Testkonto markiert (z. B. Name eines Mitarbeiters) — nur über die Suche zu finden. */
  testfall: boolean;
  /** Justins persönlicher Kalender, Name/E-Mail/Telefon schon ausgefüllt. */
  terminLink: string;
  /** Kennung für die Akte (Bestellung oder „lead-<id>") — öffnet das Akte-Fenster. */
  akteId: string | null;
  /** Die Akte im Chefbüro — null, wenn es weder Bestellung noch Lead gibt. */
  akteLink: string | null;
  storno: { am: string; grund: string | null; durch: string | null } | null;
  /** Justins nächster offener Rückruf bei diesem Menschen — ISO. */
  rueckrufAm: string | null;
  /** E-202: die Boni-Ampel (shared/fiaon-boni-ampel.ts). */
  ampel: BoniAmpel;
  /** „Herr" | „Frau" | null — für „Hallo Frau Muster" statt „Hallo Maria Muster". */
  anrede: string | null;
}

// ── Formate ─────────────────────────────────────────────────────────────────

export function euro(cents: number | null | undefined): string {
  if (cents == null || !Number.isFinite(Number(cents))) return "";
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(cents) / 100);
}

/** „5.000 €" — Limits sind ganze Euro, ohne Nachkommastellen. */
export function euroGanz(euroBetrag: number | null | undefined): string {
  if (euroBetrag == null || !Number.isFinite(Number(euroBetrag))) return "";
  return `${Math.round(Number(euroBetrag)).toLocaleString("de-DE")} €`;
}

/** „15.09.2026" aus JJJJ-MM-TT oder ISO — ohne Zeitzonenrechnung am Datum. */
export function datumKurz(wert: string | null | undefined): string {
  const m = String(wert ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "";
}

/** E-259: „3 Versuche" — die Zahl an der Karte. */
export function versucheText(n: number | null | undefined): string {
  const z = Math.max(0, Math.floor(Number(n) || 0));
  if (z === 0) return "noch nie angerufen";
  return z === 1 ? "1 Versuch" : `${z} Versuche`;
}

// ── Die Texte: vier Fälle, je WhatsApp UND Mail ────────────────────────────
// Justin (21.09.2026): „Der Kunde hat 4 mögliche Szenarien: 1. er hebt ab und
// will die Rechnung — perfekte Mail und super WhatsApp, 1 Klick […] 2. er will
// nichts — stornieren 3. er hebt nicht ab — freundliche Mail und WhatsApp,
// gleiches Prinzip 4. ‚geht jetzt nicht, rufen Sie mich um … an'." Und zum Ton:
// „Ich pitche viel mehr auf die Kreditkarte — nach Einzahlung aktiviere ich Ihr
// Konto, Kartenantrag folgt im Anschluss, bis die Karte bei Ihnen ist ungefähr
// 4–8 Werktage."
//
// Sein Wortlaut, mit drei bewussten Abweichungen — alle drei kommen aus Regeln
// des Hauses, nicht aus Geschmack:
//   · „mit Ihrem Wunschlimit von X € als Ziel": Die Plattform zeigt das
//     Wunschlimit als ZIEL (shared/fiaon-rahmenweg.ts: „Die Zusage der Bank ist
//     kein Schritt"). Ohne „als Ziel" stünde schriftlich ein Limit-Versprechen.
//   · „ab dem Antrag ist die Karte nach Zusage der Bank in der Regel in 4–8
//     Werktagen bei Ihnen": Die Wortwand verbietet feste Fristen und empfiehlt
//     genau „in der Regel" (shared/fiaon-wortverbote.ts); über die Karte
//     entscheidet die Partnerbank.
//   · „Ihr persönlicher Betreuer begleitet Sie — angefangen mit Ihrem
//     Startgespräch" statt „ruft Sie an": „ruft Sie an" ist für die Wand eine
//     Zusage, die ein eingeplanter Rückruf decken muss. Das Startgespräch ist
//     der Anruf, den der Ablauf wirklich vorsieht.
// Die MAIL trägt keine IBAN — die Wand verbietet Bankdaten im Mailtext; sie
// stehen in der angehängten Rechnung und auf der Zahlungsseite.
// E-259 (29.09.2026): Die WhatsApp „Rechnung" ist seitdem die freigegebene
// Vorlage fiaon_kk_rechnung bzw. fiaon_kk_rate (Knopf zur Zahlungsseite, dort
// stehen die Bankdaten). Der alte Text mit IBAN wäre durch die Hauswand nicht
// gekommen („Keine Bankdaten im Text") und ist entfallen.

type Namensteile = Pick<KarteiKarte, "vorname" | "nachname" | "name"> & { anrede?: string | null };

function vollerName(k: Namensteile): string {
  return [k.vorname, k.nachname].map((s) => String(s || "").trim()).filter(Boolean).join(" ");
}

/**
 * „Hallo Frau Muster," — wenn die Anrede bekannt ist; sonst mit vollem Namen
 * („Hallo Maria Muster,"). Vorher stand „Hi Maria Muster," — „Hi" mit vollem
 * Namen und Sie liest sich wie ein Serienbrief (Justin am 21.09.: „menschlicher").
 * Die Anrede fehlt bei den meisten Kunden (gemessen 21.09.: 96 von 5.700).
 */
export function anredeWhatsApp(k: Namensteile): string {
  const a = String(k.anrede ?? "").trim().toLowerCase();
  const nach = String(k.nachname ?? "").trim();
  if (nach && (a === "frau" || a === "herr")) return `Hallo ${a === "frau" ? "Frau" : "Herr"} ${nach},`;
  const name = vollerName(k);
  return name ? `Hallo ${name},` : "Hallo,";
}

/**
 * Keine Emojis, keine Sternchen (Justin am 21.09.: „bei jeder WhatsApp-Nachricht
 * die Emojis weg und menschlicher geschrieben"). Gilt auch für KI-Text:
 * Zeichen aus dem Emoji-Bereich, Variationszeichen und Fettdruck-Sternchen fallen weg.
 */
// Zur Laufzeit gebaut: Das Projekt übersetzt für ein Ziel ohne das u-Flag im Literal.
const EMOJI = new RegExp("[\\p{Extended_Pictographic}\\u{1F1E6}-\\u{1F1FF}\\u{FE0F}\\u{200D}\\u{20E3}]", "gu");

export function ohneEmojis(text: string): string {
  return String(text ?? "")
    .replace(EMOJI, "")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function gruss(absender: string): string[] {
  return ["Viele Grüße", absender || "Justin Schwarzott"];
}

/** Worum ging der Anruf? — je nach Lage ein anderer Anlass, nie „Antrag" ohne Antrag. */
export function anlass(lage: KarteiLage): string {
  if (lage === "C") return "zu Ihrer Anfrage bei FIAON";
  if (lage === "rate" || lage === "bezahlt") return "zu Ihrem FIAON Konto";
  return "zu Ihrem Kreditkartenantrag bei FIAON";
}

/** Das Ziel-Limit für den Satz — nie über dem Rahmen des Pakets, nie erfunden. */
export function limitZiel(k: Pick<KarteiKarte, "wunschlimitEuro" | "rahmenEuro">): number | null {
  const w = k.wunschlimitEuro;
  if (w == null || !(w > 0)) return null;
  return k.rahmenEuro != null && k.rahmenEuro > 0 ? Math.min(w, k.rahmenEuro) : w;
}

/** Justins Pitch — derselbe Absatz in WhatsApp und Mail. */
export function pitchAbsatz(k: KarteiKarte): string {
  const ziel = limitZiel(k);
  // 21.09.2026 (E-206): Seit der ersten Rate geht die Einladung der Partnerbank
  // raus — der Link kommt also wirklich „direkt". Die Sätze zur Karte stehen in
  // shared/fiaon-karten-weg.ts, damit WhatsApp, Mail und Mara dieselbe Zeit nennen.
  return [
    `Wie besprochen: Sobald Ihre Einzahlung da ist, aktiviere ich Ihr Konto${ziel != null ? ` – Ihr Wunschlimit von ${euroGanz(ziel)} nehmen wir dabei als Ziel` : ""}.`,
    KARTE_LINK_SATZ,
    KARTE_ZEIT_SATZ,
    "Ihr persönlicher Betreuer begleitet Sie dabei, los geht es mit Ihrem Startgespräch.",
  ].join(" ");
}

const VERWENDUNGSZWECK_HINWEIS = "Bitte geben Sie den Verwendungszweck genau so an, dann wird Ihre Zahlung sofort zugeordnet.";

/** Welche Knöpfe hat diese Karte? Eine Stelle, damit Seite und Server gleich entscheiden. */
export function hatRechnungsweg(k: Pick<KarteiKarte, "zahlung" | "lage">): boolean {
  return !!k.zahlung && k.lage !== "storniert";
}
export function hatAntragsweg(k: Pick<KarteiKarte, "zahlung" | "lage">): boolean {
  return !k.zahlung && (k.lage === "C" || k.lage === "abbrecher");
}

// ── Fall 1: erreicht, will die Rechnung ─────────────────────────────────────

/**
 * Der Zahlungsteil der Rechnungsmail — Betrag, Fälligkeit, Verwendungszweck, Zahlungsseite.
 * E-274 (02.10.2026): eine Stelle für „Rechnung schicken" UND „Zahlungsdaten neu senden"
 * (mailZahlungsdaten), damit beide Mails denselben Wortlaut tragen. „Ihre Rechnung finden Sie
 * im Anhang" steht nur da, wenn die Rechnung wirklich anhängt — sonst hält die Wand die Mail auf.
 */
function zahlungsAbsaetze(z: KarteiZahlung, mitAnhang: boolean): string[] {
  return [
    [
      mitAnhang ? "Ihre Rechnung finden Sie im Anhang." : null,
      z.betragCents != null ? `Betrag: ${euro(z.betragCents)}` : null,
      z.art === "rate" && z.faelligAm ? `Fällig: ${datumKurz(z.faelligAm)}` : null,
      `Verwendungszweck: ${z.referenz}`,
    ].filter(Boolean).join("\n"),
    `Am schnellsten zahlen Sie über Ihre Zahlungsseite – dort übernehmen Sie alle Daten mit einem Klick in Ihre Banking-App:\n${z.zahlungsseite}`,
    VERWENDUNGSZWECK_HINWEIS,
  ];
}

/** Mail „Rechnung" — die Rechnung hängt als PDF an (rechnungAlsPdf, Referenz der Zahlung). */
export function mailRechnung(k: KarteiKarte, absender: string): { betreff: string; text: string } | null {
  const z = k.zahlung;
  if (!z) return null;
  const betreff = z.art === "rate"
    ? `Ihre Rechnung zur ${z.rateNr ? `${z.rateNr}. ` : ""}Monatsrate – wie besprochen`
    : "Ihre Rechnung zur Aktivierung – wie besprochen";
  const absaetze = [
    "vielen Dank für das freundliche Telefonat eben!",
    z.art === "rate"
      ? `Wie besprochen erhalten Sie hier die Rechnung für Ihre ${z.rateNr ? `${z.rateNr}. ` : ""}Monatsrate.`
      : pitchAbsatz(k),
    ...zahlungsAbsaetze(z, true),
    gruss(absender).join("\n"),
  ];
  return { betreff, text: absaetze.join("\n\n") };
}

// ── E-Mail aus der Akte (02.10.2026, E-274) ─────────────────────────────────
// Justin: „ich brauch da ein Knopf wo ich den Kunden eine Email senden kann — wie
// jetzt, ich hatte eben mit [einem Kunden] telefoniert, der will einbezahlen
// und braucht aber die Mail neu — nur da gibts kein Knopf." Bis heute ging eine
// Mail aus der Kartei nur mit einem Gesprächsergebnis („Rechnung schicken" bucht
// „zahlt am" und schickt dazu die WhatsApp). Jetzt gibt es die freie Mail: Betreff
// und Text von Justin, Anrede, Kopf und Fuß vom Gerüst (freitextVersenden) — kein
// Ergebnis, keine WhatsApp, kein Zusagedatum. „Zahlungsdaten neu senden" füllt
// sie mit dem Wortlaut der Rechnungsmail vor.

/**
 * „Zahlungsdaten neu senden" — Betreff und Text für die freie Mail, aus derselben
 * Zahlung wie „Rechnung schicken" (hatRechnungsweg). Die Anrede („Guten Tag …,")
 * setzt freitextVersenden davor; sie steht deshalb NICHT im Text.
 */
export function mailZahlungsdaten(k: KarteiKarte, absender: string, mitAnhang: boolean): { betreff: string; text: string } | null {
  const z = k.zahlung;
  if (!z || !hatRechnungsweg(k)) return null;
  const rate = z.art === "rate" ? `${z.rateNr ? `${z.rateNr}. ` : ""}Monatsrate` : null;
  return {
    betreff: rate ? `Ihre Zahlungsdaten zur ${rate} – wie besprochen` : "Ihre Zahlungsdaten – wie besprochen",
    text: [
      rate
        ? `wie besprochen sende ich Ihnen hier noch einmal die Zahlungsdaten für Ihre ${rate}.`
        : "wie besprochen sende ich Ihnen hier noch einmal Ihre Zahlungsdaten.",
      ...zahlungsAbsaetze(z, mitAnhang),
      ...(z.art === "bestellung" ? ["Sobald Ihre Einzahlung da ist, aktiviere ich Ihr Konto."] : []),
      gruss(absender).join("\n"),
    ].join("\n\n"),
  };
}

/** Doppelklick-Schutz der freien Mail: derselbe Text an denselben Menschen binnen dieser Sekunden geht einmal raus. */
export const KARTEI_MAIL_DOPPELT_SEKUNDEN = 30;
export const KARTEI_MAIL_BETREFF_MAX = 200;
export const KARTEI_MAIL_TEXT_MAX = 8_000;
/**
 * Woher „zugestellt"/„geöffnet" kommt — die Seite sagt es, statt mehr zu versprechen. Der Abgleich
 * (zustellungAbgleichen, Takt alle 20 Minuten) ordnet Brevos Ereignisse nach Adresse und Uhrzeit zu,
 * nicht nach der Nachrichten-Kennung. Gemessen am 02.10. an einem Kunden: Die Zahlungserinnerung von 09:31
 * und Justins Rechnung von 14:49 trugen dieselbe Öffnung um 14:55.
 */
export const KARTEI_MAIL_ZUSTELL_SATZ = "Zugestellt und geöffnet gleicht das System alle 20 Minuten mit Brevo ab — direkt nach dem Senden steht „gesendet“. Zugeordnet wird nach Adresse und Uhrzeit: Gehen zwei Mails kurz nacheinander raus, kann „geöffnet“ auch die andere meinen.";

/** Eine Zeile „Zuletzt gesendet" im Blatt „E-Mail" (fiaon_mail_log dieses Menschen). */
export interface KarteiMailZeile {
  id: number;
  am: string;
  betreff: string;
  /** „gesendet", „zugestellt", „geöffnet", „blockiert", „nicht gesendet" … */
  stand: string;
  ton: "gut" | "neutral" | "warn";
  grund: string | null;
  von: string;
  mitAnhang: boolean;
  /** Aus der Telefonkartei (freie Mail, Rechnung, Nicht erreicht, Antrag). */
  ausKartei: boolean;
}

/** Was das Blatt „E-Mail" beim Öffnen vom Server bekommt. */
export interface KarteiMailLage {
  ok: boolean;
  /** Dieselbe Adresse, an die freitextVersenden schickt. */
  empfaenger: string | null;
  /** Die Anrede, die vor Justins Text steht („Guten Tag Vorname Nachname,"). */
  anrede: string;
  absender: string;
  /** Die offene Zahlung — nur sie darf als Rechnung anhängen (dieselbe Regel wie „Rechnung schicken"). */
  zahlung: KarteiZahlung | null;
  verlauf: KarteiMailZeile[];
  meldung?: string;
}

/** Antwort auf Vorschau und Senden. */
export interface KarteiMailAntwort {
  ok: boolean;
  meldung: string;
  doppelt?: boolean;
  empfaenger?: string | null;
  anhang?: { rechnungsnummer: string; betrag: string; art: string } | null;
  /** Die Rechnung entsteht erst beim Senden (fertiger Antrag ohne Rechnung). */
  anhangBeimSenden?: boolean;
  vorschau?: { betreff: string; html: string; absender: string | null };
  verlauf?: KarteiMailZeile[];
}

// ── Fall 3: nicht erreicht ──────────────────────────────────────────────────

/**
 * E-259: Freier Text — geht NUR im offenen 24-Stunden-Fenster über Meta raus
 * (der Kunde hat uns eben geschrieben). Sonst die Vorlage fiaon_kk_nicht_erreicht.
 */
export function whatsappNichtErreicht(k: KarteiKarte, absender: string): string {
  return ohneEmojis([
    anredeWhatsApp(k),
    "",
    `ich wollte Sie eben kurz ${anlass(k.lage)} anrufen, habe Sie aber nicht erreicht. Passt es Ihnen heute oder morgen für ein kurzes Gespräch?`,
    "",
    "In meinem Kalender können Sie sich direkt eine Zeit aussuchen, Ihre Daten sind schon eingetragen:",
    k.terminLink,
    "",
    ...gruss(absender),
  ].join("\n"));
}

export function mailNichtErreicht(k: KarteiKarte, absender: string): { betreff: string; text: string } {
  return {
    betreff: "Ich habe Sie eben leider nicht erreicht",
    text: [
      `ich wollte Sie eben kurz ${anlass(k.lage)} anrufen, habe Sie aber leider nicht erreicht.`,
      `Finden Sie heute oder morgen noch Zeit für einen kurzen Call? In meinem persönlichen Kalender können Sie sich direkt eine Zeit aussuchen – Ihre Daten sind schon ausgefüllt:\n${k.terminLink}`,
      gruss(absender).join("\n"),
    ].join("\n\n"),
  };
}

// ── Fall 1 für Leads: erreicht, der Weg zum Antrag ─────────────────────────

/**
 * E-259: wie oben — freier Text nur im offenen Fenster. `antragLink` ist IMMER
 * sein persönlicher Link (Nachbesserung 29.09.2026, Hausregel E-248: nie ein
 * nackter fiaon.com/antrag): beim Lead sein Code (/a/<code>/w), beim Abbrecher
 * der Wiedereinstieg in seinen begonnenen Antrag. Gebaut auf dem Server
 * (antragLinkFuer in server/lib/fiaon-telefonkartei.ts).
 */
export function whatsappAntrag(k: KarteiKarte, absender: string, antragLink: string): string {
  return ohneEmojis([
    anredeWhatsApp(k),
    "",
    "danke für das nette Telefonat gerade. Wie besprochen hier der Link zu Ihrem Antrag, das dauert nur etwa zwei Minuten:",
    antragLink,
    "",
    "Sobald der Antrag da ist, geht es weiter. Wenn unterwegs etwas unklar ist, schreiben Sie mir einfach hier.",
    "",
    ...gruss(absender),
  ].join("\n"));
}

/** Die Mail dazu — mit demselben persönlichen Link (Kanal Mail: /a/<code>/m bzw. Wiedereinstieg). */
export function mailAntrag(k: KarteiKarte, absender: string, antragLink: string): { betreff: string; text: string } {
  return {
    betreff: "Ihr Link zum Antrag – wie besprochen",
    text: [
      "vielen Dank für das freundliche Telefonat eben!",
      `Wie besprochen hier der Link zu Ihrem Antrag – das dauert nur etwa zwei Minuten:\n${antragLink}`,
      "Wenn unterwegs etwas unklar ist, antworten Sie einfach auf diese Mail.",
      gruss(absender).join("\n"),
    ].join("\n\n"),
  };
}

// ── Fall 4: „Rufen Sie mich um … an" ────────────────────────────────────────
// Kein Kundentext: Die Wand hält „Rückruf" als Zusage auf, und ein Rückruf,
// den Justin sich selbst notiert, braucht keine Nachricht. Er bekommt eine
// Erinnerung — auf der Seite und auf Wunsch als Kalendereintrag im iPhone.

// ── Persönliche Nachricht (21.09.2026) ─────────────────────────────────────
// Justin: „so was wie ein Freitext, nur besser benannt — wenn er draufklickt,
// öffnet sich ein Fenster mit der Frage ‚Was möchten Sie dem Kunden schreiben?',
// und dann schreibt die KI daraus eine 100 % personalisierte und 100 % menschlich
// klingende WhatsApp-Nachricht." Die KI schlägt vor, Justin liest und ändert —
// wie bei der Mail-KI (server/lib/fiaon-mail-ki.ts). E-259: Gesendet wird über
// das FIAON-Konto bei Meta, als freier Text nur im offenen 24-Stunden-Fenster;
// ist es zu, öffnet die Rückfrage-Vorlage das Gespräch neu.

/** So viele Zeichen darf Justins Stichwort haben. */
export const KI_WUNSCH_MAX = 600;

export interface KarteiKiAntwort {
  ok: boolean;
  text?: string;
  /** Was die Wand beanstandet hat oder was entschärft wurde — Justin sieht es vor dem Senden. */
  hinweise?: string[];
  meldung?: string;
}

/** Was ein Knopf der Karte auf dem Server auslöst. */
export type KarteiErgebnis = "rechnung" | "nicht_erreicht" | "antrag" | "rueckruf";

export function istKarteiErgebnis(v: unknown): v is KarteiErgebnis {
  return v === "rechnung" || v === "nicht_erreicht" || v === "antrag" || v === "rueckruf";
}

/** Ein Rückruf, den Justin sich selbst gesetzt hat. */
export interface KarteiRueckruf {
  id: number;
  personId: number;
  name: string;
  am: string;
  notiz: string | null;
  telefonWaehlbar: string | null;
  telefonAnzeige: string | null;
}

/** Ein gebuchter Termin für den unteren Abschnitt. */
export interface KarteiTermin {
  id: number;
  personId: number | null;
  name: string;
  beginn: string;
  dauerMin: number | null;
  status: string;
  art: string;
  bei: string | null;
  /** Justins eigene Termine (Gründerseite /justin, sein Konto) — stehen im Abschnitt „Deine Termine". */
  meiner: boolean;
  telefonWaehlbar: string | null;
  telefonAnzeige: string | null;
  notiz: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// WHATSAPP ÜBER DAS FIAON-KONTO (29.09.2026, E-259)
//
// Eine Tabelle für Seite, Server und Prüfstand: welcher Fall bei welcher Lage
// welche freigegebene Vorlage nimmt. Genannt wird die Textfassung — waSenden
// nimmt die Bildfassung (fiaon_kkb_*), sobald sie bei Meta frei ist (E-229).
//
//   Rechnung schicken   A/B (erste Zahlung) → fiaon_kk_rechnung, Knopf zur
//                       Zahlungsseite dieser Referenz; Rate offen → fiaon_kk_rate
//                       (Knopfwert = Referenz GENAU dieser Rate). Immer die
//                       Vorlage, auch im offenen Fenster: Bankdaten im freien
//                       Text hält die Wand auf.
//   Nicht erreicht      B/C/Abbrecher → fiaon_kk_nicht_erreicht. Ihr Knopf führt
//                       FEST auf https://fiaon.com/termin — das allgemeine
//                       Anfrageformular, NICHT Justins Kalender (der Kunde tippt
//                       seine Daten neu, die Anfrage landet als Aufgabe im Team).
//                       Das sagt die Seite offen (NICHT_ERREICHT_HINWEIS). Im
//                       offenen Fenster freier Text mit Justins Kalender.
//                       A (Zahlung gemeldet) und Bestandskunden (Rate, bezahlt):
//                       keine Vorlage — „Ihre Anfrage liegt bei mir, und es fehlt
//                       nur noch Ihr Ja" stimmt dort nicht (Nachbesserung
//                       29.09.2026); nur Mail mit Kalender (Entwurf
//                       fiaon_kk_kalender).
//   Antrag schicken     Abbrecher → fiaon_kk_antrag_offen. Der Knopf braucht den
//                       persönlichen Code seines Leads (/a/<code>/w → Wieder-
//                       einstieg); den setzt der SERVER und prüft vorher, dass er
//                       wirklich in den begonnenen Antrag führt. Ohne Lead oder
//                       wenn der Code woanders hinführt: keine Vorlage — der
//                       Rückfall von waSenden („start") führte in einen NEUEN
//                       Antrag, die Vorlage verspricht „genau an die Stelle".
//                       Lead C: keine freigegebene Vorlage — Mail, im offenen
//                       Fenster freier Text (Entwurf fiaon_kk_antrag_link). Jeder
//                       Link ist sein persönlicher, nie ein nackter /antrag.
//   Rückfrage           Persönliche Nachricht bei geschlossenem Fenster →
//                       fiaon_kk_rueckfrage öffnet das Gespräch neu.
//   Später anrufen, Stornieren: bewusst keine WhatsApp.
// „Unaufgefordert" (Nicht erreicht, Rückfrage) nimmt den Tagesplatz (E-253);
// Rechnung, Rate und Antrag hat der Kunde am Telefon erbeten — ohne Tagesplatz.
// ═══════════════════════════════════════════════════════════════════════════

export type KarteiWaFall = "rechnung" | "nicht_erreicht" | "antrag" | "rueckfrage";

export const KARTEI_WA_VORLAGE = {
  rechnung: "fiaon_kk_rechnung",
  rate: "fiaon_kk_rate",
  nicht_erreicht: "fiaon_kk_nicht_erreicht",
  antrag_abbrecher: "fiaon_kk_antrag_offen",
  rueckfrage: "fiaon_kk_rueckfrage",
} as const;

/** Die zwei fehlenden Vorlagen — Entwürfe im Bericht E-259 (3.4), NICHT eingereicht. */
export const KARTEI_WA_ENTWURF = { kalender: "fiaon_kk_kalender", antrag_link: "fiaon_kk_antrag_link" } as const;

export type KarteiWaPlan =
  | { art: "vorlage"; vorlage: string; werte: string[]; knopfWert?: string; unaufgefordert: boolean }
  | { art: "keine"; grund: string; kurz: string };

/** „59,99" — so steht der Betrag in den Vorlagen (das € steht im Vorlagentext). */
export function vorlagenBetrag(cents: number | null | undefined): string | null {
  if (cents == null || !Number.isFinite(Number(cents)) || Number(cents) <= 0) return null;
  return (Number(cents) / 100).toFixed(2).replace(".", ",");
}

/**
 * Die Vorlage und ihre Werte für einen Fall — oder ehrlich, warum es keine gibt.
 * Ob stattdessen freier Text geht (offenes Fenster), entscheidet der Server.
 */
export function karteiWaVorlage(k: KarteiKarte, fall: KarteiWaFall, absender: string): KarteiWaPlan {
  const name = vorlagenName(anredeWhatsApp(k));
  const vorname = String(absender || "").trim().split(/\s+/)[0] || "Justin";
  if (fall === "rueckfrage") {
    return { art: "vorlage", vorlage: KARTEI_WA_VORLAGE.rueckfrage, werte: [name, vorname], unaufgefordert: true };
  }
  if (fall === "rechnung") {
    const z = k.zahlung;
    if (!z || !hatRechnungsweg(k)) return { art: "keine", grund: "Keine offene Zahlung — keine Rechnung.", kurz: "keine offene Zahlung" };
    const betrag = vorlagenBetrag(z.betragCents);
    if (!betrag) return { art: "keine", grund: "Der Betrag ist unbekannt — ohne Betrag geht die Vorlage nicht raus.", kurz: "Betrag unbekannt" };
    if (z.art === "rate") {
      // Bestandskunden bekommen kein „Hallo und willkommen" — wie in der Zentrale (werteFuer).
      const voll = vollerName(k);
      if (!voll) return { art: "keine", grund: "Kein Name — die Raten-Vorlage braucht den vollen Namen.", kurz: "kein Name" };
      if (!z.faelligAm) return { art: "keine", grund: "Die Fälligkeit der Rate ist unbekannt.", kurz: "Fälligkeit unbekannt" };
      return { art: "vorlage", vorlage: KARTEI_WA_VORLAGE.rate, werte: [voll, betrag, datumKurz(z.faelligAm), z.referenz], knopfWert: z.referenz, unaufgefordert: false };
    }
    return { art: "vorlage", vorlage: KARTEI_WA_VORLAGE.rechnung, werte: [name, betrag, z.referenz], knopfWert: z.referenz, unaufgefordert: false };
  }
  if (fall === "nicht_erreicht") {
    if (k.lage === "B" || k.lage === "C" || k.lage === "abbrecher") {
      return { art: "vorlage", vorlage: KARTEI_WA_VORLAGE.nicht_erreicht, werte: [name, vorname], unaufgefordert: true };
    }
    if (k.lage === "A") {
      // Nachbesserung E-259: A hat die Zahlung schon gemeldet — „es fehlt nur noch Ihr Ja" stimmt nicht.
      return {
        art: "keine", kurz: "keine Vorlage für A",
        grund: `Für A (Zahlung gemeldet) passt „${KARTEI_WA_VORLAGE.nicht_erreicht}“ nicht („es fehlt nur noch Ihr Ja“). Der Entwurf „${KARTEI_WA_ENTWURF.kalender}“ ist noch nicht eingereicht; bis dahin geht nur die Mail mit deinem Kalender.`,
      };
    }
    return {
      art: "keine", kurz: "keine Vorlage für Bestandskunden",
      grund: `Für Bestandskunden gibt es noch keine passende freigegebene Vorlage — „${KARTEI_WA_VORLAGE.nicht_erreicht}“ spricht von „Ihrer Anfrage“. Der Entwurf „${KARTEI_WA_ENTWURF.kalender}“ ist noch nicht eingereicht; bis dahin geht nur die Mail.`,
    };
  }
  // fall === "antrag"
  if (!hatAntragsweg(k)) return { art: "keine", grund: "Hier gibt es schon eine Bestellung — „Rechnung schicken“ nehmen.", kurz: "schon eine Bestellung" };
  if (k.lage === "abbrecher") {
    // Der Knopfwert (Code seines Leads, /w) kommt vom Server — ohne ihn geht die Vorlage NICHT raus (siehe oben).
    return { art: "vorlage", vorlage: KARTEI_WA_VORLAGE.antrag_abbrecher, werte: [name], unaufgefordert: false };
  }
  return {
    art: "keine", kurz: "keine Vorlage für Leads",
    grund: `Für Leads ohne Antrag gibt es noch keine freigegebene Vorlage mit dem Antrag-Link — der Entwurf „${KARTEI_WA_ENTWURF.antrag_link}“ ist noch nicht eingereicht. Die Mail trägt den Link; schreibt der Kunde uns, geht er als freier Text.`,
  };
}

/**
 * Was der Knopf der Vorlage „Wir haben Sie nicht erreicht" wirklich öffnet —
 * die Seite sagt es offen (Nachbesserung E-259): fest https://fiaon.com/termin,
 * das allgemeine Anfrageformular, nicht Justins Kalender.
 */
export const NICHT_ERREICHT_HINWEIS = "Knopf: allgemeines Terminformular, nicht dein Kalender";

/** Was ein Fall auf WhatsApp gerade täte — für die Knopfzeile im Blatt „Nachrichten". */
export interface KarteiWaFallLage {
  weg: "vorlage" | "text" | null;
  vorlage: string | null;
  /** Kopfzeile der Vorlage („Ihre offene Rechnung") bzw. „freier Text". */
  klartext: string | null;
  /** Warum keine WhatsApp — ganzer Satz. Bei `bestaetigen` der Grund, warum erst bestätigt werden muss. */
  grund: string | null;
  /** Dasselbe in wenigen Wörtern. */
  kurz: string | null;
  /** Was man vorher wissen muss, obwohl sie rausgeht (z. B. NICHT_ERREICHT_HINWEIS). */
  hinweis?: string | null;
  /**
   * Nachbesserung E-259: Freier Text an einen Menschen mit Werbesperre,
   * Vertriebssperre oder Kündigung geht nur nach ausdrücklicher Bestätigung —
   * und ohne Verkauf. Bei „Stopp" geht gar nichts (dann weg = null).
   */
  bestaetigen?: boolean;
}

export interface KarteiWaLage {
  ok: boolean;
  /** Die Nummer, an die WhatsApp ginge (kanonisch, ohne „+"). */
  nummer: string | null;
  /** Hat uns der Mensch in den letzten 24 Stunden geschrieben? Dann geht freier Text. */
  fensterOffen: boolean;
  faelle: Partial<Record<KarteiWaFall, KarteiWaFallLage>>;
  /** Die persönliche Nachricht als freier Text. */
  frei: KarteiWaFallLage;
  meldung?: string;
}

/** Was mit der WhatsApp passiert ist — die zweite Zeile der Meldung. */
export interface KarteiWaErgebnis {
  ok: boolean;
  text: string;
  weg: "vorlage" | "text" | null;
  vorlage: string | null;
  doppelt?: boolean;
  /** Nicht gesendet, weil erst bestätigt werden muss (Sperre, siehe KarteiWaFallLage). */
  bestaetigen?: boolean;
}
