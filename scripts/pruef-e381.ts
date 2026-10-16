// Prüfstand E-381 (15.10.2026): Einstieg aus dem Ratgeber — „Erst Ihre Bonität. Dann Ihre Karte."
// Offline: Regeln (shared/fiaon-antrag-einstieg.ts), Wortwand, Quelltext-Belege. Aufruf:
//   env -i HOME=$HOME PATH=… DATABASE_URL=postgresql://pruef@127.0.0.1:9/keine node_modules/.bin/tsx scripts/pruef-e381.ts
import { readFileSync } from "node:fs";

let gut = 0, schlecht = 0;
function ok(b: unknown, was: string, extra = "") { if (b) { gut++; console.log(`  ✓ ${was}`); } else { schlecht++; console.log(`  ✗ ${was}${extra ? ` — ${extra}` : ""}`); } }

async function main() {
  const E = await import("../shared/fiaon-antrag-einstieg");
  const P = await import("../shared/fiaon-antrag-neu");
  const W = await import("../shared/fiaon-wortverbote");

  console.log("── 1 · Thema → Einstieg");
  ok(E.einstiegAusThema("score") === "bonitaet" && E.einstiegAusThema("auskunft") === "bonitaet" && E.einstiegAusThema("grundlagen") === "bonitaet", "Score, Auskunft, Grundlagen → Bonität zuerst");
  ok(E.einstiegAusThema("at") === "bonitaet" && E.einstiegAusThema("ch") === "bonitaet", "Österreich/Schweiz → Bonität zuerst");
  ok(E.einstiegAusThema("eintraege") === "eintraege" && E.einstiegAusThema("inkasso") === "eintraege", "Einträge, Inkasso → Einträge zuerst");
  ok(E.einstiegAusThema("karte") === null && E.einstiegAusThema("kredit") === null, "Karte, Kredit → wie heute (Karten-Einstieg)");
  ok(E.einstiegAusThema("firmen") === null && E.einstiegAusThema("") === null && E.einstiegAusThema(undefined) === null, "Firmen und ohne Thema → wie heute");
  ok(E.themaSauber("Score") === "score" && E.themaSauber("<script>") === "" && E.themaSauber("erfunden") === "", "nur bekannte Kategorien aus der Adresse");
  ok(E.artikelSauber("neue-scoring-regeln-2026") === "neue-scoring-regeln-2026" && E.artikelSauber("a b") === "" && E.artikelSauber("x\"><") === "", "nur saubere Slugs aus der Adresse");

  console.log("── 2 · Der Link aus dem Ratgeber");
  ok(E.antragLinkAusRatgeber("score", "neue-scoring-regeln") === "/antrag?thema=score&artikel=neue-scoring-regeln", "Score-Artikel → /antrag mit Thema und Artikel (über die Weiche)");
  ok(E.antragLinkAusRatgeber("karte", "x-y") === "/antrag?thema=karte&artikel=x-y", "Karten-Artikel: Thema mit, Einstieg bleibt die Karte");
  ok(E.antragLinkAusRatgeber("unbekannt", "x") === "/antrag" && E.antragLinkAusRatgeber(undefined, undefined) === "/antrag", "ohne gültiges Thema → /antrag wie bisher");

  console.log("── 3 · Paketwahl: dieselben Leistungen, Bonität zuerst");
  for (const p of P.ANTRAG_NEU_PAKETE) {
    const neu = E.leistungenFuerEinstieg(p.leistungen, "bonitaet");
    ok(neu.length === p.leistungen.length && neu.every((l) => p.leistungen.includes(l)), `${p.name}: nichts dazu, nichts weg`);
    ok(/Bonitätsauswertung|Bonitätsauskunft|Datenkopie/.test(neu[0]), `${p.name}: erster Punkt ist die Bonität`);
    ok(JSON.stringify(E.leistungenFuerEinstieg(p.leistungen, null)) === JSON.stringify(p.leistungen), `${p.name}: ohne Einstieg unverändert`);
  }
  ok(E.einstiegPaketZeile("Neue Scoring-Regeln ab 20. November 2026").includes("„Neue Scoring-Regeln ab 20. November 2026“"), "Paket-Zeile nennt den Artikel");
  ok(/unseren Ratgeber/.test(E.einstiegPaketZeile("")), "ohne Titel: allgemeiner Satz");

  console.log("── 4 · Wortwand und Verkaufsregel");
  const texte = [...Object.values(E.EINSTIEG_TEXT).flatMap((t) => [t.titel, t.lead, t.knopf]), E.EINSTIEG_KNOPF_ZUSATZ, E.einstiegPaketZeile("Titel")];
  const treffer = texte.flatMap((t) => W.wandPruefen(t).filter((f: any) => f.art === "verboten").map((f: any) => `${t}: ${f.treffer}`));
  ok(treffer.length === 0, "kein Wort der Hauswand in den neuen Texten", treffer.join(" | "));
  ok(texte.every((t) => !/keine Bank|Partnerbank entscheidet|Garantie|garantiert|löschen/i.test(t)), "kein Bank-Vorbehalt, keine Garantie, kein Löschversprechen (E-373)");
  ok(Object.values(E.EINSTIEG_TEXT).every((t) => /Dann Ihre Karte\./.test(t.titel) && /Visa-Kreditkarte/.test(t.lead)), "die Karte bleibt das Ziel in jedem Einstieg");

  console.log("── 5 · Quelltext: angeschlossen, /start unberührt");
  const lies = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  const lese = lies("client/src/components/site/LeseAufruf.tsx");
  const art = lies("client/src/pages/site/ratgeber-artikel.tsx");
  const name = lies("client/src/pages/antrag-neu/schritte-angaben.tsx");
  const paket = lies("client/src/pages/antrag-neu/schritte-abschluss.tsx");
  const index = lies("client/src/pages/antrag-neu/index.tsx");
  ok(/href=\{antragLinkAusRatgeber\(kategorie, slug\)\}/.test(lese) && !/href="\/antrag">\s*Konto eröffnen/.test(lese), "Lese-Aufruf: Knopf mit Thema");
  ok(/<LeseAufruf kategorie=\{a\.kategorie\} slug=\{a\.slug\} \/>/.test(art) && (art.match(/href=\{antragLink\}/g) ?? []).length >= 2, "Artikel: alle Antrag-Knöpfe mit Thema");
  ok(/EINSTIEG_TEXT\[einstieg\]\.titel : "Ihre Karte\. Ihr Name\."/.test(name), "Antrag: erster Bildschirm wählt die Überschrift nach Einstieg, sonst wie heute");
  ok(/einstiegPaketZeile\(S\.einstiegTitel\)/.test(paket), "Paketwahl: Zeile für Ratgeber-Leser");
  ok(/themaSauber\(q\.get\("thema"\)\)/.test(index) && /"einstieg"/.test(index), "Antrag liest das Thema aus der Adresse und misst den Einstieg");
  const start = lies("client/src/pages/start.tsx");
  ok(!/fiaon-antrag-einstieg/.test(start), "/start unberührt");

  console.log(`\n${schlecht ? "✗" : "✓"} ${gut}/${gut + schlecht} Prüfungen bestanden (offline)`);
  process.exit(schlecht ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
