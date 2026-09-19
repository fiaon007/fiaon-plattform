// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: FIAON GLOBAL — „MEIN AUFTRAG" (17.09.2026, E-188)
//
// Ohne Datenbank, ohne Netz, ohne Browser. Geprüft wird, was sich rechnen und
// lesen lässt — also alles, woran ein Firmenkunde sich später hält:
//
//   1. PFLICHTEN-REGELN je Bundesstaat und Rechtsform: Termine, Fenster von 18
//      Monaten, Jahreswechsel, Schaltjahr, nie ein Termin im Gründungsjahr, jeder
//      Hinweis endet mit dem Satz zu Steuerberater bzw. US-CPA, keine Beträge.
//   2. MONATLICHER DURCHGANG und Datumsrechnung (Monatsletzter, Jahreswechsel).
//   3. TEXTE: Etappen, Unterlagen, Dokumentarten, Kalender, Verlauf — jeder
//      deutsche Satz durch die Wortwand UND die schärferen Global-Regeln
//      (shared/fiaon-global-wortregeln.ts), jeder englische durch die Gegenprobe.
//      Die Etappentitel sind die von „Der Weg" auf /business.
//   4. UNTERLAGEN: eine Quelle — die Startmail liest dieselbe Liste.
//   5. MAILS: vier Ereignisse, je deutsch und englisch — gleiche Platzhalter,
//      gleiche Knöpfe, kein Platzhalter ohne Wert, kein Satz der Privatlinie.
//   6. TOKEN: an die Antragsnummer gebunden — auch der Link aus der Mail.
//   7. DATEITYP aus echten Magic Bytes — und Tarnungen (HTML als .pdf, SVG, EXE …).
//   8. DATEINAME: Pfad, Steuer- und Richtungszeichen, Überlänge, Kopfzeile.
//   9. ZUGRIFF im Office als reine Funktion; die Fenster-Drossel.
//  10. JAHRESBETREUUNG (19.09.2026, E-196): ab wann die Rechnung fürs zweite Jahr
//      gestellt wird (Gründungstag vor Start, 29.02., Jahreswechsel, Unsinn), und
//      dass der Tageslauf sie auch für abgeschlossene Aufträge stellt.
//
// Aufruf: npx tsx scripts/pruef-global-bereich.ts        (Exit 1 bei Fehlern)
// ═══════════════════════════════════════════════════════════════════════════

// Der Bestellweg lädt den Datenbank-Pool beim Import. Er verbindet sich erst bei der ersten
// Abfrage — und dieser Prüfstand stellt keine. Die Adresse zeigt trotzdem ins Leere.
process.env.DATABASE_URL = "postgres://pruefstand:ohne@127.0.0.1:1/keine-datenbank";

const B = await import("../shared/fiaon-global-bereich");
const { globalWortPruefen } = await import("../shared/fiaon-global-wortregeln");
const { globalMeinAuftragPfad, globalOfficeAuftragPfad } = await import("../shared/fiaon-global-wege");
const R = await import("../server/lib/fiaon-global-bereich-regeln");
const { GLOBAL_WOERTER } = await import("../client/src/i18n/global");
const { mailRendern, hatVorlage, VORLAGEN_EN } = await import("../server/mail/motor");
const { GLOBAL_BEREICH_PAARE } = await import("../server/mail/vorlagen/global-bereich");
const mailGlobal = await import("../server/mail/vorlagen/global");
const { MAKE_EVENT_REGISTRY } = await import("../server/make-events-registry");
const { LAUF_FOLGEN } = await import("../server/lib/fiaon-crons");
const auftrag = await import("../server/lib/fiaon-global-auftrag");

let fehler = 0; let geprueft = 0;
const ok = (bedingung: boolean, was: string) => { geprueft++; if (!bedingung) { fehler++; console.log(`  FEHLER  ${was}`); } };
const gleich = (ist: unknown, soll: unknown, was: string) => ok(JSON.stringify(ist) === JSON.stringify(soll), `${was} — erwartet ${JSON.stringify(soll)}, bekam ${JSON.stringify(ist)}`);
const abschnitt = (t: string) => console.log(`\n── ${t} ${"─".repeat(Math.max(3, 70 - t.length))}`);

// ═══ 1: PFLICHTEN-REGELN ════════════════════════════════════════════════════
abschnitt("Pflichten-Regeln je Bundesstaat");
const termine = (ein: Parameters<typeof B.globalPflichtFristen>[0], heute: string) => B.globalPflichtFristen(ein, heute).map((f) => `${f.regelKey}=${f.faelligAm}`);

gleich(termine({ bundesstaat: "DE", form: "LLC", gegruendetAm: "2026-10-01" }, "2026-10-02"),
  ["us_meldung:2027=2027-04-15", "staat:DE:2027=2027-06-01", "agent:2027=2027-10-01"], "Delaware LLC, gegründet 01.10.2026");
gleich(termine({ bundesstaat: "Delaware", form: "Corporation", gegruendetAm: "2026-10-01" }, "2026-10-02"),
  ["staat:DE:2027=2027-03-01", "us_meldung:2027=2027-04-15", "agent:2027=2027-10-01", "staat:DE:2028=2028-03-01"], "Delaware Corporation: 1. März statt 1. Juni (der 01.03.2028 liegt noch im Fenster bis 02.04.2028)");
gleich(termine({ bundesstaat: "WY", form: "LLC", gegruendetAm: "2026-05-15" }, "2026-06-01"),
  ["us_meldung:2027=2027-04-15", "staat:WY:2027=2027-05-01", "agent:2027=2027-05-15"], "Wyoming: erster Tag des Gründungsmonats, erst im Folgejahr");
gleich(termine({ bundesstaat: "FL", form: "LLC", gegruendetAm: "2026-11-20" }, "2026-12-01"),
  ["us_meldung:2027=2027-04-15", "staat:FL:2027=2027-05-01", "agent:2027=2027-11-20", "us_meldung:2028=2028-04-15", "staat:FL:2028=2028-05-01"], "Florida: 1. Mai");
gleich(termine({ bundesstaat: "NM", form: "LLC", gegruendetAm: "2026-10-01" }, "2026-10-02"),
  ["us_meldung:2027=2027-04-15", "agent:2027=2027-10-01"], "New Mexico LLC: keine Staatsmeldung, nur US-Meldung und Registered Agent");
ok(!termine({ bundesstaat: "NM", form: "Corporation", gegruendetAm: "2026-10-01" }, "2026-10-02").some((t) => t.startsWith("staat:")), "New Mexico Corporation: keine Staatsregel (Handeintrag)");
ok(!termine({ bundesstaat: "TX", form: "LLC", gegruendetAm: "2026-10-01" }, "2026-10-02").some((t) => t.startsWith("staat:")), "anderer Bundesstaat: keine Staatsregel (Handeintrag)");
ok(!termine({ bundesstaat: "", form: "LLC", gegruendetAm: "2026-10-01" }, "2026-10-02").some((t) => t.startsWith("staat:")), "ohne Bundesstaat: keine Staatsregel");

