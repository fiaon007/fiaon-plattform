// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-IT-G (08.10.2026), Punkt (14): GEBURTSDATUM
//
// Teil A — offline, reine Funktionen (immer):
//   der eine Leser (shared/fiaon-geburtsdatum.ts): Formen, Jahrhundert,
//   Kalender, Kontexte, Speichern-Regel, Anzeige; Gleichlauf mit den alten
//   Regeln (geburtPruefen im Antrag neu, datumIso/alterAm der Auskunft-Seite);
//   die Kündigungs-Identifikation; Quelltext-Wände (kein type=date, keine
//   Jahr-Listen, keine zweistellige Anzeige, Fehler der Stammdaten-Route).
// Teil B — lokale Datenbank (nur, wenn DATABASE_URL auf 127.0.0.1 zeigt):
//   der eine Schreibweg (Person + alle Bestellungen), Prüfung, Rückfrage,
//   Entfernen nur Leitung, die CHECK-Wand (Migration 103).
// Teil C — lokaler Server (nur mit PRUEF_BASIS=http://127.0.0.1:5317):
//   Routen über HTTP und das Bauteil im Browser (Tippen 1-7-1-1-6-3,
//   Einfügen, Rücktaste, Akte „Kunde bearbeiten“, Kündigungsseite ohne
//   Geburtsdatum). Fremde Wege werden nicht berührt; Testdaten entstehen nur
//   in der eigenen lokalen Kopie und werden am Ende entfernt.
//
//   npx tsx scripts/pruef-it-g.ts                                   # Teil A
//   DATABASE_URL=postgresql://fiaon@127.0.0.1:54329/fiaon_it_g \
//   SESSION_SECRET=… PRUEF_BASIS=http://127.0.0.1:5317 npx tsx scripts/pruef-it-g.ts   # A + B + C
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from "node:fs";
import {
  geburtsdatumLesen as L, geburtsdatumFuerSpeicher, geburtsdatumAnzeige, geburtsdatumLang, geburtsdatumMitAlter,
  geburtsdatumIso, jahrErgaenzen, alterAm, tageImMonat, geburtTeileAusEingabe, geburtTextAusTeile, geburtTeileAusText,
  geburtSpeicherbar, berlinHeuteIso, GEBURT_TEXTE, type GeburtKontext,
} from "../shared/fiaon-geburtsdatum";
import { geburtPruefen } from "../shared/fiaon-antrag-neu";

let ok = 0;
let rot = 0;
const fehler: string[] = [];
function pruef(name: string, bedingung: boolean, hinweis = ""): void {
  if (bedingung) { ok++; if (process.env.LAUT) console.log(`  ok    ${name}`); }
  else { rot++; fehler.push(name); console.log(`  ROT   ${name}${hinweis ? `  → ${hinweis}` : ""}`); }
}
function titel(t: string): void { console.log(`\n${"─".repeat(72)}\n${t}\n${"─".repeat(72)}`); }
const H = "2026-10-07";
const quelle = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

// ═════════════════════════════════════════════════════════════════════════
titel("A1  Der Leser: Formen, Jahrhundert, Kalender (heute = 07.10.2026)");
// ═════════════════════════════════════════════════════════════════════════
const FAELLE: [unknown, GeburtKontext, string, string | null, boolean?][] = [
  // [Eingabe, Kontext, erwarteter Stand, erwartetes ISO, jahrErgaenzt]
  ["14.03.1963", "akte", "ok", "1963-03-14", false],
  ["14.3.63", "akte", "ok", "1963-03-14", true],
  ["140363", "akte", "ok", "1963-03-14", true],
  ["14031963", "akte", "ok", "1963-03-14", false],
  ["19630314", "akte", "ok", "1963-03-14", false],
  ["1963-03-14", "akte", "ok", "1963-03-14", false],
  ["1963-03-14T00:00:00.000Z", "akte", "ok", "1963-03-14", false],
  ["14. März 1963", "akte", "ok", "1963-03-14", false],
  ["14 Maerz 1963", "akte", "ok", "1963-03-14", false],
  ["14. Mär 63", "akte", "ok", "1963-03-14", true],
  ["14/03/1963", "akte", "ok", "1963-03-14", false],
  ["14-3-1963", "akte", "ok", "1963-03-14", false],
  ["14 3 1963", "akte", "ok", "1963-03-14", false],
  ["  14.03.1963  ", "akte", "ok", "1963-03-14", false],
  [{ tag: "17", monat: "11", jahr: "63" }, "akte", "ok", "1963-11-17", true],
  [{ tag: "7", monat: "1", jahr: "1980" }, "akte", "ok", "1980-01-07", false],
  [{ tag: "17", monat: "November", jahr: "1963" }, "akte", "ok", "1963-11-17", false],
  ["17.11.0063", "akte", "ungueltig", null],
  ["0063-11-17", "akte", "ungueltig", null],
  ["17.11.1899", "akte", "ungueltig", null],
  ["29.02.1963", "akte", "ungueltig", null],
  ["29.02.1964", "akte", "ok", "1964-02-29", false],
  ["29.02.2000", "pruefung", "ok", "2000-02-29", false],
  ["29.02.1900", "pruefung", "ungueltig", null],
  ["31.04.1980", "akte", "ungueltig", null],
  ["31.12.1980", "akte", "ok", "1980-12-31", false],
  ["00.01.1980", "akte", "ungueltig", null],
  ["32.01.1980", "akte", "ungueltig", null],
  ["03/14/1990", "akte", "ungueltig", null],
  ["13.13.1990", "akte", "ungueltig", null],
  ["01.01.1900", "akte", "zu_alt", "1900-01-01"],
  ["01.01.1900", "pruefung", "ok", "1900-01-01", false],
  ["07.10.2008", "vertrag", "ok", "2008-10-07", false],
  ["08.10.2008", "vertrag", "zu_jung", "2008-10-08"],
  ["08.10.2008", "akte", "pruefen", "2008-10-08"],
  ["08.10.2008", "pruefung", "ok", "2008-10-08", false],
  ["01.01.2030", "akte", "zukunft", "2030-01-01"],
  ["08.10.2026", "pruefung", "zukunft", "2026-10-08"],
  ["07.10.2026", "pruefung", "ok", "2026-10-07", false],
  ["5.6.07", "akte", "ok", "2007-06-05", true],
  ["5.6.09", "akte", "pruefen", "2009-06-05", true],
  ["14.3.27", "akte", "pruefen", "1927-03-14", true],
  ["14.3.27", "vertrag", "ok", "1927-03-14", true],
  ["1.1.00", "pruefung", "ok", "2000-01-01", true],
  ["14.3.10", "vertrag", "zu_jung", "2010-03-14", true],
  ["14.3.11", "vertrag", "zu_alt", "1911-03-14", true],
  ["15.06.1931", "akte", "pruefen", "1931-06-15"],
  ["15.06.1932", "akte", "ok", "1932-06-15", false],
  ["15.06.2010", "mitarbeiter", "ok", "2010-06-15", false],
  ["15.06.2011", "mitarbeiter", "zu_jung", "2011-06-15"],
  ["1415", "akte", "unvollstaendig", null],
  ["1403196", "akte", "unvollstaendig", null],
  ["14.03.", "akte", "unvollstaendig", null],
  ["14.03.196", "akte", "unvollstaendig", null],
  [{ tag: "14", monat: "", jahr: "1963" }, "akte", "unvollstaendig", null],
  [{ tag: "14", monat: "03", jahr: "1" }, "akte", "unvollstaendig", null],
  ["", "akte", "leer", null],
  [null, "akte", "leer", null],
  [{ tag: "", monat: "", jahr: "" }, "akte", "leer", null],
  ["gestern", "akte", "ungueltig", null],
  ["123456789", "akte", "ungueltig", null],
  ["14.Foo.1963", "akte", "ungueltig", null],
];
for (const [roh, k, stand, iso, ergaenzt] of FAELLE) {
  const e = L(roh, k, H);
  pruef(`${JSON.stringify(roh)} (${k}) → ${stand} ${iso ?? ""}`, e.stand === stand && e.iso === iso && (ergaenzt === undefined || e.jahrErgaenzt === ergaenzt),
    `bekam ${e.stand} ${e.iso} ergänzt=${e.jahrErgaenzt} „${e.meldung}“`);
  pruef(`${JSON.stringify(roh)}: Meldung bei nicht-ok`, e.stand === "ok" ? e.meldung === "" : e.meldung.length > 10, e.meldung);
  if (e.iso) pruef(`${JSON.stringify(roh)}: Anzeige vierstellig`, /^\d{2}\.\d{2}\.\d{4}$/.test(e.anzeige) && e.lang.endsWith(String(e.jahr)), e.anzeige);
}
// Das Jahrhundert für jedes zweistellige Jahr: nie 0063, immer der Mensch ab 16.
for (let yy = 0; yy <= 99; yy++) {
  const j = jahrErgaenzen(yy, H);
  pruef(`Jahrhundert ${String(yy).padStart(2, "0")}`, j === (yy <= 10 ? 2000 + yy : 1900 + yy), String(j));
}
pruef("Jahrhundert wandert mit dem Jahr (2030: „14“ → 2014)", jahrErgaenzen(14, "2030-01-01") === 2014 && jahrErgaenzen(15, "2030-01-01") === 1915);
pruef("Schaltjahre in Zahlen", tageImMonat(2000, 2) === 29 && tageImMonat(1900, 2) === 28 && tageImMonat(2024, 2) === 29 && tageImMonat(2023, 2) === 28 && tageImMonat(1980, 4) === 30);
pruef("Alter auf den Tag (Geburtstag heute zählt)", alterAm("2008-10-07", H) === 18 && alterAm("2008-10-08", H) === 17 && alterAm("1963-11-17", H) === 62);
pruef("Berlin-Tag aus formatToParts (23:30 UTC = nächster Tag in Berlin)", berlinHeuteIso(new Date("2026-10-07T23:30:00Z")) === "2026-10-08" && berlinHeuteIso(new Date("2026-10-07T21:30:00Z")) === "2026-10-07");

