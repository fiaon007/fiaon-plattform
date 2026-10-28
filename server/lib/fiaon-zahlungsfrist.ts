// ═══════════════════════════════════════════════════════════════════════════
// ZAHLUNGSFRIST EINER OFFENEN BESTELLUNG SETZEN — EIN Weg (E-432, 28.10.2026)
//
// Bis heute stand dieser Schritt nur in der Route POST /admin/kunden/:ref/konditionen (Verwaltungsakte › Konditionen ›
// „Zahlungsfrist“). Das Pflege-Skript für Global-Aufträge (scripts/global-auftrag-pflegen.ts) braucht denselben Schritt — eine
// zweite Fassung derselben Datumsrechnung wäre eine zweite Gelegenheit, an der Zeitzone einen Tag zu verlieren. Deshalb hier,
// und die Route ruft ihn auf (gleiche Prüfungen, gleiche Meldungen, gleicher Protokollsatz).
//
// Gespeichert wird das ENDE des gewählten Tages in Berlin (23:59:59). Eine abgelaufene Bestellung wird wieder „offen“, wenn der
// neue Tag heute oder später ist. Eine Mail an den Kunden geht NICHT raus.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";

export type ZahlungsfristErgebnis =
  | { ok: true; geaendert: boolean; von: string; nach: string }
  | { ok: false; status: number; error: string };

export async function zahlungsfristSetzen(ref: string, tagRoh: unknown, opts: { wer?: string; grund?: string } = {}): Promise<ZahlungsfristErgebnis> {
  const [cur] = (await sqlPool`
    SELECT payment_status, payment_due_date FROM fiaon_applications WHERE ref = ${ref} AND merged_into IS NULL LIMIT 1`) as any[];
  if (!cur) return { ok: false, status: 404, error: "Kunde nicht gefunden" };
  if (!["pending_payment", "claimed_paid", "expired"].includes(String(cur.payment_status))) {
    return { ok: false, status: 409, error: "Zahlungsfrist nur bei offenen Bestellungen änderbar" };
  }
  const d = String(tagRoh || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return { ok: false, status: 400, error: "Frist ungültig (JJJJ-MM-TT)" };
  const von = cur.payment_due_date ? new Date(cur.payment_due_date).toISOString().slice(0, 10) : "—";
  if (von === d) return { ok: true, geaendert: false, von, nach: d };
  // Ende des Tages Europe/Berlin ≈ 22:00 UTC (Sommer) — bewusst 23:59 Berlin über Datums-Cast:
  await sqlPool`
    UPDATE fiaon_applications SET
      payment_due_date = (${d}::date + INTERVAL '1 day' - INTERVAL '1 second') AT TIME ZONE 'Europe/Berlin',
      payment_status = CASE WHEN payment_status = 'expired' AND ${d}::date >= (NOW() AT TIME ZONE 'Europe/Berlin')::date THEN 'pending_payment' ELSE payment_status END,
      updated_at = NOW()
    WHERE ref = ${ref}`;
  const wer = String(opts.wer || "Admin").slice(0, 80);
  const grund = String(opts.grund || "").trim().slice(0, 300);
  await sqlPool`
    INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
    VALUES (${ref}, NULL, ${wer}, 'edit', ${`Zahlungsfrist geändert durch ${wer}: ${von} → ${d}${grund ? ` — ${grund}` : ""}`})
  `.catch(() => {});
  return { ok: true, geaendert: true, von, nach: d };
}
