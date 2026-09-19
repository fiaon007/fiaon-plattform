// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: DIE UNTERSEITEN VON FIAON GLOBAL (19.09.2026, E-191)
//
// Ohne Datenbank, ohne Netz, ohne Browser. Geprüft wird das Register
// shared/fiaon-global-seiten — die eine Liste, aus der Seite, Menü, SEO-Kopf,
// FAQ-Daten und Sitemap lesen:
//
//   1. Register: Pfade und Kennungen eindeutig, Stand als Datum (nicht in der
//      Zukunft), Pflichtteile vorhanden, Anker gültig, Pakete aus dem Katalog,
//      Quellen mit https (Wissen-Seiten mindestens zwei).
//   2. Wege: jedes Weiterlesen-, Verzeichnis- und Karten-Ziel existiert; jede
//      Seite passt auf eine Route des Clients (App.tsx); keine Waise.
//      2b. Kein Soft-404 (19.09.2026): Register-Seiten und App-Wege kennt der
//      Server, Müll-Adressen unter /business bekommen 404 mit noindex, und
//      jede /business-Route aus App.tsx ist dem Server bekannt.
//   3. Menü: jeder Eintrag zeigt auf eine Seite, jede Seite (außer den
//      Landingpages) steht im Menü oder wird von einer anderen verlinkt.
//   4. SEO: jede Seite steht in der SEO-Tabelle (server/lib/fiaon-global-seo),
//      Titel ≤ 62 Zeichen, Beschreibung 110–155, FAQ-Daten = sichtbare Fragen,
//      Landingpages noindex, Unterseiten indexierbar.
//   5. Landingpages (Anzeigen): verdichten eine existierende Seite, handeln von
//      Gründung/Steuernummern/Pflichten — kein Kapitalrahmen, keine Karten, kein
//      Kredit (Google-Ads-Richtlinie Finanzdienstleistungen, E-191).
//   6. Privatpersonen: die Seite führt in den Privatauftrag (?art=privat).
//   7. Zwei Welten (19.09.2026, Justin: „Business-Kunden sollen nicht auf die
//      Privatkunden-Seite"): Kein Baustein der Business-Welt verlinkt Themen der
//      Privatkunden-Linie; Kopf und Fuß schalten im Business-Bereich um; der
//      Bereich wird richtig erkannt; die Rechtsseiten der Business-Welt haben
//      ihre Routen VOR /business/:slug.
//
// Die Wortwahl prüft scripts/pruef-wortwand-de.ts (dort stehen seit E-191 auch
// alle Texte dieser Seiten).
//
// Aufruf: npx tsx scripts/pruef-global-seiten.ts        (Exit 1 bei Fehlern)
// ═══════════════════════════════════════════════════════════════════════════
import fs from "fs";
import path from "path";
import { GLOBAL_SEITEN, LANDINGPAGES, globalInhalt, type GlobalBlock, type GlobalSeite } from "../shared/fiaon-global-seiten";
import { seiteUnbekannt, nichtGefundenHtml } from "../server/lib/fiaon-seiten-seo";
import { GLOBAL_MENUE } from "../shared/fiaon-global-menue";
import { globalPaket } from "../shared/fiaon-global";
import { PAKETE } from "../shared/fiaon-pakete";
import { globalStartPfad } from "../shared/fiaon-global-wege";
import { SEO_SEITEN, seoFragen, seoIndexierbar } from "../shared/fiaon-seo-seiten";
import "../server/lib/fiaon-global-seo";
import { istBusinessBereich, mitBereich } from "../client/src/lib/bereich";
import { GLOBAL_WOERTER } from "../client/src/i18n/global";

const HEUTE = "2026-09-19";
let fehler = 0; let geprueft = 0;
const hinweise: string[] = [];
const ok = (bedingung: boolean, was: string) => { geprueft++; if (!bedingung) { fehler++; console.log(`  FEHLER  ${was}`); } };
const abschnitt = (t: string) => console.log(`\n── ${t} ${"─".repeat(Math.max(3, 70 - t.length))}`);

