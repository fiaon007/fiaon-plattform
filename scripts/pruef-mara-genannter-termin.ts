// Prüfstand E-395 (19.10.2026): Mara erkennt einen Termin, den der Kunde mit uns hat — rein, ohne Datenbank.
// Aufruf: npx tsx scripts/pruef-mara-genannter-termin.ts
import {
  genannterTermin, tagGenannt, uhrzeitenGenannt, mitarbeiterGenannt, verkaufNebenTermin, sagtEingetragen,
  type TeamNotiz, type TerminMitarbeiter,
} from "../shared/fiaon-genannter-termin";

let gut = 0, schlecht = 0;
function ok(name: string, bed: boolean, info?: unknown) {
  if (bed) { gut++; console.log(`  ✓ ${name}`); }
  else { schlecht++; console.log(`  ✗ ${name}`, info !== undefined ? JSON.stringify(info) : ""); }
}

// Montag, 19.10.2026, 09:44 Berlin (= 07:44 UTC) — der Augenblick der Mail #7131.
const JETZT = new Date("2026-10-19T07:44:00Z");
const TEAM: TerminMitarbeiter[] = [
  { id: 8, vorname: "Daniel", nachname: "Stripling" },
  { id: 10, vorname: "Florentine", nachname: "Lombardi" },
  { id: 13, vorname: "Nikita", nachname: "Boychenko" },
  { id: 928, vorname: "Justin", nachname: "Schwarzott" },
];
const DANIEL_NOTIZ: TeamNotiz = { am: "2026-10-16T14:52:30Z", text: "Hat Interesse an unserem Global Konzept telefoniert am Montag 11 Uhr mit Justin.", agentId: 8, agentName: "Daniel Stripling" };
const g = (kundeText: string, extra: Partial<Parameters<typeof genannterTermin>[0]> = {}) =>
  genannterTermin({ kundeText, jetzt: JETZT, notizen: [DANIEL_NOTIZ], mitarbeiter: TEAM, bestehende: [], ...extra });

console.log("Hilfen");
ok("uhrzeitenGenannt „11.00 uhr“", uhrzeitenGenannt("heute um 11.00 uhr").includes("11:00"));
ok("uhrzeitenGenannt „11 am“", uhrzeitenGenannt("my call at 11 am today").includes("11:00"));
ok("uhrzeitenGenannt „2 pm“", uhrzeitenGenannt("at 2 pm").includes("14:00"));
ok("uhrzeitenGenannt „14h30“ (CH)", uhrzeitenGenannt("um 14h30").includes("14:30"));
ok("„Firmenkredit über 11.000“ ist keine Uhrzeit", uhrzeitenGenannt("Firmenkredit über 11.000 Franken").length === 0);
ok("tagGenannt heute", tagGenannt("heute um 11", JETZT)?.tag === "2026-10-19");
ok("tagGenannt morgen", tagGenannt("morgen um 14 Uhr", JETZT)?.tag === "2026-10-20");
ok("„Guten Morgen“ ist kein Tag", tagGenannt("Guten Morgen, wir telefonieren um 11", JETZT) === null);
ok("tagGenannt Donnerstag", tagGenannt("am Donnerstag", JETZT)?.tag === "2026-10-22");
ok("tagGenannt 23.10.", tagGenannt("am 23.10. um 10 Uhr", JETZT)?.tag === "2026-10-23");
ok("Montag-Notiz vom Freitag → 19.10.", tagGenannt(DANIEL_NOTIZ.text, new Date(DANIEL_NOTIZ.am))?.tag === "2026-10-19");
ok("mitarbeiterGenannt „mit Justin“", mitarbeiterGenannt("telefoniert mit Justin", TEAM) === 928);
ok("mitarbeiterGenannt „mit Herrn Stripling“", mitarbeiterGenannt("Gespräch mit Herrn Stripling", TEAM) === 8);
ok("mitarbeiterGenannt „mit meiner Bank“ → null", mitarbeiterGenannt("Termin mit meiner Bank", TEAM) === null);

console.log("Positiv — eintragen");
{
  const r = g("ja bitte stornieren, wir haben heute um 11.00 uhr ein neues gespräch für einen firmenkredit.");
  ok("Fall #7131: mit_uns", r.art === "mit_uns", r);
  ok("Fall #7131: belegt durch Daniels Notiz", r.beleg === "notiz" && r.notiz === DANIEL_NOTIZ, r);
  ok("Fall #7131: Teilnehmer Justin (928)", r.teilnehmerId === 928, r);
  ok("Fall #7131: 19.10. 11:00", r.wandzeit === "2026-10-19 11:00", r);
  ok("Fall #7131: Thema Global", r.thema === "global", r);
}
{
  const r = g("Wir sprechen morgen um 14 Uhr mit Herrn Stripling, dann entscheide ich.", { notizen: [] });
  ok("„morgen 14 Uhr mit Herrn Stripling“ → mit_uns, Daniel", r.art === "mit_uns" && r.teilnehmerId === 8 && r.beleg === "kunde" && r.wandzeit === "2026-10-20 14:00", r);
}
{
  const r = g("Ich habe heute um 11:15 ein Telefonat mit Ihrem Berater.", { notizen: [] });
  ok("11:15 außerhalb des Rasters, „mit Ihrem Berater“ → mit_uns ohne Namen", r.art === "mit_uns" && r.teilnehmerId === null && r.wandzeit === "2026-10-19 11:15", r);
}
{
  const r = g("I have my call with Mr Schwarzott at 11 am today.", { notizen: [] });
  ok("Englisch → mit_uns, Justin", r.art === "mit_uns" && r.teilnehmerId === 928, r);
}
{
  const r = g("wir haben heute um 11 uhr das gespräch", {
    bestehende: [{ id: 1900, beginn: "2026-10-19T09:00:00Z", agentId: 928, status: "gebucht" }],
  });
  ok("Termin steht schon (±30 Min.) → steht_schon, kein zweiter", r.art === "steht_schon" && r.bestehend?.id === 1900, r);
}
{
  const r = g("Wir telefonieren am Donnerstag um 15 Uhr mit Florentine.", { notizen: [] });
  ok("Wochentag + Name → Donnerstag 22.10. 15:00 bei Florentine", r.art === "mit_uns" && r.wandzeit === "2026-10-22 15:00" && r.teilnehmerId === 10, r);
}

