// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: DIE STAATEN-WAHL VON FIAON GLOBAL (E-465, 29.10.2026)
//
// Rein, ohne Datenbank und ohne Netz (Musterdaten — Repo öffentlich):
//   1 Quelle shared/fiaon-global-bundesstaaten.ts: drei angebotene Staaten, Vorgabe Delaware, Kürzel/Namen,
//     Beträge = fakten.ts, Nevada nicht angeboten, Stand-Datum
//   2 Wortregeln: jeder Kundensatz der Quelle (DE + EN) durch die Global-Wortwand — kein „bis zu“, keine Frist mit
//     Ziffer, kein „empfohlen/recommend“, kein „garantiert“, kein Partnername
//   3 Website: FG · 27 „Welcher US-Bundesstaat passt?“ DE + EN aus einer Funktion, Staatsseiten mit Eintragung/Express,
//     Kosten mit Zeiten, FAQ der Übersicht wortgleich mit STAAT_WAHL_SATZ, llms.txt, Mara-Wissen
//   4 Angebote NEU (Fassung C, Kapital A/B, Begleit): Delaware als Vorgabe, Florida/Wyoming wählbar, Nevada abgewiesen,
//     Fahrplan/Eintragungssatz/Jahrespflicht je Staat, Staaten-Fassung beim Ändern unveränderlich
//   5 Angebote BESTAND (ohne staatenFassung): Seite und Vertrag wortgleich wie vor E-465 (Florida-Sätze unverändert)
//
// Bestandsschutz gegen die Produktion (nur lesend, zwei Läufe):
//   node ~/Desktop/FIAON/10_Nacharbeit/werkzeuge/ro.mjs <angebote.sql> kompakt > <zeilen.json>   (SELECT ohne vertrag_pdf)
//   npx tsx scripts/pruef-global-bundesstaaten.ts --bestand <zeilen.json> --aus <neu.json>          (in diesem Zweig)
//   npx tsx scripts/pruef-global-bundesstaaten.ts --bestand <zeilen.json> --aus <alt.json>          (in einer Kopie von origin/main)
//   npx tsx scripts/pruef-global-bundesstaaten.ts --bestand <zeilen.json> --vergleich <alt.json>    → Prüfsumme UND Seite je Angebot gleich
// Die Zeilen enthalten Kundendaten — sie bleiben im Scratchpad, nie im Repo.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "OPENAI_API_KEY"]) if (process.env[k]) { console.error(`ABBRUCH: ${k} ist gesetzt.`); process.exit(3); }
process.env.DATABASE_URL = "postgres://pruefstand:ohne@127.0.0.1:1/keine-datenbank";
globalThis.fetch = (async () => { throw new Error("Prüfstand: kein Netz"); }) as typeof fetch;
const arg = (n: string): string | null => { const i = process.argv.indexOf(n); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : null; };

let gut = 0; const rot: string[] = [];
function ok(bed: unknown, text: string, fund: unknown = ""): void {
  if (bed) { gut++; return; }
  rot.push(text); console.log(`  ROT   ${text}${fund !== "" ? `  →  ${String(typeof fund === "string" ? fund : JSON.stringify(fund)).slice(0, 300)}` : ""}`);
}
const abschnitt = (t: string) => console.log(`\n── ${t} ${"─".repeat(Math.max(0, 72 - t.length))}`);
const texte = (v: unknown): string[] => typeof v === "string" ? [v] : Array.isArray(v) ? v.flatMap(texte) : v && typeof v === "object" ? Object.values(v).flatMap(texte) : [];
const sha = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 16);

