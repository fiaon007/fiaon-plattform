// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — das Wörterbuch der Startseite, des Gesprächs, des Fußes (17.09.2026, E-188)
//
// Sie-Form, ruhig. Was das eine Produkt enthält und was es kostet, steht NICHT hier, sondern in
// shared/fiaon-global-verkauf.ts (Startseite, Honorarrechner) — die Seite liest beides.
//
// ── UMBAU 13.11.2026 (E-510, Sprachleitfaden FIAON Global) ─────────────────
// Justin (12.11.2026): „auf JEDER Seite muss das Wording geändert werden … keine Magie, sondern knallharte Fakten —
// präsentiere uns wie eine Kanzlei, wie internationale Unternehmensberater.“
//   · Die festen Sätze (S1 bis S17, Namen der Handlungen, Schluss-Satz, Kurzwörter der Schritte) kommen aus
//     shared/fiaon-global-saetze.ts — hier wird keiner von ihnen getippt.
//   · Die neun Fragen der Startseite stehen wie im Leitfaden (8.5): erst Leistung, Honorar, Zusage, „wenn die Finanzierung
//     ausbleibt“, dann „für wen es nicht passt“, Karten, Recht und Steuern, achtzehnter Monat, Reise.
//   · Weg sind: die Tipp-Zeile der Bühne, die Wörter der vier Pakete, der Stern „Ein Ansprechpartner statt acht“, der Bogen
//     nach Miami als Abschnitt der Startseite, die Vertrauensleiste (jetzt das Vertrauens-Band aus den festen Sätzen),
//     jedes „Team vor Ort“, „Kartenleiter“, „Etappe“, „Festpreis“, „Paket“.
//   · Kopf der Seite /business/privatpersonen (Titel, Beschreibung, H1, Einleitung) kommt jetzt direkt aus dem
//     Registereintrag (shared/fiaon-global-seiten/privat.ts) — eine Quelle statt zwei, die wortgleich sein mussten.
//
// Die Grenzen der Wortwahl: keine Zusage zu Konto, Karte oder Finanzierung — darüber entscheidet das jeweilige Institut;
// kein Bankname; keine Frist mit Ziffer; kein getippter Betrag; FIAON ist keine Kanzlei — Recht und Steuern liegen bei
// Partner-Anwälten und US-Steuerberatern (CPA) aus dem Partnernetz, die in eigener Verantwortung arbeiten.
// Jeder Satz passiert scripts/pruef-global-leitfaden.ts (deutsch und englisch), dazu scripts/pruef-wortwand-de.ts,
// scripts/seo-wortverbote-en.ts und scripts/pruef-global-en.ts.
//
// FAQ-Antworten bleiben reine Zeichenketten in "…" — scripts/seo-fragen-erzeugen.ts liest nur diese Form ins FAQ-Markup.
// Ausnahme: die Antwort auf die Honorar-Frage. Sie nennt Beträge, und kein Betrag wird getippt (Leitfaden 0.5) — sie setzt
// die Beträge aus der Preisquelle ein und steht deshalb sichtbar auf der Seite, aber (noch) nicht im FAQ-Markup.
// ═══════════════════════════════════════════════════════════════════════════

// E-481 (Mara Business): der WhatsApp-Satz im Gesprächs-Formular — wortgleich mit dem Server (globalWaHinweisGezeigt).
import { GLOBAL_WA_HINWEIS } from "@shared/fiaon-whatsapp-erlaubnis";
// E-510: die festen Sätze und Namen — eine Quelle für jede öffentliche Seite.
import { SAETZE_BETRAEGE, handlung, kurzwoerter, satz, weitererSatz } from "@shared/fiaon-global-saetze";
import { GLOBAL_KAPITAL_FREI } from "@shared/fiaon-global";

/** Ein Knoten im Stern (components/site/global/SternZentrale.tsx — steht seit E-510 nicht mehr auf der Startseite). */
export interface GlobalSternKnoten { name: string; umfang?: string; status: "fest" | "antrag"; inkl?: number }

const B = SAETZE_BETRAEGE;
/** Der Schluss-Satz der Startseite in zwei Hälften (für die zweifarbige Überschrift) — geteilt, nicht neu getippt. */
const schlussTeile = (sprache: "de" | "en", vor: string): [string, string] => {
  const s = weitererSatz("SCHLUSS", sprache);
  const i = s.indexOf(vor);
  return i > 0 ? [s.slice(0, i), s.slice(i)] : [s, ""];
};

