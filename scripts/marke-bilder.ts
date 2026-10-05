/**
 * Baut alle Bilddateien der FIAON-Marke aus shared/fiaon-marke.ts (E-286):
 * Favicons, App-Symbole, Mail-Wortmarken (PNG, Mailprogramme zeigen kein SVG) und die drei OG-Bilder.
 *
 *   npx tsx scripts/marke-bilder.ts            → schreibt nach client/public/
 *   npx tsx scripts/marke-bilder.ts /tmp/x     → schreibt in einen anderen Ordner (zum Ansehen)
 *
 * Nur lokal, braucht das Playwright-Chromium. Kein Netz außer Google Fonts (Inter für die OG-Texte).
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { MARKE_BOX, MARKE_PFAD, MARKE_NAVY, markeSvg } from "../shared/fiaon-marke";

const ZIEL = process.argv[2] || join(process.cwd(), "client/public");
const SYMBOL_1024 = join(process.cwd(), "client/public/marke/fiaon-symbol-1024.png");
mkdirSync(join(ZIEL, "mail"), { recursive: true });

/** Navy-Fläche des App-Symbols: Verlauf #16305a → #0b1c36 mit Licht oben links. */
const FLAECHE = "radial-gradient(120% 90% at 22% 12%, rgba(64,118,196,.55), transparent 60%), linear-gradient(160deg,#16305a,#0b1c36)";

/** Das F mittig in einem Quadrat, `anteil` = F-Höhe relativ zur Kachel. */
function fKachelSvg(groesse: number, anteil: number, rund: number): string {
  const f = MARKE_BOX.f;
  const h = groesse * anteil;
  const s = h / f.h;
  const b = f.b * s;
  // optischer Mittelpunkt: das F hat oben den schweren Balken — 2 % nach unten
  const x = (groesse - b) / 2 - f.x * s;
  const y = (groesse - h) / 2 + groesse * 0.01 - f.y * s;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${groesse} ${groesse}" width="${groesse}" height="${groesse}" role="img" aria-label="FIAON">
  <!-- FIAON-Monogramm (E-286): das „F“ der Wortmarke A „Editorial“ (Playfair Display 800), weiß auf Navy. -->
  <defs>
    <linearGradient id="fiNavy" x1="0" y1="0" x2="0.45" y2="1"><stop offset="0" stop-color="#16305a"/><stop offset="1" stop-color="#0b1c36"/></linearGradient>
    <radialGradient id="fiLicht" cx="0.22" cy="0.12" r="0.9"><stop offset="0" stop-color="#4076c4" stop-opacity=".5"/><stop offset=".6" stop-color="#4076c4" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="${groesse}" height="${groesse}" rx="${rund}" fill="url(#fiNavy)"/>
  <rect width="${groesse}" height="${groesse}" rx="${rund}" fill="url(#fiLicht)"/>
  <path fill="#ffffff" transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${s.toFixed(5)})" d="${MARKE_PFAD.f}"/>
</svg>
`;
}

function og(art: "fiaon" | "global" | "global-en"): string {
  const global = art !== "fiaon";
  const en = art === "global-en";
  const tile = fKachelSvg(92, 0.56, 22);
  const marke = markeSvg(global ? "global" : "fiaon", "#ffffff", "64px");
  const satz = art === "fiaon" ? "Das Betriebssystem für Bonität" : en ? "Your US company. From one source." : "Ihre US-Gesellschaft. Aus einer Hand.";
  const chips = art === "fiaon" ? "EINSICHT · AKTION · ZUGANG" : en ? "FORMATION · EIN &amp; ITIN · ACCOUNT · CAPITAL" : "GRÜNDUNG · EIN &amp; ITIN · KONTO · KAPITALAUFBAU";
  const fuss = art === "fiaon" ? "Deutschland · Österreich · Schweiz" : en ? "For companies and founders in Germany · Austria · Switzerland" : "Unternehmen und Gründer aus Deutschland · Österreich · Schweiz";
  const adresse = art === "fiaon" ? "fiaon.com" : en ? "fiaon.com/en/business" : "fiaon.com/business";
  const kreise = global
    ? `<svg class="deko" viewBox="0 0 1200 630"><g fill="none" stroke="rgba(255,255,255,.07)"><circle cx="975" cy="185" r="60"/><circle cx="975" cy="185" r="120"/><circle cx="975" cy="185" r="180"/></g>
       <g fill="none" stroke="rgba(147,180,240,.55)" stroke-dasharray="4 6" stroke-width="1.5"><path d="M793 290 Q900 80 1113 159"/><path d="M833 325 Q960 150 1113 159"/></g>
       <circle cx="793" cy="290" r="4.5" fill="#9fbaf5"/><circle cx="833" cy="325" r="4.5" fill="#9fbaf5"/>
       <circle cx="1113" cy="159" r="13" fill="none" stroke="rgba(96,150,255,.5)"/><circle cx="1113" cy="159" r="6" fill="#4f8cff"/>
       <g font-family="Inter" font-size="14" letter-spacing="2" fill="rgba(220,230,250,.85)"><text x="736" y="279">LONDON</text><text x="778" y="351">${en ? "ZURICH" : "ZÜRICH"}</text><text x="1129" y="139">MIAMI</text></g></svg>`
    : `<svg class="deko" viewBox="0 0 1200 630"><g fill="none" stroke="rgba(255,255,255,.07)"><circle cx="980" cy="160" r="90"/><circle cx="980" cy="160" r="150"/><circle cx="980" cy="160" r="210"/></g></svg>`;
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1200px;height:630px;overflow:hidden}
body{position:relative;font-family:Inter,sans-serif;color:#fff;
 background:radial-gradient(55% 75% at 82% 22%,rgba(40,86,190,.55),transparent 70%),radial-gradient(40% 45% at 0% 100%,rgba(45,90,170,.35),transparent 70%),linear-gradient(135deg,#0a1226 0%,#0b1733 55%,#0b1a3a 100%)}
.deko{position:absolute;inset:0;width:1200px;height:630px}
.kachel{position:absolute;left:96px;top:94px;width:92px;height:92px;border-radius:22px;overflow:hidden;box-shadow:inset 0 0 0 1px rgba(255,255,255,.12)}
.kachel svg{display:block}
.marke{position:absolute;left:96px;top:236px}
.linie{position:absolute;left:96px;top:330px;width:120px;height:3px;border-radius:2px;background:#3b82f6}
.satz{position:absolute;left:96px;top:364px;font-weight:300;font-size:38px;letter-spacing:-.01em;color:#f3f6fc}
.chips{position:absolute;left:96px;top:436px;font-weight:700;font-size:23px;letter-spacing:.12em;color:#93b4ff}
.fuss{position:absolute;left:96px;right:96px;top:528px;display:flex;justify-content:space-between;font-size:20px}
.fuss span{color:#9aa7bd}.fuss b{font-weight:600;color:#fff}
</style></head><body>${kreise}
<div class="kachel">${tile}</div>
<div class="marke">${marke}</div>
<div class="linie"></div>
<div class="satz">${satz}</div>
<div class="chips">${chips}</div>
<div class="fuss"><span>${fuss}</span><b>${adresse}</b></div>
</body></html>`;
}

