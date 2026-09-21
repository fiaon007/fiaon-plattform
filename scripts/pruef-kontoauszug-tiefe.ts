// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND TIEFENANALYSE (21.09.2026, E-207) — ohne Netz, ohne DB
//
// Ein erfundener Auszug über drei Monate (Namen erfunden) mit allem, was die
// Tiefenanalyse beantworten muss: Wer zahlt wann wie viel ein, wer bekommt
// wann wie viel und wofür, was sind die größten Posten, was lässt sich sofort
// sparen. Dazu die Fallen: PayPal mit Netflix im Zweck, zwei Schreibweisen
// derselben Firma, zwei verschiedene Stadtwerke, Spartöpfe, Kreditkarten-
// abrechnung, Rücklastschrift, Buchungen außerhalb des gedruckten Zeitraums.
//
//   npx tsx scripts/pruef-kontoauszug-tiefe.ts
// ═══════════════════════════════════════════════════════════════════════════
import { tiefenanalyse, zuordnen, markeIn, zweckKurz, type TiefeBuchung } from "../shared/fiaon-kontoauszug-tiefe";
import { buchungenBereinigen } from "../shared/fiaon-kontoauszug-bereinigen";
import { wandPruefen } from "../shared/fiaon-wortverbote";
import { readFileSync } from "node:fs";

let geprueft = 0, fehler = 0;
function ok(bed: unknown, text: string) {
  geprueft++;
  if (bed) console.log(`  ✓ ${text}`); else { fehler++; console.log(`  ✗ ${text}`); }
}
const B = (datum: string, euro: number, empfaenger: string, zweck: string, kategorie: string, wiederkehrend = false, saldo: number | null = null): TiefeBuchung =>
  ({ datum, betragCents: Math.round(euro * 100), empfaenger, zweck, kategorie, wiederkehrend, saldoDanachCents: saldo == null ? null : Math.round(saldo * 100) });

