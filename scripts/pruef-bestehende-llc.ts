// Prüfstand: Bestehende US-Gesellschaft löschen oder übertragen (17.11.2026) — rein, ohne Datenbank.
// npx tsx scripts/pruef-bestehende-llc.ts
import { bestehendeLlcPruefen, bestehendeLlcWeisungText, bestehendeLlcKurz, BESTEHENDE_LLC_LOESCHUNG_USD } from "../shared/fiaon-global-bestehende-llc";
import { globalDokumentArt, globalKundeDarfArt } from "../shared/fiaon-global-bereich";
import { globalTresorKategorie } from "../shared/fiaon-global-mandat";
import fs from "node:fs";

let gut = 0, schlecht = 0;
const ok = (b: unknown, was: string) => { if (b) gut++; else { schlecht++; console.log("FEHLER ", was); } };
const NAME = "Max Muster";
const basis = { wahl: "loeschen", gesellschaft: { name: "Muster Events LLC", staat: "Florida", dokumentNr: "l21000123456" }, bestaetigtMit: "max muster", weisungBestaetigt: true };

const l = bestehendeLlcPruefen(basis, NAME);
ok(l.ok, "Löschen mit allen Pflichtangaben ist gültig");
if (l.ok) {
  ok(l.eingabe.gesellschaft.dokumentNr === "L21000123456", "Registernummer wird groß geschrieben");
  ok(l.eingabe.empfaenger === null && l.eingabe.anteil === null, "Löschen trägt keinen Empfänger und keinen Anteil");
  const t = bestehendeLlcWeisungText(l.eingabe, { auftraggeber: "Herr Max Muster", auftragRef: "FIAON-X", erteiltAm: "17.11.2026, 10:00 Uhr" });
  ok(t.includes("LÖSCHUNG") && t.includes(`${BESTEHENDE_LLC_LOESCHUNG_USD} US-Dollar`) && t.includes("erst nach erfolgter Löschung"), "Weisungstext Löschung nennt Kosten und Zeitpunkt der Rechnung");
  ok(t.includes("„max muster“") && t.includes("FIAON-X"), "Weisungstext nennt Bestätigung und Auftrag");
  ok(bestehendeLlcKurz(l.eingabe) === "Löschung von Muster Events LLC (Florida)", "Kurzfassung Löschung");
}
ok(!bestehendeLlcPruefen({ ...basis, wahl: "" }, NAME).ok, "ohne Wahl: Fehler");
ok(!bestehendeLlcPruefen({ ...basis, gesellschaft: { name: "AB" } }, NAME).ok, "ohne Namen der Gesellschaft: Fehler");
ok(!bestehendeLlcPruefen({ ...basis, bestaetigtMit: "Max Mustermann" }, NAME).ok, "falscher Name: Fehler");
ok(!bestehendeLlcPruefen({ ...basis, weisungBestaetigt: false }, NAME).ok, "ohne Häkchen: Fehler");
ok(!bestehendeLlcPruefen({ ...basis, gesellschaft: { name: "Muster LLC", dokumentNr: "<script>" } }, NAME).ok, "kaputte Registernummer: Fehler");
const st = bestehendeLlcPruefen({ ...basis, gesellschaft: { name: "Muster LLC", staat: "Texas" } }, NAME);
ok(st.ok && st.eingabe.gesellschaft.staat === "Florida", "unbekannter Bundesstaat fällt auf Florida");