const de = {
  // Titel und Beschreibung der Startseite stehen in VERKAUF_TEXTE.seo (shared/fiaon-global-verkauf.ts). Hier stehen sie
  // wortgleich (scripts/pruef-verkaufsmotor.ts und scripts/pruef-global-seiten.ts gleichen ab).
  metaTitel: "US-Gesellschaft (LLC) gründen mit Betreuung — FIAON Global",
  metaBeschreibung: "Unternehmensberatung für Ihre US-Gesellschaft: LLC-Gründung, EIN und ITIN, US-Büro, vorbereitete Anträge. Ihr Honorar sehen Sie vorab und vollständig.",

  knopfGespraech: handlung("gespraech", "de"),
  szeneKi: "Szene mit KI erstellt",


  // ── Wörter der früheren Tafeln (components/site/global/GlobalTafel.tsx — seit E-509 auf keiner Seite mehr eingebaut).
  //    Sie bleiben, weil der Baustein sie nennt; ihr Wortlaut folgt dem Leitfaden, falls er je wieder gezeigt wird.
  fokusBand: "Alle sechs Schritte",
  festpreis: "Honorar mit Ihrem Auftrag",
  inklusive: "Im ersten Jahr enthalten: acht Bereiche",
  planung: "Kapitalrahmen",
  planungZusatz: "Ihr Ziel — über die Finanzierung entscheidet das finanzierende Institut",
  beauftragen: (name: string) => `${name}: ${handlung("angebot", "de")}`,
  beauftragenKurz: handlung("angebot", "de"),
  vipGespraech: (name: string) => `Gespräch zu ${name} vereinbaren`,
  vipGespraechKurz: handlung("gespraech", "de"),
  direktBeauftragen: handlung("angebot", "de"),
  erstSprechen: handlung("gespraech", "de"),
  etappenBis: (bis: string) => `Schritte I–${bis}`,
  festpreisKurz: "Honorar",
  einmaligInklusive: "Mit Ihrem Auftrag — im ersten Jahr enthalten: acht Bereiche",
  alleLeistungen: (n: number) => `Alle ${n} Leistungen`,
  wenigerLeistungen: "Weniger anzeigen",
  vipZeichen: "Miami",
  vipTicket: {
    titel: "Ihr Termin in Miami",
    abflug: "Von", abflugOrte: "Ihrem Wohnsitz",
    ziel: "Nach", zielOrt: "Miami, Florida",
    enthalten: "Termin", enthaltenText: "nach Absprache",
    fuer: "Für", fuerText: "1 Person",
  },

  // ── Startseite: Überschriften der Abschnitte, die nicht aus VERKAUF_TEXTE kommen ──
  wissenTitel: "Was Sie vor dem Mandat wissen müssen",
  // Nicht mehr auf der Startseite (der Stern ist seit E-510 weg); scripts/pruef-global-seiten.ts liest das Feld noch.
  vsH2: "Ein Mandat, ein Ansprechpartner.",
  fuerKurz: "Für wen:",
  fuerChips: [
    { text: "Mittelstand", pfad: "/business/tochtergesellschaft-usa" },
    { text: "Onlinehandel", pfad: "/business/onlinehandel" },
    { text: "Agenturen und Software", pfad: "/business/agenturen-software" },
    { text: "Bau und Immobilien", pfad: "/business/bau-immobilien" },
    { text: "Privatpersonen", pfad: "/business/privatpersonen" },
  ] as { text: string; pfad?: string }[],

  // ── Erstgespräch ──
  gespraechAuge: "Erstgespräch",
  gespraechH2: "Ihr Erstgespräch.",
  gespraechLead: "Vorhaben, Wohnsitz, Ziel — in dreißig Minuten, kostenfrei und ohne Verpflichtung.",

  // ── Fragen (Leitfaden 8.5) ──
  fragenAuge: "Fragen",
  fragenH2: "Fragen zur Gründung Ihrer US-Gesellschaft.",
  fragenAlle: "Alle Fragen und Antworten zur US-Gesellschaft",
  fragenAlleZahl: (n: number) => `Alle ${n} Fragen`,
  // Neun Fragen in der Reihenfolge des Leitfadens (7.8). Die Startseite zeigt die ersten fünf, die übrigen hinter „Alle Fragen“.
  // Reine Zeichenketten: scripts/seo-fragen-erzeugen.ts liest sie als Text ins FAQ-Markup. Die festen Sätze darin (S6, S10, S11,
  // der Miami-Satz, „für wen es nicht passt“) vergleicht scripts/pruef-verkaufsmotor.ts mit shared/fiaon-global-saetze.ts.
  fragen: [
    { f: "Was übernimmt FIAON Global — und was tue ich selbst?", a: "Wir gründen Ihre US-Gesellschaft, holen jede Unterlage ein, beantragen die Steuernummern und bereiten Ihre Anträge für Konten, Karten und Finanzierung vollständig vor. Sie wählen den Namen, laden Ihren Reisepass hoch, unterzeichnen die Unterlagen und stellen die Anträge bei den Instituten selbst. Über Eintragung und Steuernummern entscheiden Bundesstaat und US-Steuerbehörde, über Konto, Karte und Finanzierung das jeweilige Institut." },
    // Die Beträge kommen aus der Preisquelle (kein Betrag wird getippt) — deshalb keine reine Zeichenkette.
    { f: "Was kostet das Mandat — und wann zahle ich was?", a: `Mit Ihrem Auftrag zahlen Sie ${B.de.honorarAuftrag} für die Gründung und die aktive Betreuung im ersten Jahr. Mit der Eintragung Ihrer Gesellschaft wird das Erfolgshonorar fällig; es richtet sich nach Ihrem Kapitalrahmen und beträgt mindestens ${B.de.erfolgMin}. Ab dem zweiten Jahr können Sie die Jahresbetreuung für ${B.de.jahresbetreuung} im Jahr beauftragen. Alle Beträge sind Endpreise und stehen in Ihrem Angebot, bevor Sie unterzeichnen.` },
    { f: "Sagt FIAON eine Finanzierung zu?", a: "Nein. Über jede Finanzierung entscheidet allein das finanzierende Institut. FIAON vergibt und vermittelt keine Kredite; wir bereiten die Anträge vollständig vor und begleiten Ihre Gesellschaft bis zur Entscheidung. Der Kapitalrahmen, den Sie wählen, ist ein Ziel, kein Versprechen. Was FIAON für Ihre Finanzierung einbringt, steht verbindlich in Ihrem persönlichen Angebot." },
    { f: "Was gilt, wenn die Finanzierung ausbleibt?", a: "Dann greift die Geld-zurück-Garantie. Kommt die Auszahlung nicht binnen acht Wochen ab Ihrem Auftrag, erstatten wir Ihnen alles, was Sie an uns gezahlt haben — binnen vierzehn Tagen nach Fristende. Ihre Gesellschaft bleibt Ihnen. Die Bedingungen stehen in Ziffer 4 Ihres Vertrags; für Konto und Karten gilt sie nicht. Über die Finanzierung selbst entscheidet das finanzierende Institut." },
    { f: "Für wen passt das Mandat nicht?", a: "Für Vorhaben ohne tatsächliche Geschäftstätigkeit und für alle, die keine Gesellschaft mit laufenden Pflichten führen wollen. Sind Sie unsicher, vereinbaren Sie ein Gespräch — wir sagen es Ihnen auch dann, wenn die Antwort ein Nein ist." },
    { f: "Kosten Kreditkarten zusätzlich?", a: "Bei FIAON nicht. Auf Wunsch bereiten wir Ihre Kreditkartenanträge vor — privat und für Ihre Gesellschaft, ohne zusätzliches Honorar von FIAON. Über jede Karte und ihren Rahmen entscheidet der Herausgeber; seine Gebühren und Zinsen legt er selbst fest, und Sie tragen sie. Firmenkreditkarten setzen in der Regel die persönliche Haftung des Inhabers voraus." },
    { f: "Wer klärt Rechts- und Steuerfragen?", a: "Partner-Anwälte und US-Steuerberater (CPA) aus unserem Partnernetz — in eigener Verantwortung. Deren Honorar für die Leistungen, die Ihr Vertrag nennt, trägt FIAON. FIAON selbst ist keine Kanzlei. Eine US-Gesellschaft ist kein Steuermodell; Ihre Steuerpflicht im Wohnsitzland bleibt bestehen." },
    { f: "Was geschieht ab dem achtzehnten Monat?", a: "Ab dem achtzehnten Monat prüfen wir mit Ihnen, ob eine Umschuldung die Finanzierungskosten senken oder eine Aufstockung Ihren Spielraum für Investitionen erweitern kann. Voraussetzung ist die laufende Jahresbetreuung; sie verlängert sich nicht von selbst. Den Antrag stellt Ihre Gesellschaft. Ob und zu welchen Bedingungen, entscheidet das jeweilige Institut." },
    { f: "Muss ich in die USA reisen?", a: "Für die Gründung und die Steuernummer Ihrer Gesellschaft nicht. Ob ein Institut für Konto, Karte oder Finanzierung Ihre Anwesenheit verlangt, entscheidet das Institut. Ab 1 Mio. US-Dollar begleiten wir Sie persönlich in Miami." },
    // 19.09.2026 (Justin, „Ändere das ÜBERALL“): wortgleich mit GLOBAL_KAPITAL_FREI.de — scripts/pruef-global-seiten.ts prüft das.
    { f: GLOBAL_KAPITAL_FREI.de.frage, a: GLOBAL_KAPITAL_FREI.de.antwort },
  ],

  // ── Schlussband: der Schluss-Satz (Leitfaden 7.1), geteilt für die zweifarbige Überschrift ──
  schlussA: schlussTeile("de", "bevor")[0],
  schlussB: schlussTeile("de", "bevor")[1],
  // Nur auf den Unterseiten (global-seite.tsx); die Startseite zeigt im Schlussband keinen Absatz.
  schlussText: "Fordern Sie Ihr Angebot an oder vereinbaren Sie ein Gespräch. Erstgespräch: dreißig Minuten, kostenfrei.",
  // Die Österreich-Seite kennt nur das Gespräch (Leitfaden 5.12).
  schlussTextAT: "Vereinbaren Sie ein Gespräch. Erstgespräch: dreißig Minuten, kostenfrei.",

  // ── Klebeleiste am Handy (Unterseiten) ──
  leisteGespraech: "Erstgespräch",

  // ── Uhren (Mini-Uhren in „Drei Orte“ im Fuß der nicht öffentlichen Seiten) — Zonen prüft scripts/pruef-global-seiten.ts ──
  uhren: [
    { zone: "Europe/Berlin", ort: "Deutschland", zusatz: "auch Österreich und die Schweiz" },
    { zone: "America/New_York", ort: "Florida", zusatz: "Miami · unsere Partner in den USA" },
    { zone: "Europe/London", ort: "London", zusatz: "FIAON LTD · Vertragspartner" },
  ],
  // ── Nachrichtenlage: seit 06.10.2026 auf /business/wissen (global-seite.tsx, Übersicht) ──
  presseAuge: "Nachrichtenlage",
  presseH2: "Die Lage in den USA. Mit Datum und Quelle.",
  presseStand: (datum: string) => `Stand ${datum}`,
  presseZurQuelle: "Zur Meldung",
  presseHinweis: "Meldungen Dritter mit Datum und Quelle. Sie beschreiben die allgemeine Lage in den USA — über Konto, Karte und Rahmen entscheidet allein das jeweilige Institut.",
  presseLaufband: "Weitere Schlagzeilen",
  pressePause: "Laufband anhalten",
  presseWeiter: "Laufband fortsetzen",

  // ── /business/privatpersonen: dieselbe Seite, eigene Augenzeile und eigene Verweise (E-196). Titel, Beschreibung, H1 und
  //    Einleitung kommen aus dem Registereintrag (shared/fiaon-global-seiten/privat.ts) — business.tsx liest sie dort. ──
  privat: {
    auge: "FIAON Global · Für Privatpersonen und Gründer",
    // Gründer und Selbständige haben keine eigene Unterseite — die Verweise ordnen ein, „Als Unternehmen“ führt zurück.
    fuerChips: [
      { text: "Gründer" },
      { text: "Selbständige" },
      { text: "Onlinehandel", pfad: "/business/onlinehandel" },
      { text: "Als Unternehmen", pfad: "/" },
    ] as { text: string; pfad?: string }[],
  },
};

