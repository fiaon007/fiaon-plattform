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
// brauchen die Seite, der Server und der Prüfstand (scripts/pruef-telefonkartei.ts). Die
// Bankdaten kommen aus shared/fiaon-bank.ts, Betrag und Verwendungszweck aus
// der Serverantwort (server/lib/fiaon-telefonkartei.ts) — im Browser wird
// nichts erfunden, genau wie beim WhatsApp-Knopf der Akte (E-181).
//
// DIE STUFEN SIND DIE DES HAUSES
// A/B/C ist `priority_tier` (shared/fiaon-kundenstatus.ts, STUFEN): A = Zahlung
// gemeldet, B = Antrag fertig/Rechnung offen, C = Lead ohne Antrag. „Rate
// offen" ist Stufe 0 mit fälliger, offener Rate — dieselbe Regel, nach der die
// Arbeitsliste der Mitarbeiter sie zieht (RATE_FAELLIG_SQL, E-165).
// ═══════════════════════════════════════════════════════════════════════════

import { BANK } from "./fiaon-bank";
import { STUFEN } from "./fiaon-kundenstatus";

export type KarteiGruppe = "alle" | "A" | "B" | "C" | "rate" | "storniert";

export interface KarteiGruppeText {
  key: KarteiGruppe;
  /** Reiter-Beschriftung. */
  label: string;
  /** Ein Satz unter den Reitern — was in dieser Gruppe steht. */
  satz: string;
}

