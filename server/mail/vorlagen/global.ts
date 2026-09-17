// ═══════════════════════════════════════════════════════════════════════════
// VORLAGEN: FIAON GLOBAL (3) — Firmenkunden, US-Struktur (E-188, 17.09.2026)
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
// ── DIESE DREI GEHEN NIE ÜBER MAKE ────────────────────────────────────────
// `global_auftrag` trägt Vertrag und Rechnung als PDF. Make kann keine Anhänge
// durchreichen und hat für diese Ereignisse keinen Zweig; der Bestellweg
// rendert sie deshalb immer mit dem Motor und sendet direkt über Brevo — wie
// die Ausfertigung der Mitarbeiter-Kündigung (E-185). Im Protokoll stehen sie
// wie jede andere Mail (fiaon_mail_log).
//
// Nutzlast (globalMailNutzlast in fiaon-global-auftrag.ts), HTML-entschärft:
//   anrede_zeile, firma, paket, betrag_text, antrag_id, payment_reference,
//   faellig_am_text, zahlungsseite_url, mein_auftrag_url, ansprechpartner,
//   stichtag_text, email, sprache.
// ═══════════════════════════════════════════════════════════════════════════
import type { MailBaustein } from "../geruest";
import { GLOBAL_ROLLEN, GLOBAL_GELD_ZURUECK } from "@shared/fiaon-global";
import { GLOBAL_UNTERLAGEN, GLOBAL_UNTERLAGEN_EN } from "@shared/fiaon-global-bereich";

/**
 * Was der Kunde für den Start bereithält — dieselbe Liste in der Startmail, in
 * der Aufgabe, auf der Seite „Mein Auftrag" und im Tageslauf. Seit dem
 * 17.09.2026 steht sie an EINER Stelle (shared/fiaon-global-bereich.ts, dort mit
 * Dokumentart und Hinweis je Zeile); hier wird sie nur weitergereicht, damit
 * bestehende Importe gelten.
 */
export { GLOBAL_UNTERLAGEN, GLOBAL_UNTERLAGEN_EN };

const KOPF = "FIAON Global";
const FUSS = GLOBAL_ROLLEN.de.fiaon;

export const GLOBAL_VORLAGEN: Record<string, MailBaustein> = {

  // Direkt nach der Unterschrift auf /business/start. Anhänge: der
  // unterschriebene Auftrag und die Rechnung — beide als PDF.
  global_auftrag: {
    kopfSatz: KOPF, rechtsSatz: FUSS,
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
    // „Mein Auftrag": Stand, Vertrag, Rechnung und später der Dokumentenraum — der Link trägt ein
    // frisches Token (globalMeinAuftragUrl). Fehlt er in der Nutzlast, lässt der Motor den Knopf weg.
    knopf2: { text: "Mein Auftrag öffnen", url: "{{params.mein_auftrag_url}}" },
    fussnote: GLOBAL_ROLLEN.de.kosten,
  },

  // Nach dem Zahlungseingang — erst wenn die Aufgabe bei der zuständigen Person liegt.
  global_start: {
    kopfSatz: KOPF, rechtsSatz: FUSS,
    betreff: "Zahlung eingegangen — wir starten mit {{params.paket}}",
    preheader: "Ihr Ansprechpartner und die Unterlagen für den Start.",
    titel: "Wir beginnen",
    absaetze: [
      "{{params.anrede_zeile}}, Ihre Zahlung für <b>{{params.paket}}</b> ist eingegangen — vielen Dank. Damit beginnt der Aufbau der US-Struktur für <b>{{params.firma}}</b>.",
      "Ihr Ansprechpartner ist <b>{{params.ansprechpartner}}</b> und meldet sich bei Ihnen, um das Startgespräch zu vereinbaren. Dort gehen wir die Schritte durch und legen gemeinsam den Stichtag für Gesellschaft und EIN fest.",
      `Bitte halten Sie für den Start bereit:<br />${GLOBAL_UNTERLAGEN.map((u) => `· ${u}`).join("<br />")}`,
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

  // Der Auftrag (Ziffer „Geld zurück") sagt zu, dass FIAON den Stichtag in
  // Textform mitteilt. Das ist diese Mail — ausgelöst von Hand aus
  // /chef/s/global-auftraege, wenn der Stichtag gesetzt wird.
  global_stichtag: {
    kopfSatz: KOPF, rechtsSatz: FUSS,
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
};
