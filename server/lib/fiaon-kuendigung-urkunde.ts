// ═══════════════════════════════════════════════════════════════════════════
// DIE KÜNDIGUNGSURKUNDE — DAS DOKUMENT ZUR KÜNDIGUNG (23.09.2026, E-213)
//
// Justin, wörtlich: „Wenn Florentine oder ich auf ‚kündigen‘ klicken, dann muss
// die Kündigung auch wirklich durchgeführt werden und überall korrekt angezeigt
// werden. Also der gesamte Prozess (Portalsperre, Kündigungsunterlagen,
// Unterschrift durch den Mitarbeiter, … der gesamte Prozess eben) und überall,
// wo man die Ansicht hat, dass es auch als gekündigt angezeigt wird."
//
// ── WAS VORHER FEHLTE ─────────────────────────────────────────────────────
// Die Wirkung war seit E-092 da: `gekuendigt_am` wird gesetzt, die letzte Rate
// bleibt fällig, alles danach wird storniert, der Tageslauf legt nichts Neues
// an. Was fehlte, war das PAPIER. Der Kunde bekam eine Mail und sonst nichts —
// kein Schriftstück, das er ablegen, weiterreichen oder einem Gericht vorlegen
// kann. Und niemand stand darunter: Die Kündigung war ein Datenbankzustand,
// keine Handlung eines Menschen mit Namen.
//
// ── WAS DIESE DATEI TUT ───────────────────────────────────────────────────
// Sie fertigt eine Urkunde aus: wer gekündigt hat, wann, welcher Vertrag,
// welches Paket, welche Rate noch offen ist und wann der Vertrag endet. Darunter
// steht der Mitarbeiter, der sie ausgefertigt hat, mit Name, Rolle, Zeitpunkt
// und einer Prüfsumme über den Inhalt.
//
// ── DIE UNTERSCHRIFT ──────────────────────────────────────────────────────
// Keine gemalte Unterschrift, sondern dieselbe Bauart wie bei der Mitarbeiter-
// kündigung (E-185): Name, Rolle, Zeitpunkt und `docHash` über den Rumpf. Eine
// gemalte Linie beweist nichts; eine Prüfsumme zeigt, dass das Dokument nach der
// Zeichnung nicht verändert wurde. Wer die Urkunde später erneut abruft, bekommt
// die GESPEICHERTE Ausfertigung — nicht eine frisch gerechnete. Sonst stünde bei
// jedem Abruf ein anderer Stand darin, und die Prüfsumme wäre wertlos.
//
// ── WAS HIER BEWUSST NICHT PASSIERT ───────────────────────────────────────
// Kein Erlass, keine Rückerstattung, keine Änderung an Raten. Die Urkunde
// BESCHREIBT, was `kuendigungSetzen` entschieden hat — sie entscheidet nichts.
// Zwei Stellen, die dasselbe entscheiden, entscheiden irgendwann verschieden.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { escapeHtml, docHash, renderDocumentPdf } from "./fiaon-html-pdf";

export interface Unterzeichner {
  name: string;
  rolle: string;
  agentId?: number | null;
}

export interface UrkundeErgebnis {
  ok: boolean;
  pdf?: Buffer;
  dateiname?: string;
  hash?: string;
  frisch?: boolean;
  error?: string;
}

/** Spalten nachrüsten — idempotent, beim ersten Aufruf. */
let spaltenBereit: Promise<void> | null = null;
export function urkundeSpalten(): Promise<void> {
  if (!spaltenBereit) {
    spaltenBereit = (async () => {
      await sqlPool`
        ALTER TABLE fiaon_applications
          ADD COLUMN IF NOT EXISTS kuendigung_pdf_base64 TEXT,
          ADD COLUMN IF NOT EXISTS kuendigung_doc_hash TEXT,
          ADD COLUMN IF NOT EXISTS kuendigung_gezeichnet_von TEXT,
          ADD COLUMN IF NOT EXISTS kuendigung_gezeichnet_rolle TEXT,
          ADD COLUMN IF NOT EXISTS kuendigung_gezeichnet_am TIMESTAMPTZ
      `;
    })().catch((e) => {
      spaltenBereit = null;
      throw e;
    });
  }
  return spaltenBereit;
}

