// ═══════════════════════════════════════════════════════════════════════════
// SEO-PRÜFSTAND — die Abnahme vor jedem Deploy der öffentlichen Seiten
// (02.09.2026, E-079)
//
// Zwei Stufen:
//   npx tsx scripts/seo-pruefen.ts            → prüft die Tabelle (offline)
//   npx tsx scripts/seo-pruefen.ts http://localhost:3001
//                                             → holt jede Seite vom laufenden
//                                               Server und prüft das HTML
//
// Was geprüft wird (die Regeln aus dem Onpage-Report vom 02.09.):
//   · Titel 20–60 Zeichen, einmalig auf der ganzen Website
//   · Beschreibung 80–155 Zeichen, einmalig
//   · jede indexierbare Seite hat H1 und Einleitung
//   · Weiterlesen-Ziele existieren in der Tabelle
//   · jede öffentliche Route aus client/src/App.tsx steht in der Tabelle
//   · die generierten FAQ sind aktuell (shared/fiaon-seo-fragen.ts)
//   · online: genau eine H1, Titel/Description wie in der Tabelle,
//     Canonical, JSON-LD parsebar, mindestens 25 interne Links
// Fehler beenden mit Code 1 — damit der Prüfstand in der Abnahme zählt.
// ═══════════════════════════════════════════════════════════════════════════
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { SEO_SEITEN, seoIndexierbar, seoFragen } from "../shared/fiaon-seo-seiten";

const WURZEL = path.resolve(import.meta.dirname, "..");
const fehler: string[] = [];
const hinweise: string[] = [];
const f = (m: string) => fehler.push(m);

// ── Stufe 1: die Tabelle ─────────────────────────────────────────────────────
const titel = new Map<string, string>();
const beschr = new Map<string, string>();
for (const s of Object.values(SEO_SEITEN)) {
  const index = !String(s.robots ?? "").includes("noindex");
  if (s.titel.length > 60) f(`${s.pfad}: Titel ${s.titel.length} Zeichen (max 60): „${s.titel}"`);
  if (index && s.titel.length < 20) f(`${s.pfad}: Titel zu kurz (${s.titel.length})`);
  if (s.beschreibung.length > 155) f(`${s.pfad}: Beschreibung ${s.beschreibung.length} Zeichen (max 155)`);
  if (index && s.beschreibung.length < 80) f(`${s.pfad}: Beschreibung zu kurz (${s.beschreibung.length})`);
  if (titel.has(s.titel)) f(`${s.pfad}: Titel doppelt mit ${titel.get(s.titel)}`); else titel.set(s.titel, s.pfad);
  if (index) { if (beschr.has(s.beschreibung)) f(`${s.pfad}: Beschreibung doppelt mit ${beschr.get(s.beschreibung)}`); else beschr.set(s.beschreibung, s.pfad); }
  if (!s.h1 || !s.lead) f(`${s.pfad}: H1 oder Einleitung fehlt`);
  if (s.h1.length > 120) hinweise.push(`${s.pfad}: H1 länger als 120 Zeichen`);
  for (const w of s.weiter ?? []) if (!SEO_SEITEN[w]) f(`${s.pfad}: Weiterlesen-Ziel ${w} fehlt in der Tabelle`);
  for (const k of s.krumen ?? []) if (!SEO_SEITEN[k.pfad]) f(`${s.pfad}: Brotkrume ${k.pfad} fehlt in der Tabelle`);
  if (s.canonical && !SEO_SEITEN[s.canonical]) f(`${s.pfad}: Canonical-Ziel ${s.canonical} fehlt`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.stand)) f(`${s.pfad}: Stand kein Datum`);
  if (index && s.art !== "recht" && s.art !== "intern" && (s.weiter?.length ?? 0) < 3) hinweise.push(`${s.pfad}: nur ${s.weiter?.length ?? 0} Weiterlesen-Links`);
  const fragen = seoFragen(s.pfad);
  for (const q of fragen) if (!q.f.trim() || q.a.length < 40) hinweise.push(`${s.pfad}: dünne FAQ-Antwort „${q.f}"`);
}

// Jede öffentliche Route aus App.tsx muss geführt sein.
const app = fs.readFileSync(path.join(WURZEL, "client/src/App.tsx"), "utf8");
const routen = [...app.matchAll(/<Route path="(\/[^":]*)"/g)].map((m) => m[1])
  .filter((p) => !/^\/(admin|agent|chef|dashboard|mein-bereich|zahlung|termin|api|nummer|kunde|space|academy|test)/.test(p))
  .filter((p) => !p.includes(":"));
for (const r of new Set(routen)) if (!SEO_SEITEN[r] && r !== "/ratgeber" && r !== "/dashboard-alt") hinweise.push(`Route ${r} hat keinen Tabelleneintrag (bekommt Standardkopf)`);

// Generierte FAQ aktuell?
try { execSync("npx tsx scripts/seo-fragen-erzeugen.ts --pruefen", { cwd: WURZEL, stdio: "pipe" }); }
catch { f("shared/fiaon-seo-fragen.ts ist veraltet — npx tsx scripts/seo-fragen-erzeugen.ts"); }

