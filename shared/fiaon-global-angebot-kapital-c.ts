// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DAS KAPITAL-ANGEBOT, FASSUNG C: FÜR PRIVATPERSONEN (Register E-432, 27.10.2026)
//
// Justin (27.10.2026): „JEDER eine US Gesellschaft … JEDER 250.000 EUR (umgerechnet in Dollar) Finanzierung mit uns als
// Bürgen für ein Immo Projekt in den VAE … die ersten 6 Monate Ratenfrei, danach wählbar bei einer Laufzeit von 5-15 Jahren,
// die ersten 16 Monate sind Zinsfrei, danach startet der Zins bei 1.5% und jedes Jahr erhöht sich dieser um 0.5% … Wir
// brauchen für beide eine eigene Vertragsseite, wo sie die Laufzeit wählen können und daraus auch die monatliche Rate sehen
// und den LLC Namen. … nur noch Laufzeit, Name und Unterschrift, es muss sich perfekt anfühlen.“
//
// ── WARUM EINE EIGENE FASSUNG ──────────────────────────────────────────────
// Fassung A/B (E-399/E-400) schließen mit einem UNTERNEHMEN (kein Widerruf, Reverse Charge, Prüfbericht als Anlage).
// Fassung C schließt mit einer PRIVATPERSON: Verbrauchervertrag mit Widerrufsbelehrung und Muster-Formular (Anlage),
// Informationen vor Vertragsschluss (Art. 246a EGBGB), Knopf „zahlungspflichtig“ (§ 312j BGB), Endpreise, Fast-Track nur mit
// ausdrücklichem Verlangen des Sofortbeginns (§ 356 Abs. 4, § 357a Abs. 2 BGB). Alles ist PARAMETER — der zweite Kunde
// bekommt dieselbe Fassung mit seiner eigenen privaten Angebotsdatei (scripts/angebot-kapital-anlegen.ts).
//
// ── JUSTINS ENTSCHEIDUNGEN (27.10.2026), HIER UMGESETZT ─────────────────────
//   · Kosten OFFEN und vollständig, aber ruhig: Finanzierung und Monatsrate stehen groß oben, „Ihre Investition“ weiter unten
//     (heute 2.790 € + 499 € Fast-Track, mit der Eintragung 6.890 € Erfolgshonorar inkl. Bürgschaft, ab Jahr 2 699 €/Jahr).
//   · KEIN Bankname — „eine US-Bank“ / „das finanzierende Institut“. Keine Kartenrahmen, kein „bis zu“, kein „60x“.
//   · Geld-zurück-Garantie: Wird die Finanzierung nicht binnen acht Wochen ab Auftragserteilung ausgezahlt, erhält der Kunde alles
//     Gezahlte zurück (Ruhen wie Fassung B, enger). Ziel mit Fast-Track: vier Wochen — als Ziel, nie als Garantie.
//   · Bürgschaft der US-Partnergesellschaft wie Fassung B, Ziffer 5 — MIT dem Satz zum Registerstand der Bürgin.
//   · Banking stellt der Kunde selbst; FIAON bereitet vor und begleitet (global-alles-abnehmen-vollmacht).
//
// ── NACHPRÜFUNG (27.10.2026, vier Gutachten: Recht, Rechnung, Gestaltung, Daten) ─────────────────────
//   · FIAON BEGLEITET bis zur Finanzierung (kein „führt zu“, keine „eigene Finanzierungsbank“); über die Finanzierung entscheidet das
//     Institut. Der Gründungspreis deckt Ziffer 2 und 3 — für die Finanzierung weist der Vertrag keine eigene Vergütung aus.
//   · Die Garantie heißt überall „Geld-zurück-Garantie“ — nie „Auszahlung garantiert“, nie „sicher“.
//   · Persönliche Haftung offen: „Ihre Verantwortung“ am Rechner, in Übersicht und Informationen; keine Ausstattungspflicht ohne Grenze.
//   · Registerstand der Bürgin offen (Parameter buerginAktiv/buerginStandAm): inaktiv → Satz in Ziffer 5 und in den Fragen.
//   · Gesamtpreis des ersten Jahres (10.179 €) in Investition, Übersicht, Informationen. ITIN nur nach ITIN-Check (E-437).
//   · Auf der Seite und im Entwurfs-PDF stehen die Ausweisnummern gekürzt; vollständig nur im angenommenen Vertrag und in der Akte.
//
// ── NACHPRÜFUNG RUNDE 2 (27.10.2026, Recht, Gestaltung, Technik, Kundensicht) ─────────────────────
//   · Bürgschaft offen erklärt: verbundenes Unternehmen beim Namen, längstens 36 Monate, Rückgriff nur über Ziffer 5 Abs. 5,
//     Registerstand MIT Folge (bürgt sie nicht rechtzeitig, greift die Geld-zurück-Garantie — auch für das Erfolgshonorar).
//   · Ruhen der Frist mit Ende: Ein Angebot nach Absatz 2 lässt sie ruhen, solange es offensteht; lehnt die Gesellschaft es ab,
//     entfällt die Garantie. Begleitung bei Aufstockung/Umschuldung (ab Monat 18) gehört zur Jahresbetreuung (Ziffer 6 Abs. 3).
//   · Die erste Jahresmeldung beim Bundesstaat (Annual Report) ist im ersten Jahr enthalten — „Im ersten Jahr ist alles enthalten“.
//   · „Mit Ihrem Auftrag“ statt „heute“; Haken „gelesen“ entfällt — die Unterschrift bestätigt den Satz darüber (ein Haken bleibt:
//     Fast-Track). Kundensicht ohne interne Kennung („Vertragsstand 27.10.2026“), Beschwerdeweg in Ziffer 14.
//
// ── JUSTIN 27.10.2026, 17:40 ─────────────────────────────────────────────────
//   · „Was er mit dem Geld macht, ist seine Sache!“ — KEIN Verwendungszweck mehr (kein Vorhaben, kein Ort, kein bezahlter Anteil,
//     kein Termin), wo der Kunde liest: Seite, Vertrag (Präambel, Ziffer 4, Bürgschaftsbedingungen in Ziffer 5), Annahme, Bestätigung,
//     Mail. Die Parameter `projekt` bleiben nur als Datenfeld (Akte, Vorgabe leer); kein Text liest sie. Statt des Zwecks: „Wofür Ihre
//     Gesellschaft die Finanzierung einsetzt, entscheiden Sie“ (im Rahmen der Bedingungen der Bank). Prüfstand: ein Marken-Vorhaben
//     darf in keinem Kundentext und keinem Vertrag auftauchen.
//   · „Ihre Investition … kleiner (weiß auf weiß)“ — keine Bühne, keine großen Ziffern: eine leise Zeile mit ALLEN Beträgen
//     (Endpreise, Gesamtpreis des ersten Jahres), Einzelheiten zum Aufklappen. Lesbar (≥ 13 px, Kontrast ≥ 4,5:1) und vollständig;
//     die Übersicht über dem Knopf (§ 312j BGB) bleibt vollständig.
//
// ── JUSTIN 27.10.2026, ABENDS: „Das gesamte Team mit Fotos noch anfügen“ ─────────────────────
//   · Parameter `team` wie Fassung A/B (E-402): dieselben Regeln (kapitalTeamAus), dieselbe Darstellung (kapitalTeam — Porträt des
//     Hauses oder Foto am Angebot NUR hinter dem Link, sonst Initialen), derselbe Bildnachweis. Die Seite zeigt es unter „Ihr
//     Ansprechpartner“ als „Ihr Team“. Das Team steht NIE im Vertrag — die Prüfsumme bleibt gleich (Prüfstand: mit und ohne Team).
//
// ── E-487 (09.11.2026): DIE TEMPO-FASSUNG „VORRANG“ ───────────────────────
//   · Bis E-487 nannte der Fast-Track ein Zeitziel („Gesellschaft und EIN binnen 72 Stunden“, E-475). Wie lange die EIN dauert,
//     bestimmt allein die US-Steuerbehörde. Seit E-487 beschreibt der Fast-Track deshalb die Schritte, die FIAON selbst in der Hand
//     hat: Vorrang in allen Schritten — die Anmeldung beim Bundesstaat (mit dessen Express, wo die Anleitung ihn bucht) spätestens am Werktag
//     nach dem Eingang, der Antrag auf die EIN am Tag der Eintragung (sobald der Kunde das vorbereitete Formular unterschrieben hat),
//     die Unterlagen für das finanzierende Institut parallel. Keine Stunden- und keine Tageszusage für die EIN (kapitalCVorrang).
//   · Wer was liest: Jedes NICHT angenommene Angebot zeigt die aktuelle Tempo-Fassung — der Parameter tempoFassung wird beim LESEN
//     gesetzt (kapitalCTempoFassungAus), in der Datenbank muss nichts geschrieben werden. Die Annahme hält ihn in schalter.tempoFassung
//     fest. Ein angenommener Vertrag OHNE diesen Vermerk ist vor E-487 angenommen: tempoFassung leer = Wortlaut wie bei der Annahme
//     („72 Stunden“) — Prüfsumme, Vertrags-PDF mit Anlage und Vertragsbestätigung bleiben wortgleich.
//   · Der Satz ohne Fast-Track („Gesellschaft, EIN und ITIN in der Regel nach drei bis fünf Wochen“, KAPITAL_C_TEMPO.ohne) bleibt
//     unverändert — er ist eine Geschäftsentscheidung, nicht Teil dieses Baus. Nichts ist vorgewählt (§ 312a Abs. 3 BGB): Die Seite
//     startet ohne Wahl, der Server nimmt nur ein ausdrückliches true/false an.
//   · Nachbesserung nach dem Gutachten (E-487, 09.11.2026), bevor die Fassung live ging: Express nur, wo die Gründungs-Anleitung ihn
//     beim Fast-Track bucht (express.imFastTrack — heute nur Delaware, nicht Wyoming); die Frist für die Anmeldung gilt, sobald ein
//     verfügbarer Name feststeht, der EIN-Antrag nach der Unterschrift des Kunden — so auch in Karte und Informationen; mit Angaben vom
//     Kunden zählt der spätere Eingang (Zahlung oder Reisepass): Fehlt der Pass bei der Zahlung, nennt die Start-Aufgabe kein Datum,
//     sondern die Aufgabe „Reisepass da“ (kapitalCReisepassAufgabe), sobald er hochgeladen ist; ein angenommener Vertrag liest seine
//     Tempo-Fassung NUR aus dem Annahmevermerk; die Vertragsbestätigung baut eine reine Funktion (kapitalCBestaetigungAbsaetze); der
//     Vertragsstand nennt den Stand der Tempo-Fassung (09.11.2026).
//
// ── DER RECHNER (rein, kapitalCPlan) ───────────────────────────────────────
// Laufzeit T Jahre = N = 12·T Monatsraten ab Monat (ratenfrei + 1). Zins je Monat m: 0 für m ≤ zinsfrei, sonst
// (Start + Schritt · floor((m − zinsfrei − 1) / 12)) / 12. Gleichbleibende Rate R aus den Abzinsungsfaktoren
// (Saldo nach den ratenfreien Monaten = Σ R · D_m), auf Cent gerundet; der Restbetrag (bis rund 1 €) steht in der letzten Rate —
// sie wird überall offen genannt, sobald sie von der Monatsrate abweicht. Der Monatszins in Cent rechnet aus ganzen Zahlen
// (Saldo · Basispunkte / 120.000, kaufmännisch gerundet) — Kommazahlen runden halbe Cent sonst manchmal ab.
// Prüfstand: scripts/pruef-kapital-fassung-c.ts (unabhängige Nachrechnung in BigInt für T = 5 … 15 und viele Beträge, Grenzfälle).
//
// DATENSCHUTZ: Das Repo ist öffentlich (E-242) — hier stehen KEINE Kundendaten. Alles Persönliche kommt aus der privaten
// Angebotsdatei in die Datenbank (fiaon_global_angebote.kunde / .parameter) und nur über den persönlichen Link auf die Seite.
// ═══════════════════════════════════════════════════════════════════════════
import { FIAON_FIRMA } from "./fiaon-firma";
import { GLOBAL_KAPITAL_FREI, globalAgentVertrag } from "./fiaon-global";
// E-465 (29.10.2026): Staaten-Wahl mit ehrlichen Zeiten — nur für Angebote mit staatenFassung (Bestand unverändert).
import { angebotStaatFehler, angebotStaatTexte, staatName, staatInfo, neuesAngebotParameter } from "./fiaon-global-bundesstaaten";
import { BEFUGNISSE_TITEL, befugnisseAbsaetze } from "./fiaon-global-befugnisse";
import { ANGEBOT_PFLICHTHINWEIS, ANGEBOT_ANSPRECHPARTNER, type AngebotAbsatz, type AngebotZiffer } from "./fiaon-global-angebot";
import { zahlwort } from "./fiaon-global-angebot-firma";
import { escHtml, BEGLEIT_LLC_TEXTE, llcWahlPruefen, type BegleitLlcWahl } from "./fiaon-global-angebot-begleit";
import { globalWiderrufsbelehrung } from "./fiaon-global-widerruf";
import type { FirmaAnnahmeTexte, FirmaPhase, FirmaUnterschriftEingabe } from "./fiaon-global-angebot-firma-typen";
import {
  KAPITAL_C_FASSUNG, KAPITAL_KNOPF, KAPITAL_TEAM_TEXTE, kapitalEur, kapitalTag, kapitalProzent, kapitalTeamAus, kapitalTeam, kapitalBildnachweis,
  type KapitalBuergin, type KapitalUnterschriftVermerk, type KapitalTeamEintrag, type KapitalTeamPerson,
} from "./fiaon-global-angebot-kapital";

export { KAPITAL_C_FASSUNG };
export const KAPITAL_C_MARKE = "FIAON Global · Ihre Finanzierung";
export const KAPITAL_C_GUELTIG_TAGE = 14;
// Kein „Finanzierungsbegleitung“ im Rechnungstitel: Der Gründungspreis deckt Ziffer 2 und 3 (Nachprüfung 27.10., § 34c GewO).
export const KAPITAL_C_TEIL1_TITEL = "Gründung, Konto und Karten sowie Fast-Track";
export const KAPITAL_C_TEIL2_TITEL = "Erfolgshonorar einschließlich Bürgschaft";

// ═══════════════════════════════════════════════════════════════════════════
// DATEN
// ═══════════════════════════════════════════════════════════════════════════
export type KapitalCLand = "DE" | "AT" | "CH";
export interface KapitalCAusweis {
  art: "reisepass" | "personalausweis";
  nummer: string;
  /** JJJJ-MM-TT */
  gueltigBis: string;
  behoerde: string;
}
/** Der Auftraggeber: eine Privatperson. Anrede/Vor-/Nachname/E-Mail stehen OBEN (Aufruf-Meldungen, Konto-Suche lesen sie dort). */
export interface KapitalCKunde {
  art: "privat";
  anrede: "Herr" | "Frau" | "";
  vorname: string;
  nachname: string;
  /** JJJJ-MM-TT */
  geburtsdatum: string;
  geburtsort: string;
  staatsangehoerigkeit: string;
  strasse: string;
  plz: string;
  ort: string;
  land: KapitalCLand;
  email: string;
  telefon: string;
  ausweise: KapitalCAusweis[];
}
/**
 * Das Vorhaben des Kunden — NUR noch Datenfeld (Akte, interne Notiz). Justin 27.10.2026, 17:40: „Was er mit dem Geld macht, ist
 * seine Sache!“ Seite, Vertrag, Annahme, Bestätigung und Mail nennen keinen Verwendungszweck; kein Kundentext liest diese Felder.
 */
export interface KapitalCProjekt {
  /** z. B. „Immobilienprojekt“ */
  art: string;
  /** Ort mit Präposition, z. B. „in Spanien“ */
  wo: string;
  /** Ort kurz */
  woKurz: string;
  bezahltProzent: number;
  /** JJJJ-MM-TT */
  fertigstellung: string;
}
export interface KapitalCParameter {
  /** Endpreise in Cent: Gründung (Jahr 1), Fast-Track, Erfolgshonorar bei Eintragung, Jahresbetreuung ab Jahr 2 */
  gruendungCents: number;
  fastTrackCents: number;
  erfolgCents: number;
  jahresCents: number;
  zahlungszielTage: number;
  /** Die Finanzierung: Betrag in Euro (Cent), ausgezahlt in US-Dollar zum EZB-Referenzkurs des Auszahlungstags */
  betragCents: number;
  /** EZB-Referenzkurs beim Anlegen (1 € = x US-$) und sein Tag — nur für die Schätzung in US-Dollar auf der Seite */
  kursUsdJeEur: number;
  kursDatum: string;
  ratenfreiMonate: number;
  zinsfreiMonate: number;
  zinsStartBp: number;
  zinsSchrittBp: number;
  laufzeitMinJahre: number;
  laufzeitMaxJahre: number;
  /** Die Laufzeit, mit der die Seite öffnet (der Kunde wählt; erst seine Wahl steht im Vertrag) */
  laufzeitVorschlagJahre: number;
  /** Ab diesem Monat Aufstockung oder Umschuldung auf Wunsch */
  aufstockungAbMonat: number;
  projekt: KapitalCProjekt;
  /** Garantie: Auszahlung binnen so vielen Wochen ab Auftragserteilung, Erstattung binnen so vielen Tagen; Ziel mit Fast-Track */
  garantieWochen: number;
  erstattungTage: number;
  zielWochen: number;
  bundesstaat: string;
  /**
   * E-465: „E-465“ = angelegt mit der Staaten-Wahl (Delaware, Florida, Wyoming) und den ehrlichen Zeiten — dann ziehen
   * Fahrplan, Eintragungssatz und Jahrespflicht den Staat. Leer = Bestand vor E-465: Text bleibt wortgleich (Prüfsumme).
   */
  staatenFassung: string;
  /** Längste Laufzeit der Bürgschaft in Monaten (wie Fassung B, Ziffer 5) */
  buergschaftMonate: number;
  /**
   * Registerstand der Bürgin beim Anlegen (Sunbiz o. Ä.): true = aktiv. Vorgabe false — dann sagt Ziffer 5 offen, dass sie derzeit
   * als inaktiv geführt wird und erst nach der Reaktivierung bürgt (Verbraucher, § 5a UWG). Nach dem Reinstatement: true setzen.
   */
  buerginAktiv: boolean;
  /** Tag der letzten Registerprüfung (JJJJ-MM-TT) — steht als „Stand …“ im Satz; leer = ohne Datum */
  buerginStandAm: string;
  /**
   * Justin 27.10.2026: „wenn ich GO sage, dann live stellen, sodass er unterschreiben kann“. Die Seite ist vorher schon sichtbar,
   * unterschreiben (annehmen) geht erst mit true. Vorgabe false: Knopf gesperrt („wird gerade vervollständigt“), die Annahme
   * antwortet 409. Freigeben: private Datei mit true neu einlesen (scripts/angebot-kapital-anlegen.ts trägt ins offene Angebot ein).
   */
  unterschriftFrei: boolean;
  /** Begleitung ab der Eintragung (Monate) */
  begleitMonate: number;
  /** Die Unterlagen, die bei Vertragsschluss vorliegen — nur Titel und Eingangstag, nie die Dateien */
  unterlagen: { titel: string; am: string }[];
  ddAbgeschlossen: boolean;
  ansprechpartner: string[];
  /**
   * Das Team unter „Ihr Ansprechpartner“ (Justin 27.10.2026, wie Fassung A/B, E-402) — aus der privaten Angebotsdatei, nie im Code.
   * foto: „haus:<kürzel>“ = echtes Porträt des Hauses, ein Bildname = Foto am Angebot (nur hinter dem Link, Skript mit --bilder).
   * Steht NUR auf der Seite, nie im Vertrag: Die Prüfsumme bleibt gleich, eine offene Seite muss nicht neu laden.
   */
  team: KapitalTeamEintrag[];
  /**
   * E-474 (Justin 02.11.2026): Angebot anlegen und versenden, BEVOR Geburtsdatum und Anschrift vorliegen. true = beim Anlegen genügen
   * Anrede, Vor-/Nachname und E-Mail; der Kunde trägt Name (korrigierbar), Geburtsdatum, Anschrift (Geburtsort und Staatsangehörigkeit
   * freiwillig) auf seiner Angebotsseite selbst ein (kapitalCAngabenPruefen). Einen Ausweis braucht es vor der Unterschrift NICHT: Der
   * Vertrag nennt keinen („ausgewiesen durch …“ entfällt), Ziffer 7 sagt, dass der Kunde seinen Reisepass nach Vertragsschluss hochlädt
   * und FIAON erst danach Anmeldungen und Anträge stellt. Vorgabe false: alles wie bisher (Bestand wortgleich, Prüfsumme gleich).
   */
  datenVomKunden: boolean;
  /**
   * E-474 (Justin 02.11.2026): Der Kunde wählt den Fast-Track auf der Seite selbst (zwei Karten vor der Unterschrift). true = heute fällig
   * nur die Gründung, mit Fast-Track zusätzlich fastTrackCents; die Geld-zurück-Garantie bleibt garantieWochen, nur das ZIEL (zielWochen)
   * gilt mit Fast-Track. Die Wahl steht im Annahmevermerk (wie die Laufzeit) — der Vertragstext ist für beide Wahlen derselbe, die
   * Prüfsumme hängt nicht an der Wahl. E-475 (Justin 02.11.2026): In BEIDEN Fällen beginnt FIAON sofort mit dem Zahlungseingang
   * (Bestätigung „sofort beginnen“ ist in beiden Fällen Pflicht) — ohne Fast-Track stehen Gesellschaft, EIN und ITIN in drei bis fünf
   * Wochen, mit Fast-Track Gesellschaft und EIN in 72 Stunden (die ITIN folgt so schnell wie möglich; über sie entscheidet der IRS).
   * Vorgabe false: nur mit Fast-Track wie bisher (Bestand wortgleich).
   * E-487 (09.11.2026): Die „72 Stunden“ gelten nur noch für Verträge, die so angenommen wurden (tempoFassung leer) — siehe tempoFassung.
   */
  fastTrackWahl: boolean;
  /**
   * E-487 (09.11.2026): die Tempo-Fassung des Fast-Track. „E-487“ (KAPITAL_C_TEMPO_FASSUNG) = Vorrang in allen Schritten, keine Stunden-
   * oder Tageszusage für die EIN (kapitalCVorrang); leer = Wortlaut vor E-487 („Gesellschaft und EIN in 72 Stunden“) — nur noch für
   * Verträge, die so angenommen wurden. Gesetzt wird sie beim LESEN (kapitalCTempoFassungAus): nicht angenommen → immer die aktuelle,
   * angenommen → die bei der Annahme festgehaltene (schalter.tempoFassung), fehlt sie → leer. Vorgabe leer (Bestand wortgleich).
   * Ein gespeicherter Wert in den Parametern zählt nie (Nachbesserung E-487): Er sagt nicht, was der Kunde gelesen hat.
   */
  tempoFassung: string;
  /**
   * E-491 (09.11.2026, Justin: „Den Wunschnamen künftig schon im Angebot vorausfüllen … dann muss der Kunde gar nichts mehr tippen“):
   * ein Namensvorschlag aus dem Gespräch — Wunschname und bis zu zwei Ausweichnamen, ohne „LLC“, in der Schreibweise des Kunden.
   * Die Seite füllt damit die Namensfelder vor; der Kunde kann sie ändern. Verbindlich ist nur, was er bei der Annahme abschickt
   * (Annahmevermerk) — der Vertragstext und seine Prüfsumme lesen diesen Wert nie. Fehlt er (Bestand) oder ist ein Name ungültig
   * (gleiche Regeln wie bei der Annahme, llcWahlPruefen), gibt es den Schlüssel nicht: alles wie bisher.
   */
  llcVorschlag?: BegleitLlcWahl;
  /**
   * E-505 (Justin 12.11.2026: „er soll sich seinen Kreditrahmen selbst aussuchen können, mit einem Schieberegler“): Der Kunde wählt
   * seinen Kapitalrahmen auf der Angebotsseite selbst — in US-Dollar zwischen minUsd und maxUsd, in Schritten von schrittUsd.
   * gewaehltUsd = der Stand des Reglers (beim Anlegen der Startwert). Mit diesem Schlüssel sind betragCents (Euro zum Kurs des
   * Angebots, volle zehn Euro) und erfolgCents (Staffel nach Rahmenhöhe, kapitalCStaffelHonorarCents) IMMER abgeleitet — eine Zahl aus
   * der privaten Datei zählt dann nicht. Die Wahl steht im Vertrag selbst (Betrag und Erfolgshonorar), die Prüfsumme folgt ihr:
   * Der Kunde nimmt genau den Text an, den er nach seiner Wahl gesehen hat. Fehlt der Schlüssel (Bestand): alles wie bisher.
   */
  rahmenWahl?: KapitalCRahmenWahl;
  /**
   * E-506 (Justin 12.11.2026): Der Kunde HAT schon eine US-Gesellschaft — FIAON gründet nicht neu, sondern übernimmt die bestehende
   * („übernehmen statt neu gründen“). Mit diesem Schlüssel sprechen Vertrag, Seite, Übersicht, Annahme, Bestätigung und „Mein Auftrag“
   * von der Übernahme (kapitalCBestandTexte): kein Name zu wählen, kein Fast-Track (ein Preis, alles enthalten), das Erfolgshonorar
   * wird fällig, sobald die Gesellschaft übernommen und bankfertig ist (statt mit der Eintragung) — oder, mit bestand.erfolgBei
   * „buergschaft“, erst nach Übernahme UND Bürgschaft. Fehlt er (Bestand): alles wie bisher.
   */
  bestand?: KapitalCBestand;
}
/**
 * E-506: die bestehende Gesellschaft des Kunden. Name, Bundesstaat, Registernummer und Eintragungstag stehen im Vertrag (Ziffer 2);
 * `ordnung` = was FIAON nach der Prüfung in Ordnung bringt (Seite UND Vertrag); `daten` (jede Einzelheit: Bezeichnung und Wert),
 * `gut`, Registerstatus und -stand stehen nur auf der Seite. Alles aus der privaten Angebotsdatei — nie im Code (Repo öffentlich).
 */
export interface KapitalCBestand {
  name: string; bundesstaat: string; registerNr: string; eingetragenAm: string;
  registerStatus: string; registerStand: string;
  daten: { label: string; wert: string }[];
  gut: string[];
  ordnung: string[];
  /**
   * E-506, Nachtrag (Justin 12.11.2026): „Er bezahlt nach erfolgreicher Übernahme und Bürgschaft, dann ist ja eh schon alles durch.“
   * „buergschaft“ = das Erfolgshonorar wird fällig, sobald die Gesellschaft übernommen ist UND die Bürgin die Bürgschaft nach
   * Ziffer 5 übernommen hat (Ziffer 6 Absatz 2) — statt schon bei „übernommen und bankfertig“. Fehlt der Schlüssel: wie bisher.
   */
  erfolgBei?: "buergschaft";
}
/** Die Vorgabe bereinigt — oder null (fehlt, ohne Namen, ohne Bundesstaat oder ohne gültigen Eintragungstag: dann kein Schlüssel). */
export function kapitalCBestandAus(roh: unknown): KapitalCBestand | null {
  if (!roh || typeof roh !== "object") return null;
  const o = roh as Record<string, unknown>;
  const name = textAus(o.name, 120); const bundesstaat = textAus(o.bundesstaat, 40); const eingetragenAm = String(o.eingetragenAm ?? "");
  if (name.length < 3 || !bundesstaat || !ISO.test(eingetragenAm)) return null;
  const zeilen = (v: unknown, max: number, laenge: number): string[] => (Array.isArray(v) ? (v as unknown[]).map((x) => textAus(x, laenge)).filter(Boolean).slice(0, max) : []);
  const daten = Array.isArray(o.daten)
    ? (o.daten as any[]).map((x) => ({ label: textAus(x?.label, 60), wert: textAus(x?.wert, 220) })).filter((x) => x.label && x.wert).slice(0, 24) : [];
  return {
    name, bundesstaat, registerNr: textAus(o.registerNr, 40), eingetragenAm,
    registerStatus: textAus(o.registerStatus, 40), registerStand: ISO.test(String(o.registerStand ?? "")) ? String(o.registerStand) : "",
    daten, gut: zeilen(o.gut, 10, 220), ordnung: zeilen(o.ordnung, 10, 260),
    ...(o.erfolgBei === "buergschaft" ? { erfolgBei: "buergschaft" as const } : {}),
  };
}
/** „MUSTER“ aus „MUSTER LLC“ — der Stamm für den Annahmevermerk (dort setzt llcVollname „LLC“ wieder dahinter). */
export function kapitalCBestandStamm(b: Pick<KapitalCBestand, "name">): string {
  let t = b.name.normalize("NFKC").replace(/\s+/g, " ").trim();
  for (let i = 0; i < 3 && /[\s,.]*\bL\.?\s?L\.?\s?C\.?$/i.test(t); i++) t = t.replace(/[\s,.]*\bL\.?\s?L\.?\s?C\.?$/i, "").trim();
  return t;
}
/** `staffel` = die Fassung der Honorar-Staffel, mit der dieses Angebot rechnet (heute nur „E-505“ — siehe KAPITAL_C_STAFFEL). */
export interface KapitalCRahmenWahl { minUsd: number; maxUsd: number; schrittUsd: number; gewaehltUsd: number; staffel: string }

// ═══════════════════════════════════════════════════════════════════════════
// E-505: DAS ERFOLGSHONORAR NACH RAHMENHÖHE (STAFFEL) UND DER WÄHLBARE KAPITALRAHMEN — rein, eine Quelle für Seite, Server, Skript
//
// Justin (12.11.2026): „wir müssen unser Erfolgshonorar bei erfolgreicher Gründung an die Finanzierungsgröße anpassen … irgendwas
// zwischen 1,5 % und 5 %“ — entschieden: Mengenrabatt. Jeder TEIL des Rahmens hat seinen Satz (wie Steuerstufen), darum steigt
// das Honorar mit dem Rahmen immer gleichmäßig und fällt an keiner Grenze: die ersten 100.000 US-$ zu 5 %, der Teil bis 250.000
// zu 3 %, bis 500.000 zu 2 %, darüber 1,5 %. Nie unter dem Mindesthonorar. Gerechnet in US-Dollar, umgerechnet zum Kurs des
// Angebots, auf volle zehn Euro gerundet. Fällig bleibt es wie bisher mit der Eintragung (Ziffer 6 Absatz 2) — bemessen am
// gewählten Rahmen, nicht an der Auszahlung.
// ═══════════════════════════════════════════════════════════════════════════
// WICHTIG: Diese Zahlen NIE ändern. Parameter werden bei jedem Lesen neu abgeleitet (kapitalCParameterAus) — eine geänderte Staffel
// würde angenommene Verträge nachträglich umrechnen. Eine neue Staffel bekommt eine NEUE Fassung daneben (rahmenWahl.staffel wählt sie).
export const KAPITAL_C_STAFFEL = {
  fassung: "E-505",
  stufen: [{ bisUsd: 100_000, bp: 500 }, { bisUsd: 250_000, bp: 300 }, { bisUsd: 500_000, bp: 200 }, { bisUsd: 1_000_000, bp: 150 }],
  mindestCents: 299_000,
  rundungCents: 1_000,
} as const;
/** Das Erfolgshonorar (Cent, Endpreis) für einen Rahmen in US-Dollar zum Kurs des Angebots (1 € = kurs US-$). */
export function kapitalCStaffelHonorarCents(usd: number, kursUsdJeEur: number): number {
  const rahmen = Math.max(0, Math.round(usd));
  const stufen = KAPITAL_C_STAFFEL.stufen;
  // Ganze Zahlen: Dollar · Basispunkte (das Honorar in US-Dollar ist diese Summe / 10.000) — kein Kommafehler an den Grenzen.
  let summeBp = 0; let ab = 0;
  for (const st of stufen) {
    if (rahmen > ab) summeBp += (Math.min(rahmen, st.bisUsd) - ab) * st.bp;
    ab = st.bisUsd;
  }
  if (rahmen > ab) summeBp += (rahmen - ab) * stufen[stufen.length - 1].bp;
  const eurCents = (summeBp / 100) / kursUsdJeEur;
  const gerundet = Math.round(eurCents / KAPITAL_C_STAFFEL.rundungCents) * KAPITAL_C_STAFFEL.rundungCents;
  return Math.max(KAPITAL_C_STAFFEL.mindestCents, gerundet);
}
/**
 * Der Rahmen in Euro (Cent, auf volle zehn Euro) zum Kurs des Angebots — der Vertrag lautet auf Euro, ausgezahlt wird in US-Dollar
 * zum Kurs des Auszahlungstags. Volle zehn Euro, damit im Vertrag „134.350 €“ steht und nicht „134.348 €“.
 */
export function kapitalCRahmenEuroCents(usd: number, kursUsdJeEur: number): number {
  return Math.round(Math.round(usd) / kursUsdJeEur / 10) * 1_000;
}
/** Liegt der Wert auf dem Regler? Ganze Dollar, in den Grenzen, auf dem Schritt-Raster ab der Untergrenze. */
export function kapitalCRahmenGueltig(w: Pick<KapitalCRahmenWahl, "minUsd" | "maxUsd" | "schrittUsd">, usd: unknown): usd is number {
  return typeof usd === "number" && Number.isInteger(usd) && usd >= w.minUsd && usd <= w.maxUsd && (usd - w.minUsd) % w.schrittUsd === 0;
}
/**
 * Die Regler-Vorgabe bereinigt — oder null (fehlt oder unsinnig: dann gibt es den Schlüssel nicht, alles wie im Bestand).
 * Grenzen 10.000 bis 1 Mio. US-$, Schritt 1.000 bis 100.000, die Spanne geht im Schritt auf. Der Stand des Reglers: zuerst die
 * Wahl, die schon am Angebot steht (`basis` — ein zweiter Skriptlauf überschreibt nie, was der Kunde gewählt hat), sonst der
 * Startwert der Datei, sonst die Mitte der Spanne (auf dem Raster).
 */
export function kapitalCRahmenWahlAus(roh: unknown, basis?: KapitalCRahmenWahl | null): KapitalCRahmenWahl | null {
  if (!roh || typeof roh !== "object") return null;
  const o = roh as Record<string, unknown>;
  const ganz = (v: unknown) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : NaN);
  const minUsd = ganz(o.minUsd); const maxUsd = ganz(o.maxUsd); const schrittUsd = ganz(o.schrittUsd ?? 5_000);
  if (!(minUsd >= 10_000) || !(maxUsd <= 1_000_000) || !(minUsd < maxUsd)) return null;
  if (!(schrittUsd >= 1_000) || !(schrittUsd <= 100_000) || (maxUsd - minUsd) % schrittUsd !== 0) return null;
  const w = { minUsd, maxUsd, schrittUsd };
  const mitte = minUsd + Math.floor((maxUsd - minUsd) / 2 / schrittUsd) * schrittUsd;
  const start = ganz(o.gewaehltUsd);
  const gewaehltUsd = basis && kapitalCRahmenGueltig(w, basis.gewaehltUsd) ? basis.gewaehltUsd : kapitalCRahmenGueltig(w, start) ? start : mitte;
  return { ...w, gewaehltUsd, staffel: KAPITAL_C_STAFFEL.fassung };
}
/** Die Parameter mit einem gewählten Rahmen: Betrag in Euro und Erfolgshonorar nach Staffel folgen der Wahl. Ohne Regler unverändert. */
export function kapitalCRahmenAnwenden<P extends Pick<KapitalCParameter, "betragCents" | "erfolgCents" | "kursUsdJeEur" | "rahmenWahl">>(par: P, usd: number): P {
  if (!par.rahmenWahl) return par;
  return {
    ...par,
    betragCents: kapitalCRahmenEuroCents(usd, par.kursUsdJeEur),
    erfolgCents: kapitalCStaffelHonorarCents(usd, par.kursUsdJeEur),
    rahmenWahl: { ...par.rahmenWahl, gewaehltUsd: usd },
  };
}
/**
 * Der Rahmen in US-Dollar für jede Anzeige: mit Regler genau die gewählte Zahl (nie „249.999“ durch die Rückrechnung aus ganzen
 * Euro), ohne Regler wie bisher die Umrechnung des Euro-Betrags (Bestand wortgleich).
 */