// Jahreswechsel: Am 31.12. reicht das Fenster bis zum 30.06. des übernächsten Jahres.
gleich(termine({ bundesstaat: "DE", form: "LLC", gegruendetAm: "2026-10-01" }, "2026-12-31"),
  ["us_meldung:2027=2027-04-15", "staat:DE:2027=2027-06-01", "agent:2027=2027-10-01", "us_meldung:2028=2028-04-15", "staat:DE:2028=2028-06-01"], "Jahreswechsel: Fenster 31.12.2026 – 30.06.2028");
// Nie ein Termin im Gründungsjahr: Die US-Meldung betrifft das Vorjahr — das es noch nicht gibt.
ok(!termine({ bundesstaat: "DE", form: "LLC", gegruendetAm: "2026-02-10" }, "2026-02-11").some((t) => t.includes(":2026=")), "kein Termin im Gründungsjahr (15.04.2026 bei Gründung im Februar 2026)");
// Grenzen eingeschlossen: fällig HEUTE zählt, gestern nicht.
ok(termine({ bundesstaat: "WY", form: "LLC", gegruendetAm: "2026-05-20" }, "2027-05-01").includes("staat:WY:2027=2027-05-01"), "Frist, die heute fällig ist, fehlt");
ok(!termine({ bundesstaat: "WY", form: "LLC", gegruendetAm: "2026-05-20" }, "2027-05-02").includes("staat:WY:2027=2027-05-01"), "Frist von gestern steht noch im Fenster");
// Schaltjahr: Gründung am 29.02. — der Jahrestag fällt sonst auf den 28.02.
ok(termine({ bundesstaat: "NM", form: "LLC", gegruendetAm: "2028-02-29" }, "2028-03-01").includes("agent:2029=2029-02-28"), "Schaltjahr: Jahrestag des 29.02.2028 ist nicht der 28.02.2029");
ok(termine({ bundesstaat: "NM", form: "LLC", gegruendetAm: "2024-02-29" }, "2027-06-01").includes("agent:2028=2028-02-29"), "Schaltjahr: im Schaltjahr 2028 bleibt der 29.02.");
gleich(B.isoPlusMonate("2026-08-31", 18), "2028-02-29", "18 Monate ab dem 31.08.2026 (Schaltjahr)");
gleich(B.isoPlusMonate("2026-08-31", 6), "2027-02-28", "6 Monate ab dem 31.08.2026");
gleich(B.isoPlusMonate("2026-11-30", 2), "2027-01-30", "Monatsrechnung über den Jahreswechsel");
gleich(B.isoPlusTage("2026-12-25", 7), "2027-01-01", "Tagesrechnung über den Jahreswechsel");
gleich(B.isoPlusTage("2028-02-28", 1), "2028-02-29", "Tagesrechnung im Schaltjahr");
// Ohne echten Gründungstag kein Kalender — ein erfundener Tag wäre schlimmer als keiner.
gleich(termine({ bundesstaat: "DE", form: "LLC", gegruendetAm: "2027-02-29" }, "2027-03-01"), [], "29.02.2027 gibt es nicht");
gleich(termine({ bundesstaat: "DE", form: "LLC", gegruendetAm: null }, "2027-03-01"), [], "ohne Gründungstag keine Fristen");
gleich(termine({ bundesstaat: "DE", form: "LLC", gegruendetAm: "2026-10-01" }, "heute"), [], "kaputtes Heute");
ok(B.istIsoTag("2028-02-29") && !B.istIsoTag("2027-02-29") && !B.istIsoTag("2027-13-01") && !B.istIsoTag("27-01-01"), "istIsoTag");

for (const [staat, form] of [["DE", "LLC"], ["DE", "Corporation"], ["WY", "LLC"], ["FL", "Corporation"], ["NM", "LLC"], ["TX", "LLC"]] as const) {
  for (const sprache of ["de", "en"] as const) {
    const fristen = B.globalPflichtFristen({ bundesstaat: staat, form, gegruendetAm: "2026-03-31" }, "2026-12-31", sprache);
    ok(fristen.length >= 2, `${staat}/${form}/${sprache}: zu wenige Fristen`);
    ok(new Set(fristen.map((f) => f.regelKey)).size === fristen.length, `${staat}/${form}/${sprache}: doppelter regelKey`);
    ok(fristen.every((f, i) => i === 0 || fristen[i - 1].faelligAm <= f.faelligAm), `${staat}/${form}/${sprache}: nicht nach Datum sortiert`);
    ok(fristen.every((f) => f.faelligAm >= "2026-12-31" && f.faelligAm <= "2028-06-30" && B.istIsoTag(f.faelligAm)), `${staat}/${form}/${sprache}: Termin außerhalb des Fensters`);
    ok(fristen.every((f) => f.hinweis.endsWith(B.GLOBAL_FRIST_STANDARDHINWEIS[sprache])), `${staat}/${form}/${sprache}: Hinweis endet nicht mit dem Satz zu Steuerberater bzw. US-CPA`);
    // Keine Beträge, keine Steuersätze: kein Währungszeichen, kein Prozent, keine Zahl mit „USD"/„Dollar".
    ok(fristen.every((f) => !/[€$%]|\bUSD\b|\bDollar\b|\bEuro\b/i.test(`${f.titel} ${f.hinweis}`)), `${staat}/${form}/${sprache}: Betrag oder Satz im Kalendertext`);
  }
}
ok(B.globalPflichtFristen({ bundesstaat: "DE", form: "LLC", gegruendetAm: "2026-10-01" }, "2026-10-02")[0].titel.includes("Form 5472"), "LLC: US-Meldung nennt Form 5472");
ok(B.globalPflichtFristen({ bundesstaat: "DE", form: "Corporation", gegruendetAm: "2026-10-01" }, "2026-10-02").some((f) => f.titel.includes("Form 1120")), "Corporation: US-Erklärung nennt Form 1120");
gleich([B.usBundesstaatCode("delaware"), B.usBundesstaatCode(" wy "), B.usBundesstaatCode("New Mexico"), B.usBundesstaatCode("XX"), B.usBundesstaatCode("")], ["DE", "WY", "NM", null, null], "Bundesstaat-Kürzel");
gleich(B.usBundesstaatName("de"), "Delaware", "Bundesstaat-Name");
ok(/§ 138 AO/.test(B.globalHeimatMeldungSchritt("DE")) && !/§ 138/.test(B.globalHeimatMeldungSchritt("AT")) && !/\d/.test(B.globalHeimatMeldungSchritt("CH")), "Meldung beim heimischen Finanzamt: § 138 AO nur für Deutschland, nie ein Datum");

