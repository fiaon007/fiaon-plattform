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
import { GLOBAL_JAHRESBETREUUNG, GLOBAL_KAPITAL_FREI, globalJahresbetreuungPreisText } from "../shared/fiaon-global";
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
  // 24.09.2026 (E-234): die englische Vorlage, die Adresspaare und die englischen Registerdateien.
  "client/src/i18n/global-seite.ts", "shared/fiaon-global-pfade.ts",
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
ok(/globalKapitalSpanne\(s\)/.test(hubSeite.slice(0, hubSeite.indexOf('id="leistungen"'))) && /abPreis/.test(hubSeite.slice(0, hubSeite.indexOf('id="leistungen"'))), "/business: Kapitalrahmen oder Festpreis fehlen im Kopf");
const einstieg = String(Math.round((PAKETE.find((x) => x.key === "global_struktur")?.preisCents ?? 0) / 100).toLocaleString("de-DE"));
ok(GLOBAL_WOERTER.de.metaTitel.includes(einstieg) && String(tabelle["/business"]?.titel).includes(einstieg), `/business: Titel nennt nicht den Einstiegspreis ${einstieg} € (Seite und SEO-Tabelle)`);
ok(GLOBAL_WOERTER.de.metaTitel === tabelle["/business"]?.titel && GLOBAL_WOERTER.en.metaTitel === tabelle["/business"]?.en?.titel, "/business: Titel der Seite und der SEO-Tabelle weichen voneinander ab");

