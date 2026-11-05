// ═══════════════════════════════════════════════════════════════════════════
// VORLAGEN: TERMINE (8 — E-401: dazu nicht_erreicht_zweimal; E-458: die drei Global-Gesprächs-Mails) — Absender „FIAON Welcome"
//
// Schreibregeln: siehe konto.ts. Zusätzlich hier:
// · Termin-Mails nennen Datum, Uhrzeit und Gesprächspartner im Datenkasten —
//   das ist, was der Kunde sucht, wenn er die Mail später wieder öffnet.
// · Der No-Show-Ton ist verständnisvoll, nie vorwurfsvoll: Wer sich schämt,
//   bucht nicht neu.
// · E-265 (29.09.2026, Justin „zum letzten Mal!!"): Der Platzhalter heißt
//   weiter {{params.agent_vorname}} (Make/Brevo lesen ihn), sein WERT ist die
//   Nennform — „Herr Stripling", ohne gepflegte Anrede der volle Name. Sätze
//   stehen deshalb im Nominativ („… ruft Sie an"), nie „mit {{…}}".
// ═══════════════════════════════════════════════════════════════════════════
import type { MailBaustein } from "../geruest";
import { FIAON_FIRMA } from "@shared/fiaon-firma";

// E-458 Nr. 11: die Unterschrift der Gesprächs-Mails (freigegebener Wortlaut, Abschnitt 6.1).
const GLOBAL_FUSSZEILE = `FIAON Global · FIAON LTD, London · Companies House ${FIAON_FIRMA.companyNo}`;
// E-476 Scheibe 4 (05.11.2026, Plan 4.6 „Firmenzeile statt Rollensatz“): der Fuß der Business-Gesprächsmails trägt die
// Pflichtangaben (Sitz und Register) statt „FIAON koordiniert … keine Kanzlei und keine Bank“ — kein Vorbehalt, eine Stimme.
const GLOBAL_PFLICHTZEILE = `${FIAON_FIRMA.name} · ${FIAON_FIRMA.strasse}, ${FIAON_FIRMA.ortZeile} · ${FIAON_FIRMA.register} Nr. ${FIAON_FIRMA.companyNo}`;
const GLOBAL_PFLICHTZEILE_EN = `${FIAON_FIRMA.name} · ${FIAON_FIRMA.strasse}, ${FIAON_FIRMA.ortZeile} · ${FIAON_FIRMA.register} No. ${FIAON_FIRMA.companyNo}`;
// E-476 Nachbesserung (Gutachten Sicherheit, Mangel 12): die stille Leitplanke zurück — ein kurzer Rollensatz OHNE das Wort
// „Bank“ (E-468 verbietet nur „die Bank entscheidet“, nicht die Klarheit über die Rollen; RDG/StBerG).
const GLOBAL_ROLLE = "FIAON koordiniert; Rechts- und Steuerberatung leisten Partnerkanzleien auf Ihr Mandat.";
const GLOBAL_ROLLE_EN = "FIAON coordinates; legal and tax matters are handled by partner lawyers and tax advisers under your own engagement.";
const GLOBAL_FUSS = `${GLOBAL_ROLLE} ${GLOBAL_PFLICHTZEILE}`;
const GLOBAL_FUSS_EN = `${GLOBAL_ROLLE_EN} ${GLOBAL_PFLICHTZEILE_EN}`;
// E-476 Nachbesserung (Gutachten Lead-Sicht, Mangel 17): Ein Lead hat keinen „Vorgang“ und keine „order“ — der Fuß sagt, worum es
// geht, und verweist auf fiaon.com (dort steht seit E-461 FIAON Global). Abschluss-Prüfung: „betrifft“ statt „bestätigt“ — derselbe
// Fuß steht auch unter der Absage und unter „nicht erreicht“ (wie die englische Fassung „relates to“).
const GLOBAL_AUTOMATISCH = "Diese Nachricht betrifft Ihr Gespräch mit FIAON Global.";
const GLOBAL_AUTOMATISCH_EN = "This message relates to your booked call.";