// ═══ 2: MONATLICHER DURCHGANG ═══════════════════════════════════════════════
abschnitt("Monatlicher Durchgang");
gleich(B.globalDurchgangMonat("2026-09-17", "2026-09-17"), null, "am Starttag kein Durchgang");
gleich(B.globalDurchgangMonat("2026-09-17", "2026-10-16"), null, "einen Tag vor dem ersten Monatstag");
gleich(B.globalDurchgangMonat("2026-09-17", "2026-10-17"), "2026-10", "erster Durchgang am Monatstag");
gleich(B.globalDurchgangMonat("2026-09-17", "2026-11-05"), "2026-10", "zwischen zwei Monatstagen gilt der letzte fällige (nachholen)");
gleich(B.globalDurchgangMonat("2026-09-17", "2026-11-17"), "2026-11", "zweiter Durchgang");
gleich(B.globalDurchgangMonat("2026-12-15", "2027-01-15"), "2027-01", "über den Jahreswechsel");
gleich(B.globalDurchgangMonat("2026-01-31", "2026-02-27"), null, "Start am 31.: im Februar erst am Monatsletzten");
gleich(B.globalDurchgangMonat("2026-01-31", "2026-02-28"), "2026-02", "Start am 31.: Februar = 28.");
gleich(B.globalDurchgangMonat("2028-01-31", "2028-02-29"), "2028-02", "Start am 31.: Februar im Schaltjahr = 29.");
gleich(B.globalDurchgangMonat("kaputt", "2026-10-17"), null, "kaputter Starttag");
gleich(["global_struktur", "global_banking", "global_kapital", "global_vip", "ultra"].map((k) => B.globalHatMonatsdurchgang(k)), [false, true, true, true, false], "Durchgang nur ab Global Banking");
gleich(["global_struktur", "global_banking", "global_kapital", "global_vip"].map((k) => B.globalPaketEtappeBis(k)), [2, 3, 4, 4], "bis zu welcher Etappe ein Paket begleitet");
gleich([B.globalEtappeStand(1, 2), B.globalEtappeStand(2, 2), B.globalEtappeStand(3, 2), B.globalEtappeStand(0, 0), B.globalEtappeStand(5, 5), B.globalEtappeStand(3, 5)], ["fertig", "jetzt", "offen", "jetzt", "fertig", "fertig"], "Stand einer Etappe");

// Erinnerungsmarken des Pflichtenkalenders: rund einen Monat und rund eine Woche vorher, je genau einmal.
const marke = (tag: string, heute: string, m30 = false, m7 = false) => B.globalFristMarke(tag, heute, { m30, m7 });
gleich([marke("2027-04-15", "2027-03-15"), marke("2027-04-15", "2027-03-16"), marke("2027-04-15", "2027-03-16", true)], [null, 30, null], "Marke 30: ab dreißig Tagen vorher, einmal");
gleich([marke("2027-04-15", "2027-04-07", true), marke("2027-04-15", "2027-04-08", true), marke("2027-04-15", "2027-04-08", true, true)], [null, 7, null], "Marke 7: ab sieben Tagen vorher, einmal");
gleich(marke("2027-04-15", "2027-04-10", false, false), 7, "kurzfristig eingetragen: nur die Wochen-Erinnerung");
gleich([marke("2027-04-15", "2027-04-15", true), marke("2027-04-15", "2027-04-16"), marke("2027-02-29", "2027-02-01"), marke("2027-04-15", "heute")], [7, null, null, null], "heute fällig zählt, gestern und Kaputtes nicht");
gleich(marke("2027-01-05", "2026-12-30", true), 7, "Marke 7 über den Jahreswechsel");
gleich([B.globalTageslaufFenster(7 * 60 + 59), B.globalTageslaufFenster(8 * 60), B.globalTageslaufFenster(19 * 60 + 59), B.globalTageslaufFenster(20 * 60), B.globalTageslaufFenster(2 * 60), B.globalTageslaufFenster(NaN)], [false, true, true, false, false, false], "Tageslauf arbeitet nur von 8 bis vor 20 Uhr");

// ═══ 3: TEXTE ═══════════════════════════════════════════════════════════════
abschnitt("Texte: Wortwand + Global-Regeln (de), Gegenprobe (en)");
gleich(B.GLOBAL_ETAPPEN.map((e) => e.nr), [0, 1, 2, 3, 4, 5], "sechs Etappen 0–5");
gleich(B.GLOBAL_ETAPPEN.slice(1, 5).map((e) => e.de.titel), GLOBAL_WOERTER.de.weg.map((w: { titel: string }) => w.titel), "Etappentitel 1–4 = „Der Weg“ auf /business (de)");
gleich(B.GLOBAL_ETAPPEN.slice(1, 5).map((e) => e.en.titel), GLOBAL_WOERTER.en.weg.map((w: { titel: string }) => w.titel), "Etappentitel 1–4 = „The path“ auf /en/business");

