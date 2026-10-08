// ═══════════════════════════════════════════════════════════════════════════
// /business — FIAON GLOBAL: die Texte der Seite (17.09.2026, E-188)
//
// Sie-Form, ruhig. Eine Zahl im Blickfang nur mit ihrem Satz direkt daneben
// (Kapitalrahmen → „entscheidet das Institut“, Geld zurück → Bedingungen).
// Was ein Paket enthält und was es kostet, steht NICHT hier, sondern in
// shared/fiaon-global.ts und im Katalog (shared/fiaon-pakete.ts) — die Seite
// liest beides.
//
// Die Grenzen der Wortwahl (Register E-187/E-188): kein Ergebnis zusagen, das
// ein Institut entscheidet; kein Bankname; keine Frist mit Ziffer;
// Steuerberater und Anwälte arbeiten auf das Mandat des Kunden (die Honorare
// trägt FIAON); Dauer nur als Erfahrungswert. Jeder deutsche Satz passiert
// scripts/pruef-wortwand-de.ts, jeder englische scripts/seo-wortverbote-en.ts
// und scripts/pruef-global-en.ts (globalWortPruefenEn).
//
// ── NEUBAU 06.10.2026 (E-293, BAUPLAN /business Scheibe A) ─────────────────
// Justin: „Business-Bereich übersichtlicher, grafischer, moderner, Texte neu
// (auch Bürgschaft bei ausgewählten Kunden)". Die Seite schrumpft von rund
// 2.730 auf rund 1.030 sichtbare Wörter: Pakete direkt nach dem Hero, jede
// Grafik ersetzt einen Absatz. Warum JEDER sichtbare Satz hier steht — auch
// Grafik-Beschriftungen, Tooltips, aria-label mit Aussage und Bildnachweise:
// Die Wortwand liest kein JSX. Vertragsgleiche Sätze (Pakete, Inklusivliste,
// Pflichthinweise, Geld zurück, Rollen) bleiben in shared/fiaon-global.ts;
// was hier steht, sind Kurzfassungen — der volle Wortlaut steht im DOM in der
// Klappe „Wortlaut wie im Vertrag“.
// Gestrichen am 06.10.: Mandat-Karte, Nachrichtenlage (jetzt /business/wissen),
// „Der Weg“ als eigener Abschnitt (jetzt Wegleiste über den Tafeln), Für-wen-
// Kacheln (jetzt Chips), drei Uhren (jetzt „Drei Orte“ im Fuß), „Klare
// Verhältnisse“ (Partnersatz im Stern, Standorte im Fuß), Kontaktkasten.
// ═══════════════════════════════════════════════════════════════════════════

import { FIAON_FIRMA } from "@shared/fiaon-firma";

// 19.09.2026 (E-192) — Justin: „Die Business Seite muss PERFEKT sein, dass sie konvertieren
// kann." FAQ-Antworten bleiben reine Zeichenketten in "…" — scripts/seo-fragen-erzeugen.ts liest
// nur diese Form (Vorlagen mit ${…} fehlen sonst im FAQ-Markup).

/** Ein Begriff zum Antippen (components/site/global/Begriff.tsx): Schlüssel → Erklärung. */
export type GlobalBegriff = "ein" | "itin" | "registeredAgent" | "operatingAgreement" | "usCpa" | "kartenleiter" | "bareinlage" | "herausgeber" | "kapitalrahmen";
/** Ein Knoten im Stern „Ein Ansprechpartner statt acht“: fest = im Festpreis, antrag = vorbereitet, das Institut entscheidet. */
export interface GlobalSternKnoten { name: string; umfang?: string; status: "fest" | "antrag"; inkl?: number }

