// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DAS INDIVIDUALANGEBOT ALS HTML UND ALS PDF
// Individualangebot (01.10.2026), Register E-268
//
// Rendert, was shared/fiaon-global-angebot.ts sagt — nichts sonst. Bildschirm,
// Prüfsumme und PDF lesen DENSELBEN Rumpf (angebotRumpfHtml): Vertrag mit fünfzehn
// Ziffern, Anlage 1 (Bürgschaftszusage), Anlage 2 (Prüfbericht) und Anlage 3
// (Widerrufsbelehrung). Die Haken des Kunden (sofortiger Beginn, Jahresbetreuung)
// ändern den Text und damit die Prüfsumme — gewollt: angenommen ist, was gezeigt wurde.
//
// ── DIE PRÜFSUMME ─────────────────────────────────────────────────────────
// docHash("global-angebot|" + ref + "|" + fassung + "|" + Rumpf ohne Annahmevermerk).
// Der Server rechnet sie bei der Annahme mit denselben Schaltern NACH und vergleicht
// sie mit der Summe, die der Kunde auf seiner Seite hatte (fiaon-global-angebot.ts).
//
// ── KEINE UNTERSCHRIFT AUF DEM PAD ────────────────────────────────────────
// Justin will die Annahme per Knopf („Zahlungspflichtig annehmen"). Für einen
// Dienstvertrag genügt die Textform; Nachweis sind Zeitpunkt, IP, Browser und die
// Prüfsumme — im PDF als Annahmevermerk, in der Akte als Spalten.
//
// Diese Datei fasst keine Datenbank an — der Prüfstand lädt sie ohne Netz.
// ═══════════════════════════════════════════════════════════════════════════
import { escapeHtml, wrapFiaonDocument, htmlZuPdfMitFusszeile, docHash } from "./fiaon-html-pdf";
import { globalWiderrufsbelehrung } from "@shared/fiaon-global-widerruf";
import { GLOBAL_VERTRAG_CSS } from "./fiaon-global-vertrag";
import { FIAON_FIRMA } from "@shared/fiaon-firma";
import {
  angebotZiffern, angebotPraeambel, angebotVertragTitel, angebotVertragUnterzeile, buergschaftTitel, buergschaftParteien,
  buergschaftZiffern, buergschaftUnterschrift, pruefberichtErgebnis, pruefberichtBoniText, angebotKundeName, angebotTag,
  PRUEFBERICHT_TITEL, ANGEBOT_KNOPF, ANGEBOT_LAND_NAME, ANLAGE1_FASSUNG,
  type AngebotDaten, type AngebotSchalter, type AngebotZiffer, type Pruefbericht,
} from "@shared/fiaon-global-angebot";

export interface AngebotAnnahme { am: Date; ip: string; userAgent: string; hash: string }

const e = escapeHtml;

function zeitText(am: Date): string {
  const tag = am.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" });
  const zeit = am.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
  return `${tag} um ${zeit} Uhr (Europe/Berlin)`;
}

/** Ziffern als HTML — eine Ziffer mit mehreren Absätzen nummeriert sie (1), (2) … */
function ziffernHtml(ziffern: AngebotZiffer[], klasse = "gv-ziffer"): string {
  return ziffern.map((z) => {
    const mehrere = z.absaetze.length > 1;
    const bloecke = z.absaetze.map((a, i) => {
      const nr = mehrere ? `(${i + 1}) ` : "";
      if (a.art === "p") return `<p>${nr}${e(a.text)}</p>`;
      const kopf = a.einleitung ? `<p>${nr}${e(a.einleitung)}</p>` : "";
      return `${kopf}<ul>${a.zeilen.map((x) => `<li>${e(x)}</li>`).join("")}</ul>`;
    });
    // Überschrift und erster Block bleiben im Druck zusammen (.gv-anfang) — wie im Global-Auftrag.
    const [erster, ...rest] = bloecke.join("").match(/<(p|ul)\b[\s\S]*?<\/\1>/g) ?? [];
    return `<section class="${klasse}" id="ziffer-${z.nr}"><div class="gv-anfang"><h2><span class="gv-nr">${z.nr}</span>${e(z.titel)}</h2>${erster ?? ""}</div>${rest.join("")}</section>`;
  }).join("\n");
}

