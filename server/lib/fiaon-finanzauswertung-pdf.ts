// ═══════════════════════════════════════════════════════════════════════════
// DAS PDF DER FIAON FINANZ- UND BONITÄTSAUSWERTUNG (E-IT-D, 08.10.2026, 4b)
//
// Justin: „Lang, juristisch sauber, sehr hochwertiges PDF (gleiche PDF-Technik
// wie bestehende Berichte, Kanzlei-Optik, Ampel grafisch, Score-Skala
// grafisch, Inhaltsverzeichnis, Seitenzahlen)."
//
// ── TECHNIK ───────────────────────────────────────────────────────────────
// HTML/CSS → Chromium über htmlZuPdfMitFusszeile (fiaon-html-pdf.ts), wie die
// Banking-Papiere (fiaon-banking-pdf.ts: Inter, Outfit, JetBrains Mono,
// Haarlinien, Tabellenziffern). keinNotbehelf: Druckt Chromium nicht, gibt es
// KEINEN pdfkit-Ersatzdruck — der Lauf scheitert ehrlich und lässt sich neu
// starten. Diagramme sind Server-SVG (kein JavaScript im Dokument).
//
// ── INHALTSVERZEICHNIS MIT SEITENZAHLEN ───────────────────────────────────
// Chromium kennt keine Seitenverweise. Deshalb zwei Durchgänge: Der erste
// druckt mit leeren Nummern und unsichtbaren Marken („FAKAPITEL01" in Weiß auf
// Weiß); pdf.js liest, auf welcher Seite jede Marke steht; der zweite druckt
// mit den Nummern. Das Verzeichnis hat feste Zeilen — die Nummern verschieben
// nichts. Findet pdf.js die Marken nicht, bleibt das Verzeichnis ohne Nummern
// (lieber ohne Zahl als mit falscher).
//
// ── GESTALTUNG ────────────────────────────────────────────────────────────
// Das Deckblatt ist die EINZIGE dunkle Fläche (Navy-Glas, Justins Geschmack:
// Navy an einer Stelle, Blau-Paar #288DFA → #1D4ED8). Innen hell, ruhig,
// Kanzlei-Optik. Der Finanzwert steht NIE ohne seine Kennzeichnung.
// ═══════════════════════════════════════════════════════════════════════════

import { createHash } from "node:crypto";
import { markeSvg } from "@shared/fiaon-marke";
import {
  AMPEL_WORT, BAENDER, BEREICHE, DATENSCHUTZ_ABSATZ, FA_PRODUKT, FA_WERT_NAME, FINANZWERT_KENNZEICHNUNG, FINANZWERT_KURZ, FINANZWERT_SOCKEL,
  FRIST_TEXT, GEWICHTE, HAFTUNG_ABSAETZE, VORBEHALT_TEXTE, monatsName,
  type Ampel, type AuswertungInhalt, type Frist,
} from "@shared/fiaon-finanzauswertung";

const esc = (v: unknown) => String(v ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const eur = (c: number) => `${Math.round(c / 100).toLocaleString("de-DE")} €`;
const eurGenau = (c: number) => `${(c / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const pct = (q: number) => `${Math.round(q * 100)} %`;
const dtag = (iso: string | null | undefined) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "—");
const dtagLang = (iso: string) => new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Berlin" }).format(new Date(iso));

const FARBE: Record<Ampel, string> = { gruen: "#0F9D6B", gelb: "#D99A06", rot: "#D93A3A", offen: "#94A3B8" };

/** Die Kapitel — Reihenfolge = Verzeichnis. */
export const KAPITEL: { nr: number; titel: string }[] = [
  { nr: 1, titel: "Auf einen Blick" },
  { nr: 2, titel: "Ihre Ampel im Detail" },
  { nr: 3, titel: "Einnahmen" },
  { nr: 4, titel: "Ausgaben" },
  { nr: 5, titel: "Verträge und Abos" },
  { nr: 6, titel: "Verbindlichkeiten und Zahlungsverhalten" },
  { nr: 7, titel: "Ihre Bonitätsauskunft" },
  { nr: 8, titel: "Ihr Plan" },
  { nr: 9, titel: "Vergleichswege und Hilfe" },
  { nr: 10, titel: "Der FIAON-Finanzwert erklärt" },
  { nr: 11, titel: "Methodik, Grenzen und Rechtliches" },
];
const marke = (nr: number) => `FAKAPITEL${String(nr).padStart(2, "0")}`;

/** Prüfwert über den eingefrorenen Inhalt — steht in der Fußzeile und unter „Rechtliches". */
export function pruefwert(inhalt: AuswertungInhalt): string {
  const h = createHash("sha256").update(JSON.stringify({ n: inhalt.nummer, w: inhalt.finanzwert.wert, a: inhalt.ampeln.map((x) => x.ampel), z: inhalt.zeitraum, r: inhalt.regelVersion })).digest("hex");
  return h.slice(0, 16).toUpperCase().replace(/(.{4})(?=.)/g, "$1 ");
}

// ───────────────────────────────────────────────────────────────────────────
// Grafiken (SVG)
// ───────────────────────────────────────────────────────────────────────────

/** Die Halbkreis-Skala 100–999 mit Bändern und Marke. */
export function skalaSvg(wert: number, dunkel = true, breite = 340): string {
  const cx = 170, cy = 170, r = 140, w = 18;
  const winkel = (v: number) => Math.PI * (1 - (Math.max(100, Math.min(999, v)) - 100) / 899);
  const punkt = (v: number, rr = r) => [cx + rr * Math.cos(winkel(v)), cy - rr * Math.sin(winkel(v))];
  const bogen = (von: number, bis: number, rr = r) => {
    const [x1, y1] = punkt(von, rr); const [x2, y2] = punkt(bis, rr);
    return `M${x1.toFixed(2)} ${y1.toFixed(2)} A${rr} ${rr} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  };
  const spur = dunkel ? "rgba(255,255,255,.14)" : "#E3E9F2";
  const schrift = dunkel ? "rgba(255,255,255,.62)" : "#6B7A90";
  const grenzen = [100, 400, 550, 700, 850, 999];
  const [mx, my] = punkt(wert);
  const striche = grenzen.map((g) => {
    const [a1, b1] = punkt(g, r + w / 2 + 3); const [a2, b2] = punkt(g, r + w / 2 + 10);
    const [tx, ty] = punkt(g, r + w / 2 + 22);
    return `<line x1="${a1.toFixed(1)}" y1="${b1.toFixed(1)}" x2="${a2.toFixed(1)}" y2="${b2.toFixed(1)}" stroke="${schrift}" stroke-width="1"/>`
      + `<text x="${tx.toFixed(1)}" y="${(ty + 3).toFixed(1)}" font-size="9" text-anchor="middle" fill="${schrift}" font-family="JetBrains Mono, monospace">${g}</text>`;
  }).join("");
  // Rand um den Bogen: Die Zahlen an 100, 550 und 999 stehen außerhalb des Halbkreises.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-26 -20 392 216" width="${breite}" height="${Math.round(breite * 216 / 392)}">