// ═════════════════════════════════════════════════════════════════════════
titel("A2  Speichern, Anzeige, Text-Formulare");
// ═════════════════════════════════════════════════════════════════════════
{
  const s1 = geburtsdatumFuerSpeicher("", "akte", { heuteIso: H });
  const s2 = geburtsdatumFuerSpeicher(null, "akte", { heuteIso: H });
  const s3 = geburtsdatumFuerSpeicher(undefined, "akte", { heuteIso: H });
  pruef("„“ / null / undefined heißen „keine Änderung“ (nie löschen)", s1.ok && s1.aenderung === "keine" && s2.ok && s2.aenderung === "keine" && s3.ok && s3.aenderung === "keine");
  const s4 = geburtsdatumFuerSpeicher("", "akte", { loeschen: true });
  pruef("Löschen nur ausdrücklich", s4.ok && s4.aenderung === "loeschen");
  const s5 = geburtsdatumFuerSpeicher("01.01.2010", "akte", { heuteIso: H });
  pruef("Rückfrage ohne Bestätigung → abgelehnt mit rueckfrage", !s5.ok && s5.rueckfrage && s5.stand === "pruefen");
  const s6 = geburtsdatumFuerSpeicher("01.01.2010", "akte", { heuteIso: H, bestaetigt: true });
  pruef("Rückfrage mit Bestätigung → speichern", s6.ok && s6.aenderung === "setzen" && s6.iso === "2010-01-01");
  const s7 = geburtsdatumFuerSpeicher("0063-11-17", "akte", { heuteIso: H, bestaetigt: true });
  pruef("0063 auch mit Bestätigung nie speicherbar", !s7.ok && !s7.rueckfrage);
  const s8 = geburtsdatumFuerSpeicher("17.11.63", "akte", { heuteIso: H });
  pruef("„17.11.63“ wird als 1963-11-17 gespeichert", s8.ok && s8.aenderung === "setzen" && s8.iso === "1963-11-17");
  const s9 = geburtsdatumFuerSpeicher("01.01.2010", "vertrag", { heuteIso: H, bestaetigt: true });
  pruef("Vertrag: unter 18 hart (auch mit Bestätigung)", !s9.ok && s9.stand === "zu_jung");
  pruef("geburtSpeicherbar", geburtSpeicherbar({ stand: "ok" }) && !geburtSpeicherbar({ stand: "pruefen" }) && geburtSpeicherbar({ stand: "pruefen" }, true) && !geburtSpeicherbar({ stand: "zu_alt" }, true));

  pruef("Anzeige 1927 nie zweistellig", geburtsdatumAnzeige("1927-04-20") === "20.04.1927");
  pruef("Anzeige mit Uhrzeit", geburtsdatumAnzeige("1963-11-17T00:00:00.000Z") === "17.11.1963");
  pruef("Anzeige: unlesbarer Wert bleibt sichtbar", geburtsdatumAnzeige("0063-11-17") === "0063-11-17");
  pruef("Anzeige leer", geburtsdatumAnzeige(null) === "" && geburtsdatumAnzeige("") === "");
  pruef("Lang", geburtsdatumLang("1963-11-17") === "17. November 1963");
  pruef("Mit Alter", geburtsdatumMitAlter("1963-11-17", H) === "17.11.1963 · 62 Jahre" && geburtsdatumMitAlter("2025-10-01", H) === "01.10.2025 · 1 Jahr");
  pruef("Iso für Vergleiche", geburtsdatumIso("1963-11-17") === "1963-11-17" && geburtsdatumIso("17.11.1963") === "1963-11-17" && geburtsdatumIso("0063-11-17") === null && geburtsdatumIso(null) === null);
  // Gegenprüfung 08.10. (niedrig): zweistellige Jahre wurden zu 99xx („17.11.63“ → 9963-11-17).
  pruef("Iso: zweistelliges Jahr → 1963, nie 9963", geburtsdatumIso("17.11.63") === "1963-11-17" && geburtsdatumIso("171163") === "1963-11-17", String(geburtsdatumIso("17.11.63")));
  pruef("Anzeige/Lang/MitAlter: zweistelliges Jahr → 1963", geburtsdatumAnzeige("17.11.63") === "17.11.1963" && geburtsdatumLang("17.11.63") === "17. November 1963" && geburtsdatumMitAlter("17.11.63", H).startsWith("17.11.1963 · 62"), geburtsdatumAnzeige("17.11.63"));
  pruef("Iso: Datum in der Zukunft behält sein iso (für Vergleiche)", geburtsdatumIso("2099-01-01") === "2099-01-01");

  // Freie Eingabe → drei Felder (Einfügen, Autofill)
  const v1 = geburtTeileAusEingabe("17.11.1963"), v2 = geburtTeileAusEingabe("1963-11-17"), v3 = geburtTeileAusEingabe("7.1.80");
  pruef("Einfügen „17.11.1963“", JSON.stringify(v1) === JSON.stringify({ tag: "17", monat: "11", jahr: "1963" }));
  pruef("Einfügen „1963-11-17“ (Autofill bday)", JSON.stringify(v2) === JSON.stringify({ tag: "17", monat: "11", jahr: "1963" }));
  pruef("Einfügen „7.1.80“ → 07 · 01 · 80", JSON.stringify(v3) === JSON.stringify({ tag: "07", monat: "01", jahr: "80" }));
  pruef("Unlesbares nicht verteilt", geburtTeileAusEingabe("hallo") === null);

  // Text-Formulare (Auskunft, Global-Angebot, Verträge): halbes Jahr bleibt halb.
  pruef("Text aus Teilen: halbes Jahr „19“ bleibt", geburtTextAusTeile({ tag: "14", monat: "03", jahr: "19" }) === "14.03.19");
  pruef("Text aus Teilen: vierstellig → ISO", geburtTextAusTeile({ tag: "14", monat: "03", jahr: "1963" }) === "1963-03-14");
  pruef("Text aus Teilen: leer → „“", geburtTextAusTeile({ tag: "", monat: "", jahr: "" }) === "");
  pruef("Teile aus Text: ISO", JSON.stringify(geburtTeileAusText("1963-03-14")) === JSON.stringify({ tag: "14", monat: "03", jahr: "1963" }));
  pruef("Teile aus Text: halb", JSON.stringify(geburtTeileAusText("14.03.")) === JSON.stringify({ tag: "14", monat: "03", jahr: "" }));
  pruef("Teile aus Text: alter Entwurf „14.03.1963“", JSON.stringify(geburtTeileAusText("14.03.1963")) === JSON.stringify({ tag: "14", monat: "03", jahr: "1963" }));
  let rund = true;
  for (const t of ["", "1", "14", "14.0", "14.03", "14.03.1", "14.03.19", "14.03.196", "1963-03-14"]) {
    const teile = geburtTeileAusText(t);
    const zurueck = geburtTextAusTeile(teile);
    if (JSON.stringify(geburtTeileAusText(zurueck)) !== JSON.stringify(teile)) rund = false;
  }
  pruef("Text ↔ Teile: Hin und zurück stabil beim Tippen", rund);

  const satz = Object.values(GEBURT_TEXTE).map((v) => (typeof v === "function" ? (v as (...a: any[]) => string)(17, 1963) : v)).join(" ");
  pruef("Meldungen ohne Anrede (passen zu Sie- und du-Seiten)", !/\b(du|dich|dir|dein\w*|Sie|Ihr\w*|Ihnen)\b/.test(satz), satz.match(/\b(du|dich|dir|dein\w*|Sie|Ihr\w*|Ihnen)\b/)?.[0]);
}

// ═════════════════════════════════════════════════════════════════════════
titel("A3  Gleichlauf mit den alten Regeln");
// ═════════════════════════════════════════════════════════════════════════
{
  // Die alte Fassung von geburtPruefen (shared/fiaon-antrag-neu.ts bis E-IT-G), wörtlich.
  function altGeburtPruefen(d: { gt: string; gm: string; gj: string }, heute: Date) {
    const t = Number(d.gt), m = Number(d.gm), j = Number(d.gj);
    if (!d.gt || !d.gm || d.gj.length !== 4) return "fehlt";
    const dt = new Date(j, m - 1, t);
    if (m < 1 || m > 12 || dt.getFullYear() !== j || dt.getMonth() !== m - 1 || dt.getDate() !== t) return "ungueltig";
    const alter = heute.getFullYear() - j - (heute.getMonth() < m - 1 || (heute.getMonth() === m - 1 && heute.getDate() < t) ? 1 : 0);
    if (alter < 18) return "jung";
    if (alter > 110) return "alt";
    return "ok";
  }
  const heute = new Date(2026, 9, 7, 12, 0, 0);
  let n = 0, abw = 0;
  const beispiele: string[] = [];
  const jahre = ["0063", "1063", "1899", "1900", "1915", "1916", "1917", "1950", "1963", "1964", "2000", "2007", "2008", "2009", "2026", "2027", "2099"];
  const monate = ["", "0", "1", "01", "02", "04", "10", "12", "13"];
  const tage = ["", "0", "1", "06", "07", "08", "28", "29", "30", "31", "32"];
  for (const gj of [...jahre, "", "63", "196"]) for (const gm of monate) for (const gt of tage) {
    const a = altGeburtPruefen({ gt, gm, gj }, heute);
    const b = geburtPruefen({ gt, gm, gj }, heute);
    n++;
    if (a !== b) { abw++; if (beispiele.length < 6) beispiele.push(`${gt}.${gm}.${gj}: alt ${a}, neu ${b}`); }
  }
  pruef(`geburtPruefen (Antrag neu): ${n} Fälle gleich`, abw === 0, beispiele.join(" | "));

  // Die alten Helfer der Auskunft-Seite (bonitaet-antrag.tsx bis E-IT-G), wörtlich.
  function datumIso(v: string): string | null {
    const m = v.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (!m) return null;
    const t = Number(m[1]), mo = Number(m[2]), j = Number(m[3]);
    const d = new Date(Date.UTC(j, mo - 1, t));
    if (d.getUTCFullYear() !== j || d.getUTCMonth() !== mo - 1 || d.getUTCDate() !== t) return null;
    return `${j}-${String(mo).padStart(2, "0")}-${String(t).padStart(2, "0")}`;
  }
  let n2 = 0, abw2 = 0;
  const bsp2: string[] = [];
  for (const gj of ["1900", "1927", "1963", "1964", "1999", "2000", "2008", "2026"]) for (const gm of ["01", "02", "04", "12", "13"]) for (const gt of ["01", "28", "29", "30", "31", "32"]) {
    const v = `${gt}.${gm}.${gj}`;
    const alt = datumIso(v);
    const neu = L(v, "pruefung", H);
    const neuIso = neu.iso && neu.iso <= H ? neu.iso : (neu.iso && neu.stand === "zukunft" ? neu.iso : null);
    n2++;
    if (alt !== neuIso) { abw2++; if (bsp2.length < 6) bsp2.push(`${v}: alt ${alt}, neu ${neuIso}`); }
  }
  pruef(`datumIso (Auskunft-Seite): ${n2} Fälle gleich (Kalendertag)`, abw2 === 0, bsp2.join(" | "));
}

