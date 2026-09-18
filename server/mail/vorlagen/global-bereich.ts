// ═══════════════════════════════════════════════════════════════════════════
// VORLAGEN: FIAON GLOBAL — „MEIN AUFTRAG" (4, je deutsch und englisch)
// (E-188, 17.09.2026)
//
// Die Mails des Bereichs, in dem ein Firmenkunde nach dem Kauf seinen Auftrag
// führt (/business/auftrag/<ref>): Zugang, neue Etappe, Erinnerung aus dem
// Pflichtenkalender, neues Dokument. Schreibregeln wie in global.ts — gesiezt,
// ein Gedanke je Absatz, Zahlen im Datenkasten, Kopf „FIAON Global", im Fuß der
// Rollensatz aus shared/fiaon-global.ts. Dazu, was für DIESE vier gilt:
//
// · JEDE führt mit EINEM Knopf zu „Mein Auftrag" ({{params.mein_auftrag_url}}).
//   Der Link trägt ein frisches Token (30 Tage, globalMeinAuftragUrl); ein
//   Auftrag läuft länger — deshalb bringt jede Mail ihren eigenen Link mit, und
//   `global_zugang` stellt auf Anforderung jederzeit einen neuen aus.
// · KEIN Dokument als Anhang. Pass, Gründungsurkunde und EIN-Brief reisen nicht
//   per Mail; `global_dokument` sagt nur, DASS etwas bereitliegt.
// · `global_frist` ist INFORMATION: ein allgemein bekannter Termin mit dem Satz,
//   dass Steuerberater bzw. US-CPA die geltenden Fristen bestätigen. Der
//   Abstand steht in Worten („in rund einem Monat"), nie als Ziffer mit Tagen;
//   kein Betrag, kein Steuersatz.
// · Kein Ergebnis, das ein Institut entscheidet. Die Etappentexte kommen aus
//   shared/fiaon-global-bereich.ts und sind dort gegen die Wortwand geprüft.
//
// ── ZWEI SPRACHEN, EIN EREIGNIS ───────────────────────────────────────────
// Jede Vorlage ist ein Paar {de, en}. Die Sprache steht in der Akte
// (fiaon_global_auftraege.vertrag_sprache) und reist als `sprache` in der
// Nutzlast; der Motor nimmt die englische Fassung, wenn es sie gibt
// (mailRendern, VORLAGEN_EN). Die englische Hälfte trägt `sprache: "en"` für
// den Rahmen des Gerüsts (Hilfszeile, Pflichtlinks) — kennt das Gerüst das Feld
// noch nicht, ist es wirkungslos, der Text der Mail ist trotzdem englisch.
// Wer eine Vorlage ändert, ändert BEIDE Hälften; scripts/pruef-global-bereich.ts
// vergleicht Platzhalter und Knöpfe der Paare.
//
// ── DIESE MAILS GEHEN NIE ÜBER MAKE ───────────────────────────────────────
// Wie global.ts: Direktversand über den Motor (globalMailSenden in
// server/lib/fiaon-global-auftrag.ts), Protokoll in fiaon_mail_log — der Link
// zu „Mein Auftrag" steht dort NICHT im Klartext.
//
// Nutzlast: die des Bestellwegs (anrede_zeile, firma, paket, antrag_id,
// ansprechpartner, mein_auftrag_url, email, sprache), dazu je Ereignis:
//   global_etappe:   etappe_marke, etappe_titel, etappe_text, etappe_weiter
//   global_frist:    frist_titel, frist_datum, frist_abstand, frist_hinweis
//   global_dokument: dokument_art, dokument_name
// ═══════════════════════════════════════════════════════════════════════════
import type { MailBaustein } from "../geruest";
import { GLOBAL_ROLLEN } from "@shared/fiaon-global";

export type GlobalBereichSprache = "de" | "en";

const KOPF = "FIAON Global";
const INSTITUT = {
  de: "Über Konto, Karte, Rahmen und Darlehen entscheidet allein das jeweilige Institut.",
  en: "The institution alone decides on the account, the card, the limit and the loan.",
} as const;

