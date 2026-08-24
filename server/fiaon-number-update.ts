// ═══════════════════════════════════════════════════════════════════
// #23 — „Nummer falsch" → Kunde/Lead aktualisiert Telefonnummer selbst.
//
// Ablauf: Agent wählt Kontakt-Ergebnis „Falsche Nummer". Ist eine E-Mail
// hinterlegt, feuert (max. 1×/Tag/Person) das Make-Event `number_update_request`
// mit einem signierten Link zu /nummer-aktualisieren. Der Kunde trägt seine
// Nummer ein → sie landet im Datensatz (Audit „vom Kunden selbst aktualisiert"),
// der Lead/Kunde wird wieder anrufbar und geht zurück in die Warteschlange.
//
// Genau die „nur E-Mail, keine Nummer"-Leads aus dem strengen Filter werden so
// reaktivierbar — echter Umsatz-Hebel.
// ═══════════════════════════════════════════════════════════════════
import { createHmac } from "crypto";
import { sqlPool as sql } from "./lib/db-pool";
import { absoluteUrl } from "./fiaon-base-url";
import { sendMakeWebhook } from "./make-webhook";


function secret(): string {
  return process.env.SESSION_SECRET || process.env.MAKE_WEBHOOK_URL || "fiaon-dev-invoice-secret";
}

export type NumTokenKind = "app" | "lead";

/** Signierter, ablaufender Link (14 Tage) zum Nummer-Formular. */
export function signNumberUpdateUrl(kind: NumTokenKind, id: string, ttlMs = 14 * 24 * 60 * 60 * 1000): string {
  const exp = Date.now() + ttlMs;
  const payload = `${kind}:${id}:${exp}`;
  const sig = createHmac("sha256", secret()).update(payload).digest("hex").slice(0, 32);
  const token = `${Buffer.from(payload).toString("base64url")}.${sig}`;
  return absoluteUrl(`/nummer-aktualisieren?token=${token}`);
}

/** Prüft und dekodiert einen Nummer-Token. Gibt null bei ungültig/abgelaufen. */
export function verifyNumberToken(token: string): { kind: NumTokenKind; id: string } | null {
  try {
    const [b64, sig] = String(token || "").split(".");
    if (!b64 || !sig) return null;
    const payload = Buffer.from(b64, "base64url").toString("utf8");
    const parts = payload.split(":");
    if (parts.length < 3) return null;
    const kind = parts[0] as NumTokenKind;
    const exp = Number(parts[parts.length - 1]);
    const id = parts.slice(1, parts.length - 1).join(":");
    if (kind !== "app" && kind !== "lead") return null;
    if (!exp || exp < Date.now()) return null;
    const expected = createHmac("sha256", secret()).update(`${kind}:${id}:${exp}`).digest("hex").slice(0, 32);
    if (expected !== sig) return null;
    return { kind, id };
  } catch {
    return null;
  }
}

let tableEnsured = false;
async function ensureTable(): Promise<void> {
  if (tableEnsured) return;
  await sql`
    CREATE TABLE IF NOT EXISTS fiaon_number_update_requests (
      id SERIAL PRIMARY KEY,
      kind VARCHAR NOT NULL,          -- 'app' | 'lead'
      target_id VARCHAR NOT NULL,     -- ref (app) oder lead-id
      email VARCHAR,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ          -- gesetzt, sobald der Kunde die Nummer geändert hat
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS fiaon_numupd_target_idx ON fiaon_number_update_requests(kind, target_id, sent_at)`;
  tableEnsured = true;
}

/**
 * Sendet (falls E-Mail vorhanden und nicht schon heute gesendet) die
 * „Nummer aktualisieren"-Mail. Wirft nie — fire-and-forget aus dem
 * Kontakt-Ergebnis-Flow. Rate-Limit: max. 1× pro Tag/Person.
 */
