// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: DER GESPRÄCHSKALENDER FÜR FIAON GLOBAL (17.09.2026, E-188)
//
// REIN: keine Datenbank, kein Netz, keine Uhr. Die Abschnitte 1–8 laden nur
// Dateien ohne Datenbank-Import — die Zeitrechnung (fiaon-global-zeiten.ts),
// die Texte (shared/fiaon-global-termin-texte.ts), die Wortwand, die
// Mailvorlage über den Motor und die Terminart-Marke. `jetzt` wird jeder
// Rechnung als Parameter gereicht; deshalb lassen sich die Tage der
// Zeitumstellung heute prüfen und nicht erst Ende Oktober. Abschnitt 9 lädt die
// Route — mit einer Datenbank-Adresse, die ins Leere zeigt (siehe unten).
//
// WAS ER BELEGT
//   1. Berlin-Zeit: Eine Wandzeit wird der richtige Weltzeitpunkt — im Sommer,
//      im Winter und an beiden Kanten der Zeitumstellung.
//   2. Zwei Stunden Vorlauf, auf die Minute.
//   3. Montag bis Freitag, 30-Minuten-Raster ab Fensterbeginn, 14 Tage.
//   4. Bestehende Termine sperren mit ihrer ECHTEN Dauer.
//   5. Der Tagesdeckel: vier Global-Gespräche, dann ist der Tag zu.
//   6. Das Angebot streut gleichmäßig und zeigt nie mehr, als der Tag aufnimmt.
//   7. Die Kalenderdatei ist gültiges iCalendar (CRLF, UTC, maskiert, gefaltet).
//   8. Jeder Satz an das Unternehmen besteht die Wortwand — Routen-Texte und
//      die Bestätigungsmail, gerendert mit derselben Funktion wie der Versand.
//   9. Die Tür (POST /termine, POST /anfrage) weist falsche Eingaben mit dem
//      richtigen Feld ab, der Honigtopf bekommt ein Ja ohne Termin, die Bremse
//      greift — alles VOR der ersten Datenbankabfrage.
//
// ZU PUNKT 9: Die Route lädt den Datenbank-Pool (er verbindet sich erst bei der
// ersten Abfrage). Damit dieser Prüfstand die Produktion unter KEINEN
// Umständen erreicht, überschreibt er DATABASE_URL vor dem Laden mit einer
// Adresse, hinter der nichts lauscht (127.0.0.1, Port 9) — auch dann, wenn
// jemand ihn mit geladener .env startet. Geprüft werden nur Wege, die vor jeder
// Abfrage antworten; käme doch eine, scheiterte sie lokal und der Fall wäre rot.
//
//   npx tsx scripts/pruef-global-termin.ts
// ═══════════════════════════════════════════════════════════════════════════
import {
  globalZeitenRechnen, globalAngebot, gleichmaessig, kalendertagPlus, globalKalenderDatei,
  GLOBAL_DAUER_MIN, GLOBAL_PRO_TAG, GLOBAL_HORIZONT_TAGE, GLOBAL_VORLAUF_STUNDEN,
  type GlobalFenster, type GlobalBelegung,
} from "../server/lib/fiaon-global-zeiten";
import { berlinZeitpunkt, berlinDatum, berlinWochentag } from "../server/lib/fiaon-time";
import { GLOBAL_TEXTE, globalText } from "../shared/fiaon-global-termin-texte";
import { wandPruefen } from "../shared/fiaon-wortverbote";
import { terminArtAusQuelle } from "../shared/fiaon-termin-art";
import { mailRendern } from "../server/mail/motor";
import { MAKE_EVENT_REGISTRY } from "../server/make-events-registry";

let gut = 0;
let schlecht = 0;
const log = (s = "") => console.log(s);
function ok(text: string, bedingung: boolean, fund = ""): void {
  if (bedingung) { gut++; log(`  ok    ${text}`); }
  else { schlecht++; log(`  ROT   ${text}${fund ? `  →  ${fund}` : ""}`); }
}
function titel(t: string): void { log(`\n${"─".repeat(74)}\n${t}\n${"─".repeat(74)}`); }

