// ═══════════════════════════════════════════════════════════════════════════
// VORLAGEN: BONITÄTSAUSKUNFT & LEADS (5 + 2 Auskunft-Fassungen) — Absender „FIAON Welcome"
//
// Schreibregeln: siehe konto.ts. Zusätzlich hier:
// · lead_followup ist mit 9.392 Versänden/Monat die größte Mail des Hauses
//   und geht an Menschen OHNE Vertrag → Abmeldelink ist Pflicht (abmeldeUrl).
// · schufa_rejected überbringt eine Rückfrage: erst die Nachricht, dann der Weg
//   nach vorn — nie umgekehrt.
//
// ── DIE AUSKUNFT-MAILS SAGEN SEIT 24.09.2026 DIE WAHRHEIT (E-240) ─────────
// Vorher: schufa_requested versprach „Sie müssen nichts tun — wir holen die
// Auskunft ein, laden sie hoch, Dauer wenige Werktage". Keine dieser Mails ging
// je automatisch raus (Registry: „noch kein Auto-Versand"), und geliefert wurde
// nichts: 59 von 66 Käufern ohne Dokument, fiaon_vorgaenge leer. Der Kunde
// MUSS etwas tun — die Vollmacht und seine Anfragen unterschreiben, sonst darf
// keine Anfrage hinaus. Jetzt feuern alle drei aus dem Liefer-Weg
// (server/lib/fiaon-auskunft-lieferung.ts) und sagen genau das: wo angefragt
// wird (je Land, nie „SCHUFA" in AT/CH), was der Kunde tut, was danach kommt.
//
// ── BIS ZUR API KAUFEN WIR SIE SELBST (25.09.2026, E-241) ─────────────────
// Im Liefermodus „einkauf" (fiaon_settings.auskunft_liefermodus) beschafft
// FIAON die Auskunft selbst. payment_confirmed, schufa_requested und
// schufa_approved sagen dann: „Wir beschaffen jetzt Ihre Auskunft … Sobald sie
// da ist, bekommen Sie Bescheid und finden Handlungsplan und Schreiben in Ihrem
// Bereich." Den Weg trägt die Nutzlast (`auskunft_liefermodus`); ohne ihn gilt
// der Vollmacht-Text vom 24.09. Die Sätze je Weg: schufaRequestedSaetze().
// Seit dem Befund der Beschaffungs-Prüfer (25.09.2026, E-241) bittet
// schufa_requested im Einkauf nicht mehr um die Vollmacht zur Übermittlung (sie
// deckt den Kauf nicht), sondern um die Bestätigung des Beschaffungsauftrags
// (AUSKUNFT_AUFTRAG_BESTAETIGEN, schufaRequestedBaustein).
//
// ── KEIN LEAD-TEXT VERSPRICHT DIE AUSKUNFT MEHR ALS PAKETLEISTUNG (25.09.2026, E-240)
// lead_followup („Auskunft holen, jeden Eintrag prüfen …"), lead_willkommen
// („Danach holen wir Ihre Bonitätsauskunft") und lead_application_link
// („Danach übernehmen wir: Auskunft, Prüfung …") versprachen, was seit E-240 ein
// Zusatzprodukt ist (shared/fiaon-auskunft.ts: 149 € einzeln, 74 € mit Paket).
// Das Paket wertet aus, erklärt jeden Eintrag und schreibt an — die Auskunft
// selbst lädt der Kunde hoch oder beauftragt sie dazu. So steht es jetzt da.
//
// ── DIE ZAHLUNGSDATEN-MAIL DER AUSKUNFT IST DIE VERTRAGSBESTÄTIGUNG (25.09.2026)
// Siehe auskunftZahlungsdatenBaustein unten: Leistung, Preis, Anbieter, AGB und
// die Widerrufsbelehrung mit Muster-Formular in Textform (§ 312f Abs. 2, § 356
// Abs. 3 BGB) — aus shared/fiaon-auskunft-widerruf.ts, wortgleich mit der
// Bestellseite.
// ═══════════════════════════════════════════════════════════════════════════
import type { MailBaustein } from "../geruest";
import {
  auskunftLand, auskunftLeistung, auskunftPreisZeile, auskunfteienText, type AuskunftArt,
} from "@shared/fiaon-auskunft";
import {
  AUSKUNFT_ANBIETER_ZEILE, AUSKUNFT_KEIN_WIDERRUF, AUSKUNFT_KONTAKT_ZEILE, AUSKUNFT_LAUFZEIT, AUSKUNFT_PREIS_STEUER,
  AUSKUNFT_VERTRAGSSPRACHE, AUSKUNFT_WIDERRUF, auskunftBeginnSatz, auskunftBeginnWahl, auskunftLeistungszeit,
} from "@shared/fiaon-auskunft-widerruf";