export async function maybeSendNumberUpdateMail(
  kind: NumTokenKind,
  id: string,
  opts: { email?: string | null; firstName?: string | null },
): Promise<{ sent: boolean; reason?: string }> {
  try {
    const email = String(opts.email || "").trim();
    if (!email) return { sent: false, reason: "keine_email" };
    await ensureTable();
    // Rate-Limit: heute schon eine Anfrage für diese Person verschickt?
    const recent = await sql`
      SELECT id FROM fiaon_number_update_requests
      WHERE kind = ${kind} AND target_id = ${id} AND sent_at > NOW() - INTERVAL '24 hours'
      LIMIT 1
    `;
    if (recent.length > 0) return { sent: false, reason: "rate_limit" };

    const url = signNumberUpdateUrl(kind, id);
    await sql`
      INSERT INTO fiaon_number_update_requests (kind, target_id, email) VALUES (${kind}, ${id}, ${email})
    `;
    // ── DER TERMIN-LINK GEHÖRT MIT IN DIE MAIL ───────────────────────────
    // Wer keine erreichbare Nummer hat, soll ZWEI Wege haben: die Nummer
    // nachtragen ODER gleich einen Termin wählen. Ohne den zweiten Weg wartet
    // ein Kunde, der lieber einen Termin will, auf einen Anruf, der nicht
    // kommen kann.
    //
    // BETREIBER-TODO: In der Brevo-Vorlage T23 muss `{{params.termin_link}}`
    // eingebaut werden — sonst fährt die Variable mit und wird nicht gezeigt.
    let terminLink: string | null = null;
    try {
      const [personId] = kind === "app"
        ? ((await sql`SELECT person_id FROM fiaon_applications WHERE ref = ${id}`) as any[])
        : ((await sql`SELECT person_id FROM fiaon_leads WHERE id = ${Number(id)}`) as any[]);
      if (personId?.person_id) {
        const { terminLink: linkFuer } = await import("./lib/fiaon-termine");
        // ── DIESER WEG HINTERLIESS BISHER GAR NICHTS (24.08.2026) ────────
        // VORHER ohne zweites Argument. Der Wert `nummer_korrektur` stand
        // zwar in den Anzeige-Wörterbüchern (fiaon-termin-zentrale.ts,
        // shared/fiaon-termin-art.ts), wurde aber NIE geschrieben — der
        // Admin-Filter „Nach Nummern-Korrektur" konnte deshalb garantiert
        // nichts finden. NACHHER trägt der Link `?von=nummer_korrektur`, und
        // der gebuchte Termin bekommt diese `herkunft`.
        terminLink = linkFuer(Number(personId.person_id), "nummer_korrektur");
      }
    } catch { /* ohne Termin-Link ist die Mail nicht falsch, nur ärmer */ }

    await sendMakeWebhook("number_update_request", {
      email,
      vorname: opts.firstName || null,
      antrag_id: kind === "app" ? id : undefined,
      lead_id: kind === "lead" ? Number(id) : undefined,
      update_url: url,
      termin_link: terminLink,
    });
    console.log(`[FIAON-NUMUPDATE] Anfrage gesendet: ${kind}:${id} → ${email}`);
    return { sent: true };
  } catch (err) {
    console.error("[FIAON-NUMUPDATE] maybeSendNumberUpdateMail:", err);
    return { sent: false, reason: "fehler" };
  }
}

/** Markiert, dass der Kunde die Nummer über den Link geändert hat (Audit). */
export async function markNumberUpdated(kind: NumTokenKind, id: string): Promise<void> {
  try {
    await ensureTable();
    await sql`
      UPDATE fiaon_number_update_requests SET updated_at = NOW()
      WHERE kind = ${kind} AND target_id = ${id} AND updated_at IS NULL
    `;
    // ── DIE KARTE KOMMT ZURÜCK ─────────────────────────────────────────────
    // Der Kunde hat gerade reagiert — das ist der beste Moment für einen
    // Anruf. `nichtMehrWarten` setzt die Wiedervorlage auf heute und nimmt
    // den Wartezustand weg. Ohne das würde die Karte noch sieben Tage liegen,
    // obwohl die Nummer längst stimmt.
    try {
      const [p] = kind === "app"
        ? ((await sql`SELECT person_id FROM fiaon_applications WHERE ref = ${id}`) as any[])
        : ((await sql`SELECT person_id FROM fiaon_leads WHERE id = ${Number(id)}`) as any[]);
      if (p?.person_id) {
        const { nichtMehrWarten } = await import("./lib/fiaon-warten");
        await nichtMehrWarten(Number(p.person_id), "nummer");
      }
    } catch (e) {
      console.error("[FIAON-NUMUPDATE] Wartezustand:", e);
    }
  } catch { /* nicht kritisch */ }
}