// Mo–Fr 09:00–12:00 und 14:00–17:00, dazu ein Samstagsfenster, das NICHT gelten darf.
const FENSTER: GlobalFenster[] = [
  ...[1, 2, 3, 4, 5].flatMap((w) => [
    { wochentag: w, von: "09:00", bis: "12:00", aktiv: true },
    { wochentag: w, von: "14:00", bis: "17:00", aktiv: true },
  ]),
  { wochentag: 6, von: "09:00", bis: "12:00", aktiv: true },
];
const zeitenAm = (erg: ReturnType<typeof globalZeitenRechnen>, tag: string) => erg.frei.filter((f) => f.tag === tag).map((f) => f.zeit);

// ───────────────────────────────────────────────────────────────────────────
titel("1 · Berlin-Zeit — Sommer, Winter und beide Kanten der Zeitumstellung");
// ───────────────────────────────────────────────────────────────────────────
ok("Sommer: 17.09.2026 09:00 Berlin = 07:00 UTC", berlinZeitpunkt("2026-09-17", 540).toISOString() === "2026-09-17T07:00:00.000Z");
ok("Winter: 15.01.2027 09:00 Berlin = 08:00 UTC", berlinZeitpunkt("2027-01-15", 540).toISOString() === "2027-01-15T08:00:00.000Z");
ok("Freitag VOR der Umstellung (23.10.2026) 15:00 = 13:00 UTC", berlinZeitpunkt("2026-10-23", 900).toISOString() === "2026-10-23T13:00:00.000Z");
ok("Montag NACH der Umstellung (26.10.2026) 09:00 = 08:00 UTC", berlinZeitpunkt("2026-10-26", 540).toISOString() === "2026-10-26T08:00:00.000Z");
ok("Montag nach der Frühjahrs-Umstellung (29.03.2027) 09:00 = 07:00 UTC", berlinZeitpunkt("2027-03-29", 540).toISOString() === "2027-03-29T07:00:00.000Z");
ok("Wochentag: 17.09.2026 ist ein Donnerstag (4)", berlinWochentag("2026-09-17") === 4);
ok("Kalendertag +1 über die 25-Stunden-Nacht: 25.10. → 26.10.", kalendertagPlus("2026-10-25", 1) === "2026-10-26");
ok("Kalendertag über den Monatswechsel: 30.09. + 2 = 02.10.", kalendertagPlus("2026-09-30", 2) === "2026-10-02");

{
  // Freitag, 23.10.2026, 12:00 Berlin (10:00 UTC). Sonntag darauf wird die Uhr zurückgestellt.
  const jetzt = new Date("2026-10-23T10:00:00.000Z");
  const erg = globalZeitenRechnen({ jetzt, fenster: FENSTER, belegt: [] });
  const fr = erg.frei.filter((f) => f.tag === "2026-10-23");
  const mo = erg.frei.filter((f) => f.tag === "2026-10-26");
  ok("Freitag vor der Umstellung: 14:00 Berlin steht als 12:00 UTC da", fr.some((f) => f.zeit === "14:00" && f.beginn === "2026-10-23T12:00:00.000Z"), JSON.stringify(fr[0]));
  ok("Montag danach: 09:00 Berlin steht als 08:00 UTC da (Winterzeit)", mo.some((f) => f.zeit === "09:00" && f.beginn === "2026-10-26T08:00:00.000Z"), JSON.stringify(mo[0]));
  ok("Montag danach hat das volle Raster (12 Zeiten)", mo.length === 12, String(mo.length));
  ok("Samstag und Sonntag der Umstellung bieten nichts an", !erg.frei.some((f) => f.tag === "2026-10-24" || f.tag === "2026-10-25"));
  ok("jede Zeit liest sich in Berlin wieder als ihr eigener Tag", erg.frei.every((f) => berlinDatum(new Date(f.beginn)) === f.tag));
  ok("kein Zeitpunkt doppelt", new Set(erg.frei.map((f) => f.beginn)).size === erg.frei.length);
}
{
  // Sonntag der Umstellung selbst, 00:30 Berlin (noch Sommerzeit): „jetzt + n × 24 h"
  // träfe den Sonntag zweimal und verlöre den letzten Tag. Kalendertage nicht.
  const jetzt = new Date("2026-10-24T22:30:00.000Z");
  const erg = globalZeitenRechnen({ jetzt, fenster: FENSTER, belegt: [], tage: 2 });
  ok("Start in der Umstellungsnacht: Montag 26.10. ist erreichbar", zeitenAm(erg, "2026-10-26").length > 0);
  ok("… und nichts liegt jenseits von jetzt + 2 Tagen", erg.frei.every((f) => Date.parse(f.beginn) <= jetzt.getTime() + 2 * 86_400_000));
}

