// ═══════════════════════════════════════════════════════════════════════════
// DER RATGEBER — Themenplan, Hausstil, Prüfstand (23.08.2026)
//
// Justin: „Blog mit drei hochwertigen Artikeln, jeden Tag drei neue Entwürfe,
// ich schaue drüber (Text, Vorschau), dann wird veröffentlicht. Der Generator
// muss auf uns abgestimmt sein. Ratgeber wirklich SEHR hilfreich, realitäts-
// bezogen, gutes Wording für die Zielgruppe. Autorin: eine fiktive Person."
//
// Dieses Modul ist `shared/`, weil drei Orte dieselbe Wahrheit brauchen: der
// Generator (Server), der Prüfstand (Server + Admin-Vorschau) und die Seite.
// Ein Wort, das man nicht schreiben soll, gehört in eine Prüfung — nicht in
// eine Schulung, die man vergisst (siehe fiaon-onboarding-agenda.ts).
//
// ── E-379 (15.10.2026): ZWEI BEREICHE, JEDEN TAG EIN ARTIKEL JE BEREICH ─────
// Justin: „Die Redaktion erstellt keine Artikel mehr. Es muss jeden Tag 1 neuer
// Artikel für die Privatkunden-Seite und 1 neuer für die Business-Kunden live
// gehen — immer aktuell und PERFEKT passend."
// Der feste Themenplan (40 Themen) war aufgebraucht, und der Generator schrieb
// nur Entwürfe, die liegen blieben. Jetzt sucht die Redaktion ihr Thema selbst
// (Websuche, server/lib/fiaon-ratgeber-redaktion.ts), schreibt es im Hausstil
// des Bereichs und veröffentlicht, sobald der STRENGE Prüfstand (unten,
// `streng: true`) nichts mehr findet. Der Bereich (privat | business) hängt an
// der Kategorie: „firmen" ist Business, alles andere privat — eine Funktion,
// bereichVonKategorie, entscheidet das überall.
// ═══════════════════════════════════════════════════════════════════════════
import { worthygiene } from "./fiaon-onboarding-agenda";
import { wandPruefen } from "./fiaon-wortverbote";
import { GLOBAL_SCHAERFER } from "./fiaon-global-wortregeln";

export type Land = "DE" | "AT" | "CH" | "DACH";
export type Kategorie = "eintraege" | "auskunft" | "karte" | "kredit" | "score" | "inkasso" | "at" | "ch" | "grundlagen" | "firmen";
export type Status = "entwurf" | "geprueft" | "veroeffentlicht" | "archiv";
/** E-379: Für wen der Artikel geschrieben ist — die Privatkunden-Seite (/ratgeber) oder FIAON Global (/business). */
export type Bereich = "privat" | "business";
export const BEREICHE: Bereich[] = ["privat", "business"];
export const BEREICH_LABEL: Record<Bereich, string> = { privat: "Privat", business: "Business" };

export const KATEGORIEN: Record<Kategorie, { label: string; kurz: string }> = {
  eintraege: { label: "Einträge löschen", kurz: "Welche Einträge angreifbar sind – und wie" },
  auskunft: { label: "Auskunft & Datenkopie", kurz: "Was gespeichert ist, und wie Sie es erfahren" },
  karte: { label: "Kreditkarte & Konto", kurz: "Was trotz Eintrag realistisch ist" },
  kredit: { label: "Kredit & Umschuldung", kurz: "Ehrlich: was geht, was nicht" },
  score: { label: "Score & Bonität", kurz: "Wie der Wert entsteht – und was ihn bewegt" },
  inkasso: { label: "Inkasso & Mahnung", kurz: "Rechte, Fristen, Einigung" },
  at: { label: "Österreich · KSV", kurz: "Auskunft, Einträge, Löschung in Österreich" },
  ch: { label: "Schweiz · CRIF & Betreibung", kurz: "Auszug, Einträge, Löschung in der Schweiz" },
  grundlagen: { label: "Grundlagen", kurz: "Begriffe, die jeder kennen sollte" },
  // E-379: Die Business-Artikel (FIAON Global) — seit 09.09.2026 in der Tabelle, bis heute ohne Eintrag hier.
  firmen: { label: "Für Unternehmen", kurz: "Firmenbonität, Gründung, Kapital, internationale Strukturen" },
};

/** E-379: Die EINE Regel, welcher Bereich zu einer Kategorie gehört. */
export function bereichVonKategorie(k: string | null | undefined): Bereich {
  return k === "firmen" ? "business" : "privat";
}

/** Die Kategorien, die ein Bereich benutzt (Themenfinder, Redaktion). */
export function kategorienFuer(b: Bereich): Kategorie[] {
  return (Object.keys(KATEGORIEN) as Kategorie[]).filter((k) => bereichVonKategorie(k) === b);
}

/** Die fiktive Autorin — niemand aus dem Team (Justin). */
export const AUTORIN = {
  name: "Johanna Brecht",
  rolle: "Redakteurin für Verbraucherfinanzen",
  bild: "/portraits/johanna.jpg",
  kurz: "Schreibt bei FIAON über Auskunfteien, Verbraucherrecht und den Weg zurück zu guter Bonität – verständlich, geprüft, ohne Versprechen.",
  lang: "Johanna Brecht schreibt seit über zehn Jahren über Verbraucherfinanzen. Bei FIAON verantwortet sie den Ratgeber: Jeder Text wird gegen Gesetzestexte, die Verhaltensregeln der Auskunfteien und die Praxis aus FIAON-Akten geprüft, bevor er erscheint. Sie erklärt, was geht – und sagt klar, was nicht geht.",
};