// ═══ BESTAND-LAUF (nur die Funktionen, die es auch auf origin/main gibt) ═══════
const bestandDatei = arg("--bestand");
if (bestandDatei) {
  const zeilen = JSON.parse(readFileSync(bestandDatei, "utf8")) as any[];
  const KC = await import("../server/lib/fiaon-global-angebot-kapital-c");
  const KA = await import("../server/lib/fiaon-global-angebot-kapital");
  const BG = await import("../server/lib/fiaon-global-angebot-begleit");
  const SC = await import("../shared/fiaon-global-angebot-kapital-c");
  const SA = await import("../shared/fiaon-global-angebot-kapital");
  const SB = await import("../shared/fiaon-global-angebot-begleit");
  const erg: Record<string, { fassung: string; status: string; hash: string; gespeichert: string | null; seite: string; vertrag: string }> = {};
  for (const z of zeilen) {
    const f = String(z.fassung);
    let hash = "", seite = "", vertrag = "";
    if (/^IA-KAPITAL-.*-C$/.test(f) || (String(z.status) === "offen" && (z.kunde?.art === "privat"))) {
      const d = KC.kapitalCDatenAus(z); hash = KC.kapitalCTextHash(d); seite = sha(JSON.stringify(SC.kapitalCSeite(d))); vertrag = sha(SC.kapitalCRumpfHtml(d, null));
    } else if (/^IA-KAPITAL-/.test(f)) {
      const d = KA.kapitalDatenAus(z); hash = KA.kapitalTextHash(d); seite = sha(JSON.stringify(SA.kapitalSeite(d))); vertrag = sha(SA.kapitalRumpfHtml(d, null));
    } else if (/^IA-BEGLEIT-/.test(f)) {
      const d = BG.begleitDatenAus(z); hash = BG.begleitTextHash(d); seite = sha(JSON.stringify(SB.begleitSeite(d))); vertrag = sha(SB.begleitRumpfHtml(d, null));
    } else continue; // Individual-, Firmen- und Kooperationsangebote: von E-465 nicht berührt
    erg[String(z.id)] = { fassung: f, status: String(z.status), hash, gespeichert: z.text_hash ?? null, seite, vertrag };
  }
  const aus = arg("--aus");
  if (aus) { writeFileSync(aus, JSON.stringify(erg, null, 1)); console.log(`${Object.keys(erg).length} Angebote berechnet → ${aus}`); }
  const vergleich = arg("--vergleich");
  if (vergleich) {
    abschnitt("5b Bestand gegen die Produktion: dieser Zweig = origin/main");
    const alt = JSON.parse(readFileSync(vergleich, "utf8")) as typeof erg;
    ok(Object.keys(alt).length === Object.keys(erg).length && Object.keys(erg).length > 0, `gleich viele Angebote (${Object.keys(erg).length})`);
    for (const [id, e] of Object.entries(erg)) {
      const a = alt[id];
      ok(a && a.hash === e.hash, `Angebot ${id} (${e.fassung}, ${e.status}): Prüfsumme des Vertrags unverändert`, { alt: a?.hash, neu: e.hash });
      ok(a && a.vertrag === e.vertrag, `Angebot ${id}: Vertragstext unverändert`);
      ok(a && a.seite === e.seite, `Angebot ${id}: Angebotsseite (alle Kundentexte) unverändert`);
      // Weicht schon origin/main von der gespeicherten Prüfsumme ab, liegt das vor E-465 (der unterschriebene Vertrag liegt als PDF
      // in der Zeile) — dann nur ein Hinweis; entscheidend ist oben: dieser Zweig rechnet exakt wie origin/main.
      if (e.status === "angenommen") {
        if (a && a.hash !== e.gespeichert) console.log(`  HINWEIS Angebot ${id}: Prüfsumme weicht schon auf origin/main von der Annahme ab (vor E-465, nicht durch diesen Bau)`);
        else ok(e.gespeichert === e.hash, `Angebot ${id}: Prüfsumme = gespeicherte Prüfsumme der Annahme`, { gespeichert: e.gespeichert, neu: e.hash });
      }
    }
    console.log(`\n${gut} grün, ${rot.length} rot.`);
    process.exit(rot.length ? 1 : 0);
  }
  process.exit(0);
}

