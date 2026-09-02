// ═══════════════════════════════════════════════════════════════════════════
// DAS FACHWISSEN — belegte Fakten mit Stand und Quelle (02.09.2026)
//
// Justin: „Der Agent soll ALLES wissen." Wissen, das der Copilot nennt, muss
// belegbar sein — sonst erfindet ein Modell Fristen. Deshalb steht jeder
// Eintrag hier mit STAND (Datum, ab dem er gilt oder geprüft wurde) und QUELLE.
// Der Copilot zitiert beides mit („Stand 1.7.2026, Pfändungstabelle").
//
// Was hier nicht steht, weiß der Copilot nicht — und sagt das. Preise kommen
// aus dem Paketkatalog (shared/fiaon-pakete.ts), Bankdaten NUR aus
// shared/fiaon-bank.ts, Leitfäden aus shared/fiaon-leitfaeden.ts.
//
// Pflege: Wer ein Gesetz, eine Tabelle oder eine Hausregel ändert, ändert den
// Eintrag hier — dieselbe Pflicht wie beim Rundgang. Öffentliche Seiten, die
// dieselbe Zahl zeigen, stehen bei `seiten`.
//
// Diese Datei ist bewusst REIN (keine Abhängigkeiten außer Typen).
// ═══════════════════════════════════════════════════════════════════════════

export type Bereich = "recht" | "auskunftei" | "zahlen" | "fiaon" | "haus";

export interface Fakt {
  /** Eindeutiger Schlüssel — steht im Zitat des Copilot. */
  key: string;
  bereich: Bereich;
  /** Kurzer Titel — was der Eintrag beantwortet. */
  titel: string;
  /** Die Fakten, in ganzen Sätzen, mit Zahlen. */
  text: string;
  /** Datum, ab dem es gilt oder an dem es geprüft wurde (JJJJ-MM-TT). */
  stand: string;
  /** Wo es belegt ist — Gesetz, Tabelle, Entscheidung, Hausregel. */
  quelle: string;
  /** Suchwörter — klein, ohne Umlaute wird beim Suchen selbst normalisiert. */
  worte: string[];
  /** Öffentliche Seiten, die dasselbe zeigen (Pfad ohne Host). */
  seiten?: string[];
}

