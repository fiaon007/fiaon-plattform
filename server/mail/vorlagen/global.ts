// ═══════════════════════════════════════════════════════════════════════════
// VORLAGEN: FIAON GLOBAL (5, je deutsch und englisch) — Firmenkunden,
// US-Struktur (E-188, 17.09.2026)
//
// Schreibregeln wie in konto.ts — gesiezt, ein Gedanke je Absatz, Zahlen im
// Datenkasten. Dazu, was für diese Linie gilt:
// · KEIN karteZiel-Block und kein Kartenbild: Der Satz „Wir bereiten Ihre
//   Bonität vor" gehört zur Privatkundenlinie. Hier steht im Kopf „FIAON
//   Global" und im Fuß der Rollensatz aus shared/fiaon-global.ts.
// · KEINE Bankdaten im Text. Bankverbindung, Verwendungszweck und QR-Code
//   stehen auf der Zahlungsseite — sie zieht sie aus shared/fiaon-bank.ts und
//   zeigt deshalb nie ein altes Konto. Der Knopf führt dorthin.
// · Kein Ergebnis, das ein Institut entscheidet; keine Frist mit Ziffer.
//   Zugesagt wird, was FIAON selbst tut.
// · `global_start` sagt „Ihr Ansprechpartner meldet sich bei Ihnen". Das ist
//   eine Zusage im Sinn der Wortwand — sie ist gedeckt, weil der Versand erst
//   geschieht, NACHDEM die Aufgabe „US-Struktur starten" bei diesem Menschen
//   liegt (globalNachZahlung in server/lib/fiaon-global-auftrag.ts).
//
// ── ZWEI SPRACHEN, EIN EREIGNIS (17.09.2026, Querschnitt) ─────────────────
// Der Auftrag existiert auch unter /en/business/start; die Sprache steht in der
// Akte (fiaon_global_auftraege.vertrag_sprache). Jede Vorlage gibt es deshalb
// als Paar {de, en} — britisches Englisch, dieselben inhaltlichen Grenzen
// (scripts/seo-wortverbote-en.ts: kein „guarantee", kein „advice", kein
// „recommend"). Das Ereignis heißt in beiden Sprachen gleich; der Motor nimmt
// die englische Fassung, wenn die Nutzlast `sprache: "en"` trägt
// (mailRendern in ../motor.ts). Wer eine Vorlage ändert, ändert BEIDE Hälften —
// der Prüfstand scripts/pruef-global-querschnitt.ts vergleicht Aufbau,
// Platzhalter und Knöpfe der Paare.
//
// ── DIESE MAILS GEHEN NIE ÜBER MAKE ───────────────────────────────────────
// `global_auftrag` trägt Vertrag und Rechnung als PDF. Make kann keine Anhänge
// durchreichen und hat für diese Ereignisse keinen Zweig; der Bestellweg
// rendert sie deshalb immer mit dem Motor und sendet direkt über Brevo — wie
// die Ausfertigung der Mitarbeiter-Kündigung (E-185). Im Protokoll stehen sie
// wie jede andere Mail (fiaon_mail_log).
//
// Nutzlast (globalMailNutzlast in fiaon-global-auftrag.ts), HTML-entschärft:
//   anrede_zeile, firma, paket, betrag_text, antrag_id, payment_reference,
//   faellig_am_text, zahlungsseite_url, mein_auftrag_url, ansprechpartner,
//   mein_auftrag_url, stichtag_text, anlass, email, sprache.
// ═══════════════════════════════════════════════════════════════════════════
import type { MailBaustein } from "../geruest";
import { GLOBAL_ROLLEN, GLOBAL_GELD_ZURUECK } from "@shared/fiaon-global";
import { GLOBAL_UNTERLAGEN, GLOBAL_UNTERLAGEN_EN } from "@shared/fiaon-global-bereich";

export type GlobalMailSprache = "de" | "en";

/**
 * Was der Kunde für den Start bereithält — dieselbe Liste in der Startmail, in
 * der Aufgabe, auf der Seite „Mein Auftrag", auf /business und im Tageslauf.
 * Seit dem 17./18.09.2026 steht sie an EINER Stelle (shared/fiaon-global-bereich.ts,
 * dort mit Dokumentart und Hinweis je Zeile); hier wird sie nur weitergereicht.
 */