const roh: TiefeBuchung[] = [];
for (const [m, lohn] of [["06", 2350], ["07", 2350], ["08", 2410]] as const) {
  roh.push(B(`2026-${m}-28`, lohn, "Muster Logistik GmbH", `Lohn/Gehalt ${m}/2026 Personalnr 4711`, "gehalt", true));
  roh.push(B(`2026-${m}-10`, 255, "Familienkasse Niedersachsen-Bremen", `Kindergeld KG 123 ${m}/2026`, "sozialleistung", true));
  roh.push(B(`2026-${m}-01`, -780, "Privatperson", "Miete Wohnung EG links", "miete", true));
  roh.push(B(`2026-${m}-02`, -64.99, "Telefonica Germany GmbH & Co. OHG", "Rechnung Mobilfunk", "telefon_internet", true));
  roh.push(B(`2026-${m}-15`, -39.99, "TELEFONICA GERMANY", "DSL Vertrag", "telefon_internet", true));
  roh.push(B(`2026-${m}-05`, -13.99, "PayPal Europe S.a.r.l.", "PP.1234.PP NETFLIX.COM Abo", "abo_medien", true));
  roh.push(B(`2026-${m}-06`, -10.99, "Spotify AB", "Spotify Premium", "abo_medien", true));
  roh.push(B(`2026-${m}-07`, -4.99, "Apple.com/bill", "iCloud+", "abo_medien", true));
  roh.push(B(`2026-${m}-12`, -89, "Stadtwerke Hannover AG", "Abschlag Strom", "energie", true));
  roh.push(B(`2026-${m}-20`, -45, "Klarna Bank AB", "Rate Bestellung 88", "kredit_rate", true));
  roh.push(B(`2026-${m}-03`, -25, "Toto-Lotto Niedersachsen", "Spielschein", "gluecksspiel"));
  roh.push(B(`2026-${m}-17`, -18, "Toto-Lotto Niedersachsen", "Spielschein", "gluecksspiel"));
  roh.push(B(`2026-${m}-30`, -9.8, "Sparkasse", "Abschluss Sollzinsen Dispo", "gebuehren"));
  roh.push(B(`2026-${m}-30`, -6.95, "Sparkasse", "Kontoführung Grundpreis", "gebuehren"));
  roh.push(B(`2026-${m}-14`, -32.5, "Lieferando.de", "Bestellung", "freizeit"));
  roh.push(B(`2026-${m}-21`, -28.4, "Lieferando.de", "Bestellung", "freizeit"));
  roh.push(B(`2026-${m}-09`, -61.2, "REWE Markt GmbH", "REWE SAGT DANKE 44", "lebensmittel"));
  roh.push(B(`2026-${m}-23`, -54.8, "REWE", "Einkauf", "lebensmittel"));
  roh.push(B(`2026-${m}-11`, -150, "Geldautomat", "Bargeldauszahlung", "bargeld"));
  roh.push(B(`2026-${m}-25`, -200, "Pocket", "To pocket EUR Rainy Day from EUR", "sonstige_ausgabe"));
  roh.push(B(`2026-${m}-26`, 120, "Pocket", "Auszahlung bei Pocket", "sonstige_einnahme"));
  roh.push(B(`2026-${m}-24`, -310, "American Express", "Kreditkartenabrechnung", "sonstige_ausgabe"));
}
roh.push(B("2026-07-16", -67.2, "PRA Group Deutschland", "Rate Forderung 5566", "kredit_rate"));
roh.push(B("2026-08-16", -67.2, "PRA Group Deutschland", "Rate Forderung 5566", "kredit_rate"));
roh.push(B("2026-07-18", -120, "Stadtwerke München", "Nachzahlung alte Wohnung", "energie"));
roh.push(B("2026-06-19", -45, "Klarna Bank AB", "Rate Bestellung 88", "kredit_rate"));
roh.push(B("2026-06-21", 45, "Klarna Bank AB", "Rücklastschrift mangels Deckung", "ruecklastschrift"));
roh.push(B("2026-06-21", -3.5, "Sparkasse", "Entgelt Rücklastschrift", "gebuehren"));
roh.push(B("2026-07-04", 23.99, "Temu", "Erstattung", "freizeit"));
// Saldo für den Monatsverlauf
roh.push(B("2026-06-27", -1, "Sparkasse", "Porto", "gebuehren", false, -412.5));
roh.push(B("2026-07-27", -1, "Sparkasse", "Porto", "gebuehren", false, -128.3));

const P = { vorname: "Max", nachname: "Mustermann" };
const bereinigt = buchungenBereinigen(roh.map((b) => ({ ...b, wiederkehrend: !!b.wiederkehrend, saldoDanachCents: b.saldoDanachCents ?? null })), P);
const t = tiefenanalyse(bereinigt, { zeitraumVon: "2026-06-01", zeitraumBis: "2026-08-31" })!;

console.log("── Zeitraum und Kennzahlen ────────────────────────────────────────");
ok(t && t.zeitraum.von === "2026-06-01" && t.zeitraum.bis === "2026-08-31" && t.zeitraum.monate.length === 3, `Zeitraum 01.06.–31.08., drei Monate (${t?.zeitraum.monate.join(", ")})`);
ok(Math.abs(t.zeitraum.monatsFaktor - 3) < 0.05, `Monatsfaktor ≈ 3 (${t.zeitraum.monatsFaktor})`);
ok(t.kennzahlen.einkommenJeMonatCents === Math.round((2350 + 2350 + 2410 + 3 * 255) * 100 / (92 / 30.4375)), `Einkommen je Monat aus Lohn + Kindergeld (${t.kennzahlen.einkommenJeMonatCents})`);
ok(t.kennzahlen.umbuchungenAusCents === 60000 && t.kennzahlen.umbuchungenEinCents === 36000, "Spartöpfe getrennt als Umbuchungen, nicht als Ausgabe/Einnahme");

