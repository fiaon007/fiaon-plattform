// ═══════════════════════════════════════════════════════════════════════════
// FIAON BANKING — die Papiere (E-228, 23.09.2026)
//
// Justin: „Die PDFs müssen viel edler, mehr nach Bank aussehen."
//
// Ein gemeinsamer Briefkopf für alles, was das Banking druckt: ein feines
// Guilloche-Band wie auf Wertpapieren, die Wortmarke in weiter Laufweite, eine
// Zeile Mikroschrift unter der Kopflinie, ein Prüfwert über die Sachdaten im
// Fuß jeder Seite. Ruhige Typografie, Haarlinien, Zahlen in Tabellenziffern.
//
// ── WAS DIE PAPIERE NIE TUN ────────────────────────────────────────────────
// Sie sehen aus wie Bankpapiere, aber sie geben sich nie als solche aus. Der
// Absender ist immer die FIAON LTD, nie ein Institut. Der Kassenbuchauszug
// sagt in seinem Kopf, dass er kein Kontoauszug der Bank ist, und jede Zeile
// nennt ihre Herkunft (Bank, Auszahlung, Buchung von Hand). Ein Dokument, das
// man für einen Bankauszug halten könnte, obwohl ein Mensch die Zahlen
// eingetragen hat, wäre genau das Papier, das dieses Haus nie ausstellt.
// ═══════════════════════════════════════════════════════════════════════════

import { createHash } from "crypto";
import { sqlPool } from "./db-pool";
import { BANK } from "@shared/fiaon-bank";
import {
  auftrag, buchPerson, ibanHuebsch, ibanMaskiert, uebergabe, BUCH_LOGIN, type BuchPerson,
} from "./fiaon-buchhaltung";
import {
  KONTEN, umsaetze, kasse, buchSaldoAm, auszahlungen, artText, type KontoSchluessel, type Umsatz,
} from "./fiaon-banking";

const FIRMA = "FIAON LTD";
const FIRMA_ZEILE = "FIAON LTD · Company No. 17318250 · 128 City Road · London EC1V 2NX · United Kingdom";

// ── Kleinkram ───────────────────────────────────────────────────────────────
const esc = (v: unknown) => String(v ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const geld = (cents: number) =>
  new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100);

const geldVz = (cents: number) => `${cents < 0 ? "−" : "+"}${geld(Math.abs(cents))}`;

const datum = (iso: string | null | undefined, lang = false) => {
  if (!iso) return "—";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00Z`) : new Date(iso);
  return new Intl.DateTimeFormat("de-DE", lang
    ? { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Berlin" }
    : { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" }).format(d);
};

const uhrzeit = (iso: string) =>
  new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }).format(new Date(iso));

/** Prüfwert über die Sachdaten — nicht über das PDF, das ihn selbst enthält. */
function pruefwert(daten: unknown): string {
  const h = createHash("sha256").update(JSON.stringify(daten)).digest("hex").slice(0, 16).toUpperCase();
  return h.replace(/(.{4})(?=.)/g, "$1 ");
}

// ═══════════════════════════════════════════════════════════════════════════
// SICHERHEITSDRUCK
// ═══════════════════════════════════════════════════════════════════════════
/** Überlagerte Wellen mit Phasenversatz — das klassische Guilloche-Band. */
export function guillocheBand(breite = 600, hoehe = 40, linien = 22): string {
  const pfade: string[] = [];
  const schritte = 260;
  for (let k = 0; k < linien; k++) {
    const phase = (k / linien) * Math.PI * 2;
    let d = "";
    for (let i = 0; i <= schritte; i++) {
      const t = (i / schritte) * Math.PI * 2;
      const x = (i / schritte) * breite;
      const y = hoehe / 2
        + hoehe * 0.36 * Math.sin(t * 3 + phase) * Math.cos(t * 1.5 - phase / 2)
        + hoehe * 0.07 * Math.sin(t * 13 + phase * 2);
      d += `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(2)}`;
    }
    pfade.push(`<path d="${d}"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${breite} ${hoehe}" preserveAspectRatio="none" width="100%" height="100%">`
    + `<g fill="none" stroke="currentColor" stroke-width="0.32">${pfade.join("")}</g></svg>`;
}

