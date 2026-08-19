// ═══════════════════════════════════════════════════════════════════════════
// DIE PROVISIONSABRECHNUNG — EIN GEHALTSZETTEL, DURCHGEHEND DEUTSCH
//
// ── DER BEFUND AM ALTEN DOKUMENT (scripts/mess-abrechnung.ts) ─────────────
// FIAON-COM-2026-0010, gemessen am gespeicherten PDF, nicht an der Vorlage:
//
//   · VIER Seiten für SECHS Positionen. Seite 3 und 4 tragen je 82 Zeichen —
//     das ist nur die Firmenzeile. Zwei Seiten, die nichts sagen.
//   · „FIAON LTD" steht 6× im Dokument (Seiten 2·2·1·1). Dreimal allein auf
//     Seite 1: in der Markenzeile unter dem Wortzeichen, im Aussteller-Block
//     und in der Fußzeile — der Aufrufer gab `fussZeile(firma)` an BEIDE
//     Stellen (`markenzeile` UND `fusszeile`).
//   · 20 von 20 Beschriftungen englisch („Issued by", „Sale value", „Rate",
//     „Subtotal", „VAT treatment") — bei deutschen Empfängern im DACH-Raum.
//   · Das Datum 19.08.2026 steht 10× auf dem Dokument.
//   · ALLE SECHS Positionen sind Pauschalen („Startgespräch geführt und Konto
//     freigeschaltet"). Sie standen in einer Tabelle mit den Spalten
//     „Bemessungsgrundlage" und „Satz" — beide zwangsläufig „—".
//
// ── WARUM DIE FUSSZEILE ZWEIMAL KAM (die eigentliche Ursache) ─────────────
// Zwei Fehler übereinander:
//
//   1. Der Aufrufer setzte denselben Text an zwei Stellen (siehe oben).
//   2. Die Fußzeile war ein `<footer style="position:fixed;bottom:0">` IM
//      Dokument. Ein fest positioniertes Element im Seitendruck ist nicht
//      dasselbe wie eine laufende Fußzeile: Chromium reserviert dafür keinen
//      Platz im Textfluss, der Inhalt läuft darunter durch und schiebt sich
//      über den Seitenrand — daraus entstehen die Anhangsseiten mit 82 Zeichen.
//
// Die Reparatur ist deshalb keine Textänderung, sondern ein anderes Verfahren:
// Die Fußzeile kommt jetzt aus `footerTemplate` von Chromium — eine ECHTE
// laufende Fußzeile, genau einmal je Seite, mit Seitenzahl n/m, und der
// Seitenrand unten ist für sie reserviert.
//
// ── EIN RENDERER FÜR ALLE WEGE ────────────────────────────────────────────
// Freigabe einer Auszahlung, Abrechnungs-Zentrale und Mail-Anhang holen ihr PDF
// aus DIESER Funktion. `scripts/pruef-abrechnung.ts` prüft, dass es keine
// zweite Fassung gibt — zwei Fassungen eines Belegs gehen auseinander, und dann
// zeigt die Zentrale ein anderes Dokument als der Anhang.
// ═══════════════════════════════════════════════════════════════════════════
import { escapeHtml, docHash } from "./fiaon-html-pdf";
import { htmlZuPdfMitFusszeile } from "./fiaon-html-pdf";
import { type Firmierung, fussZeile } from "./fiaon-firmierung";

/** Navy des Kopfbands. Dunkler als der Akzent — ein Beleg ist kein Werbemittel. */
const NAVY = "#0A1A3C";
/** Der Akzent für den Auszahlungsbetrag. */
const AKZENT = "#1D4ED8";

/**
 * Eine Position der Abrechnung.
 *
 * `satzBp` entscheidet, in WELCHE Tabelle die Zeile geht: mit Satz in die
 * Provisionen, ohne in die Pauschalen. Das ist keine Darstellungsfrage — eine
 * Pauschale HAT keinen Prozentsatz, und eine Spalte mit „—" behauptet, es fehle
 * eine Angabe.
 */
export interface AbrechnungPosition {
  datum: string;
  referenz: string;
  paket?: string | null;
  anlass?: string | null;
  grundlageCents: number;
  satzBp: number;
  betragCents: number;
}