console.log("── Was verdient er wann? ──────────────────────────────────────────");
const lohn = t.einkommen[0];
ok(lohn.name === "Muster Logistik GmbH" && lohn.monatlich && lohn.tagImMonat === 28, `Lohn: monatlich um den 28. (${lohn.name}, ${lohn.rhythmus})`);
ok(lohn.monate["2026-08"] === 241000 && lohn.anzahl === 3, "Lohn je Monat einzeln (August 2.410 €)");
const kg = t.einkommen.find((p) => p.name === "Familienkasse");
ok(!!kg && kg.monatlich && kg.tagImMonat === 10, `Kindergeld als eigene Quelle am 10. (${kg?.rhythmus})`);
ok(t.zahltag?.tag === 28 && /28\./.test(t.zahltag.text), `Zahltag nach dem Lohn (${t.zahltag?.text})`);
ok(t.weitereEingaenge.some((p) => p.name === "Temu" && p.kategorie === "erstattung"), "Erstattung erscheint unter weiteren Eingängen, nicht als Einkommen");

console.log("── Wann gibt er wie viel wofür wo aus? ────────────────────────────");
const tel = t.ausgaben.filter((p) => p.kategorie === "telefon_internet");
ok(tel.length === 1 && tel[0].name === "o2 / Telefónica" && tel[0].anzahl === 6, `Zwei Schreibweisen von Telefónica → ein Posten (${tel.map((p) => `${p.name}×${p.anzahl}`).join(", ")})`);
const netflix = t.ausgaben.find((p) => p.name === "Netflix");
ok(!!netflix && netflix.typ === "abo" && netflix.anzahl === 3, "PayPal mit NETFLIX im Zweck → Posten Netflix");
const stadtwerke = t.ausgaben.filter((p) => /stadtwerke/i.test(p.name));
ok(stadtwerke.length === 2, `Stadtwerke Hannover und München bleiben getrennt (${stadtwerke.map((p) => p.name).join(" / ")})`);
const miete = t.ausgaben.find((p) => p.kategorie === "miete");
ok(!!miete && miete.name === "Privatperson · Miete / Wohnen" && miete.monatlich && miete.tagImMonat === 1 && miete.zweck.includes("Miete"), `Miete an Privatperson: monatlich am 1., Zweck sichtbar (${miete?.rhythmus}, „${miete?.zweck}“)`);
const rewe = t.ausgaben.find((p) => p.name === "REWE");
ok(!!rewe && rewe.anzahl === 6 && !rewe.monatlich && /im Monat/.test(rewe.rhythmus), `REWE: sechs Einkäufe, „${rewe?.rhythmus}“`);
ok(t.gruppen[0].name === "Wohnen" && t.gruppen.reduce((s, g) => s + g.anteil, 0) > 0.999, `Gruppen nach Betrag, Anteile summieren auf 100 % (${t.gruppen[0].name})`);
ok(t.ausgaben.find((p) => p.name === "PRA Group Deutschland")?.kategorie === "inkasso_mahnung", "Inkasso als eigener Posten mit Kategorie Inkasso");

console.log("── Höchste Kostenpunkte ───────────────────────────────────────────");
ok(t.kostenpunkte[0].kategorie === "miete", `Größter Kostenpunkt: Miete (${t.kostenpunkte[0].name})`);
ok(!t.kostenpunkte.some((p) => p.typ === "karte"), "Kreditkartenabrechnung ist kein Kostenpunkt (Einzelausgaben stehen auf der Karte)");
ok(t.kostenpunkte[0].anteilEinkommen != null && t.kostenpunkte[0].anteilEinkommen > 0.2 && t.kostenpunkte[0].anteilEinkommen < 0.4, `Anteil der Miete am Einkommen (${Math.round((t.kostenpunkte[0].anteilEinkommen ?? 0) * 100)} %)`);
ok(t.groessteZahlungen[0].betragCents === 78000, "Größte Einzelzahlung: 780 € Miete");