export const AUSKUNFT_LEAD_VORLAGEN: Record<string, MailBaustein> = {

  // Anrede aus shared/fiaon-anrede.ts (anredeMail) wie in der Lead-Strecke — nie
  // „Guten Tag max," oder „Guten Tag , …"; der Liefer-Weg setzt sie.
  // Nach der Zahlung (lieferungStarten): die Anfragen sind angelegt, es fehlt
  // die Unterschrift. `unterschrift_satz` baut der Liefer-Weg, weil nur er weiß,
  // ob die Vollmacht schon vorliegt; `unterschrift_url` ist der signierte Link
  // auf /app/unterschrift (Vollmacht zuerst, dann die Anfragen nacheinander).
  // Keine Dauer mit Zahl: Wann die Auskunfteien antworten, bestimmen sie.
  //
  // ── ZWEI LIEFERWEGE, EINE VORLAGE (25.09.2026, E-241) ─────────────────────
  // Seit E-241 gibt es neben der Vollmacht (Anfragen per Post) den Einkauf: Bis
  // die API steht, beschafft FIAON die Auskunft selbst (fiaon_settings.
  // auskunft_liefermodus, server/lib/fiaon-auskunft-quelle.ts). Dann schickt
  // diese Mail nur den Weg zur VOLLMACHT — es gibt keine Anfragen zu
  // unterschreiben, und keine Datenkopie kommt per Post zum Kunden. Der Motor
  // kennt je Ereignis genau eine Vorlage; deshalb ist, was sich je Weg
  // unterscheidet, ein Satzteil aus der Nutzlast: `auftrag_anfang` und
  // `auftrag_ende` um die Auskunfteien herum (Pflicht — die Namen bleiben EIN
  // Platzhalter, `auskunfteien`), `unterschrift_satz` (Pflicht), `danach_satz`
  // und `fuss_satz` (wahlweise).
  // Die Sätze entstehen in schufaRequestedSaetze() unten — für beide Wege, EINE
  // Quelle. Betreff, Titel, Kasten und Knöpfe sind für beide Wege wahr.
  schufa_requested: {
    betreff: "Ihre Auskunft: Jetzt fehlt nur noch Ihre Unterschrift",
    preheader: "Damit wir Ihre Auskunft einholen dürfen, braucht es Ihre Unterschrift am Bildschirm.",
    titel: "Ihre Unterschrift für Ihre Auskunft",
    absaetze: [
      "{{params.anrede}} danke für Ihren Auftrag. {{params.auftrag_anfang}} <b>{{params.auskunfteien}}</b>{{params.auftrag_ende}}",
      "{{params.unterschrift_satz}}",
      "{{params.danach_satz}}",
    ],
    daten: [
      { label: "Auskunft bei", wert: "{{params.auskunfteien}}" },
      { label: "Ihr nächster Schritt", wert: "Am Bildschirm unterschreiben" },
    ],
    knopf: { text: "Jetzt unterschreiben", url: "{{params.unterschrift_url}}" },
    knopf2: { text: "In meinen Bereich", url: "{{params.login_url}}" },
    fussnote: "{{params.fuss_satz}}",
    karteZiel: true,
  },

  // Die Auskunft ist da. Zwei Auslöser (25.09.2026, E-241):
  //   · Vollmacht: Der Mitarbeiter trägt im Vorgang „Datenkopie eingegangen" ein
  //     (Ergebnis bewilligt einer Anfrage auf Selbstauskunft) — eine Mail je
  //     Auskunftei, der wahlweise Absatz nennt, wer noch aussteht.
  //   · Einkauf: Die Beschaffung lädt die gekaufte Auskunft im Chefbüro hoch
  //     (beschaffungHochladen) — `bereich_satz` sagt, wo Handlungsplan und
  //     Schreiben liegen.
  // Deshalb „Auskunft" statt „Datenkopie" und der Knopf in den Bereich: beides
  // stimmt für beide Wege.
  schufa_approved: {
    betreff: "Ihre Auskunft ist da: {{params.auskunftei}}",
    preheader: "Sie liegt in Ihrer Akte — jetzt beginnt die Auswertung.",
    titel: "Ihre Auskunft ist eingegangen",
    absaetze: [
      "{{params.anrede}} Ihre Auskunft ist eingegangen und liegt in Ihrer Akte: <b>{{params.auskunftei}}</b>.",
      "Jetzt beginnt die Auswertung: Wir erklären jeden Eintrag in klaren Worten, prüfen die Speicherfristen und legen Ihnen Ihren Handlungsplan vor — mit fertigen Schreiben, die Sie freigeben, bevor etwas hinausgeht.",
      "{{params.bereich_satz}}",
      "{{params.rest_satz}}",
      // 26.09.2026 (E-243): „Ihr nächster Schritt zur Karte" — NUR für Menschen ohne laufendes
      // Paket (und ohne Sperre); beide Sätze baut auskunftPaketSchrittSaetze unten, der Liefer-Weg
      // legt sie in die Nutzlast. Fehlen sie, entfallen beide Absätze still (Motor: Absatz aus
      // einem Platzhalter ohne Wert).
      "{{params.paket_schritt_satz}}",
      "{{params.paket_link_satz}}",
      // Gegenlesen 26.09.2026 (E-243): Mit dem Abschnitt ist diese Pflichtmail AUCH Werbung
      // (§ 7 Abs. 3 Nr. 4 UWG: Hinweis auf den Widerspruch bei JEDER Verwendung) — der Satz
      // kommt nur mit dem Abschnitt, nie allein.
      "{{params.paket_widerspruch_satz}}",
    ],
    knopf: { text: "In meinen Bereich", url: "{{params.login_url}}" },
    karteZiel: true,
  },

  // Die Auskunftei hat eine Rückfrage (Ergebnis abgelehnt einer Anfrage). Der
  // Grund ist der Satz des Mitarbeiters — durch die Wortwand geprüft (Router)
  // und für HTML entschärft (Liefer-Weg). Die Aufgabe „Ablehnung besprechen"
  // legt der Router an; deshalb darf hier stehen, dass die Ansprechperson klärt.
  schufa_rejected: {
    betreff: "Ihre Auskunft: {{params.auskunftei}} hat eine Rückfrage",
    preheader: "Meist fehlt nur eine Angabe — so geht es weiter.",
    titel: "Eine Rückfrage der Auskunftei",
    absaetze: [
      "{{params.anrede}} zu Ihrer Anfrage an {{params.auskunftei}} gibt es eine Rückfrage:",
      "<b>{{params.grund}}</b>",
      "Das ist lösbar — meist fehlt nur eine Angabe, etwa eine frühere Anschrift oder ein Nachweis Ihrer Identität. Antworten Sie einfach auf diese E-Mail; Ihre Ansprechperson klärt den nächsten Schritt mit Ihnen.",
    ],
    knopf: { text: "Zu meinen Vorgängen", url: "{{params.login_url}}" },
  },

  // 9.392 Versände/Monat — die größte Mail des Hauses. Geht an Interessenten
  // OHNE Antrag; ihr einziger Auftrag ist der Klick auf den Antrag.
  // E-210 (22.09.2026): Anrede aus shared/fiaon-anrede.ts statt „Guten Tag {{params.vorname}}" —
  // der Rohwert stand als „Guten Tag max," und bei leerem Vornamen als „Guten Tag , …" in der Mail.
  lead_followup: {
    betreff: "Ihre Bonität wartet nicht von allein",
    preheader: "Wenige Minuten Antrag, dann übernimmt Ihr persönliches Team.",
    titel: "Der erste Schritt ist der kleinste",
    heroKarte: true,
    absaetze: [
      "{{params.anrede}} Sie haben sich bei FIAON umgesehen — und dann kam vermutlich der Alltag dazwischen. Völlig normal. Nur: Von allein verbessert sich eine Bonität nicht.",
      // 25.09.2026 (E-240): vorher „Auskunft holen, jeden Eintrag prüfen …" — die Auskunft ist ein Zusatzprodukt.
      "Was wir für Sie tun, sobald Ihr Antrag da ist: Ihre Unterlagen auswerten, jeden Eintrag Ihrer Bonitätsauskunft erklären, angreifbare Einträge anschreiben — mit einem persönlichen Ansprechpartner, der Sie durch jeden Schritt führt. Sie sehen alles live in Ihrem eigenen Bereich.",
      "Der Antrag dauert nur wenige Minuten, und Ihre Angaben aus der Anfrage sind schon eingetragen. Alles Weitere übernehmen wir.",
    ],
    knopf: { text: "Jetzt Antrag starten", url: "{{params.antrag_url}}" },
    fussnote: "Lieber erst sprechen? Antworten Sie auf diese E-Mail — wir rufen Sie zurück.",
    karteZiel: true,
    abmeldeUrl: "{{params.abmelde_url}}",
  },

  // E-210 (22.09.2026): Die Antwort auf das eben abgeschickte Werbeformular — EINE Mail statt
  // der zwei aus Make (Gmail + Brevo-Vorlage 9, beide mit Wortverstößen und fest „Schönen guten
  // Abend"). Sie trägt den persönlichen Link: Was der Mensch uns gegeben hat, steht im Antrag
  // schon drin. Anrede, Betreff und Einstieg baut der Server (server/lib/fiaon-lead-willkommen.ts),
  // damit ein unbrauchbarer Name nie in der Mail steht und nachgeholte Leads ehrlich begrüßt werden.
  lead_willkommen: {
    betreff: "{{params.betreff}}",
    preheader: "Ihre Angaben sind schon eingetragen — der Rest dauert nur wenige Minuten.",
    titel: "Ihr Antrag ist vorbereitet",
    heroKarte: true,
    absaetze: [
      "{{params.anrede}} {{params.einstieg}}",
      // 25.09.2026 (E-240): vorher „Danach holen wir Ihre Bonitätsauskunft …" — als wäre sie im Paket.
      // Diese Mail ist Werbung mit Abmeldelink; der Preis der Auskunft darf hier stehen (eine Quelle).
      // Gegenlesen 25.09.2026 (E-240): nicht „Danach öffnet sich Ihr Bereich" — der Bereich öffnet
      // sich erst mit der ersten Zahlung (fiaon-kontostufe.ts; welcome Absatz 2), nicht nach dem Antrag.
      "So geht es weiter: Sie wählen Ihr Paket und ergänzen ein paar Angaben — das dauert nur wenige Minuten. Danach arbeiten wir für Sie: Wir erklären jeden Eintrag Ihrer Bonitätsauskunft in verständlichen Worten und übernehmen die Schreiben an die Auskunfteien. Eine feste Ansprechperson begleitet Sie, angefangen mit einem kurzen Startgespräch am Telefon.",
      `Ihre Bonitätsauskunft ist nicht im Paket enthalten: Eine selbst angeforderte Datenkopie laden Sie einfach in Ihrem Bereich hoch — oder Sie beauftragen uns damit als Zusatz (${auskunftPreisZeile("privat")}).`,
    ],
    knopf: { text: "Antrag fortsetzen", url: "{{params.antrag_url}}" },
    fussnote: "Lieber erst sprechen? Antworten Sie einfach auf diese E-Mail. Der Link ist persönlich für Sie erstellt — bitte nicht weitergeben.",
    karteZiel: true,
    abmeldeUrl: "{{params.abmelde_url}}",
  },

  lead_application_link: {
    betreff: "Ihr persönlicher Antrags-Link",
    preheader: "Wie besprochen: Ihr direkter Weg zum Antrag.",
    titel: "Wie besprochen: Ihr Link",
    absaetze: [
      "{{params.anrede}} wie im Gespräch mit {{params.agent_name}} vereinbart, kommt hier Ihr persönlicher Antrags-Link.",
      // 25.09.2026 (E-240): vorher „Danach übernehmen wir: Auskunft, Prüfung, nächste Schritte."
      "Er führt Sie direkt in den Antrag, Ihre Angaben sind schon eingetragen — nur wenige Minuten, und Ihre Akte ist bei uns. Danach übernehmen wir: Auswertung Ihrer Unterlagen, Prüfung jedes Eintrags, nächste Schritte.",
    ],
    knopf: { text: "Antrag jetzt ausfüllen", url: "{{params.antrag_url}}" },
    fussnote: "Der Link ist persönlich für Sie erstellt — bitte nicht weitergeben.",
    karteZiel: true,
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// ZAHLUNGSDATEN UND ZAHLUNGSBESTÄTIGUNG FÜR EINE AUSKUNFT (24.09.2026, E-240)
//
// payment_details und payment_confirmed (konto.ts) sprechen vom Paket: „Sobald
// Ihre Überweisung eingeht, schalten wir Ihren persönlichen Bereich frei" und
// „Ihr Zugang ist da — Startgespräch". Für eine Bonitätsauskunft stimmt beides
// nicht: Es gibt nichts freizuschalten und kein Startgespräch (fiaon-kontostufe.ts
// nimmt die Auskunft ausdrücklich aus). Der Motor nimmt diese Fassungen, wenn
// die Bestellung der Nutzlast eine Auskunft ist (produktkategorie „auskunft",
// gesetzt an der Tür in make-webhook.ts; Rückfall: Referenz FIAON-SCHUFA-…).
// Gleicher Ereignisname — Protokoll, Frequenzbremse und Pflichtmail-Liste
// bleiben unberührt.
//
// `{{params.auskunfteien}}` setzt die Tür aus dem Land der Bestellung; fehlt es
// (Vorschau ohne Datenbank), setzt der Motor „den Auskunfteien Ihres Landes".
//
// 25.09.2026 (E-240): payment_details unten ist die BASIS — der Motor schickt
// auskunftZahlungsdatenBaustein(payload) (Ende der Datei), das sie um
// Vertragsbestätigung, Widerrufsbelehrung und Muster-Formular ergänzt.
// ═══════════════════════════════════════════════════════════════════════════
export const AUSKUNFT_ZAHLUNG_VORLAGEN: Record<"payment_details" | "payment_confirmed", MailBaustein> = {
  payment_details: {
    betreff: "Ihre Zahlungsdaten für die Bonitätsauskunft — {{params.payment_reference}}",
    preheader: "Sobald Ihre Überweisung da ist, fordern wir Ihre Datenkopien an.",
    titel: "Ihre Auskunft ist beauftragt",
    absaetze: [
      "Guten Tag {{params.vorname}}, danke für Ihren Auftrag. Hier sind die Zahlungsdaten für <b>{{params.paket}}</b>.",
      "Sobald Ihre Überweisung eingeht, fordern wir Ihre Datenkopien bei {{params.auskunfteien}} an. Dafür bekommen Sie eine eigene E-Mail mit dem Link, über den Sie Vollmacht und Anfragen am Bildschirm unterschreiben.",
      "Wichtig ist nur eines: der <b>Verwendungszweck</b>. An ihm erkennt unser System Ihre Zahlung automatisch — ohne ihn liegt Ihr Geld ohne Namen bei uns, und Ihr Auftrag wartet.",
    ],
    daten: [
      { label: "Betrag", wert: "{{params.betrag}} €" },
      { label: "Empfänger", wert: "{{params.empfaenger}}" },
      { label: "IBAN", wert: "{{params.iban}}" },
      { label: "BIC", wert: "{{params.bic}}" },
      { label: "Verwendungszweck", wert: "{{params.payment_reference}}" },
    ],
    bild: { url: "https://fiaon.com/api/fiaon/zahlung/{{params.payment_reference}}/qr.png", alt: "GiroCode — mit der Banking-App scannen", unterschrift: "Mit der Banking-App scannen: Empfänger, IBAN, Betrag und Verwendungszweck sind schon ausgefüllt." },
    knopf: { text: "Zahlungsseite öffnen — QR-Code & Bankdaten", url: "https://fiaon.com/zahlung/{{params.payment_reference}}" },
    fussnote: "Eine Überweisung braucht in der Regel einen Bankarbeitstag. Fragen zu Ihrer Auskunft? Antworten Sie einfach auf diese E-Mail.",
    karteZiel: true,
  },

  payment_confirmed: {
    betreff: "Zahlung eingegangen — wir holen Ihre Auskunft, {{params.vorname}}",
    preheader: "Danke! Als Nächstes braucht es Ihre Unterschrift am Bildschirm.",
    titel: "Danke — Ihre Zahlung ist da",
    absaetze: [
      "Guten Tag {{params.vorname}}, Ihre Zahlung für <b>{{params.paket}}</b> ist eingegangen. Ab jetzt arbeiten wir an Ihrer Auskunft.",
      "Als Nächstes fordern wir Ihre Datenkopien bei {{params.auskunfteien}} an. Damit wir das dürfen, braucht es Ihre Unterschrift unter der Vollmacht zur Übermittlung und unter Ihren Anfragen — den Weg dorthin schicken wir Ihnen in einer eigenen E-Mail. Fehlt uns dafür noch eine Angabe, klärt Ihre Ansprechperson sie mit Ihnen.",
      "Danach schicken die Auskunfteien Ihre Datenkopie per Post an Ihre Anschrift. Sie fotografieren sie in Ihrem Bereich, und wir erklären jeden Eintrag, prüfen die Speicherfristen und legen Ihnen Handlungsplan und fertige Schreiben zur Freigabe vor.",
    ],
    daten: [
      { label: "Ihr Auftrag", wert: "{{params.paket}}" },
      { label: "Bezahlt", wert: "{{params.betrag}} €" },
    ],
    knopf: { text: "Zu meinem Bereich", url: "{{params.login_url}}" },
    fussnote: "Noch kein Passwort? Wählen Sie beim Anmelden „Passwort vergessen“ — Sie vergeben es in einem Schritt selbst.",
    karteZiel: true,
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// „ICH HABE ÜBERWIESEN" BEI EINER AUSKUNFT (Integration 26.09.2026, E-243)
//
// Justin: „Warum die gleiche Zahlungsseite für Nicht-Kunden — da steht ‚Konto
// aktivieren', die bestellen ja nur die Auskunft!" Die Zahlungsseite spricht
// seit E-243 von der Auskunft (client/src/i18n/zahlung-auskunft.ts). Die Mail
// danach (claim_received, server/mail/vorlagen/zahlung.ts) sagte aber weiter:
// „Sobald das Geld zugeordnet ist, geht Ihr Bereich automatisch auf und Sie
// erhalten Ihre Zugangs-Mail" — für einen Auskunft-Käufer falsch (kein Bereich,
// der aufgeht, keine Zugangs-Mail). Dieselbe Weiche wie payment_details und
// payment_confirmed: Die Tür (make-webhook.ts) setzt `produktkategorie`, der
// Motor nimmt diese Fassung. Gleicher Ereignisname — Pflichtmail, Protokoll und
// Bankwechsel-Liste bleiben. Wie die Paket-Fassung: kein Zahlknopf, kein QR-Code
// (er hat gerade überwiesen — ein Knopf lüde zur zweiten Zahlung ein), die
// Bankverbindung nur zum Abgleichen. Was nach der Zuordnung kommt, sagt die
// Bestätigung (auskunftZahlungEingangBaustein) — je Lieferweg und Widerrufswahl
// richtig; hier deshalb nur, DASS sie kommt.
// ═══════════════════════════════════════════════════════════════════════════
export const AUSKUNFT_ZAHLUNG_GEMELDET_VORLAGE: MailBaustein = {
  betreff: "Danke — wir prüfen Ihre Zahlung für die Bonitätsauskunft",
  preheader: "Ihre Meldung ist da. Wir gleichen mit dem Konto ab und melden uns.",
  titel: "Ihre Zahlungsmeldung ist da",
  absaetze: [
    "Guten Tag {{params.vorname}}, Sie haben uns mitgeteilt, dass Sie <b>{{params.betrag}} €</b> für <b>{{params.paket}}</b> überwiesen haben — danke dafür.",
    "Wir gleichen Ihre Zahlung jetzt mit dem Bankkonto ab. Das dauert in der Regel einen Bankarbeitstag. Sobald das Geld zugeordnet ist, bestätigen wir Ihnen den Eingang per E-Mail — darin steht auch, wie es mit Ihrer Auskunft bei {{params.auskunfteien}} weitergeht.",
    "Eine Bitte, damit das glattgeht: Sehen Sie kurz nach, ob Sie den Verwendungszweck unten mitgeschickt haben — daran finden wir Ihre Zahlung. Überweisen Sie bitte auf keinen Fall ein zweites Mal — wir melden uns, sobald Ihre Zahlung zugeordnet ist.",
  ],
  daten: [
    { label: "Gemeldeter Betrag", wert: "{{params.betrag}} €" },
    { label: "Empfänger", wert: "{{params.empfaenger}}" },
    { label: "IBAN", wert: "{{params.iban}}" },
    { label: "BIC", wert: "{{params.bic}}" },
    { label: "Verwendungszweck", wert: "{{params.payment_reference}}" },
  ],
  fussnote: "Kein Verwendungszweck angegeben? Dann kann die Zuordnung länger dauern — antworten Sie in dem Fall kurz mit Datum und Betrag Ihrer Überweisung.",
};

// ═══════════════════════════════════════════════════════════════════════════
// DIE SÄTZE DER LIEFER-MAILS JE LIEFERWEG (25.09.2026, E-241)
//
// Justin: „Bis zur API kaufen wir sie selbst." Im Einkauf gibt es keine
// Anfragen zu unterschreiben und keine Post an den Kunden: FIAON beschafft die
// Auskunft, lädt sie hoch, und der Kunde findet Handlungsplan und Schreiben in
// seinem Bereich. Bestätigen muss er nur, wenn für die Bestellung noch kein
// Beschaffungsauftrag dokumentiert ist (Betreuer, Mara, Altbestellungen —
// Bestellseite, Kauflink und Kaufkarte holen ihn seit 25.09.2026 als
// Pflicht-Haken ein). Die Sätze sind reiner Text ohne Tags — sie kommen als Wert
// in die Vorlage, und der Text-Teil der Mail entfernt nur die Tags der Vorlage.
// Keine Frist mit Zahl, keine Zusage über das Ergebnis.
// ═══════════════════════════════════════════════════════════════════════════
export type AuskunftLieferweg = "vollmacht" | "einkauf";

/** Einkauf ist alles, was nicht ausdrücklich „vollmacht" heißt — auch „api" (sie fällt auf den Einkauf zurück). */
export function lieferwegAusNutzlast(p: Record<string, unknown>): AuskunftLieferweg | null {
  const m = String(p.auskunft_liefermodus ?? "").trim();
  if (!m) return null;
  return m === "vollmacht" ? "vollmacht" : "einkauf";
}

export interface SchufaRequestedSaetze {
  /** Vor den Auskunfteien („Wir fordern jetzt Ihre Datenkopien bei"). */
  auftrag_anfang: string;
  /** Nach den Auskunfteien (nie leer: „ an." bzw. „."). */
  auftrag_ende: string;
  danach_satz: string;
  fuss_satz: string;
  /**
   * Nur im Einkauf (dort: die Bitte um die Auftragsbestätigung) — im Vollmacht-Weg
   * baut die Lieferung ihn (sie weiß, ob die Vollmacht schon vorliegt).
   */
  unterschrift_satz?: string;
}

/**
 * Die Sätze für schufa_requested. Die Auskunfteien selbst setzt die Vorlage
 * aus `{{params.auskunfteien}}` ein (je Land, nie „SCHUFA" in AT/CH) — hier
 * stehen nur die Worte davor und danach. `wartenAb`: Beginn vor Ablauf der
 * Widerrufsfrist nicht verlangt → ab diesem Tag (TT.MM.JJJJ).
 */
export function schufaRequestedSaetze(
  weg: AuskunftLieferweg, ein: { art?: AuskunftArt; wartenAb?: string | null } = {},
): SchufaRequestedSaetze {
  if (weg === "vollmacht") {
    return {
      auftrag_anfang: "Wir fordern jetzt Ihre Datenkopien bei",
      auftrag_ende: " an.",
      danach_satz: "Erst mit Ihrer Unterschrift gehen die Anfragen hinaus. Die Auskunfteien schicken Ihre Datenkopie per Post an Ihre Anschrift — fotografieren Sie sie dann in Ihrem Bereich unter Vorgänge. Wir erklären Ihnen jeden Eintrag, prüfen die Speicherfristen und legen Ihnen Handlungsplan und fertige Schreiben zur Freigabe vor.",
      fuss_satz: "Die Vollmacht erlaubt uns nur, Ihre unterschriebenen Anfragen zu übermitteln — widerrufen können Sie sie jederzeit in Ihrem Bereich. Ist der Link abgelaufen, finden Sie unter Vorgänge einen neuen.",
    };
  }
  const ab = ein.wartenAb && DATUM_DE.test(ein.wartenAb) ? ein.wartenAb : null;
  // ── IM EINKAUF: DIE AUFTRAGSBESTÄTIGUNG (25.09.2026, E-241) ──────────────
  // Bis heute bat diese Mail im Einkauf um die „Vollmacht zur Übermittlung"
  // (/app/unterschrift). Die deckt nur die kostenlose Datenkopie, nicht den Kauf
  // einer Auskunft im Namen des Kunden (Befund der Beschaffungs-Prüfer). Jetzt
  // bittet sie um die kurze Bestätigung des Beschaffungsauftrags — der Knopf
  // führt auf /api/fiaon/auskunft/auftrag/:token (Vorlage
  // AUSKUNFT_AUFTRAG_BESTAETIGEN, der Motor nimmt sie im Einkauf). Kein „jetzt":
  // Beschafft wird erst nach der Bestätigung (und ggf. nach der Widerrufsfrist).
  return {
    auftrag_anfang: ein.art === "firma"
      ? "Wir beschaffen die Auskünfte Ihres Unternehmens und die persönliche Auskunft der Inhaberin bzw. des Inhabers oder der Geschäftsführung bei"
      : "Wir beschaffen Ihre Auskunft bei",
    auftrag_ende: ".",
    unterschrift_satz: (ab ? `Wie bei der Beauftragung gewählt, beginnen wir damit erst nach Ablauf der Widerrufsfrist, ab dem ${ab}. ` : "")
      + "Bitte bestätigen Sie kurz Ihren Auftrag, damit wir Ihre Auskunft beschaffen dürfen — ein Klick auf den Knopf unten genügt"
      + (ab ? ", und das geht schon jetzt." : "."),
    danach_satz: "Sobald Ihre Auskunft da ist, bekommen Sie Bescheid. Sie liegt dann in Ihrem Bereich — mit der Erklärung jedes Eintrags, Ihrem Handlungsplan und fertigen Schreiben zur Freigabe.",
    fuss_satz: "Mit Ihrem Auftrag fordern wir Ihre Auskunft bei den genannten Auskunfteien für Sie an bzw. beschaffen sie — auch als kostenpflichtige Auskunft; deren Kosten sind im Preis enthalten. "
      + "Bis zur Beschaffung können Sie den Auftrag jederzeit widerrufen: Antworten Sie einfach auf diese E-Mail. Ist der Link abgelaufen, antworten Sie ebenfalls — dann bekommen Sie einen neuen.",
  };
}

/**
 * schufa_requested im Einkauf (25.09.2026, E-241): die Bitte um die
 * Auftragsbestätigung statt um die Vollmacht. Dieselben Platzhalter wie die
 * Vollmacht-Fassung (schufaRequestedSaetze("einkauf")), eigener Betreff, Titel,
 * Kasten und Knopf. `unterschrift_url` trägt hier den signierten Link zur
 * Auftragsbestätigung — der Name bleibt, weil das Mail-Protokoll genau diesen
 * Schlüssel verbirgt (payloadSchwaerzen) und das Ereignis ihn als Pflichtfeld führt.
 */
export const AUSKUNFT_AUFTRAG_BESTAETIGEN: MailBaustein = {
  betreff: "Ihre Auskunft: Bitte bestätigen Sie kurz Ihren Auftrag",
  preheader: "Ein Klick genügt — dann beschaffen wir Ihre Auskunft für Sie.",
  titel: "Bitte bestätigen Sie Ihren Auftrag",
  absaetze: [
    "{{params.anrede}} danke für Ihren Auftrag. {{params.auftrag_anfang}} <b>{{params.auskunfteien}}</b>{{params.auftrag_ende}}",
    "{{params.danach_satz}}",
    "{{params.unterschrift_satz}}",
  ],
  daten: [
    { label: "Auskunft bei", wert: "{{params.auskunfteien}}" },
    { label: "Ihr nächster Schritt", wert: "Auftrag bestätigen — ein Klick" },
  ],
  knopf: { text: "Auftrag bestätigen", url: "{{params.unterschrift_url}}" },
  knopf2: { text: "In meinen Bereich", url: "{{params.login_url}}" },
  fussnote: "{{params.fuss_satz}}",
  karteZiel: true,
};

/** Die Vorlage für schufa_requested im Einkauf — null = die Vorlage des Vollmacht-Wegs bleibt (der Motor fragt hier). */
export function schufaRequestedBaustein(p: Record<string, unknown>): MailBaustein | null {
  return lieferwegAusNutzlast(p) === "einkauf" ? AUSKUNFT_AUFTRAG_BESTAETIGEN : null;
}

/** Der wahlweise Satz in schufa_approved, wenn FIAON die Auskunft beschafft hat. */
export const AUSKUNFT_DA_BEREICH_SATZ =
  "Handlungsplan und Schreiben finden Sie in Ihrem Bereich, sobald die Auswertung fertig ist. Melden Sie sich dort mit der E-Mail-Adresse an, an die diese Nachricht ging.";

// ═══════════════════════════════════════════════════════════════════════════
// „IHR NÄCHSTER SCHRITT ZUR KARTE" IN schufa_approved (26.09.2026, E-243)
//
// Justin: „Ziel ist, die Bonitätsauskunft zu verkaufen UND ein Abo zu verkaufen."
// Wer die Auskunft ohne Paket gekauft hat, liest nach der Lieferung — einmal je
// Bestellung, in der ersten „Ihre Auskunft ist da" —, was als
// Nächstes kommt — ehrlich: Auswertung, Handlungsplan und Schreiben hat er mit
// der Auskunft schon; das Paket begleitet ihn darüber hinaus (Fristen, Antworten,
// Weg zur Karte); über die Karte entscheidet die Bank. Mit dem Abschnitt ist die
// Mail auch Werbung — deshalb kommt paket_widerspruch_satz immer mit (§ 7 Abs. 3
// Nr. 4 UWG; „Stopp“ an welcome@ liest der Postmeister). Kein „Limit" (kein zahlender
// Paketkunde, VERBOTENE_WORTE), keine Zusage, keine Frist, kein Preis ohne
// Laufzeit (der steht im Antrag, AGB §§ 5/6).
// Wer es bekommt, entscheidet auskunftPaketSchritt (server/lib/fiaon-auskunft.ts):
//   „neu"    — kein Paket-Antrag offen → Antrag (src=auskunft_da: ohne den Zusatz,
//              die Auskunft hat er ja),
//   „antrag" — ein fertiger Antrag wartet auf die erste Zahlung → seine
//              Zahlungsseite (kein zweiter Antrag).
// OHNE Tags in den Werten (wie unterschrift_satz, fiaon-auskunft-lieferung.ts):
// Der Motor füllt Werte erst NACH mailText ein — ein <b> oder <a> stünde im
// Text-Teil wörtlich. Deshalb die Überschrift als Satzanfang und die Adresse
// ausgeschrieben (die Postfächer machen sie klickbar, der Text-Teil bleibt lesbar).
// Die Adresse kommt von absoluteUrl — trotzdem entschärft (&, <, >, {{).
// ═══════════════════════════════════════════════════════════════════════════
export function auskunftPaketSchrittSaetze(variante: "neu" | "antrag", url: string): {
  paket_schritt_satz: string; paket_link_satz: string; paket_widerspruch_satz: string;
} {
  const adresse = String(url ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\{\{/g, "{ {").trim();
  // Gegenlesen 26.09.2026 (E-243): Auswertung, Handlungsplan und Schreiben GEHÖREN zur gekauften
  // Auskunft (auskunftLeistung, shared/fiaon-auskunft.ts) — der Abschnitt verkauft sie nicht noch
  // einmal als Paketleistung, sondern sagt, was das Paket DARÜBER HINAUS tut (fiaon-wissen.ts:
  // feste Ansprechperson, Fristen und Antworten verfolgen, Weg zur Karte). Keine Zusage.
  const widerspruch = "Hinweise auf weitere Leistungen von FIAON per E-Mail können Sie jederzeit abbestellen: Eine kurze Antwort „Stopp“ genügt, "
    + "dafür entstehen keine anderen als die Übermittlungskosten nach den Basistarifen. Ihre Auskunft und Ihr Handlungsplan bleiben davon unberührt.";
  if (variante === "antrag") {
    return {
      paket_schritt_satz: "Ihr nächster Schritt zur Karte: Ihr Antrag für ein FIAON-Paket liegt schon bei uns — es fehlt nur Ihre erste Zahlung. "
        + "Danach begleitet Sie Ihre feste Ansprechperson über die Auskunft hinaus: Sie verfolgt Fristen und Antworten der Auskunfteien "
        + "und richtet Ihren Weg zur passenden Karte danach aus. Über die Karte entscheidet die Bank — wir bereiten Sie darauf vor.",
      paket_link_satz: `Betrag, Bankdaten und Verwendungszweck finden Sie hier: ${adresse}`,
      paket_widerspruch_satz: widerspruch,
    };
  }
  return {
    paket_schritt_satz: "Ihr nächster Schritt zur Karte: Ihre Auskunft zeigt, wo Sie stehen — Auswertung, Handlungsplan und Schreiben gehören schon dazu. "
      + "Wer danach nicht allein weitergehen möchte, nimmt ein FIAON-Paket dazu: Ihre feste Ansprechperson begleitet Sie über die Auskunft hinaus, "
      + "verfolgt Fristen und Antworten der Auskunfteien und richtet Ihren Weg zur passenden Karte danach aus. "
      + "Über die Karte entscheidet die Bank — wir bereiten Sie darauf vor.",
    paket_link_satz: `Pakete ansehen und Antrag stellen (Ihre Auskunft ist schon da, Sie brauchen keine zweite): ${adresse}`,
    paket_widerspruch_satz: widerspruch,
  };
}

/**
 * Ist die Bestellung dieser Nutzlast eine Auskunft? Rein, ohne Datenbank: Die
 * Tür (make-webhook.ts) setzt `produktkategorie` aus der Bestellzeile; ohne sie
 * (Vorschau, Make-Weg) zählt die Referenz FIAON-SCHUFA-… oder der Katalogschlüssel.
 */
export function istAuskunftNutzlast(p: Record<string, unknown>): boolean {
  if (String(p.produktkategorie ?? "") === "auskunft") return true;
  if (String(p.produktkategorie ?? "").trim() !== "") return false;
  return String(p.antrag_id ?? "").startsWith("FIAON-SCHUFA-");
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE ZAHLUNGSDATEN-MAIL DER AUSKUNFT ALS VERTRAGSBESTÄTIGUNG (25.09.2026, E-240)
//
// ── DER BEFUND ────────────────────────────────────────────────────────────
// Die Widerrufsbelehrung stand nur auf der Bestellseite — auf keinem
// dauerhaften Datenträger. Die Widerrufsfrist beginnt aber erst mit der
// Belehrung in Textform (§ 356 Abs. 3 BGB; ohne sie läuft sie zwölf Monate und
// 14 Tage), und die Bestätigung des Vertrags mit seinem Inhalt schuldet der
// Unternehmer spätestens vor Beginn der Leistung (§ 312f Abs. 2 BGB). Die
// Zahlungsdaten-Mail geht direkt nach der Bestellung — vor jeder Leistung.
//
// ── WAS DIESE FASSUNG TUT ─────────────────────────────────────────────────
// Oben unverändert der Weg zur Zahlung (Handlungsaufruf, QR-Code, Knopf).
// Darunter, als Abschnitte des Gerüsts (MailBaustein.anhang):
//   1. „Ihre Vertragsbestätigung": Leistung (auskunftLeistung), Preis mit
//      Steuersatz der AGB, Laufzeit, Leistungszeit, Bestelldatum und
//      -nummer, Anbieter, Vertragssprache, AGB und Datenschutz.
//   2. „Ihr Widerrufsrecht": die Wahl des Kunden zum Beginn (verlangt / nicht
//      verlangt — bei „offen" kein Satz), dann das Muster wörtlich; für
//      Unternehmen der Satz „kein gesetzliches Widerrufsrecht".
//   3. „Muster-Widerrufsformular" (nur Verbraucher).
// Alle Sätze aus shared/fiaon-auskunft-widerruf.ts — dieselbe Quelle wie die
// Bestellseite. Wer nicht verlangt hat, liest schon im zweiten Absatz, dass die
// Anfragen erst nach Fristablauf hinausgehen (dieselbe Regel wie die Lieferung).
//
// ── WOHER DIE WERTE KOMMEN ────────────────────────────────────────────────
// Die Tür (auskunftMailAnreichern, server/lib/fiaon-auskunft-lieferung.ts)
// legt `auskunft_art`, `auskunft_land`, `auskunft_bestellt_am`, `widerruf_wahl`
// und `widerruf_ab` in die Nutzlast. Fehlen sie (Vorschau ohne Datenbank),
// gilt: Verbraucher, Land unbekannt („den Auskunfteien Ihres Landes" statt einer
// geratenen SCHUFA), Wahl offen. Werte aus der Nutzlast kommen nur geprüft
// (Datum als TT.MM.JJJJ) in den Text; alles andere bleibt Platzhalter, den der
// Motor füllt.
// ═══════════════════════════════════════════════════════════════════════════
const DATUM_DE = /^\d{2}\.\d{2}\.\d{4}$/;

/**
 * Die Zahlungsbestätigung der Auskunft (25.09.2026, E-240) — wie die Zahlungsdaten
 * nach Art und Wahl: Für Unternehmen nennt Absatz 2 auch die Wirtschaftsauskunfteien,
 * und wer den Beginn erst nach der Widerrufsfrist gewählt hat, liest das hier noch einmal.
 */
export function auskunftZahlungEingangBaustein(p: Record<string, unknown>): MailBaustein {
  const basis = AUSKUNFT_ZAHLUNG_VORLAGEN.payment_confirmed;
  const art: AuskunftArt = String(p.auskunft_art ?? "").trim() === "firma" ? "firma" : "privat";
  const wahl = art === "privat" ? auskunftBeginnWahl(p.widerruf_wahl) : "offen";
  const ab = DATUM_DE.test(String(p.widerruf_ab ?? "").trim()) ? String(p.widerruf_ab).trim() : null;
  // 25.09.2026 (E-241): Im Einkauf beschafft FIAON die Auskunft selbst — kein
  // „Anfragen unterschreiben", keine Datenkopie per Post zum Kunden. Die Tür
  // (auskunftMailAnreichern) setzt `auskunft_liefermodus` und, ob für die
  // Bestellung schon eine Vollmacht dokumentiert ist (`auskunft_einwilligung`).
  if (lieferwegAusNutzlast(p) === "einkauf") return auskunftZahlungEingangEinkauf(p, art, wahl === "nicht_verlangt" ? ab : null, wahl === "nicht_verlangt");
  const zweiter = art === "firma"
    ? "Als Nächstes fordern wir die Daten Ihres Unternehmens bei den Wirtschaftsauskunfteien an, dazu die persönliche Datenkopie der Inhaberin bzw. des Inhabers oder der Geschäftsführung bei {{params.auskunfteien}}. Damit wir das dürfen, braucht es Ihre Unterschrift unter der Vollmacht zur Übermittlung und unter Ihren Anfragen — den Weg dorthin schicken wir Ihnen in einer eigenen E-Mail."
    : wahl === "nicht_verlangt"
      ? `Als Nächstes bereiten wir Ihre Anfragen an {{params.auskunfteien}} vor; die Vollmacht zur Übermittlung unterschreiben Sie über den Link in einer eigenen E-Mail. Wie bei Ihrer Bestellung gewählt, übermitteln wir die Anfragen erst nach Ablauf der Widerrufsfrist${ab ? `, ab dem ${ab}` : ""}.`
      : basis.absaetze[1];
  return { ...basis, absaetze: [basis.absaetze[0], zweiter, ...basis.absaetze.slice(2)] };
}

/**
 * Die Zahlungsbestätigung im Einkauf (25.09.2026, E-241): „Wir beschaffen jetzt
 * Ihre Auskunft … Sobald sie da ist, bekommen Sie Bescheid und finden
 * Handlungsplan und Schreiben in Ihrem Bereich." Fehlt die Einwilligung, sagt
 * der zweite Absatz, dass der Link zur Auftragsbestätigung in einer eigenen
 * Mail kommt (schufa_requested aus der Lieferung, seit 25.09.2026 statt der
 * Vollmacht). Wer den Beginn vor Fristablauf nicht
 * verlangt hat, liest, dass wir erst danach anfangen — ohne Frist mit Zahl.
 */
function auskunftZahlungEingangEinkauf(p: Record<string, unknown>, art: AuskunftArt, ab: string | null, nachFrist: boolean): MailBaustein {
  const basis = AUSKUNFT_ZAHLUNG_VORLAGEN.payment_confirmed;
  // 25.09.2026 (E-241): Fehlt die Einwilligung, kommt nicht mehr der Link zur Vollmacht, sondern der
  // zur Auftragsbestätigung (auftragLinkSenden) — der Satz sagt das, ohne „jetzt“ davor.
  const auftragFehlt = String(p.auskunft_einwilligung ?? "").trim() === "nein";
  const was = art === "firma"
    ? "die Auskünfte Ihres Unternehmens und die persönliche Auskunft der Inhaberin bzw. des Inhabers oder der Geschäftsführung bei {{params.auskunfteien}}"
    : "Ihre Auskunft bei {{params.auskunfteien}}";
  const fristSatz = nachFrist
    ? ` Wie bei Ihrer Bestellung gewählt, beginnen wir damit erst nach Ablauf der Widerrufsfrist${ab ? `, ab dem ${ab}` : ""}.`
    : "";
  // Gegenlesen 25.09.2026: „jetzt“ nur ohne Wartezeit (sonst Widerspruch zum Fristsatz) — und nie,
  // solange der Auftrag noch bestätigt werden muss.
  const wann = nachFrist || auftragFehlt ? "" : "jetzt ";
  const zweiter = auftragFehlt
    ? `Wir beschaffen ${wann}${was}. Damit wir sie für Sie anfordern bzw. beschaffen dürfen, fehlt nur noch Ihre kurze Bestätigung des Auftrags — den Link dazu schicken wir Ihnen in einer eigenen E-Mail.${fristSatz}`
    : `Wir beschaffen ${wann}${was}.${fristSatz} Sie müssen dafür nichts weiter tun.`;
  return {
    ...basis,
    preheader: auftragFehlt ? "Danke! Als Nächstes braucht es nur Ihre kurze Bestätigung des Auftrags." : nachFrist ? "Danke! Nach Ablauf der Widerrufsfrist beschaffen wir Ihre Auskunft." : "Danke! Wir beschaffen jetzt Ihre Auskunft.",
    absaetze: [
      basis.absaetze[0],
      zweiter,
      "Sobald Ihre Auskunft da ist, bekommen Sie Bescheid und finden Handlungsplan und Schreiben in Ihrem Bereich: Wir erklären jeden Eintrag, prüfen die Speicherfristen und legen Ihnen fertige Schreiben zur Freigabe vor. Fehlt uns dafür noch eine Angabe, klärt Ihre Ansprechperson sie mit Ihnen.",
    ],
  };
}

export function auskunftZahlungsdatenBaustein(p: Record<string, unknown>): MailBaustein {
  const basis = AUSKUNFT_ZAHLUNG_VORLAGEN.payment_details;
  const art: AuskunftArt = String(p.auskunft_art ?? "").trim() === "firma" ? "firma" : "privat";
  const landBekannt = String(p.auskunft_land ?? "").trim() !== "";
  const land = auskunftLand(p.auskunft_land);
  const wahl = art === "privat" ? auskunftBeginnWahl(p.widerruf_wahl) : "offen";
  const ab = DATUM_DE.test(String(p.widerruf_ab ?? "").trim()) ? String(p.widerruf_ab).trim() : null;
  const bestelltAm = DATUM_DE.test(String(p.auskunft_bestellt_am ?? "").trim()) ? String(p.auskunft_bestellt_am).trim() : null;
  const nachFrist = wahl === "nicht_verlangt";

  // Ohne Land nie eine Auskunftei raten — Österreicher lesen nie „SCHUFA".
  const bei = auskunfteienText(land);
  const leistung = auskunftLeistung(art, land).map((z) => (landBekannt ? z : z.replace(bei, "den Auskunfteien Ihres Landes")));

  // Gegenlesen 25.09.2026 (E-240): Für Unternehmen sagte Absatz 2 nur „fordern wir Ihre
  // Datenkopien bei {{params.auskunfteien}} an" — das sind die Auskunfteien der PERSÖNLICHEN
  // Datenkopie; die Firmendaten der Wirtschaftsauskunfteien, die die Vertragsbestätigung darunter
  // als erste Leistung nennt (auskunftLeistung), fehlten. Jetzt sagt der Absatz beides, wie unten.
  //
  // Gegenlesen 25.09.2026 (E-241): Im Einkauf (Standard seit E-241) gibt es keine Anfragen zu
  // unterschreiben — der zweite Absatz kündigte sonst eine Mail „Vollmacht und Anfragen“ an, die
  // nie kommt. Der Vollmacht-Satz ist BEDINGT: Diese Mail geht direkt nach der Bestellung los,
  // bevor die Bestellseite ihren Haken in den Verlauf schreibt (widerrufWahlFuerMail) — so stimmt
  // er mit und ohne dokumentierte Vollmacht. Vertragsbestätigung und Belehrung unten bleiben.
  const einkaufWas = art === "firma"
    ? "die Daten Ihres Unternehmens bei den Wirtschaftsauskunfteien und die persönliche Auskunft der Inhaberin bzw. des Inhabers oder der Geschäftsführung bei {{params.auskunfteien}}"
    : "Ihre Auskunft bei {{params.auskunfteien}}";
  // 25.09.2026 (E-241): Kein Satz mehr zur Vollmacht — die Kauftüren holen den Beschaffungsauftrag
  // selbst ein (Pflicht-Haken), und wo er fehlt, bittet die Beschaffung nach der Zahlung in einer
  // eigenen Mail um die Bestätigung (die Zahlungsbestätigung sagt das dann).
  const einkaufAbsatz = lieferwegAusNutzlast(p) === "einkauf"
    ? `Sobald Ihre Überweisung eingeht, beschaffen wir ${einkaufWas}${nachFrist ? ` — wie bei Ihrer Bestellung gewählt, erst nach Ablauf der Widerrufsfrist${ab ? `, ab dem ${ab}` : ""} —` : ""} `
      + `und melden uns, sobald ${art === "firma" ? "sie da sind" : "sie da ist"}.`
    : null;
  const absaetze = einkaufAbsatz
    ? [basis.absaetze[0], einkaufAbsatz, basis.absaetze[2]]
    : nachFrist
    ? [
        basis.absaetze[0],
        `Sobald Ihre Überweisung eingeht, bereiten wir Ihre Anfragen an {{params.auskunfteien}} vor, und Sie bekommen eine eigene E-Mail mit dem Link, über den Sie Vollmacht und Anfragen am Bildschirm unterschreiben. Wie bei Ihrer Bestellung gewählt, übermitteln wir die Anfragen erst nach Ablauf der Widerrufsfrist${ab ? `, ab dem ${ab}` : ""}.`,
        basis.absaetze[2],
      ]
    : art === "firma"
      ? [
          basis.absaetze[0],
          "Sobald Ihre Überweisung eingeht, fordern wir die Daten Ihres Unternehmens bei den Wirtschaftsauskunfteien an, dazu die persönliche Datenkopie der Inhaberin bzw. des Inhabers oder der Geschäftsführung bei {{params.auskunfteien}}. Dafür bekommen Sie eine eigene E-Mail mit dem Link, über den Sie Vollmacht und Anfragen am Bildschirm unterschreiben.",
          basis.absaetze[2],
        ]
      : basis.absaetze;

  const bestellung = [
    bestelltAm ? `<b>Bestellt am:</b> ${bestelltAm}` : null,
    String(p.antrag_id ?? "").trim() ? "<b>Bestellnummer:</b> {{params.antrag_id}}" : null,
  ].filter(Boolean).join(" · ");

  const bestaetigung: string[] = [
    "Hiermit bestätigen wir Ihren Auftrag — zum Nachlesen und Aufbewahren.",
    `<b>Leistung:</b> {{params.paket}}\n${leistung.map((z) => `· ${z}`).join("\n")}`,
    `<b>Preis:</b> {{params.betrag}} € — ${AUSKUNFT_PREIS_STEUER}. Zahlung per Überweisung mit dem Verwendungszweck oben.`,
    `<b>Laufzeit:</b> ${AUSKUNFT_LAUFZEIT}`,
    `<b>Leistungszeit:</b> ${auskunftLeistungszeit(art, nachFrist ? { ab } : null)}`,
    ...(bestellung ? [bestellung] : []),
    `<b>Anbieter:</b> ${AUSKUNFT_ANBIETER_ZEILE} · ${AUSKUNFT_KONTAKT_ZEILE}`,
    `<b>Vertragssprache:</b> ${AUSKUNFT_VERTRAGSSPRACHE}. Es gelten unsere AGB (<a href="https://fiaon.com/agb" style="color:#1d4ed8;">fiaon.com/agb</a>); wie wir Ihre Daten verarbeiten, steht in der Datenschutzerklärung (<a href="https://fiaon.com/datenschutz" style="color:#1d4ed8;">fiaon.com/datenschutz</a>).`,
  ];

  const w = AUSKUNFT_WIDERRUF;
  const beginn = art === "privat" ? auskunftBeginnSatz(wahl, ab) : null;
  const widerruf: string[] = art === "firma"
    ? [AUSKUNFT_KEIN_WIDERRUF]
    : [
        ...(beginn ? [`<b>Ihre Wahl bei der Bestellung:</b> ${beginn}`] : []),
        `<b>${w.titel}</b>\n${w.gilt}`,
        ...w.abschnitte.flatMap((a) => a.absaetze.map((x, i) => (i === 0 ? `<b>${a.h}</b>\n${x}` : x))),
        `<b>${w.erloeschen.h}</b>\n${w.erloeschen.text}`,
      ];

  const anhang: NonNullable<MailBaustein["anhang"]> = [
    { titel: "Ihre Vertragsbestätigung", absaetze: bestaetigung },
    { titel: "Ihr Widerrufsrecht", absaetze: widerruf },
    ...(art === "privat"
      ? [{ titel: w.formular.titel, absaetze: [w.formular.hinweis, w.formular.an, w.formular.zeilen.map((z) => `— ${z}`).join("\n"), w.formular.fuss] }]
      : []),
  ];

  return {
    ...basis,
    preheader: nachFrist ? "Ihre Zahlungsdaten, Ihre Vertragsbestätigung und Ihr Widerrufsrecht."
      : einkaufAbsatz ? "Sobald Ihre Überweisung da ist, beschaffen wir Ihre Auskunft." : basis.preheader,
    absaetze,
    anhang,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DER KUNDENPREIS-LINK (26.09.2026, E-243)
//
// Die Antwort auf „Kundenpreis-Link anfordern" (/bonitaet-antrag, Frage „Sind
// Sie schon FIAON-Kunde mit laufendem Paket?"). Der Kunde hat sie selbst
// angefordert — deshalb keine Werbung (kein Abmeldelink, kein
// Widerspruchs-Hinweis, in PFLICHTMAILS), und deshalb kurz und sachlich: Preis,
// Leistung, ein Knopf. Wer sie NICHT bekommt und warum: Kopf „DER
// KUNDENPREIS-LINK" in server/routes/fiaon-auskunft-kauf.ts
// (kundenpreisLinkAnfordern) — dort entstehen auch alle Sätze mit Land und Art:
//   · anrede        — anredeMail (nie „Guten Tag max,")
//   · was           — „Ihre Bonitätsauskunft" / „die Bonitätsauskunft Ihres Unternehmens"
//   · preis_text    — vom Server (auskunftPreis; bei offener Bestellung deren Betrag)
//   · auskunfteien  — je Land (AT/CH nie „SCHUFA")
//   · leistung_satz — privat oder Firma
//   · weg_satz, knopf_text, kauf_url — neue Bestellung (Kauflink → Bestätigungsseite
//     mit Beschaffungsauftrag) oder die Zahlungsseite einer schon offenen
//   · gueltig_tage  — KAUF_LINK_TAGE
// Wortwand: kein „statt 149 €" (PAngV § 11 — kein Streichpreis), keine Frist
// mit Zahl als Versprechen, keine Zusage über das Ergebnis, kein „Limit".
// ═══════════════════════════════════════════════════════════════════════════
export const AUSKUNFT_KUNDENPREIS_VORLAGEN: Record<"auskunft_kundenpreis", MailBaustein> = {
  auskunft_kundenpreis: {
    betreff: "Ihr Kundenpreis für die Bonitätsauskunft: {{params.preis_text}}",
    preheader: "Der Link, den Sie auf fiaon.com angefordert haben — Ihre Angaben sind schon eingetragen.",
    titel: "Ihr Link zum Kundenpreis",
    absaetze: [
      "{{params.anrede}} Sie haben auf fiaon.com den Link zu Ihrem Kundenpreis angefordert. Weil Ihr FIAON-Paket läuft, kostet Sie {{params.was}} <b>{{params.preis_text}}</b> — einmalig, kein Abo.",
      "{{params.leistung_satz}}",
      "{{params.weg_satz}}",
    ],
    daten: [
      { label: "Ihr Kundenpreis", wert: "{{params.preis_text}} einmalig" },
      { label: "Auskunft bei", wert: "{{params.auskunfteien}}" },
    ],
    knopf: { text: "{{params.knopf_text}}", url: "{{params.kauf_url}}" },
    fussnote: "Sie haben diesen Link selbst auf fiaon.com angefordert. Er gilt {{params.gueltig_tage}} Tage und ist persönlich für Sie — bitte nicht weitergeben. Waren Sie das nicht, ignorieren Sie diese E-Mail einfach: Ohne Ihren Klick wird nichts bestellt.",
  },
};
