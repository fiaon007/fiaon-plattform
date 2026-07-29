// ═══════════════════════════════════════════════════════════════════
// FIAON Kontoabgleich (Bank-Reconciliation) — /admin/reconcile*
//
// Gleicht die REALEN Kontoeingänge (Kontoauszug, z. B. Wise-CSV) mit den im
// System hinterlegten Kunden-Anträgen ab, damit ausschließlich EXAKTE
// Zahlungseingänge verbucht sind.
//
// STRIKTE REGELN (aus Anforderung):
// - NUR EINGÄNGE der Kunden (CREDIT + DEPOSIT). Ausgänge/Card/Top-ups werden
//   serverseitig ignoriert und NIE verbucht.
// - P2-A: Verbuchen ist IDENTISCH zum Admin-Button „bezahlt" (mark-paid):
//   payment_status='paid' + Schwester-Dubletten superseden + payment_confirmed-
//   Mail (1×-Claim) + Provisionshook onCustomerPaid (der seit P2-B nur bei
//   dokumentierter Betreuung bucht — sonst Direktzahler, keine Provision).
// - P2-A Match: Kunden überweisen mit der KURZEN payment_reference (FIAON-XXXXXX,
//   QR-Code/Zahlungsseite); vereinzelt steht die LANGE Bestell-ref im Zweck.
//   findApp prüft deshalb BEIDE Felder (case-insensitiv, tolerant gegenüber
//   Leerzeichen/Bindestrichen, mit/ohne FIAON-Präfix).
// - Abweichender Betrag wird als Abweichung markiert (amount_ok=FALSE), nie
//   stillschweigend übernommen.
// - Fuzzy (Einzahlername+Betrag) ist NUR VORSCHLAG mit Konfidenz — nie Auto-Buchung.
// - Nicht automatisch zuordenbare Eingänge lassen sich manuell einem Kunden
//   zuordnen (assign) oder als „nicht-Kunde" ignorieren.
// - Beträge in Integer-Cents; Idempotenz über die Bank-Transaktions-ID.
// ═══════════════════════════════════════════════════════════════════

import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { CsvFehler, entdoppele, leseWiseCsv, type CsvZeile } from "../lib/wise-csv";
import { nameTokens, ordneZu, type Kandidat } from "../lib/zahlungs-zuordnung";

const router = Router();