console.log("── Was kann man sofort optimieren? ────────────────────────────────");
const arten = t.tipps.map((x) => x.art);
for (const a of ["dispo", "konto", "ruecklastschrift", "gluecksspiel", "inkasso", "ratenkauf", "abos", "liefer", "karte"]) ok(arten.includes(a), `Punkt „${a}“ erkannt`);
const spiel = t.tipps.find((x) => x.art === "gluecksspiel")!;
ok(spiel.vermeidbar && spiel.jeMonatCents === Math.round((3 * 43) * 100 / (92 / 30.4375)), `Glücksspiel vermeidbar, Betrag je Monat (${spiel.jeMonatCents})`);
const abos = t.tipps.find((x) => x.art === "abos")!;
ok(/Netflix/.test(abos.text) && /Spotify/.test(abos.text) && /Apple/.test(abos.text), `Abos namentlich: ${abos.text}`);
ok(t.tipps.find((x) => x.art === "karte")?.hinweis === true, "Kreditkarte ist Einordnung, kein Sparpunkt");
ok(t.tipps.indexOf(t.tipps.find((x) => x.vermeidbar)!) < t.tipps.indexOf(t.tipps.find((x) => !x.vermeidbar && !x.hinweis)!), "Vermeidbares steht vor dem Rest");
ok(t.kennzahlen.vermeidbarJeMonatCents === t.tipps.filter((x) => x.vermeidbar).reduce((s, x) => s + x.jeMonatCents, 0), "Summe „sofort vermeidbar“ = Summe der vermeidbaren Punkte");
ok(!t.tipps.some((x) => wandPruefen(`${x.titel}. ${x.text}`).some((f) => f.art === "verboten")), "Kein Punkt verletzt die Wortwand (empfehlen, beraten, garantieren …)");

console.log("── Monatsverlauf ──────────────────────────────────────────────────");
ok(t.monatsverlauf.length === 3 && t.monatsverlauf.every((m) => m.voll), "Drei volle Monate");
ok(t.monatsverlauf[0].tiefsterSaldoCents === -41250 && t.monatsverlauf[0].tiefsterSaldoAm === "2026-06-27", "Tiefster Kontostand im Juni mit Datum");
ok(t.monatsverlauf.reduce((s, m) => s + m.einkommenCents, 0) === t.einkommen.reduce((s, p) => s + p.summeCents, 0), "Monatsverlauf und Einkommensquellen ergeben dieselbe Summe");

console.log("── Zweck, Händler, Abos ────────────────────────────────────────────");
ok(zweckKurz("Lastschrift / Kd-Nr.: 12345678, Rg-Nr.: 998877/8, Ihre Tarifrechnung") === "Ihre Tarifrechnung", `Zweck ohne Buchungsart und Nummern („${zweckKurz("Lastschrift / Kd-Nr.: 12345678, Rg-Nr.: 998877/8, Ihre Tarifrechnung")}“)`);
ok(zweckKurz("Kartenzahlung Karte: ******4207 Lidl") === "Lidl", `Kartennummer entfernt („${zweckKurz("Kartenzahlung Karte: ******4207 Lidl")}“)`);
const pp = zuordnen({ empfaenger: "PayPal Europe S.a.r.l.", zweck: "1043. J.P. Morgan Mobility Payments Solutions S.A., Ihr Einkauf bei ARAL Station 123", kategorie: "sonstige_ausgabe" });
ok(pp.name === "Aral", `PayPal mit Marke im Zweck → Marke (${pp.name})`);
const pp2 = zuordnen({ empfaenger: "PayPal Europe S.a.r.l.", zweck: "Ihr Einkauf bei Hoppala Spielwaren GmbH", kategorie: "sonstige_ausgabe" });
ok(pp2.name === "Hoppala Spielwaren (über PayPal)", `PayPal „Ihr Einkauf bei …“ → Händler (${pp2.name})`);
const rl = t.tipps.find((x) => x.art === "ruecklastschrift")!;
ok(rl.anzahl === 1 && rl.vermeidbar, "Rücklastschrift: Anzahl steht dabei, mit Gebühr vermeidbar");
const abgelaufen = tiefenanalyse([
  B("2026-06-05", -13.99, "Netflix", "Abo", "abo_medien", true), B("2026-07-05", -13.99, "Netflix", "Abo", "abo_medien", true), B("2026-08-05", -13.99, "Netflix", "Abo", "abo_medien", true),
  B("2026-06-06", -9.99, "Spotify", "Premium", "abo_medien", true), B("2026-07-06", -9.99, "Spotify", "Premium", "abo_medien", true), B("2026-08-06", -9.99, "Spotify", "Premium", "abo_medien", true),
  B("2026-06-07", -12.99, "DAZN", "Abo", "abo_medien", true),
], { zeitraumVon: "2026-06-01", zeitraumBis: "2026-08-31" })!;
const aboT = abgelaufen.tipps.find((x) => x.art === "abos")!;
ok(!!aboT && aboT.jeMonatCents === 1399 + 999 && !/DAZN/.test(aboT.text) && /13,99 €/.test(aboT.text), `Nur laufende Abos mit Monatspreis (${aboT?.text})`);