export interface AbrechnungDaten {
  nummer: string;
  ausstellungsdatum: Date;
  zeitraumVon: Date | null;
  zeitraumBis: Date | null;
  firma: Firmierung;
  empfaenger: {
    name: string;
    rolle: string | null;
    email: string;
    anschrift?: string | null;
    vatId?: string | null;
    steuerNr?: string | null;
    istFirma: boolean;
  };
  positionen: AbrechnungPosition[];
  /** Was tatsächlich überwiesen wird — aus dem Auszahlungsdatensatz. */
  auszahlungCents: number;
  auszahlungsdatum: Date | null;
  ibanMaskiert: string | null;
  verwendungszweck: string;
  /** Auszahlungs-Referenz, damit Beleg und Zahlung sich gegenseitig finden. */
  auszahlungId: number | null;
}

const dat = (d: Date | string | null): string => {
  if (!d) return "—";
  const x = typeof d === "string" ? new Date(d) : d;
  // Ein Datum, EINMAL, ohne Wochentag: „19.08.2026".
  return x.toLocaleDateString("de-DE", {
    timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric",
  });
};

const eur = (cents: number): string =>
  (cents / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

const prozent = (bp: number): string =>
  (bp / 100).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 2 }) + " %";

// ═══════════════════════════════════════════════════════════════════════════
// DIE RECHTSTEXTE — ALS KONSTANTE, MIT OFFENEM VERMERK
//
// WORTLAUT STEUERBERATER-FREIGABE AUSSTEHEND.
//
// ── WELCHER TEXT WIRKLICH GEDRUCKT WIRD, UND WARUM NICHT ALLE ────────────
// Die maßgeblichen Texte kommen aus den EINSTELLUNGEN (`fiaon-firmierung.ts`:
// `gutschriftHinweis`, `steuerhinweis`) — dort kann der Betreiber sie ohne
// Entwickler ändern, und genau das ist bei einem vom Steuerberater
// freigegebenen Wortlaut nötig.
//
// Ein erster Entwurf druckte ZUSÄTZLICH `gutschriftverfahren`, `statusKlausel`
// und `widerspruch` von hier. Das Ergebnis stand im Prüf-PDF und war
// unübersehbar: „selbstständig tätig" dreimal, die 14-Tage-Frist zweimal, das
// Gutschriftverfahren zweimal — auf einer eigenen zweiten Seite, nur für die
// Rechtstexte. Also genau der Doppeldruck, den dieser Auftrag beseitigen soll,
// an einer neuen Stelle.
//
// Deshalb: Gedruckt werden die Einstellungstexte und der Systemhinweis. Die
// drei Bausteine unten bleiben als DOKUMENTIERTER RÜCKFALL stehen — wenn eine
// Einstellung leer ist, fehlt der Hinweis nicht, sondern greift von hier. Sie
// zu löschen wäre bequem und würde die Lücke erst im Ernstfall zeigen.
// ═══════════════════════════════════════════════════════════════════════════
export const RECHTSTEXTE = {
  gutschriftverfahren:
    "Diese Abrechnung ist eine Gutschrift im Sinne des Umsatzsteuerrechts "
    + "(Selbstabrechnung). Sie wird von FIAON im Namen und für Rechnung des "
    + "Empfängers erstellt und dient als Buchungsbeleg.",
  statusKlausel:
    "Der Empfänger ist selbstständig tätig. Es besteht kein Arbeitsverhältnis; "
    + "Sozialabgaben und Steuern trägt der Empfänger selbst.",
  widerspruch:
    "Einwendungen gegen diese Abrechnung sind innerhalb von 14 Tagen nach "
    + "Zugang schriftlich mitzuteilen. Danach gilt sie als anerkannt.",
  systemhinweis:
    "Maschinell erstellt aus dem Provisionsmotor und dem Auszahlungsdatensatz — "
    + "ohne Unterschrift gültig.",
} as const;