const de: [string, string][] = []; const en: [string, string][] = [];
for (const e of B.GLOBAL_ETAPPEN) { de.push([`etappe ${e.nr}`, `${e.de.titel}. ${e.de.text}`]); en.push([`etappe ${e.nr}`, `${e.en.titel}. ${e.en.text}`]); }
for (const a of B.GLOBAL_DOKUMENTARTEN) { de.push([`art ${a.art}`, a.de]); en.push([`art ${a.art}`, a.en]); }
for (const u of B.GLOBAL_UNTERLAGEN_LISTE) { de.push([`unterlage ${u.art}`, `${u.de.zeile}. ${u.de.titel}. ${u.de.hinweis} ${u.de.textHinweis ?? ""}`]); en.push([`unterlage ${u.art}`, `${u.en.zeile}. ${u.en.titel}. ${u.en.hinweis} ${u.en.textHinweis ?? ""}`]); }
for (const [staat, form] of [["DE", "LLC"], ["DE", "Corporation"], ["WY", "LLC"], ["FL", "LLC"], ["NM", "LLC"]] as const) {
  for (const f of B.globalPflichtFristen({ bundesstaat: staat, form, gegruendetAm: "2026-03-31" }, "2026-12-31", "de")) de.push([`frist ${staat}/${form}/${f.regelKey}`, `${f.titel}. ${f.hinweis}`]);
  for (const f of B.globalPflichtFristen({ bundesstaat: staat, form, gegruendetAm: "2026-03-31" }, "2026-12-31", "en")) en.push([`frist ${staat}/${form}/${f.regelKey}`, `${f.titel}. ${f.hinweis}`]);
}
for (const land of ["DE", "AT", "CH"]) { de.push([`heimat ${land}`, B.globalHeimatMeldungSchritt(land, "de")]); en.push([`heimat ${land}`, B.globalHeimatMeldungSchritt(land, "en")]); }
for (const [sprache, ziel] of [["de", de], ["en", en]] as const) {
  const T = B.GLOBAL_VERLAUF_TEXT[sprache] as Record<string, unknown>;
  for (const [k, v] of Object.entries(T)) {
    const proben = typeof v === "function"
      ? [(v as (...a: any[]) => string)(2, "Die erste Firmenkarte"), (v as (...a: any[]) => string)(5, "Abgeschlossen"), (v as (...a: any[]) => string)("Reisepass", "Pass_Muster.pdf")]
      : [String(v)];
    proben.forEach((p, i) => ziel.push([`verlauf ${k}#${i}`, p]));
  }
  for (const m of [30, 7] as const) ziel.push([`abstand ${m}`, B.globalFristAbstandText(m, sprache)]);
  ziel.push(["standardhinweis", B.GLOBAL_FRIST_STANDARDHINWEIS[sprache]]);
}
let wandTreffer = 0;
for (const [pfad, text] of de) for (const tr of globalWortPruefen(text)) { wandTreffer++; ok(false, `WORTWAHL (de) ${pfad}: „${tr.treffer}“ — ${tr.hinweis}`); }
// Englisch: dieselben Grenzen wie scripts/seo-wortverbote-en.ts. „personal guarantee" ist der Rechtsbegriff
// der persönlichen Haftung (er warnt), und eine Verneinung („not tax or legal advice") schließt aus, was verboten ist.
const enTreffer = (text: string): string[] => {
  const funde: string[] = [];
  for (const m of text.matchAll(/\b(guarantee[sd]?|advice|recommend\w*|affiliate\w*)\b/gi)) {
    const davor = text.slice(Math.max(0, m.index! - 40), m.index!);
    if (/^guarantee/i.test(m[0]) && /personal\s$/i.test(davor)) continue;
    if (/^advice$/i.test(m[0]) && /\b(no|not|never|without)\b[^.]*$/i.test(davor)) continue;
    funde.push(m[0]);
  }
  return funde;
};
for (const [pfad, text] of en) for (const tr of enTreffer(text)) { wandTreffer++; ok(false, `WORTWAHL (en) ${pfad}: „${tr}“`); }
ok(de.length > 60 && en.length === de.length, `Textsammlung unvollständig (de ${de.length}, en ${en.length})`);
// Gegenprobe: Der Prüfstand KANN rot werden.
ok(globalWortPruefen("Wir richten Ihnen einen Rahmen bis zu 250.000 $ bei Chase ein.").length >= 2, "Gegenprobe: „bis zu“ und Bankname werden nicht erkannt");
ok(globalWortPruefen("Das erledigen wir innerhalb von 14 Tagen — garantiert.").length >= 2, "Gegenprobe: Frist mit Ziffer und „garantiert“ werden nicht erkannt");
ok(enTreffer("We recommend this and guarantee the result.").length === 2, "Gegenprobe (en) schlägt nicht an");
console.log(`  ${de.length} deutsche und ${en.length} englische Texte geprüft — ${wandTreffer} Treffer.`);

// ═══ 4: UNTERLAGEN — EINE QUELLE ════════════════════════════════════════════
abschnitt("Unterlagen: eine Quelle");
ok(mailGlobal.GLOBAL_UNTERLAGEN === B.GLOBAL_UNTERLAGEN, "server/mail/vorlagen/global.ts führt eine EIGENE Unterlagenliste");
gleich(B.GLOBAL_UNTERLAGEN.length, 5, "fünf Unterlagen");
gleich(B.GLOBAL_UNTERLAGEN_EN.length, B.GLOBAL_UNTERLAGEN.length, "englische Liste gleich lang");
ok(B.GLOBAL_UNTERLAGEN_LISTE.every((u) => B.globalKundeDarfArt(u.art) && u.erfuelltDurch.every((a) => !!B.globalDokumentArt(a))), "jede Unterlage ist eine Dokumentart, die der Kunde hochladen darf");
gleich(B.globalUnterlagenOffen([]), 5, "ohne Dokumente fehlen fünf");
gleich(B.globalUnterlagenOffen(["reisepass", "sonstiges"]), 4, "Reisepass da");
ok(B.globalUnterlagenStand(["gesellschafterliste"]).find((u) => u.art === "registerauszug")!.vorhanden, "Gesellschafterliste ODER Handelsregisterauszug — eines genügt");
gleich(B.globalUnterlagenOffen(["reisepass", "adressnachweis", "registerauszug", "namenswunsch", "taetigkeitsbeschreibung"]), 0, "alle fünf da");
ok(!B.globalKundeDarfArt("ein_brief") && !B.globalKundeDarfArt("gruendungsurkunde") && B.globalKundeDarfArt("bank_unterlage") && !B.globalKundeDarfArt("exe"), "Kunde darf nur Arten „kunde“ und „beide“");
// Die zwei Text-Unterlagen: Das Angebot „als Text eintragen" steht getrennt vom Hinweis — die Seite zeigt es nur, wenn sie das Feld hat.
gleich(B.globalUnterlagenStand([]).filter((u) => u.alsText).map((u) => u.art), ["namenswunsch", "taetigkeitsbeschreibung"], "als Text einreichbar: Namenswunsch und Tätigkeit");
ok(B.globalUnterlagenStand([], "de").every((u) => !/als Text/i.test(u.hinweis)) && B.globalUnterlagenStand([], "en").every((u) => !/as text/i.test(u.hinweis)), "ein Hinweis verspricht ein Textfeld, das die Seite nicht haben muss");
ok(B.globalUnterlagenStand([], "en").filter((u) => u.alsText).every((u) => /as text/.test(u.textHinweis ?? "")), "textHinweis englisch");
gleich(B.GLOBAL_DOKUMENTARTEN.map((a) => a.art).sort(), ["adressnachweis", "bank_unterlage", "ein_brief", "gesellschafterliste", "gruendungsurkunde", "itin_bescheid", "namenswunsch", "operating_agreement", "registerauszug", "reisepass", "sonstiges", "taetigkeitsbeschreibung"], "zwölf Dokumentarten");

gleich(B.globalDokumentArtenFuer("office").length, 12, "das Office wählt aus allen zwölf Arten");
ok(B.globalDokumentArtenFuer("kunde").every((a) => B.globalKundeDarfArt(a.art)) && B.globalDokumentArtenFuer("kunde").some((a) => a.art === "sonstiges") && B.globalDokumentArtenFuer("kunde").length === 8, "der Kunde wählt nur aus Arten, die er liefern darf (acht, mit „Sonstiges“)");
gleich(B.globalDokumentArtenFuer("kunde", "en").find((a) => a.art === "reisepass")?.titel, "Passport", "Auswahl englisch");