/** Der englische Rahmen des Gerüsts (Feld `sprache`, Querschnitt-Teil von E-188) — siehe Kopf. */
const RAHMEN_EN = { sprache: "en" } as unknown as Partial<MailBaustein>;

const PAARE: Record<string, Record<GlobalBereichSprache, MailBaustein>> = {

  // Der Zugang zu „Mein Auftrag": wenn der Kunde ihn selbst anfordert (POST
  // /global/zugang — etwa nach einem abgelaufenen Link) oder wenn die zuständige
  // Person ihn aus dem Office schickt. Ein Passwort gibt es für Firmenaufträge nicht.
  global_zugang: {
    de: {
      kopfSatz: KOPF, rechtsSatz: GLOBAL_ROLLEN.de.fiaon,
      betreff: "Ihr Zugang zu „Mein Auftrag“ — {{params.paket}}",
      preheader: "Ihr persönlicher Link: Stand, Vertrag, Rechnung, Dokumente und Termine zu Ihrem Auftrag.",
      titel: "Ihr Zugang zu „Mein Auftrag“",
      absaetze: [
        "{{params.anrede_zeile}}, hier ist Ihr persönlicher Link zu „Mein Auftrag“ für <b>{{params.firma}}</b>. Dort sehen Sie den Stand Ihres Auftrags, Vertrag und Rechnung, Ihren Dokumentenraum und Ihren Pflichtenkalender.",
        "Der Link gehört zu genau diesem Auftrag; ein Passwort brauchen Sie nicht. Er gilt dreißig Tage — danach fordern Sie auf der Seite mit Ihrer E-Mail-Adresse jederzeit einen neuen an. Bitte geben Sie ihn nur an Personen weiter, die Ihren Auftrag sehen dürfen.",
        "Sie haben diesen Link nicht angefordert? Dann ist nichts zu tun.",
      ],
      daten: [
        { label: "Auftrag", wert: "{{params.antrag_id}}" },
        { label: "Paket", wert: "{{params.paket}}" },
        { label: "Ihr Ansprechpartner", wert: "{{params.ansprechpartner}}" },
      ],
      knopf: { text: "Mein Auftrag öffnen", url: "{{params.mein_auftrag_url}}" },
    },
    en: {
      ...RAHMEN_EN, kopfSatz: KOPF, rechtsSatz: GLOBAL_ROLLEN.en.fiaon,
      betreff: "Your access to “My order” — {{params.paket}}",
      preheader: "Your personal link: status, contract, invoice, documents and dates for your order.",
      titel: "Your access to “My order”",
      absaetze: [
        "{{params.anrede_zeile}}, here is your personal link to “My order” for <b>{{params.firma}}</b>. There you can see the status of your order, the contract and the invoice, your document room and your compliance calendar.",
        "The link belongs to this order only; you do not need a password. It is valid for thirty days — after that you can request a new one on the page at any time with your email address. Please share it only with people who are allowed to see your order.",
        "You did not request this link? Then there is nothing to do.",
      ],
      daten: [
        { label: "Order", wert: "{{params.antrag_id}}" },
        { label: "Package", wert: "{{params.paket}}" },
        { label: "Your contact", wert: "{{params.ansprechpartner}}" },
      ],
      knopf: { text: "Open My order", url: "{{params.mein_auftrag_url}}" },
    },
  },

  // Eine neue Etappe — von Hand aus dem Office (POST …/etappe mit mitteilen) oder beim Abschluss.
  // `etappe_weiter` ist nie leer: der persönliche Satz der zuständigen Person, der nächste
  // Schritt — oder der Hinweis, wo der Stand steht. Der TITEL ist fest: Das Gerüst setzt ihn im
  // Textteil in Großbuchstaben (mailText), und aus „{{params.etappe_titel}}" würde dabei ein
  // Platzhalter, den die Nutzlast nicht kennt — der Titel bliebe leer. Die Etappe steht im Betreff,
  // in der Marke und im ersten Absatz.
  global_etappe: {
    de: {
      kopfSatz: KOPF, rechtsSatz: GLOBAL_ROLLEN.de.fiaon,
      marke: "{{params.etappe_marke}}",
      betreff: "Ihr Auftrag {{params.paket}}: {{params.etappe_titel}}",
      preheader: "Der Stand Ihres Auftrags und der nächste Schritt.",
      titel: "Neuer Stand in Ihrem Auftrag",
      absaetze: [
        "{{params.anrede_zeile}}, in Ihrem Auftrag für <b>{{params.firma}}</b> gibt es einen neuen Stand: <b>{{params.etappe_titel}}</b>.",
        "{{params.etappe_text}}",
        "{{params.etappe_weiter}}",
      ],
      daten: [
        { label: "Auftrag", wert: "{{params.antrag_id}}" },
        { label: "Paket", wert: "{{params.paket}}" },
        { label: "Ihr Ansprechpartner", wert: "{{params.ansprechpartner}}" },
      ],
      knopf: { text: "Mein Auftrag öffnen", url: "{{params.mein_auftrag_url}}" },
      fussnote: INSTITUT.de,
    },
    en: {
      ...RAHMEN_EN, kopfSatz: KOPF, rechtsSatz: GLOBAL_ROLLEN.en.fiaon,
      marke: "{{params.etappe_marke}}",
      betreff: "Your order {{params.paket}}: {{params.etappe_titel}}",
      preheader: "The status of your order and the next step.",
      titel: "A new status in your order",
      absaetze: [
        "{{params.anrede_zeile}}, there is a new status in your order for <b>{{params.firma}}</b>: <b>{{params.etappe_titel}}</b>.",
        "{{params.etappe_text}}",
        "{{params.etappe_weiter}}",
      ],
      daten: [
        { label: "Order", wert: "{{params.antrag_id}}" },
        { label: "Package", wert: "{{params.paket}}" },
        { label: "Your contact", wert: "{{params.ansprechpartner}}" },
      ],
      knopf: { text: "Open My order", url: "{{params.mein_auftrag_url}}" },
      fussnote: INSTITUT.en,
    },
  },

  // Der Pflichtenkalender erinnert — rund einen Monat und rund eine Woche vor dem Termin
  // (Tageslauf global_tageslauf, je Marke genau einmal). Information, keine Auskunft im Einzelfall.
  global_frist: {
    de: {
      kopfSatz: KOPF, rechtsSatz: GLOBAL_ROLLEN.de.partner,
      marke: "Pflichtenkalender",
      betreff: "Pflichtenkalender: {{params.frist_titel}} — {{params.frist_datum}}",
      preheader: "Ein Termin aus Ihrem Pflichtenkalender rückt näher.",
      titel: "Ein Termin rückt näher",
      absaetze: [
        "{{params.anrede_zeile}}, in Ihrem Pflichtenkalender für <b>{{params.firma}}</b> steht ein Termin, der {{params.frist_abstand}} fällig ist: <b>{{params.frist_titel}}</b> am <b>{{params.frist_datum}}</b>.",
        "{{params.frist_hinweis}}",
        "Diese Erinnerung ist eine Information und ersetzt keine steuerliche oder rechtliche Auskunft. Ist der Termin bereits erledigt, genügt eine kurze Nachricht über „Mein Auftrag“.",
      ],
      daten: [
        { label: "Auftrag", wert: "{{params.antrag_id}}" },
        { label: "Termin", wert: "{{params.frist_titel}}" },
        { label: "Fällig am", wert: "{{params.frist_datum}}" },
        { label: "Ihr Ansprechpartner", wert: "{{params.ansprechpartner}}" },
      ],
      knopf: { text: "Pflichtenkalender öffnen", url: "{{params.mein_auftrag_url}}" },
    },
    en: {
      ...RAHMEN_EN, kopfSatz: KOPF, rechtsSatz: GLOBAL_ROLLEN.en.partner,
      marke: "Compliance calendar",
      betreff: "Compliance calendar: {{params.frist_titel}} — {{params.frist_datum}}",
      preheader: "A date from your compliance calendar is approaching.",
      titel: "A date is approaching",
      absaetze: [
        "{{params.anrede_zeile}}, your compliance calendar for <b>{{params.firma}}</b> shows a date that is due {{params.frist_abstand}}: <b>{{params.frist_titel}}</b> on <b>{{params.frist_datum}}</b>.",
        "{{params.frist_hinweis}}",
        "This reminder is for information only and is not tax or legal advice. If the matter has already been dealt with, a short message via “My order” is enough.",
      ],
      daten: [
        { label: "Order", wert: "{{params.antrag_id}}" },
        { label: "Date", wert: "{{params.frist_titel}}" },
        { label: "Due on", wert: "{{params.frist_datum}}" },
        { label: "Your contact", wert: "{{params.ansprechpartner}}" },
      ],
      knopf: { text: "Open the compliance calendar", url: "{{params.mein_auftrag_url}}" },
    },
  },

  // FIAON hat ein Dokument in den Dokumentenraum gelegt, das der Kunde sehen darf
  // (Gründungsurkunde, EIN-Bestätigung, Operating Agreement …). Nie als Anhang.
  global_dokument: {
    de: {
      kopfSatz: KOPF, rechtsSatz: GLOBAL_ROLLEN.de.fiaon,
      marke: "Dokumentenraum",
      betreff: "Neues Dokument in Ihrem Dokumentenraum — {{params.dokument_art}}",
      preheader: "FIAON hat ein Dokument für Sie bereitgestellt.",
      titel: "Ein neues Dokument liegt für Sie bereit",
      absaetze: [
        "{{params.anrede_zeile}}, in Ihrem Dokumentenraum für <b>{{params.firma}}</b> liegt ein neues Dokument: <b>{{params.dokument_art}}</b> ({{params.dokument_name}}).",
        "Aus Gründen der Vertraulichkeit reist es nicht mit dieser E-Mail. Sie öffnen es unter „Mein Auftrag“ — der Knopf unten führt dorthin.",
      ],
      daten: [
        { label: "Auftrag", wert: "{{params.antrag_id}}" },
        { label: "Dokument", wert: "{{params.dokument_art}}" },
        { label: "Ihr Ansprechpartner", wert: "{{params.ansprechpartner}}" },
      ],
      knopf: { text: "Dokument öffnen", url: "{{params.mein_auftrag_url}}" },
    },
    en: {
      ...RAHMEN_EN, kopfSatz: KOPF, rechtsSatz: GLOBAL_ROLLEN.en.fiaon,
      marke: "Document room",
      betreff: "New document in your document room — {{params.dokument_art}}",
      preheader: "FIAON has provided a document for you.",
      titel: "A new document is ready for you",
      absaetze: [
        "{{params.anrede_zeile}}, there is a new document in your document room for <b>{{params.firma}}</b>: <b>{{params.dokument_art}}</b> ({{params.dokument_name}}).",
        "For reasons of confidentiality it does not travel with this email. You open it under “My order” — the button below takes you there.",
      ],
      daten: [
        { label: "Order", wert: "{{params.antrag_id}}" },
        { label: "Document", wert: "{{params.dokument_art}}" },
        { label: "Your contact", wert: "{{params.ansprechpartner}}" },
      ],
      knopf: { text: "Open the document", url: "{{params.mein_auftrag_url}}" },
    },
  },
};

const haelfte = (s: GlobalBereichSprache): Record<string, MailBaustein> =>
  Object.fromEntries(Object.entries(PAARE).map(([event, paar]) => [event, paar[s]]));

/** Die deutschen Fassungen — sie stehen unter dem Ereignisnamen im Verzeichnis des Motors. */
export const GLOBAL_BEREICH_VORLAGEN: Record<string, MailBaustein> = haelfte("de");
/** Die englischen Fassungen — der Motor nimmt sie, wenn die Nutzlast `sprache: "en"` trägt. */
export const GLOBAL_BEREICH_VORLAGEN_EN: Record<string, MailBaustein> = haelfte("en");
/** Beide Hälften nebeneinander — für den Prüfstand. */
export const GLOBAL_BEREICH_PAARE = PAARE;