export function kapitalCRahmenUsd(par: Pick<KapitalCParameter, "betragCents" | "kursUsdJeEur" | "rahmenWahl">): number {
  return par.rahmenWahl ? par.rahmenWahl.gewaehltUsd : kapitalCInUsd(par.betragCents, par.kursUsdJeEur);
}
/**
 * E-491: der Namensvorschlag bereinigt — oder null (fehlt, Wunschname leer oder ein Name verletzt die Regeln der Annahme).
 * Die Schreibweise bleibt (z. B. „Muster Ventures“); „LLC“ am Ende und doppelte Leerzeichen fallen weg.
 */
export function kapitalCLlcVorschlagAus(roh: unknown): BegleitLlcWahl | null {
  if (!roh || typeof roh !== "object") return null;
  const o = roh as Record<string, unknown>;
  const sauber = (v: unknown): string => {
    let s = textAus(v, 90).normalize("NFKC").replace(/\s+/g, " ").trim();
    for (let i = 0; i < 3 && /[\s,.]*\bL\.?\s?L\.?\s?C\.?$/i.test(s); i++) s = s.replace(/[\s,.]*\bL\.?\s?L\.?\s?C\.?$/i, "").trim();
    return s;
  };
  const w: BegleitLlcWahl = { wunsch: sauber(o.wunsch), alternative1: sauber(o.alternative1), alternative2: sauber(o.alternative2) };
  if (!w.wunsch) return null;
  return llcWahlPruefen(w).ok ? w : null;
}
export const KAPITAL_C_VORGABEN: KapitalCParameter = {
  gruendungCents: 279_000,
  fastTrackCents: 49_900,
  erfolgCents: 689_000,
  jahresCents: 69_900,
  // E-432 (28.10.2026, Justin: „Die Rechnung ist eigentlich umgehend, also sofort fällig“): neue Angebote „zahlbar sofort“
  // (kapitalCZahlbar). Angebote mit gespeichertem Wert (z. B. sieben Tage) behalten ihn — ihr Wortlaut und ihre Prüfsumme bleiben.
  zahlungszielTage: 0,
  betragCents: 25_000_000,
  kursUsdJeEur: 1.1188,
  kursDatum: "2026-10-26",
  ratenfreiMonate: 6,
  zinsfreiMonate: 16,
  zinsStartBp: 150,
  zinsSchrittBp: 50,
  laufzeitMinJahre: 5,
  laufzeitMaxJahre: 15,
  laufzeitVorschlagJahre: 10,
  aufstockungAbMonat: 18,
  // Nur Datenfeld, nirgends gezeigt (Justin 27.10.2026, 17:40) — die Vorgabe ist leer; die private Angebotsdatei darf es füllen.
  projekt: { art: "", wo: "", woKurz: "", bezahltProzent: 0, fertigstellung: "" },
  garantieWochen: 8,
  erstattungTage: 14,
  zielWochen: 4,
  // Rückfall NUR für Bestandsangebote (alle tragen ihren Staat selbst). Neue Angebote: neuesAngebotParameter → Delaware (E-465).
  bundesstaat: "Florida",
  staatenFassung: "",
  buergschaftMonate: 36,
  buerginAktiv: false,
  buerginStandAm: "",
  unterschriftFrei: false,
  begleitMonate: 12,
  unterlagen: [],
  ddAbgeschlossen: true,
  ansprechpartner: ["justin"],
  team: [],
  datenVomKunden: false,
  fastTrackWahl: false,
  // E-487: leer = Bestand (Wortlaut wie angenommen). Offene Angebote bekommen die aktuelle Fassung beim Lesen (kapitalCTempoFassungAus).
  tempoFassung: "",
};
export interface KapitalCDaten {
  ref: string;
  fassung: string;
  kunde: KapitalCKunde;
  buergin: KapitalBuergin;
  parameter: KapitalCParameter;
  gueltigBis: string;
}
/** Was der Kunde bei der Annahme wählt — steht im Annahmevermerk, NICHT in der Prüfsumme (der Vertrag regelt die Wahl). */
/**
 * E-474: `fastTrack` nur bei Angeboten mit fastTrackWahl (sonst fehlt der Schlüssel = mit Fast-Track wie bisher); `sofortBeginn` ist
 * dann nur mit Fast-Track verlangt. Bestand: immer true.
 */
export interface KapitalCWahl { llc: BegleitLlcWahl; laufzeitJahre: number; sofortBeginn: boolean; fastTrack?: boolean }
export interface KapitalCAnnahmeVermerk { am: Date; ip: string; userAgent: string; hash: string; wahl: KapitalCWahl; unterschrift: KapitalUnterschriftVermerk }
export interface KapitalCAnnahmeEingabe {
  textHash: string;
  llc: BegleitLlcWahl;
  laufzeitJahre: number;
  gelesen: boolean;
  sofortBeginn: boolean;
  /** E-474: nur bei fastTrackWahl — true/false, die Wahl der zwei Karten */
  fastTrack?: boolean;
  unterschrift: FirmaUnterschriftEingabe;
}

// ═══════════════════════════════════════════════════════════════════════════
// ZAHLEN UND NAMEN
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Geschütztes Leerzeichen zwischen Zahl und Einheit (€, US-$, %) und nach „≈“ — damit am Handy nie „≈ | 2.611 US-$“ oder
 * „2.333,86 | €“ umbricht (Nachprüfung 27.10.). Prüfstände glätten es mit /\s+/ (\s trifft auch U+00A0).
 */