function annahmeBlock(d: AngebotDaten, annahme: AngebotAnnahme | null): string {
  const name = angebotKundeName(d.kunde);
  const kunde = annahme
    ? `<span>Angenommen durch Klick auf „${e(ANGEBOT_KNOPF)}“</span>`
    : `<span class="gv-leise">Wird durch Klick auf „${e(ANGEBOT_KNOPF)}“ angenommen.</span>`;
  const meta = annahme
    ? `<div class="meta">Angenommen von ${e(name)} am ${e(zeitText(annahme.am))}<br/>IP-Adresse: ${e(annahme.ip || "—")}<br/>Browser: ${e(String(annahme.userAgent || "—").slice(0, 220))}<br/>Prüfsumme des Vertragstextes einschließlich der Anlagen (SHA-256): <span class="hash">${e(annahme.hash)}</span></div>`
    : "";
  return `
  <div class="sig-grid gv-sig">
    <div class="sig-col">
      <div class="gv-sig-kopf">Für FIAON</div>
      <div class="gv-sig-feld">FIAON LTD — elektronisch ausgefertigt</div>
      <div class="sig-line">${e(FIAON_FIRMA.director)}, Director</div>
    </div>
    <div class="sig-col">
      <div class="gv-sig-kopf">Für den Auftraggeber</div>
      <div class="gv-sig-feld">${kunde}</div>
      <div class="sig-line">${e(name)}${annahme ? `, ${e(d.kunde.ort)}, ${e(annahme.am.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" }))}` : ""}</div>
      ${meta}
    </div>
  </div>`;
}

/** Der Wortlaut der Anlage 1 ohne Unterschriftsblock — das, was das unterschriebene Original tragen muss. */
function anlage1Wortlaut(d: AngebotDaten): string {
  return `<h2>${e(buergschaftTitel(d))}</h2>
    <p class="gv-leise">zum Vertrag „${e(angebotVertragTitel())}“ zwischen der FIAON LTD und ${e(angebotKundeName(d.kunde))} · Angebot ${e(d.ref)}</p>
    ${buergschaftParteien(d).map((x) => `<p>${e(x)}</p>`).join("\n    ")}
    ${ziffernHtml(buergschaftZiffern(d), "gv-ziffer gia-anlage-ziffer")}`;
}
/**
 * Die Prüfsumme der Anlage 1 (nur ihr Wortlaut, ohne Unterschriftsvermerk) — steht auf dem Blatt zum
 * Unterschreiben und im Vertrag: So lässt sich nachweisen, dass das eigenhändig unterschriebene
 * Original GENAU diese Fassung trägt (§ 766 BGB; Gegenprüfung 01.10.2026).
 */
export function buergschaftPruefsumme(d: AngebotDaten): string {
  // E-271: Anlage 1 hat ihren eigenen Fassungsstand (ANLAGE1_FASSUNG) — der Vertrag bekam die Kreditgarantie, der Wortlaut
  // der Bürgschaftszusage blieb gleich; so bleibt die Prüfsumme auf dem eigenhändig unterschriebenen Original gültig.
  return docHash(`global-angebot-anlage1|${d.ref}|${ANLAGE1_FASSUNG}|${anlage1Wortlaut(d)}`);
}
function anlage1Html(d: AngebotDaten): string {
  const u = buergschaftUnterschrift(d);
  return `
  <section class="gv-anlage" id="anlage-1">
    ${anlage1Wortlaut(d)}
    <div class="gv-schluss gia-buergin-sig">
      <div class="gv-sig-kopf">${e(u.kopf)}</div>
      <div class="gv-sig-feld"><span class="gv-leise">Ort, Datum und eigenhändige Unterschrift auf dem Original</span></div>
      <div class="sig-line">${e(u.zeile)}</div>
      <p class="gv-leise">${e(u.vermerk)}</p>
      <p class="gv-leise">Prüfsumme dieser Fassung der Anlage 1 (SHA-256): <span class="hash">${e(buergschaftPruefsumme(d))}</span></p>
    </div>
  </section>`;
}

/** Anlage 2 — der Prüfbericht aus den eingefrorenen Messwerten (nie getippte Zahlen). */
export function pruefberichtHtml(d: AngebotDaten, pb: Pruefbericht | null, alsAnlage = true): string {
  if (!pb) {
    return `<section class="gv-anlage" id="anlage-2"><h2>${e(PRUEFBERICHT_TITEL)}</h2><p class="gv-leise">[noch einzutragen: Prüfbericht]</p></section>`;
  }
  const erg = pruefberichtErgebnis(pb);
  const k = d.kunde;
  // Ohne Spaltenköpfe (Kopf leer) wird keine leere Kopfzeile gezeichnet — die Steckbrief-Tafel oben.
  // Jede Zelle trägt ihren Spaltenkopf als data-label: Am Handy (ANGEBOT_VERTRAG_CSS, 560 px) stapeln die
  // Zeilen, statt in einem Kasten seitlich zu scrollen (Gegenprüfung 01.10.2026).
  const tabelle = (kopf: string[], zeilen: string[][]) => {
    const mitKopf = kopf.some((h) => h);
    return `<table class="gia-tab${mitKopf ? "" : " gia-tab-steckbrief"}">${mitKopf ? `<thead><tr>${kopf.map((h) => `<th>${e(h)}</th>`).join("")}</tr></thead>` : ""}<tbody>${zeilen.map((z) => `<tr>${z.map((c, i) => `<td${mitKopf && kopf[i] ? ` data-label="${e(kopf[i])}"` : ""}>${e(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  };
  const s = pb.sanktionen;
  const boni = pb.boni ? pruefberichtBoniText(pb.boni) : null;
  return `
  <section class="${alsAnlage ? "gv-anlage" : "gia-bericht"}" id="anlage-2">
    <h2>${e(PRUEFBERICHT_TITEL)}</h2>
    <p class="gv-leise">FIAON LTD · FIAON Global Compliance · Prüfbericht zum Angebot ${e(d.ref)}</p>
    ${tabelle(["", ""], [
      ["Geprüfte Person", `${[k.anrede, angebotKundeName(k)].filter(Boolean).join(" ")}, geb. ${angebotTag(k.geburtsdatum)}, ${k.strasse}, ${k.plz} ${k.ort}, ${ANGEBOT_LAND_NAME[k.land] ?? k.land}`],
      ["Eigenschaft", pb.eigenschaft],
      ["Vorhaben", pb.vorhaben],
      ["Aktenzeichen", pb.aktenzeichen],
      ["Prüfdatum", pb.datenstand],
      ["Prüfer", pb.pruefer],
    ])}
    <h3>Ergebnis</h3>
    <p class="gia-ergebnis"><b>${e(erg.satz)}</b></p>
    ${pb.auflagen.length ? `<p>Hinweise und Auflagen:</p><ol>${pb.auflagen.map((x) => `<li>${e(x)}</li>`).join("")}</ol>` : ""}
    <h3>I. Stammdaten-Abgleich</h3>
    ${tabelle(["Merkmal", "Befund", "Quelle"], pb.stammdaten.map((z) => [z.merkmal, z.befund, z.quelle]))}
    <h3>II. Sanktionslisten-Abgleich</h3>
    ${s ? `
    <p>Abruf der amtlichen Listen am ${e(s.abruf)}, direkt beim jeweiligen Herausgeber.</p>
    ${tabelle(["Liste", "Herausgeber", "Listenstand", "Einträge (davon Personen)", "Ergebnis"],
      s.listen.map((l) => [l.liste, l.herausgeber, l.stand, `${l.eintraege.toLocaleString("de-DE")} (${l.personen.toLocaleString("de-DE")})`, l.treffer === 0 ? "kein Treffer" : `${l.treffer} Treffer — Abklärung`]))}
    <p><b>Verfahren.</b> ${e(s.verfahren)}</p>
    <p><b>Gegenprobe.</b> ${e(s.gegenprobe)}</p>
    <p><b>Befund.</b> ${e(s.listen.every((l) => l.treffer === 0) ? "Kein Treffer — weder beim Namen noch bei einer Schreibvariante noch beim Geburtsdatum." : "Es gibt Treffer — sie sind vor jeder Leistung abzuklären.")}</p>`
    : `<p><b>Steht aus.</b> Der Abgleich mit den Sanktionslisten ist für diesen Bericht noch nicht durchgeführt. Er erfolgt vor Beginn der Leistungen (Ziffer 7 des Vertrags).</p>`}
    <h3>III. Status als politisch exponierte Person (PEP)</h3>
    <p>${e(pb.pep.text)}</p>
    <p>Status am Prüftag: ${pb.pep.status === "erklaert" ? "erklärt" : "offen bis zur Erklärung mit dem Vertrag (Ziffer 7 Absatz 4)"}.</p>
    <h3>IV. Bonitätslage</h3>
    ${boni && pb.boni ? `
    <p><b>${e(boni.kopf)}</b></p>
    <p>Die Boni-Ampel ist die interne Arbeitseinschätzung von FIAON (eine Rechnung für alle Kunden). Quelle der Zahlen: ${e(pb.boni.quelle)}; Stand ${e(pb.boni.stand)}.</p>
    ${tabelle(["Teil", "Punkte", "Grundlage", "Inhalt"], boni.zeilen.map((z) => [z.teil, z.punkte, z.grundlage, z.inhalt]))}
    ${boni.einordnung.map((x) => `<p>${e(x)}</p>`).join("\n    ")}`
    : `<p><b>Steht aus.</b> Für diesen Bericht liegt keine Auswertung vor.</p>`}
    <h3>V. Eignung für das Vorhaben</h3>
    <p>${e(pb.eignung.voraussetzungen)}</p>
    <p><b>Steuerliche Hinweise.</b> FIAON leistet keine Steuerberatung; die Fragen klärt der Partner-Steuerberater auf Mandat des Auftraggebers vor der Gründung.</p>
    <ul>${pb.eignung.steuer.map((x) => `<li>${e(x)}</li>`).join("")}</ul>
    <p><b>Haftung bei Firmenkarten.</b> ${e(pb.eignung.haftung)}</p>
    <p><b>Mitwirkung, die das Vorhaben braucht.</b> ${e(pb.eignung.mitwirkung)}</p>
    <p><b>Einordnung.</b> ${e(pb.eignung.einordnung)}</p>
    <h3>VI. Ergebnis</h3>
    <p><b>${e(erg.satz)}</b></p>
    <p><b>Umfang und Grenzen.</b> Dieser Bericht hält fest, was am Prüftag mit den genannten Quellen geprüft wurde. Er ist keine Kreditwürdigkeitsprüfung, keine Rechts- oder Steuerberatung und keine Zusage eines Instituts. Er dient der Vorbereitung dieses Auftrags und wird nicht an Dritte weitergegeben.</p>
    <p class="gv-leise">Erstellt am ${e(pb.erstellt)} · ${e(pb.pruefer)}</p>
    ${s ? `
    <h3>Anlage A — Herkunft der Listen</h3>
    ${tabelle(["Liste", "Listenstand", "Abruf", "Quelle"], s.quellen.map((q) => [q.liste, q.stand, q.abruf, q.quelle]))}
    <p class="gv-leise">SHA-256 der geprüften Dateien:</p>
    <ul class="gia-summen">${s.pruefsummen.map((x) => `<li>${e(x.datei)} <span class="hash">${e(x.sha256)}</span>${x.zusatz ? ` ${e(x.zusatz)}` : ""}</li>`).join("")}</ul>` : ""}
  </section>`;
}

function anlage3Html(): string {
  // Das gesetzliche Muster wörtlich (shared/fiaon-global-widerruf.ts) — nur der Titel trägt die Nummer.
  const b = globalWiderrufsbelehrung("de");
  const zeile = (text: string) => `<li><span>${e(text)}</span><i aria-hidden="true"></i></li>`;
  return `
  <section class="gv-anlage" id="anlage-3" lang="de">
    <h2>Anlage 3 — Widerrufsbelehrung</h2>
    <p class="gv-leise">${e(b.gilt)}</p>
    ${b.abschnitte.map((a) => `<h3>${e(a.h)}</h3>\n    ${a.absaetze.map((t) => `<p>${e(t)}</p>`).join("\n    ")}`).join("\n    ")}
    <div class="gv-formular">
      <h3>${e(b.formular.titel)}</h3>
      <p class="gv-leise">${e(b.formular.hinweis)}</p>
      <ul>
        <li><span>${e(b.formular.an)}</span></li>
        ${b.formular.zeilen.map(zeile).join("\n        ")}
      </ul>
      <p class="gv-leise">${e(b.formular.fuss)}</p>
    </div>
  </section>`;
}

function rumpf(d: AngebotDaten, s: AngebotSchalter, annahme: AngebotAnnahme | null): string {
  const ziffern = ziffernHtml(angebotZiffern(d, s));
  // Die letzte Ziffer bleibt mit dem Annahmeblock zusammen (.gv-schluss) — keine Unterschrift allein auf einer Seite.
  const teile = ziffern.split("\n");
  const letzte = teile.pop() ?? "";
  return `<section class="gia-praeambel"><h2>Präambel</h2>${angebotPraeambel(d).map((x) => `<p>${e(x)}</p>`).join("")}</section>
${teile.join("\n")}
<div class="gv-schluss">${letzte}${annahmeBlock(d, annahme)}</div>
${anlage1Html(d)}
${pruefberichtHtml(d, d.pruefbericht)}
${anlage3Html()}`;
}

/** Was nur dieses Angebot zusätzlich braucht (Tabellen des Prüfberichts, Präambel). */
export const ANGEBOT_VERTRAG_CSS = `
  .gv .gia-praeambel p { margin: 0 0 8px; }
  .gv .gia-tab { width: 100%; border-collapse: collapse; margin: 6px 0 12px; font-size: .88em; }
  .gv .gia-tab th, .gv .gia-tab td { text-align: left; vertical-align: top; padding: 5px 7px; border-bottom: 1px solid #e2e8f0; }
  .gv .gia-tab th { font-weight: 500; color: #475569; background: #f7f9fc; }
  .gv .gia-tab tr { break-inside: avoid; page-break-inside: avoid; }
  .gv .gia-ergebnis { padding: 8px 10px; border: 1px solid #dbe4f0; border-radius: 6px; background: #f7f9fc; }
  .gv .gia-summen { list-style: none; padding-left: 0; font-size: .82em; }
  .gv .gia-summen .hash, .gv .gv-sig .hash, .gv .gia-buergin-sig .hash { font-family: "Courier New", monospace; word-break: break-all; color: #64748b; }
  .gv .gia-buergin-sig { margin-top: 20px; max-width: 340px; }
  .gv .gia-buergin-sig .gv-sig-feld { min-height: 54px; display: flex; align-items: flex-end; }
  .gv .gia-buergin-sig .sig-line { border-top: 1px solid #0f2044; padding-top: 4px; font-size: .82em; color: #475569; }
  .gv .gia-anlage-ziffer h2 { font-size: .95em; }
  @media (max-width: 560px) {
    /* Am Handy stapeln die Tabellen des Prüfberichts: eine Zelle je Zeile, der Spaltenkopf davor — ein Scrollweg statt zwei. */
    .gv .gia-tab thead { display: none; }
    .gv .gia-tab, .gv .gia-tab tbody, .gv .gia-tab tr, .gv .gia-tab td { display: block; width: 100%; box-sizing: border-box; }
    .gv .gia-tab tr { padding: 6px 0; border-bottom: 1px solid #cbd5e1; }
    .gv .gia-tab td { border-bottom: 0; padding: 2px 0; overflow-wrap: anywhere; }
    .gv .gia-tab td[data-label]::before { content: attr(data-label) ": "; font-weight: 500; color: #475569; }
    .gv .gia-tab-steckbrief td:first-child { font-weight: 500; color: #475569; }
    .gv .gv-sig { flex-direction: column; gap: 14px; }
  }
`;

/** Der Rumpf allein — für die Prüfsumme (ohne Annahmevermerk) und das PDF (mit). */
export function angebotRumpfHtml(d: AngebotDaten, s: AngebotSchalter, annahme: AngebotAnnahme | null = null): string {
  return `<div class="gv" lang="de">${rumpf(d, s, annahme)}</div>`;
}

/** Die Prüfsumme des gezeigten Textes — für genau diese Schalterstellung. */
export function angebotTextHash(d: AngebotDaten, s: AngebotSchalter): string {
  return docHash(`global-angebot|${d.ref}|${d.fassung}|${angebotRumpfHtml(d, s, null)}`);
}

/** Für den Bildschirm: Titel, Unterzeile, Rumpf — exakt der Text, der ins PDF geht. */
export function angebotVorschauHtml(d: AngebotDaten, s: AngebotSchalter): string {
  return `<style>${GLOBAL_VERTRAG_CSS}${ANGEBOT_VERTRAG_CSS}</style>
<div class="gv" lang="de">
  <h1 class="gv-titel">${e(angebotVertragTitel())}</h1>
  <p class="gv-unterzeile">${e(angebotVertragUnterzeile(d))}</p>
  ${rumpf(d, s, null)}
</div>`;
}

/** Reiner Text — für Prüfstand und Wortwand. */
export function angebotText(d: AngebotDaten, s: AngebotSchalter): string {
  return `${angebotVertragTitel()}\n${rumpf(d, s, null)}`
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<\/(p|li|h2|h3|section|div|tr|th|td)>/gi, "\n").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}

const PDF_CSS = `
  body { font-weight: 400; color: #0f2044; }
  .wordmark { font-weight: 300; letter-spacing: .18em; color: #0f2044; font-size: 17pt; }
  header.doc { border-bottom: 1px solid #0f2044; }
  h1.doc-title { font-weight: 300; font-size: 15pt; line-height: 1.25; color: #0f2044; letter-spacing: -.01em; }
  .doc-subtitle { color: #64748b; text-align: left; }
  footer.doc { display: none; }
  ${GLOBAL_VERTRAG_CSS}
  ${ANGEBOT_VERTRAG_CSS}
`;

/**
 * Der Vertrag als PDF. Mit `annahme` die Ausfertigung nach dem Klick (Annahmevermerk mit Zeit,
 * IP, Browser und Prüfsumme); ohne den Entwurf mit Wasserzeichen „Angebot — nicht angenommen".
 */
export async function angebotVertragPdf(d: AngebotDaten, s: AngebotSchalter, annahme: AngebotAnnahme | null): Promise<Buffer> {
  const titel = angebotVertragTitel();
  const html = wrapFiaonDocument({
    documentTitle: titel,
    subtitle: angebotVertragUnterzeile(d),
    bodyHtml: angebotRumpfHtml(d, s, annahme),
    watermark: annahme ? null : "Angebot — nicht angenommen",
    markenzeile: `${FIAON_FIRMA.name} · Company No. ${FIAON_FIRMA.companyNo} · ${FIAON_FIRMA.strasse}, ${FIAON_FIRMA.ortZeile}, ${FIAON_FIRMA.land}`,
    zusatzCss: PDF_CSS,
  });
  return htmlZuPdfMitFusszeile({
    html, titel,
    fusszeile: `${FIAON_FIRMA.name} · Company No. ${FIAON_FIRMA.companyNo} · Fassung ${d.fassung} · Angebot ${d.ref}${annahme ? "" : " · Entwurf"}`,
    rand: { oben: "18mm", unten: "20mm", links: "16mm", rechts: "16mm" },
    // Die Ausfertigung nach dem Klick nie als Ersatzdruck (Gegenprüfung 01.10.2026): druckt Chromium nicht,
    // wirft das hier — die Annahme antwortet „bitte in einer Minute noch einmal" und speichert nichts.
    keinNotbehelf: !!annahme,
  });
}

/**
 * Anlage 1 allein — das Blatt, das Justin ausdruckt und eigenhändig unterschreibt (§ 766 BGB).
 * Es trägt die Prüfsumme dieser Fassung; ändert sich Anlage 1 danach, ist neu zu unterschreiben.
 */
export async function angebotAnlage1Pdf(d: AngebotDaten): Promise<Buffer> {
  const titel = `Bürgschaftszusage der ${d.buergin.name} — zum Unterschreiben`;
  const html = wrapFiaonDocument({
    documentTitle: titel,
    subtitle: `Anlage 1 zum Angebot ${d.ref} · Fassung ${ANLAGE1_FASSUNG} · ${angebotKundeName(d.kunde)}`,
    bodyHtml: `<div class="gv" lang="de">${anlage1Html(d)}
    <p class="gv-leise">Dieses Blatt ist zum eigenhändigen Unterschreiben bestimmt. Das unterschriebene Original geht per Post an den Auftraggeber, ein Scan in die Akte. Die Prüfsumme oben weist nach, dass das Original genau diese Fassung der Anlage 1 trägt.</p></div>`,
    markenzeile: `${FIAON_FIRMA.name} · Company No. ${FIAON_FIRMA.companyNo} · ${FIAON_FIRMA.strasse}, ${FIAON_FIRMA.ortZeile}, ${FIAON_FIRMA.land}`,
    zusatzCss: PDF_CSS,
  });
  return htmlZuPdfMitFusszeile({
    html, titel,
    fusszeile: `${d.buergin.name} · Anlage 1 zum Angebot ${d.ref} · Fassung ${ANLAGE1_FASSUNG}`,
    rand: { oben: "18mm", unten: "20mm", links: "16mm", rechts: "16mm" },
  });
}

/** Anlage 2 allein als PDF — dieselbe Darstellung wie im Vertrag. */
export async function angebotPruefberichtPdf(d: AngebotDaten): Promise<Buffer> {
  const titel = "Prüfbericht — Compliance- und Eignungsprüfung";
  const html = wrapFiaonDocument({
    documentTitle: titel,
    subtitle: `Anlage 2 zum Angebot ${d.ref} · ${angebotKundeName(d.kunde)}`,
    bodyHtml: `<div class="gv" lang="de">${pruefberichtHtml(d, d.pruefbericht, false)}</div>`,
    markenzeile: `${FIAON_FIRMA.name} · Company No. ${FIAON_FIRMA.companyNo} · ${FIAON_FIRMA.strasse}, ${FIAON_FIRMA.ortZeile}, ${FIAON_FIRMA.land}`,
    zusatzCss: PDF_CSS,
  });
  return htmlZuPdfMitFusszeile({
    html, titel,
    fusszeile: `${FIAON_FIRMA.name} · Prüfbericht · Angebot ${d.ref}`,
    rand: { oben: "18mm", unten: "20mm", links: "16mm", rechts: "16mm" },
  });
}