/** Die Positionen auf die zwei Tabellen verteilen. */
export function positionenTeilen(p: AbrechnungPosition[]): {
  verkauf: AbrechnungPosition[]; pauschal: AbrechnungPosition[];
} {
  return {
    verkauf: p.filter((x) => Number(x.satzBp) > 0),
    pauschal: p.filter((x) => !Number(x.satzBp)),
  };
}

function tabelleVerkauf(p: AbrechnungPosition[], start: number): string {
  if (p.length === 0) return "";
  const zeilen = p.map((x, i) => `
    <tr${x.betragCents < 0 ? ' class="minus"' : ""}>
      <td class="pos">${start + i}</td>
      <td class="nowrap">${escapeHtml(dat(x.datum))}</td>
      <td>${escapeHtml(x.referenz)}</td>
      <td>${escapeHtml(x.paket || "—")}</td>
      <td class="num">${x.grundlageCents ? escapeHtml(eur(x.grundlageCents)) : "—"}</td>
      <td class="num">${escapeHtml(prozent(x.satzBp))}</td>
      <td class="num stark">${escapeHtml(eur(x.betragCents))}</td>
    </tr>`).join("");
  return `
    <h2>Provisionen aus Verkäufen</h2>
    <table class="pos-tabelle">
      <thead><tr>
        <th class="pos">Pos.</th><th>Datum</th><th>Kunde / Referenz</th><th>Paket</th>
        <th class="num">Bemessungsgrundlage</th><th class="num">Satz</th><th class="num">Provision</th>
      </tr></thead>
      <tbody>${zeilen}</tbody>
    </table>`;
}

function tabellePauschal(p: AbrechnungPosition[], start: number): string {
  if (p.length === 0) return "";
  // KEINE Satz- und Grundlagen-Spalte: Eine Pauschale hat beides nicht. Genau
  // hier standen im alten Dokument die „—", die wie fehlende Daten aussahen.
  const zeilen = p.map((x, i) => `
    <tr${x.betragCents < 0 ? ' class="minus"' : ""}>
      <td class="pos">${start + i}</td>
      <td class="nowrap">${escapeHtml(dat(x.datum))}</td>
      <td>${escapeHtml(x.anlass || x.paket || "Pauschalvergütung")}
        ${x.referenz ? `<div class="leise">${escapeHtml(x.referenz)}</div>` : ""}</td>
      <td class="num stark">${escapeHtml(eur(x.betragCents))}</td>
    </tr>`).join("");
  return `
    <h2>Pauschalvergütungen</h2>
    <table class="pos-tabelle">
      <thead><tr>
        <th class="pos">Pos.</th><th>Datum</th><th>Anlass</th><th class="num">Betrag</th>
      </tr></thead>
      <tbody>${zeilen}</tbody>
    </table>`;
}