export const KAPITAL_C_NB = " ";
const NB = KAPITAL_C_NB;
/** „2.333,86 €“ — Rate und Rechenwerte immer mit Cent. */
export function kapitalCEurCent(cents: number): string {
  return `${(Math.round(cents) / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${NB}€`;
}
/** „250.000 €“ / „699 €“ — wie kapitalEur (ganze Euro ohne Cent), mit geschütztem Leerzeichen. */
export function kapitalCEur(cents: number): string {
  return kapitalEur(cents).replace(/ €$/, `${NB}€`);
}
/** „2.611 US-$“ — ganze Dollar (eine Umrechnung ist eine Schätzung). */
export function kapitalCUsd(usd: number): string {
  return `${Math.round(usd).toLocaleString("de-DE")}${NB}US-$`;
}
/** „London, EC1V 2NX“ — die Postleitzahl bleibt beisammen (geschütztes Leerzeichen; Übersicht und Informationen, Runde 2). */
export function kapitalCOrtZeileNb(): string {
  return FIAON_FIRMA.ortZeile.replace(/([A-Z0-9]{2,4}) ([0-9][A-Z]{2})$/, `$1${NB}$2`);
}
/** „≈ 2.611 US-$“ — die Umrechnung, nie getrennt vom Zeichen. */
export function kapitalCUngefaehr(text: string): string {
  return `≈${NB}${text}`;
}
export function kapitalCInUsd(cents: number, kurs: number): number {
  return Math.round((cents / 100) * kurs);
}
/** „1,1188“ */
export function kapitalCKurs(kurs: number): string {
  return kurs.toLocaleString("de-DE", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}
/** „31. Dezember 2026“ */
const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
export function kapitalCTagLang(iso: string): string {
  const m = String(iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${Number(m[3])}. ${MONATE[Number(m[2]) - 1]} ${m[1]}` : "—";
}
/** Ordnungszahl im Dativ: „dem siebzehnten Monat“ — eins bis neunundneunzig. */
export function kapitalCOrdnung(n: number): string {
  const fest: Record<number, string> = { 1: "ersten", 3: "dritten", 7: "siebten", 8: "achten" };
  if (fest[n]) return fest[n];
  return n < 20 ? `${zahlwort(n)}ten` : `${zahlwort(n)}sten`;
}
export function kapitalCName(k: Pick<KapitalCKunde, "vorname" | "nachname">): string {
  return `${String(k.vorname ?? "").trim()} ${String(k.nachname ?? "").trim()}`.trim();
}
export function kapitalCGruss(k: Pick<KapitalCKunde, "anrede" | "vorname" | "nachname">): string {
  const nach = String(k.nachname || "").trim();
  return k.anrede && nach ? `${k.anrede} ${nach}` : kapitalCName(k);
}
/** „Herrn Mustermann“ / „Frau Muster“ — nach „für“. */
export function kapitalCGrussAkk(k: Pick<KapitalCKunde, "anrede" | "vorname" | "nachname">): string {
  const nach = String(k.nachname || "").trim();
  if (k.anrede === "Herr" && nach) return `Herrn ${nach}`;
  if (k.anrede === "Frau" && nach) return `Frau ${nach}`;
  return kapitalCName(k);
}
export function kapitalCAnrede(k: Pick<KapitalCKunde, "anrede" | "vorname" | "nachname">): string {
  const nach = String(k.nachname || "").trim();
  if (k.anrede === "Herr" && nach) return `Sehr geehrter Herr ${nach}`;
  if (k.anrede === "Frau" && nach) return `Sehr geehrte Frau ${nach}`;
  return `Guten Tag ${kapitalCName(k)}`;
}
const LAND_NAME: Record<KapitalCLand, string> = { DE: "Deutschland", AT: "Österreich", CH: "Schweiz" };
const AUSWEIS_NAME: Record<KapitalCAusweis["art"], string> = { reisepass: "Reisepass", personalausweis: "Personalausweis" };
/**
 * Die Ausweisnummer gekürzt — „••••••XYZ“ (nur die letzten drei Zeichen). Für die Seite und das Entwurfs-PDF: Der Link kann
 * weitergeleitet werden, die vollständige Nummer steht nur im angenommenen Vertrag und in der Akte (§ 20 PAuswG, Art. 5 DSGVO).
 */
export function kapitalCAusweisKurz(nummer: string): string {
  const n = String(nummer ?? "").trim();
  return n.length > 3 ? `${"•".repeat(n.length - 3)}${n.slice(-3)}` : "•••";
}
/** Darstellung des Vertrags: `ausweiseGekuerzt` für alles, was über den Link erreichbar ist, solange das Angebot offen ist. */
export interface KapitalCDarstellung { ausweiseGekuerzt?: boolean }
/** „Herr Max Mustermann, geboren am … in …, … Staatsangehöriger, wohnhaft …, ausgewiesen durch …“ — die Vertragszeile. */
export function kapitalCKundeZeile(k: KapitalCKunde, opt: KapitalCDarstellung = {}): string {
  // E-474: Geburtsdatum und Anschrift trägt der Kunde selbst ein (datenVomKunden) — bis dahin sagt die Zeile das, statt Lücken zu
  // zeigen. Annehmen lässt sich so nie (kapitalCPflichtFehlen); Bestand hat beides immer (kapitalCKundePruefen beim Anlegen).
  if (!k.geburtsdatum && !k.strasse) return `${k.anrede ? `${k.anrede} ` : ""}${kapitalCName(k)} (Geburtsdatum und Anschrift trägt der Auftraggeber vor der Annahme auf seiner Angebotsseite ein)`;
  const staat = k.staatsangehoerigkeit ? `, ${k.staatsangehoerigkeit}${k.anrede === "Frau" ? "e Staatsangehörige" : "er Staatsangehöriger"}` : "";
  const ausweise = k.ausweise.map((a) => `${AUSWEIS_NAME[a.art]} Nr. ${opt.ausweiseGekuerzt ? kapitalCAusweisKurz(a.nummer) : a.nummer} (${a.behoerde}, gültig bis ${kapitalTag(a.gueltigBis)})`);
  return `${k.anrede ? `${k.anrede} ` : ""}${kapitalCName(k)}, geboren am ${kapitalTag(k.geburtsdatum)}${k.geburtsort ? ` in ${k.geburtsort}` : ""}${staat}, wohnhaft ${k.strasse}, ${k.plz} ${k.ort}, ${LAND_NAME[k.land] ?? k.land}${ausweise.length ? `, ausgewiesen durch ${ausweise.join(" und ")}` : ""}`;
}
/** Fällig mit dem Auftrag. E-474: `fastTrack` false = ohne Fast-Track (nur bei fastTrackWahl); ohne Angabe wie bisher mit. */
export function kapitalCHeuteCents(par: Pick<KapitalCParameter, "gruendungCents" | "fastTrackCents">, fastTrack = true): number {
  return par.gruendungCents + (fastTrack ? par.fastTrackCents : 0);
}
/** Der Gesamtpreis des ersten Jahres: heute fällig + Erfolgshonorar bei Eintragung (§ 3 PAngV, Art. 246a EGBGB). */
export function kapitalCErstesJahrCents(par: Pick<KapitalCParameter, "gruendungCents" | "fastTrackCents" | "erfolgCents">, fastTrack = true): number {
  return kapitalCHeuteCents(par, fastTrack) + par.erfolgCents;
}
/**
 * E-474: Hat der Auftrag den Fast-Track? Ohne Wahl (Bestand, fastTrackWahl false) immer ja; mit Wahl, was der Kunde bei der Annahme
 * gewählt hat (fehlt die Wahl — vor der Annahme —, zählt sie als „mit“, damit nie ein zu kleiner Betrag entsteht).
 */
export function kapitalCMitFastTrack(par: Pick<KapitalCParameter, "fastTrackWahl">, wahl?: { fastTrack?: boolean } | null): boolean {
  return !par.fastTrackWahl || wahl?.fastTrack !== false;
}
/** E-474: Titel von Teil 1 (Rechnung, Bestellzeile, Angebotsteil) nach der Wahl. */
export const KAPITAL_C_TEIL1_TITEL_OHNE = "Gründung, Konto und Karten";
export function kapitalCTeil1Titel(fastTrack: boolean): string { return fastTrack ? KAPITAL_C_TEIL1_TITEL : KAPITAL_C_TEIL1_TITEL_OHNE; }
/** E-506: der Titel von Teil 1 nach dem Angebot — bei einer bestehenden Gesellschaft die Übernahme, sonst wie kapitalCTeil1Titel. */
export function kapitalCTeil1TitelFuer(par: Pick<KapitalCParameter, "bestand">, fastTrack: boolean): string {
  return par.bestand ? "Übernahme Ihrer Gesellschaft, Konto und Karten" : kapitalCTeil1Titel(fastTrack);
}
/**
 * Das Zahlungsziel als Vertragswort (E-432, 28.10.2026 — Justin: „Die Rechnung ist eigentlich umgehend, also sofort fällig“):
 * 0 Tage = „sofort“ (gesetzliche Grundregel § 271 Abs. 1 BGB, Muster des Individualangebots E-268), 1 Tag = „binnen eines Tages“,
 * sonst „binnen sieben Tagen“. Vorher ergab 0 „binnen null Tagen“. Bei sieben Tagen bleibt jeder Satz WORTGLEICH — die Prüfsumme
 * offener und angenommener Angebote ändert sich nicht.
 */
export function kapitalCZahlbar(tage: number): string {
  return tage <= 0 ? "sofort" : tage === 1 ? "binnen eines Tages" : `binnen ${zahlwort(tage)} Tagen`;
}

// ═══════════════════════════════════════════════════════════════════════════
// DER LAUFZEIT-RECHNER (rein — Seite, Annahmevermerk, Prüfstand)
// ═══════════════════════════════════════════════════════════════════════════
export type KapitalCKonditionen = Pick<KapitalCParameter, "betragCents" | "ratenfreiMonate" | "zinsfreiMonate" | "zinsStartBp" | "zinsSchrittBp" | "laufzeitMinJahre" | "laufzeitMaxJahre" | "kursUsdJeEur">;
/** Zins im Jahr (Basispunkte) im Monat m — 0 in den zinsfreien Monaten, danach die Treppe. */
export function kapitalCZinsBp(monat: number, k: Pick<KapitalCKonditionen, "zinsfreiMonate" | "zinsStartBp" | "zinsSchrittBp">): number {
  if (monat <= k.zinsfreiMonate) return 0;
  return k.zinsStartBp + k.zinsSchrittBp * Math.floor((monat - k.zinsfreiMonate - 1) / 12);
}
export interface KapitalCPlanStufe {
  vonMonat: number; bisMonat: number; zinsBp: number; ratenfrei: boolean;
  /** Zinsen in dieser Stufe und die Restschuld an ihrem Ende (Cent) */
  zinsenCents: number; restschuldCents: number;
}
export interface KapitalCPlan {
  jahre: number; raten: number; ersteRateMonat: number; letzteRateMonat: number;
  monatsrateCents: number; letzteRateCents: number;
  zinsenCents: number; rueckzahlungCents: number;
  /** Der Zins der letzten Rate und der Monat, ab dem er gilt */
  zinsZuletztBp: number; zinsZuletztAbMonat: number;
  treppe: KapitalCPlanStufe[];
  usd: { monatsrate: number; zinsen: number; rueckzahlung: number };
}
export function kapitalCLaufzeitGueltig(jahre: unknown, k: Pick<KapitalCKonditionen, "laufzeitMinJahre" | "laufzeitMaxJahre">): jahre is number {
  return typeof jahre === "number" && Number.isInteger(jahre) && jahre >= k.laufzeitMinJahre && jahre <= k.laufzeitMaxJahre;
}
export function kapitalCLaufzeiten(k: Pick<KapitalCKonditionen, "laufzeitMinJahre" | "laufzeitMaxJahre">): number[] {
  const aus: number[] = [];
  for (let j = k.laufzeitMinJahre; j <= k.laufzeitMaxJahre; j++) aus.push(j);
  return aus;
}
/**
 * Der Plan für T Jahre: gleichbleibende Rate, die das Darlehen unter der Zinstreppe genau tilgt.
 * Geschlossen: Saldo nach den ratenfreien Monaten S = R · Σ_{m} D_m mit D_m = Π_{j ≤ m} (1 + i_j)⁻¹ ab der ersten Rate.
 * Dann monatlich in Cent: Zins gerundet, Rate abgezogen; die letzte Rate nimmt den Rest — der Saldo endet genau bei null.
 */
export function kapitalCPlan(k: KapitalCKonditionen, jahre: number): KapitalCPlan {
  if (!kapitalCLaufzeitGueltig(jahre, k)) throw new RangeError(`Laufzeit ${jahre} liegt nicht zwischen ${k.laufzeitMinJahre} und ${k.laufzeitMaxJahre} Jahren.`);
  const raten = 12 * jahre;
  const erste = k.ratenfreiMonate + 1;
  const letzte = k.ratenfreiMonate + raten;
  const i = (m: number) => kapitalCZinsBp(m, k) / 10_000 / 12;
  // Zins eines Monats in Cent aus GANZEN Zahlen: Saldo (Cent) · Basispunkte / 120.000, kaufmännisch gerundet. Mit Kommazahlen
  // (saldo · 0,075/12) lag der Faktor knapp unter dem exakten Wert — halbe Cent rundeten dann manchmal ab (Nachprüfung 27.10.).
  // Saldo · bp ist eine ganze Zahl < 2^53, die Division ist korrekt gerundet: ein exakt halber Cent bleibt exakt halb.
  const zinsCent = (saldoCents: number, m: number) => Math.round((saldoCents * kapitalCZinsBp(m, k)) / 120_000);
  // Ratenfreie Monate: Zins (falls je einer anfällt) wächst dem Saldo zu.
  let saldo = Math.round(k.betragCents);
  let zinsen = 0;
  const treppe: KapitalCPlanStufe[] = [];
  const stufe = (m: number, ratenfrei: boolean): KapitalCPlanStufe => {
    const bp = kapitalCZinsBp(m, k);
    const letzteStufe = treppe[treppe.length - 1];
    if (!letzteStufe || letzteStufe.zinsBp !== bp || letzteStufe.ratenfrei !== ratenfrei) {
      treppe.push({ vonMonat: m, bisMonat: m, zinsBp: bp, ratenfrei, zinsenCents: 0, restschuldCents: saldo });
    }
    return treppe[treppe.length - 1];
  };
  for (let m = 1; m < erste; m++) {
    const s = stufe(m, true);
    const z = zinsCent(saldo, m);
    saldo += z; zinsen += z;
    s.bisMonat = m; s.zinsenCents += z; s.restschuldCents = saldo;
  }
  let summe = 0; let faktor = 1;
  for (let m = erste; m <= letzte; m++) { faktor /= 1 + i(m); summe += faktor; }
  const rate = Math.round(saldo / summe);
  let letzteRate = rate;
  for (let m = erste; m <= letzte; m++) {
    const s = stufe(m, false);
    const z = zinsCent(saldo, m);
    saldo += z; zinsen += z;
    const zahlung = m === letzte ? saldo : rate;
    if (m === letzte) letzteRate = zahlung;
    saldo -= zahlung;
    s.bisMonat = m; s.zinsenCents += z; s.restschuldCents = saldo;
  }
  const rueckzahlung = Math.round(k.betragCents) + zinsen;
  const zuletzt = treppe[treppe.length - 1];
  return {
    jahre, raten, ersteRateMonat: erste, letzteRateMonat: letzte,
    monatsrateCents: rate, letzteRateCents: letzteRate, zinsenCents: zinsen, rueckzahlungCents: rueckzahlung,
    zinsZuletztBp: kapitalCZinsBp(letzte, k), zinsZuletztAbMonat: zuletzt.vonMonat,
    treppe,
    usd: { monatsrate: kapitalCInUsd(rate, k.kursUsdJeEur), zinsen: kapitalCInUsd(zinsen, k.kursUsdJeEur), rueckzahlung: kapitalCInUsd(rueckzahlung, k.kursUsdJeEur) },
  };
}
/** „vier“ → „Vier“ */
export function gross(t: string): string { return t ? t[0].toUpperCase() + t.slice(1) : t; }
/** „1,5 %“ / „2 %“ — nie „2,0 %“ (die Wortwand liest „0 %“ als Zinsversprechen). */
export function kapitalCProzent(bp: number): string {
  return `${kapitalProzent(bp)}${NB}%`;
}
/** Weicht die letzte Rate (Restbetrag, bis rund 1 €) von der Monatsrate ab? Dann wird sie überall offen genannt. */
export function kapitalCLetzteRateAnders(plan: Pick<KapitalCPlan, "monatsrateCents" | "letzteRateCents">): boolean {
  return plan.letzteRateCents !== plan.monatsrateCents;
}
/** Die Zeile für den Annahmevermerk und die Übersicht: „zehn Jahre (120 Monatsraten ab dem siebten Monat); Monatsrate nach dem Rechenbeispiel …“ */
export function kapitalCLaufzeitSatz(par: KapitalCParameter, jahre: number): string {
  const plan = kapitalCPlan(par, jahre);
  const letzte = kapitalCLetzteRateAnders(plan) ? `, letzte Rate ${kapitalCEurCent(plan.letzteRateCents)}` : "";
  return `${zahlwort(jahre)} Jahre (${plan.raten} Monatsraten ab dem ${kapitalCOrdnung(plan.ersteRateMonat)} Monat nach der Auszahlung); Monatsrate nach dem Rechenbeispiel ${kapitalCEurCent(plan.monatsrateCents)} (${kapitalCUngefaehr(kapitalCUsd(plan.usd.monatsrate))}${letzte}), Zinsen insgesamt ${kapitalCEurCent(plan.zinsenCents)}, Rückzahlung insgesamt ${kapitalCEurCent(plan.rueckzahlungCents)}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE GELD-ZURÜCK-GARANTIE — EINE QUELLE
// Sie sichert das GELD des Kunden, nicht die Auszahlung: nie „Auszahlung garantiert“, nie „sicher“ (Nachprüfung 27.10., § 5 UWG).
// Der Prüfstand lässt „Garantie“ nur als Hauptwort an dieser Garantie stehen; „garantiert/garantieren“ bleibt überall rot.
// ═══════════════════════════════════════════════════════════════════════════
export const KAPITAL_C_GARANTIE_NAME = "Geld-zurück-Garantie";
export function kapitalCGarantie(par: Pick<KapitalCParameter, "garantieWochen" | "erstattungTage" | "zielWochen" | "betragCents"> & Partial<Pick<KapitalCParameter, "datenVomKunden" | "fastTrackWahl" | "bestand" | "tempoFassung">>) {
  const w = zahlwort(par.garantieWochen); const t = zahlwort(par.erstattungTage); const z = zahlwort(par.zielWochen);
  // E-512: erweitertes Ruhen (Mitwirkung auf Bitte, Behörden und Register, höhere Gewalt) — nur ab Tempo-Fassung „E-512“;
  // „E-487“ und leer (so angenommen) bleiben wortgleich.
  const R = kapitalCRuhenErweitert(par);
  // E-512: Bei einer übernommenen Gesellschaft (E-506) gibt es keine Eintragung und keine neue EIN — eigene Beispiele.
  const behoerdeBsp = par.bestand ? "etwa eine Berichtigung bei der US-Steuerbehörde, die ITIN oder ein Eintrag im Register des Bundesstaats" : "etwa die Eintragung Ihrer Gesellschaft, die EIN oder die ITIN";
  // E-474: Ruhen nach der Wahl — „Gründung und Fast-Track“ wird „die Vergütung mit Ihrem Auftrag“, ohne Ausweis vor der Unterschrift
  // ruht die Frist auch, bis der Reisepass vorliegt (Ziffer 4 Absatz 6). Ohne beide Parameter wortgleich wie bisher.
  const bezahlt = par.fastTrackWahl || par.bestand ? "die Vergütung mit Ihrem Auftrag nicht bezahlt ist" : "Gründung und Fast-Track nicht bezahlt sind";
  const pass = par.datenVomKunden ? ", bis Ihr Reisepass nach Vertragsschluss vorliegt" : "";
  return {
    name: KAPITAL_C_GARANTIE_NAME,
    vertrag: `${KAPITAL_C_GARANTIE_NAME}: Wird der Gesellschaft die Finanzierung nach Absatz 1 und 2 nicht binnen ${w} Wochen ab Auftragserteilung ausgezahlt, erstattet FIAON dem Auftraggeber alles, was er bis dahin an FIAON gezahlt hat (Ziffer 6 Absatz 1 und 2), binnen ${t} Tagen nach Fristende; noch nicht gezahlte Vergütungen entfallen. ${par.bestand ? "Die Gesellschaft bleibt dem Auftraggeber; ihre US-Meldepflichten nach Ziffer 8 bestehen fort." : "Die Gesellschaft bleibt dem Auftraggeber; auf seinen Wunsch löst FIAON sie dann auf und trägt die Kosten dafür; bis dahin bestehen ihre US-Meldepflichten nach Ziffer 8 fort."}`,
    karte: `${KAPITAL_C_GARANTIE_NAME}: Kommt die Auszahlung nicht binnen ${w} Wochen, erhalten Sie alles zurück, was Sie an uns gezahlt haben.${R ? " Wartezeiten bei Behörden und auf Ihre Unterlagen zählen nicht mit." : ""}`,
    ziel: par.fastTrackWahl ? `Mit Fast-Track ist unser Ziel die Auszahlung in Woche ${z}.` : `Unser Ziel ist die Auszahlung in Woche ${z}.`,
    seite: `Kommt die Auszahlung nicht binnen ${w} Wochen ab Ihrem Auftrag, erstatten wir Ihnen alles, was Sie an uns gezahlt haben — binnen ${t} Tagen.${R ? " Nicht mitgezählt werden die Tage, an denen wir auf eine Behörde oder auf Unterlagen von Ihnen warten (Ziffer 4)." : ""}`,
    uebersicht: R
      ? `Kommt die Auszahlung nicht binnen ${w} Wochen ab Auftragserteilung, erhalten Sie alles Gezahlte zurück — binnen ${t} Tagen; Wartezeiten bei Behörden und auf Ihre Unterlagen zählen nicht mit`
      : `Kommt die Auszahlung nicht binnen ${w} Wochen ab Auftragserteilung, erhalten Sie alles Gezahlte zurück — binnen ${t} Tagen`,
    frage: R
      ? `Dann erstatten wir Ihnen alles, was Sie an uns gezahlt haben — binnen ${t} Tagen nach Ablauf der ${w} Wochen. Nicht mitgezählt werden die Tage, an denen wir auf eine Behörde (etwa die US-Steuerbehörde) oder auf Unterlagen und Antworten von Ihnen warten. So steht es als ${KAPITAL_C_GARANTIE_NAME} in Ziffer 4 Ihres Vertrags.`
      : `Dann erstatten wir Ihnen alles, was Sie an uns gezahlt haben — binnen ${t} Tagen nach Ablauf der ${w} Wochen. So steht es als ${KAPITAL_C_GARANTIE_NAME} in Ziffer 4 Ihres Vertrags.`,
    /** Die Garantie mit ihren Ruhensgründen in einem Satz — für die Informationen vor Vertragsschluss (Art. 246a § 1 EGBGB). */
    info: R
      ? `Kommt die Auszahlung nicht binnen ${w} Wochen ab Ihrem Auftrag, erstatten wir Ihnen alles Gezahlte binnen ${t} Tagen. Die Frist ruht, solange ${bezahlt}${pass}, solange wir auf Unterlagen, Angaben, Unterschriften oder Antworten warten, um die wir oder die Bank Sie in Textform gebeten haben (bis zum Eingang), solange ein Antrag bei einer Behörde oder einem Register — ${behoerdeBsp} — eingereicht und noch nicht beschieden ist, bei höherer Gewalt und solange Ihrer Gesellschaft ein Angebot zu den Bedingungen nach Ziffer 4 ohne weitere Sicherheiten oder Kosten für Sie zur Annahme vorliegt; lehnt sie ein solches Angebot ab oder lässt sie es verfallen, entfällt die Geld-zurück-Garantie (Ziffer 4).`
      : `Kommt die Auszahlung nicht binnen ${w} Wochen ab Ihrem Auftrag, erstatten wir Ihnen alles Gezahlte binnen ${t} Tagen. Die Frist ruht nur, solange ${bezahlt}${pass}, für die Tage, um die Sie die Frist für von der Bank angeforderte Unterlagen überschreiten, und solange Ihrer Gesellschaft ein Angebot zu den Bedingungen nach Ziffer 4 ohne weitere Sicherheiten oder Kosten für Sie zur Annahme vorliegt; lehnt sie ein solches Angebot ab oder lässt sie es verfallen, entfällt die Geld-zurück-Garantie (Ziffer 4).`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DER VERTRAG
// ═══════════════════════════════════════════════════════════════════════════
const p = (text: string): AngebotAbsatz => ({ art: "p", text });
const liste = (zeilen: string[], einleitung?: string): AngebotAbsatz => (einleitung ? { art: "liste", einleitung, zeilen } : { art: "liste", zeilen });

export function kapitalCVertragTitel(): string {
  return "FIAON Global — Vertrag über US-Gesellschaft, Konto und Karten, Begleitung zur Finanzierung und Bürgschaft";
}
/**
 * Runde 2 (Kundensicht): „Vertragsstand 27.10.2026“ statt der internen Kennung „IA-KAPITAL-…-C“ (die bleibt in Prüfsumme und Akte).
 * E-487 (09.11.2026): mit der Tempo-Fassung des Vertrags (kapitalCVertragsstand) — die Unterzeile steht nicht in der Prüfsumme.
 */
export function kapitalCVertragUnterzeile(d: Pick<KapitalCDaten, "ref" | "fassung" | "gueltigBis"> & { parameter: Pick<KapitalCParameter, "tempoFassung"> }): string {
  const stand = kapitalCVertragsstand(d.fassung, d.parameter.tempoFassung);
  return `${KAPITAL_C_MARKE} · Angebot ${d.ref} · gültig bis ${kapitalTag(d.gueltigBis)}${stand ? ` · Vertragsstand ${stand}` : ""}`;
}
/** Der Satz zu den Konditionen — eine Quelle für Vertrag (Ziffer 4 Absatz 2), Seite und Übersicht. */
export function kapitalCKonditionenSatz(par: KapitalCParameter): string {
  const s1 = par.zinsfreiMonate + 1; const s2 = s1 + 12; const s3 = s2 + 12;
  return `Die ersten ${zahlwort(par.ratenfreiMonate)} Monate nach der Auszahlung sind ratenfrei. Danach zahlt die Gesellschaft das Darlehen in gleichbleibenden Monatsraten über die Laufzeit zurück, die der Auftraggeber bei der Annahme wählt: ${zahlwort(par.laufzeitMinJahre)} bis ${zahlwort(par.laufzeitMaxJahre)} Jahre. Die ersten ${zahlwort(par.zinsfreiMonate)} Monate sind zinsfrei; ab dem ${kapitalCOrdnung(s1)} Monat beträgt der Zins ${kapitalCProzent(par.zinsStartBp)} im Jahr und steigt danach mit jedem weiteren Jahr um ${kapitalProzent(par.zinsSchrittBp)} Prozentpunkte (ab dem ${kapitalCOrdnung(s2)} Monat ${kapitalCProzent(par.zinsStartBp + par.zinsSchrittBp)}, ab dem ${kapitalCOrdnung(s3)} Monat ${kapitalCProzent(par.zinsStartBp + 2 * par.zinsSchrittBp)} und so fort). Ab dem ${kapitalCOrdnung(par.aufstockungAbMonat)} Monat kann die Gesellschaft auf Wunsch eine Aufstockung beantragen oder die Finanzierung über ein anderes Institut umschulden; darüber entscheidet das jeweilige Institut. Solange die Jahresbetreuung nach Ziffer 6 Absatz 3 läuft, begleitet FIAON die Gesellschaft dabei.`;
}
/** „Ausgezahlt wird in US-Dollar zum Referenzkurs der EZB am Tag der Auszahlung; zum Kurs vom … sind das rund … US-$“ */
export function kapitalCBetragSatz(par: KapitalCParameter): string {
  return `Ausgezahlt wird in US-Dollar zum Referenzkurs der Europäischen Zentralbank am Tag der Auszahlung; zum Kurs vom ${kapitalTag(par.kursDatum)} sind das rund ${kapitalCUsd(kapitalCRahmenUsd(par))}`;
}
/**
 * Die Verwendung der Mittel — EINE Quelle für Seite (Konditionen, Fragen) und Vertrag (Ziffer 4 Absatz 4). Kein Zweck, kein Ort,
 * kein Projekt (Justin 27.10.2026, 17:40): Wofür die Gesellschaft die Finanzierung einsetzt, entscheidet der Kunde — im Rahmen der
 * Bedingungen der Bank. (Vorher: kapitalCProjektSatz mit Projekt, Ort, bezahltem Anteil und Fertigstellung — entfernt.)
 */
export const KAPITAL_C_VERWENDUNG = {
  seite: "Wofür Ihre Gesellschaft die Finanzierung einsetzt, entscheiden Sie.",
  vertrag: "Die Mittel sind nicht an die USA gebunden: Wofür und wo die Gesellschaft sie einsetzt, auch in Europa, entscheidet sie selbst im Rahmen der Bedingungen des finanzierenden Instituts.",
  /** Der Rat zur Vorsicht (Runde 1), ohne Projekt: nichts zusagen, was von der Finanzierung abhängt, bevor sie da ist. */
  rat: "Unser Rat: Sagen Sie Zahlungen, die von der Finanzierung abhängen, erst nach der Auszahlung zu.",
} as const;
export const KAPITAL_C_SOFORT_TEXT = "Ich verlange ausdrücklich, dass FIAON vor Ablauf der Widerrufsfrist mit der Arbeit beginnt (Fast-Track). Mir ist bekannt, dass ich bei einem Widerruf die bis dahin erbrachten Leistungen anteilig bezahle und dass mein Widerrufsrecht erlischt, wenn FIAON den Vertrag vollständig erfüllt hat.";
/**
 * E-475 (Justin 02.11.2026): die Bestätigung „sofort beginnen“ bei fastTrackWahl — ohne „(Fast-Track)“, denn sie gilt mit und ohne
 * Fast-Track. Der Bestand (ohne Wahl) behält KAPITAL_C_SOFORT_TEXT wortgleich.
 */
export const KAPITAL_C_SOFORT_TEXT_WAHL = "Ich verlange ausdrücklich, dass FIAON vor Ablauf der Widerrufsfrist mit der Arbeit beginnt. Mir ist bekannt, dass ich bei einem Widerruf die bis dahin erbrachten Leistungen anteilig bezahle und dass mein Widerrufsrecht erlischt, wenn FIAON den Vertrag vollständig erfüllt hat.";
/**
 * E-475: die Zeiten der zwei Wahlen — EINE Quelle für Karten, Vertrag, Seite, Übersicht, Bestätigung und Aufgabe.
 * E-487 (09.11.2026): `mit` und `itin` lesen nur noch Verträge, die vor E-487 so angenommen wurden (tempoFassung leer); offene Angebote
 * nennen mit Fast-Track keine Zeit mehr, sondern den Vorrang (kapitalCVorrang). `ohne` bleibt für beide (Geschäftsentscheidung).
 */
export const KAPITAL_C_TEMPO = {
  ohne: "drei bis fünf Wochen",
  mit: "72 Stunden",
  itin: "Die ITIN folgt so schnell wie möglich.",
} as const;
/**
 * E-487 (09.11.2026): die aktuelle Tempo-Fassung (Parameter tempoFassung) — Vorrang in allen Schritten, keine Zeitzusage für die EIN.
 * Eine künftige Fassung bekommt einen EIGENEN Wert und verzweigt auf genau ihn — so angenommene Verträge („E-487“) bleiben wortgleich.
 */
export const KAPITAL_C_TEMPO_FASSUNG = "E-512";
/** E-487 (09.11.2026): die Vorrang-Fassung — so angenommene Verträge lesen sie unverändert. */
export const KAPITAL_C_TEMPO_FASSUNG_E487 = "E-487";
/**
 * E-512 (13.11.2026, Justin): Die Frist der Geld-zurück-Garantie ruht zusätzlich, solange FIAON auf eine erbetene Mitwirkung des
 * Auftraggebers wartet, solange ein Antrag bei einer Behörde oder einem Register läuft, und bei höherer Gewalt. Die Bearbeitung
 * durch das finanzierende Institut ruht bewusst NICHT — sie ist der Kern der Garantie. Gilt für jede Tempo-Fassung in dieser Menge;
 * eine künftige Fassung, die das Ruhen behält, kommt hier dazu.
 */
const KAPITAL_C_RUHEN_FASSUNGEN: ReadonlySet<string> = new Set(["E-512"]);
export function kapitalCRuhenErweitert(par: Partial<Pick<KapitalCParameter, "tempoFassung">>): boolean {
  return KAPITAL_C_RUHEN_FASSUNGEN.has(String(par.tempoFassung ?? ""));
}
/** E-487: Gilt die Vorrang-Fassung des Fast-Track? Leer = Wortlaut vor E-487 — den lesen nur noch Verträge, die so angenommen wurden. */
export function kapitalCVorrangGilt(par: Pick<KapitalCParameter, "tempoFassung">): boolean {
  return String(par.tempoFassung ?? "") !== "";
}
/**
 * E-487: Welche Tempo-Fassung gilt für ein Angebot? Nicht angenommen → immer die aktuelle (ein offenes Angebot liest den heutigen
 * Wortlaut, ohne dass in der Datenbank etwas geschrieben wird). Angenommen → NUR die bei der Annahme festgehaltene
 * (schalter.tempoFassung), sonst leer = vor E-487 angenommen: Der Vertrag liest sich genau so, wie er angenommen wurde.
 * Nachbesserung E-487 (09.11.2026, Gutachten): kein Rückgriff mehr auf den Wert in den gespeicherten Parametern — nahm ein Kunde ein
 * schon so angelegtes Angebot noch auf dem alten Server an (Wortlaut „72 Stunden“, kein Vermerk), hätte sich sein Vertrag nach dem
 * Deploy als neue Fassung gelesen (andere Prüfsumme, Bestätigung und Aufgabe gegen das unterschriebene PDF).
 */
export function kapitalCTempoFassungAus(lage: { angenommen: boolean; schalter?: { tempoFassung?: unknown } | null }): string {
  if (!lage.angenommen) return KAPITAL_C_TEMPO_FASSUNG;
  const s = lage.schalter?.tempoFassung;
  return typeof s === "string" ? s.slice(0, 20) : "";
}
/**
 * E-487: Fast-Track = Vorrang in allen Schritten — EINE Quelle für Vertrag (Ziffer 2 Absatz 3), Karten, Seite, Fragen, Informationen
 * und Aufgabe. Für die EIN zählt der Tag des ANTRAGS (am Tag der Eintragung); wie lange die US-Steuerbehörde danach braucht, sagt kein
 * Satz zu. Nachbesserung E-487 (Gutachten):
 *   · Der Express steht nur da, wo die Gründungs-Anleitung ihn beim Fast-Track wirklich bucht (express.imFastTrack in
 *     shared/fiaon-global-bundesstaaten.ts — heute nur Delaware; Wyoming hat einen teuren Eilservice, den die Anleitung nicht bucht).
 *   · Die Frist für die Anmeldung gilt, sobald ein verfügbarer Name feststeht (Ziffer 2 Absatz 1: ist keiner der gewählten Namen frei,
 *     stimmt FIAON einen neuen mit dem Kunden ab); der Antrag auf die EIN folgt der Unterschrift des Kunden auf dem vorbereiteten
 *     Formular. Beides steht im Vertrag UND in den Informationen vor Vertragsschluss (§ 312d Abs. 1 S. 2 BGB: sie werden Vertragsinhalt).
 */
export function kapitalCVorrang(par: Pick<KapitalCParameter, "bundesstaat" | "datenVomKunden">) {
  const express = staatInfo(par.bundesstaat)?.express.imFastTrack === true;
  // Mit Angaben vom Kunden (E-474) beginnt FIAON erst, wenn auch der Reisepass da ist (Ziffer 7 Absatz 1).
  const nachSie = par.datenVomKunden ? "nach dem Eingang Ihrer Zahlung und Ihres Reisepasses" : "nach Ihrem Zahlungseingang";
  const anmeldung = `Anmeldung${express ? " mit Express" : ""} spätestens am Werktag ${nachSie}`;
  const ein = "Antrag auf die EIN am Tag der Eintragung, sobald Sie das dafür vorbereitete Formular unterschrieben haben";
  return {
    express,
    /**
     * Vertrag, Ziffer 2 Absatz 3 — die drei Schritte als ein Satzteil ab „die Anmeldung …“ (klein; am Satzanfang mit gross()).
     * `nach` ist der Eingang („diesem Eingang“ oder der ganze Satzteil mit Ziffer 6 Absatz 1).
     */
    vertragSchritte: (nach: string) => `die Anmeldung reicht FIAON ${express ? "mit der Express-Bearbeitung des Bundesstaats " : ""}spätestens am Werktag nach ${nach} ein, sobald ein verfügbarer Name feststeht (Absatz 1); den Antrag auf die EIN stellt FIAON am Tag der Eintragung, sobald der Auftraggeber das dafür vorbereitete Formular unterschrieben hat; die Unterlagen für das finanzierende Institut entstehen parallel zur Gründung`,
    anmeldung, ein,
    /** Die Zeile in der Karte „Mit Fast-Track“ — kurz (am Handy eine Zeile weniger); die Bedingungen stehen in Informationen und Vertrag. */
    anmeldungKarte: `Anmeldung${express ? " mit Express" : ""} spätestens am Werktag nach ${par.datenVomKunden ? "Zahlung und Reisepass" : "Ihrem Zahlungseingang"}`,
    /** Informationen vor Vertragsschluss: „Anmeldung … spätestens am Werktag nach …, sobald ein verfügbarer Name feststeht; Antrag auf die EIN …; die Unterlagen für die Bank parallel“ */
    liste: `${anmeldung}, sobald ein verfügbarer Name feststeht; ${ein}; die Unterlagen für die Bank parallel`,
    frage: `Vorrang in jedem Schritt: Wir melden Ihre Gesellschaft ${express ? "mit dem Express des Bundesstaats " : ""}spätestens am Werktag ${nachSie} an, stellen den Antrag auf die EIN am Tag der Eintragung — sobald Sie das Formular unterschrieben haben, das wir dafür vorbereiten — und bereiten die Unterlagen für die Bank parallel vor. So liegt jeder Antrag so früh wie möglich bei der zuständigen Behörde.`,
  };
}
export const KAPITAL_C_GELESEN_TEXT = "Ich habe den Vertrag, die Informationen vor Vertragsschluss und die Widerrufsbelehrung mit dem Muster-Widerrufsformular gelesen.";
// Runde 2 (27.10.): „für die Finanzierung gilt …“ statt „für sie gilt …“ — „sie“ ließ sich auf Konto und Karten lesen (Ziffer 3 Abs. 2).
export const KAPITAL_C_PFLICHT_ZUSATZ = "Über Konto, Karten und deren Rahmen entscheidet das jeweilige Institut, über die Finanzierung das finanzierende Institut; für die Finanzierung gilt die Geld-zurück-Garantie nach Ziffer 4.";
const KAPITAL_C_KARTEN_SOLLZINS = "Einführungszeiträume ohne Sollzins bieten manche Herausgeber an; die Bedingungen legt jeder Herausgeber selbst fest.";
/**
 * Ihre Verantwortung — der persönliche Rückgriff in einem ruhigen Satz, mit Obergrenze (Rechner, Übersicht, Fragen, Informationen;
 * Ziffer 5 Absatz 1 und 5: Höchstbetrag der Bürgschaft ist das ausgezahlte Darlehen, der Rückgriff umfasst die Kosten).
 */
export const KAPITAL_C_VERANTWORTUNG = "Muss unsere Partnergesellschaft als Bürgin einspringen, weil Ihre Gesellschaft nicht zahlt, ersetzen Sie ihr den gezahlten Betrag persönlich — höchstens in Höhe des ausgezahlten Darlehens, zuzüglich der Kosten (Ziffer 5). Solange Ihre Gesellschaft ihre Raten zahlt, kommt es dazu nicht.";

/**
 * Der Registerstand der Bürgin als Satz — null, wenn sie als aktiv geführt wird. Vertrag (Ziffer 5 Absatz 1), Fragen und
 * Informationen nennen ihn offen, solange sie inaktiv ist; mit buerginAktiv = true verschwindet er überall.
 * Runde 2 (Kundensicht): Auf der Seite mit Folge und Schutz — bürgt sie nicht rechtzeitig, greift die Geld-zurück-Garantie, auch für
 * das Erfolgshonorar. `staat` = Bundesstaat der Bürgin („im Register von Florida“).
 */
export function kapitalCBuerginStand(par: Pick<KapitalCParameter, "buerginAktiv" | "buerginStandAm" | "ddAbgeschlossen" | "garantieWochen">, art: "vertrag" | "seite", staat = ""): string | null {
  if (par.buerginAktiv) return null;
  const stand = par.buerginStandAm ? ` (Stand ${kapitalTag(par.buerginStandAm)})` : "";
  return art === "vertrag"
    ? `Die Bürgin wird im Register ihres Bundesstaats derzeit als inaktiv geführt${stand}; die Bürgschaft übernimmt sie erst nach ihrer Reaktivierung, wenn sie dort wieder als aktiv geführt wird (Absatz ${kapitalCZ5(par).bedingungen}).`
    : `Offen gesagt: Die Bürgin wird im Register ${staat ? `von ${staat}` : "ihres Bundesstaats"} derzeit als inaktiv geführt${stand}. Bürgen wird sie erst, wenn sie dort wieder als aktiv geführt wird (Ziffer 5). Bürgt sie nicht rechtzeitig, greift Ihre ${KAPITAL_C_GARANTIE_NAME}: Kommt die Auszahlung nicht binnen ${zahlwort(par.garantieWochen)} Wochen, erhalten Sie alles zurück, was Sie an uns gezahlt haben — auch das Erfolgshonorar.`;
}
/** Der Ort der Bürgin aus ihrer Anschrift („…, Miami, FL 33145, USA“ → „Miami“) — sonst ihr Bundesstaat. */
export function kapitalCBuerginOrt(b: Pick<KapitalBuergin, "anschrift" | "bundesstaat">): string {
  const teile = String(b.anschrift ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const i = teile.findIndex((x) => /^[A-Z]{2}\s+\d{5}(-\d{4})?$/.test(x));
  return i > 0 && /^[A-Za-zÀ-ÿ .'-]{2,40}$/.test(teile[i - 1]) ? teile[i - 1] : String(b.bundesstaat ?? "");
}
/**
 * E-487 (09.11.2026, Gutachten): der Stand je Tempo-Fassung — ein Vertrag mit der Vorrang-Fassung hat einen anderen Wortlaut als einer
 * mit „72 Stunden“ und trägt deshalb ihren Stand. Eine künftige Fassung bekommt hier ihren eigenen Eintrag.
 */
const KAPITAL_C_TEMPO_STAND: ReadonlyMap<string, string> = new Map([[KAPITAL_C_TEMPO_FASSUNG_E487, "2026-11-09"], ["E-512", "2026-11-13"]]);
/**
 * „27.10.2026“ aus der Fassung „IA-KAPITAL-2026-10-27-C“ — die Kundensicht nennt den Vertragsstand, nie die interne Kennung.
 * E-487: mit Tempo-Fassung der spätere der beiden Stände („09.11.2026“); leere Tempo-Fassung (vor E-487 angenommen) → wortgleich wie bisher.
 */
export function kapitalCVertragsstand(fassung: string, tempoFassung = ""): string {
  const m = String(fassung ?? "").match(/(\d{4})-(\d{2})-(\d{2})/);
  const ausFassung = m ? `${m[1]}-${m[2]}-${m[3]}` : "";
  const ausTempo = KAPITAL_C_TEMPO_STAND.get(String(tempoFassung ?? "")) ?? "";
  const iso = ausTempo > ausFassung ? ausTempo : ausFassung;
  return iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "";
}
/** Die Absatznummern in Ziffer 5 — der Absatz zur Prüfung entfällt ohne abgeschlossene Due Diligence, die Verweise folgen. */
function kapitalCZ5(par: Pick<KapitalCParameter, "ddAbgeschlossen">): { bedingungen: number; sicherheiten: number; rueckgriff: number } {
  const bedingungen = par.ddAbgeschlossen ? 3 : 2;
  return { bedingungen, sicherheiten: bedingungen + 1, rueckgriff: bedingungen + 2 };
}

// ═══════════════════════════════════════════════════════════════════════════
// E-506: DIE TEXTE DER ÜBERNAHME — eine Quelle für Vertrag, Seite, Übersicht, Annahme und „Mein Auftrag“
// Nur mit parameter.bestand; sonst null, und jeder Satz bleibt wortgleich wie bisher (Prüfsumme des Bestands).
// Wortgrenzen wie überall: kein „bis zu“, nie „garantiert“, FIAON schuldet die Arbeit — über Register und Meldungen
// entscheiden Bundesstaat und US-Steuerbehörde, über die Finanzierung das finanzierende Institut.
// ═══════════════════════════════════════════════════════════════════════════
export interface KapitalCBestandBlock {
  auge: string; titel: string; sub: string;
  karte: { auge: string; name: string; zeile: string; status: string; statusZeile: string; seitLabel: string; seit: string; eingetragenAm: string; alterEinheit: string; alterZeile: string };
  datenTitel: string; daten: { label: string; wert: string }[];
  gutTitel: string; gut: string[];
  ordnungTitel: string; ordnungSub: string; ordnung: string[];
  fuss: string;
}
export function kapitalCBestandTexte(d: Pick<KapitalCDaten, "parameter">) {
  const par = d.parameter; const B = par.bestand;
  if (!B) return null;
  const name = B.name; const staat = B.bundesstaat; const seit = kapitalTag(B.eingetragenAm);
  const register = B.registerNr ? `, Registernummer ${B.registerNr}` : "";
  const betrag = kapitalCEur(par.betragCents); const preis = kapitalCEur(kapitalCHeuteCents(par)); const erfolg = kapitalCEur(par.erfolgCents);
  const jahr1 = kapitalCEur(kapitalCErstesJahrCents(par)); const jahres = kapitalCEur(par.jahresCents);
  const zahlbar = kapitalCZahlbar(par.zahlungszielTage); const ziel = zahlwort(par.zielWochen); const wochen = zahlwort(par.garantieWochen);
  const DK = par.datenVomKunden;
  /** Erfolgshonorar erst nach Übernahme UND Bürgschaft (erfolgBei) — sonst schon bei „übernommen und bankfertig“. */
  const A = B.erfolgBei === "buergschaft";
  const fertig = A ? "sobald Ihre Gesellschaft übernommen ist und unsere US-Partnergesellschaft für Ihre Finanzierung bürgt" : "sobald Ihre Gesellschaft übernommen und bankfertig ist";
  return {
    name, staat, seit,
    // ── Vertrag ──
    praeambel: [
      `Der Auftraggeber ist nach seinen Angaben alleiniger Gesellschafter der ${name}, einer Gesellschaft nach dem Recht des Bundesstaats ${staat}${register}, eingetragen am ${seit}. Sie soll eine Finanzierung aufnehmen.`,
      `FIAON übernimmt die Betreuung dieser Gesellschaft, bringt ihre Meldungen, Registereinträge und Unterlagen in Ordnung, bereitet Konto und Karten vor und begleitet sie bis zur Finanzierung über ${betrag} durch eine US-Bank. Die US-Partnergesellschaft von FIAON übernimmt dafür eine Bürgschaft, und FIAON gibt dem Auftraggeber eine ${KAPITAL_C_GARANTIE_NAME}: Kommt die Auszahlung nicht rechtzeitig, erhält er alles Gezahlte zurück.`,
    ],
    gegenstand: `Gegenstand sind die Übernahme der Betreuung der bestehenden US-Gesellschaft des Auftraggebers (Ziffer 2), ihre Ausstattung mit Konto und Karten (Ziffer 3), die Begleitung bis zur Finanzierung mit ${KAPITAL_C_GARANTIE_NAME} (Ziffer 4) und die Bürgschaft der US-Partnergesellschaft von FIAON (Ziffer 5). Die Gesellschaft gehört allein dem Auftraggeber; FIAON erwirbt an ihr keine Anteile. Der Auftraggeber schließt diesen Vertrag als Verbraucher.`,
    z2gesellschaft: `Gesellschaft im Sinne dieses Vertrags ist die ${name} (${staat}${register}, eingetragen am ${seit}). FIAON gründet keine neue Gesellschaft, sondern übernimmt die Betreuung der bestehenden; ihr Name, ihre Steuernummer und ihr Alter bleiben.`,
    z2liste: [
      "die Prüfung der Gesellschaft: Registerstand, Steuernummer (EIN), bisherige US-Meldungen und Unterlagen",
      "die Berichtigung fehlerhafter oder unvollständiger US-Meldungen der Gesellschaft durch einen US-CPA aus dem Partnernetz von FIAON",
      "die Berichtigung der Angaben im Register des Bundesstaats einschließlich der Staatsgebühr",
      "ein Operating Agreement, soweit keines vorliegt oder das vorhandene für Bank und Finanzierung nicht genügt",
      "Registered Agent, US-Geschäftsadresse und US-Telefonnummer im ersten Jahr",
      "die Assistenz der Gesellschaft im ersten Jahr: Post, Anrufe und Termine",
      "die Umstellung der Anschrift und der Empfänger für Schreiben der US-Steuerbehörde auf den Auftraggeber",
      "der Pflichtenkalender, die nächste Jahresmeldung der Gesellschaft beim Bundesstaat einschließlich der Staatsgebühr und die nächste jährliche US-Meldung der Gesellschaft durch einen US-CPA aus dem Partnernetz von FIAON",
    ],
    z2listeEinleitung: "Die Übernahme umfasst:",
    z2ordnungEinleitung: "Nach der Prüfung der vorgelegten Unterlagen bringt FIAON insbesondere in Ordnung:",
    ordnung: B.ordnung,
    z2beginn: (eingang: string) => `FIAON beginnt mit ${eingang}. Über Einträge im Register entscheidet der Bundesstaat, über Meldungen und Steuernummern die US-Steuerbehörde. Gegenüber Behörden handelt FIAON nach Ziffer 13.`,
    befugnisBestand: "die bestehende Gesellschaft: Unterlagen und Auskünfte zur Gesellschaft beim Register, beim Registered Agent, bei bisherigen Dienstleistern und bei der US-Steuerbehörde anfordern, Berichtigungen von Registereinträgen und Meldungen vorbereiten und einreichen und die Gebühren dafür entrichten;",
    befugnisSteuer: "Steuernummer und Behördenpost der Gesellschaft: Anschrift und verantwortliche Person bei der US-Steuerbehörde aktualisieren, Bestätigungen zur Steuernummer anfordern und Vollmachten früherer Dienstleister widerrufen — nach der Unterschrift des Auftraggebers, soweit sie nötig ist;",
    z2zusicherung: "Der Auftraggeber versichert, dass er alleiniger Gesellschafter der Gesellschaft ist und dass sie bei Vertragsschluss weder ein Bankkonto unterhält noch Verträge geschlossen oder Verbindlichkeiten eingegangen ist, die er FIAON nicht in Textform genannt hat. Die Unterlagen der Gesellschaft, die ihm vorliegen, stellt er FIAON bereit.",
    zielSatz: `Ziel der Parteien ist die Auszahlung binnen ${ziel} Wochen ab Auftragserteilung. Verbindlich ist allein die Frist der ${KAPITAL_C_GARANTIE_NAME} nach Absatz 5.`,
    verguetungSatz: `Für die Leistungen nach Ziffer 2 und 3 im ersten Jahr (Übernahme der Gesellschaft, Konto und Karten) zahlt der Auftraggeber einmalig ${preis}; darin ist alles enthalten, was Ziffer 2 und 3 nennen. Der Betrag ist mit Vertragsschluss fällig; FIAON stellt die Rechnung bei Annahme dieses Vertrags, zahlbar ${zahlbar} ohne Abzug per Überweisung. FIAON beginnt mit dem Zahlungseingang (Ziffer 10 Absatz 2).`,
    erfolgSatz: A
      ? `Sobald die Gesellschaft übernommen ist — die Berichtigungen nach Ziffer 2 sind eingereicht, und das Operating Agreement liegt unterschrieben vor — und die Bürgin die Bürgschaft nach Ziffer 5 übernommen hat, wird das Erfolgshonorar von ${erfolg} fällig; FIAON teilt dem Auftraggeber diesen Stand in Textform mit. Es schließt die Bürgschaft nach Ziffer 5 ein. FIAON berechnet es mit Rechnung, zahlbar ${zahlbar}. Kommt es nicht dazu, entfällt es. Im ersten Jahr zahlt der Auftraggeber damit insgesamt ${jahr1}.`
      : `Sobald die Gesellschaft übernommen und für Bank und Finanzierung vorbereitet ist — die Berichtigungen nach Ziffer 2 sind eingereicht, und das Operating Agreement liegt unterschrieben vor —, wird das Erfolgshonorar von ${erfolg} fällig; FIAON teilt dem Auftraggeber diesen Stand in Textform mit. Es schließt die Bürgschaft nach Ziffer 5 ein. FIAON berechnet es mit Rechnung, zahlbar ${zahlbar}. Kommt es nicht dazu, entfällt es. Im ersten Jahr zahlt der Auftraggeber damit insgesamt ${jahr1}.`,
    sofortSatz: "Der Auftraggeber hat bei der Annahme ausdrücklich verlangt, dass FIAON vor Ablauf der Widerrufsfrist mit der Ausführung beginnt. Ihm ist bekannt, dass er im Fall des Widerrufs einen angemessenen Betrag für die bis dahin erbrachten Leistungen zahlt und dass sein Widerrufsrecht erlischt, wenn FIAON die Leistungen vollständig erbracht hat.",
    widerrufGesellschaft: " Die Gesellschaft bleibt dem Auftraggeber; ihre US-Meldepflichten nach Ziffer 8 bestehen fort.",
    // ── Seite ──
    auftakt: `Ihre ${name} und Ihre Finanzierung über ${betrag}.`,
    heroLead: `Wir übernehmen Ihre bestehende ${name}, bringen sie in Ordnung und begleiten Sie bis zur Auszahlung Ihrer Finanzierung über ${betrag}. Unsere US-Partnergesellschaft übernimmt die Bürgschaft gegenüber der Bank — und Sie erhalten eine ${KAPITAL_C_GARANTIE_NAME}.`,
    kachelGesellschaft: { schluessel: "gesellschaft", titel: "Ihre US-Gesellschaft", zeile: `Ihre ${name} — übernommen, geprüft und in Ordnung gebracht.`, details: ["Prüfung von Register, Steuernummer und bisherigen US-Meldungen", "Berichtigung fehlerhafter Meldungen durch unseren US-Steuerberater (CPA)", "Operating Agreement, Pflichtenkalender, die nächste Jahresmeldung beim Bundesstaat mit Staatsgebühr und die nächste US-Jahresmeldung"] } as KapitalCPaketKachel,
    kachelSteuer: { schluessel: "steuernummern", titel: "Steuernummern und Behördenpost", zeile: "Ihre vorhandenen Nummern bleiben — wir bringen alles dazu auf den richtigen Stand.", details: ["Die Steuernummer Ihrer Gesellschaft (EIN) bleibt bestehen", "Steuernummer im Register des Bundesstaats nachgetragen", "Schreiben der US-Steuerbehörde gehen künftig direkt an Sie"] } as KapitalCPaketKachel,
    paketFein: "Im ersten Jahr ist alles enthalten — auch die nächste Jahresmeldung beim Bundesstaat. Ab dem zweiten Jahr hält die Jahresbetreuung Ihre Gesellschaft am Laufen — Sie finden sie unten unter „Ihre Investition“.",
    wegSub: "Ihre Gesellschaft besteht schon — deshalb können wir sofort mit der Vorbereitung für die Bank beginnen.",
    weg1: { nr: 1, titel: "Ihre Gesellschaft in Ordnung", dauer: "Woche eins", text: `Wir prüfen Ihre ${name}, reichen die Berichtigungen ein, setzen das Operating Agreement auf und stellen Adresse, Telefonnummer und Assistenz bereit. Sie unterschreiben, was wir vorbereiten.${DK ? " Los geht es, sobald Ihr Reisepass da ist — Sie laden ihn direkt nach der Unterschrift hoch." : ""}` } as FirmaPhase,
    investZeile: `Mit Ihrem Auftrag ${preis} — darin ist alles enthalten; ${fertig}, ${erfolg} einschließlich Bürgschaft — im ersten Jahr insgesamt ${jahr1}; ab dem zweiten Jahr ${jahres} je Jahr. Alle Beträge sind Endpreise.`,
    invest1: { wann: "Mit Ihrem Auftrag", betrag: preis, text: "Übernahme Ihrer Gesellschaft, Konto und Karten — alles enthalten: Prüfung, Berichtigungen, Operating Agreement, Adresse, Telefonnummer und Assistenz" },
    invest2: A ? { wann: "Nach Übernahme und Bürgschaft", betrag: erfolg, text: `Erfolgshonorar einschließlich Bürgschaft — erst fällig, wenn Ihre Gesellschaft übernommen ist und unsere US-Partnergesellschaft die Bürgschaft für Ihre Finanzierung übernommen hat. Kommt die Auszahlung nicht binnen ${wochen} Wochen, erhalten Sie auch diesen Betrag zurück.` }
      : { wann: "Sobald Ihre Gesellschaft bankfertig ist", betrag: erfolg, text: `Erfolgshonorar für die abgeschlossene Übernahme, einschließlich Bürgschaft. Kommt die Auszahlung nicht binnen ${wochen} Wochen, erhalten Sie auch diesen Betrag zurück.` },
    frageWarum: { frage: "Warum übernehmen Sie meine Gesellschaft, statt neu anzufangen?", antwort: [`Weil Ihre ${name} seit dem ${seit} besteht und ihre Steuernummer schon hat. Das spart Ihnen Wochen — und ein Unternehmen mit Geschichte hat es bei Bank und Finanzierung leichter als ein ganz neues.`, "Voraussetzung ist, dass alles stimmt. Deshalb prüfen wir zuerst jede Unterlage und bringen in Ordnung, was nicht passt — das ist in Ihrem Preis enthalten."] },
    frageReisen: { frage: "Muss ich in die USA reisen?", antwort: ["Nein. Unsere Partner in den USA erledigen die Termine vor Ort; Sie steuern jeden Schritt von zu Hause."] },
    frageWiderruf: { frage: "Kann ich widerrufen?", antwort: ["Ja, binnen vierzehn Tagen — Belehrung und Muster-Widerrufsformular stehen in der Anlage Ihres Vertrags. Mit Ihrer Annahme verlangen Sie, dass wir sofort beginnen; bei einem Widerruf bezahlen Sie dann nur die bis dahin erbrachten Leistungen anteilig."] },
    infoLeistung: { titel: "Die Leistung", text: `Übernahme der Betreuung Ihrer bestehenden ${name} (${staat}): Prüfung, Berichtigung von Meldungen und Register, Operating Agreement, Adresse, Telefonnummer und Assistenz, im ersten Jahr mit der nächsten Jahresmeldung beim Bundesstaat; Vorbereitung von privatem Konto, privaten Karten, Geschäftskonto und Firmenkarte; Begleitung bis zur Finanzierung über ${betrag} durch eine US-Bank mit der Bürgschaft unserer US-Partnergesellschaft (Ziffer 2 bis 5). Über die Finanzierung entscheidet die Bank.` },
    infoPreise: { titel: "Die Preise", text: `Mit Ihrem Auftrag fällig ${preis} (Übernahme Ihrer Gesellschaft, Konto und Karten — alles enthalten); ${fertig}, ${erfolg} Erfolgshonorar einschließlich Bürgschaft; im ersten Jahr insgesamt ${jahr1}; ab dem zweiten Jahr ${jahres} je Jahr. Alle Beträge sind Endpreise.` },
    infoBeginn: { titel: "Beginn und Zeitplan", text: `Sofort mit Ihrem Zahlungseingang — auf Ihren ausdrücklichen Wunsch vor Ablauf der Widerrufsfrist. Unser Ziel ist die Auszahlung in Woche ${ziel}.` },
    block: {
      auge: "Ihre Gesellschaft",
      titel: `Ihre ${name} bleibt.`,
      sub: "Wir gründen nicht neu. Wir übernehmen Ihre bestehende Gesellschaft — mit ihrem Namen, ihrer Steuernummer und ihrem Alter. Hier sehen Sie, was wir über sie geprüft haben.",
      karte: {
        auge: `State of ${staat}`, name, zeile: B.registerNr ? `Registernummer ${B.registerNr}` : `Gesellschaft nach dem Recht von ${staat}`,
        status: B.registerStatus || "geprüft", statusZeile: B.registerStand ? `laut Register · Stand ${kapitalTag(B.registerStand)}` : "laut Register",
        seitLabel: "Eingetragen seit", seit, eingetragenAm: B.eingetragenAm, alterEinheit: "Monate", alterZeile: "Firmenalter — ein Vorteil bei Bank und Finanzierung",
      },
      datenTitel: "Alle Angaben Ihrer Gesellschaft", daten: B.daten,
      gutTitel: "Das stimmt schon", gut: B.gut,
      ordnungTitel: "Das bringen wir für Sie in Ordnung", ordnungSub: "Alles davon ist in Ihrem Preis enthalten.", ordnung: B.ordnung,
      fuss: "Grundlage sind die Unterlagen, die Sie uns geschickt haben, und das amtliche Register des Bundesstaats.",
    } as KapitalCBestandBlock,
    // ── Übersicht, Annahme, danach ──
    uebFaellig: (zahlbarSatz: string) => `${preis} (Übernahme Ihrer Gesellschaft, Konto und Karten — alles enthalten) — ${zahlbarSatz}`,
    uebLeistung: `Übernahme der Betreuung Ihrer bestehenden ${name}: Prüfung, Berichtigungen, Operating Agreement, Adresse, Telefonnummer und Assistenz; Konto und Karten vorbereitet; Begleitung bis zur Finanzierung mit Bürgschaft (Ziffer 2 bis 5)`,
    uebGesellschaft: `${name}, ${staat}, seit dem ${seit}`,
    uebErfolgLabel: A ? "Nach Übernahme und Bürgschaft" : "Sobald Ihre Gesellschaft bankfertig ist",
    uebBeginn: "sofort mit Ihrem Zahlungseingang — auf Ihren ausdrücklichen Wunsch vor Ablauf der Widerrufsfrist",
    annahmeSub: `${DK ? "Ihre Angaben, " : ""}Laufzeit, ein Haken und Ihre Unterschrift — dann ist alles auf dem Weg.`,
    sofortUnter: "Wir beginnen sofort mit Ihrem Zahlungseingang. Dafür brauchen wir diese ausdrückliche Bestätigung; ohne sie dürften wir erst nach Ablauf der Widerrufsfrist beginnen. Ohne den Haken können Sie das Angebot deshalb nicht annehmen.",
    leserSatz: "Angenommen wird unten auf der Seite — mit einem Haken und Ihrer Unterschrift. Der Knopf bringt Sie direkt dorthin.",
    teil1Titel: "Übernahme Ihrer Gesellschaft, Konto und Karten",
    teil2: kapitalCTeil2Fuer(par),
    auftragTeil1: { titel: "Übernahme Ihrer Gesellschaft", hinweis: `Übernahme Ihrer Gesellschaft, Konto und Karten im ersten Jahr (${preis}) — alles enthalten` },
    auftragTeil2Offen: A ? "fällig, sobald Ihre Gesellschaft übernommen ist und die Bürgschaft steht (Ziffer 6 Absatz 2) — die Bürgschaft ist darin enthalten"
      : "fällig, sobald Ihre Gesellschaft übernommen und bankfertig ist (Ziffer 6 Absatz 2) — die Bürgschaft ist darin enthalten",
    auftragTeil2Am: (tag: string) => (A ? `Gesellschaft übernommen, Bürgschaft übernommen am ${tag}` : `Gesellschaft übernommen und bankfertig am ${tag}`),
    etappe1: { titel: "Ihre Gesellschaft in Ordnung", text: "Prüfung, Berichtigungen, Operating Agreement, US-Adresse, Telefonnummer und Assistenz. Wir bereiten alles vor und reichen ein; Sie unterschreiben, was wir Ihnen fertig zuschicken." },
  };
}

export function kapitalCPraeambel(d: KapitalCDaten): string[] {
  const par = d.parameter;
  const BT = kapitalCBestandTexte(d);
  if (BT) return BT.praeambel;
  return [
    // Ohne Verwendungszweck (Justin 27.10.2026, 17:40).
    "Der Auftraggeber möchte eine eigene US-Gesellschaft gründen, die eine Finanzierung aufnimmt.",
    `FIAON gründet diese Gesellschaft, bereitet Konto und Karten vor und begleitet sie bis zur Finanzierung über ${kapitalCEur(par.betragCents)} durch eine US-Bank. Die US-Partnergesellschaft von FIAON übernimmt dafür eine Bürgschaft, und FIAON gibt dem Auftraggeber eine ${KAPITAL_C_GARANTIE_NAME}: Kommt die Auszahlung nicht rechtzeitig, erhält er alles Gezahlte zurück.`,
  ];
}

export function kapitalCZiffern(d: KapitalCDaten, opt: KapitalCDarstellung = {}): AngebotZiffer[] {
  const par = d.parameter; const b = d.buergin; const k = d.kunde;
  const G = kapitalCGarantie(par);
  const Z5 = kapitalCZ5(par);
  const unterlagen = par.unterlagen.map((u) => u.titel);
  const buerginStand = kapitalCBuerginStand(par, "vertrag");
  // E-506: bestehende Gesellschaft — null ohne parameter.bestand (dann bleibt jeder Satz wortgleich).
  const BT = kapitalCBestandTexte(d);
  // E-474: zwei neue Schalter, die NUR ihre Sätze ändern — ohne sie bleibt jeder Satz wortgleich (Prüfsumme des Bestands).
  //   FT = fastTrackWahl (der Kunde wählt; die Wahl steht im Annahmevermerk), DK = datenVomKunden (Reisepass erst nach der Annahme).
  const FT = par.fastTrackWahl; const DK = par.datenVomKunden;
  const eingang = DK ? "dem Eingang der Vergütung nach Ziffer 6 Absatz 1 und des Reisepasses nach Ziffer 7 Absatz 1" : "dem Eingang der Vergütung nach Ziffer 6 Absatz 1";
  // E-487: Ziffer 2 Absatz 3 in der Vorrang-Fassung (offene Angebote) — Vorrang in allen Schritten, keine Zeitzusage für die
  // EIN; der Satz ohne Fast-Track bleibt wortgleich. Leere tempoFassung (vor E-487 angenommen): der Wortlaut der Annahme, unverändert.
  const V = kapitalCVorrangGilt(par) ? kapitalCVorrang(par) : null;
  const fastTrackSatz = V
    ? (FT
      ? `Fast-Track nach Wahl des Auftraggebers: In beiden Fällen beginnt FIAON mit ${eingang} und reicht die Anmeldung beim Bundesstaat spätestens binnen fünf Werktagen ein; ohne Fast-Track liegen Gesellschaft, EIN und ITIN in der Regel nach ${KAPITAL_C_TEMPO.ohne} vor. Wählt der Auftraggeber bei der Annahme den Fast-Track (Annahmevermerk), bearbeitet FIAON den Auftrag in allen Schritten mit Vorrang: ${gross(V.vertragSchritte("diesem Eingang"))}.`
      : `Fast-Track: FIAON bearbeitet den Auftrag in allen Schritten mit Vorrang — ${V.vertragSchritte(eingang)}.`)
    : FT
    ? `Fast-Track nach Wahl des Auftraggebers: In beiden Fällen beginnt FIAON mit ${eingang} und reicht die Anmeldung beim Bundesstaat spätestens binnen fünf Werktagen ein; ohne Fast-Track liegen Gesellschaft, EIN und ITIN in der Regel nach ${KAPITAL_C_TEMPO.ohne} vor. Wählt der Auftraggeber bei der Annahme den Fast-Track (Annahmevermerk), bearbeitet FIAON den Auftrag mit Vorrang — Anmeldung und Antrag auf die EIN laufen beschleunigt, die Unterlagen für das finanzierende Institut entstehen parallel zur Gründung; Ziel sind dann die Gesellschaft und ihre EIN binnen ${KAPITAL_C_TEMPO.mit}, die ITIN folgt so schnell wie möglich.`
    : `Fast-Track: FIAON bearbeitet den Auftrag mit Vorrang — die Anmeldung beim Bundesstaat und der Antrag auf die EIN laufen beschleunigt, die Unterlagen für das finanzierende Institut entstehen parallel zur Gründung. FIAON reicht die Anmeldung binnen fünf Werktagen nach ${eingang} ein.`;
  const unterlagenSatz = DK
    ? "Die Frist ruht außerdem, bis der Reisepass nach Ziffer 7 Absatz 1 vorliegt."
    : "Die Unterlagen nach Ziffer 7 Absatz 1 liegen FIAON bei Vertragsschluss vor; ihretwegen ruht die Frist nicht.";
  const zielSatz = BT ? BT.zielSatz : FT
    ? `Wählt der Auftraggeber den Fast-Track, ist Ziel der Parteien die Auszahlung binnen ${zahlwort(par.zielWochen)} Wochen ab Auftragserteilung (Ziffer 2 Absatz 3). Verbindlich ist in jedem Fall allein die Frist der ${KAPITAL_C_GARANTIE_NAME} nach Absatz 5.`
    : `Ziel der Parteien ist die Auszahlung binnen ${zahlwort(par.zielWochen)} Wochen ab Auftragserteilung; diesem Ziel dient der Fast-Track (Ziffer 2 Absatz 3). Verbindlich ist allein die Frist der ${KAPITAL_C_GARANTIE_NAME} nach Absatz 5.`;
  const verguetungSatz = BT ? BT.verguetungSatz : FT
    ? `Für die Leistungen nach Ziffer 2 und 3 im ersten Jahr (Gründung, Konto und Karten) zahlt der Auftraggeber einmalig ${kapitalCEur(par.gruendungCents)}; wählt er bei der Annahme den Fast-Track (Ziffer 2 Absatz 3), zahlt er dafür zusätzlich einmalig ${kapitalCEur(par.fastTrackCents)}, zusammen ${kapitalCEur(kapitalCHeuteCents(par))}. Der Betrag ist mit Vertragsschluss fällig; FIAON stellt die Rechnung bei Annahme dieses Vertrags, zahlbar ${kapitalCZahlbar(par.zahlungszielTage)} ohne Abzug per Überweisung. FIAON beginnt mit dem Zahlungseingang, mit und ohne Fast-Track (Ziffer 10 Absatz 2).`
    : `Für die Leistungen nach Ziffer 2 und 3 im ersten Jahr (Gründung, Konto und Karten) zahlt der Auftraggeber einmalig ${kapitalCEur(par.gruendungCents)} und für den Fast-Track (Ziffer 2 Absatz 3) einmalig ${kapitalCEur(par.fastTrackCents)}, zusammen ${kapitalCEur(kapitalCHeuteCents(par))}. Der Betrag ist mit Vertragsschluss fällig; FIAON stellt die Rechnung bei Annahme dieses Vertrags, zahlbar ${kapitalCZahlbar(par.zahlungszielTage)} ohne Abzug per Überweisung. FIAON beginnt mit dem Zahlungseingang (Ziffer 10 Absatz 2).`;
  const erstesJahr = FT
    ? `insgesamt ${kapitalCEur(kapitalCErstesJahrCents(par, false))} ohne Fast-Track oder ${kapitalCEur(kapitalCErstesJahrCents(par, true))} mit Fast-Track`
    : `insgesamt ${kapitalCEur(kapitalCErstesJahrCents(par))}`;
  const sofortSatz = BT ? BT.sofortSatz : FT
    ? "Der Auftraggeber hat bei der Annahme ausdrücklich verlangt, dass FIAON vor Ablauf der Widerrufsfrist mit der Ausführung beginnt — mit und ohne Fast-Track. Ihm ist bekannt, dass er im Fall des Widerrufs einen angemessenen Betrag für die bis dahin erbrachten Leistungen zahlt und dass sein Widerrufsrecht erlischt, wenn FIAON die Leistungen vollständig erbracht hat."
    : "Der Auftraggeber hat bei der Annahme ausdrücklich verlangt, dass FIAON vor Ablauf der Widerrufsfrist mit der Ausführung beginnt (Fast-Track). Ihm ist bekannt, dass er im Fall des Widerrufs einen angemessenen Betrag für die bis dahin erbrachten Leistungen zahlt und dass sein Widerrufsrecht erlischt, wenn FIAON die Leistungen vollständig erbracht hat.";
  const mitwirkung1 = DK
    ? [p(`${unterlagen.length ? `Bei Vertragsschluss liegen FIAON vor: ${unterlagen.join(", ")}. ` : ""}Seinen gültigen Reisepass lädt der Auftraggeber binnen sieben Tagen nach Vertragsschluss zur Identifizierung hoch — auf seiner Angebotsseite oder in seinem Kundenbereich „Mein Auftrag“. Mit Anmeldungen und Anträgen beginnt FIAON erst, wenn er vorliegt.`)]
    : unterlagen.length ? [liste(unterlagen, "Folgende Unterlagen des Auftraggebers liegen FIAON bei Vertragsschluss vor:")] : [p("Der Auftraggeber stellt FIAON binnen sieben Tagen nach der Annahme eine Farbkopie seines Reisepasses und einen Adressnachweis bereit.")];
  return [
    { nr: 1, titel: "Vertragsparteien und Gegenstand", absaetze: [
      p(`Vertragsparteien sind die ${FIAON_FIRMA.name}, ${FIAON_FIRMA.strasse}, ${FIAON_FIRMA.ortZeile}, ${FIAON_FIRMA.land}, eingetragen im ${FIAON_FIRMA.register} unter Nr. ${FIAON_FIRMA.companyNo}, vertreten durch ${FIAON_FIRMA.director}, Director (nachfolgend „FIAON“), und ${kapitalCKundeZeile(k, opt)} (nachfolgend „Auftraggeber“).`),
      p(BT ? BT.gegenstand : `Gegenstand sind die Gründung einer US-Gesellschaft (Ziffer 2), ihre Ausstattung mit Konto und Karten (Ziffer 3), die Begleitung bis zur Finanzierung mit ${KAPITAL_C_GARANTIE_NAME} (Ziffer 4) und die Bürgschaft der US-Partnergesellschaft von FIAON (Ziffer 5). Die Gesellschaft gehört allein dem Auftraggeber; FIAON erwirbt an ihr keine Anteile. Der Auftraggeber schließt diesen Vertrag als Verbraucher.`),
    ] },
    BT ? { nr: 2, titel: "Die US-Gesellschaft", absaetze: [
      p(BT.z2gesellschaft),
      liste(BT.z2liste, BT.z2listeEinleitung),
      ...(BT.ordnung.length ? [liste(BT.ordnung, BT.z2ordnungEinleitung)] : []),
      p(BT.z2beginn(eingang)),
      p(BT.z2zusicherung),
    ] } : { nr: 2, titel: "Die US-Gesellschaft", absaetze: [
      p(`FIAON gründet für den Auftraggeber eine Limited Liability Company (LLC) nach dem Recht des Bundesstaats ${par.bundesstaat}; einziger Gesellschafter ist der Auftraggeber. Den Namen bestimmt der Auftraggeber bei der Annahme (Annahmevermerk). FIAON prüft die Verfügbarkeit im Register und meldet die Gesellschaft unter dem Wunschnamen an, sonst unter dem ersten verfügbaren Ausweichnamen; ist keiner verfügbar, stimmt FIAON einen neuen Namen mit dem Auftraggeber in Textform ab. Bis zur Prüfung im Register ist der Name vorgemerkt.`),
      liste([
        "die Anmeldung beim Bundesstaat (Articles of Organization) einschließlich der Staatsgebühr",
        "das Operating Agreement und die Gründungsunterlagen in digitaler Form",
        "Registered Agent, US-Geschäftsadresse und US-Telefonnummer im ersten Jahr",
        "die Assistenz der Gesellschaft im ersten Jahr: Post, Anrufe und Termine",
        "die Beantragung der US-Steuernummer der Gesellschaft (EIN) und — soweit die Voraussetzungen der US-Steuerbehörde vorliegen, was FIAON vorab prüft (ITIN-Check) — der persönlichen US-Steuernummer des Auftraggebers (ITIN)",
        `der Pflichtenkalender, ${angebotStaatTexte(par.bundesstaat, par.staatenFassung)?.jahrVertrag ?? "die erste Jahresmeldung der Gesellschaft beim Bundesstaat (Annual Report)"} einschließlich der Staatsgebühr und die erste jährliche US-Meldung der Gesellschaft durch einen US-CPA aus dem Partnernetz von FIAON`,
      ], "Die Gründung umfasst:"),
      p(fastTrackSatz),
      p("Über die Eintragung entscheidet der Bundesstaat, über EIN und ITIN die US-Steuerbehörde. Liegen die Voraussetzungen für eine ITIN nicht vor, zeigt FIAON dem Auftraggeber die Wege für Konto und Karten ohne ITIN; entsteht während der Begleitung ein Grund für eine ITIN, beantragt FIAON sie dann. Gegenüber Behörden handelt FIAON nach Ziffer 13."),
    ] },
    { nr: 3, titel: "Konto und Karten", absaetze: [
      liste([
        "ein privates US-Konto des Auftraggebers",
        "private US-Kreditkarten des Auftraggebers mit Reise- und Meilenprogrammen",
        "das Geschäftskonto der Gesellschaft",
        "eine Firmenkreditkarte der Gesellschaft",
      ], "FIAON bereitet für den Auftraggeber und die Gesellschaft vollständig vor und begleitet bis zur Eröffnung:"),
      p(`Die Anträge stellen der Auftraggeber bzw. die Gesellschaft selbst; FIAON bereitet sie vollständig vor. Über Konto, Karten und deren Rahmen entscheidet das jeweilige Institut. ${KAPITAL_C_KARTEN_SOLLZINS} Für Konto und Karten gilt die ${KAPITAL_C_GARANTIE_NAME} nach Ziffer 4 nicht.`),
    ] },
    { nr: 4, titel: `Begleitung zur Finanzierung und ${KAPITAL_C_GARANTIE_NAME}`, absaetze: [
      p(`FIAON begleitet die Gesellschaft bis zur Finanzierung über ${kapitalCEur(par.betragCents)} durch eine US-Bank (nachfolgend „finanzierendes Institut“). ${kapitalCBetragSatz(par)}. FIAON bereitet jeden Antrag vollständig vor und begleitet bis zur Auszahlung; über die Finanzierung entscheidet das finanzierende Institut nach seiner Prüfung. Den Darlehensvertrag schließt die Gesellschaft im eigenen Namen, und ob sie ein Angebot annimmt, entscheidet sie allein.`),
      p(`Ziel der Begleitung ist eine Finanzierung zu folgenden Bedingungen: ${kapitalCKonditionenSatz(par)}`),
      p("Die Raten zahlt die Gesellschaft pünktlich zu jedem Fälligkeitstag an das finanzierende Institut. Zeichnet sich ab, dass sie eine Rate nicht pünktlich zahlen kann, teilt der Auftraggeber dies FIAON unverzüglich in Textform mit. Darlehen und Raten lauten auf US-Dollar; Euro-Beträge sind Umrechnungen, ihr Gegenwert in Euro kann sich mit dem Wechselkurs ändern — steigt der Kurs des US-Dollars um zehn Prozent, steigt jede Rate in Euro ebenfalls um zehn Prozent. Maßgeblich ist der Darlehensvertrag des finanzierenden Instituts; das Rechenbeispiel der Angebotsseite folgt den Bedingungen nach Absatz 2."),
      p(`${KAPITAL_C_VERWENDUNG.vertrag} Wie Überweisungen und Investitionen steuerlich zu behandeln sind, klärt der Partner-Steuerberater von FIAON vorab mit dem Auftraggeber. Eine US-Gesellschaft ist kein Steuermodell.`),
      p(G.vertrag),
      p(kapitalCRuhenErweitert(par)
        ? `Die Frist ruht, solange die Vergütung nach Ziffer 6 Absatz 1 nicht gezahlt ist. Sie ruht außerdem: solange FIAON oder das finanzierende Institut auf eine Mitwirkung des Auftraggebers wartet, um die sie ihn in Textform gebeten haben — eine Unterlage, eine Angabe, eine Unterschrift oder eine Antwort —, vom Tag der Bitte bis zum Tag des Eingangs; solange ein Antrag bei einer Behörde oder einem Register eingereicht und noch nicht beschieden ist, ${par.bestand ? "insbesondere Berichtigungen und Anträge bei der US-Steuerbehörde (etwa auf die ITIN) und Einträge im Register des Bundesstaats" : "insbesondere die Anmeldung der Gesellschaft beim Bundesstaat und die Anträge auf EIN und ITIN bei der US-Steuerbehörde"}, vom Tag der Einreichung bis zum Tag, an dem der Bescheid FIAON vorliegt; solange FIAON durch höhere Gewalt an der Leistung gehindert ist, etwa durch Naturereignisse, behördliche Anordnungen oder einen Stillstand der US-Bundesbehörden; und solange ein der Gesellschaft vorgelegtes Finanzierungsangebot über den Betrag zu den Bedingungen nach Absatz 2 ohne weitere Sicherheiten oder Kosten des Auftraggebers zur Annahme offensteht; lehnt die Gesellschaft ein solches Angebot ab oder lässt sie es verfallen, entfällt die ${KAPITAL_C_GARANTIE_NAME}. Überschneiden sich Ruhenszeiten, zählt jeder Tag einmal; die Tage nennt FIAON dem Auftraggeber auf Wunsch mit Datum. Die Bearbeitung durch das finanzierende Institut lässt die Frist weiterlaufen. ${unterlagenSatz} Die ${KAPITAL_C_GARANTIE_NAME} entfällt auch, wenn der Auftraggeber vorsätzlich falsche Angaben macht.`
        : `Die Frist ruht, solange die Vergütung nach Ziffer 6 Absatz 1 nicht gezahlt ist. Sie ruht außerdem nur für die Tage, um die der Auftraggeber die Frist nach Ziffer 7 Absatz 2 überschreitet, und solange ein der Gesellschaft vorgelegtes Finanzierungsangebot über den Betrag zu den Bedingungen nach Absatz 2 ohne weitere Sicherheiten oder Kosten des Auftraggebers zur Annahme offensteht; lehnt die Gesellschaft ein solches Angebot ab oder lässt sie es verfallen, entfällt die ${KAPITAL_C_GARANTIE_NAME}. ${unterlagenSatz} Die ${KAPITAL_C_GARANTIE_NAME} entfällt auch, wenn der Auftraggeber vorsätzlich falsche Angaben macht.`),
      // E-512: Vorrang des Vertrags vor Zeitangaben auf der Seite und in Nachrichten — nur ab Tempo-Fassung „E-512“.
      p(kapitalCRuhenErweitert(par) ? `${zielSatz} Zeitangaben auf der Angebotsseite und in Nachrichten von FIAON sind Ziele und Erfahrungswerte; verbindliche Fristen enthält allein dieser Vertrag.` : zielSatz),
    ] },
    { nr: 5, titel: "Bürgschaft der US-Partnergesellschaft", absaetze: [
      p(`Die ${b.name}, ${b.anschrift}, eingetragen im Bundesstaat ${b.bundesstaat} unter ${b.registernummer} (nachfolgend „Bürgin“), übernimmt auf Anforderung des finanzierenden Instituts eine Bürgschaft für die Finanzierung nach Ziffer 4. Höchstbetrag ist der ausgezahlte Darlehensbetrag; die Bürgschaft lautet auf die Währung der Finanzierung und läuft längstens ${zahlwort(par.buergschaftMonate)} Monate. Die Bürgin ist ein mit FIAON verbundenes Unternehmen und tritt diesem Vertrag für Ziffer 5 bei.${buerginStand ? ` ${buerginStand}` : ""}`),
      ...(par.ddAbgeschlossen ? [p("FIAON hat die Due-Diligence-Prüfung des Auftraggebers mit positivem Ergebnis abgeschlossen; über die Finanzierung entscheidet das finanzierende Institut.")] : []),
      liste([
        "die Vergütung nach Ziffer 6 Absatz 1 ist bezahlt",
        "die Identifizierung des Auftraggebers ist abgeschlossen, und die Unterlagen nach Ziffer 7 liegen vor",
        // Keine Zweckbindung mehr (Justin 27.10.2026, 17:40) — der Vertrag nennt keinen Verwendungszweck.
        "die Bürgin ist zum Zeitpunkt der Übernahme im Register ihres Bundesstaats als aktiv geführt",
      ], "Die Bürgin übernimmt die Bürgschaft, sobald Folgendes vorliegt:"),
      p(`Eine Bareinlage oder dingliche Sicherheit verlangen FIAON und die Bürgin nicht; für den Rückgriff nach Absatz ${Z5.rueckgriff} haftet der Auftraggeber persönlich. Die Vergütung für die Bürgschaft ist im Erfolgshonorar nach Ziffer 6 Absatz 2 enthalten. Die Form der Bürgschaft stimmt die Bürgin mit dem finanzierenden Institut ab.`),
      p("Nimmt das finanzierende Institut die Bürgin in Anspruch, ersetzen die Gesellschaft und der Auftraggeber der Bürgin als Gesamtschuldner den gezahlten Betrag mit den Kosten der Inanspruchnahme (Rückgriff). Solange die Bürgschaft besteht, teilt der Auftraggeber FIAON einmal im Quartal den Stand der Finanzierung und der Rückzahlungen in Textform mit."),
    ] },
    { nr: 6, titel: "Vergütung und Fälligkeit", absaetze: [
      p(verguetungSatz),
      p(BT ? BT.erfolgSatz : `Mit der erfolgreichen Gründung der Gesellschaft — ihrer Eintragung beim Bundesstaat — wird das Erfolgshonorar von ${kapitalCEur(par.erfolgCents)} fällig; es schließt die Bürgschaft nach Ziffer 5 ein. FIAON berechnet es mit Rechnung, zahlbar ${kapitalCZahlbar(par.zahlungszielTage)}. Kommt es nicht zur Eintragung, entfällt es. Im ersten Jahr zahlt der Auftraggeber damit ${erstesJahr}.`),
      p(`Ab dem zweiten Jahr nach ${BT ? "Vertragsschluss" : "der Eintragung"} betreut FIAON die Gesellschaft für ${kapitalCEur(par.jahresCents)} je Jahr (Jahresbetreuung): Registered Agent und US-Geschäftsadresse, US-Telefonnummer und Assistenz, die jährliche US-Meldung (Form 5472 mit Form 1120) durch einen US-CPA aus dem Partnernetz von FIAON, die Jahresmeldung beim Bundesstaat einschließlich der Staatsgebühr, der Pflichtenkalender, die Begleitung bei einer Aufstockung oder Umschuldung nach Ziffer 4 Absatz 2 und ein fester Ansprechpartner. Die Jahresbetreuung wird jährlich im Voraus berechnet und verlängert sich nicht von selbst: Mit der Zahlung der Jahresrechnung beginnt das jeweilige Betreuungsjahr. Bleibt die Zahlung aus, endet die Jahresbetreuung; die laufenden Kosten der Gesellschaft trägt der Auftraggeber dann selbst.`),
      p("Alle Beträge sind Endpreise; eine etwa anfallende Umsatzsteuer ist darin enthalten. Die Honorare der Partner von FIAON für die hier genannten Leistungen trägt FIAON. Zinsen und Kosten der Finanzierung richten sich nach Ziffer 4 und dem Darlehensvertrag des finanzierenden Instituts."),
    ] },
    { nr: 7, titel: "Mitwirkung des Auftraggebers", absaetze: [
      ...mitwirkung1,
      p("Verlangen das finanzierende Institut oder eine Behörde weitere Unterlagen, stellt der Auftraggeber sie binnen sieben Tagen bereit, nachdem FIAON sie ihm in Textform genannt hat."),
      p("Der Auftraggeber macht wahre und vollständige Angaben, unterschreibt die vorbereiteten Unterlagen nach Prüfung und teilt Änderungen, die für die Gesellschaft, die Finanzierung oder die Bürgschaft erheblich sind, unverzüglich in Textform mit."),
      p(globalAgentVertrag("nutzung", false)),
    ] },
    { nr: 8, titel: "Pflichthinweise", absaetze: [
      liste([...ANGEBOT_PFLICHTHINWEIS, KAPITAL_C_PFLICHT_ZUSATZ], "Der Auftraggeber nimmt die folgenden Hinweise zur Kenntnis:"),
      p("FIAON reicht keine Unterlagen ein, deren Angaben es für unzutreffend hält. Vor Beginn gleicht FIAON den Auftraggeber mit den Sanktionslisten der Europäischen Union, der Vereinten Nationen, des Vereinigten Königreichs und der USA ab."),
    ] },
    { nr: 9, titel: "Laufzeit und Ende", absaetze: [
      p(`Der Vertrag beginnt mit der Annahme. Die Begleitung endet ${zahlwort(par.begleitMonate)} Monate nach ${BT ? "Vertragsschluss" : "der Eintragung der Gesellschaft"}; die Bürgschaft endet nach Ziffer 5, die Jahresbetreuung nach Ziffer 6 Absatz 3.`),
      p(`Das Recht beider Parteien zur fristlosen Kündigung aus wichtigem Grund bleibt unberührt, insbesondere wenn der Auftraggeber vorsätzlich falsche Angaben macht oder auf einer Sanktionsliste geführt wird. Eine bereits übernommene Bürgschaft bleibt davon unberührt; der Rückgriff nach Ziffer 5 Absatz ${Z5.rueckgriff} gilt fort. Das Widerrufsrecht nach Ziffer 10 bleibt unberührt.`),
    ] },
    { nr: 10, titel: "Widerrufsrecht", absaetze: [
      p("Der Auftraggeber kann diesen Vertrag als Verbraucher binnen vierzehn Tagen nach Maßgabe der Widerrufsbelehrung in der Anlage widerrufen; die Anlage enthält auch das Muster-Widerrufsformular. Mit dem Widerruf endet auch der Beitritt der Bürgin." + (BT ? BT.widerrufGesellschaft : " Eine bereits gegründete Gesellschaft bleibt dem Auftraggeber; auf seinen Wunsch löst FIAON sie auf und trägt die Kosten dafür; bis dahin bestehen ihre US-Meldepflichten nach Ziffer 8 fort.")),
      p(sofortSatz),
    ] },
    { nr: 11, titel: "Haftung", absaetze: [
      p(`FIAON haftet unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie bei der Verletzung von Leben, Körper oder Gesundheit. Bei leicht fahrlässiger Verletzung wesentlicher Vertragspflichten ist die Haftung auf den vertragstypischen, bei Vertragsschluss vorhersehbaren Schaden begrenzt; im Übrigen ist die Haftung für leichte Fahrlässigkeit ausgeschlossen. Für Entscheidungen von Behörden haftet FIAON nicht. Bleibt die Finanzierung aus, gilt die ${KAPITAL_C_GARANTIE_NAME} nach Ziffer 4; die Haftung nach Satz 1 bleibt unberührt. Für die Leistungen der Partner haften diese aus ihrem eigenen Mandat.`),
      p(globalAgentVertrag("haftung", false)),
    ] },
    { nr: 12, titel: "Vertraulichkeit und Datenschutz", absaetze: [
      p("Beide Parteien behandeln nicht öffentliche Informationen der anderen Partei vertraulich, auch nach dem Ende des Vertrags. FIAON gibt Unterlagen nur weiter, soweit es die Leistung erfordert: an Behörden, an den Registered Agent, an die Partner von FIAON, an die Bürgin und an Institute, bei denen ein Antrag gestellt wird."),
      p("FIAON verarbeitet personenbezogene Daten, um diesen Vertrag zu erfüllen, nach der Datenschutzerklärung unter fiaon.com/datenschutz und im Einklang mit der DSGVO. " + (BT ? "Für die Betreuung der Gesellschaft und für Anträge" : "Für Gründung und Anträge") + " gehen Daten in die USA; die Übermittlung stützt sich darauf, dass sie für die Erfüllung dieses Vertrags erforderlich ist."),
    ] },
    // E-506: bei einer bestehenden Gesellschaft statt „Gründung“ und „EIN-Antrag“ die Befugnisse, die die Übernahme braucht.
    { nr: 13, titel: BEFUGNISSE_TITEL.de, absaetze: BT ? befugnisseAbsaetze("auftraggeber").map((a) => (a.art === "liste"
      ? { ...a, zeilen: a.zeilen.map((x) => (x.startsWith("die Gründung:") ? BT.befugnisBestand : x.startsWith("Steuernummer der Gesellschaft (EIN):") ? BT.befugnisSteuer : x)) } : a)) : befugnisseAbsaetze("auftraggeber") },
    { nr: 14, titel: "Schlussbestimmungen", absaetze: [
      p(`Weitere Allgemeine Geschäftsbedingungen gelten nicht. Beigefügt ist die Anlage (Widerrufsbelehrung und Muster-Widerrufsformular). Vertragssprache ist Deutsch; FIAON speichert den Vertragstext, und der Auftraggeber erhält ihn nach der Annahme als PDF per E-Mail. Beschwerden richtet der Auftraggeber an ${FIAON_FIRMA.email}.`),
      p("Änderungen und Ergänzungen bedürfen der Textform. Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts; diese Rechtswahl gilt nur, soweit dem Auftraggeber dadurch nicht der Schutz der zwingenden Bestimmungen des Staates seines gewöhnlichen Aufenthalts entzogen wird. FIAON ist weder bereit noch verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen. Sollten einzelne Bestimmungen unwirksam sein oder werden, bleibt die Gültigkeit im Übrigen unberührt; an die Stelle der unwirksamen Bestimmung treten die gesetzlichen Vorschriften."),
    ] },
  ];
}

// ── HTML des Vertrags (dieselbe Gestalt wie Fassung A/B: gv-Klassen aus GLOBAL_VERTRAG_CSS/ANGEBOT_VERTRAG_CSS) ──
function ziffernHtml(ziffern: AngebotZiffer[]): string {
  return ziffern.map((z) => {
    const mehrere = z.absaetze.length > 1;
    const bloecke = z.absaetze.map((a, i) => {
      const nr = mehrere ? `<span class="gv-abs">(${i + 1})</span> ` : "";
      if (a.art === "p") return `<p>${nr}${escHtml(a.text)}</p>`;
      const kopf = a.einleitung ? `<p>${nr}${escHtml(a.einleitung)}</p>` : "";
      return `${kopf}<ul>${a.zeilen.map((x) => `<li>${escHtml(x)}</li>`).join("")}</ul>`;
    });
    const [erster, ...rest] = bloecke.join("").match(/<(p|ul)\b[\s\S]*?<\/\1>/g) ?? [];
    return `<section class="gv-ziffer" id="ziffer-${z.nr}"><div class="gv-anfang"><h2><span class="gv-nr">${z.nr}</span>${escHtml(z.titel)}</h2>${erster ?? ""}</div>${rest.join("")}</section>`;
  }).join("\n");
}
/** Die Anlage — das gesetzliche Muster WÖRTLICH (shared/fiaon-global-widerruf.ts). */
export function kapitalCWiderrufHtml(): string {
  const w = globalWiderrufsbelehrung("de");
  return `<section class="gv-anlage" id="anlage-widerruf"><h2>${escHtml(w.titel)}</h2><p class="gv-leise">${escHtml(w.gilt)}</p>${
    w.abschnitte.map((a) => `<h3>${escHtml(a.h)}</h3>${a.absaetze.map((x) => `<p>${escHtml(x)}</p>`).join("")}`).join("")
  }<h3>${escHtml(w.formular.titel)}</h3><p>${escHtml(w.formular.hinweis)}</p><p>${escHtml(w.formular.an)}</p><ul>${w.formular.zeilen.map((z) => `<li>${escHtml(z)}</li>`).join("")}</ul><p class="gv-leise">${escHtml(w.formular.fuss)}</p></section>`;
}
function zeitText(am: Date): string {
  const tag = am.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" });
  const zeit = am.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
  return `${tag} um ${zeit} Uhr (Europe/Berlin)`;
}
function unterschriftHtml(u: KapitalUnterschriftVermerk): string {
  const m = String(u.png ?? "").match(/^data:image\/png;base64,([A-Za-z0-9+/=]{100,})$/);
  const art = u.art === "gezeichnet" ? "von Hand gezeichnet" : `Name getippt: ${escHtml(u.name ?? "")}`;
  const zeichen = m
    ? `<img class="gv-unterschrift-bild" src="data:image/png;base64,${m[1]}" alt="Unterschrift" style="display:block;max-width:240px;max-height:80px;margin:4px 0 2px" />`
    : `<span class="gv-unterschrift-getippt" style="display:block;font-family:'Mrs Saint Delafield','Snell Roundhand','Apple Chancery','Dancing Script',cursive;font-size:30px;line-height:1.1;color:#1b3866;margin:4px 0 2px">${escHtml(u.name ?? "")}</span>`;
  return `${zeichen}<span class="gv-leise" style="font-size:8pt">Unterschrift (${art})</span>`;
}
function annahmeBlock(d: KapitalCDaten, a: KapitalCAnnahmeVermerk | null): string {
  const name = kapitalCName(d.kunde);
  const fiaon = `<div class="sig-col"><div class="gv-sig-kopf">Für FIAON</div><div class="gv-sig-feld"><span class="gv-leise">Angebot der ${escHtml(FIAON_FIRMA.name)}, vertreten durch ${escHtml(FIAON_FIRMA.director)}, Director</span></div><div class="sig-line">${escHtml(FIAON_FIRMA.name)}</div></div>`;
  const buergin = `<div class="sig-col"><div class="gv-sig-kopf">Für die Bürgin (Ziffer 5)</div><div class="gv-sig-feld"><span class="gv-leise">Beitritt der ${escHtml(d.buergin.name)}, vertreten durch ${escHtml(d.buergin.vertreter)}, ${escHtml(d.buergin.funktion)}</span></div><div class="sig-line">${escHtml(d.buergin.name)}</div></div>`;
  if (!a) {
    return `
  <div class="gv-unterschriften">
    ${fiaon}
    ${buergin}
    <div class="sig-col"><div class="gv-sig-kopf">Für den Auftraggeber</div><div class="gv-sig-feld"><span class="gv-leise">Annahme mit dem Knopf „${escHtml(KAPITAL_KNOPF)}“ — Laufzeit${d.parameter.fastTrackWahl ? ", die Wahl zum Fast-Track" : ""} und Name der Gesellschaft stehen dann hier im Annahmevermerk.</span></div><div class="sig-line">${escHtml(name)}</div></div>
  </div>`;
  }
  const w = a.wahl;
  const namen = [w.llc.wunsch, w.llc.alternative1, w.llc.alternative2].filter(Boolean);
  // E-474: die Wahl zum Fast-Track — nur bei Angeboten mit fastTrackWahl (Bestand: keine Zeile, Vermerk wortgleich).
  const par = d.parameter;
  const ftZeile = !par.fastTrackWahl ? "" : kapitalCMitFastTrack(par, w)
    ? `<li>Fast-Track (Ziffer 2 Absatz 3): <strong>gewählt</strong> — fällig mit dem Auftrag ${escHtml(kapitalCEur(kapitalCHeuteCents(par, true)))} (Gründung, Konto und Karten ${escHtml(kapitalCEur(par.gruendungCents))} und Fast-Track ${escHtml(kapitalCEur(par.fastTrackCents))})</li>`
    : `<li>Fast-Track (Ziffer 2 Absatz 3): <strong>nicht gewählt</strong> — fällig mit dem Auftrag ${escHtml(kapitalCEur(kapitalCHeuteCents(par, false)))} (Gründung, Konto und Karten)</li>`;
  return `
  <div class="gv-unterschriften">
    ${fiaon}
    ${buergin}
    <div class="sig-col"><div class="gv-sig-kopf">Für den Auftraggeber</div><div class="gv-sig-feld">${unterschriftHtml(a.unterschrift)}</div><div class="sig-line">${escHtml(name)}, ${escHtml(d.kunde.ort)}, ${escHtml(a.am.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" }))}</div></div>
  </div>
  <div class="gv-annahme">
    <h3>Annahmevermerk</h3>
    <p>Angenommen am ${escHtml(zeitText(a.am))} mit dem Knopf „${escHtml(KAPITAL_KNOPF)}“.</p>
    <ul>
      <li>Laufzeit der Finanzierung (Ziffer 4 Absatz 2): <strong>${escHtml(kapitalCLaufzeitSatz(d.parameter, w.laufzeitJahre))}</strong></li>
      ${par.bestand ? `<li>Gesellschaft (Ziffer 2): <strong>${escHtml(par.bestand.name)}</strong> — bestehende Gesellschaft, der Name bleibt</li>` : `<li>Name der Gesellschaft (Ziffer 2): Wunschname <strong>${escHtml(w.llc.wunsch)}</strong>${namen.length > 1 ? `; Ausweichnamen in dieser Reihenfolge: ${namen.slice(1).map(escHtml).join("; ")}` : "; keine Ausweichnamen"}</li>`}
      ${ftZeile}${w.sofortBeginn !== false ? `<li>Beginn vor Ablauf der Widerrufsfrist (Ziffer 10 Absatz 2), ausdrücklich verlangt: „${escHtml(par.fastTrackWahl || par.bestand ? KAPITAL_C_SOFORT_TEXT_WAHL : KAPITAL_C_SOFORT_TEXT)}“</li>` : ""}
      <li>Mit der Unterschrift bestätigt: „${escHtml(KAPITAL_C_GELESEN_TEXT)}“</li>
    </ul>
    <p class="gv-leise">IP-Adresse ${escHtml(a.ip)} · Prüfsumme des Vertragstextes (SHA-256): <span class="hash">${escHtml(a.hash)}</span></p>
  </div>`;
}
/**
 * Der Rumpf: Präambel, vierzehn Ziffern, Unterschriften/Annahmevermerk, Anlage (Widerruf). Die Prüfsumme läuft über den Rumpf
 * OHNE Vermerk und mit den VOLLSTÄNDIGEN Ausweisnummern (so steht er im angenommenen Vertrag). `opt.ausweiseGekuerzt` nur für
 * die Darstellung, die über den Link erreichbar ist (Seite, Entwurfs-PDF) — die Nummern sind dann bis auf drei Zeichen verdeckt.
 */
export function kapitalCRumpfHtml(d: KapitalCDaten, annahme: KapitalCAnnahmeVermerk | null = null, opt: KapitalCDarstellung = {}): string {
  const ziffern = ziffernHtml(kapitalCZiffern(d, opt)).split("\n");
  const letzte = ziffern.pop() ?? "";
  return `<div class="gv" lang="de"><section class="gia-praeambel" id="praeambel"><h2>Präambel</h2>${kapitalCPraeambel(d).map((x) => `<p>${escHtml(x)}</p>`).join("")}</section>
${ziffern.join("\n")}
<div class="gv-schluss">${letzte}${annahmeBlock(d, annahme)}</div>
${kapitalCWiderrufHtml()}</div>`;
}
export function kapitalCHashEingabe(d: Pick<KapitalCDaten, "ref" | "fassung">, rumpfOhneAnnahme: string): string {
  return `global-angebot-kapital-c|${d.ref}|${d.fassung}|${rumpfOhneAnnahme}`;
}
export function kapitalCVertragInhalt(d: KapitalCDaten): { anker: string; marke: string; titel: string }[] {
  return [
    { anker: "praeambel", marke: "", titel: "Präambel" },
    ...kapitalCZiffern(d).map((z) => ({ anker: `ziffer-${z.nr}`, marke: String(z.nr), titel: z.titel })),
    { anker: "anlage-widerruf", marke: "A", titel: "Anlage — Widerrufsbelehrung und Muster-Widerrufsformular" },
  ];
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE SEITE
// Reihenfolge (Nachprüfung 27.10.): Ihre Finanzierung mit Monatsrate · Laufzeit-Rechner mit den Konditionen (die EINE Navy-Stelle) ·
// Name · Paket · Weg · Investition (leise: eine Zeile mit allen Beträgen, Einzelheiten zum Aufklappen — Justin 27.10., 17:40) ·
// Unterlagen · Fragen · Ansprechpartner mit „Ihr Team“ · Vertrag · Auftrag erteilen.
// Die Geld-zurück-Garantie steht sichtbar nur in der Karte oben und in der Übersicht über dem Knopf (dazu Fragen, Informationen, Vertrag).
// ═══════════════════════════════════════════════════════════════════════════
export interface KapitalCPaketKachel { schluessel: string; titel: string; zeile: string; details: string[] }
export interface KapitalCSeite {
  auftakt: { auge: string; gruss: string; zeile: string; weiter: string };
  hero: { auge: string; titel: string; lead: string; betrag: string; umrechnung: string; kurs: string; siegel: string;
    eckdaten: { wert: string; titel: string }[]; garantie: string; knopf: string; knopfLeise: string; staat: string;
    /** Die Monatsrate in der Karte — sie folgt der Wahl im Rechner. Platzhalter {monat} und {jahre}. */
    rateAuge: string; rateBei: string; rateKnopf: string };
  /** Die Konditionen — als Leiste im Rechner (kein eigener Abschnitt mehr). */
  konditionen: { auge: string; schritte: { wann: string; titel: string; text: string }[]; fein: string[] };
  rechner: { auge: string; titel: string; sub: string; laufzeitLabel: string; jahre: string; jahr: string;
    rateAuge: string; usdPraefix: string; usdImMonat: string;
    werte: { zinsen: string; rueckzahlung: string; zinsfreiBis: string; zinsfreiWert: string; raten: string; letzteRate: string };
    monatPraefix: string; treppeKnopf: string; treppeZu: string; treppeKopf: { zeitraum: string; zins: string; zinsen: string; rest: string };
    ratenfrei: string; ratenfreiZinsfrei: string; zinsfrei: string;
    puenktlich: string; verantwortung: string; waehrung: string; hinweis: string; kursZeile: string;
    /** Für Vorleseprogramme: nur der Endwert (Platzhalter {jahre} {rate} {zinsen}). */
    vorlesen: string };
  llc: Record<keyof typeof BEGLEIT_LLC_TEXTE, string> & { aendern: string; ausweichAuf: string; ausweichZu: string; subVorschlag?: string };
  paket: { auge: string; titel: string; sub: string; gruppen: { titel: string; kacheln: KapitalCPaketKachel[] }[]; fein: string; mehr: string; weniger: string };
  weg: { auge: string; titel: string; sub: string; liste: FirmaPhase[] };
  /**
   * Justin 27.10.2026, 17:40: „kleiner (weiß auf weiß)“ — keine Bühne. `zeile` steht SICHTBAR und nennt alle Beträge (mit dem Auftrag,
   * mit der Eintragung, Gesamtpreis des ersten Jahres, ab Jahr 2, Endpreise); `zeilen`/`summe`/`fein` klappen unter `knopf` auf.
   */
  investition: { titel: string; zeile: string; knopf: string; knopfZu: string; zeilen: { wann: string; betrag: string; text: string }[]; summe: string; fein: string };
  unterlagen: { auge: string; titel: string; sub: string; liste: { titel: string; stand: string }[]; fein: string };
  fragen: { titel: string; sub: string; liste: { frage: string; antwort: string[] }[]; sichtbar: number };
  /** Ansprechpartner und darunter „Ihr Team“ (wie Fassung A/B) — leeres Team = kein Abschnitt auf der Seite. */
  ansprechpartner: { titel: string; sub: string; teamTitel: string; teamSub: string; team: KapitalTeamPerson[] };
  vertrag: { titel: string; sub: string; dokument: string; unterzeile: string; inhalt: { anker: string; marke: string; titel: string }[] };
  widerruf: { titel: string; text: string; knopf: string };
  informationen: { titel: string; sub: string; zeilen: { titel: string; text: string }[] };
  pflicht: string[];
  /** „Bildnachweis: Teamfotos teils Symbolbilder.“ sobald ein Teamfoto ein Bild am Angebot ist — sonst leer (wie Fassung A/B). */
  bildnachweis: string;
  /** E-474: die Wahl zum Fast-Track (zwei Karten vor der Unterschrift) — null ohne fastTrackWahl. */
  fastTrack: KapitalCFastTrackTexte | null;
  /** E-506: der Abschnitt „Ihre Gesellschaft“ einer bestehenden Gesellschaft — den Schlüssel gibt es nur mit parameter.bestand. */
  bestand?: KapitalCBestandBlock;
  /** E-505: die Texte des Reglers „Ihr Kapitalrahmen“ — den Schlüssel gibt es nur mit rahmenWahl (Bestand byte-gleich). */
  rahmen?: KapitalCRahmenTexte;
}
/** E-505: Der Regler steht über dem Laufzeit-Rechner; die Zahlen rechnet die Seite mit denselben Funktionen wie Server und Vertrag. */
export interface KapitalCRahmenTexte {
  auge: string; titel: string; sub: string; reglerLabel: string; von: string; bis: string; kursZeile: string;
  honorarLabel: string; honorarZeile: string; heuteLabel: string; heuteZeile: string;
  speichert: string; gespeichert: string; fehler: string; nochmal: string;
  staffelKnopf: string; staffelZu: string; staffelZeilen: { teil: string; satz: string }[]; staffelFuss: string;
  /** Für Vorleseprogramme: nur der Endwert (Platzhalter {usd} {eur} {honorar}). */
  vorlesen: string;
}
/** E-505: die Texte des Reglers — eine Quelle für Seite und Prüfstand. Nur die Stufen der Staffel, die der Regler erreicht. */
export function kapitalCRahmenTexte(par: Pick<KapitalCParameter, "kursUsdJeEur" | "kursDatum" | "fastTrackWahl"> & { rahmenWahl: KapitalCRahmenWahl }): KapitalCRahmenTexte {
  const w = par.rahmenWahl;
  const zeilen: { teil: string; satz: string }[] = [];
  let ab = 0;
  for (const st of KAPITAL_C_STAFFEL.stufen) {
    if (w.maxUsd <= ab) break;
    zeilen.push({ teil: ab === 0 ? `für die ersten ${kapitalCUsd(st.bisUsd)}` : `für den Teil von ${kapitalCUsd(ab)} bis ${kapitalCUsd(Math.min(st.bisUsd, Math.max(w.maxUsd, ab)))}`, satz: kapitalCProzent(st.bp) });
    ab = st.bisUsd;
  }
  return {
    auge: "Ihr Kapitalrahmen",
    titel: "Wählen Sie Ihren Rahmen.",
    sub: `Zwischen ${kapitalCUsd(w.minUsd)} und ${kapitalCUsd(w.maxUsd)} — Sie entscheiden. Monatsrate, Erfolgshonorar und Ihr Vertrag folgen sofort Ihrer Wahl.`,
    reglerLabel: "Kapitalrahmen in US-Dollar",
    von: kapitalCUsd(w.minUsd), bis: kapitalCUsd(w.maxUsd),
    kursZeile: `zum EZB-Referenzkurs vom ${kapitalTag(par.kursDatum)}`,
    honorarLabel: "Erfolgshonorar",
    honorarZeile: "fällig erst mit der Eintragung Ihrer Gesellschaft, einschließlich Bürgschaft",
    heuteLabel: "Mit Ihrem Auftrag",
    heuteZeile: par.fastTrackWahl ? "Gründung, Konto und Karten — den Fast-Track wählen Sie weiter unten" : "Gründung, Konto und Karten sowie Fast-Track",
    speichert: "Ihre Wahl wird übernommen …",
    gespeichert: "Übernommen — Ihr Vertrag nennt jetzt diesen Rahmen.",
    fehler: "Ihre Wahl konnte gerade nicht übernommen werden. Bitte versuchen Sie es noch einmal.",
    nochmal: "Noch einmal versuchen",
    staffelKnopf: "So berechnen wir das Erfolgshonorar", staffelZu: "Berechnung schließen",
    staffelZeilen: zeilen,
    staffelFuss: `Je größer Ihr Rahmen, desto kleiner der Satz. Umgerechnet zum Kurs Ihres Angebots, auf volle zehn Euro gerundet, mindestens ${kapitalCEur(KAPITAL_C_STAFFEL.mindestCents)}. Endpreis.`,
    vorlesen: "Kapitalrahmen {usd}, das sind {eur}. Erfolgshonorar {honorar}.",
  };
}
/** E-474: die zwei Karten „Ohne Fast-Track“ / „Mit Fast-Track“ — Beträge als Endpreise, die Garantie in beiden gleich. */
export interface KapitalCFastTrackTexte {
  auge: string; titel: string; sub: string;
  karten: { schluessel: "ohne" | "mit"; titel: string; betrag: string; zeile: string; punkte: string[] }[];
  summeLabel: string; garantie: string;
  heuteCents: { ohne: number; mit: number };
}
/**
 * Die Seite. `token` (der persönliche Link) braucht nur das Team: Fotos am Angebot gehen ausschließlich hinter dem Link raus
 * (kapitalTeam wie Fassung A/B) — ohne token stehen dort Initialen. Vertrag und Prüfsumme lesen das Team nie.
 */
export function kapitalCSeite(d: KapitalCDaten, token?: string): KapitalCSeite {
  const par = d.parameter; const k = d.kunde; const G = kapitalCGarantie(par);
  // E-465: staatsabhängige Zeiten nur für Angebote mit staatenFassung — sonst null und der alte Text bleibt wortgleich.
  const staatT = angebotStaatTexte(par.bundesstaat, par.staatenFassung);
  const betrag = kapitalCEur(par.betragCents);
  const usd = kapitalCUsd(kapitalCRahmenUsd(par));
  // Die ganze Gleichung bricht nie um („1 € =“ | „1,1188 US-$“, Nachprüfung Runde 2).
  const kursZeile = `EZB-Referenzkurs vom ${kapitalTag(par.kursDatum)}: 1${NB}€${NB}=${NB}${kapitalCKurs(par.kursUsdJeEur)}${NB}US-$`;
  const s1 = par.zinsfreiMonate + 1;
  const buerginStand = kapitalCBuerginStand(par, "seite", d.buergin.bundesstaat);
  const Z5 = kapitalCZ5(par);
  const buerginOrt = kapitalCBuerginOrt(d.buergin);
  // E-474: FT = der Kunde wählt den Fast-Track, DK = Angaben vom Kunden, Reisepass erst nach der Unterschrift. Ohne beide: wortgleich.
  const FT = par.fastTrackWahl; const DK = par.datenVomKunden;
  const eurF = kapitalCEur(par.fastTrackCents);
  const heuteMit = kapitalCEur(kapitalCHeuteCents(par, true)); const heuteOhne = kapitalCEur(kapitalCHeuteCents(par, false));
  const jahrMit = kapitalCEur(kapitalCErstesJahrCents(par, true)); const jahrOhne = kapitalCEur(kapitalCErstesJahrCents(par, false));
  const achtWochen = `${zahlwort(par.garantieWochen)} Wochen`;
  // E-487: die Vorrang-Fassung (offene Angebote) — Fast-Track = Vorrang in allen Schritten, keine Zeitzusage für die EIN.
  // V = für beide Arten (mit Wahl und Fast-Track inklusive); VW = nur mit Wahl: Dort hat ein Auftrag OHNE Fast-Track keinen Vorrang,
  // also sagt die Seite „mit Vorrang“ nur noch beim Fast-Track. Leere tempoFassung (vor E-487 angenommen): Wortlaut wie bisher.
  const V = kapitalCVorrangGilt(par) ? kapitalCVorrang(par) : null;
  const VW = V && FT ? V : null;
  const ziel = zahlwort(par.zielWochen);
  // E-506: bestehende Gesellschaft — null ohne parameter.bestand (dann bleibt die Seite byte-gleich).
  const BT = kapitalCBestandTexte(d);
  return {
    auftakt: {
      auge: "FIAON Global · Persönlich für Sie",
      gruss: `Willkommen, ${kapitalCGruss(k)}.`,
      zeile: BT ? BT.auftakt : `Ihre eigene US-Gesellschaft und Ihre Finanzierung über ${betrag}.`,
      weiter: "Weiter",
    },
    hero: {
      auge: `Persönlich für ${kapitalCGrussAkk(k)}`,
      // Justin 27.10.2026, 17:40: kein Projekt, kein Ort, kein bezahlter Anteil, kein Termin — „was er mit dem Geld macht, ist seine
      // Sache“. Zwei Sätze (am Handy kurz), „Sie“ = der Kunde, Bürgschaft als Übernahme (keine Präsens-Zusage, Runde 2).
      titel: "Die Finanzierung für Ihre Gesellschaft.",
      lead: BT ? BT.heroLead : `Wir gründen Ihre eigene US-Gesellschaft und begleiten Sie bis zur Auszahlung Ihrer Finanzierung über ${betrag}. Unsere US-Partnergesellschaft übernimmt die Bürgschaft gegenüber der Bank — und Sie erhalten eine ${KAPITAL_C_GARANTIE_NAME}.`,
      betrag, umrechnung: kapitalCUngefaehr(usd), kurs: `${kursZeile}. Ausgezahlt wird in US-Dollar zum Kurs des Auszahlungstags.`,
      siegel: "Ihre Finanzierung",
      eckdaten: [
        { wert: `${par.ratenfreiMonate} Monate`, titel: "ratenfrei" },
        { wert: `${par.zinsfreiMonate} Monate`, titel: "zinsfrei" },
        { wert: `${par.laufzeitMinJahre}–${par.laufzeitMaxJahre} Jahre`, titel: "Laufzeit nach Ihrer Wahl" },
      ],
      garantie: G.karte,
      rateAuge: "Ihre Monatsrate ab Monat {monat} nach Auszahlung · Rechenbeispiel",
      rateBei: "bei {jahre} Jahren",
      rateKnopf: "Laufzeit wählen",
      knopf: par.rahmenWahl ? "Rahmen und Laufzeit wählen" : "Laufzeit wählen", knopfLeise: "Zum Vertrag", staat: par.bundesstaat,
    },
    konditionen: {
      auge: "Ihre Konditionen · gezählt ab der Auszahlung · Ziffer 4",
      schritte: [
        { wann: `Monat 1–${par.ratenfreiMonate}`, titel: "Ratenfrei", text: "Ihre Gesellschaft zahlt in dieser Zeit nichts zurück." },
        { wann: `Monat 1–${par.zinsfreiMonate}`, titel: "Zinsfrei", text: `Auf die ersten ${zahlwort(par.zinsfreiMonate)} Monate fällt kein Zins an.` },
        { wann: `Ab Monat ${s1}`, titel: `${kapitalCProzent(par.zinsStartBp)} im Jahr`, text: `Danach steigt der Zins mit jedem Jahr um ${kapitalProzent(par.zinsSchrittBp)} Prozentpunkte.` },
        { wann: `Ab Monat ${par.aufstockungAbMonat}`, titel: "Aufstocken oder umschulden", text: "Auf Wunsch beantragt Ihre Gesellschaft eine Aufstockung oder wechselt zu einer anderen Bank — die Entscheidung liegt bei der Bank. Mit der Jahresbetreuung begleiten wir Sie dabei." },
      ],
      // Erst „Sie entscheiden“ (kein Zweck, Justin 27.10.), dann der Pflichtsatz wörtlich aus der einen Quelle (E-199).
      fein: [`${KAPITAL_C_VERWENDUNG.seite} ${GLOBAL_KAPITAL_FREI.de.satz}`, GLOBAL_KAPITAL_FREI.de.steuer],
    },
    rechner: {
      auge: "Laufzeit und Rate",
      titel: "Wählen Sie Ihre Laufzeit.",
      sub: "Ihre Monatsrate sehen Sie sofort.",
      laufzeitLabel: "Laufzeit in Jahren", jahre: "Jahre", jahr: "Jahr",
      rateAuge: "Ihre Monatsrate · Rechenbeispiel", usdPraefix: "≈", usdImMonat: "im Monat",
      werte: { zinsen: "Zinsen", rueckzahlung: "Rückzahlung", zinsfreiBis: "Zinsfrei bis", zinsfreiWert: `Monat ${par.zinsfreiMonate}`, raten: "Monatsraten", letzteRate: "letzte Rate" },
      monatPraefix: "Monat",
      treppeKnopf: "Zinstreppe ansehen", treppeZu: "Zinstreppe schließen",
      treppeKopf: { zeitraum: "Zeitraum", zins: "Zins im Jahr", zinsen: "Zinsen", rest: "Restschuld danach" },
      ratenfrei: "ratenfrei", ratenfreiZinsfrei: "ratenfrei, zinsfrei", zinsfrei: "zinsfrei",
      puenktlich: "Die Raten zahlt Ihre Gesellschaft vom Geschäftskonto an die Bank — das Geld dafür überweisen Sie ihr, am einfachsten per Dauerauftrag.",
      verantwortung: `Ihre Verantwortung: ${KAPITAL_C_VERANTWORTUNG}`,
      waehrung: `Darlehen und Raten lauten auf US-Dollar; Euro-Beträge sind Umrechnungen. Steigt der Kurs des Dollars um 10${NB}%, steigt Ihre Rate in Euro um 10${NB}%.`,
      hinweis: "Rechenbeispiel nach den Bedingungen in Ziffer 4, auf die wir Ihre Finanzierung ausrichten; über die Finanzierung entscheidet die Bank, maßgeblich ist ihr Darlehensvertrag.",
      kursZeile,
      vorlesen: "{jahre} Jahre: Monatsrate {rate}, Zinsen insgesamt {zinsen}.",
    },
    llc: {
      ...BEGLEIT_LLC_TEXTE,
      sub: "Die Gesellschaft gehört allein Ihnen. Tippen Sie den Wunschnamen — „LLC“ setzen wir dahinter.",
      // E-491: nur mit Namensvorschlag aus dem Gespräch — ohne ihn bleibt die Seite byte-gleich (Bestand, angenommene Verträge).
      ...(par.llcVorschlag ? { subVorschlag: "Die Gesellschaft gehört allein Ihnen. Ihren Wunschnamen haben wir schon eingetragen — Sie können ihn jederzeit ändern. „LLC“ setzen wir dahinter." } : {}),
      hinweis: `Vor der Anmeldung prüfen wir den Namen ${angebotStaatTexte(par.bundesstaat, par.staatenFassung)?.register ?? `im Register von ${par.bundesstaat}`}; bis dahin ist er für Sie vorgemerkt. Englische Namen funktionieren in den USA am besten, Umlaute sind dort nicht möglich.`,
      alternative1: "Ausweichname 1 (freiwillig)",
      alternative2: "Ausweichname 2 (freiwillig)",
      doppelt: "Diesen Namen haben Sie schon eingetragen — bitte einen anderen.",
      aendern: "ändern",
      ausweichAuf: "Zwei Ausweichnamen angeben (freiwillig)",
      ausweichZu: "Ausweichnamen ausblenden",
    },
    paket: {
      auge: "Ihr Paket",
      titel: "Alles, was Ihre Gesellschaft braucht.",
      sub: "Wir bereiten jeden Schritt vor. Die Anträge bei Banken und Kartenherausgebern stellen Sie selbst — fertig ausgefüllt, Sie unterschreiben nur.",
      gruppen: [
        { titel: "Ihre Gesellschaft", kacheln: [
          BT ? BT.kachelGesellschaft : { schluessel: "gesellschaft", titel: "Ihre US-Gesellschaft", zeile: `Gegründet in ${par.bundesstaat}, mit allen Unterlagen.`, details: ["Anmeldung beim Bundesstaat mit Staatsgebühr", "Operating Agreement und Gründungsunterlagen digital", "Pflichtenkalender, die erste Jahresmeldung beim Bundesstaat mit Staatsgebühr und die erste US-Jahresmeldung durch unseren US-Steuerberater (CPA)"] },
          { schluessel: "adresse", titel: "US-Adresse und Telefonnummer", zeile: "Eine Geschäftsadresse und eine US-Nummer für Ihre Gesellschaft.", details: ["Registered Agent und US-Geschäftsadresse", "Eigene US-Telefonnummer", "Post und Zustellungen digital in Ihrem Portal"] },
          { schluessel: "assistenz", titel: "Assistenz", zeile: "Eine Assistenz für Post, Anrufe und Termine.", details: ["Nimmt Anrufe Ihrer Gesellschaft entgegen", "Ordnet Post und Fristen", "Koordiniert Termine vor Ort — Sie müssen nicht reisen"] },
          BT ? BT.kachelSteuer : { schluessel: "steuernummern", titel: "EIN und ITIN", zeile: "Die Steuernummer Ihrer Gesellschaft und — nach unserem ITIN-Check — Ihre persönliche US-Steuernummer.", details: [VW ? "EIN-Antrag vollständig vorbereitet — mit Fast-Track am Tag der Eintragung" : "EIN-Antrag vollständig vorbereitet, mit Vorrang", "ITIN-Check vorab: Wir prüfen, ob die Voraussetzungen der US-Steuerbehörde vorliegen", "ITIN über unseren zertifizierten Partner im DACH-Raum — persönlich oder im Videotermin", "Über die Erteilung entscheidet die US-Steuerbehörde"] },
        ] },
        { titel: "Konto und Karten", kacheln: [
          { schluessel: "privatkonto", titel: "Privates US-Konto", zeile: "Ihr eigenes Konto in den USA.", details: ["Antrag vollständig vorbereitet", "Wir begleiten Sie bis zur Eröffnung", "Über das Konto entscheidet das jeweilige Institut"] },
          { schluessel: "privatkarten", titel: "Private Kreditkarten", zeile: "Karten mit starken Reise- und Meilenprogrammen.", details: ["Auswahl der Herausgeber und Anträge vollständig vorbereitet", KAPITAL_C_KARTEN_SOLLZINS, "Über Konto, Karten und deren Rahmen entscheidet das jeweilige Institut."] },
          { schluessel: "geschaeftskonto", titel: "Geschäftskonto", zeile: "Das Konto Ihrer Gesellschaft — für Auszahlung und Raten.", details: ["Antrag vollständig vorbereitet", "Auf dieses Konto wird Ihre Finanzierung ausgezahlt", "Von hier zahlt Ihre Gesellschaft ihre Raten"] },
          { schluessel: "firmenkarte", titel: "Firmenkarte", zeile: "Die Kreditkarte Ihrer Gesellschaft.", details: ["Antrag vollständig vorbereitet", "US-Firmenkarten setzen in der Regel die persönliche Haftung des Inhabers voraus.", "Über Karte und Rahmen entscheidet der jeweilige Herausgeber."] },
        ] },
      ],
      fein: BT ? BT.paketFein : "Im ersten Jahr ist alles enthalten — auch die erste Jahresmeldung beim Bundesstaat. Ab dem zweiten Jahr hält die Jahresbetreuung Ihre Gesellschaft am Laufen — Sie finden sie unten unter „Ihre Investition“.",
      mehr: "Mehr erfahren", weniger: "Weniger",
    },
    weg: {
      auge: "Ihr Weg",
      titel: FT ? `${gross(zahlwort(par.zielWochen))} Wochen mit Fast-Track. Das ist unser Ziel.` : `${gross(zahlwort(par.zielWochen))} Wochen. Das ist unser Ziel.`,
      sub: BT ? BT.wegSub : VW ? `Wir beginnen in beiden Fällen sofort mit Ihrem Zahlungseingang. Ohne Fast-Track stehen Ihre Gesellschaft und EIN in ${KAPITAL_C_TEMPO.ohne}; mit Fast-Track hat Ihr Auftrag in jedem Schritt Vorrang — Ihre Geld-zurück-Garantie bleibt bei ${achtWochen}.`
        : FT ? `Wir beginnen in beiden Fällen sofort mit Ihrem Zahlungseingang. Mit Fast-Track stehen Ihre Gesellschaft und EIN in ${KAPITAL_C_TEMPO.mit}, ohne in ${KAPITAL_C_TEMPO.ohne} — Ihre Geld-zurück-Garantie bleibt bei ${achtWochen}.` : "Mit dem Fast-Track laufen Gründung, Unterlagen und Bürgschaft parallel.",
      liste: [
        BT ? BT.weg1 : { nr: 1, titel: "Ihre Gesellschaft entsteht", dauer: staatT?.fahrplanDauer ?? "Woche eins", text: `Anmeldung in ${par.bundesstaat} unter Ihrem Wunschnamen, ${VW ? "EIN-Antrag (mit Fast-Track am Tag der Eintragung)" : "EIN mit Vorrang"}, US-Adresse, Telefonnummer und Assistenz. Sie unterschreiben, was wir vorbereiten.${staatT ? ` ${staatT.eintragungSatz}` : ""}${DK ? " Los geht es, sobald Ihr Reisepass da ist — Sie laden ihn direkt nach der Unterschrift hoch." : ""}` },
        { nr: 2, titel: "Alles für die Bank", dauer: "Wochen zwei und drei", text: "Geschäftskonto, Unterlagen und Bürgschaft — wir bereiten jeden Antrag vollständig vor und stimmen alles mit der finanzierenden Bank ab." },
        { nr: 3, titel: "Auszahlung", dauer: FT ? "Woche vier — unser Ziel mit Fast-Track" : "Woche vier — unser Ziel", text: `Ihre Finanzierung über ${betrag} auf dem Konto Ihrer Gesellschaft, in US-Dollar zum Kurs des Auszahlungstags. Zahlungen, die von der Finanzierung abhängen, sagen Sie am besten erst danach zu.` },
        { nr: 4, titel: "Konto und Karten", dauer: "Danach", text: "Ihr privates US-Konto, Ihre Kreditkarten und die Firmenkarte — Schritt für Schritt, fertig vorbereitet." },
      ],
    },
    investition: {
      titel: "Ihre Investition",
      // Leise, aber vollständig (§ 3 PAngV): alle Beträge in EINER sichtbaren Zeile — die Einzelheiten klappen auf.
      zeile: BT ? BT.investZeile : FT ? `Mit Ihrem Auftrag ${heuteOhne}, mit Fast-Track ${heuteMit}; mit der Eintragung Ihrer Gesellschaft ${kapitalCEur(par.erfolgCents)} einschließlich Bürgschaft — im ersten Jahr insgesamt ${jahrOhne} oder ${jahrMit} mit Fast-Track; ab dem zweiten Jahr ${kapitalCEur(par.jahresCents)} je Jahr. Alle Beträge sind Endpreise.` : `Mit Ihrem Auftrag ${kapitalCEur(kapitalCHeuteCents(par))}, mit der Eintragung Ihrer Gesellschaft ${kapitalCEur(par.erfolgCents)} einschließlich Bürgschaft — im ersten Jahr insgesamt ${kapitalCEur(kapitalCErstesJahrCents(par))}; ab dem zweiten Jahr ${kapitalCEur(par.jahresCents)} je Jahr. Alle Beträge sind Endpreise.`,
      knopf: "Einzelheiten", knopfZu: "Einzelheiten schließen",
      zeilen: [
        // „Mit Ihrem Auftrag“ statt „heute“ (fällig mit der Rechnung bei der Annahme, zahlbar binnen sieben Tagen — Runde 2).
        BT ? BT.invest1 : FT ? { wann: "Mit Ihrem Auftrag", betrag: heuteOhne, text: `Gründung, Konto und Karten · Fast-Track nach Ihrer Wahl zusätzlich${NB}${eurF}` }
          : { wann: "Mit Ihrem Auftrag", betrag: kapitalCEur(kapitalCHeuteCents(par)), text: `Gründung, Konto und Karten${NB}${kapitalCEur(par.gruendungCents)} · Fast-Track${NB}${kapitalCEur(par.fastTrackCents)}` },
        BT ? BT.invest2 : { wann: "Mit der Eintragung Ihrer Gesellschaft", betrag: kapitalCEur(par.erfolgCents), text: `Erfolgshonorar für die erfolgreiche Gründung, einschließlich Bürgschaft — nach unserem Plan ${staatT?.planWoche ?? "in Woche eins oder zwei"}. Kommt die Auszahlung nicht binnen ${zahlwort(par.garantieWochen)} Wochen, erhalten Sie auch diesen Betrag zurück.` },
        { wann: "Ab dem zweiten Jahr", betrag: `${kapitalCEur(par.jahresCents)} je Jahr`, text: "Jahresbetreuung: Adresse, Telefonnummer, Assistenz und alle US-Meldungen, solange Ihre Gesellschaft besteht — Sie zahlen jedes Jahr neu, nichts verlängert sich von selbst." },
      ],
      summe: FT ? `Im ersten Jahr insgesamt ${jahrOhne} — mit Fast-Track ${jahrMit}.` : `Im ersten Jahr insgesamt ${kapitalCEur(kapitalCErstesJahrCents(par))}.`,
      fein: "Überweisung auf Rechnung — keine Lastschrift, kein Abo. Die Honorare unserer Partner sind enthalten. Zinsen und Kosten der Finanzierung richten sich nach Ziffer 4 und dem Darlehensvertrag der Bank.",
    },
    unterlagen: {
      auge: "Ihre Unterlagen",
      titel: "Ihre Unterlagen liegen vor.",
      sub: DK ? "Ihren Reisepass laden Sie direkt nach der Unterschrift hoch — hier auf dieser Seite." : "Alles, was wir für den Start brauchen, haben Sie uns schon gegeben.",
      liste: par.unterlagen.map((u) => ({ titel: u.titel, stand: u.am ? `liegt vor seit ${kapitalTag(u.am)}` : "liegt vor" })),
      fein: "Ihre Unterlagen liegen nur bei uns, verschlüsselt — auf dieser Seite erscheinen sie nie.",
    },
    fragen: {
      titel: "Fragen und Antworten",
      sub: "Kurz und klar.",
      sichtbar: 6,
      // Runde 2 (Kundensicht): Bürgschaft offen (verbunden, 36 Monate, Rückgriff aus Ziffer 5 Abs. 5, Registerstand mit Folge), die Frage
      // nach anderen Bedingungen der Bank an Platz 2, Raten mit Dauerauftrag und Quartalsmeldung, vorzeitige Rückzahlung.
      liste: [
        { frage: "Was, wenn die Auszahlung nicht kommt?", antwort: [G.frage, KAPITAL_C_VERWENDUNG.rat] },
        { frage: "Und wenn die Bank andere Bedingungen anbietet?", antwort: [
          "Dann entscheiden Sie. Bevor Ihre Gesellschaft etwas unterschreibt, sehen Sie das Angebot der Bank schwarz auf weiß. Ein Angebot mit schlechteren Bedingungen, weiteren Sicherheiten oder Kosten für Sie muss Ihre Gesellschaft nicht annehmen — Ihre Geld-zurück-Garantie läuft dann weiter.",
          "Nur ein Angebot genau zu den Bedingungen aus Ziffer 4, ohne weitere Sicherheiten oder Kosten für Sie, lässt die Frist ruhen, solange es offensteht; lehnt Ihre Gesellschaft ein solches Angebot ab, entfällt die Geld-zurück-Garantie (Ziffer 4).",
        ] },
        { frage: "Was bedeutet die Bürgschaft für mich?", antwort: [
          `Die Bürgschaft gegenüber der Bank übernimmt unsere US-Partnergesellschaft, die ${d.buergin.name}${buerginOrt ? ` in ${buerginOrt}` : ""} — ein mit FIAON verbundenes Unternehmen —, längstens für ${zahlwort(par.buergschaftMonate)} Monate. Ihre Vergütung steckt im Erfolgshonorar; eine Bareinlage oder dingliche Sicherheit (etwa eine Grundschuld) verlangen wir nicht.`,
          `Für Sie heißt das: Solange Ihre Gesellschaft ihre Raten zahlt, kommt es auf die Bürgschaft nicht an. Müsste die Bürgin einmal für sie zahlen, ersetzen Ihre Gesellschaft und Sie persönlich ihr den gezahlten Betrag mit den Kosten — das vereinbaren Sie ausdrücklich in Ziffer 5 Absatz ${Z5.rueckgriff}.`,
          ...(buerginStand ? [buerginStand] : []),
        ] },
        { frage: "Wer zahlt die Raten?", antwort: [
          `Ihre Gesellschaft — pünktlich zu jedem Fälligkeitstag vom Geschäftskonto an die Bank. Das Geld dafür überweisen Sie ihr, am einfachsten per Dauerauftrag; wie das steuerlich zu behandeln ist, klärt unser Partner-Steuerberater vorab mit Ihnen. Die ersten ${zahlwort(par.ratenfreiMonate)} Monate nach der Auszahlung sind ratenfrei.`,
          "Solange die Bürgschaft läuft, schicken Sie uns einmal im Quartal kurz den Stand der Rückzahlungen — eine E-Mail genügt.",
        ] },
        { frage: "Kann ich die Laufzeit später ändern?", antwort: [`Über eine Umschuldung: Ab dem ${kapitalCOrdnung(par.aufstockungAbMonat)} Monat kann Ihre Gesellschaft zu einer anderen Bank wechseln oder eine Aufstockung beantragen — darüber entscheidet die Bank; mit der Jahresbetreuung begleiten wir Sie dabei. Was dann gilt, steht im neuen Vertrag der Bank.`] },
        { frage: "Kann meine Gesellschaft früher zurückzahlen?", antwort: ["Ob und wann vorzeitig zurückgezahlt werden kann, regelt der Darlehensvertrag der Bank. Diese Bedingungen zeigen wir Ihnen, bevor Ihre Gesellschaft das Angebot annimmt."] },
        { frage: "Warum Dollar?", antwort: [`Ihre Gesellschaft ist eine US-Gesellschaft: Darlehen und Raten lauten auf US-Dollar. Wir rechnen Ihnen alles in Euro um; steigt der Kurs des Dollars um 10${NB}%, steigt Ihre Rate in Euro um 10${NB}% — und umgekehrt.`] },
        ...(BT ? [BT.frageWarum] : []),
        { frage: "Muss das Geld in den USA bleiben?", antwort: [`Nein. ${KAPITAL_C_VERWENDUNG.seite} ${GLOBAL_KAPITAL_FREI.de.satz} ${GLOBAL_KAPITAL_FREI.de.steuer} Eine US-Gesellschaft ist kein Steuermodell.`] },
        BT ? BT.frageReisen : { frage: "Muss ich in die USA reisen?", antwort: ["Nein. Unsere Partner in den USA erledigen die Termine vor Ort; Sie steuern jeden Schritt von zu Hause. Für Ihre ITIN prüft unser zertifizierter Partner im DACH-Raum vorab die Voraussetzungen — persönlich oder im Videotermin."] },
        { frage: "Wem gehört die Gesellschaft?", antwort: ["Allein Ihnen. FIAON erwirbt keine Anteile. Eine US-Gesellschaft ist kein Steuermodell — wie sie steuerlich behandelt wird, klärt unser Partner-Steuerberater vorab mit Ihnen."] },
        // E-487: die Antwort ohne Zeitzusage für die EIN — die Schritte des Fast-Track (kapitalCVorrang), Ziel und Garantie wie bisher.
        ...(VW ? [{ frage: "Was bringt der Fast-Track?", antwort: [`${VW.frage} Unser Ziel ist dann die Auszahlung in Woche ${ziel}. Er kostet einmalig ${eurF}. Ihre Geld-zurück-Garantie bleibt mit und ohne Fast-Track bei ${achtWochen}.`] }]
          : FT ? [{ frage: "Was bringt der Fast-Track?", antwort: [`Vorrang: Ihre Gesellschaft und EIN stehen in ${KAPITAL_C_TEMPO.mit} statt in ${KAPITAL_C_TEMPO.ohne}, die Unterlagen für die Bank entstehen parallel — unser Ziel ist dann die Auszahlung in Woche ${zahlwort(par.zielWochen)}. ${KAPITAL_C_TEMPO.itin} Er kostet einmalig ${eurF}. Ihre Geld-zurück-Garantie bleibt mit und ohne Fast-Track bei ${achtWochen}.`] }] : []),
        ...(DK ? [{ frage: "Wofür brauchen Sie meine Angaben?", antwort: ["Für Ihren Vertrag und die gesetzlich vorgeschriebene Identifizierung. Geburtsdatum und Anschrift tragen Sie vor der Unterschrift ein; Ihren Reisepass laden Sie erst danach hoch. Ihre Angaben stehen nur in Ihrem Vertrag und in Ihrer Akte bei uns."] }] : []),
        BT ? BT.frageWiderruf : FT ? { frage: "Kann ich widerrufen?", antwort: ["Ja, binnen vierzehn Tagen — Belehrung und Muster-Widerrufsformular stehen in der Anlage Ihres Vertrags. Mit Ihrer Annahme verlangen Sie, dass wir sofort beginnen — mit und ohne Fast-Track; bei einem Widerruf bezahlen Sie dann nur die bis dahin erbrachten Leistungen anteilig."] }
          : { frage: "Kann ich widerrufen?", antwort: ["Ja, binnen vierzehn Tagen — Belehrung und Muster-Widerrufsformular stehen in der Anlage Ihres Vertrags. Dieses Angebot gibt es mit Fast-Track: Mit Ihrer Annahme verlangen Sie, dass wir sofort beginnen; bei einem Widerruf bezahlen Sie dann nur die bis dahin erbrachten Leistungen anteilig."] },
      ],
    },
    ansprechpartner: {
      titel: "Ihr Ansprechpartner", sub: "Sie erreichen uns direkt — vor der Annahme bei jeder Frage, danach bei jedem Schritt.",
      teamTitel: KAPITAL_TEAM_TEXTE.titel, teamSub: KAPITAL_TEAM_TEXTE.sub, team: kapitalTeam(par, token),
    },
    vertrag: {
      titel: "Ihr Vertrag",
      sub: DK ? "Vierzehn klare Ziffern mit Widerrufsbelehrung und Muster-Widerrufsformular als Anlage — derselbe Text wie im PDF." : "Vierzehn klare Ziffern mit Widerrufsbelehrung und Muster-Widerrufsformular als Anlage — derselbe Text wie im PDF. Ihre Ausweisnummern zeigen wir hier gekürzt; im angenommenen Vertrag stehen sie vollständig.",
      dokument: kapitalCVertragTitel(),
      unterzeile: kapitalCVertragUnterzeile(d),
      inhalt: kapitalCVertragInhalt(d),
    },
    widerruf: {
      titel: "Ihr Widerrufsrecht",
      text: "Sie können den Vertrag binnen vierzehn Tagen widerrufen — ohne Angabe von Gründen. Belehrung und Muster-Widerrufsformular stehen in der Anlage.",
      knopf: "Belehrung und Formular lesen",
    },
    informationen: {
      titel: "Informationen vor Vertragsschluss",
      sub: "Alles Wesentliche auf einen Blick (Art. 246a EGBGB).",
      zeilen: [
        { titel: "Ihr Vertragspartner", text: `${FIAON_FIRMA.name}, ${FIAON_FIRMA.strasse}, ${kapitalCOrtZeileNb()}, ${FIAON_FIRMA.land} · ${FIAON_FIRMA.register}, Nr. ${FIAON_FIRMA.companyNo} · vertreten durch ${FIAON_FIRMA.director}, Director · Telefon ${FIAON_FIRMA.telefon} · ${FIAON_FIRMA.email}` },
        BT ? BT.infoLeistung : { titel: "Die Leistung", text: `Gründung Ihrer US-Gesellschaft (LLC) in ${par.bundesstaat} mit Adresse, Telefonnummer, Assistenz, EIN und — nach dem ITIN-Check — ITIN, im ersten Jahr mit der ersten Jahresmeldung beim Bundesstaat; Vorbereitung von privatem Konto, privaten Karten, Geschäftskonto und Firmenkarte; Begleitung bis zur Finanzierung über ${betrag} durch eine US-Bank mit der Bürgschaft unserer US-Partnergesellschaft (Ziffer 2 bis 5). Über die Finanzierung entscheidet die Bank.` },
        BT ? BT.infoPreise : FT ? { titel: "Die Preise", text: `Mit Ihrem Auftrag fällig ${heuteOhne} (Gründung, Konto und Karten); mit Fast-Track zusätzlich ${eurF}, zusammen ${heuteMit}; mit der Eintragung Ihrer Gesellschaft ${kapitalCEur(par.erfolgCents)} Erfolgshonorar einschließlich Bürgschaft; im ersten Jahr insgesamt ${jahrOhne} ohne oder ${jahrMit} mit Fast-Track; ab dem zweiten Jahr ${kapitalCEur(par.jahresCents)} je Jahr. Alle Beträge sind Endpreise.` } :
        { titel: "Die Preise", text: `Mit Ihrem Auftrag fällig ${kapitalCEur(kapitalCHeuteCents(par))} (Gründung, Konto und Karten ${kapitalCEur(par.gruendungCents)}, Fast-Track ${kapitalCEur(par.fastTrackCents)}); mit der Eintragung Ihrer Gesellschaft ${kapitalCEur(par.erfolgCents)} Erfolgshonorar einschließlich Bürgschaft; im ersten Jahr insgesamt ${kapitalCEur(kapitalCErstesJahrCents(par))}; ab dem zweiten Jahr ${kapitalCEur(par.jahresCents)} je Jahr. Alle Beträge sind Endpreise.` },
        { titel: "Zahlung", text: FT ? `Per Überweisung auf Rechnung, zahlbar ${kapitalCZahlbar(par.zahlungszielTage)}. Die Rechnung über ${heuteOhne} — mit Fast-Track ${heuteMit} — kommt mit der Annahme.` : `Per Überweisung auf Rechnung, zahlbar ${kapitalCZahlbar(par.zahlungszielTage)}. Die Rechnung über ${kapitalCEur(kapitalCHeuteCents(par))} kommt mit der Annahme.` },
        // E-487: mit Fast-Track der Vorrang in allen Schritten statt einer Zeit (auch ohne Wahl, dort ist der Fast-Track inklusive).
        BT ? BT.infoBeginn : { titel: "Beginn und Zeitplan", text: `${V
          ? (FT ? `Sofort mit Ihrem Zahlungseingang — auf Ihren ausdrücklichen Wunsch vor Ablauf der Widerrufsfrist, mit und ohne Fast-Track. Ohne Fast-Track stehen Ihre Gesellschaft, EIN und ITIN in ${KAPITAL_C_TEMPO.ohne}; mit Fast-Track hat Ihr Auftrag Vorrang in allen Schritten (${V.liste}), unser Ziel ist dann die Auszahlung in Woche ${ziel}.`
            : `Mit Ihrem Zahlungseingang — auf Ihren ausdrücklichen Wunsch vor Ablauf der Widerrufsfrist (Fast-Track: Vorrang in allen Schritten — ${V.liste}). Unser Ziel ist die Auszahlung in Woche ${ziel}.`)
          : FT ? `Sofort mit Ihrem Zahlungseingang — auf Ihren ausdrücklichen Wunsch vor Ablauf der Widerrufsfrist, mit und ohne Fast-Track. Ohne Fast-Track stehen Ihre Gesellschaft, EIN und ITIN in ${KAPITAL_C_TEMPO.ohne}; mit Fast-Track Ihre Gesellschaft und EIN in ${KAPITAL_C_TEMPO.mit} (${KAPITAL_C_TEMPO.itin.replace(/\.$/, "")}), unser Ziel ist dann die Auszahlung in Woche ${zahlwort(par.zielWochen)}.` : `Mit Ihrem Zahlungseingang — auf Ihren ausdrücklichen Wunsch vor Ablauf der Widerrufsfrist (Fast-Track). Unser Ziel ist die Auszahlung in Woche ${zahlwort(par.zielWochen)}.`}${DK ? " Mit Anmeldungen und Anträgen beginnen wir, sobald Ihr Reisepass vorliegt." : ""}` },
        { titel: KAPITAL_C_GARANTIE_NAME, text: G.info },
        { titel: "Sicherheiten und Bürgschaft", text: `Eine Bareinlage oder dingliche Sicherheit verlangen wir nicht. Die Bürgschaft gegenüber der Bank übernimmt unsere US-Partnergesellschaft, ein mit FIAON verbundenes Unternehmen (Ziffer 5)${buerginStand ? `, sobald sie im US-Register wieder als aktiv geführt wird; derzeit wird sie dort als inaktiv geführt` : ""}. ${KAPITAL_C_VERANTWORTUNG}` },
        { titel: "Vertragsdauer", text: `Die Begleitung läuft ${zahlwort(par.begleitMonate)} Monate ab ${BT ? "Vertragsschluss" : "der Eintragung"}. Die Jahresbetreuung ab dem zweiten Jahr — mit der Begleitung bei einer Aufstockung oder Umschuldung — beginnt nur mit Ihrer Zahlung und verlängert sich nicht von selbst. Die Finanzierung läuft über die Laufzeit, die Sie wählen.` },
        { titel: "Widerrufsrecht", text: "Vierzehn Tage ab Vertragsschluss — Belehrung und Muster-Widerrufsformular in der Anlage. Bei einem Widerruf nach Beginn zahlen Sie die bis dahin erbrachten Leistungen anteilig." },
        { titel: "Gewährleistung und Beschwerden", text: `Es gilt die gesetzliche Mängelhaftung. Beschwerden an ${FIAON_FIRMA.email}. FIAON nimmt nicht an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teil.` },
        { titel: "Vertragstext und Sprache", text: "Deutsch. Wir speichern den Vertragstext; Sie erhalten ihn nach der Annahme als PDF mit Ihrem Annahmevermerk per E-Mail." },
      ],
    },
    pflicht: [...ANGEBOT_PFLICHTHINWEIS, KAPITAL_C_PFLICHT_ZUSATZ],
    bildnachweis: kapitalBildnachweis(par),
    fastTrack: FT ? {
      auge: "Ihr Tempo", titel: "Mit oder ohne Fast-Track?", sub: "Sie entscheiden. Ihre Geld-zurück-Garantie gilt in beiden Fällen.",
      // Nichts ist vorgewählt (§ 312a Abs. 3 BGB): Die Karten tragen keinen Zustand — die Seite startet ohne Wahl (ft = null).
      karten: [
        { schluessel: "ohne", titel: "Ohne Fast-Track", betrag: heuteOhne, zeile: `Wir beginnen sofort mit Ihrem Zahlungseingang. Ihre Gesellschaft, EIN und ITIN stehen in ${KAPITAL_C_TEMPO.ohne}.`, punkte: ["Gründung, Konto und Karten", `Geld-zurück-Garantie: ${achtWochen}`] },
        // E-487: mit Fast-Track der Vorrang in jedem Schritt (Anmeldung, Antrag auf die EIN, Unterlagen) — keine Zeit für die EIN.
        VW ? { schluessel: "mit", titel: "Mit Fast-Track", betrag: heuteMit, zeile: "Wir beginnen sofort, mit Vorrang in jedem Schritt — die Unterlagen für die Bank entstehen parallel.", punkte: [`Gründung, Konto und Karten · Fast-Track${NB}${eurF}`, VW.anmeldungKarte, VW.ein, `Unser Ziel: Auszahlung in Woche ${ziel}`, `Geld-zurück-Garantie: ${achtWochen}`] }
          : { schluessel: "mit", titel: "Mit Fast-Track", betrag: heuteMit, zeile: `Wir beginnen sofort, mit Vorrang: Ihre Gesellschaft und EIN in ${KAPITAL_C_TEMPO.mit}.`, punkte: [`Gründung, Konto und Karten · Fast-Track${NB}${eurF}`, KAPITAL_C_TEMPO.itin.replace(/\.$/, ""), `Unser Ziel: Auszahlung in Woche ${zahlwort(par.zielWochen)}`, `Geld-zurück-Garantie: ${achtWochen}`] },
      ],
      summeLabel: "Fällig mit Ihrem Auftrag",
      garantie: VW ? `Wir beginnen in beiden Fällen sofort. Mit Fast-Track hat Ihr Auftrag in jedem Schritt Vorrang, unser Ziel ist die Auszahlung in Woche ${ziel}. Ihre Geld-zurück-Garantie gilt in beiden Fällen: ${achtWochen}.`
        : `Wir beginnen in beiden Fällen sofort. Mit Fast-Track stehen Ihre Gesellschaft und EIN in ${KAPITAL_C_TEMPO.mit}, unser Ziel ist die Auszahlung in Woche ${zahlwort(par.zielWochen)}. Ihre Geld-zurück-Garantie gilt in beiden Fällen: ${achtWochen}.`,
      heuteCents: { ohne: kapitalCHeuteCents(par, false), mit: kapitalCHeuteCents(par, true) },
    } : null,
    // E-505: nur mit Regler — ohne ihn fehlt der Schlüssel (Bestand byte-gleich).
    ...(par.rahmenWahl ? { rahmen: kapitalCRahmenTexte({ ...par, rahmenWahl: par.rahmenWahl }) } : {}),
    // E-506: nur mit bestehender Gesellschaft.
    ...(BT ? { bestand: BT.block } : {}),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ÜBERSICHT (§ 312j Abs. 2 BGB) UND ANNAHME — unmittelbar über dem Knopf
// ═══════════════════════════════════════════════════════════════════════════
/**
 * E-474: `fastTrack` — die Wahl der zwei Karten (nur bei fastTrackWahl): true/false zeigt den Betrag dieser Wahl, null beide.
 * Ohne fastTrackWahl wird der Wert nicht gelesen (Übersicht wortgleich wie bisher).
 */
export function kapitalCBestellUebersicht(d: KapitalCDaten, laufzeitJahre: number | null, fastTrack: boolean | null = null): { titel: string; zeilen: { label: string; wert: string }[] } {
  const par = d.parameter; const k = d.kunde;
  const plan = laufzeitJahre != null && kapitalCLaufzeitGueltig(laufzeitJahre, par) ? kapitalCPlan(par, laufzeitJahre) : null;
  const zahlbar = `Rechnung mit der Annahme, zahlbar ${kapitalCZahlbar(par.zahlungszielTage)}`;
  const BT = kapitalCBestandTexte(d);
  const faellig = BT ? BT.uebFaellig(zahlbar) : !par.fastTrackWahl
    ? `${kapitalCEur(kapitalCHeuteCents(par))} (Gründung, Konto und Karten ${kapitalCEur(par.gruendungCents)} + Fast-Track ${kapitalCEur(par.fastTrackCents)}) — ${zahlbar}`
    : fastTrack === true ? `${kapitalCEur(kapitalCHeuteCents(par, true))} (Gründung, Konto und Karten ${kapitalCEur(par.gruendungCents)} + Fast-Track ${kapitalCEur(par.fastTrackCents)}) — ${zahlbar}`
    : fastTrack === false ? `${kapitalCEur(kapitalCHeuteCents(par, false))} (Gründung, Konto und Karten, ohne Fast-Track) — ${zahlbar}`
    : `${kapitalCEur(kapitalCHeuteCents(par, false))} ohne Fast-Track oder ${kapitalCEur(kapitalCHeuteCents(par, true))} mit Fast-Track — bitte oben wählen; ${zahlbar}`;
  const jahr = !par.fastTrackWahl || fastTrack != null ? kapitalCEur(kapitalCErstesJahrCents(par, fastTrack !== false))
    : `${kapitalCEur(kapitalCErstesJahrCents(par, false))} ohne oder ${kapitalCEur(kapitalCErstesJahrCents(par, true))} mit Fast-Track`;
  // E-475: mit fastTrackWahl beginnt FIAON in BEIDEN Fällen sofort — die Wahl ändert nur das Tempo.
  // E-487: mit Fast-Track der Vorrang in allen Schritten (Ziffer 2 Absatz 3) statt einer Zeit — leere tempoFassung: Wortlaut wie bisher.
  const mitFastTrack = kapitalCVorrangGilt(par) ? "; mit Fast-Track Vorrang in allen Schritten (Ziffer 2 Absatz 3)" : `; mit Fast-Track Ihre Gesellschaft und EIN in ${KAPITAL_C_TEMPO.mit}`;
  const beginn = BT ? BT.uebBeginn : !par.fastTrackWahl ? "sofort mit Ihrem Zahlungseingang — auf Ihren ausdrücklichen Wunsch vor Ablauf der Widerrufsfrist (Fast-Track)"
    : `sofort mit Ihrem Zahlungseingang — auf Ihren ausdrücklichen Wunsch vor Ablauf der Widerrufsfrist${fastTrack === true ? mitFastTrack : fastTrack === false ? `; Ihre Gesellschaft, EIN und ITIN in ${KAPITAL_C_TEMPO.ohne}` : ", mit und ohne Fast-Track"}`;
  // E-474: Solange der Kunde seine Anschrift noch nicht eingetragen hat (datenVomKunden), steht hier nur der Name mit dem Hinweis.
  const auftraggeber = k.strasse ? `${kapitalCName(k)}, ${k.strasse}, ${k.plz}${NB}${k.ort}` : `${kapitalCName(k)} — Geburtsdatum und Anschrift bitte oben eintragen`;
  return {
    titel: "Ihr Auftrag im Überblick",
    zeilen: [
      // Postleitzahlen und Orte bleiben zusammen (geschütztes Leerzeichen, Runde 2).
      { label: "Vertragspartner", wert: `${FIAON_FIRMA.name}, ${FIAON_FIRMA.strasse}, ${kapitalCOrtZeileNb()}, ${FIAON_FIRMA.land}` },
      { label: "Auftraggeber", wert: auftraggeber },
      ...(BT ? [{ label: "Ihre Gesellschaft", wert: BT.uebGesellschaft }] : []),
      BT ? { label: "Leistung", wert: BT.uebLeistung } : { label: "Leistung", wert: `Gründung Ihrer US-Gesellschaft (LLC) in ${par.bundesstaat} mit Adresse, Telefonnummer, Assistenz, EIN und ITIN (nach ITIN-Check); Konto und Karten vorbereitet; Begleitung bis zur Finanzierung mit Bürgschaft (Ziffer 2 bis 5)` },
      { label: "Finanzierung", wert: `${kapitalCEur(par.betragCents)}, ausgezahlt in US-Dollar · ${par.ratenfreiMonate} Monate ratenfrei, ${par.zinsfreiMonate} Monate zinsfrei, ab Monat ${par.zinsfreiMonate + 1}: ${kapitalCProzent(par.zinsStartBp)} im Jahr, danach jedes Jahr ${kapitalProzent(par.zinsSchrittBp)} Prozentpunkte mehr — über die Finanzierung entscheidet die Bank (Ziffer 4)` },
      { label: KAPITAL_C_LAUFZEIT_LABEL, wert: kapitalCLaufzeitZeile(par, plan ? plan.jahre : null) },
      { label: "Ihre Verantwortung", wert: KAPITAL_C_VERANTWORTUNG },
      { label: `${KAPITAL_C_GARANTIE_NAME} (Ziffer 4)`, wert: kapitalCGarantie(par).uebersicht },
      { label: "Fällig mit Ihrem Auftrag", wert: faellig },
      { label: BT ? BT.uebErfolgLabel : "Mit der Eintragung", wert: `${kapitalCEur(par.erfolgCents)} Erfolgshonorar einschließlich Bürgschaft (Ziffer 6 Absatz 2)` },
      { label: "Im ersten Jahr insgesamt", wert: `${jahr} — Endpreise, eine etwa anfallende Umsatzsteuer ist enthalten` },
      { label: "Ab dem zweiten Jahr", wert: `Jahresbetreuung ${kapitalCEur(par.jahresCents)} je Jahr` },
      { label: "Vertragsdauer", wert: `Begleitung ${zahlwort(par.begleitMonate)} Monate ab ${BT ? "Vertragsschluss" : "der Eintragung"}; die Jahresbetreuung ab Jahr 2 nur mit Ihrer Zahlung, keine automatische Verlängerung` },
      { label: "Beginn", wert: beginn },
      { label: "Widerruf", wert: "vierzehn Tage, Belehrung und Muster-Widerrufsformular in der Anlage" },
    ],
  };
}
/** Die Zeile „Laufzeit der Finanzierung“ der Übersicht — eine Quelle für Server (Vorschlag) und Seite (Wahl des Kunden). */
export const KAPITAL_C_LAUFZEIT_LABEL = "Laufzeit der Finanzierung";
export function kapitalCLaufzeitZeile(k: KapitalCKonditionen, jahre: number | null): string {
  if (jahre == null || !kapitalCLaufzeitGueltig(jahre, k)) return "bitte oben wählen";
  const plan = kapitalCPlan(k, jahre);
  const letzte = kapitalCLetzteRateAnders(plan) ? `, letzte Rate ${kapitalCEurCent(plan.letzteRateCents)}` : "";
  // Der Punkt vor „Rechenbeispiel“ hängt nie allein am Zeilenende (geschütztes Leerzeichen davor, Runde 2).
  return `${zahlwort(plan.jahre)} Jahre · Monatsrate ${kapitalCEurCent(plan.monatsrateCents)} (${kapitalCUngefaehr(kapitalCUsd(plan.usd.monatsrate))}${letzte})${NB}· Rechenbeispiel, maßgeblich ist der Darlehensvertrag der Bank`;
}
export interface KapitalCAnnahmeTexte {
  auge: string; titel: string; sub: string;
  laufzeit: string; laufzeitAendern: string;
  /** „Monatsrate {rate} (Rechenbeispiel)“ */
  rateZeile: string;
  name: string; nameAendern: string;
  gelesen: string;
  /**
   * Runde 2: KEIN Haken „gelesen“ mehr — der Satz steht direkt über der Unterschrift, die Unterschrift bestätigt ihn
   * („Mit Ihrer Unterschrift bestätigen Sie: „Ich habe …gelesen.““). Im Annahmevermerk: „Mit der Unterschrift bestätigt: …“.
   */
  gelesenVorsatz: string;
  /** Die Wörter im Satz „gelesen“, die zum Text führen (Vertrag öffnet den Leser, die anderen klappen ihren Block auf). */
  gelesenLinks: { vertrag: string; informationen: string; widerruf: string };
  sofort: string; sofortUnter: string;
  unterschrift: FirmaAnnahmeTexte["unterschrift"];
  knopf: string; knopfSendet: string; unterKnopf: string; gesperrt: string;
  /** Am Ende des Vertragslesers: ein ruhiger Sprung-Knopf (nie „zahlungspflichtig“ — der echte Knopf steht unten) und sein Satz. */
  leserKnopf: string; leserSatz: string;
  /** E-474: nur bei fastTrackWahl — der Satz unter dem Knopf ohne Fast-Track und der Hinweis, wenn noch nicht gewählt. */
  unterKnopfOhne?: string; fehltFastTrack?: string;
  /** E-474: nur bei datenVomKunden — gesperrt, solange die Angaben fehlen. */
  angabenFehlen?: string;
}
export function kapitalCAnnahmeTexte(d: KapitalCDaten): KapitalCAnnahmeTexte {
  const par = d.parameter; const name = kapitalCName(d.kunde);
  const FT = par.fastTrackWahl; const DK = par.datenVomKunden;
  const zahlweg = par.zahlungszielTage > 0 ? `per Überweisung ${kapitalCZahlbar(par.zahlungszielTage)}` : "sofort per Überweisung";
  const BT = kapitalCBestandTexte(d);
  return {
    auge: "Ihr Auftrag",
    titel: "Auftrag erteilen",
    sub: BT ? BT.annahmeSub : FT || DK ? `${DK ? "Ihre Angaben, " : ""}Laufzeit, Name, ${FT ? "Ihre Wahl zum Fast-Track, ein Haken" : "ein Haken"} und Ihre Unterschrift — dann ist alles auf dem Weg.` : "Laufzeit, Name, ein Haken und Ihre Unterschrift — dann ist alles auf dem Weg.",
    laufzeit: KAPITAL_C_LAUFZEIT_LABEL, laufzeitAendern: "ändern",
    rateZeile: "Monatsrate {rate} (Rechenbeispiel)",
    name: "Ihre Gesellschaft", nameAendern: "ändern",
    gelesen: KAPITAL_C_GELESEN_TEXT,
    gelesenVorsatz: "Mit Ihrer Unterschrift bestätigen Sie:",
    gelesenLinks: { vertrag: "Vertrag", informationen: "Informationen vor Vertragsschluss", widerruf: "Widerrufsbelehrung" },
    sofort: FT || BT ? KAPITAL_C_SOFORT_TEXT_WAHL : KAPITAL_C_SOFORT_TEXT,
    // Sein Grund ohne Projekt und Termin (Justin 27.10.2026, 17:40): unser Ziel, die Auszahlung in Woche vier.
    sofortUnter: BT ? BT.sofortUnter : FT ? "Wir beginnen sofort mit Ihrem Zahlungseingang — mit und ohne Fast-Track. Dafür brauchen wir diese ausdrückliche Bestätigung; ohne sie dürften wir erst nach Ablauf der Widerrufsfrist beginnen. Ohne den Haken können Sie das Angebot deshalb nicht annehmen." : `Dieses Angebot gibt es nur mit Fast-Track: Ohne diesen Haken dürften wir erst nach Ablauf der Widerrufsfrist beginnen — für unser Ziel, die Auszahlung in Woche ${zahlwort(par.zielWochen)}, zählt aber jede Woche. Ohne den Haken können Sie das Angebot deshalb nicht annehmen.`,
    unterschrift: {
      titel: "Ihre Unterschrift",
      sub: "Zeichnen Sie mit Finger oder Maus — oder tippen Sie Ihren Namen.",
      zeichnen: "Zeichnen", tippen: "Namen tippen", neu: "Neu", platz: "Hier unterschreiben",
      tippenFeld: "Ihr Name", tippenHinweis: `Vor- und Nachname, wie im Vertrag: ${name}`,
      vorschau: "So steht Ihre Unterschrift im Vertrag",
      fehlt: "Bitte unterschreiben Sie — zeichnen oder Namen tippen.",
      fehltName: `Bitte tippen Sie Ihren Namen mit Nachnamen (${String(d.kunde.nachname ?? "").trim()}).`,
    },
    knopf: KAPITAL_KNOPF,
    knopfSendet: "Ihr Auftrag wird übermittelt …",
    unterKnopf: `Mit dem Klick erteilen Sie den Auftrag. Fällig mit Ihrem Auftrag: ${kapitalCEur(kapitalCHeuteCents(par))} — ${par.zahlungszielTage > 0 ? `per Überweisung ${kapitalCZahlbar(par.zahlungszielTage)}` : "sofort per Überweisung"}. Ihren Vertrag als PDF und die Rechnung erhalten Sie per E-Mail.`,
    gesperrt: "Dieses Angebot wird gerade vervollständigt. Ihr Ansprechpartner gibt Ihnen Bescheid, sobald Sie es annehmen können.",
    leserKnopf: "Zur Annahme",
    leserSatz: BT ? BT.leserSatz : FT ? "Angenommen wird unten auf der Seite — mit Ihrer Wahl zum Fast-Track, einem Haken und Ihrer Unterschrift. Der Knopf bringt Sie direkt dorthin." : "Angenommen wird unten auf der Seite — mit einem Haken für den Fast-Track und Ihrer Unterschrift. Der Knopf bringt Sie direkt dorthin.",
    ...(FT ? {
      unterKnopfOhne: `Mit dem Klick erteilen Sie den Auftrag. Fällig mit Ihrem Auftrag: ${kapitalCEur(kapitalCHeuteCents(par, false))} — ${zahlweg}. Ihren Vertrag als PDF und die Rechnung erhalten Sie per E-Mail.`,
      fehltFastTrack: KAPITAL_C_ANNAHME.fehltFastTrack,
    } : {}),
    ...(DK ? { angabenFehlen: KAPITAL_C_ANNAHME.angabenFehlen } : {}),
  };
}
export const KAPITAL_C_ANNAHME = {
  fehltLaufzeit: "Bitte wählen Sie Ihre Laufzeit.",
  fehltGelesen: "Bitte bestätigen Sie, dass Sie Vertrag, Informationen und Widerrufsbelehrung gelesen haben.",
  fehltSofort: "Dieses Angebot gibt es nur mit Fast-Track — bitte bestätigen Sie, dass wir vor Ablauf der Widerrufsfrist beginnen.",
  // E-474 (fastTrackWahl / datenVomKunden)
  fehltFastTrack: "Bitte wählen Sie: mit oder ohne Fast-Track.",
  fehltSofortWahl: "Bitte bestätigen Sie, dass wir sofort — vor Ablauf der Widerrufsfrist — beginnen. Ohne diese Bestätigung können Sie das Angebot nicht annehmen.",
  angabenFehlen: "Bitte tragen Sie zuerst oben Ihre Angaben für den Vertrag ein — dann können Sie unterschreiben.",
  neuLaden: "Das Angebot wurde inzwischen geändert — bitte laden Sie die Seite neu und lesen Sie die aktuelle Fassung.",
  fertigTitel: (gruss: string) => `Willkommen bei FIAON Global, ${gruss}.`,
  fertigText: (email: string, llc: string, laufzeit: string) => `Ihr Auftrag steht: ${llc}, Laufzeit ${laufzeit}. Ihren Vertrag als PDF und die Rechnung schicken wir Ihnen an ${email}. Mit Ihrem Zahlungseingang beginnen wir — und die Frist Ihrer ${KAPITAL_C_GARANTIE_NAME} läuft.`,
  fertigZahlung: (betrag: string, fastTrack = true, bestand = false) => bestand ? `Fällig mit Ihrem Auftrag: ${betrag} für die Übernahme Ihrer Gesellschaft, Konto und Karten.` : `Fällig mit Ihrem Auftrag: ${betrag} für Gründung, Konto und Karten${fastTrack ? " sowie Fast-Track" : ""}.`,
  fertigFuss: "Fragen? Ihr Ansprechpartner ist für Sie da — oder schreiben Sie uns an support@fiaon.com.",
  /** Runde 2: der Fuß nach der Annahme mit dem Ansprechpartner aus dem Angebot (Name, Telefon, E-Mail). */
  fertigFussMit: (p: { name: string; telefon: string; email: string }) => `Fragen? ${p.name} ist für Sie da: ${p.telefon} · ${p.email}.`,
  fertigZweck: (zweck: string) => `Verwendungszweck: ${zweck}`,
  fertigDateien: { vertrag: "Vertrag mit Widerrufsbelehrung (PDF)", rechnung: (betrag: string) => `Rechnung über ${betrag} (PDF)` },
  fertigKnopf: "Zur Zahlungsseite", fertigMeinAuftrag: "Zu „Mein Auftrag“", fertigAnsprech: "Ihr Ansprechpartner",
  fertigAuge: "FIAON Global · Ihr Auftrag",
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// DIE VERTRAGSBESTÄTIGUNG (§ 312f Abs. 2, § 312i Abs. 1 Nr. 3 BGB) — automatisch direkt nach der Annahme
// Der Vertrag mit Annahmevermerk, Widerrufsbelehrung und Formular als PDF plus Rechnung, auf einem dauerhaften Datenträger, BEVOR
// FIAON beginnt (Beginn = Zahlungseingang). Bewusste Ausnahme zu E-301 („keine automatische Mail an Firmenkunden“): Fassung C
// schließt mit einem Verbraucher, die Bestätigung ist Pflicht — wie die Zugangs-Einladung E-423 transaktional, keine Werbung.
// Versand: server/lib/fiaon-global-angebot-kapital-c.ts (kapitalCVertragsbestaetigung), Absender welcome@.
// ═══════════════════════════════════════════════════════════════════════════
export const KAPITAL_C_BESTAETIGUNG = {
  betreff: (ref: string) => `Ihr Vertrag mit FIAON Global — Bestätigung und Unterlagen (${ref})`,
  preheader: "Ihr Vertrag als PDF — mit Widerrufsbelehrung, Muster-Widerrufsformular und Ihrer Rechnung.",
  titel: "Ihre Vertragsbestätigung",
  // E-474: `fastTrack` false = ohne Fast-Track gewählt (nur bei fastTrackWahl), `reisepass` = der Reisepass fehlt noch (datenVomKunden).
  // Ohne beide Angaben wortgleich wie bisher.
  // E-487: `tempoFassung` = die des Vertrags (parameter.tempoFassung). Gesetzt → mit Fast-Track der Vorrang statt „72 Stunden“; leer
  // (vor E-487 angenommen, „Auftragsmail nachholen“) → wortgleich wie damals. Nachbesserung (Gutachten): PFLICHT — fehlte sie still,
  // bekäme jeder neue Fast-Track-Vertrag „72 Stunden“. Der Server baut die Absätze über kapitalCBestaetigungAbsaetze (rein, Prüfstand).
  absaetze: (ein: { anrede: string; angenommen: string; llc: string; fastTrack?: boolean; reisepass?: boolean; tempoFassung: string; bestand?: boolean }) => [
    `${ein.anrede}, vielen Dank für Ihr Vertrauen. Hiermit bestätigen wir Ihren Vertrag mit FIAON Global, den Sie am ${ein.angenommen} angenommen haben — mit Ihrer Gesellschaft ${ein.llc}.`,
    ein.bestand ? "Im Anhang finden Sie Ihren Vertrag mit Annahmevermerk, der Widerrufsbelehrung und dem Muster-Widerrufsformular sowie die Rechnung über die Übernahme Ihrer Gesellschaft, Konto und Karten."
      : ein.fastTrack === false
      ? "Im Anhang finden Sie Ihren Vertrag mit Annahmevermerk, der Widerrufsbelehrung und dem Muster-Widerrufsformular sowie die Rechnung über Gründung, Konto und Karten."
      : "Im Anhang finden Sie Ihren Vertrag mit Annahmevermerk, der Widerrufsbelehrung und dem Muster-Widerrufsformular sowie die Rechnung über Gründung, Konto und Karten und den Fast-Track.",
    // E-475: mit fastTrackWahl beginnt FIAON in beiden Fällen sofort — der Satz nennt das Tempo der Wahl.
    ein.fastTrack === false
      ? `Sie können den Vertrag binnen vierzehn Tagen ohne Angabe von Gründen widerrufen; die Einzelheiten stehen in der Widerrufsbelehrung im Anhang. Sie haben verlangt, dass wir schon vor Ablauf der Widerrufsfrist beginnen: Wir beginnen mit Ihrem Zahlungseingang, und widerrufen Sie danach, zahlen Sie für die bis dahin erbrachten Leistungen einen angemessenen Betrag. Ihre Gesellschaft, EIN und ITIN stehen in ${KAPITAL_C_TEMPO.ohne}.`
      : ein.fastTrack === true && ein.tempoFassung
      ? "Sie können den Vertrag binnen vierzehn Tagen ohne Angabe von Gründen widerrufen; die Einzelheiten stehen in der Widerrufsbelehrung im Anhang. Sie haben verlangt, dass wir schon vor Ablauf der Widerrufsfrist beginnen: Wir beginnen mit Ihrem Zahlungseingang, und widerrufen Sie danach, zahlen Sie für die bis dahin erbrachten Leistungen einen angemessenen Betrag. Mit dem Fast-Track bearbeiten wir Ihren Auftrag in allen Schritten mit Vorrang (Ziffer 2 Absatz 3 Ihres Vertrags)."
      : ein.fastTrack === true
      ? `Sie können den Vertrag binnen vierzehn Tagen ohne Angabe von Gründen widerrufen; die Einzelheiten stehen in der Widerrufsbelehrung im Anhang. Sie haben verlangt, dass wir schon vor Ablauf der Widerrufsfrist beginnen: Wir beginnen mit Ihrem Zahlungseingang, und widerrufen Sie danach, zahlen Sie für die bis dahin erbrachten Leistungen einen angemessenen Betrag. Mit dem Fast-Track stehen Ihre Gesellschaft und EIN in ${KAPITAL_C_TEMPO.mit}; ${KAPITAL_C_TEMPO.itin.replace(/^Die/, "die")}`
      : "Sie können den Vertrag binnen vierzehn Tagen ohne Angabe von Gründen widerrufen; die Einzelheiten stehen in der Widerrufsbelehrung im Anhang. Sie haben verlangt, dass wir schon vor Ablauf der Widerrufsfrist beginnen" + (ein.bestand ? "" : " (Fast-Track)") + ": Wir beginnen mit Ihrem Zahlungseingang, und widerrufen Sie danach, zahlen Sie für die bis dahin erbrachten Leistungen einen angemessenen Betrag.",
    ...(ein.reisepass ? ["Bitte laden Sie noch Ihren Reisepass hoch (Seite mit Foto) — in „Mein Auftrag“ oder auf Ihrer Angebotsseite. Mit Anmeldungen und Anträgen beginnen wir, sobald er vorliegt (Ziffer 7 Ihres Vertrags)."] : []),
  ],
  // E-432 (28.10.2026): `sofort` = Zahlungsziel null Tage — dann „Zahlbar: sofort“ statt eines Datums.
  daten: (ein: { ref: string; llc: string; laufzeit: string; heute: string; zweck: string | null; faellig: string | null; sofort?: boolean }) => [
    { label: "Angebot", wert: ein.ref },
    { label: "Ihre Gesellschaft", wert: ein.llc },
    { label: KAPITAL_C_LAUFZEIT_LABEL, wert: ein.laufzeit },
    { label: "Fällig mit Ihrem Auftrag", wert: ein.heute },
    ...(ein.zweck ? [{ label: "Verwendungszweck", wert: ein.zweck }] : []),
    ...(ein.sofort ? [{ label: "Zahlbar", wert: "sofort" }] : ein.faellig ? [{ label: "Zahlbar bis", wert: ein.faellig }] : []),
  ],
  knopf: "Zur Zahlungsseite",
  knopf2: "Zu „Mein Auftrag“",
  fussnote: `Ihre ${KAPITAL_C_GARANTIE_NAME} steht in Ziffer 4 Ihres Vertrags.`,
} as const;
/**
 * E-487 (09.11.2026, Gutachten): die Absätze der Vertragsbestätigung aus den gelesenen Daten des angenommenen Vertrags — EINE reine
 * Funktion für den Versand (kapitalCVertragsbestaetigung) und den Prüfstand. Die Wahl (Fast-Track) aus dem Annahmevermerk, die
 * Tempo-Fassung aus den Parametern (kapitalCDatenAus), die Reisepass-Bitte nur mit Angaben vom Kunden und fehlendem Pass.
 */
export function kapitalCBestaetigungAbsaetze(d: { kunde: Pick<KapitalCKunde, "anrede" | "vorname" | "nachname">; parameter: Pick<KapitalCParameter, "fastTrackWahl" | "datenVomKunden" | "tempoFassung"> & Partial<Pick<KapitalCParameter, "bestand">> },
  ein: { wahl: { fastTrack?: boolean } | null; angenommen: string; llc: string; reisepassFehlt: boolean }): string[] {
  const par = d.parameter;
  return KAPITAL_C_BESTAETIGUNG.absaetze({
    anrede: kapitalCAnrede(d.kunde), angenommen: ein.angenommen, llc: ein.llc,
    ...(par.fastTrackWahl ? { fastTrack: kapitalCMitFastTrack(par, ein.wahl) } : {}),
    ...(par.datenVomKunden && ein.reisepassFehlt ? { reisepass: true } : {}),
    tempoFassung: par.tempoFassung,
    ...(par.bestand ? { bestand: true } : {}),
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// PARAMETER, KUNDE, PFLICHTFELDER (rein — Skript und Server prüfen dasselbe)
// ═══════════════════════════════════════════════════════════════════════════
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const textAus = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
export function kapitalCParameterAus(roh: Partial<KapitalCParameter> | null | undefined, basis: KapitalCParameter = KAPITAL_C_VORGABEN): KapitalCParameter {
  // E-505: Mit Regler (rahmenWahl) folgen Betrag und Erfolgshonorar IMMER dem Stand des Reglers — auch nach jedem Einlesen.
  const roh0 = kapitalCParameterRoh(roh, basis);
  // E-506: bestehende Gesellschaft — ein Preis ohne Fast-Track, und der Bundesstaat ist der der Gesellschaft.
  const aus = roh0.bestand ? { ...roh0, fastTrackWahl: false, fastTrackCents: 0, bundesstaat: roh0.bestand.bundesstaat } : roh0;
  return aus.rahmenWahl ? kapitalCRahmenAnwenden(aus, aus.rahmenWahl.gewaehltUsd) : aus;
}
function kapitalCParameterRoh(roh: Partial<KapitalCParameter> | null | undefined, basis: KapitalCParameter): KapitalCParameter {
  const r = (roh ?? {}) as Record<string, unknown>;
  const zahl = (key: keyof KapitalCParameter, min: number, max: number, ganz = true): number => {
    const v = Number(r[key]);
    return Number.isFinite(v) && v >= min && v <= max ? (ganz ? Math.round(v) : v) : (basis[key] as number);
  };
  const pr = (r.projekt && typeof r.projekt === "object" ? r.projekt : {}) as Record<string, unknown>;
  const bp = basis.projekt;
  const unterlagen = Array.isArray(r.unterlagen)
    ? (r.unterlagen as any[]).slice(0, 12).map((u) => ({ titel: textAus(u?.titel, 120), am: ISO.test(String(u?.am ?? "")) ? String(u.am) : "" })).filter((u) => u.titel)
    : basis.unterlagen;
  const ap = Array.isArray(r.ansprechpartner) ? (r.ansprechpartner as unknown[]).map(String).filter((kz) => ANGEBOT_ANSPRECHPARTNER.some((x) => x.kuerzel === kz)).slice(0, 3) : basis.ansprechpartner;
  const minJ = zahl("laufzeitMinJahre", 1, 30); const maxJ = Math.max(minJ, zahl("laufzeitMaxJahre", 1, 30));
  const vorschlag = zahl("laufzeitVorschlagJahre", 1, 30);
  return {
    gruendungCents: zahl("gruendungCents", 10_000, 10_000_000),
    fastTrackCents: zahl("fastTrackCents", 0, 1_000_000),
    erfolgCents: zahl("erfolgCents", 0, 10_000_000),
    jahresCents: zahl("jahresCents", 0, 1_000_000),
    zahlungszielTage: zahl("zahlungszielTage", 0, 30),
    betragCents: zahl("betragCents", 100_000, 10_000_000_000),
    kursUsdJeEur: zahl("kursUsdJeEur", 0.5, 2.5, false),
    kursDatum: ISO.test(String(r.kursDatum ?? "")) ? String(r.kursDatum) : basis.kursDatum,
    ratenfreiMonate: zahl("ratenfreiMonate", 0, 24),
    zinsfreiMonate: zahl("zinsfreiMonate", 0, 60),
    zinsStartBp: zahl("zinsStartBp", 0, 3_000),
    zinsSchrittBp: zahl("zinsSchrittBp", 0, 1_000),
    laufzeitMinJahre: minJ,
    laufzeitMaxJahre: maxJ,
    laufzeitVorschlagJahre: Math.min(maxJ, Math.max(minJ, vorschlag)),
    aufstockungAbMonat: zahl("aufstockungAbMonat", 1, 99),
    projekt: {
      art: textAus(pr.art, 60) || bp.art,
      wo: textAus(pr.wo, 100) || bp.wo,
      woKurz: textAus(pr.woKurz, 60) || bp.woKurz,
      bezahltProzent: Number.isFinite(Number(pr.bezahltProzent)) && Number(pr.bezahltProzent) >= 0 && Number(pr.bezahltProzent) <= 100 ? Math.round(Number(pr.bezahltProzent)) : bp.bezahltProzent,
      fertigstellung: ISO.test(String(pr.fertigstellung ?? "")) ? String(pr.fertigstellung) : bp.fertigstellung,
    },
    garantieWochen: zahl("garantieWochen", 1, 52),
    erstattungTage: zahl("erstattungTage", 1, 60),
    zielWochen: zahl("zielWochen", 1, 52),
    bundesstaat: staatName(textAus(r.bundesstaat, 40) || basis.bundesstaat),
    staatenFassung: typeof r.staatenFassung === "string" ? textAus(r.staatenFassung, 20) : basis.staatenFassung,
    buergschaftMonate: zahl("buergschaftMonate", 1, 240),
    buerginAktiv: typeof r.buerginAktiv === "boolean" ? r.buerginAktiv : basis.buerginAktiv,
    buerginStandAm: ISO.test(String(r.buerginStandAm ?? "")) ? String(r.buerginStandAm) : basis.buerginStandAm,
    unterschriftFrei: typeof r.unterschriftFrei === "boolean" ? r.unterschriftFrei : basis.unterschriftFrei,
    begleitMonate: zahl("begleitMonate", 1, 60),
    unterlagen,
    ddAbgeschlossen: typeof r.ddAbgeschlossen === "boolean" ? r.ddAbgeschlossen : basis.ddAbgeschlossen,
    ansprechpartner: ap.length ? ap : basis.ansprechpartner,
    // Dieselben Regeln wie Fassung A/B (kapitalTeamAus): nur bestätigte, höchstens zwanzig; ohne team bleibt das bisherige.
    team: kapitalTeamAus(r.team, basis.team),
    // E-474: nur echte Wahrheitswerte schalten — alles andere behält die Basis (Vorgabe false: Bestand wie bisher).
    datenVomKunden: typeof r.datenVomKunden === "boolean" ? r.datenVomKunden : basis.datenVomKunden,
    fastTrackWahl: typeof r.fastTrackWahl === "boolean" ? r.fastTrackWahl : basis.fastTrackWahl,
    // E-487: nur ein Text schaltet — fehlt er, gilt die Basis (Vorgabe leer = Bestand). Offene Angebote setzt kapitalCTempoFassungAus.
    tempoFassung: typeof r.tempoFassung === "string" ? textAus(r.tempoFassung, 20) : basis.tempoFassung,
    // E-491: nur ein gültiger Vorschlag erzeugt den Schlüssel; ohne ihn bleibt das Objekt wie im Bestand.
    ...(() => { const v = r.llcVorschlag !== undefined ? kapitalCLlcVorschlagAus(r.llcVorschlag) : (basis.llcVorschlag ?? null); return v ? { llcVorschlag: v } : {}; })(),
    // E-505: nur eine gültige Regler-Vorgabe erzeugt den Schlüssel (null in der Datei nimmt ihn wieder weg); ohne ihn wie im Bestand.
    ...(() => { const v = r.rahmenWahl !== undefined ? kapitalCRahmenWahlAus(r.rahmenWahl, basis.rahmenWahl) : (basis.rahmenWahl ?? null); return v ? { rahmenWahl: v } : {}; })(),
    // E-506: nur eine gültige Vorgabe erzeugt den Schlüssel (null in der Datei nimmt ihn weg); ohne ihn wie im Bestand.
    ...(() => { const v = r.bestand !== undefined ? kapitalCBestandAus(r.bestand) : (basis.bestand ?? null); return v ? { bestand: v } : {}; })(),
  };
}
/**
 * E-487 (09.11.2026): die Parameter eines NEUEN Angebots — Staaten-Wahl (E-465, neuesAngebotParameter) und die aktuelle Tempo-Fassung.
 * Server (kapitalCAnlegen) und Skript (Vorschau in scripts/angebot-kapital-anlegen.ts) lesen dieselbe Quelle.
 */
export function kapitalCNeuesAngebotParameter(roh: Partial<KapitalCParameter> | null | undefined): KapitalCParameter {
  return { ...kapitalCParameterAus(neuesAngebotParameter<Partial<KapitalCParameter>>(roh)), tempoFassung: KAPITAL_C_TEMPO_FASSUNG };
}
export function kapitalCParameterFehler(par: KapitalCParameter): string | null {
  if (!par.gruendungCents) return "Preis der Gründung fehlt.";
  if (!par.bundesstaat) return "Bundesstaat fehlt.";
  const sf = par.bestand ? null : angebotStaatFehler(par.bundesstaat, par.staatenFassung);
  if (sf) return sf;
  if (par.zielWochen > par.garantieWochen) return "Das Ziel liegt hinter der Garantiefrist.";
  if (par.laufzeitMinJahre > par.laufzeitMaxJahre) return "Laufzeit: kürzeste über längster.";
  if (par.laufzeitMaxJahre * 12 + par.ratenfreiMonate > 99 * 12) return "Laufzeit zu lang.";
  return null;
}
/**
 * E-474: wie streng? `nurKontakt` = beim Anlegen mit datenVomKunden (Anrede, Name, E-Mail genügen; die übrigen Felder bleiben leer),
 * `ohneAusweis` = Vertrag mit datenVomKunden (Geburtsdatum und Anschrift Pflicht, Ausweis nicht — der Reisepass kommt nach der Annahme).
 * Ohne Angabe: streng wie bisher (Bestand).
 */
export interface KapitalCKundeStrenge { nurKontakt?: boolean; ohneAusweis?: boolean }
/** Die Strenge, die zum Angebot gehört: mit datenVomKunden ohne Ausweis, sonst wie bisher. */
export function kapitalCKundeStrenge(par: Pick<KapitalCParameter, "datenVomKunden">): KapitalCKundeStrenge {
  return par.datenVomKunden ? { ohneAusweis: true } : {};
}
/** Der Kunde aus der privaten Datei — bereinigt, oder der erste Fehler. Geprüft wird, was im Vertrag steht. */
export function kapitalCKundePruefen(roh: any, strenge: KapitalCKundeStrenge = {}): { ok: true; kunde: KapitalCKunde } | { ok: false; error: string } {
  const land = String(roh?.land ?? "DE").toUpperCase() as KapitalCLand;
  if (!["DE", "AT", "CH"].includes(land)) return { ok: false, error: "Land: Deutschland, Österreich oder Schweiz." };
  const ausweise: KapitalCAusweis[] = Array.isArray(roh?.ausweise)
    ? (roh.ausweise as any[]).slice(0, 3).map((a) => ({
      art: a?.art === "personalausweis" ? "personalausweis" as const : "reisepass" as const,
      nummer: textAus(a?.nummer, 20).toUpperCase().replace(/\s+/g, ""),
      gueltigBis: ISO.test(String(a?.gueltigBis ?? "")) ? String(a.gueltigBis) : "",
      behoerde: textAus(a?.behoerde, 80),
    }))
    : [];
  const kunde: KapitalCKunde = {
    art: "privat",
    anrede: ["Herr", "Frau"].includes(String(roh?.anrede)) ? (String(roh.anrede) as "Herr" | "Frau") : "",
    vorname: textAus(roh?.vorname, 80), nachname: textAus(roh?.nachname, 80),
    geburtsdatum: ISO.test(String(roh?.geburtsdatum ?? "")) ? String(roh.geburtsdatum) : "",
    geburtsort: textAus(roh?.geburtsort, 80), staatsangehoerigkeit: textAus(roh?.staatsangehoerigkeit, 40).toLowerCase(),
    strasse: textAus(roh?.strasse, 160), plz: textAus(roh?.plz, 10), ort: textAus(roh?.ort, 120), land,
    email: textAus(roh?.email, 160).toLowerCase(), telefon: textAus(roh?.telefon, 40),
    ausweise,
  };
  if (!kunde.vorname || !kunde.nachname) return { ok: false, error: "Vorname und Nachname fehlen." };
  if (strenge.nurKontakt) {
    if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(kunde.email)) return { ok: false, error: "E-Mail-Adresse ungültig." };
    return { ok: true, kunde };
  }
  if (!kunde.geburtsdatum) return { ok: false, error: "Geburtsdatum fehlt (JJJJ-MM-TT)." };
  if (kunde.strasse.length < 3 || !kunde.ort) return { ok: false, error: "Anschrift unvollständig." };
  if (!(land === "DE" ? /^\d{5}$/ : /^\d{4}$/).test(kunde.plz)) return { ok: false, error: "Postleitzahl passt nicht zum Land." };
  if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(kunde.email)) return { ok: false, error: "E-Mail-Adresse ungültig." };
  if (!ausweise.length && !strenge.ohneAusweis) return { ok: false, error: "Mindestens ein Ausweisdokument fehlt." };
  for (const a of ausweise) {
    if (!/^[A-Z0-9]{6,12}$/.test(a.nummer)) return { ok: false, error: `${AUSWEIS_NAME[a.art]}: Nummer ungültig.` };
    if (!a.gueltigBis || !a.behoerde) return { ok: false, error: `${AUSWEIS_NAME[a.art]}: Gültigkeit oder Behörde fehlt.` };
  }
  return { ok: true, kunde };
}
/**
 * E-474: Was der Kunde auf seiner Angebotsseite eingibt (POST …/kapital-angaben) — Name (vorbelegt, korrigierbar), Geburtsdatum,
 * Anschrift; Geburtsort und Staatsangehörigkeit freiwillig. KEIN Ausweis (der Reisepass kommt nach der Unterschrift), die E-Mail
 * bleibt die des Angebots. Strenger als kapitalCKundePruefen (volljährig, kein Datum in der Zukunft) — gerufen nur von dieser Route.
 * `feld` sagt der Seite, an welches Feld der Hinweis gehört.
 */
export type KapitalCAngabenFeld = "vorname" | "nachname" | "geburtsdatum" | "geburtsort" | "staatsangehoerigkeit" | "strasse" | "plz" | "ort" | "land";
export function kapitalCAngabenPruefen(alt: KapitalCKunde, roh: any, heute: string): { ok: true; kunde: KapitalCKunde } | { ok: false; error: string; feld: KapitalCAngabenFeld } {
  const nein = (feld: KapitalCAngabenFeld, error: string) => ({ ok: false as const, error, feld });
  const land = String(roh?.land ?? "").toUpperCase();
  if (!["DE", "AT", "CH"].includes(land)) return nein("land", "Bitte wählen Sie Deutschland, Österreich oder die Schweiz.");
  const neu = {
    ...alt,
    vorname: textAus(roh?.vorname, 80), nachname: textAus(roh?.nachname, 80),
    geburtsdatum: String(roh?.geburtsdatum ?? "").trim(), geburtsort: textAus(roh?.geburtsort, 80),
    staatsangehoerigkeit: textAus(roh?.staatsangehoerigkeit, 40).toLowerCase(),
    strasse: textAus(roh?.strasse, 160), plz: textAus(roh?.plz, 10), ort: textAus(roh?.ort, 120), land: land as KapitalCLand,
  };
  if (neu.vorname.length < 2) return nein("vorname", "Bitte Ihren Vornamen eintragen.");
  if (neu.nachname.length < 2) return nein("nachname", "Bitte Ihren Nachnamen eintragen.");
  if (!ISO.test(neu.geburtsdatum)) return nein("geburtsdatum", "Bitte Ihr Geburtsdatum eintragen.");
  const [j, m, t] = neu.geburtsdatum.split("-").map(Number);
  const echt = new Date(Date.UTC(j, m - 1, t));
  if (echt.getUTCFullYear() !== j || echt.getUTCMonth() !== m - 1 || echt.getUTCDate() !== t || j < 1900) return nein("geburtsdatum", "Dieses Geburtsdatum gibt es nicht — bitte prüfen.");
  const volljaehrigAb = `${String(j + 18).padStart(4, "0")}-${neu.geburtsdatum.slice(5)}`;
  if (volljaehrigAb > heute) return nein("geburtsdatum", "Den Vertrag können nur Volljährige schließen — bitte prüfen Sie Ihr Geburtsdatum.");
  if (neu.staatsangehoerigkeit && !/^[a-zäöüß]{4,30}(-[a-zäöüß]{4,30})?$/.test(neu.staatsangehoerigkeit)) return nein("staatsangehoerigkeit", "Bitte so eintragen, wie im Satz „… Staatsangehörige(r)“, z. B. deutsch.");
  if (neu.strasse.length < 3) return nein("strasse", "Bitte Straße und Hausnummer eintragen.");
  if (!/\d/.test(neu.strasse)) return nein("strasse", "Bitte noch die Hausnummer ergänzen.");
  if (!(land === "DE" ? /^\d{5}$/ : /^\d{4}$/).test(neu.plz)) return nein("plz", land === "DE" ? "Die Postleitzahl hat in Deutschland fünf Ziffern." : "Die Postleitzahl hat hier vier Ziffern.");
  if (neu.ort.length < 2) return nein("ort", "Bitte den Ort eintragen.");
  // Zum Schluss dieselbe Prüfung wie der Vertrag (ohne Ausweis) — nichts kommt durch, was die Annahme später sperren würde.
  const k = kapitalCKundePruefen(neu, { ohneAusweis: true });
  if (!k.ok) return nein("strasse", k.error);
  return { ok: true, kunde: k.kunde };
}
/** E-474: Fehlen die Angaben, die der Kunde selbst einträgt? Nur bei datenVomKunden — sonst immer false. */
export function kapitalCAngabenFehlen(d: Pick<KapitalCDaten, "kunde" | "parameter">): boolean {
  return d.parameter.datenVomKunden && !kapitalCKundePruefen(d.kunde, { ohneAusweis: true }).ok;
}
/** E-474: Texte des Schritts „Ihre Angaben für den Vertrag“ (vor der Unterschrift) — Kunden gesiezt, wenig Text. */
export const KAPITAL_C_ANGABEN = {
  auge: "Ihre Angaben",
  titel: "Ihre Angaben für den Vertrag",
  sub: "Für Ihren Vertrag und die gesetzlich vorgeschriebene Identifizierung. Ihren Reisepass laden Sie erst nach der Unterschrift hoch.",
  felder: {
    vorname: "Vorname", nachname: "Nachname", geburtsdatum: "Geburtsdatum", geburtsort: "Geburtsort", staatsangehoerigkeit: "Staatsangehörigkeit",
    strasse: "Straße und Hausnummer", plz: "PLZ", ort: "Ort", land: "Land",
  },
  freiwillig: "freiwillig",
  staatPlatz: "z. B. deutsch",
  staatVorschlaege: ["deutsch", "österreichisch", "schweizerisch"],
  laender: [{ wert: "DE", text: "Deutschland" }, { wert: "AT", text: "Österreich" }, { wert: "CH", text: "Schweiz" }],
  strassePlatz: "Einfach lostippen — PLZ und Ort ergänzen sich",
  selbst: "Lieber selbst eingeben",
  quelle: "Vorschläge aus OpenStreetMap · Sie können jederzeit selbst weitertippen",
  datenschutz: "Ihre Angaben stehen nur in Ihrem Vertrag und in Ihrer Akte bei uns — nie öffentlich.",
  datenschutzLink: "Datenschutzerklärung",
  knopf: "Angaben übernehmen", sendet: "Wird gespeichert …",
  fertig: "In Ihrem Vertrag", aendern: "ändern", abbrechen: "abbrechen",
  gespeichert: "Danke — Ihre Angaben stehen jetzt in Ihrem Vertrag.",
  fehler: "Ihre Angaben ließen sich gerade nicht speichern — bitte versuchen Sie es noch einmal.",
  geboren: "geboren am", in: "in",
} as const;
/** E-474: der Schritt direkt NACH der Annahme — der Reisepass (datenVomKunden). Hochladen über die Angebotsseite in die Akte. */
export const KAPITAL_C_REISEPASS = {
  auge: "Nächster Schritt",
  titel: "Ihr Reisepass",
  text: "Für die gesetzliche Identifizierung brauchen wir Ihren Reisepass (Seite mit Foto). Sobald er da ist, melden wir Ihre Gesellschaft an.",
  knopf: "Reisepass hochladen", sendet: "Wird hochgeladen …", erlaubt: "PDF, JPG oder PNG, bis 15 MB.",
  fertig: "Danke — Ihr Reisepass ist bei uns angekommen.", weitere: "Weitere Seite hochladen",
  spaeter: "Sie können ihn auch später in „Mein Auftrag“ hochladen.",
  falscherTyp: "Diese Datei können wir nicht annehmen. Möglich sind PDF, JPG und PNG.",
  zuGross: "Die Datei ist größer als 15 MB. Bitte speichern Sie sie kleiner.",
} as const;
export function kapitalCBuerginFehler(b: Partial<KapitalBuergin> | null | undefined): string | null {
  if (!b || !b.name || !b.bundesstaat || !b.registernummer || !b.anschrift || !b.vertreter || !b.funktion) return "Angaben zur Bürgin (Name, Bundesstaat, Registernummer, Anschrift, Vertreter, Funktion)";
  return null;
}
export function kapitalCPflichtFehlen(d: Pick<KapitalCDaten, "kunde" | "parameter" | "buergin">): string[] {
  const fehlt: string[] = [];
  // E-474: mit datenVomKunden ohne Ausweis (der Reisepass kommt nach der Annahme); sonst streng wie bisher.
  const k = kapitalCKundePruefen(d.kunde, kapitalCKundeStrenge(d.parameter));
  if (!k.ok) fehlt.push(`Auftraggeber: ${k.error}`);
  const pf = kapitalCParameterFehler(d.parameter); if (pf) fehlt.push(pf);
  const bf = kapitalCBuerginFehler(d.buergin); if (bf) fehlt.push(bf);
  if (!d.parameter.unterschriftFrei) fehlt.push("Freigabe zur Unterschrift (Justins GO) — Parameter unterschriftFrei");
  return fehlt;
}
export function kapitalCAnsprechpartner(par: Pick<KapitalCParameter, "ansprechpartner">): { kuerzel: string; name: string; rolle: string; email: string; telefon: string }[] {
  const aus = par.ansprechpartner.map((kz) => ANGEBOT_ANSPRECHPARTNER.find((x) => x.kuerzel === kz)).filter(Boolean) as { kuerzel: string; name: string; rolle: string; email: string; telefon: string }[];
  return aus.length ? aus : ANGEBOT_ANSPRECHPARTNER.filter((x) => x.kuerzel === "justin");
}

// ═══════════════════════════════════════════════════════════════════════════
// NACH DER ANNAHME — Rechnung Teil 2, „Mein Auftrag“, Aufgaben, Fristwarnung (rein, Texte nach Fassung C)
// ═══════════════════════════════════════════════════════════════════════════
/** Teil 2 = Erfolgshonorar bei Eintragung (Chefbüro-Knopf „Gesellschaft eingetragen“). Fassung C kennt keinen Teil 3. */
export const KAPITAL_C_TEIL2 = { nr: 2 as const, titel: "Erfolgshonorar", ziffer: "Ziffer 6 Absatz 2", ereignis: "Gesellschaft beim Bundesstaat eingetragen", knopf: "Gesellschaft eingetragen", datumLabel: "Eingetragen am" };
/** E-506: Teil 2 nach dem Angebot — bei einer bestehenden Gesellschaft hängt er an „übernommen und bankfertig“ statt an der Eintragung. */
export function kapitalCTeil2Fuer(par: Pick<KapitalCParameter, "bestand">): { nr: 2; titel: string; ziffer: string; ereignis: string; knopf: string; datumLabel: string } {
  if (par.bestand?.erfolgBei === "buergschaft") return { nr: 2, titel: "Erfolgshonorar", ziffer: "Ziffer 6 Absatz 2", ereignis: "Gesellschaft übernommen, Bürgschaft übernommen", knopf: "Übernommen und Bürgschaft steht", datumLabel: "Bürgschaft am" };
  return par.bestand ? { nr: 2, titel: "Erfolgshonorar", ziffer: "Ziffer 6 Absatz 2", ereignis: "Gesellschaft übernommen und bankfertig", knopf: "Gesellschaft übernommen (bankfertig)", datumLabel: "Bankfertig am" } : KAPITAL_C_TEIL2;
}
/** E-506: die Etappen in „Mein Auftrag“ nach dem Angebot — Etappe 1 heißt bei einer bestehenden Gesellschaft „Ihre Gesellschaft in Ordnung“. */
export function kapitalCEtappenFuer(par: Pick<KapitalCParameter, "bestand"> | null | undefined): Record<1 | 2 | 3 | 4, { titel: string; text: string }> {
  return par?.bestand ? { ...KAPITAL_C_ETAPPEN, 1: { titel: "Ihre Gesellschaft in Ordnung", text: "Prüfung, Berichtigungen, Operating Agreement, US-Adresse, Telefonnummer und Assistenz. Wir bereiten alles vor und reichen ein; Sie unterschreiben, was wir Ihnen fertig zuschicken." } } : KAPITAL_C_ETAPPEN;
}
export const KAPITAL_C_KEIN_TEIL3 = "Fassung C: keine Vergütung bei Auszahlung — das Erfolgshonorar wird mit der Eintragung fällig.";
/**
 * Der zweite Knopf der Fassung C (Route …/kapital/auszahlung): hält die Auszahlung fest — KEINE Rechnung. Er setzt
 * garantie_erfuellt_am; damit enden die Fristwarnungen (kapitalFristSchritt) und „Mein Auftrag“ sagt „Garantie erfüllt“.
 */
export const KAPITAL_C_AUSZAHLUNG = { knopf: "Finanzierung ausgezahlt", datumLabel: "Ausgezahlt am", hinweis: "Ziffer 4: hält die Auszahlung fest — die Garantie ist erfüllt, die Fristwarnungen enden. Keine Rechnung." };
export function kapitalCAuszahlungPruefen(
  lage: { status: string; angenommenAm: string | null; heute: string; garantieErfuelltAm: string | null; erstattungAusgeloest: boolean;
    /** Beginn der Garantiefrist (Zahlung Teil 1) — vorher ist der Knopf zu (Runde 2: ein Fehlklick setzte sonst „Garantie erfüllt“). */
    fristBeginn: string | null }, ein: any,
): { ok: true; daten: { datum: string; beleg: string } } | { ok: false; error: string; schon?: true } {
  if (lage.status !== "angenommen") return { ok: false, error: "Erst nach der Annahme." };
  if (lage.garantieErfuelltAm) return { ok: false, error: `Die Auszahlung ist schon eingetragen (${kapitalTag(lage.garantieErfuelltAm)}).`, schon: true };
  if (lage.erstattungAusgeloest) return { ok: false, error: "Der Garantiefall ist vorgemerkt — die Auszahlung bitte mit der Leitung klären." };
  if (!lage.fristBeginn) return { ok: false, error: "Erst wenn Gründung und Fast-Track bezahlt sind — dann läuft die Frist der Geld-zurück-Garantie (Ziffer 4)." };
  const datum = String(ein?.datum ?? "").trim();
  if (!ISO.test(datum)) return { ok: false, error: `${KAPITAL_C_AUSZAHLUNG.datumLabel}: Datum fehlt (JJJJ-MM-TT).` };
  if (datum > lage.heute) return { ok: false, error: "Das Datum liegt in der Zukunft." };
  if (lage.angenommenAm && datum < lage.angenommenAm) return { ok: false, error: `Das Datum liegt vor der Annahme (${kapitalTag(lage.angenommenAm)}).` };
  if (datum < lage.fristBeginn) return { ok: false, error: `Das Datum liegt vor dem Beginn der Frist (${kapitalTag(lage.fristBeginn)}).` };
  return { ok: true, daten: { datum, beleg: String(ein?.beleg ?? "").replace(/\s+/g, " ").trim().slice(0, 600) } };
}
export function kapitalCTeil2Pruefen(
  lage: { status: string; parameter: Pick<KapitalCParameter, "erfolgCents">; angenommenAm: string | null; heute: string; teil1Bezahlt: boolean; vorhanden: { rechnungSteht: boolean } | null },
  ein: any,
): { ok: true; daten: { datum: string; beleg: string; betragCents: number } } | { ok: false; error: string; schon?: true } {
  if (lage.status !== "angenommen") return { ok: false, error: "Erst nach der Annahme." };
  const betragCents = lage.parameter.erfolgCents;
  if (!(betragCents > 0)) return { ok: false, error: "Im Vertrag ist kein Erfolgshonorar vereinbart." };
  if (lage.vorhanden?.rechnungSteht) return { ok: false, error: "Das Erfolgshonorar ist schon berechnet.", schon: true };
  if (!lage.teil1Bezahlt) return { ok: false, error: "Erst wenn Gründung und Fast-Track bezahlt sind (Ziffer 6 Absatz 1) — vorher meldet FIAON nicht an." };
  const datum = String(ein?.datum ?? "").trim();
  if (!ISO.test(datum)) return { ok: false, error: `${KAPITAL_C_TEIL2.datumLabel}: Datum fehlt (JJJJ-MM-TT).` };
  if (datum > lage.heute) return { ok: false, error: "Das Datum liegt in der Zukunft." };
  if (lage.angenommenAm && datum < lage.angenommenAm) return { ok: false, error: `Das Datum liegt vor der Annahme (${kapitalTag(lage.angenommenAm)}).` };
  const beleg = String(ein?.beleg ?? "").replace(/\s+/g, " ").trim().slice(0, 600);
  return { ok: true, daten: { datum, beleg, betragCents } };
}
/** „Ihr Weg“ in „Mein Auftrag“ (fiaon-global-bereich.ts) — dieselben Etappen-Nummern, die Texte dieses Vertrags. */
export const KAPITAL_C_ETAPPEN: Record<1 | 2 | 3 | 4, { titel: string; text: string }> = {
  1: { titel: "Gründung und Dokumente", text: "Ihre LLC mit Staatsgebühr und Operating Agreement, EIN und — nach dem ITIN-Check — ITIN, US-Adresse, Telefonnummer und Assistenz. Wir bereiten alles vor und reichen ein; Sie unterschreiben, was wir Ihnen fertig zuschicken." },
  2: { titel: "Alles für die Bank", text: "Geschäftskonto, Unterlagen und Bürgschaft — wir bereiten jeden Antrag vollständig vor und stimmen alles mit der finanzierenden Bank ab." },
  3: { titel: "Konto und Karten", text: "Ihr privates US-Konto, Ihre Kreditkarten und die Firmenkarte — fertig vorbereitet; die Anträge stellen Sie selbst." },
  4: { titel: "Ihre Finanzierung", text: `Die Auszahlung auf das Konto Ihrer Gesellschaft, mit der Bürgschaft unserer US-Partnergesellschaft — und Ihrer ${KAPITAL_C_GARANTIE_NAME} aus Ziffer 4.` },
};
/**
 * Die öffentliche Zahlungsseite (/zahlung/<Zweck>, angebotTeilZahlungsKontext) für TEIL 2 der Fassung C — das Erfolgshonorar mit der
 * Eintragung. Runde 2 (Technik): Die Seite zeigte die Texte der Fassung B („Die Bürgschaft … steht“, „Bürgschaft zugesagt“) — bei C ist
 * die Bürgin inaktiv, und Teil 2 hängt an der Eintragung. Rein, damit der Prüfstand die Texte liest. Teil 1 nutzt die allgemeinen Texte.
 */
export function kapitalCZahlungsseiteTeil2(ein: { bezahlt: boolean; angebotRef: string; titel: string; eingetragenAm: string | null; zielWochen: number; bestand?: boolean | "buergschaft" }): {
  satz: string; pruefung: { titel: string; text: string }; schritte: { titel: string; text: string }[];
} {
  return {
    satz: ein.bezahlt
      ? `Ihre Zahlung ist eingegangen — vielen Dank. Angebot ${ein.angebotRef}, ${ein.titel}.`
      : ein.bestand === "buergschaft" ? `Ihre Gesellschaft ist übernommen, und die Bürgschaft steht — offen ist das Erfolgshonorar (Ziffer 6 Absatz 2, Angebot ${ein.angebotRef}).`
      : ein.bestand ? `Ihre Gesellschaft ist übernommen und bankfertig — offen ist das Erfolgshonorar (Ziffer 6 Absatz 2, Angebot ${ein.angebotRef}).`
      : `Ihre Gesellschaft ist eingetragen — offen ist das Erfolgshonorar (Ziffer 6 Absatz 2, Angebot ${ein.angebotRef}).`,
    pruefung: ein.bestand === "buergschaft" ? { titel: "Übernommen, Bürgschaft steht", text: `${ein.eingetragenAm ? `am ${kapitalTag(ein.eingetragenAm)} ` : ""}(Ziffer 6 Absatz 2)` }
      : ein.bestand ? { titel: "Gesellschaft übernommen und bankfertig", text: `${ein.eingetragenAm ? `am ${kapitalTag(ein.eingetragenAm)} ` : ""}(Ziffer 6 Absatz 2)` }
      : { titel: "Gesellschaft eingetragen", text: `${ein.eingetragenAm ? `am ${kapitalTag(ein.eingetragenAm)} ` : ""}beim Bundesstaat (Ziffer 6 Absatz 2)` },
    schritte: [
      { titel: "Ihre Zahlung", text: "Überweisen Sie die Rechnung mit Ihrem Verwendungszweck — am schnellsten als Echtzeitüberweisung." },
      { titel: KAPITAL_C_ETAPPEN[2].titel, text: KAPITAL_C_ETAPPEN[2].text },
      { titel: "Auszahlung", text: `Unser Ziel ist die Auszahlung in Woche ${zahlwort(ein.zielWochen)} — und Ihre ${KAPITAL_C_GARANTIE_NAME} gilt (Ziffer 4).` },
    ],
  };
}
export interface KapitalCAuftragTeilEin { nr: number; titel: string; betragCents: number; stand: string; rechnungsnummer: string | null; bestellRef: string | null; ereignisAm: string | null; bezahltAm: string | null }
export function kapitalCMeinAuftrag(ein: {
  parameter: KapitalCParameter;
  angenommenAm: string | null;
  teile: KapitalCAuftragTeilEin[];
  garantieErfuelltAm: string | null;
  erstattungAusgeloest: boolean;
  gespeichert?: { beginn: string | null; ende: string | null };
  laufzeitJahre: number | null;
  /** E-474: die Wahl zum Fast-Track (nur bei fastTrackWahl; ohne Angabe: mit) */
  fastTrack?: boolean;
}) {
  const par = ein.parameter;
  const ft = ein.fastTrack !== false;
  const roh = (nr: number) => ein.teile.find((t) => Number(t.nr) === nr) ?? null;
  const t1 = roh(1), t2 = roh(2);
  const BT = kapitalCBestandTexte({ parameter: par });
  const teile: { nr: number; titel: string; betragCents: number; stand: string; rechnungsnummer: string | null; bestellRef: string | null; hinweis: string | null }[] = [{
    nr: 1, titel: BT ? BT.auftragTeil1.titel : ft ? "Gründung und Fast-Track" : "Gründung", betragCents: t1?.betragCents ?? kapitalCHeuteCents(par, ft), stand: t1?.stand ?? "offen",
    rechnungsnummer: t1?.rechnungsnummer ?? null, bestellRef: t1?.bestellRef ?? null,
    hinweis: BT ? BT.auftragTeil1.hinweis : ft ? `Gründung, Konto und Karten im ersten Jahr (${kapitalCEur(par.gruendungCents)}) und Fast-Track (${kapitalCEur(par.fastTrackCents)})` : `Gründung, Konto und Karten im ersten Jahr (${kapitalCEur(par.gruendungCents)})`,
  }];
  if (t2) teile.push({ nr: 2, titel: KAPITAL_C_TEIL2.titel, betragCents: t2.betragCents, stand: t2.stand, rechnungsnummer: t2.rechnungsnummer, bestellRef: t2.bestellRef, hinweis: t2.ereignisAm ? (BT ? BT.auftragTeil2Am(kapitalTag(t2.ereignisAm)) : `Gesellschaft eingetragen am ${kapitalTag(t2.ereignisAm)}`) : null });
  else if (par.erfolgCents > 0) teile.push({ nr: 2, titel: KAPITAL_C_TEIL2.titel, betragCents: par.erfolgCents, stand: ein.erstattungAusgeloest ? "entfallen" : "noch nicht fällig", rechnungsnummer: null, bestellRef: null,
    hinweis: ein.erstattungAusgeloest ? "entfällt nach Ziffer 4" : BT ? BT.auftragTeil2Offen : "fällig mit der Eintragung Ihrer Gesellschaft (Ziffer 6 Absatz 2) — die Bürgschaft ist darin enthalten" });
  const wochen = par.garantieWochen; const betrag = kapitalCEur(par.betragCents);
  const bezahltAm = t1?.bezahltAm ?? null;
  const beginn = bezahltAm ? (ein.angenommenAm && ein.angenommenAm > bezahltAm ? ein.angenommenAm : bezahltAm) : null;
  const plus = (iso: string, n: number) => { const x = new Date(`${iso.slice(0, 10)}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const endeRoh = beginn ? plus(beginn, wochen * 7) : null;
  const g = ein.gespeichert;
  const ende = beginn && endeRoh && g?.ende && g.beginn === beginn && g.ende >= endeRoh ? g.ende : endeRoh;
  const zurueck = "erstatten wir Ihnen alles, was Sie an uns gezahlt haben (Ziffer 4)";
  // Die Geld-zurück-Garantie sichert das Geld des Kunden — nie „wir garantieren die Auszahlung“ (Nachprüfung 27.10.).
  const garantieSatz = ein.garantieErfuelltAm ? `Ihre Finanzierung über ${betrag} ist ausgezahlt (${kapitalTag(ein.garantieErfuelltAm)}) — die ${KAPITAL_C_GARANTIE_NAME} ist damit erfüllt.`
    : ein.erstattungAusgeloest ? "Die Frist ist abgelaufen, ohne dass Ihre Finanzierung ausgezahlt wurde. Wir erstatten Ihnen alles, was Sie an uns gezahlt haben (Ziffer 4)."
    : beginn && ende ? `Ihre ${KAPITAL_C_GARANTIE_NAME}: Ist Ihre Finanzierung über ${betrag} nicht bis zum ${kapitalTag(ende)} ausgezahlt, ${zurueck}. Die ${zahlwort(wochen)} Wochen laufen seit dem ${kapitalTag(beginn)}; ruht die Frist nach Ziffer 4 Absatz 6, verschiebt sich dieser Tag entsprechend.`
    : `Ihre ${KAPITAL_C_GARANTIE_NAME}: Ist Ihre Finanzierung über ${betrag} nicht binnen ${zahlwort(wochen)} Wochen ausgezahlt, ${zurueck}. Die Wochen laufen ab Ihrer Zahlung${BT ? "" : ` von Gründung${ft ? " und Fast-Track" : ""}`}.`;
  const summeCents = teile.filter((t) => t.nr === 1 || (t.bestellRef && !["storniert", "entfallen", "noch nicht fällig"].includes(t.stand))).reduce((s, t) => s + t.betragCents, 0);
  const plan = ein.laufzeitJahre != null && kapitalCLaufzeitGueltig(ein.laufzeitJahre, par) ? kapitalCPlan(par, ein.laufzeitJahre) : null;
  return {
    teile, garantieSatz,
    garantieZiel: `${KAPITAL_C_GARANTIE_NAME}: Ist die Finanzierung über ${betrag} nicht binnen ${zahlwort(wochen)} Wochen ab Auftragserteilung ausgezahlt, erhalten Sie alles Gezahlte zurück (Ziffer 4)`,
    fristBeginn: beginn, fristEnde: ende, summeCents,
    teil2Bedingung: teile.find((t) => t.nr === 2)?.hinweis ?? "",
    seiteHinweis: `Ihre ${KAPITAL_C_GARANTIE_NAME} steht in Ziffer 4 Ihres Vertrags.${plan ? ` Ihre Laufzeit: ${zahlwort(plan.jahre)} Jahre, Monatsrate nach dem Rechenbeispiel ${kapitalCEurCent(plan.monatsrateCents)}.` : ""}`,
    jahresZeile: par.jahresCents > 0 ? `Ab dem zweiten Jahr betreuen wir Ihre Gesellschaft für ${kapitalCEur(par.jahresCents)} je Jahr (Ziffer 6): Adresse, Telefonnummer, Assistenz und alle Meldungen — die Jahresbetreuung verlängert sich nicht von selbst.` : "",
  };
}
/** E-487 (Gutachten): Fehlt der Reisepass bei der Zahlung, steht statt eines Datums dieser Satz in der Start-Aufgabe. */
export const KAPITAL_C_PASS_DATUM_FOLGT = "der Reisepass fehlt noch; das Datum nennt die Aufgabe „Reisepass da“, sobald er hochgeladen ist";
/** Die Aufgabe an Justin, wenn Teil 1 bezahlt ist (wie kapitalStartAufgabe, Fassung C). */
export function kapitalCStartAufgabe(ein: {
  angebotRef: string; name: string; parameter: KapitalCParameter; bezahltAm: string; zweck: string | null;
  frist: { beginn: string; ende: string } | null; llc: string | null; laufzeitJahre: number | null;
  /** Ist die Vertragsbestätigung (§ 312f BGB) beim Kunden? Ohne sie beginnt FIAON nicht — die Aufgabe sagt es dann zuerst. */
  bestaetigung?: { da: boolean; grund: string | null } | null;
  /** E-474/E-475: die Wahl zum Fast-Track (nur bei fastTrackWahl) — beide beginnen sofort, die Wahl ändert das Tempo */
  fastTrack?: boolean;
  /** E-474: datenVomKunden — liegt der Reisepass schon in der Akte? false = erst anfordern, vorher nicht anmelden */
  reisepassDa?: boolean | null;
  /** E-487 (Gutachten): datenVomKunden — seit wann (Berliner Tag) der Reisepass in der Akte liegt; es zählt der spätere Eingang. */
  reisepassAm?: string | null;
}): { titel: string; text: string } {
  const par = ein.parameter;
  const ft = ein.fastTrack !== false;
  const unterlagen = par.unterlagen.length ? par.unterlagen.map((u) => u.titel).join(", ") : "—";
  const ohneBestaetigung = ein.bestaetigung ? !ein.bestaetigung.da : false;
  // E-487: Fast-Track in der Vorrang-Fassung — die Arbeitsschritte des Vorrangs mit Datum, keine Zeit für die EIN.
  const V = kapitalCVorrangGilt(par) && ft ? kapitalCVorrang(par) : null;
  // Nachbesserung E-487 (Gutachten): Mit Angaben vom Kunden beginnt die Frist erst mit dem SPÄTEREN Eingang — Zahlung oder Reisepass
  // (Ziffer 2 Absatz 3, wie Fassung A/B). Fehlt der Pass noch, nennt die Aufgabe kein Datum (vorher: „also bis <Zahlung + 1 Werktag>“
  // gleich nach „vor dem Eingang NICHT anmelden“); das Datum nennt die Aufgabe „Reisepass da“ (kapitalCReisepassAufgabe), sobald er
  // hochgeladen ist. Nur in der Vorrang-Fassung — vor E-487 angenommene Verträge behalten ihre Aufgabe wortgleich (Prüfstand 12a).
  const neuDK = kapitalCVorrangGilt(par) && par.datenVomKunden;
  const passFehlt = neuDK && ein.reisepassDa === false;
  const basis = neuDK && ein.reisepassAm && ein.reisepassAm > ein.bezahltAm ? ein.reisepassAm : ein.bezahltAm;
  const nach = passFehlt || basis !== ein.bezahltAm ? "dem Eingang des Reisepasses" : "Zahlungseingang";
  const bis = (werktage: number) => (passFehlt ? ` — ${KAPITAL_C_PASS_DATUM_FOLGT}` : `, also bis ${kapitalTag(plusWerktageRein(basis, werktage))}`);
  const ablage = passFehlt ? "Kommt der Reisepass, ihn in der Akte prüfen (lesbar, gültig, Name wie im Vertrag)."
    : par.datenVomKunden ? "Den Reisepass bitte in der Akte prüfen." : `Die Unterlagen nach Ziffer 7 Absatz 1 liegen vor (${unterlagen}) — bitte in der Akte ablegen, falls noch nicht geschehen.`;
  return {
    titel: par.bestand ? `${ohneBestaetigung ? "ERST Vertragsbestätigung senden — " : ""}Kapital-Angebot ${ein.angebotRef}: Übernahme bezahlt — bestehende ${par.bestand.name} übernehmen, NICHT neu gründen (${ein.name}, privat)`
      : `${ohneBestaetigung ? "ERST Vertragsbestätigung senden — " : ""}Kapital-Angebot ${ein.angebotRef}: Gründung bezahlt — LLC anmelden (${ein.name}, privat)`,
    text: [
      ...(par.bestand ? [`BESTEHENDE GESELLSCHAFT (E-506): ${par.bestand.name}, ${par.bestand.bundesstaat}${par.bestand.registerNr ? `, Registernummer ${par.bestand.registerNr}` : ""}, eingetragen am ${kapitalTag(par.bestand.eingetragenAm)}. KEINE Neugründung, KEIN EIN-Antrag — die Zeilen „ANMELDUNG“ unten gelten hier NICHT. Stattdessen (Ziffer 2): ${par.bestand.ordnung.length ? par.bestand.ordnung.join(" · ") : "Prüfung, Berichtigungen, Operating Agreement, Behördenpost"}. ${par.bestand.erfolgBei === "buergschaft" ? `ERFOLGSHONORAR ERST, WENN ÜBERNOMMEN IST UND DIE BÜRGSCHAFT STEHT (Ziffer 6 Absatz 2): Knopf „${kapitalCTeil2Fuer(par).knopf}“ vorher NICHT drücken` : `Ist alles eingereicht und das Operating Agreement unterschrieben → Knopf „${kapitalCTeil2Fuer(par).knopf}“`} (Rechnung Erfolgshonorar ${kapitalEur(par.erfolgCents)}).`] : []),
      ...(ohneBestaetigung ? [`VERTRAGSBESTÄTIGUNG FEHLT (§ 312f BGB): Die Mail mit Vertrag (PDF) und Rechnung ist nicht nachweislich beim Kunden (${ein.bestaetigung?.grund ?? "unbekannt"}). Bitte Adresse prüfen und im Office „Auftragsmail nachholen“ drücken — das schickt Vertrag und Rechnung genau einmal. Kam sie nachweislich an (Brevo „zugestellt“, oder von Hand geschickt und vom Kunden bestätigt), ist nichts zu tun. Erst wenn auch das Nachholen scheitert, von Hand schicken. Vorher nicht anmelden.`] : []),
      ft
        ? `${ein.name} hat Gründung und Fast-Track bezahlt (${kapitalEur(kapitalCHeuteCents(par))}, Teil 1${ein.zweck ? `, Verwendungszweck ${ein.zweck}` : ""}, eingegangen am ${kapitalTag(ein.bezahltAm)}). Der Auftrag läuft — Fast-Track, Sofortbeginn ausdrücklich verlangt.`
        : `${ein.name} hat die Gründung bezahlt (${kapitalEur(kapitalCHeuteCents(par, false))}, Teil 1${ein.zweck ? `, Verwendungszweck ${ein.zweck}` : ""}, eingegangen am ${kapitalTag(ein.bezahltAm)}). Der Auftrag läuft — OHNE Fast-Track (kein Vorrang), Sofortbeginn ausdrücklich verlangt: Gesellschaft, EIN und ITIN in ${KAPITAL_C_TEMPO.ohne}.`,
      ...(ein.reisepassDa === false ? ["REISEPASS FEHLT NOCH (Ziffer 7 Absatz 1): Der Kunde lädt ihn nach der Annahme hoch (Angebotsseite oder „Mein Auftrag“). Bitte anfordern — vor dem Eingang NICHT anmelden; die Garantiefrist ruht so lange (Ziffer 4 Absatz 6)."] : []),
      V
        ? `ANMELDUNG (Ziffer 2): ${ein.llc ?? "Wunschname siehe Annahmevermerk"} in ${par.bundesstaat} — FAST-TRACK${par.fastTrackWahl ? " gewählt" : ""} (Ziffer 2 Absatz 3): spätestens am Werktag nach ${nach} einreichen${V.express ? ", mit Express des Bundesstaats" : ""}${bis(1)}. EIN-Antrag am Tag der Eintragung — das Formular (SS-4) dafür vorher zur Unterschrift schicken; die Unterlagen für das finanzierende Institut parallel. Keine Zeit für die EIN zusagen. ${ablage} ITIN nur nach ITIN-Check (Ziffer 2).`
        : `ANMELDUNG (Ziffer 2): ${ein.llc ?? "Wunschname siehe Annahmevermerk"} in ${par.bundesstaat} — binnen fünf Werktagen nach ${nach} einreichen${bis(5)}.${par.fastTrackWahl && ft ? ` FAST-TRACK gewählt: Gesellschaft und EIN in ${KAPITAL_C_TEMPO.mit} (Ziel) — sofort einreichen, EIN mit Vorrang; die ITIN so schnell wie möglich.` : ""} ${ablage} ITIN nur nach ITIN-Check (Ziffer 2).`,
      ein.frist ? `GELD-ZURÜCK-GARANTIE (Ziffer 4): Auszahlung über ${kapitalEur(par.betragCents)} — die ${zahlwort(par.garantieWochen)} Wochen laufen seit dem ${kapitalTag(ein.frist.beginn)}, die Frist endet am ${kapitalTag(ein.frist.ende)}.${ft ? ` Ziel mit Fast-Track: Woche ${zahlwort(par.zielWochen)}.` : ""} Kommt sie nicht, erstattet FIAON alles Gezahlte binnen ${zahlwort(par.erstattungTage)} Tagen. Ruhezeiten (Tage, um die der Kunde die Frist für Unterlagen der Bank nach Ziffer 7 Absatz 2 überschreitet; nicht angenommenes Angebot ohne weitere Sicherheiten oder Kosten) bitte mit Datum im Verlauf festhalten.` : "GELD-ZURÜCK-GARANTIE: keine Frist gesetzt.",
      `LAUFZEIT: ${ein.laufzeitJahre ? kapitalCLaufzeitSatz(par, ein.laufzeitJahre) : "—"}.`,
      ...(par.buerginAktiv ? [] : ["BÜRGIN: im Register als inaktiv vermerkt — die Bürgschaft erst nach der Reaktivierung (Ziffer 5); Reinstatement mit Beleg in die Akte."]),
      `DANACH: Ist die Gesellschaft eingetragen → Knopf „${KAPITAL_C_TEIL2.knopf}“ (Rechnung Erfolgshonorar ${kapitalEur(par.erfolgCents)}).`,
      "Keine automatische Kundenmail zum Start — den Start bitte persönlich mitteilen.",
    ].join("\n"),
  };
}
/**
 * E-487 (09.11.2026, Gutachten): Die Aufgabe „Reisepass da“ — der Kunde hat den Reisepass NACH der Zahlung von Teil 1 hochgeladen
 * (datenVomKunden). Erst jetzt beginnt die Frist für die Anmeldung (Ziffer 2 Absatz 3: „nach dem Eingang der Vergütung … und des
 * Reisepasses“ — es zählt der spätere Eingang, wie in Fassung A/B). Die Start-Aufgabe nannte dafür noch kein Datum; diese nennt es und
 * ist an dem Tag fällig. Vorrang-Fassung mit Fast-Track: am Werktag danach; sonst (ohne Fast-Track oder vor E-487 angenommen) binnen
 * fünf Werktagen — wie im jeweiligen Vertrag. Rein (Prüfstand); angelegt vom Server in kapitalCReisepassEingang.
 */
export function kapitalCReisepassAufgabe(ein: {
  angebotRef: string; name: string; parameter: KapitalCParameter; bezahltAm: string; reisepassAm: string; llc: string | null;
  /** die Wahl zum Fast-Track (nur bei fastTrackWahl, wie in der Start-Aufgabe) */
  fastTrack?: boolean;
}): { titel: string; text: string; faelligAm: string } {
  const par = ein.parameter;
  const ft = ein.fastTrack !== false;
  const V = kapitalCVorrangGilt(par) && ft ? kapitalCVorrang(par) : null;
  const basis = ein.reisepassAm > ein.bezahltAm ? ein.reisepassAm : ein.bezahltAm;
  const bis = plusWerktageRein(basis, V ? 1 : 5);
  const llc = ein.llc ?? "Wunschname siehe Annahmevermerk";
  return {
    titel: `Kapital-Angebot ${ein.angebotRef}: Reisepass da — LLC anmelden bis ${kapitalTag(bis)} (${ein.name}, privat)`,
    text: [
      `${ein.name} hat den Reisepass hochgeladen (${kapitalTag(ein.reisepassAm)}); Teil 1 ist seit dem ${kapitalTag(ein.bezahltAm)} bezahlt. Mit dem späteren der beiden Eingänge beginnt die Frist für die Anmeldung (Ziffer 2 Absatz 3) — die Start-Aufgabe nannte dafür noch kein Datum.`,
      V
        ? `ANMELDUNG (Ziffer 2): ${llc} in ${par.bundesstaat} — FAST-TRACK${par.fastTrackWahl ? " gewählt" : ""} (Ziffer 2 Absatz 3): spätestens am Werktag nach dem Eingang des Reisepasses einreichen${V.express ? ", mit Express des Bundesstaats" : ""}, also bis ${kapitalTag(bis)}. EIN-Antrag am Tag der Eintragung — das Formular (SS-4) dafür vorher zur Unterschrift schicken; die Unterlagen für das finanzierende Institut parallel. Keine Zeit für die EIN zusagen.`
        : `ANMELDUNG (Ziffer 2): ${llc} in ${par.bundesstaat} — binnen fünf Werktagen nach dem Eingang des Reisepasses einreichen, also bis ${kapitalTag(bis)}.${par.fastTrackWahl ? (ft ? " FAST-TRACK gewählt (Ziffer 2 Absatz 3): sofort einreichen, EIN mit Vorrang." : " OHNE Fast-Track (kein Vorrang).") : ""}`,
      "Den Reisepass in der Akte prüfen (lesbar, gültig, Name wie im Vertrag) — ist er nicht geeignet, sofort neu anfordern.",
      "GELD-ZURÜCK-GARANTIE (Ziffer 4 Absatz 6): Die Frist ruhte, bis der Reisepass vorlag — den Tag des Eingangs bitte im Verlauf festhalten.",
    ].join("\n"),
    faelligAm: bis,
  };
}
function plusWerktageRein(iso: string, n: number): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  let rest = n;
  while (rest > 0) { d.setUTCDate(d.getUTCDate() + 1); const w = d.getUTCDay(); if (w !== 0 && w !== 6) rest--; }
  return d.toISOString().slice(0, 10);
}
/** Die Fristwarnung (wie kapitalFristAufgabe, Fassung C — Euro statt CHF, Erfolgshonorar statt Auszahlungsvergütung). */
export function kapitalCFristAufgabe(ein: {
  schritt: "warnung14" | "warnung3" | "abgelaufen"; tageBis: number; angebotRef: string; name: string;
  fristBeginn: string | null; fristEnde: string; parameter: KapitalCParameter;
}): { titel: string; text: string; dringend: boolean } {
  const par = ein.parameter; const ende = kapitalTag(ein.fristEnde);
  const bisD = new Date(`${ein.fristEnde.slice(0, 10)}T12:00:00Z`); bisD.setUTCDate(bisD.getUTCDate() + par.erstattungTage);
  const bis = kapitalTag(bisD.toISOString().slice(0, 10));
  const ziel = kapitalEur(par.betragCents);
  // E-512: Ruhetage trägt die Leitung im Chefbüro ein (Knopf „Ruhetage eintragen“) — die Gründe folgen dem angenommenen Wortlaut.
  const ruhen = kapitalCRuhenErweitert(par)
    ? "Ruhte die Frist (wir warteten auf eine erbetene Unterlage, Angabe, Unterschrift oder Antwort des Kunden, ein Antrag lag bei einer Behörde oder einem Register — Eintragung, EIN, ITIN —, höhere Gewalt, oder ein Angebot zu den Bedingungen nach Ziffer 4 lag zur Annahme vor): die Tage im Chefbüro › Global-Angebote › „Ruhetage eintragen“ erfassen — das Fristende rückt dann von selbst."
    : "Ruhte die Frist (der Kunde hat die Frist für Unterlagen der Bank nach Ziffer 7 Absatz 2 überschritten — nur diese Tage — oder ein vorgelegtes Angebot zu den Bedingungen nach Ziffer 4 ohne weitere Sicherheiten oder Kosten wurde nicht angenommen), die Tage bitte mit Datum im Verlauf festhalten.";
  const ohne = "Das System hat KEIN Geld bewegt und keine Mail an den Kunden geschickt.";
  if (ein.schritt === "abgelaufen") {
    return {
      titel: `Frist abgelaufen — Garantie Ziffer 4 prüfen (Kapital-Angebot ${ein.angebotRef}, ${ein.name})`,
      text: [`Die Garantiefrist (Ziffer 4) des Kapital-Angebots ${ein.angebotRef} endete am ${ende}.`, `Wurde die Finanzierung über ${ziel} bis zum ${ende} ausgezahlt: Knopf „${KAPITAL_C_AUSZAHLUNG.knopf}“ mit dem Tag der Auszahlung.`, ruhen,
        `Sonst ist der Garantiefall da: FIAON erstattet alles Gezahlte (Gründung, Fast-Track und ein bezahltes Erfolgshonorar) binnen ${zahlwort(par.erstattungTage)} Tagen nach Fristende, also bis ${bis}. Die Gesellschaft bleibt dem Auftraggeber.`, ohne].join("\n"),
      dringend: true,
    };
  }
  return {
    titel: `Kapital-Angebot ${ein.angebotRef}: Garantiefrist endet am ${ende} (noch ${ein.tageBis} ${ein.tageBis === 1 ? "Tag" : "Tage"}) — ${ein.name}`,
    text: [`Die Garantie aus Ziffer 4 läuft am ${ende} ab: Auszahlung über ${ziel} binnen ${zahlwort(par.garantieWochen)} Wochen${ein.fristBeginn ? ` (seit dem ${kapitalTag(ein.fristBeginn)})` : ""}.`,
      `Stand prüfen: Ist die Finanzierung ausgezahlt, Knopf „${KAPITAL_C_AUSZAHLUNG.knopf}“ — dann endet diese Erinnerung.`, ruhen,
      `Kommt die Auszahlung bis zum ${ende} nicht, erstattet FIAON alles Gezahlte binnen ${zahlwort(par.erstattungTage)} Tagen nach Fristende (bis ${bis}).`, ohne].join("\n"),
    dringend: ein.schritt === "warnung3",
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE KUNDENSICHT (GET /api/fiaon/global/angebot/:token für ein offenes Kapital-Angebot der Fassung C)
// ═══════════════════════════════════════════════════════════════════════════
export interface KapitalCKundenSicht {
  ok: true; status: "offen"; art: "kapital"; variante: "privat";
  ref: string; fassung: string; gueltigBis: string;
  kunde: { anrede: string; vorname: string; nachname: string; email: string };
  kundeAnrede: string;
  seite: KapitalCSeite;
  /** Die Konditionen für den Rechner im Browser (dieselbe Funktion kapitalCPlan wie Server und Vertrag) */
  konditionen: KapitalCKonditionen & { laufzeitVorschlagJahre: number };
  /** Porträt mit Stand (?v=) und — bei einem KI-Porträt — dem Hinweis am Bild (E-288, Art. 50 Abs. 4 KI-VO). */
  ansprechpartner: { kuerzel: string; name: string; rolle: string; email: string; telefon: string; portrait: string; alt?: string; kiHinweis?: string | null }[];
  uebersicht: { titel: string; zeilen: { label: string; wert: string }[] };
  annahme: KapitalCAnnahmeTexte;
  annahmeBereit: boolean;
  gesperrtGrund: string | null;
  vorschauLeitung?: boolean;
  fehlt?: string[];
  html: string;
  textHash: string;
  vertragPdf: string;
  /** E-474: die Übersicht über dem Knopf je Wahl (nur bei fastTrackWahl) — die Seite tauscht sie, sobald der Kunde wählt. */
  uebersichtJe?: { mit: { titel: string; zeilen: { label: string; wert: string }[] }; ohne: { titel: string; zeilen: { label: string; wert: string }[] } } | null;
  /**
   * E-474: „Ihre Angaben für den Vertrag“ (nur bei datenVomKunden). `werte` = was schon eingetragen ist (vorbelegt: Name), nie ein
   * Ausweis; `fehlen` = die Unterschrift wartet darauf; `gesperrt` = nach der Annahme oder in der Vorschau der Leitung nicht änderbar.
   */
  angaben?: {
    fehlen: boolean; texte: typeof KAPITAL_C_ANGABEN;
    werte: { vorname: string; nachname: string; geburtsdatum: string; geburtsort: string; staatsangehoerigkeit: string; strasse: string; plz: string; ort: string; land: KapitalCLand };
    speichern: string;
  } | null;
  /** E-491: der Namensvorschlag aus dem Gespräch — die Seite füllt damit die Namensfelder vor (nur wenn gesetzt). */
  llcVorschlag?: BegleitLlcWahl | null;
  /**
   * E-505: der Regler „Ihr Kapitalrahmen“ (nur mit rahmenWahl). `gewaehltUsd` = der Stand am Angebot; `speichern` = wohin die Seite
   * die Wahl schickt (die Antwort ist die neue Kundensicht mit dem Vertrag und dem Fingerabdruck dieser Wahl).
   */
  rahmen?: (KapitalCRahmenWahl & { speichern: string; gruendungCents: number; fastTrackCents: number }) | null;
}
