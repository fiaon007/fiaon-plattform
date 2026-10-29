// E-462 (29.10.2026): Prüfstand für den Arbeitsablauf je Global-Kunde (shared/fiaon-global-arbeitsablauf.ts) — rein, ohne DB.
// Aufruf: env -i HOME PATH TZ=Europe/Berlin node_modules/.bin/tsx scripts/pruef-global-arbeitsablauf.ts
import { readFileSync } from "node:fs";
import {
  ABLAUF_BLOECKE, ABLAUF_SCHRITTE, ABLAUF_VORAB, ABLAUF_HAKEN_KEYS, ablaufHakenErlaubt, ablaufMailName, ablaufNameOhneEndung,
  ablaufPlusWerktage, ablaufWerte, ablaufEinsetzen, ablaufStand,
} from "../shared/fiaon-global-arbeitsablauf";

let gut = 0, schlecht = 0;
const pruef = (name: string, ok: boolean, info?: unknown) => { if (ok) gut++; else { schlecht++; console.log("ROT:", name, info ?? ""); } };

// Aufbau
pruef("8 Blöcke (0 + 7)", ABLAUF_BLOECKE.length + 1 === 8);
pruef("20 Schritte", ABLAUF_SCHRITTE.length === 20);
pruef("Nummern 1–20 lückenlos", ABLAUF_SCHRITTE.every((s, i) => s.nr === i + 1));
pruef("Schlüssel eindeutig", new Set([...ABLAUF_SCHRITTE.map((s) => s.key), ...ABLAUF_VORAB.map((v) => v.key)]).size === 23);
pruef("3 Vorab-Dinge", ABLAUF_VORAB.length === 3);

// Feldwerte exakt
const alles = JSON.stringify(ABLAUF_BLOECKE);
for (const w of ["Business Formation Package Without SSN", "Standard Articles", "79 $", "100 $", "125 $", "304 $", "Free Identity — use our address",
  "Member Managed", "Using Our Address", "Use our address", "Same as Principal", "Upon Filing", "7901 4th St N, Ste 300, St. Petersburg, FL 33702",
  "699 $", "677 $", "547 $", "199 $", "9–11 Wochen", "bis 15.04.", "01.01.–01.05.", "may be unavailable", "please submit today", "Hire Us › Start a new business",
  "https://form5472.online", "https://tello.com", "https://mercury.com", "https://services.sunbiz.org/Filings/AnnualReport/FilingStart",
  "https://www.irs.gov/individuals/individual-taxpayer-identification-number", "/chef/s/global-auftraege?reiter=partner"]) {
  pruef(`Wert „${w}“`, alles.includes(w));
}
const s7 = ABLAUF_SCHRITTE.find((s) => s.nr === 7)!;
pruef("EIN: ITIN No", s7.felder!.some((f) => f.feld === "ITIN" && f.wert === "No"));
pruef("EIN: 5 Kästchen leer", s7.felder!.some((f) => /5 Kästchen/.test(f.feld) && f.wert === "alle leer"));
pruef("EIN braucht Tätigkeit + Einverstanden", JSON.stringify(s7.braucht) === JSON.stringify(["v_taetigkeit", "v_einverstanden"]));
const s8 = ABLAUF_SCHRITTE.find((s) => s.nr === 8)!;
pruef("Formation: Members Yes", s8.felder!.some((f) => f.feld === "Members on State Record" && f.wert === "Yes"));
pruef("Formation: Attorney aus", s8.felder!.some((f) => /Attorney/.test(f.feld) && f.wert === "AUS"));

// Öffentliches Repo: keine Kundendaten in der Quelle
const quelle = readFileSync(new URL("../shared/fiaon-global-arbeitsablauf.ts", import.meta.url), "utf8");
pruef("keine Kundennamen/Rechnungsnummern", !/CHEHADE|389FE6Z2|Kaitlin/i.test(quelle));

// Haken-Liste
pruef("Haken: Vorab erlaubt", ablaufHakenErlaubt("v_einverstanden"));
pruef("Haken: Station-Schritt nicht erlaubt", !ablaufHakenErlaubt("s03_name"));
pruef("Haken: Unsinn nicht erlaubt", !ablaufHakenErlaubt("__proto__") && !ablaufHakenErlaubt(5));
pruef("Haken: 9 Schritte + 3 Vorab", ABLAUF_HAKEN_KEYS.length === 12, ABLAUF_HAKEN_KEYS.length);