console.log("── Zuordnung einzeln ──────────────────────────────────────────────");
ok(markeIn("AMAZON PRIME VIDEO")?.name === "Amazon Prime & Digital" && markeIn("AMAZON EU SARL")?.name === "Amazon", "Amazon Prime (Abo) vor Amazon (Handel)");
ok(markeIn("A1 Telekom Austria")?.name === "A1", "A1 vor Telekom");
ok(markeIn("Uber Eats")?.typ === "liefer" && markeIn("UBER BV")?.name === "Uber", "Uber Eats (Lieferdienst) vor Uber (Fahrt)");
ok(zuordnen({ empfaenger: "PayPal Europe", zweck: "PP.99 ohne Angabe", kategorie: "sonstige_ausgabe" }).name === "PayPal (ohne Händlerangabe)", "PayPal ohne Händler im Zweck bleibt PayPal");
ok(zuordnen({ empfaenger: "Skrill", zweck: "Tipico Einzahlung", kategorie: "sonstige_ausgabe" }).typ === "spiel", "Skrill mit Tipico im Zweck → Glücksspiel");
ok(zuordnen({ empfaenger: "Privatperson", zweck: "Taschengeld", kategorie: "ueberweisung_aus" }).schluessel !== zuordnen({ empfaenger: "Privatperson", zweck: "Miete", kategorie: "miete" }).schluessel, "Privatpersonen nach Kategorie getrennt");
ok(tiefenanalyse([]) === null, "Ohne Buchungen keine Tiefenanalyse");

// ── Optional: echte Auswertungen (nur lokal, nur lesend gezogen) ─────────
const datei = process.argv[2];
if (datei) {
  const zeilen = readFileSync(datei, "utf8").split("\n").filter((l) => l.startsWith("{")).map((l) => JSON.parse(l));
  let n = 0, mitTipps = 0, ohneName = 0, posten = 0, generisch = 0, dauer = 0;
  for (const z of zeilen) {
    const b = (Array.isArray(z.b) ? z.b : []) as any[];
    if (!b.length) continue;
    const start = Date.now();
    const x = tiefenanalyse(buchungenBereinigen(b.map((y) => ({ ...y, wiederkehrend: !!y.wiederkehrend, saldoDanachCents: y.saldoDanachCents ?? null })), { vorname: z.vorname, nachname: z.nachname }));
    dauer = Math.max(dauer, Date.now() - start);
    if (!x) continue;
    n++;
    if (x.tipps.some((y) => !y.hinweis)) mitTipps++;
    posten += x.ausgaben.length;
    generisch += x.ausgaben.filter((p) => p.schluessel.startsWith("g:")).length;
    ohneName += x.ausgaben.filter((p) => !p.name.trim()).length;
  }
  console.log(`\nEchte Auswertungen: ${n} · mit Sparpunkten ${mitTipps} · Ausgabenposten ${posten} (davon nur Kategorie ${generisch}, ohne Namen ${ohneName}) · längste Rechnung ${dauer} ms`);
  ok(ohneName === 0, "Jeder Posten hat einen Namen");
  ok(dauer < 1500, `Rechnung schnell genug für den Browser (${dauer} ms)`);
}

console.log(`\n${fehler === 0 ? "✓" : "✗"} ${geprueft - fehler}/${geprueft} Prüfungen bestanden`);
process.exit(fehler === 0 ? 0 : 1);