console.log("Negativ — nichts eintragen");
{
  const r = g("Ich habe heute um 11 Uhr einen Termin bei meiner Hausbank.", { notizen: [] });
  ok("Hausbank → dritte", r.art === "dritte", r);
}
{
  const r = g("Morgen um 10 Uhr habe ich ein Gespräch beim Notar.", { notizen: [] });
  ok("Notar → dritte", r.art === "dritte", r);
}
{
  const r = g("Rufen Sie mich bitte um 17 Uhr an.", { notizen: [] });
  ok("Rückrufwunsch → keiner (läuft über rueckruf_am)", r.art === "keiner", r);
}
{
  const r = g("Ich hatte gestern um 11 ein Gespräch mit Ihrem Kollegen.", { notizen: [] });
  ok("gestern → vergangen", r.art === "vergangen", r);
}
{
  const r = g("Um 11 habe ich einen Termin, danach melde ich mich.", { notizen: [] });
  ok("„um 11 einen Termin“ ohne Bezug → unklar", r.art === "unklar", r);
}
{
  const r = g("Es geht um einen Firmenkredit über 11.000 Franken.", { notizen: [] });
  ok("keine Uhrzeit → keiner", r.art === "keiner", r);
}
{
  const r = g("Danke für die Info.", { notizen: [] });
  ok("kein Gesprächswort → keiner", r.art === "keiner", r);
}
{
  const r = g("Heute um 15 Uhr habe ich einen Termin bei der Bank.", {
    notizen: [{ am: "2026-10-15T10:00:00Z", text: "Rückruf am Donnerstag um 15 Uhr.", agentId: 8, agentName: "Daniel Stripling" }],
  });
  ok("Notiz mit anderem Tag belegt nicht → dritte", r.art === "dritte" && r.notiz === null, r);
}
{
  const r = g("Wir haben heute um 11 Uhr ein Gespräch.", {
    notizen: [{ am: "2026-10-16T14:52:30Z", text: "Termin am Montag 11 Uhr", agentId: null, agentName: "Postmeister" }],
  });
  ok("Automatik-Notiz (Postmeister) ist kein Beleg → unklar", r.art === "unklar", r);
}
{
  const r = g("Wir haben heute um 11 Uhr ein Gespräch.", {
    notizen: [{ am: "2026-09-20T10:00:00Z", text: "Gespräch Montag 11 Uhr", agentId: 8, agentName: "Daniel Stripling" }],
  });
  ok("Notiz älter als 14 Tage ist kein Beleg → unklar", r.art === "unklar", r);
}
{
  const r = g("wir haben am 20.11. um 11 Uhr ein Gespräch mit Ihnen", { notizen: [] });
  ok("mehr als 14 Tage voraus → unklar", r.art === "unklar", r);
}

console.log("Antwort-Prüfung");
ok("Verkauf erkannt: „Visa-Kreditkarte“", !!verkaufNebenTermin("Wenn Sie später doch zu Ihrer eigenen Visa-Kreditkarte starten möchten, schreiben Sie mir."));
ok("„Firmenkredit“ ist kein Verkauf", verkaufNebenTermin("Für Ihr Gespräch zum Firmenkredit heute um 11 Uhr alles Gute!") === null);
ok("Bestätigung ohne Verkauf bleibt frei", verkaufNebenTermin("Erledigt: Ihre Bestellung ist storniert, es bleibt nichts offen. Ihr Gespräch heute um 11 Uhr mit Herrn Schwarzott ist bei uns eingetragen — ich wünsche Ihnen ein richtig gutes Gespräch!") === null);
ok("„ist bei uns eingetragen“ erkannt", !!sagtEingetragen("Ihr Gespräch heute um 11 Uhr mit Herrn Schwarzott ist bei uns eingetragen."));
ok("Glückwunsch ohne „eingetragen“ bleibt frei", sagtEingetragen("Für Ihren Termin heute um 11 Uhr wünsche ich Ihnen viel Erfolg!") === null);

console.log(`\n${gut} gut, ${schlecht} schlecht`);
if (schlecht) process.exit(1);