// ═══ 1 QUELLE ════════════════════════════════════════════════════════════════
const Q = await import("../shared/fiaon-global-bundesstaaten");
const FK = await import("../shared/fiaon-global-seiten/fakten");
const FKE = await import("../shared/fiaon-global-seiten/fakten-en");
abschnitt("1 Quelle");
ok(JSON.stringify(Q.STAATEN_ANGEBOTEN) === JSON.stringify(["delaware", "florida", "wyoming"]), "angeboten: Delaware, Florida, Wyoming");
ok(Q.STAAT_VORGABE_NEU === "delaware" && Q.STAAT_VORGABE_NAME === "Delaware", "Vorgabe für neue Angebote: Delaware");
ok(!Q.BUNDESSTAATEN.nevada.angeboten && !Q.staatAngeboten("Nevada") && !Q.staatAngeboten("NV"), "Nevada nicht angeboten");
for (const [roh, soll] of [["DE", "delaware"], ["delaware", "delaware"], ["State of Delaware", "delaware"], ["FL", "florida"], ["Florida", "florida"], ["wy", "wyoming"], ["Texas", null], ["", null]] as const)
  ok(Q.staatSchluessel(roh) === soll, `staatSchluessel(„${roh}“) = ${soll}`, Q.staatSchluessel(roh));
ok(Q.staatName("DE") === "Delaware" && Q.staatName("Texas") === "Texas", "staatName: Kürzel → Name, Unbekanntes bleibt");
ok(Q.BUNDESSTAATEN.delaware.jahr.betrag.de === FK.STAAT.delaware.jahr && FK.STAAT.delaware.jahr === "400 $", "Delaware jährlich 400 $ (amtlich, fakten.ts)");
ok(Q.BUNDESSTAATEN.wyoming.jahr.betrag.de === FK.STAAT.wyoming.jahr && /60 \$/.test(FK.STAAT.wyoming.jahr), "Wyoming jährlich mindestens 60 $ (amtlich)");
ok(Q.BUNDESSTAATEN.florida.jahr.betrag.de === FK.STAAT.florida.jahr && Q.BUNDESSTAATEN.florida.gruendung.de === "125 $", "Florida 125 $ / 138,75 $");
ok(Q.BUNDESSTAATEN.delaware.jahr.betrag.en === FKE.STAAT_EN.delaware.jahr && Q.BUNDESSTAATEN.wyoming.gruendung.en === FKE.STAAT_EN.wyoming.gruendung, "EN-Beträge aus fakten-en.ts");
ok(/^\d{4}-\d{2}-\d{2}$/.test(Q.STAATEN_STAND), "Stand-Datum der Zeiten");
ok(Q.BUNDESSTAATEN.delaware.express.moeglich && !Q.BUNDESSTAATEN.florida.express.moeglich, "Express: Delaware ja, Florida nein");
ok(Q.BUNDESSTAATEN.florida.werktage.bis > Q.BUNDESSTAATEN.delaware.express.werktage!.bis * 4, "Florida derzeit deutlich langsamer als Delaware mit Express");