const de = {
  metaTitel: "US-Gesellschaft gründen ab 2.499 € — FIAON Global",
  // 06.10.2026 (E-293): ohne „Konto, Karten“ als Leistung und ohne „alles inklusive“ — es sind Anträge, und „inklusive“ gilt für das Paket.
  metaBeschreibung: "US-Gesellschaft gründen mit Team in Miami — für Unternehmen und Privatpersonen: Gründung, EIN, ITIN, Konto- und Kartenanträge. Festpreis ab 2.499 €.",

  // ── 1 Hero mit Vertrauensleiste ──
  auge: "FIAON Global · Für Unternehmen und Privatpersonen",
  /** Das Wort der Augenzeile, das auf /business/privatpersonen führt. */
  augeLink: "Privatpersonen",
  h1a: "US-Gesellschaft gründen.",
  h1b: "Den Weg zum Kapital planen.",
  lead: "Gründung, EIN und ITIN, Konto- und Kartenanträge — mit unserem Team in Miami und einem festen Ansprechpartner.",
  knopfPakete: "Pakete und Preise",
  knopfGespraech: "Erstgespräch vereinbaren",
  gespraechMikro: "Dreißig Minuten, kostenfrei und ohne Verpflichtung.",
  preisKopf: "Festpreis",
  preisAb: "ab",
  preisKopfZusatz: "Einmalig, alle Gebühren des Pakets inklusive.",
  kapitalKopf: "Kapitalrahmen je nach Paket",
  kapitalKopfZusatz: "Ihr Ziel — über jeden Rahmen entscheidet das jeweilige Institut.",
  jahrZeile: (preis: string) => `Ab Jahr zwei optional: Jahresbetreuung ${preis} im Jahr`,
  // Vier Felder unter dem Hero; das zweite führt auf den Mustervertrag, das vierte kommt aus FIAON_FIRMA.
  vertrauensleiste: [
    "Vertrag auf Deutsch, nach deutschem Recht",
    "Mustervertrag vorab lesen",
    "Per Rechnung, kein Abo",
    `${FIAON_FIRMA.name} · Companies House ${FIAON_FIRMA.companyNo}`,
  ],
  // Redaktioneller Bildnachweis an jedem Higgsfield-Objekt (Art. 50 KI-VO) — erst sichtbar, wenn das Bild da ist (Scheibe C).
  bildKi: "Abbildung mit KI erstellt",
  /** Eine gemeinsame Zeile für die vier Objekte der Wegleiste (Bauplan 2.3: nicht je Objekt). */
  bilderKi: "Abbildungen mit KI erstellt",
  szeneKi: "Szene mit KI erstellt",

  // ── Begriffe zum Antippen (nur bei Bedarf sichtbar) ──
  begriffe: {
    ein: "Die Steuernummer Ihrer US-Gesellschaft, vergeben von der US-Steuerbehörde.",
    itin: "Ihre persönliche US-Steuernummer — für Gesellschafter ohne US-Sozialversicherungsnummer.",
    registeredAgent: "Die vorgeschriebene Zustelladresse Ihrer Gesellschaft im Bundesstaat der Gründung.",
    operatingAgreement: "Der Gesellschaftsvertrag einer LLC: wem sie gehört und wer entscheidet.",
    usCpa: "In den USA zugelassener Steuer- und Rechnungsprüfer (Certified Public Accountant); er erstellt die US-Meldung.",
    kartenleiter: "Erst eine Karte, dann weitere Herausgeber in einer geplanten Reihenfolge — jede pünktliche Abrechnung baut Historie auf.",
    bareinlage: "Ein Guthaben, das manche Herausgeber als Sicherheit verlangen.",
    herausgeber: "Die Bank oder das Unternehmen, das eine Karte ausgibt.",
    kapitalrahmen: "Der Rahmen, den Sie mit uns anstreben — Ihr Ziel, keine Zusage. Über jeden Rahmen entscheidet das jeweilige Institut.",
  } as Record<GlobalBegriff, string>,
  /** Wie der Begriff im Fließtext steht (Groß-/Kleinschreibung egal) — dort wird er antippbar. */
  begriffWoerter: {
    ein: "EIN", itin: "ITIN", registeredAgent: "Registered Agent", operatingAgreement: "Operating Agreement", usCpa: "US-CPA",
    kartenleiter: "Kartenleiter", bareinlage: "Bareinlage", herausgeber: "Herausgeber", kapitalrahmen: "Kapitalrahmen",
  } as Record<GlobalBegriff, string>,

  // ── 2 Pakete mit Wegleiste, Beleg und Kleingedrucktem ──
  paketeAuge: "Pakete und Preise",
  paketeH2: "Wie weit sollen wir Sie begleiten?",
  paketeLead: "Der Kapitalrahmen ist Ihr Ziel. Je höher er liegt, desto länger begleiten wir Sie.",
  wegLabel: "Der Weg in vier Etappen",
  wegLead: "Das Tempo bestimmen Behörden und Institute — wir nennen Erfahrungswerte, keine Fristen.",
  // Die Titel sind wortgleich mit GLOBAL_ETAPPEN 1–4 (scripts/pruef-global-bereich.ts); Dauer und Text stehen im Knoten-Popover.
  weg: [
    { titel: "Gründung und Dokumente", dauer: "in der Regel wenige Wochen", text: "Gesellschaft, EIN, ITIN, Registered Agent, US-Adresse und Telefonnummer, Operating Agreement. Unser Team vor Ort reicht ein und holt ab; die ITIN vergibt die US-Steuerbehörde in eigener Frist." },
    { titel: "Die erste Firmenkarte", dauer: "nach vollständigen Dokumenten", text: "Sie stellen den ersten Antrag bei einem US-Herausgeber — meist mit kleinem Rahmen und ohne Bareinlage, dafür mit persönlicher Haftung des Inhabers. Wir bereiten den Antrag vor; der Herausgeber entscheidet." },
    { titel: "Die Kartenleiter", dauer: "über einige Monate", text: "Pünktliche Abrechnung öffnet weitere Herausgeber. Viele bieten neuen Firmenkunden einen Einführungszeitraum ohne Sollzins — ob und zu welchen Bedingungen, legt jeder Herausgeber selbst fest." },
    { titel: "Das Bankdarlehen", dauer: "mit gewachsener Historie", text: "Mit gewachsener Historie kann ein Darlehen bei einer US-Bank in Frage kommen. Wir bereiten Unterlagen und Kennzahlen auf; den Antrag stellen Sie bei der Bank, die ihn nach ihren Regeln prüft." },
  ],
  inJedemPaket: "In jedem Paket",
  abPaket: (name: string) => `Ab ${name}`,
  stempelInstitut: "Hier entscheidet das Institut",
  fokusBand: "Alle vier Etappen",
  festpreis: "Festpreis, einmalig",
  inklusive: "Alle Gebühren des Pakets inklusive",
  planung: "Kapitalrahmen",
  planungZusatz: "Ihr Ziel — über den Rahmen entscheidet das Institut",
  beauftragen: (name: string) => `${name} beauftragen`,
  beauftragenKurz: "Jetzt beauftragen",
  vipGespraech: (name: string) => `Gespräch zu ${name} vereinbaren`,
  vipGespraechKurz: "Gespräch vereinbaren",
  direktBeauftragen: "Direkt beauftragen",
  erstSprechen: "Erst sprechen",
  etappenBis: (bis: string) => `Etappen I–${bis}`,
  festpreisKurz: "Festpreis",
  einmaligInklusive: "Einmalig, alle Gebühren des Pakets inklusive",
  alleLeistungen: (n: number) => `Alle ${n} Leistungen`,
  wenigerLeistungen: "Weniger anzeigen",
  zumVergleich: "Alle Leistungen im Vergleich",
  wischen: "Tabelle seitlich verschieben, um alle vier Pakete zu sehen.",
  vipZeichen: "VIP",
  vipTicket: {
    titel: "Ihr Auftakt in Miami",
    abflug: "Abflug", abflugOrte: "Deutschland · Österreich · Schweiz",
    ziel: "Ziel", zielOrt: "Miami, Florida",
    enthalten: "Enthalten", enthaltenText: "Hin- und Rückflug · Hotel",
    fuer: "Für", fuerText: "1 Person",
  },
  kostenHinweis: "Unternehmen: zuzüglich Umsatzsteuer, soweit sie anfällt. Privatpersonen: Endpreise.",
  finderLink: "Paket-Finder: vier Fragen",
  // Der Beleg „Im Festpreis“ — Kurzzeilen; der Vertragswortlaut (GLOBAL_INKLUSIVE + GLOBAL_LAUFEND) steht in der Klappe.
  inklAuge: "Im Festpreis",
  inklTitel: "Ein Festpreis — die Honorare für die Leistungen Ihres Pakets trägt FIAON.",
  beleg: [
    "Staatliche Gründungsgebühren",
    "Registered Agent, US-Adresse und Telefon im ersten Jahr",
    "Anträge für EIN und ITIN",
    "Partner-Anwalt: Operating Agreement",
    "Partner-Steuerberater: Prüfung vor der Gründung",
    "US-CPA: erste jährliche US-Meldung",
    "Termine und Einreichungen vor Ort",
    "Ihr fester Ansprechpartner",
  ],
  belegSumme: "Ihr Festpreis · einmalig",
  belegKlappe: "Wortlaut wie im Vertrag",
  nichtTitel: "Nicht im Festpreis",
  wissenTitel: "Was Sie vor dem Auftrag wissen müssen",
  // Vergleichstabelle (hinter der Klappzeile „Alle Leistungen im Vergleich“, auf allen Breiten zu)
  leistung: "Leistung",
  zeilePlanung: "Kapitalrahmen",
  zeileDauer: "Begleitung (Erfahrungswert)",
  ja: "enthalten",
  nein: "nicht enthalten",

  // ── 3 Jahresbetreuung als Band (Texte und Preis: GLOBAL_JAHRESBETREUUNG) ──
  jbKnopf: "Beim Auftrag dazubuchen",
  jbSo: "So funktioniert es",

  // ── 4 Ein Ansprechpartner statt acht (#leistungen, darin #fuer-wen) ──
  vsAuge: "Aus einer Hand",
  vsH2: "Ein Ansprechpartner statt acht Anlaufstellen.",
  sternLabel: "Ein Ansprechpartner statt acht Anlaufstellen",
  sternSchalter: ["Ohne FIAON Global", "Mit FIAON Global"] as [string, string],
  sternKnoten: [
    { name: "Gründungsdienst", umfang: "Gründung samt Staatsgebühren", status: "fest", inkl: 0 },
    { name: "Registered Agent", umfang: "im ersten Jahr", status: "fest", inkl: 1 },
    { name: "US-Steuerbehörde", umfang: "Anträge für EIN und ITIN", status: "fest", inkl: 2 },
    { name: "Anwalt", umfang: "Operating Agreement", status: "fest", inkl: 3 },
    { name: "Steuerberater", umfang: "Prüfung vor der Gründung", status: "fest", inkl: 4 },
    { name: "US-CPA", umfang: "erste US-Meldung", status: "fest", inkl: 5 },
    { name: "Banken", status: "antrag" },
    { name: "Kartenherausgeber", status: "antrag" },
  ] as GlobalSternKnoten[],
  sternMitte: "Ihr Ansprechpartner",
  sternSie: "Sie",
  sternLegende: ["Im Festpreis enthalten", "Antrag vorbereitet — das Institut entscheidet"] as [string, string],
  // Im Zustand „Ohne“ (nur im DOM, nicht gezählt): wen man ohne FIAON Global selbst anspricht — je Knoten eine Zeile.
  ohne: [
    "Gründungsdienst für die Gesellschaft",
    "Registered Agent und US-Adresse",
    "US-Steuerbehörde für EIN und ITIN",
    "Anwalt für den Gesellschaftsvertrag",
    "Steuerberater im Wohnsitzland",
    "US-CPA für die jährliche Meldung",
    "Banken für das Geschäftskonto",
    "Kartenherausgeber für jede Firmenkarte",
  ],
  ehrlichTitel: "Ehrlich gesagt",
  ehrlichText: "Nur die Gesellschaft gibt es beim Gründungsdienst günstiger. Unser Festpreis deckt auch die Schritte danach — von EIN und ITIN bis zur ersten US-Meldung.",
  ehrlichLink: "Selbst, Gründungsdienst oder FIAON Global: der Vergleich",
  fuerKurz: "Für wen:",
  fuerChips: [
    { text: "Mittelstand", pfad: "/business/tochtergesellschaft-usa" },
    { text: "Onlinehandel", pfad: "/business/onlinehandel" },
    { text: "Agenturen und Software", pfad: "/business/agenturen-software" },
    { text: "Bau und Immobilien", pfad: "/business/bau-immobilien" },
    { text: "Privatpersonen", pfad: "/business/privatpersonen" },
  ] as { text: string; pfad?: string }[],

  // ── 6 Erstgespräch ──
  gespraechAuge: "Erstgespräch",
  gespraechH2: "Erst sprechen, dann entscheiden.",
  gespraechLead: "Vorhaben, Wohnsitz, Ziel — und welches Paket dazu passt.",

  // ── 7 Fragen ──
  fragenAuge: "Häufige Fragen",
  fragenH2: "Was Unternehmer und Gründer vor dem Auftrag fragen.",
  fragenAlle: "Alle Antworten zu FIAON Global",
  fragenAlleZahl: (n: number) => `Alle ${n} Fragen`,
  // 06.10.2026 (E-293, Gutachten 2, § 5 UWG): Frage 1 endet nicht mehr mit „wir bezahlen alle, die für Ihre Gesellschaft
  // arbeiten“ — FIAON trägt die Honorare für die Leistungen des Pakets, nicht jede Rechnung rund um die Gesellschaft.
  // Reihenfolge bleibt; /business zeigt zuerst die Fragen FRAGEN_ZUERST (business.tsx), die übrigen hinter „Alle 17 Fragen“.
  fragen: [
    { f: "Was ist im Festpreis enthalten?", a: "Alle Gebühren und Honorare für die Leistungen Ihres Pakets: staatliche Gründungsgebühren, Registered Agent, US-Adresse und Telefon im ersten Jahr, die Anträge für EIN und ITIN, die Honorare unseres Partner-Anwalts, unseres Partner-Steuerberaters und unseres US-CPA sowie die Arbeit unseres Teams vor Ort. Sie zahlen einen Preis — die Honorare für die Leistungen Ihres Pakets trägt FIAON." },
    { f: "Warum kostet das mehr als eine Online-Gründung?", a: "Eine Online-Gründung liefert die Gesellschaft — und endet dort. Im Festpreis stecken zusätzlich EIN und ITIN, Registered Agent, US-Adresse und Telefon im ersten Jahr, das Operating Agreement unseres Partner-Anwalts, die Prüfung durch unseren Partner-Steuerberater vor der Gründung, die erste jährliche US-Meldung durch unseren US-CPA, die vorbereiteten Konto- und Kartenanträge und ein Ansprechpartner, der alles zusammenhält. Wer nur die Gesellschaft braucht, zahlt bei einem reinen Gründungsdienst weniger — das sagen wir Ihnen auch im Gespräch." },
    { f: "Entscheidet FIAON über Karten und Rahmen?", a: "Nein. Über Konto, Karte und Rahmen entscheidet das jeweilige Institut nach eigenen Regeln. FIAON baut die Struktur auf, bereitet Anträge vor und plant die Reihenfolge." },
    // 19.09.2026 (Justin): wortgleich mit GLOBAL_KAPITAL_FREI.de (frage/antwort) — scripts/pruef-global-seiten.ts prüft das.
    { f: "Muss das Kapital in den USA ausgegeben werden?", a: "Nein. Das Kapital ist nicht an die USA gebunden: Ihre Gesellschaft kann Mittel nach Europa überweisen oder damit in Europa investieren, etwa in Ihr bestehendes Unternehmen oder in Projekte hier. Über Rahmen und Bedingungen entscheidet das jeweilige Institut; wie Überweisungen und Investitionen steuerlich zu behandeln sind, klärt unser Partner-Steuerberater vorab mit Ihnen." },
    { f: "Was passiert, wenn eine Bank oder ein Herausgeber ablehnt?", a: "Das kommt vor — jedes Institut entscheidet nach eigenen Regeln. Ihr Ansprechpartner klärt mit Ihnen den Grund, soweit das Institut ihn nennt, und plant den nächsten Schritt; ab Global Banking bereiten wir jeden weiteren Antrag vollständig vor. Die Geld-zurück-Zusage gilt für Gesellschaft und EIN — Entscheidungen von Banken und Kartenherausgebern sind nicht Teil davon." },
    { f: "Wie prüfe ich, ob FIAON seriös ist?", a: "An drei Stellen, bevor Sie etwas bezahlen: Die FIAON LTD steht im öffentlichen Register Companies House unter der Nummer 17318250. Den Vertrag lesen Sie vorab als Mustervertrag. Und bezahlt wird erst nach der Unterschrift, per Rechnung auf das Geschäftskonto der FIAON LTD — nie auf ein privates Konto." },
    { f: "Wer ist mein Vertragspartner?", a: "Die FIAON LTD mit Sitz in London, eingetragen im Companies House (England and Wales) unter der Nummer 17318250. Ihr Vertrag ist auf Deutsch und unterliegt deutschem Recht. Steuerberater, US-CPA und Anwälte arbeiten auf Ihr Mandat; ihre Honorare trägt FIAON." },
    { f: "Muss ich in die USA reisen?", a: "In der Regel nicht. Unser Team vor Ort nimmt die Termine wahr. Wer den Aufbau persönlich erleben möchte, wählt Global VIP — Flug und Hotel für den Auftakt in Miami sind dort im Festpreis enthalten." },
    { f: "Was ist mit Steuern?", a: "Die US-Gesellschaft ersetzt keine Steuerpflicht zu Hause: Wer sie aus Deutschland, Österreich oder der Schweiz führt, versteuert dort. Unser Partner-Steuerberater prüft Ihre Lage vor der Gründung, unser US-CPA übernimmt die erste jährliche US-Meldung — beide auf Ihr Mandat, die Honorare trägt FIAON." },
    { f: "Kann mein eigener Steuerberater mitarbeiten?", a: "Ja. Ihr Steuerberater bleibt Ihr Steuerberater. Unser Partner-Steuerberater prüft die US-Struktur vor der Gründung und stimmt sich auf Ihren Wunsch mit ihm ab. Die Honorare unserer Partner für die Leistungen Ihres Pakets trägt FIAON — die Ihres eigenen Steuerberaters nicht." },
    { f: "Wie lange dauert es?", a: "Gründung und Dokumente in der Regel wenige Wochen, die ITIN in der Frist der US-Steuerbehörde, die erste Firmenkarte danach, weitere Herausgeber über mehrere Monate. Feste Fristen nennen wir nicht — Behörden und Institute bestimmen das Tempo." },
    { f: "Welche Unterlagen brauchen Sie von mir?", a: "Fünf: eine Farbkopie des Reisepasses der Gesellschafter und der Geschäftsführung, einen Adressnachweis, der nicht älter als drei Monate ist, die Gesellschafterliste oder einen Handelsregisterauszug Ihres Unternehmens, drei Namensvarianten für die US-Gesellschaft und eine kurze Beschreibung der Geschäftstätigkeit. Alles Weitere besorgt unser Team. Beauftragen Sie als Privatperson, entfällt der Registerauszug." },
    { f: "Was kostet die Gesellschaft ab dem zweiten Jahr?", a: "Mit der Jahresbetreuung 699 € im Jahr, alle Gebühren inklusive: Registered Agent, US-Adresse und Telefonnummer, die jährliche US-Meldung durch unseren US-CPA, die Jahresmeldung beim Bundesstaat samt Staatsgebühr und der Pflichtenkalender. Sie buchen sie im Auftrag dazu; sie verlängert sich nicht von selbst." },
    { f: "Kann ich sofort beauftragen?", a: "Ja. Sie wählen ein Paket, tragen Ihr Unternehmen oder sich selbst als Privatperson ein, unterschreiben den Vertrag am Bildschirm und erhalten Vertrag und Rechnung per E-Mail. Mit dem Zahlungseingang beginnt Ihr Ansprechpartner — als Privatperson auf Ihren Wunsch sofort, sonst nach Ablauf der Widerrufsfrist." },
    { f: "Kann ich auch als Privatperson beauftragen?", a: "Ja. Sie brauchen keine eigene Firma: Im Auftrag wählen Sie „Privatperson“, werden selbst Gesellschafter der US-Gesellschaft und erhalten Vertrag und Rechnung auf Ihren Namen. Der Festpreis ist für Sie ein Endpreis; handeln Sie als Verbraucher, gilt das gesetzliche Widerrufsrecht von vierzehn Tagen." },
    { f: "Wie bezahle ich?", a: "Per Überweisung auf das Geschäftskonto der FIAON LTD — Bankverbindung und Verwendungszweck stehen auf Ihrer Rechnung. Das Paket zahlen Sie einmal, ohne Abo und ohne Raten; die Jahresbetreuung ab dem zweiten Jahr ist freiwillig und verlängert sich nicht von selbst." },
    { f: "Für wen passt es nicht?", a: "Für Vorhaben ohne echte Geschäftstätigkeit und für alle, die keine Gesellschaft mit laufenden Pflichten führen wollen. Das klären wir im ersten Gespräch — offen, auch wenn die Antwort ein Nein ist." },
  ],
  // ── 8 Schlussband ──
  schlussA: "Eine Struktur, die Ihnen gehört — ",
  schlussB: "mit einem Ansprechpartner, der Ihr Vorhaben kennt.",
  // Nur noch auf den Unterseiten (global-seite.tsx); /business zeigt im Schlussband keinen Absatz mehr.
  schlussText: "Wählen Sie ein Paket oder sprechen Sie zuerst mit uns. Erstgespräch: dreißig Minuten, kostenfrei und ohne Verpflichtung.",
  schlussBeauftragen: "Jetzt beauftragen",

  // ── Klebeleiste am Handy ──
  leisteGespraech: "Erstgespräch",
  leistePakete: (preis: string) => `Pakete ab ${preis}`,
  leisteBeauftragen: "Jetzt beauftragen",
  leisteTafel: (name: string, preis: string) => `${name} · ${preis} — beauftragen`,

  // ── Uhren (Mini-Uhren in „Drei Orte“ im Fuß) — Zonen prüft scripts/pruef-global-seiten.ts §9 ──
  uhren: [
    { zone: "Europe/Berlin", ort: "Deutschland", zusatz: "auch Österreich und Schweiz" },
    { zone: "America/New_York", ort: "Florida", zusatz: "Miami · Team vor Ort" },
    { zone: "Europe/London", ort: "London", zusatz: "FIAON LTD · Vertragspartner" },
  ],
  // ── Nachrichtenlage: seit 06.10.2026 auf /business/wissen (global-seite.tsx, Übersicht) ──
  presseAuge: "Nachrichtenlage",
  presseH2: "Was gerade für eine US-Gesellschaft spricht.",
  presseStand: (datum: string) => `Stand ${datum}`,
  presseZurQuelle: "Zur Meldung",
  presseHinweis: "Meldungen Dritter mit Datum und Quelle. Sie beschreiben die allgemeine Lage in den USA — über Konto, Karte und Rahmen entscheidet allein das jeweilige Institut.",
  presseLaufband: "Weitere Schlagzeilen",
  pressePause: "Laufband anhalten",
  presseWeiter: "Laufband fortsetzen",

  // ── /business/privatpersonen: dieselbe Seite, eigene Wörter (E-196) ──
  privat: {
    // Deckungsgleich mit dem Registereintrag (Kopf im Vorab-HTML und in der SEO-Tabelle): shared/fiaon-global-seiten/privat.ts.
    // 06.10.2026 (E-293): „Kontoantrag“ statt „Konto“ — im Suchtreffer steht der Satz ohne den Institut-Satz,
    // und über das Konto entscheidet allein das Institut (Pflichthinweis 3, § 5 UWG). Wie bei /business.
    metaTitel: "US-Firma als Privatperson gründen — FIAON Global",
    metaBeschreibung: "Keine eigene Firma nötig: Als Privatperson oder Gründer beauftragen Sie FIAON Global direkt — US-Gesellschaft, EIN, ITIN und Kontoantrag zum Festpreis.",
    auge: "FIAON Global · Für Privatpersonen und Gründer",
    h1a: "Ihre eigene US-Gesellschaft.",
    h1b: "Ohne Firma, zum Festpreis.",
    lead: "Sie werden selbst Gesellschafter: Wir gründen, beantragen EIN und ITIN und bereiten Konto- und Kartenanträge vor — Vertrag und Rechnung laufen auf Ihren Namen.",
    preisKopfZusatz: "Einmalig, Endpreis, alle Gebühren des Pakets inklusive.",
    // Gründer und Selbständige haben keine eigene Unterseite — die Chips ordnen ein, „Als Unternehmen“ führt zurück.
    fuerChips: [
      { text: "Gründer" },
      { text: "Selbständige" },
      { text: "Onlinehandel", pfad: "/business/onlinehandel" },
      { text: "Als Unternehmen", pfad: "/business" },
    ] as { text: string; pfad?: string }[],
    fragenH2: "Was Privatpersonen und Gründer vor dem Auftrag fragen.",
    schlussA: "Ihre Gesellschaft, Ihr Name — ",
    schlussB: "mit einem Ansprechpartner, der Ihr Vorhaben kennt.",
  },
};