export { GLOBAL_UNTERLAGEN, GLOBAL_UNTERLAGEN_EN };

/**
 * Der eine Satz Anlass in der Zahlungserinnerung — je Stufe (1 = dritter Tag,
 * 2 = siebter Tag nach dem Auftrag). Er steht HIER bei den Vorlagen und nicht im
 * Lauf, damit jeder Kundensatz an einer Stelle liegt und die Wortwand ihn sieht.
 * Bewusst ohne Drohung und ohne Zusage eines Anrufs: Am zehnten Tag bekommt die
 * zuständige Person eine Aufgabe — versprochen wird dem Kunden davon nichts.
 */
export const GLOBAL_ERINNERUNG_ANLASS: Record<GlobalMailSprache, Record<1 | 2, string>> = {
  de: {
    1: "Deshalb erinnern wir Sie kurz daran.",
    2: "Dies ist unsere zweite und letzte Erinnerung per E-Mail.",
  },
  en: {
    1: "This is a short reminder.",
    2: "This is our second and final reminder by email.",
  },
};

const KOPF = "FIAON Global";

const PAARE: Record<string, Record<GlobalMailSprache, MailBaustein>> = {

  // Direkt nach der Unterschrift auf /business/start. Anhänge: der
  // unterschriebene Auftrag und die Rechnung — beide als PDF.
  global_auftrag: {
    de: {
      bereich: "business", kopfSatz: KOPF, rechtsSatz: GLOBAL_ROLLEN.de.fiaon,
      betreff: "Ihr Auftrag {{params.paket}} — Vertrag und Rechnung",
      preheader: "Ihr unterschriebener Auftrag und die Rechnung als PDF — und der Weg zur Zahlung.",
      titel: "Ihr Auftrag ist bei uns",
      absaetze: [
        "{{params.anrede_zeile}}, vielen Dank für Ihren Auftrag. Für <b>{{params.firma}}</b> haben wir <b>{{params.paket}}</b> angelegt. Ihren unterschriebenen Auftrag und die Rechnung erhalten Sie mit dieser E-Mail als PDF.",
        "So geht es weiter: Sie überweisen den Paketpreis — Bankverbindung, Verwendungszweck und ein QR-Code für Ihre Banking-App stehen auf Ihrer Zahlungsseite. Mit dem Zahlungseingang beginnen wir: Sie erhalten eine Bestätigung mit der Liste der Unterlagen, und Ihr Ansprechpartner vereinbart mit Ihnen das Startgespräch.",
        "Im Startgespräch legen wir gemeinsam den Stichtag für Ihre US-Gesellschaft und die EIN fest. Über Konto, Karte und Rahmen entscheidet allein das jeweilige Institut.",
      ],
      daten: [
        { label: "Auftrag", wert: "{{params.antrag_id}}" },
        { label: "Paket", wert: "{{params.paket}}" },
        { label: "Betrag, einmalig", wert: "{{params.betrag_text}}" },
        { label: "Verwendungszweck", wert: "{{params.payment_reference}}" },
        { label: "Zahlbar bis", wert: "{{params.faellig_am_text}}" },
        { label: "Ihr Ansprechpartner", wert: "{{params.ansprechpartner}}" },
      ],
      knopf: { text: "Zur Zahlungsseite", url: "{{params.zahlungsseite_url}}" },
      // „Mein Auftrag": Stand, Vertrag, Rechnung, Dokumentenraum — frisches Token (globalMeinAuftragUrl).
      knopf2: { text: "Mein Auftrag öffnen", url: "{{params.mein_auftrag_url}}" },
      fussnote: GLOBAL_ROLLEN.de.kosten,
    },
    en: {
      sprache: "en", bereich: "business", kopfSatz: KOPF, rechtsSatz: GLOBAL_ROLLEN.en.fiaon,
      betreff: "Your order {{params.paket}} — contract and invoice",
      preheader: "Your signed order and the invoice as PDFs — and how to pay.",
      titel: "We have received your order",
      absaetze: [
        "{{params.anrede_zeile}}, thank you for your order. We have set up <b>{{params.paket}}</b> for <b>{{params.firma}}</b>. Your signed order and the invoice are attached to this email as PDFs.",
        "What happens next: you transfer the package price — the bank details, the payment reference and a QR code for your banking app are on your payment page. Work begins once your payment has arrived: you will receive a confirmation with the list of documents, and your contact will arrange the kick-off call with you.",
        "In the kick-off call we set the agreed date for your US company and the EIN together. The institution alone decides on the account, the card and the limit.",
      ],
      daten: [
        { label: "Order", wert: "{{params.antrag_id}}" },
        { label: "Package", wert: "{{params.paket}}" },
        { label: "Amount, one-off", wert: "{{params.betrag_text}}" },
        { label: "Payment reference", wert: "{{params.payment_reference}}" },
        { label: "Payable by", wert: "{{params.faellig_am_text}}" },
        { label: "Your contact", wert: "{{params.ansprechpartner}}" },
      ],
      knopf: { text: "Go to the payment page", url: "{{params.zahlungsseite_url}}" },
      knopf2: { text: "Open My order", url: "{{params.mein_auftrag_url}}" },
      fussnote: GLOBAL_ROLLEN.en.kosten,
    },
  },

  // Der ruhige Takt für Unternehmen (global_zahlung_takt in
  // server/lib/fiaon-global-zahlungstakt.ts): am dritten und am siebten Tag nach
  // dem Auftrag, je Stufe genau einmal, nur solange der Auftrag offen ist. Ein
  // Satz Anlass, ein Knopf, Vertrag und Rechnung über „Mein Auftrag" — keine
  // Drohung, keine Mahnstufe, keine Bankdaten im Text.
  global_zahlung_erinnerung: {
    de: {
      bereich: "business", kopfSatz: KOPF, rechtsSatz: GLOBAL_ROLLEN.de.fiaon,
      marke: "Erinnerung",
      betreff: "Ihr Auftrag {{params.paket}} — die Zahlung steht noch aus",
      preheader: "Ihr Auftrag liegt bereit. Mit dem Zahlungseingang beginnen wir.",
      titel: "Ihr Auftrag wartet auf die Zahlung",
      absaetze: [
        "{{params.anrede_zeile}}, für <b>{{params.firma}}</b> liegt uns Ihr unterschriebener Auftrag über <b>{{params.paket}}</b> vor; ein Zahlungseingang ist dazu bisher nicht verbucht. {{params.anlass}}",
        "Bankverbindung, Verwendungszweck und ein QR-Code für Ihre Banking-App stehen auf Ihrer Zahlungsseite. Mit dem Zahlungseingang beginnen wir — Sie erhalten dann die Bestätigung mit der Liste der Unterlagen.",
        "Haben Sie bereits überwiesen, ist nichts weiter zu tun: Eine Überweisung braucht in der Regel ein bis zwei Bankarbeitstage, bis sie bei uns verbucht ist. Ihren Vertrag und die Rechnung finden Sie jederzeit unter „Mein Auftrag“.",
      ],
      daten: [
        { label: "Auftrag", wert: "{{params.antrag_id}}" },
        { label: "Paket", wert: "{{params.paket}}" },
        { label: "Betrag, einmalig", wert: "{{params.betrag_text}}" },
        { label: "Verwendungszweck", wert: "{{params.payment_reference}}" },
        { label: "Ihr Ansprechpartner", wert: "{{params.ansprechpartner}}" },
      ],
      knopf: { text: "Zur Zahlungsseite", url: "{{params.zahlungsseite_url}}" },
      knopf2: { text: "Mein Auftrag: Vertrag und Rechnung", url: "{{params.mein_auftrag_url}}" },
      fussnote: "Sie möchten den Auftrag nicht weiterverfolgen? Eine kurze Antwort auf diese E-Mail genügt.",
    },
    en: {
      sprache: "en", bereich: "business", kopfSatz: KOPF, rechtsSatz: GLOBAL_ROLLEN.en.fiaon,
      marke: "Reminder",
      betreff: "Your order {{params.paket}} — payment is still outstanding",
      preheader: "Your order is ready. Work begins once your payment has arrived.",
      titel: "Your order is waiting for payment",
      absaetze: [
        "{{params.anrede_zeile}}, we hold your signed order for <b>{{params.paket}}</b> on behalf of <b>{{params.firma}}</b>; no payment has been recorded for it so far. {{params.anlass}}",
        "The bank details, the payment reference and a QR code for your banking app are on your payment page. Work begins once your payment has arrived — you will then receive the confirmation with the list of documents.",
        "If you have already made the transfer, there is nothing further to do: a transfer usually takes one to two banking days to be recorded with us. You can find your contract and the invoice at any time under “My order”.",
      ],
      daten: [
        { label: "Order", wert: "{{params.antrag_id}}" },
        { label: "Package", wert: "{{params.paket}}" },
        { label: "Amount, one-off", wert: "{{params.betrag_text}}" },
        { label: "Payment reference", wert: "{{params.payment_reference}}" },
        { label: "Your contact", wert: "{{params.ansprechpartner}}" },
      ],
      knopf: { text: "Go to the payment page", url: "{{params.zahlungsseite_url}}" },
      knopf2: { text: "My order: contract and invoice", url: "{{params.mein_auftrag_url}}" },
      fussnote: "You no longer wish to pursue the order? A short reply to this email is enough.",
    },
  },

  // Nach dem Zahlungseingang — erst wenn die Aufgabe bei der zuständigen Person liegt.
  global_start: {
    de: {
      bereich: "business", kopfSatz: KOPF, rechtsSatz: GLOBAL_ROLLEN.de.fiaon,
      betreff: "Zahlung eingegangen — wir starten mit {{params.paket}}",
      preheader: "Ihr Ansprechpartner und die Unterlagen für den Start.",
      titel: "Wir beginnen",
      absaetze: [
        "{{params.anrede_zeile}}, Ihre Zahlung für <b>{{params.paket}}</b> ist eingegangen — vielen Dank. Damit beginnt der Aufbau der US-Struktur für <b>{{params.firma}}</b>.",
        "Ihr Ansprechpartner ist <b>{{params.ansprechpartner}}</b> und meldet sich bei Ihnen, um das Startgespräch zu vereinbaren. Dort gehen wir die Schritte durch und legen gemeinsam den Stichtag für Gesellschaft und EIN fest.",
        // 19.09.2026 (E-191): Die Liste hängt am Auftraggeber (Privatperson ohne Registerauszug) — globalMailNutzlast füllt sie.
        "Bitte halten Sie für den Start bereit:<br />{{params.unterlagen_liste}}",
        "Ihre Unterlagen laden Sie unter „Mein Auftrag“ hoch — dort sehen Sie auch jederzeit den Stand, Ihre Dokumente und die nächsten Schritte. Der Knopf unten führt dorthin.",
      ],
      daten: [
        { label: "Auftrag", wert: "{{params.antrag_id}}" },
        { label: "Paket", wert: "{{params.paket}}" },
        { label: "Bezahlt", wert: "{{params.betrag_text}}" },
        { label: "Ihr Ansprechpartner", wert: "{{params.ansprechpartner}}" },
      ],
      knopf: { text: "Mein Auftrag öffnen", url: "{{params.mein_auftrag_url}}" },
      fussnote: "Über Konto, Karte und Rahmen entscheidet allein das jeweilige Institut.",
    },
    en: {
      sprache: "en", bereich: "business", kopfSatz: KOPF, rechtsSatz: GLOBAL_ROLLEN.en.fiaon,
      betreff: "Payment received — we are starting {{params.paket}}",
      preheader: "Your contact and the documents for the start.",
      titel: "We are getting started",
      absaetze: [
        "{{params.anrede_zeile}}, your payment for <b>{{params.paket}}</b> has arrived — thank you. This starts the set-up of the US structure for <b>{{params.firma}}</b>.",
        "Your contact is <b>{{params.ansprechpartner}}</b>, who will be in touch to arrange the kick-off call. There we go through the steps and set the agreed date for the company and the EIN together.",
        "Please have the following ready for the start:<br />{{params.unterlagen_liste}}",
        "You upload your documents under “My order” — where you can also see the status, your documents and the next steps at any time. The button below takes you there.",
      ],
      daten: [
        { label: "Order", wert: "{{params.antrag_id}}" },
        { label: "Package", wert: "{{params.paket}}" },
        { label: "Paid", wert: "{{params.betrag_text}}" },
        { label: "Your contact", wert: "{{params.ansprechpartner}}" },
      ],
      knopf: { text: "Open My order", url: "{{params.mein_auftrag_url}}" },
      fussnote: "The institution alone decides on the account, the card and the limit.",
    },
  },

  // Der Auftrag (Ziffer „Geld zurück") sagt zu, dass FIAON den Stichtag in
  // Textform mitteilt. Das ist diese Mail — ausgelöst von Hand aus
  // /chef/s/global-auftraege, wenn der Stichtag gesetzt wird.
  global_stichtag: {
    de: {
      bereich: "business", kopfSatz: KOPF, rechtsSatz: GLOBAL_ROLLEN.de.fiaon,
      betreff: "Ihr Stichtag für Gesellschaft und EIN: {{params.stichtag_text}}",
      preheader: "Wie im Startgespräch festgelegt — zur Ablage bei Ihrem Auftrag.",
      titel: "Ihr Stichtag steht fest",
      absaetze: [
        "{{params.anrede_zeile}}, wie im Startgespräch besprochen halten wir fest: Der Stichtag für Ihre US-Gesellschaft und die EIN ist der <b>{{params.stichtag_text}}</b>.",
        ...(GLOBAL_GELD_ZURUECK.aktiv ? [`Für diesen Tag gilt die Zusage aus Ihrem Auftrag: ${GLOBAL_GELD_ZURUECK.de.text} ${GLOBAL_GELD_ZURUECK.de.bedingungen}`] : []),
      ],
      daten: [
        { label: "Auftrag", wert: "{{params.antrag_id}}" },
        { label: "Paket", wert: "{{params.paket}}" },
        { label: "Stichtag", wert: "{{params.stichtag_text}}" },
        { label: "Ihr Ansprechpartner", wert: "{{params.ansprechpartner}}" },
      ],
      persoenlich: true,
    },
    en: {
      sprache: "en", bereich: "business", kopfSatz: KOPF, rechtsSatz: GLOBAL_ROLLEN.en.fiaon,
      betreff: "Your agreed date for the company and the EIN: {{params.stichtag_text}}",
      preheader: "As set in the kick-off call — for your records.",
      titel: "Your agreed date is set",
      absaetze: [
        "{{params.anrede_zeile}}, as discussed in the kick-off call, we confirm: the agreed date for your US company and the EIN is <b>{{params.stichtag_text}}</b>.",
        ...(GLOBAL_GELD_ZURUECK.aktiv ? [`The commitment from your order applies to this date: ${GLOBAL_GELD_ZURUECK.en.text} ${GLOBAL_GELD_ZURUECK.en.bedingungen}`] : []),
      ],
      daten: [
        { label: "Order", wert: "{{params.antrag_id}}" },
        { label: "Package", wert: "{{params.paket}}" },
        { label: "Agreed date", wert: "{{params.stichtag_text}}" },
        { label: "Your contact", wert: "{{params.ansprechpartner}}" },
      ],
      persoenlich: true,
    },
  },

  // global_zugang: EINE Vorlage für beide Wege (Anforderung, Office, Login-Wegweiser) —
  // sie steht in vorlagen/global-bereich.ts (Merge 18.09.2026: vorher zwei gleichnamige).
};

const haelfte = (s: GlobalMailSprache): Record<string, MailBaustein> =>
  Object.fromEntries(Object.entries(PAARE).map(([event, paar]) => [event, paar[s]]));

/** Die deutschen Fassungen — sie stehen unter dem Ereignisnamen im Verzeichnis des Motors. */
export const GLOBAL_VORLAGEN: Record<string, MailBaustein> = haelfte("de");
/** Die englischen Fassungen — der Motor nimmt sie, wenn die Nutzlast `sprache: "en"` trägt. */
export const GLOBAL_VORLAGEN_EN: Record<string, MailBaustein> = haelfte("en");
/** Beide Hälften nebeneinander — für den Prüfstand. */
export const GLOBAL_VORLAGEN_PAARE = PAARE;