console.log(`Tabelle: ${Object.keys(SEO_SEITEN).length} Seiten, ${seoIndexierbar().length} indexierbar.`);

// ── Stufe 2: das ausgelieferte HTML ──────────────────────────────────────────
// Entweder vom laufenden Server (Adresse als Argument) oder — mit --render —
// direkt aus dem Vorrenderer. Letzteres ist die Abnahme vor dem Deploy: Ein
// zweiter Produktionsserver gegen die echte Datenbank würde alle Takte
// (Mahnungen, Lastschriften, Wise-Verbuchung) doppelt laufen lassen.
const basis = process.argv[2];
const AUSGABE = path.join(WURZEL, "scripts", "tmp", "seo-render");
async function online() {
  if (!basis) return;
  const rendern = basis === "--render";
  const seiten = [...seoIndexierbar().map((s) => s.pfad), "/ratgeber"];
  let seitenHtml: ((p: string) => string | null) | null = null;
  let ratgeberSeitenHtml: ((slug: string | null) => Promise<string | null>) | null = null;
  if (rendern) {
    ({ seitenHtml } = await import("../server/lib/fiaon-seiten-seo"));
    ({ ratgeberSeitenHtml } = await import("../server/lib/fiaon-ratgeber-seo"));
    fs.mkdirSync(AUSGABE, { recursive: true });
    // Auch drei Artikel prüfen — die Titel-Länge war der häufigste Fund.
    const { sqlPool } = await import("../server/lib/db-pool");
    const rows = (await sqlPool`SELECT slug FROM fiaon_ratgeber WHERE status = 'veroeffentlicht' ORDER BY length(titel) DESC LIMIT 3`) as { slug: string }[];
    for (const r of rows) seiten.push(`/ratgeber/${r.slug}`);
  }
  let ok = 0;
  for (const pfad of seiten) {
    const s = SEO_SEITEN[pfad];
    let html = "";
    try {
      if (rendern) {
        const h = pfad.startsWith("/ratgeber") ? await ratgeberSeitenHtml!(pfad === "/ratgeber" ? null : pfad.slice("/ratgeber/".length)) : seitenHtml!(pfad);
        if (!h) { f(`${pfad}: Vorrenderer liefert nichts`); continue; }
        html = h;
        fs.writeFileSync(path.join(AUSGABE, pfad.replace(/\//g, "_").replace(/^_/, "") || "start") + ".html", html);
      } else {
        const r = await fetch(`${basis}${pfad}`, { headers: { accept: "text/html" } });
        if (r.status !== 200) { f(`${pfad}: HTTP ${r.status}`); continue; }
        html = await r.text();
      }
    } catch (e) { f(`${pfad}: nicht erreichbar (${(e as Error).message})`); continue; }
    const t = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
    const d = html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "";
    const canon = html.match(/<link rel="canonical" href="([^"]*)"/)?.[1] ?? "";
    const h1 = html.match(/<h1[^>]*>/g)?.length ?? 0;
    const links = new Set([...html.matchAll(/href="(\/[^"#?]*)"/g)].map((m) => m[1]));
    const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/g, " ").replace(/\s+/g, " ");
    const tEntsch = t.replace(/&amp;/g, "&").replace(/&quot;/g, '"');
    if (s && tEntsch !== s.titel) f(`${pfad}: Titel weicht ab: „${t}"`);
    if (tEntsch.length > 60) f(`${pfad}: Titel ${tEntsch.length} Zeichen: „${tEntsch}"`);
    const dEntsch = d.replace(/&amp;/g, "&").replace(/&quot;/g, '"');
    if (dEntsch.length > 160) f(`${pfad}: Beschreibung ${dEntsch.length} Zeichen`);
    if (!canon) f(`${pfad}: Canonical fehlt`);
    if (h1 !== 1) f(`${pfad}: ${h1} H1 statt 1`);
    if (links.size < 25) f(`${pfad}: nur ${links.size} interne Links`);
    if (text.length < 1500) f(`${pfad}: nur ${text.length} Zeichen Text`);
    if (!d) f(`${pfad}: Beschreibung fehlt`);
    if ((html.match(/name="robots"/g)?.length ?? 0) !== 1) f(`${pfad}: robots-Angabe fehlt oder doppelt`);
    if ((html.match(/"@type":"Organization"/g)?.length ?? 0) !== 1) f(`${pfad}: Organization-Markup ${html.match(/"@type":"Organization"/g)?.length ?? 0}× statt 1×`);
    for (const block of ld) { try { JSON.parse(block); } catch { f(`${pfad}: JSON-LD nicht parsebar`); } }
    ok++;
  }
  console.log(`${rendern ? "Vorgerendert" : "Online"} geprüft: ${ok}/${seiten.length} Seiten${rendern ? ` (HTML unter ${path.relative(WURZEL, AUSGABE)})` : ` unter ${basis}`}.`);
  if (rendern) { const { sqlPool } = await import("../server/lib/db-pool"); await sqlPool.end(); }
}

await online();
for (const h of hinweise) console.log(`  Hinweis: ${h}`);
if (fehler.length) { for (const e of fehler) console.error(`  FEHLER: ${e}`); console.error(`${fehler.length} Fehler.`); process.exit(1); }
console.log("SEO-Prüfstand: keine Fehler.");