const en: typeof de = {
  metaTitel: "US LLC formation with ongoing administration — FIAON Global",
  metaBeschreibung: "Business consultancy for your US company: LLC formation, EIN and ITIN, US office and prepared applications. Your fees are set out in full before you sign.",

  knopfGespraech: handlung("gespraech", "en"),
  szeneKi: "Scene created with AI",


  fokusBand: "All six steps",
  festpreis: "Fee on engagement",
  inklusive: "Included in the first year: eight areas",
  planung: "Funding target",
  planungZusatz: "Your goal — all financing decisions rest with the lender",
  beauftragen: (name: string) => `${name}: ${handlung("angebot", "en")}`,
  beauftragenKurz: handlung("angebot", "en"),
  vipGespraech: (name: string) => `Arrange a call about ${name}`,
  vipGespraechKurz: handlung("gespraech", "en"),
  direktBeauftragen: handlung("angebot", "en"),
  erstSprechen: handlung("gespraech", "en"),
  etappenBis: (bis: string) => `Steps I–${bis}`,
  festpreisKurz: "Fee",
  einmaligInklusive: "On engagement — included in the first year: eight areas",
  alleLeistungen: (n: number) => `All ${n} services`,
  wenigerLeistungen: "Show less",
  vipZeichen: "Miami",
  vipTicket: {
    titel: "Your appointment in Miami",
    abflug: "From", abflugOrte: "Your country of residence",
    ziel: "To", zielOrt: "Miami, Florida",
    enthalten: "Appointment", enthaltenText: "by arrangement",
    fuer: "For", fuerText: "1 person",
  },

  wissenTitel: "What you need to know before you instruct us",
  vsH2: "One engagement, one dedicated contact.",
  fuerKurz: "For:",
  fuerChips: [
    { text: "SMEs", pfad: "/en/business/us-subsidiary" },
    { text: "E-commerce", pfad: "/en/business/e-commerce" },
    { text: "Agencies and software", pfad: "/en/business/agencies-software" },
    { text: "Construction and property", pfad: "/en/business/construction-property" },
    { text: "Private individuals", pfad: "/en/business/private-individuals" },
  ],

  gespraechAuge: "Initial call",
  gespraechH2: "Your initial call.",
  gespraechLead: "Your plans, your country of residence, your goal — thirty minutes, free of charge and without obligation.",

  fragenAuge: "Questions",
  fragenH2: "Questions about forming your US company.",
  fragenAlle: "All questions and answers about a US company",
  fragenAlleZahl: (n: number) => `All ${n} questions`,
  // Nine questions in the order of the style guide (8.5) — the same questions as the German list.
  fragen: [
    { f: "What does FIAON Global do — and what do I do myself?", a: "We form your US company, assemble every document, apply for its tax identification numbers and prepare your applications for accounts, cards and financing in full. You choose the name, upload your passport, sign the documents and submit the applications to the institutions yourself. The state and the US tax authority decide on registration and the numbers; the institution concerned decides on accounts, cards and financing." },
    // The amounts come from the fee source (no amount is typed) — which is why this answer is not a plain string.
    { f: "What does the engagement cost — and when is each fee due?", a: `On engagement you pay ${B.en.honorarAuftrag} for formation and administration in the first year. The success fee falls due on registration of your company; it is set by your funding target and is at least ${B.en.erfolgMin}. From the second year you may continue with annual administration for ${B.en.jahresbetreuung} a year. All fees are stated in full in your proposal before you sign.` },
    { f: "Does FIAON promise financing?", a: "No. Every financing decision rests with the lender alone. FIAON does not lend and does not broker loans; we prepare the applications in full and support your company through to the decision. The funding target you choose is a goal, not a promise. What FIAON contributes to your financing is set out in your personal proposal and forms part of your agreement." },
    { f: "What applies if the financing does not arrive?", a: "The money-back commitment then applies. If the financing has not been disbursed within eight weeks of your engagement, we refund everything you have paid to us — within fourteen days of the end of that period. Your company remains yours. The conditions are set out in clause 4 of your agreement; the commitment does not extend to accounts and cards. The financing decision itself rests with the lender." },
    { f: "Who is the engagement not suited to?", a: "Ventures without genuine business activity, and anyone who does not wish to run a company with ongoing obligations. If you are unsure, arrange a call — we tell you so even where the answer is no." },
    { f: "Do credit cards cost extra?", a: "Not with FIAON. On request we prepare your personal and business credit card applications, at no additional fee from FIAON. Each card issuer decides on the card and its limit and sets its own charges and interest, which you bear. Business credit cards generally require a personal guarantee from the owner." },
    { f: "Who deals with legal and tax matters?", a: "Partner lawyers and US certified public accountants (CPAs) from our partner network — in their own professional capacity. FIAON bears their fees for the services named in your agreement. FIAON itself is not a law firm. A US company is not a tax scheme; your tax liability in your country of residence remains." },
    { f: "What happens from the eighteenth month?", a: "From the eighteenth month, we review with you whether refinancing could reduce your financing costs or an increase could widen your scope for investment. This requires annual administration to be in place; it does not renew automatically. Your company submits the application. Whether, and on what terms, is for the lender concerned to decide." },
    { f: "Do I have to travel to the United States?", a: "Not for the formation or your company’s tax identification number. Whether an institution requires you to attend in person for an account, a card or financing is for that institution to decide. From US$1 million, we work with you in person in Miami." },
    // 19 September 2026 (Justin): word for word GLOBAL_KAPITAL_FREI.en — checked by scripts/pruef-global-seiten.ts.
    { f: GLOBAL_KAPITAL_FREI.en.frage, a: GLOBAL_KAPITAL_FREI.en.antwort },
  ],

  schlussA: schlussTeile("en", "before")[0],
  schlussB: schlussTeile("en", "before")[1],
  schlussText: "Request your proposal or arrange a call. Initial call: thirty minutes, free of charge.",
  schlussTextAT: "Arrange a call. Initial call: thirty minutes, free of charge.",

  leisteGespraech: "Initial call",

  uhren: [
    { zone: "Europe/Berlin", ort: "Germany", zusatz: "also Austria and Switzerland" },
    { zone: "America/New_York", ort: "Florida", zusatz: "Miami · our partners in the United States" },
    { zone: "Europe/London", ort: "London", zusatz: "FIAON LTD · contracting party" },
  ],
  presseAuge: "The news",
  presseH2: "The situation in the US. With date and source.",
  presseStand: (datum: string) => `As at ${datum}`,
  presseZurQuelle: "Read the report",
  presseHinweis: "Third-party reports with date and source. They describe the general situation in the United States — the institution alone decides on the account, the card and the limit.",
  presseLaufband: "More headlines",
  pressePause: "Pause the ticker",
  presseWeiter: "Resume the ticker",
  privat: {
    auge: "FIAON Global · For private individuals and founders",
    fuerChips: [
      { text: "Founders" },
      { text: "Self-employed" },
      { text: "E-commerce", pfad: "/en/business/e-commerce" },
      { text: "As a company", pfad: "/en" },
    ],
  },
};