const en: typeof de = {
  metaTitel: "Form a US company from €2,499 — FIAON Global",
  metaBeschreibung: "Form a US company with our team in Miami — for companies and private individuals: formation, EIN, ITIN, account and card applications. From €2,499.",

  auge: "FIAON Global · For companies and private individuals",
  augeLink: "private individuals",
  h1a: "Form a US company.",
  h1b: "Plan your route to capital.",
  lead: "Formation, EIN and ITIN, account and card applications — with our team in Miami and one dedicated contact.",
  knopfPakete: "Packages and prices",
  knopfGespraech: "Arrange a first call",
  gespraechMikro: "Thirty minutes, free of charge and without obligation.",
  preisKopf: "Fixed price",
  preisAb: "from",
  preisKopfZusatz: "One-off, all package fees included.",
  kapitalKopf: "Capital range by package",
  kapitalKopfZusatz: "Your target — each institution decides on its own limit.",
  jahrZeile: (preis: string) => `From year two, optional: annual care plan ${preis} a year`,
  vertrauensleiste: [
    "Contract under German law",
    "Read the model contract first",
    "Pay by invoice, no subscription",
    `${FIAON_FIRMA.name} · Companies House ${FIAON_FIRMA.companyNo}`,
  ],
  bildKi: "Image created with AI",
  bilderKi: "Images created with AI",
  szeneKi: "Scene created with AI",

  begriffe: {
    ein: "The tax number of your US company, issued by the US tax authority.",
    itin: "Your personal US tax number — for shareholders without a US social security number.",
    registeredAgent: "The mandatory address for service of your company in the state of formation.",
    operatingAgreement: "The articles of an LLC: who owns it and who decides.",
    usCpa: "A certified public accountant licensed in the US; prepares the US filing.",
    kartenleiter: "First one card, then further issuers in a planned order — every punctual repayment builds history.",
    bareinlage: "A balance that some issuers require as security.",
    herausgeber: "The bank or company that issues a card.",
    kapitalrahmen: "The range you aim for with us — your target, not a commitment. Each institution decides on its own limit.",
  },
  begriffWoerter: {
    ein: "EIN", itin: "ITIN", registeredAgent: "registered agent", operatingAgreement: "operating agreement", usCpa: "US CPA",
    kartenleiter: "card ladder", bareinlage: "cash deposit", herausgeber: "issuer", kapitalrahmen: "capital range",
  },

  paketeAuge: "Packages and prices",
  paketeH2: "How far should we take you?",
  paketeLead: "The capital range is your target. The higher it is, the longer we support you.",
  wegLabel: "The route in four stages",
  wegLead: "Authorities and institutions set the pace — we give you experience, not deadlines.",
  weg: [
    { titel: "Formation and documents", dauer: "typically a few weeks", text: "Company, EIN, ITIN, registered agent, US address and phone number, operating agreement. Our team on the ground files and collects; the ITIN is issued by the US tax authority on its own timeline." },
    { titel: "The first business card", dauer: "once documents are complete", text: "You submit the first application to a US issuer — usually with a small limit and no cash deposit, but with a personal guarantee from the owner. We prepare the application; the issuer decides." },
    { titel: "The card ladder", dauer: "over several months", text: "Paying on time opens further issuers. Many offer new business customers an introductory period without interest — whether and on what terms is set by each issuer." },
    { titel: "The bank loan", dauer: "with an established history", text: "With an established history, a loan from a US bank may become an option. We prepare documents and key figures; you apply to the bank, which assesses the application under its own rules." },
  ],
  inJedemPaket: "In every package",
  abPaket: (name: string) => `From ${name}`,
  stempelInstitut: "The institution decides here",
  fokusBand: "All four stages",
  festpreis: "Fixed price, one-off",
  inklusive: "All package fees included",
  planung: "Capital range",
  planungZusatz: "Your target — the institution decides on the limit",
  beauftragen: (name: string) => `Order ${name}`,
  beauftragenKurz: "Order now",
  vipGespraech: (name: string) => `Arrange a call about ${name}`,
  vipGespraechKurz: "Arrange a call",
  direktBeauftragen: "Order directly",
  erstSprechen: "Talk first",
  etappenBis: (bis: string) => `Stages I–${bis}`,
  festpreisKurz: "Fixed price",
  einmaligInklusive: "One-off, all package fees included",
  alleLeistungen: (n: number) => `All ${n} services`,
  wenigerLeistungen: "Show less",
  zumVergleich: "Compare all services",
  wischen: "Scroll the table sideways to see all four packages.",
  vipZeichen: "VIP",
  vipTicket: {
    titel: "Your kick-off in Miami",
    abflug: "From", abflugOrte: "Germany · Austria · Switzerland",
    ziel: "To", zielOrt: "Miami, Florida",
    enthalten: "Included", enthaltenText: "Return flight · Hotel",
    fuer: "For", fuerText: "1 person",
  },
  kostenHinweis: "Companies: plus VAT where applicable. Private individuals: final prices.",
  finderLink: "Package finder: four questions",
  inklAuge: "In the fixed price",
  inklTitel: "One fixed price — FIAON pays the fees for the services in your package.",
  beleg: [
    "State formation fees",
    "Registered agent, US address and phone in year one",
    "EIN and ITIN applications",
    "Partner lawyer: operating agreement",
    "Partner tax adviser: review before formation",
    "US CPA: first annual US filing",
    "Appointments and filings on the ground",
    "Your dedicated contact",
  ],
  belegSumme: "Your fixed price · one-off",
  belegKlappe: "Wording as in the contract",
  nichtTitel: "Not in the fixed price",
  wissenTitel: "What you need to know before ordering",
  leistung: "Service",
  zeilePlanung: "Capital range",
  zeileDauer: "Support (typical)",
  ja: "included",
  nein: "not included",

  jbKnopf: "Add it when you order",
  jbSo: "How it works",

  vsAuge: "From one source",
  vsH2: "One contact instead of eight.",
  sternLabel: "One contact instead of eight points of contact",
  sternSchalter: ["Without FIAON Global", "With FIAON Global"],
  sternKnoten: [
    { name: "Formation service", umfang: "formation incl. state fees", status: "fest", inkl: 0 },
    { name: "Registered agent", umfang: "in year one", status: "fest", inkl: 1 },
    { name: "US tax authority", umfang: "EIN and ITIN applications", status: "fest", inkl: 2 },
    { name: "Lawyer", umfang: "operating agreement", status: "fest", inkl: 3 },
    { name: "Tax adviser", umfang: "review before formation", status: "fest", inkl: 4 },
    { name: "US CPA", umfang: "first US filing", status: "fest", inkl: 5 },
    { name: "Banks", status: "antrag" },
    { name: "Card issuers", status: "antrag" },
  ],
  sternMitte: "Your contact",
  sternSie: "You",
  sternLegende: ["Included in the fixed price", "Application prepared — the institution decides"],
  ohne: [
    "Formation service for the company",
    "Registered agent and US address",
    "US tax authority for EIN and ITIN",
    "Lawyer for the operating agreement",
    "Tax adviser in your country of residence",
    "US CPA for the annual filing",
    "Banks for the business account",
    "Card issuers for every business credit card",
  ],
  ehrlichTitel: "To be honest",
  ehrlichText: "a formation service is cheaper if all you need is the company. Our fixed price also covers the steps after — from EIN and ITIN to the first US filing.",
  ehrlichLink: "Yourself, a formation service or FIAON Global: the comparison",
  fuerKurz: "For:",
  fuerChips: [
    { text: "SMEs", pfad: "/en/business/us-subsidiary" },
    { text: "E-commerce", pfad: "/en/business/e-commerce" },
    { text: "Agencies and software", pfad: "/en/business/agencies-software" },
    { text: "Construction and property", pfad: "/en/business/construction-property" },
    { text: "Private individuals", pfad: "/en/business/private-individuals" },
  ],

  gespraechAuge: "First call",
  gespraechH2: "Talk first, then decide.",
  gespraechLead: "Your plans, your country of residence, your goal — and which package fits.",

  fragenAuge: "Frequently asked questions",
  fragenH2: "What business owners and founders ask before ordering.",
  fragenAlle: "All answers about FIAON Global",
  fragenAlleZahl: (n: number) => `All ${n} questions`,
  fragen: [
    { f: "What is included in the fixed price?", a: "All fees and charges for the services in your package: US state formation fees, registered agent, US address and phone in the first year, the EIN and ITIN applications, the fees of our partner lawyer, partner tax adviser and US CPA, and the work of our team on the ground. You pay one price — FIAON pays the fees for the services in your package." },
    { f: "Why does this cost more than an online formation?", a: "An online formation delivers the company — and stops there. The fixed price also covers EIN and ITIN, registered agent, US address and phone in the first year, the operating agreement by our partner lawyer, the review by our partner tax adviser before formation, the first annual US filing by our US CPA, the prepared account and card applications and one contact who keeps it all together. If all you need is the company, a pure formation service costs less — we tell you that in the call as well." },
    { f: "Does FIAON decide on cards and limits?", a: "No. The institution concerned decides on account, card and limit under its own rules. FIAON builds the structure, prepares applications and plans the sequence." },
    { f: "Does the capital have to be spent in the US?", a: "No. The capital is not tied to the US: your company can transfer funds to Europe or invest them in Europe, for example in your existing business or in projects here. The institution concerned decides on the limit and its terms; our partner tax adviser clarifies with you in advance how transfers and investments are treated for tax purposes." },
    { f: "What happens if a bank or issuer declines?", a: "It happens — every institution decides under its own rules. Your contact works out the reason with you, as far as the institution gives one, and plans the next step; from Global Banking onwards we prepare every further application in full. The money-back commitment covers the company and the EIN — decisions by banks and card issuers are not part of it." },
    { f: "How do I check that FIAON is reputable?", a: "In three places, before you pay anything: FIAON LTD is listed in the public Companies House register under number 17318250. You read the contract in advance as a model contract. And you only pay after signing, by invoice to the business account of FIAON LTD — never to a private account." },
    { f: "Who is my contracting party?", a: "FIAON LTD, based in London and registered at Companies House (England and Wales) under number 17318250. Your contract is governed by German law. Tax advisers, US CPAs and lawyers act under your engagement; FIAON pays their fees." },
    { f: "Do I have to travel to the US?", a: "Usually not. Our team on the ground attends the appointments. If you want to experience the build-up in person, choose Global VIP — flights and hotel for the kick-off in Miami are included in its fixed price." },
    { f: "What about taxes?", a: "The US company does not replace tax liability at home: if you manage it from Germany, Austria or Switzerland, you pay tax there. Our partner tax adviser reviews your position before formation and our US CPA handles the first annual US filing — both under your engagement, with FIAON paying their fees." },
    { f: "Can my own tax adviser be involved?", a: "Yes. Your tax adviser remains your tax adviser. Our partner tax adviser reviews the US structure before formation and coordinates with them if you wish. FIAON pays our partners’ fees for the services in your package — not those of your own tax adviser." },
    { f: "How long does it take?", a: "Formation and documents typically a few weeks, the ITIN on the US tax authority's timeline, the first business card after that, further issuers over several months. We do not quote fixed deadlines — authorities and institutions set the pace." },
    { f: "Which documents do you need from me?", a: "Five: a colour copy of the passports of the shareholders and managing directors, proof of address no older than three months, the shareholder list or a commercial register extract of your company, three name variants for the US company and a short description of the business activity. Our team obtains everything else. If you order as a private individual, the register extract is not needed." },
    { f: "What does the company cost from the second year?", a: "With the annual care plan €699 a year, all fees included: registered agent, US address and phone number, the annual US filing by our US CPA, the annual report to the state including the state fee, and the compliance calendar. You add it when you order; it does not renew automatically." },
    { f: "Can I order straight away?", a: "Yes. You choose a package, enter your company or yourself as a private individual, sign the contract on screen and receive contract and invoice by email. Your contact starts once payment has been received — as a private individual immediately if you request it, otherwise after the withdrawal period." },
    { f: "Can I order as a private individual?", a: "Yes. You do not need a company of your own: in the order you choose “Private individual”, become the shareholder of the US company yourself and receive contract and invoice in your name. The fixed price is your final price; if you act as a consumer, the statutory fourteen-day right of withdrawal applies." },
    { f: "How do I pay?", a: "By bank transfer to the business account of FIAON LTD — bank details and payment reference are on your invoice. You pay for the package once, with no subscription and no instalments; the annual care plan from the second year is optional and does not renew automatically." },
    { f: "Who is it not for?", a: "For plans without genuine business activity, and for anyone who does not want to run a company with ongoing duties. We clarify that in the first call — openly, even if the answer is no." },
  ],
  schlussA: "A structure that belongs to you — ",
  schlussB: "with one contact who knows your plans.",
  schlussText: "Choose a package or talk to us first. First call: thirty minutes, free of charge and without obligation.",
  schlussBeauftragen: "Order now",

  leisteGespraech: "First call",
  leistePakete: (preis: string) => `Packages from ${preis}`,
  leisteBeauftragen: "Order now",
  leisteTafel: (name: string, preis: string) => `${name} · ${preis} — order`,

  uhren: [
    { zone: "Europe/Berlin", ort: "Germany", zusatz: "also Austria and Switzerland" },
    { zone: "America/New_York", ort: "Florida", zusatz: "Miami · team on the ground" },
    { zone: "Europe/London", ort: "London", zusatz: "FIAON LTD · contracting party" },
  ],
  presseAuge: "The news",
  presseH2: "What speaks for a US company right now.",
  presseStand: (datum: string) => `As of ${datum}`,
  presseZurQuelle: "Read the report",
  presseHinweis: "Third-party reports with date and source. They describe the general situation in the US — the institution alone decides on the account, the card and the limit.",
  presseLaufband: "More headlines",
  pressePause: "Pause the ticker",
  presseWeiter: "Resume the ticker",
  privat: {
    metaTitel: "Form a US company as a private individual — FIAON Global",
    metaBeschreibung: "No company needed: as a private individual or founder, engage FIAON Global directly — US company, EIN, ITIN and account application, fixed price.",
    auge: "FIAON Global · For private individuals and founders",
    h1a: "Your own US company.",
    h1b: "No company needed — at a fixed price.",
    lead: "You become the shareholder yourself: we form the company, apply for the EIN and ITIN and prepare account and card applications — contract and invoice are in your name.",
    preisKopfZusatz: "One-off, final price, all package fees included.",
    fuerChips: [
      { text: "Founders" },
      { text: "Self-employed" },
      { text: "E-commerce", pfad: "/en/business/e-commerce" },
      { text: "As a company", pfad: "/en/business" },
    ],
    fragenH2: "What private individuals and founders ask before ordering.",
    schlussA: "Your company, your name — ",
    schlussB: "with a contact who knows your plans.",
  },
};