export interface Thema { slug: string; titel: string; keyword: string; kategorie: Kategorie; land: Land; fokus: string }

/** Der Themenplan — aus Suchvolumen und echten Kundenfragen. Der Generator nimmt die nächsten unbenutzten. */
export const THEMEN: Thema[] = [
  { slug: "schufa-eintrag-loeschen-lassen", titel: "SCHUFA-Eintrag löschen lassen: Welche Einträge angreifbar sind – und wie Sie vorgehen", keyword: "schufa eintrag löschen", kategorie: "eintraege", land: "DE", fokus: "Löschfristen, Meldevoraussetzungen § 31 BDSG, Löschantrag Art. 17 DSGVO, Schritt für Schritt" },
  { slug: "kreditkarte-trotz-schufa-eintrag", titel: "Kreditkarte trotz SCHUFA-Eintrag: Was realistisch ist – und was nicht", keyword: "kreditkarte trotz schufa", kategorie: "karte", land: "DE", fokus: "Debit vs. Kreditkarte, Prepaid, Girokonto für jeden, wann eine echte Karte möglich wird" },
  { slug: "schufa-auskunft-kostenlos-datenkopie", titel: "SCHUFA-Auskunft kostenlos: Die Datenkopie nach Art. 15 DSGVO – Schritt für Schritt", keyword: "schufa auskunft kostenlos", kategorie: "auskunft", land: "DE", fokus: "Unterschied Datenkopie / Bonitätsauskunft, Frist ein Monat, wie oft, was drinsteht, wie lesen" },
  { slug: "kredit-ohne-schufa-die-ehrliche-antwort", titel: "Kredit ohne SCHUFA: Warum das die falsche Frage ist – und was stattdessen funktioniert", keyword: "kredit ohne schufa", kategorie: "kredit", land: "DE", fokus: "Warnsignale, Vorkasse-Betrug, was seriös ist, der Weg über die bereinigte Auskunft" },
  { slug: "schufa-score-verstehen", titel: "SCHUFA-Score verstehen: die neue Skala 100–999, zwölf Kriterien und was den Wert wirklich bewegt", keyword: "schufa score", kategorie: "score", land: "DE", fokus: "Neuer Score seit 17.03.2026 (100–999, fünf Klassen, zwölf Kriterien); Basisscore, Branchenscores, Scoreklassen, harte vs. weiche Merkmale, Mythen" },
  { slug: "schufa-eintrag-trotz-zahlung", titel: "Eintrag trotz Zahlung: Warum bezahlte Forderungen stehen bleiben – und wann sie weg müssen", keyword: "schufa eintrag trotz bezahlung", kategorie: "eintraege", land: "DE", fokus: "Erledigungsvermerk, 3-Jahres-Frist, 100-Tage-Regel seit 2024, Löschantrag" },
  { slug: "inkasso-schreiben-erhalten-was-tun", titel: "Inkasso-Schreiben erhalten: Was Sie prüfen müssen, bevor Sie zahlen", keyword: "inkasso schreiben was tun", kategorie: "inkasso", land: "DE", fokus: "Berechtigung prüfen, Inkassokosten, Verjährung, Widerspruch, Ratenangebot" },
  { slug: "negativer-schufa-eintrag-folgen", titel: "Negativer SCHUFA-Eintrag: Was er konkret bedeutet – für Konto, Handyvertrag, Wohnung", keyword: "negativer schufa eintrag", kategorie: "grundlagen", land: "DE", fokus: "Arten von Einträgen, Wirkung im Alltag, Dauer, erste Schritte" },
  { slug: "schufa-eintrag-falsch-berichtigen", titel: "Falscher SCHUFA-Eintrag: So lassen Sie ihn berichtigen", keyword: "schufa eintrag falsch", kategorie: "eintraege", land: "DE", fokus: "Art. 16 DSGVO, Belege, Frist, Beschwerde bei der Datenschutzbehörde" },
  { slug: "girokonto-trotz-schufa", titel: "Girokonto trotz SCHUFA: Das Basiskonto, auf das Sie ein Recht haben", keyword: "girokonto trotz schufa", kategorie: "karte", land: "DE", fokus: "Zahlungskontengesetz, Basiskonto, welche Banken, Kosten, Unterschied zum normalen Konto" },
  { slug: "restschuldbefreiung-schufa-loeschung", titel: "Restschuldbefreiung und SCHUFA: Warum der Eintrag nach sechs Monaten weg muss", keyword: "restschuldbefreiung schufa", kategorie: "eintraege", land: "DE", fokus: "BGH-Urteil 2023, Sechs-Monats-Frist, Vorgehen, Insolvenzbekanntmachungen" },
  { slug: "schufa-eintrag-verjaehrung", titel: "Verjährung und SCHUFA-Eintrag: Was die Verjährung ändert – und was nicht", keyword: "schufa eintrag verjährt", kategorie: "eintraege", land: "DE", fokus: "Regelverjährung drei Jahre, titulierte Forderungen 30 Jahre, Einrede, Wirkung auf den Eintrag" },
  { slug: "ksv-auskunft-oesterreich", titel: "KSV-Auskunft in Österreich: So erfahren Sie, was der KSV1870 über Sie speichert", keyword: "ksv auskunft", kategorie: "at", land: "AT", fokus: "Selbstauskunft nach DSGVO, Warenkreditevidenz, Fristen, Löschung" },
  { slug: "ksv-eintrag-loeschen", titel: "KSV-Eintrag löschen lassen: Rechte, Fristen und der Weg zur Löschung in Österreich", keyword: "ksv eintrag löschen", kategorie: "at", land: "AT", fokus: "Löschfristen, Datenschutzbehörde Österreich, Vorgehen Schritt für Schritt" },
  { slug: "crif-auszug-schweiz", titel: "CRIF-Auszug in der Schweiz: Was gespeichert ist und wie Sie es einsehen", keyword: "crif auszug", kategorie: "ch", land: "CH", fokus: "Auskunftsrecht nach DSG, Unterschied zum Betreibungsauszug, Kosten, Berichtigung" },
  { slug: "betreibungsauszug-schweiz-erklaert", titel: "Betreibungsauszug in der Schweiz: Was drinsteht, wer ihn sieht und wie Einträge verschwinden", keyword: "betreibungsauszug", kategorie: "ch", land: "CH", fokus: "Art. 8a SchKG, Nichtbekanntgabe, Löschung nach fünf Jahren, Vermieter und Arbeitgeber" },
  { slug: "schufa-loeschfristen-uebersicht", titel: "SCHUFA-Löschfristen im Überblick: Wann welcher Eintrag verschwindet", keyword: "schufa löschfristen", kategorie: "grundlagen", land: "DE", fokus: "Tabelle je Eintragsart, Verhaltensregeln der Auskunfteien, Änderungen 2024" },
  { slug: "mahnung-erhalten-rechte", titel: "Mahnung erhalten: Welche Mahnung zählt – und wann ein Eintrag drohen darf", keyword: "mahnung schufa eintrag", kategorie: "inkasso", land: "DE", fokus: "Zwei Mahnungen, vier Wochen, Hinweis auf Eintrag, Bestreiten, § 31 BDSG" },
  { slug: "handyvertrag-trotz-schufa", titel: "Handyvertrag trotz SCHUFA: Welche Wege offen sind", keyword: "handyvertrag trotz schufa", kategorie: "karte", land: "DE", fokus: "Prepaid, Anbieter ohne Abfrage, Kaution, warum Mobilfunk-Einträge so häufig sind" },
  { slug: "wohnung-trotz-schufa", titel: "Wohnung trotz SCHUFA-Eintrag: Was Vermieter sehen dürfen – und wie Sie überzeugen", keyword: "wohnung trotz schufa", kategorie: "grundlagen", land: "DE", fokus: "Mieterselbstauskunft, welche Auskunft Vermieter bekommen, Bürgschaft, ehrliches Gespräch" },
  { slug: "schufa-selbstauskunft-lesen", titel: "SCHUFA-Selbstauskunft lesen: Was die einzelnen Zeilen bedeuten", keyword: "schufa auskunft lesen", kategorie: "auskunft", land: "DE", fokus: "Aufbau der Datenkopie, Vertragsdaten, Anfragen, Negativmerkmale, Erledigungsvermerk" },
  { slug: "kreditanfrage-vs-konditionsanfrage", titel: "Kreditanfrage oder Konditionsanfrage: Der kleine Unterschied, der Ihren Score schützt", keyword: "konditionsanfrage schufa", kategorie: "score", land: "DE", fokus: "Anfragearten, Sichtbarkeit, Dauer, Vergleichsportale" },
  { slug: "schufa-ombudsmann-beschwerde", titel: "Beschwerde gegen die SCHUFA: Ombudsmann, Datenschutzbehörde, Klage – der richtige Weg", keyword: "schufa beschwerde", kategorie: "eintraege", land: "DE", fokus: "Reihenfolge, Fristen, Formulierung, Erfolgsaussichten" },
  { slug: "dispo-kuendigung-schufa", titel: "Dispo gekündigt: Was das mit Ihrer Bonität macht – und wie Sie reagieren", keyword: "dispo gekündigt", kategorie: "score", land: "DE", fokus: "Rückzahlung, Ratenvereinbarung mit der Bank, Eintrag vermeiden" },
  { slug: "ratenzahlung-vereinbaren-glaeubiger", titel: "Ratenzahlung mit dem Gläubiger vereinbaren: So formulieren Sie ein Angebot, das angenommen wird", keyword: "ratenzahlung vereinbaren", kategorie: "inkasso", land: "DE", fokus: "Haushaltsrechnung, realistische Rate, Schriftform, Erledigungsvermerk sichern" },
  { slug: "vergleich-mit-inkasso", titel: "Vergleich mit dem Inkassounternehmen: Wann ein Teilverzicht realistisch ist", keyword: "inkasso vergleich", kategorie: "inkasso", land: "DE", fokus: "Verhandlungsspielraum, Einmalzahlung, schriftliche Bestätigung, Eintrag" },
  { slug: "bonitaet-aufbauen-nach-insolvenz", titel: "Bonität nach der Insolvenz aufbauen: Die ersten zwölf Monate", keyword: "bonität nach insolvenz", kategorie: "score", land: "DE", fokus: "Löschung des Eintrags, Konto, kleine Verträge pünktlich, Geduld" },
  { slug: "schufa-und-stromvertrag", titel: "Stromvertrag trotz SCHUFA: Grundversorgung, Vorkasse und was Sie wissen sollten", keyword: "strom trotz schufa", kategorie: "grundlagen", land: "DE", fokus: "Grundversorgungspflicht, Anbieterwechsel, Einträge durch Energieschulden" },
  { slug: "bonitaetsauskunft-fuer-vermieter", titel: "Bonitätsauskunft für den Vermieter: Welche Sie brauchen und was sie kostet", keyword: "schufa bonitätsauskunft vermieter", kategorie: "auskunft", land: "DE", fokus: "Zwei Dokumente, Kosten, was der Vermieter sieht, Alternativen" },
  { slug: "schufa-eintrag-nach-umzug", titel: "Alte Adresse, neuer Eintrag: Warum Umzüge zu Einträgen führen – und wie Sie das verhindern", keyword: "schufa eintrag nach umzug", kategorie: "eintraege", land: "DE", fokus: "Nachsendung, unbekannt verzogen, Mahnungen, Ummeldung" },
  { slug: "bonitaet-in-oesterreich-grundlagen", titel: "Bonität in Österreich: KSV1870, CRIF und die Warenkreditevidenz erklärt", keyword: "bonität österreich", kategorie: "at", land: "AT", fokus: "Wer speichert was, Rechte nach DSGVO, typische Einträge" },
  { slug: "bonitaet-in-der-schweiz-grundlagen", titel: "Bonität in der Schweiz: CRIF, Intrum, ZEK und der Betreibungsauszug", keyword: "bonität schweiz", kategorie: "ch", land: "CH", fokus: "Wer speichert was, DSG, Auskunftsrecht, Unterschiede zu Deutschland" },
  { slug: "kreditkarte-mit-sicherheitsleistung", titel: "Kreditkarte mit Kaution: Der Weg zur echten Karte, wenn die Bonität noch nicht reicht", keyword: "kreditkarte mit kaution", kategorie: "karte", land: "DACH", fokus: "Funktionsweise, Kosten, Anbieter, Übergang zur normalen Karte" },
  { slug: "schufa-anfragen-zu-viele", titel: "Zu viele Anfragen in der SCHUFA? Was Anfragen bewirken und wie lange sie sichtbar bleiben", keyword: "schufa anfragen", kategorie: "score", land: "DE", fokus: "Zwölf Monate, Sichtbarkeit zehn Tage, Konditionsanfrage" },
  { slug: "inkasso-kosten-pruefen", titel: "Inkassokosten prüfen: Was Inkasso verlangen darf – und was nicht", keyword: "inkassokosten", kategorie: "inkasso", land: "DE", fokus: "RDG, Gebührenhöhe, Verzug, Widerspruch gegen überhöhte Kosten" },
  { slug: "schufa-eintrag-ohne-mahnung", titel: "Eintrag ohne Mahnung: Warum er meist unzulässig ist – und wie Sie ihn entfernen lassen", keyword: "schufa eintrag ohne mahnung", kategorie: "eintraege", land: "DE", fokus: "§ 31 Abs. 2 BDSG, Beweislast, Widerspruch, Datenschutzbehörde" },
  { slug: "bonitaet-und-selbststaendigkeit", titel: "Bonität als Selbstständiger: Was Auskunfteien über Unternehmer speichern", keyword: "schufa selbstständig", kategorie: "grundlagen", land: "DE", fokus: "B2B-Auskünfte, Creditreform, Unternehmerbonität, Trennung privat/geschäftlich" },
  { slug: "schulden-priorisieren-welche-zuerst", titel: "Welche Schulden zuerst? Eine ehrliche Reihenfolge für den Weg zurück", keyword: "schulden abbauen reihenfolge", kategorie: "score", land: "DACH", fokus: "Existenzsichernde Zahlungen, titulierte Forderungen, Einträge, Kleinbeträge" },
  { slug: "schufa-datenkopie-wie-oft", titel: "Wie oft darf ich die kostenlose Datenkopie anfordern? Und wann es sinnvoll ist", keyword: "schufa datenkopie wie oft", kategorie: "auskunft", land: "DE", fokus: "Angemessene Abstände, Anlässe, Monitoring als Alternative" },
  { slug: "bonitaet-monitoring-warum", titel: "Bonität überwachen: Warum ein Abgleich pro Monat Einträge verhindert", keyword: "bonität überwachen", kategorie: "score", land: "DACH", fokus: "Frühwarnung, Anfragen erkennen, Identitätsmissbrauch" },
];