/** Der Dokument-Körper als HTML. Getrennt, damit der Prüfstand ihn messen kann. */
export function abrechnungHtml(d: AbrechnungDaten): { html: string; hash: string } {
  const { verkauf, pauschal } = positionenTeilen(d.positionen);
  const summeVerkauf = verkauf.reduce((s, x) => s + x.betragCents, 0);
  const summePauschal = pauschal.reduce((s, x) => s + x.betragCents, 0);
  const summeGesamt = summeVerkauf + summePauschal;
  // Die Differenz zur Auszahlung ist eine Korrektur — sie wird BENANNT, nicht
  // stillschweigend verrechnet. Ein Betrag, der ohne Grund kleiner ist als die
  // Summe der Positionen, ist der Anfang eines Streits.
  const korrektur = d.auszahlungCents - summeGesamt;

  const hash = docHash([
    d.nummer, d.empfaenger.email, String(summeGesamt), String(d.auszahlungCents),
    JSON.stringify(d.positionen.map((p) => [p.referenz, p.betragCents, p.satzBp])),
  ].join("|"));

  const empfaengerZeilen = [
    `<div class="stark">${escapeHtml(d.empfaenger.name)}</div>`,
    d.empfaenger.rolle ? `<div>${escapeHtml(d.empfaenger.rolle)}</div>` : "",
    d.empfaenger.anschrift ? `<div>${escapeHtml(d.empfaenger.anschrift)}</div>` : "",
    `<div>${escapeHtml(d.empfaenger.email)}</div>`,
    d.empfaenger.vatId ? `<div>USt-IdNr.: ${escapeHtml(d.empfaenger.vatId)}</div>` : "",
    d.empfaenger.steuerNr ? `<div>Steuernummer: ${escapeHtml(d.empfaenger.steuerNr)}</div>` : "",
  ].filter(Boolean).join("");

  // Der Aussteller-Block steht EINMAL. Die Fußzeile wiederholt ihn NICHT als
  // Anschrift, sondern führt nur die Pflichtangaben in einer Zeile.
  const ausstellerZeilen = [
    `<div class="stark">${escapeHtml(d.firma.name)}</div>`,
    `<div>Company No. ${escapeHtml(d.firma.companyNo)}</div>`,
    `<div>${escapeHtml(d.firma.strasse)}</div>`,
    `<div>${escapeHtml(d.firma.ort)}</div>`,
    `<div>${escapeHtml(d.firma.land)}</div>`,
    d.firma.vatId ? `<div>USt-IdNr.: ${escapeHtml(d.firma.vatId)}</div>` : "",
  ].filter(Boolean).join("");

  // Der Rückfall greift nur, wenn die Einstellung leer ist — dann fehlt der
  // Hinweis nicht, sondern kommt aus der Konstante.
  const gutschrift = d.firma.gutschriftHinweis?.trim() || RECHTSTEXTE.gutschriftverfahren;
  const steuer = d.firma.steuerhinweis?.trim()
    || `${RECHTSTEXTE.statusKlausel} ${RECHTSTEXTE.widerspruch}`;

  const ustText = d.empfaenger.istFirma && d.empfaenger.vatId
    ? `Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge), `
      + `USt-IdNr. ${escapeHtml(d.empfaenger.vatId)}. FIAON weist keine Umsatzsteuer aus.`
    : "Der Empfänger ist nicht umsatzsteuerpflichtig für diese Tätigkeit. "
      + "Es wird keine Umsatzsteuer ausgewiesen.";

  const summenZeilen = [
    verkauf.length > 0 ? ["Provisionen gesamt", eur(summeVerkauf), ""] : null,
    pauschal.length > 0 ? ["Pauschalen gesamt", eur(summePauschal), ""] : null,
    verkauf.length > 0 && pauschal.length > 0 ? ["Zwischensumme", eur(summeGesamt), ""] : null,
    korrektur !== 0
      ? [korrektur < 0 ? "Abzug / Korrektur" : "Nachvergütung", eur(korrektur),
        "Abweichung zwischen den Positionen und dem freigegebenen Auszahlungsbetrag."]
      : null,
  ].filter(Boolean) as [string, string, string][];

  const html = `
  <div class="kopfband">
    <div class="wortmarke">FIAON</div>
    <div class="kopf-rechts">
      <div class="dokumentart">Provisionsabrechnung</div>
      <div class="nummer">${escapeHtml(d.nummer)}</div>
    </div>
  </div>

  <div class="stammdaten">
    <div class="spalte">
      <div class="etikett">Aussteller</div>
      ${ausstellerZeilen}
    </div>
    <div class="spalte">
      <div class="etikett">Empfänger</div>
      ${empfaengerZeilen}
    </div>
  </div>

  <div class="meta">
    <div><span class="etikett">Abrechnungs-Nr.</span><span class="stark">${escapeHtml(d.nummer)}</span></div>
    <div><span class="etikett">Ausstellungsdatum</span><span class="stark">${escapeHtml(dat(d.ausstellungsdatum))}</span></div>
    <div><span class="etikett">Abrechnungszeitraum</span><span class="stark">${
      d.zeitraumVon && d.zeitraumBis
        ? (dat(d.zeitraumVon) === dat(d.zeitraumBis)
          ? escapeHtml(dat(d.zeitraumVon))
          : `${escapeHtml(dat(d.zeitraumVon))} – ${escapeHtml(dat(d.zeitraumBis))}`)
        : "—"}</span></div>
  </div>

  ${tabelleVerkauf(verkauf, 1)}
  ${tabellePauschal(pauschal, verkauf.length + 1)}
  ${d.positionen.length === 0
    ? `<div class="hinweis">Für diesen Zeitraum sind keine Positionen erfasst.</div>` : ""}

  <div class="summenblock">
   <div class="s-reihe">
    <div class="s-links">
      <table class="zahlweg">
        <tr><td class="z-etikett">Zahlweg</td><td class="z-wert">Überweisung${
          d.ibanMaskiert ? `<br/>${escapeHtml(d.ibanMaskiert)}` : ""}</td></tr>
        <tr><td class="z-etikett">Verwendungszweck</td><td class="z-wert">${escapeHtml(d.verwendungszweck)}</td></tr>
        <tr><td class="z-etikett">Auszahlungsdatum</td><td class="z-wert">${escapeHtml(dat(d.auszahlungsdatum))}</td></tr>
      </table>
    </div>
    <div class="s-rechts">
    <table class="summen">
      ${summenZeilen.map(([t, w]) => `
        <tr><td class="s-text">${escapeHtml(t)}</td><td class="num">${escapeHtml(w)}</td></tr>`).join("")}
      <tr class="auszahlung">
        <td class="s-text">Auszahlungsbetrag</td>
        <td class="num">${escapeHtml(eur(d.auszahlungCents))}</td>
      </tr>
    </table>
    ${summenZeilen.filter(([, , g]) => g).map(([t, , g]) =>
      `<div class="grundzeile">${escapeHtml(t)}: ${escapeHtml(g)}</div>`).join("")}
    </div>
   </div>
  </div>

  <div class="rechtsblock">
    <div class="r-titel">Rechtliche Hinweise</div>
    <div class="r-spalten">
      <p>${escapeHtml(gutschrift)}</p>
      <p><span class="stark">Umsatzsteuer:</span> ${ustText}</p>
      <p>${escapeHtml(steuer)}</p>
    </div>
    <p class="leise r-schluss">${RECHTSTEXTE.systemhinweis}</p>
    <p class="hash">Dokument-Prüfsumme (SHA-256): ${hash}</p>
  </div>`;

  return { html, hash };
}