// ═══ 2 WORTREGELN ════════════════════════════════════════════════════════════
const W = await import("../shared/fiaon-global-wortregeln");
abschnitt("2 Wortregeln (DE + EN)");
const kundeDe: string[] = [Q.STAAT_WAHL_SATZ.de, Q.STAAT_BANKEN.de, ...texte(Q.EIN_ZEITEN.de)];
const kundeEn: string[] = [Q.STAAT_WAHL_SATZ.en, Q.STAAT_BANKEN.en, ...texte(Q.EIN_ZEITEN.en)];
for (const b of Object.values(Q.BUNDESSTAATEN)) {
  for (const feld of [b.eintragung, b.eintragungKurz, b.express.text, b.express.kurz, b.fahrplan, b.passtFuer, b.einordnung]) { kundeDe.push(feld.de); kundeEn.push(feld.en); }
  kundeDe.push(...b.vorteile.de, ...b.nachteile.de); kundeEn.push(...b.vorteile.en, ...b.nachteile.en);
  for (const sp of ["de", "en"] as const) (sp === "de" ? kundeDe : kundeEn).push(Q.staatEintragungSatz(b.schluessel, sp));
}
for (const t of kundeDe) ok(W.globalWortPruefen(t).length === 0, `DE: „${t.slice(0, 60)}…“`, W.globalWortPruefen(t));
for (const t of kundeEn) ok(W.globalWortPruefenEn(t).length === 0, `EN: „${t.slice(0, 60)}…“`, W.globalWortPruefenEn(t));
const alleKunde = [...kundeDe, ...kundeEn].join("\n");
ok(!/northwest/i.test(alleKunde), "kein Partnername in Kundentexten");
ok(!/garant/i.test(alleKunde) && !/\bbis zu\b|\bup to\b/i.test(alleKunde), "kein „garantiert“, kein „bis zu“");
ok(!/(Briefkasten|bank-?tauglich)/i.test(alleKunde), "keine Interna („Briefkasten-Staat“, „bank-tauglich“)");

// ═══ 3 WEBSITE ═══════════════════════════════════════════════════════════════
const GS = await import("../shared/fiaon-global-seiten");
const I18N = await import("../client/src/i18n/global");
abschnitt("3 Website");
const alle = [...GS.GLOBAL_SEITEN, ...GS.GLOBAL_SEITEN_EN];
const seite = (p: string) => alle.find((s) => s.pfad === p);
const wahlDe = seite("/business/wissen/bundesstaat-waehlen"), wahlEn = seite("/en/business/knowledge/choosing-a-state");
ok(wahlDe && wahlDe.h1 === "Welcher US-Bundesstaat passt?" && wahlDe.stand === Q.STAATEN_STAND, "FG · 27 DE: neuer Titel und Stand");
ok(wahlEn && wahlEn.schwester === "/business/wissen/bundesstaat-waehlen" && wahlEn.stand === Q.STAATEN_STAND, "FG · 27 EN: Schwester und Stand");
const tDe = JSON.stringify(wahlDe), tEn = JSON.stringify(wahlEn);
for (const w of ["Delaware", "Florida", "Wyoming", "ein bis zwei Werktage", "rund zwei Wochen", "rund drei Werktage", "Express", "Operating Agreement", "EIN", "Nevada"]) ok(tDe.includes(w), `FG · 27 DE nennt „${w}“`);
for (const w of ["one or two business days", "around two weeks", "around three business days", "express", "operating agreement", "Nevada"]) ok(tEn.includes(w), `FG · 27 EN nennt „${w}“`);
ok(!/Drei Fragen entscheiden/.test(tDe) && !/Three questions decide/.test(tEn), "alte Überschrift „Drei Fragen entscheiden“ weg");
for (const [p, w] of [["/business/delaware", "ein bis zwei Werktage"], ["/business/florida", "rund zwei Wochen"], ["/business/wyoming", "rund drei Werktage"],
  ["/en/business/delaware", "one or two business days"], ["/en/business/florida", "around two weeks"], ["/en/business/wyoming", "around three business days"]] as const) {
  const s = JSON.stringify(seite(p)); ok(s.includes(w) && /"Express"/.test(s), `${p}: Eintragung („${w}“) und Express im Vergleich`);
}
ok(!/Passt selten/.test(JSON.stringify(seite("/business/delaware"))) && !/Rarely a fit/.test(JSON.stringify(seite("/en/business/delaware"))), "Delaware-Seite widerspricht der Vorgabe nicht mehr („Passt selten“ weg)");
ok(/rund zwei Wochen/.test(JSON.stringify(seite("/business/kosten"))) && /around two weeks/.test(JSON.stringify(seite("/en/business/costs"))), "Kosten DE/EN: Eintragungszeiten in der Staatentabelle");
const fDe = I18N.GLOBAL_WOERTER.de.fragen.find((f: any) => f.f === "In welchem US-Bundesstaat gründen Sie?");
const fEn = (I18N.GLOBAL_WOERTER as any).en.fragen.find((f: any) => f.f === "Which US state do you form in?");
ok(fDe && fDe.a === Q.STAAT_WAHL_SATZ.de, "Übersicht-FAQ DE wortgleich mit STAAT_WAHL_SATZ.de", fDe?.a);
ok(fEn && fEn.a === Q.STAAT_WAHL_SATZ.en, "Übersicht-FAQ EN wortgleich mit STAAT_WAHL_SATZ.en", fEn?.a);
const FR = readFileSync(new URL("../shared/fiaon-seo-fragen.ts", import.meta.url), "utf8");
ok(FR.includes("In welchem US-Bundesstaat gründen Sie?") && FR.includes("Which US state do you form in?"), "FAQ-Daten (seo-fragen-erzeugen) enthalten die neue Frage");
const { llmsTxt } = await import("../server/lib/fiaon-llms");
ok(llmsTxt().includes(Q.STAAT_WAHL_SATZ.de), "llms.txt: Staaten-Wahl mit Zeiten");
const { globalWissen } = await import("../shared/fiaon-wissen");
const mara = globalWissen();
ok(mara.includes(Q.STAAT_WAHL_SATZ.de) && mara.includes(Q.EIN_ZEITEN.de.satz) && /nie als Zusage/.test(mara) && !/northwest/i.test(mara), "Mara-Wissen: Staaten, EIN-Zeiten, keine Zusage, kein Partnername");
const AB = await import("../shared/fiaon-global-arbeitsablauf");
ok(/Express/.test(JSON.stringify(AB.ablaufBloecke("Delaware"))) && /icis\.corp\.delaware\.gov/.test(JSON.stringify(AB.ablaufBloecke("DE"))), "Arbeitsablauf: Delaware mit Express und eigenem Register");