// ───────────────────────────────────────────────────────────────────────────
titel("2 · Zwei Stunden Vorlauf — auf die Minute");
// ───────────────────────────────────────────────────────────────────────────
{
  // Donnerstag, 17.09.2026, 09:00 Berlin.
  const jetzt = new Date("2026-09-17T07:00:00.000Z");
  const erg = globalZeitenRechnen({ jetzt, fenster: FENSTER, belegt: [] });
  const heute = zeitenAm(erg, "2026-09-17");
  ok("Vorgabe sind zwei Stunden", GLOBAL_VORLAUF_STUNDEN === 2);
  ok("um 09:00 ist 11:00 die erste Zeit (genau zwei Stunden voraus zählt)", heute[0] === "11:00", heute.join(","));
  ok("10:30 wird nicht angeboten", !heute.includes("10:30"));
  ok("11:30 ist die letzte Vormittagszeit (endet 12:00), 12:00 gibt es nicht", heute.includes("11:30") && !heute.includes("12:00"));
  const eineMinuteSpaeter = globalZeitenRechnen({ jetzt: new Date(jetzt.getTime() + 60_000), fenster: FENSTER, belegt: [] });
  ok("um 09:01 ist 11:00 weg, 11:30 die erste", zeitenAm(eineMinuteSpaeter, "2026-09-17")[0] === "11:30");
  const abends = globalZeitenRechnen({ jetzt: new Date("2026-09-17T16:00:00.000Z"), fenster: FENSTER, belegt: [] });
  ok("um 18:00 bietet der heutige Tag nichts mehr", zeitenAm(abends, "2026-09-17").length === 0);
}

// ───────────────────────────────────────────────────────────────────────────
titel("3 · Montag bis Freitag, Raster, Horizont, gepflegte Zeiten");
// ───────────────────────────────────────────────────────────────────────────
{
  const jetzt = new Date("2026-09-17T07:00:00.000Z");
  const erg = globalZeitenRechnen({ jetzt, fenster: FENSTER, belegt: [] });
  ok("Gesprächsdauer 30 Minuten, Horizont 14 Tage", GLOBAL_DAUER_MIN === 30 && GLOBAL_HORIZONT_TAGE === 14);
  ok("Samstag (19.09.) trotz Samstagsfenster: nichts", zeitenAm(erg, "2026-09-19").length === 0);
  ok("Sonntag (20.09.): nichts", zeitenAm(erg, "2026-09-20").length === 0);
  const fr = zeitenAm(erg, "2026-09-18");
  ok("Freitag: 12 Zeiten im 30-Minuten-Raster ab Fensterbeginn", fr.join(",") === "09:00,09:30,10:00,10:30,11:00,11:30,14:00,14:30,15:00,15:30,16:00,16:30", fr.join(","));
  ok("nichts jenseits von 14 Tagen", erg.frei.every((f) => Date.parse(f.beginn) <= jetzt.getTime() + 14 * 86_400_000));
  ok("der 14. Tag (01.10.) ist bis 09:00 dabei, 09:30 nicht mehr", zeitenAm(erg, "2026-10-01").join(",") === "09:00", zeitenAm(erg, "2026-10-01").join(","));
  const kurz = globalZeitenRechnen({ jetzt, fenster: FENSTER, belegt: [], tage: 3 });
  ok("?tage=3 zieht die Grenze enger, nie weiter", kurz.frei.every((f) => Date.parse(f.beginn) <= jetzt.getTime() + 3 * 86_400_000) && kurz.frei.length > 0);
  const weit = globalZeitenRechnen({ jetzt, fenster: FENSTER, belegt: [], tage: 99 });
  ok("?tage=99 bleibt bei 14 Tagen", weit.frei.length === erg.frei.length);

  const ohne = globalZeitenRechnen({ jetzt, fenster: [], belegt: [] });
  ok("keine Zeiten gepflegt = keine Termine, und es wird gesagt", ohne.frei.length === 0 && ohne.zeitenGepflegt === false);
  const inaktiv = globalZeitenRechnen({ jetzt, fenster: FENSTER.map((f) => ({ ...f, aktiv: false })), belegt: [] });
  ok("nur inaktive Fenster zählen wie keine", inaktiv.frei.length === 0 && inaktiv.zeitenGepflegt === false);
  const nurSamstag = globalZeitenRechnen({ jetzt, fenster: [{ wochentag: 6, von: "09:00", bis: "12:00" }], belegt: [] });
  ok("nur ein Samstagsfenster zählt wie keine gepflegten Zeiten", nurSamstag.zeitenGepflegt === false);
  const kaputt = globalZeitenRechnen({ jetzt, fenster: [{ wochentag: 1, von: "xx", bis: "12:00" }, { wochentag: 2, von: "11:45", bis: "12:00" }], belegt: [] });
  ok("unlesbare und zu kurze Fenster werden übergangen", kaputt.frei.length === 0);
  const ueberlappt = globalZeitenRechnen({ jetzt, fenster: [{ wochentag: 5, von: "09:00", bis: "11:00" }, { wochentag: 5, von: "10:00", bis: "12:00" }], belegt: [] });
  ok("überlappende Fenster bieten keine Zeit doppelt an", zeitenAm(ueberlappt, "2026-09-18").join(",") === "09:00,09:30,10:00,10:30,11:00,11:30", zeitenAm(ueberlappt, "2026-09-18").join(","));
}