export const KARTEI_GRUPPEN: KarteiGruppeText[] = [
  { key: "alle", label: "Alle", satz: "Jeder Mensch im System — ohne Stornierte, die frischesten zuerst." },
  { key: "A", label: "A · Zahlung gemeldet", satz: STUFEN.A.begruendung },
  { key: "B", label: "B · Rechnung offen", satz: STUFEN.B.begruendung },
  { key: "C", label: "C · Lead", satz: "Über Facebook eingetragen, noch kein Antrag." },
  { key: "rate", label: "Rate offen", satz: "Bezahlt — eine Monatsrate ist fällig und noch offen." },
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
  /** E.164 mit „+" — für tel: und wa.me. */
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
  kontakt: { am: string | null; von: string | null; ergebnis: string | null; nichtErreicht: number };
  termin: { beginn: string; art: string; bei: string | null } | null;
  /** Wunschfenster aus dem Antrag („18–20 Uhr") — leer ohne Angabe. */
  erreichbarkeit: string;
  zusage: string | null;
  gesperrt: boolean;
  werbungGesperrt: boolean;
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

/** Nur Ziffern, ohne „+" — so will wa.me die Nummer. */
export function waNummer(telefonWaehlbar: string | null | undefined): string {
  return String(telefonWaehlbar ?? "").replace(/\D/g, "");
}

export function waLink(telefonWaehlbar: string | null | undefined, text: string): string | null {
  const nr = waNummer(telefonWaehlbar);
  if (nr.length < 8) return null;
  return `https://wa.me/${nr}?text=${encodeURIComponent(text)}`;
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
// stehen in der angehängten Rechnung und auf der Zahlungsseite. WhatsApp trägt
// sie, wie der WhatsApp-Knopf der Akte (E-181), aus shared/fiaon-bank.ts.

type Namensteile = Pick<KarteiKarte, "vorname" | "nachname" | "name">;

function vollerName(k: Namensteile): string {
  return [k.vorname, k.nachname].map((s) => String(s || "").trim()).filter(Boolean).join(" ");
}

function anredeWhatsApp(k: Namensteile): string {
  const name = vollerName(k);
  return name ? `Hi ${name},` : "Hallo,";
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
  return [
    `Wie besprochen: Sobald Ihre Einzahlung da ist, aktiviere ich umgehend Ihr Konto${ziel != null ? ` – mit Ihrem Wunschlimit von ${euroGanz(ziel)} als Ziel` : ""}.`,
    "Im Anschluss geht es mit Ihrem Kartenantrag weiter; ab dem Antrag ist die Karte nach Zusage der Bank in der Regel in 4–8 Werktagen bei Ihnen.",
    "Ihr persönlicher Betreuer begleitet Sie dabei – angefangen mit Ihrem Startgespräch.",
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

/** WhatsApp „Rechnung" — null ohne offene Zahlung (dann gibt es den Knopf nicht). */
export function whatsappRechnung(k: KarteiKarte, absender: string): string | null {
  const z = k.zahlung;
  if (!z) return null;
  const kopf = z.art === "rate"
    ? [`Wie besprochen hier die Zahlungsinformationen für Ihre ${z.rateNr ? `${z.rateNr}. ` : ""}Monatsrate.`]
    : [pitchAbsatz(k)];
  return [
    anredeWhatsApp(k),
    "",
    "vielen Dank für das freundliche Telefonat eben! 🙂",
    "",
    ...kopf,
    "",
    "*So zahlen Sie am schnellsten:*",
    `👉 ${z.zahlungsseite}`,
    "(dort übernehmen Sie alles mit einem Klick in Ihre Banking-App)",
    "",
    "Oder per Überweisung:",
    z.betragCents != null ? `*Betrag:* ${euro(z.betragCents)}` : null,
    z.art === "rate" && z.faelligAm ? `*Fällig:* ${datumKurz(z.faelligAm)}` : null,
    `*Empfänger:* ${BANK.empfaenger}`,
    `*IBAN:* ${BANK.ibanDisplay}`,
    `*BIC:* ${BANK.bic}`,
    `*Verwendungszweck:* ${z.referenz}`,
    VERWENDUNGSZWECK_HINWEIS,
    ...(z.rechnungLink ? ["", "📄 Ihre Rechnung als PDF:", z.rechnungLink] : []),
    ...(k.email ? ["", "Die Rechnung habe ich Ihnen zusätzlich per E-Mail geschickt."] : []),
    "",
    ...gruss(absender),
  ].filter((l): l is string => l !== null).join("\n");
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
    [
      "Ihre Rechnung finden Sie im Anhang.",
      z.betragCents != null ? `Betrag: ${euro(z.betragCents)}` : null,
      z.art === "rate" && z.faelligAm ? `Fällig: ${datumKurz(z.faelligAm)}` : null,
      `Verwendungszweck: ${z.referenz}`,
    ].filter(Boolean).join("\n"),
    `Am schnellsten zahlen Sie über Ihre Zahlungsseite – dort übernehmen Sie alle Daten mit einem Klick in Ihre Banking-App:\n${z.zahlungsseite}`,
    VERWENDUNGSZWECK_HINWEIS,
    gruss(absender).join("\n"),
  ];
  return { betreff, text: absaetze.join("\n\n") };
}

// ── Fall 3: nicht erreicht ──────────────────────────────────────────────────

export function whatsappNichtErreicht(k: KarteiKarte, absender: string): string {
  return [
    anredeWhatsApp(k),
    "",
    `ich wollte Sie eben kurz ${anlass(k.lage)} anrufen – finden Sie heute oder morgen noch Zeit für einen kurzen Call?`,
    "",
    "Hier können Sie sich direkt in meinem persönlichen Kalender eintragen, Ihre Daten sind schon ausgefüllt:",
    k.terminLink,
    "",
    ...gruss(absender),
  ].join("\n");
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

export function whatsappAntrag(k: KarteiKarte, absender: string, antragUrl: string): string {
  return [
    anredeWhatsApp(k),
    "",
    "vielen Dank für das freundliche Telefonat eben! 🙂",
    "",
    "Wie besprochen hier der Link zu Ihrem Antrag – das dauert nur etwa zwei Minuten:",
    antragUrl,
    "",
    "Sobald der Antrag da ist, geht es direkt weiter – schreiben Sie mir gern hier, wenn unterwegs etwas unklar ist.",
    "",
    ...gruss(absender),
  ].join("\n");
}

export function mailAntrag(k: KarteiKarte, absender: string, antragUrl: string): { betreff: string; text: string } {
  return {
    betreff: "Ihr Link zum Antrag – wie besprochen",
    text: [
      "vielen Dank für das freundliche Telefonat eben!",
      `Wie besprochen hier der Link zu Ihrem Antrag – das dauert nur etwa zwei Minuten:\n${antragUrl}`,
      "Wenn unterwegs etwas unklar ist, antworten Sie einfach auf diese Mail.",
      gruss(absender).join("\n"),
    ].join("\n\n"),
  };
}

// ── Fall 4: „Rufen Sie mich um … an" ────────────────────────────────────────
// Kein Kundentext: Die Wand hält „Rückruf" als Zusage auf, und ein Rückruf,
// den Justin sich selbst notiert, braucht keine Nachricht. Er bekommt eine
// Erinnerung — auf der Seite und auf Wunsch als Kalendereintrag im iPhone.

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