const alle = [...GLOBAL_SEITEN.map((s) => s.pfad), ...LANDINGPAGES.map((l) => l.pfad)];
const seitenPfade = new Set(GLOBAL_SEITEN.map((s) => s.pfad));
// Ziele außerhalb des Registers, auf die eine Unterseite zeigen darf.
const AUSSERHALB = new Set(["/business", "/business/start", "/kontakt", "/datenschutz", "/impressum", "/agb", "/widerrufsbelehrung", "/cookie-einstellungen"]);
const zielDa = (ziel: string) => {
  const basis = ziel.split("#")[0].split("?")[0] || "/business";
  return seitenPfade.has(basis) || AUSSERHALB.has(basis) || !!(SEO_SEITEN as Record<string, unknown>)[basis];
};

// ═══ 1: DAS REGISTER ═════════════════════════════════════════════════════════
abschnitt("Register");
ok(new Set(alle).size === alle.length, `Pfade doppelt: ${alle.filter((p, i) => alle.indexOf(p) !== i).join(", ")}`);
const kennungen = GLOBAL_SEITEN.map((s) => s.kennung);
ok(new Set(kennungen).size === kennungen.length, `Kennungen doppelt: ${kennungen.filter((k, i) => kennungen.indexOf(k) !== i).join(", ")}`);
for (const s of GLOBAL_SEITEN) {
  const w = s.pfad;
  ok(/^\/business\/(wissen\/)?[a-z0-9-]+$/.test(w), `${w}: Pfad passt auf keine Route (/business/:slug oder /business/wissen/:slug)`);
  ok(/^\d{4}-\d{2}-\d{2}$/.test(s.stand) && s.stand <= HEUTE, `${w}: Stand „${s.stand}“ ist kein Datum oder liegt in der Zukunft`);
  ok(!!s.h1.trim() && !!s.lead.trim() && s.kurz.trim().length >= 120, `${w}: H1, Lead oder „Kurz beantwortet“ fehlt/zu kurz`);
  ok(s.blick.length >= 3, `${w}: „Auf einen Blick“ hat nur ${s.blick.length} Zeilen`);
  // Werkzeuge (Paket-Finder) tragen weniger Bausteine; Übersichten (Wissen, Fragen) keine eigene FAQ.
  ok(s.bloecke.length >= (s.art === "werkzeug" ? 2 : 3), `${w}: nur ${s.bloecke.length} Bausteine`);
  ok(s.fragen.length >= 3 || s.art === "hub" || s.pfad === "/business/fragen", `${w}: nur ${s.fragen.length} Fragen`);
  ok(s.weiter.length >= 2, `${w}: nur ${s.weiter.length} Weiterlesen-Ziele`);
  const ids = s.bloecke.map((b) => b.id);
  ok(new Set(ids).size === ids.length, `${w}: Anker doppelt (${ids.join(", ")})`);
  ok(ids.every((id) => /^[a-z0-9-]+$/.test(id) && !["kurz", "fragen"].includes(id)), `${w}: ungültiger oder reservierter Anker (${ids.join(", ")})`);
  ok(globalInhalt(s).length >= 4, `${w}: Inhaltsverzeichnis zu kurz`);
  if (s.paket) ok(!!globalPaket(s.paket), `${w}: Paket ${s.paket} nicht im Katalog`);
  for (const b of s.bloecke) if (b.typ === "paket") ok(!!globalPaket(b.paket), `${w}: Baustein ${b.id} zeigt auf unbekanntes Paket ${b.paket}`);
  for (const q of s.quellen ?? []) ok(/^https:\/\/[^\s]+$/.test(q.url) && !!q.titel.trim(), `${w}: Quelle ohne https-Adresse oder Titel: ${q.titel} ${q.url}`);
  if (s.art === "wissen") ok((s.quellen?.length ?? 0) >= 2, `${w}: Wissen-Seite mit ${s.quellen?.length ?? 0} Quellen`);
}
console.log(`  ${GLOBAL_SEITEN.length} Seiten, ${LANDINGPAGES.length} Landingpages, ${GLOBAL_SEITEN.reduce((n, s) => n + s.fragen.length, 0)} Fragen, ${GLOBAL_SEITEN.reduce((n, s) => n + (s.quellen?.length ?? 0), 0)} Quellen`);

