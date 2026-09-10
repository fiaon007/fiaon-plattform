// ═══════════════════════════════════════════════════════════════════════════
// AUS DER ANALYSE WERDEN PAPIERE (10.09.2026, E-175)
//
// ── DER AUFTRAG ────────────────────────────────────────────────────────────
// Justin: „Die Einträge die auf 0 sind und gelöscht werden können müssen ja
// durch uns direkt gelöscht werden … er muss mit 1 Klick die Auskunftei
// anschreiben können, er braucht die Bonitätsanalyse von uns in einem
// juristischen Dokument als PDF die er sich zusätzlich herunterladen könnte."
//
// Zwei Papiere entstehen hier, beide aus derselben Analyse:
//   1. DER BERICHT — was in der Auskunft steht, Posten für Posten, mit Frist
//      und Fundstelle. Das Dokument, das der Kunde herunterlädt und zu einer
//      Bank, einem Anwalt oder einer Beratungsstelle mitnehmen kann.
//   2. DER LÖSCHANTRAG — das Schreiben an die Auskunftei für die Posten, deren
//      Speicherfrist abgelaufen ist. Wortlaut aus dem Hauswissen
//      (client/src/pages/agent/academy/kapitel-6-schufa.ts, Muster „Löschung
//      nach Fristablauf"), mit Fundstelle und Frist.
//
// ── DIE REGELN, DIE HIER GELTEN ────────────────────────────────────────────
// · Es wird NICHTS behauptet, was nicht in der Analyse steht. Jeder Posten im
//   Antrag nennt seine Frist und ihre Rechtsgrundlage.
// · Der Kunde ist der Absender, FIAON handelt in seinem Auftrag. Deshalb steht
//   seine Anschrift oben und FIAON in der Fußzeile — nicht umgekehrt.
// · Kein Erfolgsversprechen, keine Frist ZUSAGE an den Kunden. Die Auskunftei
//   hat nach Art. 12 Abs. 3 DSGVO einen Monat Zeit; das ist ihre Frist, nicht
//   unsere Zusage.
// · Ausgehender Text geht durch `wandPruefen` wie jeder Kundentext.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { htmlZuPdfMitFusszeile } from "./fiaon-html-pdf";
import { schufaAnalyseFuer, schreibenPosten, type SchufaAnalyse, type SchufaEintrag } from "./fiaon-schufa-analyse";
import { wandPruefen } from "@shared/fiaon-wortverbote";

const dt = (iso: string | null | undefined) => (iso ? iso.split("-").reverse().join(".") : "—");
const eur = (c: number | null | undefined) =>
  c == null ? "—" : new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(c / 100);
const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface Empfaenger {
  name: string; strasse: string; plz: string; ort: string; geburtsdatum: string | null; ref: string;
}

/** Die Anschrift der Auskunftei — nur die, die das Haus wirklich kennt. */
const AUSKUNFTEIEN: Record<string, string[]> = {
  schufa: ["SCHUFA Holding AG", "Kormoranweg 5", "65201 Wiesbaden"],
  crif: ["CRIF GmbH", "Leopoldstraße 244", "80807 München"],
  creditreform: ["Creditreform Boniversum GmbH", "Hellersbergstraße 11", "41460 Neuss"],
  boniversum: ["Creditreform Boniversum GmbH", "Hellersbergstraße 11", "41460 Neuss"],
  ksv: ["KSV1870 Information GmbH", "Wagenseilgasse 7", "1120 Wien"],
};

export function auskunfteiAnschrift(name: string | null): string[] {
  const k = String(name || "").toLowerCase();
  for (const [muster, zeilen] of Object.entries(AUSKUNFTEIEN)) if (k.includes(muster)) return zeilen;
  return [name || "Ihre Auskunftei", "", ""];
}

const KOPF = `
<style>
  @page { size: A4; }
  body { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 10.5pt; line-height: 1.5; color: #0f172a; }
  h1 { font-size: 15pt; margin: 0 0 2mm; letter-spacing: .01em; }
  h2 { font-size: 11pt; margin: 7mm 0 2mm; text-transform: uppercase; letter-spacing: .09em; color: #475569; }
  .anschrift { margin: 0 0 8mm; line-height: 1.45; }
  .zeile { display: flex; justify-content: space-between; gap: 6mm; }
  table { width: 100%; border-collapse: collapse; margin: 2mm 0 0; }
  th { text-align: left; font-size: 8.5pt; text-transform: uppercase; letter-spacing: .06em; color: #64748b;
       border-bottom: .6pt solid #cbd5e1; padding: 1.6mm 1mm; }
  td { padding: 1.8mm 1mm; border-bottom: .4pt solid #e2e8f0; vertical-align: top; font-size: 9.5pt; }
  td.zahl { text-align: right; white-space: nowrap; }
  h2.brief { text-transform: none; letter-spacing: .01em; font-size: 11.5pt; color: #0f172a; margin: 6mm 0 2mm; }
  .klein { font-size: 8.5pt; color: #64748b; }
  .kasten { border: .6pt solid #cbd5e1; border-radius: 2mm; padding: 4mm; margin: 3mm 0 0; }
  .faellig { color: #b91c1c; font-weight: 600; }
  ul { margin: 1mm 0 0; padding-left: 5mm; }
  li { margin: 1mm 0; }
</style>`;

