// ═══════════════════════════════════════════════════════════════════════════
// FIAON — KOOPERATIONSVERTRÄGE FÜR RECHT, STEUERN, ENERGIE, TELEFON & INTERNET (Register E-390, 16.10.2026)
//
// Justin (16.10.2026): „Mach die Vertragsvorlagen für Recht, Steuern, Energie und Telefon“ — zu den Preisen des
// Partner-Netzwerks (shared/fiaon-partnernetz.ts, E-388). Der Vorsorge-Vertrag (E-384, Modell „kontakt“) bleibt in
// shared/fiaon-global-angebot-koop.ts Wort für Wort unverändert; diese Datei liefert die zwei weiteren Modelle:
//
//   · „platz“     Recht und Steuern — ein fester Partnerplatz je Monat. NIE ein Entgelt je Mandat: § 49b Abs. 3 BRAO und
//                 § 9 StBerG verbieten Vergütungen für die Vermittlung von Aufträgen. Bezahlt wird Sichtbarkeit,
//                 Nennung und Terminorganisation — unabhängig von Zahl, Art und Ausgang der Mandate. Höchstens drei Partner
//                 je Region und Gebiet, Mindestlaufzeit drei Monate, Beginn am Ersten des Folgemonats (bis dahin frei).
//   · „abschluss“ Energie und Telefon & Internet — FIAON ist Tippgeber und wird nur für einen zustande gekommenen Vertrag
//                 bezahlt: Energie mit bestätigtem Lieferbeginn, Telefon nach Aktivierung und abgelaufener Widerrufsfrist.
//                 Der Partner meldet Abschlüsse im Partnerbereich; FIAON hat ein Auskunftsrecht.
//
// Alle Modelle: Einwilligung vor jeder Übermittlung (Art. 6 Abs. 1 Buchst. a DSGVO, § 7 Abs. 2 Nr. 1 UWG), Rücksichtsklausel,
// Unternehmergeschäft ohne Widerruf, Reverse Charge, deutsches Recht. Vertrag in Vertragssprache („der Partner“, „FIAON“).
// DATENSCHUTZ: Das Repo ist öffentlich (E-242) — hier stehen KEINE Partnerdaten.
// ═══════════════════════════════════════════════════════════════════════════
import { FIAON_FIRMA } from "./fiaon-firma";
import type { AngebotAbsatz, AngebotZiffer } from "./fiaon-global-angebot";
import { zahlwort } from "./fiaon-global-angebot-firma";
import type { FirmaPhase, FirmaLeistung, FirmaFrage } from "./fiaon-global-angebot-firma-typen";

export type KoopBereich = "vorsorge" | "recht" | "steuern" | "energie" | "telekom";
export type KoopModell = "kontakt" | "abschluss" | "platz";
export const KOOP_BEREICHE: KoopBereich[] = ["vorsorge", "recht", "steuern", "energie", "telekom"];
export function koopModellVon(bereich: unknown): KoopModell {
  return bereich === "recht" || bereich === "steuern" ? "platz" : bereich === "energie" || bereich === "telekom" ? "abschluss" : "kontakt";
}
export function koopBereichAus(v: unknown): KoopBereich {
  return (KOOP_BEREICHE as string[]).includes(String(v)) ? (v as KoopBereich) : "vorsorge";
}

/** Fassungen je Modell — alle mit dem Präfix IA-KOOP- (ein Pfad in server/lib/fiaon-global-angebot-koop.ts). */
export const KOOP_FASSUNG_PLATZ = "IA-KOOP-PLATZ-2026-10-16";
export const KOOP_FASSUNG_ABSCHLUSS = "IA-KOOP-ABSCHLUSS-2026-10-16";

/** Was je Bereich gilt: Name, Rolle des Partners, Sparten (abschluss) und die Wörter auf Seite und im Vertrag. */
export const KOOP_BEREICH: Record<KoopBereich, {
  name: string; partnerArt: string; titel: string; marke: string;
  /** Sparten bei „abschluss“: erste zum Hauptpreis, zweite zum Zweitpreis */
  sparten?: [string, string];
  /** Was ein Abschluss ist (abschluss) */
  abschluss?: string;
  /** Gesetzliche Grundlage der Partnerplatz-Regel (platz) */
  berufsrecht?: string;
  /** Wer der Partner ist (platz) */
  zulassung: string;
  einheit: string;
}> = {
  vorsorge: { name: "Vorsorge & Versicherung", partnerArt: "Berater", titel: "Termine für Ihre Beratung", marke: "FIAON Partner-Kooperation", zulassung: "Erlaubnis bzw. Registrierung nach § 34d oder § 34f GewO", einheit: "Kontakte" },
  recht: { name: "Recht", partnerArt: "Kanzlei", titel: "Partnerplatz Recht", marke: "FIAON Partner-Netzwerk · Recht", berufsrecht: "§ 49b Abs. 3 der Bundesrechtsanwaltsordnung (BRAO)", zulassung: "Zulassung zur Rechtsanwaltschaft", einheit: "Erstberatungen" },
  steuern: { name: "Steuern", partnerArt: "Kanzlei", titel: "Partnerplatz Steuern", marke: "FIAON Partner-Netzwerk · Steuern", berufsrecht: "§ 9 Abs. 2 des Steuerberatungsgesetzes (StBerG)", zulassung: "Bestellung als Steuerberater oder Anerkennung als Lohnsteuerhilfeverein (§ 4 Nr. 11 StBerG)", einheit: "Erstgespräche" },
  energie: { name: "Energie", partnerArt: "Versorger", titel: "Neukunden für Strom und Gas", marke: "FIAON Partner-Netzwerk · Energie", sparten: ["Strom", "Gas"], abschluss: "ein Energieliefervertrag, dessen Lieferbeginn der Netzbetreiber bestätigt hat", zulassung: "Anzeige als Energielieferant bei der Bundesnetzagentur (§ 5 EnWG)", einheit: "Wechsel" },
  telekom: { name: "Telefon & Internet", partnerArt: "Anbieter", titel: "Neukunden für Mobilfunk und Internet", marke: "FIAON Partner-Netzwerk · Telefon & Internet", sparten: ["Mobilfunk", "Internet und Festnetz"], abschluss: "ein aktivierter Vertrag, für den die gesetzliche Widerrufsfrist ohne Widerruf abgelaufen ist", zulassung: "Meldung als Anbieter von Telekommunikationsdiensten bei der Bundesnetzagentur (§ 5 TKG)", einheit: "Verträge" },
};

