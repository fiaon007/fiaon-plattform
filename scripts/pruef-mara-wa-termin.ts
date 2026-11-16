// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND MARA AUF WHATSAPP — DIE ZEITWAHL FÜR DAS GESPRÄCH MIT JUSTIN (16.11.2026)
//
// Befund 10.11.2026 (Produktion nur gelesen): Ein Business-Lead aus WhatsApp bekam fünfmal hintereinander wörtlich
// „Diese Zeit ist leider gerade vergeben“ — auch für die Zeit, die Mara selbst angeboten hatte. Ursache: Die Anfrage aus
// WhatsApp trug keine E-Mail, `buchen` las den Kontakt mit E-Mail-Pflicht, und jedes Scheitern hieß „vergeben“. Danach schloss
// sich sein Anruf-Auftrag mit „bitte nicht anrufen“, obwohl kein Termin stand.
//
//   A1 EINE Regel: jede angebotene Zeit besteht die Buchungsprüfung (freieZeitFinden — dieselbe Funktion in der Annahme).
//   A2 Text → Berliner Zeit („Freitag 9 Uhr“, „9.30“, „Dann 9“, Sommer-/Winterzeit, Mitternacht in Berlin vs. UTC).
//   A3 Der Verlauf vom 10.11. nachgespielt (ohne Namen): jede Antwort des Kunden bucht oder fragt eindeutig nach.
//   A4 Belegte Zeit → zwei konkrete freie Zeiten in der Nähe; die Sätze bestehen Hauswand und Business-Wand.
//   A5 Nie zweimal hintereinander dieselbe Absage.
//   A6 Kontakt ohne E-Mail (Anfrage aus WhatsApp) bucht; ergänzt aus einer zweiten Anfrage desselben Anschlusses.
//   A7 Anruf-Auftrag: „spricht auf WhatsApp mit Mara“ schließt ihn nicht mehr (bleibt offen bis zum Termin).
//
//   env -i PATH="$PATH" HOME="$HOME" node_modules/.bin/tsx scripts/pruef-mara-wa-termin.ts
//
// Reine Funktionen, keine Datenbank, kein Netz. Repo öffentlich: nur erfundene Menschen, Nummern aus dem Prüfbereich.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from "node:fs";

// Kein Schlüssel, keine echte Datenbank: Module, die den Pool nur importieren, bekommen eine Adresse, die nirgends hinführt.
for (const k of ["DATABASE_URL_EXTERN", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "WHATSAPP_TOKEN", "BREVO_API_KEY"]) {
  if (process.env[k]) { console.error(`ABBRUCH: ${k} ist gesetzt — dieser Prüfstand läuft nur ohne Schlüssel.`); process.exit(3); }
}
process.env.DATABASE_URL = "postgresql://pruef@127.0.0.1:9/keine";
process.env.CRONS = "aus";

let geprueft = 0, fehler = 0;
const ok = (b: unknown, t: string) => { geprueft++; if (!b) { fehler++; console.log(`  ✗ ${t}`); } };
const gleich = (ist: unknown, soll: unknown, t: string) => ok(JSON.stringify(ist) === JSON.stringify(soll), `${t} — ist: ${JSON.stringify(ist)}, soll: ${JSON.stringify(soll)}`);
const abschnitt = (t: string) => console.log(`\n── ${t}`);
const lies = (p: string) => readFileSync(p, "utf8");

const W = await import("../shared/fiaon-mara-wa-termin");
const MB = await import("../shared/fiaon-mara-business");
const TAKT = await import("../shared/fiaon-lead-takt");
const { globalZeitenRechnen, zweitenDeckelAnwenden } = await import("../server/lib/fiaon-global-zeiten");
const { globalKontaktLesen } = await import("../server/lib/fiaon-global-termin");
const { sendePruefung } = await import("../server/lib/fiaon-whatsapp");
const { plusWerktage } = await import("../shared/fiaon-wiedervorlage");

// Justins Gesprächszeiten im Prüfstand: Mo–Fr 09:00–12:00 (30-Minuten-Raster), höchstens 3 Lead-Gespräche je Tag.
const FENSTER = [1, 2, 3, 4, 5].map((wochentag) => ({ wochentag, von: "09:00", bis: "12:00", aktiv: true }));
const rechnen = (jetzt: Date, belegt: { beginn: string; dauerMin: number; zaehltAlsGlobal?: boolean }[] = []) =>
  globalZeitenRechnen({ jetzt, fenster: FENSTER, belegt, tage: 14, proTag: 3 });