const STIL = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: Inter, "Helvetica Neue", Helvetica, Arial, sans-serif;
    color: #0f172a; font-size: 9pt; line-height: 1.28;
    -webkit-font-smoothing: antialiased;
  }
  .stark { font-weight: 700; }
  .leise { color: #64748b; }
  .nowrap { white-space: nowrap; }
  /* ── KEIN „tabular-nums“ — DIE ZAHLEN WÄREN SONST NICHT KOPIERBAR ───────
     Erster Entwurf hatte „font-variant-numeric: tabular-nums“. Im Bild sah
     alles richtig aus, aber die Textebene des PDF war LEER an genau diesen
     Stellen: „FIAON High End      €     %      €" — Beträge, Satz und Provision
     fehlten, € und % kamen durch.
     Chromium greift für Tabellenziffern auf einen anderen Glyphensatz der
     Schrift zu, und der landet im eingebetteten Teilsatz ohne
     Unicode-Zuordnung. Ein Buchungsbeleg, in dem man die Beträge nicht
     markieren, suchen oder auslesen kann, ist für einen Steuerberater
     unbrauchbar — und keine Prüfung hätte es am Bild gesehen.
     Rechtsbündig genügt: Die Spalten stehen auch mit Proportionalziffern. */
  .num { text-align: right; white-space: nowrap; }

  /* ── KOPFBAND ───────────────────────────────────────────────────────────
     Randlos über die volle Breite: Der Seitenrand wird mit negativen Margen
     ueberzogen, damit das Band bis an die Blattkante laeuft. */
  /* ── DAS BAND BLUTET NUR SEITLICH AUS ────────────────────────────────────
     Erster Entwurf: „margin: -18mm -16mm 0" — das Band sollte bis an die obere
     Blattkante laufen. Es lief bis dorthin, aber sein INHALT ging mit: Bei
     7 mm Innenabstand saß das Wortzeichen 11 mm ÜBER dem bedruckbaren Bereich
     und wurde abgeschnitten. Im Bild war ein leerer blauer Streifen zu sehen —
     ohne „FIAON", ohne „Provisionsabrechnung", ohne Belegnummer.
     Gefunden hat es NUR der Screenshot: Seitenzahl, Textmenge und alle 55
     Prüfungen waren grün, weil der Text im PDF vorhanden, nur unsichtbar war.
     Jetzt blutet das Band seitlich aus (dort ist Platz) und bleibt oben im
     Satzspiegel. */
  .kopfband {
    background: ${NAVY}; color: #fff;
    margin: 0 -16mm; padding: 5mm 16mm 4.5mm;
    display: flex; align-items: flex-end; justify-content: space-between;
  }
  .wortmarke { font-size: 19pt; font-weight: 800; letter-spacing: -0.02em; line-height: 1; flex: 0 0 auto; }
  /* Die Nummer lief im ersten Muster bis an die Blattkante und wurde
     abgeschnitten. Sie bekommt jetzt eine Höchstbreite und darf umbrechen —
     eine abgeschnittene Belegnummer ist ein unbrauchbarer Beleg. */
  .kopf-rechts { text-align: right; flex: 1 1 auto; min-width: 0; padding-left: 8mm; }
  .dokumentart {
    font-size: 8pt; letter-spacing: .14em; text-transform: uppercase;
    color: rgba(255,255,255,.72);
  }
  .nummer {
    font-size: 13pt; font-weight: 800; letter-spacing: -0.01em; margin-top: 1mm;
    word-break: break-all; line-height: 1.15;
  }

  /* ── STAMMDATEN ─────────────────────────────────────────────────────── */
  .stammdaten {
    display: flex; gap: 12mm; margin: 3.5mm 0 0;
    padding-bottom: 2mm; border-bottom: 1px solid #e2e8f0;
  }
  .stammdaten .spalte { flex: 1; }
  .etikett {
    font-size: 7pt; letter-spacing: .1em; text-transform: uppercase;
    color: #94a3b8; display: block; margin-bottom: 1.5mm;
  }
  .meta { display: flex; gap: 10mm; margin: 2.5mm 0 0.5mm; }
  .meta > div { flex: 1; }
  .meta .etikett { margin-bottom: 0.5mm; }

  h2 {
    font-size: 9.5pt; font-weight: 700; margin: 3mm 0 1.2mm; color: ${NAVY};
    padding-bottom: 1mm; border-bottom: 2px solid ${NAVY};
  }
  table.pos-tabelle { width: 100%; border-collapse: collapse; font-size: 8pt; }
  .pos-tabelle th {
    text-align: left; padding: 1.6mm 2.2mm; background: #f1f5f9; color: #334155;
    font-weight: 700; font-size: 7pt; letter-spacing: .05em; text-transform: uppercase;
    border-bottom: 1px solid #cbd5e1;
  }
  .pos-tabelle td { padding: 1.05mm 2.2mm; border-bottom: 1px solid #eef2f7; vertical-align: top; }
  .pos-tabelle th.pos, .pos-tabelle td.pos { width: 9mm; color: #94a3b8; }
  .pos-tabelle tr.minus td { color: #b91c1c; }
  .pos-tabelle .leise { font-size: 7.5pt; }
  /* Kopfzeile auf Folgeseiten wiederholen — eine Tabelle ohne Kopf ist auf
     Seite 2 nicht lesbar. */
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }

  /* ── SUMMEN ─────────────────────────────────────────────────────────────
     Rechts wie am Gehaltszettel. Der Block bleibt zusammen. */
  .summenblock { margin-top: 4mm; page-break-inside: avoid; }
  /* ── ZAHLWEG NEBEN DIE SUMME, NICHT DARUNTER ─────────────────────────────
     Gestapelt brauchte der Block 58 mm — der groesste Posten der Seite und der
     Grund, warum zehn Positionen nicht auf ein Blatt passten (GEMESSEN mit
     scripts/_hoehen.ts: 219 px von 986 px Nutzhoehe).
     Nebeneinander ist auch fachlich richtiger: Auf einem Gehaltszettel stehen
     Zahlweg und Nettobetrag auf einer Hoehe. */
  .s-reihe { display: flex; align-items: flex-start; gap: 8mm; }
  .s-links { flex: 1 1 auto; min-width: 0; padding-top: 1mm; }
  .s-rechts { flex: 0 0 86mm; }
  table.summen { width: 86mm; border-collapse: collapse; }
  .summen td { padding: 0.9mm 2.2mm; border-bottom: 1px solid #eef2f7; }
  .summen .s-text { color: #475569; }
  .summen tr.auszahlung td {
    border-top: 2px solid ${NAVY}; border-bottom: none;
    font-weight: 800; font-size: 10.5pt; color: ${AKZENT}; padding-top: 1.8mm;
  }
  .grundzeile { width: 86mm; font-size: 7.5pt; color: #64748b; margin-top: 1.5mm; }
  /* ── DER ZAHLWEG: EIGENE ETIKETTEN, SONST ÜBERLAPPT ES ─────────────────
     Im ersten Muster stand „VERWENDUNGSZWEFIAON-COM-MUSTER-…" und
     „AUSZAHLUNGSDATU19.08.2026": Die Klasse „.etikett“ trägt „display: block“
     und „margin-bottom“, was in einer Tabellenzelle nicht wirkt wie erwartet —
     die Beschriftung lief über den Wert. Eigene Klasse, feste Spaltenbreite. */
  table.zahlweg { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .zahlweg td { padding: 0.6mm 2.2mm; font-size: 7.5pt; vertical-align: top; }
  .zahlweg td.z-etikett {
    width: 34mm; font-size: 7pt; letter-spacing: .06em; text-transform: uppercase;
    color: #94a3b8; white-space: nowrap;
  }
  .zahlweg td.z-wert { word-break: break-word; }

  .hinweis {
    margin: 6mm 0; padding: 4mm; background: #f8fafc; border: 1px solid #e2e8f0;
    border-radius: 2mm; color: #475569;
  }

  /* ── RECHTSBLOCK ──────────────────────────────────────────────────────── */
  .rechtsblock {
    margin-top: 3mm; padding-top: 2mm; border-top: 1px solid #e2e8f0;
    font-size: 6.5pt; color: #64748b; line-height: 1.4;
  }
  .rechtsblock .r-titel {
    font-size: 7pt; letter-spacing: .1em; text-transform: uppercase;
    color: #94a3b8; margin-bottom: 2mm;
  }
  .rechtsblock p { margin: 0 0 1.6mm; text-align: left; }
  /* Zwei Spalten: Die Hinweise sind lang und schmal gesetzt kürzer — im ersten
     Muster brauchten sie eine ganze zweite Seite fuer sich allein. */
  .r-spalten { column-count: 3; column-gap: 6mm; }
  .r-spalten p { break-inside: avoid; }
  .r-schluss { margin-top: 2mm; }
  .hash { font-family: "Courier New", monospace; font-size: 6.5pt; word-break: break-all; color: #94a3b8; }
`;

/**
 * Das fertige PDF.
 *
 * Die Fußzeile kommt über `htmlZuPdfMitFusszeile` aus Chromiums
 * `footerTemplate` — genau einmal je Seite, mit reserviertem Rand. Im Dokument
 * selbst steht KEINE Fußzeile mehr; das war die Ursache der Doppelung und der
 * Anhangsseiten.
 */
export async function abrechnungPdf(d: AbrechnungDaten): Promise<{ pdf: Buffer; hash: string }> {
  const { html, hash } = abrechnungHtml(d);
  const pdf = await htmlZuPdfMitFusszeile({
    html: `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"/><style>${STIL}</style></head>`
      + `<body>${html}</body></html>`,
    fusszeile: fussZeile(d.firma),
    // Unten Platz für die laufende Fußzeile — der Wert ist gemessen, nicht
    // geschätzt: 7,5 pt Schrift plus Linie plus Abstand braucht 14 mm, damit
    // nichts hineinläuft (siehe pruef-abrechnung.ts, Randmessung).
    rand: { oben: "18mm", unten: "18mm", links: "16mm", rechts: "16mm" },
  });
  return { pdf, hash };
}
