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
  schufa_requested: {
    betreff: "Ihre Auskunft: Jetzt fehlt nur noch Ihre Unterschrift",
    preheader: "Wir fordern Ihre Datenkopien an — dafür braucht es Ihre Unterschrift am Bildschirm.",
    titel: "Wir fordern Ihre Datenkopien an",
    absaetze: [
      "{{params.anrede}} danke für Ihren Auftrag. Wir fordern jetzt Ihre Datenkopien bei <b>{{params.auskunfteien}}</b> an.",
      "{{params.unterschrift_satz}}",
      "Erst mit Ihrer Unterschrift gehen die Anfragen hinaus. Die Auskunfteien schicken Ihre Datenkopie per Post an Ihre Anschrift — fotografieren Sie sie dann in Ihrem Bereich unter Vorgänge. Wir erklären Ihnen jeden Eintrag, prüfen die Speicherfristen und legen Ihnen Handlungsplan und fertige Schreiben zur Freigabe vor.",
    ],
    daten: [
      { label: "Anfragen an", wert: "{{params.auskunfteien}}" },
      { label: "Ihr nächster Schritt", wert: "Am Bildschirm unterschreiben" },
    ],
    knopf: { text: "Jetzt unterschreiben", url: "{{params.unterschrift_url}}" },
    knopf2: { text: "Zu meinen Vorgängen", url: "{{params.login_url}}" },
    fussnote: "Die Vollmacht erlaubt uns nur, Ihre unterschriebenen Anfragen zu übermitteln — widerrufen können Sie sie jederzeit in Ihrem Bereich. Ist der Link abgelaufen, finden Sie unter Vorgänge einen neuen.",
    karteZiel: true,
  },

  // Der Mitarbeiter trägt im Vorgang „Datenkopie eingegangen" ein (Ergebnis
  // bewilligt einer Anfrage auf Selbstauskunft). Eine Mail je Auskunftei; der
  // wahlweise Absatz nennt, wer noch aussteht.
  schufa_approved: {
    betreff: "Ihre Datenkopie von {{params.auskunftei}} ist da",
    preheader: "{{params.auskunftei}} hat geantwortet — jetzt beginnt die Auswertung.",
    titel: "Ihre Datenkopie ist eingegangen",
    absaetze: [
      "{{params.anrede}} Ihre Datenkopie von <b>{{params.auskunftei}}</b> ist eingegangen und liegt in Ihrer Akte.",
      "Jetzt beginnt die Auswertung: Wir erklären jeden Eintrag in klaren Worten, prüfen die Speicherfristen und legen Ihnen Ihren Handlungsplan vor — mit fertigen Schreiben, die Sie freigeben, bevor etwas hinausgeht.",
      "{{params.rest_satz}}",
    ],
    knopf: { text: "Zu meinen Vorgängen", url: "{{params.login_url}}" },
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
  const zweiter = art === "firma"
    ? "Als Nächstes fordern wir die Daten Ihres Unternehmens bei den Wirtschaftsauskunfteien an, dazu die persönliche Datenkopie der Inhaberin bzw. des Inhabers oder der Geschäftsführung bei {{params.auskunfteien}}. Damit wir das dürfen, braucht es Ihre Unterschrift unter der Vollmacht zur Übermittlung und unter Ihren Anfragen — den Weg dorthin schicken wir Ihnen in einer eigenen E-Mail."
    : wahl === "nicht_verlangt"
      ? `Als Nächstes bereiten wir Ihre Anfragen an {{params.auskunfteien}} vor; die Vollmacht zur Übermittlung unterschreiben Sie über den Link in einer eigenen E-Mail. Wie bei Ihrer Bestellung gewählt, übermitteln wir die Anfragen erst nach Ablauf der Widerrufsfrist${ab ? `, ab dem ${ab}` : ""}.`
      : basis.absaetze[1];
  return { ...basis, absaetze: [basis.absaetze[0], zweiter, ...basis.absaetze.slice(2)] };
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
  const absaetze = nachFrist
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
    preheader: nachFrist ? "Ihre Zahlungsdaten, Ihre Vertragsbestätigung und Ihr Widerrufsrecht." : basis.preheader,
    absaetze,
    anhang,
  };
}
