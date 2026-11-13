/**
 * VORSCHAUBILDER JE BUSINESS-SEITE (27.10.2026, E-439)
 *
 * Justin: „Jeder Link, den wir vom Business teilen, soll darauf aufbauen und so aussehen.“
 * Bis heute trugen alle Business-Seiten dasselbe Bild (og-global.jpg); die Artikel der
 * Redaktion trugen gar keins und erbten das Bonitäts-Bild aus index.html.
 *
 * Dieses Skript baut für jede Business-Adresse ein eigenes 1200×630-Bild im Design von
 * /business (helles Papier, Newsreader, EINE navyblaue Glaskarte „Auf einen Blick“) und
 * schreibt die Liste aller Bilder nach shared/fiaon-og-business.ts (GENERIERT — nie von Hand).
 *
 *   npx tsx scripts/og-business-bilder.ts                       → alle Bilder neu
 *   npx tsx scripts/og-business-bilder.ts --nur /business/kosten → nur diese Seite (Probe)
 *   npx tsx scripts/og-business-bilder.ts --ziel /tmp/og         → woanders hin (zum Ansehen)
 *   npx tsx scripts/og-business-bilder.ts --artikel datei.json   → auch die Redaktionsartikel
 *        (datei.json = [{ slug, titel, sprache }] aus fiaon_ratgeber, bereich business, nur lesend geholt)
 *
 * Nur lokal; braucht das Playwright-Chromium (PLAYWRIGHT_BROWSERS_PATH=~/Developer/fiaon-plattform/.playwright)
 * und Netz für Google Fonts (Inter, Newsreader). Neue Seite im Register → Skript laufen lassen,
 * sonst meldet scripts/pruef-og-business.ts sie als „ohne eigenes Bild“.
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { GLOBAL_SEITEN, GLOBAL_SEITEN_EN, type GlobalSeite } from "../shared/fiaon-global-seiten";
import { LANDINGPAGES } from "../shared/fiaon-global-seiten/landingpages";
// E-509 (12.11.2026): EIN Produkt statt vier Pakete — die Überschrift der Startseite aus der einen Quelle
// (vorher: „Festpreis ab <Global Struktur>, alles inklusive“ und der Hero-Wortlaut vor E-509 von Hand).
// E-510 (13.11.2026, Sprachleitfaden 7.9): Im Vorschaubild steht KEIN Betrag mehr (vorher „2.799 € mit Ihrem Auftrag“ —
// ein Betrag ohne die beiden anderen Honorarzeilen), kein „Team vor Ort in Miami“, kein „Ein Ansprechpartner statt acht“.
// Die drei Zeilen der Leiste sind die des Leitfadens. Die Bilder selbst entstehen erst mit dem nächsten Lauf dieses Skripts.
import { VERKAUF_TEXTE } from "../shared/fiaon-global-verkauf";
import { markeSvg } from "../shared/fiaon-marke";
import { ogDateiName, ogArtikelSchluessel, OG_BUSINESS_REDAKTION } from "../shared/fiaon-og-business-regeln";

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const ROOT = process.cwd();
const ZIEL = arg("--ziel") || join(ROOT, "client/public/og/business");
const NUR = arg("--nur");
const ARTIKEL = arg("--artikel");
mkdirSync(ZIEL, { recursive: true });

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

type Sprache = "de" | "en";
interface Bild {
  pfad: string;
  sprache: Sprache;
  auge: string;
  h1: string;
  h1b?: string;
  kennung?: string;
  zeilen: [string, string][];
  kartenTitel: string;
  alt: string;
  /** Eigene Leiste unten (sonst WORT[sprache].konzept) — für die Anzeigen-Landingpages (E-466). */
  konzept?: readonly string[];
}