<defs><linearGradient id="fa-verlauf" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#288DFA"/><stop offset="1" stop-color="#1D4ED8"/></linearGradient></defs>
<path d="${bogen(100, 999)}" fill="none" stroke="${spur}" stroke-width="${w}" stroke-linecap="round"/>
<path d="${bogen(100, Math.max(101, wert))}" fill="none" stroke="url(#fa-verlauf)" stroke-width="${w}" stroke-linecap="round"/>
${striche}
<circle cx="${mx.toFixed(2)}" cy="${my.toFixed(2)}" r="11" fill="${dunkel ? "#0B1220" : "#FFFFFF"}" stroke="#FFFFFF" stroke-width="3"/>
<circle cx="${mx.toFixed(2)}" cy="${my.toFixed(2)}" r="5" fill="#288DFA"/>
</svg>`;
}

function pille(a: Ampel, text: string, dunkel = false): string {
  return `<span class="pille${dunkel ? " dunkel" : ""}"><i style="background:${FARBE[a]}"></i>${esc(text)}</span>`;
}

/** Monatsbalken: Einnahmen (blau) und Ausgaben (schiefer) je Monat. */
function monatsBalken(m: AuswertungInhalt["fakten"]["monate"]): string {
  if (!m.length) return "";
  const max = Math.max(1, ...m.map((x) => Math.max(x.einkommenCents + x.weitereCents, x.ausgabenCents)));
  const breite = 560, hoehe = 170, unten = 140, je = breite / m.length, bw = Math.min(34, je * 0.3);
  const teile = m.map((x, i) => {
    const ein = x.einkommenCents + x.weitereCents;
    const he = (ein / max) * 118, ha = (x.ausgabenCents / max) * 118;
    const x0 = i * je + je / 2;
    return `<rect x="${(x0 - bw - 2).toFixed(1)}" y="${(unten - he).toFixed(1)}" width="${bw}" height="${he.toFixed(1)}" rx="2" fill="#288DFA"/>`
      + `<rect x="${(x0 + 2).toFixed(1)}" y="${(unten - ha).toFixed(1)}" width="${bw}" height="${ha.toFixed(1)}" rx="2" fill="#94A3B8"/>`
      + `<text x="${x0.toFixed(1)}" y="${unten + 14}" font-size="8.5" text-anchor="middle" fill="#526277">${esc(monatsName(x.monat, true).slice(0, 3))}${x.voll ? "" : "*"}</text>`
      + `<text x="${(x0 - bw / 2 - 2).toFixed(1)}" y="${(unten - he - 4).toFixed(1)}" font-size="7.5" text-anchor="middle" fill="#22324A" font-family="JetBrains Mono, monospace">${Math.round(ein / 100)}</text>`
      + `<text x="${(x0 + bw / 2 + 2).toFixed(1)}" y="${(unten - ha - 4).toFixed(1)}" font-size="7.5" text-anchor="middle" fill="#526277" font-family="JetBrains Mono, monospace">${Math.round(x.ausgabenCents / 100)}</text>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${breite} ${hoehe}" width="100%" style="max-height:62mm">
<line x1="0" y1="${unten}" x2="${breite}" y2="${unten}" stroke="#C9D5E5" stroke-width="0.8"/>${teile}</svg>
<div class="legende"><span><i style="background:#288DFA"></i>Eingänge</span><span><i style="background:#94A3B8"></i>Ausgaben</span><span>Beträge in Euro${m.some((x) => !x.voll) ? " · * Monat nur zum Teil im Auszug" : ""}</span></div>`;
}

/** Ring nach Ausgabengruppen. */
function ring(gruppen: AuswertungInhalt["fakten"]["gruppen"]): string {
  const farben = ["#1D4ED8", "#288DFA", "#5AA9FB", "#8EC5FC", "#0B1220", "#526277", "#94A3B8", "#C9D5E5"];
  const top = gruppen.slice(0, 7);
  const rest = gruppen.slice(7).reduce((s, g) => s + g.anteil, 0);
  const teile = [...top.map((g) => ({ name: g.name, anteil: g.anteil, je: g.jeMonatCents })), ...(rest > 0.005 ? [{ name: "Weitere", anteil: rest, je: gruppen.slice(7).reduce((s, g) => s + g.jeMonatCents, 0) }] : [])];
  let w = -Math.PI / 2;
  const R = 62, r = 38, c = 70;
  const boegen = teile.map((t, i) => {
    const a = Math.max(0.0001, t.anteil) * Math.PI * 2;
    const x1 = c + R * Math.cos(w), y1 = c + R * Math.sin(w), x2 = c + R * Math.cos(w + a), y2 = c + R * Math.sin(w + a);
    const x3 = c + r * Math.cos(w + a), y3 = c + r * Math.sin(w + a), x4 = c + r * Math.cos(w), y4 = c + r * Math.sin(w);
    const gross = a > Math.PI ? 1 : 0;
    const d = `M${x1.toFixed(2)} ${y1.toFixed(2)} A${R} ${R} 0 ${gross} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L${x3.toFixed(2)} ${y3.toFixed(2)} A${r} ${r} 0 ${gross} 0 ${x4.toFixed(2)} ${y4.toFixed(2)} Z`;
    w += a;
    return `<path d="${d}" fill="${farben[i % farben.length]}"/>`;
  }).join("");
  const legende = teile.map((t, i) => `<tr><td><i class="punkt" style="background:${farben[i % farben.length]}"></i>${esc(t.name)}</td><td class="r mono">${eur(t.je)}</td><td class="r mono">${pct(t.anteil)}</td></tr>`).join("");
  return `<div class="ring"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 140" width="44mm" height="44mm">${boegen}</svg>
