// ═══════════════════════════════════════════════════════════════════════════
// VORLAGE: FIAON GLOBAL — RECHNUNG EINES ZUSATZDIENSTES (Scheibe 1 „Ihr US-Büro“, 22.10.2026)
//
// Der Kunde hat im Portal einen Dienst hinzugefügt („Ihr Büro erweitern“). Diese Mail bringt die
// Rechnung als PDF und den Weg zur Zahlungsseite; nach dem Zahlungseingang richtet das Team den
// Dienst ein. Schreibregeln wie global.ts: gesiezt, ein Gedanke je Absatz, Zahlen im Datenkasten,
// Kopf „FIAON Global“, im Fuß der Rollensatz. Keine Qualitäts-Etiketten, keine Anbieter, keine Frist
// mit Ziffer. Direktversand über den Motor (globalMailSenden) — nie über Make; die Wand für das
// Firmenangebot (E-301) gilt (server/lib/fiaon-global-firma-post.ts).
//
// Nutzlast: die des Bestellwegs (anrede_zeile, firma, antrag_id = Mandat, payment_reference,
// faellig_am_text, zahlungsseite_url, mein_auftrag_url, ansprechpartner, sprache), dazu:
//   zusatz_titel, betrag_text („149 € im Monat“), zusatz_einrichtung, rechnungsnummer.
// Wer eine Hälfte ändert, ändert beide — scripts/pruef-global-zusatz.ts vergleicht Platzhalter und Knöpfe.
// ═══════════════════════════════════════════════════════════════════════════
import type { MailBaustein } from "../geruest";
import { GLOBAL_ROLLEN } from "@shared/fiaon-global";

const KOPF = "FIAON Global";
const RAHMEN_EN = { sprache: "en" } as unknown as Partial<MailBaustein>;

const PAARE: Record<string, Record<"de" | "en", MailBaustein>> = {
  global_zusatz: {
    de: {
      bereich: "business", kopfSatz: KOPF, rechtsSatz: GLOBAL_ROLLEN.de.fiaon,
      marke: "Ihr Büro",
      betreff: "Ihre Rechnung — {{params.zusatz_titel}}",
      preheader: "Ihre Rechnung als PDF und der Weg zur Zahlung.",
      titel: "Ihr Dienst ist hinzugefügt",
      absaetze: [
        "{{params.anrede_zeile}}, vielen Dank. Für <b>{{params.firma}}</b> haben Sie <b>{{params.zusatz_titel}}</b> hinzugefügt. Ihre Rechnung erhalten Sie mit dieser E-Mail als PDF.",
        "{{params.zusatz_einrichtung}}",
        "Den Stand sehen Sie jederzeit in Ihrem Portal unter „Ihr Büro erweitern“.",
      ],
      daten: [
        { label: "Dienst", wert: "{{params.zusatz_titel}}" },
        { label: "Betrag", wert: "{{params.betrag_text}}" },
        { label: "Rechnung", wert: "{{params.rechnungsnummer}}" },
        { label: "Verwendungszweck", wert: "{{params.payment_reference}}" },
        { label: "Zahlbar bis", wert: "{{params.faellig_am_text}}" },
        { label: "Ihr Ansprechpartner", wert: "{{params.ansprechpartner}}" },
      ],
      knopf: { text: "Zur Zahlungsseite", url: "{{params.zahlungsseite_url}}" },
      knopf2: { text: "Mein Auftrag öffnen", url: "{{params.mein_auftrag_url}}" },
    },
    en: {
      ...RAHMEN_EN, bereich: "business", kopfSatz: KOPF, rechtsSatz: GLOBAL_ROLLEN.en.fiaon,
      marke: "Your office",
      betreff: "Your invoice — {{params.zusatz_titel}}",
      preheader: "Your invoice as a PDF and how to pay.",
      titel: "Your service has been added",
      absaetze: [
        "{{params.anrede_zeile}}, thank you. You have added <b>{{params.zusatz_titel}}</b> for <b>{{params.firma}}</b>. Your invoice is attached to this email as a PDF.",
        "{{params.zusatz_einrichtung}}",
        "You can follow the status in your portal under “Extend your office” at any time.",
      ],
      daten: [
        { label: "Service", wert: "{{params.zusatz_titel}}" },
        { label: "Amount", wert: "{{params.betrag_text}}" },
        { label: "Invoice", wert: "{{params.rechnungsnummer}}" },
        { label: "Payment reference", wert: "{{params.payment_reference}}" },
        { label: "Payable by", wert: "{{params.faellig_am_text}}" },
        { label: "Your contact", wert: "{{params.ansprechpartner}}" },
      ],
      knopf: { text: "Go to the payment page", url: "{{params.zahlungsseite_url}}" },
      knopf2: { text: "Open My order", url: "{{params.mein_auftrag_url}}" },
    },
  },
};

const haelfte = (s: "de" | "en"): Record<string, MailBaustein> =>
  Object.fromEntries(Object.entries(PAARE).map(([event, paar]) => [event, paar[s]]));

export const GLOBAL_ZUSATZ_VORLAGEN: Record<string, MailBaustein> = haelfte("de");
export const GLOBAL_ZUSATZ_VORLAGEN_EN: Record<string, MailBaustein> = haelfte("en");
export const GLOBAL_ZUSATZ_PAARE = PAARE;