/** Der Hausstil für den Generator — und der Maßstab für den Prüfstand. */
export const HAUSSTIL = `Du schreibst für den FIAON-Ratgeber (fiaon.com). FIAON ist eine Bonitätsplattform für Deutschland, Österreich und die Schweiz:
FIAON zeigt mit der FIAON-Bonitätsauswertung die Bonität aus Sicht einer Bank (aus Ausweis und Kontoauszügen), erklärt jeden Eintrag einer
Datenkopie (SCHUFA, KSV, CRIF — die fordert der Mensch selbst kostenlos an), bereitet Schreiben vor (Löschantrag, Widerspruch,
Ratenangebot, Selbstauskunft) und versendet sie, verfolgt Fristen und Antworten, und öffnet danach die Tür zu Girokonto, Kreditkarte und Finanzierung.

ZIELGRUPPE: Menschen mit einem negativen Eintrag oder Sorge davor — oft beschämt, oft von Mahnungen überrollt, ohne Jurastudium. Sie wollen
wissen: Was bedeutet das? Was kann ich tun? Was ist realistisch? Schreibe auf Augenhöhe, ohne Belehrung, ohne Panik, ohne Werbesprache.

FORM: Sie-Form. Kurze Sätze. Konkrete Zahlen, Fristen, Paragrafen (nur, wenn sie stimmen — im Zweifel weglassen statt raten).
Überschriften als Fragen oder klare Aussagen. Jeder Abschnitt beantwortet eine Frage, die der Leser wirklich hat.
Keine Icons, keine Emojis, keine Ausrufezeichen-Häufung. Keine Floskeln („In der heutigen Zeit…", „Es ist wichtig zu beachten…").

RECHT & EHRLICHKEIT (nicht verhandelbar): FIAON berät nicht, garantiert nichts, „verbessert" keinen Score. Verbotene Wörter:
Beratung/beraten, Empfehlung/empfehlen, Garantie/garantiert, „sicher zu", „auf jeden Fall", „Score verbessern".
Erlaubt: Auskunft, Übersicht, Handlungsplan, „Sie sehen", „FIAON übernimmt/bereitet vor/versendet/verfolgt".
Sag klar, was NICHT geht (kein Kredit „ohne SCHUFA", keine Löschung berechtigter Einträge vor der Frist). Nenne Gesetze korrekt:
DSGVO Art. 15 (Datenkopie), Art. 16 (Berichtigung), Art. 17 (Löschung), Art. 21 (Widerspruch), Art. 77 (Beschwerde Datenschutzbehörde);
§ 31 Abs. 2 BDSG (Voraussetzungen für die Meldung einer offenen Forderung: fällig, nicht bestritten, zwei Mahnungen mit mindestens vier
Wochen Abstand, Hinweis auf die mögliche Meldung, Meldung frühestens vier Wochen nach der ersten Mahnung — oder titulierte/anerkannte Forderung);
SCHUFA-SCORE SEIT 17.03.2026: Skala 100–999 Punkte, fünf Klassen (hervorragend 776–999, gut 709–775, akzeptabel 642–708, ausreichend 100–641, ungenügend = offene Zahlungsstörung), zwölf veröffentlichte Kriterien (Zahlungsstörungen max. 264 Punkte), tagesaktuell berechnet, kostenlos online einsehbar; ersetzt Basisscore (0–100 %) und Branchenscores — den alten Prozentwert NIE als aktuell darstellen.
Löschfristen nach den Verhaltensregeln der Auskunfteien (erledigte Forderungen drei Jahre; seit 2024: bei Begleichung innerhalb von 100 Tagen
nach Meldung und ohne weitere Einträge nach 18 Monaten; Restschuldbefreiung sechs Monate nach BGH 2023; Anfragen zwölf Monate, für Dritte zehn Tage sichtbar).
Österreich: KSV1870 und CRIF, DSGVO gilt ebenso, Datenschutzbehörde Wien. Schweiz: CRIF, Intrum; Datenschutzgesetz (DSG); Betreibungsauszug nach SchKG, Art. 8a.

STRUKTUR DES ARTIKELS (Markdown, 1.500–2.000 Wörter):
- Einstieg (2–3 Absätze): die Lage des Lesers, ohne Einleitung-Floskel.
- 5–7 Abschnitte mit ## Überschriften; darunter gern ### Unterpunkte, Listen, eine kleine Tabelle, wo Zahlen zu vergleichen sind.
- Ein Abschnitt „Schritt für Schritt" als nummerierte Liste.
- Ein Abschnitt „Was FIAON dabei übernimmt“ (## Überschrift mit dem Wort FIAON) — FIAON als Lösung für genau diese Lage (Justin 23.09.2026):
  1–2 Absätze, konkret, was die Plattform tut (Einträge der selbst angeforderten Datenkopie erklären, Schreiben vorbereiten und versenden,
  Fristen verfolgen, die FIAON-Bonitätsauswertung aus Kontoauszügen, danach der Link der Partnerbank für Konto und Karte), mit einem Link
  auf die passende Seite. Ruhig und überzeugend, ohne Superlative („Gamechanger“, „die beste“, „Nummer 1“) und ohne Versprechen.
- Ein Abschnitt „Was nicht geht" — ehrlich.
- Kurzes Fazit („Das Wichtigste in drei Sätzen").
Dazu: 5 FAQ (Frage + Antwort in 2–4 Sätzen), ein Teaser (max. 160 Zeichen), Meta-Titel (max. 60 Zeichen, enthält das Keyword),
Meta-Beschreibung (max. 155 Zeichen), 4–6 Schlagwörter. (Die Lesezeit rechnet das System — sie steht nicht im Text.)`;

