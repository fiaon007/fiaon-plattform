// ═══════════════════════════════════════════════════════════════════════════
// /bonitaet-antrag — DIE BESTELLSEITE DER BONITÄTSAUSKUNFT: TEXTE
// (24.09.2026, E-240)
//
// ── WARUM EINE EIGENE DATEI ───────────────────────────────────────────────
// Auf dieser Seite schließt ein Mensch einen Vertrag. Jeder Satz über Anbieter,
// Preis, Widerruf, Vollmacht und Werbung steht hier EINMAL — die Seite zeigt
// ihn, und dieselbe Fassung reist mit der Bestellung zum Server
// (`zustimmungen.punkte[].text`). So ist im Streitfall belegt, was der Kunde
// gelesen und angekreuzt hat. Wer einen der Rechtssätze ändert, erhöht
// BESTELL_FASSUNG — sonst passt die gespeicherte Fassung nicht mehr zum Text.
//
// ── WAS NICHT HIER STEHT ──────────────────────────────────────────────────
// Preise, Leistung und Auskunfteien kommen aus shared/fiaon-auskunft.ts (eine
// Quelle für Seite, Mail, Mara und Kundenbereich). Die Widerrufsbelehrung ist
// das gesetzliche Muster — wörtlich, sonst geht die Musterwirkung verloren.
// Seit 25.09.2026 (E-240) steht sie mit Anbieter, Laufzeit, Leistungszeit und
// Preisangabe in shared/fiaon-auskunft-widerruf.ts: Dieselben Sätze gehen als
// Vertragsbestätigung mit der Zahlungsdaten-Mail hinaus (§ 312f Abs. 2, § 356
// Abs. 3 BGB). Anbieterdaten: shared/fiaon-firma.ts.
//
// ── WORTWAND (shared/fiaon-wortverbote.ts) ────────────────────────────────
// Keine Zusage, keine Löschzusage, kein „Score verbessern", keine Frist mit
// Zahl als FIAON-Versprechen, „anwaltlich geprüft" gibt es nicht. Die kostenlose
// Datenkopie steht in den Fragen — als ehrliche Antwort, nicht als Hauptweg.
// Österreich und Schweiz lesen nie „SCHUFA" (auskunfteienText je Land).
//
// Nur Deutsch: Eine englische Fassung braucht eine englische Belehrung und
// AGB-Fassung — erst nach Freigabe.
// ═══════════════════════════════════════════════════════════════════════════
import { FIAON_FIRMA } from "@shared/fiaon-firma";
import {
  AUSKUNFT_BESCHAFFUNGSAUFTRAG_TEXT, AUSKUNFT_KOSTENLOS_ANTWORT, AUSKUNFT_PREISE_CENTS, euroText, type AuskunftArt, type AuskunftLand,
} from "@shared/fiaon-auskunft";
import {
  AUSKUNFT_ANBIETER_ZEILE, AUSKUNFT_KEIN_WIDERRUF, AUSKUNFT_KONTAKT_ZEILE, AUSKUNFT_LAUFZEIT, AUSKUNFT_PREIS_STEUER,
  AUSKUNFT_VERTRAGSSPRACHE, AUSKUNFT_WIDERRUF, auskunftLeistungszeit,
} from "@shared/fiaon-auskunft-widerruf";

/**
 * Die Fassung der Rechtssätze dieser Seite — reist mit jeder Bestellung zum Server.
 * 2026-09-25 (E-240): Belehrung aus shared/fiaon-auskunft-widerruf.ts — Anbieter
 * wie im Impressum („Vereinigtes Königreich"), im Muster-Formular Anschrift und
 * E-Mail ohne Telefon (Anlage 2 zu Art. 246a EGBGB). Sonst wortgleich.
 * 2026-09-25b (E-241): Der Haken „Vollmacht zur Übermittlung" ist jetzt der
 * Beschaffungsauftrag (hakenAuftrag, Schlüssel „beschaffungsauftrag") — die
 * Vollmacht deckte nur die kostenlose Datenkopie, nicht den Kauf der Auskunft.
 */
export const BESTELL_FASSUNG = "2026-09-25b";

/** Der Knopf nach § 312j Abs. 3 BGB — wörtlich, ohne Zusatz. */
export const BESTELL_KNOPF = "Zahlungspflichtig bestellen";