// ═════════════════════════════════════════════════════════════════════════
titel("A4  Kündigungsseite: Identifikation (§ 312k BGB — nur leichter, nie schwerer)");
// ═════════════════════════════════════════════════════════════════════════
{
  const { kuendigungIdentitaet: K } = await import("../server/lib/fiaon-kuendigung-identitaet");
  const zeile = (o: Partial<{ ref: string; first_name: string; last_name: string; app_geburt: unknown; person_geburt: unknown; merged_into: string | null }>) =>
    ({ ref: "R1", first_name: "Anna", last_name: "Muster", app_geburt: null, person_geburt: null, merged_into: null, ...o });
  const e = (k: any[], vor: string, nach: string, geb: string | null) => K(k, { firstName: vor, lastName: nach, geburt: geb });
  let r = e([zeile({ app_geburt: "1963-11-17" })], "Anna", "Muster", "1963-11-17");
  pruef("Geburtsdatum an der Bestellung passt", r.ueber === "geburtsdatum" && r.treffer?.ref === "R1");
  r = e([zeile({ person_geburt: "1963-11-17" })], "anna", "MUSTER", "1963-11-17");
  pruef("Nur an der Person (vorher „Keine Übereinstimmung“) → erkannt", r.ueber === "geburtsdatum");
  r = e([zeile({})], "Anna", "Muster", "1963-11-17");
  pruef("Nirgends ein Geburtsdatum → angenommen über Name + E-Mail", r.ueber === "name_email" && !!r.treffer);
  r = e([zeile({})], "Anna", "Muster", null);
  pruef("Nirgends eins und nichts eingegeben → angenommen", r.ueber === "name_email");
  // Gegenprüfung 08.10.: Ein Widerspruch ist keine Sackgasse mehr — angenommen, das Team prüft.
  r = e([zeile({ app_geburt: "1963-11-17" })], "Anna", "Muster", "1964-11-17");
  pruef("Widerspruch → angenommen als name_email_abweichend (vorher 404 geburt_falsch)", r.ueber === "name_email_abweichend" && r.treffer?.ref === "R1" && r.hinterlegt === "1963-11-17", JSON.stringify(r));
  r = e([zeile({ app_geburt: "1963-11-17" })], "Anna", "Muster", null);
  pruef("Bei uns steht eins, Eingabe fehlt → angenommen als name_email_abweichend", r.ueber === "name_email_abweichend" && !!r.treffer);
  r = e([zeile({ person_geburt: "1963-11-17" })], "Anna", "Muster", "1964-11-17");
  pruef("Widerspruch nur gegen die Person → name_email_abweichend, hinterlegt = Person", r.ueber === "name_email_abweichend" && r.hinterlegt === "1963-11-17");
  r = e([zeile({})], "Berta", "Muster", "1963-11-17");
  pruef("Anderer Name → kein_konto", !r.treffer && r.grund === "kein_konto" && r.ueber === null);
  r = e([], "Anna", "Muster", "1963-11-17");
  pruef("Keine Bestellung zur E-Mail → kein_konto", !r.treffer && r.grund === "kein_konto");
  r = e([zeile({})], "", "Muster", null);
  pruef("Leerer Vorname → kein_konto (nie ein Treffer über leere Felder)", !r.treffer);
  r = e([zeile({ first_name: null, last_name: null })], "", "", null);
  pruef("Leere Namen auf beiden Seiten → kein Treffer", !r.treffer);
  r = e([zeile({ first_name: "Antonio", last_name: "Mičuda", person_geburt: "1980-01-02" })], "Antonio", "Micuda", "1980-01-02");
  pruef("Akzente zählen nicht (Mičuda = Micuda)", r.ueber === "geburtsdatum");
  r = e([zeile({ first_name: "Jörg", last_name: "Strauß", app_geburt: "1970-02-03" })], "joerg", "strauss", "1970-02-03");
  pruef("ß = ss; „joerg“ ≠ „jörg“ bleibt kein Treffer (keine Umschrift erfunden)", !r.treffer);
  r = e([zeile({ first_name: "Jörg", last_name: "Strauß", app_geburt: "1970-02-03" })], "Jorg", "Strauss", "1970-02-03");
  pruef("„Jorg Strauss“ = „Jörg Strauß“ (Akzent und ß)", r.ueber === "geburtsdatum");
  // Anders geteilte Altdaten: die alte Akte teilte am letzten Leerzeichen.
  r = e([zeile({ first_name: "Anna Maria von", last_name: "Berg", app_geburt: "1963-11-17" })], "Anna Maria", "von Berg", "1963-11-17");
  pruef("Name anders geteilt („Anna Maria von“/„Berg“ ↔ „Anna Maria“/„von Berg“) → erkannt", r.ueber === "geburtsdatum" && r.treffer?.ref === "R1", JSON.stringify(r));
  r = e([zeile({ first_name: "Anna", last_name: "Maria von Berg" })], "Anna Maria", "von  Berg", null);
  pruef("Zusammengesetzt, doppelte Leerzeichen egal → angenommen (nichts hinterlegt)", r.ueber === "name_email");
  r = e([zeile({ first_name: "Anna", last_name: "Bergmann" })], "Anna", "Berg mann", null);
  pruef("„Berg mann“ ≠ „Bergmann“ (Leerzeichen trennen Wörter)", !r.treffer);
  r = e([zeile({ ref: "ALT", merged_into: "NEU", app_geburt: "1963-11-17" }), zeile({ ref: "NEU", app_geburt: "1963-11-17" })], "Anna", "Muster", "1963-11-17");
  pruef("Lebende Bestellung vor zusammengeführter", r.treffer?.ref === "NEU");
  r = e([zeile({ ref: "ALT", merged_into: "NEU" }), zeile({ ref: "NEU", first_name: "Magdalena" })], "Anna", "Muster", null);
  pruef("Nur die zusammengeführte passt → sie ist der Treffer (Route bucht auf merged_into)", r.treffer?.ref === "ALT" && r.treffer?.merged_into === "NEU");
  r = e([zeile({ person_geburt: "1963-11-17", app_geburt: "1964-01-01" })], "Anna", "Muster", "1964-01-01");
  pruef("Weichen Person und Bestellung ab, passt jede der beiden", r.ueber === "geburtsdatum");
  r = e([zeile({ ref: "K", first_name: "Konstantin", app_geburt: "1970-01-01" }), zeile({ ref: "M", first_name: "Magdalena", app_geburt: "1975-05-05" })], "Magdalena", "Muster", "1975-05-05");
  pruef("Gemeinsame E-Mail, zwei Menschen: der Name wählt die richtige Bestellung", r.treffer?.ref === "M" && r.ueber === "geburtsdatum");
  // Zweistelliges Jahr aus der Seite (Leser im Kontext „pruefung“)
  pruef("Kündigung: „17.11.63“ wird 1963-11-17", L("17.11.63", "pruefung").iso === "1963-11-17");

  // Nach außen: EINE neutrale Meldung, keine Auskunft über Geburtsdatum oder Konto.
  const { KUENDIGUNG_KEIN_TREFFER, KUENDIGUNG_ZU_VIELE, kuendigungDrossel, vollerNamePasst } = await import("../server/lib/fiaon-kuendigung-identitaet");
  pruef("Neutrale Meldung nennt kein Geburtsdatum", !/geburt/i.test(KUENDIGUNG_KEIN_TREFFER) && /Keine Übereinstimmung/.test(KUENDIGUNG_KEIN_TREFFER));
  pruef("429-Text neutral", /Zu viele Versuche/.test(KUENDIGUNG_ZU_VIELE) && !/geburt|konto|e-mail/i.test(KUENDIGUNG_ZU_VIELE));
  pruef("vollerNamePasst: gleiche Teile", vollerNamePasst({ first_name: "Anna", last_name: "Muster" }, { firstName: " anna ", lastName: "MUSTER" }));
  pruef("vollerNamePasst: andere Person", !vollerNamePasst({ first_name: "Konstantin", last_name: "N" }, { firstName: "Magdalena", lastName: "N" }));

  // Drossel: nur Fehlschläge zählen, 5 je E-Mail, 10 je IP, Fenster 15 Minuten.
  const d = kuendigungDrossel();
  const t0 = 1_000_000_000_000;
  for (let i = 0; i < 4; i++) d.fehlschlag("1.1.1.1", "a@x.de", t0 + i);
  pruef("Drossel: 4 Fehlschläge → noch frei", !d.gesperrt("1.1.1.1", "a@x.de", t0 + 10));
  d.fehlschlag("1.1.1.1", "A@X.de ", t0 + 5);
  pruef("Drossel: 5. Fehlschlag (Groß/klein egal) → E-Mail gesperrt", d.gesperrt("9.9.9.9", "a@x.de", t0 + 10));
  pruef("Drossel: andere E-Mail von derselben IP noch frei (5 < 10)", !d.gesperrt("1.1.1.1", "b@x.de", t0 + 10));
  pruef("Drossel: nach 15 Minuten wieder frei", !d.gesperrt("1.1.1.1", "a@x.de", t0 + 15 * 60_000 + 10));
  for (let i = 0; i < 5; i++) d.fehlschlag("1.1.1.1", `n${i}@x.de`, t0 + 100 + i);
  pruef("Drossel: 10 Fehlschläge je IP → IP gesperrt, auch für neue E-Mail", d.gesperrt("1.1.1.1", "neu@x.de", t0 + 200));
  pruef("Drossel: andere IP mit neuer E-Mail frei", !d.gesperrt("2.2.2.2", "neu@x.de", t0 + 200));
  const d2 = kuendigungDrossel({ fensterMs: 1000, jeIp: 2, jeMail: 1 });
  d2.fehlschlag("3.3.3.3", "c@x.de", 0);
  pruef("Drossel mit eigenen Grenzen: 1 je E-Mail", d2.gesperrt("4.4.4.4", "c@x.de", 500) && !d2.gesperrt("4.4.4.4", "c@x.de", 1500));

  // Gegenprüfung 08.10. (niedrig): Zusammengeführt → bis zum Kopf der Kette, nicht nur einen Schritt.
  const { kopfDerKette } = await import("../server/lib/fiaon-kuendigung-identitaet");
  const KETTE: Record<string, string | null> = { A: "B", B: "C", C: null, X: "Y", Y: "X" };
  const lies = async (r: string) => KETTE[r] ?? null;
  pruef("Kette: lebender Treffer bleibt", (await kopfDerKette("C", null, lies)) === "C");
  pruef("Kette: A → B → C ergibt C (vorher B, eine tote Bestellung)", (await kopfDerKette("A", "B", lies)) === "C");
  pruef("Kette: Kreis bricht ab, ohne zu hängen", ["X", "Y"].includes(await kopfDerKette("X", "Y", lies)));
  pruef("Cancellation-Route nutzt die Kette", /kopfDerKette\(String\(treffer\.ref\)/.test(quelle("server/routes/cancellation.ts")) && !/const appRef = treffer\.merged_into \|\| treffer\.ref/.test(quelle("server/routes/cancellation.ts")));

  // Antragsformular: wann darf es die Person ändern? (Gegenprüfung 08.10.)
  const { antragKorrigiertPerson: AK } = await import("../shared/fiaon-geburtsdatum");
  pruef("Antrag: einzige, unbezahlte Bestellung, Name passt → Person darf mit", AK({ lebendeBestellungen: 1, bezahlt: false, namePasst: true }));
  pruef("Antrag: zweite Bestellung an der Person → Person bleibt", !AK({ lebendeBestellungen: 2, bezahlt: false, namePasst: true }));
  pruef("Antrag: bezahlt (bestehender Kunde) → Person bleibt", !AK({ lebendeBestellungen: 1, bezahlt: true, namePasst: true }));
  pruef("Antrag: anderer Name (Partner) → Person bleibt", !AK({ lebendeBestellungen: 1, bezahlt: false, namePasst: false }));
  pruef("Antrag: keine lebende Bestellung (Zählfehler) → Person bleibt", !AK({ lebendeBestellungen: 0, bezahlt: false, namePasst: true }));
}

// ═════════════════════════════════════════════════════════════════════════
titel("A5  Quelltext-Wände: jede Eingabestelle über das eine Bauteil");
// ═════════════════════════════════════════════════════════════════════════
{
  const STELLEN: [string, RegExp][] = [
    ["client/src/pages/agent/pipeline.tsx", /<GeburtsdatumFeld[\s\S]*?kontext="akte"/],
    ["client/src/components/agent/KundeAnlegen.tsx", /<GeburtsdatumFeld[\s\S]*?kontext="akte"/],
    ["client/src/pages/admin-kunde.tsx", /<GeburtsdatumFeld[\s\S]*?kontext="akte"/],
    ["client/src/components/admin/ChefGlobalAngebote.tsx", /<GeburtsdatumFeld[\s\S]*?kontext="vertrag"/],
    ["client/src/pages/admin-vertraege.tsx", /<GeburtsdatumFeld[\s\S]*?kontext="mitarbeiter"/],
    ["client/src/pages/vereinbarung.tsx", /<GeburtsdatumFeld[\s\S]*?kontext="mitarbeiter"/],
    ["client/src/pages/antrag-neu/schritte-angaben.tsx", /<GeburtsdatumFeld[\s\S]*?variante="antrag"/],
    ["client/src/pages/antrag.tsx", /<GeburtsdatumFeld[\s\S]*?kontext="vertrag"/],
    ["client/src/pages/bonitaet-antrag.tsx", /<GeburtsdatumFeld[\s\S]*?kontext="vertrag"/],
    ["client/src/pages/passwort-vergessen.tsx", /<GeburtsdatumFeld[\s\S]*?kontext="pruefung"/],
    ["client/src/pages/abo-kuendigen.tsx", /<GeburtsdatumFeld[\s\S]*?kontext="pruefung"/],
  ];
  for (const [datei, muster] of STELLEN) pruef(`${datei}: Bauteil`, muster.test(quelle(datei)));
  // Kein natives Datumsfeld und keine Jahr-Liste mehr in der Nähe eines Geburtsdatums.
  for (const [datei] of STELLEN) {
    const zeilen = quelle(datei).split("\n");
    const treffer = zeilen.findIndex((z, i) => /type=\{?["']date["']|type="date"/.test(z) && /geburt|birth/i.test(zeilen.slice(Math.max(0, i - 3), i + 3).join("\n")));
    pruef(`${datei}: kein type=date am Geburtsdatum`, treffer < 0, treffer >= 0 ? `Zeile ${treffer + 1}` : "");
  }
  pruef("Antrag alt: keine Jahr-Liste (100 Jahrgänge) und keine Vorbelegung 1990", !/getFullYear\(\) - 18 - i/.test(quelle("client/src/pages/antrag.tsx")) && !/birthYear: "1990", phoneCountryCode/.test(quelle("client/src/pages/antrag.tsx")));
  pruef("Passwort vergessen: keine Jahr-Liste 1930–2009", !/getFullYear\(\) - 17 - i/.test(quelle("client/src/pages/passwort-vergessen.tsx")));
  pruef("Akte: Geburtsdatum nicht mehr über dtag() (zweistellig)", !/geburtsdatum\)?\s*\?\s*dtag\(/.test(quelle("client/src/pages/agent/pipeline.tsx")) && !/geburtsdatum\)\)?\s*:\s*null.*dtag/.test(quelle("client/src/pages/agent/pipeline.tsx")));
  pruef("Alte Kartei: Geburtsdatum nicht mehr über dtag()", !/\["Geburtsdatum", k\.stammdaten\?\.geburtsdatum \? dtag/.test(quelle("client/src/pages/agent/kunden-neu.tsx")));
  const akte = quelle("client/src/pages/agent/pipeline.tsx");
  const kb = akte.slice(akte.indexOf("function KundeBearbeiten("), akte.indexOf("\nfunction ", akte.indexOf("function KundeBearbeiten(") + 10));
  pruef("Kunde bearbeiten schickt nur Geändertes", kb.length > 500 && /geaenderteFelder/.test(kb) && /JSON\.stringify\(body\)/.test(kb) && !/JSON\.stringify\(f\)/.test(kb));
  pruef("Akte: Hinweis „Geburtsdatum weicht ab“ mit Übernehmen-Knöpfen", /GeburtAbweichungHinweis/.test(akte) && /übernehmen`/.test(akte));
  const anlage = quelle("server/routes/fiaon-agent-anlage.ts");
  pruef("Stammdaten-Route meldet Fehler statt ok:true", /if \(erg\?\.error\) \{\s*\n\s*return res\.status\(erg\.error\.code\)/.test(anlage));
  pruef("Kunde anlegen prüft das Geburtsdatum", /geburtsdatumFuerSpeicher\(b\.birthdate, "akte"/.test(anlage) && !/String\(b\.birthdate \?\? ""\)\.trim\(\)\.slice\(0, 10\)/.test(anlage));
  const agent = quelle("server/routes/fiaon-agent.ts");
  pruef("updateCustomerContact: shared-Prüfer, Löschen nur mit Recht, ein Schreibweg", /geburtsdatumFuerSpeicher\(body\.birthdate, "akte"/.test(agent) && /darfGeburtLoeschen/.test(agent) && /geburtsdatumSetzen\(ref, birthdate/.test(agent) && !/UPDATE fiaon_persons p SET birthdate = \$\{birthdate\}/.test(agent));
  const kunden = quelle("server/routes/fiaon-kunden.ts");
  pruef("Chef-Akte: kein eigener Geburtsdatum-Block mehr (nur Bestellung)", !/UPDATE fiaon_applications SET birthdate = \$\{bd \|\| null\}/.test(kunden) && /"birthdate", "geburtBestaetigt", "birthdateEntfernen"/.test(kunden));
  const antragSrv = quelle("server/routes/fiaon-antrag.ts");
  pruef("POST /application: leer/ungültig überschreibt nicht (COALESCE)", /birthdate = COALESCE\(\$\{values\.birthdate \?\? null\}, birthdate\)/.test(antragSrv));
  // Gegenprüfung 08.10. (hoch): Das öffentliche Formular schreibt Person + Bestellungen NUR in der einen Ausnahme.
  {
    const block = antragSrv.slice(antragSrv.indexOf("DAS ANTRAGSFORMULAR SCHREIBT NUR DIE EIGENE BESTELLUNG"), antragSrv.indexOf("DER PERSÖNLICHE LINK (22.09.2026, E-210)"));
    pruef("POST /application: Block gefunden", block.length > 500);
    pruef("POST /application: geburtsdatumSetzen nur hinter antragKorrigiertPerson", /const darf = antragKorrigiertPerson\(/.test(block) && /if \(darf\) \{\s*\n\s*const \{ geburtsdatumSetzen \}/.test(block) && (block.match(/geburtsdatumSetzen\(/g) ?? []).length === 1);
    pruef("POST /application: sonst nur Verlaufseintrag „Akte bleibt unverändert“", /Die Akte bleibt unverändert/.test(block));
    pruef("POST /application: Name, Bezahlstand und Anzahl lebender Bestellungen gelesen", /vollerNamePasst\(/.test(block) && /payment_status/.test(block) && /AS lebende/.test(block));
    pruef("Kein anderer geburtsdatumSetzen-Aufruf im Antragsweg", (antragSrv.match(/geburtsdatumSetzen\(/g) ?? []).length === 1);
  }
  for (const [datei, muster] of [
    ["server/routes/cancellation.ts", /geburtsdatumLesen\(birthdate, "pruefung"\)/],
    ["server/lib/fiaon-whatsapp.ts", /geburtsdatumLesen\(t, "akte"\)/],
    ["server/lib/fiaon-global-angebot.ts", /geburtsdatumFuerSpeicher\(kunde\.geburtsdatum, "vertrag"\)/],
    ["server/routes/fiaon-onboarding.ts", /geburtsdatumFuerSpeicher\(b\.birthDate, "mitarbeiter"\)/],
    ["server/routes/fiaon-vereinbarung.ts", /geburtsdatumFuerSpeicher\(\(angaben as any\)\.geburtsdatum, "mitarbeiter"\)/],
    ["server/routes/fiaon-vertrieb.ts", /geburtsdatumFuerSpeicher\(req\.body\[feld\], "akte"/],
    ["server/fiaon-person-model.ts", /birthdate\s+= COALESCE\(birthdate, CASE[\s\S]{0,400}THEN \$\{geburtsdatumIso\(s\.birthdate\)\}::text END\)/],
  ] as [string, RegExp][]) pruef(`${datei}: über shared`, muster.test(quelle(datei)));
  const mig = quelle("db/migrations/103_geburtsdatum_wand.sql");
  pruef("Migration 103: idempotent, NOT VALID + VALIDATE, keine DROP", /IF NOT EXISTS \(SELECT 1 FROM pg_constraint/.test(mig) && /NOT VALID/.test(mig) && /VALIDATE CONSTRAINT fiaon_app_geburt_iso/.test(mig) && !/\bDROP\b/i.test(mig));
  // Gegenprüfung 08.10.: Jedes VALIDATE in einem eigenen Block — ein Altwert rollt die Datei nicht mehr zurück.
  const ohneKommentare = mig.split("\n").filter((z) => !/^\s*--/.test(z)).join("\n");
  const validates = ohneKommentare.match(/VALIDATE CONSTRAINT \w+/g) ?? [];
  const geschuetzt = ohneKommentare.match(/BEGIN\s*\n\s*ALTER TABLE \w+ VALIDATE CONSTRAINT \w+;\s*\nEXCEPTION WHEN check_violation THEN\s*\n\s*RAISE WARNING/g) ?? [];
  pruef("Migration 103: alle drei VALIDATE einzeln abgefangen (check_violation → WARNING)", validates.length === 3 && geschuetzt.length === 3, `${validates.length} / ${geschuetzt.length}`);
  pruef("Migration 103: Spalte identifiziert_ueber VOR den Bedingungen", ohneKommentare.indexOf("identifiziert_ueber") < ohneKommentare.indexOf("ADD CONSTRAINT"));
  const kuend = quelle("server/routes/cancellation.ts");
  pruef("Kündigung: Spalte wird ohne Migration nachgelegt (Katalog zuerst, lock_timeout)", /information_schema\.columns[\s\S]{0,300}identifiziert_ueber/.test(kuend) && /SET LOCAL lock_timeout = '3s'[\s\S]{0,200}ADD COLUMN IF NOT EXISTS identifiziert_ueber/.test(kuend));
  pruef("Kündigung: INSERT fängt 42703 ab und legt den Antrag ohne Spalte an", /e\?\.code !== "42703"/.test(kuend) && /Identität prüfen\]/.test(kuend));
  pruef("Kündigung: 404 ohne „grund“, nie „ohneGeburtsdatum“ nach außen", !/grund: ident\.grund/.test(kuend) && !/ohneGeburtsdatum/.test(kuend) && /status\(404\)\.json\(\{ ok: false, error: KUENDIGUNG_KEIN_TREFFER \}\)/.test(kuend));
  pruef("Kündigung: verify-only antwortet nur ok", /reason === "__verify_only__"\) \{\s*\n\s*return res\.json\(\{ ok: true \}\);/.test(kuend));
  pruef("Kündigung: Drossel vor der Abfrage, Fehlschlag gezählt", kuend.indexOf("drossel.gesperrt(") < kuend.indexOf("FROM fiaon_applications a") && /drossel\.fehlschlag\(ip/.test(kuend) && /status\(429\)/.test(kuend));
  pruef("Kündigung: IP wie clientIp (req.ip, sonst LETZTER X-Forwarded-For)", /if \(req\.ip\) return String\(req\.ip\)/.test(kuend) && /weiter\[weiter\.length - 1\]/.test(kuend));
  pruef("Kündigung: Aufgabe „Identität prüfen“ beim Betreuer (idempotent je Antrag)", /auftragFuerKunden\(\{[\s\S]{0,400}schluessel: `kuendigung-identitaet:\$\{row\.id\}`/.test(kuend));
  pruef("Kundenweg: Kündigungsantrag zeigt „Identität prüfen“ (to_jsonb, ohne Spalte lauffähig)", /to_jsonb\(c\) ->> 'identifiziert_ueber'/.test(quelle("server/lib/fiaon-kundenweg.ts")) && /Identität prüfen\)/.test(quelle("server/lib/fiaon-kundenweg.ts")));
  const kAlt = quelle("server/routes/fiaon-kuendigung.ts");
  // Querprüfung 08.10.2026: Der Ausdruck steht jetzt EINMAL in shared (KUENDIGUNG_IDENTITAET_OFFEN_SQL) — Sammellauf, Akte und Chefbüro.
  pruef("Sammellauf Altbestand: ungeprüfte Identität zurückgehalten, in der Vorschau getrennt", /KUENDIGUNG_IDENTITAET_OFFEN_SQL\("c"\)\)\} AS identitaet_offen/.test(kAlt)
    && /'kuendigung-identitaet:' \|\| \$\{c\}\.id::text AND kr_it\.status = 'erledigt'/.test(quelle("shared/fiaon-kuendigung-regel.ts")) && /identitaetOffen: identitaetOffen\.length/.test(kAlt));
  const seite = quelle("client/src/pages/abo-kuendigen.tsx");
  pruef("Kündigungsseite: kein Hinweis „kein Geburtsdatum hinterlegt“ mehr (keine Auskunft)", !/ohneGeburtsdatum|data-ohne-geburtsdatum|kein Geburtsdatum hinterlegt/.test(seite));
  pruef("Kündigungsseite: 429 zeigt die Server-Meldung", /res\.status === 404 \|\| res\.status === 429/.test(seite));
  // ── Querprüfung 08.10.2026 (§ 312k BGB): Eingangsbestätigung, Ausweg, Geburtsdatum freiwillig ──
  {
    const idm = await import("../server/lib/fiaon-kuendigung-identitaet");
    pruef("Querprüfung § 312k: „keine Übereinstimmung“ und Drossel nennen den Ausweg (formlos an support@fiaon.com, gilt mit dem Eingang)",
      /support@fiaon\.com/.test(idm.KUENDIGUNG_KEIN_TREFFER) && /gilt mit dem Eingang/.test(idm.KUENDIGUNG_KEIN_TREFFER) && /support@fiaon\.com/.test(idm.KUENDIGUNG_ZU_VIELE));
    const inh = idm.kuendigungEingangInhalt({ am: new Date("2026-10-08T12:32:00Z"), wunsch: "2026-10-31", paket: "FIAON Plus\nZeile 2", grund: "Zu <teuer> & weg", antragNr: 142, name: "Erika Muster" });
    pruef("Querprüfung § 312k: Eingang mit Datum und Uhrzeit (Berlin), gewünschter Zeitpunkt, Erklärung — HTML-sicher",
      inh.eingang_text === "08.10.2026 um 14:32 Uhr" && inh.zeitpunkt_text === "31.10.2026" && /zum 31\.10\.2026 erklärt — für Ihren Vertrag FIAON Plus\./.test(inh.zeitpunkt_satz)
      && /Kündigung von Erika Muster, Grund: „Zu &lt;teuer&gt; &amp; weg“/.test(inh.erklaerung_text) && inh.antrag_nr === "142", JSON.stringify(inh));
    const ohneW = idm.kuendigungEingangInhalt({ am: new Date("2026-01-05T08:05:00Z"), wunsch: null, paket: null, grund: null, antragNr: 1, name: "A B" });
    pruef("Querprüfung § 312k: ohne Wunschdatum „nächstmöglicher Zeitpunkt“ (Winterzeit richtig)", ohneW.zeitpunkt_text === "nächstmöglicher Zeitpunkt" && ohneW.eingang_text === "05.01.2026 um 09:05 Uhr", JSON.stringify(ohneW));
    const kz = quelle("server/routes/cancellation.ts");
    const route = kz.slice(kz.indexOf('router.post("/abo-kuendigen"'), kz.indexOf("// ─── GET /api/fiaon/admin/cancellations"));
    pruef("Querprüfung § 312k: nach JEDEM angenommenen Antrag sofort die Eingangsbestätigung (auch bei offener Identität)",
      route.indexOf("kuendigungsAntragEinfuegen(") > 0 && route.indexOf("await eingangBestaetigen(") > route.indexOf("kuendigungsAntragEinfuegen(")
      && route.indexOf("await eingangBestaetigen(") > route.indexOf('if (ueber !== "geburtsdatum")') && /bestaetigungGesendet: eingang\.gesendet/.test(route)
      && /sendMakeWebhookMitGrund\("kuendigung_eingegangen"/.test(kz) && /Eingangsbestätigung der Kündigung \(Antrag Nr\./.test(kz));
    const motor = await import("../server/mail/motor");
    const { PFLICHTMAILS } = await import("../server/lib/fiaon-mail-frequenz");
    const v = (motor as any).VORLAGEN?.kuendigung_eingegangen;
    pruef("Querprüfung § 312k: Vorlage „Eingangsbestätigung“ — Vertragspost von FIAON Legal, Pflichtmail, Eingang/Zeitpunkt/Erklärung im Kasten",
      !!v && v.marke === "Vertragspost" && motor.absenderFuer("kuendigung_eingegangen").name === "FIAON Legal" && PFLICHTMAILS.has("kuendigung_eingegangen")
      && JSON.stringify(v.daten).includes("{{params.eingang_text}}") && JSON.stringify(v.daten).includes("{{params.zeitpunkt_text}}") && JSON.stringify(v.daten).includes("{{params.erklaerung_text}}")
      && /gilt ab ihrem Eingang/.test(v.absaetze.join(" ")) && !v.knopf);
    pruef("Querprüfung § 312k: Kündigungsseite — Geburtsdatum freiwillig, Eingang und Bestätigung auf der Fertig-Seite, Ausweg genannt",
      /<Field label="Geburtsdatum \(optional\)">/.test(seite) && !/gebGelesen\.stand === "leer"\) \{/.test(seite) && /\.\.\.\(birthdate \? \{ birthdate \} : \{\}\)/.test(seite)
      && /Eingegangen am <span/.test(seite) && /bestaetigungGesendet === false/.test(seite) && /support@fiaon\.com/.test(seite) && !/1–2 Werktagen/.test(seite));
  }
  pruef("Einmal-Lauf: C1/C2 nur bei passendem Namen", /vollerNamePasst\(/.test(quelle("scripts/it-g-einmal.ts")) && /if \(b\.namePasst\) c1\.push/.test(quelle("scripts/it-g-einmal.ts")));
  pruef("Einmal-Lauf: zeigt das VALIDATE zum Nachholen", /VALIDATE CONSTRAINT \$\{b\.conname\}/.test(quelle("scripts/it-g-einmal.ts")));
  // Gegenprüfung 08.10. (niedrig): C1 schreibt nie das Datum eines anderen Menschen.
  {
    const { lueckenPlanen } = await import("./it-g-einmal");
    const b = (ref: string, iso: string | null, namePasst: boolean) => ({ ref, iso, roh: iso, namePasst });
    const m = (personId: number, person: string | null, bestellungen: ReturnType<typeof b>[]) => ({ personId, person, personRoh: person, vor: "Konstantin", nach: "N", bestellungen });
    let p = lueckenPlanen([m(1, "1970-01-01", [b("K1", null, true), b("M1", null, false)])]);
    pruef("C1: eigene leere Bestellung bekommt das Datum der Person, die fremde nicht", p.c1.length === 1 && p.c1[0].ref === "K1" && p.vonHand.some((x) => /M1/.test(x.grund)), JSON.stringify(p));
    p = lueckenPlanen([m(2, null, [b("M2", "1975-05-05", false), b("K2", null, true)])]);
    pruef("C1/C2: Datum nur an der Bestellung eines anderen Namens → nichts gefüllt", p.c1.length === 0 && p.c2.length === 0 && p.vonHand.length === 1, JSON.stringify(p));
    p = lueckenPlanen([m(3, null, [b("K3", "1970-01-01", true), b("K4", null, true)])]);
    pruef("C1/C2: Datum an eigener Bestellung → Person und Lücke gefüllt", p.c2.length === 1 && p.c1.length === 1 && p.c1[0].ref === "K4", JSON.stringify(p));
    p = lueckenPlanen([m(4, "1970-01-01", [b("K5", "1971-01-01", true)])]);
    pruef("Zwei Werte → nichts (Liste B)", p.c1.length === 0 && p.c2.length === 0);
  }
  pruef("Akten warnen bei fremdem Namen (Text aus shared)", /GEBURT_TEXTE\.fremderName/.test(quelle("client/src/pages/agent/pipeline.tsx")) && /GEBURT_TEXTE\.fremderName/.test(quelle("client/src/pages/admin-kunde.tsx")));
  pruef("Texte: Update-Hinweis begrenzt „Person UND alle Bestellungen“ auf Mitarbeiter/Leitung", /Korrigierst du \(oder die Leitung\)/.test(quelle("client/src/pages/agent/updates-data.ts")) && /Identität prüfen/.test(quelle("client/src/pages/agent/updates-data.ts")));
  const rg = quelle("client/src/pages/agent/rundgaenge.ts");
  pruef("Rundgang Pipeline erklärt das neue Feld", /Geburtsdatum in drei Feldern/.test(rg) && /Stimmt so/.test(rg));
  // Gegenprüfung 08.10. (niedrig) — Akte, Texte, Anrede, Ratgeber-Briefe:
  const pip = quelle("client/src/pages/agent/pipeline.tsx");
  pruef("Kunde bearbeiten: unverändertes Altdatum blockiert andere Felder nicht", /else if \(!geb\.leer && \(geb\.erg\.iso !== geb\.startIso \|\| !geb\.erg\.iso\)\)/.test(pip));
  pruef("Weicht ab – übernehmen: Rückfrage unter 18/ab 95, Alter auf dem Knopf", /e\.stand === "pruefen" && !window\.confirm\(/.test(pip) && /\.\.\.\(e\.stand === "pruefen" \? \{ geburtBestaetigt: true \} : \{\}\)/.test(pip) && /geburtsdatumMitAlter\(w\.iso\)\} übernehmen/.test(pip) && !/geburtBestaetigt: true \}\) \}\);\n\s*setBusy\(null\)/.test(pip));
  pruef("Rundgang Telefonkartei: Entfernen nennt beide Stellen", /nur für die Leitung – hier in der Chef-Akte und in der Akte unter „Kunde bearbeiten“/.test(rg) && !/gibt es nur hier, für die Leitung/.test(rg));
  pruef("Alte Kartei: Weg zum Geburtsdatum über den Reiter „Daten“", /Akte öffnen → Reiter „Daten“ → „Kunde bearbeiten“/.test(quelle("client/src/pages/agent/kunden-neu.tsx")));
  const pw = quelle("client/src/pages/passwort-vergessen.tsx");
  pruef("Passwort vergessen: Kundentexte im Sie", !/Bestätige deine|Wähle ein sicheres Passwort für dein|Du kannst dich jetzt damit|Deine Daten werden|Dein Zugang/.test(pw) && /Bitte bestätigen Sie Ihre Identität/.test(pw));
  pruef("verify-identity: neutrale Meldung im Sie", /Bitte prüfen Sie Vorname, Nachname, E-Mail-Adresse und Geburtsdatum/.test(quelle("server/routes/fiaon-antrag.ts")) && !/wie du sie im Antrag angegeben hast/.test(quelle("server/routes/fiaon-antrag.ts")));
  // Fertigstellung 08.10.: die letzten Reste im Passwort-Weg, die Zusammenfassung der Kündigungsseite, Vereinbarung am Handy.
  pruef("reset-password-direct: Support-Hinweis im Sie", !/nenne dem Support diesen Fehlercode: RESET-05-/.test(quelle("server/routes/fiaon-antrag.ts")) && (quelle("server/routes/fiaon-antrag.ts").match(/nennen Sie dem Support diesen Fehlercode: RESET-05-/g) ?? []).length === 2);
  pruef("Kündigungsseite: Zusammenfassung zeigt „geb. TT.MM.JJJJ“, nicht JJJJ-MM-TT", /geb\. \{gebGelesen\.anzeige \|\| birthdate\}/.test(seite) && !/geb\. \{birthdate\}/.test(seite));
  pruef("Vereinbarung am Handy: drei Geburtsdatum-Felder nicht je 100 % breit", /\.vb-luecke\.vb-geburt input \{ width: 3\.6em !important; \}/.test(quelle("client/src/styles/vereinbarung.css")) && /vb-luecke vb-geburt/.test(quelle("client/src/pages/vereinbarung.tsx")));
  for (const w of ["selbstauskunft", "widerspruch"]) {
    pruef(`Ratgeber-Brief ${w}: Geburtsdatum über den einen Leser`, /Geburtsdatum: \$\{geburtBrief\(f\.geburt\)\}/.test(quelle(`client/src/pages/site/werkzeuge/${w}.tsx`)));
  }
  pruef("Ratgeber-Brief: „14.5.88“ → 14.05.1988, „31.02.1988“ → Platzhalter", L("14.5.88", "pruefung").anzeige === "14.05.1988" && L("31.02.1988", "pruefung").stand !== "ok");
}

// ═════════════════════════════════════════════════════════════════════════
// Teil B — lokale Datenbank
// ═════════════════════════════════════════════════════════════════════════
const DB = process.env.DATABASE_URL ?? "";
const LOKAL = /@127\.0\.0\.1:54329\/fiaon_it_g\b/.test(DB);
if (LOKAL) {
  titel("B   Der eine Schreibweg gegen die lokale Kopie fiaon_it_g");
  const { sqlPool } = await import("../server/lib/db-pool");
  const { updateCustomerContact } = await import("../server/routes/fiaon-agent");
  const { geburtStandAkte, geburtsdatumSetzen } = await import("../server/lib/fiaon-geburtsdatum-akte");
  const MARKE = `ITG${Date.now().toString(36).toUpperCase()}`;
  const R1 = `FIAON-TEST-${MARKE}-1`, R2 = `FIAON-TEST-${MARKE}-2`;
  const RK = `FIAON-TEST-${MARKE}-K`, RM = `FIAON-TEST-${MARKE}-M`, RN = `FIAON-TEST-${MARKE}-N`;
  let personId = 0, famPerson = 0, namenlos = 0;
  try {
    const [p] = (await sqlPool`INSERT INTO fiaon_persons (person_ref, kind, first_name, last_name, primary_email, account_status)
      VALUES (${`P-${MARKE}`}, 'private', 'Prüfa', 'Geburtig', ${`pruef.${MARKE.toLowerCase()}@example.invalid`}, 'pending') RETURNING id`) as any[];
    personId = Number(p.id);
    await sqlPool`INSERT INTO fiaon_applications (ref, type, status, first_name, last_name, email, birthdate, person_id, created_at, updated_at)
      VALUES (${R1}, 'private', 'submitted', 'Prüfa', 'Geburtig', ${`pruef.${MARKE.toLowerCase()}@example.invalid`}, '1963-11-17', ${personId}, NOW() - INTERVAL '2 days', NOW())`;
    await sqlPool`INSERT INTO fiaon_applications (ref, type, status, first_name, last_name, email, birthdate, person_id, created_at, updated_at)
      VALUES (${R2}, 'private', 'submitted', 'Prüfa', 'Geburtig', ${`pruef.${MARKE.toLowerCase()}@example.invalid`}, NULL, ${personId}, NOW() - INTERVAL '1 day', NOW())`;
    const werte = async () => {
      const [pp] = (await sqlPool`SELECT birthdate FROM fiaon_persons WHERE id = ${personId}`) as any[];
      const bb = (await sqlPool`SELECT ref, birthdate FROM fiaon_applications WHERE person_id = ${personId} ORDER BY ref`) as any[];
      return [pp.birthdate ?? null, ...bb.map((b) => b.birthdate ?? null)].join("|");
    };

    let st = await geburtStandAkte(personId);
    pruef("Stand: Bestellung allein → Wert, keine Abweichung", st.wert === "1963-11-17" && !st.abweichend);
    await sqlPool`UPDATE fiaon_persons SET birthdate = '1964-11-17' WHERE id = ${personId}`;
    st = await geburtStandAkte(personId);
    pruef("Stand: Person zuerst + Abweichung erkannt", st.wert === "1964-11-17" && st.abweichend && st.werte.length === 2);

    const akteur = { id: 927, name: "Claude Prüfkonto (Office-Bau)" };
    let e = await updateCustomerContact(R1, { birthdate: "0063-11-17" }, akteur);
    pruef("0063-11-17 → 400 mit Text", e.error?.code === 400 && /Geburtsdatum/.test(e.error.msg), JSON.stringify(e.error));
    pruef("… und nichts geschrieben", (await werte()) === "1964-11-17|1963-11-17|");
    e = await updateCustomerContact(R1, { birthdate: "" }, akteur);
    pruef("„“ → keine Änderung", !e.error && (e.changes?.length ?? 0) === 0 && (await werte()) === "1964-11-17|1963-11-17|");
    e = await updateCustomerContact(R1, { phone: "abc" }, akteur);
    pruef("Telefon „abc“ → Fehler (die Route meldet ihn jetzt)", e.error?.code === 400);
    e = await updateCustomerContact(R1, { birthdate: "17.11.63" }, akteur);
    pruef("„17.11.63“ → gespeichert", !e.error && e.changes?.some((c) => c.field === "Geburtsdatum") === true, JSON.stringify(e));
    pruef("… an Person UND allen Bestellungen (auch der leeren)", (await werte()) === "1963-11-17|1963-11-17|1963-11-17", await werte());
    const [log1] = (await sqlPool`SELECT note FROM fiaon_contact_log WHERE ref = ${R1} AND note LIKE 'Geburtsdatum korrigiert%' ORDER BY id DESC LIMIT 1`) as any[];
    pruef("… Verlauf nennt beide alten Werte und den neuen", !!log1 && /17\.11\.1964/.test(log1.note) && /17\.11\.1963/.test(log1.note) && /→ 17\.11\.1963/.test(log1.note), log1?.note);
    e = await updateCustomerContact(R1, { birthdate: "1963-11-17" }, akteur);
    pruef("Gleicher Wert noch einmal → keine Änderung, kein zweiter Eintrag", !e.error && (e.changes?.length ?? 0) === 0);
    e = await updateCustomerContact(R1, { birthdate: "01.01.2010" }, akteur);
    pruef("Unter 18 ohne Bestätigung → Rückfrage", e.error?.code === 400 && e.error.rueckfrage === true);
    e = await updateCustomerContact(R1, { birthdate: "01.01.2010", geburtBestaetigt: true }, akteur);
    pruef("Unter 18 mit „Stimmt so“ → gespeichert", !e.error && (await werte()) === "2010-01-01|2010-01-01|2010-01-01");
    e = await updateCustomerContact(R1, { birthdateEntfernen: true }, akteur);
    pruef("Entfernen ohne Leitungsrecht → 403", e.error?.code === 403);
    e = await updateCustomerContact(R1, { birthdateEntfernen: true }, { ...akteur, darfGeburtLoeschen: true });
    pruef("Entfernen durch die Leitung → Person und Bestellungen leer", !e.error && (await werte()) === "||", await werte());
    const g = await geburtsdatumSetzen(R2, "1970-05-05", { id: null, name: "Prüfstand" });
    pruef("geburtsdatumSetzen über die zweite Bestellung trifft alle", g.geaendert && g.bestellungen === 2 && (await werte()) === "1970-05-05|1970-05-05|1970-05-05");
    let wand = "";
    try { await sqlPool`UPDATE fiaon_applications SET birthdate = '0063-11-17' WHERE ref = ${R1}`; } catch (x: any) { wand = String(x?.code ?? ""); }
    pruef("CHECK-Wand (Migration 103) hält an der Bestellung (23514)", wand === "23514", wand || "kein Fehler — Migration 103 eingespielt?");
    wand = "";
    try { await sqlPool`UPDATE fiaon_persons SET birthdate = '17.11.1963' WHERE id = ${personId}`; } catch (x: any) { wand = String(x?.code ?? ""); }
    pruef("CHECK-Wand hält an der Person (23514)", wand === "23514", wand);

    // ── Gegenprüfung 08.10.: Migration 103 mit einem Altwert (Transaktion, am Ende zurückgerollt) ──
    titel("B2  Migration 103 mit Altwert: Spalte kommt trotzdem, Bedingung bleibt NOT VALID");
    const migText = quelle("db/migrations/103_geburtsdatum_wand.sql");
    let mig: any = null;
    try {
      await sqlPool.begin(async (tx: any) => {
        await tx`ALTER TABLE fiaon_applications DROP CONSTRAINT fiaon_app_geburt_iso`;
        await tx`ALTER TABLE cancellation_requests DROP COLUMN identifiziert_ueber`;
        await tx`UPDATE fiaon_applications SET birthdate = '0063-11-17' WHERE ref = ${R1}`;
        await tx.unsafe(migText);
        const [c] = (await tx`SELECT convalidated FROM pg_constraint WHERE conname = 'fiaon_app_geburt_iso'`) as any[];
        const [p2] = (await tx`SELECT convalidated FROM pg_constraint WHERE conname = 'fiaon_person_geburt_iso'`) as any[];
        const [sp] = (await tx`SELECT 1 AS da FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'cancellation_requests' AND column_name = 'identifiziert_ueber'`) as any[];
        let neuWand = "";
        try { await tx.savepoint(async (sv: any) => { await sv`UPDATE fiaon_applications SET birthdate = '0064-01-01' WHERE ref = ${R2}`; }); }
        catch (x: any) { neuWand = String(x?.code ?? ""); }
        mig = { app: c?.convalidated, person: p2?.convalidated, spalte: !!sp, neuWand };
        throw new Error("PRUEF-ZURUECK");
      });
    } catch (x: any) { if (x?.message !== "PRUEF-ZURUECK") mig = { fehler: String(x?.message || x) }; }
    pruef("Migration 103 läuft mit Altwert „0063-11-17“ durch (kein Rückroll)", !!mig && !mig.fehler, JSON.stringify(mig));
    pruef("… Spalte identifiziert_ueber angelegt", mig?.spalte === true);
    pruef("… Bedingung an der Bestellung NOT VALID, an der Person geprüft", mig?.app === false && mig?.person === true, JSON.stringify(mig));
    pruef("… NOT VALID schützt trotzdem jeden neuen Schreibvorgang (23514)", mig?.neuWand === "23514", mig?.neuWand);
    const [nachMig] = (await sqlPool`SELECT convalidated FROM pg_constraint WHERE conname = 'fiaon_app_geburt_iso'`) as any[];
    pruef("… zurückgerollt: Bedingung wieder geprüft wie vorher", nachMig?.convalidated === true);

    // ── Gegenprüfung 08.10.: Die Kündigung hängt nie an der Spalte ──
    titel("B3  Kündigungsantrag ohne Spalte identifiziert_ueber (Migration fehlt)");
    const kmod = await import("../server/routes/cancellation");
    await kmod.kuendigungTabelleBereit;
    await sqlPool`ALTER TABLE cancellation_requests RENAME COLUMN identifiziert_ueber TO identifiziert_ueber_itg`;
    let ohne: any = null, spalteWieder = false;
    try {
      ohne = await kmod.kuendigungsAntragEinfuegen({
        ref: R1, firstName: "Prüfa", lastName: "Geburtig", email: `pruef.${MARKE.toLowerCase()}@example.invalid`, phone: null,
        packName: null, reason: "Prüfstand", cancellationDate: null, ueber: "name_email_abweichend",
      });
      await new Promise((r) => setTimeout(r, 400));
      await kmod.identitaetSpalteSichern();
      const [sp] = (await sqlPool`SELECT 1 AS da FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'cancellation_requests' AND column_name = 'identifiziert_ueber'`) as any[];
      spalteWieder = !!sp;
    } finally {
      // Nur die lokale Kopie: die frisch nachgelegte (leere) Spalte weg, die alte zurück.
      await sqlPool`ALTER TABLE cancellation_requests DROP COLUMN IF EXISTS identifiziert_ueber`;
      await sqlPool`ALTER TABLE cancellation_requests RENAME COLUMN identifiziert_ueber_itg TO identifiziert_ueber`;
    }
    const [ohneZeile] = ohne ? (await sqlPool`SELECT admin_note, status FROM cancellation_requests WHERE id = ${ohne.id}`) as any[] : [];
    pruef("Antrag geht ohne die Spalte durch (statt 500)", !!ohne?.id && ohne.ohneSpalte === true && ohneZeile?.status === "pending", JSON.stringify(ohne));
    pruef("… Kennung steht in admin_note („Identität prüfen“)", /Geburtsdatum nicht zu unseren Angaben passt – Identität prüfen\]/.test(ohneZeile?.admin_note ?? ""), ohneZeile?.admin_note);
    pruef("… und die Spalte wird von selbst nachgelegt", spalteWieder);
    const mitSpalte = await kmod.kuendigungsAntragEinfuegen({
      ref: R2, firstName: "Prüfa", lastName: "Geburtig", email: `pruef.${MARKE.toLowerCase()}@example.invalid`, phone: null,
      packName: null, reason: "Prüfstand", cancellationDate: null, ueber: "geburtsdatum",
    });
    const [mz] = (await sqlPool`SELECT identifiziert_ueber, admin_note FROM cancellation_requests WHERE id = ${mitSpalte.id}`) as any[];
    pruef("Mit Spalte: identifiziert_ueber gesetzt, keine Notiz", mitSpalte.ohneSpalte === false && mz?.identifiziert_ueber === "geburtsdatum" && mz?.admin_note == null, JSON.stringify(mz));

    // ── Gegenprüfung 08.10. (hoch): Eine E-Mail, zwei Menschen ──
    titel("B4  Gemeinsame E-Mail: die Person bekommt nie das Geburtsdatum des Partners");
    const pm = await import("../server/fiaon-person-model");
    const famMail = `pruef.${MARKE.toLowerCase()}.paar@example.invalid`;
    const [pf] = (await sqlPool`INSERT INTO fiaon_persons (person_ref, kind, first_name, last_name, primary_email, account_status)
      VALUES (${`P-${MARKE}-F`}, 'private', 'Konstantin', 'Nikolou', ${famMail}, 'pending') RETURNING id`) as any[];
    famPerson = Number(pf.id);
    await sqlPool`INSERT INTO fiaon_person_aliases (person_id, kind, value_norm, value_raw, source, created_at) VALUES (${famPerson}, 'email', ${famMail}, ${famMail}, 'pruefstand', NOW())`;
    await sqlPool`INSERT INTO fiaon_applications (ref, type, status, payment_status, first_name, last_name, email, birthdate, person_id, created_at, updated_at)
      VALUES (${RK}, 'private', 'submitted', 'paid', 'Konstantin', 'Nikolou', ${famMail}, NULL, ${famPerson}, NOW() - INTERVAL '5 days', NOW())`;
    await sqlPool`INSERT INTO fiaon_applications (ref, type, status, first_name, last_name, email, birthdate, created_at, updated_at)
      VALUES (${RM}, 'private', 'started', 'Magdalena', 'Nikolou', ${famMail}, '1975-05-05', NOW(), NOW())`;
    const zu = await pm.bindePersonAnAntrag(RM);
    const [nachM] = (await sqlPool`SELECT p.birthdate, p.first_name FROM fiaon_persons p WHERE p.id = ${famPerson}`) as any[];
    pruef("Antrag der Partnerin hängt per E-Mail an seiner Person", zu?.personId === famPerson, JSON.stringify(zu));
    pruef("… seine leere Person bekommt IHR Datum NICHT (Name passt nicht)", nachM?.birthdate == null && nachM?.first_name === "Konstantin", JSON.stringify(nachM));
    await sqlPool`UPDATE fiaon_applications SET birthdate = '1970-01-01' WHERE ref = ${RK}`;
    await pm.bindePersonAnAntrag(RK);
    const [nachK] = (await sqlPool`SELECT birthdate FROM fiaon_persons WHERE id = ${famPerson}`) as any[];
    pruef("Seine eigene Bestellung (Name passt) füllt die leere Person", nachK?.birthdate === "1970-01-01", JSON.stringify(nachK));
    const fst = await geburtStandAkte(famPerson);
    pruef("Akte: Abweichung mit Namen der fremden Bestellung + Warnung", fst.abweichend && fst.fremderName && fst.werte.some((w) => w.fremderName && w.quellen.some((q) => q.includes("Magdalena Nikolou"))), JSON.stringify(fst.werte));
    const eigen = await geburtStandAkte(personId);
    pruef("Akte ohne fremden Namen: keine Warnung", eigen.fremderName === false);
    // Person ohne Namen: füllt wie bisher.
    const [pn] = (await sqlPool`INSERT INTO fiaon_persons (person_ref, kind, primary_email, account_status)
      VALUES (${`P-${MARKE}-N`}, 'private', ${`pruef.${MARKE.toLowerCase()}.nn@example.invalid`}, 'pending') RETURNING id`) as any[];
    namenlos = Number(pn.id);
    await sqlPool`INSERT INTO fiaon_applications (ref, type, status, first_name, last_name, email, birthdate, person_id, created_at, updated_at)
      VALUES (${RN}, 'private', 'started', 'Nora', 'Namenlos', ${`pruef.${MARKE.toLowerCase()}.nn@example.invalid`}, '1981-08-09', ${namenlos}, NOW(), NOW())`;
    await pm.bindePersonAnAntrag(RN);
    const [nachN] = (await sqlPool`SELECT birthdate, first_name FROM fiaon_persons WHERE id = ${namenlos}`) as any[];
    pruef("Person ohne Namen: Name und Datum kommen aus der Zeile (wie bisher)", nachN?.birthdate === "1981-08-09" && nachN?.first_name === "Nora", JSON.stringify(nachN));
    // ── Querprüfung 08.10.2026 (§ 312k Abs. 4 BGB): Eingangsbestätigung ohne Schlüssel — versucht, im Verlauf ──
    titel("B5  Eingangsbestätigung der Kündigung (ohne Mail-Schlüssel: versucht, im Verlauf)");
    const eb = await kmod.eingangBestaetigen({ ref: R2, antragId: Number(mitSpalte.id), am: new Date(), name: "Prüfa Geburtig", wunsch: null, grund: "Prüfstand", packName: null, email: `pruef.${MARKE.toLowerCase()}@example.invalid` });
    const [ebv] = (await sqlPool`SELECT note FROM fiaon_contact_log WHERE ref = ${R2} AND note LIKE 'Eingangsbestätigung der Kündigung%' ORDER BY id DESC LIMIT 1`) as any[];
    pruef("Eingangsbestätigung: ohne Schlüssel nicht gesendet, aber im Verlauf mit Antragsnummer und Eingang", eb.gesendet === false && /Antrag Nr\. \d+, Eingang \d\d\.\d\d\.\d{4} um \d\d:\d\d Uhr/.test(String(ebv?.note)) && /NICHT gesendet/.test(String(ebv?.note)), ebv?.note);
  } finally {
    // Nur die eigene lokale Kopie (LOKAL geprüft): Prüfdaten wieder entfernen.
    const alle = [R1, R2, RK, RM, RN];
    await sqlPool`DELETE FROM cancellation_requests WHERE ref = ANY(${alle})`.catch(() => {});
    await sqlPool`DELETE FROM fiaon_contact_log WHERE ref = ANY(${alle})`.catch(() => {});
    await sqlPool`DELETE FROM fiaon_applications WHERE ref = ANY(${alle})`.catch(() => {});
    for (const id of [personId, famPerson, namenlos].filter(Boolean)) {
      await sqlPool`DELETE FROM fiaon_person_aliases WHERE person_id = ${id}`.catch(() => {});
      await sqlPool`DELETE FROM fiaon_persons WHERE id = ${id}`.catch(() => {});
    }
    const [rest] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_applications WHERE ref = ANY(${alle})`) as any[];
    pruef("Aufgeräumt", rest.n === 0);
  }
} else {
  console.log("\n(B übersprungen — DATABASE_URL zeigt nicht auf die lokale Kopie fiaon_it_g)");
}

// ═════════════════════════════════════════════════════════════════════════
// Teil C — lokaler Server + Browser
// ═════════════════════════════════════════════════════════════════════════
const BASIS = process.env.PRUEF_BASIS ?? "";
if (BASIS && /^http:\/\/(127\.0\.0\.1|localhost):5317$/.test(BASIS) && LOKAL) {
  const { browserTeil } = await import("./pruef-it-g-browser");
  const r = await browserTeil(BASIS, pruef, titel);
  if (r) console.log(r);
} else if (BASIS) {
  console.log("\n(C übersprungen — nur gegen http://127.0.0.1:5317 mit der lokalen Kopie)");
}

if (LOKAL) { const { sqlPool } = await import("../server/lib/db-pool"); await sqlPool.end({ timeout: 2 }).catch(() => {}); }
console.log(`\n${"═".repeat(72)}\nE-IT-G Geburtsdatum: ${ok} grün, ${rot} rot${rot ? `\n  ${fehler.slice(0, 20).join("\n  ")}` : ""}`);
// Querprüfung 08.10.2026: B5 lädt den Mailweg (Diagnose- und DDL-Wache-Takte) — ohne ausdrückliches Ende liefe der Prozess weiter.
process.exit(rot ? 1 : 0);