// ───────────────────────────────────────────────────────────────────────────
titel("4 · Bestehende Termine sperren mit ihrer echten Dauer");
// ───────────────────────────────────────────────────────────────────────────
{
  const jetzt = new Date("2026-09-17T07:00:00.000Z");
  const belegt: GlobalBelegung[] = [
    // Freitag 18.09.: ein 20-Minuten-Vertriebsgespräch um 10:20 Berlin
    { beginn: berlinZeitpunkt("2026-09-18", 620), dauerMin: 20 },
    // und ein 15-Minuten-Startgespräch um 15:00
    { beginn: berlinZeitpunkt("2026-09-18", 900).toISOString(), dauerMin: 15 },
  ];
  const fr = zeitenAm(globalZeitenRechnen({ jetzt, fenster: FENSTER, belegt }), "2026-09-18");
  ok("10:20–10:40 sperrt 10:00 UND 10:30", !fr.includes("10:00") && !fr.includes("10:30"), fr.join(","));
  ok("09:30 (endet 10:00) und 11:00 bleiben frei", fr.includes("09:30") && fr.includes("11:00"));
  ok("15:00–15:15 sperrt 15:00, aber nicht 14:30 und 15:30", !fr.includes("15:00") && fr.includes("14:30") && fr.includes("15:30"));
  const ohneDauer = zeitenAm(globalZeitenRechnen({ jetzt, fenster: FENSTER, belegt: [{ beginn: berlinZeitpunkt("2026-09-18", 540), dauerMin: null }] }), "2026-09-18");
  ok("fehlt die Dauer, gelten 20 Minuten: 09:00 weg, 09:30 frei", !ohneDauer.includes("09:00") && ohneDauer.includes("09:30"));
  const muell = globalZeitenRechnen({ jetzt, fenster: FENSTER, belegt: [{ beginn: "kein datum" }] });
  ok("ein kaputter Zeitstempel sperrt nichts", zeitenAm(muell, "2026-09-18").length === 12);
}