// ═══ 4 ANGEBOTE NEU ═════════════════════════════════════════════════════════
const SC = await import("../shared/fiaon-global-angebot-kapital-c");
const SA = await import("../shared/fiaon-global-angebot-kapital");
const SB = await import("../shared/fiaon-global-angebot-begleit");
abschnitt("4 Angebote neu (E-465)");
const KUNDE_C = SC.kapitalCKundePruefen({
  art: "privat", anrede: "Herr", vorname: "Max", nachname: "Mustermann", geburtsdatum: "1980-01-15", geburtsort: "Musterstadt", staatsangehoerigkeit: "deutsch",
  strasse: "Musterweg 1", plz: "12345", ort: "Musterstadt", land: "DE", email: "max.mustermann@beispiel.example", telefon: "",
  ausweise: [{ art: "reisepass", nummer: "C01X00T47", gueltigBis: "2033-01-01", behoerde: "Stadt Musterstadt" }],
});
if (!KUNDE_C.ok) { console.error("Musterkunde ungültig:", KUNDE_C.error); process.exit(1); }
const BUERGIN = { name: "Muster Partner LLC", bundesstaat: "Florida", anschrift: "1 Example Way, Miami, FL 33100, USA", registernummer: "L00000000000", vertreter: "Erika Muster", funktion: "Manager" };
const FIRMA: any = { art: "firma", firma: { name: "Musterfirma Beispiel GmbH", marke: "BEISPIEL", rechtsform: "GmbH", registergericht: "Amtsgericht Musterstadt", registernummer: "HRB 99999", uid: "DE123456789", strasse: "Musterweg 7", plz: "12345", ort: "Musterstadt", land: "DE" },
  vertretung: { anrede: "Frau", vorname: "Martina", nachname: "Muster", funktion: "Geschäftsführerin" }, email: "pruef@beispiel.example", telefon: "" };