export const GLOBAL_WOERTER = { de, en };


// ── Das Gespräch (Kalender auf /business#gespraech) ────────────────────────
const gespraechDe = {
  punkte: [
    "Ihr Vorhaben, Ihr Wohnsitz, Ihr Ziel — in dreißig Minuten geordnet.",
    "Welche Gesellschaftsform und welches Paket zu Ihrer Lage passen.",
    "Was im Festpreis steckt und was wir nicht zusagen können.",
    "Ohne Verpflichtung — Sie entscheiden danach in Ruhe.",
  ],
  mitWemZusatz: "Dreißig Minuten am Telefon — wir rufen Sie zur gewählten Zeit an.",
  direkt: "Lieber sofort sprechen?",
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
  fehler: "Das hat nicht geklappt. Bitte prüfen Sie Ihre Angaben und versuchen Sie es erneut.",
  pflicht: "Bitte füllen Sie Name, E-Mail und Telefon aus.",
  fertigTitel: "Ihr Gespräch steht.",
  fertigText: (wann: string, wer: string) => `${wann} Uhr${wer ? " mit " + wer : ""}. Die Bestätigung ist unterwegs an Ihre E-Mail-Adresse — mit allem, was Sie für das Gespräch brauchen.`,
  anfrageTitel: "Ihre Anfrage ist angekommen.",
  anfrageText: "Ihr Ansprechpartner meldet sich bei Ihnen und stimmt einen Termin ab.",
  paketGewaehlt: (name: string) => `Paketwunsch: ${name}`,
  datenschutz: "Ihre Angaben verwenden wir nur für dieses Gespräch. Einzelheiten stehen in der Datenschutzerklärung.",
  // 06.10.2026 (E-293): Visitenkarte statt Punkteliste, Kalender in zwei Schritten (erst Tag und Uhrzeit, dann die Angaben).
  karteTitel: "Ihr Ansprechpartner",
  // E-309 (08.10.2026): Visitenkarte mit Porträt — der Satz nennt die Person beim Namen.
  mitPerson: (vorname: string) => `Dreißig Minuten am Telefon — ${vorname} ruft Sie zur gewählten Zeit persönlich an.`,
  mailAn: (name: string) => `E-Mail an ${name}`,
  anrufen: (name: string) => `${name} anrufen`,
  zurueck: "Zurück",
  rueckrufStatt: "Rückruf statt Termin",
};

