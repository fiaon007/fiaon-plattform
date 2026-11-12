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
//  13. Ein Produkt (12.11.2026, E-509): Keine Seite, kein Menüpunkt, kein Vorab-HTML und kein Abschnitt von /llms.txt
//      nennt mehr eines der vier Pakete oder einen ihrer Preise; der Paket-Finder leitet dauerhaft auf den Konfigurator.
//  14. Leitplanke (12.11.2026, E-509): Keine Seite, kein Menüpunkt und kein Vorab-HTML bewirbt die Bürgschaft der
//      US-Partnergesellschaft oder nennt ihren Registerstand — beides steht nur im persönlichen Angebot. Wissens-Artikel
//      dürfen das Wort allgemein erklären (Satz für Satz geprüft).
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
// E-509 (12.11.2026): ein Produkt statt vier Pakete — Preis und Texte der Startseite aus der einen Quelle.
import { VERKAUF_TEXTE, VERKAUF_PREISE, verkaufEur } from "../shared/fiaon-global-verkauf";
import { globalStartPfad } from "../shared/fiaon-global-wege";
import { SEO_SEITEN, seoFragen, seoIndexierbar } from "../shared/fiaon-seo-seiten";
import "../server/lib/fiaon-global-seo";
import { istBusinessBereich, mitBereich } from "../client/src/lib/bereich";
import { GLOBAL_WOERTER, GLOBAL_FUSS_WOERTER } from "../client/src/i18n/global";
import { GLOBAL_BUERGSCHAFT_SEITE, GLOBAL_JAHRESBETREUUNG, GLOBAL_KAPITAL_FREI, globalJahresbetreuungPreisText } from "../shared/fiaon-global";
import { GLOBAL_STANDORTE } from "../shared/fiaon-global-partner";
import { GLOBAL_SCHLAGZEILEN } from "../shared/fiaon-global-schlagzeilen";
import { globalWortPruefen, globalWortPruefenEn } from "../shared/fiaon-global-wortregeln";
import { titelPixel, beschreibungPixel, TITEL_MAX_PX, BESCHREIBUNG_MAX_PX } from "../shared/fiaon-pixel";

// 23.09.2026 (E-232): der heutige Tag in Berlin statt eines festen Datums — ein Stand von heute ist kein Fehler.
const HEUTE = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());
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
for (const route of ["/business/lp/:slug", "/business/wissen/:slug", "/business/:slug", "/en/business/knowledge/:slug", "/en/business/:slug"]) ok(appTsx.includes(`path="${route}"`), `App.tsx: Route ${route} fehlt`);
// 24.09.2026 (E-234): die festen englischen Wege VOR /en/business/:slug — sonst schluckt :slug sie.
for (const r of ["/en/business/start", "/en/business/auftrag/:ref?", "/en/business/widerrufsbelehrung", "/en/business/mustervertrag", "/en/business/private-individuals", "/en/business/knowledge/:slug"]) {
  ok(appTsx.includes(`path="${r}"`) && appTsx.indexOf(`path="${r}"`) < appTsx.indexOf(`path="/en/business/:slug"`), `App.tsx: ${r} fehlt oder steht hinter /en/business/:slug`);
}
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
  "/en/business/gibt-es-nicht", "/en/business/us-firmengruendung", "/en/business/wissen/form-5472", "/en/business/knowledge/gibt-es-nicht",
  "/en/business/lp/gruendung", "/business/us-company-formation", "/business/knowledge/form-5472"]) ok(seiteUnbekannt(p), `${p}: Müll-Adresse bekäme 200 (Soft-404)`);
for (const p of ["/", "/preise", "/gibt-es-nicht", "/business-antrag", "/businessplan", "/en/pricing", "/blogger", "/blogs"]) ok(bekannt(p), `${p}: liegt außerhalb von /business und darf nicht angefasst werden`);
// 09.11.2026: alte Adressen aus der Zeit vor FIAON (Google: Soft-404) — FIAON hat keinen /blog.
for (const p of ["/blog", "/blog/", "/blog/hidden-costs-of-operational-inefficiency", "/BLOG/Irgendwas", "/en/blog/x"]) ok(seiteUnbekannt(p), `${p}: alte Adresse bekäme 200 (Soft-404)`);
ok((nichtGefundenHtml("/blog/hidden-costs-of-operational-inefficiency") ?? "Seite nicht gefunden — FIAON<").includes("Seite nicht gefunden — FIAON<"), "/blog/…: Nicht-gefunden-Ansicht von FIAON (nicht FIAON Global)");
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
ok(html404.includes("<title>Seite nicht gefunden — FIAON Global</title>"), "404-Seite: Titel fehlt (unter /business „— FIAON Global“)");
ok((nichtGefundenHtml("/en/business/gibt-es-nicht") ?? "").includes("<title>Page not found — FIAON Global</title>"), "404-Seite /en/business: englischer Titel fehlt");
// „Mein Auftrag" aus der Mail (/business/auftrag/<Ref>?t=…) trägt den Kopf von /business/auftrag, nicht den Standardkopf der Privatkunden.
{
  const { seitenHtml } = await import("../server/lib/fiaon-seiten-seo");
  const mein = seitenHtml("/business/auftrag/FIAON-MUSTER-0001") ?? "";
  ok(mein.includes("<title>Mein Auftrag — FIAON Global</title>") && /noindex/.test(mein.match(/<meta name="robots"[^>]*>/)?.[0] ?? ""), "Mein Auftrag mit Auftragsnummer: Kopf von /business/auftrag fehlt (Titel der Privatkunden in Tab und Linkvorschau)");
}
ok(html404.includes('<div id="root"></div>'), "404-Seite: SPA-Wurzel fehlt — die Nicht-gefunden-Ansicht des Clients käme nicht");
console.log(`  ${alle.length} Register-Pfade bekannt, ${businessRouten.length} /business-Routen aus App.tsx gegen den Server gehalten`);