/** Eine Hypotrochoide — die Rosette eines Wertpapiers. */
export function rosette(radius = 100): string {
  const R = 19, r = 7, d = 10;
  const max = R - r + d;
  const s = radius / max;
  let pfad = "";
  const schritte = 1600;
  for (let i = 0; i <= schritte; i++) {
    const t = (i / schritte) * Math.PI * 2 * r;
    const x = ((R - r) * Math.cos(t) + d * Math.cos(((R - r) / r) * t)) * s + radius;
    const y = ((R - r) * Math.sin(t) - d * Math.sin(((R - r) / r) * t)) * s + radius;
    pfad += `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  const innen = radius * 0.42;
  let pfad2 = "";
  for (let i = 0; i <= 900; i++) {
    const t = (i / 900) * Math.PI * 2 * 5;
    const rr = innen * (0.72 + 0.28 * Math.cos((24 / 5) * t));
    pfad2 += `${i ? "L" : "M"}${(radius + rr * Math.cos(t / 5)).toFixed(1)} ${(radius + rr * Math.sin(t / 5)).toFixed(1)}`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${radius * 2} ${radius * 2}" width="100%" height="100%">`
    + `<g fill="none" stroke="currentColor" stroke-width="0.4"><path d="${pfad}"/><path d="${pfad2}"/></g></svg>`;
}

const MIKRO = Array.from({ length: 26 }, () => "FIAON LTD · FIAON BANKING · ZAHLUNGSVERKEHR · ").join("");

// ═══════════════════════════════════════════════════════════════════════════
// DER BRIEFKOPF
// ═══════════════════════════════════════════════════════════════════════════
interface Brief {
  art: string;          // kleine Zeile über dem Titel, z. B. „Zahlungsverkehr"
  titel: string;        // „Zahlungsbestätigung"
  nummer: string;       // „ZA-2026-0001"
  ausgestellt: string;  // ISO
  inhalt: string;       // HTML
  rosette?: boolean;
}

const STIL = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: Inter, "Helvetica Neue", Helvetica, Arial, sans-serif;
    font-size: 8.6pt; line-height: 1.5; color: #22324A;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
    font-variant-numeric: tabular-nums;
  }
  .band { height: 12mm; color: #1D4ED8; opacity: .30; margin: 0 0 6.5mm; }
  .kopf { display: flex; justify-content: space-between; align-items: flex-end; gap: 10mm; }
  .marke { font-family: Outfit, Inter, sans-serif; font-weight: 300; font-size: 21pt; letter-spacing: .34em; color: #0B1220; line-height: 1; }
  .marke small { display: block; font-family: Inter, sans-serif; font-size: 6.2pt; letter-spacing: .36em; text-transform: uppercase; color: #1D4ED8; margin-top: 2.4mm; font-weight: 500; }
  .dok { text-align: right; }
  .dok .art { font-size: 6.2pt; letter-spacing: .3em; text-transform: uppercase; color: #526277; font-weight: 600; }
  .dok .titel { font-family: Outfit, Inter, sans-serif; font-weight: 300; font-size: 16.5pt; color: #0B1220; margin-top: 1.4mm; line-height: 1.15; }
  .dok .nr { font-family: "JetBrains Mono", ui-monospace, Menlo, monospace; font-size: 7.8pt; color: #22324A; margin-top: 1.4mm; letter-spacing: .02em; }
  .linie { border-top: 0.7pt solid #0B1220; margin: 5mm 0 0.7mm; }
  .mikro { font-size: 3.4pt; letter-spacing: .08em; color: #A7B7CE; white-space: nowrap; overflow: hidden; line-height: 1.2; }
  .absender { font-size: 6.8pt; color: #526277; margin-top: 2.4mm; letter-spacing: .01em; }
  .inhalt { margin-top: 8mm; position: relative; }
  .rosette { position: absolute; right: -6mm; top: 30mm; width: 70mm; height: 70mm; color: #1D4ED8; opacity: .06; pointer-events: none; }

  h2 { font-family: Inter, sans-serif; font-size: 6.4pt; letter-spacing: .26em; text-transform: uppercase; color: #526277; font-weight: 600; margin: 7mm 0 2.4mm; }
  p.lead { font-size: 9.2pt; color: #22324A; margin: 0 0 5mm; max-width: 150mm; line-height: 1.55; }
  .fein { font-size: 7pt; color: #526277; line-height: 1.55; }
  .mono { font-family: "JetBrains Mono", ui-monospace, Menlo, monospace; letter-spacing: .02em; }

  .parteien { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; }
  .partei { border: 0.5pt solid #C9D5E5; border-radius: 2.2mm; padding: 4mm 4.5mm; }
  .partei .rolle { font-size: 6.2pt; letter-spacing: .26em; text-transform: uppercase; color: #526277; font-weight: 600; }
  .partei .name { font-size: 10.5pt; color: #0E1A2E; margin-top: 1.6mm; font-weight: 500; }
  .partei .iban { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 8.4pt; color: #0E1A2E; margin-top: 1.4mm; letter-spacing: .03em; }
  .partei .zusatz { font-size: 7.2pt; color: #526277; margin-top: 0.8mm; }

  .betrag { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 5mm;
            border-top: 0.5pt solid #C9D5E5; border-bottom: 0.5pt solid #C9D5E5; padding: 4.5mm 0; }
  .betrag .l { font-size: 6.4pt; letter-spacing: .26em; text-transform: uppercase; color: #526277; font-weight: 600; }
  .betrag .z { font-family: Outfit, Inter, sans-serif; font-weight: 300; font-size: 25pt; color: #0B1220; line-height: 1; }
  .betrag .z small { font-family: Inter, sans-serif; font-size: 8pt; color: #526277; margin-left: 2mm; letter-spacing: .12em; }

  .status { display: inline-block; font-size: 6.6pt; letter-spacing: .2em; text-transform: uppercase; font-weight: 600;
            color: #12704F; border: 0.6pt solid #12704F; border-radius: 1.2mm; padding: 1.1mm 2.4mm; }
  .status.warn { color: #8A500C; border-color: #8A500C; }

  table.kv { width: 100%; border-collapse: collapse; }
  table.kv th { text-align: left; font-weight: 400; color: #526277; width: 52mm; padding: 2.1mm 4mm 2.1mm 0; vertical-align: top; border-bottom: 0.4pt solid #E1E8F2; font-size: 8pt; }
  table.kv td { padding: 2.1mm 0; border-bottom: 0.4pt solid #E1E8F2; color: #0E1A2E; font-size: 8.6pt; }

  table.liste { width: 100%; border-collapse: collapse; }
  table.liste thead th { font-size: 6pt; letter-spacing: .2em; text-transform: uppercase; color: #526277; font-weight: 600;
                         text-align: left; padding: 0 3mm 2mm 0; border-bottom: 0.7pt solid #0B1220; }
  table.liste td { padding: 2.2mm 3mm 2.2mm 0; border-bottom: 0.4pt solid #E1E8F2; vertical-align: top; font-size: 8.2pt; }
  table.liste tr { page-break-inside: avoid; }
  table.liste .r { text-align: right; padding-left: 4mm; white-space: nowrap; }
  table.liste th.r:last-child, table.liste td.r:last-child { padding-right: 0; }
  table.liste .n { white-space: nowrap; }
  table.liste .klein { display: block; color: #526277; font-size: 7pt; margin-top: 0.5mm; }
  table.liste .herkunft { font-size: 6pt; letter-spacing: .14em; text-transform: uppercase; color: #526277; white-space: nowrap; }
  table.liste tr.summe td { border-top: 0.7pt solid #0B1220; border-bottom: 0; font-weight: 600; color: #0E1A2E; padding-top: 2.8mm; }
  table.liste tr.gruppe td { padding-top: 5mm; border-bottom: 0.5pt solid #C9D5E5; font-weight: 600; color: #0E1A2E; font-size: 8.6pt; }
  table.liste tr.storno td { color: #94A3B8; text-decoration: line-through; }

  .kopfgitter { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm 6mm; border: 0.5pt solid #C9D5E5; border-radius: 2.2mm; padding: 4mm 4.5mm; }
  .kopfgitter .l { font-size: 6pt; letter-spacing: .24em; text-transform: uppercase; color: #526277; font-weight: 600; }
  .kopfgitter .w { font-size: 8.6pt; color: #0E1A2E; margin-top: 0.8mm; }

  .streifen { display: grid; grid-template-columns: repeat(4, 1fr); margin: 5mm 0 2mm; border-top: 0.5pt solid #C9D5E5; border-bottom: 0.5pt solid #C9D5E5; }
  .streifen > div { padding: 3.2mm 0 3.2mm 0; }
  .streifen > div + div { padding-left: 4mm; border-left: 0.4pt solid #E1E8F2; }
  .streifen .l { font-size: 6pt; letter-spacing: .22em; text-transform: uppercase; color: #526277; font-weight: 600; }
  .streifen .w { font-family: Outfit, Inter, sans-serif; font-weight: 300; font-size: 13pt; color: #0B1220; margin-top: 1mm; }

  .vermerk { margin-top: 4mm; padding: 3mm 4mm; border-radius: 2mm; background: #F4F7FC; font-size: 7.4pt; color: #22324A; line-height: 1.55; }
  ul { margin: 0; padding-left: 4.5mm; }
  li { margin: 0.8mm 0; }
`;

function briefHtml(b: Brief): string {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Outfit:wght@200;300;400&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>${STIL}</style></head><body>
  <div class="band">${guillocheBand()}</div>
  <div class="kopf">
    <div class="marke">FIAON<small>Banking</small></div>
    <div class="dok">
      <div class="art">${esc(b.art)}</div>
      <div class="titel">${esc(b.titel)}</div>
      <div class="nr">${esc(b.nummer)} · ${esc(datum(b.ausgestellt, true))}</div>
    </div>
  </div>
  <div class="linie"></div>
  <div class="mikro">${MIKRO}</div>
  <div class="absender">${esc(FIRMA_ZEILE)}</div>
  <div class="inhalt">
    ${b.rosette ? `<div class="rosette">${rosette()}</div>` : ""}
    ${b.inhalt}
  </div>
</body></html>`;
}

async function drucken(b: Brief, pruef: string, titel: string): Promise<Buffer> {
  const { htmlZuPdfMitFusszeile } = await import("./fiaon-html-pdf");
  return htmlZuPdfMitFusszeile({
    html: briefHtml(b),
    fusszeile: `${FIRMA} · Company No. 17318250 · ${b.nummer} · Prüfwert ${pruef} · erstellt ${datum(b.ausgestellt)} ${uhrzeit(b.ausgestellt)}`,
    rand: { oben: "12mm", unten: "17mm", links: "16mm", rechts: "16mm" },
    titel,
  });
}

const kontoZeile = (k: KontoSchluessel) => KONTEN.find((x) => x.schluessel === k)!;

// ═══════════════════════════════════════════════════════════════════════════
// ZAHLUNGSBESTÄTIGUNG
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Zu einem AUSGEFÜHRTEN Auftrag. Sie beschreibt, was die FIAON LTD getan hat —
 * beauftragt, freigegeben, an die Bank übergeben — und nennt die Referenz der
 * Bank als Beleg. Sie behauptet keine Gutschrift beim Empfänger.
 */
export async function bestaetigungErzeugen(id: number): Promise<Buffer> {
  const a = await auftrag(id);
  if (!a) throw new Error("Auftrag nicht gefunden");
  if (a.status !== "ausgefuehrt") throw new Error("Eine Bestätigung gibt es erst nach der Ausführung");
  const name = (e: string | null) => (e ? buchPerson(e)?.name ?? e : "—");
  const jetzt = new Date().toISOString();
  const pruef = pruefwert({ n: a.nummer, b: a.betragCents, i: a.iban, r: a.bankReferenz, t: a.ausgefuehrtAm });
  const freigabe = a.freigabeArt === "einzel"
    ? "Einzelzeichnung durch den Inhaber, mit TAN bestätigt"
    : "Vier-Augen-Verfahren, Freigabe mit TAN bestätigt";

  const inhalt = `
    <p class="lead">Die ${FIRMA} bestätigt, dass der folgende Zahlungsauftrag freigegeben und zur Ausführung an die Bank übergeben wurde.</p>
    <div class="parteien">
      <div class="partei">
        <div class="rolle">Auftraggeber</div>
        <div class="name">${esc(BANK.empfaenger)}</div>
        <div class="iban">${esc(BANK.ibanDisplay)}</div>
        <div class="zusatz">BIC ${esc(BANK.bic)} · ${esc(BANK.bank)}</div>
      </div>
      <div class="partei">
        <div class="rolle">Empfänger</div>
        <div class="name">${esc(a.empfaenger)}</div>
        <div class="iban">${esc(ibanHuebsch(a.iban))}</div>
        <div class="zusatz">${a.bic ? `BIC ${esc(a.bic)}` : "BIC nicht angegeben"}</div>
      </div>
    </div>
    <div class="betrag">
      <div>
        <div class="l">Betrag</div>
        <div class="z">${geld(a.betragCents)}<small>EUR</small></div>
      </div>
      <div class="status">Ausgeführt · ${esc(datum(a.ausgefuehrtAm))}</div>
    </div>
    <h2>Zahlung</h2>
    <table class="kv">
      <tr><th>Verwendungszweck</th><td>${esc(a.zweck)}</td></tr>
      <tr><th>Auftragsnummer</th><td class="mono">${esc(a.nummer)}</td></tr>
      <tr><th>Referenz der Bank</th><td class="mono">${esc(a.bankReferenz || "—")}</td></tr>
      ${a.kategorie ? `<tr><th>Kategorie</th><td>${esc(a.kategorie)}</td></tr>` : ""}
      ${a.payoutId ? `<tr><th>Mitarbeiter-Auszahlung</th><td class="mono">FIAON-AUS-${a.payoutId}</td></tr>` : ""}
    </table>
    <h2>Freigabe</h2>
    <table class="kv">
      <tr><th>Erfasst</th><td>${esc(name(a.erstelltVon))} · ${esc(datum(a.erstelltAm))} ${esc(uhrzeit(a.erstelltAm))}</td></tr>
      <tr><th>Freigegeben</th><td>${esc(name(a.entschiedenVon))} · ${esc(datum(a.entschiedenAm))}${a.entschiedenAm ? ` ${esc(uhrzeit(a.entschiedenAm))}` : ""}</td></tr>
      <tr><th>Verfahren</th><td>${esc(freigabe)}</td></tr>
      <tr><th>Überweisung eingetragen</th><td>${esc(name(a.ausgefuehrtVon))} · ${esc(datum(a.ausgefuehrtAm))}${a.ausgefuehrtAm ? ` ${esc(uhrzeit(a.ausgefuehrtAm))}` : ""}</td></tr>
    </table>
    <p class="fein" style="margin-top:6mm">Diese Bestätigung dokumentiert Beauftragung, Freigabe und Übergabe an die Bank durch die ${FIRMA}.
    Wann der Betrag beim Empfänger gutgeschrieben wird, bestimmt dessen Bank. Maßgeblich ist die Buchung unter der genannten Referenz.</p>`;

  const pdf = await drucken({ art: "Zahlungsverkehr", titel: "Zahlungsbestätigung", nummer: a.nummer, ausgestellt: jetzt, inhalt, rosette: true }, pruef, "Zahlungsbestätigung");
  const { docHash } = await import("./fiaon-html-pdf");
  await sqlPool`
    UPDATE fiaon_buch_auftrag SET bestaetigung_base64 = ${pdf.toString("base64")}, bestaetigung_hash = ${docHash(pdf.toString("base64"))}
     WHERE id = ${id}`;
  return pdf;
}

/** Die gespeicherte Bestätigung — immer dieselbe Datei. */
export async function bestaetigungLesen(id: number): Promise<Buffer | null> {
  const [r] = (await sqlPool`SELECT bestaetigung_base64 FROM fiaon_buch_auftrag WHERE id = ${id}`) as any[];
  return r?.bestaetigung_base64 ? Buffer.from(String(r.bestaetigung_base64), "base64") : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// KASSENBUCHAUSZUG — ein Monat, ein Konto
// ═══════════════════════════════════════════════════════════════════════════
const HERKUNFT: Record<string, string> = {
  kunde: "Bank", offen: "Bank", sonstiges: "Bank", auszahlung: "Auszahlung",
  ueberweisung: "Überweisung", einlage: "Von Hand", eingang: "Von Hand", ausgabe: "Von Hand", korrektur: "Von Hand",
};

function monatsGrenzen(monat: string): { von: string; bis: string; name: string } {
  const [j, m] = monat.split("-").map(Number);
  const letzter = new Date(Date.UTC(j, m, 0)).getUTCDate();
  const name = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(j, m - 1, 15)));
  return { von: `${monat}-01`, bis: `${monat}-${String(letzter).padStart(2, "0")}`, name };
}

export async function kassenbuchauszug(konto: KontoSchluessel, monat: string): Promise<Buffer> {
  if (!/^\d{4}-\d{2}$/.test(monat)) throw new Error("Monat im Format JJJJ-MM");
  const { von, bis, name } = monatsGrenzen(monat);
  const k = kontoZeile(konto);
  const jetzt = new Date().toISOString();
  const { zeilen } = await umsaetze({ konto, von, bis, limit: 500 });
  const chrono = [...zeilen].reverse();
  const tagDavor = new Date(new Date(`${von}T12:00:00Z`).getTime() - 86_400_000).toISOString().slice(0, 10);
  const saldoStart = konto === "geschaeft" ? await buchSaldoAm(tagDavor) : null;
  const saldoEnde = konto === "geschaeft" ? await buchSaldoAm(bis) : null;
  const ein = chrono.filter((u) => u.cents > 0 && !u.storniert && !u.schwebend).reduce((s, u) => s + u.cents, 0);
  const aus = chrono.filter((u) => u.cents < 0 && !u.storniert).reduce((s, u) => s - u.cents, 0);
  const nummer = `KBA-${monat.replace("-", "")}-${konto === "geschaeft" ? "GK" : "WI"}`;
  const pruef = pruefwert({ nummer, n: chrono.length, ein, aus, s: saldoEnde });
  const k2 = await kasse();

  const zeile = (u: Umsatz) => `
    <tr class="${u.storniert ? "storno" : ""}">
      <td class="n">${esc(datum(u.tag))}</td>
      <td>
        ${esc(u.gegenpartei)}${u.kunde && u.kunde !== u.gegenpartei ? ` <span style="color:#526277">· Kunde ${esc(u.kunde)}</span>` : ""}
        <span class="klein">${esc(u.zweck || artText(u.art))}${u.referenz ? ` · <span class="mono">${esc(u.referenz)}</span>` : ""}${u.schwebend ? " · unterwegs, noch nicht gutgeschrieben" : ""}${u.art === "offen" ? " · noch keiner Bestellung zugeordnet" : ""}</span>
      </td>
      <td class="herkunft">${esc(HERKUNFT[u.art] ?? "")}</td>
      <td class="r">${esc(geldVz(u.cents))}</td>
      <td class="r" style="color:#526277">${u.saldoNach != null ? esc(geld(u.saldoNach)) : ""}</td>
    </tr>`;

  const abgleichZeile = konto === "geschaeft" && k2.abgleich && k2.abgleich.am >= von && k2.abgleich.am <= bis
    ? `<div class="vermerk"><strong>Abgleich mit der Bank:</strong> Kontostand laut Bank am ${esc(datum(k2.abgleich.am))}: ${esc(geld(k2.abgleich.cents))} EUR ·
       Saldo laut Buch am selben Tag: ${k2.abgleich.buchAmTagCents != null ? esc(geld(k2.abgleich.buchAmTagCents)) : "nicht verfügbar"} EUR
       ${k2.abgleich.differenzCents != null ? ` · Differenz ${esc(geldVz(k2.abgleich.differenzCents))} EUR` : ""}.</div>`
    : "";

  const inhalt = `
    <div class="kopfgitter">
      <div><div class="l">Kontoinhaber</div><div class="w">${esc(k.inhaber)}</div></div>
      <div><div class="l">IBAN</div><div class="w mono">${esc(k.ibanDisplay)}</div></div>
      <div><div class="l">BIC</div><div class="w mono">${esc(k.bic)}</div></div>
      <div><div class="l">Konto</div><div class="w">${esc(k.name)}</div></div>
      <div><div class="l">Institut</div><div class="w">${esc(k.institut)}</div></div>
      <div><div class="l">Zeitraum</div><div class="w">${esc(datum(von))} – ${esc(datum(bis))}</div></div>
    </div>
    <div class="streifen">
      <div><div class="l">Anfangssaldo</div><div class="w">${saldoStart != null ? esc(geld(saldoStart)) : "—"}</div></div>
      <div><div class="l">Eingänge</div><div class="w">${esc(geld(ein))}</div></div>
      <div><div class="l">Ausgänge</div><div class="w">${esc(geld(aus))}</div></div>
      <div><div class="l">Endsaldo</div><div class="w">${saldoEnde != null ? esc(geld(saldoEnde)) : "—"}</div></div>
    </div>
    <p class="fein" style="margin:0 0 4mm">Auszug aus dem Kassenbuch der ${FIRMA} — <strong>kein Kontoauszug der Bank</strong>.
    Eingänge stammen aus dem Abruf der Bank, Auszahlungen und Überweisungen aus dem Zahlungsverkehr der ${FIRMA},
    Buchungen „von Hand“ wurden im Banking erfasst. ${konto === "geschaeft"
      ? (k2.anfang ? `Salden laut Buch ab dem Anfangsbestand zum ${esc(datum(k2.anfang.am))}.` : "Ein Anfangsbestand ist noch nicht gesetzt — deshalb ohne Salden.")
      : "Das Altkonto ist seit dem 02.09.2026 gesperrt; der Auszug zeigt die Umsätze ohne Salden."}</p>
    <h2>Umsätze · ${esc(name)}</h2>
    ${chrono.length === 0 ? `<p class="fein">Keine Umsätze in diesem Zeitraum.</p>` : `
    <table class="liste">
      <thead><tr><th>Tag</th><th>Vorgang</th><th>Herkunft</th><th class="r">Betrag EUR</th><th class="r">Saldo EUR</th></tr></thead>
      <tbody>
        ${chrono.map(zeile).join("")}
        <tr class="summe"><td></td><td>${chrono.length} Umsätze</td><td></td><td class="r">${esc(geldVz(ein - aus))}</td><td></td></tr>
      </tbody>
    </table>`}
    ${abgleichZeile}`;

  return drucken({ art: `${k.name} · ${k.ibanDisplay}`, titel: "Kassenbuchauszug", nummer, ausgestellt: jetzt, inhalt }, pruef, "Kassenbuchauszug");
}

// ═══════════════════════════════════════════════════════════════════════════
// AUSZAHLUNGEN AN MITARBEITER
// ═══════════════════════════════════════════════════════════════════════════
export async function auszahlungsbeleg(id: number): Promise<Buffer> {
  const alle = await auszahlungen();
  const p = alle.find((x) => x.id === id);
  if (!p) throw new Error("Auszahlung nicht gefunden");
  if (p.status !== "ausgezahlt") throw new Error("Ein Beleg entsteht erst, wenn die Auszahlung überwiesen ist");
  const konto = p.ausgezahltAm && new Date(p.ausgezahltAm).toISOString().slice(0, 10) < KONTEN[0].seit! ? KONTEN[1] : KONTEN[0];
  const [o] = p.auftragId
    ? (await sqlPool`SELECT nummer, bank_referenz FROM fiaon_buch_auftrag WHERE id = ${p.auftragId}`) as any[]
    : [];
  const jetzt = new Date().toISOString();
  const nummer = `FIAON-AUS-${p.id}`;
  const pruef = pruefwert({ nummer, c: p.cents, t: p.ausgezahltAm, a: p.agentId });
  const inhalt = `
    <p class="lead">Die ${FIRMA} bestätigt die folgende Auszahlung an ${esc(p.name)}.</p>
    <div class="parteien">
      <div class="partei">
        <div class="rolle">Auszahlendes Konto</div>
        <div class="name">${esc(konto.inhaber)}</div>
        <div class="iban">${esc(konto.ibanDisplay)}</div>
        <div class="zusatz">${esc(konto.name)} · ${esc(konto.institut)}</div>
      </div>
      <div class="partei">
        <div class="rolle">Empfänger</div>
        <div class="name">${esc(p.name)}</div>
        <div class="iban">${esc(p.ibanMaskiert || "IBAN hinterlegt")}</div>
        <div class="zusatz">Mitarbeiter-Nr. ${p.agentId}</div>
      </div>
    </div>
    <div class="betrag">
      <div><div class="l">Auszahlung · ${esc(p.art)}</div><div class="z">${geld(p.cents)}<small>EUR</small></div></div>
      <div class="status">Ausgezahlt · ${esc(datum(p.ausgezahltAm))}</div>
    </div>
    <h2>Einzelheiten</h2>
    <table class="kv">
      <tr><th>Beleg</th><td class="mono">${esc(nummer)}</td></tr>
      <tr><th>Art</th><td>${esc(p.art)}</td></tr>
      <tr><th>Angefordert am</th><td>${esc(datum(p.angefordertAm))}</td></tr>
      <tr><th>Überwiesen am</th><td>${esc(datum(p.ausgezahltAm))}</td></tr>
      <tr><th>Abrechnung</th><td class="mono">${esc(p.abrechnungNr || "—")}</td></tr>
      ${o ? `<tr><th>Zahlungsauftrag</th><td class="mono">${esc(o.nummer)}</td></tr><tr><th>Referenz der Bank</th><td class="mono">${esc(o.bank_referenz || "—")}</td></tr>` : ""}
    </table>
    <p class="fein" style="margin-top:6mm">Die Aufstellung der einzelnen Provisionen steht in der Abrechnung ${esc(p.abrechnungNr || "")}.
    Die IBAN ist aus Datenschutzgründen gekürzt.</p>`;
  return drucken({ art: "Mitarbeiter · Auszahlung", titel: "Auszahlungsbeleg", nummer, ausgestellt: jetzt, inhalt, rosette: true }, pruef, "Auszahlungsbeleg");
}

export async function auszahlungsjournal(von: string | null, bis: string | null): Promise<Buffer> {
  const alle = await auszahlungen();
  const imZeitraum = (iso: string | null) => {
    if (!iso) return false;
    const t = new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
    return (!von || t >= von) && (!bis || t <= bis);
  };
  const bezahlt = alle.filter((p) => p.status === "ausgezahlt" && imZeitraum(p.ausgezahltAm));
  const offen = alle.filter((p) => p.status === "angefordert" || p.status === "requested");
  const jeName = new Map<string, typeof bezahlt>();
  for (const p of bezahlt) jeName.set(p.name, [...(jeName.get(p.name) || []), p]);
  const gruppen = Array.from(jeName.entries()).sort((a, b) => a[0].localeCompare(b[0], "de"));
  const summe = bezahlt.reduce((s, p) => s + p.cents, 0);
  const jetzt = new Date().toISOString();
  const nummer = `AJ-${(von || "2026-07-01").replace(/-/g, "")}-${(bis || jetzt.slice(0, 10)).replace(/-/g, "")}`;
  const pruef = pruefwert({ nummer, n: bezahlt.length, summe });

  const inhalt = `
    <div class="streifen">
      <div><div class="l">Zeitraum</div><div class="w" style="font-size:10pt">${esc(von ? datum(von) : "Beginn")} – ${esc(bis ? datum(bis) : datum(jetzt))}</div></div>
      <div><div class="l">Ausgezahlt</div><div class="w">${esc(geld(summe))}</div></div>
      <div><div class="l">Auszahlungen</div><div class="w">${bezahlt.length}</div></div>
      <div><div class="l">Offen angefordert</div><div class="w">${esc(geld(offen.reduce((s, p) => s + p.cents, 0)))}</div></div>
    </div>
    <h2>Ausgezahlt, nach Mitarbeiter</h2>
    ${bezahlt.length === 0 ? `<p class="fein">Keine Auszahlungen in diesem Zeitraum.</p>` : `
    <table class="liste">
      <thead><tr><th>Überwiesen</th><th>Beleg</th><th>Art</th><th>Abrechnung</th><th class="r">Betrag EUR</th></tr></thead>
      <tbody>
        ${gruppen.map(([n, liste]) => `
          <tr class="gruppe"><td colspan="4">${esc(n)}</td><td class="r">${esc(geld(liste.reduce((s, p) => s + p.cents, 0)))}</td></tr>
          ${liste.map((p) => `<tr>
            <td class="n">${esc(datum(p.ausgezahltAm))}</td>
            <td class="mono">FIAON-AUS-${p.id}</td>
            <td>${esc(p.art)}</td>
            <td class="mono">${esc(p.abrechnungNr || "—")}</td>
            <td class="r">${esc(geld(p.cents))}</td>
          </tr>`).join("")}`).join("")}
        <tr class="summe"><td colspan="4">Summe ausgezahlt</td><td class="r">${esc(geld(summe))}</td></tr>
      </tbody>
    </table>`}
    ${offen.length ? `
    <h2>Angefordert, noch nicht überwiesen</h2>
    <table class="liste">
      <thead><tr><th>Angefordert</th><th>Mitarbeiter</th><th>Nr.</th><th>Stand</th><th class="r">Betrag EUR</th></tr></thead>
      <tbody>${offen.map((p) => `<tr>
        <td class="n">${esc(datum(p.angefordertAm))}</td><td>${esc(p.name)}</td><td class="mono">FIAON-AUS-${p.id}</td>
        <td>${p.status === "requested" ? "Altbestand" : p.auftragNr ? `Auftrag ${esc(p.auftragNr)}` : "angefordert"}</td>
        <td class="r">${esc(geld(p.cents))}</td></tr>`).join("")}</tbody>
    </table>` : ""}`;
  return drucken({ art: "Mitarbeiter · Auszahlungen", titel: "Auszahlungsjournal", nummer, ausgestellt: jetzt, inhalt }, pruef, "Auszahlungsjournal");
}

// ═══════════════════════════════════════════════════════════════════════════
// ÜBERGABE UND ZUGANG
// ═══════════════════════════════════════════════════════════════════════════
export async function uebergabeVermerk(): Promise<Buffer> {
  const u = await uebergabe();
  if (!u) throw new Error("Keine Übergabe hinterlegt");
  const k = await kasse();
  const person = u.bestaetigtVon ? buchPerson(u.bestaetigtVon) : null;
  const jetzt = new Date().toISOString();
  const nummer = `UEB-${u.stichtag.replace(/-/g, "")}`;
  const inhalt = `
    <p class="lead">Interner Vermerk zur Übergabe der laufenden Buchhaltung der ${FIRMA}.</p>
    <table class="kv">
      <tr><th>Bisher geführt von</th><td>${esc(u.bisher)}</td></tr>
      <tr><th>Übergabe zum</th><td>${esc(datum(u.stichtag, true))}</td></tr>
      <tr><th>Übernimmt</th><td>Florentine Lombardi</td></tr>
      <tr><th>Saldo laut Buch</th><td>${k.buchCents != null ? `${esc(geld(k.buchCents))} EUR` : "noch kein Anfangsbestand gesetzt"}</td></tr>
      ${k.live.ok && k.live.cents != null ? `<tr><th>Kontostand laut Bank</th><td>${esc(geld(k.live.cents))} EUR (Abruf ${esc(datum(k.live.stand!))} ${esc(uhrzeit(k.live.stand!))})</td></tr>` : ""}
    </table>
    <h2>Was übernommen wird</h2>
    <ul>
      <li>Die Vorbereitung sämtlicher Zahlungsaufträge des Hauses, einschließlich der Auszahlungen an Mitarbeiter.</li>
      <li>Die Zuordnung der Eingänge und die Pflege der Empfänger-Kartei.</li>
      <li>Die Monatsauszüge des Kassenbuchs und die Unterlagen für die Steuerberatung.</li>
    </ul>
    <h2>Was ausdrücklich beim Inhaber bleibt</h2>
    <ul>
      <li>Die Freigabe jeder Zahlung (mit TAN) und die Ausführung über das Bankkonto.</li>
      <li>Der Kontostand: Anfangsbestand, Einlagen, Korrekturen und Bankabgleich.</li>
    </ul>
    <div class="vermerk">${u.bestaetigtVon
      ? `Übernahme bestätigt von ${esc(person?.name || u.bestaetigtVon)} am ${esc(datum(u.bestaetigtAm))} um ${esc(uhrzeit(u.bestaetigtAm!))}.`
      : "Die Übernahme ist noch nicht bestätigt."}</div>`;
  return drucken({ art: "Interner Vermerk", titel: "Übergabe der Buchhaltung", nummer, ausgestellt: jetzt, inhalt },
    pruefwert({ nummer, u }), "Übergabe der Buchhaltung");
}

/** Das Zugangsblatt. Das Passwort steht NICHT darauf — es wird persönlich übergeben. */
export async function zugangsblatt(fuer: BuchPerson): Promise<Buffer> {
  const jetzt = new Date().toISOString();
  const nummer = `ZUG-${fuer.email.split("@")[0].toUpperCase()}`;
  const inhalt = `
    <p class="lead">Zugang zum FIAON Banking für ${esc(fuer.name)} (${esc(fuer.titel)}).</p>
    <h2>Anmeldung</h2>
    <table class="kv">
      <tr><th>Adresse</th><td class="mono">https://fiaon.com/buchhaltung</td></tr>
      <tr><th>Anmeldename</th><td class="mono">${esc(BUCH_LOGIN)}</td></tr>
      <tr><th>Passwort</th><td>wird persönlich übergeben — es steht bewusst nicht in diesem Dokument</td></tr>
      <tr><th>Zweiter Schritt</th><td>Person wählen, 12-stelligen PIN aus der Mail an <span class="mono">${esc(fuer.email)}</span> eingeben</td></tr>
      <tr><th>PIN</th><td>10 Minuten gültig, einmalig</td></tr>
      <tr><th>Abmeldung</th><td>automatisch nach 10 Minuten ohne Eingabe, spätestens nach 8 Stunden</td></tr>
    </table>
    <h2>Rechte</h2>
    <ul>
      ${fuer.rolle === "inhaber"
        ? `<li>Alles einsehen, Zahlungen mit TAN freigeben, Überweisungen eintragen.</li>
           <li>Den Kontostand bewegen: Anfangsbestand, Einlage, Eingang, Ausgabe, Korrektur, Bankabgleich — jeweils mit TAN.</li>
           <li>Zugänge sperren und Sitzungen beenden.</li>`
        : `<li>Alle Konten, Umsätze, Auszahlungen und Auszüge einsehen.</li>
           <li>Zahlungsaufträge und Mitarbeiter-Auszahlungen vorbereiten und zur Freigabe einreichen.</li>
           <li>Den Kontostand bewegt ausschließlich der Inhaber.</li>`}
    </ul>
    <h2>Regeln</h2>
    <ul>
      <li>Jede Zahlung trägt zwei Namen: wer sie vorbereitet und wer sie freigibt.</li>
      <li>Eine TAN gilt nur für den Vorgang, der in ihrer Mail steht. Stimmt er nicht: TAN nicht eingeben.</li>
      <li>PIN und TAN werden nie weitergegeben — auch nicht an Kollegen oder den Inhaber.</li>
      <li>Jede Handlung steht mit Namen und Uhrzeit im Protokoll.</li>
    </ul>`;
  return drucken({ art: "Persönlich · vertraulich", titel: "Zugang zum Banking", nummer, ausgestellt: jetzt, inhalt },
    pruefwert({ nummer, e: fuer.email }), "Zugang zum Banking");
}
