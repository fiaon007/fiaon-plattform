// ═══════════════════════════════════════════════════════════════════════════
// GRÜNDUNGSBOGEN — „GRÜNDUNGSAUFTRAG UND ANGABEN“ ALS PDF (E-526, 17.11.2026)
//
// Je Mitglied EIN PDF: Kopf FIAON Global, Kennung des Bogens und Fassung, alle gemeinsamen
// Angaben, die eigenen Angaben (US-Steuernummer maskiert, ohne Reisepassbild — nur Datei,
// Zeitpunkt und Prüfsumme), die fünf Bestätigungen im Wortlaut (shared/fiaon-global-gruendungsbogen.ts),
// Unterschriftsbild, Name, Ort, Zeit in Berliner Zeit, IP gekürzt, Hash; Fußzeile „Seite X von Y“.
//
// gbPdfRumpf ist REIN (kein Netz, keine Datenbank) — der Prüfstand liest daraus den Text.
// gbPdfErzeugen druckt über Chromium (htmlZuPdfMitFusszeile) OHNE Notbehelf: Eine Urkunde, die
// gerade unterschrieben wird, entsteht pixelgenau oder gar nicht (Muster Individualangebot).
// ═══════════════════════════════════════════════════════════════════════════
import { escapeHtml, wrapFiaonDocument, htmlZuPdfMitFusszeile } from "./fiaon-html-pdf";
import { formatBerlin } from "./fiaon-time";
import { FIAON_FIRMA } from "@shared/fiaon-firma";
import {
  GB_RECHTSFORM, anteilText, dativ, gbStaatName, ipKuerzen, type GbAngaben, type GbGesellschaft,
} from "@shared/fiaon-global-gruendungsbogen";

const e = escapeHtml;

export interface GbPdfDaten {
  kennung: string;
  fassung: number;
  wortlautFassung: string;
  kostenHinweis: string;
  gesellschaft: GbGesellschaft;
  mitglieder: { id: number; name: string }[];
  ich: { id: number; anzeigename: string; email: string };
  /** Bereits für den Beleg aufbereitet (angabenFuerBeleg): US-Steuernummer maskiert. */
  angaben: GbAngaben;
  reisepass: { name: string; am: Date | string; sha256: string } | null;
  bestaetigungen: { titel: string; text: string }[];
  unterschrift: { png: string; name: string; ort: string; am: Date; ip: string; hash: string } | null;
}

export const GB_PDF_TITEL = "Gründungsauftrag und Angaben";

function zeile(label: string, wert: string | null | undefined): string {
  const w = String(wert ?? "").trim();
  return `<tr><th>${e(label)}</th><td>${w ? e(w).replace(/\n/g, "<br/>") : '<span class="gb-leer">—</span>'}</td></tr>`;
}
const tagDe = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : iso);

export function gbPdfUnterzeile(d: Pick<GbPdfDaten, "kennung" | "fassung" | "wortlautFassung">): string {
  return `Gründungsbogen ${d.kennung} · Fassung ${d.fassung} der gemeinsamen Angaben · Wortlaut ${d.wortlautFassung}`;
}