<table class="liste kompakt"><thead><tr><th>Gruppe</th><th class="r">je Monat</th><th class="r">Anteil</th></tr></thead><tbody>${legende}</tbody></table></div>`;
}

// ───────────────────────────────────────────────────────────────────────────
// Das Dokument
// ───────────────────────────────────────────────────────────────────────────

const STIL = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Inter, "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 8.9pt; line-height: 1.55; color: #22324A;
         -webkit-print-color-adjust: exact; print-color-adjust: exact; font-variant-numeric: tabular-nums; }
  .mono { font-family: "JetBrains Mono", ui-monospace, Menlo, monospace; letter-spacing: .01em; }
  .mk { color: #FFFFFF; font-size: 1pt; line-height: 1; display: block; height: 1px; overflow: hidden; }
  .deck { height: 257mm; border-radius: 5mm; padding: 15mm 14mm 12mm; color: #FFFFFF; position: relative; overflow: hidden;
          background: radial-gradient(120% 80% at 85% 0%, rgba(40,141,250,.30) 0%, rgba(40,141,250,0) 55%), linear-gradient(160deg, #0B1220 0%, #13203A 55%, #1A2744 100%); }
  .deck .oben { display: flex; justify-content: space-between; align-items: flex-start; }
  .deck .art { font-size: 6.6pt; letter-spacing: .34em; text-transform: uppercase; color: rgba(255,255,255,.66); margin-top: 3mm; }
  .deck .nr { font-family: "JetBrains Mono", monospace; font-size: 7.6pt; color: rgba(255,255,255,.72); text-align: right; line-height: 1.7; }
  .deck h1 { font-family: Outfit, Inter, sans-serif; font-weight: 300; font-size: 27pt; line-height: 1.12; margin: 22mm 0 3mm; letter-spacing: -.01em; }
  .deck .fuer { font-size: 10pt; color: rgba(255,255,255,.8); }
  .deck .skala { margin: 13mm auto 0; text-align: center; }
  .deck .wert { font-family: Outfit, Inter, sans-serif; font-weight: 300; font-size: 44pt; line-height: 1; margin-top: -24mm; }
  .deck .wert small { display: block; font-family: Inter, sans-serif; font-size: 7pt; letter-spacing: .3em; text-transform: uppercase; color: rgba(255,255,255,.62); margin-top: 3mm; }
  .deck .band { font-family: Outfit, Inter, sans-serif; font-size: 14pt; font-weight: 300; margin-top: 3mm; }
  .deck .pillen { display: flex; flex-wrap: wrap; justify-content: center; gap: 2.2mm; margin-top: 10mm; }
  .deck .kenn { position: absolute; left: 14mm; right: 14mm; bottom: 11mm; font-size: 6.9pt; line-height: 1.5; color: rgba(255,255,255,.7);
                border-top: .4pt solid rgba(255,255,255,.22); padding-top: 3mm; }
  .pille { display: inline-flex; align-items: center; gap: 1.6mm; font-size: 7.2pt; padding: 1.2mm 2.8mm; border-radius: 10mm; border: .5pt solid #C9D5E5; color: #22324A; background: #FFFFFF; }
  .pille i { width: 2.4mm; height: 2.4mm; border-radius: 50%; display: inline-block; }
  .pille.dunkel { background: rgba(255,255,255,.08); border-color: rgba(255,255,255,.22); color: #FFFFFF; }
  .seite { page-break-before: always; }
  .kopfzeile { display: flex; justify-content: space-between; align-items: center; border-bottom: .7pt solid #0B1220; padding-bottom: 2.4mm; margin-bottom: 6mm; }
  .kopfzeile .t { font-size: 6.4pt; letter-spacing: .3em; text-transform: uppercase; color: #526277; font-weight: 600; }
  h2 { font-family: Outfit, Inter, sans-serif; font-weight: 300; font-size: 19pt; color: #0B1220; margin: 0 0 1.5mm; line-height: 1.15; page-break-after: avoid; }
  h2 .n { font-family: "JetBrains Mono", monospace; font-size: 9pt; color: #1D4ED8; vertical-align: middle; margin-right: 3mm; letter-spacing: .05em; }
  h3 { font-size: 6.6pt; letter-spacing: .26em; text-transform: uppercase; color: #526277; font-weight: 600; margin: 6mm 0 2.2mm; page-break-after: avoid; }
  p { margin: 0 0 2.6mm; }
  p.lead { font-size: 10pt; line-height: 1.6; color: #22324A; max-width: 165mm; }
  .fein { font-size: 7.4pt; color: #526277; line-height: 1.55; }
  .kapitel { margin-top: 9mm; }
  .verzeichnis { width: 100%; border-collapse: collapse; margin-top: 2mm; }
  .verzeichnis td { padding: 2.2mm 0; border-bottom: .4pt solid #E1E8F2; font-size: 9.6pt; }
  .verzeichnis td.n { width: 12mm; font-family: "JetBrains Mono", monospace; color: #1D4ED8; font-size: 8pt; }
  .verzeichnis td.s { width: 14mm; text-align: right; font-family: "JetBrains Mono", monospace; color: #22324A; }
  .kacheln { display: grid; grid-template-columns: repeat(4, 1fr); border-top: .5pt solid #C9D5E5; border-bottom: .5pt solid #C9D5E5; margin: 4mm 0; }
  .kacheln > div { padding: 3.6mm 0 3.6mm 3.6mm; }
  .kacheln > div + div { border-left: .4pt solid #E1E8F2; }
  .kacheln .l { font-size: 6.1pt; letter-spacing: .22em; text-transform: uppercase; color: #526277; font-weight: 600; }
  .kacheln .w { font-family: Outfit, Inter, sans-serif; font-weight: 300; font-size: 16pt; color: #0B1220; margin-top: 1.2mm; }
  .kacheln .w.plus { color: #0F7A55; } .kacheln .w.minus { color: #B42318; }
  .kasten { border: .5pt solid #C9D5E5; border-radius: 2.4mm; padding: 4mm 4.6mm; margin: 3mm 0; page-break-inside: avoid; }
  .kasten.blau { background: #F3F7FD; border-color: #D6E3F7; }
  .kasten.vorbehalt { background: #FFF8E8; border-color: #F1D9A0; }
  .bereich { display: grid; grid-template-columns: 7mm 1fr; gap: 3mm; padding: 3.6mm 0; border-bottom: .4pt solid #E1E8F2; page-break-inside: avoid; }
  .bereich .dot { width: 5mm; height: 5mm; border-radius: 50%; margin-top: .8mm; }
  .bereich b { font-size: 10pt; color: #0B1220; font-weight: 600; }
  .bereich .frage { font-size: 7.4pt; color: #526277; }
  .bereich .grund { margin-top: 1.2mm; }
  .bereich .beleg { font-size: 6.6pt; letter-spacing: .14em; text-transform: uppercase; color: #94A3B8; margin-top: 1mm; }
  table.liste { width: 100%; border-collapse: collapse; }
  table.liste thead th { font-size: 6pt; letter-spacing: .2em; text-transform: uppercase; color: #526277; font-weight: 600; text-align: left; padding: 0 3mm 2mm 0; border-bottom: .7pt solid #0B1220; }
  table.liste td { padding: 2.1mm 3mm 2.1mm 0; border-bottom: .4pt solid #E1E8F2; vertical-align: top; font-size: 8.4pt; }
  table.liste tr { page-break-inside: avoid; }
  table.liste .r { text-align: right; white-space: nowrap; }
  table.liste.kompakt td { padding: 1.4mm 2mm 1.4mm 0; font-size: 8pt; }
  .punkt { display: inline-block; width: 2.6mm; height: 2.6mm; border-radius: 50%; margin-right: 2mm; vertical-align: middle; }
  .ring { display: grid; grid-template-columns: 48mm 1fr; gap: 6mm; align-items: center; }
  .legende { display: flex; gap: 6mm; font-size: 7pt; color: #526277; margin-top: 1mm; }
  .legende i { display: inline-block; width: 2.6mm; height: 2.6mm; border-radius: 1mm; margin-right: 1.4mm; vertical-align: middle; }
  .schritt { border: .5pt solid #C9D5E5; border-radius: 2.4mm; padding: 3.6mm 4.4mm; margin: 2.6mm 0; page-break-inside: avoid; }
  .schritt .kopf { display: flex; justify-content: space-between; gap: 5mm; align-items: baseline; }
  .schritt b { font-size: 10pt; color: #0B1220; }
  .schritt .wirkung { font-family: "JetBrains Mono", monospace; font-size: 8pt; color: #0F7A55; white-space: nowrap; }
  .schritt .wirkung.ruecklage { color: #1D4ED8; }
  .schritt ul { margin: 1.6mm 0 0; padding-left: 4.4mm; }
  .schritt li { margin: .8mm 0; }
  .frist-gruppe { break-inside: avoid; page-break-inside: avoid; }
  .frist { font-size: 6.6pt; letter-spacing: .26em; text-transform: uppercase; color: #1D4ED8; font-weight: 600; margin: 6mm 0 1mm; }
  .skala-hell { text-align: center; margin: 2mm 0 0; }
  .baender { display: grid; grid-template-columns: repeat(5, 1fr); gap: 2mm; margin: 2mm 0 4mm; }
  .baender div { border-top: 1.4mm solid #288DFA; padding-top: 1.6mm; font-size: 7.2pt; }
  .baender div.an { border-top-color: #0B1220; font-weight: 600; }
  .baender div:nth-child(1) { border-top-color: #D93A3A; } .baender div:nth-child(2) { border-top-color: #D99A06; }
  .baender div:nth-child(3) { border-top-color: #8EC5FC; } .baender div:nth-child(4) { border-top-color: #288DFA; } .baender div:nth-child(5) { border-top-color: #1D4ED8; }
  .baender div.an { box-shadow: inset 0 -0.6mm 0 #0B1220; padding-bottom: 1mm; }
  .pruefwert { font-family: "JetBrains Mono", monospace; font-size: 9pt; letter-spacing: .08em; color: #0B1220; }
`;