// Werte
pruef("Mailname Umlaute", ablaufMailName("Müller-Lüdenscheidt") === "muellerluedenscheidt");
pruef("Mailname Akzente/ß", ablaufMailName("Gößé López") === "goessélopez".normalize("NFD").replace(/[̀-ͯ]/g, ""));
pruef("Name ohne LLC", ablaufNameOhneEndung("Muster Holding LLC") === "Muster Holding");
pruef("Name ohne L.L.C.", ablaufNameOhneEndung("Muster, L.L.C.") === "Muster");
pruef("Name ohne Endung bleibt", ablaufNameOhneEndung("Muster Holding") === "Muster Holding");
const jetzt = new Date("2026-10-29T10:00:00Z"); // Donnerstag
pruef("+5 Werktage", ablaufPlusWerktage(jetzt, 5) === "05.11.2026", ablaufPlusWerktage(jetzt, 5));
pruef("+1 Werktag Freitag → Montag", ablaufPlusWerktage(new Date("2026-10-30T10:00:00Z"), 1) === "02.11.2026");
const w = ablaufWerte({ gesellschaftName: "Muster & Co LLC", vorname: "Anna", nachname: "Schäfer", wohnadresse: "Weg 1\n12345 Ort\nDeutschland", jetzt });
pruef("Kontakt-Mail", w.kontaktMail === "js+schaefer@fiaon.com", w.kontaktMail);
pruef("Bundesstaat Vorgabe Florida", w.bundesstaat === "Florida");
pruef("heute US", w.heuteUs === "10/29/2026", w.heuteUs);
pruef("Wohnadresse einzeilig", w.wohnadresse === "Weg 1, 12345 Ort, Deutschland");
const url = ablaufEinsetzen("https://x/?q={sunbizName}", w, { url: true });
pruef("URL codiert", url.text === "https://x/?q=Muster%20%26%20Co" && !url.fehlt, url.text);
const leer = ablaufEinsetzen("{usTelefon}", w);
pruef("Leerstelle", leer.fehlt && leer.text.startsWith("‹"));
pruef("Anleitung ohne Werte", ablaufEinsetzen("{kunde}", null).fehlt);

// Stand
const leerStand = ablaufStand({ status: "offen", schritte: [], haken: {} });
pruef("offen: 0 von 20", leerStand.erledigt === 0 && leerStand.gesamt === 20);
pruef("offen: nächster = Zahlung", leerStand.naechster === "s01_zahlung");
pruef("EIN wartet ohne Vorab", leerStand.schritte.find((s) => s.key === "s07_ein_formular")!.zustand === "wartet");
const h = (am = "2026-10-29T10:00:00+01:00") => ({ am, von: "Test" });
const st = ablaufStand({
  status: "gestartet", bezahltAm: "2026-10-29",
  schritte: [{ schluessel: "name", status: "erledigt", datum: "2026-10-29" }, { schluessel: "articles", status: "erledigt" }, { schluessel: "agent", status: "erledigt" }, { schluessel: "itin", status: "entfaellt" }],
  plus: { usAdresse: "7901 4th St N" }, dokumentArten: ["reisepass"],
  haken: { s02_akte: h(), s04_bestellen: h(), s05_paket: h(), s06_cart: h() },
});
const z = (k: string) => st.schritte.find((s) => s.key === k)!;
pruef("Zahlung erledigt", z("s01_zahlung").zustand === "erledigt" && z("s01_zahlung").datum === "2026-10-29");
pruef("Name aus Station", z("s03_name").zustand === "erledigt" && z("s03_name").station === "name");
pruef("Agent+Adresse erledigt", z("s09_agent_adresse").zustand === "erledigt");
pruef("Tello offen ohne Nummer", z("s12_tello").zustand === "offen");
pruef("Eintragung läuft", z("s13_sunbiz_pruefen").zustand === "in_arbeit");
pruef("entfällt zählt als erledigt", z("s19_itin").zustand === "erledigt");
pruef("Pass aus Tresor", st.vorab.v_pass.da && st.vorab.v_pass.ausTresor);
pruef("EIN wartet weiter", z("s07_ein_formular").zustand === "wartet");
pruef("nächster überspringt Wartendes", st.naechster === "s10_notiz", st.naechster);
pruef("Zahl 9 von 20", st.erledigt === 9, st.erledigt);
const st2 = ablaufStand({ status: "gestartet", schritte: [], haken: { v_taetigkeit: h(), v_einverstanden: h() } });
// E-462 Nachtrag: ohne US-Nummer wartet das EIN-Formular weiter — mit Nummer + Vorab ist es frei.
pruef("EIN wartet ohne US-Nummer", st2.schritte.find((s) => s.key === "s07_ein_formular")!.zustand === "wartet");
const st3 = ablaufStand({ status: "gestartet", schritte: [], plus: { usTelefon: "+1 555 0100" }, haken: { v_taetigkeit: h(), v_einverstanden: h() } });
pruef("EIN frei mit Vorab + US-Nummer", st3.schritte.find((s) => s.key === "s07_ein_formular")!.zustand === "offen");

console.log(`pruef-global-arbeitsablauf: ${gut} grün, ${schlecht} rot`);
process.exit(schlecht ? 1 : 0);