// ───────────────────────────────────────────────────────────────────────────
titel("5 · Der Tagesdeckel — vier Global-Gespräche, dann ist der Tag zu");
// ───────────────────────────────────────────────────────────────────────────
{
  const jetzt = new Date("2026-09-17T07:00:00.000Z");
  const gespraech = (min: number, global: boolean): GlobalBelegung => ({ beginn: berlinZeitpunkt("2026-09-18", min), dauerMin: 30, zaehltAlsGlobal: global });
  ok("Vorgabe sind vier", GLOBAL_PRO_TAG === 4);
  const drei = globalZeitenRechnen({ jetzt, fenster: FENSTER, belegt: [gespraech(540, true), gespraech(600, true), gespraech(840, true)] });
  ok("drei gebucht: der Tag nimmt noch EINES auf", drei.restJeTag["2026-09-18"] === 1, JSON.stringify(drei.restJeTag["2026-09-18"]));
  ok("… frei sind die übrigen neun Zeiten", zeitenAm(drei, "2026-09-18").length === 9);
  ok("… das Angebot zeigt aber nur EINE", globalAngebot(drei).find((t) => t.tag === "2026-09-18")?.zeiten.length === 1);
  const vier = globalZeitenRechnen({ jetzt, fenster: FENSTER, belegt: [gespraech(540, true), gespraech(600, true), gespraech(840, true), gespraech(900, true)] });
  ok("vier gebucht: der Tag bietet nichts mehr", zeitenAm(vier, "2026-09-18").length === 0 && !("2026-09-18" in vier.restJeTag));
  ok("… der Montag danach ist unberührt", zeitenAm(vier, "2026-09-21").length === 12 && vier.restJeTag["2026-09-21"] === 4);
  const fremd = globalZeitenRechnen({ jetzt, fenster: FENSTER, belegt: [gespraech(540, false), gespraech(600, false), gespraech(840, false), gespraech(900, false)] });
  ok("vier ANDERE Termine sperren ihre Zeit, verbrauchen aber keinen Platz", fremd.restJeTag["2026-09-18"] === 4 && zeitenAm(fremd, "2026-09-18").length === 8);
  const zwei = globalZeitenRechnen({ jetzt, fenster: FENSTER, belegt: [], proTag: 2 });
  ok("der Deckel ist einstellbar (2)", zwei.restJeTag["2026-09-18"] === 2 && globalAngebot(zwei).every((t) => t.zeiten.length <= 2));
  // Ein Global-Gespräch um 23:30 Berlin am Donnerstag gehört zum Donnerstag, nicht zum UTC-Freitag … und umgekehrt.
  const nachts = globalZeitenRechnen({ jetzt, fenster: FENSTER, belegt: [{ beginn: new Date("2026-09-17T22:30:00.000Z"), dauerMin: 30, zaehltAlsGlobal: true }] });
  ok("der Deckel zählt den BERLINER Tag: 00:30 Berlin am 18.09. zählt für den 18.", nachts.restJeTag["2026-09-18"] === 3, JSON.stringify(nachts.restJeTag["2026-09-18"]));
}

// ───────────────────────────────────────────────────────────────────────────
titel("6 · Das Angebot streut gleichmäßig");
// ───────────────────────────────────────────────────────────────────────────
{
  const zwoelf = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"];
  ok("vier aus zwölf: erste, letzte und zwei dazwischen", gleichmaessig(zwoelf, 4).join(",") === "09:00,11:00,14:30,16:30", gleichmaessig(zwoelf, 4).join(","));
  ok("eine aus zwölf: die erste (keine Division durch null)", gleichmaessig(zwoelf, 1).join(",") === "09:00");
  ok("mehr Plätze als Zeiten: alle, unverändert", gleichmaessig(["09:00", "09:30"], 4).join(",") === "09:00,09:30");
  ok("null Plätze: nichts", gleichmaessig(zwoelf, 0).length === 0);
  ok("immer genau n, auch wenn die Rundung doppelt trifft", [2, 3, 5, 7, 11].every((n) => gleichmaessig(zwoelf, n).length === n && new Set(gleichmaessig(zwoelf, n)).size === n));
  const jetzt = new Date("2026-09-17T07:00:00.000Z");
  const erg = globalZeitenRechnen({ jetzt, fenster: FENSTER, belegt: [] });
  const angebot = globalAngebot(erg);
  ok("kein Tag zeigt mehr als vier Zeiten", angebot.every((t) => t.zeiten.length <= 4 && t.zeiten.length > 0));
  ok("jede gezeigte Zeit ist auch buchbar (steht in frei)", angebot.every((t) => t.zeiten.every((z) => erg.frei.some((f) => f.tag === t.tag && f.zeit === z))));
  ok("die Tage kommen aufsteigend, ohne Wochenende", angebot.map((t) => t.tag).join() === [...angebot.map((t) => t.tag)].sort().join() && angebot.every((t) => berlinWochentag(t.tag) <= 5));
  ok("dieselbe Eingabe, dasselbe Ergebnis", JSON.stringify(globalAngebot(globalZeitenRechnen({ jetzt, fenster: FENSTER, belegt: [] }))) === JSON.stringify(angebot));
}