/**
 * E-379: Der Hausstil der Business-Artikel (FIAON Global, /business). Dieselbe Strenge wie privat — dazu die
 * schärferen Wortregeln von FIAON Global (shared/fiaon-global-wortregeln.ts, E-188). Die Pakete und Preise setzt
 * der Generator zur Laufzeit aus shared/fiaon-global.ts ein (eine Quelle für Preise).
 */
export const HAUSSTIL_BUSINESS = `Du schreibst für FIAON Global (fiaon.com/business), den Bereich von FIAON für Unternehmer, Gründer und Geschäftsführer
aus Deutschland, Österreich und der Schweiz. FIAON Global baut für sie eine US-Gesellschaft auf (LLC oder Corporation, mit Team in Miami),
beantragt EIN und ITIN, stellt Registered Agent, US-Adresse und US-Telefonnummer, bereitet das US-Geschäftskonto und die erste Firmenkarte vor,
plant die „Kartenleiter“ weiterer Herausgeber und bereitet Kennzahlen für ein späteres Bankdarlehen auf; dazu ein Pflichtenkalender für die
US-Meldungen (Form 5472 mit Form 1120), Partner-Anwalt, Partner-Steuerberater und US-CPA. Festpreise je Paket. Das Kapital ist nicht an die USA
gebunden. FIAON plant, bereitet vor und begleitet — es vergibt und vermittelt keine Kredite; über Konto, Karte, Rahmen und Darlehen entscheidet
allein das jeweilige Institut. Eine US-Gesellschaft ist ein Werkzeug für echtes Geschäft und Kapitalaufbau, KEIN Steuermodell: Wer sie aus
Deutschland, Österreich oder der Schweiz führt, versteuert sie in der Regel zu Hause und meldet sie dem Finanzamt.

ZIELGRUPPE: Inhaber kleiner und mittlerer Unternehmen, Selbstständige, Gründer — unter Zeitdruck, skeptisch gegenüber Versprechen, mit
konkreten Fragen zu Bonität, Finanzierung, Liquidität, Gründung und Expansion. Schreibe wie eine gute Wirtschaftsredaktion: präzise,
nüchtern, mit Zahlen und Beispielen aus dem Alltag eines Unternehmens. Sie-Form. Kurze Sätze.

RECHT & EHRLICHKEIT (nicht verhandelbar): Keine Beratung, keine Garantie, keine Empfehlung, kein Steuerversprechen. Verbotene Wörter:
Beratung/beraten (auch „Steuerberatung“, „Unternehmensberatung“ — erlaubt ist „Steuerberater“, „Anwalt“), Empfehlung/empfehlen/empfohlen,
Garantie/garantiert (auch „Ausfallgarantie“ — sag „Bürgschaft“), „sicher zu“, „auf jeden Fall“, „bis zu“ (sag „höchstens“), „0 %“,
„ohne Sicherheiten“ (sag „ohne Bareinlage“, die persönliche Haftung IST die Sicherheit), „Steuern sparen“/„Steuervorteil“, Banknamen
als Versprechen, Fristen mit Ziffer in Wochen oder Monaten („innerhalb von 6 Wochen“ — schreibe Fristen in Worten: „sechs Wochen“).
Alles andere in Ziffern: Jahreszahlen (2026), Daten, Beträge, Prozentwerte, Paragraphen — nie eine Jahreszahl ausschreiben.
Nenne Gesetze korrekt (BGB, HGB, InsO, AO, GmbHG; in Österreich UGB/IO, in der Schweiz OR/SchKG; EU-Recht mit Nummer) und nur, wenn sie stimmen.

STRUKTUR DES ARTIKELS (Markdown, 1.500–2.000 Wörter):
- Einstieg (2–3 Absätze): eine konkrete Lage aus dem Unternehmensalltag, ohne Floskel.
- 5–7 Abschnitte mit ## Überschriften; darunter gern ### Unterpunkte, Listen, eine kleine Tabelle, wo Zahlen zu vergleichen sind.
- Ein Abschnitt „Schritt für Schritt“ als nummerierte Liste.
- Ein Abschnitt „So übernimmt FIAON Global …“ (## Überschrift mit „FIAON Global“): FIAON Global als Lösung für genau diese Lage, 1–2 Absätze —
  was das Team konkret tut, welches Paket passt (Name und Festpreis), Partner vor Ort, und ein Link auf die passende Seite.
  Ruhig und überzeugend, ohne Superlative („Gamechanger“, „die beste“, „Nummer 1“) und ohne Zusagen zu Rahmen, Zinsen oder Dauer.
- Ein Abschnitt „Was nicht geht“ — ehrlich (z. B. keine Steuerersparnis durch eine US-Gesellschaft, persönliche Haftung bei der ersten Karte,
  keine Zusage eines Rahmens).
- Kurzes Fazit („Das Wichtigste in drei Sätzen“).
Dazu: 5 FAQ (Frage + Antwort in 2–4 Sätzen), ein Teaser (max. 160 Zeichen), Meta-Titel (max. 60 Zeichen, enthält das Keyword),
Meta-Beschreibung (max. 155 Zeichen), 4–6 Schlagwörter.`;