const KUNDE_B = { art: "privat" as const, anrede: "Herr" as const, vorname: "Max", nachname: "Muster", geburtsdatum: "1990-01-01", strasse: "Musterweg 1", plz: "10115", ort: "Berlin", land: "DE" as const, email: "pruef@example.org", telefon: "" };

function cDaten(roh: Record<string, unknown>) {
  const parameter = SC.kapitalCParameterAus({ ...SC.KAPITAL_C_VORGABEN, ...roh } as any);
  return { ref: "FIAON-IA-CMUSTER", fassung: SC.KAPITAL_C_FASSUNG, kunde: KUNDE_C.ok ? KUNDE_C.kunde : (null as never), buergin: BUERGIN as any, parameter, gueltigBis: "2026-11-30" };
}
function aDaten(roh: Record<string, unknown>) {
  return { ref: "FIAON-IA-AMUSTER", fassung: SA.KAPITAL_FASSUNG, kunde: FIRMA, buergin: BUERGIN as any, parameter: SA.kapitalParameterAus(roh as any), compliance: null, gueltigBis: "2026-11-30" };
}
function bDaten(roh: Record<string, unknown>) {
  return { ref: "FIAON-IA-BMUSTER", fassung: SB.BEGLEIT_FASSUNG, kunde: KUNDE_B, parameter: SB.begleitParameterAus(roh as any), gueltigBis: "2026-11-30" };
}
const neu = (roh: Record<string, unknown> = {}) => Q.neuesAngebotParameter(roh);

// Vorgabe und Wahl
ok(neu({}).bundesstaat === "Delaware" && neu({}).staatenFassung === "E-465", "neues Angebot ohne Angabe → Delaware, E-465");
ok(neu({ bundesstaat: "FL" }).bundesstaat === "Florida" && neu({ bundesstaat: "wyoming" }).bundesstaat === "Wyoming", "Wahl Florida/Wyoming (Kürzel/Kleinschreibung)");
ok(SC.kapitalCParameterFehler(cDaten(neu({ bundesstaat: "Nevada" })).parameter)?.includes("Delaware, Florida oder Wyoming"), "Fassung C: Nevada abgewiesen");
ok(SA.kapitalParameterFehler(SA.kapitalParameterAus(neu({ bundesstaat: "Texas" }) as any))?.includes("Delaware, Florida oder Wyoming"), "Kapital A/B: Texas abgewiesen");
ok(SB.begleitParameterFehler(SB.begleitParameterAus(neu({ bundesstaat: "NV" }) as any))?.includes("Delaware, Florida oder Wyoming"), "Begleit: Nevada abgewiesen");
ok(SC.kapitalCParameterFehler(cDaten({ bundesstaat: "Texas" }).parameter) === null, "Bestand (ohne E-465) wird nie nachträglich abgewiesen");

// Fassung C
for (const [staat, dauer, satz, jahr] of [
  ["Delaware", "Woche eins bis zwei", "ein bis zwei Werktagen", "(Annual Tax)"],
  ["Florida", "Woche eins bis vier", "rund zwei Wochen", "(Annual Report)"],
  ["Wyoming", "Woche eins bis zwei", "rund drei Werktagen", "(Annual Report mit License Tax)"],
] as const) {
  const d = cDaten(neu({ bundesstaat: staat }));
  const s = SC.kapitalCSeite(d as any); const sT = JSON.stringify(s); const v = SC.kapitalCRumpfHtml(d as any, null);
  ok(sT.includes(`"dauer":"${dauer}"`) && sT.includes(satz), `Fassung C ${staat}: Fahrplan „${dauer}“ und Eintragungssatz`);
  ok(v.includes(`nach dem Recht des Bundesstaats ${staat}`) && v.includes(jahr), `Fassung C ${staat}: Vertrag mit Staat und Jahrespflicht ${jahr}`);
  ok(sT.includes(`im offiziellen Register von ${staat}`), `Fassung C ${staat}: Namensprüfung im Register von ${staat}`);
  ok(W.globalWortPruefen(texte(s).join("\n")).filter((f) => !/Garantie/i.test(f.treffer)).every((f) => !/bis zu|Frist mit Ziffer|empfohl/i.test(f.hinweis)), `Fassung C ${staat}: Seite ohne „bis zu“/Frist mit Ziffer`);
}
ok(!JSON.stringify(SC.kapitalCSeite(cDaten(neu({ bundesstaat: "Delaware" })) as any)).includes("Sunbiz"), "Fassung C Delaware: kein Sunbiz");