// ───────────────────────────────────────────────────────────────────────────
titel("7 · Die Kalenderdatei");
// ───────────────────────────────────────────────────────────────────────────
{
  const ics = globalKalenderDatei({
    terminId: 4711, beginn: "2026-09-22T08:30:00.000Z", ansprechpartner: "Nikita Boychenko",
    telefon: "+49 30 1234567", stornoLink: "https://www.fiaon.com/termin/absagen/" + "ab".repeat(24) + "?anrede=sie",
    erstelltAm: new Date("2026-09-17T07:00:00.000Z"),
  });
  const zeilen = ics.split("\r\n");
  ok("Zeilenende CRLF, kein nacktes LF", !/[^\r]\n/.test(ics) && ics.endsWith("\r\n"));
  ok("Rahmen VCALENDAR/VEVENT vollständig", zeilen[0] === "BEGIN:VCALENDAR" && zeilen.includes("END:VEVENT") && zeilen[zeilen.length - 2] === "END:VCALENDAR");
  ok("Beginn und Ende in UTC, 30 Minuten", zeilen.includes("DTSTART:20260922T083000Z") && zeilen.includes("DTEND:20260922T090000Z"));
  ok("feste Kennung je Termin", zeilen.includes("UID:global-termin-4711@fiaon.com"));
  ok("Komma im Text maskiert, Zeilenumbruch als \\n", /DESCRIPTION:.*Sie brauchen nichts vorzubereiten/.test(ics.replace(/\r\n /g, "")) && ics.replace(/\r\n /g, "").includes("\\n"));
  ok("keine Zeile über 75 Oktette", zeilen.every((z) => Buffer.byteLength(z, "utf8") <= 75), zeilen.filter((z) => Buffer.byteLength(z, "utf8") > 75).join(" | "));
  ok("gefaltete Zeilen ergeben entfaltet wieder den Storno-Link", ics.replace(/\r\n /g, "").includes("?anrede=sie"));
  ok("Erinnerung 15 Minuten vorher", zeilen.includes("TRIGGER:-PT15M"));
}

