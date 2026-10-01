// ═══════════════════════════════════════════════════════════════════════════
// VORLAGEN: FIAON GLOBAL — INDIVIDUALANGEBOT (6, deutsch)
// Individualangebot (01.10.2026), Register E-268
//
// Dieselben Regeln wie vorlagen/global.ts: gesiezt, Kopf „FIAON Global", Fuß in
// der Business-Welt, KEINE Bankdaten im Text (der Knopf führt zur Zahlungsseite,
// die sie aus shared/fiaon-bank.ts zieht), kein Bankname, keine Frist mit Ziffer
// (Zahlwörter oder ein Datum). E-271 (Justin, 01.10.2026 abends): FIAON GARANTIERT Kreditrahmen + Karten binnen der
// Frist, sonst alles Gezahlte zurück — der Garantie-Satz kommt als {{params.garantie_text}} fertig vom Server
// (angebotGarantie().mail); die Vorlagen schreiben „garant…“ sonst nirgends und nennen keinen Institut-Satz mehr.
// Das Individualangebot ist (Fassung IA-2026-10-01) deutsch — eine englische
// Hälfte gibt es erst mit einer englischen Fassung.
//
// Gesendet IMMER direkt über den Motor (Anhänge) und protokolliert in
// fiaon_mail_log — über globalMailSenden (server/lib/fiaon-global-auftrag.ts),
// dessen Nutzlast hier um die Angebotsfelder ergänzt wird (angebotMailZusatz):
//   angebot_ref, teil1_text, teil2_text, gesamt_text, frist_wochen_text,
//   erstattung_tage_text, teil2_ziel_text, frist_beginn_text, frist_ende_text,
//   buergin, ereignis_text, ereignis_am_text, erstattung_bis_text,
//   hemmung_von_text, hemmung_bis_text, hemmung_grund_text (nur global_angebot_hemmung),
//   kreditrahmen_text, karten_text, garantie_text, teil2_folge_text (E-271), erstattung_betrag_text, teil2_satz_text (nur global_angebot_erstattung).
// Der Prüfstand scripts/pruef-individualangebot.ts rendert jede Vorlage mit
// echten Feldern und prüft Platzhalter, Knöpfe und Wortwand.
// ═══════════════════════════════════════════════════════════════════════════
import type { MailBaustein } from "../geruest";
import { GLOBAL_ROLLEN } from "@shared/fiaon-global";

const KOPF = "FIAON Global";
const RAHMEN = { bereich: "business" as const, kopfSatz: KOPF, rechtsSatz: GLOBAL_ROLLEN.de.fiaon };

