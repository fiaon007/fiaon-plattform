// ═══════════════════════════════════════════════════════════════════════════
// Prüfstand E-531 (25.11.2026): Privat-Ratgeber aus — der KI-Tagesartikel entsteht nur noch für Business.
// Die Privat-Artikel bleiben online (Seiten, Sitemap, Links lesen weiter BEREICHE). Offline: kein Netz, keine DB.
//
//   A  shared: BEREICHE unverändert, TAGESARTIKEL_BEREICHE = Business, hatTagesartikel.
//   B  Redaktion (rein): tageslaufBereiche, tagFertig, naechsterLauf mit tagFertig.
//   C  ratgeberLaufPruefen: Privat fehlt → kein Fehler (Ampel bleibt grün), Business fehlt → Fehler,
//      die Lauf-Meldung nennt Privat nicht mehr als „erschienen“.
//   D  Quelltext-Wand: Tageslauf nimmt tageslaufBereiche, Takt ohne Vorgabe, Seiten und Sitemap zeigen weiter alles.
//
// Aufruf:
//   env -i PATH="$PATH" HOME="$HOME" TZ=Europe/Berlin DATABASE_URL=postgresql://pruef@127.0.0.1:9/keine \
//     ./node_modules/.bin/tsx scripts/pruef-e531-ratgeber.ts
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from "node:fs";

let gut = 0, schlecht = 0;
function ok(b: unknown, was: string, info = "") { if (b) { gut++; console.log(`  ✓ ${was}`); } else { schlecht++; console.log(`  ✗ ${was}${info ? ` — ${info}` : ""}`); } }
const gruppe = (t: string) => console.log(`\n── ${t}`);
const gleich = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const wirft = (fn: () => unknown): string => { try { fn(); return ""; } catch (x: any) { return String(x?.message ?? x); } };