const ROLLE_TEXT: Record<string, string> = {
  agent: "Bonitätsmanagement",
  onboarding: "Bonitätsmanagement",
  inkasso: "Forderungen und Zahlungen",
  vertriebsleiter: "Vertriebsleitung",
  trainer: "Schulung",
  chef: "Geschäftsführung",
  admin: "Geschäftsführung",
};
export function rolleInWorten(rolle: string | null | undefined): string {
  return ROLLE_TEXT[String(rolle ?? "").toLowerCase()] ?? "FIAON LTD";
}

const datum = (v: unknown): string =>
  v ? new Date(String(v)).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" }) : "—";
const zeitpunkt = (v: unknown): string =>
  v ? `${new Date(String(v)).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" })}, ${new Date(String(v)).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" })} Uhr`
    : "—";
const euro = (cents: unknown): string => `${(Number(cents || 0) / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

const zeile = (k: string, w: string) =>
  `<tr><th style="text-align:left;padding:6px 18px 6px 0;font-weight:normal;color:#555;white-space:nowrap">${escapeHtml(k)}</th><td style="padding:6px 0">${w}</td></tr>`;

/**
 * Den Rumpf der Urkunde bauen. Getrennt vom Rendern, damit die Prüfsumme über
 * GENAU den Text läuft, der gedruckt wird.
 */
function rumpfBauen(a: any, unterzeichner: Unterzeichner, gezeichnetAm: Date): { html: string; titel: string } {
  const name = [a.first_name, a.last_name].filter(Boolean).join(" ").trim() || a.email || a.payment_reference || a.ref;
  const paket = a.pack_name ? String(a.pack_name).split("\n")[0] : "—";
  const offeneRate = a.rate_nr != null;
  const beendet = !!a.vertrag_ende_am && new Date(a.vertrag_ende_am).getTime() <= Date.now();

  // ── WAS JETZT GILT ──────────────────────────────────────────────────────
  // Justins Regel aus E-092, in der Sprache des Kunden: Die laufende Rate
  // bleibt fällig; mit ihrer Zahlung endet der Vertrag. Steht nichts mehr
  // offen, ist er bereits beendet. Beides wird hier benannt, nicht angedeutet.
  const wasGilt = beendet
    ? `<p>Der Vertrag ist <strong>beendet</strong>. Es steht nichts mehr offen. Weitere Raten werden nicht mehr gestellt,
       und Sie erhalten keine Zahlungserinnerungen mehr.</p>`
    : offeneRate
      ? `<p>Mit dieser Kündigung entfallen alle künftigen Raten. <strong>Offen bleibt die laufende Rate ${escapeHtml(String(a.rate_nr))}</strong>
         über ${escapeHtml(euro(a.betrag_cents))}, fällig am ${escapeHtml(datum(a.faellig_am))}.
         Mit dem Eingang dieser Zahlung endet der Vertrag endgültig; Sie erhalten darüber eine gesonderte Bestätigung.</p>
         <p>Verwendungszweck für die Überweisung: <strong>${escapeHtml(String(a.zahlungsreferenz ?? a.payment_reference ?? ""))}</strong>.
         Bitte geben Sie ihn genau so an, damit Ihre Zahlung ohne Rückfrage zugeordnet werden kann.</p>`
      : `<p>Mit dieser Kündigung entfallen alle künftigen Raten. Eine offene Forderung besteht nach unserem Stand nicht.</p>`;

  const html = `
    <p>Hiermit bestätigen wir den Eingang und die Durchführung Ihrer Kündigung.</p>

    <h2>Vertrag</h2>
    <table style="border-collapse:collapse;font-size:11pt">
      ${zeile("Vertragspartnerin", escapeHtml(name))}
      ${zeile("Vertragsnummer", escapeHtml(String(a.payment_reference ?? a.ref)))}
      ${zeile("Leistung", escapeHtml(paket))}
      ${zeile("Kündigung eingegangen", escapeHtml(datum(a.gekuendigt_am)))}
      ${zeile("Kündigungsweg", escapeHtml(wegInWorten(a.kuendigung_quelle)))}
      ${zeile("Vertragsende", a.vertrag_ende_am ? escapeHtml(datum(a.vertrag_ende_am)) : "mit Zahlung der letzten Rate")}
    </table>

    <h2>Was jetzt gilt</h2>
    ${wasGilt}

    <h2>Ihr Zugang</h2>
    <p>Ihr persönlicher Bereich bleibt für Sie geöffnet: Sie finden dort weiterhin Ihre Unterlagen, Ihre Rechnungen und
    diese Bestätigung, und Sie können eine offene Rate dort bezahlen. Neue Leistungen können über den Bereich nicht mehr
    beauftragt werden, und es werden Ihnen keine Termine mehr angeboten.</p>

    <h2>Wenn Sie es sich anders überlegen</h2>
    <p>Solange der Vertrag nicht beendet ist, können wir die Kündigung auf Ihren Wunsch zurücknehmen — der Vertrag läuft
    dann unverändert weiter. Eine kurze Nachricht an support@fiaon.com genügt.</p>

    <h2>Ausgefertigt</h2>
    <p style="margin-bottom:4px">FIAON LTD, gezeichnet durch:</p>
    <table style="border-collapse:collapse;font-size:11pt">
      ${zeile("Name", escapeHtml(unterzeichner.name))}
      ${zeile("Funktion", escapeHtml(unterzeichner.rolle))}
      ${zeile("Zeitpunkt", escapeHtml(zeitpunkt(gezeichnetAm.toISOString())))}
    </table>
    <p style="margin-top:14px;font-size:9.5pt;color:#666">
      Dieses Dokument wurde elektronisch ausgefertigt und ist ohne handschriftliche Unterschrift gültig.
      Die nachstehende Prüfsumme sichert seinen Inhalt: Wird auch nur ein Zeichen geändert, stimmt sie nicht mehr überein.
    </p>`;

  return { html, titel: "Kündigungsbestätigung" };
}

function wegInWorten(quelle: unknown): string {
  switch (String(quelle ?? "")) {
    case "mail": return "schriftlich per E-Mail";
    case "formular": return "über das Kündigungsformular";
    case "telefon": return "im Telefongespräch";
    case "admin": return "durch die Geschäftsführung";
    case "altbestand": return "aus einem früher eingegangenen Kündigungsantrag";
    default: return "schriftlich";
  }
}

/**
 * Die Urkunde ausfertigen. Existiert bereits eine, wird GENAU DIESE zurück-
 * gegeben — eine zweite Ausfertigung mit anderem Zeitpunkt würde die erste
 * entwerten, die der Kunde schon in der Hand hat.
 */
export async function urkundeAusfertigen(
  ref: string,
  unterzeichner: Unterzeichner,
  opts: { neuAusfertigen?: boolean } = {},
): Promise<UrkundeErgebnis> {
  await urkundeSpalten();
  const [a] = (await sqlPool`
    SELECT a.ref, a.person_id, a.email, a.first_name, a.last_name, a.payment_reference, a.pack_name,
           a.gekuendigt_am, a.kuendigung_quelle, a.letzte_rate_nr, a.vertrag_ende_am,
           a.kuendigung_zurueckgenommen_am,
           a.kuendigung_pdf_base64, a.kuendigung_doc_hash, a.kuendigung_gezeichnet_von,
           a.kuendigung_gezeichnet_rolle, a.kuendigung_gezeichnet_am,
           r.rate_nr, r.betrag_cents, r.faellig_am, r.zahlungsreferenz
      FROM fiaon_applications a
      LEFT JOIN LATERAL (
        SELECT rate_nr, betrag_cents, faellig_am, zahlungsreferenz FROM fiaon_abo_raten x
         WHERE x.ref = a.ref AND x.rate_nr = a.letzte_rate_nr AND x.status = 'offen' LIMIT 1
      ) r ON TRUE
     WHERE a.ref = ${ref} LIMIT 1`) as any[];

  if (!a) return { ok: false, error: "Diese Bestellung gibt es nicht." };
  if (!a.gekuendigt_am) return { ok: false, error: "Zu dieser Bestellung liegt keine Kündigung vor." };

  const dateiname = `FIAON_Kuendigungsbestaetigung_${String(a.payment_reference ?? a.ref).replace(/[^A-Za-z0-9-]+/g, "_")}.pdf`;

  // Die gespeicherte Ausfertigung hat Vorrang.
  if (a.kuendigung_pdf_base64 && !opts.neuAusfertigen) {
    return { ok: true, pdf: Buffer.from(String(a.kuendigung_pdf_base64), "base64"), dateiname, hash: a.kuendigung_doc_hash ?? undefined, frisch: false };
  }

  const gezeichnetAm = new Date();
  const { html, titel } = rumpfBauen(a, unterzeichner, gezeichnetAm);
  const hash = docHash(html);
  const bodyHtml = `${html}
    <p style="margin-top:6px;font-size:9.5pt;color:#666">Prüfsumme: <code>${escapeHtml(hash)}</code></p>`;

  let pdf: Buffer;
  try {
    pdf = await renderDocumentPdf({
      documentTitle: titel,
      subtitle: `Vertrag ${String(a.payment_reference ?? a.ref)}`,
      bodyHtml,
    });
    if (!pdf || pdf.length < 800) throw new Error("PDF leer");
  } catch (e) {
    console.error("[KÜNDIGUNG] Urkunde:", e);
    return { ok: false, error: "Die Urkunde konnte gerade nicht erzeugt werden — bitte in einer Minute noch einmal." };
  }

  await sqlPool`
    UPDATE fiaon_applications
       SET kuendigung_pdf_base64 = ${pdf.toString("base64")},
           kuendigung_doc_hash = ${hash},
           kuendigung_gezeichnet_von = ${unterzeichner.name},
           kuendigung_gezeichnet_rolle = ${unterzeichner.rolle},
           kuendigung_gezeichnet_am = ${gezeichnetAm.toISOString()},
           updated_at = NOW()
     WHERE ref = ${ref}`;

  console.log(`[KÜNDIGUNG] Urkunde ausgefertigt für ${ref} durch ${unterzeichner.name} (${hash.slice(0, 12)}…).`);
  return { ok: true, pdf, dateiname, hash, frisch: true };
}

/**
 * Wird die Kündigung zurückgenommen, verliert die Urkunde ihre Grundlage. Sie
 * wird gelöscht, nicht überschrieben: Ein Dokument, das einen Zustand bescheinigt,
 * den es nicht mehr gibt, ist schlimmer als gar keines.
 */
export async function urkundeVerwerfen(ref: string): Promise<void> {
  await urkundeSpalten();
  await sqlPool`
    UPDATE fiaon_applications
       SET kuendigung_pdf_base64 = NULL, kuendigung_doc_hash = NULL,
           kuendigung_gezeichnet_von = NULL, kuendigung_gezeichnet_rolle = NULL,
           kuendigung_gezeichnet_am = NULL, updated_at = NOW()
     WHERE ref = ${ref}`.catch(() => {});
}

/** Nur der Stand — für Akte und Kundenbereich, ohne die PDF zu laden. */
export async function urkundeStand(ref: string): Promise<{
  da: boolean; von: string | null; rolle: string | null; am: string | null; hash: string | null;
}> {
  await urkundeSpalten();
  const [r] = (await sqlPool`
    SELECT (kuendigung_pdf_base64 IS NOT NULL) AS da, kuendigung_gezeichnet_von AS von,
           kuendigung_gezeichnet_rolle AS rolle, kuendigung_gezeichnet_am AS am, kuendigung_doc_hash AS hash
      FROM fiaon_applications WHERE ref = ${ref} LIMIT 1`.catch(() => [])) as any[];
  return {
    da: r?.da === true, von: r?.von ?? null, rolle: r?.rolle ?? null,
    am: r?.am ?? null, hash: r?.hash ?? null,
  };
}
