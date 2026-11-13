// Prüfstand E-512 (13.11.2026): Ruhetage der Garantiefrist im Kapital-Angebot — Gründe nach dem Wortlaut, Rechnung ohne
// Doppelzählung, neuer Wortlaut nur ab Tempo-Fassung „E-512“, Übernahme ohne Neugründungs-Worte. Rein, ohne Datenbank.
// npx tsx scripts/pruef-kapital-ruhen.ts
import * as R from "../shared/fiaon-global-angebot-kapital-ruhen";
import * as C from "../shared/fiaon-global-angebot-kapital-c";

let gruen = 0, rot = 0;
function ok(b: unknown, was: string, info?: unknown) {
  if (b) { gruen++; console.log(`  grün  ${was}`); } else { rot++; console.log(`  ROT   ${was}${info !== undefined ? `  →  ${typeof info === "string" ? info : JSON.stringify(info)}` : ""}`); }
}

console.log("── 1 Gründe je Vertrag ──");
ok(JSON.stringify(R.kapitalRuhenGruende({ fassungC: false, ruhenErweitert: false, datenVomKunden: false })) === JSON.stringify(["unterlagen7", "angebot"]), "Fassung A/B: nur Ziffer-7-Unterlagen und offenes Angebot");
ok(JSON.stringify(R.kapitalRuhenGruende({ fassungC: true, ruhenErweitert: false, datenVomKunden: false })) === JSON.stringify(["bankunterlagen", "angebot"]), "Fassung C vor E-512: Bank-Unterlagenfrist und Angebot — kein Behörden-Grund");
ok(JSON.stringify(R.kapitalRuhenGruende({ fassungC: true, ruhenErweitert: false, datenVomKunden: true })) === JSON.stringify(["bankunterlagen", "angebot", "reisepass"]), "Fassung C vor E-512 mit Reisepass nach der Annahme");
ok(JSON.stringify(R.kapitalRuhenGruende({ fassungC: true, ruhenErweitert: true, datenVomKunden: false })) === JSON.stringify(["mitwirkung", "behoerde", "hoeheregewalt", "angebot"]), "Fassung C ab E-512: Mitwirkung, Behörde, höhere Gewalt, Angebot");
ok(Object.keys(R.KAPITAL_RUHEN_GRUENDE).every((k) => R.KAPITAL_RUHEN_GRUENDE[k as R.KapitalRuhenGrund].label.length > 10 && R.KAPITAL_RUHEN_GRUENDE[k as R.KapitalRuhenGrund].hinweis.length > 20), "jeder Grund hat Text und Hinweis");