// ───────────────────────────────────────────────────────────────────────────
titel("8 · Jeder Satz an das Unternehmen besteht die Wortwand");
// ───────────────────────────────────────────────────────────────────────────
// „Wir rufen Sie an" ist für die Wand eine ZUSAGE. Gedeckt ist sie hier durch
// den Auftrag an die zuständige Person, den Buchung und Anfrage im selben Lauf
// anlegen (auftragFuerKunden) — deshalb die Deckung „aufgabe_an_betreuer".
// OHNE Deckung muss die Wand anschlagen: Das belegt, dass sie hier wirklich
// prüft und nicht einfach durchwinkt.
const DECKUNG = ["aufgabe_an_betreuer"];
{
  for (const [sprache, texte] of Object.entries(GLOBAL_TEXTE)) {
    for (const [schluessel, satz] of Object.entries(texte)) {
      const text = globalText(satz, { datum: "22.09.2026", uhrzeit: "10:30", name: "Nikita Boychenko" });
      const funde = wandPruefen(text, DECKUNG);
      ok(`${sprache}.${schluessel}`, funde.length === 0, funde.map((f) => `${f.art}: „${f.treffer}“`).join(" / "));
      if (sprache === "de") ok(`${sprache}.${schluessel} siezt`, !/\b(du|dich|dir|dein\w*)\b/i.test(text), text);
      ok(`${sprache}.${schluessel} ohne offenen Platzhalter`, !/[{}]/.test(text), text);
    }
  }
  ok("Gegenprobe: ohne Deckung schlägt die Wand bei „wir rufen Sie an“ an", wandPruefen(GLOBAL_TEXTE.de.keinAngebot).some((f) => f.art === "zusage"));

  const def = MAKE_EVENT_REGISTRY.find((e) => e.type === "global_termin");
  ok("das Ereignis global_termin ist registriert", !!def);
  const mail = def ? mailRendern("global_termin", def.example) : null;
  ok("die Vorlage global_termin rendert", !!mail);
  if (mail) {
    ok("kein Platzhalter bleibt ohne Wert", mail.fehlend.length === 0, mail.fehlend.join(", "));
    ok("kein „{{params.“ im fertigen Text", !mail.text.includes("{{") && !mail.html.includes("{{params."));
    const funde = wandPruefen(`${mail.betreff}\n${mail.text}`, DECKUNG);
    ok("Betreff und Text bestehen die Wortwand", funde.length === 0, funde.map((f) => `${f.art}: „${f.treffer}“`).join(" / "));
    ok("die Mail siezt", !/\b(du|dich|dir|dein\w*)\b/i.test(mail.text), mail.text.match(/\b(du|dich|dir|dein\w*)\b/i)?.[0]);
    ok("Firma, Paketwunsch, Datum und Uhrzeit stehen drin", ["Beispiel GmbH", "Global Banking", "22.09.2026", "10:30"].every((w) => mail.text.includes(w)));
    ok("der Satz zur Entscheidung des Instituts steht drin", /entscheidet das jeweilige Institut/.test(mail.text));
    ok("beide Wege stehen drin: Kalenderdatei und Storno-Link", mail.text.includes(".ics") && mail.text.includes("/termin/absagen/"));
    const ohneKalender = mailRendern("global_termin", { ...def!.example, kalender_url: "" });
    ok("fehlt die Kalenderdatei, rückt der Storno-Knopf auf — kein toter Knopf", !!ohneKalender && !ohneKalender.html.includes("In den Kalender eintragen") && ohneKalender.html.includes("Termin verschieben oder absagen"));
  }

  const marke = terminArtAusQuelle("global");
  ok("die Terminart „global“ hat eine eigene Marke (nicht der Rückfall „Vertrieb“)", marke.art === "global" && marke.text === "FIAON Global", JSON.stringify(marke));
}