/** Themen bzw. Gebiete je Bereich (Vorgabe — im Angebot änderbar). */
export const KOOP_THEMEN: Record<KoopBereich, string[]> = {
  vorsorge: ["Altersvorsorge und Sparen (zum Beispiel Lebens- oder Rentenversicherung)", "Krankenzusatzversicherung", "Absicherung der Kinder", "Vermögensaufbau", "Absicherung von Einkommen und Familie"],
  recht: ["Inkasso und Forderungen", "Verbraucherrecht", "Insolvenz und Schuldenbereinigung", "Mietrecht", "Arbeitsrecht"],
  steuern: ["Einkommensteuererklärung", "Erklärungen für Vorjahre nachholen", "Einspruch gegen einen Steuerbescheid", "Belege ordnen und Erstattung prüfen"],
  energie: ["Strom", "Gas"],
  telekom: ["Mobilfunk", "Internet und Festnetz"],
};

/** Die Daten, die die Modelle brauchen (Teil von KoopDaten — hier ohne Import, damit kein Kreis entsteht). */
export interface KoopModellDaten {
  ref: string; fassung: string; gueltigBis: string;
  partner: { anrede: string; vorname: string; nachname: string; firma: string; strasse: string; plz: string; ort: string; land: string; email: string };
  parameter: {
    preisCents: number; zweitCents: number; startDeckel: number; zahlungszielTage: number; ruhenNachTagen: number; kuendigungTage: number;
    exklusivMonate: number; themen: string[]; bereich: KoopBereich; region: string; mindestMonate: number; jeRegion: number;
  };
}