export const TERMIN_VORLAGEN: Record<string, MailBaustein> = {

  termin_bestaetigung: {
    betreff: "Ihr Termin steht: {{params.termin_datum}}, {{params.termin_uhrzeit}} Uhr",
    preheader: "Bestätigt. {{params.agent_vorname}} ruft Sie an — Sie müssen nichts tun.",
    titel: "Ihr Termin ist gebucht",
    absaetze: [
      "Guten Tag {{params.vorname}} {{params.nachname}}, Ihr Termin ist fest eingetragen — hier alles auf einen Blick:",
      "<b>{{params.agent_vorname}}</b> ruft Sie zur vereinbarten Zeit an. Sie brauchen nichts vorzubereiten — halten Sie einfach Ihr Telefon bereit. {{params.hinweis_anruf}}",
    ],
    daten: [
      { label: "Gespräch", wert: "{{params.termin_art}}" },
      { label: "Datum", wert: "{{params.termin_datum}}" },
      { label: "Uhrzeit", wert: "{{params.termin_uhrzeit}} Uhr" },
      { label: "Ihr Gesprächspartner", wert: "{{params.agent_vorname}}" },
    ],
    knopf: { text: "Termin verschieben oder absagen", url: "{{params.storno_link}}" },
    // E-263 (29.09.2026): „In Ihren Kalender: Apple / Outlook · Google Kalender" — weniger verpasste Termine.
    kalender: { ics: "{{params.kalender_url}}", google: "{{params.google_kalender_url}}" },
    fussnote: "{{params.hinweis_absage}}",
  },

  // ── E-188 (17.09.2026): DIE BESTÄTIGUNG FÜR DAS ERSTGESPRÄCH ZU FIAON GLOBAL ──
  // Eine eigene Vorlage und nicht `termin_bestaetigung`: Die spricht einen
  // Privatkunden an („Ihre Akte", Vor- und Nachname aus der Person). Hier liest
  // ein Unternehmen, das über ein Paket ab 2.499 € sprechen will — es sieht
  // Firma und Paketwunsch im Datenkasten und erfährt in einem Satz, worum es in
  // den 30 Minuten geht. Zwei Grenzen der Wortwahl stehen im Text selbst:
  // FIAON „bespricht" und „erklärt" (das Wort aus Justins Auftrag ist für
  // Kundentexte gesperrt), und — seit E-476 Scheibe 3 / E-468 — kein Satz
  // „das Institut entscheidet“ mehr. Der zweite Knopf trägt die Kalenderdatei — als LINK, weil die
  // Vorlagen-Mails des Hauses keine Anhänge tragen (mailDirektSenden).
  //
  // Querschnitt 17.09.2026: Kopf- und Rechtssatz der Global-Linie. Bis dahin trug
  // diese Mail den Privatkunden-Rahmen — „Bonität ist machbar." im Kopf und im Fuß
  // „… verspricht keine Löschung berechtigter Einträge": beides falsch gegenüber
  // einem Unternehmen, das über eine US-Gesellschaft sprechen will. Die englische
  // Fassung steht unten (GLOBAL_TERMIN_EN); der Motor nimmt sie, wenn die Nutzlast
  // `sprache: "en"` trägt (wer auf /en/business bucht).
  // E-476 Scheibe 4 (05.11.2026, Plan 4.6): Absender „FIAON Global“, Antworten an Justin (motor.ts); Firmenzeile statt
  // Rollensatz im Fuß; „Ihre Angaben liegen uns vor“ mit SEINEN Sätzen (ohne Betrag, ohne Klammer — wahlweise, nur mit
  // Formular-Antworten); Unternehmen und Paketwunsch nur, wenn es sie gibt (kein „Paketwunsch: noch offen“ mehr).
  global_termin: {
    bereich: "business", kopfSatz: "FIAON Global", rechtsSatz: GLOBAL_FUSS, automatischSatz: GLOBAL_AUTOMATISCH, fussStartseite: true,
    betreff: "Ihr Gespräch zu FIAON Global: {{params.termin_datum}}, {{params.termin_uhrzeit}} Uhr",
    preheader: "Bestätigt. {{params.agent_vorname}} ruft Sie an — Sie müssen nichts vorbereiten.",
    titel: "Ihr Gespräch ist eingetragen",
    absaetze: [
      "Guten Tag {{params.name}}, Ihr Erstgespräch zu FIAON Global ist fest eingetragen — hier alles auf einen Blick:",
      "<b>{{params.agent_vorname}}</b> ruft Sie zur vereinbarten Zeit unter {{params.telefon}} an. Das Gespräch dauert rund {{params.termin_dauer}} Minuten; Sie brauchen nichts vorzubereiten.",
      "{{params.angaben_satz}}",
      // E-476 Scheibe 3 (05.11.2026, E-468 „kein Bank-Satz in Mails“): Der Institut-Satz ist raus — dafür Justins eigene Worte.
      "Wir besprechen, wo Ihr Unternehmen heute steht, welches Paket dazu passt und was wir für Sie übernehmen — wir kümmern uns um alles bis zur Unterschrift bei der Bank.",
    ],
    daten: [
      { label: "Gespräch", wert: "{{params.termin_art}}" },
      { label: "Datum", wert: "{{params.termin_datum}}" },
      { label: "Uhrzeit", wert: "{{params.termin_uhrzeit}} Uhr (deutsche Zeit)" },
      { label: "Unternehmen", wert: "{{params.firma}}", wahlweise: true },
      { label: "Paketwunsch", wert: "{{params.paket}}", wahlweise: true },
      { label: "Ihr Gesprächspartner", wert: "{{params.agent_vorname}}" },
    ],
    knopf: { text: "In den Kalender eintragen", url: "{{params.kalender_url}}" },
    knopf2: { text: "Termin verschieben oder absagen", url: "{{params.storno_link}}" },
    // E-263: Google dazu — die Datei oben nimmt Apple und Outlook, Google braucht seinen eigenen Link.
    kalender: { google: "{{params.google_kalender_url}}" },
    fussnote: "Passt es doch nicht? Über „Termin verschieben oder absagen“ sagen Sie jederzeit ab und wählen auf fiaon.com eine neue Zeit.",
  },

  // ── E-458 Nr. 11 (29.10.2026): VOR UND NACH DEM GLOBAL-GESPRÄCH ───────────────────────────────────────────
  // Der Wortlaut ist von Justin freigegeben (29.10., „go Plan“; Quelle 06_Marketing/KUNDENGEWINNUNG_2026-10-28/
  // KI_SICHTBARKEIT_UND_CONVERSION.md, 6.1 und 6.2). Vorher bekam ein Unternehmen vor dem Erstgespräch die
  // Privat-Erinnerung (termin_erinnerung: „Guten Tag {Vorname}“, Privat-Rahmen) und nach einem verpassten
  // Gespräch nichts. Eine Abweichung mit Absicht: Der Link zum Verschieben bzw. zur neuen Zeit ist der Knopf
  // unter der Mail — die Vorlagen-Mails tragen keine nackten Adressen. Der Lauf steht in
  // server/lib/fiaon-global-gespraech.ts; {{params.betreuer_name}} ist der, der wirklich anruft.
  // E-476 Scheibe 4 (Plan: „Vortag-Mail spiegelt die Antworten und fragt nur, was fehlt“): Der Vorbereitungs-Absatz kommt aus
  // vorbereitungHtml (shared/fiaon-global-lead-texte.ts) — ohne Formular-Antworten ist er Wort für Wort der freigegebene.
  global_termin_erinnerung: {
    bereich: "business", kopfSatz: "FIAON Global", rechtsSatz: GLOBAL_FUSS, automatischSatz: GLOBAL_AUTOMATISCH, fussStartseite: true,
    betreff: "Morgen um {{params.termin_uhrzeit}} Uhr: Ihr Gespräch mit FIAON Global",
    preheader: "{{params.betreuer_name}} ruft Sie an — {{params.termin_dauer}} Minuten für Ihr Vorhaben in den USA.",
    titel: "Ihr Gespräch ist morgen",
    absaetze: [
      "{{params.anrede_zeile}},",
      "morgen, am {{params.termin_datum}}, um {{params.termin_uhrzeit}} Uhr (deutsche Zeit) ruft {{params.betreuer_name}} Sie unter {{params.telefon}} an. Wir nehmen uns {{params.termin_dauer}} Minuten Zeit für Ihr Vorhaben in den USA.",
      "{{params.vorbereitung_html}}",
      "Passt die Zeit nicht mehr? Mit dem Knopf unten verschieben Sie den Termin oder sagen ihn ab.\nStimmt die Nummer nicht? Antworten Sie einfach auf diese Mail.",
      `Freundliche Grüße\n{{params.betreuer_name}}\n${GLOBAL_FUSSZEILE}`,
    ],
    knopf: { text: "Termin verschieben oder absagen", url: "{{params.storno_link}}" },
  },

  // Kurz vor dem Gespräch (eine Stunde vorher) — derselbe Lauf, ohne Anhang.
  global_termin_kurz: {
    bereich: "business", kopfSatz: "FIAON Global", rechtsSatz: GLOBAL_FUSS, automatischSatz: GLOBAL_AUTOMATISCH, fussStartseite: true,
    betreff: "Um {{params.termin_uhrzeit}} Uhr rufen wir Sie an",
    preheader: "Ihr Gespräch mit FIAON Global — falls etwas dazwischenkommt, verschieben Sie mit einem Klick.",
    titel: "Gleich sprechen wir",
    absaetze: [
      "{{params.anrede_zeile}}, um {{params.termin_uhrzeit}} Uhr rufen wir Sie an.",
      "Falls etwas dazwischenkommt: Mit dem Knopf unten verschieben Sie den Termin oder sagen ihn ab.",
      "Freundliche Grüße, {{params.betreuer_vorname}}, FIAON Global",
    ],
    knopf: { text: "Termin verschieben oder absagen", url: "{{params.storno_link}}" },
  },

  // Nach einem verpassten Gespräch — genau einmal, wenn ein Mensch „nicht erreicht“ einträgt. Danach keine
  // weitere automatische Mail; die zuständige Person ruft an. {{params.wann_satz}} ist „heute um 10:30 Uhr“ —
  // oder das Datum, wenn das Ergebnis erst später eingetragen wird (dann stimmte „heute“ nicht mehr).
  // E-476 Scheibe 4: „Neue Zeit wählen“ führt bei einem Lead-Gespräch auf seinen persönlichen Link (fiaon-global-gespraech.ts).
  global_nicht_erreicht: {
    bereich: "business", kopfSatz: "FIAON Global", rechtsSatz: GLOBAL_FUSS, automatischSatz: GLOBAL_AUTOMATISCH, fussStartseite: true,
    betreff: "Wir haben Sie {{params.wann_kurz}} nicht erreicht",
    preheader: "Das kommt vor — wählen Sie in Ruhe eine neue Zeit oder antworten Sie mit einer Zeit, die Ihnen passt.",
    titel: "Wir haben Sie nicht erreicht",
    absaetze: [
      "{{params.anrede_zeile}},",
      "{{params.wann_satz}} haben wir Sie unter {{params.telefon}} leider nicht erreicht. Das kommt vor — kein Problem.",
      "Mit dem Knopf unten wählen Sie in Ruhe eine neue Zeit.\nLieber zurückgerufen werden? Antworten Sie kurz mit einer Zeit, die Ihnen passt.",
      "Freundliche Grüße\n{{params.betreuer_name}}, FIAON Global",
    ],
    knopf: { text: "Neue Zeit wählen", url: "{{params.link_kalender}}" },
  },

  // E-476 Nachbesserung (Gutachten Lead-Sicht, Mangel 3): Sagen WIR ein Global-Gespräch ab (Kalender, Chefbüro), bekam das
  // Unternehmen bisher die Privat-Vorlage („Bonität ist machbar“, „Ihre Akte“, SCHUFA-Fuß). Jetzt der Business-Rahmen
  // „FIAON Global“, Sie-Form, ohne „Akte“; der Knopf führt auf seinen persönlichen Link (Lead) bzw. Justins Seite (Startgespräch).
  global_termin_absage: {
    bereich: "business", kopfSatz: "FIAON Global", rechtsSatz: GLOBAL_FUSS, automatischSatz: GLOBAL_AUTOMATISCH, fussStartseite: true,
    betreff: "Ihr Gespräch am {{params.termin_datum}}: wir müssen es verschieben",
    preheader: "Das tut uns leid — wählen Sie in Ruhe eine neue Zeit.",
    titel: "Wir müssen Ihr Gespräch verschieben",
    absaetze: [
      "{{params.anrede_zeile}},",
      "leider muss ich unser Gespräch am <b>{{params.termin_datum}} um {{params.termin_uhrzeit}} Uhr</b> (deutsche Zeit) verschieben — das tut mir leid.",
      "Mit dem Knopf unten wählen Sie in Ruhe eine neue Zeit.\nLieber zurückgerufen werden? Antworten Sie kurz mit zwei, drei Zeiten, die Ihnen passen.",
      "Freundliche Grüße\n{{params.agent_name}}, FIAON Global",
    ],
    knopf: { text: "Neue Zeit wählen", url: "{{params.neu_buchen_link}}" },
    kalender: { ics: "{{params.kalender_url}}", entfernen: true },
  },

  termin_erinnerung: {
    betreff: "Morgen: Ihr Gespräch um {{params.termin_uhrzeit}} Uhr",
    preheader: "Kurze Erinnerung — {{params.agent_vorname}} ruft Sie an.",
    titel: "Ihr Gespräch steht bevor",
    absaetze: [
      // E-265 (29.09.2026): {{params.agent_vorname}} trägt jetzt die Nennform („Herr Stripling") — im Nominativ
      // gebaut, damit kein „mit Herr Stripling" entsteht.
      "Guten Tag {{params.vorname}}, nur eine kurze Erinnerung: Ihr Gespräch steht an, <b>{{params.agent_vorname}}</b> ruft Sie an — Sie müssen nichts weiter tun.",
      "Passt die Zeit doch nicht mehr? Verschieben ist völlig in Ordnung und dauert einen Klick — das ist uns lieber als ein verpasster Anruf. {{params.hinweis_anruf}}",
    ],
    daten: [
      { label: "Gespräch", wert: "{{params.termin_art}}" },
      { label: "Datum", wert: "{{params.termin_datum}}" },
      { label: "Uhrzeit", wert: "{{params.termin_uhrzeit}} Uhr" },
    ],
    knopf: { text: "Termin verschieben oder absagen", url: "{{params.storno_link}}" },
    // E-263 (29.09.2026): „In Ihren Kalender: Apple / Outlook · Google Kalender" — weniger verpasste Termine.
    kalender: { ics: "{{params.kalender_url}}", google: "{{params.google_kalender_url}}" },
    fussnote: "{{params.hinweis_absage}}",
  },

  termin_absage: {
    betreff: "Ihr Termin am {{params.termin_datum}} wurde abgesagt",
    preheader: "Der Termin entfällt — mit einem Klick wählen Sie einen neuen.",
    titel: "Ihr Termin wurde abgesagt",
    absaetze: [
      "Guten Tag {{params.vorname}} {{params.nachname}}, Ihr Termin ({{params.termin_art}}) am <b>{{params.termin_datum}} um {{params.termin_uhrzeit}} Uhr</b> wurde von unserer Seite abgesagt — das tut uns leid.",
      "Ihre Akte wartet deshalb nicht: Wählen Sie einfach direkt einen neuen Termin, der Ihnen passt — der Kalender zeigt Ihnen alle freien Zeiten.",
    ],
    knopf: { text: "Neuen Termin wählen", url: "{{params.neu_buchen_link}}" },
    // E-263, Gegenprüfung 29.09.2026: Wer den Termin aus Bestätigung oder Erinnerung in seinen Kalender
    // übernommen hat, nimmt ihn hier wieder heraus — dieselbe Datei liefert jetzt METHOD:CANCEL.
    kalender: { ics: "{{params.kalender_url}}", entfernen: true },
  },

  termin_verpasst: {
    betreff: "Wir haben Sie verpasst, {{params.vorname}}",
    preheader: "Kein Problem — suchen Sie sich einfach eine neue Zeit aus.",
    titel: "Wir haben uns verpasst",
    absaetze: [
      "Guten Tag {{params.vorname}}, {{params.agent_vorname}} hat versucht, Sie zu Ihrem Termin am <b>{{params.termin_datum}} um {{params.termin_uhrzeit}} Uhr</b> zu erreichen — leider ohne Erfolg.",
      "Das passiert, kein Grund zur Sorge. Wichtig ist nur: Das Gespräch bringt Ihre Akte wirklich voran, deshalb lohnt sich ein neuer Anlauf. Suchen Sie sich einfach die nächste Zeit aus, die sicher passt.",
    ],
    knopf: { text: "Neuen Termin wählen", url: "{{params.termin_link}}" },
    fussnote: "Der Kalender zeigt nur Zeiten, die wirklich frei sind — Sie können nichts falsch machen.",
  },

  // E-401 (5/6, 19.10.2026): Vorher „hat ZWEIMAL versucht“ / „Zwei Anrufe“ — ein Rest aus der Zeit, als diese Mail
  // nach dem 2. Versuch ging (SCHWELLE_MAIL = 2). Seit dem 19.08. geht sie ab dem SECHSTEN (und von Hand jederzeit);
  // nach dem zweiten schickt jetzt Mara „nicht_erreicht_zweimal“ (unten). Ohne Zählwort stimmt der Satz immer.
  nicht_erreicht_termin: {
    betreff: "Wir erreichen Sie nicht — wählen Sie Ihre Zeit selbst",
    preheader: "Bisher kein Glück am Telefon. Ein Klick, und der Termin gehört Ihnen.",
    titel: "Sagen Sie uns, wann es passt",
    absaetze: [
      "Guten Tag {{params.vorname}} {{params.nachname}}, {{params.agent_vorname}} hat versucht, Sie telefonisch zu erreichen — bisher ohne Glück.",
      "Machen wir es andersherum: Sie wählen die Zeit, wir rufen pünktlich an. Im Kalender sehen Sie alle freien Termine — ein Klick, und die Sache ist fest.",
    ],
    knopf: { text: "Meine Zeit auswählen", url: "{{params.termin_link}}" },
    fussnote: "Das Gespräch dauert etwa fünfzehn Minuten und bringt Ihre Akte den nächsten großen Schritt voran.",
    karteZiel: true,
  },

  // ── E-401 (5/6, 19.10.2026): MARA FASST NACH DEM ZWEITEN ANRUF SELBST NACH ──────────────────────────────
  // Justin: „Mach Mara … fertig, damit sie wirklich gut arbeitet und selbst arbeitet.“ Kurz und ohne Druck:
  // wir haben es zweimal versucht, hier wählen Sie Ihre Zeit. Der Knopf ist der persönliche Terminlink
  // (Slots des Betreuers, bei Abwesenheit des Vertreters). {{params.agent_vorname}} trägt die Nennform
  // („Herr Stripling“, E-265) und steht im Nominativ. BEWUSST ohne Karten-Block (karteZiel): Dessen Satz
  // trägt den Bank-Vorbehalt, und das hier ist eine Terminfrage, kein Verkauf (E-373).
  nicht_erreicht_zweimal: {
    betreff: "Wir haben Sie zweimal nicht erreicht — wann passt es Ihnen?",
    preheader: "Hier wählen Sie Ihre Zeit — ein Klick, und wir rufen genau dann an.",
    titel: "Wann passt es Ihnen?",
    absaetze: [
      "Guten Tag {{params.vorname}} {{params.nachname}}, wir haben zweimal versucht, Sie anzurufen, und Sie leider nicht erreicht.",
      "Hier wählen Sie Ihre Zeit selbst: Im Kalender sehen Sie alle freien Termine. Ein Klick genügt, und <b>{{params.agent_vorname}}</b> ruft Sie genau dann an.",
    ],
    knopf: { text: "Meine Zeit wählen", url: "{{params.termin_link}}" },
    fussnote: "Das Gespräch dauert etwa fünfzehn Minuten — danach wissen Sie genau, wie es für Sie weitergeht.",
  },

  onboarding_einladung: {
    betreff: "Ihr Startgespräch, {{params.vorname}} — wählen Sie Ihre Zeit",
    preheader: "15 Minuten, die Ihre Akte in Bewegung setzen. Jetzt Termin wählen.",
    titel: "Zeit für Ihr Startgespräch",
    absaetze: [
      "Guten Tag {{params.vorname}}, Ihr Bereich ist offen, Ihre Akte liegt bereit — jetzt fehlt nur noch das Startgespräch: fünfzehn Minuten mit Ihrem persönlichen Ansprechpartner.",
      // 25.09.2026 (E-240): vorher „… was in Ihrer Auskunft steht" — als läge sie mit dem Paket schon
      // vor. Die Auskunft ist ein Zusatzprodukt; im Startgespräch wird sie besprochen, WENN sie da ist.
      "Darin gehen wir gemeinsam durch, wo Sie stehen, welche Unterlagen noch fehlen und was die nächsten Schritte sind — liegt Ihre Bonitätsauskunft schon vor, auch jeden Eintrag darin. Danach wissen Sie genau, woran Sie sind — und wir legen los.",
    ],
    knopf: { text: "Startgespräch buchen", url: "{{params.termin_link}}" },
    fussnote: "Der Kalender zeigt alle freien Zeiten. Wir rufen Sie zur gewählten Zeit an.",
    karteZiel: true,
  },
};