const ue = { ...basis, wahl: "uebertragen", anteil: 100, empfaenger: { art: "firma", name: "Beispiel Holding GmbH", vertreten: "Erika Beispiel", strasse: "Musterstraße 5", plz: "80331", ort: "München", land: "Deutschland", email: "Erika@Beispiel.example" } };
const u = bestehendeLlcPruefen(ue, NAME);
ok(u.ok, "Übertragen an eine Firma mit allen Angaben ist gültig");
if (u.ok) {
  ok(u.eingabe.empfaenger?.email === "erika@beispiel.example", "E-Mail wird klein geschrieben");
  const t = bestehendeLlcWeisungText(u.eingabe, { auftraggeber: "Herr Max Muster", auftragRef: "FIAON-X", erteiltAm: "17.11.2026" });
  ok(t.includes("ÜBERTRAGUNG") && t.includes("100 % der Anteile") && t.includes("vertreten durch Erika Beispiel") && t.includes("Kosten nennt FIAON vorab"), "Weisungstext Übertragung vollständig");
  ok(bestehendeLlcKurz(u.eingabe).includes("100 % der Anteile an Beispiel Holding GmbH (Firma)"), "Kurzfassung Übertragung");
}
ok(!bestehendeLlcPruefen({ ...ue, empfaenger: { ...ue.empfaenger, vertreten: "" } }, NAME).ok, "Firma ohne Vertreter: Fehler");
ok(!bestehendeLlcPruefen({ ...ue, empfaenger: { ...ue.empfaenger, email: "keine-mail" } }, NAME).ok, "Übertragung ohne gültige E-Mail: Fehler");
ok(!bestehendeLlcPruefen({ ...ue, empfaenger: { ...ue.empfaenger, plz: "" } }, NAME).ok, "Übertragung ohne vollständige Anschrift: Fehler");
ok(!bestehendeLlcPruefen({ ...ue, anteil: 0 }, NAME).ok && !bestehendeLlcPruefen({ ...ue, anteil: 101 }, NAME).ok, "Anteil außerhalb 1–100: Fehler");
const pe = bestehendeLlcPruefen({ ...ue, empfaenger: { ...ue.empfaenger, art: "person", vertreten: "" } }, NAME);
ok(pe.ok && pe.eingabe.empfaenger?.vertreten === "", "Person braucht keinen Vertreter");

// Die Dokumentart „weisung“: bekannt, Mappe „Vollmachten“, der Kunde wählt sie nicht selbst beim Hochladen.
ok(globalDokumentArt("weisung")?.de === "Weisung des Auftraggebers", "Dokumentart „weisung“ ist bekannt");
ok(globalTresorKategorie("weisung") === "vollmacht", "Weisung liegt in der Mappe „Vollmachten“");
ok(!globalKundeDarfArt("weisung"), "Kunde wählt „weisung“ nicht beim Hochladen");

// Die Wege: Route im Client, Freigabe im Server (sonst 404), Zutritt nur nach Annahme, Vorschau der Leitung sendet nicht.
const app = fs.readFileSync("client/src/App.tsx", "utf8");
const seo = fs.readFileSync("server/lib/fiaon-seiten-seo.ts", "utf8");
const srv = fs.readFileSync("server/lib/fiaon-global-bestehende-llc.ts", "utf8");
const rt = fs.readFileSync("server/routes/fiaon-global-angebot.ts", "utf8");
ok(app.indexOf('"/business/angebot/:token/bestehende-gesellschaft"') > 0 && app.indexOf('"/business/angebot/:token/bestehende-gesellschaft"') < app.indexOf('"/business/angebot/:token"'), "Client-Route steht vor der Angebotsroute");
ok(seo.includes("bestehende-gesellschaft$/"), "Server kennt den Weg (kein 404)");
ok(/angebotStatusAus\(z\) !== "angenommen"/.test(srv) && /kontext\.leitung\) return nein\(403/.test(srv), "Zutritt nur nach Annahme; Leitung nur Vorschau");
ok(rt.includes('router.get("/global/angebot/:token/bestehende-gesellschaft"') && rt.includes('router.post("/global/angebot/:token/bestehende-gesellschaft"'), "beide API-Wege vorhanden");

console.log(`\n${gut} Prüfungen grün, ${schlecht} rot.`);
if (schlecht) process.exitCode = 1;