let ensured = false;
async function ensureTable(): Promise<void> {
  if (ensured) return;
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_bank_txns (
      id SERIAL PRIMARY KEY,
      txn_id VARCHAR UNIQUE,                 -- Bank-Transaktions-ID (Idempotenz)
      booked_at TIMESTAMPTZ,
      amount_cents INTEGER NOT NULL,         -- immer positiv (Eingang)
      currency VARCHAR NOT NULL DEFAULT 'EUR',
      payer_name VARCHAR,
      reference_raw TEXT,                    -- Original-Referenz/Beschreibung
      extracted_ref VARCHAR,                 -- automatisch erkannte FIAON-Referenz
      matched_ref VARCHAR,                   -- zugeordnete Antrags-Referenz (auto/manuell)
      match_status VARCHAR NOT NULL DEFAULT 'unmatched', -- matched | unmatched | manual | ignored
      amount_ok BOOLEAN,                     -- Eingang == amount_due des Antrags?
      applied BOOLEAN NOT NULL DEFAULT FALSE,-- als bezahlt verbucht?
      applied_at TIMESTAMPTZ,
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_bank_txns_status_idx ON fiaon_bank_txns (match_status)`;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_bank_txns_matched_idx ON fiaon_bank_txns (matched_ref)`;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_bank_txns_booked_idx ON fiaon_bank_txns (booked_at)`;
  ensured = true;
}

/** FIAON-Referenz aus einem freien Verwendungszweck extrahieren.
 * Die Funktion ist reine Logik und liegt seit dem Wise-Umbau in
 * `lib/zahlungs-zuordnung.ts` — dort ist sie ohne Datenbank testbar.
 * Sie wird hier unverändert re-exportiert, damit alle bisherigen Aufrufer
 * (Import, Rematch, Zuordnung) gültig bleiben. */
export { extractRef } from "../lib/zahlungs-zuordnung";
import { extractRef } from "../lib/zahlungs-zuordnung";

/** Sucht den Antrag zu einer (normalisierten) Referenz — P2-A (D6-Root-Cause):
 * Kunden überweisen mit der KURZEN payment_reference, der alte Code prüfte nur
 * die LANGE ref → 0 % Auto-Match. Jetzt: BEIDE Felder, Präfix-/Format-tolerant. */
export async function findApp(ref: string): Promise<any | null> {
  const norm = ref.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const body = norm.startsWith("FIAON") ? norm.slice(5) : norm;
  if (body.length < 6) return null;
  // Kandidaten: exakt wie angegeben, kurze 6er- und lange 12er-Variante —
  // Verwendungszwecke hängen oft Junk an („FIAON 6AS4A5/WUIBCB…").
  const candidates = Array.from(new Set([
    `FIAON${body}`,
    `FIAON${body.slice(0, 6)}`,
    `FIAON${body.slice(0, 12)}`,
  ]));
  const rows = await sqlPool`
    SELECT ref, payment_reference, amount_due, currency, payment_status, first_name, last_name, contact_name, email
    FROM fiaon_applications
    WHERE merged_into IS NULL AND (
      UPPER(REGEXP_REPLACE(COALESCE(payment_reference, ''), '[^A-Za-z0-9]', '', 'g')) = ANY(${candidates})
      OR UPPER(REGEXP_REPLACE(ref, '[^A-Za-z0-9]', '', 'g')) = ANY(${candidates})
    )
    ORDER BY (UPPER(REGEXP_REPLACE(COALESCE(payment_reference, ''), '[^A-Za-z0-9]', '', 'g')) = ANY(${candidates})) DESC,
             created_at ASC
    LIMIT 1
  `;
  return rows.length ? rows[0] : null;
}

function appAmountCents(app: any): number {
  return Math.round(Number(app.amount_due || 0) * 100);
}

/** P4: Passt der Einzahlername plausibel zum Kundennamen? Tolerant (Reihenfolge,
 * Diakritika, Teil-Tokens ≥ 3 Zeichen). Genügt EIN gemeinsames Namens-Token, gilt
 * es als Treffer — es geht nur darum, echte Dritt-Zahler (#27) sichtbar zu machen,
 * nicht darum, Zuordnungen zu blockieren. */
export function payerMatchesCustomer(payer: string, customer: string): boolean {
  const norm = (s: string) =>
    String(s || "")
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/).filter((t) => t.length >= 3);
  const p = new Set(norm(payer));
  const c = norm(customer);
  if (p.size === 0 || c.length === 0) return true; // zu wenig Info → keinen Hinweis erzwingen
  return c.some((t) => p.has(t));
}

// ═══════════════ Import (Kontoauszug → Ledger, idempotent) ═══════════════
//
// Der Auszug wird SERVERSEITIG gelesen — früher tat das der Browser mit einer
// festen Spaltentabelle. Passte ein Spaltenname nicht, verschwand die Zeile
// wortlos. Von 100 Eingängen wurden am Ende 9 zugeordnet.
//
// Jetzt: `lib/wise-csv.ts` erkennt die Spalten in mehreren Sprach- und
// Formatvarianten und BRICHT AB, wenn eine Pflichtspalte fehlt. Zugeordnet
// wird über `lib/zahlungs-zuordnung.ts` in Stufen — Referenz, Absender-IBAN,
// Name mit exaktem Betrag. Alles Unsichere bleibt Vorschlag für einen Menschen.
//
// Automatisch verbucht wird hier weiterhin NICHTS. Der Import füllt nur das
// Bankbuch; „Verbuchen" bleibt ein eigener, bewusster Klick.

interface BankRow {
  txnId?: string; dateTime?: string; amount?: number | string; currency?: string;
  description?: string; reference?: string; payerName?: string;
  senderAccount?: string;
  transactionType?: string; detailsType?: string;
}

/** Kandidaten samt Vorfilter — ohne ihn liefe jeder Eingang gegen alle Zeilen. */
async function ladeKandidaten(): Promise<{
  alle: Kandidat[];
  vorfilter: (payerName: string | null, amountCents: number) => Kandidat[];
}> {
  const roh = await sqlPool`
    SELECT ref, payment_reference, amount_due, payment_status, iban, email, person_id, created_at,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', first_name, last_name)), ''), contact_name, company_name, email) AS name
    FROM fiaon_applications
    WHERE merged_into IS NULL AND gdpr_deleted_at IS NULL
  `;
  const alle: Kandidat[] = roh.map((r: any) => ({
    ref: r.ref,
    paymentReference: r.payment_reference,
    sollCents: Math.round(Number(r.amount_due || 0) * 100),
    paymentStatus: String(r.payment_status || ""),
    name: String(r.name || ""),
    email: r.email,
    iban: r.iban,
    personId: r.person_id != null ? Number(r.person_id) : null,
    createdAt: r.created_at ? new Date(r.created_at) : null,
  }));

  const nachPraefix = new Map<string, Kandidat[]>();
  const nachBetrag = new Map<number, Kandidat[]>();
  for (const k of alle) {
    for (const t of Array.from(new Set(nameTokens(k.name).map((x) => x.slice(0, 3))))) {
      const arr = nachPraefix.get(t) ?? [];
      arr.push(k);
      nachPraefix.set(t, arr);
    }
    const arr = nachBetrag.get(k.sollCents) ?? [];
    arr.push(k);
    nachBetrag.set(k.sollCents, arr);
  }
  const vorfilter = (payerName: string | null, amountCents: number): Kandidat[] => {
    const menge = new Set<Kandidat>();
    for (const p of Array.from(new Set(nameTokens(payerName).map((x) => x.slice(0, 3))))) {
      for (const k of nachPraefix.get(p) ?? []) menge.add(k);
    }
    for (const k of nachBetrag.get(amountCents) ?? []) menge.add(k);
    return Array.from(menge);
  };
  return { alle, vorfilter };
}

const refSuche = async (ref: string) => {
  const app = await findApp(ref);
  return app ? { ref: app.ref, personId: null } : null;
};

/** Eingänge zuordnen und ins Bankbuch schreiben. Verbucht nichts, versendet nichts. */
async function schreibeEingaenge(zeilen: CsvZeile[]): Promise<{
  imported: number; matched: number; unmatched: number; stufen: Record<string, number>;
}> {
  const { vorfilter } = await ladeKandidaten();
  const stufen: Record<string, number> = {};
  let imported = 0, matched = 0, unmatched = 0;

  for (const z of zeilen) {
    const zu = await ordneZu(
      { amountCents: z.amountCents, payerName: z.payerName, senderAccount: z.senderAccount, referenceRaw: z.referenceRaw },
      vorfilter(z.payerName, z.amountCents),
      refSuche,
    );
    stufen[zu.methode] = (stufen[zu.methode] ?? 0) + 1;
    const status = zu.automatisch ? "matched" : "unmatched";

    await sqlPool`
      INSERT INTO fiaon_bank_txns
        (txn_id, booked_at, amount_cents, currency, payer_name, reference_raw,
         extracted_ref, matched_ref, match_status, amount_ok, note)
      VALUES
        (${z.txnId}, ${z.bookedAt}, ${z.amountCents}, ${z.currency}, ${z.payerName},
         ${z.referenceRaw}, ${zu.ref}, ${zu.automatisch ? zu.ref : null}, ${status},
         ${zu.betragPasst}, ${zu.begruendung})
      ON CONFLICT (txn_id) DO UPDATE SET
        amount_cents  = EXCLUDED.amount_cents,
        currency      = EXCLUDED.currency,
        payer_name    = EXCLUDED.payer_name,
        reference_raw = EXCLUDED.reference_raw,
        extracted_ref = EXCLUDED.extracted_ref,
        -- Eine von Hand gesetzte oder bereits verbuchte Zuordnung ist mehr wert
        -- als jede Automatik und wird nie überschrieben.
        matched_ref = CASE WHEN fiaon_bank_txns.match_status IN ('manual','ignored') OR fiaon_bank_txns.applied
                           THEN fiaon_bank_txns.matched_ref ELSE EXCLUDED.matched_ref END,
        match_status = CASE WHEN fiaon_bank_txns.match_status IN ('manual','ignored') OR fiaon_bank_txns.applied
                            THEN fiaon_bank_txns.match_status ELSE EXCLUDED.match_status END,
        amount_ok   = EXCLUDED.amount_ok,
        note        = EXCLUDED.note,
        updated_at  = NOW()
    `;
    imported++;
    if (status === "matched") matched++; else unmatched++;
  }
  return { imported, matched, unmatched, stufen };
}

/** Altes Format aus dem Browser in die Form des CSV-Lesers bringen. */
function ausAltformat(rows: BankRow[]): { zeilen: CsvZeile[]; uebersprungen: number } {
  const zeilen: CsvZeile[] = [];
  let uebersprungen = 0;
  rows.forEach((r, i) => {
    const cents = Math.round(Number(r.amount) * 100);
    const txnId = String(r.txnId || "").trim();
    const typ = String(r.transactionType || "").toUpperCase();
    if (!txnId || !Number.isFinite(cents) || cents <= 0 || typ === "DEBIT" || typ === "OUT") {
      uebersprungen++;
      return;
    }
    const d = r.dateTime ? new Date(r.dateTime) : null;
    zeilen.push({
      txnId,
      bookedAt: d && !isNaN(d.getTime()) ? d : null,
      amountCents: cents,
      currency: String(r.currency || "EUR").toUpperCase().slice(0, 3),
      payerName: r.payerName || null,
      senderAccount: r.senderAccount || null,
      referenceRaw: [r.reference, r.description].filter(Boolean).join(" ") || null,
      description: r.description || null,
      art: r.detailsType || null,
      richtung: "eingang",
      zeileNr: i + 2,
    });
  });
  return { zeilen, uebersprungen };
}

router.post("/admin/reconcile/import", async (req: Request, res: Response) => {
  try {
    await ensureTable();

    let zeilen: CsvZeile[];
    let uebersprungen = 0;
    let hinweise: string[] = [];

    if (typeof req.body?.csv === "string" && req.body.csv.trim() !== "") {
      // Bevorzugter Weg: Rohtext, serverseitig gelesen.
      let befund;
      try {
        befund = leseWiseCsv(req.body.csv, { ersatzschluessel: req.body?.ersatzschluessel === true });
      } catch (err) {
        if (err instanceof CsvFehler) {
          // Bewusst 400 mit voller Begründung: Der Admin soll SEHEN, warum die
          // Datei nicht passt, statt einen leeren Import zu bekommen.
          return res.status(400).json({ ok: false, error: err.message });
        }
        throw err;
      }
      const ent = entdoppele(befund.eingaenge);
      zeilen = ent.eindeutig;
      uebersprungen = befund.uebersprungen.length;
      hinweise = [
        `${befund.ausgaenge.length} Ausgänge und ${befund.intern.length} interne Umbuchungen übergangen`,
        ...(ent.doppelt > 0 ? [`${ent.doppelt} Dubletten in der Datei zusammengefasst`] : []),
        ...(befund.ohneDatum > 0 ? [`${befund.ohneDatum} Zeilen ohne lesbares Datum`] : []),
      ];
      if (zeilen.length > 10000) return res.status(400).json({ ok: false, error: "Zu viele Zeilen (max. 10000)" });
    } else if (Array.isArray(req.body?.rows)) {
      if (req.body.rows.length === 0) return res.status(400).json({ ok: false, error: "Keine Zeilen" });
      if (req.body.rows.length > 10000) return res.status(400).json({ ok: false, error: "Zu viele Zeilen (max. 10000)" });
      const alt = ausAltformat(req.body.rows);
      zeilen = alt.zeilen;
      uebersprungen = alt.uebersprungen;
    } else {
      return res.status(400).json({ ok: false, error: "Keine Datei übermittelt" });
    }

    if (zeilen.length === 0) {
      return res.status(400).json({
        ok: false,
        error: `Kein einziger Eingang erkannt (${uebersprungen} Zeilen übersprungen). Enthält der Auszug nur Ausgänge?`,
      });
    }

    const erg = await schreibeEingaenge(zeilen);
    console.log(
      `[FIAON-RECONCILE] Import: ${erg.imported} Eingänge, ${erg.matched} zugeordnet ` +
      `(${JSON.stringify(erg.stufen)}), ${uebersprungen} übersprungen`,
    );
    res.json({ ok: true, ...erg, skipped: uebersprungen, hinweise });
  } catch (err) {
    console.error("[FIAON-RECONCILE] import:", err);
    res.status(500).json({ ok: false, error: "Serverfehler beim Import" });
  }
});

// ═══════════════ Neu-Abgleich der bereits vorhandenen Eingänge ═══════════════
//
// Wichtig für den Altbestand: Im Bankbuch liegen Eingänge, die nur deshalb als
// „offen" gelten, weil früher ausschliesslich nach der Referenz im
// Verwendungszweck gesucht wurde. Wer ohne Referenz überwiesen hat, blieb
// liegen — auch wenn Name und Betrag eindeutig passen.
//
// Dieser Lauf nimmt jetzt dieselben Stufen wie der Import: Referenz,
// Absender-IBAN, Name mit exaktem Betrag. Verbucht wird weiterhin nichts,
// und eine von Hand gesetzte Zuordnung bleibt unangetastet.
router.post("/admin/reconcile/rematch", async (_req: Request, res: Response) => {
  try {
    await ensureTable();
    const rows = await sqlPool`
      SELECT id, reference_raw, payer_name, amount_cents FROM fiaon_bank_txns
      WHERE match_status = 'unmatched' AND applied = FALSE
      ORDER BY id ASC
    `;
    const { vorfilter } = await ladeKandidaten();
    const stufen: Record<string, number> = {};
    let matched = 0;

    for (const t of rows) {
      const cents = Number(t.amount_cents);
      const zu = await ordneZu(
        { amountCents: cents, payerName: t.payer_name, senderAccount: null, referenceRaw: t.reference_raw },
        vorfilter(t.payer_name, cents),
        refSuche,
      );
      stufen[zu.methode] = (stufen[zu.methode] ?? 0) + 1;
      if (!zu.automatisch || !zu.ref) continue;

      await sqlPool`
        UPDATE fiaon_bank_txns SET
          extracted_ref = ${zu.ref}, matched_ref = ${zu.ref}, match_status = 'matched',
          amount_ok = ${zu.betragPasst},
          note = ${zu.begruendung},
          updated_at = NOW()
        WHERE id = ${t.id} AND match_status = 'unmatched' AND applied = FALSE
      `;
      matched++;
    }
    console.log(
      `[FIAON-RECONCILE] Neu-Abgleich: ${matched} von ${rows.length} offenen Eingängen zugeordnet ` +
      `(${JSON.stringify(stufen)})`,
    );
    res.json({ ok: true, checked: rows.length, matched, stufen });
  } catch (err) {
    console.error("[FIAON-RECONCILE] rematch:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ P2-A: Fuzzy-Vorschläge (Einzahlername + Betrag) — NUR Vorschlag
// mit Konfidenz, wird NIE automatisch verbucht. Admin bestätigt per assign. ════
router.get("/admin/reconcile/:id/suggestions", async (req: Request, res: Response) => {
  try {
    await ensureTable();
    const [txn] = await sqlPool`SELECT id, payer_name, amount_cents FROM fiaon_bank_txns WHERE id = ${Number(req.params.id)}`;
    if (!txn) return res.status(404).json({ ok: false, error: "Eingang nicht gefunden" });
    const payer = String(txn.payer_name || "").toLowerCase().trim();
    if (payer.length < 3) return res.json({ ok: true, data: [] });
    const cents = Number(txn.amount_cents);
    // Kandidaten: Nachname ODER Vorname im Einzahlernamen enthalten.
    const rows = await sqlPool`
      SELECT ref, payment_reference, amount_due, payment_status,
             COALESCE(NULLIF(TRIM(CONCAT_WS(' ', first_name, last_name)), ''), contact_name, email) AS customer_name
      FROM fiaon_applications
      WHERE merged_into IS NULL
        AND (
          (last_name IS NOT NULL AND LENGTH(TRIM(last_name)) >= 3 AND ${payer} LIKE '%' || LOWER(TRIM(last_name)) || '%')
          OR (contact_name IS NOT NULL AND LENGTH(TRIM(contact_name)) >= 3 AND ${payer} LIKE '%' || LOWER(TRIM(contact_name)) || '%')
        )
      ORDER BY (ROUND(COALESCE(amount_due::numeric, 0) * 100) = ${cents}) DESC, created_at DESC
      LIMIT 5
    `;
    const data = rows.map((r: any) => {
      const amountMatch = Math.round(Number(r.amount_due || 0) * 100) === cents;
      return {
        ...r,
        confidence: amountMatch ? "hoch" : "mittel",
        confidenceLabel: amountMatch
          ? "Name im Einzahler + exakter Betrag"
          : "Name im Einzahler, Betrag weicht ab",
      };
    });
    res.json({ ok: true, data });
  } catch (err) {
    console.error("[FIAON-RECONCILE] suggestions:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ Liste (Ledger + verknüpfter Antrag) ═══════════════
router.get("/admin/reconcile/list", async (req: Request, res: Response) => {
  try {
    await ensureTable();
    const status = typeof req.query.status === "string" ? req.query.status : null;
    const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
    const limit = Math.min(1000, Math.max(1, Number(req.query.limit) || 500));
    const rows = await sqlPool`
      SELECT t.id, t.txn_id, t.booked_at, t.amount_cents, t.currency, t.payer_name, t.reference_raw,
             t.extracted_ref, t.matched_ref, t.match_status, t.amount_ok, t.applied, t.applied_at, t.note,
             a.payment_status, a.amount_due,
             COALESCE(NULLIF(TRIM(CONCAT_WS(' ', a.first_name, a.last_name)), ''), a.contact_name, a.email) AS customer_name
      FROM fiaon_bank_txns t
      LEFT JOIN fiaon_applications a ON a.ref = t.matched_ref AND a.merged_into IS NULL
      WHERE (${status}::text IS NULL OR t.match_status = ${status})
        AND (${q} = '' OR LOWER(COALESCE(t.payer_name,'') || ' ' || COALESCE(t.reference_raw,'') || ' ' || COALESCE(t.matched_ref,'')) LIKE ${"%" + q + "%"})
      ORDER BY t.booked_at DESC NULLS LAST, t.id DESC
      LIMIT ${limit}
    `;
    // P4 (#27 „Jovanovic Momir zahlte über das Konto der Mutter"): Die Referenz
    // ist der verlässliche Anker, NICHT der Einzahlername. Wenn ein Eingang zwar
    // per Referenz zugeordnet ist, der Einzahlername aber nicht zum Kundennamen
    // passt, wird ein dezenter Hinweis gesetzt („Zahlung evtl. durch Dritte").
    // Reine Sichtbarkeit — kein Automatismus, keine Zuordnungsänderung.
    const enriched = rows.map((r: any) => {
      let payerNameMismatch = false;
      if (r.matched_ref && r.payer_name && r.customer_name) {
        payerNameMismatch = !payerMatchesCustomer(r.payer_name, r.customer_name);
      }
      return {
        ...r,
        payerNameMismatch,
        payerHint: payerNameMismatch ? "Name weicht ab (Zahlung evtl. durch Dritte)" : null,
      };
    });
    res.json({ ok: true, data: enriched });
  } catch (err) {
    console.error("[FIAON-RECONCILE] list:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ Zusammenfassung (exakte Bank-Aufstellung, brutto) ═══════════════
router.get("/admin/reconcile/summary", async (_req: Request, res: Response) => {
  try {
    await ensureTable();
    const [s] = await sqlPool`
      SELECT
        COUNT(*)::int AS total_count,
        COALESCE(SUM(amount_cents),0)::bigint AS total_cents,
        COUNT(*) FILTER (WHERE match_status IN ('matched','manual'))::int AS matched_count,
        COALESCE(SUM(amount_cents) FILTER (WHERE match_status IN ('matched','manual')),0)::bigint AS matched_cents,
        COUNT(*) FILTER (WHERE match_status = 'unmatched')::int AS unmatched_count,
        COALESCE(SUM(amount_cents) FILTER (WHERE match_status = 'unmatched'),0)::bigint AS unmatched_cents,
        COUNT(*) FILTER (WHERE applied)::int AS applied_count,
        COALESCE(SUM(amount_cents) FILTER (WHERE applied),0)::bigint AS applied_cents,
        COUNT(*) FILTER (WHERE match_status IN ('matched','manual') AND amount_ok = FALSE)::int AS discrepancy_count,
        COUNT(*) FILTER (WHERE match_status = 'ignored')::int AS ignored_count
      FROM fiaon_bank_txns
    `;
    res.json({
      ok: true,
      summary: {
        totalCount: Number(s.total_count), totalCents: Number(s.total_cents),
        matchedCount: Number(s.matched_count), matchedCents: Number(s.matched_cents),
        unmatchedCount: Number(s.unmatched_count), unmatchedCents: Number(s.unmatched_cents),
        appliedCount: Number(s.applied_count), appliedCents: Number(s.applied_cents),
        discrepancyCount: Number(s.discrepancy_count), ignoredCount: Number(s.ignored_count),
      },
    });
  } catch (err) {
    console.error("[FIAON-RECONCILE] summary:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ Antragssuche (für manuelle Zuordnung) ═══════════════
router.get("/admin/reconcile/search", async (req: Request, res: Response) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
    if (q.length < 2) return res.json({ ok: true, data: [] });
    const rows = await sqlPool`
      SELECT ref, amount_due, currency, payment_status,
             COALESCE(NULLIF(TRIM(CONCAT_WS(' ', first_name, last_name)), ''), contact_name, email) AS customer_name, email
      FROM fiaon_applications
      WHERE merged_into IS NULL
        AND LOWER(COALESCE(ref,'') || ' ' || COALESCE(first_name,'') || ' ' || COALESCE(last_name,'') || ' ' || COALESCE(contact_name,'') || ' ' || COALESCE(email,'')) LIKE ${"%" + q + "%"}
      ORDER BY created_at DESC LIMIT 20
    `;
    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error("[FIAON-RECONCILE] search:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ Manuelle Zuordnung eines Eingangs zu einem Kunden ═══════════════
router.post("/admin/reconcile/:id/assign", async (req: Request, res: Response) => {
  try {
    await ensureTable();
    const id = Number(req.params.id);
    const ref = String(req.body?.ref || "").trim();
    if (!ref) return res.status(400).json({ ok: false, error: "Antrags-Referenz erforderlich" });
    const app = await findApp(ref);
    if (!app) return res.status(404).json({ ok: false, error: "Antrag nicht gefunden" });
    const [txn] = await sqlPool`SELECT amount_cents FROM fiaon_bank_txns WHERE id = ${id}`;
    if (!txn) return res.status(404).json({ ok: false, error: "Eingang nicht gefunden" });
    const amountOk = appAmountCents(app) === Number(txn.amount_cents);
    await sqlPool`
      UPDATE fiaon_bank_txns SET matched_ref = ${app.ref}, match_status = 'manual', amount_ok = ${amountOk}, updated_at = NOW()
      WHERE id = ${id}
    `;
    res.json({ ok: true, matchedRef: app.ref, amountOk });
  } catch (err) {
    console.error("[FIAON-RECONCILE] assign:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ Als „kein Kunde" ignorieren ═══════════════
router.post("/admin/reconcile/:id/ignore", async (req: Request, res: Response) => {
  try {
    await ensureTable();
    await sqlPool`UPDATE fiaon_bank_txns SET match_status = 'ignored', updated_at = NOW() WHERE id = ${Number(req.params.id)} AND applied = FALSE`;
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-RECONCILE] ignore:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * Verbucht EINEN Bank-Eingang — P2-A: IDENTISCH zum Admin-Button „bezahlt"
 * (mark-paid): Status + Freischaltung, Schwester-Dubletten superseden,
 * payment_confirmed-Mail (1×-Claim) und Provisionshook onCustomerPaid.
 * Der Hook bucht seit P2-B nur bei dokumentierter Betreuung (sonst Direktzahler).
 * Optional wird `amount_due` exakt an den Bankeingang angeglichen (syncAmount).
 * Idempotent; jede Verbuchung landet im Kontakt-Log (Audit).
 */
export async function applyTxn(id: number, syncAmount: boolean): Promise<{ ok: boolean; error?: string; ref?: string }> {
  const [txn] = await sqlPool`SELECT * FROM fiaon_bank_txns WHERE id = ${id}`;
  if (!txn) return { ok: false, error: "Eingang nicht gefunden" };
  if (txn.match_status === "ignored") return { ok: false, error: "Eingang ist als ignoriert markiert" };
  if (!txn.matched_ref) return { ok: false, error: "Kein Kunde zugeordnet" };

  const receivedCents = Number(txn.amount_cents);
  const eur = (receivedCents / 100).toFixed(2);
  const updated = await sqlPool`
    UPDATE fiaon_applications SET
      payment_status = 'paid',
      status = CASE WHEN status = 'payment_completed' THEN status ELSE 'payment_completed' END,
      account_status = CASE WHEN account_status = 'suspended' THEN account_status ELSE 'active' END,
      claimed_paid_at = COALESCE(claimed_paid_at, ${txn.booked_at}, NOW()),
      completed_at = COALESCE(completed_at, ${txn.booked_at}, NOW()),
      updated_at = NOW()
    WHERE ref = ${txn.matched_ref} AND merged_into IS NULL
    RETURNING ref
  `;
  if (updated.length === 0) return { ok: false, error: "Antrag nicht gefunden/zusammengeführt" };
  // Optional: Betrag exakt an den Bankeingang angleichen (Kunden-EINGANG, brutto).
  if (syncAmount) {
    await sqlPool`UPDATE fiaon_applications SET amount_due = ${eur}::numeric, updated_at = NOW() WHERE ref = ${txn.matched_ref} AND merged_into IS NULL`;
  }
  await sqlPool`UPDATE fiaon_bank_txns SET applied = TRUE, applied_at = NOW(), updated_at = NOW() WHERE id = ${id}`;
  console.log(`[FIAON-RECONCILE] verbucht: ${txn.matched_ref} ← Bank ${txn.txn_id} (${eur} ${txn.currency})${syncAmount ? " [Betrag synchronisiert]" : ""}`);
  // Audit: jede Schreibaktion nachvollziehbar im Kontakt-Log.
  const mismatch = txn.amount_ok === false && !syncAmount ? " — ABWEICHUNG zum Sollbetrag, nicht übernommen" : "";
  await sqlPool`
    INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
    VALUES (${txn.matched_ref}, NULL, 'System', 'system',
            ${`Per Kontoabgleich als bezahlt verbucht — Bankeingang ${txn.txn_id || "#" + id} (${eur} ${txn.currency})${mismatch}`})
  `.catch(() => {});
  // P2-A: identische Nacharbeit wie mark-paid —
  // 1. Schwester-Dubletten superseden (stoppt Erinnerungs-Kette, Attribution bleibt).
  // 2. Bezahlt-Bestätigung an den Kunden (Make 'payment_confirmed', 1×-Claim).
  // 3. Provisionshook onCustomerPaid — seit P2-B nur bei dokumentierter Betreuung
  //    (idempotent: bestehende positive Provision wird nie doppelt gebucht).
  try {
    const antrag = await import("./fiaon-antrag");
    await antrag.supersedeSisterOrders(txn.matched_ref);
    await antrag.sendPaymentConfirmedOnce(txn.matched_ref);
    const agent = await import("./fiaon-agent");
    await agent.onCustomerPaid(txn.matched_ref);
  } catch (e) {
    console.error("[FIAON-RECONCILE] Nacharbeit (supersede/confirmed/provision):", e);
  }
  return { ok: true, ref: txn.matched_ref };
}

router.post("/admin/reconcile/:id/apply", async (req: Request, res: Response) => {
  try {
    await ensureTable();
    const r = await applyTxn(Number(req.params.id), req.body?.syncAmount === true);
    if (!r.ok) return res.status(400).json({ ok: false, error: r.error });
    res.json({ ok: true, ref: r.ref });
  } catch (err) {
    console.error("[FIAON-RECONCILE] apply:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// Bulk: alle zugeordneten, noch nicht verbuchten Eingänge verbuchen.
router.post("/admin/reconcile/apply-matched", async (req: Request, res: Response) => {
  try {
    await ensureTable();
    const syncAmount = req.body?.syncAmount === true;
    const onlyAmountOk = req.body?.onlyAmountOk === true;
    const rows = await sqlPool`
      SELECT id FROM fiaon_bank_txns
      WHERE applied = FALSE AND match_status IN ('matched','manual') AND matched_ref IS NOT NULL
        AND (${onlyAmountOk} = FALSE OR amount_ok = TRUE)
      ORDER BY id ASC
    `;
    let applied = 0; const errors: string[] = [];
    for (const row of rows) {
      const r = await applyTxn(Number(row.id), syncAmount);
      if (r.ok) applied++; else errors.push(`#${row.id}: ${r.error}`);
    }
    res.json({ ok: true, applied, total: rows.length, errors });
  } catch (err) {
    console.error("[FIAON-RECONCILE] apply-matched:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