/** Der Rumpf — derselbe Text, den das PDF trägt (ohne Kopf und Fuß des Hausdokuments). */
export function gbPdfRumpf(d: GbPdfDaten): string {
  const g = d.gesellschaft;
  const name = (id: number | null) => d.mitglieder.find((m) => m.id === id)?.name ?? "—";
  const a = d.angaben;
  const gesellschafter = d.mitglieder.map((m) => {
    const rollen = [
      g.fuehrung === "manager" && g.manager.includes(m.id) ? "Manager" : null,
      g.responsibleParty === m.id ? "Responsible Party (EIN)" : null,
      m.id === d.ich.id ? "unterzeichnet dieses Dokument" : null,
    ].filter(Boolean).join(" · ");
    return `<tr><th>${e(m.name)}</th><td>${e(anteilText(Number(g.anteile[String(m.id)] ?? 0)))}${rollen ? ` <span class="gb-leise">· ${e(rollen)}</span>` : ""}</td></tr>`;
  }).join("");
  const u = d.unterschrift;
  return `<div class="gb">
  <p class="gb-einleitung">Die Gesellschafter gründen gemeinsam eine US-Gesellschaft. Jeder Gesellschafter macht seine Angaben selbst und unterschreibt getrennt. Dieses Dokument enthält die gemeinsamen Angaben in der unterschriebenen Fassung und die Angaben von <b>${e(dativ(d.ich.anzeigename))}</b>.</p>

  <h2><span class="gb-nr">1</span> Die Gesellschaft</h2>
  <table class="gb-tab">
    ${zeile("Wunschname", `${g.wunschname1} ${GB_RECHTSFORM}`)}
    ${zeile("Ausweichname 1", g.wunschname2 ? `${g.wunschname2} ${GB_RECHTSFORM}` : "")}
    ${zeile("Ausweichname 2", g.wunschname3 ? `${g.wunschname3} ${GB_RECHTSFORM}` : "")}
    ${zeile("Rechtsform", `Limited Liability Company (${GB_RECHTSFORM})`)}
    ${zeile("Bundesstaat", gbStaatName(g.bundesstaat))}
    ${zeile("Unternehmensgegenstand", g.gegenstand)}
    ${zeile("Führung", g.fuehrung === "manager" ? `Von Managern geführt (manager-managed): ${g.manager.map(name).join(", ")}` : "Von den Gesellschaftern geführt (member-managed)")}
    ${zeile("Responsible Party (EIN)", name(g.responsibleParty))}
    ${zeile("Geschäftsjahr", "Kalenderjahr")}
    ${zeile("Website", g.website)}
    ${zeile("Anmerkungen", g.anmerkungen)}
  </table>

  <h2><span class="gb-nr">2</span> Gesellschafter und Anteile</h2>
  <table class="gb-tab">${gesellschafter}</table>

  <h2><span class="gb-nr">3</span> Angaben von ${e(dativ(d.ich.anzeigename))}</h2>
  <table class="gb-tab">
    ${zeile("Anrede", a.anrede)}
    ${zeile("Vorname(n) laut Reisepass", a.vornamen)}
    ${zeile("Nachname laut Reisepass", a.nachname)}
    ${zeile("Geburtsdatum", tagDe(a.geburtsdatum))}
    ${zeile("Geburtsort", a.geburtsort)}
    ${zeile("Staatsangehörigkeit", a.staatsangehoerigkeit)}
    ${zeile("Wohnanschrift", [a.strasse, [a.plz, a.ort].filter(Boolean).join(" "), a.land].filter(Boolean).join(", "))}
    ${zeile("Steuerlich ansässig in", a.steuerAnsaessig)}
    ${zeile("E-Mail (Zugang)", d.ich.email)}
    ${zeile("Weitere Kontaktadresse", a.kontaktEmail)}
    ${zeile("Telefon", a.telefon)}
    ${zeile("Reisepassnummer", a.passNummer)}
    ${zeile("Ausstellender Staat", a.passStaat)}
    ${zeile("Reisepass gültig bis", tagDe(a.passGueltigBis))}
    ${zeile("US-Steuernummer (SSN/ITIN)", a.usSteuernummerVorhanden === true ? a.usSteuernummer || "vorhanden" : a.usSteuernummerVorhanden === false ? "keine" : "")}
    ${zeile("Bildseite des Reisepasses", d.reisepass ? `hochgeladen am ${formatBerlin(d.reisepass.am)} (${d.reisepass.name}), Prüfsumme SHA-256 ${d.reisepass.sha256}` : "")}
  </table>

  <h2><span class="gb-nr">4</span> Bestätigungen</h2>
  <ol class="gb-best">
    ${d.bestaetigungen.map((b) => `<li><b>${e(b.titel)}.</b> ${e(b.text)} <span class="gb-haken">bestätigt</span></li>`).join("\n    ")}
  </ol>

  <h2><span class="gb-nr">5</span> Unterschrift</h2>
  <div class="gb-sig">
    <div class="gb-sig-feld">${u ? `<img class="gb-sig-img" src="${e(u.png)}" alt="Unterschrift" />` : '<span class="gb-leise">Noch nicht unterschrieben.</span>'}</div>
    <div class="gb-sig-linie">${e(u?.name ?? d.ich.anzeigename)}${u ? ` · ${e(u.ort)}, ${e(formatBerlin(u.am, false))}` : ""}</div>
    ${u ? `<div class="gb-meta">Elektronisch unterschrieben von ${e(u.name)} am ${e(formatBerlin(u.am))} (Europe/Berlin)<br/>IP-Adresse (gekürzt): ${e(ipKuerzen(u.ip))}<br/>Prüfsumme der unterschriebenen Inhalte (SHA-256): <span class="gb-hash">${e(u.hash)}</span></div>` : ""}
  </div>
  <p class="gb-fuss">Auftragnehmerin: ${e(FIAON_FIRMA.name)}, ${e(FIAON_FIRMA.strasse)}, ${e(FIAON_FIRMA.ortZeile)}, ${e(FIAON_FIRMA.land)}, ${e(FIAON_FIRMA.register)}, Company No. ${e(FIAON_FIRMA.companyNo)}.</p>
</div>`;
}