/** Der Hausstil je Bereich. */
export function hausstilFuer(b: Bereich): string {
  return b === "business" ? HAUSSTIL_BUSINESS : HAUSSTIL;
}

export interface Quelle { titel: string; url: string }

export interface Artikel {
  id: number; slug: string; titel: string; untertitel: string | null; teaser: string; inhalt: string;
  kategorie: Kategorie; land: Land; keyword: string; schlagworte: string[];
  faq: { frage: string; antwort: string }[];
  metaTitel: string; metaBeschreibung: string; lesezeit: number;
  status: Status; quelle: "ki" | "hand"; modell: string | null;
  pruefung: Pruefung | null;
  erstelltAm: string; aktualisiertAm: string; veroeffentlichtAm: string | null;
  /** E-379: privat (/ratgeber) oder business (FIAON Global). */
  bereich: Bereich;
  /** E-379: Der Berliner Tag, für den die Redaktion diesen Artikel als Tagesartikel geschrieben hat (sonst null). */
  tagesartikel: string | null;
  /** E-379: Die Quellen der Recherche (Websuche) — für die Redaktion. */
  quellen: Quelle[];
  /** E-379: Warum das Thema gerade jetzt dran ist (aus der Recherche). */
  anlass: string | null;
}

export interface Pruefung { ok: boolean; punkte: { art: "fehler" | "hinweis" | "ok"; text: string }[]; worte: number; geprueftAm: string }