// Der 10.11.2026, 08:42 Berlin (Dienstag) — wie im Befund.
const JETZT = new Date("2026-11-10T07:42:00.000Z");
const ERG = rechnen(JETZT);
const FREI = ERG.frei;

// ═══ A1 ════════════════════════════════════════════════════════════════════
abschnitt("A1 EINE Regel: was Mara anbietet, besteht die Buchungsprüfung");
ok(FREI.length > 20, `freie Zeiten gerechnet (${FREI.length})`);
const angebot = W.waZeitAngebot(FREI, 3);
gleich(angebot.length, 3, "Angebot: drei Zeiten an drei Tagen");
ok(new Set(angebot.map((x) => x.tag)).size === 3, "Angebot: drei verschiedene Tage");
for (const x of [...angebot, ...FREI.slice(0, 8)]) {
  ok(W.freieZeitFinden(FREI, x) === x, `angeboten ${x.tag} ${x.zeit} → die Buchungsprüfung sagt frei`);
  // So sieht Mara die Zeit im Auftrag: „Freitag, 13.11., 09:00 Uhr [2026-11-13 09:00]“ — und so schreibt sie sie zurück.
  const zeile = `${W.waZeitText(x.tag, x.zeit)} [${x.tag} ${x.zeit}]`;
  const m = zeile.match(/\[(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})\]/);
  ok(!!m && W.freieZeitFinden(FREI, { tag: m[1], zeit: m[2] }) === x, `Auftragszeile „${zeile}“ → zurückgelesen frei`);
}
// Mit dem zweiten Deckel (Gesamtdeckel) bleibt es dieselbe Liste, die die Annahme prüft.
const mitDeckel = zweitenDeckelAnwenden(ERG, { "2026-11-12": 0 });
ok(!mitDeckel.frei.some((f) => f.tag === "2026-11-12") && W.freieZeitFinden(mitDeckel.frei, { tag: "2026-11-12", zeit: "09:00" }) === null, "voller Tag (Gesamtdeckel) → weder angeboten noch buchbar");
ok(W.waZeitAngebot(mitDeckel.frei, 3).every((x) => W.freieZeitFinden(mitDeckel.frei, x) === x), "Angebot nach Deckel → alles buchbar");
gleich(W.waZeitNormal("9"), "09:00", "„9“ → 09:00");
gleich(W.waZeitNormal("9:00"), "09:00", "„9:00“ → 09:00");
gleich(W.waZeitNormal("9.30"), "09:30", "„9.30“ → 09:30");
gleich(W.waZeitNormal("09:30 Uhr"), "09:30", "„09:30 Uhr“ → 09:30");
gleich(W.waZeitNormal("25:00"), null, "25:00 → unlesbar");
gleich(W.waTagNormal("2026-11-31"), null, "31.11. gibt es nicht");
ok(W.freieZeitFinden(FREI, { tag: "2026-11-13", zeit: "9:00" })?.zeit === "09:00", "Modell schreibt „9:00“ → dieselbe freie Zeit wie „09:00“");
ok(W.freieZeitFinden(FREI, { tag: "2026-11-14", zeit: "09:00" }) === null, "Samstag → nicht frei (keine Arbeitszeit)");
ok(W.freieZeitFinden(FREI, { tag: "2026-11-10", zeit: "09:30" }) === null, "heute 09:30 bei 08:42 → nicht frei (zwei Stunden Vorlauf)");
const gt = lies("server/lib/fiaon-global-termin.ts");
ok(/const slot = freieZeitFinden\(angebot\.ergebnis\.frei, \{ tag: ein\.tag, zeit: ein\.zeit \}\);/.test(gt) && !/ergebnis\.frei\.find\(\(f\) => f\.tag === ein\.tag/.test(gt),
  "Quelltext: die Annahme (globalTerminBuchen) prüft mit DERSELBEN Funktion freieZeitFinden");
const mbs = lies("server/lib/fiaon-mara-business.ts");
ok(/const \{ globalAngebotLaden \} = await import\("\.\/fiaon-global-termin"\);\s*const st = await globalAngebotLaden\(\);/.test(mbs), "Quelltext: Maras freie Zeiten kommen aus globalAngebotLaden — derselben Quelle wie die Annahme");

// ═══ A2 ════════════════════════════════════════════════════════════════════
abschnitt("A2 Text → Berliner Zeit");
const w1 = W.waWunschAusText("Freitag 9 Uhr", JETZT);
gleich(w1, { tage: ["2026-11-13"], zeit: "09:00" }, "„Freitag 9 Uhr“ am Dienstag 10.11. → Freitag 13.11., 09:00");
gleich(W.freieZeitFinden(FREI, { tag: w1.tage[0], zeit: w1.zeit })?.beginn, "2026-11-13T08:00:00.000Z", "… = 08:00 UTC (Winterzeit, Berlin = UTC+1)");
const SOMMER = new Date("2026-07-07T06:00:00.000Z");
const wS = W.waWunschAusText("Freitag 9 Uhr", SOMMER);
gleich(wS.tage[0], "2026-07-10", "Sommer: „Freitag 9 Uhr“ am Dienstag 07.07. → Freitag 10.07.");
gleich(W.freieZeitFinden(rechnen(SOMMER).frei, { tag: wS.tage[0], zeit: wS.zeit })?.beginn, "2026-07-10T07:00:00.000Z", "… = 07:00 UTC (Sommerzeit, Berlin = UTC+2)");
gleich(W.waWunschAusText("Freitag um 9", JETZT), { tage: ["2026-11-13"], zeit: "09:00" }, "„Freitag um 9“");
gleich(W.waWunschAusText("9.30", JETZT), { tage: [], zeit: "09:30" }, "„9.30“ → 09:30, Tag aus dem Zusammenhang");
gleich(W.waWunschAusText("Dan 9", JETZT), { tage: [], zeit: "09:00" }, "„Dan 9“ (Tippfehler) → 09:00");
gleich(W.waUhrzeitAusText("Hier steht doch um 9.00?"), "09:00", "„Hier steht doch um 9.00?“ → 09:00");
gleich(W.waUhrzeitAusText("halb 10"), "09:30", "„halb 10“ → 09:30");
gleich(W.waWunschAusText("Am 13.11. um 9", JETZT), { tage: ["2026-11-13"], zeit: "09:00" }, "„Am 13.11. um 9“ — das Datum ist keine Uhrzeit");
gleich(W.waWunschAusText("Montag 16.11. 10:30 Uhr", JETZT), { tage: ["2026-11-16"], zeit: "10:30" }, "Wochentag + Datum desselben Tages → ein Tag");
gleich(W.waUhrzeitAusText("Wir haben 12 Mitarbeiter und wollen in den USA expandieren"), null, "langer Satz mit Zahl → keine Uhrzeit");
gleich(W.waUhrzeitAusText("Sie sind verwirrt"), null, "„Sie sind verwirrt“ → keine Uhrzeit");
gleich(W.waUhrzeitAusText("9 oder 10 Uhr"), null, "zwei Uhrzeiten → unklar (nicht raten)");
gleich(W.waTageAusText("übermorgen", JETZT), ["2026-11-12"], "„übermorgen“ → 12.11. (nicht „morgen“)");
const FR_MITTAG = new Date("2026-11-13T11:00:00.000Z"); // Freitag 12:00 Berlin
const naechsterFr = W.waTerminEntscheiden({ modell: null, kunde: "Freitag 9 Uhr", kontext: null, jetzt: FR_MITTAG, frei: rechnen(FR_MITTAG).frei });
ok(naechsterFr.art === "rueckfrage" && naechsterFr.kandidaten.length === 1 && naechsterFr.kandidaten[0].tag === "2026-11-20", "„Freitag 9 Uhr“ am Freitag um 12 → nachfragen „Meinen Sie Freitag, 20.11.?“ (nie still eine Woche später buchen)");
gleich(W.waTageAusText("Guten Morgen, morgen passt", JETZT), ["2026-11-11"], "„Guten Morgen“ ist kein Tag, „morgen“ schon");
// Mitternacht: 23:30 UTC am 12.11. ist in Berlin schon Freitag, der 13.11. — „heute“ muss der Berliner Tag sein.
gleich(W.waTageAusText("heute", new Date("2026-11-12T23:30:00.000Z")), ["2026-11-13"], "„heute“ um 00:30 Berlin = Berliner Tag (nicht der UTC-Tag)");
gleich(W.waTageAusText("Freitag, 13.11., 09:00 Uhr oder Montag, 16.11., 09:00 Uhr", JETZT), ["2026-11-13", "2026-11-16"], "Maras Satz mit zwei Zeiten → zwei Tage, in Textreihenfolge");

// ═══ A3 ════════════════════════════════════════════════════════════════════
abschnitt("A3 Der Verlauf vom 10.11. nachgespielt");
const MARA1 = "Sehr gern, Herr Schwarzott kann Sie per WhatsApp anrufen. Dafür bräuchte ich nur eine feste Zeit: Freitag wären noch 09:30 Uhr, 10:30 Uhr oder 11:30 Uhr deutscher Zeit frei.";
const MARA2 = "Herr Schwarzott hat zum Beispiel Freitag, 13.11., 09:00 Uhr oder Montag, 16.11., 09:00 Uhr frei. Was passt Ihnen am besten?";
const ent = (modell: any, kunde: string, kontext: string | null, frei = FREI) => W.waTerminEntscheiden({ modell, kunde, kontext, jetzt: JETZT, frei });
const b1 = ent({ tag: "2026-11-13", zeit: "09:30" }, "9.30", MARA1);
ok(b1.art === "buchen" && b1.slot.tag === "2026-11-13" && b1.slot.zeit === "09:30" && b1.quelle === "modell", "„9.30“ (Modell: Freitag 09:30) → buchen");
const b1b = ent({ tag: "2026-11-13", zeit: "9.30" }, "9.30", MARA1);
ok(b1b.art === "buchen" && b1b.slot.zeit === "09:30", "Modell schreibt „9.30“ → normalisiert, buchen");
const b1c = ent(null, "9.30", MARA1);
ok(b1c.art === "buchen" && b1c.slot.tag === "2026-11-13" && b1c.slot.zeit === "09:30" && b1c.quelle === "kunde", "ohne Modellzeit: „9.30“ + Maras „Freitag“ → Freitag 09:30 buchen");
const b2 = ent({ tag: "2026-11-13", zeit: "09:00" }, "Dan 9", MARA2);
ok(b2.art === "buchen" && b2.slot.zeit === "09:00", "„Dan 9“ (Modell: Freitag 09:00 — Maras eigenes Angebot) → buchen");
const b2b = ent(null, "Dan 9", MARA2);
ok(b2b.art === "rueckfrage" && b2b.kandidaten.length === 2 && b2b.kandidaten[0].tag === "2026-11-13" && b2b.kandidaten[1].tag === "2026-11-16",
  "„Dan 9“ ohne Modellzeit, zwei Tage im Angebot → nachfragen (Freitag oder Montag), nicht raten");
const b3 = ent(null, "Freitag um 9", MARA2);
ok(b3.art === "buchen" && b3.slot.tag === "2026-11-13" && b3.slot.zeit === "09:00", "„Freitag um 9“ → Freitag 09:00 buchen");
ok(b3.art === "buchen" && b3.slot.beginn === "2026-11-13T08:00:00.000Z", "… Beginn 08:00 UTC = 09:00 Berlin");
const b4 = ent({ tag: "2026-11-14", zeit: "09:00" }, "Freitag um 9", MARA2);
ok(b4.art === "buchen" && b4.slot.tag === "2026-11-13", "Modell greift daneben (Samstag), seine Worte sagen Freitag 9 → Freitag 09:00 buchen");
const b5 = ent({ tag: "2026-11-13", zeit: "09:00" }, "Freitag kann ich doch nicht, lieber Montag", MARA2);
ok(b5.art === "buchen" && b5.slot.tag === "2026-11-13", "freie Modellzeit gilt (das Modell liest den ganzen Verlauf) — der Leser greift nur ein, wenn sie nicht frei ist");
const b6 = ent({ tag: "2026-11-14", zeit: "09:00" }, "Freitag passt nicht, lieber Samstag 9", MARA2);
ok(b6.art === "nicht_frei" && b6.wunsch.tag === "2026-11-14", "verschiebt/sagt ab („passt nicht“) → der Leser rät nie, Samstag ist nicht frei");
const b7 = ent({ tag: "2026-11-13", zeit: "09:00" }, "Sie sind verwirrt", MARA2);
ok(b7.art === "buchen", "„Sie sind verwirrt“ mit Freitag 09:00 vom Modell → buchen (vorher: zum fünften Mal „vergeben“)");
const b8 = ent({ tag: "", zeit: "" }, "ok", null);
ok(b8.art === "rueckfrage" && b8.kandidaten.length === 2, "gar nichts Lesbares → nachfragen mit zwei Zeiten (nie „vergeben“)");

// ═══ A4 ════════════════════════════════════════════════════════════════════
abschnitt("A4 Belegte Zeit → zwei konkrete freie Zeiten");
const BELEGT = rechnen(JETZT, [{ beginn: "2026-11-13T08:00:00.000Z", dauerMin: 30, zaehltAlsGlobal: true }]).frei;
ok(W.freieZeitFinden(BELEGT, { tag: "2026-11-13", zeit: "09:00" }) === null, "Freitag 09:00 belegt → nicht frei");
const n1 = ent({ tag: "2026-11-13", zeit: "09:00" }, "Freitag um 9", MARA2, BELEGT);
ok(n1.art === "nicht_frei", "belegte Wunschzeit → „nicht frei“");
if (n1.art === "nicht_frei") {
  gleich(n1.alternativen.length, 2, "genau zwei Alternativen");
  ok(n1.alternativen.every((a) => W.freieZeitFinden(BELEGT, a) === a), "beide Alternativen bestehen die Buchungsprüfung");
  ok(n1.alternativen.every((a) => !(a.tag === "2026-11-13" && a.zeit === "09:00")), "die belegte Zeit ist nie eine Alternative");
  gleich(n1.alternativen.map((a) => `${a.tag} ${a.zeit}`), ["2026-11-13 09:30", "2026-11-13 10:00"], "Alternativen: derselbe Freitag, die nächsten Uhrzeiten");
}
gleich(W.zweiAlternativen(BELEGT, { tag: "2026-11-14", zeit: "09:00" }).map((a) => `${a.tag} ${a.zeit}`), ["2026-11-13 09:30", "2026-11-13 10:00"], "Samstag 9 → nächster Arbeitstag, nächste Uhrzeiten");
gleich(W.zweiAlternativen(BELEGT, { tag: null, zeit: null }).length, 2, "ohne Wunsch → die zwei frühesten");
gleich(W.zweiAlternativen([], { tag: "2026-11-13", zeit: "09:00" }), [], "keine freie Zeit → keine Alternative (dann Übergabe)");
const satzA = W.satzNichtFrei({ wunsch: W.waZeitText("2026-11-13", "09:00"), alternativen: ["Freitag, 13.11., 09:30 Uhr", "Freitag, 13.11., 10:00 Uhr"], link: "https://fiaon.com/g/Ab3dEf7hJk", art: "alternativen" });
ok(/Freitag, 13\.11\., 09:00 Uhr ist bei Herrn Schwarzott leider nicht frei\./.test(satzA) && /09:30 Uhr oder Freitag, 13\.11\., 10:00 Uhr/.test(satzA), `Absage nennt den Wunsch und zwei Zeiten: „${satzA}“`);
ok(!/vergeben\.\s*Sehr gern/.test(satzA) && !/gerade vergeben/.test(satzA), "kein „vergeben. Sehr gern.“ mehr");
const saetze = [
  satzA,
  W.satzNichtFrei({ wunsch: null, alternativen: ["Freitag, 13.11., 09:30 Uhr"], link: null, art: "alternativen" }),
  W.satzNichtFrei({ wunsch: W.waZeitText("2026-11-13", "09:00"), alternativen: [], link: "https://fiaon.com/g/Ab3dEf7hJk", art: "uebergabe" }),
  W.satzNichtFrei({ wunsch: "Friday, 13.11., 09:00", alternativen: ["Friday, 13.11., 09:30", "Monday, 16.11., 09:00"], link: null, art: "alternativen", englisch: true }),
  W.satzNichtFrei({ wunsch: null, alternativen: [], link: null, art: "uebergabe", englisch: true }),
  W.satzRueckfrage(["Freitag, 13.11., 09:00 Uhr", "Montag, 16.11., 09:00 Uhr"], null),
  W.satzRueckfrage(["Freitag, 13.11., 09:00 Uhr"], null), W.satzRueckfrage([], null), W.satzRueckfrage(["Friday, 13.11., 09:00"], "https://fiaon.com/g/Ab3dEf7hJk", true),
  W.satzWunschWeitergegeben("Freitag, 13.11., 09:30 Uhr"), W.satzWunschWeitergegeben(null, true),
];
for (const s of saetze) {
  const f = [...sendePruefung(s, { namen: [] }), ...MB.businessWand(s, { ersteAntwort: false })];
  ok(f.length === 0, `Satz „${s.slice(0, 60)}…“ besteht Hauswand und Business-Wand (${f.join(" · ")})`);
  ok(!/vergeben/i.test(s), `Satz ohne „vergeben“: „${s.slice(0, 40)}…“`);
}
ok(/Meinen Sie Freitag, 13\.11\., 09:00 Uhr oder Montag, 16\.11\., 09:00 Uhr\?/.test(saetze[5]), "Rückfrage nennt beide Zeiten");

// ═══ A5 ════════════════════════════════════════════════════════════════════
abschnitt("A5 Nie zweimal hintereinander dieselbe Absage");
const ALT_SATZ = "Diese Zeit ist leider gerade vergeben. Sehr gern. Herr Schwarzott hat zum Beispiel Freitag, 13.11., 09:00 Uhr oder Montag, 16.11., 09:00 Uhr frei. Was passt Ihnen am besten?";
gleich(W.waAbsageArt(null, 2), "alternativen", "erste Absage → mit zwei Zeiten");
gleich(W.waAbsageArt(MARA2, 2), "alternativen", "davor ein Angebot (keine Absage) → mit zwei Zeiten");
gleich(W.waAbsageArt(satzA, 2), "uebergabe", "davor schon eine Absage mit Zeiten → Übergabe an Herrn Schwarzott");
gleich(W.waAbsageArt(ALT_SATZ, 2), "uebergabe", "davor der alte Satz („gerade vergeben“) → Übergabe (gilt auch für Gespräche von vor dem Fix)");
gleich(W.waAbsageArt(saetze[2], 2), "alternativen", "davor die Übergabe → wieder mit Zeiten (nicht dieselbe Übergabe)");
gleich(W.waAbsageArt(null, 0), "uebergabe", "keine freie Zeit mehr → Übergabe");
// Fünf Fehlgriffe in Folge wie am 10.11. — nie zweimal derselbe Satz, jede zweite Absage geht an Herrn Schwarzott.
let letzte: string | null = MARA1;
const folge: string[] = [];
for (const wunsch of [["2026-11-13", "09:00"], ["2026-11-13", "09:00"], ["2026-11-13", "09:00"], ["2026-11-13", "09:00"], ["2026-11-13", "09:00"]]) {
  const alt = W.zweiAlternativen(BELEGT, { tag: wunsch[0], zeit: wunsch[1] });
  const art = W.waAbsageArt(letzte, alt.length);
  const s = W.satzNichtFrei({ wunsch: W.waZeitText(wunsch[0], wunsch[1]), alternativen: alt.map((a) => W.waZeitText(a.tag, a.zeit)), link: null, art });
  folge.push(art);
  ok(s.trim() !== String(letzte ?? "").trim(), `Absage ${folge.length} ist nicht wörtlich die vorige`);
  letzte = s;
}
gleich(folge, ["alternativen", "uebergabe", "alternativen", "uebergabe", "alternativen"], "fünf Fehlgriffe: Zeiten und Übergabe wechseln sich ab");
ok(!/"Diese Zeit ist leider gerade vergeben\./.test(mbs) && !/"That time has just been taken/.test(mbs), "Quelltext: der alte Satz „Diese Zeit ist leider gerade vergeben“ ist aus Maras Server-Antwort raus");
ok(/waAbsageArt\(letzteMara, alternativen\.length\)/.test(mbs) && /text\.trim\(\) === letzteMara\.trim\(\)\) text = satzUebergabe/.test(mbs), "Quelltext: Absage-Art aus Maras letzter Nachricht + Wache gegen wörtliche Wiederholung");
ok(/if \(b\.grund === "nicht_frei"\)/.test(mbs) && /satzWunschWeitergegeben\(zeitText\(e\.slot\.tag, e\.slot\.zeit\), k\.englisch\);\s*await ein\.anJustinUebergeben/.test(mbs), "Quelltext: nur „nicht_frei“ wird als nicht frei gesagt; technischer Fehler → Wunsch an Justin, nie „vergeben“");