const PDF_CSS = `
  body { font-weight: 400; color: #0f2044; }
  header.doc { border-bottom: 1px solid #12284a; }
  h1.doc-title { font-weight: 300; font-size: 16pt; line-height: 1.25; color: #0f2044; letter-spacing: -.01em; }
  .doc-subtitle { color: #64748b; }
  footer.doc { display: none; }
  .gb { font-family: Inter, "Helvetica Neue", Helvetica, Arial, sans-serif; color: #0f2044; line-height: 1.55; }
  .gb h2 { font-size: 11pt; font-weight: 500; color: #0f2044; margin: 18px 0 6px; break-after: avoid; }
  .gb .gb-nr { display: inline-block; min-width: 1.4em; color: #1d4ed8; font-weight: 400; }
  .gb p { text-align: left; }
  .gb .gb-einleitung { color: #334155; }
  .gb .gb-tab { width: 100%; border-collapse: collapse; margin: 4px 0 8px; font-size: 9.5pt; }
  .gb .gb-tab th { width: 34%; background: none; text-transform: none; letter-spacing: 0; font-size: 9pt; font-weight: 400; color: #64748b; padding: 5px 8px 5px 0; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  .gb .gb-tab td { padding: 5px 0; border-bottom: 1px solid #e2e8f0; vertical-align: top; color: #0f2044; word-break: break-word; }
  .gb .gb-tab tr { break-inside: avoid; }
  .gb .gb-leer, .gb .gb-leise { color: #94a3b8; }
  .gb .gb-best { padding-left: 1.3em; margin: 4px 0 8px; font-size: 9.5pt; }
  .gb .gb-best li { margin: 0 0 6px; break-inside: avoid; }
  .gb .gb-haken { display: inline-block; margin-left: 4px; padding: 0 6px; border: 1px solid #1d4ed8; border-radius: 3px; color: #1d4ed8; font-size: 8pt; }
  .gb .gb-sig { margin-top: 10px; break-inside: avoid; page-break-inside: avoid; }
  .gb .gb-sig-feld { min-height: 74px; display: flex; align-items: flex-end; padding-bottom: 4px; }
  .gb .gb-sig-img { max-height: 70px; max-width: 260px; }
  .gb .gb-sig-linie { border-top: 1px solid #0f2044; padding-top: 4px; font-size: 9pt; color: #475569; max-width: 360px; }
  .gb .gb-meta { font-size: 8pt; color: #64748b; margin-top: 6px; }
  .gb .gb-hash { font-family: "Courier New", monospace; font-size: 7.5pt; word-break: break-all; color: #64748b; }
  .gb .gb-fuss { margin-top: 18px; font-size: 8pt; color: #94a3b8; }
`;

/** Reiner Text des Rumpfs — für den Prüfstand und die Wortwand. */
export function gbPdfText(d: GbPdfDaten): string {
  return gbPdfRumpf(d).replace(/<\/(p|li|h2|tr|div)>/gi, "\n").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}

export function gbPdfHtml(d: GbPdfDaten): string {
  return wrapFiaonDocument({
    documentTitle: GB_PDF_TITEL,
    subtitle: gbPdfUnterzeile(d),
    bodyHtml: gbPdfRumpf(d),
    markenzeile: `FIAON Global · ${FIAON_FIRMA.name} · Company No. ${FIAON_FIRMA.companyNo} · ${FIAON_FIRMA.strasse}, ${FIAON_FIRMA.ortZeile}, ${FIAON_FIRMA.land}`,
    zusatzCss: PDF_CSS,
  });
}

/** Das PDF (Chromium, laufende Fußzeile mit „Seite X von Y“). Wirft, wenn Chromium nicht druckt. */
export async function gbPdfErzeugen(d: GbPdfDaten): Promise<Buffer> {
  return htmlZuPdfMitFusszeile({
    html: gbPdfHtml(d),
    fusszeile: `${FIAON_FIRMA.name} · Company No. ${FIAON_FIRMA.companyNo} · Gründungsbogen ${d.kennung} · Fassung ${d.fassung} · ${d.ich.anzeigename}`,
    titel: GB_PDF_TITEL,
    rand: { oben: "18mm", unten: "20mm", links: "16mm", rechts: "16mm" },
    sprache: "de",
    keinNotbehelf: true,
  });
}