const p = (text: string): AngebotAbsatz => ({ art: "p", text });
const liste = (zeilen: string[], einleitung?: string): AngebotAbsatz => (einleitung ? { art: "liste", einleitung, zeilen } : { art: "liste", zeilen });
export function koopModellEur(cents: number): string {
  const e = Math.round(cents) / 100;
  return `${e.toLocaleString("de-DE", { minimumFractionDigits: Number.isInteger(e) ? 0 : 2, maximumFractionDigits: 2 })} €`;
}
const LAND: Record<string, string> = { DE: "Deutschland", AT: "Österreich", CH: "Schweiz" };
function partnerZeile(k: KoopModellDaten["partner"]): string {
  const name = `${String(k.vorname ?? "").trim()} ${String(k.nachname ?? "").trim()}`.trim();
  return `${k.firma ? `${k.firma}, vertreten durch ${name}` : name}, ${k.strasse}, ${k.plz} ${k.ort}, ${LAND[k.land] ?? k.land}`;
}
const fiaonZeile = () => `die ${FIAON_FIRMA.name}, ${FIAON_FIRMA.strasse}, ${FIAON_FIRMA.ortZeile}, ${FIAON_FIRMA.land} (nachfolgend „FIAON“)`;
const listeText = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} und ${xs[xs.length - 1]}`);

// ── Gemeinsame Ziffern ──────────────────────────────────────────────────────
function datenschutz(partnerWort: string): AngebotZiffer["absaetze"] {
  return [
    p(`Jede Partei ist für ihre Verarbeitung personenbezogener Daten selbst verantwortlich. FIAON übermittelt Kontaktdaten nur auf Grundlage der ausdrücklichen Einwilligung des Kunden (Art. 6 Abs. 1 Buchst. a DSGVO), dokumentiert sie mit Datum, Uhrzeit und Wortlaut und weist sie ${partnerWort} auf Anfrage binnen drei Werktagen nach.`),
    p(`${partnerWort.charAt(0).toUpperCase() + partnerWort.slice(1)} informiert den Kunden bei der ersten Kontaktaufnahme nach Art. 14 DSGVO, verarbeitet die Daten nur für die Anfrage und eine daraus entstehende Vertrags- oder Mandatsbeziehung, gibt sie nicht weiter und löscht sie, wenn keine solche Beziehung entsteht, spätestens sechs Monate nach der Übermittlung, soweit keine gesetzliche Aufbewahrungspflicht besteht. Er kontaktiert den Kunden telefonisch nur im Rahmen der Einwilligung (§ 7 Abs. 2 Nr. 1 UWG).`),
    p("Widerruft ein Kunde seine Einwilligung gegenüber einer Partei, unterrichtet sie die andere binnen drei Werktagen in Textform. Beide Parteien schützen die Daten nach dem Stand der Technik."),
  ];
}
function haftung(): AngebotZiffer["absaetze"] {
  return [
    p("Die Parteien haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie bei der Verletzung von Leben, Körper oder Gesundheit. Bei leicht fahrlässiger Verletzung wesentlicher Vertragspflichten ist die Haftung auf den vertragstypischen, bei Vertragsschluss vorhersehbaren Schaden begrenzt; im Übrigen ist die Haftung für leichte Fahrlässigkeit ausgeschlossen."),
    p("Für Beratung, Leistung und Verträge gegenüber dem Kunden haftet allein der Partner; er stellt FIAON von Ansprüchen Dritter daraus frei. FIAON stellt den Partner von Ansprüchen frei, die darauf beruhen, dass für eine Übermittlung keine wirksame Einwilligung vorlag."),
  ];
}
function schluss(): AngebotZiffer["absaetze"] {
  return [
    p("Dieser Vertrag ist ein Geschäft unter Unternehmern; ein Widerrufsrecht für Verbraucher besteht nicht. Allgemeine Geschäftsbedingungen einer Partei gelten nicht."),
    p("Änderungen und Ergänzungen bedürfen der Textform. Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts; es gelten die gesetzlichen Gerichtsstände. Sollten einzelne Bestimmungen unwirksam sein oder werden, bleibt die Gültigkeit im Übrigen unberührt; an die Stelle der unwirksamen Bestimmung treten die gesetzlichen Vorschriften."),
  ];
}
const vertraulich = (): AngebotZiffer["absaetze"] => [p("Beide Parteien behandeln die Bedingungen dieses Vertrags und alle nicht öffentlichen Informationen der anderen Partei vertraulich, auch nach dem Ende des Vertrags.")];

// ═══════════════════════════════════════════════════════════════════════════
// MODELL „PLATZ“ — RECHT UND STEUERN
// ═══════════════════════════════════════════════════════════════════════════
export function koopPlatzPraeambel(d: KoopModellDaten): string[] {
  const b = KOOP_BEREICH[d.parameter.bereich];
  return [
    "FIAON begleitet Menschen dabei, ihre Finanzen zu ordnen und neu aufzubauen. Viele von ihnen stehen dabei vor Fragen, die nur eine rechtlich bzw. steuerlich befugte Fachperson beantworten darf.",
    `Der Partner ist ${d.parameter.bereich === "recht" ? "als Rechtsanwältin oder Rechtsanwalt" : "als Steuerberater oder Lohnsteuerhilfeverein"} tätig. Die Parteien vereinbaren einen Partnerplatz im Bereich „${b.name}“ des FIAON Partner-Netzwerks: FIAON nennt den Partner Kunden, die es wünschen, und organisiert Termine — gegen einen festen monatlichen Preis, der von Zahl, Art und Ausgang von Mandaten unabhängig ist.`,
  ];
}
export function koopPlatzZiffern(d: KoopModellDaten): AngebotZiffer[] {
  const par = d.parameter; const b = KOOP_BEREICH[par.bereich];
  const preis = koopModellEur(par.preisCents);
  const recht = par.bereich === "recht";
  const fach = recht ? "rechtlich" : "steuerlich";
  const mandat = recht ? "Mandat" : "Auftrag";
  return [
    { nr: 1, titel: "Vertragsparteien und Gegenstand", absaetze: [
      p(`Vertragsparteien sind ${fiaonZeile()}, und ${partnerZeile(d.partner)} (nachfolgend „Partner“). Der Partner schließt diesen Vertrag in Ausübung seiner selbstständigen beruflichen Tätigkeit (§ 14 BGB).`),
      p(`Gegenstand ist ein Partnerplatz im Bereich „${b.name}“ des FIAON Partner-Netzwerks für die Region ${par.region || "nach Vereinbarung in Textform"} und die Gebiete ${listeText(par.themen)}.`),
    ] },
    { nr: 2, titel: "Leistungen von FIAON", absaetze: [
      liste([
        `FIAON nennt den Partner Kunden aus der Region, die ein Anliegen in einem der Gebiete schildern und ausdrücklich eingewilligt haben, dass FIAON ihre Kontaktdaten an den Partner übermittelt`,
        "FIAON vereinbart auf Wunsch des Kunden einen Termin für ein Erstgespräch in den Zeiten, die der Partner freigegeben hat, und übermittelt Name, Telefonnummer, E-Mail-Adresse, das Gebiet, den Termin und eine kurze Notiz zum Anliegen",
        "FIAON stellt dem Partner einen Partnerbereich bereit, in dem er Zeiten freigibt und alle Termine und Rechnungen sieht",
      ], "FIAON erbringt folgende Leistungen:"),
      p(`Im Bereich „${b.name}“ vergibt FIAON je Region und Gebiet höchstens ${zahlwort(par.jeRegion)} Partnerplätze. FIAON kann einem Kunden neben dem Partner weitere Partner nennen; der Kunde wählt frei.`),
      p(`FIAON berät Kunden nicht ${fach}, prüft keine Erfolgsaussichten und wirkt an Mandat oder Auftrag nicht mit. FIAON fragt nur, welches Gebiet ein Anliegen betrifft. FIAON schuldet keine bestimmte Zahl an Nennungen, Terminen oder Mandaten.`),
    ] },
    { nr: 3, titel: "Vergütung", absaetze: [
      p(`Für den Partnerplatz zahlt der Partner FIAON ${preis} im Kalendermonat. Der Betrag ist ein Nettobetrag. FIAON sitzt im Vereinigten Königreich; für die Umsatzsteuer gilt das Reverse-Charge-Verfahren — Steuerschuldner ist der Partner (§ 13b UStG).`),
      p(`Die Vergütung ist das Entgelt für Sichtbarkeit, Nennung und Terminorganisation. Sie hängt nicht davon ab, ob, wie viele und welche Mandate oder Aufträge entstehen. Ein Entgelt oder ein sonstiger Vorteil für die Vermittlung einzelner Aufträge wird weder vereinbart noch gezahlt (${b.berufsrecht}). Der Partner gibt FIAON keine Auskunft über Mandate, und FIAON fragt nicht danach.`),
      p(`Der Partnerplatz beginnt am Ersten des auf die Annahme folgenden Kalendermonats; bis dahin ist er kostenfrei. FIAON rechnet jeweils zum Ersten eines Monats für diesen Monat ab; die Rechnung ist binnen ${zahlwort(par.zahlungszielTage)} Tagen nach Zugang per Überweisung zu zahlen.`),
      p(`Ist eine Rechnung ${zahlwort(par.ruhenNachTagen)} Tage nach Fälligkeit nicht bezahlt, ruht die Nennung des Partners bis zum Zahlungseingang; vereinbarte Termine bleiben bestehen. Die gesetzlichen Regeln zum Zahlungsverzug bleiben unberührt.`),
    ] },
    { nr: 4, titel: "Pflichten des Partners", absaetze: [
      liste([
        `${b.zulassung} und eine Berufshaftpflichtversicherung zu unterhalten und FIAON den Wegfall unverzüglich in Textform mitzuteilen`,
        "dem Kunden die Kosten des Erstgesprächs bzw. die Gebühren oder den Mitgliedsbeitrag vor Beginn der Tätigkeit zu nennen",
        "vereinbarte Termine wahrzunehmen oder rechtzeitig mit dem Kunden zu verlegen",
        `frei und allein nach Berufsrecht zu entscheiden, ob er ein ${mandat === "Mandat" ? "Mandat" : "Auftrag"} annimmt, und die Interessen des Kunden unabhängig von FIAON wahrzunehmen`,
        "auf die finanzielle Lage des Kunden Rücksicht zu nehmen, keinen Druck auszuüben und keine Leistungen anzubieten, deren Kosten der Kunde erkennbar nicht tragen kann",
        "nicht im Namen von FIAON aufzutreten, die Vergütung nach Ziffer 3 nicht an Kunden weiterzuberechnen und nicht darauf hinzuwirken, dass ein Kunde einen Vertrag mit FIAON beendet",
      ], "Der Partner verpflichtet sich,"),
    ] },
    { nr: 5, titel: "Unabhängigkeit und Berufsrecht", absaetze: [
      p("FIAON nimmt keinen Einfluss auf die Beratung, gibt dem Partner keine Weisungen und erhält keine Informationen aus Mandaten oder Aufträgen. Die berufsrechtlichen Pflichten des Partners, insbesondere die Verschwiegenheit, bleiben unberührt."),
      p("FIAON stellt den Partner gegenüber Kunden sachlich vor (Name, Gebiete, Ort, Art der Termine). Weitere Angaben veröffentlicht FIAON nur mit Zustimmung des Partners."),
    ] },
    { nr: 6, titel: "Datenschutz", absaetze: datenschutz("dem Partner") },
    { nr: 7, titel: "Laufzeit und Ende", absaetze: [
      p(`Der Vertrag beginnt mit der Annahme und läuft auf unbestimmte Zeit, mindestens ${zahlwort(par.mindestMonate)} Monate ab Beginn des Partnerplatzes. Danach kann jede Partei mit einer Frist von ${zahlwort(par.kuendigungTage)} Tagen zum Monatsende in Textform kündigen.`),
      p("Das Recht beider Parteien zur fristlosen Kündigung aus wichtigem Grund bleibt unberührt. Ein wichtiger Grund für FIAON liegt insbesondere vor, wenn der Partner seine Zulassung bzw. Bestellung verliert, gegen Ziffer 4 oder Ziffer 6 verstößt oder mit einer Rechnung länger als dreißig Tage in Verzug ist."),
    ] },
    { nr: 8, titel: "Haftung", absaetze: haftung() },
    { nr: 9, titel: "Vertraulichkeit", absaetze: vertraulich() },
    { nr: 10, titel: "Schlussbestimmungen", absaetze: schluss() },
  ];
}

// ═══════════════════════════════════════════════════════════════════════════
// MODELL „ABSCHLUSS“ — ENERGIE UND TELEFON & INTERNET
// ═══════════════════════════════════════════════════════════════════════════
export function koopAbschlussPraeambel(d: KoopModellDaten): string[] {
  const b = KOOP_BEREICH[d.parameter.bereich];
  const energie = d.parameter.bereich === "energie";
  return [
    `FIAON begleitet Menschen dabei, ihre Finanzen zu ordnen und neu aufzubauen. Viele von ihnen zahlen zu hohe ${energie ? "Abschläge für Strom und Gas" : "Preise für Handy und Internet"} oder werden bei einem neuen Vertrag allein wegen eines Bonitätseintrags abgewiesen.`,
    `Der Partner bietet ${energie ? "Strom und Gas für Haushaltskunden" : "Mobilfunk sowie Internet und Festnetz für Privatkunden"} an. Die Parteien vereinbaren, dass FIAON dem Partner Kunden mit ausdrücklicher Einwilligung übermittelt, die ${b.sparten ? listeText(b.sparten) : ""} neu abschließen möchten — gegen eine feste Vergütung je zustande gekommenem Vertrag.`,
  ];
}
export function koopAbschlussZiffern(d: KoopModellDaten): AngebotZiffer[] {
  const par = d.parameter; const b = KOOP_BEREICH[par.bereich];
  const energie = par.bereich === "energie";
  const [s1, s2] = b.sparten ?? ["", ""];
  const exkl = zahlwort(par.exklusivMonate);
  return [
    { nr: 1, titel: "Vertragsparteien und Gegenstand", absaetze: [
      p(`Vertragsparteien sind ${fiaonZeile()}, und ${partnerZeile(d.partner)} (nachfolgend „Partner“). Der Partner schließt diesen Vertrag in Ausübung seiner gewerblichen Tätigkeit (§ 14 BGB).`),
      p(`Gegenstand ist die Übermittlung von Kunden, die einen Vertrag über ${listeText(par.themen)} mit dem Partner schließen möchten und darin ausdrücklich eingewilligt haben (Ziffer 3), und die Vergütung für daraus entstehende Verträge (Ziffer 6).`),
    ] },
    { nr: 2, titel: "Rolle von FIAON", absaetze: [
      p("FIAON stellt den Kontakt her. FIAON berät nicht zu Tarifen, empfiehlt keinen bestimmten Tarif und schließt keine Verträge im Namen des Partners oder des Kunden. Ein Vertrag kommt allein zwischen dem Kunden und dem Partner zustande; über die Annahme entscheidet allein der Partner."),
      p("FIAON schuldet keine bestimmte Zahl an Übermittlungen oder Verträgen."),
    ] },
    { nr: 3, titel: "Der übermittelte Kunde", absaetze: [
      liste([
        "der Kunde ist volljährig und wohnt in Deutschland",
        "er hat FIAON ausdrücklich erlaubt, seine Kontaktdaten an den Partner zu übermitteln, und eingewilligt, dass der Partner ihn dazu telefonisch und per E-Mail kontaktiert; FIAON dokumentiert die Einwilligung mit Datum, Uhrzeit und Wortlaut",
        energie
          ? "sein Bedarf ist erfragt: Sparte, soweit bekannt Jahresverbrauch, Zählernummer und bisheriger Versorger"
          : "sein Bedarf ist erfragt: Sparte, gewünschter Leistungsumfang und, soweit gewünscht, die Mitnahme der Rufnummer",
        "für einen Rückruf des Partners ist ein Termin in einer Zeit vereinbart, die der Partner freigegeben hat",
      ], "Bei jeder Übermittlung liegt vor:"),
      p("FIAON übermittelt Vor- und Nachname, Anschrift, Telefonnummer, E-Mail-Adresse, die Sparte, den Rückruftermin und eine kurze Notiz zum Bedarf. Angaben zu Einkommen, Gesundheit oder Bonität übermittelt FIAON nicht."),
      p(`Jede Übermittlung ist exklusiv: FIAON übermittelt denselben Kunden zur selben Sparte für ${exkl} Monate keinem anderen Partner.`),
    ] },
    { nr: 4, titel: "Menge und Übermittlung", absaetze: [
      p("Der Partner nennt bei der Annahme, wie viele Übermittlungen er je Woche wünscht, und gibt die Zeiten für Rückrufe frei. Beides kann er jederzeit im Partnerbereich ändern."),
      p(`Bis die erste Monatsrechnung bezahlt ist, übermittelt FIAON höchstens ${zahlwort(par.startDeckel)} Kunden. Danach gilt allein die Wunschmenge.`),
      p("FIAON übermittelt jeden Kunden spätestens am Werktag vor dem Rückruftermin per E-Mail an die Adresse des Partners aus Ziffer 1 und im Partnerbereich."),
    ] },
    { nr: 5, titel: "Pflichten des Partners", absaetze: [
      liste([
        `die ${b.zulassung} zu unterhalten und FIAON Änderungen unverzüglich mitzuteilen`,
        "jeden Antrag eines übermittelten Kunden einzeln zu prüfen und ihn nicht allein wegen eines Eintrags bei einer Auskunftei abzulehnen; die Entscheidung über den Vertrag bleibt beim Partner",
        energie
          ? "Preise, Abschläge und Laufzeiten vor Vertragsschluss klar zu nennen, Abschläge am tatsächlichen Verbrauch auszurichten und keine unangemessenen Vorauszahlungen oder Sicherheiten zu verlangen"
          : "Monatspreis, Laufzeit und etwaige Gerätekosten vor Vertragsschluss klar zu nennen und keine Gerätebündel oder Tarife anzubieten, deren Kosten der Kunde erkennbar nicht tragen kann",
        "die gesetzlichen Informations- und Vertragspflichten gegenüber Verbrauchern zu erfüllen",
        "auf die finanzielle Lage des Kunden Rücksicht zu nehmen und keinen Druck auszuüben",
        "nicht im Namen von FIAON aufzutreten und die Vergütung nach Ziffer 6 nicht an Kunden weiterzuberechnen",
      ], "Der Partner verpflichtet sich,"),
    ] },
    { nr: 6, titel: "Vergütung, Meldung und Abrechnung", absaetze: [
      p(`Für jeden Abschluss zahlt der Partner FIAON ${koopModellEur(par.preisCents)} (${s1}) bzw. ${koopModellEur(par.zweitCents)} (${s2}). Die Beträge sind Nettobeträge; für die Umsatzsteuer gilt das Reverse-Charge-Verfahren — Steuerschuldner ist der Partner (§ 13b UStG).`),
      p(`Ein Abschluss ist ${b.abschluss}, den der Kunde binnen neunzig Tagen nach der Übermittlung mit dem Partner geschlossen hat. Für eine Übermittlung ohne Abschluss entsteht keine Vergütung.`),
      p(`Der Partner meldet jeden Abschluss binnen vierzehn Tagen, nachdem ${energie ? "der Lieferbeginn bestätigt ist" : "die Widerrufsfrist abgelaufen ist"}, im Partnerbereich. FIAON rechnet zum Ende jedes Kalendermonats über alle in diesem Monat gemeldeten Abschlüsse ab, mit einer Aufstellung; die Rechnung ist binnen ${zahlwort(par.zahlungszielTage)} Tagen nach Zugang per Überweisung zu zahlen.`),
      p("FIAON kann einmal im Kalendervierteljahr in Textform eine Aufstellung aller Verträge verlangen, die mit übermittelten Kunden zustande gekommen sind; der Partner versichert ihre Vollständigkeit. Ergibt sich ein nicht gemeldeter Abschluss, wird er nachberechnet."),
      p(`Endet ein Vertrag vor ${energie ? "dem Lieferbeginn" : "Ablauf der Widerrufsfrist"}, entsteht keine Vergütung. Eine spätere Kündigung durch den Kunden lässt eine entstandene Vergütung unberührt.`),
      p(`Ist eine Rechnung ${zahlwort(par.ruhenNachTagen)} Tage nach Fälligkeit nicht bezahlt, ruht die Übermittlung neuer Kunden bis zum Zahlungseingang. Die gesetzlichen Regeln zum Zahlungsverzug bleiben unberührt.`),
    ] },
    { nr: 7, titel: "Datenschutz", absaetze: datenschutz("dem Partner") },
    { nr: 8, titel: "Laufzeit und Ende", absaetze: [
      p(`Der Vertrag beginnt mit der Annahme und läuft auf unbestimmte Zeit. Jede Partei kann ihn mit einer Frist von ${zahlwort(par.kuendigungTage)} Tagen in Textform kündigen. Für Kunden, die bis zum Ende übermittelt wurden, gilt Ziffer 6 weiter.`),
      p("Das Recht beider Parteien zur fristlosen Kündigung aus wichtigem Grund bleibt unberührt. Ein wichtiger Grund für FIAON liegt insbesondere vor, wenn der Partner gegen Ziffer 5 oder Ziffer 7 verstößt, Abschlüsse nicht meldet oder mit einer Rechnung länger als dreißig Tage in Verzug ist."),
    ] },
    { nr: 9, titel: "Haftung", absaetze: haftung() },
    { nr: 10, titel: "Vertraulichkeit", absaetze: vertraulich() },
    { nr: 11, titel: "Schlussbestimmungen", absaetze: schluss() },
  ];
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE ANGEBOTSSEITE JE MODELL (Struktur wie KoopSeite in shared/fiaon-global-angebot-koop.ts)
// ═══════════════════════════════════════════════════════════════════════════
export interface KoopModellSeite {
  hero: { auge: string; titel: string; lead: string; nutzen: string[]; preis: string; preisZeile: string; preisFein: string };
  rechner: { titel: string; sub: string; woche: string; monat: string; fein: string; festMonat: string };
  ablauf: { titel: string; sub: string; liste: FirmaPhase[] };
  kontakt: { titel: string; sub: string; felder: { titel: string; text: string }[]; themenTitel: string };
  leistungen: { titel: string; sub: string; karten: FirmaLeistung[] };
  sauber: { titel: string; sub: string; punkte: { titel: string; text: string }[] };
  fragen: FirmaFrage[];
  zeile: string;
  uebersicht: { label: string; wert: string }[];
  annahme: { wunsch: string; wunschUnter: string; wunschEinheit: string; unterKnopf: string; fertigText: (email: string, menge: number) => string; fertigZahlung: string };
  vermerk: (wunsch: number) => string[];
  auftaktZeile: string;
}
export function koopModellSeite(d: KoopModellDaten): KoopModellSeite {
  const par = d.parameter; const b = KOOP_BEREICH[par.bereich];
  const modell = koopModellVon(par.bereich);
  const preis = koopModellEur(par.preisCents); const zweit = koopModellEur(par.zweitCents);
  if (modell === "platz") {
    const recht = par.bereich === "recht";
    return {
      auftaktZeile: "Ihr Platz im FIAON Partner-Netzwerk.",
      hero: {
        auge: b.marke, titel: recht ? "Menschen mit einer klaren Frage — und Ihre Kanzlei als Name, den wir nennen." : "Belege, Fristen, offene Jahre — und Ihre Kanzlei als Name, den wir nennen.",
        lead: `Ein fester Partnerplatz für ${par.region || "Ihre Region"}: Wir nennen Ihre Kanzlei Kunden, die es wünschen, und tragen Erstgespräche direkt in Ihre freien Zeiten ein. Ein Preis im Monat — unabhängig von jedem Mandat.`,
        nutzen: [`Höchstens ${zahlwort(par.jeRegion)} Kanzleien je Region und Gebiet`, "Termine in Ihren freigegebenen Zeiten", "Berufsrechtlich sauber: nie ein Entgelt je Mandat"],
        preis, preisZeile: "Partnerplatz im Monat, netto",
        preisFein: `Beginn am Ersten des Folgemonats — bis dahin kostenfrei · Mindestlaufzeit ${zahlwort(par.mindestMonate)} Monate, danach monatlich kündbar`,
      },
      rechner: { titel: "Ihr Partnerplatz", sub: `Wie viele ${b.einheit} können Sie je Woche anbieten? Wir planen danach — der Preis bleibt gleich.`, woche: `${b.einheit} je Woche`, monat: "Ihr Preis im Monat (netto)", fein: "Fest im Monat, unabhängig von Zahl, Art und Ausgang der Mandate.", festMonat: preis },
      ablauf: { titel: "So läuft es", sub: "Vom Anliegen des Kunden bis in Ihren Kalender.", liste: [
        { nr: 1, titel: "Anliegen", dauer: "im Gespräch", text: `Der Kunde schildert sein Anliegen — wir ordnen nur das Gebiet zu, ${recht ? "rechtlich" : "steuerlich"} beraten wir nicht.` },
        { nr: 2, titel: "Einwilligung", dauer: "zuerst", text: "Er stimmt ausdrücklich zu, dass wir Ihre Kanzlei nennen und Kontaktdaten übermitteln." },
        { nr: 3, titel: "Termin", dauer: "in Ihren Zeiten", text: "Wir vereinbaren das Erstgespräch in den Zeiten, die Sie freigeben." },
        { nr: 4, titel: "Übermittlung", dauer: "spätestens am Vortag", text: "Name, Telefon, E-Mail, Gebiet, Termin und eine kurze Notiz — per E-Mail und im Partnerbereich." },
        { nr: 5, titel: "Ihr Mandat", dauer: "Ihre Entscheidung", text: "Ob und wie Sie übernehmen, entscheiden allein Sie und der Kunde." }, // kein Preis-Abzeichen am Mandat (§ 49b Abs. 3 BRAO, § 9 StBerG)
      ] },
      kontakt: { titel: "Was Sie zu jedem Termin bekommen", sub: "Vorbereitet und mit Einwilligung.", felder: [
        { titel: "Einwilligung", text: "ausdrücklich, dokumentiert, auf Anfrage nachgewiesen" },
        { titel: "Gebiet", text: "aus dem Gespräch mit unserem Team" },
        { titel: "Fester Termin", text: "in Ihren freigegebenen Zeiten" },
        { titel: "Kontaktdaten", text: "Name, Telefon, E-Mail und eine kurze Notiz" },
      ], themenTitel: "Ihre Gebiete" },
      leistungen: { titel: "Fair und sauber", sub: "Klare Regeln für Ihren Partnerplatz.", karten: [
        { schluessel: "vertrieb", titel: "Wenige Plätze", text: `Höchstens ${zahlwort(par.jeRegion)} Kanzleien je Region und Gebiet — Sie werden genannt, nicht gelistet.`, punkte: ["Kunde wählt frei", "Keine langen Listen", "Termine in Ihren Zeiten"] },
        { schluessel: "strategie", titel: "Berufsrecht", text: `Ein fester Preis für Sichtbarkeit und Terminorganisation — kein Entgelt je Mandat (${b.berufsrecht}).`, punkte: ["Keine Erfolgsbeteiligung", "Keine Auskunft über Mandate", "Unabhängig von FIAON"] },
        { schluessel: "plattform", titel: "Planbar", text: `${preis} netto im Monat, Rechnung zum Monatsersten.`, punkte: ["Erster Monat bis zum Monatsende frei", `Mindestlaufzeit ${zahlwort(par.mindestMonate)} Monate`, "Danach monatlich kündbar"] },
      ] },
      sauber: { titel: "Sauber aufgestellt", sub: "Damit die Zusammenarbeit lange trägt.", punkte: [
        { titel: "Klare Rollen", text: `FIAON nennt Ihre Kanzlei und vereinbart Termine. Beratung und ${recht ? "Mandat" : "Auftrag"} liegen allein bei Ihnen.` },
        { titel: "Kosten vorab", text: "Sie nennen dem Kunden die Kosten des Erstgesprächs, bevor es beginnt — so entsteht Vertrauen." },
        { titel: "Mit Rücksicht", text: "Viele unserer Kunden ordnen gerade ihre Finanzen. Bitte nur, was zur Lage passt und tragbar ist." },
      ] },
      fragen: [
        { frage: "Warum zahle ich nicht je Mandat?", antwort: [`Weil das berufsrechtlich unzulässig wäre (${b.berufsrecht}). Der Partnerplatz ist ein fester Preis für Sichtbarkeit und Terminorganisation.`] },
        { frage: "Wann beginnt der Partnerplatz?", antwort: ["Am Ersten des Monats nach Ihrer Annahme. Termine bis dahin sind kostenfrei."] },
        { frage: "Wie viele Kanzleien teilen sich eine Region?", antwort: [`Höchstens ${zahlwort(par.jeRegion)} je Region und Gebiet. Der Kunde wählt frei.`] },
        { frage: "Sagt FIAON eine Zahl an Mandaten zu?", antwort: ["Nein. Wir vereinbaren Termine mit Kunden, die es wünschen — ob ein Mandat entsteht, entscheiden Sie und der Kunde."] },
        { frage: "Wie komme ich wieder raus?", antwort: [`Nach ${zahlwort(par.mindestMonate)} Monaten monatlich, mit ${zahlwort(par.kuendigungTage)} Tagen Frist zum Monatsende.`] },
      ],
      zeile: `${preis} netto im Monat · ${par.region || "Region offen"} · ${par.themen.length} Gebiete`,
      uebersicht: [
        { label: "Leistung", wert: `Partnerplatz „${b.name}“: Nennung gegenüber Kunden mit Einwilligung, Terminorganisation, Partnerbereich` },
        { label: "Region und Gebiete", wert: `${par.region || "nach Vereinbarung"} · ${listeText(par.themen)}` },
        { label: "Vergütung", wert: `${preis} netto im Monat (Reverse Charge) — nie ein Entgelt je Mandat` },
        { label: "Beginn", wert: "am Ersten des Folgemonats, bis dahin kostenfrei" },
        { label: "Laufzeit", wert: `mindestens ${zahlwort(par.mindestMonate)} Monate, danach mit ${zahlwort(par.kuendigungTage)} Tagen zum Monatsende kündbar` },
        { label: "Widerruf", wert: "Geschäft unter Unternehmern — kein Widerrufsrecht für Verbraucher" },
      ],
      annahme: {
        wunsch: `Wie viele ${b.einheit} können Sie je Woche anbieten?`, wunschUnter: "Jederzeit änderbar — der Preis bleibt gleich.", wunschEinheit: "je Woche",
        unterKnopf: `Mit dem Klick vereinbaren Sie den Partnerplatz. Heute wird nichts fällig: ${preis} netto im Monat ab dem Ersten des Folgemonats.`,
        fertigText: (email: string) => `Ihr Partnerplatz beginnt am Ersten des nächsten Monats. Ihren Vertrag schicken wir an ${email}; Ihren Partnerbereich bekommen Sie in Kürze per E-Mail.`,
        fertigZahlung: "Heute ist nichts zu zahlen. Die erste Rechnung kommt am Ersten des Folgemonats.",
      },
      vermerk: (w) => [`Gewünschte Menge (Ziffer 2): ${w} ${b.einheit} je Woche`, `Vergütung (Ziffer 3): ${preis} netto im Monat ab dem Ersten des Folgemonats, Mindestlaufzeit ${zahlwort(par.mindestMonate)} Monate`],
    };
  }
  // „abschluss“
  const energie = par.bereich === "energie";
  const [s1, s2] = b.sparten ?? ["", ""];
  return {
    auftaktZeile: energie ? "Neue Kunden für Strom und Gas." : "Neue Kunden für Mobilfunk und Internet.",
    hero: {
      auge: b.marke, titel: energie ? "Haushalte, die wechseln wollen — mit Einwilligung und vollständigen Daten." : "Kunden, die einen Vertrag wirklich wollen — mit Einwilligung und klarem Bedarf.",
      lead: `Wir fragen bei unseren Kunden den Bedarf ab, holen die Einwilligung ein und vereinbaren Ihren Rückruf. Sie machen das Angebot — und zahlen nur, wenn ein Vertrag zustande kommt.`,
      nutzen: ["Bedarf erfragt, Einwilligung dokumentiert", "Exklusiv je Haushalt und Sparte", energie ? "Bezahlt erst mit bestätigtem Lieferbeginn" : "Bezahlt erst nach Aktivierung und Widerrufsfrist"],
      preis: `${preis} / ${zweit}`, preisZeile: `je Abschluss ${s1} / ${s2}, netto`,
      preisFein: `Abrechnung zum Monatsende · zahlbar binnen ${zahlwort(par.zahlungszielTage)} Tagen · ohne Grundgebühr, ohne Mindestmenge`,
    },
    rechner: { titel: "Ihre Menge", sub: "Wie viele Kunden möchten Sie je Woche übermittelt bekommen? Sie zahlen nur für Abschlüsse.", woche: "Kunden je Woche", monat: "Vergütung", fein: "Keine Grundgebühr, keine Mindestmenge — berechnet wird nur ein zustande gekommener Vertrag.", festMonat: `nur je Abschluss` },
    ablauf: { titel: "So läuft es", sub: "Vom Bedarf bis zum Vertrag.", liste: [
      { nr: 1, titel: "Bedarf", dauer: "im Gespräch", text: energie ? "Abschlag zu hoch, Vertrag läuft aus, abgewiesen: Wir erfragen Sparte, Verbrauch und Zählernummer." : "Kein eigener Vertrag oder ein viel zu teurer: Wir erfragen Sparte, Umfang und Rufnummernmitnahme." },
      { nr: 2, titel: "Einwilligung", dauer: "zuerst", text: "Der Kunde stimmt ausdrücklich zu, dass wir seine Daten an Sie übermitteln." },
      { nr: 3, titel: "Rückruf", dauer: "in Ihren Zeiten", text: "Wir vereinbaren Ihren Rückruf in den Zeiten, die Sie freigeben." },
      { nr: 4, titel: "Angebot", dauer: "Ihre Prüfung", text: "Sie prüfen einzeln und machen ein Angebot, das passt." },
      { nr: 5, titel: "Abschluss", dauer: energie ? "mit Lieferbeginn" : "nach Widerrufsfrist", text: "Sie melden den Abschluss im Partnerbereich — erst dann wird berechnet.", abzeichen: `${preis} / ${zweit}` },
    ] },
    kontakt: { titel: "Was Sie zu jedem Kunden bekommen", sub: "Vollständig und mit Einwilligung.", felder: [
      { titel: "Einwilligung", text: "ausdrücklich, dokumentiert, auf Anfrage nachgewiesen" },
      { titel: "Bedarf", text: energie ? "Sparte, Verbrauch, Zählernummer, bisheriger Versorger — soweit bekannt" : "Sparte, Umfang, Rufnummernmitnahme" },
      { titel: "Rückruftermin", text: "in Ihren freigegebenen Zeiten" },
      { titel: "Kontaktdaten", text: "Name, Anschrift, Telefon, E-Mail" },
    ], themenTitel: "Sparten" },
    leistungen: { titel: "Fair für beide Seiten", sub: "Bezahlt wird nur Erfolg.", karten: [
      { schluessel: "vertrieb", titel: "Exklusiv", text: `Jeder Kunde geht je Sparte nur an Sie — ${zahlwort(par.exklusivMonate)} Monate lang an niemanden sonst.`, punkte: ["Kein Wettbieten", "Keine Listen", "Rückruftermin steht"] },
      { schluessel: "strategie", titel: "Nur bei Abschluss", text: energie ? "Berechnet wird erst ein Vertrag mit bestätigtem Lieferbeginn." : "Berechnet wird erst ein aktivierter Vertrag nach Ablauf der Widerrufsfrist.", punkte: ["Storno vorher: nichts", "Kein Abschluss: nichts", "Meldung mit einem Klick"] },
      { schluessel: "plattform", titel: "Einfache Abrechnung", text: `${preis} (${s1}) bzw. ${zweit} (${s2}) netto je Abschluss, eine Rechnung zum Monatsende.`, punkte: ["Mit Aufstellung", `Zahlbar binnen ${zahlwort(par.zahlungszielTage)} Tagen`, "Keine Grundgebühr"] },
    ] },
    sauber: { titel: "Sauber aufgestellt", sub: "Damit die Zusammenarbeit lange trägt.", punkte: [
      { titel: "Einzelprüfung", text: "Sie prüfen jeden Antrag selbst — nur nicht allein wegen eines Bonitätseintrags ablehnen." },
      { titel: "Klare Preise", text: energie ? "Preise und Abschläge vorab, keine unangemessenen Vorauszahlungen." : "Monatspreis, Laufzeit und Gerätekosten vorab, keine untragbaren Bündel." },
      { titel: "Mit Rücksicht", text: "Viele unserer Kunden ordnen gerade ihre Finanzen. Bitte nur, was zur Lage passt." },
    ] },
    fragen: [
      { frage: "Was kostet ein Abschluss?", antwort: [`${preis} (${s1}) bzw. ${zweit} (${s2}) netto — nur für einen zustande gekommenen Vertrag.`] },
      { frage: "Wann zählt ein Vertrag als Abschluss?", antwort: [`Wenn ${b.abschluss} und der Kunde ihn binnen neunzig Tagen nach der Übermittlung geschlossen hat.`] },
      { frage: "Wie melde ich einen Abschluss?", antwort: ["Mit einem Klick im Partnerbereich beim jeweiligen Kunden. Am Monatsende kommt die Rechnung mit Aufstellung."] },
      { frage: "Muss ich jeden Kunden annehmen?", antwort: ["Nein. Sie prüfen jeden Antrag einzeln — nur nicht allein wegen eines Bonitätseintrags ablehnen."] },
      { frage: "Wie komme ich wieder raus?", antwort: [`Mit ${zahlwort(par.kuendigungTage)} Tagen Frist in Textform. Für bis dahin übermittelte Kunden gilt die Vergütung weiter.`] },
    ],
    zeile: `${preis} / ${zweit} netto je Abschluss · Start-Rahmen ${par.startDeckel} · Abrechnung zum Monatsende`,
    uebersicht: [
      { label: "Leistung", wert: `Übermittlung von Kunden mit Einwilligung und erfragtem Bedarf (${listeText(par.themen)}), exklusiv je Sparte` },
      { label: "Vergütung", wert: `${preis} (${s1}) bzw. ${zweit} (${s2}) netto je Abschluss (Reverse Charge) — keine Grundgebühr` },
      { label: "Abschluss", wert: b.abschluss ?? "" },
      { label: "Abrechnung", wert: `zum Monatsende über die gemeldeten Abschlüsse, zahlbar binnen ${zahlwort(par.zahlungszielTage)} Tagen` },
      { label: "Start-Rahmen", wert: `bis zur ersten bezahlten Rechnung höchstens ${zahlwort(par.startDeckel)} Übermittlungen` },
      { label: "Laufzeit", wert: `unbefristet, kündbar mit ${zahlwort(par.kuendigungTage)} Tagen Frist in Textform` },
    ],
    annahme: {
      wunsch: "Wie viele Kunden möchten Sie je Woche?", wunschUnter: `Jederzeit änderbar. Zum Start höchstens ${zahlwort(par.startDeckel)} Übermittlungen bis zur ersten bezahlten Rechnung.`, wunschEinheit: "je Woche",
      unterKnopf: `Mit dem Klick vereinbaren Sie die Kooperation. Heute wird nichts fällig: Sie zahlen ${preis} bzw. ${zweit} netto je Abschluss, abgerechnet zum Monatsende.`,
      fertigText: (email: string, menge: number) => `Wir übermitteln ab sofort bis zu ${menge} Kunden je Woche. Ihren Vertrag schicken wir an ${email}; Ihren Partnerbereich bekommen Sie in Kürze per E-Mail.`,
      fertigZahlung: "Heute ist nichts zu zahlen. Berechnet werden nur Abschlüsse, einmal im Monat mit Aufstellung.",
    },
    vermerk: (w) => [`Gewünschte Menge (Ziffer 4): ${w} Kunden je Woche — bis zur ersten bezahlten Rechnung höchstens ${par.startDeckel}`, `Vergütung (Ziffer 6): ${preis} (${s1}) bzw. ${zweit} (${s2}) netto je Abschluss, Abrechnung zum Monatsende`],
  };
}