/**
 * Wie FIAON die Umsatzsteuer ausweist — wortgleich aus den AGB § 5 Abs. 1
 * („… als Endpreise einschließlich einer etwaig anfallenden Umsatzsteuer").
 * Die Rechnung der Auskunft trägt keinen gesonderten Steuerausweis
 * (server/fiaon-invoice.ts, Modus „none") — der angezeigte Betrag ist der
 * Rechnungsbetrag, auch für Unternehmen. Seit 25.09.2026 aus der gemeinsamen
 * Quelle — die Vertragsbestätigung in der Zahlungsdaten-Mail sagt dasselbe.
 */
export const PREIS_STEUER = AUSKUNFT_PREIS_STEUER;

export const LANDNAMEN: Record<AuskunftLand, string> = { DE: "Deutschland", AT: "Österreich", CH: "Schweiz" };
export const VORWAHLEN: Record<AuskunftLand, string> = { DE: "+49", AT: "+43", CH: "+41" };

/** Rechtsformen je Land — Auswahl statt Freitext, damit die Anfrage an die Auskunftei stimmt. */
export const RECHTSFORMEN: Record<AuskunftLand, string[]> = {
  DE: ["Einzelunternehmen", "e.K.", "GbR", "UG (haftungsbeschränkt)", "GmbH", "GmbH & Co. KG", "KG", "OHG", "AG", "Freier Beruf", "Andere Rechtsform"],
  AT: ["Einzelunternehmen", "e.U.", "OG", "KG", "GmbH", "FlexCo", "AG", "Andere Rechtsform"],
  CH: ["Einzelunternehmen", "Kollektivgesellschaft", "GmbH", "AG", "Andere Rechtsform"],
};
export const REGISTER_BEISPIEL: Record<AuskunftLand, string> = {
  DE: "z. B. HRB 123456, Amtsgericht München",
  AT: "z. B. FN 123456a",
  CH: "z. B. CHE-123.456.789",
};