export const GLOBAL_WOERTER = { de, en };


// ── Das Gespräch (Kalender auf der Startseite, #gespraech) ─────────────────
const gespraechDe = {
  punkte: [
    "Ihr Vorhaben, Ihr Wohnsitz, Ihr Ziel — in dreißig Minuten geordnet.",
    "Welcher Bundesstaat zu Ihrer Lage passt.",
    "Was Ihr Honorar umfasst und was wir nicht zusagen.",
    "Ohne Verpflichtung — Sie entscheiden danach in Ruhe.",
  ],
  mitWemZusatz: "Dreißig Minuten am Telefon — wir rufen Sie zur gewählten Zeit an.",
  direkt: "Lieber direkt anrufen?",
  laedt: "Freie Zeiten werden geladen …",
  tagWaehlen: "Tag wählen",
  zeitWaehlen: "Uhrzeit wählen",
  zeitzone: "Alle Zeiten in deutscher Zeit (Berlin).",
  gewaehlt: (tag: string, zeit: string) => `Ihr Gespräch: ${tag}, ${zeit} Uhr`,
  name: "Ihr Name",
  firma: "Unternehmen (falls vorhanden)",
  email: "E-Mail",
  telefon: "Telefon (mit Ländervorwahl)",
  thema: "Worum geht es? (optional)",
  wunschzeit: "Wann erreichen wir Sie am besten?",
  buchen: (wann: string) => `Gespräch am ${wann} Uhr vereinbaren`,
  anfragen: "Rückruf anfragen",
  sendet: "Wird gesendet …",
  rueckfallTitel: "Wir rufen Sie zurück",
  rueckfallText: "Im Moment sind online keine freien Zeiten hinterlegt. Hinterlassen Sie Ihre Angaben — Ihr Ansprechpartner meldet sich und stimmt einen Termin mit Ihnen ab.",
  zurueckKalender: "Zurück zu den freien Zeiten",
  vergeben: "Diese Zeit wurde gerade vergeben. Bitte wählen Sie eine andere.",
  fehler: "Die Übertragung ist nicht gelungen. Bitte prüfen Sie Ihre Angaben und senden Sie sie erneut.",
  pflicht: "Bitte füllen Sie Name, E-Mail und Telefon aus.",
  fertigTitel: "Ihr Gespräch ist vereinbart.",
  fertigText: (wann: string, wer: string) => `${wann} Uhr${wer ? " mit " + wer : ""}. Die Bestätigung ist unterwegs an Ihre E-Mail-Adresse — mit allem, was Sie für das Gespräch brauchen.`,
  anfrageTitel: "Wir haben Ihre Anfrage erhalten.",
  anfrageText: "Ihr Ansprechpartner meldet sich bei Ihnen und stimmt einen Termin ab.",
  paketGewaehlt: (name: string) => `Ihr Anliegen: ${name}`,
  datenschutz: "Ihre Angaben verwenden wir nur für dieses Gespräch. Einzelheiten stehen in der Datenschutzerklärung.",
  // 06.10.2026 (E-293): Visitenkarte statt Punkteliste, Kalender in zwei Schritten (erst Tag und Uhrzeit, dann die Angaben).
  karteTitel: "Ihr Ansprechpartner",
  // E-309 (08.10.2026): Visitenkarte mit Porträt — der Satz nennt die Person beim Namen.
  mitPerson: (vorname: string) => `Dreißig Minuten am Telefon — ${vorname} ruft Sie zur gewählten Zeit persönlich an.`,
  mailAn: (name: string) => `E-Mail an ${name}`,
  anrufen: (name: string) => `${name} anrufen`,
  zurueck: "Zurück",
  rueckrufStatt: "Rückruf statt Termin",
  // E-476 Scheibe 3 (05.11.2026): der persönliche Terminlink — Name, Firma, Mail und Telefon sind schon ausgefüllt.
  persoenlich: "Ihre Angaben sind bereits ausgefüllt — wählen Sie Tag und Uhrzeit.",
  persoenlichPruefen: "Ihre Angaben sind bereits ausgefüllt — bitte sehen Sie sie kurz durch.",
  persoenlichLaedt: "Ihre Angaben werden geladen …",
  // E-481 (Mara Business): Der Klient wählt selbst, wie er das Gespräch führt — Telefon (Kalender), E-Mail oder WhatsApp mit Mara.
  wegeTitel: "Lieber schriftlich?",
  wegMail: "Per E-Mail",
  wegWhatsapp: "Auf WhatsApp mit Mara, der digitalen Assistentin",
  wegMailFertig: (email: string) => `Sehr gern — Justin Schwarzott schreibt Ihnen persönlich${email ? ` an ${email}` : ""}.`,
  wegMailOhne: "Sehr gern — antworten Sie auf unsere E-Mail; Justin Schwarzott schreibt Ihnen persönlich.",
  waHinweis: GLOBAL_WA_HINWEIS.de as string,
};