const WORT = {
  de: {
    // Die drei Zeilen der Leiste — wortgleich aus dem Sprachleitfaden (7.9), ohne Betrag.
    konzept: ["Ein Mandat, ein Ansprechpartner", "Honorar vor der Unterschrift", "FIAON LTD, London"],
    blick: "Auf einen Blick",
    konzeptKarte: "Ihr Mandat",
    // Zeile 3 nennt, wer entscheidet (Leitfaden 5.1): nie „Konten und Karten“ ohne das Institut.
    konzeptZeilen: [["Gründung", "Ihre LLC in Delaware, Florida oder Wyoming"], ["Steuernummern", "EIN und ITIN — wir beantragen sie"], ["Konten und Karten", "Wir bereiten vor, das Institut entscheidet"], ["Ansprechpartner", "Ein fester Ansprechpartner für Ihr Mandat"]] as [string, string][],
    redaktion: "Aktuell aus der Redaktion",
    // E-466 (30.10.2026): Hinter einer Meta-Anzeige darf im Blickfang nichts von Konto, Karte oder Kapital stehen (E-233)
    // und kein „Team vor Ort in Miami“. E-510: auch kein Betrag (ein Betrag stünde ohne das Erfolgshonorar da) und kein
    // Satz zur Reise — vorher „2.799 €, erstes Jahr inklusive“ und „In der Regel ohne Reise“.
    lpKonzept: ["Ein Mandat, ein Ansprechpartner", "Honorar vor der Unterschrift", "FIAON LTD, London"],
    lpZeilen: [["Gründung", "Ihre LLC in Delaware, Florida oder Wyoming"], ["Steuernummern", "EIN und ITIN — wir beantragen sie"], ["Ansprechpartner", "Ein fester Ansprechpartner für Ihr Mandat"]] as [string, string][],
  },
  en: {
    konzept: ["One engagement, one dedicated contact", "Fees set out before you sign", "FIAON LTD, London"],
    blick: "At a glance",
    konzeptKarte: "Your engagement",
    konzeptZeilen: [["Formation", "Your LLC in Delaware, Florida or Wyoming"], ["Tax numbers", "EIN and ITIN — we apply for them"], ["Accounts and cards", "We prepare, the institution decides"], ["Your contact", "One dedicated contact for your engagement"]] as [string, string][],
    redaktion: "Latest from the editorial team",
  },
} as const;

/** Der Pfad, wie er unten im Bild steht — kurz genug für eine Zeile. */
function adresse(pfad: string): string {
  if (pfad.startsWith("artikel:") || pfad.includes("~redaktion")) return pfad.startsWith("/en") ? "fiaon.com/en/business/knowledge" : "fiaon.com/business/wissen";
  // 29.10.2026 (E-461): Die Übersichten sind die Startseite — im Bild steht ihre echte Adresse, nicht der alte Schlüssel /business.
  if (pfad === "/business") return "fiaon.com";
  if (pfad === "/en/business") return "fiaon.com/en";
  const a = `fiaon.com${pfad}`;
  return a.length <= 52 ? a : `fiaon.com${pfad.split("/").slice(0, 3).join("/")}/…`;
}

function ausRegister(s: GlobalSeite): Bild {
  const sp: Sprache = s.sprache === "en" ? "en" : "de";
  const w = WORT[sp];
  // E-510: Im Bild steht kein Betrag — eine Zeile mit Betrag würde nach zwei Zeilen abgeschnitten und zeigte nur den ersten
  // Teil des Honorars (Sprachleitfaden 7.9). Zeilen mit einem Euro-Betrag bleiben darum der Seite vorbehalten.
  const zeilen = (s.blick ?? []).filter(([, wert]) => !/€|EUR/.test(wert)).slice(0, 3);
  return {
    pfad: s.pfad, sprache: sp, auge: s.auge, h1: s.h1, h1b: s.h1b, kennung: s.kennung,
    zeilen: zeilen.length >= 2 ? zeilen : w.konzeptZeilen.slice(0, 3),
    kartenTitel: zeilen.length >= 2 ? w.blick : w.konzeptKarte,
    alt: `${s.h1}${s.h1b ? " " + s.h1b : ""} — FIAON Global`,
  };
}