const gespraechEn: typeof gespraechDe = {
  punkte: [
    "Your plans, your residence, your goal — put in order in thirty minutes.",
    "Which company form and which package suit your situation.",
    "What the fixed price covers and what we cannot commit to.",
    "No obligation — you decide afterwards, in your own time.",
  ],
  mitWemZusatz: "Thirty minutes by phone — we call you at the time you choose.",
  direkt: "Rather talk right away?",
  laedt: "Loading available times …",
  tagWaehlen: "Choose a day",
  zeitWaehlen: "Choose a time",
  zeitzone: "All times are German time (Berlin).",
  gewaehlt: (tag: string, zeit: string) => `Your call: ${tag}, ${zeit}`,
  name: "Your name",
  firma: "Company (if any)",
  email: "Email",
  telefon: "Phone (with country code)",
  thema: "What is it about? (optional)",
  wunschzeit: "When is the best time to reach you?",
  buchen: (wann: string) => `Book the call on ${wann}`,
  anfragen: "Request a call back",
  sendet: "Sending …",
  rueckfallTitel: "We will call you back",
  rueckfallText: "There are currently no available times online. Leave your details — your contact will get in touch and agree a time with you.",
  zurueckKalender: "Back to the available times",
  vergeben: "This time has just been taken. Please choose another one.",
  fehler: "That did not work. Please check your details and try again.",
  pflicht: "Please fill in name, email and phone.",
  fertigTitel: "Your call is booked.",
  fertigText: (wann: string, wer: string) => `${wann}${wer ? " with " + wer : ""}. The confirmation is on its way to your email address — with everything you need for the call.`,
  anfrageTitel: "Your request has arrived.",
  anfrageText: "Your contact will get in touch and agree a time with you.",
  paketGewaehlt: (name: string) => `Package of interest: ${name}`,
  datenschutz: "We use your details only for this call. Details are in the privacy policy.",
  karteTitel: "Your contact",
  mitPerson: (vorname: string) => `Thirty minutes by phone — ${vorname} calls you personally at the time you choose.`,
  mailAn: (name: string) => `Email ${name}`,
  anrufen: (name: string) => `Call ${name}`,
  zurueck: "Back",
  rueckrufStatt: "Call me back instead",
};