// ═══ 3: MENÜ ═════════════════════════════════════════════════════════════════
abschnitt("Menü");
const menuePfade = new Set(GLOBAL_MENUE.map((m) => m.pfad.split("#")[0]));
for (const m of GLOBAL_MENUE) {
  const basis = m.pfad.split("#")[0];
  // 29.10.2026 (E-461): Anker der Übersicht stehen auf der Startseite „/“ (Produkt, Jahresbetreuung).
  // E-509 (12.11.2026): „Angebot zusammenstellen“ führt zum Konfigurator /business/start — eine eigene Seite außerhalb
  // des Registers (client/src/pages/site/global-konfigurator.tsx), deshalb hier beim Namen erlaubt.
  ok(basis === "/business" || basis === "/" || basis === "/business/start" || seitenPfade.has(basis), `Menü „${m.titel}“ → ${m.pfad} ist keine Seite`);
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
  // 23.09.2026 (E-232): Google schneidet nach Pixeln ab, nicht nach Zeichen (Arial 20 px ≤ 580, Arial 14 px ≤ 1000; shared/fiaon-pixel.ts).
  ok(titelPixel(s.seo.titel) <= TITEL_MAX_PX, `${s.pfad}: Titel ${titelPixel(s.seo.titel)} px breit (max ${TITEL_MAX_PX}) — Google kürzt ihn`);
  ok(beschreibungPixel(s.seo.beschreibung) <= BESCHREIBUNG_MAX_PX, `${s.pfad}: Beschreibung ${beschreibungPixel(s.seo.beschreibung)} px breit (max ${BESCHREIBUNG_MAX_PX}) — Google kürzt sie`);
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
// 06.10.2026 (E-293): auch das persönliche Angebot mit Bürgschaftszusage gehört nie auf eine Anzeigenseite.
const FINANZ = /kapitalrahmen|kreditkarte|firmenkarte|\bkarten?\b|darlehen|\bkredit|finanzierung|kartenleiter|b(ü|ue)rgschaft|b(ü|ue)rgin|guaranty|surety/i;
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
  // 24.09.2026 (E-234): die englische Vorlage, die Adresspaare und die englischen Registerdateien.
  "client/src/i18n/global-seite.ts", "shared/fiaon-global-pfade.ts",
];
const PRIVAT_ZIEL = /href=\{?["'`]\/(?:en\/)?(privatkunden|personal|login|antrag|bonitaet|bonitaetsauskunft|kreditkarte|credit-card|ratgeber|guides|dashboard|mein-bereich|agb|termin|werkzeuge|schufa|kredit|preise|pricing|karriere|team)(?:[/"'`?#]|$)/;
for (const datei of BUSINESS_DATEIEN) {
  const text = fs.readFileSync(path.join(WURZEL, datei), "utf8");
  const m = text.match(PRIVAT_ZIEL);
  ok(!m, `${datei}: verlinkt die Privatkunden-Linie (${m?.[0]})`);
  // 29.10.2026 (E-461): „/“ ist die Startseite von FIAON Global; die der Privatkunden heißt /privat (nur der leise Weg im Kopf/Fuß, über PRIVAT_START).
  ok(!/href=\{?["'`]\/(en\/)?privat(e)?["'`]/.test(text), `${datei}: verlinkt die Startseite der Privatkunden („/privat“) fest`);
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
  ["/businessplan", "", false], ["/impressum", "", false], ["/impressum", "?bereich=business", true], ["/zahlung/FIAON-X", "?bereich=business&art=firma", true], ["/privatkunden", "?bereich=privat", false],
  // 29.10.2026 (E-461): fiaon.com/ und /en sind FIAON Global, /privat und /en/private die Privat-Welt.
  ["/", "", true], ["/en", "", true], ["/en/", "", true], ["/privat", "", false], ["/en/private", "", false], ["/en/pricing", "", false]] as const) {
  ok(istBusinessBereich(pfad, suche) === soll, `istBusinessBereich(${pfad}${suche}) ist nicht ${soll}`);
}
ok(mitBereich("/impressum") === "/impressum?bereich=business" && mitBereich("/datenschutz#vi") === "/datenschutz?bereich=business#vi" && mitBereich("/x?a=1") === "/x?a=1&bereich=business", "mitBereich() baut die Adresse falsch");
// Auch das Vorrendering (Weiterlesen, Brotkrumen) bleibt in der Business-Welt — bis 19.09.2026 verwies /en/business auf /preise und /privatkunden.
// 29.10.2026 (E-461): Die Startseite „/“ (und /en) IST FIAON Global — sie wird mitgeprüft und ist als Ziel erlaubt.
for (const [pfad, e] of Object.entries(tabelle) as [string, any][]) {
  if (!/^\/(en\/)?business(\/|$)/.test(pfad) && pfad !== "/" && pfad !== "/en") continue;
  for (const eintrag of [e, e.en].filter(Boolean)) {
    const ziele = [...(eintrag.weiter ?? []), ...((eintrag.krumen ?? []) as any[]).map((k) => k.pfad)];
    const fremd = ziele.filter((z: string) => !/^\/(en\/)?(business|impressum|datenschutz|cookie-einstellungen|legal-notice|privacy)/.test(z) && !/^\/(en)?$/.test(z));
    ok(fremd.length === 0, `SEO ${eintrag.pfad ?? pfad}: Weiterlesen/Brotkrumen führen aus der Business-Welt: ${fremd.join(", ")}`);
  }
}
// Gemeinsame Seiten, aus der Business-Welt geöffnet (?bereich=business), tragen schon im Vorab-HTML den Business-Rahmen
// (server/routes.ts → seitenHtml(pfad, { bereich: "business" })) — ohne Weiterlesen in die Privatkunden-Linie.
{
  const { seitenHtml } = await import("../server/lib/fiaon-seiten-seo");
  const links = (html: string) => [...(html.split(/<div class="vorab[^"]*">/)[1] ?? "").matchAll(/<a href="([^"]+)"/g)].map((m) => m[1]);
  // 29.10.2026 (E-459): Die Vertrauensseite gehört ganz zur Business-Welt (shared/fiaon-business-grenze.ts) — der Business-Fuß verlinkt sie.
  // 29.10.2026 (E-461): dazu die Startseite (/ und /en) und der eine leise Weg zur Privat-Startseite (/privat, /en/private).
  const erlaubt = /^(\/(en\/)?(business|impressum|datenschutz|cookie-einstellungen|privacy|legal-notice|cookie-settings)([/?#]|$)|\/(en)?([?#]|$)|\/privat$|\/en\/private$|\/ist-fiaon-serioes$|\/en\/is-fiaon-legit$|tel:|mailto:|https?:)/;
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
  // 29.10.2026 (E-461): FIAON Global beginnt auf „/“ (und /en) — die 404-Ansicht führt dorthin, nie nach /privat.
  ok(/istBusinessBereich\(/.test(nf) && zweig.length > 50 && /const start = en \? "\/en" : "\/";/.test(zweig) && !/"\/(login|was-ist-fiaon|privat)"|PRIVAT_START/.test(zweig), "not-found.tsx: die 404-Ansicht unter /business führt nicht zu FIAON Global oder in die Privatwelt");
}
// Die Chips „Für wen" auf /business (seit 06.10.2026, E-293, statt Kacheln und Länderzeile) führen auf Seiten, die es gibt.
for (const k of [...GLOBAL_WOERTER.de.fuerChips, ...GLOBAL_WOERTER.de.privat.fuerChips]) ok(!k.pfad || k.pfad === "/business" || k.pfad === "/" || seitenPfade.has(k.pfad), `/business „Für wen": ${k.text} → ${k.pfad} gibt es nicht`);
// 19.09.2026: beide Rechtsseiten auch englisch (Vertrag und Belehrung gibt es in Vertragssprache Englisch).
for (const route of ["/business/widerrufsbelehrung", "/business/mustervertrag", "/en/business/widerrufsbelehrung", "/en/business/mustervertrag"]) {
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
// E-509 (12.11.2026): EIN Produkt — im Kopf stehen der Kapitalrahmen des Reglers und der eine Preis aus der einen Quelle.
// (Vorher: globalKapitalSpanne(s) und abPreis = Einstiegspreis des Pakets Global Struktur.)
ok(/kapitalWert: rahmenSpanne/.test(hubSeite.slice(0, hubSeite.indexOf('id="leistungen"'))) && /verkaufEur\(VERKAUF_PREISE\.gruendungCents, s\)/.test(hubSeite.slice(0, hubSeite.indexOf('id="leistungen"'))), "/: Kapitalrahmen oder der eine Preis fehlen im Kopf");
const einstieg = verkaufEur(VERKAUF_PREISE.gruendungCents, "de");
// 29.10.2026 (E-461): Der Eintrag der Übersicht steht unter „/“ (Startseite von fiaon.com), englisch „/en“.
// E-509: Der Preis steht im Vorab-Text (aus der einen Quelle), nicht mehr im Titel. (Vorher: Titel nennt „ab 2.499 €“.)
ok(JSON.stringify(tabelle["/"]?.abschnitte ?? []).includes(einstieg) && JSON.stringify(tabelle["/"]?.en?.abschnitte ?? []).includes(verkaufEur(VERKAUF_PREISE.gruendungCents, "en")), `/: Der Vorab-Text nennt nicht den einen Preis ${einstieg} (SEO-Tabelle, beide Sprachen)`);
// E-509: Titel und Beschreibung der Seite kommen aus VERKAUF_TEXTE.seo. (Vorher: GLOBAL_WOERTER.metaTitel/metaBeschreibung.)
ok(VERKAUF_TEXTE.de.seo.titel === tabelle["/"]?.titel && VERKAUF_TEXTE.en.seo.titel === tabelle["/"]?.en?.titel, "/: Titel der Seite und der SEO-Tabelle weichen voneinander ab");
// 06.10.2026 (E-293): Beschreibung der Seite = SEO-Tabelle (beide Sprachen).
ok(VERKAUF_TEXTE.de.seo.beschreibung === tabelle["/"]?.beschreibung && VERKAUF_TEXTE.en.seo.beschreibung === tabelle["/"]?.en?.beschreibung, "/: Beschreibung der Seite und der SEO-Tabelle weichen voneinander ab");
// 06.10.2026 (E-293): Das persönliche Angebot mit Bürgschaftszusage steht nie in Meta, SEO-Korpus oder FAQ-Markup —
// weder auf /business noch auf /business/privatpersonen (Bauplan 3.1: die Pakete sagen „Ihr Ziel“, das Angebot etwas anderes).
{
  const BUERGSCHAFT = /b(ü|ue)rgschaft|b(ü|ue)rgin|guaranty|surety/i;
  const korpus = (e: any) => e ? [e.titel, e.beschreibung, e.h1, e.lead, ...((e.abschnitte ?? []) as any[]).flatMap((x) => [x.h2, x.text, ...(x.punkte ?? [])])].join(" \n ") : "";
  // 29.10.2026 (E-461): Die Übersicht ist die Startseite „/“ (englisch „/en“).
  for (const [pfad, meta] of [["/", GLOBAL_WOERTER.de.metaBeschreibung], ["/business/privatpersonen", GLOBAL_WOERTER.de.privat.metaBeschreibung]] as const) {
    const e = tabelle[pfad];
    const text = [meta, korpus(e), korpus(e?.en), ...seoFragen(pfad).flatMap((f) => [f.f, f.a])].join(" \n ");
    ok(!!e && !BUERGSCHAFT.test(text), `${pfad}: „${text.match(BUERGSCHAFT)?.[0]}“ in Meta, SEO-Korpus oder FAQ-Markup — das persönliche Angebot gehört nur auf die Seite selbst`);
  }
  for (const pfad of ["/en", "/en/business/private-individuals"]) {
    const text = [korpus(tabelle[pfad]), ...seoFragen(pfad).flatMap((f) => [f.f, f.a])].join(" \n ");
    ok(!BUERGSCHAFT.test(text), `${pfad}: „${text.match(BUERGSCHAFT)?.[0]}“ im SEO-Korpus oder FAQ-Markup`);
  }
}
// 06.10.2026 (E-293, Gutachten): Freigabebedingung (1) aus Bauplan 3.5 als harte Probe — das persönliche Angebot nennt die
// Bürgin öffentlich erst, wenn ihr Registernachweis (Sunbiz „Active“) in GLOBAL_STANDORTE eingetragen ist. Die Anwaltsantwort
// zu KWG und § 34c GewO (Bedingung 2) bleibt eine Freigabe durch Justin und lässt sich hier nicht prüfen.
{
  const miami = GLOBAL_STANDORTE.find((o) => o.schluessel === "miami");
  ok(!GLOBAL_BUERGSCHAFT_SEITE.aktiv || !!miami?.register, "GLOBAL_BUERGSCHAFT_SEITE.aktiv ist an, aber der Registernachweis der Schwarzott Global LLC (GLOBAL_STANDORTE miami.register) fehlt — erst Sunbiz-Auszug „Active“ eintragen (Bauplan 3.5)");
}
// 06.10.2026 (E-293): Jede H2 des Korpus /business steht so auf der Seite (Regel 1: nichts im Korpus, was der Besucher nicht sieht).
// Verglichen ohne Schlusspunkt — gegen die Liste der Überschriften, die business.tsx wirklich zeigt (nicht gegen das ganze
// Wörterbuch: sonst meldete eine H2 grün, die nur in einer zugeklappten Antwort oder einem Popover steht; Gutachten 06.10.).
// Die Jahresbetreuung baut ihre Überschrift aus GLOBAL_JAHRESBETREUUNG (Titel und Preis).
for (const sp of ["de", "en"] as const) {
  const e = sp === "de" ? tabelle["/"] : tabelle["/"]?.en;
  const w = GLOBAL_WOERTER[sp];
  // E-509: die Überschriften der neuen Startseite — das eine Produkt und der Konfigurator aus VERKAUF_TEXTE, die übrigen aus dem
  // Wörterbuch. (Vorher: paketeH2 und die Überschrift des Bands „Jahresbetreuung“.)
  const v = VERKAUF_TEXTE[sp];
  const gezeigt = [`${v.produkt.h2a} ${v.produkt.h2b}`, `${v.konfig.h2a} ${v.konfig.h2b}`, w.vsH2, w.wissenTitel, w.gespraechH2, w.fragenH2].map((x) => x.replace(/\.$/, ""));
  for (const a of (e?.abschnitte ?? []) as { h2: string }[]) {
    const h2 = a.h2.replace(/\.$/, "");
    ok(gezeigt.includes(h2), `SEO /business (${sp}): Abschnitt „${a.h2}“ ist keine Überschrift der Seite (Produkt, Konfigurator, vsH2, wissenTitel, gespraechH2, fragenH2)`);
  }
  ok(((e?.abschnitte ?? []) as unknown[]).length >= 4, `SEO /business (${sp}): weniger als vier Abschnitte im Korpus`);
}

// ═══ 9: JAHRESBETREUUNG, UHREN, NACHRICHTENLAGE, STARTSEITE PRIVATPERSONEN (19.09.2026, E-196) ═══
abschnitt("E-196: Jahresbetreuung, Uhren, Nachrichtenlage, Privatpersonen");
{
  // Jahresbetreuung: ein Preis, eine Quelle, auf jeder Seite.
  ok(GLOBAL_JAHRESBETREUUNG.preisCents === 69900, `Jahresbetreuung: Preis ${GLOBAL_JAHRESBETREUUNG.preisCents} statt 69900`);
  for (const sp of ["de", "en"] as const) {
    const j = GLOBAL_JAHRESBETREUUNG[sp];
    // 06.10.2026 (E-293): dazu die Wörter des Bands auf /business (Ring, Satz, Zeitleiste, Bedingung kurz).
    const jt = [j.kurz, j.lead, ...j.leistungen, j.bedingungen, j.buchen, j.gebucht, j.nichtHeute, ...j.kurzLeistungen, j.bandSatz, ...j.zeitleiste, j.bandBedingung].join("\n");
    // 24.09.2026 (E-234): die englische Hälfte mit den englischen Regeln — die deutschen fanden in ihr nichts.
    const funde = sp === "en" ? globalWortPruefenEn(jt) : globalWortPruefen(jt);
    ok(funde.length === 0, `Jahresbetreuung (${sp}) verletzt die Wortregeln: ${funde.map((x) => x.treffer).join(", ")}`);
    ok(/Staatsgeb|state fee/i.test(j.leistungen.join(" ")), `Jahresbetreuung (${sp}): die Staatsgebühr fehlt in den Leistungen`);
    ok(/nicht von selbst|does not renew/i.test(j.bedingungen) && /nicht von selbst|does not renew/i.test(j.bandBedingung), `Jahresbetreuung (${sp}): „verlängert sich nicht von selbst" fehlt (Bedingungen oder Band)`);
    ok(j.kurzLeistungen.length === j.leistungen.length, `Jahresbetreuung (${sp}): ${j.kurzLeistungen.length} Ringbeschriftungen für ${j.leistungen.length} Leistungen`);
  }
  // E-509 (12.11.2026): Startseite und Unterseiten tragen das Band „Jahresbetreuung“ nicht mehr (sein Text spricht von Paketen).
  // Die Jahresbetreuung steht mit dem Preis aus der einen Quelle im Preisblatt des Konfigurators und in der Karte „Ein Mandat“.
  // (Vorher: beide Dateien mussten <GlobalJahresbetreuung> enthalten.)
  ok(/VERKAUF_PREISE\.jahresCents/.test(fs.readFileSync(path.join(WURZEL, "client/src/components/site/global/VerkaufKonfigurator.tsx"), "utf8")), "VerkaufKonfigurator.tsx: die Jahresbetreuung fehlt im Preisblatt (Preis aus VERKAUF_PREISE)");
  ok(fs.readFileSync(path.join(WURZEL, "client/src/pages/site/business.tsx"), "utf8").includes("<VerkaufKonfigurator") && fs.readFileSync(path.join(WURZEL, "client/src/pages/site/global-seite.tsx"), "utf8").includes("<VerkaufKarte"), "Startseite ohne Konfigurator oder Unterseiten ohne die Karte „Ein Mandat“");
  // E-509 (12.11.2026): Die Anzeigenseite trägt das Band nicht mehr — sein Text spricht von Paketen („Das erste Jahr steckt
  // in jedem Paket“). Die Jahresbetreuung steht dort als Zeile mit dem Preis aus der einen Quelle (EIN_PRODUKT.jahres).
  // (Vorher: global-lp.tsx musste <GlobalJahresbetreuung> enthalten.)
  ok(/\{P\.jahres\}/.test(fs.readFileSync(path.join(WURZEL, "client/src/pages/site/global-lp.tsx"), "utf8")), "client/src/pages/site/global-lp.tsx: die Jahresbetreuung fehlt (Preis aus EIN_PRODUKT)");
  // Startseite für Privatpersonen: eigene Route vor /business/:slug, jede Tafel führt in den Auftrag als Privatperson.
  const app = fs.readFileSync(path.join(WURZEL, "client/src/App.tsx"), "utf8");
  ok(app.includes(`path="/business/privatpersonen" component={BusinessPrivatPage}`) && app.indexOf(`path="/business/privatpersonen"`) < app.indexOf(`path="/business/:slug"`),
    "App.tsx: /business/privatpersonen führt nicht auf die Startseite für Privatpersonen (oder steht hinter /business/:slug)");
  const hub = fs.readFileSync(path.join(WURZEL, "client/src/pages/site/business.tsx"), "utf8");
  // E-509: Es gibt einen Weg für alle — den Konfigurator; jeder schließt als Person ab (Vertrag der Fassung C).
  // (Vorher: jede Pakettafel der Privatpersonen-Seite führte mit art=privat in den Direktkauf.)
  ok(/zumKonfigurator\("buehne"\)/.test(hub) && /<VerkaufKonfigurator sprache=\{s\} \/>/.test(hub), "business.tsx: die Bühne führt nicht zum Konfigurator");
  ok(globalStartPfad("global_kapital", "de", "privat").endsWith("paket=global_kapital&art=privat"), "globalStartPfad: art=privat fehlt");
  const privatEintrag = GLOBAL_SEITEN.find((x) => x.pfad === "/business/privatpersonen");
  ok(!!privatEintrag && GLOBAL_WOERTER.de.privat.metaTitel === privatEintrag.seo.titel && GLOBAL_WOERTER.de.privat.metaBeschreibung === privatEintrag.seo.beschreibung,
    "Privatpersonen: Titel/Beschreibung der Startseite weichen vom Registereintrag (Vorab-HTML) ab");
  // Die drei Uhren: Deutschland, Florida, London — in beiden Sprachen dieselben Zonen.
  for (const sp of ["de", "en"] as const) {
    ok(JSON.stringify(GLOBAL_WOERTER[sp].uhren.map((u) => u.zone)) === JSON.stringify(["Europe/Berlin", "America/New_York", "Europe/London"]), `Uhren (${sp}): Zonen stimmen nicht`);
  }
  // Das Menü (auf jeder Business-Seite) führt zur Jahresbetreuung — mit demselben Preis.
  const jbMenue = GLOBAL_MENUE.find((x) => x.pfad === "/#jahresbetreuung");
  ok(!!jbMenue && jbMenue.text.includes(globalJahresbetreuungPreisText("de")), "Menü: Eintrag Jahresbetreuung fehlt oder nennt einen anderen Preis als GLOBAL_JAHRESBETREUUNG");
  // Nachrichtenlage: nur echte Meldungen mit Quelle, jung genug, ohne verbotene Wörter.
  const m = GLOBAL_SCHLAGZEILEN.meldungen;
  if (!m.length) hinweise.push("Nachrichtenlage: noch keine Meldungen — die Sektion erscheint erst mit Einträgen");
  const grenze = new Date(new Date(`${GLOBAL_SCHLAGZEILEN.stand}T12:00:00Z`).getTime() - 365 * 86_400_000).toISOString().slice(0, 10);
  ok(new Set(m.map((x) => x.de)).size === m.length && new Set(m.map((x) => x.en)).size === m.length, "Nachrichtenlage: eine Schlagzeile steht doppelt (die Liste nutzt sie als Schlüssel)");
  for (const x of m) {
    ok(/^https:\/\//.test(x.url) && x.quelle.trim().length > 1, `Schlagzeile ohne Quelle oder https-Adresse: ${x.de}`);
    ok(/^\d{4}-\d{2}-\d{2}$/.test(x.datum) && x.datum >= grenze && x.datum <= GLOBAL_SCHLAGZEILEN.stand, `Schlagzeile mit Datum außerhalb der zwölf Monate: ${x.datum} ${x.de}`);
    ok(x.de.length <= 70 && x.en.length <= 70, `Schlagzeile länger als 70 Zeichen: ${x.de}`);
    const funde = [...globalWortPruefen([x.de, x.kurzDe].join("\n")), ...globalWortPruefenEn([x.en, x.kurzEn].join("\n"))];
    ok(funde.length === 0, `Schlagzeile verletzt die Wortregeln (${funde.map((y) => y.treffer).join(", ")}): ${x.de}`);
  }
}

// ═══ 10: DAS KAPITAL IST NICHT AN DIE USA GEBUNDEN (19.09.2026, Justin) ═══════
// „Das Kapital muss NICHT in den USA ausgegeben werden — man kann es auch nach Europa überweisen
// oder in Europa Investitionen tätigen. Ändere das ÜBERALL." Eine Quelle: GLOBAL_KAPITAL_FREI.
// Wörtlich kopiert steht sie nur in den FAQ von /business (reine Zeichenketten fürs FAQ-Markup) —
// dieser Block hält die Kopie gleich. Wo der Satz steht, steht der Steuersatz daneben; auf den
// Anzeigen-Landingpages steht er nie (Google-Ads-Richtlinie, Abschnitt 5).
abschnitt("Kapital auch in Europa (GLOBAL_KAPITAL_FREI)");
{
  for (const sp of ["de", "en"] as const) {
    const k = GLOBAL_KAPITAL_FREI[sp];
    const kt = [k.kurz, k.satz, k.steuer, k.frage, k.antwort].join("\n");
    const funde = sp === "en" ? globalWortPruefenEn(kt) : globalWortPruefen(kt);
    ok(funde.length === 0, `GLOBAL_KAPITAL_FREI.${sp} verletzt die Wortregeln: ${funde.map((x) => x.treffer).join(", ")}`);
    // Die zwei ehrlichen Sätze: Rahmen und Bedingungen setzt das Institut, die Steuer klärt der Partner-Steuerberater vorab.
    const institut = sp === "de" ? /Institut/ : /institution/;
    const berater = sp === "de" ? /Partner-Steuerberater/ : /partner tax adviser/;
    ok(institut.test(k.satz) && berater.test(k.steuer) && institut.test(k.antwort) && berater.test(k.antwort), `GLOBAL_KAPITAL_FREI.${sp}: Institut oder Partner-Steuerberater fehlt in Satz, Steuersatz oder Antwort`);
    // /business trägt die Frage wortgleich — als reine Zeichenkette, sonst fehlt sie im FAQ-Markup.
    const faq = GLOBAL_WOERTER[sp].fragen.find((x) => x.f === k.frage);
    ok(!!faq && faq.a === k.antwort, `/business (${sp}): Frage „${k.frage}“ fehlt oder weicht von GLOBAL_KAPITAL_FREI.${sp} ab`);
    const markup = seoFragen(sp === "de" ? "/" : "/en");
    ok(markup.some((x) => x.f === k.frage && x.a === k.antwort), `FAQ-Markup ${sp === "de" ? "/" : "/en"}: Frage zum Kapital fehlt — npx tsx scripts/seo-fragen-erzeugen.ts`);
  }
  // Die Hauptseite liest die Quelle: am Kapitalrahmen im Kopf (mit Fußnote) und unter den Pakettafeln.
  const kopf = hubSeite.slice(0, hubSeite.indexOf('id="leistungen"'));
  // 29.10.2026: Seit der Glas-Bühne (E-442, 27.10.) gibt /business den Hinweis als Eigenschaft an HeroGlas weiter
  // (kapitalFrei: frei.kurz, fussnote: `${frei.satz} ${frei.steuer}`) — beide Schreibweisen zählen.
  const kurzImKopf = /\{frei\.kurz\}/.test(kopf) || /kapitalFrei: frei\.kurz\b/.test(kopf);
  const fussImKopf = /\{frei\.satz\} \{frei\.steuer\}/.test(kopf) || /fussnote: `\$\{frei\.satz\} \$\{frei\.steuer\}`/.test(kopf);
  ok(/GLOBAL_KAPITAL_FREI\[s\]/.test(hubSeite) && kurzImKopf && fussImKopf, "/business: der Hinweis am Kapitalrahmen oder seine Fußnote (GLOBAL_KAPITAL_FREI) fehlt im Kopf");
  // E-509: Die zweite Stelle (Zeile unter den Pakettafeln) gibt es nicht mehr — die Tafeln sind weg. Der Hinweis steht im Kopf
  // (oben geprüft) und als Frage in den Fragen der Startseite (i18n/global.ts, wortgleich mit GLOBAL_KAPITAL_FREI).
  ok(GLOBAL_WOERTER.de.fragen.some((f) => f.f === GLOBAL_KAPITAL_FREI.de.frage && f.a === GLOBAL_KAPITAL_FREI.de.antwort), "/: die Frage „Muss das Kapital in den USA ausgegeben werden?“ (GLOBAL_KAPITAL_FREI) fehlt in den Fragen der Startseite");
  // Die Unterseiten, auf denen Kapital Thema ist, tragen die Frage — von Firmenkarten und Kapital sammelt sie die Fragen-Seite.
  for (const pfad of ["/business/firmenkarten-kapital", "/business/privatpersonen", "/business/bau-immobilien"]) {
    const seite = GLOBAL_SEITEN.find((x) => x.pfad === pfad);
    ok(!!seite?.fragen.some((x) => x.f === GLOBAL_KAPITAL_FREI.de.frage && x.a === GLOBAL_KAPITAL_FREI.de.antwort), `${pfad}: die Frage zum Kapital fehlt oder weicht von GLOBAL_KAPITAL_FREI ab`);
  }
  const sammlung = GLOBAL_SEITEN.find((x) => x.pfad === "/business/fragen");
  ok(!!sammlung?.bloecke.some((b) => b.typ === "fragen" && b.fragen.some((x) => x.f === GLOBAL_KAPITAL_FREI.de.frage)), "/business/fragen: die Frage zum Kapital fehlt");
  // Wo der Satz auf einer Unterseite steht, steht der Steuersatz mindestens ebenso oft (die Institut-Bedingung steckt im Satz).
  for (const s of GLOBAL_SEITEN) {
    const text = JSON.stringify(s);
    const saetze = text.split(GLOBAL_KAPITAL_FREI.de.satz).length - 1;
    const steuer = text.split(GLOBAL_KAPITAL_FREI.de.steuer).length - 1;
    ok(steuer >= saetze, `${s.pfad}: „${GLOBAL_KAPITAL_FREI.de.satz.slice(0, 40)}…“ ${saetze}× ohne den Satz zum Partner-Steuerberater (${steuer}×)`);
  }
  // Nie auf den Anzeigen-Landingpages — weder im Register noch in der Seite selbst.
  const lpTexte = JSON.stringify(LANDINGPAGES);
  const lpFund = [...Object.values(GLOBAL_KAPITAL_FREI.de), ...Object.values(GLOBAL_KAPITAL_FREI.en)].find((x) => lpTexte.includes(x))
    ?? lpTexte.match(/nach Europa überweisen|in Europa investieren|in Europa einsetzbar|nicht an die USA gebunden/i)?.[0];
  ok(!lpFund, `Landingpages: der Kapital-Satz steht auf einer Anzeigenseite („${String(lpFund).slice(0, 50)}“)`);
  ok(!/GLOBAL_KAPITAL_FREI/.test(lpQuelle), "global-lp.tsx liest GLOBAL_KAPITAL_FREI — der Satz gehört nicht auf die Anzeigenseiten");
}

// ═══ 11: DIE ENGLISCHEN UNTERSEITEN (24.09.2026, E-234) ═════════════════════
// Justin: „Mach die englischen Fassungen der Business-Unterseiten." Jede deutsche Seite hat genau eine
// englische Schwester (shared/fiaon-global-pfade.ts). Den Aufbau Seite für Seite (Bausteine, Anker, Zahlen,
// Wortregeln, deutsche Reste) prüft scripts/pruef-global-en.ts — hier läuft er mit. Dazu das, was nur im
// Zusammenspiel sichtbar wird: Paare in beide Richtungen, SEO-Tabelle, hreflang, Vorab-HTML, Menü, Wege.
abschnitt("Englische Unterseiten");
{
  const { GLOBAL_SEITEN_EN } = await import("../shared/fiaon-global-seiten");
  const { GLOBAL_EN_PFADE, globalSchwester, globalEnPfad } = await import("../shared/fiaon-global-pfade");
  const { globalMenue } = await import("../shared/fiaon-global-menue");
  const { seitenHtml } = await import("../server/lib/fiaon-seiten-seo");
  const { GLOBAL_BILD_EN, SEO_BASIS } = await import("../shared/fiaon-seo-seiten");
  const { execFileSync } = await import("child_process");
  const enPfade = new Set(GLOBAL_SEITEN_EN.map((s) => s.pfad));
  // Paare: jede deutsche Seite hat ihre englische, jede englische ihre deutsche — und die Tabelle kennt beide Wege.
  ok(GLOBAL_SEITEN_EN.length === GLOBAL_SEITEN.length, `Englisch ${GLOBAL_SEITEN_EN.length} Seiten, Deutsch ${GLOBAL_SEITEN.length}`);
  for (const d of GLOBAL_SEITEN) {
    const en = GLOBAL_EN_PFADE[d.pfad];
    ok(!!en && enPfade.has(en), `${d.pfad}: keine englische Schwester (${en ?? "kein Eintrag in fiaon-global-pfade.ts"})`);
    if (en) ok(globalSchwester(en, "de") === d.pfad && globalSchwester(d.pfad, "en") === en, `${d.pfad} ↔ ${en}: Paar nicht in beide Richtungen`);
  }
  const titelEn = GLOBAL_SEITEN_EN.map((s) => s.seo.titel);
  ok(new Set(titelEn).size === titelEn.length, `Englische Titel doppelt: ${titelEn.filter((t, i) => titelEn.indexOf(t) !== i).join(" | ")}`);
  for (const e of GLOBAL_SEITEN_EN) {
    const w = e.pfad;
    ok(/^\/en\/business\/(knowledge\/)?[a-z0-9-]+$/.test(w), `${w}: Pfad passt auf keine englische Route`);
    ok(!seiteUnbekannt(w) && !seiteUnbekannt(`${w}/`), `${w}: der Server hielte die Seite für unbekannt (404)`);
    ok(globalInhalt(e).length >= 4 && globalInhalt(e)[0].titel === "In brief", `${w}: Inhaltsverzeichnis zu kurz oder deutsch`);
    const t = tabelle[w];
    ok(!!t && t.sprache === "en" && t.schwester === e.schwester && tabelle[e.schwester ?? ""]?.schwester === w, `${w}: SEO-Eintrag fehlt oder das hreflang-Paar ist nicht gegenseitig`);
    if (!t) continue;
    ok(t.titel === e.seo.titel && t.beschreibung === e.seo.beschreibung && t.bild === GLOBAL_BILD_EN && t.global === e.art && !!t.erschienen, `${w}: SEO-Eintrag weicht ab (Titel, Beschreibung, Bild, global, erschienen)`);
    ok(seoIndexierbar().some((x: any) => x.pfad === w), `${w}: nicht indexierbar (fehlt in der Sitemap)`);
    ok(seoFragen(w).length === e.fragen.length, `${w}: FAQ-Daten ${seoFragen(w).length}, sichtbar ${e.fragen.length}`);
    // 29.10.2026 (E-461): Die erste Krume ist die englische Startseite /en (FIAON Global), danach nur /en/business/….
    ok((t.krumen ?? [])[0]?.pfad === "/en" && (t.krumen ?? []).slice(1).every((k: any) => k.pfad.startsWith("/en/business")), `${w}: Brotkrumen führen aus der englischen Welt`);
    // Vorab-HTML: Sprache, hreflang-Trio, keine deutschen Business-Links, kein „(in German)", englisches Angebot.
    const html = seitenHtml(w) ?? "";
    ok(html.includes('<html lang="en">') && html.includes(`hreflang="en" href="${SEO_BASIS}${w}"`) && html.includes(`hreflang="de" href="${SEO_BASIS}${e.schwester}"`) && html.includes(`hreflang="x-default" href="${SEO_BASIS}${e.schwester}"`), `${w}: html lang oder hreflang-Trio fehlt`);
    const vorab = html.split(/<div class="vorab[^"]*">/)[1] ?? html.split('<div id="root">')[1] ?? "";
    const deutscheLinks = [...vorab.matchAll(/href="(\/business[^"]*)"/g)].map((m) => m[1]);
    ok(deutscheLinks.length === 0, `${w}: Vorab-HTML verlinkt deutsche Business-Seiten (${deutscheLinks.slice(0, 3).join(", ")})`);
    ok(!/\(in German\)|Kurz beantwortet|Weiterlesen|Häufige Fragen/.test(html), `${w}: deutsche Rahmenwörter im Vorab-HTML`);
    if (["leistung", "preise", "zielgruppe", "land"].includes(e.art)) ok(html.includes(`"@id":"${SEO_BASIS}/en#leistung"`) && !html.includes(`${SEO_BASIS}/business/start?paket=`), `${w}: Service-Markup nicht englisch`);
    // Die deutsche Schwester nennt die englische.
    const htmlDe = seitenHtml(e.schwester ?? "") ?? "";
    ok(htmlDe.includes(`hreflang="en" href="${SEO_BASIS}${w}"`), `${e.schwester}: hreflang auf ${w} fehlt`);
  }
  // Menü: englische Pfade führen auf englische Seiten (oder Anker der englischen Übersicht), Längen passen ins Panel.
  for (const g of globalMenue("en")) for (const m of g.eintraege) {
    const basis = m.pfad.split("#")[0];
    ok(basis === "/en" || basis === "/en/business/start" || enPfade.has(basis), `Menü (en) „${m.titel}" → ${m.pfad} ist keine englische Seite`);
    ok(m.titel.length <= 30 && m.text.length <= 52, `Menü (en) „${m.titel}": Titel oder Zeile zu lang für das Panel`);
    ok(globalWortPruefenEn(`${m.titel}\n${m.text}`).length === 0, `Menü (en) „${m.titel}": ${globalWortPruefenEn(`${m.titel}\n${m.text}`).map((f) => f.hinweis).join("; ")}`);
  }
  const jbEn = globalMenue("en").flatMap((g) => g.eintraege).find((m) => m.pfad === "/en#jahresbetreuung");
  ok(!!jbEn && jbEn.text.includes(globalJahresbetreuungPreisText("en")), "Menü (en): Jahresbetreuung fehlt oder nennt einen anderen Preis");
  // Übersicht /en/business: „Who it is for" und die Länder führen auf englische Seiten; Privatpersonen: Kopf = Register.
  for (const k of GLOBAL_WOERTER.en.fuerChips) ok(!!k.pfad && enPfade.has(k.pfad), `/en/business „For": ${k.text} → ${k.pfad || "(leer)"}`);
  for (const k of GLOBAL_WOERTER.en.privat.fuerChips) ok(!k.pfad || k.pfad === "/en" || enPfade.has(k.pfad), `/en/business/private-individuals „For": ${k.text} → ${k.pfad}`);
  const privatEn = GLOBAL_SEITEN_EN.find((x) => x.pfad === "/en/business/private-individuals");
  ok(!!privatEn && privatEn.auftraggeber === "privat" && GLOBAL_WOERTER.en.privat.metaTitel === privatEn.seo.titel && GLOBAL_WOERTER.en.privat.metaBeschreibung === privatEn.seo.beschreibung,
    "Private individuals: Titel/Beschreibung der Startseite weichen vom englischen Registereintrag ab (oder art privat fehlt)");
  // 06.10.2026 (E-293): Die Standorte stehen nur noch im Fuß (GlobalOrte) — dort liest GlobalFuss.tsx GLOBAL_VERBUNDEN_EN direkt.
  ok(/neither a bank/.test(GLOBAL_FUSS_WOERTER.en.keineBank) && /keine Bank/.test(GLOBAL_FUSS_WOERTER.de.keineBank), "GLOBAL_FUSS_WOERTER: der Satz „keine Bank“ (§ 39/§ 41 KWG) fehlt im Fuß");
  // Das Kapital ist nicht an die USA gebunden — dieselbe Frage auf den englischen Schwestern.
  for (const pfad of ["/business/firmenkarten-kapital", "/business/privatpersonen", "/business/bau-immobilien"]) {
    const e = GLOBAL_SEITEN_EN.find((x) => x.schwester === pfad);
    ok(!!e?.fragen.some((x) => x.f === GLOBAL_KAPITAL_FREI.en.frage && x.a === GLOBAL_KAPITAL_FREI.en.antwort), `${globalEnPfad(pfad)}: die Frage zum Kapital fehlt oder weicht von GLOBAL_KAPITAL_FREI.en ab`);
  }
  const faqEn = GLOBAL_SEITEN_EN.find((x) => x.pfad === "/en/business/faq");
  ok(!!faqEn?.bloecke.some((b) => b.typ === "fragen" && b.fragen.some((x) => x.f === GLOBAL_KAPITAL_FREI.en.frage)), "/en/business/faq: die Frage zum Kapital fehlt");
  const zaehle = (liste: GlobalSeite[]) => liste.find((x) => x.art === "preise" && x.bloecke.every((b) => b.typ === "fragen"))?.bloecke.reduce((n, b) => n + (b.typ === "fragen" ? b.fragen.length : 0), 0) ?? 0;
  ok(zaehle(GLOBAL_SEITEN_EN) === zaehle(GLOBAL_SEITEN), `Fragen-Seite: englisch ${zaehle(GLOBAL_SEITEN_EN)} Fragen, deutsch ${zaehle(GLOBAL_SEITEN)}`);
  // Seite für Seite: scripts/pruef-global-en.ts (Aufbau, Wortregeln, deutsche Reste).
  let enOk = true;
  try { execFileSync("npx", ["tsx", "scripts/pruef-global-en.ts"], { cwd: WURZEL, stdio: "pipe" }); } catch (e: any) { enOk = false; console.log(String(e.stdout ?? "").split("\n").filter((z: string) => z.includes("FEHLER")).slice(0, 20).join("\n")); }
  ok(enOk, "scripts/pruef-global-en.ts meldet Fehler (siehe oben)");
  console.log(`  ${GLOBAL_SEITEN_EN.length} englische Seiten, Paare und Vorab-HTML geprüft`);
}

// ═══ 12: ÖSTERREICH-SEITE OHNE „UNTERNEHMENSBERATUNG“, KLÄRUNGSSATZ IM SCHEMA (28.10.2026, E-454) ═══
// E-439: „Unternehmensberatung“/„business consultancy“ ist erlaubt — nur nicht auf der Österreich-Seite (AT § 94 Z 74 GewO).
// Bis E-454 stand das Wort dort trotzdem einmal sichtbar und dreimal im JSON-LD. Geprüft wird das fertige HTML (Text UND
// Datenblock) beider Sprachen, mit und ohne ?bereich=business, dazu der Registereintrag selbst. Außerdem: Jede Seite trägt
// im Organisations-Schema den Klärungssatz gegen Verwechslungen (disambiguatingDescription) in ihrer Sprache, /llms.txt auch.
abschnitt("Österreich-Seite und Verwechslungs-Schutz (E-454)");
{
  const { seitenHtml } = await import("../server/lib/fiaon-seiten-seo");
  const { GLOBAL_SEITEN_EN } = await import("../shared/fiaon-global-seiten");
  const { OESTERREICH_SEITEN, OESTERREICH_REGEL, istOesterreichSeite } = await import("../shared/fiaon-global-wortregeln");
  const { fiaonVerwechslung } = await import("../shared/fiaon-firma");
  const { llmsTxt } = await import("../server/lib/fiaon-llms");
  ok(OESTERREICH_SEITEN.length === 2 && istOesterreichSeite("/business/aus-oesterreich/") && istOesterreichSeite("/en/business/from-austria?x=1") && !istOesterreichSeite("/business/aus-deutschland"),
    "istOesterreichSeite erkennt die beiden Österreich-Adressen nicht (oder eine andere)");
  const ldVon = (html: string) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => { try { return JSON.parse(m[1]); } catch { return null; } });
  for (const pfad of OESTERREICH_SEITEN) {
    const register = [...GLOBAL_SEITEN, ...GLOBAL_SEITEN_EN].find((x) => x.pfad === pfad);
    ok(!!register, `${pfad}: fehlt im Register`);
    const imRegister = JSON.stringify(register ?? {}).match(OESTERREICH_REGEL.muster)?.[0];
    ok(!imRegister, `${pfad}: Registereintrag nennt „${imRegister}“ — ${OESTERREICH_REGEL.grund}`);
    for (const bereich of [undefined, "business"] as const) {
      const html = seitenHtml(pfad, bereich ? { bereich } : {}) ?? "";
      ok(html.length > 5000, `${pfad}${bereich ? " (bereich business)" : ""}: kein Vorab-HTML`);
      const fund = html.match(OESTERREICH_REGEL.muster);
      ok(!fund, `${pfad}${bereich ? " (bereich business)" : ""}: HTML nennt „${fund?.[0]}“ bei „…${fund ? html.slice(Math.max(0, fund.index! - 60), fund.index! + 20).replace(/\s+/g, " ") : ""}…“ — ${OESTERREICH_REGEL.grund}`);
    }
  }
  // Klärungssatz: auf Deutsch und Englisch, privat und Business, in der Organisation (FIAON LTD) und bei FIAON Global.
  // 29.10.2026 (E-461): „/“ und „/en“ sind FIAON Global, /privat die Privat-Startseite.
  for (const [pfad, sp] of [["/privat", "de"], ["/preise", "de"], ["/", "de"], ["/business/aus-oesterreich", "de"], ["/en", "en"], ["/en/business/from-austria", "en"]] as const) {
    const ld = ldVon(seitenHtml(pfad) ?? "");
    const org = ld.find((l) => l?.["@id"] === "https://fiaon.com/#organisation");
    ok(org?.disambiguatingDescription === fiaonVerwechslung(sp), `${pfad}: Organisation ohne disambiguatingDescription (${sp}) — „${org?.disambiguatingDescription ?? "fehlt"}“`);
    if (pfad.includes("business") || pfad === "/" || pfad === "/en") {
      const glob = ld.find((l) => l?.["@id"] === "https://fiaon.com/#fiaon-global");
      ok(typeof glob?.disambiguatingDescription === "string" && glob.disambiguatingDescription.includes(sp === "en" ? "not related to" : "nicht verwandt mit"), `${pfad}: FIAON Global ohne disambiguatingDescription (${sp})`);
    }
  }
  const llms = llmsTxt();
  ok(llms.includes("Nicht zu verwechseln mit") && llms.includes("Not to be confused with"), "/llms.txt: der Satz „Nicht zu verwechseln mit …“ fehlt (deutsch oder englisch)");
  console.log(`  ${OESTERREICH_SEITEN.length} Österreich-Seiten (Register + HTML, je zwei Bereiche), Klärungssatz auf 6 Seiten und in /llms.txt geprüft`);
}

// ═══ 13: EIN PRODUKT — KEINE SEITE VERKAUFT MEHR DIE VIER PAKETE (12.11.2026, E-509) ═══════════════
// Justin: „wir sollten die Pakete weg“. Die vier Pakete (Global Struktur, Banking, Kapital, VIP) bleiben für Bestandskunden im
// Katalog, stehen aber auf keiner öffentlichen Seite von FIAON Global mehr: nicht im Register (deutsch und englisch), nicht auf
// den Anzeigenseiten, nicht im Menü, nicht im Vorab-HTML samt Datenblock und nicht in /llms.txt. Der Paket-Finder ist der
// Konfigurator; seine alten Adressen leiten dauerhaft dorthin.
abschnitt("E-509: ein Produkt, keine Pakete");
{
  const { GLOBAL_SEITEN_EN } = await import("../shared/fiaon-global-seiten");
  const { GLOBAL_UMGEZOGEN, GLOBAL_EN_PFADE } = await import("../shared/fiaon-global-pfade");
  const { seitenHtml } = await import("../server/lib/fiaon-seiten-seo");
  const { llmsTxt } = await import("../server/lib/fiaon-llms");
  const { EIN_PRODUKT } = await import("../shared/fiaon-global-seiten/ein-produkt");
  // Alle Texte einer Seite — ohne die Schlüssel, die nur den Baustein benennen (typ „paket“, id „paket“, paket: global_…).
  const texteVon = (x: unknown, aus: string[] = []): string[] => {
    if (typeof x === "string") aus.push(x);
    else if (Array.isArray(x)) for (const y of x) texteVon(y, aus);
    else if (x && typeof x === "object") for (const [k, v] of Object.entries(x)) if (!["typ", "id", "paket", "pfad", "schwester"].includes(k)) texteVon(v, aus);
    return aus;
  };
  // Die vier Preise aus dem Katalog — nie getippt: „2.499 €“ / „€2,499“ in jeder Schreibweise.
  const altPreise = PAKETE.filter((p) => ["global_struktur", "global_banking", "global_kapital", "global_vip"].includes(p.key)).map((p) => Math.round(p.preisCents / 100));
  ok(altPreise.length === 4 && altPreise.every((e) => e >= 1000), `Katalog: die vier Global-Pakete (Struktur, Banking, Kapital, VIP) stehen nicht mehr mit Preis im Katalog (${altPreise.join(", ")}) — Bestandskunden brauchen sie`);
  const preisMuster = new RegExp(altPreise.map((e) => `(?<![\\d.,])${Math.floor(e / 1000)}[.,\\u202f\\u00a0 ]?${String(e % 1000).padStart(3, "0")}(?!\\d)`).join("|"));
  const PAKET_WORT = /paket|package/i;
  const PAKET_NAME = /Global (Struktur|Banking|Kapital|VIP|Structure|Capital)\b|Paket-?Finder|package finder|vier Pakete|four packages|Paketwahl/i;
  for (const s of [...GLOBAL_SEITEN, ...GLOBAL_SEITEN_EN, ...LANDINGPAGES] as { pfad: string }[]) {
    const texte = texteVon(s);
    const wort = texte.find((t) => PAKET_WORT.test(t));
    ok(!wort, `${s.pfad}: spricht noch von einem Paket — „${String(wort).slice(0, 110)}“`);
    const name = texte.find((t) => PAKET_NAME.test(t) || preisMuster.test(t));
    ok(!name, `${s.pfad}: nennt noch einen Paketnamen oder einen alten Paketpreis — „${String(name).slice(0, 110)}“`);
  }
  const menueText = texteVon(GLOBAL_MENUE).join("\n");
  ok(!PAKET_WORT.test(menueText) && !PAKET_NAME.test(menueText) && !preisMuster.test(menueText), `Menü: spricht noch von Paketen („${menueText.match(PAKET_WORT)?.[0] ?? menueText.match(PAKET_NAME)?.[0] ?? menueText.match(preisMuster)?.[0]}“)`);
  // Was Suchmaschinen und Assistenten lesen: Vorab-HTML mit Datenblock — für jede Global-Seite, beide Startseiten, Konfigurator und Mustervertrag.
  const fest = ["/", "/en", "/business/start", "/en/business/start", "/business/mustervertrag", "/en/business/mustervertrag"];
  for (const pfad of [...fest, ...GLOBAL_SEITEN.map((s) => s.pfad), ...GLOBAL_SEITEN_EN.map((s) => s.pfad), ...LANDINGPAGES.map((l) => l.pfad)]) {
    const html = (seitenHtml(pfad) ?? "").replace(/<style[\s\S]*?<\/style>/g, " ");
    ok(html.length > 2000, `${pfad}: kein Vorab-HTML`);
    const fund = html.match(PAKET_NAME) ?? html.match(preisMuster);
    ok(!fund, `${pfad}: Vorab-HTML nennt „${fund?.[0]}“ bei „…${fund ? html.slice(Math.max(0, fund.index! - 70), fund.index! + 30).replace(/\s+/g, " ") : ""}…“`);
    // „Paket“ darf im Vorab-HTML nur in dem einen Satz der Startseite stehen, der es verneint („Keine Pakete, keine Stufen“).
    const worte = [...html.replace(/Keine Pakete, keine Stufen|No packages, no tiers/g, "").matchAll(/[^<>"]{0,60}(?:Paket|package)[^<>"]{0,40}/gi)].map((m) => m[0]).filter((t) => !/\/og\/business\/|paket=global_/.test(t));
    ok(worte.length === 0, `${pfad}: Vorab-HTML spricht von einem Paket — „${worte[0]?.replace(/\s+/g, " ").slice(0, 120)}“`);
  }
  // /llms.txt: Der Abschnitt über FIAON Global nennt das eine Produkt mit dem einen Preis — und kein Paket. (Die Privatkunden-Linie
  // darunter hat ihre eigenen Pakete; sie beginnt bei „## FIAON Bonität“.)
  const llmsGlobal = llmsTxt().split("## FIAON Bonität")[0];
  const llmsFund = llmsGlobal.match(PAKET_NAME) ?? llmsGlobal.match(preisMuster) ?? llmsGlobal.match(/[^\n]{0,60}(?:Paket|package)[^\n]{0,40}/i);
  ok(!llmsFund, `/llms.txt (FIAON Global): „${llmsFund?.[0]}“`);
  ok(llmsGlobal.includes(EIN_PRODUKT.de.preis) && llmsGlobal.includes(EIN_PRODUKT.de.partner), "/llms.txt: der eine Preis oder der Partner-Satz des einen Produkts fehlt");
  // Titel und Beschreibung der Startseite im Wörterbuch = VERKAUF_TEXTE.seo (vorher stand dort „ab 2.499 €“).
  ok(GLOBAL_WOERTER.de.metaTitel === VERKAUF_TEXTE.de.seo.titel && GLOBAL_WOERTER.de.metaBeschreibung === VERKAUF_TEXTE.de.seo.beschreibung
    && GLOBAL_WOERTER.en.metaTitel === VERKAUF_TEXTE.en.seo.titel && GLOBAL_WOERTER.en.metaBeschreibung === VERKAUF_TEXTE.en.seo.beschreibung,
    "i18n/global.ts: metaTitel/metaBeschreibung der Startseite weichen von VERKAUF_TEXTE.seo ab");
  // Der Paket-Finder ist der Konfigurator: Die alten Adressen leiten dauerhaft weiter, sind keine Seiten mehr und werden nirgends verlinkt.
  ok(GLOBAL_UMGEZOGEN["/business/paket-finder"] === "/business/start" && GLOBAL_UMGEZOGEN["/en/business/package-finder"] === "/en/business/start",
    "GLOBAL_UMGEZOGEN: /business/paket-finder und /en/business/package-finder führen nicht auf den Konfigurator");
  const alleTexte = JSON.stringify([GLOBAL_SEITEN, GLOBAL_SEITEN_EN, LANDINGPAGES, GLOBAL_MENUE]);
  for (const [alt, ziel] of Object.entries(GLOBAL_UMGEZOGEN)) {
    ok(alt === alt.toLowerCase() && !alt.endsWith("/"), `GLOBAL_UMGEZOGEN: Schlüssel ${alt} ist nicht klein geschrieben oder endet auf „/“ (die Route schlägt klein und ohne Schrägstrich nach)`);
    ok(!seitenPfade.has(alt) && !GLOBAL_SEITEN_EN.some((s) => s.pfad === alt), `${alt}: leitet weiter und steht trotzdem im Register`);
    ok(!seiteUnbekannt(ziel), `${alt} → ${ziel}: das Ziel kennt der Server nicht (404)`);
    ok(!alleTexte.includes(`"${alt}"`), `${alt}: wird von einer Seite oder vom Menü noch verlinkt (Weiterlesen, Karte, Verzeichnis)`);
    ok(!(alt in GLOBAL_EN_PFADE) && !Object.values(GLOBAL_EN_PFADE).includes(alt), `${alt}: steht noch als Sprachpaar in GLOBAL_EN_PFADE`);
    ok(!seoIndexierbar().some((x: any) => x.pfad === alt), `${alt}: steht noch in der Sitemap`);
  }
  const routen = fs.readFileSync(path.join(WURZEL, "server/routes.ts"), "utf8");
  const tabelleAb = routen.indexOf("const UMGEZOGEN: Record<string, string> = {");
  const tabelleEnde = routen.indexOf("};", tabelleAb);
  ok(tabelleAb > -1 && routen.slice(tabelleAb, tabelleEnde).includes("...GLOBAL_UMGEZOGEN") && routen.indexOf("app.get(Object.keys(UMGEZOGEN)") > tabelleEnde
    && routen.indexOf("app.get(Object.keys(UMGEZOGEN)") < routen.lastIndexOf("app.get('*', async (req, res, next) => {"),
    "routes.ts: GLOBAL_UMGEZOGEN fehlt in der Tabelle UMGEZOGEN oder die Weiterleitung steht hinter dem Vorrenderer (app.get('*'))");
  // Auch außerhalb des Registers zeigt kein Baustein mehr auf den Paket-Finder oder auf „Pakete und Preise“.
  for (const datei of ["client/src/components/GlassNav.tsx", "client/src/components/site/GlobalNav.tsx", "client/src/components/site/GlobalFuss.tsx", "client/src/pages/not-found.tsx",
    "client/src/pages/site/global-seite.tsx", "client/src/pages/site/global-lp.tsx", "client/src/pages/site/business.tsx", "client/src/pages/site/ratgeber-artikel.tsx", "client/src/pages/site/global-recht.tsx"]) {
    const ohneKommentar = fs.readFileSync(path.join(WURZEL, datei), "utf8").replace(/\/\*[\s\S]*?\*\//g, " ").split("\n").filter((z) => !/^\s*\/\//.test(z)).join("\n");
    const fund = ohneKommentar.match(/\/business\/paket-finder(?!")|\/en\/business\/package-finder|href=[^>]{0,40}#pakete|Pakete und Preise|Packages and prices|knopfPakete\}|Pakete ansehen|vier Pakete/);
    ok(!fund, `${datei}: zeigt noch auf den Paket-Finder oder die Pakete („${fund?.[0]}“)`);
  }
  console.log(`  ${GLOBAL_SEITEN.length + GLOBAL_SEITEN_EN.length + LANDINGPAGES.length} Seiten ohne Paket, ${Object.keys(GLOBAL_UMGEZOGEN).length} Weiterleitungen, Vorab-HTML und /llms.txt geprüft`);
}

// ═══ 14: LEITPLANKE — „BÜRGSCHAFT“ STEHT NICHT AUF ÖFFENTLICHEN SEITEN (12.11.2026, E-509) ═══════════════
// Regel der Firma (30.10.2026, gilt weiter): Die Bürgschaft der US-Partnergesellschaft wird öffentlich nicht beworben; sie steht
// nur im persönlichen Angebot (Vertrag der Fassung C). Mit dem einen Produkt war sie auf Unterseiten geraten („Erfolgshonorar,
// Bürgschaft enthalten“, „mit der Bürgschaft unserer US-Partnergesellschaft“). Diese Wand liest jede Seite des Registers
// (deutsch und englisch), die Anzeigenseiten, das Menü und das Vorab-HTML samt Datenblock.
// Zwei Stufen:
//   · Streng (das Wort kommt gar nicht vor): jede Seite, die verkauft oder beschreibt, was FIAON tut — Leistungen, Zielgruppen,
//     Länder, Kosten, Ablauf, Vergleich, Anzeigenseiten, Menü, Fußzeile, Startseite, Konfigurator, „Ihr Vertrag im Überblick“.
//   · Satz für Satz: Wissens-Artikel und die Fragen-Übersicht (sie sammelt deren Fragen) dürfen das Wort ALLGEMEIN erklären
//     („Bürgschaft der Muttergesellschaft gegenüber einer Bank“, die Bürgen der SBA) — das ist keine Werbung für unsere
//     Bürgschaft. Ein Satz mit dem Wort darf dort weder FIAON noch „wir/unser“ noch eine Partnergesellschaft noch Honorar
//     oder „enthalten“ nennen.
// Startseite und Konfigurator liest außerdem scripts/pruef-verkaufsmotor.ts Satz für Satz aus der Quelle (Abschnitt 10).
abschnitt("Leitplanke: keine Bürgschaft von FIAON auf öffentlichen Seiten");
{
  const { GLOBAL_SEITEN_EN } = await import("../shared/fiaon-global-seiten");
  const { seitenHtml } = await import("../server/lib/fiaon-seiten-seo");
  const WORT = /b(ü|ue)rgschaft|b(ü|ue)rgin|\bb(ü|ue)rg(t|en|e)\b|\bB(ü|ue)rgen\b|verb(ü|ue)rg|guarantor|surety|guaranty/i;
  const UNSERE = /FIAON|\bwir\b|\buns\b|\bunser\w*|Partnergesellschaft|Erfolgshonorar|\benthalten\b|inklusive|eingeschlossen|schließt[^.]*\bein\b|\bwe\b|\bour\b|partner company|success fee|\bincluded?\b|\bincludes\b/i;
  const REGISTER = /als inaktiv geführt|listed as inactive|im Register[^.]{0,40}inaktiv|inactive in the register/i;
  const saetze = (text: string) => text.split(/(?<=[.!?…])\s+|\s+[—–]\s+|;\s+|\n+/).map((x) => x.trim()).filter(Boolean);
  const texteVon = (x: unknown, aus: string[] = []): string[] => {
    if (typeof x === "string") aus.push(x);
    else if (Array.isArray(x)) for (const y of x) texteVon(y, aus);
    else if (x && typeof x === "object") for (const [k, v] of Object.entries(x)) if (!["typ", "id", "paket", "pfad", "schwester", "url"].includes(k)) texteVon(v, aus);
    return aus;
  };
  let allgemein = 0;
  // Wo das Wort allgemein erklärt werden darf: Wissens-Artikel und die beiden Fragen-Übersichten.
  const erklaert = new Set<string>([...GLOBAL_SEITEN, ...GLOBAL_SEITEN_EN].filter((s) => s.art === "wissen").map((s) => s.pfad).concat(["/business/fragen", "/en/business/faq"]));
  // Je Ort zwei Prüfungen (Registerstand, Bürgschaft) — gemeldet wird der erste Fund mit seinem Satz.
  const pruefe = (ort: string, texte: string[], streng: boolean) => {
    let register = ""; let fund = "";
    for (const t of texte) {
      register ||= t.match(REGISTER)?.[0] ?? "";
      if (!WORT.test(t)) continue;
      for (const satz of saetze(t)) {
        if (!WORT.test(satz)) continue;
        const wir = satz.match(UNSERE);
        if (streng) fund ||= `„${satz.match(WORT)?.[0]}“ in „${satz.slice(0, 150)}“ (auf dieser Seite steht das Wort gar nicht)`;
        else if (wir) fund ||= `„${satz.match(WORT)?.[0]}“ zusammen mit „${wir[0]}“ in „${satz.slice(0, 150)}“`;
        else allgemein++;
      }
    }
    ok(!register, `${ort}: Hinweis zum Registerstand („${register}“) — er gehört zur Bürgschaft und steht nur im Angebot`);
    ok(!fund, `${ort}: ${fund} — die Bürgschaft wird öffentlich nicht beworben`);
  };
  for (const s of [...GLOBAL_SEITEN, ...GLOBAL_SEITEN_EN, ...LANDINGPAGES] as { pfad: string }[]) pruefe(s.pfad, texteVon(s), !erklaert.has(s.pfad));
  pruefe("Menü", texteVon(GLOBAL_MENUE), true);
  pruefe("Fußzeile", texteVon(GLOBAL_FUSS_WOERTER), true);
  // Vorab-HTML mit Datenblock: derselbe Maßstab auf dem, was Suchmaschinen und Assistenten wirklich bekommen (Text je Element).
  for (const pfad of ["/", "/en", "/business/start", "/en/business/start", "/business/mustervertrag", "/en/business/mustervertrag", ...GLOBAL_SEITEN.map((s) => s.pfad), ...GLOBAL_SEITEN_EN.map((s) => s.pfad), ...LANDINGPAGES.map((l) => l.pfad)]) {
    const html = (seitenHtml(pfad) ?? "").replace(/<style[\s\S]*?<\/style>/g, " ");
    const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap((m) => { try { return texteVon(JSON.parse(m[1])); } catch { return [m[1]]; } });
    const sichtbar = html.replace(/<script[\s\S]*?<\/script>/g, " ").split(/<[^>]+>/).map((x) => x.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim()).filter((x) => x.length > 3);
    pruefe(`${pfad} (Vorab-HTML)`, [...sichtbar, ...ld], !erklaert.has(pfad));
  }
  // Die Probe muss die allgemeinen Erklärungen der Wissens-Artikel wirklich sehen — sonst wäre sie blind.
  ok(allgemein >= 10, `Leitplanke: nur ${allgemein} allgemeine Sätze mit „Bürgschaft“ gefunden — liest die Probe die Wissens-Artikel noch?`);
  // Und sie muss anschlagen, wenn ein Satz unsere Bürgschaft nennt (Selbstprobe mit den Sätzen, die am 12.11.2026 entfernt wurden).
  const frueher = ["Erfolgshonorar nach Ihrem Kapitalrahmen, Bürgschaft enthalten", "Bis zur Finanzierung, mit der Bürgschaft unserer US-Partnergesellschaft", "US-Partnergesellschaft: Bürgschaft für die Finanzierung",
    "Unsere US-Partnergesellschaft übernimmt die Bürgschaft; über die Finanzierung entscheidet das finanzierende Institut.", "Success fee according to your capital range, surety included", "With the surety of our US partner company — the financing institution decides on the financing",
    "Sie wird im Register ihres Bundesstaats derzeit als inaktiv geführt."];
  const schlaegtAn = (t: string) => REGISTER.test(t) || saetze(t).some((x) => WORT.test(x) && UNSERE.test(x));
  ok(frueher.every(schlaegtAn), `Leitplanke: die Probe erkennt einen der früheren Sätze nicht („${frueher.find((t) => !schlaegtAn(t))}“)`);
  const erlaubt = ["Einlage, Bürgschaft der Muttergesellschaft, Immobilie", "Kann eine Muttergesellschaft in Europa für die US-Gesellschaft bürgen?", "Deposit, parent company surety, property"];
  ok(!erlaubt.some(schlaegtAn), `Leitplanke: die Probe schlägt bei einer allgemeinen Erklärung an („${erlaubt.find(schlaegtAn)}“)`);
  ok(erklaert.size >= 20 && !erklaert.has("/business/kosten") && !erklaert.has("/business/ablauf"), `Leitplanke: ${erklaert.size} Seiten dürfen das Wort erklären — Kosten und Ablauf gehören nie dazu`);
  console.log(`  ${GLOBAL_SEITEN.length + GLOBAL_SEITEN_EN.length + LANDINGPAGES.length} Seiten, Menü, Fußzeile und Vorab-HTML gelesen (${GLOBAL_SEITEN.length + GLOBAL_SEITEN_EN.length + LANDINGPAGES.length - erklaert.size} streng); ${allgemein} allgemeine Sätze zum Wort bleiben in Wissens-Artikeln`);
}

// ═══ ERGEBNIS ═══════════════════════════════════════════════════════════════
abschnitt("Ergebnis");
if (hinweise.length) { console.log("  Hinweise (kein Fehler):"); for (const h of hinweise) console.log(`    · ${h}`); }
console.log(`  ${geprueft} Prüfungen, ${fehler} Fehler.`);
process.exit(fehler ? 1 : 0);