const gespraechEn: typeof gespraechDe = {
  punkte: [
    "Your plans, your country of residence, your goal — put in order in thirty minutes.",
    "Which state suits your situation.",
    "What your fees cover and what we do not promise.",
    "No obligation — you decide afterwards, in your own time.",
  ],
  mitWemZusatz: "Thirty minutes by telephone — we call you at the time you choose.",
  direkt: "Prefer to call us directly?",
  laedt: "Loading available times …",
  tagWaehlen: "Choose a day",
  zeitWaehlen: "Choose a time",
  zeitzone: "All times are German time (Berlin).",
  gewaehlt: (tag: string, zeit: string) => `Your call: ${tag}, ${zeit}`,
  name: "Your name",
  firma: "Company (if any)",
  email: "Email",
  telefon: "Telephone (with country code)",
  thema: "What is it about? (optional)",
  wunschzeit: "When is the best time to reach you?",
  buchen: (wann: string) => `Arrange the call for ${wann}`,
  anfragen: "Request a call back",
  sendet: "Sending …",
  rueckfallTitel: "We will call you back",
  rueckfallText: "There are currently no available times online. Leave your details — your contact will get in touch and agree a time with you.",
  zurueckKalender: "Back to the available times",
  vergeben: "This time has just been taken. Please choose another one.",
  fehler: "The transmission did not succeed. Please check your details and send them again.",
  pflicht: "Please enter your name, email address and telephone number.",
  fertigTitel: "Your call is arranged.",
  fertigText: (wann: string, wer: string) => `${wann}${wer ? " with " + wer : ""}. The confirmation is on its way to your email address — with everything you need for the call.`,
  anfrageTitel: "We have received your enquiry.",
  anfrageText: "Your contact will get in touch and agree a time with you.",
  paketGewaehlt: (name: string) => `Your enquiry: ${name}`,
  datenschutz: "We use your details only for this call. The privacy policy sets out the particulars.",
  karteTitel: "Your contact",
  mitPerson: (vorname: string) => `Thirty minutes by telephone — ${vorname} calls you personally at the time you choose.`,
  mailAn: (name: string) => `Email ${name}`,
  anrufen: (name: string) => `Call ${name}`,
  zurueck: "Back",
  rueckrufStatt: "Call me back instead",
  persoenlich: "Your details are already filled in — choose a day and a time.",
  persoenlichPruefen: "Your details are already filled in — please look through them briefly.",
  persoenlichLaedt: "Loading your details …",
  wegeTitel: "Prefer to write?",
  wegMail: "By email",
  wegWhatsapp: "On WhatsApp with Mara, the digital assistant",
  wegMailFertig: (email: string) => `Of course — Justin Schwarzott will write to you personally${email ? ` at ${email}` : ""}.`,
  wegMailOhne: "Of course — reply to our email and Justin Schwarzott will write to you personally.",
  waHinweis: GLOBAL_WA_HINWEIS.en,
};