// ═══ A6 ════════════════════════════════════════════════════════════════════
abschnitt("A6 Kontakt ohne E-Mail (Anfrage aus WhatsApp)");
const roh = { name: "Business-Lead", firma: "", email: "", telefon: "+4915500000001", sprache: "de" };
const kOhne = globalKontaktLesen(roh, { ohneMail: true });
ok(!("error" in kOhne) && (kOhne as any).email === "" && (kOhne as any).telefon === "+4915500000001", "Maras Buchung: leere E-Mail erlaubt → Kontakt gültig (vorher: Fehler → „vergeben“)");
const kForm = globalKontaktLesen(roh);
ok("error" in kForm && (kForm as any).feld === "email", "öffentliches Formular (ohne opt): E-Mail bleibt Pflicht");
const kKaputt = globalKontaktLesen({ ...roh, email: "kaputt@" }, { ohneMail: true });
ok("error" in kKaputt && (kKaputt as any).feld === "email", "auch für Mara: eine FALSCHE E-Mail fliegt (nur eine leere ist erlaubt)");
gleich(W.kontaktErgaenzen({ name: "", firma: "", email: "" }, [{ name: "Max Muster", firma: "Muster GmbH", email: "max@muster.example" }]),
  { name: "Max Muster", firma: "Muster GmbH", email: "max@muster.example" }, "leere Felder aus der zweiten Anfrage desselben Anschlusses");