export interface PruefOptionen {
  /** Business-Artikel bekommen zusätzlich die schärferen Wortregeln von FIAON Global. */
  bereich?: Bereich;
  /**
   * E-379: Der Prüfstand als TOR für die automatische Veröffentlichung. Was für einen Menschen ein Hinweis ist
   * (Du-Form, fehlender FIAON-Abschnitt, kein „Was nicht geht“, keine Quellen, Superlative, Wortwand), ist für
   * die Automatik ein Fehler — sie hat niemanden, der den Hinweis liest.
   */
  streng?: boolean;
  /** Interne Links, die es wirklich gibt. Steht ein anderer „](/…)“-Link im Text, ist das im strengen Modus ein Fehler. */
  erlaubteLinks?: string[];
}

/** Superlative und Werbewörter — Kanzlei-Ton, YMYL-Vertrauen (Justin 23.09.2026: FIAON als Lösung, aber ohne „Gamechanger“). */
const WERBEWORTE = /\b(game-?changer|revolution\w*|nummer\s*(1|eins)|platz\s*(1|eins)|unschlagbar\w*|einzigartig\w*|weltbest\w*|marktführer\w*)\b/i;
/** „die beste …“ ist nur in einem Satz über FIAON Werbung — „Die beste Arbeitsregel lautet …“ ist keine (Echtlauf 15.10.2026). */
const BESTE = /\b(der|die|das|den|dem)\s+beste[nm]?\b/i;
function werbewort(text: string): string | null {
  const m = text.match(WERBEWORTE);
  if (m) return m[0];
  for (const satz of text.split(/(?<=[.!?])\s+|\n+/)) {
    if (!/FIAON/.test(satz)) continue;
    const b = satz.match(BESTE);
    if (b) return b[0];
  }
  return null;
}