export const GLOBAL_GESPRAECH_WOERTER = { de: gespraechDe, en: gespraechEn };

// ═══════════════════════════════════════════════════════════════════════════
// DER FUSS DER BUSINESS-WELT (GlobalFuss.tsx) — 06.10.2026 (E-293)
// Bis heute standen diese Wörter als JSX in GlobalFuss.tsx; die Wortwand liest
// kein JSX. Jetzt prüft scripts/pruef-wortwand-de.ts die deutsche Hälfte und
// scripts/pruef-global-en.ts die englische. Der Satz unter der Marke sagt nicht
// mehr „alles inklusive“, sondern was inklusive ist: die Gebühren des Pakets.
// KEINE_BANK steht auf jeder Seite der Business-Welt (Paketname „Global Banking“,
// § 39/§ 41 KWG) — Begründung in GlobalFuss.tsx.
// ═══════════════════════════════════════════════════════════════════════════
const fussDe = {
  label: "FIAON Global — Fußzeile",
  satz: "US-Gesellschaft aus einer Hand — für Unternehmen und Privatpersonen. Festpreis, alle Gebühren des Pakets inklusive.",
  gespraech: "Gespräch vereinbaren",
  beauftragen: "Beauftragen",
  auftrag: "Mein Auftrag",
  themen: "Themen",
  standorte: "Standorte",
  rechtlich: "Rechtliches",
  orte: { london: "Vertragspartner", zuerich: "Partner Kapital-Etappe", miami: "Team vor Ort" },
  // „Drei Orte“: wo Sie sind (Deutschland, Österreich, Schweiz) und die drei Gesellschaften.
  orteSie: "Sie",
  orteSieZusatz: "Deutschland · Österreich · Schweiz",
  recht: [
    { pfad: "/impressum", text: "Impressum" },
    { pfad: "/datenschutz", text: "Datenschutz" },
    { pfad: "/cookie-einstellungen", text: "Cookie-Einstellungen" },
    { pfad: "/business/widerrufsbelehrung", text: "Widerrufsbelehrung" },
    { pfad: "/business/mustervertrag", text: "Mustervertrag" },
  ],
  registriert: "Eingetragen in England und Wales",
  keineBank: "FIAON ist keine Bank und keine Kanzlei. Über Konten, Karten und Darlehen entscheiden allein die Institute; Steuer- und Rechtsfragen klären unsere Partner auf Ihr Mandat.",
  einwilligung: "Einwilligung ändern",
};

const fussEn: typeof fussDe = {
  label: "FIAON Global — footer",
  satz: "Your US company from one source — for companies and private individuals. Fixed price, all package fees included.",
  gespraech: "Arrange a call",
  beauftragen: "Order now",
  auftrag: "My order",
  themen: "Topics",
  standorte: "Locations",
  rechtlich: "Legal",
  orte: { london: "Contracting party", zuerich: "Capital stage partner", miami: "Team on the ground" },
  orteSie: "You",
  orteSieZusatz: "Germany · Austria · Switzerland",
  recht: [
    { pfad: "/impressum", text: "Legal notice" },
    { pfad: "/datenschutz", text: "Privacy policy" },
    { pfad: "/cookie-einstellungen", text: "Cookie settings" },
    { pfad: "/en/business/widerrufsbelehrung", text: "Withdrawal instructions" },
    { pfad: "/en/business/mustervertrag", text: "Model contract" },
  ],
  registriert: "Registered in England and Wales",
  keineBank: "FIAON is neither a bank nor a law firm. Accounts, cards and loans are decided solely by the institutions; tax and legal questions are handled by our partners under your engagement.",
  einwilligung: "Change consent",
};

export const GLOBAL_FUSS_WOERTER = { de: fussDe, en: fussEn };