gleich(W.kontaktErgaenzen({ name: "Erika Beispiel", firma: "", email: "erika@beispiel.example" }, [{ name: "Max Muster", firma: "Muster GmbH", email: "max@muster.example" }]),
  { name: "Erika Beispiel", firma: "Muster GmbH", email: "erika@beispiel.example" }, "was da ist, bleibt — nur Leeres wird gefüllt");
gleich(W.kontaktErgaenzen(null, [{ email: "kaputt" }, { email: "ok@muster.example" }]).email, "", "eine unlesbare Adresse wird nie übernommen (die erste nicht-leere zählt)");
ok(/const kontakt = globalKontaktLesen\([\s\S]{0,300}?\{ ohneMail: true \}/.test(mbs), "Quelltext: Maras buchen liest den Kontakt mit { ohneMail: true }");
ok(/kontaktErgaenzen\(a, weitere\)/.test(mbs) && /RIGHT\(REGEXP_REPLACE\(COALESCE\(telefon, ''\), '\\\\D', '', 'g'\), 9\) = \$\{k9\}/.test(mbs), "Quelltext: businessKontakt ergänzt aus Anfragen desselben Anschlusses");
ok(/if \(!k\.email\) console\.log\([^)]*ohne E-Mail/.test(gt) && /else await versendenUndProtokollieren\(\s*"global_termin"/.test(gt), "Quelltext: ohne E-Mail keine Bestätigungs-Mail (Mara bestätigt auf WhatsApp)");

// ═══ A7 ════════════════════════════════════════════════════════════════════
abschnitt("A7 Anruf-Auftrag: ohne Termin nie „bitte nicht anrufen“ durch Mara");
gleich(TAKT.auftragNachEreignis("weg_whatsapp"), "offen_lassen", "„spricht auf WhatsApp mit Mara“ → Anruf-Auftrag bleibt offen");
gleich(TAKT.auftragNachEreignis("termin_gebucht"), "schliessen", "Termin gebucht → Auftrag schließt sich (unverändert)");
gleich(TAKT.auftragNachEreignis("weg_mail"), "schliessen", "Wahl E-Mail → Justin schreibt, Auftrag zu (unverändert)");
const lt = lies("server/lib/fiaon-lead-takt.ts");
const satzWa = lt.match(/weg_whatsapp: "([^"]+)"/)?.[1] ?? "";
ok(!!satzWa && !/bitte nicht anrufen/.test(satzWa), `Vermerk für WhatsApp ohne „bitte nicht anrufen“: „${satzWa}“`);
ok(/weg === "whatsapp" \? \{ wiedervorlage: plusWerktage\(berlinHeuteIso\(\), 1\) \}/.test(mbs), "Quelltext: wegSetzen gibt für WhatsApp die Wiedervorlage am nächsten Werktag mit");
gleich(plusWerktage("2026-11-13", 1), "2026-11-16", "Wiedervorlage: Freitag → Montag");
gleich(plusWerktage("2026-11-10", 1), "2026-11-11", "Wiedervorlage: Dienstag → Mittwoch");

console.log(`\n${fehler ? `✗ ${fehler} von ${geprueft} Prüfungen rot.` : `✓ ${geprueft} von ${geprueft} Prüfungen bestanden.`}`);
process.exit(fehler ? 1 : 0);