export const GLOBAL_GESPRAECH_WOERTER = { de: gespraechDe, en: gespraechEn };

// ═══════════════════════════════════════════════════════════════════════════
// DER FUSS DER GLOBAL-SEITEN (GlobalFuss.tsx) — 06.10.2026 (E-293), nachgezogen 13.11.2026 (E-510)
// Die Wortwand liest kein JSX — deshalb stehen die Wörter des Fußes hier. Der Rollen-Satz (keineBank) ist der feste Satz S8,
// wortgleich auf jeder öffentlichen Seite; für die Österreich-Seite steht daneben S8-AT (keineBankAT).
// Die Namen der beiden Handlungen sind die der Seite: „Angebot anfordern“ und „Gespräch vereinbaren“.
// ═══════════════════════════════════════════════════════════════════════════
const fussDe = {
  label: "FIAON Global — Fußzeile",
  satz: "Ihre US-Gesellschaft, gegründet und betreut in einem Mandat. Ihr Honorar steht fest, bevor Sie unterzeichnen.",
  gespraech: handlung("gespraech", "de"),
  beauftragen: handlung("angebot", "de"),
  auftrag: "Mein Mandat",
  themen: "Themen",
  standorte: "Standorte",
  rechtlich: "Rechtliches",
  orte: { london: "Vertragspartner", zuerich: "Verbundene Gesellschaft", miami: "Partner in den USA" },
  // „Drei Orte“ (nur noch im Fuß der nicht öffentlichen Seiten): wo Sie sind und die drei Gesellschaften.
  orteSie: "Sie",
  orteSieZusatz: "Ihr Wohnsitz",
  recht: [
    { pfad: "/impressum", text: "Impressum" },
    { pfad: "/datenschutz", text: "Datenschutz" },
    { pfad: "/cookie-einstellungen", text: "Cookie-Einstellungen" },
    { pfad: "/business/widerrufsbelehrung", text: "Widerrufsbelehrung" },
    { pfad: "/business/mustervertrag", text: "Vertrag im Überblick" },
    { pfad: "/ist-fiaon-serioes", text: "Ist FIAON seriös?" },
  ],
  registriert: "Eingetragen in England und Wales",
  keineBank: satz("S8", "de"),
  keineBankAT: satz("S8", "de", "AT"),
  einwilligung: "Einwilligung ändern",
};