console.log("── 2 Rechnung ──");
const r1 = R.kapitalRuhenRechnen({ von: "2026-11-13", bis: "2026-11-18", heute: "2026-11-20", fristBeginn: "2026-11-03", bisher: null });
ok(r1.ok && r1.von === "2026-11-13" && r1.bisGezaehlt === "2026-11-17" && r1.tage === 5 && !r1.offen, "Bitte 13.11., Eingang 18.11. → 13.–17.11. = 5 Tage (Eingangstag zählt nicht)", r1);
const r2 = R.kapitalRuhenRechnen({ von: "2026-11-13", bis: null, heute: "2026-11-15", fristBeginn: "2026-11-03", bisher: null });
ok(r2.ok && r2.bisGezaehlt === "2026-11-15" && r2.tage === 3 && r2.offen, "läuft noch → bis heute einschließlich (3 Tage), als offen markiert", r2);
const r3 = R.kapitalRuhenRechnen({ von: "2026-11-13", bis: "2026-11-20", heute: "2026-11-20", fristBeginn: "2026-11-03", bisher: "2026-11-15" });
ok(r3.ok && r3.von === "2026-11-16" && r3.tage === 4, "Fortsetzung nach offener Eintragung: ab dem Tag nach dem letzten gezählten (16.–19.11. = 4)", r3);
const r4 = R.kapitalRuhenRechnen({ von: "2026-10-28", bis: "2026-11-05", heute: "2026-11-20", fristBeginn: "2026-11-03", bisher: null });
ok(r4.ok && r4.von === "2026-11-03" && r4.tage === 2, "vor dem Fristbeginn ruht nichts: 03.–04.11. = 2", r4);
const r5 = R.kapitalRuhenRechnen({ von: "2026-10-20", bis: "2026-11-01", heute: "2026-11-20", fristBeginn: "2026-11-03", bisher: null });
ok(!r5.ok && /Fristbeginn/.test(r5.error), "ganz vor dem Fristbeginn → Fehler, kein Tag", r5);
const r6 = R.kapitalRuhenRechnen({ von: "2026-11-10", bis: "2026-11-14", heute: "2026-11-20", fristBeginn: "2026-11-03", bisher: "2026-11-15" });
ok(!r6.ok && /schon gezählt/.test(r6.error), "Überschneidung mit schon gezählten Tagen → kein Tag doppelt", r6);
ok(!R.kapitalRuhenRechnen({ von: "2026-11-25", bis: null, heute: "2026-11-20", fristBeginn: "2026-11-03", bisher: null }).ok, "Beginn in der Zukunft → Fehler");
ok(!R.kapitalRuhenRechnen({ von: "2026-11-10", bis: "2026-11-25", heute: "2026-11-20", fristBeginn: "2026-11-03", bisher: null }).ok, "Ende in der Zukunft → Fehler");
ok(!R.kapitalRuhenRechnen({ von: "2026-11-10", bis: "2026-11-10", heute: "2026-11-20", fristBeginn: "2026-11-03", bisher: null }).ok, "Ende = Beginn → kein Ruhetag");
ok(!R.kapitalRuhenRechnen({ von: "13.11.2026", bis: null, heute: "2026-11-20", fristBeginn: "2026-11-03", bisher: null }).ok, "falsches Datumsformat → Fehler");
const r7 = R.kapitalRuhenRechnen({ von: "2026-12-30", bis: "2027-01-03", heute: "2027-01-05", fristBeginn: "2026-11-03", bisher: null });
ok(r7.ok && r7.tage === 4 && r7.bisGezaehlt === "2027-01-02", "über den Jahreswechsel richtig gezählt", r7);
ok(!R.kapitalRuhenRechnen({ von: "2026-07-01", bis: null, heute: "2026-11-20", fristBeginn: "2026-07-01", bisher: null }).ok, "mehr als 120 Tage in einer Eintragung → erst mit Justin klären");

console.log("── 3 Lage fürs Chefbüro ──");
const basis = { fassungC: true, ruhenErweitert: true, datenVomKunden: false, status: "angenommen", fristBeginn: "2026-11-13", fristEnde: "2027-01-08", hemmungTage: 0, garantieErfuellt: false, erstattung: false, verlauf: [] as unknown[] };
const l1 = R.kapitalRuhenLage(basis);
ok(l1.sperre === null && l1.gruende.length === 4 && l1.erweitert && l1.bisher === null, "laufende Frist: Knopf frei, vier Gründe", l1);
ok(R.kapitalRuhenLage({ ...basis, status: "offen" }).sperre === "Erst nach der Annahme.", "offenes Angebot: gesperrt");
ok(/beginnt mit der Zahlung/.test(String(R.kapitalRuhenLage({ ...basis, fristBeginn: null, fristEnde: null }).sperre)), "ohne Frist (unbezahlt): gesperrt");
ok(/keine Frist mehr/.test(String(R.kapitalRuhenLage({ ...basis, garantieErfuellt: true }).sperre)) && /keine Frist mehr/.test(String(R.kapitalRuhenLage({ ...basis, erstattung: true }).sperre)), "nach erfüllter Garantie oder Garantiefall: gesperrt");
ok(R.kapitalRuhenLage({ ...basis, verlauf: [{ was: "x" }, { ruhenBis: "2026-11-15" }, { ruhenBis: "2026-11-20" }, { ruhenBis: "kaputt" }] }).bisher === "2026-11-20", "letzter gezählter Tag aus dem Verlauf (nur gültige Daten)");