// Kapital A/B
for (const [staat, dauer, satz] of [["Delaware", "Woche eins bis zwei", "ein bis zwei Werktagen"], ["Florida", "Woche eins bis vier", "rund zwei Wochen"], ["Wyoming", "Woche eins bis zwei", "rund drei Werktagen"]] as const) {
  const sT = JSON.stringify(SA.kapitalSeite(aDaten(neu({ bundesstaat: staat })) as any));
  ok(sT.includes(`"dauer":"${dauer}"`) && sT.includes(satz) && sT.includes(`Register von ${staat}`), `Kapital A/B ${staat}: Fahrplan, Eintragungssatz, Register`);
  ok(!sT.includes("Florida (Sunbiz)") || staat === "Florida", `Kapital A/B ${staat}: kein Florida-Namenshinweis`);
}
// Begleit
for (const [staat, satz] of [["Delaware", "ein bis zwei Werktagen"], ["Florida", "rund zwei Wochen"], ["Wyoming", "rund drei Werktagen"]] as const) {
  const sT = JSON.stringify(SB.begleitSeite(bDaten(neu({ bundesstaat: staat })) as any));
  ok(sT.includes(satz) && !sT.includes("Florida trägt in der Regel innerhalb weniger Tage ein") && sT.includes(`Register von ${staat}`), `Begleit ${staat}: ehrliche Zeit, kein alter Florida-Satz`);
}

// ═══ 5 BESTAND (ohne staatenFassung) ═══════════════════════════════════════════
abschnitt("5 Bestand: Texte wie vor E-465");
{
  const d = cDaten({ bundesstaat: "Florida" });
  ok(d.parameter.staatenFassung === "", "Fassung C Bestand: keine Staaten-Fassung");
  const sT = JSON.stringify(SC.kapitalCSeite(d as any)); const v = SC.kapitalCRumpfHtml(d as any, null);
  ok(sT.includes('"dauer":"Woche eins"') && sT.includes("nach unserem Plan in Woche eins oder zwei") && sT.includes("im Register von Florida;"), "Fassung C Bestand: Fahrplan, Plan und Namenshinweis wie vorher");
  ok(v.includes("die erste Jahresmeldung der Gesellschaft beim Bundesstaat (Annual Report) einschließlich der Staatsgebühr"), "Fassung C Bestand: Vertrag Ziffer 2 wortgleich");
  ok(!sT.includes("trägt derzeit langsamer") && !sT.includes("Express des Staats"), "Fassung C Bestand: keine neuen Sätze");
}
{
  const sT = JSON.stringify(SA.kapitalSeite(aDaten({ bundesstaat: "Florida" }) as any));
  ok(sT.includes('"dauer":"Woche eins"') && sT.includes("Ihre US-Gesellschaft — in der ersten Woche") && sT.includes("Register von Florida (Sunbiz)") && sT.includes("Unser Plan: Woche eins die LLC"), "Kapital A/B Bestand: wie vorher");
  const sB = JSON.stringify(SB.begleitSeite(bDaten({ bundesstaat: "Florida" }) as any));
  ok(sB.includes("Florida trägt in der Regel innerhalb weniger Tage ein") && sB.includes('"dauer":"Woche eins bis zwei"'), "Begleit Bestand: wie vorher (Text bleibt, Prüfsumme bleibt)");
}

console.log(`\n${gut} grün, ${rot.length} rot.`);
process.exit(rot.length ? 1 : 0);