const fussEn: typeof fussDe = {
  label: "FIAON Global — footer",
  satz: "Your US company, formed and administered under one engagement. Your fees are set out in full before you sign.",
  gespraech: handlung("gespraech", "en"),
  beauftragen: handlung("angebot", "en"),
  auftrag: "My engagement",
  themen: "Topics",
  standorte: "Locations",
  rechtlich: "Legal",
  orte: { london: "Contracting party", zuerich: "Connected company", miami: "Partners in the United States" },
  orteSie: "You",
  orteSieZusatz: "Your country of residence",
  recht: [
    { pfad: "/impressum", text: "Legal notice" },
    { pfad: "/datenschutz", text: "Privacy policy" },
    { pfad: "/cookie-einstellungen", text: "Cookie settings" },
    { pfad: "/en/business/widerrufsbelehrung", text: "Withdrawal instructions" },
    { pfad: "/en/business/mustervertrag", text: "Agreement at a glance" },
    { pfad: "/en/is-fiaon-legit", text: "Is FIAON legit?" },
  ],
  registriert: "Registered in England and Wales",
  keineBank: satz("S8", "en"),
  keineBankAT: satz("S8", "en", "AT"),
  einwilligung: "Change consent",
};

export const GLOBAL_FUSS_WOERTER = { de: fussDe, en: fussEn };


// ── Der Vorführraum (E-313, 08.10.2026): Filme im iPhone und das Konzept als PDF. Seit E-509 steht er nicht auf der
//    Startseite (Filme und Mappe zeigen noch die vier Pakete); die Wörter folgen trotzdem dem Leitfaden. ─────────────
const filmDe = {
  auge: "FIAON Global im Film",
  h2: "Der blaue Faden.",
  h2Kursiv: "Der Ablauf in 83 Sekunden.",
  lead: "Von der Entscheidung bis zum Kapitalrahmen — einmal durcherzählt, mit Ton am schönsten. Und das ganze Konzept zum Mitnehmen.",
  // Ab zwei Filmen (lib/global-filme.ts) — der Vorführraum wählt selbst.
  h2Zwei: "Der Ablauf im Bild.",
  h2KursivZwei: "In zwei kurzen Filmen.",
  leadZwei: "„Die Entscheidung“ erzählt den Ablauf mit einem Darsteller, „Der blaue Faden“ als Linie durch alle Schritte — von der Entscheidung bis zum Kapitalrahmen. Mit Ton am schönsten. Und das ganze Konzept zum Mitnehmen.",
  filmZeileZwei: (dauern: string[]) => `${dauern.length} Filme · ${dauern.join(" und ")} · Deutsch · mit KI erstellt`,
  ansehen: "Film ansehen",
  mitTon: "Mit Ton ansehen",
  filmZeile: (dauer: string) => `${dauer} · Deutsch · Bilder mit KI erstellt`,
  untertitelAn: "Untertitel an",
  untertitelAus: "Untertitel aus",
  filmLabel: (titel: string, dauer: string) => `Film „${titel}“ ansehen, ${dauer} Minuten, mit Ton`,
  // Kino
  kinoLabel: (titel: string) => `Film „${titel}“`,
  schliessen: "Schließen",
  abspielen: "Abspielen",
  anhalten: "Anhalten",
  tonAn: "Ton an",
  tonAus: "Ton aus",
  vollbild: "Vollbild",
  stelle: "Stelle im Film",
  // Mappe
  mappeAuge: "Das Konzept · Oktober 2026",
  mappeTitel: "Das Konzept auf 22 Folien.",
  mappeText: "Leistung, Ablauf, Honorar — und was wir nicht zusagen. Zum Weitergeben an Ihren Steuerberater oder Mitgesellschafter.",
  laden: "PDF herunterladen",
  ladenZeile: (folien: number, mb: string) => `${folien} Folien · PDF · ${mb} MB`,
  imBrowser: "Im Browser ansehen",
  mappeBild: "Drei Folien aus dem Konzept: Titel, Leistung und Ablauf",
};
const filmEn: typeof filmDe = {
  auge: "FIAON Global on film",
  h2: "The blue thread.",
  h2Kursiv: "The process in 83 seconds.",
  lead: "From the decision to the funding target — told once, best with sound. And the whole concept to keep.",
  h2Zwei: "The process on film.",
  h2KursivZwei: "In two short films.",
  leadZwei: "“The decision” tells the process with an actor, “The blue thread” as a line through each step — from the decision to the funding target. In German, best with sound. And the whole concept to keep.",
  filmZeileZwei: (dauern: string[]) => `${dauern.length} films · ${dauern.join(" and ")} · in German · created with AI`,
  ansehen: "Watch the film",
  mitTon: "Watch with sound",
  filmZeile: (dauer: string) => `${dauer} · in German · images created with AI`,
  untertitelAn: "Subtitles on (German)",
  untertitelAus: "Subtitles off",
  filmLabel: (titel: string, dauer: string) => `Watch the film “${titel}”, ${dauer} minutes, with sound`,
  kinoLabel: (titel: string) => `Film “${titel}”`,
  schliessen: "Close",
  abspielen: "Play",
  anhalten: "Pause",
  tonAn: "Sound on",
  tonAus: "Sound off",
  vollbild: "Full screen",
  stelle: "Position in the film",
  mappeAuge: "The concept · October 2026",
  mappeTitel: "The concept on 22 slides.",
  mappeText: "Services, process, fees — and what we do not promise. To pass on to your tax adviser or co-shareholders.",
  laden: "Download PDF",
  ladenZeile: (folien: number, mb: string) => `${folien} slides · PDF · ${mb} MB · in German`,
  imBrowser: "View in browser",
  mappeBild: "Three slides from the concept: title, services and process",
};