// E-510 (13.11.2026): Unten rechts stand auf JEDEM Bild „DE · AT · CH“ — auch neben „Konten und Karten“ oder einer Überschrift
// zu Firmenkreditkarten und Finanzierung. Österreich und die Schweiz stehen nie im selben Blick wie Konto, Karte oder
// Finanzierung (Sprachleitfaden 5.12, 7.9 und 9.1 Nr. 8: „Im Zweifel die Länder weglassen.“). Die Zeile ist deshalb entfallen;
// die Leiste nennt mit „FIAON LTD, London“ den Vertragspartner. (Die Klasse .land im Stilblatt oben bleibt ungenutzt stehen.)
function html(b: Bild): string {
  const w = WORT[b.sprache];
  const marke = markeSvg("global", "#0c1a2e", "34px");
  // Titel: je länger, desto kleiner — immer höchstens vier Zeilen.
  const laenge = b.h1.length + (b.h1b?.length ?? 0);
  const groesse = laenge <= 38 ? 64 : laenge <= 56 ? 56 : laenge <= 76 ? 49 : laenge <= 98 ? 43 : 38;
  const zeilen = b.zeilen.map(([l, v]) => `<div class="z"><span>${esc(l)}</span><b>${esc(v)}</b></div>`).join("");
  return `<!doctype html><html lang="${b.sprache}"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;1,6..72,300;1,6..72,400&display=block" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1200px;height:630px;overflow:hidden}
body{position:relative;font-family:Inter,sans-serif;color:#3b4658;font-weight:300;
  background:
    radial-gradient(700px 420px at 88% 8%, rgba(40,141,250,.16), transparent 62%),
    radial-gradient(520px 380px at 6% 100%, rgba(29,78,216,.07), transparent 60%),
    #f5f6f8}
.raster{position:absolute;inset:0;background-image:linear-gradient(rgba(12,26,46,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(12,26,46,.045) 1px,transparent 1px);background-size:72px 72px;mask-image:linear-gradient(90deg,transparent,#000 45%,#000)}
.links{position:absolute;left:72px;top:58px;width:610px;bottom:132px;display:flex;flex-direction:column}
.marke{display:flex;align-items:center;gap:14px}
.auge{margin-top:46px;display:flex;align-items:center;gap:14px;font-size:15px;font-weight:500;letter-spacing:.2em;text-transform:uppercase;color:#12284a}
.auge:before{content:"";width:34px;height:1.5px;background:#12284a;opacity:.7}
h1{margin-top:20px;font-family:Newsreader,Georgia,serif;font-weight:300;font-size:${groesse}px;line-height:1.06;letter-spacing:-.022em;color:#0c1a2e;text-wrap:balance}
h1 i{display:block;font-style:italic;font-weight:300;color:#12284a}
.unten{position:absolute;left:72px;right:64px;bottom:50px;display:flex;justify-content:space-between;align-items:center;gap:20px}
.konzept{display:flex;gap:10px}
.konzept span{display:flex;align-items:center;gap:8px;padding:10px 16px;border-radius:999px;background:rgba(255,255,255,.86);border:1px solid #e2e6ed;font-size:15px;font-weight:500;color:#12284a;white-space:nowrap}
.konzept span:before{content:"";width:7px;height:7px;border-radius:50%;background:#288dfa;box-shadow:0 0 0 3px rgba(40,141,250,.16)}
.land{font-size:13px;font-weight:500;letter-spacing:.18em;color:#5b6576;white-space:nowrap}
.karte{position:absolute;right:64px;top:70px;width:410px;border-radius:22px;overflow:hidden;
  background:linear-gradient(160deg,#16305a,#0b1c36);box-shadow:0 34px 70px -28px rgba(11,28,54,.55),0 2px 0 rgba(255,255,255,.08) inset}
.karte:before{content:"";position:absolute;inset:0;background:radial-gradient(120% 80% at 18% 0%,rgba(96,150,255,.32),transparent 60%);pointer-events:none}
.kk{position:relative;display:flex;justify-content:space-between;align-items:center;padding:24px 28px 20px}
.kk h2{font-family:Newsreader,Georgia,serif;font-weight:300;font-size:29px;color:#fff;letter-spacing:-.01em}
.kk small{font-size:12px;font-weight:500;letter-spacing:.24em;color:rgba(220,230,250,.75)}
.z{position:relative;display:grid;grid-template-columns:132px 1fr;gap:12px;padding:16px 28px;border-top:1px solid rgba(255,255,255,.1)}
.z span{font-size:11px;font-weight:500;letter-spacing:.12em;text-transform:uppercase;color:rgba(200,215,245,.72);padding-top:3px;line-height:1.35}
.z b{font-weight:400;font-size:16.5px;line-height:1.38;color:#fff;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.kf{position:relative;padding:15px 28px 18px;border-top:1px solid rgba(255,255,255,.1);font-size:13px;color:rgba(220,230,250,.7);letter-spacing:.02em}
</style></head><body><div class="raster"></div>
<div class="links">
  <div class="marke">${marke}</div>
  <div class="auge">${esc(b.auge)}</div>
  <h1>${esc(b.h1)}${b.h1b ? `<i>${esc(b.h1b)}</i>` : ""}</h1>
</div>
<div class="unten">
  <div class="konzept">${(b.konzept ?? w.konzept).map((k) => `<span>${esc(k)}</span>`).join("")}</div>
</div>
<div class="karte">
  <div class="kk"><h2>${esc(b.kartenTitel)}</h2><small>${esc(b.kennung ?? "FIAON GLOBAL")}</small></div>
  ${zeilen}
  <div class="kf">${esc(adresse(b.pfad))}</div>
</div>
</body></html>`;
}