// ── E-188, Querschnitt: die englische Bestätigung des Erstgesprächs ──────────
// Gleicher Aufbau, gleiche Platzhalter, gleiche Knöpfe wie `global_termin` oben —
// britisches Englisch, dieselben Grenzen (das Institut entscheidet; FIAON
// „discusses" und „explains"). scripts/pruef-global-querschnitt.ts vergleicht das Paar.
// Die Seite hinter „Reschedule or cancel" und die Kalenderdatei sind noch deutsch.
export const GLOBAL_TERMIN_EN: Record<string, MailBaustein> = {
  global_termin: {
    sprache: "en", bereich: "business", kopfSatz: "FIAON Global", rechtsSatz: GLOBAL_FUSS_EN, automatischSatz: GLOBAL_AUTOMATISCH_EN, fussStartseite: true,
    betreff: "Your call about FIAON Global: {{params.termin_datum}}, {{params.termin_uhrzeit}}",
    preheader: "Confirmed. {{params.agent_vorname}} will call you — there is nothing to prepare.",
    titel: "Your call is booked",
    absaetze: [
      "Dear {{params.name}}, your first call about FIAON Global is firmly booked — here is everything at a glance:",
      "<b>{{params.agent_vorname}}</b> will call you at the agreed time on {{params.telefon}}. The call takes around {{params.termin_dauer}} minutes; there is nothing you need to prepare.",
      "{{params.angaben_satz}}",
      // E-476 Scheibe 3 (E-468): the institution sentence is gone — Justin's own words instead. Scheibe 4: „right through to“
      // instead of „up to“ (the English wall reads „up to“ as a peak-value promise — pruef-global-querschnitt).
      "We discuss where your company stands today, which package fits and what we take on for you — we take care of everything right through to the signature at the bank.",
    ],
    daten: [
      { label: "Call", wert: "{{params.termin_art}}" },
      { label: "Date", wert: "{{params.termin_datum}}" },
      { label: "Time", wert: "{{params.termin_uhrzeit}} (German time)" },
      { label: "Company", wert: "{{params.firma}}", wahlweise: true },
      { label: "Package of interest", wert: "{{params.paket}}", wahlweise: true },
      { label: "Your contact", wert: "{{params.agent_vorname}}" },
    ],
    knopf: { text: "Add to calendar", url: "{{params.kalender_url}}" },
    knopf2: { text: "Reschedule or cancel", url: "{{params.storno_link}}" },
    kalender: { google: "{{params.google_kalender_url}}" },
    fussnote: "Does the time no longer suit you? Use “Reschedule or cancel” at any time and choose a new slot at fiaon.com/en.",
  },

  // E-458 Nr. 11: die drei Gesprächs-Mails auf Englisch — wer auf /en/business gebucht hat. Gleiche Platzhalter und
  // Knöpfe wie oben, britisches Englisch.
  global_termin_erinnerung: {
    sprache: "en", bereich: "business", kopfSatz: "FIAON Global", rechtsSatz: GLOBAL_FUSS_EN, automatischSatz: GLOBAL_AUTOMATISCH_EN, fussStartseite: true,
    betreff: "Tomorrow at {{params.termin_uhrzeit}}: your call with FIAON Global",
    preheader: "{{params.betreuer_name}} will call you — {{params.termin_dauer}} minutes for your plans in the US.",
    titel: "Your call is tomorrow",
    absaetze: [
      "{{params.anrede_zeile}},",
      "Tomorrow, {{params.termin_datum}}, at {{params.termin_uhrzeit}} (German time), {{params.betreuer_name}} will call you on {{params.telefon}}. We are setting aside {{params.termin_dauer}} minutes for your plans in the US.",
      "{{params.vorbereitung_html}}",
      "Does the time no longer suit you? Use the button below to reschedule or cancel.\nIs the number wrong? Simply reply to this email.",
      `Kind regards\n{{params.betreuer_name}}\n${GLOBAL_FUSSZEILE}`,
    ],
    knopf: { text: "Reschedule or cancel", url: "{{params.storno_link}}" },
  },
  global_termin_kurz: {
    sprache: "en", bereich: "business", kopfSatz: "FIAON Global", rechtsSatz: GLOBAL_FUSS_EN, automatischSatz: GLOBAL_AUTOMATISCH_EN, fussStartseite: true,
    betreff: "We will call you at {{params.termin_uhrzeit}} (German time)",
    preheader: "Your call with FIAON Global — if something comes up, reschedule with one click.",
    titel: "We will speak shortly",
    absaetze: [
      "{{params.anrede_zeile}}, we will call you at {{params.termin_uhrzeit}} (German time).",
      "If something comes up, use the button below to reschedule or cancel.",
      "Kind regards, {{params.betreuer_vorname}}, FIAON Global",
    ],
    knopf: { text: "Reschedule or cancel", url: "{{params.storno_link}}" },
  },
  global_nicht_erreicht: {
    sprache: "en", bereich: "business", kopfSatz: "FIAON Global", rechtsSatz: GLOBAL_FUSS_EN, automatischSatz: GLOBAL_AUTOMATISCH_EN, fussStartseite: true,
    betreff: "We could not reach you {{params.wann_kurz}}",
    preheader: "That happens — choose a new time at your convenience or reply with a time that suits you.",
    titel: "We could not reach you",
    absaetze: [
      "{{params.anrede_zeile}},",
      "We were unfortunately unable to reach you {{params.wann_satz}} on {{params.telefon}}. That happens — no problem at all.",
      "Use the button below to choose a new time at your convenience.\nWould you rather we called you back? Simply reply with a time that suits you.",
      "Kind regards\n{{params.betreuer_name}}, FIAON Global",
    ],
    knopf: { text: "Choose a new time", url: "{{params.link_kalender}}" },
  },
  global_termin_absage: {
    sprache: "en", bereich: "business", kopfSatz: "FIAON Global", rechtsSatz: GLOBAL_FUSS_EN, automatischSatz: GLOBAL_AUTOMATISCH_EN, fussStartseite: true,
    betreff: "Your call on {{params.termin_datum}}: we need to reschedule",
    preheader: "We are sorry — choose a new time at your convenience.",
    titel: "We need to reschedule your call",
    absaetze: [
      "{{params.anrede_zeile}},",
      "Unfortunately I have to reschedule our call on <b>{{params.termin_datum}} at {{params.termin_uhrzeit}}</b> (German time) — I am sorry about that.",
      "Use the button below to choose a new time at your convenience.\nWould you rather be called back? Simply reply with two or three times that suit you.",
      "Kind regards\n{{params.agent_name}}, FIAON Global",
    ],
    knopf: { text: "Choose a new time", url: "{{params.neu_buchen_link}}" },
    kalender: { ics: "{{params.kalender_url}}", entfernen: true },
  },
};