// ═══ 9: JAHRESBETREUUNG, UHREN, NACHRICHTENLAGE, STARTSEITE PRIVATPERSONEN (19.09.2026, E-196) ═══
abschnitt("E-196: Jahresbetreuung, Uhren, Nachrichtenlage, Privatpersonen");
{
  // Jahresbetreuung: ein Preis, eine Quelle, auf jeder Seite.
  ok(GLOBAL_JAHRESBETREUUNG.preisCents === 69900, `Jahresbetreuung: Preis ${GLOBAL_JAHRESBETREUUNG.preisCents} statt 69900`);
  for (const sp of ["de", "en"] as const) {
    const j = GLOBAL_JAHRESBETREUUNG[sp];
    const jt = [j.kurz, j.lead, ...j.leistungen, j.bedingungen, j.buchen, j.gebucht, j.nichtHeute].join("\n");
    // 24.09.2026 (E-234): die englische Hälfte mit den englischen Regeln — die deutschen fanden in ihr nichts.
    const funde = sp === "en" ? globalWortPruefenEn(jt) : globalWortPruefen(jt);
    ok(funde.length === 0, `Jahresbetreuung (${sp}) verletzt die Wortregeln: ${funde.map((x) => x.treffer).join(", ")}`);
    ok(/Staatsgeb|state fee/i.test(j.leistungen.join(" ")), `Jahresbetreuung (${sp}): die Staatsgebühr fehlt in den Leistungen`);
    ok(/nicht von selbst|does not renew/i.test(j.bedingungen), `Jahresbetreuung (${sp}): „verlängert sich nicht von selbst" fehlt`);
  }
  for (const datei of ["client/src/pages/site/business.tsx", "client/src/pages/site/global-seite.tsx", "client/src/pages/site/global-lp.tsx"]) {
    ok(fs.readFileSync(path.join(WURZEL, datei), "utf8").includes("<GlobalJahresbetreuung"), `${datei}: der Block Jahresbetreuung fehlt`);
  }
  // Startseite für Privatpersonen: eigene Route vor /business/:slug, jede Tafel führt in den Auftrag als Privatperson.
  const app = fs.readFileSync(path.join(WURZEL, "client/src/App.tsx"), "utf8");
  ok(app.includes(`path="/business/privatpersonen" component={BusinessPrivatPage}`) && app.indexOf(`path="/business/privatpersonen"`) < app.indexOf(`path="/business/:slug"`),
    "App.tsx: /business/privatpersonen führt nicht auf die Startseite für Privatpersonen (oder steht hinter /business/:slug)");
  const hub = fs.readFileSync(path.join(WURZEL, "client/src/pages/site/business.tsx"), "utf8");
  ok(/globalStartPfad\(paket, s, privat \? "privat" : undefined\)/.test(hub), "business.tsx: die Pakete der Privatpersonen-Seite führen nicht in den Auftrag als Privatperson");
  ok(globalStartPfad("global_kapital", "de", "privat").endsWith("paket=global_kapital&art=privat"), "globalStartPfad: art=privat fehlt");
  const privatEintrag = GLOBAL_SEITEN.find((x) => x.pfad === "/business/privatpersonen");
  ok(!!privatEintrag && GLOBAL_WOERTER.de.privat.metaTitel === privatEintrag.seo.titel && GLOBAL_WOERTER.de.privat.metaBeschreibung === privatEintrag.seo.beschreibung,
    "Privatpersonen: Titel/Beschreibung der Startseite weichen vom Registereintrag (Vorab-HTML) ab");
  // Die drei Uhren: Deutschland, Florida, London — in beiden Sprachen dieselben Zonen.
  for (const sp of ["de", "en"] as const) {
    ok(JSON.stringify(GLOBAL_WOERTER[sp].uhren.map((u) => u.zone)) === JSON.stringify(["Europe/Berlin", "America/New_York", "Europe/London"]), `Uhren (${sp}): Zonen stimmen nicht`);
  }
  // Das Menü (auf jeder Business-Seite) führt zur Jahresbetreuung — mit demselben Preis.
  const jbMenue = GLOBAL_MENUE.find((x) => x.pfad === "/business#jahresbetreuung");
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
    const markup = seoFragen(sp === "de" ? "/business" : "/en/business");
    ok(markup.some((x) => x.f === k.frage && x.a === k.antwort), `FAQ-Markup ${sp === "de" ? "/business" : "/en/business"}: Frage zum Kapital fehlt — npx tsx scripts/seo-fragen-erzeugen.ts`);
  }
  // Die Hauptseite liest die Quelle: am Kapitalrahmen im Kopf (mit Fußnote) und unter den Pakettafeln.
  const kopf = hubSeite.slice(0, hubSeite.indexOf('id="leistungen"'));
  ok(/GLOBAL_KAPITAL_FREI\[s\]/.test(hubSeite) && /\{frei\.kurz\}/.test(kopf) && /\{frei\.satz\} \{frei\.steuer\}/.test(kopf), "/business: der Hinweis am Kapitalrahmen oder seine Fußnote (GLOBAL_KAPITAL_FREI) fehlt im Kopf");
  const tafelnFuss = hubSeite.slice(hubSeite.indexOf('className="fg-paket-fuss"'), hubSeite.indexOf('className="fg-inkl"'));
  ok(/fg-paket-europa/.test(tafelnFuss) && /\{frei\.satz\} \{frei\.steuer\}/.test(tafelnFuss), "/business: die Zeile unter den Pakettafeln (GLOBAL_KAPITAL_FREI) fehlt");
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
    ok((t.krumen ?? []).every((k: any) => k.pfad.startsWith("/en/business")) && (t.krumen ?? [])[0]?.pfad === "/en/business", `${w}: Brotkrumen führen aus der englischen Welt`);
    // Vorab-HTML: Sprache, hreflang-Trio, keine deutschen Business-Links, kein „(in German)", englisches Angebot.
    const html = seitenHtml(w) ?? "";
    ok(html.includes('<html lang="en">') && html.includes(`hreflang="en" href="${SEO_BASIS}${w}"`) && html.includes(`hreflang="de" href="${SEO_BASIS}${e.schwester}"`) && html.includes(`hreflang="x-default" href="${SEO_BASIS}${e.schwester}"`), `${w}: html lang oder hreflang-Trio fehlt`);
    const vorab = html.split('<div class="vorab">')[1] ?? html.split('<div id="root">')[1] ?? "";
    const deutscheLinks = [...vorab.matchAll(/href="(\/business[^"]*)"/g)].map((m) => m[1]);
    ok(deutscheLinks.length === 0, `${w}: Vorab-HTML verlinkt deutsche Business-Seiten (${deutscheLinks.slice(0, 3).join(", ")})`);
    ok(!/\(in German\)|Kurz beantwortet|Weiterlesen|Häufige Fragen/.test(html), `${w}: deutsche Rahmenwörter im Vorab-HTML`);
    if (["leistung", "preise", "zielgruppe", "land"].includes(e.art)) ok(html.includes(`"@id":"${SEO_BASIS}/en/business#leistung"`) && !html.includes(`${SEO_BASIS}/business/start?paket=`), `${w}: Service-Markup nicht englisch`);
    // Die deutsche Schwester nennt die englische.
    const htmlDe = seitenHtml(e.schwester ?? "") ?? "";
    ok(htmlDe.includes(`hreflang="en" href="${SEO_BASIS}${w}"`), `${e.schwester}: hreflang auf ${w} fehlt`);
  }
  // Menü: englische Pfade führen auf englische Seiten (oder Anker der englischen Übersicht), Längen passen ins Panel.
  for (const g of globalMenue("en")) for (const m of g.eintraege) {
    const basis = m.pfad.split("#")[0];
    ok(basis === "/en/business" || enPfade.has(basis), `Menü (en) „${m.titel}" → ${m.pfad} ist keine englische Seite`);
    ok(m.titel.length <= 30 && m.text.length <= 52, `Menü (en) „${m.titel}": Titel oder Zeile zu lang für das Panel`);
    ok(globalWortPruefenEn(`${m.titel}\n${m.text}`).length === 0, `Menü (en) „${m.titel}": ${globalWortPruefenEn(`${m.titel}\n${m.text}`).map((f) => f.hinweis).join("; ")}`);
  }
  const jbEn = globalMenue("en").flatMap((g) => g.eintraege).find((m) => m.pfad === "/en/business#jahresbetreuung");
  ok(!!jbEn && jbEn.text.includes(globalJahresbetreuungPreisText("en")), "Menü (en): Jahresbetreuung fehlt oder nennt einen anderen Preis");
  // Übersicht /en/business: „Who it is for" und die Länder führen auf englische Seiten; Privatpersonen: Kopf = Register.
  for (const k of GLOBAL_WOERTER.en.fuer) ok(!!k.pfad && enPfade.has(k.pfad), `/en/business „Who it is for": ${k.tag} → ${k.pfad || "(leer)"}`);
  for (const [ziel] of GLOBAL_WOERTER.en.fuerLaenderLinks) ok(enPfade.has(ziel), `/en/business: ${ziel} gibt es nicht`);
  const privatEn = GLOBAL_SEITEN_EN.find((x) => x.pfad === "/en/business/private-individuals");
  ok(!!privatEn && privatEn.auftraggeber === "privat" && GLOBAL_WOERTER.en.privat.metaTitel === privatEn.seo.titel && GLOBAL_WOERTER.en.privat.metaBeschreibung === privatEn.seo.beschreibung,
    "Private individuals: Titel/Beschreibung der Startseite weichen vom englischen Registereintrag ab (oder art privat fehlt)");
  ok(GLOBAL_WOERTER.en.standorteVerbunden === (await import("../shared/fiaon-global-partner")).GLOBAL_VERBUNDEN_EN, "i18n/global.ts en.standorteVerbunden weicht von GLOBAL_VERBUNDEN_EN ab");
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

// ═══ ERGEBNIS ═══════════════════════════════════════════════════════════════
abschnitt("Ergebnis");
if (hinweise.length) { console.log("  Hinweise (kein Fehler):"); for (const h of hinweise) console.log(`    · ${h}`); }
console.log(`  ${geprueft} Prüfungen, ${fehler} Fehler.`);
process.exit(fehler ? 1 : 0);