export const GLOBAL_ANGEBOT_VORLAGEN: Record<string, MailBaustein> = {

  // Direkt nach „Auftrag zahlungspflichtig erteilen". Anhänge: der Vertrag mit allen drei Anlagen und die Rechnung Teil 1.
  global_angebot_angenommen: {
    ...RAHMEN,
    betreff: "Ihr Auftrag {{params.angebot_ref}} — Vertrag und Rechnung Teil 1",
    preheader: "Ihr angenommener Vertrag und die Rechnung über Teil 1 als PDF — und der Weg zur Zahlung.",
    titel: "Ihr Auftrag steht",
    absaetze: [
      "{{params.anrede_zeile}}, vielen Dank für Ihr Vertrauen. Sie haben unser Angebot <b>{{params.angebot_ref}}</b> angenommen. Den Vertrag mit allen drei Anlagen — Bürgschaftszusage, Prüfbericht und Widerrufsbelehrung — und die Rechnung über Teil 1 erhalten Sie mit dieser E-Mail als PDF.",
      "Heute fällig ist nur Teil 1 „Gründung“ über <b>{{params.teil1_text}}</b>. Bankverbindung, Verwendungszweck und ein QR-Code für Ihre Banking-App stehen auf Ihrer Zahlungsseite. Teil 2 „Kapital-Begleitung“ über {{params.teil2_text}} wird erst fällig, wenn Ihre Gesellschaft eingetragen ist und das erste Kapital ausgezahlt oder die erste Business-Kreditkarte freigeschaltet ist.",
      "Mit dem Start beginnt die Frist von {{params.frist_wochen_text}} Wochen. Das genaue Fristende teilen wir Ihnen mit der Bestätigung Ihrer Zahlung mit.",
      "{{params.garantie_text}}",
      "Die Bürgschaftszusage der {{params.buergin}} erhalten Sie zusätzlich im Original per Post.",
    ],
    daten: [
      { label: "Angebot", wert: "{{params.angebot_ref}}" },
      { label: "Auftrag", wert: "{{params.antrag_id}}" },
      { label: "Heute fällig (Teil 1)", wert: "{{params.betrag_text}}" },
      { label: "Verwendungszweck", wert: "{{params.payment_reference}}" },
      { label: "Teil 2", wert: "{{params.teil2_text}} — erst beim Meilenstein" },
      { label: "Ihr Ansprechpartner", wert: "{{params.ansprechpartner}}" },
    ],
    knopf: { text: "Zur Zahlungsseite", url: "{{params.zahlungsseite_url}}" },
    knopf2: { text: "Mein Auftrag öffnen", url: "{{params.mein_auftrag_url}}" },
    fussnote: "Sie haben als Verbraucher ein Widerrufsrecht von vierzehn Tagen — Belehrung und Formular stehen in Anlage 3 Ihres Vertrags.",
  },

  // Nach dem Zahlungseingang Teil 1 — erst wenn die Aufgabe „Individualangebot starten" bei einem Menschen liegt.
  // Die Mail ist die Mitteilung von Beginn und Ende der Frist in Textform (Ziffer 6 Absatz 1).
  global_angebot_start: {
    ...RAHMEN,
    betreff: "Zahlung eingegangen — Ihre Frist läuft bis {{params.frist_ende_text}}",
    preheader: "Wir beginnen. Beginn und Ende der Frist Ihrer Garantie.",
    titel: "Wir beginnen",
    absaetze: [
      "{{params.anrede_zeile}}, Ihre Zahlung für Teil 1 „Gründung“ ist eingegangen — vielen Dank. Damit beginnen wir mit der Gründung Ihrer US-Gesellschaft.",
      "Wie im Vertrag zugesagt, teilen wir Ihnen die Frist mit: Sie beginnt am <b>{{params.frist_beginn_text}}</b> und endet am <b>{{params.frist_ende_text}}</b>.",
      "{{params.garantie_text}} Die Erstattung kommt binnen {{params.erstattung_tage_text}} Tagen nach dem Fristende.",
      "Ihr Ansprechpartner ist <b>{{params.ansprechpartner}}</b> und meldet sich bei Ihnen, um das Startgespräch zu vereinbaren. Vor dem ersten Antrag prüfen wir Ihren Reisepass.",
      // Nachtrag (h) + Gegenprüfung 01.10.2026: keine Unterlagenliste — beim Individualangebot bereitet FIAON alles vor.
      "Sie müssen nichts vorbereiten: Wir bereiten alles fertig vor und schicken es Ihnen zur Unterschrift. Für die gesetzlich vorgeschriebene Identifizierung brauchen wir nur Ihren Reisepass — laden Sie ihn unter „Mein Auftrag“ hoch oder zeigen Sie ihn im Startgespräch.",
    ],
    daten: [
      { label: "Auftrag", wert: "{{params.antrag_id}}" },
      { label: "Bezahlt (Teil 1)", wert: "{{params.betrag_text}}" },
      { label: "Frist beginnt", wert: "{{params.frist_beginn_text}}" },
      { label: "Frist endet", wert: "{{params.frist_ende_text}}" },
      { label: "Ihr Ansprechpartner", wert: "{{params.ansprechpartner}}" },
    ],
    knopf: { text: "Mein Auftrag öffnen", url: "{{params.mein_auftrag_url}}" },
    fussnote: "Kreditrahmen von {{params.kreditrahmen_text}} und {{params.karten_text}} bis {{params.frist_ende_text}} — sonst alles zurück (Ziffer 3 und 6 Ihres Vertrags).",
    persoenlich: true,
  },

  // „Meilenstein erreicht" im Chefbüro — die Mitteilung in Textform (Ziffer 5 Absatz 3) mit der Rechnung Teil 2.
  global_angebot_teil2: {
    ...RAHMEN,
    betreff: "Meilenstein erreicht — Rechnung Teil 2 „Kapital-Begleitung“",
    preheader: "Ihre Gesellschaft ist so weit. Die Rechnung über Teil 2 als PDF.",
    titel: "Der Meilenstein ist erreicht",
    absaetze: [
      "{{params.anrede_zeile}}, am {{params.ereignis_am_text}} hat ein Institut {{params.ereignis_text}}. Ihre Gesellschaft ist eingetragen — damit ist der Meilenstein aus Ziffer 5 Absatz 3 Ihres Vertrags erreicht.",
      "Mit dieser E-Mail erhalten Sie die Rechnung über Teil 2 „Kapital-Begleitung“: <b>{{params.betrag_text}}</b>, zahlbar binnen {{params.teil2_ziel_text}} Tagen. Bankverbindung und Verwendungszweck stehen auf Ihrer Zahlungsseite.",
      // Gegenprüfung (logik-5): vom Server — nach erfüllter Garantie ohne Erstattungs-Satz.
      "{{params.teil2_folge_text}}",
    ],
    daten: [
      { label: "Auftrag", wert: "{{params.antrag_id}}" },
      { label: "Teil 2", wert: "{{params.betrag_text}}" },
      { label: "Verwendungszweck", wert: "{{params.payment_reference}}" },
      { label: "Zahlbar bis", wert: "{{params.faellig_am_text}}" },
    ],
    knopf: { text: "Zur Zahlungsseite", url: "{{params.zahlungsseite_url}}" },
    knopf2: { text: "Mein Auftrag öffnen", url: "{{params.mein_auftrag_url}}" },
    fussnote: "Fragen zur Rechnung? Eine kurze Antwort auf diese E-Mail genügt.",
  },

  global_angebot_teil2_bezahlt: {
    ...RAHMEN,
    betreff: "Zahlung für Teil 2 eingegangen",
    preheader: "Danke — die Kapital-Begleitung läuft weiter.",
    titel: "Zahlung eingegangen",
    absaetze: [
      "{{params.anrede_zeile}}, Ihre Zahlung für Teil 2 „Kapital-Begleitung“ ist eingegangen — vielen Dank. Damit ist die vereinbarte Vergütung vollständig bezahlt.",
      "{{params.teil2_folge_text}}",
    ],
    daten: [
      { label: "Auftrag", wert: "{{params.antrag_id}}" },
      { label: "Bezahlt (Teil 2)", wert: "{{params.betrag_text}}" },
      { label: "Ihr Ansprechpartner", wert: "{{params.ansprechpartner}}" },
    ],
    knopf: { text: "Mein Auftrag öffnen", url: "{{params.mein_auftrag_url}}" },
  },

  // „Frist hemmen" im Chefbüro (Gegenprüfung 01.10.2026): Ziffer 6 verlangt die Mitteilung von Beginn und Ende der
  // Frist in Textform — die Ruhezeit und das neue Fristende gehen im selben Schritt als Mail raus. Ruhig, ohne Vorwurf.
  global_angebot_hemmung: {
    ...RAHMEN,
    betreff: "Ihre Frist läuft jetzt bis {{params.frist_ende_text}}",
    preheader: "Die Frist hat geruht, solange eine Mitwirkung fehlte — das neue Fristende.",
    titel: "Ihre Frist hat geruht",
    absaetze: [
      "{{params.anrede_zeile}}, wie in Ziffer 6 Absatz 3 Ihres Vertrags vereinbart, ruht die Frist, solange nach unserer Aufforderung eine Mitwirkung fehlt: {{params.hemmung_grund_text}}.",
      "Die Frist hat deshalb vom <b>{{params.hemmung_von_text}}</b> bis <b>{{params.hemmung_bis_text}}</b> geruht. Ihr neues Fristende ist der <b>{{params.frist_ende_text}}</b>. Alles Übrige bleibt, wie es ist:",
      "{{params.garantie_text}}",
      "Haben Sie Fragen dazu, antworten Sie einfach auf diese E-Mail oder sprechen Sie {{params.ansprechpartner}} an.",
    ],
    daten: [
      { label: "Auftrag", wert: "{{params.antrag_id}}" },
      { label: "Frist ruhte", wert: "{{params.hemmung_von_text}} bis {{params.hemmung_bis_text}}" },
      { label: "Neues Fristende", wert: "{{params.frist_ende_text}}" },
      { label: "Ihr Ansprechpartner", wert: "{{params.ansprechpartner}}" },
    ],
    knopf: { text: "Mein Auftrag öffnen", url: "{{params.mein_auftrag_url}}" },
    persoenlich: true,
  },

  // Garantiefall (E-271): Frist abgelaufen, ohne dass Kreditrahmen und Karten vollständig da sind — alles Gezahlte zurück.
  global_angebot_erstattung: {
    ...RAHMEN,
    betreff: "Ihre Erstattung — wie im Vertrag zugesagt",
    preheader: "Die Frist ist abgelaufen. Sie erhalten alles zurück, was Sie uns gezahlt haben.",
    titel: "Wir erstatten Ihnen alles",
    absaetze: [
      "{{params.anrede_zeile}}, die Frist aus Ziffer 6 Ihres Vertrags ist am {{params.frist_ende_text}} abgelaufen, ohne dass Ihre Gesellschaft den Kreditrahmen von {{params.kreditrahmen_text}} und {{params.karten_text}} vollständig erhalten hat. Wie im Vertrag zugesagt, gilt deshalb:",
      "Wir erstatten Ihnen alles, was Sie uns gezahlt haben — <b>{{params.erstattung_betrag_text}}</b>, ohne Abzug — bis spätestens <b>{{params.erstattung_bis_text}}</b> auf das Konto, von dem Sie gezahlt haben. {{params.teil2_satz_text}} Ihre Gesellschaft und alle Unterlagen bleiben Ihre.",
      "Sie müssen dafür nichts tun. Haben Sie Fragen, antworten Sie einfach auf diese E-Mail.",
    ],
    daten: [
      { label: "Auftrag", wert: "{{params.antrag_id}}" },
      { label: "Erstattung", wert: "{{params.erstattung_betrag_text}}" },
      { label: "Spätestens bis", wert: "{{params.erstattung_bis_text}}" },
    ],
    knopf: { text: "Mein Auftrag öffnen", url: "{{params.mein_auftrag_url}}" },
    persoenlich: true,
  },
};

/** Für Rollen-Zuordnung im Motor: Rechnungspost kommt aus der Buchhaltung. */
export const GLOBAL_ANGEBOT_ABSENDER: Record<string, "accounting"> = {
  global_angebot_angenommen: "accounting",
  global_angebot_teil2: "accounting",
  global_angebot_erstattung: "accounting",
};