// ═══ 2: WEGE ═════════════════════════════════════════════════════════════════
abschnitt("Wege");
const verlinkt = new Map<string, number>();
const zeige = (von: string, ziel: string, wo: string) => {
  ok(zielDa(ziel), `${von}: ${wo} → ${ziel} existiert nicht`);
  const basis = ziel.split("#")[0].split("?")[0];
  if (basis !== von) verlinkt.set(basis, (verlinkt.get(basis) ?? 0) + 1);
};
const bausteinZiele = (b: GlobalBlock): { ziel: string; wo: string }[] => {
  if (b.typ === "verzeichnis") return b.eintraege.map((e) => ({ ziel: e.pfad, wo: `Verzeichnis ${b.id}` }));
  if (b.typ === "karten") return b.karten.filter((k) => k.pfad).map((k) => ({ ziel: k.pfad!, wo: `Karte „${k.titel}“` }));
  return [];
};
for (const s of GLOBAL_SEITEN) {
  for (const z of s.weiter) zeige(s.pfad, z, "Weiterlesen");
  ok(!s.weiter.includes(s.pfad), `${s.pfad}: verlinkt sich selbst im Weiterlesen`);
  for (const b of s.bloecke) for (const { ziel, wo } of bausteinZiele(b)) zeige(s.pfad, ziel, wo);
}
for (const l of LANDINGPAGES) {
  ok(seitenPfade.has(l.quelle), `${l.pfad}: Quelle ${l.quelle} ist keine Unterseite`);
  ok(/^\/business\/lp\/[a-z0-9-]+$/.test(l.pfad), `${l.pfad}: Pfad passt nicht auf /business/lp/:slug`);
}
const appTsx = fs.readFileSync(path.resolve(import.meta.dirname, "../client/src/App.tsx"), "utf8");
for (const route of ["/business/lp/:slug", "/business/wissen/:slug", "/business/:slug"]) ok(appTsx.includes(`path="${route}"`), `App.tsx: Route ${route} fehlt`);
ok(appTsx.indexOf(`path="/business/start"`) < appTsx.indexOf(`path="/business/:slug"`), "App.tsx: /business/start steht HINTER /business/:slug und würde verschluckt");

// ── 2b: Kein Soft-404 (19.09.2026) ──────────────────────────────────────────
// Unter /business kennt der Server jede Seite; alles andere dort ist 404 mit noindex
// (seiteUnbekannt in server/lib/fiaon-seiten-seo.ts). Vorher: 200 mit dem Startseiten-Kopf.
abschnitt("Wege: kein Soft-404");
const bekannt = (p: string) => !seiteUnbekannt(p);
for (const p of alle) ok(bekannt(p) && bekannt(`${p}/`) && bekannt(p.toUpperCase()), `${p}: Der Server hielte die Seite für unbekannt (404)`);
for (const p of ["/business", "/business/", "/business/start", "/business/auftrag", "/business/auftrag/FG-2026-0001",
  "/en/business", "/en/business/start", "/en/business/auftrag", "/en/business/auftrag/FG-2026-0001"]) ok(bekannt(p), `${p}: App-Weg bekäme 404`);
for (const p of ["/business/gibt-es-nicht", "/business/wissen/gibt-es-nicht", "/business/lp/gibt-es-nicht", "/business/lp",
  "/business/kosten/weiter", "/business/auftrag/FG-2026-0001/weiter", "/business/wp-login.php",
  "/en/business/gibt-es-nicht", "/en/business/us-firmengruendung"]) ok(seiteUnbekannt(p), `${p}: Müll-Adresse bekäme 200 (Soft-404)`);