console.log("── 4 Wortlaut: neu nur ab E-512 ──");
const V = C.KAPITAL_C_VORGABEN;
const par487 = { ...V, tempoFassung: "E-487" }; const par512 = { ...V, tempoFassung: "E-512" }; const parAlt = { ...V, tempoFassung: "" };
ok(C.KAPITAL_C_TEMPO_FASSUNG === "E-512" && C.kapitalCRuhenErweitert(par512) && !C.kapitalCRuhenErweitert(par487) && !C.kapitalCRuhenErweitert(parAlt), "E-512 ist aktuell; E-487 und leer lesen das alte Ruhen");
const G512 = C.kapitalCGarantie(par512); const G487 = C.kapitalCGarantie(par487); const GAlt = C.kapitalCGarantie(parAlt);
ok(/Behörde oder einem Register/.test(G512.info) && /höherer Gewalt/.test(G512.info) && /Eintragung Ihrer Gesellschaft, die EIN oder die ITIN/.test(G512.info), "E-512: Information vor Vertragsschluss nennt Mitwirkung, Behörde/Register, höhere Gewalt", G512.info);
ok(G487.info === GAlt.info && /Die Frist ruht nur/.test(G487.info) && !/Behörde/.test(G487.info), "E-487 und Bestand: Information unverändert (ruht nur …)");
ok(G487.seite === GAlt.seite && G487.karte === GAlt.karte && G487.frage === GAlt.frage && G487.uebersicht === GAlt.uebersicht, "E-487: Seite, Karte, Frage, Übersicht wortgleich wie Bestand");
ok(/Behörde/.test(G512.seite) && /Behörden/.test(G512.karte) && /US-Steuerbehörde/.test(G512.frage) && /Wartezeiten bei Behörden/.test(G512.uebersicht), "E-512: Seite, Karte, Frage, Übersicht sagen offen, was nicht mitzählt");
ok(G512.vertrag === G487.vertrag, "der Garantiesatz selbst (acht Wochen, Erstattung) bleibt gleich");
const parBestand = { ...par512, bestand: { name: "MUSTER LLC", bundesstaat: "Florida", registerNr: "L1", eingetragenAm: "2025-01-01", registerStand: "2026-11-12", registerStatus: "aktiv", erfolgBei: "buergschaft", gut: [], ordnung: [], daten: [] } } as any;
const GB = C.kapitalCGarantie(parBestand);
ok(!/Eintragung Ihrer Gesellschaft|die EIN /.test(GB.info) && /Berichtigung bei der US-Steuerbehörde/.test(GB.info), "Übernahme (E-506): keine Neugründungs-Worte im Ruhen", GB.info);

console.log("── 5 Vertragstext Ziffer 4 ──");
const D = (par: any) => ({ ref: "FIAON-IA-CTEST", fassung: C.KAPITAL_C_FASSUNG, gueltigBis: "2026-11-30", parameter: par, kunde: { art: "privat", anrede: "Herr", vorname: "Max", nachname: "Muster", email: "m@example.com", telefon: "", geburtsdatum: "1980-01-01", geburtsort: "", staatsangehoerigkeit: "deutsch", strasse: "A 1", plz: "10115", ort: "Berlin", land: "DE", ausweise: [] }, buergin: { name: "Bürgin LLC", anschrift: "Miami", bundesstaat: "Florida", registernummer: "L1" } }) as any;
const z4 = (par: any) => { try { const z = C.kapitalCZiffern(D({ unterlagen: [], staatenFassung: "E-465", bundesstaat: "Delaware", ...par })).find((x: any) => x.nr === 4); return JSON.stringify(z); } catch (e) { return `FEHLER ${String((e as Error)?.stack ?? e).split("\n").slice(0, 3).join(" | ")}`; } };
const t512 = z4(par512), t487 = z4(par487);
ok(/Behörde oder einem Register/.test(t512) && /höhere Gewalt/.test(t512) && /lässt die Frist weiterlaufen/.test(t512) && /verbindliche Fristen enthält allein dieser Vertrag/.test(t512), "E-512: Ziffer 4 mit Mitwirkung, Behörde/Register, höherer Gewalt, Institut läuft weiter, Vorrang", t512.slice(0, 200));
ok(!/Behörde oder einem Register/.test(t487) && /Sie ruht außerdem nur für die Tage/.test(t487) && !/verbindliche Fristen enthält allein/.test(t487), "E-487: Ziffer 4 wortgleich alt (kein neues Ruhen, kein Vorrangsatz)", t487.slice(0, 200));

console.log(`\n${gruen} grün, ${rot} rot.`);
process.exit(rot ? 1 : 0);