// ═══════════════════════════════════════════════════════════════════════════
// 1 · DER BERICHT
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Die zweite Zeile am Posten - Art und Meldungszahl.
 *
 * Bei sechs von Dirk Ladewigs vierzehn Posten ist der Glaeubiger die Art
 * („Vollstreckung nach dem Inhalt des Vermoegensverzeichnisses …"). Ohne diese
 * Pruefung stand derselbe lange Satz zweimal untereinander.
 */
function zusatz(x: SchufaEintrag): string {
  const teile: string[] = [];
  if (x.art && x.art !== (x.glaeubiger || x.art)) teile.push(x.art);
  if (x.meldungen && x.meldungen > 1) teile.push(`${x.meldungen} Saldo-Meldungen`);
  return teile.join(" · ");
}

export function berichtHtml(a: SchufaAnalyse, e: Empfaenger): string {
  const eintraege = a.eintraege || [];
  const offen = eintraege.filter((x) => x.offen);
  const loeschbar = eintraege.filter((x) => x.loeschung?.faellig);
  const heute = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

  const zeilen = eintraege.map((x: SchufaEintrag) => `
    <tr>
      <td>${esc(x.nummer ?? "")}</td>
      <td><b>${esc(x.glaeubiger || x.art)}</b>${zusatz(x) ? `<div class="klein">${esc(zusatz(x))}</div>` : ""}</td>
      <td class="zahl">${esc(eur(x.betragCents))}</td>
      <td>${esc(dt(x.gemeldetAm))}</td>
      <td>${x.offen ? "offen" : "erledigt"}</td>
      <td>${x.loeschung
        ? `<span class="${x.loeschung.faellig ? "faellig" : ""}">${esc(dt(x.loeschung.am))}</span>
           <div class="klein">${esc(x.loeschung.rechtsgrund)}</div>`
        : '<span class="klein">keine Frist ermittelbar</span>'}</td>
    </tr>`).join("");

  return `${KOPF}
  <h1>Auswertung Ihrer Bonitätsauskunft</h1>
  <div class="klein">Erstellt am ${esc(heute)} für ${esc(e.name)}${e.geburtsdatum ? `, geboren am ${esc(dt(e.geburtsdatum))}` : ""} · Kundennummer ${esc(e.ref)}</div>

  <div class="kasten">
    <div class="zeile"><b>Grundlage</b><span>${esc(a.auskunftei || "Auskunftei")}${a.auskunftVom ? `, Auskunft vom ${esc(dt(a.auskunftVom))}` : ""}${a.seiten ? `, ${a.seiten} Seiten` : ""}</span></div>
    <div class="zeile"><b>Posten insgesamt</b><span>${eintraege.length}</span></div>
    <div class="zeile"><b>davon offen</b><span>${offen.length} über ${esc(eur(a.summeOffenCents))}</span></div>
    <div class="zeile"><b>Speicherfrist abgelaufen</b><span>${loeschbar.length}</span></div>
    <div class="zeile"><b>Score in der Auskunft</b><span>${a.score != null ? esc(String(a.score)) : "nicht enthalten"}</span></div>
  </div>

  <h2>Die Posten im Einzelnen</h2>
  <table>
    <thead><tr><th>Nr.</th><th>Gläubiger und Art</th><th class="zahl">Zuletzt gemeldet</th><th>Seit</th><th>Stand</th><th>Speicherfrist bis</th></tr></thead>
    <tbody>${zeilen || '<tr><td colspan="6">Keine Negativeinträge gefunden.</td></tr>'}</tbody>
  </table>

  <h2>Was daraus folgt</h2>
  <ul>${(a.empfehlungen || []).map((v) => `<li><b>${esc(v.titel)}</b> — ${esc(v.text)}</li>`).join("") || "<li>—</li>"}</ul>

  <h2>Wie diese Auswertung entstanden ist</h2>
  <p class="klein">
    Grundlage ist ausschließlich die von Ihnen hochgeladene Auskunft. Die Posten sind so übernommen, wie sie dort
    nummeriert stehen; wiederholte Saldo-Meldungen desselben Postens sind zusammengefasst und als Anzahl vermerkt.
    Die Speicherfristen folgen den Verhaltensregeln der Wirtschaftsauskunfteien (Fassung 2024), § 882e ZPO für
    Eintragungen im Schuldnerverzeichnis und den Urteilen des Europäischen Gerichtshofs vom 7.12.2023
    (C-26/22 und C-64/22) zur Restschuldbefreiung. Über die Löschung entscheidet die Auskunftei, über Kredit,
    Konto und Rahmen entscheidet die jeweilige Bank. Diese Auswertung ist keine Rechtsberatung.
  </p>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 · DER LÖSCHANTRAG
// ═══════════════════════════════════════════════════════════════════════════
export function loeschantragHtml(a: SchufaAnalyse, e: Empfaenger): string | null {
  const { ueberfaellig, pruefen } = schreibenPosten(a.eintraege || []);
  if (!ueberfaellig.length && !pruefen.length) return null;
  const anschrift = auskunfteiAnschrift(a.auskunftei);
  const heute = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

  const bezeichnung = (x: SchufaEintrag) =>
    `<b>${esc(x.glaeubiger || x.art)}${x.nummer ? ` (Nr. ${esc(x.nummer)} der Auskunft)` : ""}</b>`
    + `${x.betragCents ? `, zuletzt gemeldeter Betrag ${esc(eur(x.betragCents))}` : ""}`
    + `${x.gemeldetAm ? `, Ereignis vom ${esc(dt(x.gemeldetAm))}` : ""}`;

  const teilA = ueberfaellig.length ? `
    <h2 class="brief">1 · Einträge, deren Speicherfrist abgelaufen ist</h2>
    <ul>${ueberfaellig.map((x) => `
      <li>${bezeichnung(x)}.
        Die Speicherfrist endete am ${esc(dt(x.loeschung!.am))} — ${esc(x.loeschung!.grund)}
        <span class="klein">(${esc(x.loeschung!.rechtsgrund)})</span>
      </li>`).join("")}</ul>
    <p>
      Für diese Einträge beantrage ich die unverzügliche Löschung nach Art. 17 Abs. 1 DSGVO.
    </p>` : "";

  const teilB = pruefen.length ? `
    <h2 class="brief">${ueberfaellig.length ? "2 · " : ""}Einträge, zu denen ich um Auskunft und Prüfung bitte</h2>
    <ul>${pruefen.map((x) => `
      <li>${bezeichnung(x)}.${x.loeschung?.am
        ? ` Nach ${esc(x.loeschung.rechtsgrund)} wäre die Löschung am ${esc(dt(x.loeschung.am))} vorgesehen.`
        : ""}</li>`).join("")}</ul>
    <p>
      Zu diesen Einträgen bitte ich nach Art. 15 DSGVO um Auskunft, auf wessen Meldung und auf welche Rechtsgrundlage
      sie sich stützen und zu welchem Datum ihre Löschung vorgesehen ist. Soweit die Meldevoraussetzungen des
      § 31 Abs. 2 BDSG nicht nachgewiesen sind, beantrage ich insoweit die Löschung nach Art. 17 Abs. 1 lit. d DSGVO,
      hilfsweise die Einschränkung der Verarbeitung nach Art. 18 DSGVO bis zur Klärung.
    </p>` : "";

  return `${KOPF}
  <div class="anschrift">
    <div class="klein">${esc(e.name)} · ${esc(e.strasse)} · ${esc(e.plz)} ${esc(e.ort)}</div>
    <br>
    ${anschrift.filter(Boolean).map((z) => `<div>${esc(z)}</div>`).join("")}
  </div>
  <div class="klein" style="text-align:right">${esc(heute)}</div>

  <h1>${ueberfaellig.length ? "Antrag auf Löschung nach Art. 17 DSGVO" : "Auskunft nach Art. 15 DSGVO und Prüfbitte"}</h1>
  <p>Sehr geehrte Damen und Herren,</p>
  <p>
    in der zu meiner Person geführten Auskunft${a.auskunftVom ? ` vom ${esc(dt(a.auskunftVom))}` : ""} sind die
    folgenden Einträge enthalten.
  </p>
  ${teilA}
  ${teilB}
  <p>Um eine Bestätigung innerhalb eines Monats nach Art. 12 Abs. 3 DSGVO wird gebeten.</p>
  <p>
    Meine Angaben zur Person: ${esc(e.name)}${e.geburtsdatum ? `, geboren am ${esc(dt(e.geburtsdatum))}` : ""},
    ${esc(e.strasse)}, ${esc(e.plz)} ${esc(e.ort)}.
  </p>
  <p>Mit freundlichen Grüßen</p>
  <p style="margin-top:14mm">${esc(e.name)}</p>
  <p class="klein" style="margin-top:10mm">
    Dieses Schreiben wurde für Sie vorbereitet. Unterschreiben Sie es und senden Sie es per Einschreiben; die
    Auskunftei antwortet Ihnen unmittelbar. Auf Wunsch übernimmt FIAON den Versand mit Ihrer Vollmacht.
  </p>`;
}

/**
 * Letzte Wand vor dem Druck. Die Empfehlungen aus der Analyse sind schon
 * geprueft; hier faellt auf, wenn ein fester Satz dieser Datei jemals in ein
 * verbotenes Wort rutscht. Ein Papier wird deswegen nicht zurueckgehalten - es
 * enthaelt nur, was die Auskunft selbst sagt -, aber es steht im Protokoll.
 */
function wandNotieren(html: string, was: string): void {
  const text = html.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
  const hart = wandPruefen(text).filter((f) => f.art === "verboten" || f.art === "zusage");
  if (hart.length) console.warn(`[FIAON-BONITAET] ${was}: Wandtreffer`, hart.map((f) => f.treffer));
}

async function alsPdf(html: string, fusszeile: string, titel: string): Promise<Buffer> {
  wandNotieren(html, titel);
  return htmlZuPdfMitFusszeile({
    html: `<!doctype html><html lang="de"><head><meta charset="utf-8"></head><body>${html}</body></html>`,
    fusszeile,
    rand: { oben: "18mm", unten: "22mm", links: "16mm", rechts: "16mm" },
    titel,
  });
}

/** Empfänger-Angaben aus der Bestellung — nur, was in den Brief gehört. */
export async function empfaengerFuer(ref: string): Promise<Empfaenger | null> {
  const [r] = (await sqlPool`
    SELECT a.ref,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    NULLIF(TRIM(CONCAT_WS(' ', a.first_name, a.last_name)), ''), a.contact_name) AS name,
           COALESCE(NULLIF(p.street, ''), a.street) AS strasse,
           COALESCE(NULLIF(p.zip, ''), a.zip) AS plz,
           COALESCE(NULLIF(p.city, ''), a.city) AS ort,
           COALESCE(NULLIF(p.birthdate, ''), NULLIF(a.birthdate, '')) AS geburtsdatum
    FROM fiaon_applications a LEFT JOIN fiaon_persons p ON p.id = a.person_id
    WHERE a.ref = ${ref} AND a.merged_into IS NULL LIMIT 1
  `.catch(() => [] as any[])) as any[];
  if (!r) return null;
  return {
    ref: String(r.ref), name: String(r.name || "").trim() || "—",
    strasse: String(r.strasse || ""), plz: String(r.plz || ""), ort: String(r.ort || ""),
    geburtsdatum: r.geburtsdatum ? String(r.geburtsdatum).slice(0, 10) : null,
  };
}

export async function berichtAlsPdf(ref: string): Promise<{ datei: string; pdf: Buffer } | null> {
  const a = await schufaAnalyseFuer(ref);
  if (!a || a.status !== "fertig") return null;
  const e = await empfaengerFuer(ref);
  if (!e) return null;
  const pdf = await alsPdf(berichtHtml(a, e), `FIAON · Auswertung Ihrer Bonitätsauskunft · ${e.ref}`, "Auswertung Ihrer Bonitätsauskunft");
  return { datei: `FIAON-Bonitaetsauswertung-${e.ref}.pdf`, pdf };
}

export async function loeschantragAlsPdf(ref: string): Promise<{ datei: string; pdf: Buffer; posten: number; ueberfaellig: number; pruefen: number } | null> {
  const a = await schufaAnalyseFuer(ref);
  if (!a || a.status !== "fertig") return null;
  const e = await empfaengerFuer(ref);
  if (!e) return null;
  const html = loeschantragHtml(a, e);
  if (!html) return null;
  const pdf = await alsPdf(html, `Löschantrag nach Art. 17 DSGVO · ${e.name} · ${e.ref}`, "Antrag auf Löschung nach Art. 17 DSGVO");
  const t = schreibenPosten(a.eintraege || []);
  return {
    datei: `Schreiben-an-die-Auskunftei-${e.ref}.pdf`, pdf,
    posten: t.ueberfaellig.length + t.pruefen.length,
    ueberfaellig: t.ueberfaellig.length, pruefen: t.pruefen.length,
  };
}
