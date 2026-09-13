// ═══════════════════════════════════════════════════════════════════════════
// KÜNDIGUNG EINES MITARBEITERS — DER SAUBERE ABSCHLUSS (13.09.2026, E-185)
//
// Justin: „Wir haben Lucas gekündigt. Wenn er sich einloggt, soll er die
// Kündigung unterschreiben, eine E-Mail angeben, wohin sie geht, und sie
// danach per Mail bekommen. Am 1. des Folgemonats werden alle offenen
// Provisionen ausgezahlt. Ein Top-Prozess, alles 100 % richtig."
//
// Was hier steht — und was bewusst NICHT:
//   · Die Kündigung ist eine einseitige Erklärung der FIAON LTD nach Ziffer 11.1
//     des Handelsvertretervertrags (Self-Employed Commercial Agent Agreement,
//     eine Frist von einem Monat). Die Unterschrift des Mitarbeiters ist die
//     EMPFANGSBESTÄTIGUNG — sie macht die Kündigung nicht wirksam, sie belegt
//     den Zugang. Deshalb steht das so im Schreiben.
//   · Festgehalten wird, was ein Nachweis braucht: Name, gezeichnete oder
//     getippte Unterschrift, Zeitpunkt, IP, Browser, Hash über den Text — genau
//     wie beim Vertrag selbst (fiaon_agent_contracts).
//   · Die Schlussabrechnung: Alle bestätigten Provisionen werden am 1. des auf
//     die Unterschrift folgenden Monats ausgezahlt — ohne Mindestbetrag. Der
//     Auszahlungstag-Lauf (fiaon-agent.ts) holt sich die fälligen Abschlüsse
//     über schlussabrechnungenFaellig(); bis dahin hält der normale Sammellauf
//     am 15. die Finger von diesem Konto (schlussabrechnungOffenAgentIds).
//   · Der Bildschirm hängt an einem signierten Token (wie /zustimmung), weil
//     ein gesperrtes Konto keine Sitzung bekommt — und bekommen soll.
// ═══════════════════════════════════════════════════════════════════════════
import { createHmac, timingSafeEqual } from "node:crypto";
import { sqlPool } from "./db-pool";
import { escapeHtml, docHash, renderDocumentPdf } from "./fiaon-html-pdf";
import { formatBerlin, berlinToday } from "./fiaon-time";
import { absoluteUrl } from "../fiaon-base-url";

export const ABSCHLUSS_TAGE = 30;
const FIRMA = "FIAON LTD";
const FIRMA_ANSCHRIFT = "128 City Road, London EC1V 2NX, United Kingdom";
const FIRMA_NUMMER = "Company No. 17318250";
const DIREKTOR = "Justin Schwarzott";

