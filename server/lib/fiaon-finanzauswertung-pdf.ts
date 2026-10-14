// ═══════════════════════════════════════════════════════════════════════════
// DAS PDF DER FIAON FINANZ- UND BONITÄTSAUSWERTUNG (E-IT-D 08.10.2026 · E-353 14.10.2026)
//
// E-IT-D, Justin: „Lang, juristisch sauber, sehr hochwertiges PDF (Kanzlei-Optik,
// Ampel grafisch, Score-Skala grafisch, Inhaltsverzeichnis, Seitenzahlen).“
//
// E-353, Justin (14.10.2026): „DAS IST JA DER BONITÄTSAUSZUG, DEN ER ERWIRBT — da
// kann nicht stehen ‚wir wissen es nicht‘ … er zahlt an uns 74 € und wir ersetzen
// damit die Bonitätsauswertung … muss den Kunden 100 % analysieren, alle seine
// Ausgaben im Detail — Potenziale, Einnahmen … sein ganzes Leben widerspiegeln:
// wo gibt er wann wie viel aus und wie könnte man das optimieren … viel wertiger
// und institutioneller.“ Deshalb:
//   · Kapitel „Ihre Bonitätsauskunft“ (mit „lag uns nicht vor, laden Sie hoch“) ist
//     ersetzt durch „Ihre Bonität aus Sicht einer Bank“ — Haushaltsrechnung und die
//     Merkmale einer Kreditprüfung aus dem Kontoverlauf. Eine vorgelegte Auskunft
//     fließt zusätzlich ein; fehlt sie, steht dazu kein Wort.
//   · Neu: Kennzahlen gegen Richtwerte, Ausgaben im Detail (jeder Empfänger je
//     Gruppe), Ihr Monat im Ablauf (wann das Geld abfließt, Wochentage,
//     Kontostand), Optimierungspotenzial (Monat und Jahr), die nächsten 12 Monate.
//   · Gestaltung wie ein Bankbericht: Deckblatt mit Ausstellungsdaten und Siegel,
//     „Vertraulich“, laufende Kopfzeile, Serifen-Überschriften, Haarlinien.
//
// ── TECHNIK ───────────────────────────────────────────────────────────────
// HTML/CSS → Chromium über htmlZuPdfMitFusszeile (fiaon-html-pdf.ts). keinNotbehelf:
// Druckt Chromium nicht, scheitert der Lauf ehrlich. Diagramme sind Server-SVG.
// Inhaltsverzeichnis in zwei Durchgängen (unsichtbare Marken „FAKAPITEL01“, pdf.js
// liest die Seiten, zweiter Druck mit Nummern — ohne Marken in der Textschicht).
// Fassungen vor dem 14.10. haben keine `fakten.detail` — die neuen Kapitel sagen
// dann knapp, dass diese Fassung die Einzelaufstellung nicht enthält.
// ═══════════════════════════════════════════════════════════════════════════

import { createHash } from "node:crypto";
import { markeSvg } from "@shared/fiaon-marke";
import {
  AMPEL_WORT, BAENDER, BEREICHE, DATENSCHUTZ_ABSATZ, FA_PRODUKT, FA_WERT_NAME, FINANZWERT_KENNZEICHNUNG, FINANZWERT_KURZ, FINANZWERT_SOCKEL,
  FRIST_TEXT, GEWICHTE, HAFTUNG_ABSAETZE, VORBEHALT_TEXTE, doppelteVertraege, monatsName,
  type Ampel, type AuswertungInhalt, type Frist,
} from "@shared/fiaon-finanzauswertung";
import { bankblickAus, jahresblickAus, kennzahlenAus, type KennStatus, type MerkmalStand } from "@shared/fiaon-finanzauswertung-detail";

const esc = (v: unknown) => String(v ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const eur = (c: number) => `${Math.round(c / 100).toLocaleString("de-DE")} €`;
const eurGenau = (c: number) => `${(c / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const pct = (q: number) => `${Math.round(q * 100)} %`;
const dtag = (iso: string | null | undefined) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "—");
const dtagLang = (iso: string) => new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Berlin" }).format(new Date(iso));

const FARBE: Record<Ampel, string> = { gruen: "#0F9D6B", gelb: "#D99A06", rot: "#D93A3A", offen: "#94A3B8" };
const STATUS_FARBE: Record<KennStatus, string> = { gut: FARBE.gruen, beobachten: FARBE.gelb, handeln: FARBE.rot, offen: FARBE.offen };
const STATUS_WORT: Record<KennStatus, string> = { gut: "im Rahmen", beobachten: "beobachten", handeln: "handeln", offen: "nicht prüfbar" };
const MERKMAL_FARBE: Record<MerkmalStand, string> = { ok: FARBE.gruen, hinweis: FARBE.gelb, kritisch: FARBE.rot };
const MERKMAL_ZEICHEN: Record<MerkmalStand, string> = { ok: "✓", hinweis: "!", kritisch: "✕" };

/** Die Kapitel — Reihenfolge = Verzeichnis. */
export const KAPITEL: { nr: number; titel: string }[] = [
  { nr: 1, titel: "Zusammenfassung" },
  { nr: 2, titel: "Ihre Ampel im Detail" },
  { nr: 3, titel: "Kennzahlen und Richtwerte" },
  { nr: 4, titel: "Einnahmen" },
  { nr: 5, titel: "Ausgaben im Überblick" },
  { nr: 6, titel: "Ausgaben im Detail" },
  { nr: 7, titel: "Ihr Monat im Ablauf" },
  { nr: 8, titel: "Verträge und Abos" },
  { nr: 9, titel: "Verbindlichkeiten und Zahlungsverhalten" },
  { nr: 10, titel: "Ihre Bonität aus Sicht einer Bank" },
  { nr: 11, titel: "Ihr Optimierungspotenzial" },
  { nr: 12, titel: "Ihr Plan" },
  { nr: 13, titel: "Ihre nächsten 12 Monate" },
  { nr: 14, titel: "Vergleichswege und Hilfe" },
  { nr: 15, titel: "Der FIAON-Finanzwert erklärt" },
  { nr: 16, titel: "Methodik, Grenzen und Rechtliches" },
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
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-26 -20 392 216" width="${breite}" height="${Math.round(breite * 216 / 392)}">
<defs><linearGradient id="fa-verlauf" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#288DFA"/><stop offset="1" stop-color="#1D4ED8"/></linearGradient></defs>
<path d="${bogen(100, 999)}" fill="none" stroke="${spur}" stroke-width="${w}" stroke-linecap="round"/>
<path d="${bogen(100, Math.max(101, wert))}" fill="none" stroke="url(#fa-verlauf)" stroke-width="${w}" stroke-linecap="round"/>
${striche}
<circle cx="${mx.toFixed(2)}" cy="${my.toFixed(2)}" r="11" fill="${dunkel ? "#0B1220" : "#FFFFFF"}" stroke="${dunkel ? "#FFFFFF" : "#1D4ED8"}" stroke-width="3"/>
<circle cx="${mx.toFixed(2)}" cy="${my.toFixed(2)}" r="5" fill="#288DFA"/>
</svg>`;
}

/** Das Siegel des Dokuments: Ring mit Umschrift, innen Jahr und Nummer — keine Behauptung, nur Herkunft. */
function siegelSvg(nummer: string, jahr: string): string {
  const umschrift = "FIAON · FINANZANALYSE · PERSÖNLICHER BERICHT · ";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="30mm" height="30mm">
<defs><path id="fa-siegel-kreis" d="M60 60 m-45 0 a45 45 0 1 1 90 0 a45 45 0 1 1 -90 0"/></defs>
<circle cx="60" cy="60" r="57" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1"/>
<circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,.28)" stroke-width=".6"/>
<circle cx="60" cy="60" r="36" fill="none" stroke="rgba(255,255,255,.28)" stroke-width=".6"/>
<text font-family="Inter, sans-serif" font-size="7.4" letter-spacing="2.2" fill="rgba(255,255,255,.78)"><textPath href="#fa-siegel-kreis">${esc(umschrift)}</textPath></text>
<text x="60" y="56" text-anchor="middle" font-family="Source Serif 4, Georgia, serif" font-size="15" fill="#FFFFFF">${esc(jahr)}</text>
<text x="60" y="70" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="6.6" fill="rgba(255,255,255,.75)">${esc(nummer)}</text>
</svg>`;
}

function pille(a: Ampel, text: string, dunkel = false): string {
  return `<span class="pille${dunkel ? " dunkel" : ""}"><i style="background:${FARBE[a]}"></i>${esc(text)}</span>`;
}
function status(s: KennStatus): string {
  return `<span class="status"><i style="background:${STATUS_FARBE[s]}"></i>${esc(STATUS_WORT[s])}</span>`;
}

/** Monatsbalken: Eingänge (blau) und Ausgaben (schiefer) je Monat. */
function monatsBalken(m: AuswertungInhalt["fakten"]["monate"]): string {
  if (!m.length) return "";
  const max = Math.max(1, ...m.map((x) => Math.max(x.einkommenCents + x.weitereCents, x.ausgabenCents)));
  const breite = 560, hoehe = 170, unten = 140, je = breite / m.length, bw = Math.min(34, je * 0.3);
  const teile = m.map((x, i) => {
    const ein = x.einkommenCents + x.weitereCents;
    const he = (ein / max) * 118, ha = (x.ausgabenCents / max) * 118;
    const x0 = i * je + je / 2;
    return `<rect x="${(x0 - bw - 2).toFixed(1)}" y="${(unten - he).toFixed(1)}" width="${bw}" height="${he.toFixed(1)}" rx="2" fill="#1D4ED8"/>`
      + `<rect x="${(x0 + 2).toFixed(1)}" y="${(unten - ha).toFixed(1)}" width="${bw}" height="${ha.toFixed(1)}" rx="2" fill="#94A3B8"/>`
      + `<text x="${x0.toFixed(1)}" y="${unten + 14}" font-size="8.5" text-anchor="middle" fill="#526277">${esc(monatsName(x.monat, true).slice(0, 3))}${x.voll ? "" : "*"}</text>`
      + `<text x="${(x0 - bw / 2 - 2).toFixed(1)}" y="${(unten - he - 4).toFixed(1)}" font-size="7.5" text-anchor="middle" fill="#22324A" font-family="JetBrains Mono, monospace">${Math.round(ein / 100)}</text>`
      + `<text x="${(x0 + bw / 2 + 2).toFixed(1)}" y="${(unten - ha - 4).toFixed(1)}" font-size="7.5" text-anchor="middle" fill="#526277" font-family="JetBrains Mono, monospace">${Math.round(x.ausgabenCents / 100)}</text>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${breite} ${hoehe}" width="100%" style="max-height:62mm">