// ───────────────────────────────────────────────────────────────────────────
titel("9 · Die Tür — Eingaben, Honigtopf, Bremse (vor jeder Datenbankabfrage)");
// ───────────────────────────────────────────────────────────────────────────
process.env.DATABASE_URL = "postgres://pruefstand:pruefstand@127.0.0.1:9/nirgendwo";
{
  const { globalKontaktLesen, globalZuViel } = await import("../server/lib/fiaon-global-termin");
  const { default: router } = await import("../server/routes/fiaon-global-termin");

  const gut0 = { name: "Dr. Maria Beispiel", firma: "Beispiel GmbH", email: " M.Beispiel@Beispiel-GmbH.de ", telefon: "+49 30 1234567", paket: "global_banking", land: "at" };
  const k = globalKontaktLesen(gut0);
  ok("vollständige Eingabe wird gelesen", !("error" in k));
  if (!("error" in k)) {
    ok("E-Mail klein und ohne Ränder", k.email === "m.beispiel@beispiel-gmbh.de");
    ok("der Titel gehört nicht in den Vornamen", k.vorname === "Maria" && k.nachname === "Beispiel", `${k.vorname}/${k.nachname}`);
    ok("der Paketwunsch kommt aus dem Katalog — Name und Preis", k.paket === "global_banking" && k.paketText === "Global Banking (4.999 €)", String(k.paketText));
    ok("Land im Klartext", k.land === "Österreich");
    ok("Sprache ist Deutsch, wenn nichts anderes kommt", k.sprache === "de");
  }
  const unbekannt = globalKontaktLesen({ ...gut0, paket: "business_pro" });
  ok("ein fremdes Paket ist kein Fehler des Menschen — der Wunsch bleibt leer", !("error" in unbekannt) && unbekannt.paket === null && unbekannt.paketText === null);
  const einWort = globalKontaktLesen({ ...gut0, name: "Schmidt" });
  ok("ein einzelnes Wort als Name geht durch (Nachname)", !("error" in einWort) && einWort.nachname === "Schmidt" && einWort.vorname === null);
  for (const [feld, eingabe] of Object.entries({
    name: { ...gut0, name: " " }, firma: { ...gut0, firma: "X" }, email: { ...gut0, email: "maria@beispiel" }, telefon: { ...gut0, telefon: "12 34" },
  })) {
    const f = globalKontaktLesen(eingabe);
    ok(`fehlt/kaputt: ${feld} → Fehler mit feld „${feld}“`, "error" in f && f.feld === feld, JSON.stringify(f));
  }
  const englisch = globalKontaktLesen({ ...gut0, sprache: "en", firma: "" });
  ok("mit sprache=en kommt der Fehler auf Englisch", "error" in englisch && englisch.error === GLOBAL_TEXTE.en.fehlerFirma);

  ok("Bremse: drei Versuche je Adresse gehen, der vierte nicht",
    !globalZuViel("198.51.100.7", "a@x.de") && !globalZuViel("198.51.100.7", "b@x.de") && !globalZuViel("198.51.100.7", "c@x.de") && globalZuViel("198.51.100.7", "d@x.de"));
  ok("Bremse: dieselbe E-Mail zweimal in einer Minute geht nicht", !globalZuViel("198.51.100.8", "e@x.de") && globalZuViel("198.51.100.9", "e@x.de"));

  // Die Handler direkt rufen — ohne Server, ohne Port.
  const handler = (methode: string, pfad: string) => (router as any).stack
    .find((l: any) => l.route?.path === pfad && l.route.methods[methode])?.route.stack[0].handle as ((req: any, res: any) => Promise<void>) | undefined;
  const rufe = async (methode: string, pfad: string, body: any) => {
    const antwort: { status: number; json: any } = { status: 200, json: null };
    const res: any = { status(c: number) { antwort.status = c; return res; }, json(j: any) { antwort.json = j; return res; }, setHeader() { return res; } };
    const h = handler(methode, pfad);
    if (!h) throw new Error(`Route ${methode} ${pfad} fehlt`);
    await h({ body, query: {}, params: {}, headers: { "x-forwarded-for": "203.0.113.5" }, socket: {} }, res);
    return antwort;
  };
  ok("die vier Routen sind da", ["get /termine/frei", "post /termine", "post /anfrage", "get /termine/kalender/:datei"]
    .every((r) => !!handler(r.split(" ")[0], r.split(" ")[1])));

  const falle = await rufe("post", "/termine", { ...gut0, tag: "2026-09-22", zeit: "10:30", falle: "http://spam.example" });
  ok("Honigtopf (Buchung): ein freundliches Ja, kein Termin", falle.status === 200 && falle.json?.ok === true && falle.json?.terminId === null);
  const falle2 = await rufe("post", "/anfrage", { ...gut0, falle: "x" });
  ok("Honigtopf (Anfrage): ein freundliches Ja", falle2.status === 200 && falle2.json?.ok === true);
  const ohneFirma = await rufe("post", "/termine", { ...gut0, firma: "", tag: "2026-09-22", zeit: "10:30" });
  ok("Buchung ohne Firma: 400 mit feld „firma“", ohneFirma.status === 400 && ohneFirma.json?.ok === false && ohneFirma.json?.feld === "firma");
  const ohneZeit = await rufe("post", "/termine", { ...gut0, tag: "22.09.2026", zeit: "halb elf" });
  ok("Buchung mit unlesbarer Zeit: 400 mit feld „zeit“", ohneZeit.status === 400 && ohneZeit.json?.feld === "zeit" && ohneZeit.json?.error === GLOBAL_TEXTE.de.fehlerZeitWaehlen);
  const ohneMail = await rufe("post", "/anfrage", { ...gut0, email: "" });
  ok("Anfrage ohne E-Mail: 400 mit feld „email“", ohneMail.status === 400 && ohneMail.json?.feld === "email");
}

log(`\n${"═".repeat(74)}`);
log(schlecht === 0 ? `ALLE ${gut} PRÜFUNGEN GRÜN` : `${schlecht} ROT, ${gut} grün`);
process.exit(schlecht === 0 ? 0 : 1);