function kapitelKopf(nr: number, nummer: string, mitMarke = true): string {
  const k = KAPITEL.find((x) => x.nr === nr)!;
  // Nachprüfung 08.10.: Die Marke braucht nur der erste Durchgang (Seitenzahlen suchen). Im zweiten bleibt
  // ein leeres Element gleicher Höhe — sonst stünde „FAKAPITEL01“ in der Textschicht (Kopieren, Vorlesen).
  return `<span class="mk">${mitMarke ? marke(nr) : ""}</span><h2><span class="n">${String(nr).padStart(2, "0")}</span>${esc(k.titel)}</h2><div class="fein" style="margin-bottom:3mm">${esc(FA_PRODUKT)} · ${esc(nummer)}</div>`;
}

/** Das HTML. `seiten` = Kapitelnummer → Seite (zweiter Durchgang). */
export function finanzauswertungHtml(inhalt: AuswertungInhalt, seiten: Record<number, number> = {}): string {
  const f = inhalt.fakten;
  const fw = inhalt.finanzwert;
  const name = [inhalt.kunde.vorname, inhalt.kunde.nachname].filter(Boolean).join(" ") || "Kundin / Kunde";
  const zr = `${dtag(inhalt.zeitraum.von)} – ${dtag(inhalt.zeitraum.bis)}`;
  const vorbehalt = inhalt.vorbehalte.length > 0;
  const baender = BAENDER.slice().reverse();
  // Zweiter Durchgang (alle Seitenzahlen bekannt): keine Marken mehr in der Textschicht.
  const mitMarke = KAPITEL.some((k) => !seiten[k.nr]);

  const deckblatt = `
  <section class="deck">
    <div class="oben">
      <div>${markeSvg("fiaon", "#FFFFFF", "19pt")}<div class="art">Finanz- und Bonitätsauswertung</div></div>
      <div class="nr">Nr. ${esc(inhalt.nummer)}<br>Zeitraum ${esc(zr)}<br>Erstellt am ${esc(dtagLang(inhalt.erstelltAm))}</div>
    </div>
    <h1>Ihre Finanzen<br>auf einen Blick</h1>
    <div class="fuer">für ${esc(name)}${vorbehalt ? " · mit Vorbehalt (siehe Kapitel 11)" : ""}</div>
    <div class="skala">${skalaSvg(fw.wert, true, 360)}
      <div class="wert mono" style="font-family:Outfit,Inter,sans-serif">${fw.wert}<small>${esc(FA_WERT_NAME)} · 100–999</small></div>
      <div class="band">${esc(fw.band.charAt(0).toUpperCase() + fw.band.slice(1))}</div>
    </div>
    <div class="pillen">
      ${pille(inhalt.gesamt.ampel, `Gesamt: ${AMPEL_WORT[inhalt.gesamt.ampel]}`, true)}
      ${inhalt.ampeln.map((a) => pille(a.ampel, a.titel, true)).join("")}
    </div>
    <div class="kenn">${esc(FINANZWERT_KENNZEICHNUNG)}</div>
  </section>`;

  const verzeichnis = `
  <section class="seite">
    <div class="kopfzeile"><span class="t">Inhalt</span><span class="t">${esc(inhalt.nummer)}</span></div>
    <h2>Inhalt</h2>
    <table class="verzeichnis">${KAPITEL.map((k) => `<tr><td class="n">${String(k.nr).padStart(2, "0")}</td><td>${esc(k.titel)}</td><td class="s">${seiten[k.nr] ? seiten[k.nr] : ""}</td></tr>`).join("")}</table>
    <div class="kasten blau" style="margin-top:8mm">
      <b>So lesen Sie diese Auswertung.</b>
      <p style="margin-top:1.6mm">Sie beruht ausschließlich auf den Unterlagen, die Sie uns gegeben haben: Ihrem Kontoauszug für den Zeitraum ${esc(zr)}${inhalt.auskunft ? ", Ihrem Ausweis und Ihrer Bonitätsauskunft" : " und Ihrem Ausweis"}. Alle Beträge sind Monatsdurchschnitte über diesen Zeitraum, auf volle Euro gerundet.</p>
      <p>Die Ampeln zeigen je Bereich, wo Sie stehen: <b style="color:${FARBE.gruen}">Grün</b> heißt gut aufgestellt, <b style="color:${FARBE.gelb}">Gelb</b> heißt hier lohnt es sich anzusetzen, <b style="color:${FARBE.rot}">Rot</b> heißt hier hat es Vorrang. Ihr Plan in Kapitel 8 zeigt, was Sie konkret tun können.</p>
      <p class="fein" style="margin:0">${esc(FINANZWERT_KURZ)}</p>
    </div>
  </section>`;

  const top3 = inhalt.schritte.filter((s) => s.wirkung?.art !== "ruecklage").slice(0, 3);
  const k1 = `
  <section class="seite">
    ${kapitelKopf(1, inhalt.nummer, mitMarke)}
    <p class="lead">${esc(inhalt.einordnung.zusammenfassung)}</p>
    <div class="kacheln">
      <div><div class="l">Ø Einnahmen</div><div class="w">${eur(f.einnahmenJeMonatCents)}</div></div>
      <div><div class="l">Ø Ausgaben</div><div class="w">${eur(f.ausgabenJeMonatCents)}</div></div>
      <div><div class="l">Ø Überschuss</div><div class="w ${f.ueberschussJeMonatCents >= 0 ? "plus" : "minus"}">${eur(f.ueberschussJeMonatCents)}</div></div>
      <div><div class="l">Sparpotenzial</div><div class="w">${inhalt.sparpotenzial.bisCents > 0 ? `bis ${eur(inhalt.sparpotenzial.bisCents)}` : "—"}</div></div>
    </div>
    <h3>Ihre Lage je Bereich</h3>
    <div style="display:flex;flex-wrap:wrap;gap:2mm">${pille(inhalt.gesamt.ampel, `Gesamt: ${AMPEL_WORT[inhalt.gesamt.ampel]}`)}${inhalt.ampeln.map((a) => pille(a.ampel, `${a.titel}: ${AMPEL_WORT[a.ampel]}`)).join("")}</div>
    <h3>Die drei wichtigsten Schritte</h3>
    ${top3.length ? top3.map((s, i) => `<div class="schritt"><div class="kopf"><b>${i + 1}. ${esc(s.titel)}</b>${s.wirkung ? `<span class="wirkung">${s.wirkung.vonCents === s.wirkung.bisCents ? `rund ${eur(s.wirkung.bisCents)}` : `${s.wirkung.vonCents > 0 ? `${eur(s.wirkung.vonCents)}–` : "bis zu "}${eur(s.wirkung.bisCents)}`} im Monat</span>` : ""}</div><div class="fein">${esc(s.warum)}</div></div>`).join("") : `<p>Ihre Finanzen sind geordnet — Ihr Plan in Kapitel 8 zeigt, wie Sie diesen Stand halten.</p>`}
    <h3>Prüfvermerke</h3>
    <ul class="fein" style="padding-left:4mm;margin:0">${inhalt.pruefvermerke.map((v) => `<li>${esc(v)}</li>`).join("")}</ul>
    ${vorbehalt ? `<div class="kasten vorbehalt"><b>Vorbehalt.</b> ${inhalt.vorbehalte.map((v) => esc(VORBEHALT_TEXTE[v] ?? v)).join(" ")}</div>` : ""}
  </section>`;

  const k2 = `
  <section class="seite">
    ${kapitelKopf(2, inhalt.nummer, mitMarke)}
    <p class="lead">Sieben Bereiche, je eine Ampel. Der Grund steht jeweils dabei, darunter die Grundlage, aus der wir ihn ablesen.</p>
    <div class="bereich" style="border-top:.7pt solid #0B1220"><div class="dot" style="background:${FARBE[inhalt.gesamt.ampel]}"></div><div><b>Gesamt: ${esc(AMPEL_WORT[inhalt.gesamt.ampel])}</b><div class="grund">${esc(inhalt.gesamt.grund)}</div></div></div>
    ${inhalt.ampeln.map((a) => {
      const b = BEREICHE.find((x) => x.key === a.key)!;
      const text = inhalt.einordnung.bereiche[a.key] && inhalt.einordnung.bereiche[a.key] !== a.grund ? `<div class="grund">${esc(inhalt.einordnung.bereiche[a.key])}</div>` : "";
      return `<div class="bereich"><div class="dot" style="background:${FARBE[a.ampel]}"></div><div><b>${esc(a.titel)}</b> <span class="fein">· ${esc(AMPEL_WORT[a.ampel])}</span><div class="frage">${esc(b.frage)}</div><div class="grund">${esc(a.grund)}</div>${text}<div class="beleg">Grundlage: ${esc(a.beleg)}</div></div></div>`;
    }).join("")}
  </section>`;

  const quelleText: Record<string, string> = { gehalt: "Gehalt bzw. Lohn", rente: "Rente bzw. Pension", sozialleistung: "Sozialleistungen", gemischt: "mehrere Quellen", keins: "kein regelmäßiges Einkommen erkennbar" };
  const k3 = `
  <section class="seite">
    ${kapitelKopf(3, inhalt.nummer, mitMarke)}
    <p class="lead">Im Schnitt gehen ${eur(f.einkommenJeMonatCents)} Einkommen im Monat ein (${esc(quelleText[f.einkommenQuelle] ?? f.einkommenQuelle)})${f.weitereJeMonatCents > 0 ? `, dazu ${eur(f.weitereJeMonatCents)} weitere Eingänge wie Erstattungen oder Überweisungen` : ""}.${f.zahltag ? ` Das Einkommen kommt meist um den ${f.zahltag}. des Monats.` : ""}</p>
    <h3>Monatsverlauf</h3>
    ${monatsBalken(f.monate)}
    <table class="liste" style="margin-top:4mm"><thead><tr><th>Monat</th><th class="r">Einkommen</th><th class="r">Weitere Eingänge</th><th class="r">Ausgaben</th><th class="r">Saldo</th></tr></thead><tbody>
    ${f.monate.map((m) => `<tr><td>${esc(monatsName(m.monat))}${m.voll ? "" : " <span class=\"fein\">(teilweise)</span>"}</td><td class="r mono">${eur(m.einkommenCents)}</td><td class="r mono">${eur(m.weitereCents)}</td><td class="r mono">${eur(m.ausgabenCents)}</td><td class="r mono">${eur(m.freiCents)}</td></tr>`).join("")}
    </tbody></table>
  </section>`;

  const k4 = `
  <section class="seite">
    ${kapitelKopf(4, inhalt.nummer, mitMarke)}
    <p class="lead">Im Schnitt gehen ${eur(f.ausgabenJeMonatCents)} im Monat hinaus — davon ${eur(f.festJeMonatCents)} feste Zahlungen (${pct(f.fixkostenQuote)} der Einnahmen) und ${eur(f.variabelJeMonatCents)} für die laufende Lebenshaltung.</p>
    <h3>Wofür das Geld geht</h3>
    ${ring(f.gruppen)}
    <h3>Die größten Kostenpunkte</h3>
    <table class="liste"><thead><tr><th>Empfänger</th><th>Gruppe</th><th>Rhythmus</th><th class="r">je Monat</th></tr></thead><tbody>
    ${f.kostenpunkte.map((k) => `<tr><td>${esc(k.name)}</td><td>${esc(k.gruppe)}</td><td>${esc(k.rhythmus)}</td><td class="r mono">${eur(k.jeMonatCents)}</td></tr>`).join("") || `<tr><td colspan="4">Keine Kostenpunkte erkennbar.</td></tr>`}
    </tbody></table>
    ${f.art9Anzahl ? `<p class="fein" style="margin-top:3mm">${f.art9Anzahl} Buchung${f.art9Anzahl === 1 ? "" : "en"} stehen ohne Empfänger unter „Sonstiges“ — siehe Kapitel 11 (Datenschutz).</p>` : ""}
  </section>`;

  const k5 = `
  <section class="seite">
    ${kapitelKopf(5, inhalt.nummer, mitMarke)}
    <p class="lead">Diese Zahlungen laufen regelmäßig und sind im Zeitraum zuletzt noch abgegangen. Zusammen binden sie ${eur(f.vertraege.reduce((s, v) => s + v.jeMonatCents, 0))} im Monat.</p>
    <table class="liste"><thead><tr><th>Vertrag / Abo</th><th>Art</th><th>Fällig</th><th class="r">je Monat</th></tr></thead><tbody>
    ${f.vertraege.map((v) => `<tr><td>${esc(v.name)}</td><td>${esc(v.kategorie)}</td><td>${v.tag ? `um den ${v.tag}.` : esc(v.rhythmus)}</td><td class="r mono">${eurGenau(v.jeMonatCents)}</td></tr>`).join("") || `<tr><td colspan="4">Keine laufenden Verträge erkennbar.</td></tr>`}
    </tbody></table>
    <p class="fein" style="margin-top:3mm">Kündigungsfristen und Laufzeiten stehen in Ihren Verträgen oder im Kundenkonto des Anbieters. Prüfen Sie vor einer Kündigung, ob ein Vertrag noch gebraucht wird.</p>
  </section>`;

  const k6 = `
  <section class="seite">
    ${kapitelKopf(6, inhalt.nummer, mitMarke)}
    <table class="liste"><tbody>
      <tr><td>Raten und „Später bezahlen“</td><td class="r mono">${eur(f.ratenJeMonatCents)} im Monat · ${pct(f.ratenQuote)} der Einnahmen</td></tr>
      ${f.ratenPosten.length ? `<tr><td class="fein">davon</td><td class="r fein">${esc(f.ratenPosten.slice(0, 6).join(", "))}</td></tr>` : ""}
      <tr><td>Zahlungen an Inkasso</td><td class="r mono">${f.inkassoAnzahl}${f.inkassoPosten.length ? ` · ${esc(f.inkassoPosten.slice(0, 4).join(", "))}` : ""}</td></tr>
      <tr><td>Mahn- und Verzugsgebühren</td><td class="r mono">${f.mahnAnzahl}</td></tr>
      <tr><td>Rücklastschriften</td><td class="r mono">${f.ruecklastschriften}</td></tr>
      <tr><td>Tage im Minus</td><td class="r mono">${f.dispoTage == null ? "nicht im Auszug" : f.dispoTage}${f.tiefsterSaldoCents != null ? ` · tiefster Stand ${eur(f.tiefsterSaldoCents)}` : ""}</td></tr>
      <tr><td>Glücksspiel und Wetten</td><td class="r mono">${f.gluecksspielAnzahl ? `${f.gluecksspielAnzahl} Buchungen · ${eur(f.gluecksspielJeMonatCents)} im Monat` : "keine"}</td></tr>
      <tr><td>Bargeld</td><td class="r mono">${pct(f.bargeldQuote)} der Ausgaben</td></tr>
      <tr><td>Hinweise auf Pfändung</td><td class="r mono">${f.pfaendungHinweis ? "ja" : "keine"}</td></tr>
    </tbody></table>
    <p style="margin-top:4mm">${esc(inhalt.einordnung.bereiche.verbindlichkeiten ?? "")} ${esc(inhalt.einordnung.bereiche.zahlungsverhalten ?? "")}</p>
    <p class="fein">Wir prüfen einzelne Forderungen nicht rechtlich. Ob eine Forderung besteht oder ein Eintrag zu löschen ist, kann im Einzelfall nur eine dazu befugte Stelle beurteilen.</p>
  </section>`;

  const AUSKUNFT_STUFE: Record<string, string> = { frei: "Nichts Belastendes gefunden", aufraeumen: "Erledigt — es läuft nur noch die Zeit", angreifbar: "Überschaubar — hier lässt sich arbeiten", dringend: "Viel auf einmal — es braucht einen Plan" };
  const k7 = `
  <section class="seite">
    ${kapitelKopf(7, inhalt.nummer, mitMarke)}
    ${inhalt.auskunft ? `
      <p class="lead">Ausgewertet haben wir Ihre Auskunft${inhalt.auskunft.auskunftei ? ` der ${esc(inhalt.auskunft.auskunftei)}` : ""}${inhalt.auskunft.vom ? ` vom ${esc(dtag(inhalt.auskunft.vom))}` : ""}.</p>
      <table class="liste"><tbody>
        <tr><td>Einschätzung</td><td class="r">${esc(AUSKUNFT_STUFE[String(inhalt.auskunft.stufe)] ?? "—")}</td></tr>
        <tr><td>Einträge in der Auskunft</td><td class="r mono">${inhalt.auskunft.negativ}</td></tr>
        ${inhalt.auskunft.offenCents != null ? `<tr><td>Offene Beträge laut Auskunft</td><td class="r mono">${eur(inhalt.auskunft.offenCents)}</td></tr>` : ""}
      </tbody></table>
      <p class="fein" style="margin-top:3mm">Die Erklärung jedes Eintrags, die Speicherfristen und die fertigen Schreiben finden Sie in Ihrem Bereich unter Ihrer Bonitätsauskunft. Einen Score der Auskunftei weisen wir hier bewusst nicht aus — er gehört der Auskunftei und ist nicht der ${esc(FA_WERT_NAME)}.</p>`
    : `
      <p class="lead">Eine ausgewertete Bonitätsauskunft lag uns für diese Auswertung nicht vor. Dieser Teil ist „nicht bewertet“; im ${esc(FA_WERT_NAME)} haben wir ihn mit der halben Punktzahl angesetzt.</p>
      <p>Liegt Ihnen eine Bonitätsauskunft vor (etwa Ihre Datenkopie nach Art. 15 DSGVO bei einer Auskunftei), können Sie sie in Ihrem Bereich hochladen; sie fließt dann in eine neue Fassung dieser Auswertung ein.</p>`}
  </section>`;

  const fristen: Frist[] = ["sofort", "30", "90", "365"];
  const k8 = `
  <section class="seite">
    ${kapitelKopf(8, inhalt.nummer, mitMarke)}
    <p class="lead">Ihr Plan in Schritten, die Sie selbst gehen können — nach Dringlichkeit geordnet, mit dem, was der Schritt im Monat bewirken kann. Die Beträge sind Spannen aus Ihren eigenen Buchungen, keine Zusage.</p>
    ${fristen.map((fr) => {
      const liste = inhalt.schritte.filter((s) => s.frist === fr);
      if (!liste.length) return "";
      // Die Überschrift bleibt mit dem ersten Schritt zusammen (sonst stünde „Einmal im Jahr“ allein am Seitenende).
      return `<div class="frist-gruppe"><div class="frist">${esc(FRIST_TEXT[fr])}</div>` + liste.map((s, i) => `${i === 1 ? "</div>" : ""}<div class="schritt"><div class="kopf"><b>${esc(s.titel)}</b>${s.wirkung ? `<span class="wirkung${s.wirkung.art === "ruecklage" ? " ruecklage" : ""}">${s.wirkung.art === "ruecklage" ? `Rücklage rund ${eur(s.wirkung.bisCents)} im Monat` : s.wirkung.vonCents === s.wirkung.bisCents ? `rund ${eur(s.wirkung.bisCents)} im Monat` : `${s.wirkung.vonCents > 0 ? `${eur(s.wirkung.vonCents)}–` : "bis zu "}${eur(s.wirkung.bisCents)} im Monat`}</span>` : ""}</div><div class="fein">${esc(s.warum)}</div><ul>${s.wie.map((w) => `<li>${esc(w)}</li>`).join("")}</ul></div>`).join("") + (liste.length === 1 ? "</div>" : "");
    }).join("")}
    <div class="kasten blau"><b>Zusammen</b> können die Schritte ${inhalt.sparpotenzial.bisCents > 0 ? `${inhalt.sparpotenzial.vonCents > 0 ? `zwischen ${eur(inhalt.sparpotenzial.vonCents)} und ` : "bis zu "}${eur(inhalt.sparpotenzial.bisCents)} im Monat` : "Ihren Monat vor allem ordnen"} bewirken — je nachdem, welche Sie umsetzen.</div>
  </section>`;

  const k9 = `
  <section class="seite">
    ${kapitelKopf(9, inhalt.nummer, mitMarke)}
    <p class="lead">Allgemeine Wege, Preise zu vergleichen und Hilfe zu bekommen. FIAON empfiehlt keine bestimmten Anbieter und erhält für diese Hinweise keine Vergütung.</p>
    ${inhalt.vergleichswege.map((v) => `<div class="kasten"><b>${esc(v.titel)}</b><p style="margin:1.4mm 0 0">${esc(v.text)}</p></div>`).join("")}
  </section>`;

  const k10 = `
  <section class="seite">
    ${kapitelKopf(10, inhalt.nummer, mitMarke)}
    <p class="lead">Der ${esc(FA_WERT_NAME)} fasst Ihre Lage in einer Zahl zwischen 100 und 999 zusammen. Er entsteht nach festen, offen gelegten Regeln — nicht durch künstliche Intelligenz. Jeder Punkt lässt sich auf Ihre Unterlagen zurückführen.</p>
    <div class="skala-hell">${skalaSvg(fw.wert, false, 300)}<div class="mono" style="font-size:22pt;margin-top:-17mm;color:#0B1220">${fw.wert}</div><div class="fein">${esc(fw.band)}</div></div>
    <div class="baender">${baender.map((b) => `<div class="${b.band === fw.band ? "an" : ""}">${esc(b.band)}<br><span class="mono fein">ab ${b.ab}</span></div>`).join("")}</div>
    <table class="liste"><thead><tr><th>Kriterium</th><th>Grundlage</th><th class="r">Punkte</th><th class="r">von</th></tr></thead><tbody>
      <tr><td>Sockel</td><td class="fein">jeder Wert beginnt bei ${FINANZWERT_SOCKEL}</td><td class="r mono">${FINANZWERT_SOCKEL}</td><td class="r mono">${FINANZWERT_SOCKEL}</td></tr>
      ${fw.kriterien.map((k) => `<tr><td>${esc(k.titel)}</td><td class="fein">${esc(k.grund)}</td><td class="r mono">${k.punkte}</td><td class="r mono">${k.max}</td></tr>`).join("")}
      <tr><td><b>${esc(FA_WERT_NAME)}</b></td><td></td><td class="r mono"><b>${fw.wert}</b></td><td class="r mono">${FINANZWERT_SOCKEL + GEWICHTE.reduce((s, g) => s + g.max, 0)}</td></tr>
    </tbody></table>
    <div class="kasten blau"><b>Was der Wert ist — und was nicht.</b><p style="margin:1.4mm 0 0">${esc(FINANZWERT_KENNZEICHNUNG)}</p></div>
  </section>`;

  const k11 = `
  <section class="seite">
    ${kapitelKopf(11, inhalt.nummer, mitMarke)}
    <h3>Datenbasis</h3>
    <p>Kontoauszug ${esc(zr)} (${f.buchungen} Buchungen, ${inhalt.zeitraum.tage} Tage)${inhalt.ausweisTyp ? `, Ausweis (${esc(inhalt.ausweisTyp)})` : ", Ausweis"}${inhalt.auskunft ? `, Bonitätsauskunft${inhalt.auskunft.auskunftei ? ` der ${esc(inhalt.auskunft.auskunftei)}` : ""}` : ""}. Regelwerk ${esc(inhalt.regelVersion)}.</p>
    ${vorbehalt ? `<h3>Vorbehalt</h3>${inhalt.vorbehalte.map((v) => `<p>${esc(VORBEHALT_TEXTE[v] ?? v)}</p>`).join("")}` : ""}
    <h3>Rechtliche Hinweise</h3>
    ${HAFTUNG_ABSAETZE.map((a) => `<p>${esc(a)}</p>`).join("")}
    <h3>Datenschutz</h3>
    <p>${esc(DATENSCHUTZ_ABSATZ)}</p>
    <p>${inhalt.texteQuelle === "ki" ? "Die erläuternden Sätze sind mit Unterstützung künstlicher Intelligenz formuliert und vor der Übergabe von einem Menschen bei FIAON geprüft worden." : "Die erläuternden Sätze sind nach festen Regeln formuliert und vor der Übergabe von einem Menschen bei FIAON geprüft worden."}</p>
    <h3>Prüfwert</h3>
    <p class="pruefwert">${esc(pruefwert(inhalt))}</p>
    <p class="fein">Der Prüfwert bildet den Inhalt dieser Fassung ab. Eine neue Auswertung erhält eine neue Fassungsnummer; frühere Fassungen bleiben in Ihrem Bereich abrufbar.</p>
    <p class="fein" style="margin-top:6mm">FIAON LTD · Company No. 17318250 · 128 City Road · London EC1V 2NX · United Kingdom</p>
  </section>`;

  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${esc(FA_PRODUKT)} ${esc(inhalt.nummer)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Outfit:wght@200;300;400&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>${STIL}</style></head><body>
${deckblatt}${verzeichnis}${k1}${k2}${k3}${k4}${k5}${k6}${k7}${k8}${k9}${k10}${k11}
</body></html>`;
}

/** Auf welcher Seite steht jede Kapitelmarke? Seiten zählen ab 1. */
export async function kapitelSeiten(pdf: Buffer): Promise<Record<number, number>> {
  const { pdfTextJeSeite } = await import("./fiaon-pdf-lesen");
  const seiten = await pdfTextJeSeite(pdf);
  const aus: Record<number, number> = {};
  for (const k of KAPITEL) {
    const i = seiten.findIndex((t) => t.replace(/\s+/g, "").includes(marke(k.nr)));
    if (i >= 0) aus[k.nr] = i + 1;
  }
  return aus;
}

/** Drucken — zwei Durchgänge für das Inhaltsverzeichnis, kein Notbehelf. */
export async function finanzauswertungDrucken(inhalt: AuswertungInhalt): Promise<Buffer> {
  const { htmlZuPdfMitFusszeile } = await import("./fiaon-html-pdf");
  const druck = (seiten: Record<number, number>) => htmlZuPdfMitFusszeile({
    html: finanzauswertungHtml(inhalt, seiten),
    fusszeile: `FIAON · ${FA_PRODUKT} · Nr. ${inhalt.nummer} · Prüfwert ${pruefwert(inhalt)}`,
    rand: { oben: "16mm", unten: "22mm", links: "16mm", rechts: "16mm" },
    titel: FA_PRODUKT,
    keinNotbehelf: true,
  });
  const erst = await druck({});
  const seiten = await kapitelSeiten(erst).catch(() => ({} as Record<number, number>));
  if (Object.keys(seiten).length !== KAPITEL.length) return erst;
  return druck(seiten);
}