<line x1="0" y1="${unten}" x2="${breite}" y2="${unten}" stroke="#C9D5E5" stroke-width="0.8"/>${teile}</svg>
<div class="legende"><span><i style="background:#1D4ED8"></i>Eingänge</span><span><i style="background:#94A3B8"></i>Ausgaben</span><span>Beträge in Euro${m.some((x) => !x.voll) ? " · * Monat nur zum Teil im Auszug" : ""}</span></div>`;
}

const RING_FARBEN = ["#0B1220", "#1D4ED8", "#288DFA", "#5AA9FB", "#8EC5FC", "#526277", "#94A3B8", "#C9D5E5"];

/** Ring nach Ausgabengruppen. */
function ring(gruppen: AuswertungInhalt["fakten"]["gruppen"]): string {
  const top = gruppen.slice(0, 7);
  const rest = gruppen.slice(7).reduce((s, g) => s + g.anteil, 0);
  const teile = [...top.map((g) => ({ name: g.name, anteil: g.anteil, je: g.jeMonatCents })), ...(rest > 0.005 ? [{ name: "Weitere", anteil: rest, je: gruppen.slice(7).reduce((s, g) => s + g.jeMonatCents, 0) }] : [])];
  let w = -Math.PI / 2;
  const R = 62, r = 40, c = 70;
  const boegen = teile.map((t, i) => {
    const a = Math.max(0.0001, Math.min(0.9999, t.anteil)) * Math.PI * 2;
    const x1 = c + R * Math.cos(w), y1 = c + R * Math.sin(w), x2 = c + R * Math.cos(w + a), y2 = c + R * Math.sin(w + a);
    const x3 = c + r * Math.cos(w + a), y3 = c + r * Math.sin(w + a), x4 = c + r * Math.cos(w), y4 = c + r * Math.sin(w);
    const gross = a > Math.PI ? 1 : 0;
    const d = `M${x1.toFixed(2)} ${y1.toFixed(2)} A${R} ${R} 0 ${gross} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L${x3.toFixed(2)} ${y3.toFixed(2)} A${r} ${r} 0 ${gross} 0 ${x4.toFixed(2)} ${y4.toFixed(2)} Z`;
    w += a;
    return `<path d="${d}" fill="${RING_FARBEN[i % RING_FARBEN.length]}" stroke="#FFFFFF" stroke-width="1"/>`;
  }).join("");
  const legende = teile.map((t, i) => `<tr><td><i class="punkt" style="background:${RING_FARBEN[i % RING_FARBEN.length]}"></i>${esc(t.name)}</td><td class="r mono">${eur(t.je)}</td><td class="r mono">${pct(t.anteil)}</td></tr>`).join("");
  return `<div class="ring"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 140" width="46mm" height="46mm">${boegen}</svg>
<table class="liste kompakt"><thead><tr><th>Gruppe</th><th class="r">je Monat</th><th class="r">Anteil</th></tr></thead><tbody>${legende}</tbody></table></div>`;
}

/** Senkrechte Säulen mit Beschriftung; `hervor` markiert eine Säule (z. B. den Zahltag). */
function saeulen(werte: { label: string; cents: number }[], opts: { hervor?: number; hinweis?: string } = {}): string {
  if (!werte.length) return "";
  const max = Math.max(1, ...werte.map((w) => w.cents));
  const breite = 560, unten = 120, je = breite / werte.length, bw = Math.min(46, je * 0.56);
  const teile = werte.map((w, i) => {
    const h = (w.cents / max) * 96;
    const x0 = i * je + je / 2;
    const farbe = i === opts.hervor ? "#1D4ED8" : "#94A3B8";
    return `<rect x="${(x0 - bw / 2).toFixed(1)}" y="${(unten - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${farbe}"/>`
      + `<text x="${x0.toFixed(1)}" y="${(unten - h - 4).toFixed(1)}" font-size="8" text-anchor="middle" fill="#22324A" font-family="JetBrains Mono, monospace">${Math.round(w.cents / 100)}</text>`
      + `<text x="${x0.toFixed(1)}" y="${unten + 13}" font-size="8.5" text-anchor="middle" fill="#526277">${esc(w.label)}</text>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${breite} ${unten + 20}" width="100%" style="max-height:52mm">