async function main() {
  const sh = await import("../shared/fiaon-ratgeber");
  const r = await import("../server/lib/fiaon-ratgeber-redaktion");
  const { laufMeldung, LAUF_FOLGEN } = await import("../server/lib/fiaon-crons");

  // ═══ A. SHARED ════════════════════════════════════════════════════════════
  gruppe("A Bereiche (shared/fiaon-ratgeber.ts)");
  ok(gleich(sh.BEREICHE, ["privat", "business"]), "BEREICHE unverändert — Seiten, Routen und Redaktion kennen beide Bereiche");
  ok(gleich(sh.TAGESARTIKEL_BEREICHE, ["business"]), "TAGESARTIKEL_BEREICHE = nur Business");
  ok(sh.hatTagesartikel("business") && !sh.hatTagesartikel("privat"), "hatTagesartikel: Business ja, Privat nein");
  ok(sh.BEREICH_LABEL.privat === "Privat" && sh.BEREICH_LABEL.business === "Business", "Labels beider Bereiche bleiben");

  // ═══ B. REDAKTION (REIN) ══════════════════════════════════════════════════
  gruppe("B Welche Bereiche der Tageslauf schreibt");
  ok(gleich(r.tageslaufBereiche(), ["business"]), "ohne Vorgabe: nur Business");
  ok(gleich(r.tageslaufBereiche(null), ["business"]), "null wie ohne Vorgabe");
  ok(gleich(r.tageslaufBereiche("privat"), ["privat"]), "nurBereich privat (Prüfstand, gezielter Aufruf) bleibt möglich");
  const kopie = r.tageslaufBereiche(); kopie.push("privat");
  ok(gleich(sh.TAGESARTIKEL_BEREICHE, ["business"]) && gleich(r.tageslaufBereiche(), ["business"]), "Rückgabe ist eine Kopie — die Liste bleibt unberührt");
  const stand = (privat: boolean, business: boolean) => ({ privat: { erledigt: privat }, business: { erledigt: business } });
  ok(r.tagFertig(stand(false, true)), "Business erschienen, Privat nicht → Tag fertig");
  ok(!r.tagFertig(stand(true, false)), "Privat erschienen, Business nicht → Tag nicht fertig");
  ok(!r.tagFertig(stand(false, true), sh.BEREICHE) && r.tagFertig(stand(true, true), sh.BEREICHE), "mit beiden Bereichen als Vorgabe zählt auch Privat");
  ok(r.tagFertig({}, []), "leere Liste (Tagesartikel ganz aus) → fertig");
  const nl = r.naechsterLauf(new Date("2026-11-25T10:00:00Z"), new Date("2026-11-25T09:40:00Z"), r.tagFertig(stand(false, true)));
  ok(nl.toISOString() === "2026-11-26T05:00:00.000Z", `Business fertig, Privat leer → nächster Lauf morgen 06:00 MEZ (${nl.toISOString()})`);
  const offen = r.naechsterLauf(new Date("2026-11-25T10:00:00Z"), new Date("2026-11-25T09:50:00Z"), r.tagFertig(stand(true, false)));
  ok(offen.toISOString() === "2026-11-25T10:20:00.000Z", `Business offen → letzter Beginn + 30 Minuten (${offen.toISOString()})`);

  // ═══ C. TAKT-PRÜFUNG (AMPEL) ══════════════════════════════════════════════
  gruppe("C ratgeberLaufPruefen — die Ampel „ratgeber-tagesartikel“");
  const lauf = (x: Record<string, unknown> = {}): any => ({ tag: "2026-11-25", faellig: true, geprueft: ["business"], fehlt: [], veroeffentlicht: 1, bereiche: [], grund: null, ...x });
  const p1 = r.ratgeberLaufPruefen(lauf());
  ok(p1.business === 1 && p1.privat === null && p1.veroeffentlicht === 1, `Business erschienen, Privat nicht geprüft → Erfolg, privat = null (${JSON.stringify(p1)})`);
  const m1 = JSON.parse(String(laufMeldung("ratgeber-tagesartikel", p1) ?? "{}"));
  ok(!("privat" in m1) && m1.business === 1 && m1.veroeffentlicht === 1, `Lauf-Meldung ohne Privat (${JSON.stringify(m1)})`);
  const f2 = wirft(() => r.ratgeberLaufPruefen(lauf({ fehlt: ["business"], veroeffentlicht: 0, grund: "Business: deckel" })));
  ok(/Tagesartikel fehlt für 2026-11-25: Business/.test(f2) && !/Privat/.test(f2), `Business fehlt → Fehler in der Historie (${f2.slice(0, 80)})`);
  ok(wirft(() => r.ratgeberLaufPruefen(lauf({ faellig: false, tag: "2026-11-24", veroeffentlicht: 0, grund: "vor 06:00" }))) === "", "vor 06:00, Business-Vortag erfüllt → Erfolg");
  const p3 = r.ratgeberLaufPruefen(lauf({ geprueft: ["privat", "business"], veroeffentlicht: 2 }));
  ok(p3.privat === 1 && p3.business === 1, "beide geprüft und erschienen → je 1");
  ok(/Privat/.test(wirft(() => r.ratgeberLaufPruefen(lauf({ geprueft: ["privat"], fehlt: ["privat"], veroeffentlicht: 0 })))), "gezielt Privat geprüft und leer → weiter ein Fehler");
  const ohne = lauf(); delete ohne.geprueft;
  const p4 = r.ratgeberLaufPruefen(ohne);
  ok(p4.business === 1 && p4.privat === null, "ohne Feld „geprueft“: es gelten die Tagesartikel-Bereiche");

  // ═══ D. QUELLTEXT-WAND ════════════════════════════════════════════════════
  gruppe("D Quelltext-Wand");
  const lies = (p: string) => readFileSync(p, "utf8");
  const red = lies("server/lib/fiaon-ratgeber-redaktion.ts");
  const lauftext = red.slice(red.indexOf("export async function tagesartikelLauf"), red.indexOf("export function ratgeberLaufPruefen"));
  ok(lauftext.length > 500 && /const bereiche = tageslaufBereiche\(opt\.nurBereich\);/.test(lauftext), "der Tageslauf nimmt tageslaufBereiche(opt.nurBereich)");
  ok(!/(?<![A-Z_])BEREICHE\b/.test(lauftext), "im Tageslauf steht BEREICHE (beide) nicht mehr");
  const rueckgaben = lauftext.match(/return \{[^}]*\}/g) || [];
  ok(rueckgaben.length >= 5 && rueckgaben.every((x) => /geprueft: bereiche/.test(x)), `jede Rückgabe des Tageslaufs nennt die geprüften Bereiche (${rueckgaben.length})`);
  const route = lies("server/routes/fiaon-ratgeber.ts");
  ok(/ratgeberLaufPruefen\(await tagesartikelLauf\(\)\)/.test(route), "der Takt ruft den Tageslauf ohne Vorgabe (= nur Business)");
  ok(/tageslauf\('ratgeber-tagesartikel',\s*async \(\) => await fiaonRatgeber\.ratgeberTageslaufStreng\(\)/.test(lies("server/routes.ts")), "der Takt bleibt registriert (Name unverändert)");
  ok(!!LAUF_FOLGEN["ratgeber-tagesartikel"]?.folge, "die Ampel kennt den Lauf weiter (LAUF_FOLGEN)");
  ok(/v === "privat" \|\| v === "business"/.test(route), "öffentliche Liste nimmt weiter ?bereich=privat");
  const sitemap = route.slice(route.indexOf("export async function sitemapXml"));
  ok(/FROM fiaon_ratgeber WHERE status = 'veroeffentlicht' ORDER BY/.test(sitemap) && !/bereich\s*=/.test(sitemap.slice(0, sitemap.indexOf("const adresse"))), "Sitemap: alle veröffentlichten Artikel, Privat eingeschlossen");
  ok(/bereich=privat/.test(lies("client/src/pages/site/ratgeber.tsx")), "/ratgeber holt weiter die Privat-Artikel");

  console.log(`\n${schlecht ? "✗" : "✓"} ${gut}/${gut + schlecht} Prüfungen bestanden (offline)`);
  process.exit(schlecht ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