let tabelleDa = false;
export async function ensureKuendigungTabelle(): Promise<void> {
  if (tabelleDa) return;
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_agent_kuendigungen (
      id SERIAL PRIMARY KEY,
      agent_id INTEGER NOT NULL,
      status VARCHAR NOT NULL DEFAULT 'offen',
      ausgesprochen_am DATE NOT NULL,
      wirksam_am DATE NOT NULL,
      freigestellt_ab DATE NOT NULL,
      grund TEXT,
      angelegt_von VARCHAR,
      text_html TEXT NOT NULL,
      variables_json TEXT NOT NULL,
      unterschrift_png TEXT,
      unterschrift_name VARCHAR,
      unterschrift_modus VARCHAR,
      unterschrieben_am TIMESTAMPTZ,
      ip VARCHAR,
      user_agent TEXT,
      doc_hash VARCHAR,
      pdf_base64 TEXT,
      empfangs_email VARCHAR,
      mail_versandt_am TIMESTAMPTZ,
      mail_fehler TEXT,
      schlussabrechnung_am DATE,
      schluss_payout_id INTEGER,
      schluss_betrag_cents INTEGER,
      schluss_fehler TEXT,
      schluss_abgeschlossen_am TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_agent_kuendigungen_agent_idx ON fiaon_agent_kuendigungen(agent_id, created_at)`;
  await sqlPool.unsafe(`
    ALTER TABLE fiaon_agent_kuendigungen
      ADD COLUMN IF NOT EXISTS grund_vorher TEXT,
      ADD COLUMN IF NOT EXISTS zustell_mail_versandt_am TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS zustell_mail_fehler TEXT`);
  // Eine laufende Akte je Mitarbeiter — zwei schnelle Klicks erzeugen keine zwei.
  await sqlPool.unsafe(`CREATE UNIQUE INDEX IF NOT EXISTS fiaon_agent_kuendigungen_laufend_idx
    ON fiaon_agent_kuendigungen(agent_id) WHERE status <> 'zurueckgenommen'`);
  tabelleDa = true;
}

// ── Token: signiert, ohne Sitzung — wie bei der Kundenzustimmung ────────────
function geheimnis(): string {
  return process.env.SESSION_SECRET || process.env.MAKE_WEBHOOK_URL || "fiaon-dev-invoice-secret";
}
/** Die Sitzungs-Epoche des Kontos steckt in der Signatur: Ein Passwort-Reset oder eine neue Sperre entwertet alle alten Links. */
async function epocheVon(agentId: number): Promise<number> {
  const [r] = (await sqlPool`SELECT session_epoch FROM fiaon_agents WHERE id = ${agentId}`) as any[];
  return Number(r?.session_epoch ?? 0);
}
export async function abschlussTokenErzeugen(agentId: number, ttlMs = ABSCHLUSS_TAGE * 24 * 60 * 60 * 1000): Promise<string> {
  const exp = Date.now() + ttlMs;
  const epoche = await epocheVon(agentId);
  const sig = createHmac("sha256", geheimnis()).update(`abschluss.${agentId}.${epoche}.${exp}`).digest("hex").slice(0, 32);
  return `${agentId}.${exp}.${sig}`;
}
export async function abschlussTokenPruefen(token: unknown): Promise<{ agentId: number; abgelaufen: boolean } | null> {
  const teile = String(token ?? "").split(".");
  if (teile.length !== 3) return null;
  const [idRoh, expRoh, sig] = teile;
  const agentId = Number(idRoh); const exp = Number(expRoh);
  if (!Number.isInteger(agentId) || agentId <= 0 || !exp) return null;
  const epoche = await epocheVon(agentId);
  const erwartet = createHmac("sha256", geheimnis()).update(`abschluss.${agentId}.${epoche}.${exp}`).digest("hex").slice(0, 32);
  const a = Buffer.from(erwartet); const b = Buffer.from(sig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { agentId, abgelaufen: exp < Date.now() };
}
export async function abschlussLink(agentId: number): Promise<string> {
  return absoluteUrl(`/mitarbeiter/abschluss/${await abschlussTokenErzeugen(agentId)}`);
}

// ── Lesen ────────────────────────────────────────────────────────────────────
export async function kuendigungLesen(agentId: number): Promise<any | null> {
  await ensureKuendigungTabelle();
  const [k] = (await sqlPool`
    SELECT * FROM fiaon_agent_kuendigungen
     WHERE agent_id = ${agentId} AND status <> 'zurueckgenommen'
     ORDER BY created_at DESC LIMIT 1`) as any[];
  return k ?? null;
}

/** Nur wenn eine laufende Kündigung existiert, bekommt der Login ein Token. */
export async function abschlussTokenFuer(agentId: number): Promise<string | null> {
  const k = await kuendigungLesen(agentId);
  return k ? await abschlussTokenErzeugen(agentId) : null;
}

export const SCHLUSS_VERMERK = "Schlussabrechnung nach Kündigung";
/**
 * Was zur Schlussabrechnung ansteht: Bestätigtes plus die EIGENEN Vormerkungen
 * dieser Kündigung — nicht fremde Vormerkungen mit späterem Datum (ein Gehalt
 * „ab 01.12." darf im Schreiben nicht als „am 1. ausgezahlt" stehen).
 */
export async function provisionenOffen(agentId: number): Promise<{ cents: number; anzahl: number }> {
  const [z] = (await sqlPool`
    SELECT COALESCE(SUM(amount_cents), 0)::bigint AS cents, COUNT(*)::int AS anzahl
      FROM fiaon_commissions
     WHERE agent_id = ${agentId}
       AND (status = 'bestaetigt' OR (status = 'vorgemerkt' AND note LIKE ${"%" + SCHLUSS_VERMERK + "%"}))`) as any[];
  return { cents: Number(z?.cents || 0), anzahl: Number(z?.anzahl || 0) };
}
/** Bereits angeforderte, noch nicht überwiesene Auszahlungen — die gehören sichtbar dazu. */
export async function offeneAnforderungen(agentId: number): Promise<{ cents: number; anzahl: number }> {
  const [z] = (await sqlPool`
    SELECT COALESCE(SUM(amount_cents), 0)::bigint AS cents, COUNT(*)::int AS anzahl
      FROM fiaon_payouts
     WHERE agent_id = ${agentId} AND status IN ('angefordert', 'requested') AND processed_at IS NULL`) as any[];
  return { cents: Number(z?.cents || 0), anzahl: Number(z?.anzahl || 0) };
}

// ── Daten ────────────────────────────────────────────────────────────────────
/**
 * postgres.js liefert DATE-Spalten als JS-Date (UTC-Mitternacht), nicht als
 * Text — `String(date).slice(0, 10)` ergäbe „Tue Oct 13". Deshalb hier eine
 * Stelle, die beides in YYYY-MM-DD wandelt (Skeptiker-Befund 13.09.2026).
 */
export function isoTag(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v ?? "").slice(0, 10);
}
/** Der letzte Tag des Monats, in dem das Datum liegt. */
export function monatsende(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}
function tagDe(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso.length === 10 ? `${iso}T12:00:00+02:00` : iso) : iso;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" });
}
function tagEn(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00+02:00`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Berlin" });
}
function eur(cents: number): string {
  return `${(cents / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}
/** Ein Monat nach dem Datum (gleicher Tag; existiert er nicht, der letzte Tag des Monats). */
export function einenMonatSpaeter(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const ziel = new Date(Date.UTC(y, m, 1));       // erster des Folgemonats
  const letzter = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  ziel.setUTCDate(Math.min(d, letzter));
  return ziel.toISOString().slice(0, 10);
}
/** Der 1. des Monats, der auf das Datum folgt (Berliner Kalender). */
export function ersterDesFolgemonats(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
}
function monatDe(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("de-DE", { month: "long", year: "numeric", timeZone: "UTC" });
}

async function agentDaten(agentId: number): Promise<any | null> {
  const [a] = (await sqlPool`
    SELECT a.id, a.name, a.first_name, a.last_name, a.email, a.anrede, a.partner_type, a.legal_name, a.company_name,
           a.address_line, a.postal_code, a.city, a.country, a.notice_period, a.governing_law, a.jurisdiction,
           a.bank_iban_masked, a.contract_start_date, a.zugang_gesperrt_am, a.zugang_gesperrt_grund, a.active,
           (SELECT c.template_version FROM fiaon_agent_contracts c WHERE c.agent_id = a.id ORDER BY c.signed_at DESC LIMIT 1) AS vertrag_version,
           (SELECT c.signed_at FROM fiaon_agent_contracts c WHERE c.agent_id = a.id ORDER BY c.signed_at DESC LIMIT 1) AS vertrag_unterzeichnet_am
      FROM fiaon_agents a WHERE a.id = ${agentId}`) as any[];
  return a ?? null;
}

function anredeFuer(a: any): { sie: string; nameFormal: string } {
  const nachname = String(a.last_name || String(a.name || "").split(" ").slice(-1)[0] || "").trim();
  const anrede = String(a.anrede || "").trim();
  if (anrede === "Frau") return { sie: `Sehr geehrte Frau ${nachname},`, nameFormal: `Frau ${nachname}` };
  if (anrede === "Herr") return { sie: `Sehr geehrter Herr ${nachname},`, nameFormal: `Herr ${nachname}` };
  return { sie: `Sehr geehrte/r ${String(a.name || "")},`, nameFormal: String(a.name || "") };
}

// ── Das Schreiben ────────────────────────────────────────────────────────────
interface Variablen {
  name: string; legalName: string; anschrift: string; email: string;
  ausgesprochenAm: string; wirksamAm: string; freigestelltAb: string;
  schlussabrechnungAm: string | null;
  vertragVersion: string; vertragUnterzeichnetAm: string;
  provisionenCents: number; provisionenAnzahl: number; ibanMaskiert: string;
  noticeText: string;
  /** Bereits angeforderte, noch nicht überwiesene Auszahlungen (Cent). */
  anforderungenCents: number;
}

export function schlussabrechnungText(schlussAm: string | null, bezug: string): string {
  if (schlussAm) return `am ${tagDe(schlussAm)}`;
  const beispiel = ersterDesFolgemonats(bezug);
  return `am 1. des auf Ihre Bestätigung folgenden Monats — bei Bestätigung im ${monatDe(bezug)} also am ${tagDe(beispiel)}`;
}
/** Dasselbe für den Bildschirm, der den Mitarbeiter duzt. */
export function schlussabrechnungTextDu(schlussAm: string | null, bezug: string): string {
  if (schlussAm) return `am ${tagDe(schlussAm)}`;
  const beispiel = ersterDesFolgemonats(bezug);
  return `am 1. des Monats nach deiner Bestätigung — bestätigst du im ${monatDe(bezug)}, also am ${tagDe(beispiel)}`;
}

function unterschriftsFeld(opts: {
  signed: boolean; name?: string | null; png?: string | null; modus?: string | null;
  am?: Date | string | null; ip?: string | null; hash?: string | null; email?: string | null;
}): string {
  const sig = opts.signed
    ? (opts.png
        ? `<img class="sig-img" src="${escapeHtml(opts.png)}" alt="Unterschrift" />`
        : `<span style="font-family:'Brush Script MT',cursive;font-size:20pt;">${escapeHtml(opts.name || "")}</span>`)
    : "";
  const meta = opts.signed
    ? `<div class="meta">Elektronisch unterschrieben von ${escapeHtml(opts.name || "")}
        (${opts.modus === "drawn" ? "handgezeichnet" : "getippte Bestätigung"})<br/>
        Zeitpunkt (Europe/Berlin): ${escapeHtml(formatBerlin(opts.am))}<br/>
        IP-Adresse: ${escapeHtml(opts.ip || "—")} · Ausfertigung an: ${escapeHtml(opts.email || "—")}<br/>
        Dokument-Hash (SHA-256): <span class="hash">${escapeHtml(opts.hash || "—")}</span></div>`
    : `<div class="meta">Wird elektronisch über den FIAON-Mitarbeiterbereich bestätigt.</div>`;
  return `
  <div class="sig-grid">
    <div class="sig-col">
      <div style="font-weight:700;">Für die ${FIRMA}</div>
      <div class="sig-line">Name: ${escapeHtml(DIREKTOR)}</div>
      <div class="sig-line">Funktion: Director</div>
      <div class="sig-line">Unterschrift: <span style="font-family:'Brush Script MT',cursive;font-size:18pt;">${escapeHtml(DIREKTOR)}</span></div>
    </div>
    <div class="sig-col">
      <div style="font-weight:700;">Empfangsbestätigung des Handelsvertreters</div>
      <div class="sig-line">Name: ${opts.signed ? escapeHtml(opts.name || "") : "________________"}</div>
      <div class="sig-line" style="min-height:40px;">Unterschrift: ${sig}</div>
      <div class="sig-line">Datum: ${opts.signed ? escapeHtml(formatBerlin(opts.am, false)) : "________________"}</div>
      ${meta}
    </div>
  </div>`;
}

export function schreibenHtml(v: Variablen, panel: string): string {
  const abrechnung = schlussabrechnungText(v.schlussabrechnungAm, v.ausgesprochenAm);
  const abrechnungEn = v.schlussabrechnungAm
    ? `on ${tagEn(v.schlussabrechnungAm)}`
    : `on the first day of the month following your acknowledgment (if acknowledged in ${new Date(`${v.ausgesprochenAm}T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}: on ${tagEn(ersterDesFolgemonats(v.ausgesprochenAm))})`;
  return `
  <div class="brief">
    <table class="kopf" style="width:100%;border-collapse:collapse;margin-bottom:18px;font-size:9.5pt;color:#334155;">
      <tr>
        <td style="vertical-align:top;width:50%;"><b>${FIRMA}</b><br/>${FIRMA_NUMMER}<br/>${escapeHtml(FIRMA_ANSCHRIFT)}</td>
        <td style="vertical-align:top;text-align:right;"><b>${escapeHtml(v.legalName)}</b>${v.anschrift ? `<br/>${escapeHtml(v.anschrift)}` : ""}<br/>${escapeHtml(v.email)}<br/><br/>London, ${escapeHtml(tagDe(v.ausgesprochenAm))}</td>
      </tr>
    </table>

    <h2 style="margin:0 0 4px 0;">Kündigung des Handelsvertretervertrags</h2>
    <p style="margin:0 0 16px 0;color:#64748b;font-size:9.5pt;">Notice of Termination — Self-Employed Commercial Agent Agreement (Version ${escapeHtml(v.vertragVersion)}, unterzeichnet am ${escapeHtml(v.vertragUnterzeichnetAm)})</p>

    <p>${escapeHtml(v.name ? anredeText(v) : "Sehr geehrte Damen und Herren,")}</p>
    <p>hiermit kündigen wir den zwischen Ihnen und der ${FIRMA} geschlossenen Handelsvertretervertrag („Self-Employed Commercial Agent Agreement“) <b>ordentlich gemäß Ziffer 11.1 des Vertrags</b> unter Einhaltung der vertraglichen Kündigungsfrist von ${escapeHtml(v.noticeText)} <b>zum ${escapeHtml(tagDe(v.wirksamAm))}</b> (Ende des Kalendermonats nach Ablauf der Frist). Dieses Schreiben geht Ihnen per E-Mail und im Mitarbeiterbereich zu; Ihre Empfangsbestätigung unten dokumentiert den Zugang.</p>

    <p><b>Freistellung.</b> Seit dem ${escapeHtml(tagDe(v.freigestelltAb))} sind Sie von der Erbringung weiterer Leistungen freigestellt. Ihr Zugang zur FIAON-Plattform ist seit diesem Tag geschlossen; die von Ihnen betreuten Kunden und Termine wurden an die Vertriebsleitung übergeben.</p>

    <p><b>Schlussabrechnung und Auszahlung.</b> Alle bis zum Vertragsende entstandenen und bestätigten Provisionen werden in einer Schlussabrechnung zusammengefasst und <b>${escapeHtml(abrechnung)}</b> auf die von Ihnen hinterlegte Bankverbindung (${escapeHtml(v.ibanMaskiert)}) ausgezahlt — unabhängig vom sonst geltenden Mindestauszahlungsbetrag. Zum Datum dieses Schreibens sind <b>${escapeHtml(eur(v.provisionenCents))}</b> (${v.provisionenAnzahl} ${v.provisionenAnzahl === 1 ? "Buchung" : "Buchungen"}) bestätigt; Provisionen, die bis dahin noch bestätigt werden, kommen hinzu. Provisionen, die erst nach der Schlussabrechnung bestätigt werden (etwa Raten, die später eingehen), werden mit der jeweils nächsten regulären Abrechnung ausgezahlt — ebenfalls ohne Mindestbetrag. Rückbelastungen nach Ziffer 6.5 des Vertrags (Erstattungen, Rücklastschriften) bleiben vorbehalten. Zu jeder Auszahlung erhalten Sie eine Provisionsabrechnung.${v.anforderungenCents > 0 ? ` Bereits angeforderte, noch nicht überwiesene Auszahlungen (<b>${escapeHtml(eur(v.anforderungenCents))}</b>) werden gesondert abgeschlossen.` : ""}</p>

    <p><b>Pflichten nach Vertragsende.</b> Nach Ziffer 11.3 endet die Nutzung der Plattform und der Materialien mit Vertragsende; vertrauliche Informationen und Kundendaten sind zurückzugeben beziehungsweise zu löschen. Die Vertraulichkeitspflicht nach Ziffer 8 gilt über das Vertragsende hinaus; Name, Marke und Materialien von FIAON dürfen nach Ziffer 10 nicht weiter verwendet werden. Nach Ziffer 13.1 dürfen Kunden und Interessenten, mit denen Sie im Rahmen dieses Vertrags zu tun hatten, zwölf Monate lang nicht für konkurrierende Produkte angesprochen werden.</p>

    <p>Ansprüche nach Ziffer 12 des Vertrags (Ausgleich oder Entschädigung nach zwingendem Handelsvertreterrecht) bleiben von dieser Kündigung unberührt.</p>

    <p>Wir danken Ihnen für Ihre Arbeit und wünschen Ihnen für Ihren weiteren Weg alles Gute.</p>

    <p style="margin-top:14px;">Mit freundlichen Grüßen<br/><b>${FIRMA}</b><br/>${escapeHtml(DIREKTOR)}, Director</p>

    <h3 style="margin-top:26px;">Empfangsbestätigung</h3>
    <p>Ich bestätige, diese Kündigung erhalten und gelesen zu haben, und habe die Regelung zur Schlussabrechnung zur Kenntnis genommen. Meine Unterschrift bestätigt den Zugang dieses Schreibens; die Wirksamkeit der Kündigung hängt nicht von ihr ab.</p>
    ${panel}

    <h3 style="margin-top:26px;">Notice of Termination (English summary for the record)</h3>
    <p style="font-size:9.5pt;color:#334155;">${FIRMA} (${FIRMA_NUMMER}, ${escapeHtml(FIRMA_ANSCHRIFT)}) hereby terminates the Self-Employed Commercial Agent Agreement with ${escapeHtml(v.legalName)} in accordance with Clause 11.1 by giving ${escapeHtml(noticeEn(v.noticeText))} notice, effective <b>${escapeHtml(tagEn(v.wirksamAm))}</b> (end of the calendar month following the notice period). The Agent is released from further services as of ${escapeHtml(tagEn(v.freigestelltAb))}. All Commission accrued and confirmed up to the termination date will be settled in a final commission statement and paid ${escapeHtml(abrechnungEn)} to the Agent's nominated bank account, irrespective of the Minimum Payout Threshold; clawbacks under Clause 6.5 remain reserved. Clauses 8 (confidentiality), 10 (intellectual property), 11.3 (return of materials and data), 12 (indemnity or compensation) and 13.1 (twelve-month non-solicitation) continue to apply. The Agent's signature above acknowledges receipt of this notice; the effectiveness of the termination does not depend on it.</p>
  </div>`;
}
function anredeText(v: Variablen): string { return v.name; }
function noticeEn(noticeText: string): string {
  return /einem \(1\) Monat|one \(1\) month/i.test(noticeText) ? "one (1) month's" : noticeText;
}
function noticeDe(notice: string | null | undefined): string {
  const n = String(notice || "").trim();
  if (!n || /one \(1\) month/i.test(n)) return "einem (1) Monat";
  if (/two \(2\) months/i.test(n)) return "zwei (2) Monaten";
  if (/three \(3\) months/i.test(n)) return "drei (3) Monaten";
  return n;
}

async function variablenFuer(a: any, k: any): Promise<Variablen> {
  const prov = await provisionenOffen(Number(a.id));
  const anf = await offeneAnforderungen(Number(a.id));
  const isCompany = String(a.partner_type || "private") === "company";
  const legalName = (isCompany ? a.company_name : a.legal_name) || a.name || "";
  const anschrift = [a.address_line, [a.postal_code, a.city].filter(Boolean).join(" "), a.country].filter(Boolean).join(", ");
  const anrede = anredeFuer(a);
  return {
    name: anrede.sie, legalName: String(legalName), anschrift, email: String(a.email || ""),
    ausgesprochenAm: isoTag(k.ausgesprochen_am),
    wirksamAm: isoTag(k.wirksam_am),
    freigestelltAb: isoTag(k.freigestellt_ab),
    schlussabrechnungAm: k.schlussabrechnung_am ? isoTag(k.schlussabrechnung_am) : null,
    vertragVersion: a.vertrag_version ? String(a.vertrag_version) : "—",
    vertragUnterzeichnetAm: a.vertrag_unterzeichnet_am ? tagDe(a.vertrag_unterzeichnet_am) : (a.contract_start_date ? tagDe(a.contract_start_date) : "—"),
    provisionenCents: prov.cents, provisionenAnzahl: prov.anzahl,
    ibanMaskiert: a.bank_iban_masked ? String(a.bank_iban_masked) : "IBAN laut Mitarbeiterprofil",
    noticeText: noticeDe(a.notice_period),
    anforderungenCents: anf.cents,
  };
}

// ── Anlegen (Verwaltung) ─────────────────────────────────────────────────────
export async function kuendigungAnlegen(agentId: number, ein: {
  ausgesprochenAm?: string | null; wirksamAm?: string | null; freigestelltAb?: string | null;
  grund?: string | null; von: string;
}): Promise<{ ok: true; kuendigung: any } | { ok: false; error: string; status: number }> {
  await ensureKuendigungTabelle();
  const a = await agentDaten(agentId);
  if (!a) return { ok: false, error: "Mitarbeiter nicht gefunden", status: 404 };
  const laufend = await kuendigungLesen(agentId);
  if (laufend) return { ok: false, error: "Für diesen Mitarbeiter läuft bereits eine Kündigung.", status: 409 };
  const heute = berlinToday();
  const datum = (v: unknown, standard: string) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? String(v) : standard);
  const ausgesprochenAm = datum(ein.ausgesprochenAm, heute);
  // Ziffer 11.1: mindestens ein Monat, „to comply with any applicable statutory
  // minimum" — Richtlinie 86/653/EWG Art. 15 (und § 89 HGB): Die Frist endet mit
  // dem Ende eines Kalendermonats. Also: ein Monat, dann Monatsende.
  const wirksamAm = datum(ein.wirksamAm, monatsende(einenMonatSpaeter(ausgesprochenAm)));
  const gesperrtSeit = a.zugang_gesperrt_am ? new Date(a.zugang_gesperrt_am).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }) : ausgesprochenAm;
  const freigestelltAb = datum(ein.freigestelltAb, gesperrtSeit);
  if (wirksamAm < ausgesprochenAm) return { ok: false, error: "Das Vertragsende liegt vor dem Kündigungsdatum.", status: 400 };

  const kRoh = { ausgesprochen_am: ausgesprochenAm, wirksam_am: wirksamAm, freigestellt_ab: freigestelltAb, schlussabrechnung_am: null };
  const v = await variablenFuer(a, kRoh);
  const html = schreibenHtml(v, unterschriftsFeld({ signed: false }));
  let k: any;
  try {
    [k] = (await sqlPool`
      INSERT INTO fiaon_agent_kuendigungen
        (agent_id, status, ausgesprochen_am, wirksam_am, freigestellt_ab, grund, grund_vorher, angelegt_von, text_html, variables_json)
      VALUES (${agentId}, 'offen', ${ausgesprochenAm}::date, ${wirksamAm}::date, ${freigestelltAb}::date,
              ${ein.grund ? String(ein.grund).slice(0, 500) : null}, ${a.zugang_gesperrt_grund ?? null}, ${ein.von}, ${html}, ${JSON.stringify(v)})
      RETURNING *`) as any[];
  } catch (e: any) {
    if (String(e?.code) === "23505") return { ok: false, error: "Für diesen Mitarbeiter läuft bereits eine Kündigung.", status: 409 };
    throw e;
  }

  // Der Zugang bleibt zu — mit dem Grund, den der Login als Kündigung erkennt.
  await sqlPool`
    UPDATE fiaon_agents
       SET zugang_gesperrt_am = COALESCE(zugang_gesperrt_am, NOW()),
           zugang_gesperrt_grund = ${"Kündigung — Abschluss, Abrechnung und Auszahlung stehen beim Login bereit"},
           zugang_gesperrt_von = ${ein.von}, session_epoch = session_epoch + 1
     WHERE id = ${agentId}`;
  await sqlPool`
    INSERT INTO fiaon_agent_events (agent_id, type, meta)
    VALUES (${agentId}, 'kuendigung_angelegt', ${JSON.stringify({ kuendigung_id: k.id, ausgesprochen_am: ausgesprochenAm, wirksam_am: wirksamAm, freigestellt_ab: freigestelltAb, von: ein.von })})
  `.catch(() => {});

  // ── ZUSTELLUNG (Ziffer 16.5: Notices in writing, per E-Mail) ────────────
  // Die Kündigung geht dem Mitarbeiter sofort per Mail zu — mit dem Schreiben
  // als PDF und dem Link zum Abschluss. So hängt der Zugang nicht davon ab, ob
  // er sich noch einmal anmeldet; die Zustellmeldung von Brevo ist der Nachweis.
  await zustellungSenden(k, a, html).catch((e) => console.error("[KUENDIGUNG] Zustellung:", e));
  return { ok: true, kuendigung: k };
}

async function zustellungSenden(k: any, a: any, html: string): Promise<void> {
  const email = String(a.email || "").trim().toLowerCase();
  const link = abschlussLink(Number(a.id));
  let versandt = false; let grund: string | null = null; let messageId: string | null = null;
  if (!email) grund = "keine E-Mail-Adresse im Mitarbeiterkonto";
  else {
    try {
      const pdf = await renderDocumentPdf({
        documentTitle: "Kündigung des Handelsvertretervertrags",
        subtitle: "Notice of Termination · Self-Employed Commercial Agent Agreement",
        bodyHtml: html,
      });
      const { freitextSenden } = await import("../mail/motor");
      const erg = await freitextSenden({
        an: email,
        betreff: "Kündigung Ihres Handelsvertretervertrags mit der FIAON LTD",
        anrede: anredeFuer(a).sie,
        text: [
          `im Anhang erhalten Sie die Kündigung Ihres Handelsvertretervertrags mit der FIAON LTD zum ${tagDe(isoTag(k.wirksam_am))}. Das Schreiben erklärt die Freistellung, die Schlussabrechnung Ihrer Provisionen und Ihre Pflichten nach Vertragsende.`,
          "",
          `Bitte bestätigen Sie den Erhalt über Ihren Mitarbeiterbereich — dort unterschreiben Sie elektronisch und erhalten die Ausfertigung mit Ihrer Unterschrift: ${link}`,
          "",
          "Der Link gilt 30 Tage. Bei Fragen antworten Sie einfach auf diese E-Mail.",
          "",
          "FIAON LTD",
          `${DIREKTOR}, Director`,
        ].join("\n"),
        anhaenge: [{ name: `FIAON_Kuendigung_${String(a.name || "Mitarbeiter").replace(/[^A-Za-z0-9]+/g, "_")}.pdf`, inhalt: pdf }],
        absender: "legal",
      });
      versandt = erg.ok; grund = erg.ok ? null : (erg.grund || "unbekannt"); messageId = erg.messageId ?? null;
    } catch (e) { grund = e instanceof Error ? e.message : String(e); }
  }
  await sqlPool`
    UPDATE fiaon_agent_kuendigungen
       SET zustell_mail_versandt_am = ${versandt ? new Date() : null}, zustell_mail_fehler = ${grund}, updated_at = NOW()
     WHERE id = ${k.id}`;
  try {
    const { mailProtokoll } = await import("./fiaon-mail-log");
    await mailProtokoll({
      event: "kuendigung_zustellung", personId: null, empfaenger: email || null,
      status: versandt ? "versandt" : "fehlgeschlagen", grund,
      payload: { agent_id: Number(a.id), kuendigung_id: k.id, betreff: "Kündigung Ihres Handelsvertretervertrags mit der FIAON LTD" },
      ausgeloestVon: "System (Kündigung)", brevoMessageId: messageId,
    });
  } catch (e) { console.error("[KUENDIGUNG] Mailprotokoll Zustellung:", e); }
}

export async function kuendigungZuruecknehmen(agentId: number, von: string): Promise<{ ok: boolean; error?: string }> {
  const k = await kuendigungLesen(agentId);
  if (!k) return { ok: false, error: "Keine laufende Kündigung." };
  if (k.status === "unterschrieben") return { ok: false, error: "Die Kündigung ist bereits unterschrieben — sie lässt sich nicht mehr zurücknehmen." };
  await sqlPool`UPDATE fiaon_agent_kuendigungen SET status = 'zurueckgenommen', updated_at = NOW() WHERE id = ${k.id}`;
  // Der Sperrgrund von vorher kommt zurück — sonst zeigte der Login weiter „Kündigung".
  await sqlPool`
    UPDATE fiaon_agents SET zugang_gesperrt_grund = ${k.grund_vorher || "Zugang gesperrt — bitte an die Leitung wenden"}
     WHERE id = ${agentId} AND zugang_gesperrt_am IS NOT NULL`;
  await sqlPool`
    INSERT INTO fiaon_agent_events (agent_id, type, meta)
    VALUES (${agentId}, 'kuendigung_zurueckgenommen', ${JSON.stringify({ kuendigung_id: k.id, von })})
  `.catch(() => {});
  return { ok: true };
}

// ── Lage für Bildschirm und Verwaltung ───────────────────────────────────────
export async function abschlussLage(agentId: number, token?: string | null) {
  const a = await agentDaten(agentId);
  const k = await kuendigungLesen(agentId);
  if (!a || !k) return null;
  const prov = await provisionenOffen(agentId);
  const unterschrieben = k.status === "unterschrieben";
  const schluss = k.schlussabrechnung_am ? isoTag(k.schlussabrechnung_am) : null;
  return {
    vorname: String(a.first_name || String(a.name || "").split(" ")[0] || ""),
    name: String(a.legal_name || a.name || ""),
    unterschrieben,
    unterschriebenAm: k.unterschrieben_am ?? null,
    unterschriftName: k.unterschrift_name ?? null,
    ausgesprochenAm: isoTag(k.ausgesprochen_am),
    wirksamAm: isoTag(k.wirksam_am),
    freigestelltAb: isoTag(k.freigestellt_ab),
    schlussabrechnungAm: schluss,
    schlussabrechnungText: schlussabrechnungTextDu(schluss, berlinToday()),
    provisionenOffenCents: prov.cents,
    provisionenAnzahl: prov.anzahl,
    anforderungenOffenCents: (await offeneAnforderungen(agentId)).cents,
    ibanMaskiert: a.bank_iban_masked ?? null,
    emailVorschlag: String(k.empfangs_email || a.email || ""),
    empfangsEmail: k.empfangs_email ?? null,
    mailVersandtAm: k.mail_versandt_am ?? null,
    mailFehler: k.mail_fehler ?? null,
    dokumentHtml: String(k.text_html),
    pdfUrl: unterschrieben && k.pdf_base64 && token ? `/api/fiaon/abschluss/${token}/dokument.pdf` : null,
    schlussPayoutId: k.schluss_payout_id ?? null,
    schlussBetragCents: k.schluss_betrag_cents ?? null,
    schlussAbgeschlossenAm: k.schluss_abgeschlossen_am ?? null,
  };
}

/** Wie beim Kundenantrag: nur ein echtes PNG mit Kopf 89 50 4E 47, 100 Byte bis 400 KB. */
function signaturPruefen(roh: unknown): string | null {
  const s = String(roh ?? "");
  if (!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(s)) return null;
  const b64 = s.slice("data:image/png;base64,".length);
  if (b64.length < 200) return null;
  const bytes = Buffer.from(b64, "base64");
  if (bytes.length < 100 || bytes.length > 400_000) return null;
  if (bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) return null;
  return s;
}

// ── Unterschreiben (der Mitarbeiter) ─────────────────────────────────────────
export async function kuendigungUnterschreiben(agentId: number, ein: {
  signatureName: string; signatureMode: "drawn" | "typed"; signaturePng: string | null;
  email: string; ip: string; userAgent: string;
}): Promise<{ ok: true; mail: { versandt: boolean; an: string; grund?: string } } | { ok: false; error: string; status: number }> {
  const a = await agentDaten(agentId);
  const k = await kuendigungLesen(agentId);
  if (!a || !k) return { ok: false, error: "Keine laufende Kündigung.", status: 404 };
  if (k.status === "unterschrieben") return { ok: false, error: "Die Kündigung ist bereits unterschrieben.", status: 409 };
  const name = String(ein.signatureName || "").trim();
  if (name.length < 3) return { ok: false, error: "Bitte den vollständigen Namen zur Unterschrift angeben.", status: 400 };
  const modus = ein.signatureMode === "drawn" ? "drawn" : "typed";
  // Dieselbe Prüfung wie beim Kundenantrag: echtes PNG, 100 Byte bis 400 KB.
  const png = modus === "drawn" ? signaturPruefen(ein.signaturePng) : null;
  if (modus === "drawn" && !png) return { ok: false, error: "Die gezeichnete Unterschrift fehlt oder ist unbrauchbar — bitte noch einmal zeichnen.", status: 400 };
  const email = String(ein.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, error: "Bitte eine gültige E-Mail-Adresse für die Ausfertigung angeben.", status: 400 };
  const { istRoboterUnterschrift } = await import("./fiaon-vertrieb-zusage");
  const roboter = istRoboterUnterschrift(ein.ip, ein.userAgent);
  if (roboter.roboter) return { ok: false, error: `Diese Unterschrift kann nicht angenommen werden: ${roboter.grund}.`, status: 400 };

  const jetzt = new Date();
  const heute = berlinToday();
  const schlussAm = ersterDesFolgemonats(heute);
  // Ging die Zustell-Mail raus, steht das Vertragsende seit dem Anlegen fest. Nur
  // wenn sie NICHT zugestellt wurde, ist die Bestätigung der Zugang — dann läuft
  // die Frist ab heute (ein Monat, dann Monatsende), nie vor dem genannten Datum.
  const fruehestens = isoTag(k.wirksam_am);
  const abZugang = monatsende(einenMonatSpaeter(heute));
  const wirksamAm = !k.zustell_mail_versandt_am && abZugang > fruehestens ? abZugang : fruehestens;
  const kMitSchluss = { ...k, schlussabrechnung_am: schlussAm, wirksam_am: wirksamAm };
  const v = await variablenFuer(a, kMitSchluss);
  const unsigniert = schreibenHtml(v, "");
  const hash = docHash(`kuendigung|${k.id}|${agentId}|${name}|${jetzt.toISOString()}|${ein.ip}|${unsigniert}`);
  const html = schreibenHtml(v, unterschriftsFeld({ signed: true, name, png, modus, am: jetzt, ip: ein.ip, hash, email }));

  // Ohne PDF keine Unterschrift: Die Ausfertigung IST das Dokument. Scheitert der
  // Druck, bleibt die Akte offen und der Mensch versucht es in einer Minute erneut.
  let pdf: Buffer;
  try {
    pdf = await renderDocumentPdf({
      documentTitle: "Kündigung des Handelsvertretervertrags",
      subtitle: "Notice of Termination · Self-Employed Commercial Agent Agreement",
      bodyHtml: html,
    });
    if (!pdf || pdf.length < 1000) throw new Error("PDF leer");
  } catch (e) {
    console.error("[KUENDIGUNG] PDF:", e);
    return { ok: false, error: "Die PDF konnte gerade nicht erzeugt werden — bitte in einer Minute noch einmal unterschreiben.", status: 500 };
  }

  // EIN Schreibvorgang, der nur eine offene Akte trifft: Zwei Tabs oder ein
  // Doppeltipp erzeugen keine zwei Unterschriften, und ein Fehler hier lässt
  // keine halbe Akte zurück (Skeptiker-Befund 13.09.2026).
  const [gesetzt] = (await sqlPool`
    UPDATE fiaon_agent_kuendigungen
       SET status = 'unterschrieben', text_html = ${html}, variables_json = ${JSON.stringify(v)},
           unterschrift_png = ${png}, unterschrift_name = ${name}, unterschrift_modus = ${modus},
           unterschrieben_am = ${jetzt}, ip = ${ein.ip}, user_agent = ${String(ein.userAgent || "").slice(0, 500)},
           doc_hash = ${hash}, pdf_base64 = ${pdf.toString("base64")},
           empfangs_email = ${email}, schlussabrechnung_am = ${schlussAm}::date, wirksam_am = ${wirksamAm}::date, updated_at = NOW()
     WHERE id = ${k.id} AND status = 'offen' RETURNING id`) as any[];
  if (!gesetzt) return { ok: false, error: "Die Kündigung ist bereits unterschrieben.", status: 409 };

  // Alle bestätigten Provisionen werden für den Schlussabrechnungstag vorgemerkt —
  // damit sie der Sammellauf am 15. nicht vorher anfasst und der Mitarbeiter sie
  // im Bereich als „vorgemerkt bis <Datum>" sieht.
  await sqlPool`
    UPDATE fiaon_commissions
       SET status = 'vorgemerkt', auszahlbar_ab = ${schlussAm}::date, updated_at = NOW(),
           note = COALESCE(note, '') || ${` · ${SCHLUSS_VERMERK}, Auszahlung am ${tagDe(schlussAm)}`}
     WHERE agent_id = ${agentId} AND status = 'bestaetigt'`.catch((e) => console.error("[KUENDIGUNG] vormerken:", e));

  await sqlPool`
    INSERT INTO fiaon_agent_events (agent_id, type, meta)
    VALUES (${agentId}, 'kuendigung_unterschrieben', ${JSON.stringify({ kuendigung_id: k.id, hash, ip: ein.ip, email, schlussabrechnung_am: schlussAm, modus })})
  `.catch(() => {});

  // Die Ausfertigung per Mail — an die Adresse, die der Mitarbeiter genannt hat.
  let mail: { versandt: boolean; an: string; grund?: string } = { versandt: false, an: email, grund: "nicht versucht" };
  const dateiname = `FIAON_Kuendigung_${String(a.name || "Mitarbeiter").replace(/[^A-Za-z0-9]+/g, "_")}_${heute}.pdf`;
  let brevoMessageId: string | null = null;
  {
    try {
      const { freitextSenden } = await import("../mail/motor");
      const prov = await provisionenOffen(agentId);
      const erg = await freitextSenden({
        an: email,
        betreff: "Ihre Kündigung — Ausfertigung mit Ihrer Empfangsbestätigung",
        anrede: anredeFuer(a).sie,
        text: [
          `im Anhang erhalten Sie die Kündigung Ihres Handelsvertretervertrags mit der FIAON LTD als PDF, versehen mit Ihrer elektronischen Empfangsbestätigung vom ${formatBerlin(jetzt)}.`,
          "",
          `Das Vertragsverhältnis endet zum ${tagDe(wirksamAm)}. Ihre bestätigten Provisionen (${eur(prov.cents)}, ${prov.anzahl} ${prov.anzahl === 1 ? "Buchung" : "Buchungen"} zum heutigen Stand) werden in einer Schlussabrechnung zusammengefasst und am ${tagDe(schlussAm)} auf Ihre hinterlegte Bankverbindung ausgezahlt. Die Provisionsabrechnung dazu erhalten Sie gesondert.`,
          "",
          "Bitte bewahren Sie dieses Dokument auf. Bei Fragen antworten Sie einfach auf diese E-Mail.",
          "",
          "Wir danken Ihnen für Ihre Arbeit und wünschen Ihnen alles Gute.",
          "",
          "FIAON LTD",
          `${DIREKTOR}, Director`,
        ].join("\n"),
        anhaenge: [{ name: dateiname, inhalt: pdf }],
        absender: "legal",
      });
      brevoMessageId = erg.messageId ?? null;
      mail = erg.ok ? { versandt: true, an: email } : { versandt: false, an: email, grund: erg.grund || "unbekannt" };
    } catch (e) {
      mail = { versandt: false, an: email, grund: e instanceof Error ? e.message : String(e) };
    }
  }
  // Ins Mailprotokoll — wie jede Mail des Hauses, damit Zustellung und Öffnung sichtbar werden.
  try {
    const { mailProtokoll } = await import("./fiaon-mail-log");
    await mailProtokoll({
      event: "kuendigung_ausfertigung", personId: null, empfaenger: email,
      status: mail.versandt ? "versandt" : "fehlgeschlagen", grund: mail.versandt ? null : (mail.grund || "unbekannt"),
      payload: { agent_id: agentId, kuendigung_id: k.id, anhang: dateiname, betreff: "Ihre Kündigung — Ausfertigung mit Ihrer Empfangsbestätigung" },
      ausgeloestVon: "System (Abschluss)", brevoMessageId,
    });
  } catch (e) { console.error("[KUENDIGUNG] Mailprotokoll:", e); }
  await sqlPool`
    UPDATE fiaon_agent_kuendigungen
       SET mail_versandt_am = ${mail.versandt ? jetzt : null}, mail_fehler = ${mail.versandt ? null : (mail.grund || "unbekannt")}, updated_at = NOW()
     WHERE id = ${k.id}`;

  // Die Hausleitung erfährt es als Aufgabe — mit dem Weg zur Akte.
  try {
    const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
    await auftragFuerKunden({
      personId: null, ref: null,
      titel: `${a.name} hat die Kündigung unterschrieben — Schlussabrechnung am ${tagDe(schlussAm)}`,
      text: `Empfangsbestätigung am ${formatBerlin(jetzt)} (IP ${ein.ip}). Ausfertigung ${mail.versandt ? `an ${email} gesendet` : `NICHT gesendet (${mail.grund}) — PDF liegt in der Mitarbeiterakte`}. `
        + `Offene Provisionen: ${eur((await provisionenOffen(agentId)).cents)}. Der Auszahlungstag-Lauf legt die Anforderung am ${tagDe(schlussAm)} an; die Überweisung machst du wie gewohnt.`,
      dringend: false, schluessel: `kuendigung:${k.id}:unterschrieben`, quelle: "kuendigung", bereich: "konten",
      autorName: "System", anBetreiber: true, link: "/admin/team",
    });
  } catch (e) { console.error("[KUENDIGUNG] Aufgabe:", e); }

  return { ok: true, mail };
}

// ── Schlussabrechnung — Hände für den Auszahlungstag-Lauf ───────────────────
export async function schlussabrechnungenFaellig(heute: string): Promise<{ id: number; agentId: number; schlussAm: string }[]> {
  await ensureKuendigungTabelle();
  // Unterschrieben: am vorgemerkten Tag. Nie unterschrieben: spätestens am Tag
  // nach dem Vertragsende — die Provisionen gehören ihm so oder so.
  await sqlPool`
    UPDATE fiaon_agent_kuendigungen SET schlussabrechnung_am = ${heute}::date, updated_at = NOW()
     WHERE status = 'offen' AND schlussabrechnung_am IS NULL AND wirksam_am < ${heute}::date`;
  const rows = (await sqlPool`
    SELECT id, agent_id, schlussabrechnung_am FROM fiaon_agent_kuendigungen
     WHERE status IN ('unterschrieben', 'offen') AND schluss_abgeschlossen_am IS NULL
       AND schlussabrechnung_am IS NOT NULL AND schlussabrechnung_am <= ${heute}::date
     ORDER BY id`) as any[];
  return rows.map((r) => ({ id: Number(r.id), agentId: Number(r.agent_id), schlussAm: isoTag(r.schlussabrechnung_am) }));
}
export async function schlussabrechnungAbschliessen(id: number, payoutId: number | null, betragCents: number, fehler?: string | null): Promise<void> {
  await sqlPool`
    UPDATE fiaon_agent_kuendigungen
       SET schluss_payout_id = ${payoutId}, schluss_betrag_cents = ${betragCents},
           schluss_fehler = ${fehler ?? null}, schluss_abgeschlossen_am = ${fehler ? null : new Date()}, updated_at = NOW()
     WHERE id = ${id}`;
}
/** Konten mit abgeschlossener Schlussabrechnung — spätere Provisionen zahlt der Sammellauf ohne Mindestbetrag. */
export async function schlussabrechnungAbgeschlossenAgentIds(): Promise<Set<number>> {
  await ensureKuendigungTabelle();
  const rows = (await sqlPool`
    SELECT agent_id FROM fiaon_agent_kuendigungen
     WHERE status IN ('unterschrieben', 'offen') AND schluss_abgeschlossen_am IS NOT NULL`) as any[];
  return new Set(rows.map((r) => Number(r.agent_id)));
}
/** Konten, deren Schlussabrechnung noch aussteht — der Sammellauf am 15. lässt sie in Ruhe. */
export async function schlussabrechnungOffenAgentIds(): Promise<Set<number>> {
  await ensureKuendigungTabelle();
  const rows = (await sqlPool`
    SELECT agent_id FROM fiaon_agent_kuendigungen
     WHERE status IN ('unterschrieben', 'offen') AND schluss_abgeschlossen_am IS NULL`) as any[];
  return new Set(rows.map((r) => Number(r.agent_id)));
}