<line x1="0" y1="${unten}" x2="${breite}" y2="${unten}" stroke="#C9D5E5" stroke-width=".8"/>${teile}</svg>${opts.hinweis ? `<div class="legende"><span>${esc(opts.hinweis)}</span></div>` : ""}`;
}

/** Waagerechte Balken (Anteil an den Einnahmen o. Ä.). */
function balkenH(zeilen: { label: string; wert: number; text: string; farbe?: string }[], max = 1): string {
  return `<div class="balken">${zeilen.map((z) => `<div class="b-zeile"><span class="b-l">${esc(z.label)}</span><span class="b-spur"><i style="width:${Math.max(0.6, Math.min(100, (z.wert / Math.max(1e-9, max)) * 100)).toFixed(1)}%;background:${z.farbe ?? "#1D4ED8"}"></i></span><span class="b-t mono">${esc(z.text)}</span></div>`).join("")}</div>`;
}

/** Kontostand als Treppenlinie mit Nulllinie. */
function linie(verlauf: { datum: string; cents: number }[]): string {
  if (verlauf.length < 3) return "";
  const breite = 560, hoehe = 150, oben = 10, unten = 124;
  const werte = verlauf.map((v) => v.cents);
  const min = Math.min(0, ...werte), max = Math.max(1, ...werte);
  const y = (c: number) => oben + (1 - (c - min) / Math.max(1, max - min)) * (unten - oben);
  const t0 = Date.parse(`${verlauf[0].datum}T12:00:00Z`), t1 = Date.parse(`${verlauf[verlauf.length - 1].datum}T12:00:00Z`);
  const x = (d: string) => ((Date.parse(`${d}T12:00:00Z`) - t0) / Math.max(1, t1 - t0)) * breite;
  // Treppe: Der Stand gilt bis zur nächsten Buchung.
  let d = `M0 ${y(verlauf[0].cents).toFixed(1)}`;
  for (let i = 1; i < verlauf.length; i++) d += ` H${x(verlauf[i].datum).toFixed(1)} V${y(verlauf[i].cents).toFixed(1)}`;
  const fl = `${d} V${y(min).toFixed(1)} H0 Z`;
  const null0 = y(0);
  const beschr = [verlauf[0], verlauf[Math.floor(verlauf.length / 2)], verlauf[verlauf.length - 1]];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${breite} ${hoehe}" width="100%" style="max-height:56mm">
<defs><linearGradient id="fa-flaeche" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#288DFA" stop-opacity=".22"/><stop offset="1" stop-color="#288DFA" stop-opacity="0"/></linearGradient></defs>
<path d="${fl}" fill="url(#fa-flaeche)"/>
<line x1="0" y1="${null0.toFixed(1)}" x2="${breite}" y2="${null0.toFixed(1)}" stroke="${min < 0 ? "#D93A3A" : "#C9D5E5"}" stroke-width=".8" stroke-dasharray="${min < 0 ? "3 3" : "0"}"/>
<path d="${d}" fill="none" stroke="#1D4ED8" stroke-width="1.6"/>
${beschr.map((b, i) => `<text x="${Math.min(breite - 2, Math.max(2, x(b.datum))).toFixed(1)}" y="${hoehe - 6}" font-size="8" text-anchor="${i === 0 ? "start" : i === 2 ? "end" : "middle"}" fill="#526277">${esc(dtag(b.datum))}</text>`).join("")}
<text x="2" y="${(y(max) + 9).toFixed(1)}" font-size="8" fill="#526277" font-family="JetBrains Mono, monospace">${Math.round(max / 100)} €</text>
${min < 0 ? `<text x="${breite - 2}" y="${(y(min) + 9).toFixed(1)}" font-size="8" text-anchor="end" fill="#B42318" font-family="JetBrains Mono, monospace">tiefster Stand ${Math.round(min / 100)} €</text>` : ""}
</svg>`;
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

  /* ── Deckblatt ── */
  .deck { height: 260mm; border-radius: 4mm; padding: 13mm 14mm 11mm; color: #FFFFFF; position: relative; overflow: hidden;
          background: radial-gradient(110% 70% at 88% 0%, rgba(40,141,250,.28) 0%, rgba(40,141,250,0) 55%), linear-gradient(165deg, #0A1120 0%, #111D35 55%, #18243F 100%); }
  .deck::after { content: ""; position: absolute; top: 5mm; left: 5mm; right: 5mm; bottom: 5mm; border: .5pt solid rgba(255,255,255,.16); border-radius: 2.5mm; }
  .deck .oben { display: flex; justify-content: space-between; align-items: center; position: relative; z-index: 1; }
  .deck .vertraulich { font-size: 6.4pt; letter-spacing: .34em; text-transform: uppercase; color: rgba(255,255,255,.82);
                       border: .6pt solid rgba(255,255,255,.45); padding: 1.4mm 3mm; border-radius: 1mm; }
  .deck .art { font-size: 6.6pt; letter-spacing: .34em; text-transform: uppercase; color: rgba(255,255,255,.62); margin-top: 16mm; }
  .deck h1 { font-family: "Source Serif 4", Georgia, serif; font-weight: 400; font-size: 30pt; line-height: 1.08; margin: 3mm 0 3mm; letter-spacing: -.005em; }
  .deck .fuer { font-size: 10.5pt; color: rgba(255,255,255,.86); }
  .deck .fuer b { font-weight: 600; color: #FFFFFF; }
  .deck .mitte { display: grid; grid-template-columns: 1fr 64mm; gap: 6mm; align-items: center; margin-top: 10mm; }
  .deck .skala { text-align: center; }
  .deck .wert { font-family: Outfit, Inter, sans-serif; font-weight: 200; font-size: 46pt; line-height: 1; margin-top: -24mm; }
  .deck .wert small { display: block; font-family: Inter, sans-serif; font-size: 6.6pt; letter-spacing: .3em; text-transform: uppercase; color: rgba(255,255,255,.62); margin-top: 3mm; }
  .deck .band { font-family: "Source Serif 4", Georgia, serif; font-size: 14pt; margin-top: 2mm; }
  .deck .urteil { border-left: .8pt solid rgba(255,255,255,.4); padding-left: 5mm; }
  .deck .urteil .l { font-size: 6.2pt; letter-spacing: .28em; text-transform: uppercase; color: rgba(255,255,255,.6); }
  .deck .urteil .t { font-family: "Source Serif 4", Georgia, serif; font-size: 12pt; line-height: 1.3; margin: 1.6mm 0 4mm; }
  .deck .pillen { display: flex; flex-wrap: wrap; justify-content: center; gap: 2mm; margin-top: 8mm; }
  .deck .meta { position: absolute; left: 14mm; right: 14mm; bottom: 34mm; display: grid; grid-template-columns: 26mm 36mm 38mm 1fr; gap: 0 4mm; align-items: start;
                border-top: .5pt solid rgba(255,255,255,.22); padding-top: 4mm; }
  .deck .meta .l { font-size: 5.8pt; letter-spacing: .26em; text-transform: uppercase; color: rgba(255,255,255,.55); }
  .deck .meta .w { font-size: 8.6pt; color: #FFFFFF; margin-top: 1.2mm; line-height: 1.4; }
  .deck .siegel { position: absolute; right: 14mm; bottom: 52mm; }
  .deck .kenn { position: absolute; left: 14mm; right: 14mm; bottom: 11mm; font-size: 6.6pt; line-height: 1.5; color: rgba(255,255,255,.62); }

  .pille { display: inline-flex; align-items: center; gap: 1.6mm; font-size: 7.2pt; padding: 1.2mm 2.8mm; border-radius: 10mm; border: .5pt solid #C9D5E5; color: #22324A; background: #FFFFFF; }
  .pille i, .status i { width: 2.4mm; height: 2.4mm; border-radius: 50%; display: inline-block; }
  .pille.dunkel { background: rgba(255,255,255,.07); border-color: rgba(255,255,255,.22); color: #FFFFFF; }
  .status { display: inline-flex; align-items: center; gap: 1.4mm; font-size: 7.4pt; white-space: nowrap; }

  /* ── Innenseiten ── */
  .seite { page-break-before: always; }
  .lauf { display: flex; justify-content: space-between; align-items: center; border-bottom: .5pt solid #C9D5E5; padding-bottom: 2mm; margin-bottom: 7mm; }
  .lauf .t { font-size: 6pt; letter-spacing: .28em; text-transform: uppercase; color: #6B7A90; font-weight: 600; }
  .lauf .t b { color: #0B1220; font-weight: 700; }
  .kap { display: grid; grid-template-columns: 16mm 1fr; align-items: baseline; border-bottom: 1.2pt solid #0B1220; padding-bottom: 2.6mm; margin-bottom: 4mm; page-break-after: avoid; }
  .kap .n { font-family: "JetBrains Mono", monospace; font-size: 10pt; color: #1D4ED8; letter-spacing: .06em; }
  .kap h2 { font-family: "Source Serif 4", Georgia, serif; font-weight: 400; font-size: 21pt; color: #0B1220; margin: 0; line-height: 1.15; }
  h3 { font-size: 6.4pt; letter-spacing: .26em; text-transform: uppercase; color: #526277; font-weight: 700; margin: 7mm 0 2.4mm; page-break-after: avoid; }
  h4 { font-family: "Source Serif 4", Georgia, serif; font-weight: 400; font-size: 12.5pt; color: #0B1220; margin: 6mm 0 1.6mm; page-break-after: avoid; }
  h4 .neben { font-family: Inter, sans-serif; font-size: 8pt; color: #526277; margin-left: 2mm; }
  p { margin: 0 0 2.6mm; }
  p.lead { font-size: 10pt; line-height: 1.62; color: #22324A; max-width: 168mm; }
  .fein { font-size: 7.4pt; color: #526277; line-height: 1.55; }
  .verzeichnis { width: 100%; border-collapse: collapse; margin-top: 2mm; }
  .verzeichnis td { padding: 2mm 0; border-bottom: .4pt solid #E1E8F2; font-size: 9.6pt; }
  .verzeichnis td.n { width: 12mm; font-family: "JetBrains Mono", monospace; color: #1D4ED8; font-size: 8pt; }
  .verzeichnis td.s { width: 14mm; text-align: right; font-family: "JetBrains Mono", monospace; color: #22324A; }
  .kacheln { display: grid; grid-template-columns: repeat(5, 1fr); border-top: .7pt solid #0B1220; border-bottom: .5pt solid #C9D5E5; margin: 4mm 0; }
  .kacheln.vier { grid-template-columns: repeat(4, 1fr); }
  .kacheln > div { padding: 3.4mm 0 3.4mm 3.4mm; }
  .kacheln > div + div { border-left: .4pt solid #E1E8F2; }
  .kacheln .l { font-size: 5.9pt; letter-spacing: .2em; text-transform: uppercase; color: #526277; font-weight: 600; }
  .kacheln .w { font-family: Outfit, Inter, sans-serif; font-weight: 300; font-size: 15pt; color: #0B1220; margin-top: 1.2mm; }
  .kacheln .w.plus { color: #0F7A55; } .kacheln .w.minus { color: #B42318; }
  .kacheln .u { font-size: 6.6pt; color: #6B7A90; margin-top: .4mm; }
  .ergebnis { display: grid; grid-template-columns: 62mm 1fr; gap: 6mm; align-items: center; background: #F4F7FC; border: .5pt solid #D6E3F7; border-radius: 2.4mm; padding: 4mm 5mm; margin: 4mm 0; page-break-inside: avoid; }
  .ergebnis .wert { font-family: Outfit, Inter, sans-serif; font-weight: 200; font-size: 26pt; color: #0B1220; margin-top: -13mm; text-align: center; }
  .ergebnis .wert small { display: block; font-family: Inter, sans-serif; font-size: 6pt; letter-spacing: .24em; text-transform: uppercase; color: #526277; }
  .ergebnis .zeile { display: flex; gap: 3mm; align-items: baseline; padding: 1.6mm 0; border-bottom: .4pt solid #DCE5F2; }
  .ergebnis .zeile:last-child { border-bottom: 0; }
  .ergebnis .zeile .l { width: 30mm; font-size: 6.2pt; letter-spacing: .2em; text-transform: uppercase; color: #526277; font-weight: 600; flex: none; }
  .kern { counter-reset: kern; list-style: none; padding: 0; margin: 0; }
  .kern li { counter-increment: kern; display: grid; grid-template-columns: 8mm 1fr; gap: 2mm; padding: 2.4mm 0; border-bottom: .4pt solid #E1E8F2; page-break-inside: avoid; }
  .kern li::before { content: counter(kern, decimal-leading-zero); font-family: "JetBrains Mono", monospace; font-size: 8pt; color: #1D4ED8; padding-top: .5mm; }
  .kern b { color: #0B1220; }
  .kasten { border: .5pt solid #C9D5E5; border-radius: 2.4mm; padding: 4mm 4.6mm; margin: 3mm 0; page-break-inside: avoid; }
  .kasten.blau { background: #F4F7FC; border-color: #D6E3F7; }
  .kasten.vorbehalt { background: #FFF8E8; border-color: #F1D9A0; }
  .kasten.dunkel { background: #0B1220; border-color: #0B1220; color: #E7ECF4; }
  .kasten.dunkel b { color: #FFFFFF; }
  .bereich { display: grid; grid-template-columns: 7mm 1fr; gap: 3mm; padding: 3.4mm 0; border-bottom: .4pt solid #E1E8F2; page-break-inside: avoid; }
  .bereich .dot { width: 5mm; height: 5mm; border-radius: 50%; margin-top: .8mm; }
  .bereich b { font-size: 10pt; color: #0B1220; font-weight: 600; }
  .bereich .frage { font-size: 7.4pt; color: #526277; }
  .bereich .grund { margin-top: 1.2mm; }
  .bereich .beleg { font-size: 6.4pt; letter-spacing: .14em; text-transform: uppercase; color: #94A3B8; margin-top: 1mm; }
  table.liste { width: 100%; border-collapse: collapse; }
  table.liste thead th { font-size: 5.9pt; letter-spacing: .18em; text-transform: uppercase; color: #526277; font-weight: 700; text-align: left; padding: 0 2.6mm 1.8mm 0; border-bottom: .7pt solid #0B1220; }
  table.liste td { padding: 1.9mm 2.6mm 1.9mm 0; border-bottom: .4pt solid #E1E8F2; vertical-align: top; font-size: 8.2pt; }
  table.liste tr { page-break-inside: avoid; }
  table.liste .r { text-align: right; white-space: nowrap; }
  table.liste.kompakt td { padding: 1.3mm 2mm 1.3mm 0; font-size: 7.9pt; }
  table.liste tfoot td { border-top: .7pt solid #0B1220; border-bottom: 0; font-weight: 600; color: #0B1220; }
  table.liste td .unter { display: block; font-size: 6.8pt; color: #6B7A90; margin-top: .3mm; }
  .punkt { display: inline-block; width: 2.6mm; height: 2.6mm; border-radius: 50%; margin-right: 2mm; vertical-align: middle; }
  .ring { display: grid; grid-template-columns: 50mm 1fr; gap: 6mm; align-items: center; }
  .legende { display: flex; gap: 6mm; font-size: 7pt; color: #526277; margin-top: 1mm; }
  .legende i { display: inline-block; width: 2.6mm; height: 2.6mm; border-radius: 1mm; margin-right: 1.4mm; vertical-align: middle; }
  .balken { display: grid; gap: 1.6mm; margin: 2mm 0; }
  .b-zeile { display: grid; grid-template-columns: 48mm 1fr 32mm; gap: 3mm; align-items: center; font-size: 8pt; page-break-inside: avoid; }
  .b-spur { height: 3.2mm; background: #EEF2F8; border-radius: 1mm; overflow: hidden; }
  .b-spur i { display: block; height: 100%; border-radius: 1mm; }
  .b-t { text-align: right; font-size: 7.6pt; color: #22324A; }
  .merkmal { display: grid; grid-template-columns: 7mm 52mm 1fr; gap: 3mm; padding: 2.4mm 0; border-bottom: .4pt solid #E1E8F2; align-items: baseline; page-break-inside: avoid; }
  .merkmal .z { width: 5mm; height: 5mm; border-radius: 50%; color: #FFFFFF; font-size: 7.4pt; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; }
  .merkmal b { color: #0B1220; font-weight: 600; }
  .haushalt td.r { width: 36mm; }
  .schritt { border: .5pt solid #C9D5E5; border-radius: 2.4mm; padding: 3.4mm 4.4mm; margin: 2.4mm 0; page-break-inside: avoid; }
  .schritt .kopf { display: flex; justify-content: space-between; gap: 5mm; align-items: baseline; }
  .schritt b { font-size: 10pt; color: #0B1220; }
  .schritt .wirkung { font-family: "JetBrains Mono", monospace; font-size: 8pt; color: #0F7A55; white-space: nowrap; }
  .schritt .wirkung.ruecklage { color: #1D4ED8; }
  .schritt ul { margin: 1.6mm 0 0; padding-left: 4.4mm; }
  .schritt li { margin: .8mm 0; }
  .frist-gruppe { break-inside: avoid; page-break-inside: avoid; }
  .frist { font-size: 6.4pt; letter-spacing: .26em; text-transform: uppercase; color: #1D4ED8; font-weight: 700; margin: 6mm 0 1mm; }
  .skala-hell { text-align: center; margin: 2mm 0 0; }
  .baender { display: grid; grid-template-columns: repeat(5, 1fr); gap: 2mm; margin: 2mm 0 4mm; }
  .baender div { border-top: 1.4mm solid #288DFA; padding-top: 1.6mm; font-size: 7.2pt; }
  .baender div:nth-child(1) { border-top-color: #D93A3A; } .baender div:nth-child(2) { border-top-color: #D99A06; }
  .baender div:nth-child(3) { border-top-color: #8EC5FC; } .baender div:nth-child(4) { border-top-color: #288DFA; } .baender div:nth-child(5) { border-top-color: #1D4ED8; }
  .baender div.an { font-weight: 600; box-shadow: inset 0 -0.6mm 0 #0B1220; padding-bottom: 1mm; }
  .pruefwert { font-family: "JetBrains Mono", monospace; font-size: 9pt; letter-spacing: .08em; color: #0B1220; }
  .fortschritt { height: 4mm; background: #EEF2F8; border-radius: 1mm; overflow: hidden; margin: 2mm 0 1mm; }
  .fortschritt i { display: block; height: 100%; background: linear-gradient(90deg, #288DFA, #1D4ED8); }
  .glossar dt { font-weight: 600; color: #0B1220; margin-top: 2mm; }
  .glossar dd { margin: .4mm 0 0; }
  .abschluss { margin-top: 10mm; padding-top: 4mm; border-top: .7pt solid #0B1220; display: grid; grid-template-columns: 1fr auto; gap: 6mm; align-items: end; page-break-inside: avoid; }
`;

/** Laufende Kopfzeile + Kapitelkopf (mit unsichtbarer Marke im ersten Durchgang). */
function kapitelKopf(nr: number, nummer: string, mitMarke = true): string {
  const k = KAPITEL.find((x) => x.nr === nr)!;
  // Nachprüfung 08.10.: Die Marke braucht nur der erste Durchgang (Seitenzahlen suchen). Im zweiten bleibt
  // ein leeres Element gleicher Höhe — sonst stünde „FAKAPITEL01“ in der Textschicht (Kopieren, Vorlesen).
  return `<div class="lauf"><span class="t"><b>FIAON</b> · ${esc(FA_PRODUKT.replace(/^FIAON /, ""))}</span><span class="t">Nr. ${esc(nummer)} · Vertraulich</span></div>`
    + `<span class="mk">${mitMarke ? marke(nr) : ""}</span><div class="kap"><span class="n">${String(nr).padStart(2, "0")}</span><h2>${esc(k.titel)}</h2></div>`;
}

const OHNE_DETAIL = `<p class="fein">Diese Fassung wurde vor dem 14.10.2026 erstellt und enthält die Einzelaufstellung noch nicht. Eine neue Fassung zeigt sie vollständig.</p>`;

/** Was der Kunde je Merkmal tun kann (Kapitel 10). */
const MERKMAL_RAT: Record<string, string> = {
  "Regelmäßiges Einkommen": "Lassen Sie Ihr Einkommen immer auf dasselbe Konto gehen — Banken wollen es dort jeden Monat sehen.",
  "Ausgaben gedeckt": "Die Sofort-Schritte in Kapitel 12 bringen den Monat ins Plus; erst dann trägt eine neue Rate.",
  "Kontoführung ohne Minus": "Ein Monat ohne Minus zählt bei jeder Bank. Ein Dauerauftrag direkt nach dem Zahltag hilft, einen Puffer zu halten.",
  "Keine Rücklastschriften": "Legen Sie Lastschriften auf die Tage direkt nach dem Zahltag — jede geplatzte Lastschrift sieht die Bank.",
  "Keine Inkasso- oder Mahnkosten": "Offene Forderungen zuerst klären — eine anerkannte Schuldnerberatung hilft kostenfrei (Kapitel 14).",
  "Keine Hinweise auf Pfändung": "Sprechen Sie mit einer anerkannten Schuldnerberatung; ein geordneter Plan ist hier der erste Schritt.",
  "Tragbare Raten": "Keine neuen Raten, bis die bestehenden unter 15 % der Einnahmen liegen; „Später bezahlen“ meiden.",
  "Kein Glücksspiel": "Buchungen für Wetten oder Glücksspiel wiegen schwer — eine Sperre beim Anbieter oder bei der Bank stoppt sie.",
  "Freier Betrag nach Haushaltsrechnung": "Jeder Euro aus Kapitel 11, der wirklich übrig bleibt, erhöht den freien Betrag, auf den eine Bank schaut.",
};

/** Das HTML. `seiten` = Kapitelnummer → Seite (zweiter Durchgang). */
export function finanzauswertungHtml(inhalt: AuswertungInhalt, seiten: Record<number, number> = {}): string {
  const f = inhalt.fakten;
  const d = f.detail;
  const fw = inhalt.finanzwert;
  const name = [inhalt.kunde.vorname, inhalt.kunde.nachname].filter(Boolean).join(" ") || "Kundin / Kunde";
  const zr = `${dtag(inhalt.zeitraum.von)} – ${dtag(inhalt.zeitraum.bis)}`;
  const vorbehalt = inhalt.vorbehalte.length > 0;
  const baender = BAENDER.slice().reverse();
  const mitMarke = KAPITEL.some((k) => !seiten[k.nr]);
  const kz = kennzahlenAus({ ...f, detail: d });
  const bank = bankblickAus({ ...f, detail: d, volleMonate: f.zeitraum.volleMonate.length });
  const jahr = jahresblickAus({ ...f, detail: d }, inhalt.sparpotenzial);
  const potenzialMonat = inhalt.sparpotenzial.bisCents;
  const einnahmen = f.einnahmenJeMonatCents;
  const anteilEin = (c: number) => (einnahmen > 0 ? pct(c / einnahmen) : "—");
  const ausgestellt = dtagLang(inhalt.erstelltAm);
  const jahrZahl = new Intl.DateTimeFormat("de-DE", { year: "numeric", timeZone: "Europe/Berlin" }).format(new Date(inhalt.erstelltAm));
  const bankKurz = bank.urteil.titel.replace(/^Aus Sicht einer Bank: /, "");
  const gross = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  // ── Deckblatt ────────────────────────────────────────────────────────────
  const deckblatt = `
  <section class="deck">
    <div class="oben">${markeSvg("fiaon", "#FFFFFF", "18pt")}<span class="vertraulich">Vertraulich</span></div>
    <div class="art">Finanzanalyse · Persönlicher Bericht</div>
    <h1>Finanz- und<br>Bonitätsauswertung</h1>
    <div class="fuer">erstellt für <b>${esc(name)}</b>${vorbehalt ? " · mit Vorbehalt (Kapitel 16)" : ""}</div>
    <div class="mitte">
      <div class="skala">${skalaSvg(fw.wert, true, 330)}
        <div class="wert">${fw.wert}<small>${esc(FA_WERT_NAME)} · 100–999</small></div>
        <div class="band">${esc(gross(fw.band))}</div>
      </div>
      <div class="urteil">
        <div class="l">Gesamturteil</div>
        <div class="t">${esc(AMPEL_WORT[inhalt.gesamt.ampel])} — ${esc(inhalt.gesamt.grund)}</div>
        <div class="l">Bonität aus Sicht einer Bank</div>
        <div class="t">${esc(gross(bankKurz))}</div>
      </div>
    </div>
    <div class="pillen">${inhalt.ampeln.map((a) => pille(a.ampel, a.titel, true)).join("")}</div>
    <div class="meta">
      <div><div class="l">Dokument-Nr.</div><div class="w mono">${esc(inhalt.nummer)}</div></div>
      <div><div class="l">Ausgestellt am</div><div class="w">${esc(ausgestellt)}</div></div>
      <div><div class="l">Analysezeitraum</div><div class="w">${esc(dtag(inhalt.zeitraum.von))} –<br>${esc(dtag(inhalt.zeitraum.bis))}</div></div>
      <div><div class="l">Datengrundlage</div><div class="w">${f.buchungen} Buchungen<br>${inhalt.zeitraum.tage} Tage</div></div>
    </div>
    <div class="siegel">${siegelSvg(inhalt.nummer, jahrZahl)}</div>
    <div class="kenn">${esc(FINANZWERT_KENNZEICHNUNG)}</div>
  </section>`;

  // ── Verzeichnis ──────────────────────────────────────────────────────────
  const verzeichnis = `
  <section class="seite">
    <div class="lauf"><span class="t"><b>FIAON</b> · ${esc(FA_PRODUKT.replace(/^FIAON /, ""))}</span><span class="t">Nr. ${esc(inhalt.nummer)} · Vertraulich</span></div>
    <div class="kap"><span class="n">—</span><h2>Inhalt</h2></div>
    <table class="verzeichnis">${KAPITEL.map((k) => `<tr><td class="n">${String(k.nr).padStart(2, "0")}</td><td>${esc(k.titel)}</td><td class="s">${seiten[k.nr] ? seiten[k.nr] : ""}</td></tr>`).join("")}</table>
    <div class="kasten blau" style="margin-top:7mm">
      <b>So lesen Sie diese Auswertung.</b>
      <p style="margin-top:1.6mm">Grundlage sind Ihr Kontoauszug für den Zeitraum ${esc(zr)} mit ${f.buchungen} Buchungen${inhalt.auskunft ? ", Ihr Ausweis und Ihre Bonitätsauskunft" : " und Ihr Ausweis"}. Wir haben jede Buchung einem Empfänger und einer Ausgabengruppe zugeordnet und daraus Ihre Einnahmen, Ausgaben, Verträge, Ihren Monatsablauf und Ihre Bonitätsmerkmale gerechnet. Beträge sind Monatsdurchschnitte über den Zeitraum, auf volle Euro gerundet.</p>
      <p>Die Ampeln zeigen je Bereich, wo Sie stehen: <b style="color:${FARBE.gruen}">Grün</b> heißt gut aufgestellt, <b style="color:${FARBE.gelb}">Gelb</b> heißt hier lohnt es sich anzusetzen, <b style="color:${FARBE.rot}">Rot</b> heißt hier hat es Vorrang. Kapitel 11 und 12 zeigen, was Sie konkret tun können — mit dem Betrag, den es Ihnen im Monat und im Jahr bringt.</p>
      <p class="fein" style="margin:0">${esc(FINANZWERT_KURZ)}</p>
    </div>
  </section>`;

  // ── 01 Zusammenfassung ───────────────────────────────────────────────────
  const top3 = inhalt.schritte.filter((s) => s.wirkung?.art !== "ruecklage").slice(0, 3);
  const staerkste = inhalt.ampeln.filter((a) => a.ampel === "gruen");
  const schwaechste = inhalt.ampeln.filter((a) => a.ampel === "rot").concat(inhalt.ampeln.filter((a) => a.ampel === "gelb"));
  const groessteGruppe = d?.gruppen[0]
    ?? (f.gruppen[0] ? { ...f.gruppen[0], anteilEinnahmen: einnahmen > 0 ? f.gruppen[0].jeMonatCents / einnahmen : null } : null);
  const groessterTipp = (d?.tipps ?? []).filter((t) => !t.hinweis && t.jeMonatCents > 0).sort((a, b) => b.jeMonatCents - a.jeMonatCents)[0];
  const kern: string[] = [];
  kern.push(staerkste.length
    ? `<b>Ihre Stärke:</b> ${esc(staerkste.slice(0, 2).map((a) => a.titel).join(" und "))} — ${esc(staerkste[0].grund)}`
    : `<b>Ihre Ausgangslage:</b> ${esc(inhalt.gesamt.grund)}`);
  if (groessteGruppe) kern.push(`<b>Ihr größter Kostenblock:</b> ${esc(groessteGruppe.name)} mit ${eur(groessteGruppe.jeMonatCents)} im Monat${groessteGruppe.anteilEinnahmen != null ? ` — ${pct(groessteGruppe.anteilEinnahmen)} Ihrer Einnahmen` : ""}.`);
  kern.push(potenzialMonat > 0
    ? `<b>Ihr Potenzial:</b> bis zu ${eur(potenzialMonat)} im Monat, das sind bis zu ${eur(potenzialMonat * 12)} im Jahr${groessterTipp ? ` — am meisten bei „${esc(groessterTipp.titel)}“` : ""}.`
    : `<b>Ihr Potenzial:</b> Ihre Ausgaben sind bereits schlank; Ihr Plan zielt darauf, den Stand zu halten und ein Polster aufzubauen.`);
  if (schwaechste.length) kern.push(`<b>Wo es Vorrang hat:</b> ${esc(schwaechste[0].titel)} — ${esc(schwaechste[0].grund)}`);
  kern.push(`<b>${esc(bank.urteil.titel)}.</b> ${esc(bank.urteil.satz)}`);
  const k1 = `
  <section class="seite">
    ${kapitelKopf(1, inhalt.nummer, mitMarke)}
    <p class="lead">${esc(inhalt.einordnung.zusammenfassung)}</p>
    <div class="ergebnis">
      <div>${skalaSvg(fw.wert, false, 220)}<div class="wert">${fw.wert}<small>${esc(FA_WERT_NAME)}</small></div></div>
      <div>
        <div class="zeile"><span class="l">Band</span><span>${esc(gross(fw.band))}</span></div>
        <div class="zeile"><span class="l">Gesamt</span><span>${pille(inhalt.gesamt.ampel, AMPEL_WORT[inhalt.gesamt.ampel])} ${esc(inhalt.gesamt.grund)}</span></div>
        <div class="zeile"><span class="l">Bankblick</span><span>${esc(gross(bankKurz))}</span></div>
        <div class="zeile"><span class="l">Zeitraum</span><span>${esc(zr)} · ${f.buchungen} Buchungen</span></div>
      </div>
    </div>
    <div class="kacheln">
      <div><div class="l">Ø Einnahmen</div><div class="w">${eur(f.einnahmenJeMonatCents)}</div><div class="u">im Monat</div></div>
      <div><div class="l">Ø Ausgaben</div><div class="w">${eur(f.ausgabenJeMonatCents)}</div><div class="u">im Monat</div></div>
      <div><div class="l">Ø Überschuss</div><div class="w ${f.ueberschussJeMonatCents >= 0 ? "plus" : "minus"}">${eur(f.ueberschussJeMonatCents)}</div><div class="u">${einnahmen > 0 ? `${pct(f.ueberschussQuote)} der Einnahmen` : "im Monat"}</div></div>
      <div><div class="l">Potenzial</div><div class="w">${potenzialMonat > 0 ? eur(potenzialMonat) : "—"}</div><div class="u">bis zu, im Monat</div></div>
      <div><div class="l">Im Jahr</div><div class="w">${potenzialMonat > 0 ? eur(potenzialMonat * 12) : "—"}</div><div class="u">bis zu</div></div>
    </div>
    <h3>Die Kernaussagen</h3>
    <ol class="kern">${kern.map((k) => `<li><span>${k}</span></li>`).join("")}</ol>
    <h3>Die drei wichtigsten Schritte</h3>
    ${top3.length ? top3.map((s, i) => `<div class="schritt"><div class="kopf"><b>${i + 1}. ${esc(s.titel)}</b>${s.wirkung ? `<span class="wirkung">${s.wirkung.vonCents === s.wirkung.bisCents ? `rund ${eur(s.wirkung.bisCents)}` : `${s.wirkung.vonCents > 0 ? `${eur(s.wirkung.vonCents)}–` : "bis zu "}${eur(s.wirkung.bisCents)}`} im Monat</span>` : ""}</div><div class="fein">${esc(s.warum)}</div></div>`).join("") : `<p>Ihre Finanzen sind geordnet — Ihr Plan in Kapitel 12 zeigt, wie Sie diesen Stand halten.</p>`}
    <h3>Prüfvermerke</h3>
    <ul class="fein" style="padding-left:4mm;margin:0">${inhalt.pruefvermerke.map((v) => `<li>${esc(v)}</li>`).join("")}</ul>
    ${vorbehalt ? `<div class="kasten vorbehalt"><b>Vorbehalt.</b> ${inhalt.vorbehalte.map((v) => esc(VORBEHALT_TEXTE[v] ?? v)).join(" ")}</div>` : ""}
  </section>`;

  // ── 02 Ampel ─────────────────────────────────────────────────────────────
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

  // ── 03 Kennzahlen ────────────────────────────────────────────────────────
  const k3 = `
  <section class="seite">
    ${kapitelKopf(3, inhalt.nummer, mitMarke)}
    <p class="lead">Ihre wichtigsten Quoten, gemessen an allgemeinen Richtwerten der Haushaltsführung. Ein Richtwert ist eine bewährte Faustregel, keine Pflicht — er zeigt, wo Ihr Geld im Vergleich besonders viel oder wenig Raum bekommt.</p>
    <table class="liste"><thead><tr><th>Kennzahl</th><th class="r">Ihr Wert</th><th class="r">Richtwert</th><th>Einordnung</th></tr></thead><tbody>
    ${kz.map((k) => `<tr><td><b style="color:#0B1220;font-weight:600">${esc(k.titel)}</b><span class="unter">${esc(k.satz)}</span></td><td class="r mono">${esc(k.wert)}</td><td class="r">${esc(k.richtwert)}</td><td>${status(k.status)}</td></tr>`).join("")}
    </tbody></table>
    <h3>Ihre Einnahmen — wohin sie gehen</h3>
    ${balkenH([
      { label: "Feste Kosten", wert: f.festJeMonatCents, text: `${eur(f.festJeMonatCents)} · ${anteilEin(f.festJeMonatCents)}`, farbe: "#0B1220" },
      { label: "Lebenshaltung (variabel)", wert: f.variabelJeMonatCents, text: `${eur(f.variabelJeMonatCents)} · ${anteilEin(f.variabelJeMonatCents)}`, farbe: "#288DFA" },
      { label: f.ueberschussJeMonatCents >= 0 ? "Überschuss" : "Fehlbetrag", wert: Math.abs(f.ueberschussJeMonatCents), text: `${eur(f.ueberschussJeMonatCents)} · ${anteilEin(Math.abs(f.ueberschussJeMonatCents))}`, farbe: f.ueberschussJeMonatCents >= 0 ? "#0F9D6B" : "#D93A3A" },
    ], Math.max(einnahmen, f.festJeMonatCents + f.variabelJeMonatCents))}
    <p class="fein">Gemessen an Ihren gesamten Einnahmen (${eur(einnahmen)} im Monat).</p>
  </section>`;

  // ── 04 Einnahmen ─────────────────────────────────────────────────────────
  const quelleText: Record<string, string> = { gehalt: "Gehalt bzw. Lohn", rente: "Rente bzw. Pension", sozialleistung: "Sozialleistungen", gemischt: "mehrere Quellen", keins: "kein regelmäßiges Einkommen erkennbar" };
  const volleEin = f.einkommenMonate.filter((m) => m.voll && m.cents > 0).map((m) => m.cents);
  const schwankung = volleEin.length >= 2 ? Math.max(...volleEin) - Math.min(...volleEin) : null;
  const k4 = `
  <section class="seite">
    ${kapitelKopf(4, inhalt.nummer, mitMarke)}
    <p class="lead">Im Schnitt gehen ${eur(f.einkommenJeMonatCents)} Einkommen im Monat ein (${esc(quelleText[f.einkommenQuelle] ?? f.einkommenQuelle)})${f.weitereJeMonatCents > 0 ? `, dazu ${eur(f.weitereJeMonatCents)} weitere Eingänge wie Erstattungen oder Überweisungen` : ""}.${f.zahltag ? ` Ihr Einkommen kommt meist um den ${f.zahltag}. des Monats.` : ""}${schwankung != null ? ` Zwischen dem stärksten und dem schwächsten vollen Monat liegen ${eur(schwankung)}.` : ""}</p>
    <h3>Ihre Einkommensquellen</h3>
    ${d ? `<table class="liste"><thead><tr><th>Quelle</th><th>Art</th><th>Rhythmus</th><th class="r">Eingänge</th><th class="r">üblich je Eingang</th><th class="r">Ø je Monat</th></tr></thead><tbody>
      ${d.einkommen.map((e) => `<tr><td>${esc(e.name)}<span class="unter">${esc(dtag(e.ersteAm))} – ${esc(dtag(e.letzteAm))}</span></td><td>${esc(e.art)}</td><td>${e.tag ? `um den ${e.tag}.` : esc(e.rhythmus)}</td><td class="r mono">${e.anzahl}</td><td class="r mono">${eur(e.typischCents)}</td><td class="r mono">${eur(e.jeMonatCents)}</td></tr>`).join("") || `<tr><td colspan="6">Kein regelmäßiges Einkommen im Auszug.</td></tr>`}
      </tbody></table>` : OHNE_DETAIL}
    <h3>Monatsverlauf</h3>
    ${monatsBalken(f.monate)}
    <table class="liste" style="margin-top:4mm"><thead><tr><th>Monat</th><th class="r">Einkommen</th><th class="r">Weitere Eingänge</th><th class="r">Ausgaben</th><th class="r">Saldo</th></tr></thead><tbody>
    ${f.monate.map((m) => `<tr><td>${esc(monatsName(m.monat))}${m.voll ? "" : " <span class=\"fein\">(teilweise)</span>"}</td><td class="r mono">${eur(m.einkommenCents)}</td><td class="r mono">${eur(m.weitereCents)}</td><td class="r mono">${eur(m.ausgabenCents)}</td><td class="r mono">${eur(m.freiCents)}</td></tr>`).join("")}
    </tbody></table>
    ${d && d.weitere.length ? `<h3>Weitere Eingänge</h3><table class="liste kompakt"><thead><tr><th>Von</th><th>Art</th><th class="r">Anzahl</th><th class="r">Summe im Zeitraum</th></tr></thead><tbody>
      ${d.weitere.map((w) => `<tr><td>${esc(w.name)}</td><td>${esc(w.art)}</td><td class="r mono">${w.anzahl}</td><td class="r mono">${eur(w.summeCents)}</td></tr>`).join("")}</tbody></table>` : ""}
    ${d && (d.umbuchungen.einCents > 0 || d.umbuchungen.ausCents > 0) ? `<p class="fein" style="margin-top:3mm">Umbuchungen zwischen Ihren eigenen Konten (${eur(d.umbuchungen.einCents)} hinein, ${eur(d.umbuchungen.ausCents)} hinaus) zählen weder als Einnahme noch als Ausgabe.</p>` : ""}
  </section>`;

  // ── 05 Ausgaben im Überblick ─────────────────────────────────────────────
  const k5 = `
  <section class="seite">
    ${kapitelKopf(5, inhalt.nummer, mitMarke)}
    <p class="lead">Im Schnitt gehen ${eur(f.ausgabenJeMonatCents)} im Monat hinaus — davon ${eur(f.festJeMonatCents)} feste Zahlungen (${pct(f.fixkostenQuote)} der Einnahmen) und ${eur(f.variabelJeMonatCents)} für die laufende Lebenshaltung.</p>
    <h3>Wofür Ihr Geld geht</h3>
    ${ring(f.gruppen)}
    ${d ? `<h3>Alle Ausgabengruppen</h3><table class="liste"><thead><tr><th>Gruppe</th><th class="r">Empfänger</th><th class="r">je Monat</th><th class="r">Anteil an den Ausgaben</th><th class="r">Anteil an den Einnahmen</th></tr></thead><tbody>
      ${d.gruppen.map((g) => `<tr><td>${esc(g.name)}${g.fest ? ` <span class="fein">· fest</span>` : ""}</td><td class="r mono">${g.posten.length}</td><td class="r mono">${eur(g.jeMonatCents)}</td><td class="r mono">${pct(g.anteil)}</td><td class="r mono">${g.anteilEinnahmen != null ? pct(g.anteilEinnahmen) : "—"}</td></tr>`).join("")}
      </tbody><tfoot><tr><td>Zusammen</td><td class="r mono">${d.gruppen.reduce((s, g) => s + g.posten.length, 0)}</td><td class="r mono">${eur(f.ausgabenJeMonatCents)}</td><td class="r mono">100 %</td><td class="r mono">${anteilEin(f.ausgabenJeMonatCents)}</td></tr></tfoot></table>` : ""}
    ${f.art9Anzahl ? `<p class="fein" style="margin-top:3mm">${f.art9Anzahl} Buchung${f.art9Anzahl === 1 ? "" : "en"} stehen ohne Empfänger unter „Sonstiges“ — siehe Kapitel 16 (Datenschutz).</p>` : ""}
  </section>`;

  // ── 06 Ausgaben im Detail ────────────────────────────────────────────────
  const MAX_JE_GRUPPE = 30;
  const k6 = `
  <section class="seite">
    ${kapitelKopf(6, inhalt.nummer, mitMarke)}
    <p class="lead">Jede Ausgabe aus Ihrem Kontoauszug, geordnet nach Gruppe und Empfänger — wie oft Sie dort gezahlt haben, wie viel üblicherweise, was es Sie im Monat und im ganzen Zeitraum gekostet hat.</p>
    ${d ? d.gruppen.filter((g) => g.posten.length > 0).map((g) => {
      const zeige = g.posten.slice(0, MAX_JE_GRUPPE);
      const rest = g.posten.slice(MAX_JE_GRUPPE);
      return `<h4>${esc(g.name)}<span class="neben">${eur(g.jeMonatCents)} im Monat · ${g.anteilEinnahmen != null ? `${pct(g.anteilEinnahmen)} der Einnahmen` : pct(g.anteil)} · ${g.posten.length} Empfänger</span></h4>
      <table class="liste kompakt"><thead><tr><th>Empfänger</th><th>Art</th><th>Rhythmus</th><th class="r">Zahlungen</th><th class="r">üblich</th><th class="r">je Monat</th><th class="r">im Zeitraum</th></tr></thead><tbody>
      ${zeige.map((p) => `<tr><td>${esc(p.name)}${p.zweck ? `<span class="unter">${esc(p.zweck.slice(0, 60))}</span>` : ""}</td><td>${esc(p.art)}</td><td>${p.tag && p.fest ? `um den ${p.tag}.` : esc(p.rhythmus)}${!p.aktiv && p.fest ? ` <span class="fein">(beendet)</span>` : ""}</td><td class="r mono">${p.anzahl}</td><td class="r mono">${eurGenau(p.typischCents)}</td><td class="r mono">${eur(p.jeMonatCents)}</td><td class="r mono">${eur(p.summeCents)}</td></tr>`).join("")}
      ${rest.length ? `<tr><td colspan="3">${rest.length} weitere Empfänger</td><td class="r mono">${rest.reduce((s, p) => s + p.anzahl, 0)}</td><td></td><td class="r mono">${eur(rest.reduce((s, p) => s + p.jeMonatCents, 0))}</td><td class="r mono">${eur(rest.reduce((s, p) => s + p.summeCents, 0))}</td></tr>` : ""}
      </tbody></table>`;
    }).join("") + (d.verborgen ? `<p class="fein" style="margin-top:4mm">Dazu ${d.verborgen.anzahl} Buchung${d.verborgen.anzahl === 1 ? "" : "en"} (${eur(d.verborgen.jeMonatCents)} im Monat), die wir zum Schutz besonderer Daten ohne Empfänger führen (Art. 9 DSGVO, Kapitel 16).</p>` : "") : OHNE_DETAIL}
  </section>`;

  // ── 07 Monat im Ablauf ───────────────────────────────────────────────────
  const zahltagTeil = f.zahltag && d ? d.monatsTeile.findIndex((t) => f.zahltag! >= t.von && f.zahltag! <= t.bis) : -1;
  const ersteZehn = d ? d.monatsTeile.filter((t) => t.bis <= 10).reduce((s, t) => s + t.anteil, 0) : 0;
  const staerksterTag = d ? d.wochentage.slice().sort((a, b) => b.jeWocheCents - a.jeWocheCents)[0] : null;
  const gruppenMonate = d ? d.gruppen.slice(0, 8) : [];
  const k7 = `
  <section class="seite">
    ${kapitelKopf(7, inhalt.nummer, mitMarke)}
    ${d ? `
    <p class="lead">Wann im Monat Ihr Geld abfließt, an welchen Tagen Sie am meisten ausgeben und wie sich Ihr Kontostand bewegt.${ersteZehn > 0 ? ` ${pct(ersteZehn)} Ihrer Ausgaben fallen in die ersten zehn Tage des Monats.` : ""}${staerksterTag && staerksterTag.jeWocheCents > 0 ? ` Am meisten geben Sie an einem ${esc(staerksterTag.tag)} aus.` : ""}</p>
    <h3>Ausgaben nach Abschnitt des Monats (Ø je Monat)</h3>
    ${saeulen(d.monatsTeile.map((t) => ({ label: `Tag ${t.label}`, cents: t.jeMonatCents })), { hervor: zahltagTeil >= 0 ? zahltagTeil : undefined, hinweis: zahltagTeil >= 0 ? `Blau: der Abschnitt mit Ihrem Zahltag (um den ${f.zahltag}.).` : undefined })}
    <h3>Ausgaben nach Wochentag (Ø je Woche)</h3>
    ${saeulen(d.wochentage.map((w) => ({ label: w.tag.slice(0, 2), cents: w.jeWocheCents })), { hervor: staerksterTag ? d.wochentage.findIndex((w) => w.tag === staerksterTag.tag) : undefined })}
    <h3>Ihr Kontostand</h3>
    ${d.saldo ? `${linie(d.saldo.verlauf)}
      <table class="liste kompakt" style="margin-top:3mm"><tbody>
        <tr><td>Durchschnittlicher Kontostand</td><td class="r mono">${eur(d.saldo.schnittCents)}</td></tr>
        <tr><td>Tiefster Stand</td><td class="r mono">${eur(d.saldo.tiefsterCents)} am ${esc(dtag(d.saldo.tiefsterAm))}</td></tr>
        <tr><td>Höchster Stand</td><td class="r mono">${eur(d.saldo.hoechsterCents)}</td></tr>
        ${d.saldo.vorZahltagCents != null ? `<tr><td>Stand kurz vor dem Zahltag (Ø)</td><td class="r mono">${eur(d.saldo.vorZahltagCents)}</td></tr>` : ""}
        <tr><td>Tage im Minus</td><td class="r mono">${f.dispoTage ?? d.saldo.tageUnterNull}</td></tr>
        ${d.saldo.endeCents != null ? `<tr><td>Stand am Ende des Auszugs</td><td class="r mono">${eur(d.saldo.endeCents)}</td></tr>` : ""}
      </tbody></table>` : `<p class="fein">Ihr Kontoauszug nennt keine Kontostände je Buchung — der Verlauf lässt sich daraus nicht zeichnen.</p>`}
    ${gruppenMonate.length && f.zeitraum.monate.length > 1 ? `<h3>Ihre Gruppen Monat für Monat</h3>
      <table class="liste kompakt"><thead><tr><th>Gruppe</th>${f.zeitraum.monate.map((m) => `<th class="r">${esc(monatsName(m, true).slice(0, 3))}</th>`).join("")}</tr></thead><tbody>
      ${gruppenMonate.map((g) => `<tr><td>${esc(g.name)}</td>${g.monate.map((m) => `<td class="r mono">${m.cents ? Math.round(m.cents / 100).toLocaleString("de-DE") : "–"}</td>`).join("")}</tr>`).join("")}
      </tbody></table><p class="fein">Beträge in Euro. Teilmonate am Anfang und Ende des Auszugs sind nicht hochgerechnet.</p>` : ""}
    ` : OHNE_DETAIL}
  </section>`;

  // ── 08 Verträge ──────────────────────────────────────────────────────────
  const vertragSumme = f.vertraege.reduce((s, v) => s + v.jeMonatCents, 0);
  const doppelt = doppelteVertraege(f);
  const k8 = `
  <section class="seite">
    ${kapitelKopf(8, inhalt.nummer, mitMarke)}
    <p class="lead">Diese Zahlungen laufen regelmäßig und sind im Zeitraum zuletzt noch abgegangen. Zusammen binden sie ${eur(vertragSumme)} im Monat — ${eur(vertragSumme * 12)} im Jahr.</p>
    <table class="liste"><thead><tr><th>Vertrag / Abo</th><th>Art</th><th>Fällig</th><th class="r">je Monat</th><th class="r">im Jahr</th></tr></thead><tbody>
    ${f.vertraege.map((v) => `<tr><td>${esc(v.name)}</td><td>${esc(v.kategorie)}</td><td>${v.tag ? `um den ${v.tag}.` : esc(v.rhythmus)}</td><td class="r mono">${eurGenau(v.jeMonatCents)}</td><td class="r mono">${eur(v.jeMonatCents * 12)}</td></tr>`).join("") || `<tr><td colspan="5">Keine laufenden Verträge erkennbar.</td></tr>`}
    </tbody>${f.vertraege.length ? `<tfoot><tr><td colspan="3">Zusammen</td><td class="r mono">${eurGenau(vertragSumme)}</td><td class="r mono">${eur(vertragSumme * 12)}</td></tr></tfoot>` : ""}</table>
    ${doppelt.length ? `<div class="kasten blau"><b>Doppelte Verträge.</b> ${doppelt.map((x) => `${esc(x.kategorie)}: ${esc(x.posten.join(", "))}`).join(" · ")}. Prüfen Sie, ob Sie beide brauchen — der kleinere Vertrag allein kostet ${eur(Math.min(...doppelt.map((x) => x.kleinsterCents)))} im Monat.</div>` : ""}
    <h3>So prüfen Sie jeden Vertrag</h3>
    <ul style="padding-left:4.4mm;margin:0">
      <li>Brauche ich ihn noch — und in diesem Umfang?</li>
      <li>Wann kann ich kündigen? Laufzeit und Frist stehen im Vertrag oder im Kundenkonto des Anbieters.</li>
      <li>Gibt es denselben Umfang günstiger — beim selben Anbieter (Bestandskundenangebot) oder bei einem anderen?</li>
    </ul>
  </section>`;

  // ── 09 Verbindlichkeiten ─────────────────────────────────────────────────
  const k9 = `
  <section class="seite">
    ${kapitelKopf(9, inhalt.nummer, mitMarke)}
    <p class="lead">Was eine Bank oder ein Vermieter als Erstes sehen möchte: wie verlässlich Sie zahlen und wie viel Ihres Einkommens schon gebunden ist.</p>
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

  // ── 10 Bonität aus Sicht einer Bank ──────────────────────────────────────
  const AUSKUNFT_STUFE: Record<string, string> = { frei: "Nichts Belastendes gefunden", aufraeumen: "Erledigt — es läuft nur noch die Zeit", angreifbar: "Überschaubar — hier lässt sich arbeiten", dringend: "Viel auf einmal — es braucht einen Plan" };
  const h = bank.haushalt;
  const offeneMerkmale = bank.merkmale.filter((m) => m.stand !== "ok");
  const k10 = `
  <section class="seite">
    ${kapitelKopf(10, inhalt.nummer, mitMarke)}
    <p class="lead">Bevor eine Bank einen Kredit, einen Dispo oder eine Karte vergibt, muss sie prüfen, ob Sie ihn tragen können (§ 505a BGB). Dafür schaut sie vor allem auf Ihren Kontoverlauf: Kommt das Einkommen verlässlich? Sind die Ausgaben gedeckt? Wird pünktlich gezahlt? Genau das haben wir aus Ihrem Kontoauszug gelesen.</p>
    <div class="kasten dunkel"><b>${esc(bank.urteil.titel)}.</b><p style="margin:1.4mm 0 0">${esc(bank.urteil.satz)}</p></div>
    <h3>Die Haushaltsrechnung (je Monat)</h3>
    <table class="liste haushalt"><tbody>
      <tr><td>Einnahmen</td><td class="r mono">${eur(h.einnahmenCents)}</td></tr>
      <tr><td>− feste Kosten (Wohnen, Energie, Versicherungen, Verträge)</td><td class="r mono">${eur(h.festOhneRatenCents)}</td></tr>
      <tr><td>− bestehende Raten</td><td class="r mono">${eur(h.ratenCents)}</td></tr>
      <tr><td>− Lebenshaltung (Ihre tatsächlichen Ausgaben)</td><td class="r mono">${eur(h.lebenshaltungCents)}</td></tr>
    </tbody><tfoot><tr><td>Frei verfügbar</td><td class="r mono" style="color:${h.freiCents >= 0 ? "#0F7A55" : "#B42318"}">${eur(h.freiCents)}</td></tr></tfoot></table>
    <h3>Die Merkmale einer Kreditprüfung</h3>
    ${bank.merkmale.map((m) => `<div class="merkmal"><span class="z" style="background:${MERKMAL_FARBE[m.stand]}">${MERKMAL_ZEICHEN[m.stand]}</span><b>${esc(m.titel)}</b><span>${esc(m.satz)}</span></div>`).join("")}
    ${inhalt.auskunft ? `
      <h3>Ihre vorgelegte Bonitätsauskunft</h3>
      <p>Zusätzlich ausgewertet haben wir Ihre Auskunft${inhalt.auskunft.auskunftei ? ` der ${esc(inhalt.auskunft.auskunftei)}` : ""}${inhalt.auskunft.vom ? ` vom ${esc(dtag(inhalt.auskunft.vom))}` : ""}.</p>
      <table class="liste"><tbody>
        <tr><td>Einschätzung</td><td class="r">${esc(AUSKUNFT_STUFE[String(inhalt.auskunft.stufe)] ?? "—")}</td></tr>
        <tr><td>Einträge in der Auskunft</td><td class="r mono">${inhalt.auskunft.negativ}</td></tr>
        ${inhalt.auskunft.offenCents != null ? `<tr><td>Offene Beträge laut Auskunft</td><td class="r mono">${eur(inhalt.auskunft.offenCents)}</td></tr>` : ""}
      </tbody></table>
      <p class="fein" style="margin-top:2mm">Einen Score der Auskunftei weisen wir bewusst nicht aus — er gehört der Auskunftei und ist nicht der ${esc(FA_WERT_NAME)}.</p>` : ""}
    <h3>So stärken Sie Ihre Bonität</h3>
    <ul style="padding-left:4.4mm;margin:0">
      ${offeneMerkmale.length ? offeneMerkmale.map((m) => `<li><b style="color:#0B1220;font-weight:600">${esc(m.titel)}:</b> ${esc(MERKMAL_RAT[m.titel] ?? "Der Plan in Kapitel 12 zeigt den Weg.")}</li>`).join("") : "<li>Halten Sie den heutigen Stand: Einkommen auf ein Konto, Lastschriften gedeckt, neue Raten nur mit Puffer.</li>"}
    </ul>
    <p class="fein" style="margin-top:3mm">Diese Einordnung ist keine Kreditwürdigkeitsprüfung und keine Zusage — wie eine Bank entscheidet, legt allein die Bank fest. Sie zeigt, welche Merkmale Ihres Kontoverlaufs dabei für oder gegen Sie sprechen.</p>
  </section>`;

  // ── 11 Optimierungspotenzial ─────────────────────────────────────────────
  const tippsEuro = (d?.tipps ?? []).filter((t) => !t.hinweis && t.jeMonatCents > 0).sort((a, b) => b.jeMonatCents - a.jeMonatCents);
  const tippsHinweis = (d?.tipps ?? []).filter((t) => t.hinweis || t.jeMonatCents <= 0);
  const k11 = `
  <section class="seite">
    ${kapitelKopf(11, inhalt.nummer, mitMarke)}
    <p class="lead">Wo in Ihren Ausgaben Spielraum steckt — Posten für Posten, mit dem Betrag, um den es im Monat und im Jahr geht. „Vermeidbar“ heißt: Dieses Geld lässt sich ganz sparen (Gebühren, Zinsen, Wetten). Bei den übrigen Punkten geht es um einen Teil davon.</p>
    ${d ? (tippsEuro.length ? `
      ${balkenH(tippsEuro.slice(0, 8).map((t) => ({ label: t.titel, wert: t.jeMonatCents, text: `${eur(t.jeMonatCents)} / Monat`, farbe: t.vermeidbar ? "#D93A3A" : "#1D4ED8" })), tippsEuro[0].jeMonatCents)}
      <table class="liste" style="margin-top:4mm"><thead><tr><th>Ansatzpunkt</th><th class="r">betrifft je Monat</th><th class="r">im Jahr</th></tr></thead><tbody>
      ${tippsEuro.map((t) => `<tr><td><b style="color:#0B1220;font-weight:600">${esc(t.titel)}</b>${t.vermeidbar ? ` <span class="fein">· vermeidbar</span>` : ""}<span class="unter">${esc(t.text)}</span></td><td class="r mono">${eur(t.jeMonatCents)}</td><td class="r mono">${eur(t.jeMonatCents * 12)}</td></tr>`).join("")}
      </tbody></table>` : `<p>In Ihren Ausgaben stecken keine auffälligen Kostentreiber — Gebühren, doppelte Verträge oder teure Gewohnheiten finden wir nicht.</p>`)
      + (tippsHinweis.length ? `<h3>Zur Einordnung</h3>${tippsHinweis.map((t) => `<div class="kasten"><b>${esc(t.titel)}</b><p style="margin:1.2mm 0 0">${esc(t.text)}</p></div>`).join("")}` : "") : OHNE_DETAIL}
    <div class="kasten blau"><b>Was davon realistisch ist.</b> Ihr Plan in Kapitel 12 rechnet aus diesen Punkten ${inhalt.sparpotenzial.bisCents > 0 ? `${inhalt.sparpotenzial.vonCents > 0 ? `zwischen ${eur(inhalt.sparpotenzial.vonCents)} und ` : "bis zu "}${eur(inhalt.sparpotenzial.bisCents)} im Monat` : "vor allem Ordnung, weniger Ersparnis"} — vorsichtig, nur aus Ihren eigenen Buchungen.</div>
  </section>`;

  // ── 12 Plan ──────────────────────────────────────────────────────────────
  const fristen: Frist[] = ["sofort", "30", "90", "365"];
  const k12 = `
  <section class="seite">
    ${kapitelKopf(12, inhalt.nummer, mitMarke)}
    <p class="lead">Ihr Plan in Schritten, die Sie selbst gehen können — nach Dringlichkeit geordnet, mit dem, was der Schritt im Monat bewirken kann. Die Beträge sind Spannen aus Ihren eigenen Buchungen, keine Zusage.</p>
    ${fristen.map((fr) => {
      const liste = inhalt.schritte.filter((s) => s.frist === fr);
      if (!liste.length) return "";
      // Die Überschrift bleibt mit dem ersten Schritt zusammen (sonst stünde „Einmal im Jahr“ allein am Seitenende).
      return `<div class="frist-gruppe"><div class="frist">${esc(FRIST_TEXT[fr])}</div>` + liste.map((s, i) => `${i === 1 ? "</div>" : ""}<div class="schritt"><div class="kopf"><b>${esc(s.titel)}</b>${s.wirkung ? `<span class="wirkung${s.wirkung.art === "ruecklage" ? " ruecklage" : ""}">${s.wirkung.art === "ruecklage" ? `Rücklage rund ${eur(s.wirkung.bisCents)} im Monat` : s.wirkung.vonCents === s.wirkung.bisCents ? `rund ${eur(s.wirkung.bisCents)} im Monat` : `${s.wirkung.vonCents > 0 ? `${eur(s.wirkung.vonCents)}–` : "bis zu "}${eur(s.wirkung.bisCents)} im Monat`}</span>` : ""}</div><div class="fein">${esc(s.warum)}</div><ul>${s.wie.map((w) => `<li>${esc(w)}</li>`).join("")}</ul></div>`).join("") + (liste.length === 1 ? "</div>" : "");
    }).join("")}
    <div class="kasten blau"><b>Zusammen</b> können die Schritte ${inhalt.sparpotenzial.bisCents > 0 ? `${inhalt.sparpotenzial.vonCents > 0 ? `zwischen ${eur(inhalt.sparpotenzial.vonCents)} und ` : "bis zu "}${eur(inhalt.sparpotenzial.bisCents)} im Monat` : "Ihren Monat vor allem ordnen"} bewirken — je nachdem, welche Sie umsetzen.</div>
  </section>`;

  // ── 13 Nächste 12 Monate ─────────────────────────────────────────────────
  const reserveQuote = jahr.reserveZielCents > 0 ? Math.min(1, jahr.standCents / jahr.reserveZielCents) : 0;
  const k13 = `
  <section class="seite">
    ${kapitelKopf(13, inhalt.nummer, mitMarke)}
    <p class="lead">Was Ihr heutiger Monat aufs Jahr gerechnet bedeutet — und was sich ändert, wenn Sie Ihren Plan umsetzen. Eine Hochrechnung aus Ihren Durchschnitten, keine Prognose.</p>
    <div class="kacheln vier">
      <div><div class="l">Einnahmen im Jahr</div><div class="w">${eur(jahr.einnahmenCents)}</div></div>
      <div><div class="l">Ausgaben im Jahr</div><div class="w">${eur(jahr.ausgabenCents)}</div></div>
      <div><div class="l">Übrig heute</div><div class="w ${jahr.heuteCents >= 0 ? "plus" : "minus"}">${eur(jahr.heuteCents)}</div></div>
      <div><div class="l">Übrig mit Plan</div><div class="w ${jahr.mitPlanCents >= 0 ? "plus" : "minus"}">${eur(jahr.mitPlanCents)}</div></div>
    </div>
    ${balkenH([
      { label: "Heute", wert: Math.max(0, jahr.heuteCents), text: eur(jahr.heuteCents), farbe: "#94A3B8" },
      { label: "Mit Plan", wert: Math.max(0, jahr.mitPlanCents), text: eur(jahr.mitPlanCents), farbe: "#1D4ED8" },
    ], Math.max(1, jahr.heuteCents, jahr.mitPlanCents))}
    <p class="fein">Mit Plan: Ihr heutiger Überschuss plus die Mitte der Spanne aus Kapitel 12 (${eur(jahr.planJeMonatCents)} im Monat).</p>
    <h3>Ihr finanzielles Polster</h3>
    <p>Als Polster für Unerwartetes — eine Reparatur, eine Nachzahlung, ein Monat ohne Einkommen — gelten drei Monatsausgaben als Richtwert: bei Ihnen <b>${eur(jahr.reserveZielCents)}</b>.${d?.saldo?.endeCents != null ? ` Am Ende des Auszugs stand Ihr Konto bei ${eur(d.saldo.endeCents)}.` : ""}</p>
    <div class="fortschritt"><i style="width:${(reserveQuote * 100).toFixed(1)}%"></i></div>
    <p class="fein">${jahr.monateBisZiel === 0 ? "Ihr Polster ist schon erreicht." : jahr.monateBisZiel != null ? `Mit Plan ist das Polster in rund ${jahr.monateBisZiel} Monat${jahr.monateBisZiel === 1 ? "" : "en"} erreicht, wenn der Überschuss jeden Monat zur Seite geht.` : "Solange der Monat nicht aufgeht, wächst kein Polster — die Sofort-Schritte in Kapitel 12 haben deshalb Vorrang."}</p>
  </section>`;

  // ── 14 Vergleichswege ────────────────────────────────────────────────────
  const k14 = `
  <section class="seite">
    ${kapitelKopf(14, inhalt.nummer, mitMarke)}
    <p class="lead">Allgemeine Wege, Preise zu vergleichen und Hilfe zu bekommen. FIAON empfiehlt keine bestimmten Anbieter und erhält für diese Hinweise keine Vergütung.</p>
    ${inhalt.vergleichswege.map((v) => `<div class="kasten"><b>${esc(v.titel)}</b><p style="margin:1.4mm 0 0">${esc(v.text)}</p></div>`).join("")}
  </section>`;

  // ── 15 Finanzwert erklärt ────────────────────────────────────────────────
  const k15 = `
  <section class="seite">
    ${kapitelKopf(15, inhalt.nummer, mitMarke)}
    <p class="lead">Der ${esc(FA_WERT_NAME)} fasst Ihre Lage in einer Zahl zwischen 100 und 999 zusammen. Er entsteht nach festen, offen gelegten Regeln — nicht durch künstliche Intelligenz. Jeder Punkt lässt sich auf Ihre Unterlagen zurückführen.</p>
    <div class="skala-hell">${skalaSvg(fw.wert, false, 300)}<div class="mono" style="font-size:22pt;margin-top:-17mm;color:#0B1220">${fw.wert}</div><div class="fein">${esc(fw.band)}</div></div>
    <div class="baender">${baender.map((b) => `<div class="${b.band === fw.band ? "an" : ""}">${esc(b.band)}<br><span class="mono fein">ab ${b.ab}</span></div>`).join("")}</div>
    <table class="liste"><thead><tr><th>Kriterium</th><th>Grundlage</th><th class="r">Punkte</th><th class="r">von</th></tr></thead><tbody>
      <tr><td>Sockel</td><td class="fein">jeder Wert beginnt bei ${FINANZWERT_SOCKEL}</td><td class="r mono">${FINANZWERT_SOCKEL}</td><td class="r mono">${FINANZWERT_SOCKEL}</td></tr>
      ${fw.kriterien.map((k) => `<tr><td>${esc(k.titel)}</td><td class="fein">${esc(k.grund)}</td><td class="r mono">${k.punkte}</td><td class="r mono">${k.max}</td></tr>`).join("")}
    </tbody><tfoot><tr><td>${esc(FA_WERT_NAME)}</td><td></td><td class="r mono">${fw.wert}</td><td class="r mono">${FINANZWERT_SOCKEL + GEWICHTE.reduce((s, g) => s + g.max, 0)}</td></tr></tfoot></table>
    <div class="kasten blau"><b>Was der Wert ist — und was nicht.</b><p style="margin:1.4mm 0 0">${esc(FINANZWERT_KENNZEICHNUNG)}</p></div>
  </section>`;

  // ── 16 Methodik ──────────────────────────────────────────────────────────
  const k16 = `
  <section class="seite">
    ${kapitelKopf(16, inhalt.nummer, mitMarke)}
    <h3>Datenbasis</h3>
    <p>Kontoauszug ${esc(zr)} (${f.buchungen} Buchungen, ${inhalt.zeitraum.tage} Tage)${inhalt.ausweisTyp ? `, Ausweis (${esc(inhalt.ausweisTyp)})` : ", Ausweis"}${inhalt.auskunft ? `, Bonitätsauskunft${inhalt.auskunft.auskunftei ? ` der ${esc(inhalt.auskunft.auskunftei)}` : ""}` : ""}. Regelwerk ${esc(inhalt.regelVersion)}.</p>
    <h3>Wie wir rechnen</h3>
    <p>Jede Buchung wird gelesen, einem Empfänger und einer Kategorie zugeordnet und auf Dubletten geprüft. Umbuchungen zwischen Ihren eigenen Konten zählen nicht. Monatswerte sind der Durchschnitt über den Zeitraum (Summe geteilt durch die Zahl der Monate). Feste Kosten sind Zahlungen, die regelmäßig wiederkehren. Richtwerte sind allgemeine Faustregeln der Haushaltsführung, keine Statistik über Sie.</p>
    ${vorbehalt ? `<h3>Vorbehalt</h3>${inhalt.vorbehalte.map((v) => `<p>${esc(VORBEHALT_TEXTE[v] ?? v)}</p>`).join("")}` : ""}
    <h3>Begriffe</h3>
    <dl class="glossar">
      <dt>Überschuss</dt><dd>Was nach allen Ausgaben im Monat übrig bleibt (Einnahmen minus Ausgaben).</dd>
      <dt>Fixkostenquote</dt><dd>Anteil Ihrer Einnahmen, der jeden Monat fest abgeht, bevor Sie etwas entscheiden können.</dd>
      <dt>Haushaltsrechnung</dt><dd>Die Rechnung, mit der Banken prüfen, was nach festen Kosten, Raten und Lebenshaltung frei bleibt.</dd>
      <dt>Rücklastschrift</dt><dd>Eine Lastschrift, die Ihre Bank mangels Deckung oder auf Widerspruch zurückgegeben hat.</dd>
      <dt>Finanzielles Polster</dt><dd>Geld auf dem Konto für Unerwartetes; Richtwert sind drei Monatsausgaben.</dd>
    </dl>
    <h3>Rechtliche Hinweise</h3>
    ${HAFTUNG_ABSAETZE.map((a) => `<p>${esc(a)}</p>`).join("")}
    <h3>Datenschutz</h3>
    <p>${esc(DATENSCHUTZ_ABSATZ)}</p>
    <p>${inhalt.texteQuelle === "ki" ? "Die erläuternden Sätze sind mit Unterstützung künstlicher Intelligenz formuliert und vor der Übergabe von einem Menschen bei FIAON geprüft worden." : "Die erläuternden Sätze sind nach festen Regeln formuliert und vor der Übergabe von einem Menschen bei FIAON geprüft worden."}</p>
    <div class="abschluss">
      <div>
        <h3 style="margin-top:0">Prüfwert</h3>
        <p class="pruefwert">${esc(pruefwert(inhalt))}</p>
        <p class="fein">Der Prüfwert bildet den Inhalt dieser Fassung ab. Eine neue Auswertung erhält eine neue Fassungsnummer; frühere Fassungen bleiben in Ihrem Bereich abrufbar.</p>
        <p class="fein" style="margin-top:3mm">Ausgestellt am ${esc(ausgestellt)} · Dokument-Nr. ${esc(inhalt.nummer)}<br>FIAON LTD · Company No. 17318250 · 128 City Road · London EC1V 2NX · United Kingdom</p>
      </div>
      <div>${markeSvg("fiaon", "#0B1220", "16pt")}</div>
    </div>
  </section>`;

  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${esc(FA_PRODUKT)} ${esc(inhalt.nummer)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@200;300;400&family=JetBrains+Mono:wght@400;500&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap" rel="stylesheet">
<style>${STIL}</style></head><body>
${deckblatt}${verzeichnis}${k1}${k2}${k3}${k4}${k5}${k6}${k7}${k8}${k9}${k10}${k11}${k12}${k13}${k14}${k15}${k16}
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
    fusszeile: `${FA_PRODUKT} · Nr. ${inhalt.nummer} · Vertraulich · Prüfwert ${pruefwert(inhalt)}`,
    rand: { oben: "15mm", unten: "20mm", links: "16mm", rechts: "16mm" },
    titel: FA_PRODUKT,
    keinNotbehelf: true,
  });
  const erst = await druck({});
  const seiten = await kapitelSeiten(erst).catch(() => ({} as Record<number, number>));
  if (Object.keys(seiten).length !== KAPITEL.length) return erst;
  return druck(seiten);
}