/** Der Prüfstand: Worthygiene, Form, Länge, Struktur. Reine Funktion — Server und Admin-Vorschau prüfen dasselbe. */
export function pruefstand(a: Pick<Artikel, "titel" | "teaser" | "inhalt" | "faq" | "metaTitel" | "metaBeschreibung" | "keyword">, opt: PruefOptionen = {}): Pruefung {
  const punkte: Pruefung["punkte"] = [];
  const streng = !!opt.streng;
  const schwer = (streng ? "fehler" : "hinweis") as "fehler" | "hinweis";
  const alles = `${a.titel}\n${a.teaser}\n${a.inhalt}\n${a.faq.map((f) => f.frage + " " + f.antwort).join("\n")}`;
  const worte = a.inhalt.split(/\s+/).filter(Boolean).length;
  // E-379: Wortprüfungen ohne Adressen — „eur-lex.europa.eu/eli/dir/2023/…“ ist keine Du-Form.
  const text = alles.replace(/\]\([^)\s]*\)/g, "]").replace(/https?:\/\/\S+/g, " ");

  // 02.09.2026: „Schuldnerberatung" ist der gesetzliche Name der kostenlosen,
  // staatlich anerkannten Stellen, an die der Ratgeber bei ernster Lage
  // verweisen MUSS (Regel aus /werkzeuge/schulden-check). Die Silbe „beratung"
  // darin ist kein Versprechen von FIAON — sie wird vor der Prüfung entfernt.
  const schlecht = worthygiene(text.replace(/schuldnerberatung/gi, ""));
  if (schlecht.length) punkte.push({ art: "fehler", text: `Verbotene Wörter: ${schlecht.join(", ")}` });
  else punkte.push({ art: "ok", text: "Worthygiene: keine verbotenen Wörter" });

  const versprechen = ["ohne schufa garantiert", "100 % sicher", "garantiert gelöscht", "sofort gelöscht", "schufa-frei", "schufafrei"].filter((w) => text.toLowerCase().includes(w));
  if (versprechen.length) punkte.push({ art: "fehler", text: `Versprechen, die wir nicht halten: ${versprechen.join(", ")}` });

  // E-379: die Wand aller Kundentexte (shared/fiaon-wortverbote.ts) — nur die harten Treffer; für Business dazu die Global-Regeln.
  const wand = wandPruefen(text.replace(/schuldnerberatung/gi, "")).filter((f) => f.art === "verboten");
  for (const f of wand) punkte.push({ art: schwer, text: `Wortwand: „${f.treffer}“ — ${f.hinweis}` });
  if (opt.bereich === "business") {
    for (const r of GLOBAL_SCHAERFER) {
      const m = text.match(r.muster);
      if (m) punkte.push({ art: schwer, text: `FIAON-Global-Regel: „${m[0].slice(0, 50)}“ — ${r.grund}` });
    }
  }
  const werbung = werbewort(text);
  if (werbung) punkte.push({ art: schwer, text: `Superlativ/Werbewort „${werbung}“ — FIAON als Lösung zeigen, ohne Superlative.` });

  const du = /(^|[^a-zäöü])(du|dich|dir|dein|deine|deinen|deinem)([^a-zäöü]|$)/i.test(text.replace(/Dusche|durch|dunkel/gi, ""));
  if (du) punkte.push({ art: schwer, text: "Du-Form gefunden — der Ratgeber siezt." });

  const mindestens = streng ? 1300 : 1100;
  if (worte < mindestens) punkte.push({ art: "fehler", text: `Zu kurz: ${worte} Wörter (Ziel 1.500–2.000)` });
  else if (worte < 1400) punkte.push({ art: "hinweis", text: `Knapp: ${worte} Wörter (Ziel 1.500–2.000)` });
  else punkte.push({ art: "ok", text: `Länge: ${worte} Wörter` });

  const ueberschriften = a.inhalt.match(/^## .+$/gm) || [];
  const h2 = ueberschriften.length;
  if (h2 < 5) punkte.push({ art: "fehler", text: `Nur ${h2} Abschnitte (## ) — mindestens 5` });
  else punkte.push({ art: "ok", text: `${h2} Abschnitte` });
  if (/^# /m.test(a.inhalt)) punkte.push({ art: schwer, text: "Eine H1 (# …) im Text — der Titel steht separat." });
  // 15.10.2026: Die Fristen-Regel der Wortwand verleitete die KI, auch Jahreszahlen auszuschreiben („im August zweitausendsechsundzwanzig“).
  if (streng && /(zweitausend|neunzehnhundert)\w*/i.test(a.inhalt)) punkte.push({ art: "fehler", text: "Jahreszahl ausgeschrieben — Jahreszahlen in Ziffern (2026)." });
  if (!/^\d+\. /m.test(a.inhalt)) punkte.push({ art: schwer, text: "Keine nummerierte Schritt-für-Schritt-Liste gefunden" });
  // Streng: der Abschnitt muss eine ## Überschrift mit FIAON sein — ein FIAON irgendwo im Text ist noch kein Abschnitt.
  if (streng ? !ueberschriften.some((u) => /FIAON/.test(u)) : !/FIAON/.test(a.inhalt)) punkte.push({ art: schwer, text: "Der Abschnitt „Was FIAON übernimmt“ fehlt" });
  if (streng ? !ueberschriften.some((u) => /nicht geht|geht nicht/i.test(u)) : !/nicht geht|Was nicht geht|geht nicht/i.test(a.inhalt)) punkte.push({ art: schwer, text: "Kein ehrlicher Abschnitt „Was nicht geht“" });

  // E-034: jede Zahl mit Quelle — am Ende ein Quellenblock. Streng: mindestens drei Einträge mit Adresse.
  const qi = a.inhalt.search(/^## Quellen\s*$/m);
  const quellZeilen = qi >= 0 ? (a.inhalt.slice(qi).match(/^[-*] .*https?:\/\//gm) || []).length : 0;
  if (qi < 0) punkte.push({ art: schwer, text: "Kein Abschnitt „## Quellen“ am Ende (Regel E-034: jede Zahl mit Quelle)" });
  else if (streng && quellZeilen < 3) punkte.push({ art: "fehler", text: `Nur ${quellZeilen} Quellen mit Adresse (mindestens 3)` });

  if (opt.erlaubteLinks) {
    const erlaubt = new Set(opt.erlaubteLinks.map((l) => l.replace(/[#?].*$/, "").replace(/\/+$/, "") || "/"));
    const intern = Array.from(a.inhalt.matchAll(/\]\((\/[^)\s]*)\)/g)).map((m) => m[1]);
    const fremd = intern.filter((l) => !erlaubt.has(l.replace(/[#?].*$/, "").replace(/\/+$/, "") || "/"));
    if (fremd.length) punkte.push({ art: schwer, text: `Links auf Seiten, die es nicht gibt: ${Array.from(new Set(fremd)).join(", ")}` });
    const ziel = opt.bereich === "business" ? /^\/business(\/|#|\?|$)/ : /^\/(privatkunden|antrag|bonitaetsauskunft|bonitaet-antrag|bonitaet|partnerbank-dkb|preise)(\/|#|\?|$)/;
    if (!intern.some((l) => ziel.test(l))) punkte.push({ art: schwer, text: opt.bereich === "business" ? "Kein Link auf FIAON Global (/business…)" : "Kein Link auf ein FIAON-Angebot (/privatkunden, /bonitaetsauskunft …)" });
  }

  if (a.faq.length < 4) punkte.push({ art: "fehler", text: `Nur ${a.faq.length} FAQ (mindestens 4)` });
  else punkte.push({ art: "ok", text: `${a.faq.length} FAQ` });

  if (!a.teaser || a.teaser.length > 170) punkte.push({ art: "hinweis", text: `Teaser ${a.teaser?.length || 0} Zeichen (max. 160)` });
  if (!a.metaTitel || a.metaTitel.length > 64) punkte.push({ art: "hinweis", text: `Meta-Titel ${a.metaTitel?.length || 0} Zeichen (max. 60)` });
  if (!a.metaBeschreibung || a.metaBeschreibung.length > 160) punkte.push({ art: "hinweis", text: `Meta-Beschreibung ${a.metaBeschreibung?.length || 0} Zeichen (max. 155)` });
  if (a.keyword && !alles.toLowerCase().includes(a.keyword.toLowerCase().split(" ")[0])) punkte.push({ art: "hinweis", text: `Keyword „${a.keyword}“ kommt im Text kaum vor` });
  // E-379 (Echtlauf 15.10.2026): „Beim Thema **boi reporting us llc** …“ — das Keyword wörtlich und klein in den Text gesetzt.
  // Deutsch schreibt Substantive groß; eine klein geschriebene Kette aus mehreren Wörtern ist fast immer eingefügtes SEO.
  const kw = String(a.keyword || "").trim();
  if (streng && kw.split(/\s+/).length >= 2 && /[a-zäöü]/.test(kw) && kw === kw.toLowerCase() && a.inhalt.replace(/\]\([^)]*\)/g, "]").includes(kw)) {
    punkte.push({ art: "fehler", text: `Keyword als klein geschriebene Wortkette im Text („${kw}“) — natürlich formulieren` });
  }

  const ok = !punkte.some((p) => p.art === "fehler");
  return { ok, punkte, worte, geprueftAm: new Date().toISOString() };
}

export function slugify(s: string): string {
  return s.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90);
}

export function lesezeitVon(md: string): number {
  return Math.max(3, Math.round(md.split(/\s+/).filter(Boolean).length / 200));
}