for (const p of ["/", "/preise", "/gibt-es-nicht", "/business-antrag", "/businessplan", "/en/pricing"]) ok(bekannt(p), `${p}: liegt außerhalb von /business und darf nicht angefasst werden`);
// Jede /business-Route des Clients muss der Server kennen — sonst liefert er für eine Seite,
// die im Browser erscheint, 404. Parameter mit Musterwert (optionale auch ohne); die drei
// :slug-Routen deckt das Register oben ab.
const businessRouten = [...new Set([...appTsx.matchAll(/<Route path="((?:\/en)?\/business(?:\/[^"]*)?)"/g)].map((m) => m[1]))];
for (const r of businessRouten.filter((x) => !x.includes(":slug"))) {
  const beispiele = [r.replace(/:[a-z]+\??/gi, "muster")];
  if (/:[a-z]+\?/i.test(r)) beispiele.push(r.replace(/\/:[a-z]+\?/gi, "").replace(/:[a-z]+/gi, "muster"));
  for (const b of new Set(beispiele)) ok(bekannt(b), `App.tsx: Route ${r}${b !== r ? ` (als ${b})` : ""} bekäme vom Server 404 — öffentliche Seite in die SEO-Tabelle, Formular/Konto in BUSINESS_APP_WEGE (server/lib/fiaon-seiten-seo.ts)`);
}
const html404 = nichtGefundenHtml("/business/gibt-es-nicht") ?? "";
const robots404 = html404.match(/<meta name="robots"[^>]*>/g) ?? [];
ok(robots404.length === 1 && robots404[0] === '<meta name="robots" content="noindex" />', `404-Seite: robots-Angabe ${robots404.join(" ") || "fehlt"}`);
ok(!/rel="canonical"/.test(html404), "404-Seite trägt ein canonical");
ok(html404.includes("<title>Seite nicht gefunden — FIAON</title>"), "404-Seite: Titel fehlt");
ok(html404.includes('<div id="root"></div>'), "404-Seite: SPA-Wurzel fehlt — die Nicht-gefunden-Ansicht des Clients käme nicht");
console.log(`  ${alle.length} Register-Pfade bekannt, ${businessRouten.length} /business-Routen aus App.tsx gegen den Server gehalten`);

// ═══ 3: MENÜ ═════════════════════════════════════════════════════════════════
abschnitt("Menü");
const menuePfade = new Set(GLOBAL_MENUE.map((m) => m.pfad.split("#")[0]));
for (const m of GLOBAL_MENUE) {
  const basis = m.pfad.split("#")[0];
  ok(basis === "/business" || seitenPfade.has(basis), `Menü „${m.titel}“ → ${m.pfad} ist keine Seite`);
  ok(m.titel.length <= 30 && m.text.length <= 52, `Menü „${m.titel}“: Titel oder Zeile zu lang für das Panel`);
}
const reihen = GLOBAL_MENUE.map((m) => `${m.gruppe}:${m.reihe}`);
ok(new Set(reihen).size === reihen.length, `Menü: Reihenfolge doppelt (${reihen.filter((r, i) => reihen.indexOf(r) !== i).join(", ")})`);
for (const s of GLOBAL_SEITEN) {
  const imMenue = menuePfade.has(s.pfad);
  ok(imMenue || (verlinkt.get(s.pfad) ?? 0) > 0, `${s.pfad}: Waise — weder im Menü noch von einer anderen Seite verlinkt`);
  if (!imMenue) hinweise.push(`${s.pfad}: nicht im Menü, ${verlinkt.get(s.pfad) ?? 0}× verlinkt`);
}

// ═══ 4: SEO ═══════════════════════════════════════════════════════════════════
abschnitt("SEO-Tabelle");
const tabelle = SEO_SEITEN as Record<string, any>;
for (const s of GLOBAL_SEITEN) {
  const e = tabelle[s.pfad];
  ok(!!e, `${s.pfad}: fehlt in der SEO-Tabelle`);
  if (!e) continue;
  ok(e.titel === s.seo.titel && e.beschreibung === s.seo.beschreibung, `${s.pfad}: SEO-Eintrag weicht vom Register ab`);
  ok(s.seo.titel.length <= 62, `${s.pfad}: Titel ${s.seo.titel.length} Zeichen (max 62)`);
  ok(s.seo.beschreibung.length >= 110 && s.seo.beschreibung.length <= 155, `${s.pfad}: Beschreibung ${s.seo.beschreibung.length} Zeichen (110–155)`);
  ok(/— FIAON Global$/.test(s.seo.titel), `${s.pfad}: Titel endet nicht auf „— FIAON Global“`);
  ok(seoIndexierbar().some((x: any) => x.pfad === s.pfad), `${s.pfad}: nicht indexierbar (fehlt in der Sitemap)`);
  const faq = seoFragen(s.pfad);
  ok(faq.length === s.fragen.length, `${s.pfad}: FAQ-Daten ${faq.length}, sichtbar ${s.fragen.length}`);
}
const titel = GLOBAL_SEITEN.map((s) => s.seo.titel);
ok(new Set(titel).size === titel.length, `Titel doppelt: ${titel.filter((t, i) => titel.indexOf(t) !== i).join(" | ")}`);
for (const l of LANDINGPAGES) {
  const e = tabelle[l.pfad];
  ok(!!e && /noindex/.test(String(e.robots ?? "")), `${l.pfad}: Landingpage nicht noindex`);
  ok(!seoIndexierbar().some((x: any) => x.pfad === l.pfad), `${l.pfad}: Landingpage steht in der Sitemap`);
}

// ═══ 5: LANDINGPAGES FÜR ANZEIGEN ════════════════════════════════════════════
abschnitt("Landingpages");
const FINANZ = /kapitalrahmen|kreditkarte|firmenkarte|\bkarten?\b|darlehen|\bkredit|finanzierung|kartenleiter/i;
for (const l of LANDINGPAGES) {
  ok(!!globalPaket(l.paket), `${l.pfad}: Paket ${l.paket} nicht im Katalog`);
  ok(l.vorteile.length >= 3 && l.fragen.length >= 3, `${l.pfad}: zu wenige Vorteile oder Fragen`);
  const text = [l.seo.titel, l.seo.beschreibung, l.auge, l.h1, l.h1b ?? "", l.lead, ...l.vorteile, ...l.fragen.flatMap((f) => [f.f, f.a])].join(" \n ");
  const m = text.match(FINANZ);
  ok(!m, `${l.pfad}: Finanzbegriff „${m?.[0]}“ auf einer Anzeigen-Landingpage (Google-Ads-Richtlinie Finanzdienstleistungen)`);
}
// 19.09.2026 (E-192): Die Pakettafeln der Landingpages zeigen nur Name, Dauer und Preis — Überzeile,
// Paketzeile und Leistungsliste sprechen von Karten und Darlehen (Global Banking, Global Kapital).
const lpQuelle = fs.readFileSync(path.resolve(import.meta.dirname, "../client/src/pages/site/global-lp.tsx"), "utf8");
ok(!/\bp\.de\.(marke|fuer|leistungen)\b/.test(lpQuelle) && !/paket\.de\.(marke|fuer|leistungen)\b/.test(lpQuelle), "global-lp.tsx: Pakettafel zeigt Überzeile, Paketzeile oder Leistungen (Finanzbegriffe auf der Anzeigenseite)");

// ═══ 6: PRIVATPERSONEN ═══════════════════════════════════════════════════════
abschnitt("Privatpersonen");
const privat = GLOBAL_SEITEN.find((s) => s.pfad === "/business/privatpersonen") as GlobalSeite | undefined;
ok(!!privat && privat.auftraggeber === "privat", "/business/privatpersonen fehlt oder führt nicht in den Privatauftrag");
ok(globalStartPfad("global_struktur", "de", "privat") === "/business/start?paket=global_struktur&art=privat", `Startpfad privat: ${globalStartPfad("global_struktur", "de", "privat")}`);
ok(globalStartPfad(undefined, "en", "privat") === "/en/business/start?art=privat", `Startpfad privat ohne Paket: ${globalStartPfad(undefined, "en", "privat")}`);
ok(globalStartPfad("global_vip") === "/business/start?paket=global_vip" && globalStartPfad("unbekannt") === "/business/start", "Startpfad ohne Privatperson verändert");
ok(menuePfade.has("/business/privatpersonen"), "Privatpersonen fehlt im Menü");
ok(GLOBAL_SEITEN.filter((s) => s.pfad !== "/business/privatpersonen").some((s) => s.weiter.includes("/business/privatpersonen")), "keine Unterseite verweist auf /business/privatpersonen");

// ═══ 7: ZWEI WELTEN ══════════════════════════════════════════════════════════
abschnitt("Zwei Welten: Business ohne Privatkunden-Themen");
const WURZEL = path.resolve(import.meta.dirname, "..");
const BUSINESS_DATEIEN = [
  "client/src/components/site/GlobalNav.tsx", "client/src/components/site/GlobalFuss.tsx", "client/src/pages/site/business.tsx",
  "client/src/pages/site/global-seite.tsx", "client/src/pages/site/global-lp.tsx", "client/src/pages/site/global-recht.tsx",
  "client/src/pages/business-start.tsx", "client/src/pages/business-auftrag.tsx", "client/src/components/site/GlobalGespraech.tsx",
  "client/src/i18n/global.ts", "client/src/i18n/global-start.ts", "client/src/i18n/global-auftrag.ts", "shared/fiaon-global-menue.ts",
];
const PRIVAT_ZIEL = /href=\{?["'`]\/(?:en\/)?(privatkunden|personal|login|antrag|bonitaet|bonitaetsauskunft|kreditkarte|credit-card|ratgeber|guides|dashboard|mein-bereich|agb|termin|werkzeuge|schufa|kredit|preise|pricing|karriere|team)(?:[/"'`?#]|$)/;
for (const datei of BUSINESS_DATEIEN) {
  const text = fs.readFileSync(path.join(WURZEL, datei), "utf8");
  const m = text.match(PRIVAT_ZIEL);
  ok(!m, `${datei}: verlinkt die Privatkunden-Linie (${m?.[0]})`);
  ok(!/href=\{?["'`]\/["'`]/.test(text), `${datei}: verlinkt die Startseite der Privatkunden („/“)`);
  // Die Wortwand liest nur Textdateien; in JSX stand am 19.09.2026 kurz ein „Empfohlen" (Register E-188: keine Empfehlung).
  ok(!/\bempf(ohlen|ehl\w*)\b/i.test(text), `${datei}: „${text.match(/\bempf(ohlen|ehl\w*)\b/i)?.[0]}“ — FIAON Global spricht keine Empfehlung aus`);
}
for (const s2 of [...GLOBAL_SEITEN, ...LANDINGPAGES] as any[]) {
  const ziele = [...(s2.weiter ?? []), ...((s2.bloecke ?? []) as any[]).flatMap((b: any) => (b.eintraege ?? []).map((e: any) => e.pfad).concat((b.karten ?? []).map((k: any) => k.pfad).filter(Boolean)))];
  const fremd = ziele.filter((z: string) => !/^\/(business|impressum|datenschutz|cookie-einstellungen)/.test(z));
  ok(fremd.length === 0, `${s2.pfad}: verlinkt außerhalb der Business-Welt: ${fremd.join(", ")}`);
}
const glassNav = fs.readFileSync(path.join(WURZEL, "client/src/components/GlassNav.tsx"), "utf8");
const premiumFuss = fs.readFileSync(path.join(WURZEL, "client/src/components/PremiumFooter.tsx"), "utf8");
ok(/useBusinessBereich\(\)/.test(glassNav) && /<GlobalNav \/>/.test(glassNav), "GlassNav.tsx: die Weiche zum Kopf von FIAON Global fehlt");
ok(/useBusinessBereich\(\)/.test(premiumFuss) && /<GlobalFuss \/>/.test(premiumFuss), "PremiumFooter.tsx: die Weiche zur Fußzeile von FIAON Global fehlt");
for (const [pfad, suche, soll] of [["/business", "", true], ["/business/kosten", "", true], ["/business/wissen/form-5472", "", true], ["/en/business", "", true], ["/en/business/start", "", true],
  ["/businessplan", "", false], ["/impressum", "", false], ["/impressum", "?bereich=business", true], ["/zahlung/FIAON-X", "?bereich=business&art=firma", true], ["/", "", false], ["/privatkunden", "?bereich=privat", false]] as const) {
  ok(istBusinessBereich(pfad, suche) === soll, `istBusinessBereich(${pfad}${suche}) ist nicht ${soll}`);
}
ok(mitBereich("/impressum") === "/impressum?bereich=business" && mitBereich("/datenschutz#vi") === "/datenschutz?bereich=business#vi" && mitBereich("/x?a=1") === "/x?a=1&bereich=business", "mitBereich() baut die Adresse falsch");
// Auch das Vorrendering (Weiterlesen, Brotkrumen) bleibt in der Business-Welt — bis 19.09.2026 verwies /en/business auf /preise und /privatkunden.
for (const [pfad, e] of Object.entries(tabelle) as [string, any][]) {
  if (!/^\/(en\/)?business(\/|$)/.test(pfad)) continue;
  for (const eintrag of [e, e.en].filter(Boolean)) {
    const ziele = [...(eintrag.weiter ?? []), ...((eintrag.krumen ?? []) as any[]).map((k) => k.pfad)];
    const fremd = ziele.filter((z: string) => !/^\/(en\/)?(business|impressum|datenschutz|cookie-einstellungen|legal-notice|privacy)/.test(z));
    ok(fremd.length === 0, `SEO ${eintrag.pfad ?? pfad}: Weiterlesen/Brotkrumen führen aus der Business-Welt: ${fremd.join(", ")}`);
  }
}
// Gemeinsame Seiten, aus der Business-Welt geöffnet (?bereich=business), tragen schon im Vorab-HTML den Business-Rahmen
// (server/routes.ts → seitenHtml(pfad, { bereich: "business" })) — ohne Weiterlesen in die Privatkunden-Linie.
{
  const { seitenHtml } = await import("../server/lib/fiaon-seiten-seo");
  const links = (html: string) => [...(html.split('<div class="vorab">')[1] ?? "").matchAll(/<a href="([^"]+)"/g)].map((m) => m[1]);
  const erlaubt = /^(\/(en\/)?(business|impressum|datenschutz|cookie-einstellungen|privacy|legal-notice|cookie-settings)([/?#]|$)|tel:|mailto:|https?:)/;
  for (const pfad of ["/impressum", "/privacy"]) {
    const html = seitenHtml(pfad, { bereich: "business" }) ?? "";
    const fremd = links(html).filter((h) => !erlaubt.test(h));
    ok(html.includes('<nav aria-label="FIAON Global">') && fremd.length === 0, `Vorab-HTML ${pfad}?bereich=business: Business-Rahmen fehlt oder Links in die Privatwelt (${fremd.slice(0, 4).join(", ")})`);
  }
  ok((seitenHtml("/impressum") ?? "").includes('aria-label="Hauptnavigation"'), "Vorab-HTML /impressum ohne ?bereich: der Rahmen der Privatkunden fehlt");
  const routen = fs.readFileSync(path.join(WURZEL, "server/routes.ts"), "utf8");
  ok(routen.indexOf("seitenHtml(req.path, { bereich: 'business' })") > -1 && routen.indexOf("seitenHtml(req.path, { bereich: 'business' })") < routen.lastIndexOf("seitenHtml(req.path"), "routes.ts: der Business-Vorrenderer für ?bereich=business fehlt oder steht hinter dem allgemeinen");
}
// Die 404-Ansicht unter /business führt zu FIAON Global — nie zu Startseite, Login oder „Was ist FIAON?" der Privatkunden.
{
  const nf = fs.readFileSync(path.join(WURZEL, "client/src/pages/not-found.tsx"), "utf8");
  const zweig = nf.slice(nf.indexOf("if (business)"), nf.indexOf("const primary"));
  ok(/istBusinessBereich\(/.test(nf) && zweig.length > 50 && /"\/business"/.test(zweig) && !/"\/(login|was-ist-fiaon)"|href: "\/"/.test(zweig), "not-found.tsx: die 404-Ansicht unter /business führt nicht zu FIAON Global oder in die Privatwelt");
}
// Die Kacheln „Für wen" auf /business führen auf Unterseiten, die es gibt.
for (const k of GLOBAL_WOERTER.de.fuer) ok(!k.pfad || seitenPfade.has(k.pfad), `/business „Für wen": ${k.tag} → ${k.pfad} gibt es nicht`);
for (const [ziel] of GLOBAL_WOERTER.de.fuerLaenderLinks) ok(seitenPfade.has(ziel), `/business „Für wen": ${ziel} gibt es nicht`);
for (const route of ["/business/widerrufsbelehrung", "/business/mustervertrag"]) {
  ok(appTsx.includes(`path="${route}"`) && appTsx.indexOf(`path="${route}"`) < appTsx.indexOf(`path="/business/:slug"`), `App.tsx: Route ${route} fehlt oder steht hinter /business/:slug`);
  ok(/noindex/.test(String(tabelle[route]?.robots ?? "")), `${route}: fehlt in der SEO-Tabelle oder ist nicht noindex`);
}

// ═══ 8: DIE HAUPTSEITE /business ═════════════════════════════════════════════
abschnitt("Hauptseite /business");
// Justins eigener US-Fall steht nie auf der Seite (Entscheidung 17.09.2026) — auch nicht als „Wir sind diesen Weg selbst gegangen".
const EIGENER_FALL = /selbst gegangen|eigene[nr]? US-Gesellschaft, eigene[nr]? Karten|walked this path ourselves/i;
const hubTexte = JSON.stringify([GLOBAL_WOERTER.de, GLOBAL_WOERTER.en, GLOBAL_SEITEN, LANDINGPAGES]);
ok(!EIGENER_FALL.test(hubTexte), `Texte erzählen den eigenen Fall: „${hubTexte.match(EIGENER_FALL)?.[0]}“`);
// Die FAQ stehen als reine Zeichenketten da — nur so liest scripts/seo-fragen-erzeugen.ts sie ins FAQ-Markup.
const hubQuelle = fs.readFileSync(path.join(WURZEL, "client/src/i18n/global.ts"), "utf8");
const faqRoh = [...hubQuelle.matchAll(/\{\s*f:\s*"((?:[^"\\]|\\.)*)",\s*a:\s*"((?:[^"\\]|\\.)*)"/gs)].length;
ok(faqRoh === GLOBAL_WOERTER.de.fragen.length + GLOBAL_WOERTER.en.fragen.length, `i18n/global.ts: ${GLOBAL_WOERTER.de.fragen.length + GLOBAL_WOERTER.en.fragen.length} Fragen, aber nur ${faqRoh} als reine Zeichenkette (fehlen im FAQ-Markup)`);
ok(GLOBAL_WOERTER.de.fragen.length === GLOBAL_WOERTER.en.fragen.length, "/business: deutsche und englische Fragen verschieden viele");
// Preis und Kapitalrahmen im ersten Bildschirm, der Titel nennt den Einstiegspreis aus dem Katalog.
const hubSeite = fs.readFileSync(path.join(WURZEL, "client/src/pages/site/business.tsx"), "utf8");
ok(/globalKapitalSpanne\(s\)/.test(hubSeite.slice(0, hubSeite.indexOf('id="leistungen"'))) && /abPreis/.test(hubSeite.slice(0, hubSeite.indexOf('id="leistungen"'))), "/business: Kapitalrahmen oder Festpreis fehlen im Kopf");
const einstieg = String(Math.round((PAKETE.find((x) => x.key === "global_struktur")?.preisCents ?? 0) / 100).toLocaleString("de-DE"));
ok(GLOBAL_WOERTER.de.metaTitel.includes(einstieg) && String(tabelle["/business"]?.titel).includes(einstieg), `/business: Titel nennt nicht den Einstiegspreis ${einstieg} € (Seite und SEO-Tabelle)`);
ok(GLOBAL_WOERTER.de.metaTitel === tabelle["/business"]?.titel && GLOBAL_WOERTER.en.metaTitel === tabelle["/business"]?.en?.titel, "/business: Titel der Seite und der SEO-Tabelle weichen voneinander ab");

// ═══ ERGEBNIS ═══════════════════════════════════════════════════════════════
abschnitt("Ergebnis");
if (hinweise.length) { console.log("  Hinweise (kein Fehler):"); for (const h of hinweise) console.log(`    · ${h}`); }
console.log(`  ${geprueft} Prüfungen, ${fehler} Fehler.`);
process.exit(fehler ? 1 : 0);