export const GLOBAL_FILM_WOERTER = { de: filmDe, en: filmEn };

// ── Die Bühne (09.10.2026): Beispielansicht „Ihr Mandat“ (HeroAuftrag.tsx) und die Karte „Der Bogen“ (GlobalBogen.tsx) ──
// Beide Bausteine stehen seit E-510 nicht mehr auf der Startseite (eine dunkle Fläche je Seite — der Honorarrechner; keine
// Abschnitte nach ihm, die erst überzeugen sollen). Ihre Wörter bleiben, weil die Bausteine sie nennen, und folgen dem Leitfaden:
// die Kurzwörter der vier Plätze kommen aus den festen Sätzen (Gründung · Konten · Finanzierung · Umschuldung).
const buehneDe = {
  beispiel: "Beispielansicht",
  kapitalAuge: "Ihr Kapitalrahmen",
  kapitalBetrag: "250.000 $",
  kapitalZeile: "Von Ihnen gewählt · über die Finanzierung entscheidet das finanzierende Institut",
  akteAuge: "Ihre US-Gesellschaft",
  akteName: "Muster Ventures LLC",
  akteOrt: "Florida · mit aktiver Betreuung",
  schritte: [
    { titel: "Gesellschaft angemeldet", zeile: "Florida · Articles of Organization", marke: "Erledigt" },
    { titel: "EIN erteilt", zeile: "Steuernummer der IRS", marke: "Erledigt" },
    { titel: "ITIN beantragt", zeile: "Es entscheidet die US-Steuerbehörde", marke: "Läuft" },
    { titel: "Geschäftskonto", zeile: "Antrag vorbereitet", marke: "Als Nächstes" },
    { titel: "Kreditkarten auf Wunsch", zeile: "Antrag vorbereitet", marke: "Danach" },
  ],
  person: "Ihr Ansprechpartner",
  weiterBlick: "Weiter zum Überblick",
  mail: "E-Mail",
  telefon: "Anrufen",
  meldungTitel: "Neu in Ihrer Akte",
  meldungText: "EIN-Bestätigung der IRS liegt bereit",
  meldungZeit: "jetzt",
  heroLabel: (name: string) => `Beispielansicht eines Mandats: Gesellschaft angemeldet, EIN erteilt, ITIN beantragt, Geschäftskonto als Nächstes. Ihr Ansprechpartner: ${name}.`,

  bogenSie: "Sie",
  bogenSieZeile: "Ihr Wohnsitz",
  bogenMiami: "Miami",
  bogenMiamiZeile: "Unsere Partner in den USA",
  bogenKapital: "Mittel auch in Europa einsetzbar",
  bogenKapitalZeile: satz("S1", "de"),
  bogenEtappenKurz: [...kurzwoerter("de", "DE", 4)],
  bogenLabel: `Karte: von Ihrem Wohnsitz zu unseren Partnern in den USA, dort die Schritte Gründung, Konten, Finanzierung und Umschuldung; ein zweiter Bogen führt zurück nach Europa. ${satz("S1", "de")}`,
};
const buehneEn: typeof buehneDe = {
  beispiel: "Sample view",
  kapitalAuge: "Your funding target",
  kapitalBetrag: "$250,000",
  kapitalZeile: "Chosen by you · all financing decisions rest with the lender",
  akteAuge: "Your US company",
  akteName: "Sample Ventures LLC",
  akteOrt: "Florida · formed and administered",
  schritte: [
    { titel: "Company filed", zeile: "Florida · Articles of Organization", marke: "Done" },
    { titel: "EIN issued", zeile: "Tax identification number from the IRS", marke: "Done" },
    { titel: "ITIN applied for", zeile: "The US tax authority decides", marke: "In progress" },
    { titel: "Business account", zeile: "Application prepared", marke: "Next" },
    { titel: "Credit cards on request", zeile: "Application prepared", marke: "Then" },
  ],
  person: "Your contact",
  weiterBlick: "Continue to the overview",
  mail: "Email",
  telefon: "Call",
  meldungTitel: "New in your file",
  meldungText: "IRS EIN confirmation is ready",
  meldungZeit: "now",
  heroLabel: (name: string) => `Sample view of an engagement: company filed, EIN issued, ITIN applied for, business account next. Your contact: ${name}.`,

  bogenSie: "You",
  bogenSieZeile: "Your country of residence",
  bogenMiami: "Miami",
  bogenMiamiZeile: "Our partners in the United States",
  bogenKapital: "Funds can be used in Europe too",
  bogenKapitalZeile: satz("S1", "en"),
  bogenEtappenKurz: [...kurzwoerter("en", "DE", 4)],
  bogenLabel: `Map: from your country of residence to our partners in the United States, where formation, accounts, financing and refinancing take place; a second arc leads back to Europe. ${satz("S1", "en")}`,
};
export const GLOBAL_BUEHNE_WOERTER = { de: buehneDe, en: buehneEn };