function alleBilder(): Bild[] {
  const liste: Bild[] = [];
  for (const s of [...GLOBAL_SEITEN, ...GLOBAL_SEITEN_EN]) liste.push(ausRegister(s));
  // Die beiden Übersichten (Startseite / und /en, Schlüssel /business und /en/business) — Wortlaut wie in der Bühne der Startseite:
  // seit E-509 aus VERKAUF_TEXTE.buehne (vorher von Hand: „US-Gesellschaft gründen. Den Weg zum Kapital planen.“).
  for (const sp of ["de", "en"] as const) {
    const b = VERKAUF_TEXTE[sp].buehne;
    liste.push({ pfad: sp === "de" ? "/business" : "/en/business", sprache: sp, auge: b.auge, h1: b.h1a, h1b: b.h1b,
      kennung: "FIAON GLOBAL", kartenTitel: WORT[sp].konzeptKarte, zeilen: WORT[sp].konzeptZeilen.slice(0, 3),
      // E-510: der Alternativtext ist die Überschrift der Startseite — ohne den Zusatz „Ein Ansprechpartner statt acht.“
      alt: `FIAON Global — ${b.h1a} ${b.h1b}` });
  }
  for (const lp of LANDINGPAGES) {
    liste.push({ pfad: lp.pfad, sprache: "de", auge: lp.auge, h1: lp.h1, h1b: lp.h1b, kennung: "FIAON GLOBAL",
      kartenTitel: WORT.de.konzeptKarte, zeilen: WORT.de.lpZeilen, konzept: WORT.de.lpKonzept, alt: `${lp.h1} ${lp.h1b ?? ""} — FIAON Global`.replace(/\s+/g, " ") });
  }
  // Rückfallbild für Redaktionsartikel ohne eigenes Bild (neue Artikel des Tageslaufs).
  for (const sp of ["de", "en"] as const) {
    liste.push({ pfad: OG_BUSINESS_REDAKTION[sp], sprache: sp, auge: WORT[sp].redaktion, h1: sp === "de" ? "Ihre US-Gesellschaft." : "Your US company.",
      h1b: sp === "de" ? "Aktuell, mit Quellen." : "Current, with sources.", kennung: "FIAON GLOBAL", kartenTitel: WORT[sp].konzeptKarte,
      zeilen: WORT[sp].konzeptZeilen.slice(0, 3), alt: sp === "de" ? "FIAON Global — aktuell aus der Redaktion" : "FIAON Global — latest from the editorial team" });
  }
  if (ARTIKEL && existsSync(ARTIKEL)) {
    const artikel = JSON.parse(readFileSync(ARTIKEL, "utf8")) as { slug: string; titel: string; sprache: string }[];
    for (const a of artikel) {
      const sp: Sprache = a.sprache === "en" ? "en" : "de";
      // Schlüssel „artikel:<slug>“ — die Artikel hängen unter /ratgeber/<slug> (Vorrenderer fiaon-ratgeber-seo.ts).
      const pfad = ogArtikelSchluessel(a.slug);
      // Titel am Doppelpunkt teilen: „Form 941: Was … prüfen müssen“ → zwei Zeilen wie im Hero.
      const [h1, ...rest] = a.titel.split(/:\s+/);
      liste.push({ pfad, sprache: sp, auge: WORT[sp].redaktion, h1: rest.length ? `${h1}:` : a.titel, h1b: rest.length ? rest.join(": ") : undefined,
        kennung: "FIAON GLOBAL", kartenTitel: WORT[sp].konzeptKarte, zeilen: WORT[sp].konzeptZeilen.slice(0, 3), alt: `${a.titel} — FIAON Global` });
    }
  }
  return NUR ? liste.filter((b) => b.pfad === NUR) : liste;
}