export const FACHWISSEN: Fakt[] = [
  // ── Auskunfteien ──────────────────────────────────────────────────────────
  {
    key: "schufa-score-2026", bereich: "auskunftei",
    titel: "Der neue SCHUFA-Score (seit 17.03.2026)",
    text: "Seit dem 17. März 2026 gibt es einen einzigen SCHUFA-Score von 100 bis 999 Punkten, berechnet aus zwölf Kriterien; Basisscore und Branchenscores sind für Privatpersonen abgelöst. Fünf Klassen: hervorragend 776–999 (etwa 62 % der Menschen), gut 709–775 (etwa 20 %), akzeptabel 642–708 (etwa 8 %), ausreichend 100–641 (etwa 2 %), ungenügend bei offener Zahlungsstörung (etwa 8 %). Zahlungsstörungen wiegen mit bis zu 264 Punkten am schwersten. Für Unternehmen läuft eine Übergangsfrist bis Ende 2028. Der Score wird nicht „verbessert“ — er folgt den Daten; erledigte und gelöschte Einträge verändern ihn.",
    stand: "2026-03-17", quelle: "SCHUFA Holding AG, Veröffentlichung zum neuen Score (März 2026)",
    worte: ["schufa", "score", "punkte", "klasse", "hervorragend", "basisscore", "branchenscore", "zahlungsstoerung", "kriterien"],
    seiten: ["/schufa-score-verstehen", "/ratgeber/neuer-schufa-score-2026-was-sich-aendert"],
  },
  {
    key: "datenkopie-art-15", bereich: "auskunftei",
    titel: "Die kostenlose Datenkopie (Art. 15 DSGVO)",
    text: "Jede Auskunftei (SCHUFA, KSV1870, CRIF, Intrum) muss auf Antrag eine kostenlose Datenkopie liefern — Einträge, Anfragen, Score-Werte, Empfänger — innerhalb eines Monats. Sie ist nicht die kostenpflichtige Bonitätsauskunft für Vermieter. Musterbrief: /werkzeuge/selbstauskunft.",
    stand: "2026-09-02", quelle: "Art. 15 DSGVO, Art. 12 Abs. 3 DSGVO",
    worte: ["datenkopie", "selbstauskunft", "art. 15", "kostenlos", "auskunft", "ksv", "crif", "intrum"],
    seiten: ["/werkzeuge/selbstauskunft", "/bonitaetsauskunft-beantragen"],
  },
  {
    key: "loeschfristen", bereich: "auskunftei",
    titel: "Löschfristen der Auskunfteien",
    text: "Erledigte Forderungen werden drei Jahre nach Erledigung taggenau gelöscht. Wird eine gemeldete Forderung innerhalb von 100 Tagen nach der Meldung beglichen und liegen keine weiteren Einträge vor, sind es 18 Monate. Restschuldbefreiung: sechs Monate nach Eintragung (EuGH 7.12.2023, C-634/21). Kreditanfragen bleiben zwölf Monate gespeichert und sind zehn Tage für Dritte sichtbar; Konditionsanfragen sind neutral. Rechner: /werkzeuge/loeschfrist.",
    stand: "2025-01-01", quelle: "Verhaltensregeln der Wirtschaftsauskunfteien (Code of Conduct), EuGH C-634/21",
    worte: ["loeschfrist", "loeschung", "geloescht", "drei jahre", "100 tage", "18 monate", "restschuldbefreiung", "anfrage", "konditionsanfrage", "schufa", "erledigt", "bezahlt", "bleibt", "gespeichert", "eintrag"],
    seiten: ["/werkzeuge/loeschfrist", "/schufa-eintrag-loeschen"],
  },
  {
    key: "meldung-31-bdsg", bereich: "recht",
    titel: "Wann eine offene Forderung gemeldet werden darf (§ 31 Abs. 2 BDSG)",
    text: "Eine nicht titulierte Forderung darf nur gemeldet werden, wenn sie fällig und nicht bestritten ist, der Schuldner zweimal schriftlich gemahnt wurde (mindestens vier Wochen Abstand), in der Mahnung auf die Meldung hingewiesen wurde und die Meldung frühestens vier Wochen nach der ersten Mahnung erfolgt. Fehlt eine Voraussetzung, ist der Eintrag angreifbar (Widerspruch, Löschantrag Art. 17 DSGVO). Prüfer: /werkzeuge/eintrag-pruefen, Brief: /werkzeuge/widerspruch.",
    stand: "2026-09-02", quelle: "§ 31 Abs. 2 BDSG; Art. 16, 17, 77 DSGVO",
    worte: ["meldung", "mahnung", "bestritten", "31 bdsg", "widerspruch", "loeschantrag", "angreifbar", "titel"],
    seiten: ["/werkzeuge/eintrag-pruefen", "/werkzeuge/widerspruch"],
  },
  // ── Recht ─────────────────────────────────────────────────────────────────
  {
    key: "inkassokosten", bereich: "recht",
    titel: "Zulässige Inkassokosten (§ 13e RDG)",
    text: "Inkassokosten sind seit dem 1. Oktober 2021 an die Rechtsanwaltsvergütung gekoppelt: in der Regel eine 0,9-Geschäftsgebühr, bei einer ersten Zahlungsaufforderung und sofortiger Zahlung 0,5; bei Forderungen bis 50 Euro nur eine 0,5-Gebühr (rund 24,50 Euro), es sei denn, die Sache war besonders umfangreich. Auslagenpauschale höchstens 20 % der Gebühr, maximal 20 Euro. Inkassodienste müssen nach § 13a RDG Forderung, Gläubiger und Kosten aufschlüsseln. Prüfer: /werkzeuge/inkassokosten, Antwortbrief: /werkzeuge/inkasso-antwort.",
    stand: "2021-10-01", quelle: "§ 13e RDG, § 13a RDG, RVG Nr. 2300 VV",
    worte: ["inkasso", "inkassokosten", "gebuehr", "13e rdg", "13a rdg", "auslagen", "rvg", "mahngebuehr"],
    seiten: ["/werkzeuge/inkassokosten", "/werkzeuge/inkasso-antwort", "/werkzeuge/mahngebuehren"],
  },
  {
    key: "verjaehrung", bereich: "recht",
    titel: "Verjährung von Forderungen",
    text: "Die regelmäßige Verjährungsfrist beträgt drei Jahre und beginnt mit dem Ende des Jahres, in dem die Forderung entstanden ist und der Gläubiger davon wusste. Titulierte Forderungen (Vollstreckungsbescheid, Urteil) verjähren nach 30 Jahren. Verjährung wirkt nur auf Einrede — sie muss ausdrücklich erhoben werden. Rechner: /werkzeuge/verjaehrung.",
    stand: "2026-09-02", quelle: "§§ 195, 199, 197 BGB, § 214 BGB",
    worte: ["verjaehrung", "verjaehrt", "einrede", "drei jahre", "30 jahre", "titel", "vollstreckungsbescheid"],
    seiten: ["/werkzeuge/verjaehrung"],
  },
  {
    key: "mahnbescheid", bereich: "recht",
    titel: "Mahnbescheid: zwei Wochen Widerspruch",
    text: "Gegen einen gerichtlichen Mahnbescheid kann innerhalb von zwei Wochen ab Zustellung Widerspruch eingelegt werden (§ 694 ZPO); ohne Widerspruch folgt der Vollstreckungsbescheid, gegen den zwei Wochen Einspruch möglich sind (§ 700 ZPO). Ein Widerspruch ist keine Begründung — er hält nur das Verfahren an. Muster: /werkzeuge/mahnbescheid (Muster, keine Rechtsdienstleistung).",
    stand: "2026-09-02", quelle: "§§ 692, 694, 700 ZPO",
    worte: ["mahnbescheid", "widerspruch", "zwei wochen", "vollstreckungsbescheid", "einspruch", "zpo", "frist"],
    seiten: ["/werkzeuge/mahnbescheid"],
  },
  {
    key: "basiskonto", bereich: "recht",
    titel: "Recht auf ein Basiskonto (§§ 31–48 ZKG)",
    text: "Jeder Verbraucher mit rechtmäßigem Aufenthalt in der EU hat Anspruch auf ein Basiskonto bei jeder Bank, die Zahlungskonten anbietet — unabhängig von Bonität oder Einträgen. Die Bank muss innerhalb von zehn Geschäftstagen entscheiden; eine Ablehnung ist schriftlich zu begründen, dagegen hilft die BaFin (Verwaltungsverfahren nach § 48 ZKG). Antrag: /werkzeuge/basiskonto.",
    stand: "2026-09-02", quelle: "Zahlungskontengesetz §§ 31–48 ZKG",
    worte: ["basiskonto", "girokonto", "zkg", "konto", "ablehnung", "bafin", "jedermann"],
    seiten: ["/werkzeuge/basiskonto"],
  },
  {
    key: "pfaendungsfreigrenzen-2026", bereich: "zahlen",
    titel: "Pfändungsfreigrenzen ab 1.7.2026",
    text: "Unpfändbar sind ab dem 1. Juli 2026 monatlich 1.587,40 Euro netto; mit der ersten Unterhaltspflicht kommen 597,42 Euro dazu, mit der zweiten bis fünften je 332,83 Euro. Ab 4.866,30 Euro ist alles darüber voll pfändbar. Vorjahr (ab 1.7.2025): 1.555,00 / 585,23 / 326,04 / 4.766,90 Euro. Rechner: /werkzeuge/pfaendungsrechner.",
    stand: "2026-07-01", quelle: "Pfändungsfreigrenzenbekanntmachung 2026, § 850c ZPO",
    worte: ["pfaendung", "pfaendungsfreigrenze", "unpfaendbar", "850c", "lohnpfaendung", "kontopfaendung", "p-konto", "unterhalt"],
    seiten: ["/werkzeuge/pfaendungsrechner"],
  },
  {
    key: "dispozins", bereich: "zahlen",
    titel: "Dispozinsen im Schnitt",
    text: "Der durchschnittliche Dispozins in Deutschland lag im November 2025 bei rund 11,3 % im Jahr (Verivox). Wer dauerhaft im Dispo steht, zahlt bei 2.000 Euro Überziehung etwa 19 Euro Zinsen im Monat. Rechner: /werkzeuge/dispo-rechner.",
    stand: "2025-11-01", quelle: "Verivox Dispozins-Auswertung 11/2025",
    worte: ["dispo", "dispozins", "ueberziehung", "zinsen", "girokonto"],
    seiten: ["/werkzeuge/dispo-rechner"],
  },
  {
    key: "scoring-eugh", bereich: "recht",
    titel: "Scoring als automatisierte Entscheidung (EuGH 7.12.2023)",
    text: "Der EuGH hat am 7. Dezember 2023 (C-634/21) entschieden, dass ein Score eine automatisierte Entscheidung im Sinne von Art. 22 DSGVO sein kann, wenn Vertragspartner ihn maßgeblich für Ja/Nein nutzen. Betroffene haben dann Anspruch auf Erklärung und menschliche Überprüfung. Beschwerde: Datenschutzbehörde (Art. 77 DSGVO) oder SCHUFA-Ombudsmann.",
    stand: "2023-12-07", quelle: "EuGH, Urteil vom 7.12.2023, C-634/21 (SCHUFA Holding)",
    worte: ["eugh", "scoring", "automatisierte entscheidung", "art. 22", "ombudsmann", "beschwerde"],
    seiten: ["/schufa-score-verstehen"],
  },
  // ── Das Haus: Regeln für Mitarbeiter ─────────────────────────────────────
  {
    key: "erste-zahlung-direkt", bereich: "haus",
    titel: "Die erste Zahlung ist IMMER eine Überweisung",
    text: "Die erste Rate zahlt der Kunde selbst per Überweisung mit Referenz — nie per Lastschrift. Zahlungsdaten gehen nur über die Mailvorlage aus der Akte (payment_details) hinaus, nie aus dem Kopf: Die Bankverbindung hat eine einzige Quelle im System. Danach entscheidet der Kunde über SEPA-Lastschrift.",
    stand: "2026-08-23", quelle: "Justin, Mitarbeiter-Office-Plan 23.08.2026 §13; Leitfäden A/B/C",
    worte: ["erste zahlung", "ueberweisung", "lastschrift", "zahlungsdaten", "referenz", "bankverbindung", "iban"],
  },
  {
    key: "mandat-und-provision", bereich: "haus",
    titel: "Mandat, Provision, Arbeitsliste",
    text: "Ein Mandat gehört dem Mitarbeiter, der den Kunden zur ZAHLUNG gebracht hat (eigene Provision) — nicht dem, der das Startgespräch führt: Das Startgespräch bringt eine Onboarding-Provision, aber kein Mandat (E-066, 24.08.2026). Die Provision entsteht bei der Zahlung — 25 % je bezahlter Rate (plus 5 % Academy), genau einmal je Kunde und Rate, nie beim Klick auf „Ich habe bezahlt“. Die Arbeitsliste zeigt sechs Kunden; der Bestand eines Mitarbeiters ist auf 500 Mandate begrenzt. Vor dem Mandat besitzt niemand einen Kunden: Die Arbeitsliste zieht aus dem gemeinsamen Pool, ein nicht bearbeiteter Kunde fällt nach drei Tagen zurück.",
    stand: "2026-08-25", quelle: "Entscheidungsregister E-066 (Mandate, 24.08.2026: Provisionsempfänger = Mandatsinhaber; Startgespräch ≠ Mandat), Kundenpool 25.08.2026, Academy Kapitel „Die Provision entsteht bei der Zahlung“",
    worte: ["mandat", "provision", "arbeitsliste", "bestand", "pool", "kundenpool", "500", "rueckfall", "verdienst"],
  },
  {
    key: "reaktivierung-bonus", bereich: "haus",
    titel: "Reaktivierung: 50 % nur für den Altbestand",
    text: "Wer einen Kunden aus dem Altbestand mit überfälliger Rate weich zurückholt (Leitfaden Reaktivierung: vorstellen, entschuldigen, Zahlung oder ein Monat Aussetzen, Termin), bekommt 50 % der zurückgeholten Rate — nur für den Altbestand (E-042a), nie für eigene Neukunden. Im Onboarding gibt es 10 Euro je 74-Euro-Zahlung für die Bonitätsauskunft.",
    stand: "2026-08-24", quelle: "Entscheidungsregister E-042/E-042a; Pipeline (REAKTIVIERUNG_ANTEIL, SCHUFA_BONUS_TEXT)",
    worte: ["reaktivierung", "bonus", "50 %", "altbestand", "schufa-bonus", "rate ueberfaellig"],
  },
  {
    key: "wortverbote", bereich: "haus",
    titel: "Wortverbote in jedem Kundentext",
    text: "Nie: Beratung/beraten, Empfehlung/empfehlen, Garantie/garantiert, „sicher klappt“, „wir verbessern Ihren Score“, „Löschung garantiert“, Affiliate. Karte, Konto und Rahmen sind Ziel, nie Zusage — die Bank entscheidet. FIAON ist keine Rechtsberatung im Einzelfall; Briefe sind Muster. Der Server prüft kundengerichtete Texte gegen diese Liste (verboteneKundenworte).",
    stand: "2026-08-30", quelle: "AGENTS.md; server/lib/fiaon-assistent-werkzeuge.ts (WORTVERBOTE); Academy Wortprüfer",
    worte: ["wortverbot", "garantie", "beratung", "empfehlung", "score verbessern", "affiliate", "sie-form", "compliance"],
  },
  {
    key: "copilot-grenzen", bereich: "haus",
    titel: "Was der Copilot nie tut",
    text: "Keine Löschungen, keine DSGVO-Aktionen, keine Zahlungs- oder Ratenbuchungen — solche Werkzeuge gibt es nicht. Höchstens fünf Kunden je Auftrag. Alles mit Folgen für Geld, Zugänge oder Kundenkommunikation wird vorbereitet und wartet auf den Klick des Menschen; eine Vorbereitung verfällt nach 15 Minuten. Jede Aktion steht als „KI-Assistent im Auftrag von …“ im Verlauf der Akte.",
    stand: "2026-08-30", quelle: "server/lib/fiaon-assistent-werkzeuge.ts (Harte Grenzen); server/routes/fiaon-assistent.ts",
    worte: ["copilot", "grenzen", "bestaetigen", "loeschen", "15 minuten", "fuenf kunden", "audit"],
  },
  {
    key: "kundenweg", bereich: "fiaon",
    titel: "Der Weg eines Kunden bei FIAON",
    text: "Antrag (etwa zwei Minuten) → Vertrag annehmen → erste Rate per Überweisung → Startgespräch (15 Minuten, Pflicht; bis dahin bleibt der Bereich geschlossen) → Bereich voll aktiv → Vollmacht, Bonitätsauskunft (Einsicht etwa 24 Stunden nach Eingang), Kontoauszug-Analyse → Schreiben (Kunde gibt frei, FIAON versendet und verfolgt) → Girokonto → Kreditkarte, sobald die Schwelle des Partners erreicht ist (Bank entscheidet). Etappen heißen im Kundenbereich: Startgespräch, Unterlagen, Bonitätsauskunft, Analyse, Schreiben, Girokonto, Kreditkarte. Kontostufen: kein_zugang (unbezahlt), wartet_auf_onboarding (bezahlt, kein Startgespräch), voll_aktiv.",
    stand: "2026-09-02", quelle: "shared/fiaon-wissen.ts; server/lib/fiaon-kundenstufe.ts",
    worte: ["kundenweg", "etappe", "startgespraech", "onboarding", "kontostufe", "voll_aktiv", "wartet_auf_onboarding", "fahrplan"],
    seiten: ["/plattform-konzept", "/was-ist-fiaon"],
  },
];

/** Umlaute und Sonderzeichen für die Suche vereinheitlichen. */
export function suchNormal(text: string): string {
  return String(text || "")
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9 §%.,/-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