// ═══ 5: MAILS ═══════════════════════════════════════════════════════════════
abschnitt("Mails: global_zugang · global_etappe · global_frist · global_dokument");
const EREIGNISSE = ["global_zugang", "global_etappe", "global_frist", "global_dokument"];
const platzhalter = (b: unknown) => Array.from(new Set(Array.from(JSON.stringify(b).matchAll(/\{\{params\.([a-z_0-9]+)\}\}/g), (m) => m[1]))).sort();
gleich(Object.keys(GLOBAL_BEREICH_PAARE).sort(), [...EREIGNISSE].sort(), "vier Paare");
for (const event of EREIGNISSE) {
  const paar = GLOBAL_BEREICH_PAARE[event];
  ok(hatVorlage(event), `${event}: fehlt im Motor`);
  ok(!!VORLAGEN_EN[event], `${event}: englische Fassung fehlt im Motor`);
  gleich(platzhalter(paar.en), platzhalter(paar.de), `${event}: Platzhalter de/en`);
  gleich([paar.en.knopf?.url, paar.en.knopf2?.url, paar.en.daten?.length, paar.en.absaetze.length], [paar.de.knopf?.url, paar.de.knopf2?.url, paar.de.daten?.length, paar.de.absaetze.length], `${event}: Aufbau de/en`);
  ok(paar.de.knopf?.url === "{{params.mein_auftrag_url}}", `${event}: der Knopf führt nicht zu „Mein Auftrag“`);
  // Der Textteil setzt den Titel in Großbuchstaben — ein Platzhalter dort bliebe leer (mailText im Gerüst).
  ok(!/\{\{/.test(paar.de.titel) && !/\{\{/.test(paar.en.titel), `${event}: Platzhalter im Titel`);
  const def = MAKE_EVENT_REGISTRY.find((e: { type: string }) => e.type === event);
  ok(!!def, `${event}: nicht registriert (make-events-registry.ts)`);
  if (!def) continue;
  for (const sprache of ["de", "en"] as const) {
    const mail = mailRendern(event, { ...def.example, sprache });
    ok(!!mail, `${event}/${sprache}: rendert nicht`);
    if (!mail) continue;
    ok(mail.fehlend.length === 0, `${event}/${sprache}: Platzhalter ohne Wert — ${mail.fehlend.join(", ")}`);
    ok(mail.html.includes("FIAON Global") && !/Bonität ist machbar|keine Löschung berechtigter Einträge|Ihr Ziel bleibt die eigene Karte/.test(mail.html), `${event}/${sprache}: Kopf/Fuß der Privatkundenlinie`);
    ok(mail.html.includes(String(def.example.mein_auftrag_url)), `${event}/${sprache}: Link zu „Mein Auftrag“ fehlt`);
    ok(!/\b[A-Z]{2}\d{2}[ ]?\d{4}[ ]?\d{4}/.test(mail.text), `${event}/${sprache}: Bankdaten im Mailtext`);
    ok(!/\{\{|\}\}|undefined|null/.test(mail.text), `${event}/${sprache}: Rest eines Platzhalters im Text`);
    if (sprache === "de") {
      // Der Link selbst ist kein Kundensatz (und trüge zufällige Ziffern in die Regeln).
      for (const tr of globalWortPruefen(mail.text.split(String(def.example.mein_auftrag_url)).join(""))) ok(false, `${event}: WORTWAHL „${tr.treffer}“ — ${tr.hinweis}`);
      ok(/Ihr|Sie/.test(mail.text) && !/\b(du|dein|dir)\b/i.test(mail.text), `${event}: nicht in Sie-Form`);
    } else {
      ok(paar.en.betreff !== paar.de.betreff && /Your|your/.test(mail.text) && !/\b(Ihre?|Sie)\b/.test(mail.text.split("—")[0]), `${event}/en: nicht englisch`);
      for (const tr of enTreffer(mail.text)) ok(false, `${event}/en: WORTWAHL „${tr}“`);
    }
  }
}
// Die Erinnerung nennt den Abstand in Worten — nie „in 30 Tagen".
ok(!/\d+\s*(Tag|Woche|Monat|day|week|month)/i.test(JSON.stringify(GLOBAL_BEREICH_PAARE.global_frist)), "global_frist: Abstand als Ziffer");
// Bestellweg-Mails: der Knopf zu „Mein Auftrag" — und ohne Link kein toter Knopf.
const NUTZLAST = {
  email: "m.muster@muster-gmbh.example", anrede_zeile: "Guten Tag Herr Muster", firma: "Muster GmbH", paket: "FIAON Global Struktur", betrag_text: "2.499,00 €",
  antrag_id: "FIAON-PRUEFSTAND-0001", payment_reference: "FIAON-A1B2C3", faellig_am_text: "24.09.2026", zahlungsseite_url: "https://fiaon.com/zahlung/FIAON-A1B2C3", ansprechpartner: "Herr Beispiel",
  // Seit E-191 füllt globalMailNutzlast die Liste je Auftraggeber — hier die des Unternehmens.
  unterlagen_liste: B.GLOBAL_UNTERLAGEN.map((u) => `· ${u}`).join("<br />"),
};
for (const event of ["global_auftrag", "global_start"]) {
  const mit = mailRendern(event, { ...NUTZLAST, mein_auftrag_url: "https://fiaon.com/business/auftrag/FIAON-PRUEFSTAND-0001?t=1.abc" });
  const ohne = mailRendern(event, NUTZLAST);
  ok(!!mit && mit.html.includes("Mein Auftrag öffnen") && mit.html.includes("/business/auftrag/FIAON-PRUEFSTAND-0001"), `${event}: Knopf „Mein Auftrag öffnen“ fehlt`);
  ok(!!ohne && !ohne.html.includes("Mein Auftrag öffnen") && ohne.fehlend.length === 0, `${event}: ohne Link bleibt ein toter Knopf oder ein leerer Platzhalter`);
}
for (const u of B.GLOBAL_UNTERLAGEN) ok(mailRendern("global_start", NUTZLAST)!.text.includes(u), `global_start nennt die Unterlage nicht: ${u}`);
ok(!!LAUF_FOLGEN.global_tageslauf && LAUF_FOLGEN.global_tageslauf.fenster >= 24, "global_tageslauf fehlt im Katalog der Läufe (LAUF_FOLGEN)");

// ═══ 6: TOKEN ═══════════════════════════════════════════════════════════════
abschnitt("Token: an die Antragsnummer gebunden");
const REF = "FIAON-PRUEFSTAND-0001"; const FREMD = "FIAON-PRUEFSTAND-0002";
const token = auftrag.globalTokenErzeugen(REF);
ok(auftrag.globalTokenPruefen(REF, token) === "gueltig", "frisches Token gilt nicht");
ok(auftrag.globalTokenPruefen(FREMD, token) === null, "Token gilt für eine FREMDE Antragsnummer");
ok(auftrag.globalTokenPruefen(REF.toLowerCase(), token) === null, "Token gilt für eine anders geschriebene Antragsnummer");
ok(auftrag.globalTokenPruefen(REF, auftrag.globalTokenErzeugen(REF, -1000)) === "abgelaufen", "abgelaufenes Token wird nicht erkannt");
ok(auftrag.globalTokenPruefen(FREMD, auftrag.globalTokenErzeugen(REF, -1000)) === null, "abgelaufenes Token einer fremden Nummer meldet „abgelaufen“ statt „ungültig“");
ok(auftrag.globalTokenPruefen(REF, token.replace(/^\d+/, (z) => String(Number(z) + 86_400_000))) === null, "verlängertes Ablaufdatum gilt");
ok(auftrag.globalTokenPruefen(REF, token.replace(/.$/, (z) => (z === "0" ? "1" : "0"))) === null, "verändertes Token gilt");
ok([undefined, null, "", "abc", "1.2.3", `${Date.now() + 1000}.`].every((x) => auftrag.globalTokenPruefen(REF, x) === null), "leeres oder kaputtes Token gilt");
for (const sprache of ["de", "en"] as const) {
  const url = new URL(auftrag.globalMeinAuftragUrl(REF, sprache));
  gleich(url.pathname, `${sprache === "en" ? "/en" : ""}/business/auftrag/${REF}`, `Link zu „Mein Auftrag“ (${sprache})`);
  ok(auftrag.globalTokenPruefen(REF, url.searchParams.get("t")) === "gueltig" && auftrag.globalTokenPruefen(FREMD, url.searchParams.get("t")) === null, `Link (${sprache}): Token nicht an die Nummer gebunden`);
}
gleich(globalMeinAuftragPfad("FIAON A/B", "1.ab"), "/business/auftrag/FIAON%20A%2FB?t=1.ab", "Pfad maskiert die Nummer");
gleich(globalOfficeAuftragPfad(REF), `/agent/global/${REF}`, "Pfad im Office");
gleich(auftrag.globalSpracheVon({ vertrag_sprache: "EN " }), "en", "Sprache aus der Akte");
gleich(auftrag.globalSpracheVon({}), "de", "Sprache: Vorgabe deutsch");

// ═══ 7: DATEITYP ════════════════════════════════════════════════════════════
abschnitt("Dateityp aus dem Inhalt");
const fuellung = Buffer.alloc(64, 0x20);
const bytes = (...teile: (string | number[] | Buffer)[]) => Buffer.concat([...teile.map((t) => (typeof t === "string" ? Buffer.from(t, "latin1") : Buffer.from(t as any))), fuellung]);
const isoBmff = (haupt: string, ...vertraeglich: string[]) => {
  const rumpf = Buffer.concat([Buffer.from("ftyp", "latin1"), Buffer.from(haupt, "latin1"), Buffer.from([0, 0, 0, 0]), ...vertraeglich.map((v) => Buffer.from(v, "latin1"))]);
  const laenge = Buffer.alloc(4); laenge.writeUInt32BE(rumpf.length + 4);
  return Buffer.concat([laenge, rumpf, fuellung]);
};
const PNG_KOPF = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
gleich(R.globalDateiTyp(bytes("%PDF-1.7\n%", [0xe2, 0xe3, 0xcf, 0xd3])), { mime: "application/pdf", endung: "pdf" }, "PDF");
gleich(R.globalDateiTyp(bytes([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10], "JFIF")), { mime: "image/jpeg", endung: "jpg" }, "JPG (JFIF)");
gleich(R.globalDateiTyp(bytes([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x10], "Exif")), { mime: "image/jpeg", endung: "jpg" }, "JPG (Exif, Handyfoto)");
gleich(R.globalDateiTyp(bytes(PNG_KOPF, [0, 0, 0, 13], "IHDR")), { mime: "image/png", endung: "png" }, "PNG");
gleich(R.globalDateiTyp(isoBmff("heic", "mif1", "heic")), { mime: "image/heic", endung: "heic" }, "HEIC (iPhone)");
gleich(R.globalDateiTyp(isoBmff("mif1", "mif1", "heic")), { mime: "image/heic", endung: "heic" }, "HEIC mit allgemeiner Hauptmarke");
const TARNUNGEN: [string, Buffer][] = [
  ["HTML als .pdf", bytes("<!DOCTYPE html><html><script>alert(1)</script></html>")],
  ["HTML mit %PDF- weiter hinten", bytes("<html><!-- ", "%PDF-1.4", " --><script>alert(1)</script>")],
  ["HTML nach Leerzeichen", bytes("   \n<html><body onload=alert(1)>")],
  ["SVG", bytes("<?xml version=\"1.0\"?><svg xmlns=\"http://www.w3.org/2000/svg\" onload=\"alert(1)\"/>")],
  ["SVG ohne XML-Kopf", bytes("<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>")],
  ["EXE (MZ)", bytes("MZ", [0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04])],
  ["ELF", bytes([0x7f], "ELF", [2, 1, 1, 0])],
  ["ZIP / DOCX", bytes("PK", [0x03, 0x04, 0x14, 0x00, 0x06, 0x00])],
  ["GIF", bytes("GIF89a", [1, 0, 1, 0])],
  ["WebP", bytes("RIFF", [0x24, 0, 0, 0], "WEBPVP8 ")],
  ["AVIF", isoBmff("avif", "mif1", "miaf")],
  ["AVIF mit allgemeiner Hauptmarke", isoBmff("mif1", "avif", "miaf")],
  ["MP4", isoBmff("isom", "isom", "mp42")],
  ["PNG mit halber Signatur", bytes([0x89, 0x50, 0x4e, 0x47, 0x3c, 0x73, 0x76, 0x67])],
  ["JavaScript", bytes("alert(document.cookie);//")],
  ["Text", bytes("Sehr geehrte Damen und Herren,")],
];
for (const [name, b] of TARNUNGEN) ok(R.globalDateiTyp(b) === null, `${name} wird als ${JSON.stringify(R.globalDateiTyp(b))} angenommen`);
ok(R.globalDateiTyp(Buffer.alloc(0)) === null && R.globalDateiTyp(Buffer.from("%PDF-")) === null && R.globalDateiTyp(null) === null, "leere oder zu kurze Datei");
gleich(["application/pdf", "image/jpeg", "image/png", "image/heic", "text/plain"].map((m) => R.globalMimeAuslieferbar(m)), ["application/pdf", "image/jpeg", "image/png", "image/heic", "text/plain; charset=utf-8"], "auslieferbare Typen");
ok(["image/svg+xml", "text/html", "application/xhtml+xml", "application/javascript", "application/octet-stream", "", null, "TEXT/HTML"].every((m) => R.globalMimeAuslieferbar(m) === null), "SVG/HTML/Unbekanntes wird ausgeliefert");
gleich([R.GLOBAL_DATEI_MAX_BYTES, R.GLOBAL_DOKUMENTE_MAX], [15 * 1024 * 1024, 40], "15 MB, 40 Dokumente");

// ═══ 8: DATEINAME ═══════════════════════════════════════════════════════════
abschnitt("Dateiname");
const Z = (n: number) => String.fromCharCode(n);
gleich(R.globalDateiname("../../etc/passwd", "pdf"), "passwd.pdf", "Pfad (Unix)");
gleich(R.globalDateiname("C:\\Users\\max\\Desktop\\Scan 1.PDF", "pdf"), "Scan 1.pdf", "Pfad (Windows)");
gleich(R.globalDateiname(`Rech${Z(0)}nung${Z(10)}${Z(13)}${Z(27)}.pdf`, "pdf"), "Rechnung.pdf", "Steuerzeichen");
gleich(R.globalDateiname(`Pass${Z(0x202e)}gpj.exe`, "jpg"), "Passgpj.jpg", "Richtungswechsel (exe sieht aus wie jpg)");
gleich(R.globalDateiname(`Pass${Z(0x200b)}${Z(0xfeff)}port.png`, "png"), "Passport.png", "unsichtbare Zeichen");
gleich(R.globalDateiname("vertrag.pdf.exe", "pdf"), "vertrag.pdf", "doppelte Endung");
gleich(R.globalDateiname("foto.JPEG", "heic"), "foto.heic", "Endung folgt dem erkannten Inhalt, nicht dem Namen");
gleich(R.globalDateiname("Auszug.2026.09.pdf", "pdf"), "Auszug.2026.09.pdf", "Datum im Namen bleibt");
gleich(R.globalDateiname("Gesellschafterliste Müller & Söhne (final).pdf", "pdf"), "Gesellschafterliste Müller _ Söhne (final).pdf", "Umlaute bleiben, Sonderzeichen nicht");
gleich(R.globalDateiname("a\"; filename=evil.html", "pdf"), "a_ filename=evil.pdf".replace("=", "_"), "Anführungszeichen und Gleichheitszeichen");
gleich(R.globalDateiname(".htaccess", "pdf"), "Dokument.pdf", "versteckte Datei");
gleich([R.globalDateiname("", "pdf"), R.globalDateiname("...", "png"), R.globalDateiname(null, "jpg"), R.globalDateiname("///", "pdf")], ["Dokument.pdf", "Dokument.png", "Dokument.jpg", "Dokument.pdf"], "leerer Name");
const lang = R.globalDateiname(`${"ä".repeat(300)}.pdf`, "pdf");
ok(Array.from(lang).length === 84 && lang.endsWith(".pdf"), `Überlänge: ${Array.from(lang).length} Zeichen`);
ok(R.globalDateiname("x.pdf", "p/../df").endsWith(".pdf") && R.globalDateiname("x", "").endsWith(".bin"), "kaputte Endung");
for (const roh of ["../../etc/passwd", `a${Z(13)}${Z(10)}Set-Cookie: x=1.pdf`, "a\"b.pdf", "Müller Söhne.pdf", `${"x".repeat(500)}.pdf`]) {
  const kopf = R.globalDateinameKopf(R.globalDateiname(roh, "pdf"));
  ok(/^[A-Za-z0-9._-]{1,100}$/.test(kopf) && !kopf.startsWith("."), `Kopfzeilen-Name nicht sauber: ${JSON.stringify(kopf)}`);
}

// ═══ 9: ZUGRIFF UND DROSSEL ═════════════════════════════════════════════════
abschnitt("Zugriff im Office, Drossel");
const darf = (w: Parameters<typeof R.globalOfficeZugriff>[0], z: number | null | undefined) => R.globalOfficeZugriff(w, z);
gleich(darf({ agentId: 8, rolle: "agent" }, 8), { erlaubt: true, grund: "zustaendig" }, "zuständige Person");
gleich(darf({ agentId: 8, rolle: "vertriebsleiter" }, 8).grund, "zustaendig", "zuständig schlägt Rolle (Grund)");
gleich(darf({ agentId: 12, rolle: "agent" }, 8), { erlaubt: false, grund: null }, "fremder Mitarbeiter");
gleich(darf({ agentId: 12, rolle: "onboarding" }, 8).erlaubt, false, "Onboarding");
gleich(darf({ agentId: 12, rolle: "inkasso" }, 8).erlaubt, false, "Forderungsmanagement");
gleich(darf({ agentId: 12, rolle: "agent" }, null).erlaubt, false, "Auftrag ohne zuständige Person: nicht für jeden");
gleich(darf({ agentId: 12, rolle: "agent" }, undefined).erlaubt, false, "unbekannter Auftrag");
gleich(darf({ agentId: 10, rolle: "vertriebsleiter" }, 8), { erlaubt: true, grund: "vertriebsleitung" }, "Vertriebsleitung");
gleich(darf({ agentId: 10, rolle: " Vertriebsleiter " }, null).erlaubt, true, "Vertriebsleitung (Schreibweise)");
gleich(darf({ agentId: 12, rolle: "agent", chef: true }, 8), { erlaubt: true, grund: "chef" }, "Chef-Token");
gleich(darf({ agentId: 12, rolle: "agent", adminCode: true }, 8), { erlaubt: true, grund: "verwaltung" }, "Verwaltungs-Code");
ok([undefined, null, 0, -1, NaN, 1.5].every((id) => !darf({ agentId: id as any, rolle: "vertriebsleiter", chef: true, adminCode: true }, 8).erlaubt), "ohne angemeldeten Mitarbeiter nie — auch nicht mit Chef-Token");
gleich(darf({ agentId: 12, rolle: "agent", chef: "true" as any }, 8).erlaubt, false, "chef muss ein echtes true sein");
gleich([R.globalOfficeSiehtAlle({ agentId: 1, rolle: "agent" }), R.globalOfficeSiehtAlle({ agentId: 1, rolle: "vertriebsleiter" })], [null, "vertriebsleitung"], "wer alle Aufträge sieht");
// Der RAUM (Liste): 403 für alle, die weder alles sehen noch einen Auftrag führen noch eingestellt sind —
// sonst zeigte die Office-Leiste den Raum „Global" jedem Mitarbeiter.
const raum = (w: Parameters<typeof R.globalOfficeRaumZugriff>[0], fuehrt = false, eingestellt = false) => R.globalOfficeRaumZugriff(w, { fuehrtAuftraege: fuehrt, istEingestellt: eingestellt });
gleich(raum({ agentId: 12, rolle: "agent" }), { erlaubt: false, alle: false, grund: null }, "gewöhnlicher Mitarbeiter: kein Raum");
gleich(raum({ agentId: 12, rolle: "agent" }, true), { erlaubt: true, alle: false, grund: "zustaendig" }, "führt einen Auftrag: Raum mit den eigenen");
gleich(raum({ agentId: 12, rolle: "agent" }, false, true), { erlaubt: true, alle: false, grund: "eingestellt" }, "in den Einstellungen zuständig: Raum schon vor dem ersten Auftrag");
gleich(raum({ agentId: 8, rolle: "vertriebsleiter" }), { erlaubt: true, alle: true, grund: "vertriebsleitung" }, "Vertriebsleitung: Raum mit allen");
gleich(raum({ agentId: 12, rolle: "onboarding", chef: true }).alle, true, "Chef-Token: Raum mit allen");
gleich(raum({ agentId: 0, rolle: "vertriebsleiter", chef: true }, true, true).erlaubt, false, "ohne angemeldeten Mitarbeiter kein Raum");
gleich(raum({ agentId: 12, rolle: "agent" }, "true" as any, 1 as any).erlaubt, false, "die Lage muss ein echtes true sein");

// Der Satz, den ein Mitarbeiter an den Kunden schreibt: harte Treffer der Hauswand sperren, eine
// selbst gegebene Zusage („ich rufe Sie an") und der Name eines Instituts nicht.
const { kundensatz } = await import("../server/lib/fiaon-global-bereich");
ok(kundensatz("Bitte laden Sie den aktuellen Adressnachweis hoch. Ich rufe Sie am Dienstag an.") === null, "Kundensatz: „ich rufe Sie an“ wird gesperrt, obwohl der Schreibende es selbst zusagt");
ok(kundensatz("Bitte bestätigen Sie die E-Mail von Mercury, damit die Kontoeröffnung weitergeht.") === null, "Kundensatz: Institutsname im laufenden Auftrag wird gesperrt");
ok(!!kundensatz("Wir garantieren Ihnen die Karte."), "Kundensatz: „garantieren“ geht durch");
ok(!!kundensatz("Das erledigen wir innerhalb von 10 Tagen."), "Kundensatz: Frist in Tagen geht durch");
ok(!!kundensatz("Wir empfehlen Ihnen Delaware."), "Kundensatz: Empfehlung geht durch");
ok(!!kundensatz("Ihr Zugang wurde freigeschaltet."), "Kundensatz: fremde Zusage (Freischaltung) geht durch");

const drossel = R.fensterDrossel(2, 1000);
gleich([drossel("a", 0), drossel("a", 1), drossel("a", 2), drossel("b", 2), drossel("a", 999), drossel("a", 1001), drossel("a", 1002), drossel("a", 1003)], [false, false, true, false, true, false, false, true], "Fenster-Drossel: zwei je Sekunde, je Schlüssel");

// ═══ JAHRESBETREUUNG: WANN DIE RECHNUNG FÜRS ZWEITE JAHR KOMMT (19.09.2026, E-196) ═══
// Rund einen Monat vor dem ersten Jahrestag der Gründung (ohne Gründungstag: des Starts) bekommt die
// zuständige Person EINE Aufgabe. Die Regel ist rein — hier gerechnet; der Lauf selbst im Prüfstand mit Datenbank.
abschnitt("Jahresbetreuung: Rechnung fürs zweite Jahr");
gleich(B.GLOBAL_JAHRESBETREUUNG_VORLAUF_TAGE, 30, "Vorlauf der Rechnung");
gleich(B.globalJahresbetreuungRechnungAb({ gegruendetAm: "2026-10-01" }), { jahrestag: "2027-10-01", rechnungAb: "2027-09-01", basis: "gruendung" }, "Gründung 01.10.2026");
gleich(B.globalJahresbetreuungRechnungAb({ gegruendetAm: "2026-10-01", gestartetAm: "2026-09-20" }), { jahrestag: "2027-10-01", rechnungAb: "2027-09-01", basis: "gruendung" }, "Gründungstag geht vor dem Start");
gleich(B.globalJahresbetreuungRechnungAb({ gegruendetAm: null, gestartetAm: "2026-09-20" }), { jahrestag: "2027-09-20", rechnungAb: "2027-08-21", basis: "start" }, "ohne Gründungstag zählt der Start");
gleich(B.globalJahresbetreuungRechnungAb({ gegruendetAm: "2026-01-15" }), { jahrestag: "2027-01-15", rechnungAb: "2026-12-16", basis: "gruendung" }, "Rechnung noch im Gründungsjahr (Jahreswechsel)");
gleich(B.globalJahresbetreuungRechnungAb({ gegruendetAm: "2028-02-29" }), { jahrestag: "2029-02-28", rechnungAb: "2029-01-29", basis: "gruendung" }, "Gründung am 29.02. — Jahrestag am 28.02.");
gleich(B.globalJahresbetreuungRechnungAb({ gegruendetAm: "2027-02-29", gestartetAm: "2026-12-01" }), { jahrestag: "2027-12-01", rechnungAb: "2027-11-01", basis: "start" }, "ein Tag, den es nicht gibt, ist kein Gründungstag");
gleich(B.globalJahresbetreuungRechnungAb({}), null, "weder Gründung noch Start: keine Rechnung");
gleich(B.globalJahresbetreuungRechnungAb({ gegruendetAm: "irgendwann", gestartetAm: "" }), null, "Unsinn: keine Rechnung");
{
  // Der Lauf: die Aufgabe hat EINEN Schlüssel je Auftrag, steht VOR dem Ausstieg für abgeschlossene Aufträge
  // (ein Paket ist nach Wochen geliefert, der Jahrestag kommt danach) und legt keinen Termin im Kalender des Kunden an.
  const fs = await import("node:fs");
  const q = fs.readFileSync(new URL("../server/lib/fiaon-global-bereich.ts", import.meta.url), "utf8");
  const lauf = q.slice(q.indexOf("export async function globalTageslauf"));
  const schritt = lauf.slice(lauf.indexOf("// (d) Jahresbetreuung"), lauf.indexOf("if (!laeuft || !g.gestartet_am) continue;"));
  ok(schritt.length > 200 && lauf.indexOf("// (d) Jahresbetreuung") < lauf.indexOf("if (!laeuft || !g.gestartet_am) continue;"), "Tageslauf: die Jahresbetreuung steht hinter dem Ausstieg für abgeschlossene Aufträge — sie käme nie");
  ok(schritt.includes("`global:${ref}:jahresbetreuung:2`") && schritt.includes("aufgabeDa(schluessel)") && schritt.includes("globalJahresbetreuungRechnungAb("), "Tageslauf: Schlüssel, Doppel-Sperre oder die reine Regel fehlen");
  ok(schritt.includes("Jahresbetreuung: Rechnung für das zweite Betreuungsjahr stellen") && !/fiaon_global_fristen|global_frist/.test(schritt), "Tageslauf: falscher Titel — oder die Rechnung landet im Pflichtenkalender des Kunden");
  ok(/g\.jahresbetreuung, g\.jahresbetreuung_preis_cents/.test(lauf), "Tageslauf: liest die Jahresbetreuung nicht aus der Akte");
}

// ═══ ERGEBNIS ═══════════════════════════════════════════════════════════════
abschnitt("Ergebnis");
console.log(`  ${geprueft} Prüfungen, ${fehler} Fehler.`);
process.exit(fehler ? 1 : 0);