async function main() {
  const bilder = alleBilder();
  if (!bilder.length) throw new Error(`Keine Seite gefunden${NUR ? ` für ${NUR}` : ""}.`);
  const browser = await chromium.launch();
  const seite = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  const liste: Record<string, { datei: string; alt: string }> = {};
  for (const b of bilder) {
    await seite.setContent(html(b), { waitUntil: "networkidle" });
    await seite.evaluate(() => (document as any).fonts.ready);
    // Passt der Titel nicht in den linken Block, eine Stufe kleiner.
    for (let i = 0; i < 6; i++) {
      const zuHoch = await seite.evaluate(() => {
        const l = document.querySelector(".links") as HTMLElement; const h = document.querySelector("h1") as HTMLElement; const k = document.querySelector(".karte") as HTMLElement;
        return l.scrollHeight > l.clientHeight + 1 || h.getBoundingClientRect().right > k.getBoundingClientRect().left - 24;
      });
      if (!zuHoch) break;
      await seite.evaluate(() => { const h = document.querySelector("h1") as HTMLElement; h.style.fontSize = `${parseFloat(getComputedStyle(h).fontSize) - 4}px`; });
    }
    const datei = ogDateiName(b.pfad);
    await seite.screenshot({ path: join(ZIEL, `${datei}.jpg`), type: "jpeg", quality: 84 });
    liste[b.pfad] = { datei, alt: b.alt };
    process.stdout.write(".");
  }
  await browser.close();
  console.log(`\n${bilder.length} Bilder nach ${ZIEL}`);
  if (NUR || arg("--ziel")) return; // Proben schreiben die Liste nicht.
  const pfade = Object.keys(liste).sort();
  writeFileSync(join(ROOT, "shared/fiaon-og-business.ts"), `// ═══════════════════════════════════════════════════════════════════════════
// GENERIERT von scripts/og-business-bilder.ts (E-439) — NIE von Hand ändern.
// Eigenes Vorschaubild je Business-Adresse: client/public/og/business/<datei>.jpg
// Neue Seite im Register → Skript laufen lassen; scripts/pruef-og-business.ts prüft die Abdeckung.
// ═══════════════════════════════════════════════════════════════════════════
export const OG_BUSINESS: Record<string, { datei: string; alt: string }> = {
${pfade.map((p) => `  ${JSON.stringify(p)}: ${JSON.stringify(liste[p])},`).join("\n")}
};
`);
  console.log(`shared/fiaon-og-business.ts: ${pfade.length} Einträge`);
}

main().catch((e) => { console.error(e); process.exit(1); });