export const T = {
  pille: "Bonitätsauskunft · Einmalpreis, kein Abo",
  h1a: "Ihre Bonitätsauskunft.",
  h1b: " Angefordert, erklärt, mit Plan.",
  lead: "Wir fordern Ihre Datenkopien bei den großen Auskunfteien Ihres Landes an, erklären jeden Eintrag, prüfen die Speicherfristen und geben Ihnen einen Handlungsplan mit fertigen Schreiben.",
  fakten: ["Die großen Auskunfteien Ihres Landes", "Jede Zeile in klaren Worten", "Schreiben zur Freigabe"],

  // ── Schritt 1 ──
  s1: "Für wen bestellen Sie?",
  artPrivat: "Privatperson", artPrivatSub: "Ihre persönliche Auskunft",
  artFirma: "Unternehmen", artFirmaSub: "Auskunft über Ihre Firma",
  landTitel: "Land Ihres Wohnsitzes", landTitelFirma: "Sitz des Unternehmens",
  landSub: (bei: string) => `Anfrage bei ${bei}`,

  // ── Schritt 2 ──
  s2: "Ihre Angaben",
  s2Firma: "Unternehmen und Ansprechperson",
  s2Sub: "So, wie Sie bei den Auskunfteien gemeldet sind — damit sie Sie sicher zuordnen können.",
  s2SubFirma: "So, wie das Unternehmen im Register steht.",
  vorname: "Vorname", nachname: "Nachname",
  geburtsdatum: "Geburtsdatum", geburtsdatumPlatz: "TT.MM.JJJJ",
  geburtsdatumFirma: "Geburtsdatum der Ansprechperson (freiwillig)",
  geburtsdatumFirmaHinweis: "Nur, wenn die Ansprechperson Inhaberin, Inhaber oder Geschäftsführung ist — für die persönliche Datenkopie. Sie können es auch später nachreichen.",
  firma: "Firmenname", rechtsform: "Rechtsform", rechtsformWaehlen: "Bitte wählen",
  register: "Registernummer (freiwillig)",
  ansprechperson: "Ansprechperson",
  anschrift: "Aktuelle Anschrift", anschriftFirma: "Geschäftsanschrift",
  strasse: "Straße und Hausnummer", plz: "PLZ", ort: "Ort",

  // ── Schritt 3 ──
  s3: "So erreichen wir Sie",
  s3Sub: "An diese Adresse gehen Zahlungsdaten, Rechnung und Ihre Auswertung.",
  email: "E-Mail-Adresse", emailPlatz: { DE: "name@beispiel.de", AT: "name@beispiel.at", CH: "name@beispiel.ch" } as Record<AuskunftLand, string>,
  telefon: "Telefonnummer", telefonPlatz: { DE: "176 12345678", AT: "664 1234567", CH: "79 123 45 67" } as Record<AuskunftLand, string>,
  telefonHinweis: "Für Rückfragen Ihres Betreuers zur Auswertung.",

  // ── Schritt 4 ──
  s4: "Bestellung prüfen",
  s4Sub: "Bis zum Klick auf „Zahlungspflichtig bestellen“ können Sie jede Angabe oben noch ändern.",
  zfLeistung: "Leistung", zfPreis: "Preis", zfLaufzeit: "Laufzeit", zfZahlung: "Zahlung", zfZeit: "Leistungszeit",
  leistungName: (art: AuskunftArt, land: AuskunftLand, bei: string) =>
    `${art === "firma" ? "Bonitätsauskunft für Unternehmen" : "Bonitätsauskunft für Privatpersonen"} · ${LANDNAMEN[land]} — Anfrage bei ${bei}; jeder Eintrag erklärt, Speicherfristen geprüft, Handlungsplan und fertige Schreiben zur Freigabe.`,
  // Laufzeit, Leistungszeit, Anbieter, Kontakt und Vertragssprache: seit 25.09.2026 (E-240)
  // wortgleich aus shared/fiaon-auskunft-widerruf.ts — die Vertragsbestätigung der
  // Zahlungsdaten-Mail liest dieselben Sätze.
  laufzeit: AUSKUNFT_LAUFZEIT,
  zahlung: "Per Überweisung. Bankverbindung und Verwendungszweck sehen Sie direkt nach der Bestellung auf Ihrer Zahlungsseite; die Rechnung kommt per E-Mail.",
  // Gegenlesen 24.09.2026 (E-240): „Die Auskunfteien antworten innerhalb der Frist" war ein
  // Versprechen über Dritte — sie MÜSSEN es. Für Firmendaten (juristische Personen) gilt
  // Art. 15 DSGVO nicht; wann Creditreform & Co. liefern, liegt bei ihnen — keine Frist erfinden.
  leistungszeit: (art: AuskunftArt) => auskunftLeistungszeit(art),

  infoTitel: "Vorvertragliche Informationen",
  infoZeilen: [
    ["Anbieter", AUSKUNFT_ANBIETER_ZEILE],
    ["Kontakt", AUSKUNFT_KONTAKT_ZEILE],
    ["Bestellweg", "Angaben eintragen, Bestellung prüfen, „Zahlungspflichtig bestellen“ klicken — danach öffnet sich Ihre Zahlungsseite. Eingabefehler korrigieren Sie bis zum Klick direkt in den Feldern."],
    ["Vertragssprache", AUSKUNFT_VERTRAGSSPRACHE],
    // Gegenlesen 24.09.2026 (E-240): Nur, was heute wahr ist. POST /payment-order speichert
    // Leistung, Preis und Datum (fiaon_applications) — die Erklärungen (`zustimmungen`) noch
    // NICHT. Sobald der Server sie ablegt, darf hier „und Ihre Erklärungen" stehen (dann
    // BESTELL_FASSUNG erhöhen).
    // 25.09.2026 (E-240): Die Zahlungsdaten-Mail trägt jetzt die Vertragsbestätigung mit
    // Widerrufsbelehrung und Muster-Formular (auskunftZahlungsdatenBaustein) — das steht hier.
    ["Vertragstext", "Wir speichern Ihre Bestellung mit Leistung, Preis und Datum. AGB und Widerrufsbelehrung können Sie auf dieser Seite jederzeit abrufen und speichern; Zahlungsdaten, Rechnung und die Bestätigung Ihres Vertrags mit Widerrufsbelehrung erhalten Sie per E-Mail."],
  ] as [string, string][],
  agbA: "Es gelten unsere ", agbLink: "AGB", agbB: ". Wie wir Ihre Daten verarbeiten, steht in der ", dsLink: "Datenschutzerklärung", agbC: ".",

  // Belehrung, Erlöschen-Hinweis und Unternehmer-Satz: seit 25.09.2026 (E-240) aus
  // shared/fiaon-auskunft-widerruf.ts — dieselben Worte stehen in der Zahlungsdaten-Mail.
  widerrufTitel: "Widerrufsbelehrung und Muster-Widerrufsformular",
  widerrufGilt: AUSKUNFT_WIDERRUF.gilt,
  erloeschenTitel: AUSKUNFT_WIDERRUF.erloeschen.h,
  erloeschen: AUSKUNFT_WIDERRUF.erloeschen.text,
  widerrufAngezeigt: "Muster-Widerrufsbelehrung und Muster-Widerrufsformular (Anlage 1 und 2 zu Art. 246a § 1 EGBGB) angezeigt, dazu der Hinweis zum vorzeitigen Erlöschen (§ 356 Abs. 4 BGB).",
  firmaKeinWiderruf: AUSKUNFT_KEIN_WIDERRUF,

  // ── Die Häkchen: genau diese Sätze werden mit Zeitstempel gespeichert ──
  hakenBeginn: "Ich verlange ausdrücklich, dass FIAON vor Ablauf der Widerrufsfrist mit der Leistung beginnt. Mir ist bekannt, dass ich mein Widerrufsrecht bei vollständiger Vertragserfüllung verliere.",
  // 25.09.2026 (E-241): EIN Haken, der Beschaffungsauftrag — statt der „Vollmacht zur
  // Übermittlung" (bis Fassung 2026-09-25). Die schloss ausdrücklich aus, in meinem Namen
  // Erklärungen abzugeben; den Kauf der Auskunft (bis zur API kaufen wir sie selbst) deckte
  // sie nicht. Der Wortlaut steht in shared/fiaon-auskunft.ts — wortgleich an allen Kauftüren.
  // „Bei den oben genannten Auskunfteien": Die Zeile „Leistung" darüber nennt sie je Land.
  hakenAuftrag: (art: AuskunftArt) => AUSKUNFT_BESCHAFFUNGSAUFTRAG_TEXT(art),
  hakenUnternehmer: "Ich bestelle für das genannte Unternehmen zu gewerblichen Zwecken und bin berechtigt, es dabei zu vertreten.",
  uwg: `Wir nutzen Ihre E-Mail-Adresse auch, um Sie über eigene ähnliche Leistungen von FIAON zu informieren. Dem können Sie jederzeit widersprechen — über den Abmeldelink in jeder dieser E-Mails oder an ${FIAON_FIRMA.email} —, ohne dass dafür andere als die Übermittlungskosten nach den Basistarifen entstehen (§ 7 Abs. 3 UWG).`,

  // Die Zeile direkt über dem Knopf (§ 312j Abs. 2 BGB): Was, wie lange, was es kostet —
  // auch am Handy, wo die Bestellkarte weit oben steht.
  endzeile: (art: AuskunftArt, land: AuskunftLand) =>
    `${art === "firma" ? "Bonitätsauskunft für Unternehmen" : "Bonitätsauskunft für Privatpersonen"} · ${LANDNAMEN[land]} · einmalig, kein Abo`,
  knopfLaeuft: "Ihre Zahlungsseite wird geöffnet …",
  unterKnopf: "Nach dem Klick sehen Sie Ihre Zahlungsseite mit Bankverbindung und Verwendungszweck.",

  // ── Die Bestellkarte (Navy, die eine dunkle Stelle der Seite) ──
  karteTag: "Ihre Bonitätsauskunft",
  karteEinmal: "einmalig · kein Abo",
  kartePaket: (privat: string, firma: string) => `FIAON-Kunden mit Paket zahlen ${privat} (Unternehmen ${firma}).`,
  kartePaketLink: "Im Kundenbereich bestellen",
  karteKundenpreis: "Ihr Preis als FIAON-Kunde mit Paket",
  // Angemeldet, aber ohne laufendes, bezahltes Paket: Warum hier der Einzelpreis steht —
  // sonst sieht ein Kunde 149 €, obwohl sein Betreuer von 74 € sprach.
  karteKundeOhnePaket: (kundenpreis: string) => `Der Kundenpreis von ${kundenpreis} gilt, solange ein FIAON-Paket läuft und bezahlt ist. Für Ihr Konto gilt deshalb der Einzelpreis.`,
  karteKundePaketOffen: "Sobald die erste Rate Ihres Pakets eingegangen ist, bestellen Sie die Auskunft im Kundenbereich zum Kundenpreis.",
  karteBei: "Angefragt bei",
  karteFirmaBei: "Firmendaten u. a. bei",
  kartePersoenlichBei: "Persönliche Datenkopie bei",
  karteLeistung: "Das bekommen Sie",

  // ── Angemeldete Kunden ──
  kundeTitel: (name: string) => `Angemeldet als ${name}`,
  kundeText: "Wir bestellen die Auskunft mit den Angaben aus Ihrem Konto.",
  kundeAendern: "Angaben im Kundenbereich ändern",
  kundeAndere: "Für eine andere Person bestellen",
  kundeBezahlt: "Ihre Bonitätsauskunft ist bereits bezahlt — den Stand sehen Sie in Ihrem Kundenbereich.",
  kundeOffen: (betrag: string) => `Ihre Bonitätsauskunft ist schon bestellt. Die Zahlung${betrag ? ` über ${betrag}` : ""} ist noch offen — Sie brauchen keine zweite Bestellung.`,
  kundeOffenGemeldet: "Ihre Bonitätsauskunft ist bestellt, und Sie haben die Überweisung gemeldet. Sobald das Geld eingegangen ist, übermitteln wir Ihre Anfragen.",
  kundeZurZahlung: "Zur Zahlungsseite",
  kundeZumBereich: "Zum Kundenbereich",
  kundeDokument: "In Ihrer Akte liegt bereits eine Auskunft, die Sie selbst hochgeladen haben — wir werten sie aus.",
  kundeTrotzdem: "Trotzdem die Auskunft bestellen",
  // Der Bereich sieht schon eine Auskunft (alte Käufe über die E-Mail, Dokument an einer
  // Schwester-Zeile), die Kaufkarte bleibt dort zu — hier ebenso, nur mit bewusster Wahl.
  kundeVorhanden: "Zu Ihrem Konto ist bereits eine Bonitätsauskunft hinterlegt — den Stand sehen Sie in Ihrem Kundenbereich.",
  // E-213: gekündigt = keine neuen Leistungen (derselbe Satz wie PORTAL_GESPERRT_SATZ, server/lib/fiaon-kuendigung.ts).
  kundeGekuendigt: "Ihr Vertrag ist gekündigt. Neue Leistungen können darüber nicht mehr beauftragt werden — Ihre Unterlagen und offenen Rechnungen finden Sie weiterhin in Ihrem Bereich.",

  // ── Ablauf und Fragen ──
  ablaufTitel: "So geht es weiter",
  ablauf: [
    { t: "Zahlungsseite", x: "Direkt nach der Bestellung: Bankverbindung, Verwendungszweck und Betrag auf einen Blick." },
    { t: "Anfragen übermitteln", x: "Nach Zahlungseingang übermitteln wir Ihre Anfragen an die Auskunfteien Ihres Landes." },
    { t: "Auswertung", x: "Jeder Eintrag in klaren Worten erklärt, die Speicherfristen geprüft." },
    { t: "Handlungsplan", x: "Was Sie tun können, in welcher Reihenfolge — mit fertigen Schreiben, die Sie freigeben." },
  ],
  fragenTitel: "Häufige Fragen",
  fragen: [
    { f: "Wirkt sich die Anfrage auf meine Bonität aus?", a: "Die Anfrage auf Ihre eigene Datenkopie ist keine Kreditanfrage. Nach Angaben der Auskunfteien fließt sie nicht in Ihre Bewertung ein." },
    { f: "Wie lange dauert es?", a: "Wir übermitteln Ihre Anfragen, sobald Ihre Zahlung eingegangen ist. Die Auskunfteien müssen innerhalb der gesetzlichen Frist antworten, in der Regel innerhalb eines Monats. Sobald die Antworten vorliegen, erhalten Sie Auswertung, Handlungsplan und Schreiben." },
    { f: "Kann FIAON Einträge löschen lassen?", a: "Löschen kann nur die Auskunftei. Wir prüfen die Speicherfristen und bereiten die Schreiben vor — etwa zur Löschung nach Fristablauf oder zur Berichtigung falscher Daten. Sie geben jedes Schreiben frei; ob ein Eintrag gelöscht wird, entscheidet die Auskunftei." },
    { f: "Ich bin schon FIAON-Kunde. Was zahle ich?", a: `Mit einem laufenden Paket gilt der Kundenpreis: ${euroText(AUSKUNFT_PREISE_CENTS.privat.mitAbo)} (Unternehmen ${euroText(AUSKUNFT_PREISE_CENTS.firma.mitAbo)}). Einzeln kostet die Auskunft ${euroText(AUSKUNFT_PREISE_CENTS.privat.einzeln)} (Unternehmen ${euroText(AUSKUNFT_PREISE_CENTS.firma.einzeln)}). Melden Sie sich an und bestellen Sie über Ihren Kundenbereich — der Kundenpreis gilt dort von selbst.` },
    // Die kostenlose Datenkopie: ehrliche Antwort auf die Frage — nicht als erster Punkt, nicht als Hauptweg.
    { f: "Kann ich die Datenkopie nicht auch kostenlos selbst anfordern?", a: AUSKUNFT_KOSTENLOS_ANTWORT },
    { f: "Brauchen Sie weitere Unterlagen von mir?", a: "Zunächst nur die Angaben auf dieser Seite. Verlangt eine Auskunftei zusätzlich einen Identitätsnachweis, sagen wir Ihnen Bescheid." },
  ],

  // ── Fehler (Sie-Form, ein Satz, was zu tun ist) ──
  f: {
    vorname: "Bitte geben Sie Ihren Vornamen ein.",
    nachname: "Bitte geben Sie Ihren Nachnamen ein.",
    geburtsdatum: "Bitte geben Sie Ihr Geburtsdatum als TT.MM.JJJJ ein.",
    geburtsdatumAlter: "Die Auskunft können Sie ab 18 Jahren bestellen.",
    geburtsdatumFirma: "Bitte als TT.MM.JJJJ eingeben — oder das Feld leer lassen.",
    firma: "Bitte geben Sie den Firmennamen ein.",
    rechtsform: "Bitte wählen Sie die Rechtsform.",
    strasse: "Bitte geben Sie Straße und Hausnummer ein.",
    hausnummer: "Bitte ergänzen Sie die Hausnummer.",
    plz: (stellen: number) => `Bitte geben Sie eine ${stellen}-stellige Postleitzahl ein.`,
    ort: "Bitte geben Sie den Ort ein.",
    email: "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
    telefon: "Bitte geben Sie eine vollständige Telefonnummer ein.",
    telefonDach: "Bitte geben Sie eine Nummer aus Deutschland, Österreich oder der Schweiz ein.",
    haken: "Bitte bestätigen Sie die markierten Punkte.",
    oben: "Bitte prüfen Sie die markierten Angaben.",
    senden: `Die Bestellung ließ sich gerade nicht anlegen. Bitte versuchen Sie es in einem Moment noch einmal — oder schreiben Sie an ${FIAON_FIRMA.email}.`,
    bezahlt: "Für Sie ist bereits eine bezahlte Bonitätsauskunft hinterlegt — den Stand sehen Sie in Ihrem Kundenbereich.",
    // Antwort 409 {anmelden:true}: Zu der E-Mail gehört ein laufendes Paket (fiaon-antrag.ts,
    // POST /payment-order). Bewusst ohne „Sie sind FIAON-Kunde" — wer eine fremde Adresse
    // eintippt, soll daraus nicht lesen, wer bei uns Kunde ist.
    anmelden: "Mit dieser E-Mail-Adresse können wir die Bestellung hier nicht anlegen. Sind Sie bereits FIAON-Kunde, melden Sie sich bitte an und bestellen Sie in Ihrem Kundenbereich — dort gilt der Kundenpreis.",
    anmeldenLink: "Zur Anmeldung",
  },
};