function nurSvg(svg: string, b: number, h: number, grund = "transparent"): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>*{margin:0}html,body{width:${b}px;height:${h}px;background:${grund};overflow:hidden}svg{display:block;width:${b}px;height:${h}px}</style></head><body>${svg}</body></html>`;
}

async function main() {
  // Ohne installiertes Playwright-Chromium: das Google Chrome des Rechners nehmen.
  const browser = await chromium.launch().catch(() => chromium.launch({ channel: "chrome" }));
  const bild = async (html: string, b: number, h: number, datei: string, typ: "png" | "jpeg", transparent = false) => {
    const p = await browser.newPage({ viewport: { width: b, height: h }, deviceScaleFactor: 1 });
    await p.setContent(html, { waitUntil: "networkidle" });
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: join(ZIEL, datei), type: typ, ...(typ === "jpeg" ? { quality: 90 } : {}), omitBackground: transparent });
    await p.close();
    console.log("✓", datei, `${b}×${h}`);
  };

  // Favicons: Kachel mit Rundung, F groß (bei 16–32 px muss es tragen)
  const favicon = fKachelSvg(64, 0.62, 14);
  writeFileSync(join(ZIEL, "favicon.svg"), favicon);
  console.log("✓ favicon.svg");
  for (const g of [32, 64]) await bild(nurSvg(favicon, g, g), g, g, `favicon-${g}.png`, "png", true);

  // App-Symbole: volle Fläche (iOS und Android runden selbst), aus dem freigegebenen 1024er-Symbol
  if (existsSync(SYMBOL_1024)) {
    const daten = `data:image/png;base64,${readFileSync(SYMBOL_1024).toString("base64")}`;
    for (const [g, datei] of [[180, "apple-touch-icon.png"], [512, "icon-maskable-512.png"]] as const) {
      await bild(`<!doctype html><html><body style="margin:0"><img src="${daten}" style="display:block;width:${g}px;height:${g}px"></body></html>`, g, g, datei, "png");
    }
  } else console.log("! fiaon-symbol-1024.png fehlt — App-Symbole übersprungen");

  // Mail-Wortmarken (3× für scharfe Bildschirme, transparent)
  const mb = Math.round((63 * MARKE_BOX.fiaon.b) / MARKE_BOX.fiaon.h);
  await bild(nurSvg(markeSvg("fiaon", "#ffffff", "63px"), mb, 63), mb, 63, "mail/fiaon-wortmarke-weiss.png", "png", true);
  await bild(nurSvg(markeSvg("fiaon", MARKE_NAVY, "63px"), mb, 63), mb, 63, "mail/fiaon-wortmarke-navy.png", "png", true);
  const gb = Math.round((63 * MARKE_BOX.global.b) / MARKE_BOX.global.h);
  await bild(nurSvg(markeSvg("global", "#ffffff", "63px"), gb, 63), gb, 63, "mail/fiaon-global-wortmarke-weiss.png", "png", true);

  // OG-Bilder 1200×630
  await bild(og("fiaon"), 1200, 630, "og-fiaon.jpg", "jpeg");
  await bild(og("global"), 1200, 630, "og-global.jpg", "jpeg");
  await bild(og("global-en"), 1200, 630, "og-global-en.jpg", "jpeg");

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
